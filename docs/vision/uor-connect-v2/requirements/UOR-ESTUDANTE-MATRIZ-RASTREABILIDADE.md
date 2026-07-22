# UOR Estudante — Matriz de rastreabilidade

```yaml
document_id: UOR-EST-TRACE-001
status: approved
owner: Engenharia UOR Estudante
authority: informative
version: 1.7
last_reviewed: 2026-07-22
approved_by: Product Owner
approved_at: 2026-07-21
review_cycle: por entrega verificada
next_review: piloto da escrita Secretaria sobre TLS
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
- Suite backend completa nesta árvore: 109 ficheiros/449 testes passaram de 110 ficheiros/452 testes; 3 testes preexistentes de referrals em `passport-game-rules.spec.ts` falharam porque o mock não expõe `prisma.student.findFirst`. Suite frontend anteriormente verificada: 3 ficheiros/6 testes.
- API Secretaria verificada adicionalmente nesta entrega: contratos unitários/de rota/persistência, build de produção e ensaio vivo integral em dois perfis autorizados para identidade, contactos, fotografia, consentimentos, 10 datasets académicos, finanças, sete processos e diretório de cursos. O ensaio encontrou e eliminou exposição de identidade interna em faltas, candidaturas e ações HTML.
- O build de produção está aprovado. O lint TypeScript não aponta erro no módulo Secretaria, mas permanece globalmente vermelho por três fixtures antigas fora deste âmbito (`delete-incomplete-student`, `odin-ai.service` e `http-errors`).
- Leitura viva da fotografia foi repetida pelo gateway HTTP: assinatura binária PNG, 959 bytes e precondição consistente. O multipart JPEG foi capturado com POST bloqueado; nenhuma fotografia foi alterada.
- As duas contas autorizadas estavam fora do período de inscrição, com listas vazias. O cancelamento foi capturado como POST form-urlencoded de campo único com a requisição bloqueada; nenhum registo foi alterado e o contrato de criação permanece desconhecido.
- O contrato de contactos foi observado no navegador e repetido pelo gateway HTTP com submissão no-op: o portal devolveu `parameterErrors`/`success=false` por campos legados obrigatórios incompletos, sem criar pedido ou alterar valores.
- Um terceiro perfil autorizado confirmou ao vivo extrato de propinas, dívidas, histórico, comprovativos imprimíveis e cobranças de recurso. Uma prova controlada gerou uma referência, reconciliou-a e extraiu o PDF oficial; não houve checkout, cartão ou processamento de pagamento.
- O fluxo de revisão de nota foi mapeado no browser autorizado: referência da linha, estados oficiais, ações por fase, limite de 16000 caracteres e `PUT application/json` com `id` e `justificacaoPedidoTemp`. Uma confirmação de “pedido de cópia de prova” alcançou o ambiente de teste antes de o `autoSync`/`PUT` ser identificado, deixando uma linha em `Aguarda prova`; o portal não expôs cancelamento. Todas as sondas mutáveis posteriores foram bloqueadas no cliente.

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
| [ ] | RF-EST-016 | implemented | integration_test | Secretaria `/session`, envelopes separados e renovação; rota testada e login observado |
| [ ] | RF-EST-017 | implemented | runtime_observed | `/me` ligado ao gateway; identity match observado, cobertura de campos varia por perfil |
| [ ] | RF-EST-018 | implemented | integration_test | inscrições/contexto expostos; snapshots Prisma implementados, sem E2E de persistência |
| [ ] | RF-EST-019 | implemented | integration_test | `/health`, `/session` e `/capabilities` substituem estado `planned` |
| [ ] | RF-EST-020 | implemented | static | `/sync` e reutilização de execução ativa implementados; worker assíncrono ainda ausente |
| [ ] | RF-EST-021 | implemented | static | snapshots versionados e fallback `stale`; cenário de falha ainda sem teste automatizado |
| [ ] | RF-EST-022 | partial | static | JSON/HTML incompatível falha fechado por capability; alerta operacional ainda ausente |
| [ ] | RF-EST-023 | implemented | runtime_observed | histórico, inscrições, créditos e progressão expostos por contrato interno |
| [ ] | RF-EST-024 | implemented | integration_test | `/academic/grades` protegido e normalizado; conteúdo real pode ser vazio por conta/período |
| [ ] | RF-EST-025 | implemented | static | `/academic/overview` ligado a totais curriculares oficiais |
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
| [ ] | RF-EST-048 | implemented | runtime_observed | `/academic/exams`; 13 itens observados no smoke autorizado |
| [ ] | RF-EST-049 | implemented | runtime_observed | faltas/presenças académicas isoladas do attendance de Eventos |
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
| [ ] | RF-EST-067 | implemented | runtime_observed | `/finance/overview`; dados oficiais observados |
| [x] | RF-EST-068 | verified | runtime_observed | `/finance/tuition`, `/finance/debts` e `/finance/charges`; contratos vivos e testes de parser aprovados |
| [ ] | RF-EST-069 | implemented | runtime_observed | referências existentes e `chargeRef` opaco entregues em leitura |
| [x] | RF-EST-070 | verified | runtime_observed | `/finance/payments`; linhas pagas, datas e saldos confirmados no extrato vivo |
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
| [ ] | RF-EST-085 | implemented | integration_test | leitura, patch permitido, precondição, idempotência e comando implementados; flag desativada e sucesso real bloqueado por dados obrigatórios incompletos nas contas de teste |
| [ ] | RF-EST-086 | implemented | integration_test | leitura proxy e comando JPEG com precondição implementados; multipart observado, flag desativada e sucesso real não executado; remoção não suportada pelo portal |
| [ ] | RF-EST-087 | deprecated | static | reservado: troca de senha não pertence à API v1 |
| [ ] | RF-EST-088 | partial | runtime_observed | leitura oficial “Sem consentimentos” implementada; escrita permanece desativada porque não existe finalidade editável nas contas autorizadas |
| [ ] | RF-EST-089 | partial | integration_test | leitura com referência opaca e cancelamento durável/reconciliável implementados sob flag; criação continua bloqueada até observar janela elegível e pós-condição real |
| [ ] | RF-EST-090 | implemented | integration_test | cópia de prova, revisão e reapreciação usam `reviewRef` opaco, comando de risco alto, idempotência, confirmação, precondição e reconciliação; cópia foi observada ao vivo e as demais dependem de estado elegível |
| [ ] | RF-EST-091 | planned | — | candidatura permanece com flag/contrato desativados |
| [ ] | RF-EST-092 | planned | — | escritas de processos permanecem com flags/contratos desativados |
| [x] | RF-EST-093 | verified | runtime_observed | wizard `REFERENCIAS_MB`, reconciliação e extração PDF confirmados num recurso elegível; sem pagamento |
| [ ] | RF-EST-094 | deprecated | static | reservado: payment intent/checkout não pertence à API v1 |
| [x] | RF-EST-095 | verified | runtime_observed | índice, detalhe por `receiptRef` opaco e PDF informativo verificados; `officialFiscalReceipt=false` explícito |
| [x] | RF-EST-096 | verified | runtime_observed | `/directory/courses` normalizado e observado nos dois perfis autorizados; 12 registos por página no contrato vivo |
| [x] | RF-EST-097 | verified | runtime_observed | proxy PDF validou assinatura, ownership por `chargeRef`, ETag e documento vivo de recurso |
| [ ] | RF-EST-098 | implemented | integration_test | endpoint e resposta oficial mapeados; comando durável usa a flag de contactos, confirmação e precondição; execução real depende de pedido pendente |

## Requisitos não funcionais

| Check | ID | Estado | Evidência | Referência / teste / lacuna |
| --- | --- | --- | --- | --- |
| [ ] | RNF-EST-001 | partial | static | middlewares existem; fronteiras de produto não estão impostas |
| [ ] | RNF-EST-002 | partial | static | ownership Moodle testado; cobertura global incompleta |
| [ ] | RNF-EST-003 | implemented | automated_test | redaction e ausência de senha na resposta testadas; scanner global não executado |
| [ ] | RNF-EST-004 | implemented | automated_test | AES-256-GCM, AAD e adulteração testados; persistência E2E pendente |
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
| [ ] | RNF-EST-023 | implemented | static | snapshots/fallback Secretaria implementados; teste de indisponibilidade pendente |
| [x] | RNF-EST-024 | verified | integration_test | schemas/rotas Moodle aprovados; Codex/local-test/669aed0/2026-07-21 |
| [ ] | RNF-EST-025 | partial | static | logs gerais; dimensão produto incompleta |
| [ ] | RNF-EST-026 | partial | integration_test | falhas Moodle modeladas; alerting operacional não provado |
| [ ] | RNF-EST-027 | implemented | static | deploy possui volumes/backups; restore não verificado |
| [ ] | RNF-EST-028 | in_analysis | static | princípio documentado; execução por produto ausente |
| [ ] | RNF-EST-029 | partial | static | módulos existem, mas imports/Prisma atravessam fronteiras |
| [ ] | RNF-EST-030 | partial | automated_test | 184 specs totais; regras académicas novas ausentes |
| [ ] | RNF-EST-031 | partial | integration_test | contrato HTTP Secretaria coberto; fixtures de alteração upstream ainda incompletas |
| [ ] | RNF-EST-032 | partial | static | `/api/v1` iniciou; Moodle ainda em `/integrations/moodle` |
| [ ] | RNF-EST-033 | partial | static | Moodle usa UUIDs; vários contratos legados expõem IDs/números |
| [x] | RNF-EST-034 | verified | automated_test | unique composto e identidade; Codex/local-test/669aed0/2026-07-21 |
| [ ] | RNF-EST-035 | implemented | integration_test | Secretaria devolve source, coverage, observedAt e stale no envelope |
| [ ] | RNF-EST-036 | partial | static | formatação existe; política transversal não verificada |
| [ ] | RNF-EST-037 | implemented | static | runtime atual é monólito; fronteiras ainda parciais |
| [ ] | RNF-EST-038 | partial | automated_test | testes/build existem; validação v2 ainda não é gate CI |
| [ ] | RNF-EST-039 | planned | — | RPO/RTO não aprovados |
| [ ] | RNF-EST-040 | partial | static | ODIN/auditoria existem; runbook Estudante não confirmado |
| [ ] | RNF-EST-041 | implemented | integration_test | persistência, idempotência, tentativa, confirmação e resultado cifrado testados; reconciliação concorrente PostgreSQL pendente |
| [ ] | RNF-EST-042 | partial | integration_test | confirmação literal/prazo implementados; OTP por risco ainda ausente |
| [ ] | RNF-EST-043 | partial | integration_test | flag individual e drift fail-closed testados; circuit breaker operacional pendente |
| [ ] | RNF-EST-044 | implemented | automated_test | AES-256-GCM/AAD separado para credencial, sessão, payload e resultado financeiro; KMS externo pendente |

## Regras de negócio

| Check | ID | Estado | Evidência | Referência / teste / lacuna |
| --- | --- | --- | --- | --- |
| [x] | RN-EST-001 | verified | automated_test | schema + `student-identity.spec.ts`; Codex/local-test/669aed0/2026-07-21 |
| [ ] | RN-EST-002 | partial | static | várias consultas/JWT ainda usam número sem instituição |
| [ ] | RN-EST-003 | partial | automated_test | fontes de perfil existem; cobertura de todos os dados ausente |
| [ ] | RN-EST-004 | implemented | integration_test | notas vêm exclusivamente do gateway Secretaria |
| [ ] | RN-EST-005 | implemented | runtime_observed | finanças vêm exclusivamente do gateway Secretaria |
| [ ] | RN-EST-006 | partial | integration_test | Moodle evita falsos vazios; domínio completo ausente |
| [x] | RN-EST-007 | verified | integration_test | publicação por snapshot Moodle testada; Codex/local-test/669aed0/2026-07-21 |
| [x] | RN-EST-008 | verified | integration_test | sync por comando/job, não render; Codex/local-test/669aed0/2026-07-21 |
| [x] | RN-EST-009 | verified | integration_test | ownership nas rotas Moodle testado; Codex/local-test/669aed0/2026-07-21 |
| [x] | RN-EST-010 | verified | automated_test | escrita de referência falha fechada por flag; restantes mutações retornam `SECRETARIA_CAPABILITY_DISABLED` |
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
| [ ] | RN-EST-031 | implemented | integration_test | somente consulta/referência; payment intents e processamento não existem |
| [ ] | RN-EST-032 | planned | — | partilha de referência ausente |
| [ ] | RN-EST-033 | planned | — | responsáveis ausentes |
| [ ] | RN-EST-034 | planned | — | autorização genérica ausente |
| [ ] | RN-EST-035 | planned | — | delegação contextual ausente |
| [ ] | RN-EST-036 | planned | — | OTP contextual ausente |
| [ ] | RN-EST-037 | partial | static | limites em códigos legados; mecanismo v2 ausente |
| [ ] | RN-EST-038 | implemented | integration_test | referência só termina após etapa oficial de resultado/sucesso; ambiguidades ficam `UNKNOWN` |
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
| [ ] | RN-EST-049 | implemented | static | snapshot Secretaria preserva origem/data e muda coverage para `stale` |
| [ ] | RN-EST-050 | partial | automated_test | identidade isolada; agregações legadas precisam inventário |
| [ ] | RN-EST-051 | in_analysis | static | ID interno existe; fluxo de correção não verificado |
| [ ] | RN-EST-052 | partial | static | vários fluxos públicos ainda usam número/slug/token heterogéneo |
| [ ] | RN-EST-053 | planned | — | catálogo académico versionado ausente |
| [x] | RN-EST-054 | verified | static | esta matriz declara nível por conclusão; revisão Codex/local-test/669aed0/2026-07-21 |
| [x] | RN-EST-055 | verified | static | validador documental da entrega confirma checkbox/estado |
| [ ] | RN-EST-056 | implemented | integration_test | gateway exige resumo consistente e `stepresultadopagamento` com sucesso |
| [ ] | RN-EST-057 | implemented | static | erro ambíguo produz `UNKNOWN`; reconciliação apenas lê e nunca reenvia escrita |
| [ ] | RN-EST-058 | implemented | integration_test | estado financeiro vem da leitura oficial; referência não é tratada como pagamento |
| [ ] | RN-EST-059 | implemented | integration_test | não existem payment intents/checkout/captura; prova controlada gerou somente referência |
| [ ] | RN-EST-060 | implemented | integration_test | `/session`, `/connection` e `/data-deletion-requests` possuem efeitos distintos |

## Resumo factual

- RF: 9 `verified`; a maioria das capacidades académicas/financeiras/comunitárias permanece planeada.
- RNF: 3 `verified`; há fundação técnica relevante, mas sem produto Estudante independente.
- RN: 8 `verified`; concentram-se em identidade, sincronização e bloqueio de escritas não ativadas.
- Bloqueador externo explícito: TLS/API da Secretaria.

Este resumo deve ser recalculado por validação automática; não possui precedência sobre as linhas individuais.
