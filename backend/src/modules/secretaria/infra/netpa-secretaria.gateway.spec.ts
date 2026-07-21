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
