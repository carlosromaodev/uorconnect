import { describe, expect, it } from "vitest";
import { extractStudentScanRouteTarget } from "./student-scan-input";

describe("student scan input", () => {
  it("recognizes project QR links as valid challenge scan targets", () => {
    expect(extractStudentScanRouteTarget("https://uorconnect.space/projeto/smart-campus-42")).toEqual({
      kind: "PROJECT",
      slug: "smart-campus-42",
    });
    expect(extractStudentScanRouteTarget("/projeto/smart-campus-42?utm=qr")).toEqual({
      kind: "PROJECT",
      slug: "smart-campus-42",
    });
  });

  it("recognizes exhibitor credential links without treating qra tokens as profile slugs", () => {
    expect(extractStudentScanRouteTarget("https://uorconnect.space/equipa/perfil/carlos-romao-ab12")).toEqual({
      kind: "TEAM_CREDENTIAL",
      slug: "carlos-romao-ab12",
    });
    expect(extractStudentScanRouteTarget("https://uorconnect.space/validar/expositor-carlos-ab12")).toEqual({
      kind: "TEAM_CREDENTIAL",
      slug: "expositor-carlos-ab12",
    });
    expect(extractStudentScanRouteTarget("https://uorconnect.space/validar/qra_123")).toBeNull();
  });
});
