# Backend completo da UOR Estudante

```yaml
document_id: SPEC-UOR-EST-BACKEND-001
status: proposed
owner: Engenharia UOR Estudante
authority: informative
version: 1.0
created_at: 2026-07-22
approved_by:
approved_at:
review_cycle: por onda de implementação ou alteração normativa
next_review: conclusão da fundação backend
depends_on:
  - ../../vision/uor-connect-v2/SDD-000-ECOSSISTEMA-UOR-CONNECT.md
  - ../../vision/uor-connect-v2/SDD-002-UOR-ESTUDANTE.md
  - ../../vision/uor-connect-v2/SDD-005-CAPACIDADES-TRANSVERSAIS.md
  - ../../vision/uor-connect-v2/requirements/UOR-ESTUDANTE-RF-RNF-REGRAS-NEGOCIO.md
  - ../../vision/uor-connect-v2/requirements/UOR-ESTUDANTE-MATRIZ-RASTREABILIDADE.md
```

## 1. Objetivo

Construir, como uma missão contínua, todo o backend da UOR Estudante definido por `SDD-002`, pelos requisitos `RF-EST-001..098`, `RNF-EST-001..044` e pelas regras `RN-EST-001..060`.

O trabalho será entregue em ondas internas verificáveis, mas não será tratado como projetos independentes. Cada onda mantém o backend executável, aplica migrações compatíveis, preserva o último dado válido e atualiza a rastreabilidade de forma conservadora.

O frontend não faz parte desta especificação. Serão fornecidos contratos prontos para consumo posterior.

## 2. Autoridade e decisões já aprovadas

- UOR Connect permanece o ecossistema; UOR Estudante é o produto proprietário da jornada académica individual.
- O backend continua num monólito modular. Separação lógica precede separação física.
- Secretaria e Moodle são provedores isolados. O domínio não conhece HTML, cookies, URLs ou IDs upstream.
- A UOR Estudante não processa dinheiro.
- A página e os consumidores leem snapshots/read models; nunca iniciam sincronização durante uma leitura.
- A sincronização é automática no backend. Não depende de botão.
- O login institucional usa número de estudante e senha da Secretaria.
- Após a autenticação na Secretaria, o backend guarda as credenciais da Secretaria e do Moodle em envelopes cifrados separados.
- O primeiro acesso ao Moodle usa o número de estudante e a senha padrão `Est.2026`.
- Se a senha Moodle tiver sido alterada, existe fluxo autenticado para fornecer e guardar a senha atual.
- Falha no Moodle não impede o login UOR Estudante. O estado fica parcial e acionável.
- `[x]` continua reservado exclusivamente a `verified`.

## 3. Limites do sistema

### 3.1 Produto

O produto será implementado em `backend/src/modules/uor-student`, dividido por capacidades. Este módulo é proprietário de regras, derivados, simulações, autorizações académicas, comunidade, mercado e read models da UOR Estudante.

### 3.2 Provedores

`backend/src/modules/secretaria` e `backend/src/modules/moodle` continuam proprietários de transporte, sessão upstream, parsing, normalização inicial e snapshots do respetivo provedor. Expõem portas internas estáveis ao produto.

### 3.3 Capacidades transversais

Autenticação UOR, cookies, criptografia, auditoria técnica, OTP, notificações, ficheiros e observabilidade são mecanismos UOR Connect. A UOR Estudante fornece finalidade, recurso, dados, validade e significado funcional.

### 3.4 Outros produtos

UOR Eventos não fornece notas, rankings académicos, agenda académica ou perfis de explicador. UOR Direção não consulta tabelas privadas; recebe apenas read models autorizados e agregados.

## 4. Estrutura modular

