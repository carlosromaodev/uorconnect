import { expect, test, type Page } from "@playwright/test";

const provider = {
  provider: "secretaria",
  status: "connected",
  connected: true,
  credentialStored: true,
  actionRequired: "none",
  retryable: false,
  lastAuthenticatedAt: "2026-07-26T08:00:00.000Z",
  lastSuccessfulSyncAt: "2026-07-26T08:00:00.000Z",
};

async function mockStudentDashboard(page: Page) {
  await page.route("**/api/v1/student/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { active: true, profileId: "profile-opaque", institutionCode: "uor", providers: [provider] },
      }),
    });
  });
  await page.route("**/api/v1/student/today", async (route) => {
    const provenance = {
      source: "secretaria_uor",
      observedAt: "2026-07-26T08:00:00.000Z",
      coverage: "exact",
      stale: false,
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          identity: {
            institutionCode: "uor",
            studentNumber: "20240000",
            displayName: "Ana Estudante",
            course: "Engenharia Informática",
            classCode: "EI-4",
            academicYear: "2025/2026",
            academicPeriod: "2.º semestre",
            provenance,
          },
          priorities: [],
          academic: { enrollments: 6, grades: 5, exams: 2, attendance: 10, provenance },
          learning: { courses: 6, materials: 12, provenance: { ...provenance, source: "moodle" } },
          finance: { charges: 2, references: 1, payments: 8, receipts: 8, provenance },
          agenda: { officialExams: 2, moodleDeadlines: null, provenance },
          providers: [provider],
        },
      }),
    });
  });
}

test("presents a dedicated and accessible student login", async ({ page }) => {
  await page.goto("/estudante-login");

  await expect(page.getByRole("heading", { name: "Entra como estudante" })).toBeVisible();
  await expect(page.getByLabel("Número de estudante")).toBeVisible();
  await expect(page.getByLabel("Palavra-passe da Secretaria")).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar na UOR Estudante" })).toBeVisible();
  await expect(page.locator("nav").filter({ hasText: "Agenda" })).toHaveCount(0);

  await page.getByLabel("Número de estudante").focus();
  await expect(page.getByLabel("Número de estudante")).toBeFocused();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("renders the private dashboard in the own product shell", async ({ page }) => {
  await mockStudentDashboard(page);
  await page.goto("/estudante");

  await expect(page.getByRole("heading", { name: "Olá, Ana." })).toBeVisible();
  await expect(page.getByText("Secretaria e Moodle, sem botão para atualizar.")).toBeVisible();
  await expect(page.locator('nav[aria-label*="UOR Estudante"]:visible')).toHaveCount(1);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
