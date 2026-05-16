# Home Passaporte Promo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a premium boarding-pass style promotional card for the Desafio UOR Connect on the home page, linking to `Minha Área → Desafio`.

**Architecture:** Keep the feature local to `frontend/src/pages/Index.tsx` as a presentational section, following the existing home page pattern of small local components. Protect the placement and copy with a source contract test.

**Tech Stack:** React, TypeScript, Vite, Tailwind CSS, Vitest.

---

### Task 1: Home Promo Contract

**Files:**
- Create: `frontend/src/pages/home-passport-promo.contract.spec.ts`
- Modify: `frontend/src/pages/Index.tsx`

- [x] **Step 1: Write the failing test**

Assert that `Index.tsx` contains `PassportChallengePromo`, the target route `/minha-area?tab=desafio`, the title `Chegou o Desafio UOR Connect`, and the prize labels `Prime Video`, `HBO`, and `Duolingo`.

- [x] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run src/pages/home-passport-promo.contract.spec.ts`

- [x] **Step 3: Implement the section**

Add a `PassportChallengePromo` component in `Index.tsx`, place it after the stats/quick links section and before the first `SectionDivider`, and make the CTA link to `/minha-area?tab=desafio`.

- [x] **Step 4: Run the focused test and frontend build**

Run:

```bash
npm test -- --run src/pages/home-passport-promo.contract.spec.ts
npm run build
```
