# ADR-003 — Identidade institucional

```yaml
document_id: ADR-003
status: approved
owner: Identidade UOR Connect
authority: normative
version: 1.0
last_reviewed: 2026-07-21
approved_by: Product Owner
approved_at: 2026-07-21
review_cycle: por alteração do modelo de identidade
next_review: migração dos tokens e consultas legadas
supersedes:
superseded_by:
depends_on:
  - ../SDD-000-ECOSSISTEMA-UOR-CONNECT.md
  - ../SDD-005-CAPACIDADES-TRANSVERSAIS.md
```

## Decisão

O número académico permanece identificador visível; `institution_id + student_number` é único; relações técnicas usam ID interno opaco. Uma conta poderá possuir múltiplos perfis institucionais.

## Regras

- Número isolado não é chave global nem autorização.
- Correção do número preserva histórico.
- URLs públicas usam IDs opacos.
- Token e ownership incluem contexto institucional suficiente.

## Consequências

Consultas legadas apenas por `studentNumber` devem ser inventariadas e migradas por expand/contract.
