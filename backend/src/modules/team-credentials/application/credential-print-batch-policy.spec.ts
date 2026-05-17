import { describe, expect, it } from "vitest";

import {
  applyOfficialMembershipToNucleusBatchCredential,
  isOfficialNucleusBatchCredential,
} from "./credential-print-batch-policy";

const baseCredential = {
  id: 21,
  category: "NUCLEO",
  teamMembershipId: 7,
  team: "Geral",
  role: "Admin geral",
  accessLevel: "Admin geral",
  permissions: "OVERVIEW,SECURITY",
  name: "Victorino Ricardo",
};

const activeMembership = {
  id: 7,
  category: "NUCLEO",
  status: "ACTIVE",
  team: "Logística e Protocolo",
  role: "Protocolo",
  accessLevel: "Operação",
  permissions: "NUCLEUS,CREDENTIALS",
  fullName: "Victorino Ricardo",
};

describe("credential print batch policy", () => {
  it("bloqueia credenciais do núcleo sem ligação à lista oficial de membros", () => {
    expect(
      isOfficialNucleusBatchCredential(
        { ...baseCredential, teamMembershipId: null },
        null,
      ),
    ).toBe(false);
  });

  it("usa área e função atuais da lista oficial ao imprimir lote do núcleo", () => {
    const normalized = applyOfficialMembershipToNucleusBatchCredential(
      baseCredential,
      activeMembership,
    );

    expect(isOfficialNucleusBatchCredential(normalized, activeMembership)).toBe(true);
    expect(normalized.name).toBe("Victorino Ricardo");
    expect(normalized.team).toBe("Logística e Protocolo");
    expect(normalized.role).toBe("Protocolo");
    expect(normalized.accessLevel).toBe("Operação");
    expect(normalized.permissions).toBe("NUCLEUS,CREDENTIALS");
  });

  it("não altera credenciais que não são do núcleo", () => {
    const exhibitor = {
      ...baseCredential,
      category: "EXPOSITOR",
      teamMembershipId: null,
      team: "Expositores",
      role: "Projeto",
      accessLevel: "Expositor",
    };

    expect(isOfficialNucleusBatchCredential(exhibitor, null)).toBe(true);
    expect(applyOfficialMembershipToNucleusBatchCredential(exhibitor, null)).toBe(exhibitor);
  });
});
