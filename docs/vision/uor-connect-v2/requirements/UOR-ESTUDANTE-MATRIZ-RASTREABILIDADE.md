# UOR Estudante — Matriz de rastreabilidade

```yaml
document_id: UOR-EST-TRACE-001
status: approved
owner: Engenharia UOR Estudante
authority: informative
version: 1.0
last_reviewed: 2026-07-21
approved_by: Product Owner
approved_at: 2026-07-21
review_cycle: por entrega verificada
next_review: primeira fatia vertical UOR Estudante
supersedes:
superseded_by:
depends_on:
  - UOR-ESTUDANTE-RF-RNF-REGRAS-NEGOCIO.md
```

## Regras

- `[x]` apenas para `verified`; `[ ]` para qualquer outro estado.
- Estados: `planned`, `in_analysis`, `partial`, `implemented`, `verified`, `blocked`, `deprecated`, `superseded`.
- Evidência: `static`, `automated_test`, `integration_test`, `runtime_observed`, `production_observed`.
- `implemented` significa código identificado sem verificação suficiente.
- Verificação executada em 2026-07-21 no ambiente `local-test`, por `Codex`, sobre o commit de base `669aed0`.
- Suite backend verificada: 7 ficheiros/45 testes. Suite frontend: 3 ficheiros/6 testes. Nenhuma escrita externa.

## Requisitos funcionais

