# Passaporte do Expositor Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the Passaporte do Expositor scoring MVP so project winners are calculated by auditable points with rounds, configuration, admin controls, freezing and exports.

**Architecture:** Keep the existing `ExhibitorScoreConfig` and `ExhibitorScoreEvent` tables as the core. Store configurable weights, rounds and streak thresholds in the existing JSON fields, and represent every operational effect as a ledger event with a stable `businessKey`.

**Tech Stack:** Fastify, Zod, Prisma/SQLite, Vitest, React/Vite admin UI.

---

### Task 1: Config And Round Resolver

**Files:**
- Create: `backend/src/modules/exhibitor-scoring/application/exhibitor-scoring.config.ts`
- Create: `backend/src/modules/exhibitor-scoring/application/exhibitor-scoring.config.spec.ts`
- Modify: `backend/src/modules/exhibitor-scoring/application/exhibitor-scoring.rules.ts`

- [x] Write tests for parsing stored weights, streak bonuses and rounds.
- [x] Write tests for selecting the active round by time and by explicit `roundKey`.
- [x] Implement config parsing by merging stored JSON with `DEFAULT_EXHIBITOR_SCORE_CONFIG`.
- [x] Implement `resolveExhibitorScoreRound`.
- [x] Run `npm test -- src/modules/exhibitor-scoring/application/exhibitor-scoring.config.spec.ts`.

### Task 2: Vote Flow Completion

**Files:**
- Modify: `backend/src/modules/exhibitor-scoring/application/exhibitor-scoring.service.ts`
- Modify: `backend/src/modules/exhibitor-scoring/application/exhibitor-scoring.service.spec.ts`

- [x] Write failing tests proving `Curso por confirmar` does not receive first-course bonus.
- [x] Write failing tests proving active round multiplier is loaded from config when request has no multiplier.
- [x] Write failing tests proving first-course milestones create streak bonus events once.
- [x] Implement config loading from `ExhibitorScoreConfig`.
- [x] Implement course bonus guard for empty/unknown courses.
- [x] Implement streak bonus ledger events with stable keys.
- [x] Run service tests.

### Task 3: Admin Scoring Operations

**Files:**
- Modify: `backend/src/modules/interactions/http/interactions.routes.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/features/admin/AdminWorkspace.tsx`

- [x] Add admin API for scoring config read/update.
- [x] Add admin API for score breakdown by project.
- [x] Add admin API for freezing a ranking snapshot.
- [x] Add admin API for exporting ranking snapshot/current ranking.
- [x] Add minimal admin UI buttons for config visibility, freeze and export.
- [x] Run backend route tests where available and frontend build.

### Task 4: Expositor Roles And Missions MVP

**Files:**
- Modify: `backend/src/modules/exhibitor-scoring/application/exhibitor-scoring.service.ts`
- Modify: `backend/src/modules/interactions/http/interactions.routes.ts`
- Modify: `frontend/src/lib/api.ts`

- [x] Add ledger-based check-in/check-out events for expositor/embaixador roles.
- [x] Enforce at most two active stand exhibitors per project using latest duty events.
- [x] Add stand empty penalty helper.
- [x] Add mission completion endpoint using `AMBASSADOR_MISSION`, `EXHIBITOR_MISSION` and `TEAM_BONUS`.
- [x] Add tests for mission idempotency beyond the generic score-adjustment idempotency path.

### Task 5: Verification And Requirements Update

**Files:**
- Modify: `RF_RNF_REGRAS_PASSAPORTE_EXPOSITOR_PONTUACAO.md`

- [x] Run targeted backend tests.
- [x] Run backend lint.
- [x] Run frontend build if frontend files changed.
- [x] Update requirement checkboxes based on what was actually delivered.
- [x] Record remaining gaps explicitly if any are intentionally out of scope for this pass.

### Task 6: Automation, Ambassador Ranking And CSV Continuation

**Files:**
- Modify: `backend/src/modules/exhibitor-scoring/application/exhibitor-scoring.admin.ts`
- Modify: `backend/src/modules/exhibitor-scoring/application/exhibitor-scoring.admin.spec.ts`
- Modify: `backend/src/modules/interactions/http/interactions.routes.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/features/admin/AdminWorkspace.tsx`
- Modify: `RF_RNF_REGRAS_PASSAPORTE_EXPOSITOR_PONTUACAO.md`

- [x] Write tests for automatic stand active bonus and objective mission awards.
- [x] Implement automatic awards for stand active, Explorador de Cursos, Diversidade Maxima and Anfitriao de Elite.
- [x] Write tests for internal ambassador ranking.
- [x] Implement internal ambassador ranking from member-attributed ledger events.
- [x] Write tests for suspicious scoring alerts.
- [x] Implement alerts for self-vote, course concentration and member conversion bursts.
- [x] Write tests for CSV export.
- [x] Add admin API endpoints and frontend API helpers.
- [x] Reuse existing votes control card with small buttons for Missões, Embaixadores, Alertas and CSV.
- [x] Run targeted tests, backend lint and frontend build.
- [x] Update requirement checkboxes based on this continuation.