```text
uor-student/
├── identity/          perfil institucional, preferências, exportação e eliminação
├── integrations/      composição das portas Secretaria/Moodle e saúde
├── sync/              orquestração automática, leases, backoff e publicação
├── today/             projeção de prioridades e estado atual
├── academics/         catálogo, inscrições, notas, médias e regras versionadas
├── curriculum/        créditos, precedências, estados e previsão
├── rankings/          participação, posição, percentil, cobertura e privacidade
├── history/           alterações, alertas e supressão de duplicados
├── agenda/            agenda unificada, eventos pessoais e conflitos
├── teaching/          docentes e avaliações pedagógicas
├── tutoring/          explicadores, relação, grants, planos, tarefas e sessões
├── representation/    recursos e pedidos coletivos
├── finance/           visão financeira, referências, partilhas e responsáveis
├── authorizations/    grants contextuais, decisão, revogação e caixa
├── marketplace/       anúncios, pesquisa, reserva, venda e moderação
├── administration/    configuração exclusiva do produto
└── public-read-models/ contratos autorizados para UOR Direção
```

Cada capacidade segue `domain`, `application`, `infra` e `http` quando essas camadas forem necessárias. Domínio não importa Fastify, Prisma, gateway ou adaptador.

## 5. Autenticação e ligação automática

### 5.1 Login

O fluxo existente `POST /auth/login` permanece o ponto de entrada e recebe origem `uor_estudante`. A Secretaria valida a identidade antes de criar a sessão UOR. O token/cookie inclui identidade interna e contexto institucional suficiente; número académico isolado não autoriza acesso.

Após sucesso:

1. persistir/atualizar a ligação Secretaria com credencial e sessão cifradas;
2. persistir a credencial Moodle padrão em envelope próprio;
3. criar tentativas idempotentes de autenticação e sincronização dos dois provedores;
4. devolver a sessão UOR sem aguardar o Moodle ou a sincronização integral;
5. registar auditoria sem senha, cookie ou detalhe upstream.

Falha na Secretaria impede o login. Falha no Moodle produz `credentials_required`, `unavailable`, `failed` ou `stale`, sem invalidar a sessão UOR.

### 5.2 Recuperação Moodle

`PUT /api/v1/student/providers/moodle/credentials` aceita a senha atual, exige sessão UOR e CSRF, valida a identidade Moodle contra o perfil institucional, substitui o envelope por geração e agenda nova sincronização. A senha nunca é devolvida.

### 5.3 Proteção dos segredos

- AES-256-GCM com AAD que contém versão, finalidade, instituição, estudante e geração.
- Envelopes distintos para credencial, sessão, locator/payload e resultado sensível.
- Chaves fora da base e do repositório; formato com `keyId` e rotação na leitura.
- Plaintext existe apenas durante autenticação/renovação e tem referências libertadas imediatamente.
- Redação central cobre nomes de campos, headers, formulários, erros e estruturas aninhadas.

## 6. Sincronização automática

### 6.1 Gatilhos

- login UOR Estudante concluído;
- nova credencial de provedor;
- snapshot inexistente;
- TTL do domínio expirado;
- retry devido após falha transitória;
- reconciliação de comando externo;
- agenda periódica do worker.

Não existe sincronização iniciada por renderização. O produto não terá botão de sincronização. Endpoints técnicos existentes dos adaptadores permanecem compatíveis, mas o fluxo canónico é o orquestrador automático.

### 6.2 Política inicial configurável

- sessão/saúde: validação por necessidade com cache L1 curto;
- agenda, exames e atividades Moodle: 30 minutos;
- notas, faltas e presenças: 2 horas;
- finanças e referências: 6 horas;
- perfil, inscrições, currículo e catálogo: 24 horas.

Os valores são configuração operacional e podem usar jitter. Falhas aplicam backoff exponencial limitado; autenticação inválida não entra em retry infinito.

### 6.3 Execução

Um worker embutido reclama jobs por lease durável, heartbeat e fence de geração. A chave idempotente combina estudante, instituição, provedor, domínio, janela de frescura e motivo. Execuções concorrentes são reutilizadas ou rejeitadas.

Cada provedor publica o próprio snapshot atomicamente. Uma falha não cancela o snapshot válido do outro. Respostas inválidas são rejeitadas antes da publicação. O último snapshot válido mantém momento e valor originais e recebe `stale`.

### 6.4 Estado

O produto expõe estado consultável, mas não comando manual:

- `GET /api/v1/student/providers`
- `GET /api/v1/student/sync`
- `GET /api/v1/student/sync/:runId`

Estados de run: `queued`, `running`, `partial`, `completed`, `failed`, `cancelled`. Cada domínio informa cobertura, contadores, início, fim e erro seguro.

