import { afterEach, describe, expect, it, vi } from "vitest";
import type { SecretariaSession } from "../domain/models";
import { NetpaSecretariaGateway } from "./netpa-secretaria.gateway";

const session: SecretariaSession = { cookies: { session: "test-cookie" }, authenticatedAt: "2026-07-21T20:00:00.000Z" };
const selection = {
  id: "internal-item-id",
  idFinanceira: "internal-finance-id",
  inputId: "internal-input-id",
};

function form(stage: string) {
  return `<html><body><form name="wizPagamentos"><input name="_formsubmitstage" value="${stage}"></form></body></html>`;
}

function testGateway() {
  return new NetpaSecretariaGateway({
    baseUrl: "https://secretaria.example.test",
    timeoutMs: 5_000,
    maxResponseBytes: 1_000_000,
    paymentReferenceCandidates: (value) => [`scr_${Buffer.from(JSON.stringify(value)).toString("base64url").padEnd(43, "x").slice(0, 43)}`],
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("NetpaSecretariaGateway finance contract", () => {
  it("devolve referência opaca e executa somente o wizard REFERENCIAS_MB verificado", async () => {
    let generated = false;
    const observedPosts: Array<{ path: string; body: URLSearchParams }> = [];
    const sourceRow = () => ({
      id: selection.id,
      idFinanceira: selection.idFinanceira,
      inputId: selection.inputId,
      vlTotalFalta: 100,
      codeTipoItem: "TEST",
      seleccaoPagamentoCalc: `<input type="checkbox" onclick="toogleItem(this, '${selection.id}', '${selection.idFinanceira}','${selection.inputId}')">`,
      descItem: "Propina de teste",
      dateVencimento: "31/12/2026",
      valorItemCalc: "100,00",
      referenciaMBCalc: generated ? "Entidade TEST Referência TEST" : "",
    });
    const summaryRow = {
      id: "summary-internal-id",
      id_numberConta: null,
      id_itemConta: null,
      vlTotalFalta: 100,
      descItem: "Propina de teste",
      dateVencimento: "31/12/2026",
      valorItemCalc: "100,00",
      referenciaMBCalc: "Entidade TEST Referência TEST",
    };

    const fetchMock = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
      const url = new URL(typeof input === "string" || input instanceof URL ? input.toString() : input.url);
      const method = init.method ?? "GET";
      const body = new URLSearchParams(typeof init.body === "string" ? init.body : "");
      if (method === "POST") observedPosts.push({ path: url.pathname, body });

      if (url.pathname === "/netpa/ajax/stepseleccionaritemsconta/pagamentos") {
        return new Response(JSON.stringify({ result: [sourceRow()], total: 1 }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.pathname === "/netpa/ajax/stepseleccionaritemsconta/addItem") {
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.pathname === "/netpa/ajax/stepconfirmarpagamento/pagamentos") {
        return new Response(JSON.stringify({ result: [summaryRow], total: 1 }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.pathname === "/netpa/page" && method === "POST" && url.searchParams.get("stage") === "stepseleccionaritemsconta") {
        return new Response(form("stepseleccionartipopagamento"), { status: 200 });
      }
      if (url.pathname === "/netpa/page" && method === "POST" && url.searchParams.get("stage") === "stepseleccionartipopagamento") {
        return new Response(form("stepconfirmarpagamento"), { status: 200 });
      }
      if (url.pathname === "/netpa/page" && method === "POST" && url.searchParams.get("stage") === "stepconfirmarpagamento") {
        generated = true;
        return new Response(`${form("stepresultadopagamento")}<p>Sucesso</p>`, { status: 200 });
      }
      if (url.pathname === "/netpa/page") return new Response("<html><body>Protected stage</body></html>", { status: 200 });
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const gateway = testGateway();
    const dataset = await gateway.getDataset(session, "finance.charges");
    const chargeRef = String(dataset.items[0].chargeRef);
    expect(chargeRef).toMatch(/^scr_[A-Za-z0-9_-]{43}$/);
    expect(JSON.stringify(dataset)).not.toContain(selection.id);
    expect(JSON.stringify(dataset)).not.toContain(selection.idFinanceira);
    expect(JSON.stringify(dataset)).not.toContain(selection.inputId);
    expect(JSON.stringify(dataset)).not.toContain("toogleItem");

    await expect(gateway.preparePaymentReference(session, [chargeRef])).resolves.toEqual({ chargeRefs: [chargeRef] });
    const result = await gateway.generatePaymentReference(session, [chargeRef]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].chargeRef).toBe(chargeRef);
    expect(result.items[0]).not.toHaveProperty("idNumberConta");

    const add = observedPosts.find((entry) => entry.path.endsWith("/addItem"));
    expect(add?.body.get("id")).toBe(selection.id);
    expect(add?.body.get("idFinanceira")).toBe(selection.idFinanceira);
    const final = observedPosts.find((entry) => entry.body.get("_formsubmitstage") === "stepconfirmarpagamento");
    expect(final?.body.get("submitAction")).toBe("Confirmar");
    await expect(gateway.verifyPaymentReference(session, [chargeRef])).resolves.toMatchObject({ items: [{ chargeRef }] });
  });
});

describe("NetpaSecretariaGateway personal data contracts", () => {
  it("lê contactos e submete somente o patch preservando o formulário completo", async () => {
    const personalData = `<html><body><form id="boletimForm" name="boletimForm">
      <input type="hidden" name="_formsubmitstage" value="boletimmatricula">
      <input type="hidden" name="_formsubmitname" value="boletimForm">
      <input type="hidden" name="_formfieldnames" value="email,telefonePrincipal,telemovel,moradaPrincipal,moradaSecundaria,moradaCorreio,identificacaoNumero">
      <input type="text" name="email" value="old@example.test">
      <input type="text" name="telefonePrincipal" value="222000000">
      <input type="text" name="telemovel" value="923000000">
      <input type="text" name="moradaPrincipal" value="Rua Antiga">
      <input type="text" name="paisMoradaPrincipalDesc" value="Angola">
      <input type="text" name="moradaSecundaria" value="">
      <input type="radio" name="moradaCorreio" value="P" checked>
      <input type="radio" name="moradaCorreio" value="S">
      <input type="text" name="identificacaoNumero" value="PRESERVE-ME">
      <input type="hidden" name="submitAction" value="">
    </form></body></html>`;
    const submissions: URLSearchParams[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
      const url = new URL(typeof input === "string" || input instanceof URL ? input.toString() : input.url);
      if ((init.method ?? "GET") === "POST" && url.pathname === "/netpa/ajax") {
        submissions.push(new URLSearchParams(String(init.body ?? "")));
        return new Response(JSON.stringify({ success: true, parameterErrors: {} }), { status: 200 });
      }
      if (url.searchParams.get("stage") === "BoletimMatricula") return new Response(personalData, { status: 200 });
      return new Response("not found", { status: 404 });
    }));

    const gateway = testGateway();
    const contacts = await gateway.getContactDetails(session);
    expect(contacts).toMatchObject({
      email: "old@example.test",
      phone: "222000000",
      mobile: "923000000",
      primaryAddress: { line1: "Rua Antiga", country: "Angola" },
      mailingAddress: "PRIMARY",
    });
    const prepared = await gateway.prepareContactDetails(session, { email: "new@example.test", mobile: null });
    const result = await gateway.updateContactDetails(session, prepared.patch, prepared.preconditionHash);
    expect(result.items[0]).toEqual({ outcome: "CHANGE_REQUEST_SUBMITTED", changedFields: ["email", "mobile"] });
    expect(submissions[0]?.get("email")).toBe("new@example.test");
    expect(submissions[0]?.get("telemovel")).toBe("");
    expect(submissions[0]?.get("identificacaoNumero")).toBe("PRESERVE-ME");
    expect(submissions[0]?.get("moradaCorreio")).toBe("P");
  });

  it("devolve conjunto vazio apenas para o estado de consentimentos confirmado", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      "<html><h2>Consentimentos do utilizador</h2><h4>Sem consentimentos</h4><p>Não existem consentimentos disponíveis no momento para rever.</p></html>",
      { status: 200 },
    )));
    await expect(testGateway().getConsents(session)).resolves.toMatchObject({
      domain: "privacy.consents",
      items: [],
      total: 0,
      coverage: "live",
    });
  });

  it("serve a fotografia por proxy e submete JPEG multipart com precondição", async () => {
    const photoPage = `<html><body>
      <img src="/netpa/PhotoLoader?codAluno=student&amp;codCurso=course">
      <form id="atualizarFotografia" name="atualizarFotografia">
        <input type="hidden" name="_formsubmitstage" value="atualizarfotografia">
        <input type="hidden" name="_formsubmitname" value="atualizarFotografia">
        <input type="hidden" name="_formfieldnames" value="photo">
        <input type="file" name="photo" accept="image/jpeg">
        <input type="hidden" name="submitAction" value="">
      </form>
    </body></html>`;
    const initial = Buffer.from("GIF89a-initial-photo");
    const replacement = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(128, 2)]);
    let uploaded = false;
    let multipartFields: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
      const url = new URL(typeof input === "string" || input instanceof URL ? input.toString() : input.url);
      if (url.pathname === "/netpa/PhotoLoader") return new Response(uploaded ? replacement : initial, { status: 200 });
      if ((init.method ?? "GET") === "POST" && url.searchParams.get("stage") === "atualizarfotografia") {
        const formData = init.body as FormData;
        multipartFields = [...formData.keys()].sort();
        const file = formData.get("photo") as File;
        expect(file.type).toBe("image/jpeg");
        expect(file.name).toBe("profile-photo.jpg");
        uploaded = true;
        return new Response("<html><p>Pedido de fotografia submetido com sucesso.</p></html>", { status: 200 });
      }
      if (url.pathname === "/netpa/page") return new Response(photoPage, { status: 200 });
      return new Response("not found", { status: 404 });
    }));

    const gateway = testGateway();
    const current = await gateway.getPhoto(session);
    expect(current).toMatchObject({ contentType: "image/gif", contentLength: initial.length });
    current.body.fill(0);
    const prepared = await gateway.preparePhoto(session);
    const result = await gateway.updatePhoto(session, replacement, prepared.preconditionHash);
    expect(result.items[0]).toMatchObject({ outcome: "PHOTO_UPDATED", contentType: "image/jpeg", size: replacement.length });
    expect(multipartFields).toEqual(["_formfieldnames", "_formsubmitname", "_formsubmitstage", "photo", "submitAction"]);
    initial.fill(0);
    replacement.fill(0);
  });
});
