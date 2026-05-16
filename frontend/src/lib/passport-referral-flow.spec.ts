import { describe, expect, it, beforeEach } from "vitest";
import {
  buildPassportReferralAcceptedPath,
  buildPassportReferralDeclinedPath,
  buildPassportReferralInvitePath,
  clearPassportReferralAccepted,
  consumePassportReferralAccepted,
  getPassportReferralCodeFromPath,
  hasPassportReferralAccepted,
  markPassportReferralAccepted,
} from "./passport-referral-flow";

describe("passport referral flow", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("extrai o codigo de convite de redirects internos seguros", () => {
    expect(
      getPassportReferralCodeFromPath("/minha-area?tab=desafio&convite=abc.123"),
    ).toBe("abc.123");
    expect(getPassportReferralCodeFromPath("/minha-area?ref=xyz")).toBe("xyz");
    expect(getPassportReferralCodeFromPath("https://uorconnect.ao/minha-area?convite=abc")).toBeNull();
  });

  it("prepara o redirect aceito para abrir desafios e autoativar o passaporte", () => {
    expect(
      buildPassportReferralAcceptedPath("/minha-area?tab=projetos", "abc.123"),
    ).toBe("/minha-area?tab=desafio&convite=abc.123&aceitarConvite=1");
  });

  it("gera link publico de convite sem passar primeiro pela Minha Area", () => {
    expect(buildPassportReferralInvitePath("abc.123")).toBe(
      "/desafio/convite/abc.123",
    );
  });

  it("envia recusas para projetos para o estudante votar", () => {
    expect(
      buildPassportReferralDeclinedPath("/minha-area?tab=desafio&convite=abc.123&aceitarConvite=1"),
    ).toBe("/projetos");
  });

  it("guarda a decisao de aceitar ate a Minha Area consumir", () => {
    markPassportReferralAccepted("abc.123");

    expect(hasPassportReferralAccepted("abc.123")).toBe(true);
    expect(consumePassportReferralAccepted("abc.123")).toBe(true);
    expect(hasPassportReferralAccepted("abc.123")).toBe(false);

    markPassportReferralAccepted("abc.123");
    clearPassportReferralAccepted();
    expect(hasPassportReferralAccepted("abc.123")).toBe(false);
  });
});
