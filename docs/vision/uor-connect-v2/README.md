# UOR Connect v2 — Fonte normativa

```yaml
document_id: UOR-V2-INDEX
status: approved
owner: CAVINOVA
authority: normative
version: 2.0
last_reviewed: 2026-07-21
approved_by: Product Owner
approved_at: 2026-07-21
review_cycle: trimestral e por alteração de fronteira
next_review: 2026-10-21
supersedes:
  - ../../wiki/raw/uorconnect-sdd-v1.0/README.md
superseded_by:
depends_on:
  - ../../superpowers/specs/2026-07-21-uor-connect-visao-v2-design.md
```

## Autoridade

Esta pasta é a fonte normativa da visão v2. UOR Connect é o ecossistema; UOR Estudante, UOR Eventos e UOR Direção são produtos independentes.

Precedência:

1. [SDD-000](SDD-000-ECOSSISTEMA-UOR-CONNECT.md): visão, vocabulário, produtos e fronteiras.
2. [SDD-005](SDD-005-CAPACIDADES-TRANSVERSAIS.md): mecanismos transversais.
3. SDD do produto: capacidades, dados e arquitetura do produto.
4. RF/RNF/RN: refinamento verificável dos SDDs.
5. ADRs: decisões técnicas subordinadas.
6. Matriz: estado factual, sem autoridade comportamental.

O SDD transversal e o SDD de produto possuem autoridade equivalente nos seus âmbitos. Uma capacidade que use um mecanismo transversal deve cumprir ambos.

## Documentos

| Documento | Estado | Finalidade |
| --- | --- | --- |
| [SDD-000](SDD-000-ECOSSISTEMA-UOR-CONNECT.md) | approved | Ecossistema, fronteiras e propriedade dos dados |
| [SDD-002](SDD-002-UOR-ESTUDANTE.md) | approved | Visão integral da UOR Estudante |
| [SDD-003](SDD-003-UOR-EVENTOS.md) | draft | Fronteira inicial da UOR Eventos |
| [SDD-004](SDD-004-UOR-DIRECAO.md) | draft | Fronteira inicial da UOR Direção |
| [SDD-005](SDD-005-CAPACIDADES-TRANSVERSAIS.md) | approved | Identidade, segurança e infraestrutura partilhada |
| [MIG-001](MIG-001-TRANSICAO-PLATAFORMA-ATUAL.md) | approved | Diagnóstico e transição do sistema atual |
| [Glossário](GLOSSARIO-E-MODELO-CONCEPTUAL.md) | approved | Linguagem e entidades conceptuais |
| [RF/RNF/RN](requirements/UOR-ESTUDANTE-RF-RNF-REGRAS-NEGOCIO.md) | approved | Requisitos da UOR Estudante |
| [Matriz](requirements/UOR-ESTUDANTE-MATRIZ-RASTREABILIDADE.md) | approved | Implementação e evidência verificadas |
| [Validação documental](VALIDACAO-DOCUMENTAL.md) | approved | Links, IDs, estados, terminologia e divergências |

## ADRs

- [ADR-001 — Separação dos produtos](adrs/ADR-001-SEPARACAO-DOS-PRODUTOS.md)
- [ADR-002 — Monólito modular](adrs/ADR-002-MONOLITO-MODULAR.md)
- [ADR-003 — Identidade institucional](adrs/ADR-003-IDENTIDADE-INSTITUCIONAL.md)
- [ADR-004 — Propriedade dos dados](adrs/ADR-004-PROPRIEDADE-DOS-DADOS.md)
- [ADR-005 — Integrações externas](adrs/ADR-005-INTEGRACOES-EXTERNAS.md)
- [ADR-006 — Arquitetura técnica da integração Secretaria](adrs/ADR-006-ARQUITETURA-TECNICA-INTEGRACAO-SECRETARIA.md) — `proposed`

## Inventário dos documentos anteriores

| Grupo | Classificação v2 | Tratamento |
| --- | --- | --- |
| `docs/wiki/raw/uorconnect-sdd-v1.0/*` | histórico, anteriormente normativo | marcado como substituído pela visão v2 |
| páginas vivas `arquitetura`, `separacao`, `sdd` e `operacao-migracao` | informativo vivo | resumem e apontam para v2 |
| `backend/REQUISITOS.md` e `frontend/REQUISITOS.md` | requisitos legados de Eventos/admin | preservados; não são visão do ecossistema |
| `RF_RNF_REGRAS_PASSAPORTE_*` e `RF_RNF_REGRAS_PERFIS_CREDENCIAIS.md` | normativos do domínio Eventos | preservados sob autoridade futura do SDD-003 |
| documentação Moodle e Secretaria | informativa de integração Estudante | subordinada ao SDD-002 e ADR-005 |
| relatórios, memórias, specs e planos concluídos | histórico/informativo | preservados sem autoridade concorrente |
| deploy e operação | operacional | preservados; descrevem o estado implantado |

## Vocabulário de estado

Documentos: `draft`, `proposed`, `approved`, `deprecated`, `superseded`.

Rastreabilidade: `planned`, `in_analysis`, `partial`, `implemented`, `verified`, `blocked`, `deprecated`, `superseded`.

Questões: `open`, `in_analysis`, `decided`, `deferred`, `cancelled`.

## Open Questions

| ID | Questão | Responsável | Impacto | Condição/prazo | Estado | Atualiza |
| --- | --- | --- | --- | --- | --- | --- |
| OQ-001 | Qual será o modelo físico final: monorepo com apps ou repositórios separados? | Arquitetura | deploy e ownership | após diagnóstico da primeira fatia Estudante | deferred | ADR-002, MIG-001 |
| OQ-002 | A UOR/fornecedor disponibilizará HTTPS ou API oficial da Secretaria? | Instituição | bloqueador de produção | antes do piloto com dados reais | open | ADR-005, SDD-002 |
| OQ-003 | Quais regras oficiais definem dispensa, aprovação e bolsa por curso? | Direção Académica | cálculos e comunicação | antes da inteligência académica | open | SDD-002, RN-EST |
| OQ-004 | Qual o limiar mínimo institucional para agregações da Direção? | Privacidade/Direção | reidentificação | antes do piloto Direção | open | SDD-004, SDD-005 |
| OQ-005 | Que capacidades legadas pertencem definitivamente à UOR Eventos? | Produto Eventos | migração de módulos | análise específica do SDD-003 | in_analysis | SDD-003, MIG-001 |

## Regra de mudança

Novas alterações não podem aumentar divergências conhecidas nem criar comportamento contrário à documentação aprovada. Divergências legadas são registadas na matriz e no `MIG-001` até serem corrigidas.
