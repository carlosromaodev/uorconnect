# ADR-004 — Propriedade dos dados

```yaml
document_id: ADR-004
status: approved
owner: Arquitetura de Dados UOR Connect
authority: normative
version: 1.0
last_reviewed: 2026-07-21
approved_by: Product Owner
approved_at: 2026-07-21
review_cycle: por novo domínio ou transferência de ownership
next_review: inventário físico das tabelas
supersedes:
superseded_by:
depends_on:
  - ../SDD-000-ECOSSISTEMA-UOR-CONNECT.md
```

## Decisão

Cada dado possui produto proprietário. Consumidores usam contratos/read models; uma base partilhada não concede ownership nem leitura direta.

## Regras

- Fonte oficial e proprietário interno são conceitos distintos.
- Derivados mantêm proveniência.
- Direção consome agregações autorizadas.
- Auditoria técnica é transversal; significado do evento é do produto.

## Consequências

Schemas atuais serão classificados por ownership antes de qualquer separação física.
