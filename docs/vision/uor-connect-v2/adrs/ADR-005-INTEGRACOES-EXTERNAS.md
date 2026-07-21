# ADR-005 — Integrações externas isoladas

```yaml
document_id: ADR-005
status: approved
owner: Integrações UOR Estudante
authority: normative
version: 1.0
last_reviewed: 2026-07-21
approved_by: Product Owner
approved_at: 2026-07-21
review_cycle: por alteração de provedor/contrato
next_review: decisão institucional sobre Secretaria
supersedes:
superseded_by:
depends_on:
  - ../SDD-002-UOR-ESTUDANTE.md
  - ../SDD-005-CAPACIDADES-TRANSVERSAIS.md
```

## Contexto

Moodle e Secretaria possuem transportes, sessões e fragilidades diferentes. O netPA conhecido não oferece API pública documentada e usa HTTP.

## Decisão

Adaptadores próprios escondem HTML, cookies, URLs e IDs upstream. Domínio e frontend consomem contratos normalizados com proveniência e cobertura.

## Regras

- Credenciais/cookies nunca chegam ao frontend ou logs.
- HTTP público é bloqueador de produção.
- Snapshots inválidos não substituem último estado válido.
- Escrita externa só com autorização institucional, idempotência, confirmação e reconciliação.

## Consequências

Secretaria deve sair do módulo de autenticação para uma integração própria; Moodle existente deve ser consumido pela UOR Estudante, não pelo portal geral.
