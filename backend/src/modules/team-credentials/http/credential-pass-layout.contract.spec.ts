import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(path.join(__dirname, "team-credentials.routes.ts"), "utf8");

describe("credential pass print contract", () => {
  it("prints official passes in portrait CR-80 PVC size without redesigning the artwork", () => {
    expect(source).toContain("const cr80CardWidthMm = 53.98");
    expect(source).toContain("const cr80CardHeightMm = 85.6");
    expect(source).toContain("const passDesignWidthMm = 90");
    expect(source).toContain("const passDesignHeightMm = 140");
    expect(source).toContain("width:${cardW}mm");
    expect(source).toContain("height:${cardH}mm");
    expect(source).toContain("width:${designW}mm");
    expect(source).toContain("height:${designH}mm");
    expect(source).toContain("transform:scale(${scaleX},${scaleY})");
    expect(source).toContain("CR-80 PVC");
    expect(source).not.toContain("9×14 cm");
  });

  it("uses project/challenge QR targets for exhibitor passes and keeps generic passes on site/profile", () => {
    expect(source).toContain("resolveCredentialPassQrTargets");
    expect(source).toContain("buildCredentialProjectUrl");
    expect(source).toContain("ensureExhibitorChallengeQrActionForPass");
    expect(source).toContain('frontQrLabel = "Projeto do expositor"');
    expect(source).toContain('backQrLabel = "Desafio do expositor"');
    expect(source).toContain("buildValidationUrl(env, challengeAction.token)");
    expect(source).toContain("buildProfileUrl(env, member.publicSlug)");
    expect(source).toContain("frontQrDataUri");
    expect(source).toContain("backQrDataUri");
    expect(source).toContain('src="${params.backQrDataUri}"');
    expect(source).toContain("${escapeHtml(params.backQrLabel)}");
    expect(source).toContain('tokenHashPurpose: qrTargets.tokenHashPurpose');
    expect(source).toContain('tokenHashPurpose = "front-project-back-exhibitor-challenge"');
  });

  it("uses the pass primary color for the side accent without leaking black-white styles", () => {
    expect(source).toContain("background:${theme.primary};z-index:10");
    expect(source).toContain("background:var(--pri);z-index:10");
    expect(source).toContain("body.print-mode-bw .pass-top,body.print-mode-bw .accent-bar");
    expect(source).not.toContain("body.print-mode-bw .pass-top,.accent-bar");
  });

  it("keeps informational text readable after the CR-80 scaling experiment", () => {
    expect(source).toContain(".pname{font-size:16.8px");
    expect(source).toContain(".pmeta{margin-top:1.7mm;font-size:9.8px");
    expect(source).toContain(".bid-card .bname{font-size:13.5px");
    expect(source).toContain(".mcell .mval{font-size:8.4px");
    expect(source).toContain(".qu2{font-size:7.2px");
  });

  it("renders pass QR codes with transparent backgrounds", () => {
    expect(source).toContain("transparentBackground: true");
  });
});
