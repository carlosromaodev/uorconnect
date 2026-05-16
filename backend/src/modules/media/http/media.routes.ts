import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Env } from "../../../config/env";
import { prisma } from "../../../shared/prisma";
import { adminGuard, setDefaultAdminPermission } from "../../auth/http/admin.middleware";
import { authGuard } from "../../auth/http/auth.middleware";
import {
  cleanupOrphanedMediaFiles,
  getMediaStoragePolicy,
  isPrivateStoredMediaUrl,
  isStoredMediaUrl,
  resolveStoredMediaFile,
  storeMediaDataUrl,
} from "../application/media-storage";
import { getMissingImagePlaceholder } from "../application/missing-media-placeholder";

const mediaUploadSchema = z.object({
  dataUrl: z.string().min(20).max(12_000_000),
  purpose: z.string().trim().min(2).max(60).default("general"),
  allowDocuments: z.boolean().optional(),
  maxImageDimension: z.number().int().min(128).max(2400).optional(),
});

const mediaResponseSchema = z.object({
  url: z.string(),
  thumbnailUrl: z.string().nullable(),
  mimeType: z.string(),
  originalMimeType: z.string(),
  size: z.number(),
  originalSize: z.number(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  metadataUrl: z.string(),
});

const cleanupResultSchema = z.object({
  scanned: z.number(),
  orphaned: z.number(),
  deleted: z.number(),
  bytesDeleted: z.number(),
  dryRun: z.boolean(),
  retentionDays: z.number(),
});

function addStoredMediaUrl(target: Set<string>, value?: string | null) {
  const trimmed = value?.trim();
  if (trimmed && isStoredMediaUrl(trimmed)) target.add(trimmed);
}

function addStoredMediaUrlsFromText(target: Set<string>, value?: string | null) {
  if (!value) return;
  for (const match of value.matchAll(/\/(?:api\/)?media\/files\/[^\s"'<>),]+/g)) {
    addStoredMediaUrl(target, match[0]);
  }
}

async function collectReferencedMediaUrls() {
  const referenced = new Set<string>();
  const [students, credentials, membershipClaims, speakers, submissions, courses, enrollments, whatsappCampaigns, homeConfigs] = await Promise.all([
    prisma.student.findMany({ select: { avatarUrl: true } }),
    prisma.eventTeamCredential.findMany({ select: { photoUrl: true } }),
    prisma.teamMembershipClaim.findMany({ select: { photoUrl: true } }),
    prisma.speaker.findMany({ select: { avatarUrl: true } }),
    prisma.submission.findMany({ select: { paymentProof: true, bannerUrl: true } }),
    prisma.course.findMany({ select: { companyLogoUrl: true } }),
    prisma.courseEnrollment.findMany({ select: { paymentProof: true } }),
    prisma.whatsAppCampaign.findMany({ select: { mediaUrl: true } }),
    prisma.homeSocialConfig.findMany({ select: { sponsorsJson: true, heroFloatingIconsJson: true } }),
  ]);

  students.forEach((item) => addStoredMediaUrl(referenced, item.avatarUrl));
  credentials.forEach((item) => addStoredMediaUrl(referenced, item.photoUrl));
  membershipClaims.forEach((item) => addStoredMediaUrl(referenced, item.photoUrl));
  speakers.forEach((item) => addStoredMediaUrl(referenced, item.avatarUrl));
  submissions.forEach((item) => {
    addStoredMediaUrl(referenced, item.paymentProof);
    addStoredMediaUrl(referenced, item.bannerUrl);
  });
  courses.forEach((item) => addStoredMediaUrl(referenced, item.companyLogoUrl));
  enrollments.forEach((item) => addStoredMediaUrl(referenced, item.paymentProof));
  whatsappCampaigns.forEach((item) => addStoredMediaUrl(referenced, item.mediaUrl));
  homeConfigs.forEach((item) => {
    addStoredMediaUrlsFromText(referenced, item.sponsorsJson);
    addStoredMediaUrlsFromText(referenced, item.heroFloatingIconsJson);
  });

  return referenced;
}

export async function mediaRoutes(app: FastifyInstance, opts: { env: Env }) {
  app.get("/files/*", {
    schema: {
      response: {
        404: z.object({ message: z.string() }),
      },
    },
  }, async (request, reply) => {
    const wildcardPath = (request.params as { "*": string })["*"];
    if (isPrivateStoredMediaUrl(`/media/files/${wildcardPath}`)) {
      return reply.code(404).send({ message: "Ficheiro não encontrado." });
    }

    const media = await resolveStoredMediaFile(opts.env, `/media/files/${wildcardPath}`).catch(() => null);
    if (!media) {
      const placeholder = getMissingImagePlaceholder(`/media/files/${wildcardPath}`);
      if (placeholder) {
        reply.header("Cache-Control", "no-store");
        reply.type(placeholder.mimeType);
        return reply.send(placeholder.body);
      }

      return reply.code(404).send({ message: "Ficheiro não encontrado." });
    }

    reply.header("Content-Type", media.mimeType);
    reply.header("Cache-Control", "public, max-age=31536000, immutable");
    if (media.size) reply.header("Content-Length", String(media.size));
    return reply.send(media.stream);
  });

  app.register(async (protectedApp) => {
    protectedApp.register(authGuard, { env: opts.env });

    protectedApp.post("/upload", {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: 60_000,
        },
      },
      schema: {
        body: mediaUploadSchema,
        response: {
          200: mediaResponseSchema,
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
        },
      },
    }, async (request, reply) => {
      try {
        const body = mediaUploadSchema.parse(request.body);
        return await storeMediaDataUrl(opts.env, body.dataUrl, {
          purpose: body.purpose,
          allowDocuments: body.allowDocuments,
          maxImageDimension: body.maxImageDimension,
        });
      } catch (error) {
        return reply.code(400).send({
          message: error instanceof Error ? error.message : "Não foi possível guardar o ficheiro.",
        });
      }
    });
  });

  app.register(async (adminApp) => {
    adminApp.register(authGuard, { env: opts.env });
    adminApp.register(adminGuard);
    setDefaultAdminPermission(adminApp, ["SECURITY"]);

    adminApp.get("/admin/storage-policy", {
      schema: {
        response: {
          200: z.object({
            imageMimeTypes: z.array(z.string()),
            documentMimeTypes: z.array(z.string()),
            defaultImageMaxBytes: z.number(),
            defaultDocumentMaxBytes: z.number(),
            defaultMaxImageDimension: z.number(),
            defaultThumbnailDimension: z.number(),
            publicCacheMaxAgeSeconds: z.number(),
            orphanRetentionDays: z.number(),
            privatePurposes: z.array(z.string()),
          }),
        },
      },
    }, async () => getMediaStoragePolicy(opts.env));

    adminApp.post("/admin/cleanup-orphans", {
      schema: {
        body: z.object({
          dryRun: z.boolean().optional().default(true),
          retentionDays: z.number().int().min(1).max(365).optional(),
        }).optional(),
        response: {
          200: cleanupResultSchema,
        },
      },
    }, async (request) => {
      const body = (request.body ?? {}) as { dryRun?: boolean; retentionDays?: number };
      const referenced = await collectReferencedMediaUrls();
      return cleanupOrphanedMediaFiles(opts.env, referenced, {
        dryRun: body.dryRun ?? true,
        retentionDays: body.retentionDays,
      });
    });
  });
}
