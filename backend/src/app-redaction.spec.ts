import { describe, expect, it } from "vitest";
import { sensitiveLogPaths } from "./app";

describe("política central de redação de logs", () => {
  it("cobre sessão, credenciais institucionais, OTP, step-up e envelopes cifrados", () => {
    expect(sensitiveLogPaths).toEqual(expect.arrayContaining([
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['x-csrf-token']",
      "req.headers['x-uor-student-mfa']",
      "req.headers['x-uor-step-up']",
      "res.headers['set-cookie']",
      "req.body.password",
      "req.body.secretariaPassword",
      "req.body.moodlePassword",
      "req.body.code",
      "req.body.token",
      "req.body.cookieJar",
      "credentialsEnvelope",
      "sessionEnvelope",
      "encryptedCookieJar",
    ]));
    expect(sensitiveLogPaths).not.toContain("req.body.studentNumber");
  });
});
