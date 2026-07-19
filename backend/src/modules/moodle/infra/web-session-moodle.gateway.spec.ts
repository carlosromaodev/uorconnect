import { describe, expect, it } from "vitest";
import type { MoodleGatewaySession } from "../domain/gateway";
import { MoodleGatewayFailure } from "../domain/gateway";
import type { MoodleHttpFetch } from "./web-session-moodle.gateway";
import { WebSessionMoodleGateway } from "./web-session-moodle.gateway";

type ExpectedRequest = {
  method: string;
  path: string;
  response: () => Response;
  inspect?: (init: RequestInit) => void;
};

function headers(init: RequestInit): Headers {
  return new Headers(init.headers);
}

function queuedFetch(expected: ExpectedRequest[]): { fetch: MoodleHttpFetch; calls: URL[] } {
  const queue = [...expected];
  const calls: URL[] = [];
  return {
    calls,
    fetch: async (input, init = {}) => {
      const item = queue.shift();
      if (!item) throw new Error("unexpected fixture request");
      const url = new URL(input);
      calls.push(url);
      expect((init.method ?? "GET").toUpperCase()).toBe(item.method);
      expect(`${url.pathname}${url.search}`).toBe(item.path);
      item.inspect?.(init);
      return item.response();
    },
  };
}

function html(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    ...init,
    headers: { "content-type": "text/html; charset=utf-8", ...init.headers },
  });
}

function session(): MoodleGatewaySession {
  return {
    cookies: [{
      name: "MoodleSession",
      value: "fixture-session",
      domain: "learning.example.test",
      path: "/",
      expires: null,
      secure: true,
      httpOnly: true,
      sameSite: "None",
    }],
    sesskey: "fixtureSesskey",
    authenticatedAt: "2026-07-19T10:00:00.000Z",
    expiresAt: "2026-07-19T10:30:00.000Z",
  };
}

