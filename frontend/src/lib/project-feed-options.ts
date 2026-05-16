import type { ProjectFeedAudience, ProjectFeedSort } from "./api";

export const PROJECTS_PAGE_COMPACT_LIMIT = 36;
export const PROJECTS_TOP_LIMIT = 6;

export function getProjectsPageFeedParams({
  page = 1,
  sort = "recent_desc",
  q = "",
  course = "",
  audience = "all",
}: {
  page?: number;
  sort?: ProjectFeedSort;
  q?: string;
  course?: string;
  audience?: ProjectFeedAudience;
} = {}) {
  const query = q.trim();
  const courseFilter = course.trim();

  return {
    page,
    limit: PROJECTS_PAGE_COMPACT_LIMIT,
    view: "compact" as const,
    sort,
    ...(query ? { q: query } : {}),
    ...(courseFilter ? { course: courseFilter } : {}),
    ...(audience !== "all" ? { audience } : {}),
    likesLimit: 0,
    commentsLimit: 0,
  };
}

export function getTopProjectsFeedParams() {
  return {
    page: 1,
    limit: PROJECTS_TOP_LIMIT,
    view: "compact" as const,
    sort: "votes_desc" as const,
    likesLimit: 0,
    commentsLimit: 0,
  };
}
