import { describe, expect, it } from "vitest";
import { MoodleCookieJar, splitSetCookieHeader } from "./moodle-cookie-jar";

const baseUrl = new URL("https://learning.example.test");

describe("MoodleCookieJar", () => {
  it("preserves cookie flags and sends only matching paths", () => {
    const jar = new MoodleCookieJar(baseUrl, [], () => new Date("2026-07-19T10:00:00Z"));
    jar.setFromHeader(
      "MoodleSession=session-value; Path=/; Secure; HttpOnly; SameSite=None",
      new URL("https://learning.example.test/login/index.php"),
    );
    jar.setFromHeader(
      "course_pref=compact; Path=/course; Secure; SameSite=Lax; Max-Age=120",
      new URL("https://learning.example.test/course/view.php"),
    );

    expect(jar.headerFor(new URL("https://learning.example.test/course/view.php")))
      .toBe("course_pref=compact; MoodleSession=session-value");
    expect(jar.headerFor(new URL("https://learning.example.test/my/")))
      .toBe("MoodleSession=session-value");
    expect(jar.toJSON()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: "MoodleSession",
        domain: "learning.example.test",
        path: "/",
        secure: true,
        httpOnly: true,
        sameSite: "None",
      }),
    ]));
  });

  it("rejects foreign domains, insecure SameSite=None and expired cookies", () => {
    const jar = new MoodleCookieJar(baseUrl, [], () => new Date("2026-07-19T10:00:00Z"));
    jar.setFromHeader("foreign=x; Domain=other.example.test; Path=/; Secure", baseUrl);
    jar.setFromHeader("weak=x; Path=/; SameSite=None", baseUrl);
    jar.setFromHeader("old=x; Path=/; Expires=Sat, 18 Jul 2026 10:00:00 GMT", baseUrl);

    expect(jar.toJSON()).toEqual([]);
    expect(jar.headerFor(new URL("https://other.example.test/"))).toBe("");
  });

  it("deletes a matching cookie with Max-Age=0", () => {
    const jar = new MoodleCookieJar(baseUrl);
    jar.setFromHeader("MoodleSession=one; Path=/; Secure", baseUrl);
    jar.setFromHeader("MoodleSession=gone; Path=/; Secure; Max-Age=0", baseUrl);
    expect(jar.headerFor(baseUrl)).toBe("");
  });

  it("splits combined headers without breaking an Expires date", () => {
    expect(splitSetCookieHeader(
      "first=1; Expires=Sun, 19 Jul 2026 12:00:00 GMT; Path=/, second=2; Path=/; Secure",
    )).toEqual([
      "first=1; Expires=Sun, 19 Jul 2026 12:00:00 GMT; Path=/",
      "second=2; Path=/; Secure",
    ]);
  });
});

