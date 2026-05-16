import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workspaceSource = readFileSync(
  path.join(process.cwd(), "src/features/admin/AdminWorkspace.tsx"),
  "utf8",
);

const apiSource = readFileSync(
  path.join(process.cwd(), "src/lib/api.ts"),
  "utf8",
);

describe("admin submission team members editor", () => {
  it("adds an admin modal that edits the submitted group list", () => {
    expect(workspaceSource).toContain("teamMembersDialogSubmission");
    expect(workspaceSource).toContain("handleSubmissionTeamMembersSave");
    expect(workspaceSource).toContain("Editar membros");
    expect(workspaceSource).toContain("Um nome por linha");
    expect(workspaceSource).toContain("api.submissions.updateTeamMembers");
  });

  it("calls the admin team members endpoint with PATCH", () => {
    expect(apiSource).toContain("updateTeamMembers: (id: number, members: string[])");
    expect(apiSource).toContain("`/submissions/${id}/team/members`");
    expect(apiSource).toContain('method: "PATCH"');
  });

  it("adds a guarded admin action for secretaria-based member confirmation", () => {
    expect(workspaceSource).toContain("handleConfirmSubmissionTeamMemberFromAdmin");
    expect(workspaceSource).toContain("Confirmar pela secretaria");
    expect(workspaceSource).toContain("member.expectedStudentNumber");
    expect(apiSource).toContain("confirmTeamMemberFromAdmin");
    expect(apiSource).toContain("`/submissions/${id}/team/members/${memberId}/confirm`");
  });
});
