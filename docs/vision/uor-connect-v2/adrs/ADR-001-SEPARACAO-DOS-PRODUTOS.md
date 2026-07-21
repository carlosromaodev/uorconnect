# ADR-001 — Separação dos produtos

```yaml
document_id: ADR-001
status: approved
owner: Arquitetura UOR Connect
authority: normative
version: 1.0
last_reviewed: 2026-07-21
approved_by: Product Owner
approved_at: 2026-07-21
review_cycle: por alteração de fronteira
next_review: análise própria da UOR Eventos e UOR Direção
supersedes:
superseded_by:
depends_on:
  - ../SDD-000-ECOSSISTEMA-UOR-CONNECT.md
```

## Contexto

A aplicação atual mistura portal, Eventos, experiência do estudante e administração. Navegação, permissões e dados tornam-se ambíguos.

## Decisão

UOR Connect será ecossistema; UOR Estudante, UOR Eventos e UOR Direção serão produtos com missão, contratos, ownership, permissões e roadmap próprios.

## Alternativas

- Produto único por menus: rejeitado por manter acoplamento.
- Microsserviços imediatos: rejeitado por custo e fronteiras ainda imaturas.

## Consequências

Migração incremental, redirects e duplicação temporária controlada. Cada nova função precisa de produto proprietário.
