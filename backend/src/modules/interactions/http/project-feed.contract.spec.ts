import { describe, expect, it } from "vitest";
import {
  PROJECT_FEED_PAYLOAD_LIMITS,
  buildProjectFeedWhere,
  getProjectFeedCacheControl,
  buildProjectFeedOrderBy,
  resolveProjectFeedPreviewLimits,
} from "./interactions.routes";

describe("project feed payload contract", () => {
  it("keeps public feed pages bounded for normal devices", () => {
    expect(PROJECT_FEED_PAYLOAD_LIMITS.defaultPageSize).toBeLessThanOrEqual(24);
    expect(PROJECT_FEED_PAYLOAD_LIMITS.maxPageSize).toBeLessThanOrEqual(48);
  });

  it("does not return full interaction histories in feed cards", () => {
    const maxPreviewItemsPerPage = PROJECT_FEED_PAYLOAD_LIMITS.maxPageSize * (
      PROJECT_FEED_PAYLOAD_LIMITS.maxLikesPreview + PROJECT_FEED_PAYLOAD_LIMITS.maxCommentsPreview
    );

    expect(maxPreviewItemsPerPage).toBeLessThanOrEqual(960);
    expect(PROJECT_FEED_PAYLOAD_LIMITS.maxDetailComments).toBeLessThanOrEqual(100);
  });

  it("orders the public feed by global vote counts when requested", () => {
    expect(buildProjectFeedOrderBy("votes_desc")).toEqual([
      { studentVotes: { _count: "desc" } },
      { createdAt: "desc" },
      { id: "desc" },
    ]);
  });

  it("forces compact feed cards to skip heavy interaction previews", () => {
    expect(resolveProjectFeedPreviewLimits({
      view: "compact",
      likesLimit: PROJECT_FEED_PAYLOAD_LIMITS.defaultLikesPreview,
      commentsLimit: PROJECT_FEED_PAYLOAD_LIMITS.defaultCommentsPreview,
    })).toEqual({
      likesLimit: 0,
      commentsLimit: 0,
    });
  });

  it("builds a searchable public feed filter without removing the approved project guard", () => {
    const where = buildProjectFeedWhere({
      q: "safe",
      course: "Informática",
      audience: "all",
    });

    expect(where).toMatchObject({
      AND: [
        { status: "APPROVED", deletedAt: null },
        expect.objectContaining({
          OR: expect.arrayContaining([
            { name: { contains: "safe" } },
            { name: { contains: "Safe" } },
            { name: { contains: "SAFE" } },
            { description: { contains: "safe" } },
            { course: { contains: "safe" } },
            { members: { contains: "safe" } },
            { area: { contains: "safe" } },
          ]),
        }),
        { course: { contains: "Informática" } },
      ],
    });
  });

  it("maps exhibition filters to business and product submissions, including legacy area values", () => {
    expect(buildProjectFeedWhere({
      q: "",
      course: "",
      audience: "exhibitions",
    })).toEqual({
      AND: [
        { status: "APPROVED", deletedAt: null },
        {
          OR: [
            { type: { in: ["BUSINESS", "PRODUCT"] } },
            { area: { contains: "Negócio" } },
            { area: { contains: "negocio" } },
            { area: { contains: "Produto" } },
            { area: { contains: "produto" } },
          ],
        },
      ],
    });
  });

  it("uses short-lived public cache for compact project feeds", () => {
    expect(getProjectFeedCacheControl("compact")).toBe("public, max-age=15, stale-while-revalidate=30");
    expect(getProjectFeedCacheControl("cards")).toBe("public, max-age=5, stale-while-revalidate=15");
  });
});
