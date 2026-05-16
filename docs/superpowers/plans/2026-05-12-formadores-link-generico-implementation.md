# Formadores Link Generico Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o cadastro generico de formadores com SMS, aprovacao administrativa e painel limitado por curso.

**Architecture:** Criar um modulo `trainers` separado, com modelo proprio `TrainerRegistrationRequest`, reaproveitando `StudentAccessCode` para OTP por telefone e criando JWT com papel `trainer` apenas para o painel limitado. O frontend ganha paginas dedicadas em `/formadores/cadastro` e `/formadores/painel`, alem de API tipada.

**Tech Stack:** Fastify, Zod, Prisma, JWT, React, Vite, Tailwind, Vitest.

---

### Task 1: Backend contract and pure rules

**Files:**
- Create: `backend/src/modules/trainers/http/trainer-registration.ts`
- Test: `backend/src/modules/trainers/http/trainer-registration.spec.ts`

- [ ] Write failing tests for required fields, approval without course, dashboard access by status and aggregate-only dashboard shape.
- [ ] Run the test and confirm it fails because the module does not exist.
- [ ] Implement schemas and serializers used by the route.
- [ ] Run the test and confirm it passes.

### Task 2: Persistence and routes

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260512190000_trainer_registration_requests/migration.sql`
- Create: `backend/src/modules/trainers/http/trainers.routes.ts`
- Modify: `backend/src/core/routes/index.ts`
- Modify: `backend/src/modules/auth/utils/jwt.ts`
- Modify: `backend/src/modules/auth/http/auth.middleware.ts`
- Modify: `backend/src/modules/auth/http/auth.routes.ts`

- [ ] Add `TrainerRegistrationRequest` linked to `Course`.
- [ ] Add trainer JWT support without allowing trainers into general admin.
- [ ] Add public registration endpoints, admin approval/rejection endpoints and trainer dashboard endpoint.
- [ ] Reuse SMS code storage with purpose `TRAINER_REGISTRATION`.
- [ ] Register `/trainers` routes.

### Task 3: Frontend API and pages

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/pages/FormadorCadastro.tsx`
- Create: `frontend/src/pages/FormadorPainel.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/pages/formadores-flow.contract.spec.ts`

- [ ] Add typed API client for trainer registration, admin requests and trainer dashboard.
- [ ] Add polished public registration page with OTP, profile, course selection and status states.
- [ ] Add limited dashboard page with aggregate course metrics only.
- [ ] Add routes and contract tests that prevent student-sensitive fields from appearing on the trainer dashboard.

### Task 4: Verification

- [ ] Run targeted backend tests.
- [ ] Run targeted frontend tests.
- [ ] Run backend build.
- [ ] Run frontend build when feasible.
