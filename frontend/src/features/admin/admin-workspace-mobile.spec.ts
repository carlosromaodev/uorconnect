import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("AdminWorkspace mobile navigation", () => {
  it("abre o menu mobile sem deixar a tela fusca", () => {
    const source = readSource("./AdminWorkspace.tsx");
    const css = readSource("../../index.css");

    expect(source).toContain("admin-mobile-sidebar-scrim");
    expect(source).not.toContain("bg-black/20 backdrop-blur-[2px]");
    expect(css).toContain(".admin-mobile-sidebar-scrim");
    expect(css).toContain("background: rgb(15 23 42 / 0.06);");
  });

  it("mantem o menu e o conteudo a rolar em superficies independentes", () => {
    const source = readSource("./AdminWorkspace.tsx");
    const css = readSource("../../index.css");

    expect(source).toContain(
      "admin-shell relative h-[100svh] min-h-[100svh] overflow-hidden",
    );
    expect(source).toContain(
      "document.body.style.overflow = \"hidden\"",
    );
    expect(source).toContain(
      "document.documentElement.style.overscrollBehavior = \"none\"",
    );
    expect(source).toContain(
      "admin-mobile-sidebar-scrim fixed inset-0 z-[90] lg:hidden",
    );
    expect(source).toContain("aria-label=\"Abrir menu administrativo\"");
    expect(source).toContain("aria-label=\"Fechar menu administrativo\"");
    expect(source).toContain(
      "onWheel={stopSidebarScrollPropagation}",
    );
    expect(source).toContain(
      "onTouchMove={stopSidebarTouchPropagation}",
    );
    expect(source).toContain(
      "admin-shell__layout relative flex h-full min-h-0 overflow-hidden",
    );
    expect(source).toContain(
      "admin-shell__sidebar fixed inset-y-0 left-0 z-[100] flex h-[100svh] max-h-[100svh] min-h-0 w-[min(86vw,304px)]",
    );
    expect(source).toContain(
      "admin-shell__brand flex min-h-20 shrink-0",
    );
    expect(source).toContain(
      "admin-shell__nav min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 py-5",
    );
    expect(source).toContain(
      "admin-sidebar-footer shrink-0",
    );
    expect(source).toContain(
      "admin-main-panel flex h-full min-w-0 flex-1 flex-col overflow-hidden",
    );
    expect(source).toContain(
      "admin-content min-h-0 flex-1 overflow-y-auto overscroll-contain",
    );
    expect(css).toContain("@media (max-width: 1023px)");
    expect(css).toContain(".admin-workspace.admin-shell");
    expect(css).toContain("height: 100svh;");
    expect(css).toContain("overscroll-behavior-y: contain;");
  });

  it("mantem o CRUD de inscritos dos cursos com icone e remocao ligados", () => {
    const source = readSource("./AdminWorkspace.tsx");
    const apiSource = readSource("../../lib/api.ts");

    expect(source).toMatch(/UserPlus,[\s\S]*} from "lucide-react";/);
    expect(source).toContain("<UserPlus className=\"mr-1 h-3.5 w-3.5\" />");
    expect(source).toContain("handleCourseEnrollmentRemove");
    expect(source).toContain("courseEnrollmentPendingRemoval");
    expect(source).toContain("setCourseEnrollmentPendingRemoval");
    expect(source).not.toContain("window.confirm(`Remover ${fullName} deste curso?`)");
    expect(source).toContain("Participante removido do curso.");
    expect(apiSource).toContain("removeEnrollment: (enrollmentId: number)");
    expect(apiSource).toContain("method: \"DELETE\"");
  });

  it("mostra o comprovativo de pagamento dos inscritos dos cursos na admin", () => {
    const source = readSource("./AdminWorkspace.tsx");

    expect(source).toContain("adminDocumentHref");
    expect(source).toContain("entry.paymentProofPath");
    expect(source).toContain("Ver comprovativo");
    expect(source).toContain("rel=\"noreferrer noopener\"");
  });

  it("mantem detalhes expandidos de cursos responsivos sem esmagar texto", () => {
    const source = readSource("./AdminWorkspace.tsx");

    expect(source).toContain("course-enrollment-expanded-panel");
    expect(source).toContain("course-enrollment-row-grid");
    expect(source).toContain("grid-cols-1 sm:grid-cols-2 2xl:grid-cols-5");
    expect(source).toContain("min-w-[min(100%,12rem)]");
    expect(source).toContain("break-words");
  });

  it("usa modal de exclusao para curso e inscrito do curso", () => {
    const source = readSource("./AdminWorkspace.tsx");

    expect(source).toContain("coursePendingRemoval");
    expect(source).toContain("courseEnrollmentPendingRemoval");
    expect(source).toContain("Eliminar curso");
    expect(source).toContain("Remover inscrito do curso");
    expect(source).toContain("Esta ação remove o curso");
    expect(source).toContain("Esta ação remove a inscrição");
  });

  it("expõe reset de votos com confirmação SMS no número protegido", () => {
    const source = readSource("./AdminWorkspace.tsx");
    const apiSource = readSource("../../lib/api.ts");

    expect(source).toContain("Remover todos os votos");
    expect(source).toContain("+244937624785");
    expect(source).toContain("api.interactions.requestVotesResetConfirmation");
    expect(source).toContain("api.interactions.confirmVotesReset");
    expect(apiSource).toContain("requestVotesResetConfirmation");
    expect(apiSource).toContain("/interactions/admin/votes/reset/request-confirmation");
    expect(apiSource).toContain("confirmVotesReset");
    expect(apiSource).toContain("/interactions/admin/votes/reset/confirm");
  });

  it("expõe reset do desafio com confirmação SMS no número protegido", () => {
    const source = readSource("../../components/admin/AdminPassportTab.tsx");
    const apiSource = readSource("../../lib/api.ts");

    expect(source).toContain("Reiniciar desafio");
    expect(source).toContain("+244937624785");
    expect(source).toContain("api.passport.requestResetConfirmation");
    expect(source).toContain("api.passport.confirmReset");
    expect(apiSource).toContain("requestResetConfirmation");
    expect(apiSource).toContain("/passport/admin/reset/request-confirmation");
    expect(apiSource).toContain("confirmReset");
    expect(apiSource).toContain("/passport/admin/reset/confirm");
  });

  it("organiza candidaturas com subpagina de projetos e obrigações por membro", () => {
    const source = readSource("./AdminWorkspace.tsx");

    expect(source).toContain("submissionSubpages");
    expect(source).toContain("Projetos e obrigações");
    expect(source).toContain("activeSubmissionSubpage");
    expect(source).toContain("teamAllConfirmed");
    expect(source).toContain("teamMembers.map");
    expect(source).toContain("Foto do projeto");
    expect(source).toContain("Baixar manual");
  });
});
