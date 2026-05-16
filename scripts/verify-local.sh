#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_SCHEMA="${ROOT_DIR}/.tmp-schema-deploy-check.prisma"

cleanup() {
  rm -f "${TMP_SCHEMA}"
}
trap cleanup EXIT

print_step() {
  printf '\n[%s] %s\n' "$(date +%H:%M:%S)" "$1"
}

print_step "Prisma generate"
npm --prefix "${ROOT_DIR}/backend" run prisma -- generate

print_step "Prisma schema.deploy.prisma sincronizado"
(
  cd "${ROOT_DIR}/backend"
  node scripts/prepare-prisma-schema.mjs postgresql "../$(basename "${TMP_SCHEMA}")"
  diff -u prisma/schema.deploy.prisma "${TMP_SCHEMA}"
)

print_step "Backend lint"
npm --prefix "${ROOT_DIR}/backend" run lint

print_step "Backend build"
npm --prefix "${ROOT_DIR}/backend" run build

print_step "Backend tests criticos"
npm --prefix "${ROOT_DIR}/backend" run test -- \
  src/modules/communication/campaign-approval.spec.ts \
  src/modules/interactions/http/project-feed.contract.spec.ts \
  src/modules/auth/http/complete-profile.contract.spec.ts \
  src/modules/team-credentials/http/team-membership-crud.contract.spec.ts \
  src/modules/team-credentials/http/public-member-profile.spec.ts \
  src/modules/validation/http/validation-public-operational.contract.spec.ts \
  --run

print_step "Frontend lint"
npm --prefix "${ROOT_DIR}/frontend" run lint

print_step "Frontend tests criticos"
npm --prefix "${ROOT_DIR}/frontend" run test -- \
  src/lib/auth-session.contract.spec.ts

print_step "Frontend build"
npm --prefix "${ROOT_DIR}/frontend" run build

print_step "Git diff check"
git -C "${ROOT_DIR}" diff --check

print_step "Verificacao local concluida"