| Check | ID | Estado | Evidência | Referência / teste / lacuna |
| --- | --- | --- | --- | --- |
| [x] | RF-EST-001 | verified | integration_test | `auth/use-cases/login.ts`; `login.integration.spec.ts` aprovado |
| [x] | RF-EST-002 | verified | automated_test | schema composto; `student-identity.spec.ts` aprovado |
| [ ] | RF-EST-003 | partial | static | ID interno existe; contratos/URLs ainda usam número em vários fluxos |
| [ ] | RF-EST-004 | implemented | automated_test | perfil e proveniência existem; produto Estudante próprio ausente |
| [ ] | RF-EST-005 | implemented | static | `auth.routes.ts` completa perfil; teste não executado nesta auditoria |
| [ ] | RF-EST-006 | implemented | static | `StudentProfileExtra`/`ConsentRecord`; finalidade ainda misturada |
| [ ] | RF-EST-007 | partial | static | logout UOR existe; encerramento uniforme de upstream incompleto |
| [ ] | RF-EST-008 | partial | static | eliminação parcial existe; exportação Estudante não confirmada |
| [x] | RF-EST-009 | verified | integration_test | Moodle `/session`; `moodle.routes.spec.ts` aprovado |
| [x] | RF-EST-010 | verified | integration_test | Moodle `DELETE /session`; routes/session tests aprovados |
| [x] | RF-EST-011 | verified | integration_test | `/me` e aplicação live aprovados |
| [x] | RF-EST-012 | verified | integration_test | `/courses`, snapshots e worker aprovados |
| [x] | RF-EST-013 | verified | integration_test | materials/open com ownership; routes tests aprovados |
| [x] | RF-EST-014 | verified | integration_test | `/sync`, leases/idempotência; worker/session tests aprovados |
| [x] | RF-EST-015 | verified | integration_test | `/sync/status`; routes tests aprovados |
| [ ] | RF-EST-016 | partial | automated_test | login netPA cria sessão transitória em auth; integração própria ausente |
| [ ] | RF-EST-017 | partial | automated_test | parser de perfil usado no login; endpoint Estudante ausente |
| [ ] | RF-EST-018 | partial | automated_test | inscrições consultadas para contexto; persistência completa ausente |
| [ ] | RF-EST-019 | partial | static | Moodle possui estados; Secretaria retorna `planned/not_synced` |
| [ ] | RF-EST-020 | partial | static | Moodle manual possui lock; Secretaria não possui API de sync |
| [ ] | RF-EST-021 | partial | integration_test | snapshots Moodle preservados; Secretaria sem histórico normalizado |
| [ ] | RF-EST-022 | partial | integration_test | Moodle valida contratos; Secretaria não possui monitor de contrato |
| [ ] | RF-EST-023 | planned | — | domínio académico oficial ausente |
| [ ] | RF-EST-024 | planned | — | consulta oficial de notas não exposta |
| [ ] | RF-EST-025 | planned | — | resumo académico ausente |
| [ ] | RF-EST-026 | planned | — | motor de média académica ausente |
| [ ] | RF-EST-027 | planned | — | motor de média geral ausente |
| [ ] | RF-EST-028 | planned | — | simulador ausente |
| [ ] | RF-EST-029 | planned | — | regra de aprovação ausente |
| [ ] | RF-EST-030 | planned | — | regra de dispensa ausente |
| [ ] | RF-EST-031 | planned | — | simulação de bolsa ausente |
| [ ] | RF-EST-032 | planned | — | evolução académica ausente |
| [ ] | RF-EST-033 | planned | — | ranking atual é de Eventos/passaporte |
| [ ] | RF-EST-034 | planned | — | percentil académico ausente |
| [ ] | RF-EST-035 | planned | — | filtros académicos de ranking ausentes |
| [ ] | RF-EST-036 | planned | — | limiar académico ausente |
| [ ] | RF-EST-037 | planned | — | mapa curricular ausente |
| [ ] | RF-EST-038 | planned | — | créditos/conclusão ausentes |
| [ ] | RF-EST-039 | planned | — | precedências ausentes |
| [ ] | RF-EST-040 | planned | — | previsão de conclusão ausente |
| [ ] | RF-EST-041 | planned | — | histórico académico normalizado ausente |
| [ ] | RF-EST-042 | planned | — | alertas académicos ausentes |
| [ ] | RF-EST-043 | partial | static | agenda atual é predominantemente de Eventos |
| [ ] | RF-EST-044 | planned | — | agenda pessoal Estudante ausente |
| [ ] | RF-EST-045 | planned | — | deteção de conflitos ausente |
| [ ] | RF-EST-046 | planned | — | sobrecarga ausente |
| [ ] | RF-EST-047 | planned | — | horário oficial não exposto |
| [ ] | RF-EST-048 | planned | — | exames oficiais não expostos |
| [ ] | RF-EST-049 | partial | static | attendance atual pertence a Eventos/QR, não assiduidade académica |
| [ ] | RF-EST-050 | planned | — | reporte comunitário ausente |
| [ ] | RF-EST-051 | planned | — | confirmação comunitária ausente |
| [ ] | RF-EST-052 | planned | — | docentes por cadeira/período ausentes |
| [ ] | RF-EST-053 | planned | — | avaliação pedagógica ausente |
| [ ] | RF-EST-054 | planned | — | agregação pedagógica ausente |
| [ ] | RF-EST-055 | partial | static | denúncias genéricas/evento não equivalem à moderação pedagógica |
| [ ] | RF-EST-056 | planned | — | perfil de explicador ausente |
| [ ] | RF-EST-057 | planned | — | pesquisa de explicador ausente |
| [ ] | RF-EST-058 | planned | — | relação de acompanhamento ausente |
| [ ] | RF-EST-059 | planned | — | grant académico granular ausente |
| [ ] | RF-EST-060 | planned | — | plano de estudo ausente |
| [ ] | RF-EST-061 | planned | — | revogação de acompanhamento ausente |
| [ ] | RF-EST-062 | planned | — | recurso académico ausente |
| [ ] | RF-EST-063 | planned | — | histórico de recurso ausente |
| [ ] | RF-EST-064 | planned | — | pedido coletivo académico ausente |
| [ ] | RF-EST-065 | partial | static | convites/equipas de Eventos não cumprem pedido académico coletivo |
| [ ] | RF-EST-066 | planned | — | retirada de pedido coletivo ausente |
| [ ] | RF-EST-067 | planned | — | resumo financeiro académico ausente |
| [ ] | RF-EST-068 | planned | — | propinas/dívidas ausentes |
| [ ] | RF-EST-069 | planned | — | referências académicas ausentes |
| [ ] | RF-EST-070 | planned | — | pagamentos académicos ausentes |
| [ ] | RF-EST-071 | planned | — | partilha de referência ausente |
| [ ] | RF-EST-072 | planned | — | responsável financeiro ausente |
| [ ] | RF-EST-073 | planned | — | autorização contextual genérica ausente |
| [ ] | RF-EST-074 | planned | — | decisão de autorização ausente |
| [ ] | RF-EST-075 | planned | — | caixa de autorizações ausente |
| [ ] | RF-EST-076 | planned | — | revogação contextual ausente |
| [ ] | RF-EST-077 | partial | static | códigos de acesso existem em Eventos; OTP contextual Estudante ausente |
| [ ] | RF-EST-078 | partial | static | limites existem em fluxos específicos, não mecanismo transversal aprovado |
| [ ] | RF-EST-079 | partial | static | SMS/WhatsApp existem; ciclo de autorização Estudante ausente |
| [ ] | RF-EST-080 | planned | — | mercado académico ausente |
| [ ] | RF-EST-081 | planned | — | pesquisa do mercado ausente |
| [ ] | RF-EST-082 | planned | — | reserva/venda ausentes |
| [ ] | RF-EST-083 | planned | — | moderação do mercado ausente |
| [ ] | RF-EST-084 | partial | static | admin atual é transversal/Eventos e não Estudante isolado |

