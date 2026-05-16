import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const indexHtml = readFileSync(
  path.join(__dirname, "../../index.html"),
  "utf8",
);

describe("social link previews", () => {
  it("usa o logotipo oficial da UOR Connect nos metadados de partilha", () => {
    const officialLogoUrl = "https://uorconnect.space/logoworconnect.png";

    expect(indexHtml).toContain(
      `<meta property="og:image" content="${officialLogoUrl}" />`,
    );
    expect(indexHtml).toContain(
      `<meta property="og:image:secure_url" content="${officialLogoUrl}" />`,
    );
    expect(indexHtml).toContain(
      `<meta name="twitter:image" content="${officialLogoUrl}" />`,
    );
    expect(indexHtml).toContain('<meta property="og:image:type" content="image/png" />');
    expect(indexHtml).toContain('<meta property="og:image:width" content="1839" />');
    expect(indexHtml).toContain('<meta property="og:image:height" content="933" />');
    expect(indexHtml).not.toContain("/icons/icon-512x512.png");
  });
});
