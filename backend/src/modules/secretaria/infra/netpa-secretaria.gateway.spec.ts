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
    receiptReferenceCandidates: (value) => [`srr_${Buffer.from(JSON.stringify(value)).toString("base64url").padEnd(43, "x").slice(0, 43)}`],
    examRegistrationReferenceCandidates: (id) => [`ser_${Buffer.from(id).toString("base64url").padEnd(43, "x").slice(0, 43)}`],
    gradeReviewReferenceCandidates: (id) => [`sgr_${Buffer.from(id).toString("base64url").padEnd(43, "x").slice(0, 43)}`],
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("NetpaSecretariaGateway finance contract", () => {
  it("expõe propinas, pagamentos, dívidas e comprovativos com referências opacas", async () => {
    const tuition = `<html><body><form name="myForm"><select name="anoLectivo"><option value="2025" selected>2025-2026</option></select>
      <table><tr><th></th><th>Descri&ccedil;&atilde;o</th><th>Dt. Vencimento</th><th>Ref. MB</th><th>Valor</th><th>Dt. Pagamento</th><th>Pago</th><th>D&iacute;vida</th><th>Multa</th></tr>
      <tr><td><a href="javascript:Propinas_columnClick('36','info','modalidade=3','itemPago=S');">info</a></td><td>Fevereiro</td><td>10-02-2026</td><td></td><td>100.00 Kz</td><td>06-02-2026</td><td>100.00 Kz</td><td>0.00 Kz</td><td>0.00 Kz</td></tr></table></form></body></html>`;
    const debts = `<html><body><table><tr><th>Descrição</th><th>Tipo</th><th>Dt. Vencimento</th><th>Total</th><th>Pago</th><th>Total Dívida</th></tr>
      <tr><td>Recurso de Física</td><td>Emolumento</td><td>30-01-2026</td><td>16,986.00 Kz</td><td>0.00 Kz</td><td>16,986.00 Kz</td></tr></table></body></html>`;
    const detail = `<html><body><h1>Detalhe Item Conta</h1><table><tr><td>Descrição:</td><td>Fevereiro</td></tr><tr><td>Dt. Vencimento:</td><td>10-02-2026</td></tr><tr><td>Pago</td><td>Sim</td></tr><tr><td>Facturado:</td><td>Sim</td></tr><tr><td>Valor:</td><td>100.00 Kz</td></tr><tr><td>Anulado:</td><td>Não</td></tr></table></body></html>`;
    const posts: URLSearchParams[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
      const url = new URL(typeof input === "string" || input instanceof URL ? input.toString() : input.url);
      if ((init.method ?? "GET") === "POST") {
        posts.push(new URLSearchParams(String(init.body ?? "")));
        return new Response(detail, { status: 200 });
      }
      if (url.searchParams.get("_SR_") === "176") return new Response(debts, { status: 200 });
      return new Response(tuition, { status: 200 });
    }));
    const gateway = testGateway();
    const tuitionResult = await gateway.getDataset(session, "finance.tuition");
    expect(tuitionResult.items[0]).toMatchObject({ description: "Fevereiro", dueDate: "2026-02-10", paymentDate: "2026-02-06", status: "PAID" });
    expect(String(tuitionResult.items[0].receiptRef)).toMatch(/^srr_[A-Za-z0-9_-]{43}$/);
    expect(JSON.stringify(tuitionResult)).not.toContain("'36'");
    await expect(gateway.getDataset(session, "finance.payments")).resolves.toMatchObject({ total: 1, coverage: "live" });
    await expect(gateway.getDataset(session, "finance.receipts")).resolves.toMatchObject({ total: 1, coverage: "live" });
    await expect(gateway.getDataset(session, "finance.debts")).resolves.toMatchObject({ items: [{ status: "OUTSTANDING" }], total: 1 });
    const receipt = await gateway.getReceipt(session, String(tuitionResult.items[0].receiptRef));
    expect(receipt).toMatchObject({ officialFiscalReceipt: false, fields: { description: "Fevereiro", paid: true, invoiced: true, voided: false } });
    expect(posts[0].get("_SR_")).toBe("163");
    expect(posts[0].get("item")).toBe("36");
  });

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
      referencia: generated ? "reference-document" : "",
      referenciaMBCalc: generated ? "-" : "",
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
      if (url.pathname === "/netpa/doc") {
        return new Response(Buffer.from("%PDF-1.7\nsecretaria-test"), { status: 200, headers: { "content-type": "application/pdf" } });
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
    const document = await gateway.getPaymentReferenceDocument(session, chargeRef);
    expect(document).toMatchObject({ contentType: "application/pdf", filename: "referencia-pagamento-secretaria.pdf" });
    expect(document.body.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    document.body.fill(0);
  });

  it("remove identidade pessoal, ids internos e ações executáveis dos datasets", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(typeof input === "string" || input instanceof URL ? input.toString() : input.url);
      if (url.pathname.endsWith("/faltasAlunosPorDisciplina")) {
        return new Response(JSON.stringify({ result: [{
          CD_ALUNO: "student-secret",
          ID_INDIVIDUO: "person-secret",
          NM_COMPLETO: "Private Student Name",
          descDiscip: "Programação",
          numberFaltas: 2,
          acoesCalc: '<a href="javascript:deleteEverything()">apagar</a>',
        }], total: 1 }), { status: 200 });
      }
      return new Response("<html><body>Protected stage</body></html>", { status: 200 });
    }));
    const result = await testGateway().getDataset(session, "academic.absences");
    expect(result.items).toEqual([{ descDiscip: "Programação", numberFaltas: 2 }]);
    expect(JSON.stringify(result)).not.toContain("student-secret");
    expect(JSON.stringify(result)).not.toContain("Private Student Name");
    expect(JSON.stringify(result)).not.toContain("javascript");
  });
});