## Requisitos não funcionais

| Check | ID | Estado | Evidência | Referência / teste / lacuna |
| --- | --- | --- | --- | --- |
| [ ] | RNF-EST-001 | partial | static | middlewares existem; fronteiras de produto não estão impostas |
| [ ] | RNF-EST-002 | partial | static | ownership Moodle testado; cobertura global incompleta |
| [ ] | RNF-EST-003 | implemented | static | envelopes/redaction presentes; scanner global não executado |
| [ ] | RNF-EST-004 | implemented | static | `crypto-envelope.ts`; teste específico não executado nesta auditoria |
| [ ] | RNF-EST-005 | blocked | runtime_observed | Secretaria conhecida usa HTTP; depende da instituição/fornecedor |
| [ ] | RNF-EST-006 | partial | static | controlos admin existem; MFA transversal não confirmado |
| [ ] | RNF-EST-007 | implemented | static | Fastify rate limit existe; contexto/provedor incompleto |
| [ ] | RNF-EST-008 | partial | static | práticas locais existem; validação global ausente |
| [ ] | RNF-EST-009 | partial | static | `AdminAuditLog` existe; sem modelo transversal por produto |
| [ ] | RNF-EST-010 | partial | static | consent records existem; finalidade por produto incompleta |
| [ ] | RNF-EST-011 | partial | static | deleção parcial; política completa não evidenciada |
| [ ] | RNF-EST-012 | planned | — | rankings académicos ausentes |
| [ ] | RNF-EST-013 | partial | automated_test | frontend responsivo atual não é shell UOR Estudante completo |
| [ ] | RNF-EST-014 | in_analysis | static | componentes acessíveis existem; auditoria WCAG não executada |
| [ ] | RNF-EST-015 | partial | static | lazy loading/cache existem; orçamento Estudante ausente |
| [ ] | RNF-EST-016 | partial | integration_test | Moodle tem retry/estado; UX Estudante incompleta |
| [ ] | RNF-EST-017 | planned | — | SLO não medido |
| [ ] | RNF-EST-018 | planned | — | INP não medido |
| [ ] | RNF-EST-019 | planned | — | LCP Estudante não medido |
| [ ] | RNF-EST-020 | planned | — | CLS Estudante não medido |
| [ ] | RNF-EST-021 | partial | static | várias listas paginam; garantia global ausente |
| [x] | RNF-EST-022 | verified | integration_test | Moodle worker/session tests aprovados; Codex/local-test/669aed0/2026-07-21 |
| [ ] | RNF-EST-023 | partial | integration_test | cache/snapshots Moodle; demais domínios ausentes |
| [x] | RNF-EST-024 | verified | integration_test | schemas/rotas Moodle aprovados; Codex/local-test/669aed0/2026-07-21 |
| [ ] | RNF-EST-025 | partial | static | logs gerais; dimensão produto incompleta |
| [ ] | RNF-EST-026 | partial | integration_test | falhas Moodle modeladas; alerting operacional não provado |
| [ ] | RNF-EST-027 | implemented | static | deploy possui volumes/backups; restore não verificado |
| [ ] | RNF-EST-028 | in_analysis | static | princípio documentado; execução por produto ausente |
| [ ] | RNF-EST-029 | partial | static | módulos existem, mas imports/Prisma atravessam fronteiras |
| [ ] | RNF-EST-030 | partial | automated_test | 184 specs totais; regras académicas novas ausentes |
| [ ] | RNF-EST-031 | partial | automated_test | contratos Moodle cobertos; Secretaria incompleta |
| [ ] | RNF-EST-032 | partial | static | `/api/v1` iniciou; Moodle ainda em `/integrations/moodle` |
| [ ] | RNF-EST-033 | partial | static | Moodle usa UUIDs; vários contratos legados expõem IDs/números |
| [x] | RNF-EST-034 | verified | automated_test | unique composto e identidade; Codex/local-test/669aed0/2026-07-21 |
| [ ] | RNF-EST-035 | partial | integration_test | Moodle normaliza meta; Secretaria/status ainda incompleto |
| [ ] | RNF-EST-036 | partial | static | formatação existe; política transversal não verificada |
| [ ] | RNF-EST-037 | implemented | static | runtime atual é monólito; fronteiras ainda parciais |
| [ ] | RNF-EST-038 | partial | automated_test | testes/build existem; validação v2 ainda não é gate CI |
| [ ] | RNF-EST-039 | planned | — | RPO/RTO não aprovados |
| [ ] | RNF-EST-040 | partial | static | ODIN/auditoria existem; runbook Estudante não confirmado |

