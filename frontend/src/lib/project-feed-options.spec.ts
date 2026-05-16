import { describe, expect, it } from "vitest";
import {
  getProjectsPageFeedParams,
  getTopProjectsFeedParams,
  PROJECTS_PAGE_COMPACT_LIMIT,
} from "./project-feed-options";

describe("project feed options", () => {
  it("uses compact payloads for the projects page", () => {
    expect(getProjectsPageFeedParams({
      page: 2,
      sort: "recent_desc",
      q: "safe drive",
      course: "Informática",
      audience: "competition",
    })).toEqual({
      page: 2,
      limit: PROJECTS_PAGE_COMPACT_LIMIT,
      view: "compact",
      sort: "recent_desc",
      q: "safe drive",
      course: "Informática",
      audience: "competition",
      likesLimit: 0,
      commentsLimit: 0,
    });
  });

  it("omits empty project feed filters", () => {
    expect(getProjectsPageFeedParams({ q: " ", course: "", audience: "all" })).not.toHaveProperty("q");
    expect(getProjectsPageFeedParams({ q: " ", course: "", audience: "all" })).not.toHaveProperty("course");
  });

  it("requests the top projects from server-side vote ordering", () => {
    expect(getTopProjectsFeedParams()).toMatchObject({
      page: 1,
      view: "compact",
      sort: "votes_desc",
      likesLimit: 0,
      commentsLimit: 0,
    });
  });
});
