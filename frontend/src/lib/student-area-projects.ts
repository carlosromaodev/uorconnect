export type StudentAreaProjectTeamMemberState = {
  isResponsible?: boolean;
  confirmed?: boolean;
  expectedStudentNumber?: string | null;
};

export type StudentAreaProjectTeamState = {
  status?: string | null;
  viewerRole?: "RESPONSAVEL" | "MEMBRO" | string | null;
  canManageTeam?: boolean | null;
  teamAllConfirmed: boolean;
  teamConfirmedMembers: number;
  teamTotalMembers: number;
  teamInviteUrl?: string | null;
  teamJourneyLabel?: string | null;
  teamMembers?: StudentAreaProjectTeamMemberState[] | null;
};

export function isRejectedProjectSubmission(project: StudentAreaProjectTeamState) {
  return project.status === "REJECTED";
}

export function hasAdditionalProjectMembers(project: StudentAreaProjectTeamState) {
  const members = project.teamMembers ?? [];
  if (members.length > 0) {
    return members.some((member) => !member.isResponsible);
  }

  return project.teamTotalMembers > 1;
}

export function requiresProjectTeamConfirmation(project: StudentAreaProjectTeamState) {
  return !isRejectedProjectSubmission(project) && hasAdditionalProjectMembers(project);
}

export function getProjectTeamConfirmationOverview<T extends StudentAreaProjectTeamState>(
  projects: T[],
) {
  const activeProjects = projects.filter((project) => !isRejectedProjectSubmission(project));
  const confirmableProjects = activeProjects.filter(requiresProjectTeamConfirmation);
  const completedProjects = confirmableProjects.filter((project) => project.teamAllConfirmed);
  const pendingProjects = confirmableProjects.filter((project) => !project.teamAllConfirmed);

  return {
    activeProjects,
    confirmableProjects,
    completedProjects,
    pendingProjects,
    hasTeamConfirmationDone: confirmableProjects.length === 0
      ? activeProjects.length > 0
      : completedProjects.length > 0,
  };
}

export function getProjectTeamCardState(project: StudentAreaProjectTeamState) {
  const rejected = isRejectedProjectSubmission(project);
  const confirmationRequired = requiresProjectTeamConfirmation(project);
  const confirmed = !confirmationRequired || project.teamAllConfirmed;
  const missingMemberStudentNumbers = confirmationRequired
    && (project.teamMembers ?? []).some((member) => (
      !member.isResponsible
      && !member.confirmed
      && !member.expectedStudentNumber?.trim()
    ));
  const canManageTeam = !rejected
    && project.viewerRole !== "MEMBRO"
    && project.canManageTeam !== false;
  const label = rejected
    ? "Confirmação dispensada"
    : confirmationRequired
      ? project.teamJourneyLabel ?? (confirmed ? "Equipa confirmada" : "Confirmação pendente")
      : "Equipa individual";

  return {
    confirmationRequired,
    confirmed,
    isRejected: rejected,
    label,
    pendingMembers: confirmationRequired
      ? Math.max(0, project.teamTotalMembers - project.teamConfirmedMembers)
      : 0,
    canManageMembers: canManageTeam,
    canPrepareInvite: canManageTeam && confirmationRequired && Boolean(project.teamInviteUrl),
    canShareInvite: canManageTeam
      && confirmationRequired
      && Boolean(project.teamInviteUrl)
      && !missingMemberStudentNumbers,
    missingMemberStudentNumbers,
    showMemberConfirmationList: !rejected && Boolean(project.teamMembers?.length),
  };
}