## Regras de negócio

| Check | ID | Estado | Evidência | Referência / teste / lacuna |
| --- | --- | --- | --- | --- |
| [x] | RN-EST-001 | verified | automated_test | schema + `student-identity.spec.ts`; Codex/local-test/669aed0/2026-07-21 |
| [ ] | RN-EST-002 | partial | static | várias consultas/JWT ainda usam número sem instituição |
| [ ] | RN-EST-003 | partial | automated_test | fontes de perfil existem; cobertura de todos os dados ausente |
| [ ] | RN-EST-004 | planned | — | notas oficiais ainda não modeladas |
| [ ] | RN-EST-005 | planned | — | finanças oficiais ainda não modeladas |
| [ ] | RN-EST-006 | partial | integration_test | Moodle evita falsos vazios; domínio completo ausente |
| [x] | RN-EST-007 | verified | integration_test | publicação por snapshot Moodle testada; Codex/local-test/669aed0/2026-07-21 |
| [x] | RN-EST-008 | verified | integration_test | sync por comando/job, não render; Codex/local-test/669aed0/2026-07-21 |
| [x] | RN-EST-009 | verified | integration_test | ownership nas rotas Moodle testado; Codex/local-test/669aed0/2026-07-21 |
| [ ] | RN-EST-010 | partial | static | API Secretaria não escreve; guardrail transversal ainda documental |
| [ ] | RN-EST-011 | planned | — | motor académico ausente |
| [ ] | RN-EST-012 | planned | — | regra de bolsa ausente |
| [ ] | RN-EST-013 | planned | — | simulador ausente |
| [ ] | RN-EST-014 | planned | — | ranking académico ausente |
| [ ] | RN-EST-015 | planned | — | ranking académico ausente |
| [ ] | RN-EST-016 | planned | — | ranking académico ausente |
| [ ] | RN-EST-017 | planned | — | limiar académico ausente |
| [ ] | RN-EST-018 | planned | — | participação académica ausente |
| [ ] | RN-EST-019 | planned | — | previsão curricular ausente |
| [ ] | RN-EST-020 | planned | — | comunidade académica ausente |
| [ ] | RN-EST-021 | planned | — | comunidade académica ausente |
| [ ] | RN-EST-022 | planned | — | avaliação pedagógica ausente |
| [ ] | RN-EST-023 | planned | — | avaliação pedagógica ausente |
| [ ] | RN-EST-024 | planned | — | avaliação pedagógica ausente |
| [ ] | RN-EST-025 | planned | — | explicadores ausentes |
| [ ] | RN-EST-026 | planned | — | explicadores ausentes |
| [ ] | RN-EST-027 | planned | — | revogação contextual ausente |
| [ ] | RN-EST-028 | planned | — | pedidos coletivos ausentes |
| [ ] | RN-EST-029 | planned | — | pedidos coletivos ausentes |
| [ ] | RN-EST-030 | planned | — | recursos ausentes |
| [ ] | RN-EST-031 | planned | — | finanças Estudante ausentes |
| [ ] | RN-EST-032 | planned | — | partilha de referência ausente |
| [ ] | RN-EST-033 | planned | — | responsáveis ausentes |
| [ ] | RN-EST-034 | planned | — | autorização genérica ausente |
| [ ] | RN-EST-035 | planned | — | delegação contextual ausente |
| [ ] | RN-EST-036 | planned | — | OTP contextual ausente |
| [ ] | RN-EST-037 | partial | static | limites em códigos legados; mecanismo v2 ausente |
| [ ] | RN-EST-038 | partial | static | estados pendentes existem em módulos legados, não contrato Estudante |
| [ ] | RN-EST-039 | partial | static | SMS possui controlos; templates Estudante não definidos |
| [ ] | RN-EST-040 | planned | — | mercado ausente |
| [ ] | RN-EST-041 | planned | — | mercado ausente |
| [ ] | RN-EST-042 | partial | static | admin tem perfis, mas fronteiras de dados ainda misturadas |
| [ ] | RN-EST-043 | partial | static | permissões específicas existem; acessos administrativos amplos exigem auditoria |
| [ ] | RN-EST-044 | planned | — | mecanismo emergencial formal ausente |
| [ ] | RN-EST-045 | planned | — | read models Direção ausentes |
| [ ] | RN-EST-046 | partial | static | consent records existem; finalidade por produto incompleta |
| [ ] | RN-EST-047 | partial | static | audit log existe; ownership semântico ainda não formalizado no código |
| [x] | RN-EST-048 | verified | integration_test | idempotência Moodle testada; Codex/local-test/669aed0/2026-07-21 |
| [ ] | RN-EST-049 | partial | integration_test | Moodle suporta stale; cobertura Secretaria ausente |
| [ ] | RN-EST-050 | partial | automated_test | identidade isolada; agregações legadas precisam inventário |
| [ ] | RN-EST-051 | in_analysis | static | ID interno existe; fluxo de correção não verificado |
| [ ] | RN-EST-052 | partial | static | vários fluxos públicos ainda usam número/slug/token heterogéneo |
| [ ] | RN-EST-053 | planned | — | catálogo académico versionado ausente |
| [x] | RN-EST-054 | verified | static | esta matriz declara nível por conclusão; revisão Codex/local-test/669aed0/2026-07-21 |
| [x] | RN-EST-055 | verified | static | validador documental da entrega confirma checkbox/estado |

## Resumo factual

- RF: 9 `verified`; a maioria das capacidades académicas/financeiras/comunitárias permanece planeada.
- RNF: 3 `verified`; há fundação técnica relevante, mas sem produto Estudante independente.
- RN: 7 `verified`; concentram-se em identidade e sincronização Moodle.
- Bloqueador externo explícito: TLS/API da Secretaria.

Este resumo deve ser recalculado por validação automática; não possui precedência sobre as linhas individuais.
