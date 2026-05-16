import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("team membership CRUD contract", () => {
  it("keeps the Nucleus list as an admin-managed digital registry", () => {
    const routes = source("src/modules/team-credentials/http/team-credentials.routes.ts");

    expect(routes).toContain("adminApp.get(\"/admin/team-memberships\"");
    expect(routes).toContain("adminApp.post(\"/admin/team-memberships\"");
    expect(routes).toContain("adminApp.patch(\"/admin/team-memberships/:id\"");
    expect(routes).toContain("adminApp.delete(\"/admin/team-memberships/:id\"");
  });

  it("soft-removes memberships and disables linked operational credentials", () => {
    const routes = source("src/modules/team-credentials/http/team-credentials.routes.ts");

    expect(routes).toContain("status: \"REMOVED\"");
    expect(routes).toContain("prisma.eventTeamCredential.updateMany");
    expect(routes).toContain("status: \"DISABLED\"");
    expect(routes).toContain("team_membership.remove");
  });

  it("creates member invitation links bound to the official membership", () => {
    const routes = source("src/modules/team-credentials/http/team-credentials.routes.ts");

    expect(routes).toContain("teamMembershipId: membership?.id ?? null");
    expect(routes).toContain("const initialStatus = membership ? \"INVITED\"");
    expect(routes).toContain("Só é possível criar credencial para membro oficial ativo.");
  });

  it("routes Nucleus possession through an auditable approval request", () => {
    const routes = source("src/modules/team-credentials/http/team-credentials.routes.ts");
    const schema = source("prisma/schema.prisma");
    const env = source("src/config/env.ts");

    expect(schema).toContain("model TeamMembershipClaim");
    expect(routes).toContain("protectedApp.post(\"/invitations/:token/nucleus-claim-request\"");
    expect(routes).toContain("adminApp.get(\"/admin/nucleus-claims\"");
    expect(routes).toContain("adminApp.post(\"/admin/nucleus-claims/:id/approve\"");
    expect(routes).toContain("adminApp.post(\"/admin/nucleus-claims/:id/reject\"");
    expect(routes).toContain("A tomada de posse do Núcleo agora exige solicitação e aprovação administrativa.");
    expect(routes).toContain("A importação da lista antiga do Núcleo foi desativada.");
    expect(routes).toContain("team_membership_claim.approve");
    expect(routes).toContain("team_membership_claim.reject");
    expect(env).not.toContain("NUCLEUS_MEMBERS_JSON");
  });
});
