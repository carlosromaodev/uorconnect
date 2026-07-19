import { describe, expect, it } from "vitest";
import { MoodleGatewayFailure } from "../domain/gateway";
import {
  cleanMoodleText,
  extractMoodleSesskey,
  isMoodleLoginPage,
  parseMoodleCourseAjaxResponse,
  parseMoodleCourseFormatAjaxResponse,
  parseMoodleCourseHtml,
  parseMoodleProfile,
} from "./moodle-html.parser";

describe("Moodle response parser", () => {
  it("detects an expired session even when the login page returns HTTP 200", () => {
    const html = `
      <html><body>
        <form method="post" action="/login/index.php">
          <input name="username"><input name="password" type="password">
        </form>
      </body></html>
    `;
    expect(isMoodleLoginPage(html, "/home/")).toBe(true);
    expect(extractMoodleSesskey(html)).toBeNull();
  });

  it("extracts the authenticated identity without returning page URLs", () => {
    const profile = parseMoodleProfile(`
      <html data-userid="73">
        <nav><a href="https://learning.example.test/my/">Navegação</a></nav>
        <div class="page-header-headings"><h1>Estudante Exemplo</h1></div>
        <dl>
          <dt>Número do estudante</dt><dd> 2026-0042 </dd>
          <dt>Endereço de email</dt><dd>student42@example.test</dd>
          <dt>Fuso horário</dt><dd>Africa/Luanda</dd>
        </dl>
      </html>
    `);
    expect(profile).toEqual({
      externalUserKey: "73",
      studentNumber: "20260042",
      displayName: "Estudante Exemplo",
      email: "student42@example.test",
      timezone: "Africa/Luanda",
    });
    expect(JSON.stringify(profile)).not.toContain("learning.example.test");
  });

  it("keeps untracked progress null and preserves a real tracked zero", () => {
    const result = parseMoodleCourseAjaxResponse([{
      error: false,
      data: {
        nextoffset: 0,
        courses: [
          { id: 10, fullname: "Ética", shortname: "ETI", hasprogress: false, progress: 0, visible: 1 },
          { id: 11, fullname: "Redes", shortname: "RED", hasprogress: true, progress: 0, visible: 1 },
        ],
      },
    }]);
    expect(result.courses[0]).toMatchObject({ progressAvailable: false, progressPercent: null });
    expect(result.courses[1]).toMatchObject({ progressAvailable: true, progressPercent: 0 });
  });

  it("rejects an AJAX session error as expiry", () => {
    expect(() => parseMoodleCourseAjaxResponse([{
      error: true,
      exception: { errorcode: "invalidsesskey", message: "fixture-only" },
    }])).toThrowError(expect.objectContaining({ code: "MOODLE_SESSION_EXPIRED" }));
  });

  it("normalizes sections and materials while removing navigation and scripts", () => {
    const parsed = parseMoodleCourseHtml(`
      <html>
        <nav>Página principal Área pessoal https://learning.example.test/my/</nav>
        <script>window.secret = "noise"</script>
        <div class="page-header-headings"><h1>Programação I</h1></div>
        <li id="section-0" data-sectionid="500" class="section main">
          <h3 class="sectionname">Introdução</h3>
          <div class="summary">Começar aqui. <a href="https://external.test">Link</a></div>
          <li id="module-900" class="activity modtype_resource">
            <a href="/mod/resource/view.php?id=900">
              <span class="instancename">Guia.pdf <span class="accesshide">Ficheiro</span></span>
            </a>
            <div class="activity-description">Documento da primeira semana.</div>
          </li>
        </li>
      </html>
    `, "25");

    expect(parsed.course).toMatchObject({ name: "Programação I", progressPercent: null });
    expect(parsed.sections).toHaveLength(1);
    expect(parsed.sections[0]).toMatchObject({
      externalKey: "500",
      summary: "Começar aqui. Link",
      modules: [{ externalKey: "900", type: "resource", title: "Guia.pdf", available: true }],
    });
    expect(parsed.materials[0]).toMatchObject({
      type: "file",
      title: "Guia.pdf",
      openAvailable: true,
      locator: { kind: "course-module", courseModuleKey: "900" },
    });
    expect(JSON.stringify(parsed)).not.toMatch(/learning\.example\.test|window\.secret|P[aá]gina principal/);
  });

  it("parses the serialized course-format state with clean module summaries", () => {
    const state = JSON.stringify([
      { name: "section", action: "put", fields: { id: 70, section: 1, title: "Semana 1", cmlist: [80] } },
      { name: "cm", action: "put", fields: { id: 80, sectionid: 70, modname: "resource", name: "Aula.pdf", visible: 1 } },
    ]);
    const parsed = parseMoodleCourseFormatAjaxResponse([{ error: false, data: state }], "12");
    expect(parsed?.sections[0]).toMatchObject({
      externalKey: "70",
      position: 1,
      modules: [{ externalKey: "80", title: "Aula.pdf" }],
    });
    expect(parsed?.materials[0].locator).toEqual({
      kind: "course-module",
      moduleType: "resource",
      courseModuleKey: "80",
    });
  });

  it("does not count assignments, quizzes or forums as materials", () => {
    const state = JSON.stringify([
      { name: "section", action: "put", fields: { id: 70, section: 1, title: "Semana 1", cmlist: [80, 81, 82, 83] } },
      { name: "cm", action: "put", fields: { id: 80, sectionid: 70, modname: "resource", name: "Aula.pdf", visible: 1 } },
      { name: "cm", action: "put", fields: { id: 81, sectionid: 70, modname: "assign", name: "Trabalho 1", visible: 1 } },
      { name: "cm", action: "put", fields: { id: 82, sectionid: 70, modname: "quiz", name: "Teste 1", visible: 1 } },
      { name: "cm", action: "put", fields: { id: 83, sectionid: 70, modname: "forum", name: "Fórum", visible: 1 } },
    ]);
    const parsed = parseMoodleCourseFormatAjaxResponse([{ error: false, data: state }], "12");

    expect(parsed?.sections[0].modules.map((module) => module.type)).toEqual([
      "resource",
      "assign",
      "quiz",
      "forum",
    ]);
    expect(parsed?.materials).toHaveLength(1);
    expect(parsed?.materials[0]).toMatchObject({ type: "file", title: "Aula.pdf" });
  });

  it("marks structured content incomplete when a listed module record is missing", () => {
    const state = JSON.stringify([
      { name: "section", action: "put", fields: { id: 70, section: 1, title: "Semana 1", cmlist: [80, 81] } },
      { name: "cm", action: "put", fields: { id: 80, sectionid: 70, modname: "resource", name: "Aula.pdf", visible: 1 } },
    ]);

    const parsed = parseMoodleCourseFormatAjaxResponse([{ error: false, data: state }], "12");
    expect(parsed).toMatchObject({ complete: false });
    expect(parsed?.materials).toHaveLength(1);
  });

  it("removes peripheral Moodle UI and literal URLs from free text", () => {
    expect(cleanMoodleText(`
      <nav>Navegação</nav><p>Conteúdo útil</p>
      <p>https://learning.example.test/course/view.php?id=1&amp;sesskey=secret</p>
      <footer>Administração</footer>
    `)).toBe("Conteúdo útil");
  });
});
