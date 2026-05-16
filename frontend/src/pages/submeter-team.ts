export const MAX_SUBMISSION_TEAM_MEMBERS = 17;
export const MAX_ADDITIONAL_TEAM_MEMBERS = MAX_SUBMISSION_TEAM_MEMBERS - 1;

function normalizeMemberName(value?: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeMemberKey(value?: string | null) {
  return normalizeMemberName(value).toLowerCase();
}

export function buildSubmissionMembers(input: {
  leaderName?: string | null;
  members: string[];
}) {
  const seen = new Set<string>();
  const ordered = [input.leaderName ?? "", ...input.members];

  return ordered
    .map((member) => normalizeMemberName(member))
    .filter((member) => {
      if (!member) return false;
      const key = normalizeMemberKey(member);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_SUBMISSION_TEAM_MEMBERS);
}

export function isSubmittingStudentMember(input: {
  leaderName?: string | null;
  memberName: string;
}) {
  const leaderKey = normalizeMemberKey(input.leaderName);
  return Boolean(leaderKey && leaderKey === normalizeMemberKey(input.memberName));
}

export function getAdditionalSubmissionMembers(input: {
  leaderName?: string | null;
  members: string[];
}) {
  const leaderKey = normalizeMemberKey(input.leaderName);

  return buildSubmissionMembers({ leaderName: null, members: input.members })
    .filter((member) => !leaderKey || normalizeMemberKey(member) !== leaderKey)
    .slice(0, MAX_ADDITIONAL_TEAM_MEMBERS);
}

export function getAdditionalMemberInputPlaceholder(additionalMemberCount: number) {
  const nextMemberNumber = Math.min(
    MAX_SUBMISSION_TEAM_MEMBERS,
    Math.max(2, additionalMemberCount + 2),
  );
  return `Adicionar nome do ${nextMemberNumber}.º membro`;
}
