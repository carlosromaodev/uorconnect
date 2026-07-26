import type { UorStudentOfficialDataRepository, UorStudentIdentity, UorStudentPublicIdentityResolver } from "../application/ports";
import type { LiveUorStudentAuthorizationApplication } from "../authorizations/authorization-service";
import { UorStudentError } from "../domain/errors";
import type { UorStudentDataBlock } from "../domain/models";

function canonical(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}
function value(record: Record<string, unknown>, aliases: string[]) {
  const keys = new Set(aliases.map(canonical));
  return Object.entries(record).find(([key]) => keys.has(canonical(key)))?.[1] ?? null;
}
function safeScalar(input: unknown): string | number | boolean | null {
  return typeof input === "string" || typeof input === "number" || typeof input === "boolean" ? input : null;
}

export class UorStudentDelegatedFinanceApplication {
  constructor(
    private readonly authorizations: LiveUorStudentAuthorizationApplication,
    private readonly officialData: UorStudentOfficialDataRepository,
    private readonly identities: UorStudentPublicIdentityResolver,
  ) {}

  async getSharedReference(input: { student: UorStudentIdentity; authorizationId: string; traceId?: string }) {
    const authorization = await this.authorizations.get(input.student, input.authorizationId);
    if (authorization.representativeProfileId === authorization.ownerProfileId || authorization.purpose !== "finance_reference_sharing" || authorization.action !== "finance.reference.view" || authorization.resourceType !== "payment_reference") {
      throw new UorStudentError("UOR_STUDENT_FINANCE_SHARE_INVALID", "A autorização não corresponde a uma partilha de referência.", 403);
    }
    let cursor: string | undefined;
    let selected: { id: string; attributes: Record<string, unknown> } | null = null;
    let provenance: UorStudentDataBlock | null = null;
    const owner = await this.#ownerIdentity(authorization.ownerProfileId, input.student.institutionCode);
    for (let page = 0; page < 20; page += 1) {
      const result = await this.officialData.getDataset({ student: owner, domain: "finance.references", limit: 100, cursor });
      selected = result.items.find((item) => item.id === authorization.resourceId) ?? null;
      provenance = result.provenance;
      if (selected || !result.pagination.nextCursor) break;
      cursor = result.pagination.nextCursor;
    }
    if (!selected || !provenance) throw new UorStudentError("UOR_STUDENT_SHARED_REFERENCE_NOT_FOUND", "A referência partilhada não está disponível.", 404);
    await this.authorizations.consume({ student: input.student, authorizationId: authorization.id, purpose: authorization.purpose, action: authorization.action, resourceType: authorization.resourceType, resourceId: authorization.resourceId, fields: authorization.fields, traceId: input.traceId });
    return {
      authorizationId: authorization.id,
      referenceId: selected.id,
      entity: safeScalar(value(selected.attributes, ["entity", "entidade", "merchant", "institution"])),
      reference: safeScalar(value(selected.attributes, ["reference", "referencia", "paymentReference", "numeroReferencia"])),
      amount: safeScalar(value(selected.attributes, ["amount", "valor", "total", "montante"])),
      currency: safeScalar(value(selected.attributes, ["currency", "moeda"])) ?? "AOA",
      expiresAt: safeScalar(value(selected.attributes, ["expiresAt", "validUntil", "validade", "dataLimite"])),
      status: safeScalar(value(selected.attributes, ["status", "state", "estado"])),
      provenance,
    };
  }

  async #ownerIdentity(profileId: string, institutionCode: string) {
    const owner = await this.identities.findByProfileId({ profileId, institutionCode });
    if (!owner) throw new UorStudentError("UOR_STUDENT_FINANCE_SHARE_INVALID", "O titular da partilha não está disponível.", 404);
    return owner;
  }
}
