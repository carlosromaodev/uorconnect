import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../../shared/prisma";

export async function statsRoutes(app: FastifyInstance) {
  app.get("/", {
    schema: {
      response: {
        200: z.object({
          participants: z.number(),
          submissions: z.number(),
          approved: z.number(),
          votes: z.number(),
          avgRating: z.number()
        })
      }
    }
  }, async () => {
    const [students, submissions, approved, votes, avg] = await Promise.all([
      prisma.student.count(),
      prisma.submission.count(),
      prisma.submission.count({ where: { status: "APPROVED" } }),
      prisma.vote.count(),
      prisma.review.aggregate({ _avg: { rating: true } })
    ]);

    return {
      participants: students,
      submissions,
      approved,
      votes,
      avgRating: Number((avg._avg.rating ?? 0).toFixed(1))
    };
  });
}
