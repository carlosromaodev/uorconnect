# Project Public Details And Mobile Manual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow project owners to update public project details/social links and make the exhibitor manual render mobile system components as a practical guide.

**Architecture:** Extend the existing submission presentation update path instead of creating a second project profile flow. Reuse Minha Área labels/states in the PDF generator as mobile snapshots, so the manual remains aligned with the system without introducing a separate design language.

**Tech Stack:** Fastify, Zod, Prisma, React, TypeScript, Vitest, Playwright PDF HTML rendering.

---

### Task 1: Public Project Details Data

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260516173000_project_public_links/migration.sql`
- Modify: `backend/src/modules/submission/domain/submission.ts`
- Modify: `backend/src/modules/submission/domain/submission.repository.ts`
- Modify: `backend/src/modules/submission/use-cases/manage-submissions.ts`
- Modify: `backend/src/modules/submission/http/submission.routes.ts`
- Modify: `backend/src/modules/submission/infra/prisma/prisma.submission.repository.ts`
- Modify: `backend/src/modules/interactions/http/interactions.routes.ts`

- [ ] Add nullable project social columns: `instagramUrl`, `facebookUrl`, `linkedinUrl`, `githubUrl`.
- [ ] Extend presentation update payload with `description`, `repoUrl`, `websiteUrl`, and social URLs.
- [ ] Return those fields from owner/admin/public project responses.

### Task 2: Minha Área Editing UI

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/pages/MinhaArea.tsx`
- Modify: `frontend/src/pages/ProjetoDetalhe.tsx`

- [ ] Add typed API fields for public details.
- [ ] Add a mobile-friendly “Detalhes públicos do projeto” editor for project owners.
- [ ] Display project social links on the public project detail page.

### Task 3: Mobile Component Manual

**Files:**
- Modify: `backend/src/modules/submission/http/exhibitor-pdf.ts`
- Modify: `backend/src/modules/submission/http/exhibitor-pdf.spec.ts`

- [ ] Bump PDF template version.
- [ ] Add mobile snapshots for QR conversion, details editor, team management, challenge states, round map, ambassador ranking, and points rules.
- [ ] Include step-by-step usage beside each mobile snapshot.

### Task 4: Verification

**Commands:**
- `npm test -- --run src/modules/submission/http/exhibitor-pdf.spec.ts src/modules/submission/use-cases/manage-submissions.spec.ts src/modules/submission/http/student-submission-presenter.spec.ts`
- `npm run test -- --run src/pages/minha-area-project-public-details.contract.spec.ts`
- `bash scripts/verify-local.sh`
