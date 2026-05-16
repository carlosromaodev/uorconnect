import { extractValidationToken } from "../../validation/application/validation-links";

export type StudentScanRouteTarget =
  | { kind: "PROJECT"; slug: string }
  | { kind: "TEAM_CREDENTIAL"; slug: string };

function decodeSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function routeSegmentsFromRawInput(value: string) {
  const raw = value.trim();
  if (!raw) return [];

  const path = (() => {
    try {
      const parsed = new URL(raw);
      const hashPath = parsed.hash.replace(/^#/, "");
      return hashPath.startsWith("/") ? hashPath : parsed.pathname;
    } catch {
      return raw.split(/[?#]/)[0] ?? raw;
    }
  })();

  return path.split("/").filter(Boolean).map(decodeSegment);
}

export function extractStudentScanRouteTarget(value?: string | null): StudentScanRouteTarget | null {
  const raw = value?.trim();
  if (!raw) return null;

  const segments = routeSegmentsFromRawInput(raw);
  const projectIndex = segments.indexOf("projeto");
  if (projectIndex >= 0 && segments[projectIndex + 1]) {
    return { kind: "PROJECT", slug: segments[projectIndex + 1] };
  }

  const teamProfileIndex = segments.findIndex((segment, index) => segment === "equipa" && segments[index + 1] === "perfil");
  if (teamProfileIndex >= 0 && segments[teamProfileIndex + 2]) {
    return { kind: "TEAM_CREDENTIAL", slug: segments[teamProfileIndex + 2] };
  }

  const validationIndex = segments.indexOf("validar");
  const validationToken = validationIndex >= 0 ? segments[validationIndex + 1] : extractValidationToken(raw);
  if (validationToken && !validationToken.startsWith("qra_") && !validationToken.startsWith("att_")) {
    return { kind: "TEAM_CREDENTIAL", slug: validationToken };
  }

  return null;
}
