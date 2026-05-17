import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("voting visual design contract", () => {
  it("uses an institutional broadcast structure for the live vote screen", () => {
    const liveVotes = source("src/pages/VotacaoAoVivo.tsx");
    const styles = source("src/index.css");

    expect(liveVotes).toContain("live-votes-broadcast-shell");
    expect(liveVotes).toContain("live-votes-scoreboard");
    expect(liveVotes).toContain("live-votes-ranking-table");
    expect(liveVotes).toContain("Placar oficial");
    expect(liveVotes).not.toContain("Sparkles");
    expect(styles).toContain(".live-votes-broadcast-shell");
    expect(styles).toContain(".live-votes-scoreboard");
    expect(styles).toContain(".live-votes-ranking-table");
  });

  it("keeps project voting cards closer to a ballot than a generic AI card", () => {
    const showcaseCard = source("src/components/projects/ProjectShowcaseCard.tsx");
    const projectsPage = source("src/pages/Projetos.tsx");

    expect(showcaseCard).toContain("project-vote-card");
    expect(showcaseCard).toContain("project-vote-card__ballot");
    expect(showcaseCard).toContain("project-vote-card__vote-state");
    expect(showcaseCard).toContain("Voto registado");
    expect(projectsPage).toContain("project-compact-vote-card");
    expect(projectsPage).toContain("Boletim de projetos");
  });
});
