# UOR Estudante — Matriz de rastreabilidade

```yaml
document_id: UOR-EST-TRACE-001
status: approved
owner: Engenharia UOR Estudante
authority: informative
version: 2.0
last_reviewed: 2026-07-26
approved_by: Product Owner
approved_at: 2026-07-21
review_cycle: por entrega verificada
next_review: ensaio de restore PostgreSQL e piloto da Secretaria sobre TLS
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
- Verificação executada em 2026-07-26 no ambiente `local-test`, por `Codex`, sobre o commit `4354fa4`.
- Suite backend completa: 129 ficheiros/513 testes passaram. `npm run build` e `npm run lint` passaram sem erros.
- O schema PostgreSQL foi gerado e validado; as seis migrações UOR Estudante são aditivas. O gate CI executa geração Prisma, migrações, build, testes focados, validação documental e inspeção do utilitário de backup.
- API Secretaria verificada adicionalmente nesta entrega: contratos unitários/de rota/persistência, build de produção e ensaio vivo integral em dois perfis autorizados para identidade, contactos, fotografia, consentimentos, 10 datasets académicos, finanças, sete processos e diretório de cursos. O ensaio encontrou e eliminou exposição de identidade interna em faltas, candidaturas e ações HTML.
- O build de produção e o typecheck global estão aprovados; fixtures antigas incompatíveis com os contratos atuais foram atualizadas sem alterar comportamento de produção.
- Leitura viva da fotografia foi repetida pelo gateway HTTP: assinatura binária PNG, 959 bytes e precondição consistente. O multipart JPEG foi capturado com POST bloqueado; nenhuma fotografia foi alterada.
- As duas contas autorizadas estavam fora do período de inscrição, com listas vazias. O cancelamento foi capturado como POST form-urlencoded de campo único com a requisição bloqueada; nenhum registo foi alterado e o contrato de criação permanece desconhecido.
- O contrato de contactos foi observado no navegador e repetido pelo gateway HTTP com submissão no-op: o portal devolveu `parameterErrors`/`success=false` por campos legados obrigatórios incompletos, sem criar pedido ou alterar valores.
- Um terceiro perfil autorizado confirmou ao vivo extrato de propinas, dívidas, histórico, comprovativos imprimíveis e cobranças de recurso. Uma prova controlada gerou uma referência, reconciliou-a e extraiu o PDF oficial; não houve checkout, cartão ou processamento de pagamento.
- O fluxo de revisão de nota foi mapeado no browser autorizado: referência da linha, estados oficiais, ações por fase, limite de 16000 caracteres e `PUT application/json` com `id` e `justificacaoPedidoTemp`. Uma confirmação de “pedido de cópia de prova” alcançou o ambiente de teste antes de o `autoSync`/`PUT` ser identificado, deixando uma linha em `Aguarda prova`; o portal não expôs cancelamento. Todas as sondas mutáveis posteriores foram bloqueadas no cliente.

## Requisitos funcionais

| Check | ID | Estado | Evidência | Referência / teste / lacuna |
| --- | --- | --- | --- | --- |
| [x] | RF-EST-001 | verified | integration_test | login institucional + bootstrap do produto; `login.integration.spec.ts` e `uor-student-login-bootstrap.spec.ts` |
| [x] | RF-EST-002 | verified | automated_test | unicidade `institutionCode + studentNumber`; contrato Prisma aprovado |
| [x] | RF-EST-003 | verified | integration_test | `uorStudentPublicId`, ownership e cursores opacos; testes de identidade, workflows e rotas |
| [x] | RF-EST-004 | verified | integration_test | `/api/v1/student/me` com proveniência por campo; route/repository tests |
| [x] | RF-EST-005 | verified | automated_test | patch separa campos declarados dos oficiais e audita alteração |
| [x] | RF-EST-006 | verified | automated_test | preferências por finalidade, versão, campos, expiração e revogação |
| [x] | RF-EST-007 | verified | integration_test | sessão UOR, sessão externa e desconexão são efeitos distintos; route tests |
| [x] | RF-EST-008 | verified | automated_test | exportação escopada e pedido de eliminação com retenções/estado; identity + route tests |
| [x] | RF-EST-009 | verified | integration_test | ligação Moodle cifrada e associada ao titular |
| [x] | RF-EST-010 | verified | integration_test | desconexão revoga segredos/sessão sem apagar histórico retido |
| [x] | RF-EST-011 | verified | integration_test | perfil Moodle normalizado com cobertura e sincronização |
| [x] | RF-EST-012 | verified | integration_test | cursos/secções publicados por snapshot consistente |
| [x] | RF-EST-013 | verified | integration_test | materiais por proxy, locator cifrado e ownership testado |
| [x] | RF-EST-014 | verified | integration_test | jobs assíncronos, leases e chave idempotente testados |
| [x] | RF-EST-015 | verified | integration_test | estado/fase/contadores/erro seguro expostos e testados |
| [x] | RF-EST-016 | verified | integration_test | sessão Secretaria isolada, envelopes por finalidade e bootstrap testados |
| [x] | RF-EST-017 | verified | runtime_observed | perfil oficial normalizado e identity match observados em contas autorizadas |
| [x] | RF-EST-018 | verified | integration_test | inscrições/contexto persistidos em snapshots versionados com proveniência |
| [x] | RF-EST-019 | verified | integration_test | `/providers`, health/capabilities e estados diferenciados; application/route tests |
| [ ] | RF-EST-020 | superseded | static | decisão aprovada: sincronização exclusivamente automática no backend; sem botão/manual na v1 |
| [x] | RF-EST-021 | verified | automated_test | repositório mantém último snapshot válido com `stale`/data e rejeita snapshot inválido |
| [x] | RF-EST-022 | verified | automated_test | drift falha fechado e abre alerta técnico deduplicado; worker/official-change tests |
| [x] | RF-EST-023 | verified | integration_test | unidades/inscrições oficiais paginadas, com origem e filtro por snapshot |
| [x] | RF-EST-024 | verified | integration_test | notas oficiais preservam `null`; rotas, normalização e motor testados |
| [ ] | RF-EST-025 | implemented | integration_test | resumo oficial e médias derivadas separados; falta fixture viva rica por período |
| [x] | RF-EST-026 | verified | automated_test | média ponderada por cadeira, fórmula/versão/inputs testados |
| [x] | RF-EST-027 | verified | automated_test | média geral reproduzível e ausências excluídas sem virar zero |
| [x] | RF-EST-028 | verified | automated_test | simulações isoladas, editáveis, paginadas e protegidas contra IDOR |
| [x] | RF-EST-029 | verified | automated_test | nota necessária distingue alcançado, exigido, impossível e informação insuficiente |
| [ ] | RF-EST-030 | implemented | automated_test | cálculo genérico existe; só é oficial quando regra institucional versionada estiver aprovada |
| [ ] | RF-EST-031 | implemented | automated_test | hipótese de bolsa 16 versionada e explicitamente não oficial; confirmação institucional aberta |
| [x] | RF-EST-032 | verified | automated_test | série temporal por snapshots, fonte, versão e `stale` testada |
| [x] | RF-EST-033 | verified | automated_test | adesão/retirada por contexto e política versionada; ranking tests |
| [x] | RF-EST-034 | verified | automated_test | posição/percentil privados sem identidades de terceiros |
| [x] | RF-EST-035 | verified | automated_test | instituição, curso, turma, período e cadeira compõem o contexto |
| [x] | RF-EST-036 | verified | automated_test | grupo abaixo da amostra mínima retorna `insufficient_sample` |
| [x] | RF-EST-037 | verified | automated_test | `/curriculum/map` normaliza concluída, atual, pendente, reprovada e bloqueada |
| [x] | RF-EST-038 | verified | automated_test | créditos/percentagem somente quando totais oficiais estão presentes |
| [x] | RF-EST-039 | verified | automated_test | precedências oficiais normalizadas e associadas à unidade curricular |
| [x] | RF-EST-040 | verified | automated_test | previsão por velocidade de créditos com método, hipóteses e incerteza |
| [x] | RF-EST-041 | verified | automated_test | histórico antes/depois, fonte, versões e deteção; official-change tests |
| [x] | RF-EST-042 | verified | automated_test | alerta configurável, deduplicação e preferência desativada testados |
| [x] | RF-EST-043 | verified | automated_test | agenda unifica aulas, exames e eventos pessoais com proveniência |
| [x] | RF-EST-044 | verified | automated_test | eventos pessoais privados, owner-scoped, histórico e remoção/transição |
| [x] | RF-EST-045 | verified | automated_test | sobreposição identifica itens, fontes e intervalo comum |
| [x] | RF-EST-046 | verified | automated_test | densidade semanal retorna recomendação explicável, nunca decisão oficial |
| [x] | RF-EST-047 | verified | runtime_observed | horário oficial e alterações expostos por snapshot; cobertura viva observada |
| [x] | RF-EST-048 | verified | runtime_observed | exames/épocas normalizados; 13 itens observados no smoke autorizado |
| [x] | RF-EST-049 | verified | integration_test | faltas/presenças oficiais usam coverage e nunca fabricam zero |
| [ ] | RF-EST-050 | implemented | static | reporte comunitário contextual, privado ao autor, com validade obrigatória |
| [ ] | RF-EST-051 | implemented | static | confirmações/contestações independentes e transições concorrentes implementadas |
| [ ] | RF-EST-052 | implemented | integration_test | associação docente/cadeira/período exposta a partir do horário oficial |
| [ ] | RF-EST-053 | implemented | automated_test | elegibilidade oficial, unicidade contextual e anonimização implementadas |
| [x] | RF-EST-054 | verified | automated_test | agregado pedagógico oculta amostra pequena e calcula dimensões |
| [x] | RF-EST-055 | verified | automated_test | denúncia e fila/decisão de moderação isoladas de notas/finanças |
| [ ] | RF-EST-056 | implemented | static | perfil de explicador escopado por cadeira e disponibilidade |
| [ ] | RF-EST-057 | implemented | static | pesquisa institucional minimizada por cadeira/estado |
| [ ] | RF-EST-058 | implemented | integration_test | convite, decisão própria e relação ativa modelados |
| [x] | RF-EST-059 | verified | automated_test | grant rejeita wildcard/finanças e limita cadeira, período, campos e validade |
| [ ] | RF-EST-060 | implemented | integration_test | plano, tarefas e sessões pertencem à relação ativa |
| [ ] | RF-EST-061 | implemented | integration_test | revogação encerra relação e grants associados de forma transacional |
| [ ] | RF-EST-062 | implemented | static | recurso local nasce como `draft`, separado do comando oficial |
| [ ] | RF-EST-063 | implemented | integration_test | eventos funcionais preservam histórico/origem do recurso |
| [ ] | RF-EST-064 | implemented | integration_test | pedido coletivo registra contexto, criador e composição |
| [x] | RF-EST-065 | verified | automated_test | participação requer ação própria e bloqueia inclusão entre instituições |
| [x] | RF-EST-066 | verified | automated_test | retirada antes da submissão atualiza ator e histórico |
| [x] | RF-EST-067 | verified | runtime_observed | resumo financeiro oficial observado e separado por domínio |
| [x] | RF-EST-068 | verified | runtime_observed | propinas, dívidas e cobranças vivas com moeda/estado/fonte |
| [x] | RF-EST-069 | verified | runtime_observed | referências oficiais com locator opaco, validade e estado |
| [x] | RF-EST-070 | verified | runtime_observed | histórico pago, datas e saldos confirmados no extrato oficial |
| [x] | RF-EST-071 | verified | automated_test | partilha usa autorização com apenas seis campos da referência |
| [x] | RF-EST-072 | verified | automated_test | responsável é confirmado por finalidade, validade, usos e revogação |
| [x] | RF-EST-073 | verified | automated_test | autorização exige titular, representante, ação, recurso, campos, prazo e usos |
| [x] | RF-EST-074 | verified | automated_test | decisão autenticada por OTP contextual e auditada |
| [x] | RF-EST-075 | verified | automated_test | caixa enviada/recebida, estado e paginação opaca implementadas |
| [x] | RF-EST-076 | verified | automated_test | revogação invalida OTP/uso e notifica representante |
| [x] | RF-EST-077 | verified | automated_test | OTP ligado a ator, autorização, ação/recurso e prazo |
| [x] | RF-EST-078 | verified | automated_test | tentativas/reenvios, expiração e consumo atómico testados |
| [x] | RF-EST-079 | verified | automated_test | notificações minimizadas e deduplicadas no ciclo da autorização |
| [ ] | RF-EST-080 | implemented | static | publicação institucional, expiração e ownership do anúncio |
| [ ] | RF-EST-081 | implemented | static | pesquisa paginada por categoria, curso, preço e estado |
| [ ] | RF-EST-082 | implemented | integration_test | reserva concorrente e transição para vendido implementadas |
| [x] | RF-EST-083 | verified | automated_test | denúncia, fila e decisão moderada com auditoria; admin tests |
| [x] | RF-EST-084 | verified | automated_test | permissão `UOR_STUDENT` isolada e mutações administrativas exigem MFA |
| [ ] | RF-EST-085 | implemented | integration_test | leitura, patch permitido, precondição, idempotência e comando implementados; flag desativada e sucesso real bloqueado por dados obrigatórios incompletos nas contas de teste |
| [ ] | RF-EST-086 | implemented | integration_test | leitura proxy e comando JPEG com precondição implementados; multipart observado, flag desativada e sucesso real não executado; remoção não suportada pelo portal |
| [ ] | RF-EST-087 | deprecated | static | reservado: troca de senha não pertence à API v1 |
| [ ] | RF-EST-088 | partial | runtime_observed | leitura oficial “Sem consentimentos” implementada; escrita desativada sem finalidade editável observada |
| [ ] | RF-EST-089 | partial | integration_test | leitura com referência opaca e cancelamento durável/reconciliável implementados sob flag; criação continua bloqueada até observar janela elegível e pós-condição real |
| [ ] | RF-EST-090 | implemented | integration_test | cópia de prova, revisão e reapreciação usam `reviewRef` opaco, comando de risco alto, idempotência, confirmação, precondição e reconciliação; cópia foi observada ao vivo e as demais dependem de estado elegível |
| [ ] | RF-EST-091 | planned | — | candidatura permanece com flag/contrato desativados |
| [ ] | RF-EST-092 | planned | — | escritas de processos permanecem com flags/contratos desativados |
| [x] | RF-EST-093 | verified | runtime_observed | wizard `REFERENCIAS_MB`, reconciliação e extração PDF confirmados num recurso elegível; sem pagamento |
| [ ] | RF-EST-094 | deprecated | static | reservado: payment intent/checkout não pertence à API v1 |
| [x] | RF-EST-095 | verified | runtime_observed | índice, detalhe por `receiptRef` opaco e PDF informativo verificados; `officialFiscalReceipt=false` explícito |
| [x] | RF-EST-096 | verified | runtime_observed | `/directory/courses` normalizado e observado nos dois perfis autorizados; 12 registos por página no contrato vivo |
| [x] | RF-EST-097 | verified | runtime_observed | proxy PDF validou assinatura, ownership por `chargeRef`, ETag e documento vivo de recurso |
| [ ] | RF-EST-098 | implemented | integration_test | comando durável usa flag, confirmação, precondição e resposta inequívoca; execução real depende de pedido pendente |

## Requisitos não funcionais

| Check | ID | Estado | Evidência | Referência / teste / lacuna |
| --- | --- | --- | --- | --- |
| [x] | RNF-EST-001 | verified | integration_test | prefixo privado, tenant, finalidade e negação por defeito cobertos por testes negativos |
| [x] | RNF-EST-002 | verified | automated_test | rotas/repositórios impedem IDOR de perfil, snapshot, simulação, workflow e autorização |
| [ ] | RNF-EST-003 | implemented | automated_test | respostas/logs redigidos e senhas ausentes; scanner de segredos do repositório ainda não é gate |
| [x] | RNF-EST-004 | verified | automated_test | AES-256-GCM, AAD, adulteração, rotação e persistência de envelopes testados |
| [ ] | RNF-EST-005 | blocked | runtime_observed | Secretaria conhecida usa HTTP; depende da instituição/fornecedor |
| [x] | RNF-EST-006 | verified | automated_test | admin UOR Estudante e operações externas de risco alto exigem MFA/step-up curto |
| [ ] | RNF-EST-007 | implemented | integration_test | limites por rota, identidade/IP e OTP existem; métricas por limiar aguardam piloto |
| [ ] | RNF-EST-008 | implemented | automated_test | redação e erros seguros testados; política central de log ainda é transversal |
| [x] | RNF-EST-009 | verified | automated_test | auditoria UOR Estudante contém ator, instituição, domínio, ação, recurso, finalidade, resultado e trace |
| [x] | RNF-EST-010 | verified | automated_test | perfil, grants, finanças delegadas e autorizações usam campos/finalidade explícitos |
| [ ] | RNF-EST-011 | partial | static | retenções são declaradas e exportação funciona; executor assíncrono de eliminação ainda não foi ensaiado |
| [x] | RNF-EST-012 | verified | automated_test | amostra mínima, contexto estrito, opt-in/retirada e resposta privada testados |
| [ ] | RNF-EST-013 | partial | automated_test | frontend responsivo atual não é shell UOR Estudante completo |
| [ ] | RNF-EST-014 | in_analysis | static | componentes acessíveis existem; auditoria WCAG não executada |
| [ ] | RNF-EST-015 | implemented | static | paginação, snapshots e proxy evitam payload ilimitado; orçamento medido aguarda piloto |
| [x] | RNF-EST-016 | verified | integration_test | retries seguros, jobs retomáveis e último snapshot preservam trabalho em ligação instável |
| [ ] | RNF-EST-017 | planned | — | SLO não medido |
| [ ] | RNF-EST-018 | planned | — | INP não medido |
| [ ] | RNF-EST-019 | planned | — | LCP Estudante não medido |
| [ ] | RNF-EST-020 | planned | — | CLS Estudante não medido |
| [ ] | RNF-EST-021 | implemented | automated_test | listas públicas/privadas têm limites e cursores; auditoria automática de toda rota ainda não existe |
| [x] | RNF-EST-022 | verified | integration_test | jobs automáticos, leases, idempotência e retentativa aprovados; `4354fa4` |
| [x] | RNF-EST-023 | verified | automated_test | snapshots locais e `stale` funcionam sem upstream; repository/application tests |
| [x] | RNF-EST-024 | verified | integration_test | Zod, parsers e contratos externos falham fechados; suites Moodle/Secretaria |
| [x] | RNF-EST-025 | verified | automated_test | logs usam `product=uor_student`, domínio real da rota, tenant, resultado e trace |
| [x] | RNF-EST-026 | verified | automated_test | drift abre alerta técnico deduplicado e administrável |
| [ ] | RNF-EST-027 | implemented | static | backup cifrado e restore isolado existem; falta ensaio recente de restauração |
| [ ] | RNF-EST-028 | implemented | static | seis migrações aditivas/expand foram validadas; nenhuma quebra contract nesta entrega |
| [ ] | RNF-EST-029 | implemented | static | módulo por domínio e portas explícitas; ainda partilha Prisma/runtime monolítico conforme ADR |
| [x] | RNF-EST-030 | verified | automated_test | médias, ranking, autorização, OTP, workflows e drift têm testes determinísticos |
| [x] | RNF-EST-031 | verified | integration_test | fixtures cobrem campos ausentes, HTML alterado, sessão expirada e circuit breaker |
| [x] | RNF-EST-032 | verified | integration_test | produto publicado integralmente sob `/api/v1/student`; reservados documentados |
| [x] | RNF-EST-033 | verified | automated_test | IDs de perfil, itens, cursores, comandos e workflows são opacos |
| [x] | RNF-EST-034 | verified | automated_test | matrícula igual entre instituições não cruza dados; identity/sync/workflow tests |
| [x] | RNF-EST-035 | verified | integration_test | respostas externas incluem source, observedAt/syncedAt, coverage e stale |
| [ ] | RNF-EST-036 | implemented | integration_test | ISO-8601/timezone e moeda aparecem nos contratos; revisão completa de locale aguarda frontend |
| [x] | RNF-EST-037 | verified | static | fronteiras lógicas por módulo/porta foram implementadas no monólito modular |
| [x] | RNF-EST-038 | verified | automated_test | workflow CI bloqueia build, testes focados, migração e documentação |
| [ ] | RNF-EST-039 | implemented | static | RPO/RTO aprovados no runbook; ensaio de restore ainda é condição do piloto |
| [ ] | RNF-EST-040 | implemented | static | runbook cobre contenção, rotação, comunicação, evidência e recuperação; simulação pendente |
| [x] | RNF-EST-041 | verified | integration_test | comandos persistentes, idempotentes, cifrados, confirmados e reconciliáveis testados |
| [x] | RNF-EST-042 | verified | automated_test | confirmação recente e OTP contextual por risco implementados/testados |
| [x] | RNF-EST-043 | verified | automated_test | flags por capability, drift fail-closed e circuit breaker têm testes |
| [ ] | RNF-EST-044 | implemented | automated_test | AES-GCM/AAD/rotação verificados; chave é injetável, mas KMS externo depende do deploy |

## Regras de negócio

| Check | ID | Estado | Evidência | Referência / teste / lacuna |
| --- | --- | --- | --- | --- |
| [x] | RN-EST-001 | verified | automated_test | schema composto e isolamento testados; `4354fa4` |
| [x] | RN-EST-002 | verified | automated_test | autorização/ownership do produto usa ID interno + instituição |
| [x] | RN-EST-003 | verified | integration_test | perfil e datasets preservam fonte, observedAt e coverage |
| [x] | RN-EST-004 | verified | automated_test | somente snapshot Secretaria recebe origem `secretaria_uor`; cálculo é derivado |
| [x] | RN-EST-005 | verified | integration_test | finanças oficiais vêm exclusivamente da Secretaria |
| [x] | RN-EST-006 | verified | automated_test | ausência permanece `null`/coverage; motor e rotas testados |
| [x] | RN-EST-007 | verified | integration_test | publicação atómica mantém snapshot válido anterior |
| [x] | RN-EST-008 | verified | integration_test | TTL/jobs automáticos governam sync; nenhuma renderização dispara upstream |
| [x] | RN-EST-009 | verified | integration_test | ligação/desconexão validam titular e tenant no servidor |
| [x] | RN-EST-010 | verified | automated_test | escrita de referência falha fechada por flag; restantes mutações retornam `SECRETARIA_CAPABILITY_DISABLED` |
| [x] | RN-EST-011 | verified | automated_test | cálculo devolve código, versão, fórmula e inputs |
| [x] | RN-EST-012 | verified | automated_test | alvo 16 é `hypothesis`, versionado e nunca rotulado como regra oficial |
| [x] | RN-EST-013 | verified | automated_test | simulações persistem em namespace próprio e não atualizam notas |
| [x] | RN-EST-014 | verified | automated_test | ranking usa opt-in, instituição, curso, turma, período e cadeira |
| [x] | RN-EST-015 | verified | automated_test | resposta contém coverage e sampleSize |
| [x] | RN-EST-016 | verified | automated_test | retorna apenas posição/percentil do titular e agregados |
| [x] | RN-EST-017 | verified | automated_test | amostra pequena fica `insufficient_sample` |
| [x] | RN-EST-018 | verified | automated_test | retirada remove contribuição na consulta seguinte |
| [x] | RN-EST-019 | verified | automated_test | previsão é `estimated`, com método, hipóteses e incerteza |
| [ ] | RN-EST-020 | implemented | static | fonte comunitária permanece categoria separada da oficial |
| [ ] | RN-EST-021 | implemented | static | reporte exige expiração futura e listagem ignora expirados |
| [ ] | RN-EST-022 | implemented | automated_test | criação valida associação oficial cadeira/período |
| [ ] | RN-EST-023 | implemented | static | views públicas omitem identidade do avaliador |
| [x] | RN-EST-024 | verified | automated_test | agregado pedagógico exige amostra mínima |
| [x] | RN-EST-025 | verified | automated_test | grant/relação fixam estudante, explicador, cadeira e período |
| [x] | RN-EST-026 | verified | automated_test | wildcard e qualquer campo financeiro são rejeitados |
| [ ] | RN-EST-027 | implemented | integration_test | revogação transacional encerra relação/grants; teste concorrente específico pendente |
| [x] | RN-EST-028 | verified | automated_test | participante só entra após decisão própria |
| [x] | RN-EST-029 | verified | automated_test | retirada é permitida somente antes de `submitted` |
| [x] | RN-EST-030 | verified | automated_test | recurso local só nasce `draft`; submissão oficial é comando separado |
| [x] | RN-EST-031 | verified | integration_test | API não possui checkout/captura/payment intent; somente consulta/referência |
| [x] | RN-EST-032 | verified | automated_test | partilha contém apenas entidade, número, valor, moeda, validade e estado |
| [x] | RN-EST-033 | verified | automated_test | responsável é autorizado por finalidade e não recebe finanças gerais |
| [x] | RN-EST-034 | verified | automated_test | autorização incompleta/wildcard é rejeitada |
| [x] | RN-EST-035 | verified | automated_test | somente o titular cria nova autorização; representante não redelega |
| [x] | RN-EST-036 | verified | automated_test | OTP inclui ator, ação, recurso e contexto |
| [x] | RN-EST-037 | verified | automated_test | expiração, tentativas e reenvios são limitados atomicamente |
| [x] | RN-EST-038 | verified | integration_test | efeito externo só conclui com pós-condição; ambiguidade fica `UNKNOWN` |
| [ ] | RN-EST-039 | implemented | static | templates OTP/admin são minimizados; auditoria automática de todo SMS aguarda capacidade transversal |
| [ ] | RN-EST-040 | implemented | static | anúncio público minimiza contacto e não inclui dados académicos sensíveis |
| [ ] | RN-EST-041 | implemented | integration_test | reserva usa transição condicional; vendido não volta a reservado |
| [x] | RN-EST-042 | verified | automated_test | moderação acessa somente conteúdo comunitário, nunca notas/finanças |
| [ ] | RN-EST-043 | partial | static | UOR Estudante rejeita wildcard; permissões `ALL` ainda existem em módulos legados fora do produto |
| [ ] | RN-EST-044 | implemented | static | UOR Estudante não expõe acesso emergencial; qualquer acesso não modelado falha fechado |
| [ ] | RN-EST-045 | planned | — | read models Direção ausentes |
| [ ] | RN-EST-046 | implemented | automated_test | produto/módulo e finalidade versionada estão no registo de privacidade |
| [x] | RN-EST-047 | verified | automated_test | audit event distingue domínio, ação funcional, recurso, finalidade e trace |
| [x] | RN-EST-048 | verified | integration_test | chaves contextuais impedem duplicação em sync, comandos e notificações |
| [x] | RN-EST-049 | verified | automated_test | `stale` preserva valor e observedAt originais |
| [x] | RN-EST-050 | verified | automated_test | tenant compõe todas as queries UOR Estudante e testes cruzados falham |
| [ ] | RN-EST-051 | implemented | static | relações usam ID interno estável; operação administrativa de correção da matrícula não foi exposta |
| [x] | RN-EST-052 | verified | integration_test | URLs sensíveis do produto usam UUID/ref/cursor opaco + autorização |
| [x] | RN-EST-053 | verified | automated_test | configuração académica possui versão, vigência e histórico |
| [x] | RN-EST-054 | verified | static | cada conclusão desta matriz declara nível de evidência; baseline `4354fa4` |
| [x] | RN-EST-055 | verified | automated_test | validador rejeita checkbox incompatível com estado |
| [x] | RN-EST-056 | verified | integration_test | gateway exige resultado oficial inequívoco/pós-condição |
| [x] | RN-EST-057 | verified | integration_test | erro ambíguo produz `UNKNOWN`; reconciliação é somente leitura |
| [x] | RN-EST-058 | verified | integration_test | referência não altera estado pago; pagamento vem da leitura oficial |
| [x] | RN-EST-059 | verified | integration_test | não existem endpoints de iniciar/cancelar/processar pagamento |
| [x] | RN-EST-060 | verified | integration_test | sessão, desconexão e eliminação têm rotas/efeitos distintos |

## Resumo factual

- RF: 69 `verified`, 22 `implemented`, 2 `partial`, 2 `planned`, 2 `deprecated` e 1 `superseded`.
- RNF: 24 `verified`, 12 `implemented`, 2 `partial`, 4 `planned`, 1 `in_analysis` e 1 `blocked`.
- RN: 47 `verified`, 11 `implemented`, 1 `partial` e 1 `planned`.
- O backend do produto está construído e os gates locais estão verdes. `implemented` não é promovido a `verified` sem a evidência específica exigida.
- Bloqueadores externos explícitos: TLS da Secretaria, contratos upstream ainda não observados em estados elegíveis e ensaio real de restore PostgreSQL.

Este resumo deve ser recalculado por validação automática; não possui precedência sobre as linhas individuais.