## 7. Contratos públicos

Todos os novos contratos usam `/api/v1/student`, Zod e envelope `{ data, meta }`. `meta` contém `traceId`, `product`, `source`, `observedAt`, `coverage` e `stale` quando aplicável.

### 7.1 Fundação

- `/session`, `/me`, `/profile`, `/privacy`, `/data-exports`, `/data-deletion-requests`
- `/providers`, `/sync`, `/today`

### 7.2 Académico

- `/academic/periods`, `/subjects`, `/enrollments`, `/grades`, `/summaries`
- `/academic-rules`, `/averages`, `/simulations`, `/required-grades`, `/scholarship-scenarios`
- `/curriculum`, `/curriculum/prerequisites`, `/completion-estimates`
- `/rankings/participation`, `/rankings/me`
- `/changes`, `/alerts`, `/agenda`, `/personal-events`, `/schedule`, `/exams`, `/attendance`

### 7.3 Apoio e representação

- `/teachers`, `/teaching-evaluations`, `/teaching-reports`
- `/tutors`, `/tutoring-requests`, `/tutoring-relationships`, `/study-plans`
- `/appeals`, `/collective-requests`

### 7.4 Financeiro e autorização

- `/finance/overview`, `/tuition`, `/debts`, `/charges`, `/references`, `/payments`, `/receipts`
- `/finance/reference-shares`, `/finance/responsible-links`
- `/authorizations`, `/authorizations/inbox`, `/otp-challenges`

### 7.5 Mercado e administração

- `/market/listings`, `/market/reservations`, `/market/reports`
- `/admin/configuration`, `/admin/moderation`

Listas usam paginação cursor-based e limites máximos. IDs públicos são UUIDs ou referências opacas específicas da finalidade.

## 8. Modelo académico

### 8.1 Proveniência

Todo facto normalizado inclui instituição, período, fonte, estado semântico, cobertura, observação e transformação. Valores oficiais da Secretaria nunca são substituídos por Moodle, cálculo ou comunidade.

### 8.2 Regras versionadas

`AcademicRuleSet` e `AcademicRuleVersion` guardam âmbito, vigência, fórmula, parâmetros, fonte da decisão e estado de aprovação. Cálculos persistem a versão e as entradas utilizadas.

Enquanto regras oficiais estiverem ausentes:

- aprovação/dispensa só calculam com configuração explícita;
- bolsa 16 é hipótese identificada, nunca regra oficial;
- resultados impossíveis retornam lacunas, não números inventados.

### 8.3 Médias e simulações

O motor usa decimal exato, política explícita de arredondamento e unidades elegíveis. Simulações vivem em namespace próprio e não alteram snapshots oficiais. Resultados são reproduzíveis e explicam fórmula, versão, entradas ignoradas e motivos.

### 8.4 Rankings

Ranking exige participação elegível, contexto institucional/curso/turma/unidade/período compatível, amostra e cobertura. A API retorna somente posição/percentil do titular e agregados não inferíveis. Abaixo do limiar configurado retorna `insufficient_sample`.

### 8.5 Currículo

Nós curriculares representam unidades e estados; arestas representam precedências. Créditos ausentes permanecem nulos. Previsão de conclusão é estimada e inclui método, pressupostos e incerteza.

## 9. Histórico, agenda e prioridades

Snapshots publicados são comparados por chaves estáveis. Alterações guardam antes, depois, fonte, deteção, confirmação e hash de deduplicação.

A agenda unifica Secretaria, Moodle e eventos pessoais sem perder origem. Conflitos e sobrecarga são cálculos explicáveis, nunca decisões oficiais.

`GET /today` lê somente dados locais e produz blocos independentes de identidade, prioridades, académico, Moodle, finanças, agenda e provedores. Ausência retorna `null` com cobertura; falha de um bloco não derruba os restantes.

## 10. Docentes, explicadores e representação

Avaliação pedagógica exige associação comprovada à unidade/período, uma submissão conforme política, anonimato público, limiar de agregação e moderação auditada.

A relação de explicador é `estudante + explicador + unidade + período`. Grants listam campos, finalidade e validade; finanças são incompatíveis com este tipo de relação. Revogação impede novos acessos imediatamente.

