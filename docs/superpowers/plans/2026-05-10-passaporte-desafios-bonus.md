# Passaporte Desafios e Bónus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar a lógica de QR do Passaporte Digital: projeto visita stand, expositor abre desafio, estudante faz networking, núcleo dá bónus, regras bloqueadas aparecem com feedback próprio e combos entram no ledger.

**Architecture:** O backend mantém a autoridade das regras no scanner e no serviço do Passaporte. O frontend só interpreta `result`, `actionType`, pontos e mensagens para exibir modais animados, sons e cores consistentes.

**Tech Stack:** Fastify, Prisma, Vitest, React, Framer Motion, CSS.

---

### Task 1: Regras de QR e Missões

**Files:**
- Modify: `backend/src/modules/passport/application/passport.service.ts`
- Modify: `backend/src/modules/attendance/http/attendance.routes.ts`
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260510120000_passport_challenge_game_closure/migration.sql`
- Test: `backend/src/modules/passport/application/passport-game-rules.spec.ts`

- [ ] **Step 1: Write failing tests**
  - Test `NUCLEUS_MEMBER_BONUS` exists in the catalog and maps to the correct mission.
  - Test `answerPassportChallenge` rejects answers when the student has not scanned the exhibitor QR.
  - Test project owner/member cannot score their own challenge.
  - Test nucleus member scan uses one ledger key per scanner/member pair and blocks self-scan.

- [ ] **Step 2: Verify red**
  - Run: `npm --prefix backend run test -- src/modules/passport/application/passport-game-rules.spec.ts`
  - Expected: FAIL because the new helpers, statuses and mission mapping do not exist.

- [ ] **Step 3: Implement backend**
  - Add `NUCLEUS_MEMBER_BONUS`, `PERFECT_SEQUENCE_COMBO`, `BALANCED_EXPLORER_COMBO`, `MENTOR_FOUND_BONUS`.
  - Add challenge `status`, `reviewNote`, `version` and answer `challengeVersion`.
  - Resolve team credential route targets by category: `EXPOSITOR` creates/uses `EXHIBITOR_CHALLENGE`; `NUCLEO` creates/uses `NUCLEUS_MEMBER_BONUS`.
  - Keep project routes as `STAND_VISIT`.
  - Require successful challenge QR scan before answer.
  - Block owner/member self-challenge.
  - Award combo ledgers after stand, challenge and networking events.

- [ ] **Step 4: Verify green**
  - Run: `npm --prefix backend run test -- src/modules/passport/application/passport-game-rules.spec.ts`
  - Expected: PASS.

### Task 2: Admin and Student Status Surfaces

**Files:**
- Modify: `backend/src/modules/passport/http/passport.routes.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/components/admin/AdminPassportTab.tsx`
- Modify: `frontend/src/pages/MinhaArea.tsx`
- Test: `frontend/src/pages/passport-challenges-effects.spec.ts`

- [ ] **Step 1: Write failing tests**
  - Assert statuses `PENDING_APPROVAL`, `APPROVED`, `PAUSED`, `REJECTED` and review note labels exist.
  - Assert blocked QR messages are mapped to professional challenge modals.

- [ ] **Step 2: Verify red**
  - Run: `npm --prefix frontend run test -- passport-challenges-effects.spec.ts`
  - Expected: FAIL for missing messages/status mapping.

- [ ] **Step 3: Implement frontend**
  - Map backend `result` codes to amber, soft red, cyan and UOR success tones.
  - Use funny but clear text for self-scan, self-stand, self-challenge, duplicate nucleus, expired QR and same-course networking.
  - Preserve reduced-motion support and existing audio hooks.

- [ ] **Step 4: Verify green**
  - Run: `npm --prefix frontend run test -- passport-challenges-effects.spec.ts`
  - Expected: PASS.

### Task 3: Full Verification

**Files:**
- Verify all touched files.

- [ ] **Step 1: Prepare Prisma**
  - Run: `npm --prefix backend run prisma:prepare:postgres`
  - Expected: deploy schema regenerated.

- [ ] **Step 2: Build and lint**
  - Run: `npm --prefix backend run lint`
  - Run: `npm --prefix backend run build`
  - Run: `npm --prefix frontend run lint`
  - Run: `npm --prefix frontend run build`
  - Expected: no new blocking errors.
