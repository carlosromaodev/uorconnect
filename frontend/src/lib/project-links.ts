import type { ProjectPublicFeedItem, SubmissionPresentation } from "@/lib/api";

type ProjectLinkSource = Pick<ProjectPublicFeedItem, "slug"> | Pick<SubmissionPresentation, "slug">;

export function getProjectDetailPath(slug: string) {
  return `/projeto/${slug}`;
}

export function getProjectShareUrl(project: ProjectLinkSource) {
  const detailPath = getProjectDetailPath(project.slug);

  if (typeof window === "undefined") {
    return detailPath;
  }

  return new URL(detailPath, window.location.origin).toString();
}
