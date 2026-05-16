#!/usr/bin/env bash
set -euo pipefail

FRONTEND_URL="${FRONTEND_URL:-https://uorconnect.space}"
API_URL="${API_URL:-https://api.uorconnect.space}"
COOKIE_JAR="${COOKIE_JAR:-/tmp/uor-smoke-cookies.txt}"
ADMIN_STUDENT_NUMBER="${ADMIN_STUDENT_NUMBER:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"

cleanup() {
  rm -f "${COOKIE_JAR}"
}

trap cleanup EXIT

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Comando obrigatório não encontrado: $1"
    exit 1
  fi
}

print_step() {
  printf '\n[%s] %s\n' "$(date +%H:%M:%S)" "$1"
}

require_command curl
require_command awk

print_step "Frontend HEAD ${FRONTEND_URL}"
curl --fail --silent --show-error --location --head "${FRONTEND_URL}" >/dev/null
echo "OK frontend"

for path in /login /completar-perfil /minha-area /admin /submeter /cursos /validar/demo-token; do
  print_step "Frontend route ${path}"
  curl --fail --silent --show-error --location --head "${FRONTEND_URL}${path}" >/dev/null
  echo "OK ${path}"
done

print_step "API health ${API_URL}/health"
health_json="$(curl --fail --silent --show-error "${API_URL}/health")"
echo "${health_json}"

print_step "API cursos"
curl --fail --silent --show-error "${API_URL}/courses" >/dev/null
echo "OK cursos"

print_step "API candidaturas config"
curl --fail --silent --show-error "${API_URL}/submissions/config" >/dev/null
echo "OK submissao"

print_step "API feed paginado"
curl --fail --silent --show-error "${API_URL}/interactions/projects?limit=6&commentsLimit=0&likesLimit=0" >/dev/null
echo "OK feed"

print_step "API validacao QR negativa"
validation_status="$(curl --silent --show-error --output /dev/null --write-out "%{http_code}" "${API_URL}/validation/demo-token")"
if [[ "${validation_status}" != "404" ]]; then
  echo "Falha: validação QR negativa esperava 404 e recebeu ${validation_status}."
  exit 1
fi
echo "OK validacao negativa"

if [[ -z "${ADMIN_STUDENT_NUMBER}" || -z "${ADMIN_PASSWORD}" ]]; then
  print_step "Smoke público concluído (sem credenciais admin)"
  exit 0
fi

print_step "Login admin ${ADMIN_STUDENT_NUMBER}"
login_json="$(curl --fail --silent --show-error \
  -c "${COOKIE_JAR}" \
  -b "${COOKIE_JAR}" \
  -H "content-type: application/json" \
  -X POST "${API_URL}/auth/login" \
  --data "{\"studentNumber\":\"${ADMIN_STUDENT_NUMBER}\",\"password\":\"${ADMIN_PASSWORD}\"}")"
echo "${login_json}"

csrf_token="$(awk '$6=="uor_csrf"{print $7}' "${COOKIE_JAR}" | tail -n 1)"
if [[ -z "${csrf_token}" ]]; then
  echo "Falha: cookie CSRF não encontrado após login."
  exit 1
fi

print_step "Sessão autenticada"
curl --fail --silent --show-error \
  -c "${COOKIE_JAR}" \
  -b "${COOKIE_JAR}" \
  "${API_URL}/interactions/me" >/dev/null
echo "OK sessão"

print_step "Área admin /auth/security"
curl --fail --silent --show-error \
  -c "${COOKIE_JAR}" \
  -b "${COOKIE_JAR}" \
  "${API_URL}/auth/security" >/dev/null
echo "OK admin security"

print_step "Logout"
curl --fail --silent --show-error \
  -c "${COOKIE_JAR}" \
  -b "${COOKIE_JAR}" \
  -H "x-csrf-token: ${csrf_token}" \
  -X POST "${API_URL}/auth/logout" >/dev/null
echo "OK logout"

print_step "Smoke completo concluído"