describe("WebSessionMoodleGateway", () => {
  it("authenticates through the custom redirect flow and includes an optional logintoken", async () => {
    const fake = queuedFetch([
      {
        method: "GET",
        path: "/login/index.php",
        response: () => new Response(null, {
          status: 303,
          headers: { location: "/home/", "set-cookie": "preference=pt; Path=/; Secure; SameSite=Lax; Max-Age=60" },
        }),
      },
      {
        method: "GET",
        path: "/home/",
        response: () => html(`
          <form action="/login/index.php" method="post">
            <input name="username"><input name="password" type="password">
            <input name="logintoken" value="fixture-login-token">
          </form>
        `),
      },
      {
        method: "POST",
        path: "/login/index.php",
        inspect: (init) => {
          const form = new URLSearchParams(String(init.body));
          expect(form.get("username")).toBe("student-fixture");
          expect(form.get("password")).toBe("fixture-password");
          expect(form.get("logintoken")).toBe("fixture-login-token");
          expect(headers(init).get("cookie")).toContain("preference=pt");
        },
        response: () => new Response(null, {
          status: 303,
          headers: {
            location: "/login/index.php?testsession=73",
            "set-cookie": "MoodleSession=authenticated-fixture; Path=/; Secure; HttpOnly; SameSite=None",
          },
        }),
      },
      {
        method: "GET",
        path: "/login/index.php?testsession=73",
        response: () => new Response(null, { status: 303, headers: { location: "/my/" } }),
      },
      {
        method: "GET",
        path: "/my/",
        inspect: (init) => expect(headers(init).get("cookie")).toContain("MoodleSession=authenticated-fixture"),
        response: () => html(`
          <div data-region="user-menu"><a href="/login/logout.php?sesskey=dashboardKey">Sair</a></div>
          <script>M.cfg = {"sesskey":"dashboardKey"};</script>
        `),
      },
      {
        method: "GET",
        path: "/user/profile.php",
        response: () => html(`
          <main data-userid="73">
            <div class="page-header-headings"><h1>Estudante Exemplo</h1></div>
            <dl>
              <dt>Número do estudante</dt><dd>2026-0042</dd>
              <dt>Email</dt><dd>student42@example.test</dd>
              <dt>Fuso horário</dt><dd>Africa/Luanda</dd>
            </dl>
          </main>
        `),
      },
    ]);
    const gateway = new WebSessionMoodleGateway({
      baseUrl: "https://learning.example.test",
      fetch: fake.fetch,
      now: () => new Date("2026-07-19T10:00:00Z"),
    });

    const connected = await gateway.authenticate({
      username: "student-fixture",
      password: "fixture-password",
    });

    expect(connected.profile).toMatchObject({
      externalUserKey: "73",
      studentNumber: "20260042",
      displayName: "Estudante Exemplo",
    });
    expect(connected.session.sesskey).toBe("dashboardKey");
    expect(connected.session.expiresAt).toBe("2026-07-19T10:30:00.000Z");
    expect(connected.session.cookies.map((cookie) => cookie.name)).toEqual(["MoodleSession", "preference"]);
    expect(JSON.stringify(connected)).not.toContain("fixture-password");
  });

  it("reports a 200 login page as an expired session", async () => {
    const fake = queuedFetch([
      {
        method: "GET",
        path: "/my/",
        response: () => new Response(null, { status: 303, headers: { location: "/home/" } }),
      },
      {
        method: "GET",
        path: "/home/",
        response: () => html(`
          <form action="/login/index.php"><input name="username"><input name="password"></form>
        `),
      },
    ]);
    const gateway = new WebSessionMoodleGateway({ baseUrl: "https://learning.example.test", fetch: fake.fetch });

    await expect(gateway.validateSession(session())).resolves.toEqual({ valid: false, reason: "expired" });
  });

  it("uses structured AJAX courses and never turns unavailable progress into zero", async () => {
    const fake = queuedFetch([{
      method: "POST",
      path: "/lib/ajax/service.php?sesskey=fixtureSesskey&info=core_course_get_enrolled_courses_by_timeline_classification",
      inspect: (init) => {
        expect(headers(init).get("cookie")).toContain("MoodleSession=fixture-session");
        const request = JSON.parse(String(init.body));
        expect(request[0].methodname).toBe("core_course_get_enrolled_courses_by_timeline_classification");
      },
      response: () => new Response(JSON.stringify([{
        error: false,
        data: {
          courses: [
            { id: 10, fullname: "Ética", shortname: "ETI", hasprogress: false, progress: 0, visible: true },
            { id: 11, fullname: "Redes", shortname: "RED", hasprogress: true, progress: 0, visible: true },
          ],
          nextoffset: 0,
        },
      }]), { headers: { "content-type": "application/json" } }),
    }]);
    const gateway = new WebSessionMoodleGateway({ baseUrl: "https://learning.example.test", fetch: fake.fetch });

    const result = await gateway.listCourses(session());
    expect(result).toMatchObject({ complete: true, source: "ajax" });
    expect(result.courses).toEqual(expect.arrayContaining([
      expect.objectContaining({ externalKey: "10", progressAvailable: false, progressPercent: null }),
      expect.objectContaining({ externalKey: "11", progressAvailable: true, progressPercent: 0 }),
    ]));
    expect(JSON.stringify(result)).not.toContain("learning.example.test");
  });

  it("falls back to authenticated HTML when the internal AJAX shape changes", async () => {
    const fake = queuedFetch([
      {
        method: "POST",
        path: "/lib/ajax/service.php?sesskey=fixtureSesskey&info=core_course_get_enrolled_courses_by_timeline_classification",
        response: () => new Response(JSON.stringify([{ error: false, data: { changed: true } }]), {
          headers: { "content-type": "application/json" },
        }),
      },
      {
        method: "GET",
        path: "/my/courses.php",
        response: () => html(`
          <nav>Página principal https://learning.example.test/my/</nav>
          <div class="course-info-container">
            <a href="/course/view.php?id=29">Arquitectura de Software</a>
          </div>
        `),
      },
    ]);
    const gateway = new WebSessionMoodleGateway({ baseUrl: "https://learning.example.test", fetch: fake.fetch });

    const result = await gateway.listCourses(session());
    expect(result).toMatchObject({ complete: false, source: "html" });
    expect(result.courses).toEqual([expect.objectContaining({
      externalKey: "29",
      name: "Arquitectura de Software",
      progressAvailable: false,
      progressPercent: null,
    })]);
    expect(JSON.stringify(result)).not.toMatch(/P[aá]gina principal|learning\.example\.test/);
  });

  it("marks a capped AJAX listing as incomplete instead of claiming an exact total", async () => {
    const pages = Array.from({ length: 20 }, (_, page) => ({
      method: "POST",
      path: "/lib/ajax/service.php?sesskey=fixtureSesskey&info=core_course_get_enrolled_courses_by_timeline_classification",
      response: () => new Response(JSON.stringify([{
        error: false,
        data: {
          courses: [{
            id: 100 + page,
            fullname: `Disciplina ${page + 1}`,
            shortname: `D${page + 1}`,
            hasprogress: false,
            visible: true,
          }],
          nextoffset: (page + 1) * 100,
        },
      }]), { headers: { "content-type": "application/json" } }),
    }));
    const fake = queuedFetch(pages);
    const gateway = new WebSessionMoodleGateway({ baseUrl: "https://learning.example.test", fetch: fake.fetch });

    const result = await gateway.listCourses(session());
    expect(result).toMatchObject({ complete: false, source: "ajax" });
    expect(result.courses).toHaveLength(20);
  });

  it("combines safe course HTML with structured sections and materials", async () => {
    const state = JSON.stringify([
      { name: "section", action: "put", fields: { id: 50, section: 1, title: "Semana 1", cmlist: [90] } },
      { name: "cm", action: "put", fields: { id: 90, sectionid: 50, modname: "resource", name: "Guia.pdf", visible: 1 } },
    ]);
    const fake = queuedFetch([
      {
        method: "GET",
        path: "/course/view.php?id=25",
        response: () => html(`<div class="page-header-headings"><h1>Programação I</h1></div>`),
      },
      {
        method: "POST",
        path: "/lib/ajax/service.php?sesskey=fixtureSesskey&info=core_courseformat_get_state",
        response: () => new Response(JSON.stringify([{ error: false, data: state }]), {
          headers: { "content-type": "application/json" },
        }),
      },
    ]);
    const gateway = new WebSessionMoodleGateway({ baseUrl: "https://learning.example.test", fetch: fake.fetch });

    const content = await gateway.getCourseContent(session(), "25");
    expect(content).toMatchObject({ complete: true, source: "ajax" });
    expect(content.course.name).toBe("Programação I");
    expect(content.sections[0]).toMatchObject({ externalKey: "50", title: "Semana 1" });
    expect(content.materials[0]).toMatchObject({
      externalKey: "90",
      type: "file",
      locator: { kind: "course-module", courseModuleKey: "90" },
    });
  });

  it("marks HTML-only course content as incomplete", async () => {
    const fake = queuedFetch([{
      method: "GET",
      path: "/course/view.php?id=25",
      response: () => html(`
        <div class="page-header-headings"><h1>Programação I</h1></div>
        <li id="section-0" data-sectionid="50" class="section main">
          <h3 class="sectionname">Semana 1</h3>
          <li id="module-90" class="activity modtype_resource">
            <a href="/mod/resource/view.php?id=90"><span class="instancename">Guia.pdf</span></a>
          </li>
        </li>
      `),
    }]);
    const gateway = new WebSessionMoodleGateway({ baseUrl: "https://learning.example.test", fetch: fake.fetch });
    const withoutSesskey = session();
    withoutSesskey.sesskey = null;

    const content = await gateway.getCourseContent(withoutSesskey, "25");
    expect(content).toMatchObject({ complete: false, source: "html" });
    expect(content.materials).toHaveLength(1);
  });

  it("rejects redirects outside the configured Moodle origin", async () => {
    const fake = queuedFetch([{
      method: "GET",
      path: "/my/",
      response: () => new Response(null, { status: 302, headers: { location: "https://attacker.example/collect" } }),
    }]);
    const gateway = new WebSessionMoodleGateway({ baseUrl: "https://learning.example.test", fetch: fake.fetch });

    await expect(gateway.validateSession(session())).rejects.toEqual(
      expect.objectContaining({ code: "MOODLE_UNSAFE_REDIRECT" }),
    );
  });

  it("enforces one authentication budget across the whole login flow", async () => {
    const blockingFetch: MoodleHttpFetch = async (_input, init = {}) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    });
    const gateway = new WebSessionMoodleGateway({
      baseUrl: "https://learning.example.test",
      fetch: blockingFetch,
      timeoutMs: 1_000,
      authenticationBudgetMs: 25,
    });

    await expect(gateway.authenticate({ username: "fixture", password: "fixture" }))
      .rejects.toEqual(expect.objectContaining({ code: "MOODLE_UNAVAILABLE" }));
  });

  it("stops reading a chunked text response as soon as the byte cap is exceeded", async () => {
    const fake = queuedFetch([{
      method: "GET",
      path: "/my/",
      response: () => new Response(new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("12345678"));
          controller.enqueue(new TextEncoder().encode("abcdefgh"));
          controller.close();
        },
      }), { headers: { "content-type": "text/html" } }),
    }]);
    const gateway = new WebSessionMoodleGateway({
      baseUrl: "https://learning.example.test",
      fetch: fake.fetch,
      maxTextResponseBytes: 10,
    });

    await expect(gateway.validateSession(session())).rejects.toEqual(
      expect.objectContaining({ code: "MOODLE_RESPONSE_TOO_LARGE" }),
    );
  });

  it("opens only same-origin passive files and preserves a valid Range", async () => {
    const fake = queuedFetch([{
      method: "GET",
      path: "/pluginfile.php/10/mod_resource/content/1/guide.pdf?forcedownload=1",
      inspect: (init) => expect(headers(init).get("range")).toBe("bytes=0-3"),
      response: () => new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
        status: 206,
        headers: {
          "content-type": "application/pdf",
          "content-length": "4",
          "content-range": "bytes 0-3/100",
          "content-disposition": "attachment; filename=guide.pdf",
        },
      }),
    }]);
    const gateway = new WebSessionMoodleGateway({ baseUrl: "https://learning.example.test", fetch: fake.fetch });

    const result = await gateway.openStream(session(), {
      kind: "plugin-file",
      path: "/pluginfile.php/10/mod_resource/content/1/guide.pdf?forcedownload=1",
    }, { range: "bytes=0-3" });
    expect(result).toMatchObject({
      status: 206,
      contentType: "application/pdf",
      contentLength: 4,
      contentRange: "bytes 0-3/100",
      filename: "guide.pdf",
    });
    expect(new Uint8Array(await new Response(result.body).arrayBuffer()))
      .toEqual(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
  });

  it("rejects active content even when returned by a stored locator", async () => {
    const fake = queuedFetch([{
      method: "GET",
      path: "/pluginfile.php/10/mod_resource/content/1/page.html",
      response: () => new Response("<script>bad()</script>", {
        headers: { "content-type": "text/html", "content-disposition": "attachment; filename=page.html" },
      }),
    }]);
    const gateway = new WebSessionMoodleGateway({ baseUrl: "https://learning.example.test", fetch: fake.fetch });

    await expect(gateway.openStream(session(), {
      kind: "plugin-file",
      path: "/pluginfile.php/10/mod_resource/content/1/page.html",
    })).rejects.toBeInstanceOf(MoodleGatewayFailure);
  });
});