Recursos começam como rascunhos locais. Estado `submitted` só existe após confirmação externa verificável. Pedidos coletivos armazenam conteúdo integral e exigem decisão individual; retirada antes da submissão atualiza composição e auditoria.

## 11. Finanças, responsáveis e autorizações

Finanças oficiais vêm exclusivamente da Secretaria. Referência disponível não significa pagamento. Partilha cria um recurso mínimo com entidade, referência, montante, validade, finalidade, destinatário e expiração; não entrega o restante quadro financeiro.

Responsável financeiro exige vínculo confirmado, finalidade, dados, prazo e revogação. Não existe acesso geral.

Autorizações têm titular, representante, produto, finalidade, ação, recurso, campos, início, expiração, usos e estado. Estados: `pending`, `approved`, `rejected`, `active`, `used`, `expired`, `cancelled`.

OTP é um mecanismo transversal ligado ao ator, autorização, ação, recurso, contexto hash, expiração e contador atómico. Hash do código é armazenado; plaintext não é persistido. Reenvios e tentativas possuem limites. Notificações não incluem nota, dívida completa, senha ou código reutilizável.

## 12. Mercado e comunidade

Anúncios pertencem a perfil institucional ativo, possuem categoria, curso opcional, preço, estado e dados mínimos de contacto. A máquina de estados impede reservar item vendido ou concluir transições incompatíveis.

Informação comunitária mantém autor protegido, origem `community`, expiração, confirmações e contestações. Nunca substitui silenciosamente o oficial. Moderação não concede acesso a notas ou finanças.

## 13. Persistência e migrações

- PostgreSQL é a semântica de produção e dos testes de concorrência.
- Prisma fica em repositórios de infraestrutura, nunca no domínio ou HTTP.
- Novos modelos usam migrações expand/contract.
- Colunas obrigatórias entram primeiro como opcionais, são preenchidas, validadas e só depois restringidas.
- Backfills são idempotentes, paginados e observáveis.
- Tabelas privadas possuem owner de produto documentado.
- Read models da Direção são fisicamente distintos ou expostos apenas por repositório/contrato dedicado.

Famílias principais: regras académicas, factos normalizados, resultados calculados, currículo, ranking, alterações, agenda, docentes, explicadores, representação, partilha financeira, autorizações, OTP, mercado e configuração de produto.

## 14. Escritas externas

Cada escrita usa comando durável, idempotency key contextual, classificação de risco, confirmação recente, OTP quando exigido, feature flag e circuit breaker próprios.

O worker regista tentativas e evidências. Sucesso exige pós-condição oficial inequívoca. Timeout/erro ambíguo produz `UNKNOWN` ou `VERIFYING`; reconciliação somente lê e nunca repete automaticamente a mutação.

Capacidades cujo contrato ou estado elegível não foi observado permanecem implementáveis atrás de flag, mas não recebem `verified`.

## 15. Segurança e privacidade

- Negação por padrão, ownership, tenant e finalidade em todas as consultas.
- Identidade institucional composta em tokens, repositórios e caches.
- Nenhuma permissão wildcard de acesso completo.
- CSRF para sessão por cookie; rate limit por ator, IP, provedor e ação.
- Erros públicos sem stack ou detalhe upstream.
- Auditoria inclui produto, domínio, ator, recurso opaco, tenant, finalidade, resultado e trace.
- Exportação inclui categorias e proveniência; eliminação respeita retenção e gera resultado auditável.
- Uploads validam assinatura, tamanho, metadados e ownership.
- Acesso emergencial é curto, aprovado, justificado e automaticamente revogado.

## 16. Observabilidade e continuidade

Logs, métricas e traces usam `product=uor_student`, domínio, instituição, provedor, duração, resultado e correlação. Métricas cobrem login, fila, idade de snapshot, drift, parsing, retry, lease, comando, autorização, OTP e acesso negado.

Health checks distinguem vida, prontidão e dependências degradadas. O produto continua a ler snapshots com provedores indisponíveis.

RPO/RTO serão configuração aprovada antes do piloto. Até essa decisão, backups, restore test e runbook são implementados, mas `RNF-EST-039` permanece não verificado.

## 17. Estratégia de testes

### 17.1 Unitários

