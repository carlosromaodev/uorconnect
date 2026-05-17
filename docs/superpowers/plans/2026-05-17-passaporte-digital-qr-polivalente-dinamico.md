# Passaporte Digital QR Polivalente Dinamico Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evoluir o QR surpresa para QR polivalente dinamico, com efeito decidido por QR individual no momento do scan e PDF de lote com paginas explicativas para estudantes ainda nao inscritos.

**Architecture:** Reaproveitar `PassportSurpriseQr`, `dynamicRulesJson`, `PassportSurpriseEffectLedger` e o scanner existente. O novo motor fica em `passport.service.ts` com helpers puros testaveis, mantendo efeitos antigos funcionais. O PDF de lote continua em `passport.routes.ts`, mas passa a paginar QR e inserir paginas de arte explicativas apos cada 3 paginas de codigos.

**Tech Stack:** Fastify, Prisma, Zod, Vitest, React/Vite, HTML-to-PDF existente.

---

### Task 1: Resolver Universal Dinamico por QR

**Files:**
- Modify: `backend/src/modules/passport/application/passport.service.ts`
- Test: `backend/src/modules/passport/application/passport-game-rules.spec.ts`

- [x] **Step 1: Write failing tests**

Add tests proving:

```ts
// QR-001 muda depois de perdas naquele QR.
// QR-002 nao herda o estado do QR-001.
// O ledger guarda metadata auditavel com resolverVersion, seed, pesos e roll.
```

- [x] **Step 2: Run test to verify failure**

Run:

```bash
npm --prefix backend test -- --run src/modules/passport/application/passport-game-rules.spec.ts
```

Expected: FAIL because `UNIVERSAL_DYNAMIC` is not supported yet.

- [x] **Step 3: Implement resolver**

Add support for configured effect `UNIVERSAL_DYNAMIC`, concrete effects `NEUTRAL_HINT` and `RECOVERY_POINTS`, weighted selection, per-QR loss adjustment, deterministic seed metadata and safe point computation.

- [x] **Step 4: Run tests**

Run:

```bash
npm --prefix backend test -- --run src/modules/passport/application/passport-game-rules.spec.ts
```

Expected: PASS.

### Task 2: Admin/API Types and Validation

**Files:**
- Modify: `backend/src/modules/passport/http/passport.routes.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/components/admin/AdminPassportTab.tsx`
- Test: `frontend/src/pages/passport-surprise-batch.contract.spec.ts`

- [x] **Step 1: Write/update contract test**

Assert admin source exposes `UNIVERSAL_DYNAMIC`, universal weights, loss threshold, and batch PDF download.

- [x] **Step 2: Run test to verify failure**

Run:

```bash
npm --prefix frontend test -- --run src/pages/passport-surprise-batch.contract.spec.ts
```

Expected: FAIL before UI/API types are updated.

- [x] **Step 3: Update schemas and UI**

Allow `UNIVERSAL_DYNAMIC` in backend Zod schemas and frontend API types. Add compact admin controls for weights and the loss-adjustment threshold while keeping existing fixed QR behavior.

- [x] **Step 4: Run frontend contract test**

Run:

```bash
npm --prefix frontend test -- --run src/pages/passport-surprise-batch.contract.spec.ts
```

Expected: PASS.

### Task 3: PDF de Lote com Paginas Explicativas

**Files:**
- Modify: `backend/src/modules/passport/http/passport.routes.ts`
- Test: `backend/src/modules/passport/http/passport.routes.contract.spec.ts` or `backend/src/modules/passport/application/passport-surprise-batch.contract.spec.ts`

- [x] **Step 1: Write failing contract test**

Assert the batch PDF renderer contains:

```txt
Encontraste um QR do Passaporte Digital
Passaporte Digital UOR Connect
QR-001
```

and contains page-break classes for QR pages and explanation pages.

- [x] **Step 2: Run test to verify failure**

Run:

```bash
npm --prefix backend test -- --run src/modules/passport/application/passport-surprise-batch.contract.spec.ts
```

Expected: FAIL because the current renderer has only a single grid page.

- [x] **Step 3: Implement paginated HTML**

Paginate QR cards into pages of 9 cards. Insert one explanation/art page after every 3 QR pages. Keep QR display codes, UOR Connect branding and student instructions visible.

- [x] **Step 4: Run backend contract test**

Run:

```bash
npm --prefix backend test -- --run src/modules/passport/application/passport-surprise-batch.contract.spec.ts
```

Expected: PASS.

### Task 4: Verification and GitHub

**Files:**
- No new production files.

- [x] **Step 1: Run targeted backend tests**

```bash
npm --prefix backend test -- --run src/modules/passport/application/passport-game-rules.spec.ts src/modules/passport/application/passport-surprise-batch.contract.spec.ts
```

- [x] **Step 2: Run targeted frontend test**

```bash
npm --prefix frontend test -- --run src/pages/passport-surprise-batch.contract.spec.ts
```

- [x] **Step 3: Run builds**

```bash
npm --prefix backend run build
npm --prefix frontend run build
```

- [ ] **Step 4: Commit and push**

```bash
git add backend frontend docs
git commit -m "feat: add dynamic universal passport qr"
git push origin main
```
