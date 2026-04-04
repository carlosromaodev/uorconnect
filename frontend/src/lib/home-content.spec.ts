import { describe, expect, it } from "vitest";
import { defaultHomeSocialConfig, isCourseEnrollmentEnabled, isFirstYearContestEnabled } from "./home-content";

describe("home-content feature flags", () => {
  it("mantém os acessos públicos ativos por padrão", () => {
    expect(defaultHomeSocialConfig.courseEnrollmentEnabled).toBe(true);
    expect(defaultHomeSocialConfig.firstYearContestEnabled).toBe(true);
  });

  it("respeita flags explícitas e faz fallback seguro para true", () => {
    expect(isCourseEnrollmentEnabled({ ...defaultHomeSocialConfig, courseEnrollmentEnabled: false })).toBe(false);
    expect(isFirstYearContestEnabled({ ...defaultHomeSocialConfig, firstYearContestEnabled: false })).toBe(false);
    expect(isCourseEnrollmentEnabled(null)).toBe(true);
    expect(isFirstYearContestEnabled(undefined)).toBe(true);
  });
});
