import { describe, expect, it } from "vitest";
import {
  getProjectTeamCardState,
  getProjectTeamConfirmationOverview,
  requiresProjectTeamConfirmation,
  type StudentAreaProjectTeamState,
} from "./student-area-projects";

const project = (
  overrides: Partial<StudentAreaProjectTeamState> = {},
): StudentAreaProjectTeamState => ({
  status: "APPROVED",
  teamAllConfirmed: false,
  teamConfirmedMembers: 1,
  teamTotalMembers: 2,
  teamMembers: [
    { isResponsible: true, confirmed: true },
    { isResponsible: false, confirmed: false },
  ],
  ...overrides,
});

describe("student area project team state", () => {
  it("treats rejected projects as non-confirmable", () => {
    const rejected = project({ status: "REJECTED" });

    expect(requiresProjectTeamConfirmation(rejected)).toBe(false);
    expect(getProjectTeamCardState(rejected)).toMatchObject({
      canManageMembers: false,
      canShareInvite: false,
      pendingMembers: 0,
      showMemberConfirmationList: false,
      label: "Confirmação dispensada",
    });
  });

  it("keeps confirmation progress individual to each project", () => {
    const confirmed = project({ teamAllConfirmed: true, teamConfirmedMembers: 2 });
    const newPending = project({ teamAllConfirmed: false, teamConfirmedMembers: 1 });

    const overview = getProjectTeamConfirmationOverview([confirmed, newPending]);

    expect(overview.hasTeamConfirmationDone).toBe(true);
    expect(overview.pendingProjects).toHaveLength(1);
    expect(overview.completedProjects).toHaveLength(1);
  });

  it("does not mark a single active team project as confirmed while members are missing", () => {
    const overview = getProjectTeamConfirmationOverview([project()]);

    expect(overview.hasTeamConfirmationDone).toBe(false);
    expect(overview.pendingProjects).toHaveLength(1);
  });

  it("does not require confirmation for individual projects", () => {
    const individual = project({
      teamAllConfirmed: true,
      teamConfirmedMembers: 1,
      teamTotalMembers: 1,
      teamMembers: [{ isResponsible: true, confirmed: true }],
    });

    expect(requiresProjectTeamConfirmation(individual)).toBe(false);
    expect(getProjectTeamConfirmationOverview([individual]).hasTeamConfirmationDone).toBe(true);
  });

  it("keeps confirmed members in read-only mode inside Minha Área", () => {
    const memberProject = project({
      teamInviteUrl: "https://uorconnect.space/equipa/team_123",
      viewerRole: "MEMBRO",
      canManageTeam: false,
    });

    expect(getProjectTeamCardState(memberProject)).toMatchObject({
      canManageMembers: false,
      canShareInvite: false,
      showMemberConfirmationList: true,
    });
  });

  it("blocks the team invite while pending members do not have student numbers", () => {
    const pendingWithoutNumber = project({
      teamInviteUrl: "https://uorconnect.space/equipa/team_123",
      teamMembers: [
        { isResponsible: true, confirmed: true },
        { isResponsible: false, confirmed: false, expectedStudentNumber: null },
      ],
    });

    expect(getProjectTeamCardState(pendingWithoutNumber)).toMatchObject({
      canPrepareInvite: true,
      canShareInvite: false,
      missingMemberStudentNumbers: true,
    });
  });

  it("allows the team invite after every pending member has a student number", () => {
    const pendingWithNumber = project({
      teamInviteUrl: "https://uorconnect.space/equipa/team_123",
      teamMembers: [
        { isResponsible: true, confirmed: true },
        {
          isResponsible: false,
          confirmed: false,
          expectedStudentNumber: "20250108",
        },
      ],
    });

    expect(getProjectTeamCardState(pendingWithNumber)).toMatchObject({
      canShareInvite: true,
      missingMemberStudentNumbers: false,
    });
  });
});
