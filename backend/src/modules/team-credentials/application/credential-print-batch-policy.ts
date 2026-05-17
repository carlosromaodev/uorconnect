export type NucleusBatchCredential = {
  category: string;
  teamMembershipId: number | null;
  team: string;
  role: string;
  accessLevel: string;
  permissions: string;
  name: string | null;
};

export type NucleusBatchMembership = {
  id: number;
  category: string;
  status: string;
  team: string;
  role: string;
  accessLevel: string;
  permissions: string;
  fullName: string;
};

export function isOfficialNucleusBatchCredential(
  credential: Pick<NucleusBatchCredential, "category" | "teamMembershipId">,
  membership?: Pick<NucleusBatchMembership, "category" | "status"> | null,
) {
  if (credential.category !== "NUCLEO") return true;
  return Boolean(
    credential.teamMembershipId &&
      membership &&
      membership.status === "ACTIVE" &&
      membership.category === "NUCLEO",
  );
}

export function applyOfficialMembershipToNucleusBatchCredential<
  Credential extends NucleusBatchCredential,
>(
  credential: Credential,
  membership?: NucleusBatchMembership | null,
): Credential {
  if (!isOfficialNucleusBatchCredential(credential, membership) || !membership) {
    return credential;
  }

  return {
    ...credential,
    category: membership.category,
    team: membership.team,
    role: membership.role,
    accessLevel: membership.accessLevel,
    permissions: membership.permissions,
    name: membership.fullName,
  };
}