describe("NetpaSecretariaGateway personal data contracts", () => {
  it("lê contactos e submete somente o patch preservando o formulário completo", async () => {
    const personalData = `<html><body><script>
      function cancelarPedidoRequestfunc(){ return 'ajax/boletimmatricula/cancelarPedido'; }
    </script><form id="boletimForm" name="boletimForm">
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
      if ((init.method ?? "GET") === "POST" && url.pathname === "/netpa/ajax/boletimmatricula/cancelarPedido") {
        return new Response(JSON.stringify({ success: true, result: "success" }), { status: 200 });
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
    const cancellation = await gateway.prepareContactDetailsCancellation(session);
    await expect(gateway.cancelContactDetailsChangeRequest(session, cancellation.preconditionHash)).resolves.toMatchObject({
      items: [{ outcome: "CONTACT_CHANGE_REQUEST_CANCELLED" }],
    });
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

describe("NetpaSecretariaGateway circuit breaker", () => {
  it("isola somente o endpoint que falhou repetidamente", async () => {
    const fetchMock = vi.fn(async () => new Response("unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const gateway = testGateway();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(gateway.getProfile(session)).rejects.toMatchObject({ code: "SECRETARIA_UNAVAILABLE" });
    }
    await expect(gateway.getProfile(session)).rejects.toMatchObject({ code: "SECRETARIA_CIRCUIT_OPEN", retryable: true });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});

describe("NetpaSecretariaGateway exam registration contracts", () => {
  it("expõe referência opaca e só conclui a anulação após releitura oficial", async () => {
    const page = `<html><body><script>
      function anular(id){ anulaInscricaoEpocafunc("id=" + id); }
      function anulaInscricaoEpocafunc(params){ return params; }
      const endpoint = "ajax/consultainscricaoepocas/anulaInscricaoEpoca";
    </script></body></html>`;
    const activeRow = {
      id: "upstream-registration-1",
      CdLectivoFmt: "2025-26",
      CdDiscipFmt: "Álgebra",
      DsStaInscExame: "Inscrito",
      accaoCalc: `<a onclick="anular('upstream-registration-1')">Anular</a>`,
      operacao: "internal-operation",
    };
    let cancelled = false;
    let cancellationBody = "";
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
      const url = new URL(typeof input === "string" || input instanceof URL ? input.toString() : input.url);
      if (url.pathname === "/netpa/page") return new Response(page, { status: 200 });
      if (url.pathname.endsWith("/listaInscricoesEpocas")) {
        return new Response(JSON.stringify({ success: true, result: cancelled ? [] : [activeRow], total: cancelled ? 0 : 1 }), { status: 200 });
      }
      if (url.pathname.endsWith("/anulaInscricaoEpoca") && init.method === "POST") {
        cancellationBody = String(init.body ?? "");
        cancelled = true;
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    }));

    const gateway = testGateway();
    const dataset = await gateway.getDataset(session, "process.examRegistrations");
    const registrationRef = String(dataset.items[0].registrationRef);
    expect(registrationRef).toMatch(/^ser_[A-Za-z0-9_-]{43}$/);
    expect(dataset.items[0]).toMatchObject({ cdDiscipFmt: "Álgebra", canCancel: true });
    expect(JSON.stringify(dataset)).not.toContain("upstream-registration-1");
    expect(JSON.stringify(dataset)).not.toContain("internal-operation");

    const prepared = await gateway.prepareExamRegistrationCancellation(session, registrationRef);
    const result = await gateway.cancelExamRegistration(session, prepared);
    expect(new URLSearchParams(cancellationBody).get("id")).toBe("upstream-registration-1");
    expect(result.items[0]).toEqual({ outcome: "EXAM_REGISTRATION_CANCELLED", registrationRef });
  });
});

describe("NetpaSecretariaGateway grade review contracts", () => {
  it("expõe referência opaca e só conclui a revisão após releitura oficial", async () => {
    const page = `<html><body><script>
      function efectuarPedidoRevisaoNota(){ return true; }
      const store = { autoSync: true, url: 'ajax/listapedidosrevisaonotasaluno/pedidosrevisao', fields: [{name: 'justificacaoPedidoTemp'}] };
      function submitReview(){ if (Ext.get('justificacaoPedirRevisao').dom.value.length > 16000) return false; record.set('justificacaoPedidoTemp', Ext.get('justificacaoPedirRevisao').dom.value); }
    </script></body></html>`;
    const upstreamId = "grade-review-upstream-1";
    let submitted = false;
    let submittedBody: Record<string, unknown> | null = null;
    const row = () => ({
      id: upstreamId,
      anoLectivoPeriodoCalc: "2025-26",
      descDiscipCalc: "Unidade Curricular de Teste",
      descEpocaCalc: "Avaliação de Teste",
      descEstadoCalc: submitted ? "Em Validação" : "Aguarda pedido de revisão",
      numberPedidoCalc: submitted ? "TEST-001" : "",
      accaoCalc: submitted ? "" : `<a href="javascript:efectuarPedidoRevisaoNota()">Pedir revisão</a>`,
      justificacaoPedidoTemp: "internal-only",
      justificacaoReapreciacaoTemp: "internal-only",
    });
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
      const url = new URL(typeof input === "string" || input instanceof URL ? input.toString() : input.url);
      if (url.pathname === "/netpa/page") return new Response(page, { status: 200 });
      if (url.pathname === "/netpa/ajax/listapedidosrevisaonotasaluno/pedidosrevisao") {
        return new Response(JSON.stringify({ success: true, result: [row()], total: 1 }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.pathname.endsWith(`/${upstreamId}`) && init.method === "PUT") {
        submittedBody = JSON.parse(String(init.body ?? "{}")) as Record<string, unknown>;
        submitted = true;
        return new Response(JSON.stringify({ success: true, result: row() }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response("not found", { status: 404 });
    }));

    const gateway = testGateway();
    const dataset = await gateway.getDataset(session, "process.gradeReviews");
    const reviewRef = String(dataset.items[0].reviewRef);
    expect(reviewRef).toMatch(/^sgr_[A-Za-z0-9_-]{43}$/);
    expect(dataset.items[0]).toMatchObject({ availableAction: "SUBMIT_REVIEW", canSubmitReview: true });
    expect(JSON.stringify(dataset)).not.toContain(upstreamId);
    expect(JSON.stringify(dataset)).not.toContain("justificacaoPedidoTemp");
    expect(JSON.stringify(dataset)).not.toContain("efectuarPedidoRevisaoNota");

    const prepared = await gateway.prepareGradeReview(session, reviewRef, "REVIEW", "  Justificação objetiva para revisão.  ");
    expect(prepared.justification).toBe("Justificação objetiva para revisão.");
    const result = await gateway.submitGradeReview(session, prepared);
    expect(submittedBody).toEqual({ id: upstreamId, justificacaoPedidoTemp: "Justificação objetiva para revisão." });
    expect(result.items[0]).toEqual({ outcome: "GRADE_REVIEW_SUBMITTED", reviewRef, state: "Em Validação", requestNumber: "TEST-001" });
  });

  it("submete pedido de cópia de prova com o marcador oficial e impede revisão fora de sequência", async () => {
    const page = `<html><body><script>
      const store = { autoSync: true, url: 'ajax/listapedidosrevisaonotasaluno/pedidosrevisao', fields: [{name: 'justificacaoPedidoTemp'}] };
      function submitReview(){ if (Ext.get('justificacaoPedirRevisao').dom.value.length > 16000) return false; record.set('justificacaoPedidoTemp', Ext.get('justificacaoPedirRevisao').dom.value); }
    </script></body></html>`;
    let submittedBody: Record<string, unknown> | null = null;
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
      const url = new URL(typeof input === "string" || input instanceof URL ? input.toString() : input.url);
      if (url.pathname === "/netpa/page") return new Response(page, { status: 200 });
      if (url.pathname === "/netpa/ajax/listapedidosrevisaonotasaluno/pedidosrevisao") {
        return new Response(JSON.stringify({
          success: true,
          result: [{
            id: "proof-first",
            descEstadoCalc: submittedBody ? "Aguarda prova" : "-",
            numberPedidoCalc: submittedBody ? "TEST-PROOF" : "-",
            accaoCalc: submittedBody ? "" : `<a href="javascript:efectuarPedidoCopiaProva()">Pedir prova</a>`,
          }],
          total: 1,
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (init.method === "PUT") {
        submittedBody = JSON.parse(String(init.body)) as Record<string, unknown>;
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response("not found", { status: 404 });
    }));

    const gateway = testGateway();
    const dataset = await gateway.getDataset(session, "process.gradeReviews");
    expect(dataset.items[0]).toMatchObject({ availableAction: "REQUEST_PROOF_COPY", canSubmitReview: false });
    await expect(gateway.prepareGradeReview(session, String(dataset.items[0].reviewRef), "REVIEW", "Justificação"))
      .rejects.toMatchObject({ code: "SECRETARIA_COMMAND_STATE_INVALID" });
    const prepared = await gateway.prepareGradeReview(session, String(dataset.items[0].reviewRef), "PROOF_COPY", "");
    const result = await gateway.submitGradeReview(session, prepared);
    expect(submittedBody).toEqual({ id: "proof-first", justificacaoPedidoTemp: "#pedidocopia#" });
    expect(result.items[0]).toMatchObject({ outcome: "GRADE_PROOF_COPY_REQUESTED", state: "Aguarda prova" });
  });
});
