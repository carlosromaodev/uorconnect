import { describe, expect, it } from "vitest";

import {
  buildSubmissionMembers,
  getAdditionalMemberInputPlaceholder,
  getAdditionalSubmissionMembers,
  MAX_SUBMISSION_TEAM_MEMBERS,
} from "./submeter-team";

describe("Submeter team members", () => {
  it("places the submitting student as the first team member", () => {
    expect(
      buildSubmissionMembers({
        leaderName: "Carlos Junior",
        members: ["Patricia Cayeye", "Victorino Ricardo"],
      }),
    ).toEqual(["Carlos Junior", "Patricia Cayeye", "Victorino Ricardo"]);
  });

  it("treats manually added members as second, third and following members", () => {
    expect(getAdditionalMemberInputPlaceholder(0)).toBe("Adicionar nome do 2.º membro");
    expect(getAdditionalMemberInputPlaceholder(1)).toBe("Adicionar nome do 3.º membro");
    expect(getAdditionalMemberInputPlaceholder(15)).toBe("Adicionar nome do 17.º membro");
  });

  it("does not duplicate the submitting student and keeps the total limit at 17", () => {
    const members = buildSubmissionMembers({
      leaderName: "Carlos Junior",
      members: [
        "Carlos Junior",
        ...Array.from({ length: 17 }, (_, index) => `Membro ${index + 2}`),
      ],
    });

    expect(members).toHaveLength(MAX_SUBMISSION_TEAM_MEMBERS);
    expect(members[0]).toBe("Carlos Junior");
    expect(MAX_SUBMISSION_TEAM_MEMBERS).toBe(17);
    expect(members).toContain("Membro 17");
    expect(members).not.toContain("Membro 18");
  });

  it("keeps receipt members editable without showing the submitting student twice", () => {
    expect(
      getAdditionalSubmissionMembers({
        leaderName: "Carlos Junior",
        members: ["Carlos Junior", "Patricia Cayeye"],
      }),
    ).toEqual(["Patricia Cayeye"]);
  });
});
