# Game SMS Passport Exhibitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ligar mensagens WhatsApp/SMS humanizadas aos eventos de pontos do Passaporte Digital e Desafio do Expositor, com QR surpresa numerado, lote de impressão, regras dinâmicas e limites claros de pontuação.

**Architecture:** manter a pontuação dentro dos serviços existentes (`passport.service` e `exhibitor-scoring.service`) e criar uma camada pequena de notificação de jogo para compor mensagens limpas e acionar as automações já existentes. QR surpresa ganha metadados de lote/código impresso e regra dinâmica, sem criar um segundo sistema de QR.

**Tech Stack:** Fastify, Prisma, Zod, Vitest, React/Vite, renderização HTML→PDF existente.

---

### Task 1: Contratos de Mensagens e Gatilhos

**Files:**
- Create: `backend/src/modules/game-notifications/game-notification.service.spec.ts`
- Create: `backend/src/modules/game-notifications/game-notification.service.ts`
- Modify: `backend/src/modules/sms/http/sms.routes.ts`
- Modify: `backend/src/modules/whatsapp/http/whatsapp.routes.ts`
- Modify: `backend/src/modules/attendance/http/attendance.routes.ts`
- Modify: `backend/src/modules/interactions/http/interactions.routes.ts`

- [ ] **Step 1: Write failing tests**
  Test message sanitization, game wording, QR hint text and source scans that import the notifier from attendance/interactions.

- [ ] **Step 2: Run tests to verify failure**
  Run: `npm --prefix backend test -- --run src/modules/game-notifications/game-notification.service.spec.ts`
  Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement message composer**
  Add `sanitizeGameMessage`, `composePassportGameNotification`, `composeExhibitorGameNotification`, `notifyPassportGameEvent`, and `notifyExhibitorGameEvent`.

- [ ] **Step 4: Register automation keys**
  Add `PASSPORT_POINTS_GAINED`, `PASSPORT_POINTS_LOST`, `PASSPORT_NEGATIVE_BALANCE`, `EXHIBITOR_POINTS_GAINED`, and `EXHIBITOR_POINTS_LOST` to WhatsApp and SMS automation definitions.

- [ ] **Step 5: Connect triggers**
  Call passport notifier after QR scans that award/remove passport points and exhibitor notifier after accepted student votes.

### Task 2: QR Surpresa Numerado e Dinâmico

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/src/modules/passport/application/passport.service.ts`
- Modify: `backend/src/modules/passport/http/passport.routes.ts`
- Test: `backend/src/modules/passport/application/passport-game-rules.spec.ts`

- [ ] **Step 1: Write failing tests**
  Cover display codes, batch codes, dynamic rule after N losses, and PDF batch route contract.

- [ ] **Step 2: Run tests to verify failure**
  Run: `npm --prefix backend test -- --run src/modules/passport/application/passport-game-rules.spec.ts`
  Expected: FAIL on missing fields/functions.

- [ ] **Step 3: Add schema fields**
  Extend `PassportSurpriseQr` with `displayCode`, `batchCode`, `dynamicRulesJson`, and `printedAt`.

- [ ] **Step 4: Implement dynamic effect resolver**
  If `SUBTRACT_POINTS` reaches `convertAfterLosses`, later scans use the configured positive effect and store activation metadata.

- [ ] **Step 5: Implement batch creation and PDF**
  Add `createPassportSurpriseQrBatch`, `POST /passport/admin/surprise-qrs/batch`, and `GET /passport/admin/surprise-qrs/batch/:batchCode/pdf`.

### Task 3: Limites e Recuperação de Pontos

**Files:**
- Modify: `backend/src/modules/passport/application/passport.service.ts`
- Modify: `backend/src/modules/passport/http/passport.routes.ts`
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Write failing tests**
  Cover max available passport points including surprise/recovery caps and a recovery request that can only lift negative balance up to zero.

- [ ] **Step 2: Implement constants and summary fields**
  Add `PASSPORT_SURPRISE_POINTS_CAP`, `PASSPORT_RECOVERY_PRICE_KZ`, `PASSPORT_RECOVERY_POINTS`, and return cap fields in summaries.

- [ ] **Step 3: Implement recovery model and routes**
  Add pending recovery requests and admin confirmation that awards capped points.

### Task 4: Admin Frontend

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/components/admin/AdminPassportTab.tsx`
- Test: `frontend/src/pages/passport-challenges-effects.spec.ts`

- [ ] **Step 1: Write failing contract test**
  Assert the admin exposes batch QR creation, dynamic conversion after losses, and batch PDF download.

- [ ] **Step 2: Add API types/methods**
  Add batch input/result and batch PDF methods.

- [ ] **Step 3: Add compact admin controls**
  Reuse current QR surpresa card style; add quantity, prefix, dynamic conversion fields and “Baixar lote”.

### Task 5: Verification and Deploy

**Files:**
- No production file ownership; this task runs commands and deploy scripts.

- [ ] **Step 1: Run backend targeted tests**
  Run game-notification, passport, exhibitor scoring tests.

- [ ] **Step 2: Run frontend targeted tests**
  Run passport/admin contract tests.

- [ ] **Step 3: Run build/type checks**
  Run backend build and frontend build if available.

- [ ] **Step 4: Deploy**
  Use the repo’s existing VPS deploy workflow only after the local verification output is read.
