# ADR-002 — Monólito modular durante a transição

```yaml
document_id: ADR-002
status: approved
owner: Arquitetura UOR Connect
authority: normative
version: 1.0
last_reviewed: 2026-07-21
approved_by: Product Owner
approved_at: 2026-07-21
review_cycle: por decisão de separação física
next_review: conclusão da fundação UOR Estudante
supersedes:
superseded_by:
depends_on:
  - ../SDD-000-ECOSSISTEMA-UOR-CONNECT.md
```

## Contexto

Frontend, backend e base atuais são únicos. Separação física precoce aumentaria operação sem resolver ownership.

## Decisão

Manter implantação conjunta inicialmente, impondo módulos, contratos, permissões e propriedade dos dados por produto. Acesso direto a tabelas privadas alheias é proibido.

## Consequências

Testes de fronteira e interfaces internas tornam-se obrigatórios. Processos/bases podem ser separados depois sem redefinir o domínio.
