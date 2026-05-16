import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("Passaporte Digital desafios e QR surpresa", () => {
  it("mantem desafio do expositor pendente ate aprovacao admin", () => {
    const minhaArea = readSource("./MinhaArea.tsx");
    const apiSource = readSource("../lib/api.ts");
    const adminPassport = readSource(
      "../components/admin/AdminPassportTab.tsx",
    );

    expect(apiSource).toContain("myProjectChallenges");
    expect(apiSource).toContain("saveProjectChallenge");
    expect(minhaArea).toContain("Guardar e enviar para aprovação");
    expect(minhaArea).toContain("Desafio enviado para aprovação da admin.");
    expect(minhaArea).toContain("clampProjectChallengeAttempts");
    expect(minhaArea).toContain("max={5}");
    expect(adminPassport).toContain("Pendente admin");
  });

  it("abre o desafio escaneado em modal e protege efeitos do jogo", () => {
    const minhaArea = readSource("./MinhaArea.tsx");
    const css = readSource("../index.css");
    const publicValidation = readSource("./PublicValidation.tsx");

    expect(minhaArea).toContain("Desafio do expositor");
    expect(minhaArea).toContain("challenge-answer-modal");
    expect(minhaArea).toContain('searchParams.get("scan")');
    expect(minhaArea).toContain("autoScanTokenRef");
    expect(minhaArea).toContain("void handleScanRef.current(autoScanToken)");
    expect(publicValidation).toContain("/minha-area?tab=desafio&scan=");
    expect(publicValidation).toContain("Responder desafio");
    expect(minhaArea).toContain("scan-confetti-field");
    expect(minhaArea).toContain("scan-point-drain");
    expect(minhaArea).toContain("scan-sad-ripple");
    expect(minhaArea).toContain("Responder questão");
    expect(minhaArea).toContain("onPointerDownOutside={(event) => event.preventDefault()}");
    expect(minhaArea).toContain("onEscapeKeyDown={(event) => event.preventDefault()}");
    expect(minhaArea).not.toContain("scan-celebration-card__close");
    expect(minhaArea).toContain("Leitura recusada");
    expect(minhaArea).toContain("QR não validado");
    expect(css).toContain("@keyframes scanConfettiFall");
    expect(css).toContain("@keyframes scanPointDrop");
    expect(css).toContain("@keyframes scanSadRipple");
    expect(css).toContain("@keyframes challengeModalPulse");
  });

  it("oferece download em PDF para QR surpresa na admin", () => {
    const apiSource = readSource("../lib/api.ts");
    const adminPassport = readSource(
      "../components/admin/AdminPassportTab.tsx",
    );

    expect(apiSource).toContain("surpriseQrPdf");
    expect(adminPassport).toContain("handleDownloadSurpriseQrPdf");
    expect(adminPassport).toContain("Baixar PDF");
  });

  it("restaura o convite claro antes do scanner com participantes", () => {
    const minhaArea = readSource("./MinhaArea.tsx");
    const apiSource = readSource("../lib/api.ts");
    const inviteIndex = minhaArea.indexOf("desafio-hero");
    const scannerIndex = minhaArea.indexOf("desafio-scanner");
    const passportIndex = minhaArea.indexOf("desafio-journey", scannerIndex);

    expect(apiSource).toContain("participantCount");
    expect(minhaArea).toContain("challengeParticipantCount");
    expect(minhaArea).toContain("participantes");
    expect(inviteIndex).toBeGreaterThan(-1);
    expect(scannerIndex).toBeGreaterThan(inviteIndex);
    expect(passportIndex).toBeGreaterThan(scannerIndex);
    expect(minhaArea).not.toContain("challenge-invite-card");
    expect(minhaArea).not.toContain("challenge-scanner-card");
    expect(minhaArea).not.toContain("challenge-rulebook");
    expect(minhaArea).not.toContain('className="h-1.5 bg-gradient-to-r');
  });

  it("mostra os cards do passaporte apenas depois do estudante aceitar o desafio", () => {
    const minhaArea = readSource("./MinhaArea.tsx");
    const gateIndex = minhaArea.indexOf("{passportJoined ? (");
    const scannerIndex = minhaArea.indexOf("desafio-scanner");
    const journeyIndex = minhaArea.indexOf("desafio-journey", scannerIndex);

    expect(gateIndex).toBeGreaterThan(-1);
    expect(scannerIndex).toBeGreaterThan(gateIndex);
    expect(journeyIndex).toBeGreaterThan(gateIndex);
    expect(minhaArea).not.toContain("pts bónus");
    expect(minhaArea).not.toContain("Bónus QR");
  });

  it("mantem o convite oficial no tema anterior sem tipografia experimental", () => {
    const minhaArea = readSource("./MinhaArea.tsx");
    const css = readSource("../index.css");

    expect(minhaArea).toContain("Passaporte UOR Connect");
    expect(css).toContain(".desafio-hero {");
    expect(css).toContain(".desafio-hero__glow");
    expect(css).toContain(".desafio-hero__rank");
    expect(minhaArea).not.toContain("challenge-invite-card__badge");
    expect(minhaArea).not.toContain("challenge-invite-card__manual");
    expect(minhaArea).not.toContain("certificate-blueprint-panel");
    expect(css).not.toContain("--cert-blueprint-paper");
  });

  it("mantem o card do estudante legivel sem overlay escuro no hero", () => {
    const css = readSource("../index.css");

    expect(css).toContain(".minha-area-hero::before");
    expect(css).not.toContain(
      "background: linear-gradient(90deg, #ff7a1a, #050505);",
    );
    expect(css).toContain(
      "box-shadow: inset 0 0 0 1px rgb(255 122 26 / 0.18);",
    );
  });

  it("restaura o mapa do passaporte em checklist claro sem resumo duplicado", () => {
    const minhaArea = readSource("./MinhaArea.tsx");
    const css = readSource("../index.css");

    expect(minhaArea).toContain("desafio-mission");
    expect(minhaArea).not.toContain("passport-route-curve");
    expect(minhaArea).not.toContain("passport-quest__piece");
    expect(minhaArea).not.toContain("is-left");
    expect(minhaArea).not.toContain("is-right");
    expect(minhaArea).not.toContain("passport-stats-row");
    expect(minhaArea).not.toContain("Bónus QR");
    expect(css).toContain(".desafio-mission");
    expect(css).not.toContain(".passport-stats-row");
    expect(css).not.toContain(".passport-stat-card");
  });

  it("fecha a area desafio com orientacao em design claro e sem painel escuro", () => {
    const minhaArea = readSource("./MinhaArea.tsx");
    const inviteIndex = minhaArea.indexOf("desafio-hero");
    const scannerIndex = minhaArea.indexOf("desafio-scanner");
    const passportIndex = minhaArea.indexOf("desafio-journey", scannerIndex);

    expect(minhaArea).toContain("Scanner Oficial");
    expect(minhaArea).toContain("Mapa do Desafio");
    expect(minhaArea).toContain("QR surpresa");
    expect(minhaArea).toContain("Conquistas");
    expect(scannerIndex).toBeGreaterThan(inviteIndex);
    expect(passportIndex).toBeGreaterThan(scannerIndex);
    expect(minhaArea).not.toContain("challenge-map-legend");
    expect(minhaArea).not.toContain("Peça = tu");
    expect(minhaArea).not.toContain("challenge-passport-panel");
  });

  it("oferece manual do desafio em PDF com linguagem profissional", () => {
    const minhaArea = readSource("./MinhaArea.tsx");
    const apiSource = readSource("../lib/api.ts");
    const passportRoutes = readSource(
      "../../../backend/src/modules/passport/http/passport.routes.ts",
    );
    const challengeManual = readSource(
      "../../../backend/src/modules/passport/http/challenge-manual-pdf.ts",
    );

    expect(apiSource).toContain("challengeManualPdf");
    expect(minhaArea).toContain("handleDownloadChallengeManual");
    expect(minhaArea).toContain("Manual do desafio");
    expect(passportRoutes).toContain("/me/challenge-manual.pdf");
    expect(challengeManual).toContain("Manual do Desafio");
    expect(challengeManual).toContain("Passaporte Digital UOR Connect");
    expect(minhaArea).not.toContain("andar a escanear no escuro");
    expect(minhaArea).not.toContain("O próprio QR não engana ninguém");
    expect(minhaArea).not.toContain("Acertou, pontuou");
  });

  it("protege contraste dos textos no design claro de desafios", () => {
    const css = readSource("../index.css");

    expect(css).toContain(".challenge-entry-card {");
    expect(css).toContain("@apply relative text-slate-950");
    expect(css).toContain(".organization-scanner-card");
    expect(css).toContain(".passport-check-item.is-current");
    expect(css).not.toContain(".challenge-passport-panel .passport-next-card p");
  });

  it("usa mensagens profissionais e tons proprios para regras bloqueadas do jogo", () => {
    const minhaArea = readSource("./MinhaArea.tsx");
    const css = readSource("../index.css");
    const apiSource = readSource("../lib/api.ts");
    const adminPassport = readSource(
      "../components/admin/AdminPassportTab.tsx",
    );

    expect(minhaArea).toContain("scanFeedbackForResult");
    expect(minhaArea).toContain("Apanhado no espelho. Esse QR é teu, campeão.");
    expect(minhaArea).toContain("Boa tentativa, mas a casa não joga contra si mesma.");
    expect(minhaArea).toContain("O autor da pergunta não pode ganhar o prémio por saber a resposta.");
    expect(minhaArea).toContain("Esse crachá já assinou o teu passaporte. Vai conhecer outro.");
    expect(minhaArea).toContain("Chegaste depois dos créditos finais. Este QR já saiu de cena.");
    expect(minhaArea).toContain("Boa conversa, mas os pontos são para misturar cursos.");
    expect(minhaArea).toContain("scan-celebration-card--warning");
    expect(minhaArea).toContain("scan-celebration-card--blocked");
    expect(minhaArea).toContain("scan-celebration-card--educational");
    expect(css).toContain(".scan-celebration-card--warning");
    expect(css).toContain(".scan-celebration-card--blocked");
    expect(css).toContain(".scan-celebration-card--educational");
    expect(apiSource).toContain("reviewNote");
    expect(apiSource).toContain("version");
    expect(adminPassport).toContain("Recusado");
    expect(adminPassport).toContain("Nota da admin");
  });

  it("celebra virada no ranking e oferece aprovacao/recusa admin para desafios", () => {
    const minhaArea = readSource("./MinhaArea.tsx");
    const adminPassport = readSource(
      "../components/admin/AdminPassportTab.tsx",
    );

    expect(minhaArea).toContain("Virada de Ranking");
    expect(minhaArea).toContain("uor-passport-ranking");
    expect(adminPassport).toContain("Aprovar");
    expect(adminPassport).toContain("Recusar");
    expect(adminPassport).toContain("reviewDrafts");
    expect(adminPassport).toContain("handleReviewChallenge");
  });

  it("mantem QR surpresa misterioso para estudante e material impresso", () => {
    const minhaArea = readSource("./MinhaArea.tsx");
    const passportRoutes = readSource(
      "../../../backend/src/modules/passport/http/passport.routes.ts",
    );
    const passportService = readSource(
      "../../../backend/src/modules/passport/application/passport.service.ts",
    );

    expect(minhaArea).toContain("Surpresa revelada");
    expect(minhaArea).not.toContain("QR Risco");
    expect(minhaArea).not.toContain("QR Turbo");
    expect(minhaArea).not.toContain("QR Fragmento");

    expect(passportRoutes).toContain("QR Surpresa");
    expect(passportRoutes).not.toContain("QR de risco");
    expect(passportRoutes).not.toContain("QR turbo");
    expect(passportRoutes).not.toContain("QR fragmento");
    expect(passportRoutes).not.toContain("<span>Efeito</span>");
    expect(passportRoutes).not.toContain("<span>Valor</span>");
    expect(passportRoutes).not.toContain("<span>Raridade</span>");

    expect(passportService).not.toContain("QR de risco");
    expect(passportService).not.toContain("QR Turbo");
    expect(passportService).not.toContain("QR Fragmento");
  });

  it("inclui convite de afiliado no mapa sem trocar o design do passaporte", () => {
    const minhaArea = readSource("./MinhaArea.tsx");
    const appSource = readSource("../App.tsx");
    const invitePage = readSource("./PassportReferralInvite.tsx");
    const loginPage = readSource("./Login.tsx");
    const portalLogin = readSource("../portal/pages/PortalLoginPage.tsx");
    const referralFlow = readSource("../lib/passport-referral-flow.ts");
    const apiSource = readSource("../lib/api.ts");
    const passportService = readSource(
      "../../../backend/src/modules/passport/application/passport.service.ts",
    );
    const passportRoutes = readSource(
      "../../../backend/src/modules/passport/http/passport.routes.ts",
    );

    expect(passportService).toContain('key: "affiliate-invite"');
    expect(passportService).toContain('type: "PASSPORT_REFERRAL"');
    expect(passportService).toContain("recordPassportReferralJoin");
    expect(passportRoutes).toContain("referralCode");
    expect(apiSource).toContain("referralInvite");
    expect(apiSource).toContain("referralCode");
    expect(appSource).toContain('path="/desafio/convite/:code"');
    expect(appSource).toContain("passportInviteRoute");
    expect(passportService).toContain("/desafio/convite/");
    expect(invitePage).toContain("Passaporte UOR Connect");
    expect(invitePage).toContain("Foste convidado para o desafio interativo");
    expect(invitePage).toContain("api.passport.join");
    expect(invitePage).toContain("Aceitar e entrar no desafio");
    expect(invitePage).toContain("Não, prefiro votar");
    expect(invitePage).toContain("passport-invite__btn--accept");
    expect(invitePage).toContain("passport-invite__btn--decline");
    expect(referralFlow).toContain("buildPassportReferralInvitePath");
    expect(referralFlow).toContain('return "/projetos"');
    expect(loginPage).toContain("referralInvite");
    expect(portalLogin).toContain("Foste convidado para o Desafio UOR Connect");
    expect(portalLogin).toContain("Prémio oficial");
    expect(portalLogin).toContain("pagamento de 1 recurso");
    expect(portalLogin).toContain("Prime Video");
    expect(portalLogin).toContain("HBO");
    expect(portalLogin).toContain("Duolingo Super");
    expect(portalLogin).toContain("Aceitar convite");
    expect(portalLogin).toContain("Não, prefiro votar");
    expect(portalLogin).toContain("passportReferralLoginOnly");
    expect(portalLogin).toContain("allowConventional={!passportReferralLoginOnly}");
    expect(portalLogin).toContain("!passportReferralLoginOnly ? (");
    expect(referralFlow).toContain("aceitarConvite");
    expect(minhaArea).toContain("handleCopyPassportReferral");
    expect(minhaArea).toContain("buildPassportReferralInvitePath");
    expect(minhaArea).toContain("orderPassportMissionsForMap");
    expect(minhaArea).toContain("handleDeclinePassportReferral");
    expect(minhaArea).toContain("consumePassportReferralAccepted");
    expect(minhaArea).toContain("Pagamento de 1 recurso");
    expect(minhaArea).toContain("Certificado Top 3");
    expect(minhaArea).toContain("Prime Video");
    expect(minhaArea).toContain("HBO");
    expect(minhaArea).toContain("Duolingo Super");
    expect(minhaArea).toContain("Copiar link");
    expect(minhaArea).toContain("convidou-te para o desafio interativo");
    expect(minhaArea).toContain("Não, prefiro votar");
    expect(minhaArea).toContain('className="desafio-hero__accepted mt-2');
    expect(minhaArea).toContain("desafio-mission");
    expect(minhaArea).not.toContain("/minha-area?tab=desafio&convite=");
    expect(minhaArea).not.toContain("affiliate-card");
  });

  it("prioriza camera no scanner e remove digitacao manual do QR", () => {
    const minhaArea = readSource("./MinhaArea.tsx");

    expect(minhaArea).toContain("Abrir câmera e escanear QR");
    expect(minhaArea).toContain("setScannerOpen(true)");
    expect(minhaArea).not.toContain('placeholder="Código do QR..."');
    expect(minhaArea).not.toContain("setManualToken");
    expect(minhaArea).not.toContain("handleScan(manualToken)");
  });

  it("liga batalha, pistas, cooperacao e recuperacao a QR de etapa na admin", () => {
    const minhaArea = readSource("./MinhaArea.tsx");
    const apiSource = readSource("../lib/api.ts");
    const adminPassport = readSource("../components/admin/AdminPassportTab.tsx");
    const passportService = readSource(
      "../../../backend/src/modules/passport/application/passport.service.ts",
    );
    const passportRoutes = readSource(
      "../../../backend/src/modules/passport/http/passport.routes.ts",
    );

    expect(passportService).toContain("POINT_BATTLE_QR");
    expect(passportService).toContain("CLUE_CHAIN_QR");
    expect(passportService).toContain("COOPERATIVE_MISSION_QR");
    expect(passportService).toContain("RECOVERY_SMART_QR");
    expect(passportService).toContain("awardCooperativeMission");
    expect(passportService).toContain("awardSmartRecoveryMission");
    expect(passportRoutes).toContain("/admin/mission-qrs");
    expect(apiSource).toContain("createMissionQr");
    expect(adminPassport).toContain("QR de etapa");
    expect(adminPassport).toContain("Batalha de pontos");
    expect(adminPassport).toContain("Pistas encadeadas");
    expect(adminPassport).toContain("Missão cooperativa");
    expect(adminPassport).toContain("Recuperação inteligente");
    expect(minhaArea).toContain("POINT_BATTLE");
    expect(minhaArea).toContain("CLUE_CHAIN");
    expect(minhaArea).toContain("COOPERATIVE_MISSION");
    expect(minhaArea).toContain("RECOVERY_SMART");
  });
});