Regras académicas, médias, arredondamento, simulações, rankings, empates, limiar, currículo, conflitos, autorizações, transições, OTP, mercado e redaction.

### 17.2 Contrato

Zod/OpenAPI, HTML/JSON upstream alterado, campos ausentes, resposta parcial, sessão expirada, content type, tamanho, redirects e fixtures anonimizadas.

### 17.3 Integração

Fastify com aplicações injetadas; Prisma/PostgreSQL para constraints, locks, leases, idempotência, publicação atómica, revogação e concorrência.

### 17.4 Segurança

IDOR/BOLA, mesma matrícula em instituições diferentes, CSRF, tenant, finalidade, revogação, reutilização de OTP, brute force, log scanning e ausência de segredos em contratos.

### 17.5 Resiliência

Provedor indisponível, retry com jitter, crash do worker, reclaim de lease, snapshot inválido, comando ambíguo, rotação de chave e restore.

### 17.6 Desempenho

Consultas cacheadas medem p95, paginação e payload. Jobs medem atraso/fila. Testes do produto verificam que leitura não contacta upstream.

### 17.7 Gates

- typecheck e build;
- testes focados por domínio;
- suite backend completa;
- testes PostgreSQL concorrentes;
- validação documental e matriz;
- scanner de segredos/logs;
- smoke test autorizado quando necessário.

Uma falha preexistente deve ser corrigida ou registada com causa reproduzível; o backend completo não será declarado concluído com regressão crítica conhecida.

## 18. Ondas internas da tarefa única

### Onda 1 — Fundação e sincronização

RF `001..022`, `084`; identidade composta, bootstrap de provedores, worker automático, snapshots locais, `/providers`, `/sync`, `/today`, exportação/eliminação, auditoria e observabilidade de produto.

### Onda 2 — Núcleo académico

RF `023..027`, `037..039`, `041`, `043`, `047..049`, `067..070`, `095..097`; modelo normalizado, notas, médias, currículo, histórico, agenda e consolidação das leituras financeiras.

### Onda 3 — Inteligência e rankings

RF `028..036`, `040`, `042`, `045..046`; simulações, regras necessárias, bolsa hipotética, evolução, ranking privado, previsão e sobrecarga.

### Onda 4 — Apoio e representação

RF `050..066`; comunidade académica, docentes, avaliações, explicadores, grants, planos, recursos e pedidos coletivos.

### Onda 5 — Financeiro delegado e autorizações

RF `071..079`; partilha mínima, responsáveis, autorização contextual, caixa, revogação, OTP e notificações.

### Onda 6 — Mercado, administração e escritas externas

RF `080..098`; mercado, configuração isolada e comandos externos permitidos. IDs reservados `087` e `094` continuam deprecated.

### Onda 7 — Hardening e piloto

Fechar RNF e RN sob controlo da equipa, validar fronteiras, performance, CI, segurança, restore, incidentes, documentação e rastreabilidade. Dependências externas permanecem `blocked` ou abaixo de `verified` até existirem evidências reais.

## 19. Critério de conclusão

A missão termina quando:

- todos os RF não reservados têm implementação ou bloqueio externo factual documentado;
- todas as RN possuem teste ou evidência adequada ao seu tipo;
- RNF controláveis pela equipa estão verificados;
- nenhuma leitura do produto contacta upstream por efeito de renderização;
- autenticação e sincronização automática funcionam com falha parcial Moodle;
- contratos públicos usam IDs opacos, ownership, tenant e finalidade;
- suite backend, concorrência PostgreSQL, segurança e validação documental passam;
- matriz reflete o estado real, com `[x]` somente em `verified`;
- bloqueadores externos — TLS/API oficial, regras académicas institucionais, provedor OTP e RPO/RTO — não são ocultados nem falsamente concluídos.

## 20. Decisões não bloqueantes

- TTLs e limites são configuração operacional com defaults desta especificação.
- Worker embutido é a primeira implantação; a porta permite fila externa futura.
- KMS/cofre externo é o alvo de produção; o formato de envelope permite migração.
- O login pode devolver antes de a sincronização terminar.
- Falha Moodle nunca invalida a sessão autenticada pela Secretaria.
- Fluxos sem contrato upstream verificável permanecem fail-closed.
