# UOR Estudante — RF, RNF e regras de negócio

```yaml
document_id: UOR-EST-REQ-001
status: approved
owner: Produto UOR Estudante
authority: normative
version: 1.4
last_reviewed: 2026-07-22
approved_by: Product Owner
approved_at: 2026-07-21
review_cycle: por fase ou alteração de regra académica
next_review: conclusão da Fase 1
supersedes:
superseded_by:
depends_on:
  - ../SDD-002-UOR-ESTUDANTE.md
  - ../SDD-005-CAPACIDADES-TRANSVERSAIS.md
```

## Convenções

Prioridades: `Must`, `Should`, `Could`. Fases: `F1 Fundação`, `F2 Núcleo`, `F3 Inteligência`, `F4 Apoio`, `F5 Autorizações`, `F6 Comunidade`, `F7 Escrita externa`.

O checkbox deste catálogo espelha o estado factual da [matriz de rastreabilidade](UOR-ESTUDANTE-MATRIZ-RASTREABILIDADE.md): `[x]` significa exclusivamente `verified`; `[ ]` identifica qualquer item ainda não verificado. O estado detalhado, a evidência e as lacunas permanecem na matriz.

## Requisitos funcionais

### Identidade, sessão e perfil

| Check | ID | Requisito | Prioridade | Fase | Critério de aceitação |
| --- | --- | --- | --- | --- | --- |
| [x] | RF-EST-001 | Autenticar estudante por provedor institucional autorizado. | Must | F1 | Credencial válida cria sessão UOR Estudante sem expor segredo upstream. |
| [x] | RF-EST-002 | Identificar perfil por instituição e número académico. | Must | F1 | Dois números iguais em instituições diferentes coexistem sem colisão. |
| [x] | RF-EST-003 | Usar ID interno opaco nas relações e contratos públicos. | Must | F1 | URL/ownership não dependem apenas do número académico. |
| [x] | RF-EST-004 | Consultar o próprio perfil institucional. | Must | F1 | Resposta contém instituição, número, curso, turma, estado e proveniência por campo. |
| [x] | RF-EST-005 | Completar campos pessoais permitidos. | Must | F1 | Campos editáveis não sobrescrevem silenciosamente dados oficiais. |
| [x] | RF-EST-006 | Gerir visibilidade e consentimentos do perfil. | Must | F1 | Alteração é validada, auditada e revogável. |
| [x] | RF-EST-007 | Terminar sessões próprias e externas associadas. | Must | F1 | Logout invalida sessão UOR e remove/revoga envelopes externos aplicáveis. |
| [x] | RF-EST-008 | Solicitar exportação e eliminação dos dados próprios. | Should | F1 | Pedido informa escopo, retenções, estado e resultado auditável. |

### Integrações e sincronização

| Check | ID | Requisito | Prioridade | Fase | Critério de aceitação |
| --- | --- | --- | --- | --- | --- |
| [x] | RF-EST-009 | Ligar uma conta Moodle ao perfil autenticado. | Must | F1 | Sessão cifrada fica associada apenas ao titular. |
| [x] | RF-EST-010 | Desligar a conta Moodle. | Must | F1 | Segredos e sessão são revogados sem apagar histórico sujeito a retenção. |
| [x] | RF-EST-011 | Sincronizar perfil pedagógico do Moodle. | Must | F1 | Perfil contém origem, sincronização, cobertura e estado. |
| [x] | RF-EST-012 | Sincronizar cursos e secções Moodle. | Must | F1 | Snapshot publicado é consistente e pertencente ao estudante. |
| [x] | RF-EST-013 | Sincronizar e abrir materiais Moodle por proxy autorizado. | Must | F1 | Locator upstream não é exposto e ownership é validado. |
| [x] | RF-EST-014 | Iniciar sincronização Moodle assíncrona/idempotente. | Must | F1 | Pedido duplicado não cria publicação concorrente inválida. |
| [x] | RF-EST-015 | Consultar estado e falhas da sincronização Moodle. | Must | F1 | Mostra fase, cobertura, contadores e erro seguro. |
| [x] | RF-EST-016 | Criar sessão isolada com a Secretaria. | Must | F1 | Credencial cria sessão externa cifrada sem permanecer em logs. |
| [x] | RF-EST-017 | Consultar perfil oficial da Secretaria. | Must | F1 | Campos oficiais são normalizados e identificados. |
| [x] | RF-EST-018 | Sincronizar inscrições e contexto académico da Secretaria. | Must | F1 | Ano, período, turma, estado e cadeiras são persistidos com proveniência. |
| [x] | RF-EST-019 | Consultar saúde e cobertura de cada provedor. | Must | F1 | Estado distingue configurado, indisponível, parcial e não sincronizado. |
| [ ] | RF-EST-020 | Executar atualização manual limitada. | Should | F1 | Rate limit, lock e feedback impedem abuso/concorrência. |
| [x] | RF-EST-021 | Apresentar último dado válido quando o provedor falhar. | Must | F1 | Valor anterior permanece com `stale` e data. |
| [x] | RF-EST-022 | Detetar alteração inesperada do contrato upstream. | Must | F1 | Snapshot inválido é rejeitado e gera alerta técnico. |

### Vida académica e desempenho

| Check | ID | Requisito | Prioridade | Fase | Critério de aceitação |
| --- | --- | --- | --- | --- | --- |
| [x] | RF-EST-023 | Consultar unidades curriculares e inscrições oficiais. | Must | F2 | Lista filtra período e mostra estado/origem. |
| [x] | RF-EST-024 | Consultar notas oficiais por avaliação e cadeira. | Must | F2 | Nota não disponível permanece nula, nunca zero fabricado. |
| [ ] | RF-EST-025 | Consultar resumo académico por período. | Must | F2 | Resumo separa valores oficiais e calculados. |
| [x] | RF-EST-026 | Calcular média por unidade curricular. | Must | F2 | Fórmula/versionamento e entradas ficam visíveis. |
| [x] | RF-EST-027 | Calcular média geral e por período. | Must | F2 | Resultado reproduzível usa apenas entradas elegíveis. |
| [x] | RF-EST-028 | Simular notas futuras sem alterar dado oficial. | Must | F3 | Cenário é isolado, editável e identificado como estimativa. |
| [x] | RF-EST-029 | Calcular nota necessária para aprovação. | Must | F3 | Regra aplicável e lacunas são apresentadas. |
| [ ] | RF-EST-030 | Calcular nota necessária para dispensa. | Should | F3 | Só opera quando regra institucional configurada. |
| [ ] | RF-EST-031 | Simular média necessária para bolsa. | Should | F3 | Resultado indica hipótese/regra e não promete elegibilidade. |
| [x] | RF-EST-032 | Mostrar evolução temporal de desempenho. | Should | F3 | Série preserva período, fonte e mudanças. |

### Rankings e percurso curricular

| Check | ID | Requisito | Prioridade | Fase | Critério de aceitação |
| --- | --- | --- | --- | --- | --- |
| [x] | RF-EST-033 | Participar em rankings académicos mediante política aplicável. | Should | F2 | Participação/retirada recalcula agregações necessárias. |
| [x] | RF-EST-034 | Consultar posição e percentil privados. | Should | F2 | Mostra amostra, cobertura, período e atualização sem nomes de terceiros. |
| [x] | RF-EST-035 | Filtrar ranking por contexto compatível. | Should | F2 | Instituição, curso, turma, cadeira e período não são misturados indevidamente. |
| [x] | RF-EST-036 | Ocultar ranking abaixo do limiar de privacidade. | Must | F2 | API/UI não revelam resultado inferível. |
| [x] | RF-EST-037 | Visualizar mapa curricular. | Must | F2 | Distingue concluída, atual, pendente, reprovada e bloqueada. |
| [x] | RF-EST-038 | Consultar créditos e percentagem de conclusão. | Should | F2 | Valores ausentes não são estimados como oficiais. |
| [x] | RF-EST-039 | Visualizar precedências entre unidades curriculares. | Should | F2 | Bloqueios e dependências são explicáveis. |
| [x] | RF-EST-040 | Estimar data/período de conclusão. | Should | F3 | Exibe método, pressupostos e incerteza. |

### Histórico, agenda e assiduidade

| Check | ID | Requisito | Prioridade | Fase | Critério de aceitação |
| --- | --- | --- | --- | --- | --- |
| [x] | RF-EST-041 | Consultar histórico de alterações sincronizadas. | Must | F2 | Cada entrada tem antes, depois, fonte e deteção. |
| [x] | RF-EST-042 | Receber alerta configurável para alteração relevante. | Should | F3 | Duplicações são suprimidas e preferência respeitada. |
| [x] | RF-EST-043 | Consultar agenda académica unificada. | Must | F2 | Combina fontes sem perder proveniência. |
| [x] | RF-EST-044 | Criar eventos e lembretes pessoais. | Should | F2 | Evento privado pertence ao titular e pode ser removido. |
| [x] | RF-EST-045 | Detetar conflitos de horário. | Should | F3 | Conflito identifica itens, fontes e intervalo. |
| [x] | RF-EST-046 | Detetar períodos de sobrecarga. | Should | F3 | Resultado é recomendação explicável, não decisão oficial. |
| [x] | RF-EST-047 | Consultar horário e alterações oficiais. | Must | F2 | Mostra período, sala, docente, atualização e estado. |
| [x] | RF-EST-048 | Consultar exames e épocas. | Must | F2 | Mostra cadeira, data, local, época e origem. |
| [x] | RF-EST-049 | Consultar faltas e presenças. | Must | F2 | Ausência de sincronização não é mostrada como zero. |

### Comunidade, docentes e explicadores

| Check | ID | Requisito | Prioridade | Fase | Critério de aceitação |
| --- | --- | --- | --- | --- | --- |
| [x] | RF-EST-050 | Reportar alteração comunitária de horário/aula. | Could | F6 | Reporte contém contexto, autor protegido e expiração. |
| [x] | RF-EST-051 | Confirmar ou contestar informação comunitária. | Could | F6 | Estado reflete confirmações independentes e contestação. |
| [ ] | RF-EST-052 | Consultar docente associado à cadeira/período. | Should | F4 | Associação exibe origem e período. |
| [x] | RF-EST-053 | Avaliar experiência pedagógica elegível. | Should | F4 | Só estudante associado avalia uma vez conforme política. |
| [x] | RF-EST-054 | Consultar avaliação agregada de docente/cadeira. | Could | F4 | Limiar e anonimato são aplicados. |
| [x] | RF-EST-055 | Denunciar comentário pedagógico inadequado. | Must | F4 | Denúncia entra em fila de moderação auditada. |
| [ ] | RF-EST-056 | Criar perfil de explicador por cadeira. | Should | F4 | Validação e disponibilidade são registadas. |
| [ ] | RF-EST-057 | Pesquisar explicadores por cadeira e disponibilidade. | Should | F4 | Resultado minimiza dados e respeita estado ativo. |
| [x] | RF-EST-058 | Solicitar e aceitar acompanhamento. | Should | F4 | Relação só ativa após aceitação/condições. |
| [x] | RF-EST-059 | Conceder acesso granular ao explicador. | Must | F4 | Escopo é cadeira, dados, período e validade. |
| [ ] | RF-EST-060 | Gerir plano, tarefas e sessões de estudo. | Should | F4 | Ações pertencem à relação e são auditáveis. |
| [x] | RF-EST-061 | Revogar acompanhamento e acessos. | Must | F4 | Novos acessos cessam imediatamente. |

### Recursos, representação e finanças

| Check | ID | Requisito | Prioridade | Fase | Critério de aceitação |
| --- | --- | --- | --- | --- | --- |
| [x] | RF-EST-062 | Preparar recurso/revisão de nota. | Should | F5 | Rascunho não é apresentado como submetido externamente. |
| [ ] | RF-EST-063 | Acompanhar estado e histórico de recurso. | Should | F5 | Estado identifica origem e confirmação. |
| [x] | RF-EST-064 | Criar pedido coletivo contextual. | Could | F6 | Conteúdo, cadeira, período e criador ficam registados. |
| [x] | RF-EST-065 | Aprovar/rejeitar participação individual. | Must | F6 | Ninguém é incluído sem ação própria verificável. |
| [x] | RF-EST-066 | Retirar participação antes da submissão. | Must | F6 | Retirada atualiza composição e auditoria. |
| [x] | RF-EST-067 | Consultar resumo financeiro oficial. | Must | F2 | Distingue dívida, cobrança, pagamento, saldo e atualização. |
| [x] | RF-EST-068 | Consultar propinas, vencimentos e dívidas. | Must | F2 | Valores usam moeda, estado e fonte oficiais. |
| [x] | RF-EST-069 | Consultar referências de pagamento. | Must | F2 | Referência exibe validade e estado sem processar dinheiro. |
| [x] | RF-EST-070 | Consultar histórico/estado de pagamentos. | Should | F2 | Pagamento só é concluído após confirmação oficial. |
| [x] | RF-EST-071 | Partilhar referência com pessoa autorizada. | Should | F5 | Partilha não concede visão financeira total. |
| [x] | RF-EST-072 | Associar responsável a finalidade financeira. | Should | F5 | Associação exige confirmação, escopo e revogação. |

### Autorizações, OTP, notificações e mercado

| Check | ID | Requisito | Prioridade | Fase | Critério de aceitação |
| --- | --- | --- | --- | --- | --- |
| [x] | RF-EST-073 | Criar autorização específica entre utilizadores. | Must | F5 | Regista titular, representante, ação, recurso, dados, validade e usos. |
| [x] | RF-EST-074 | Aprovar ou rejeitar autorização. | Must | F5 | Decisão é autenticada, contextual e auditada. |
| [x] | RF-EST-075 | Consultar caixa de autorizações. | Must | F5 | Separa recebidas, enviadas, ativas, usadas, expiradas e canceladas. |
| [x] | RF-EST-076 | Revogar autorização ainda utilizável. | Must | F5 | Revogação impede novo uso e notifica partes. |
| [x] | RF-EST-077 | Confirmar operação sensível por OTP contextual. | Must | F5 | OTP não funciona para outra ação, ator, recurso ou prazo. |
| [x] | RF-EST-078 | Limitar tentativas e reenvios de OTP. | Must | F5 | Abuso gera bloqueio temporário e auditoria. |
| [x] | RF-EST-079 | Notificar partes sobre ciclo da autorização. | Should | F5 | Conteúdo minimizado e preferência/canal respeitados. |
| [x] | RF-EST-080 | Publicar anúncio no mercado académico. | Could | F6 | Anúncio validado pertence a perfil institucional ativo. |
| [ ] | RF-EST-081 | Pesquisar e filtrar materiais. | Could | F6 | Filtros por categoria, curso, preço e estado funcionam. |
| [x] | RF-EST-082 | Contactar, reservar e marcar item como vendido. | Could | F6 | Estado impede reservas/vendas incompatíveis. |
| [x] | RF-EST-083 | Denunciar e moderar anúncio. | Must | F6 | Denúncia possui estado, decisão e auditoria. |
| [x] | RF-EST-084 | Administrar configurações exclusivas da UOR Estudante. | Must | F1 | Permissões não concedem acesso automático a Eventos/Direção. |

### Integração Secretaria — escritas controladas

| Check | ID | Requisito | Prioridade | Fase | Critério de aceitação |
| --- | --- | --- | --- | --- | --- |
| [ ] | RF-EST-085 | Atualizar contactos explicitamente editáveis na Secretaria. | Should | F7 | Só campos confirmados entram no patch; o formulário restante é preservado e a aceitação oficial do pedido é registada sem assumir aplicação imediata. |
| [ ] | RF-EST-086 | Atualizar ou remover fotografia quando suportado. | Should | F7 | JPEG é normalizado, cifrado e submetido por comando; remoção só existe quando o portal expuser contrato verificável. |
| [ ] | RF-EST-088 | Atualizar consentimentos editáveis do portal. | Must | F7 | Finalidade, versão, decisão e pós-condição oficial ficam registadas. |
| [ ] | RF-EST-089 | Criar ou cancelar inscrição em época quando permitido. | Must | F7 | Referência pública é opaca, estado/ação elegíveis são validados e a inscrição oficial é relida; criação permanece indisponível sem contrato observado numa janela ativa. |
| [ ] | RF-EST-090 | Preparar e submeter cópia de prova, revisão ou reapreciação oficial sem anexos. | Should | F7 | A ação elegível é relida, rascunho e confirmação são distintos e o pedido oficial recebe estado verificável. |
| [ ] | RF-EST-091 | Gerir candidatura enquanto oficialmente editável. | Should | F7 | Transições fora do estado permitido são rejeitadas. |
| [ ] | RF-EST-092 | Gerir formações, estágios, atividades e competências aprovadas. | Could | F7 | Cada capacidade possui contrato, flag e pós-condição próprios. |
| [x] | RF-EST-093 | Gerar ou extrair referência oficial de pagamento. | Must | F7 | Comando idempotente exige confirmação e devolve somente referência oficial; não processa pagamento. |
| [x] | RF-EST-095 | Consultar recibos permitidos. | Should | F2 | Conteúdo é entregue por proxy seguro quando o contrato upstream suportar. |
| [x] | RF-EST-096 | Consultar diretório institucional de cursos. | Should | F2 | Lista pública é normalizada sem IDs internos nem código executável. |
| [x] | RF-EST-097 | Obter documento oficial de referência de pagamento. | Must | F7 | PDF é validado por assinatura, limitado, servido por proxy e associado a `chargeRef` opaco do titular. |
| [ ] | RF-EST-098 | Cancelar pedido pendente de alteração cadastral. | Should | F7 | Comando idempotente exige confirmação, precondição e resposta oficial inequívoca. |

### Itens funcionais reservados

| Check | ID | Estado normativo | Motivo |
| --- | --- | --- | --- |
| [ ] | RF-EST-087 | Reservado | Troca de senha não pertence ao produto v1. |
| [ ] | RF-EST-094 | Reservado | Payment intent, checkout e processamento de pagamento não pertencem ao produto v1. |

Os identificadores reservados não são reutilizados nem contam como capacidades a implementar.

## Requisitos não funcionais

| Check | ID | Requisito | Prioridade | Critério de aceitação |
| --- | --- | --- | --- | --- |
| [x] | RNF-EST-001 | Segurança por negação padrão. | Must | Testes negativos cobrem ownership, tenant e finalidade. |
| [x] | RNF-EST-002 | Proteção contra IDOR/BOLA. | Must | IDs de terceiros não autorizam leitura/ação. |
| [x] | RNF-EST-003 | Segredos ausentes de frontend/logs. | Must | Scanner e testes não encontram credencial/cookie/token externo. |
| [x] | RNF-EST-004 | Criptografia de sessões externas. | Must | Persistência contém apenas envelope autenticado. |
| [ ] | RNF-EST-005 | TLS em produção. | Must | Nenhum dado académico usa HTTP público. |
| [x] | RNF-EST-006 | MFA em operações privilegiadas. | Must | Direção/admin/emergência exigem segundo fator. |
| [ ] | RNF-EST-007 | Rate limiting contextual. | Must | Limites por identidade, IP e provedor são observáveis. |
| [x] | RNF-EST-008 | Redação automática de logs. | Must | Campos sensíveis são removidos antes de persistência. |
| [x] | RNF-EST-009 | Auditoria íntegra e correlacionada. | Must | Ação crítica possui ator, recurso, resultado e trace. |
| [x] | RNF-EST-010 | Minimização e finalidade. | Must | Cada acesso sensível declara campos e finalidade necessários. |
| [x] | RNF-EST-011 | Retenção e eliminação definidas. | Must | Política por categoria é aplicável e testável. |
| [x] | RNF-EST-012 | Privacidade dos rankings. | Must | Limiar e proteção contra inferência são testados. |
| [ ] | RNF-EST-013 | Mobile-first. | Must | Fluxos críticos funcionam a 360 px sem overflow impeditivo. |
| [ ] | RNF-EST-014 | Acessibilidade WCAG 2.2 AA. | Must | Axe + teclado não apresentam violações críticas. |
| [ ] | RNF-EST-015 | Baixo consumo de dados. | Should | Payloads paginados, cacheados e sem recursos supérfluos. |
| [x] | RNF-EST-016 | Tolerância a ligações instáveis. | Must | Retry seguro e estados recuperáveis preservam trabalho. |
| [ ] | RNF-EST-017 | Resposta de leitura em cache p95 ≤ 500 ms. | Should | Métrica por endpoint exclui upstream forçado. |
| [ ] | RNF-EST-018 | Interação principal p75 ≤ 200 ms no cliente. | Should | INP medido nos fluxos prioritários. |
| [ ] | RNF-EST-019 | LCP p75 ≤ 2,5 s em rede móvel-alvo. | Should | Medição real/sintética documentada. |
| [ ] | RNF-EST-020 | CLS p75 ≤ 0,1. | Should | Rotas principais não deslocam conteúdo materialmente. |
| [x] | RNF-EST-021 | Paginação obrigatória. | Must | Listas não retornam conjunto ilimitado. |
| [x] | RNF-EST-022 | Sincronização assíncrona e idempotente. | Must | Retentativa não duplica snapshot/efeito. |
| [x] | RNF-EST-023 | Disponibilidade independente dos provedores. | Must | Último dado/local funciona com upstream indisponível. |
| [x] | RNF-EST-024 | Contratos validados. | Must | Entrada/saída externa falha fechada e observável. |
| [x] | RNF-EST-025 | Observabilidade por produto/domínio. | Must | Logs, métricas e traces permitem filtrar UOR Estudante. |
| [x] | RNF-EST-026 | Alertas de mudança upstream. | Must | Falha de parsing/contrato aciona alerta. |
| [ ] | RNF-EST-027 | Backups cifrados e restauração ensaiada. | Must | Evidência recente do restore existe. |
| [ ] | RNF-EST-028 | Migrações expand/contract. | Must | Mudança incompatível possui janela e rollback. |
| [ ] | RNF-EST-029 | Manutenibilidade modular. | Must | Domínio não importa adaptador/HTTP indevidamente. |
| [x] | RNF-EST-030 | Testes de regras críticas. | Must | Médias, ranking, autorização e OTP possuem testes determinísticos. |
| [x] | RNF-EST-031 | Testes de contrato de provedores. | Must | Fixtures cobrem campos ausentes, HTML alterado e sessão expirada. |
| [x] | RNF-EST-032 | Compatibilidade API versionada. | Must | Breaking change exige nova versão/depreciação. |
| [x] | RNF-EST-033 | IDs públicos opacos. | Must | Contratos não expõem chaves sequenciais sensíveis. |
| [x] | RNF-EST-034 | Isolamento multi-instituição. | Must | Teste impede leitura cruzada com número igual. |
| [x] | RNF-EST-035 | Qualidade e proveniência. | Must | Resposta externa informa source/syncedAt/coverage/stale. |
| [ ] | RNF-EST-036 | Internacionalização de datas/moeda. | Should | Datas têm timezone; valores têm moeda/formatação local. |
| [x] | RNF-EST-037 | Operação sem microserviços prematuros. | Must | Separação lógica é demonstrável antes da física. |
| [x] | RNF-EST-038 | CI bloqueia regressões críticas. | Must | Typecheck, testes focados e validação documental são gates. |
| [ ] | RNF-EST-039 | RPO/RTO definidos antes do piloto. | Must | Valores aprovados e ensaio documentado. |
| [ ] | RNF-EST-040 | Resposta segura a incidentes. | Must | Runbook inclui contenção, rotação, comunicação e evidência. |
| [x] | RNF-EST-041 | Escrita externa como comando idempotente, auditável e reconciliável. | Must | Payload igual devolve o mesmo comando; resultado ambíguo não é reenviado automaticamente. |
| [x] | RNF-EST-042 | Autenticação reforçada proporcional ao risco. | Must | Confirmação recente e OTP são exigidos quando a classificação da operação determinar. |
| [x] | RNF-EST-043 | Isolamento por feature flag, contrato e circuit breaker. | Must | Drift ou falha de uma escrita não ativa nem derruba capacidades independentes. |
| [ ] | RNF-EST-044 | Credencial reversível protegida por gestão externa de chaves. | Must | Envelope autenticado usa finalidade/AAD e permite rotação sem expor plaintext. |

## Regras de negócio

| Check | ID | Regra | Prioridade | Verificação |
| --- | --- | --- | --- | --- |
| [x] | RN-EST-001 | A identidade institucional única é `institution_id + student_number`. | Must | Colisão interinstitucional é permitida; intrainstitucional é rejeitada. |
| [x] | RN-EST-002 | Número académico isolado não autoriza nem identifica globalmente. | Must | Ownership usa ID opaco + instituição. |
| [x] | RN-EST-003 | Cada campo sincronizado mantém fonte e atualização. | Must | Campo sem origem não é apresentado como oficial. |
| [x] | RN-EST-004 | Nota oficial provém apenas da Secretaria. | Must | Moodle/cálculo nunca recebe etiqueta oficial. |
| [x] | RN-EST-005 | Finanças académicas oficiais provêm apenas da Secretaria. | Must | Valor interno estimado é rotulado separadamente. |
| [x] | RN-EST-006 | Falha/ausência nunca vira zero. | Must | `null` + coverage/estado é utilizado. |
| [x] | RN-EST-007 | Último snapshot válido não é substituído por resposta inválida. | Must | Publicação é atómica. |
| [x] | RN-EST-008 | Sincronização não ocorre a cada renderização. | Must | TTL, ação manual ou job governa atualização. |
| [x] | RN-EST-009 | Só o titular liga/desliga o seu provedor. | Must | Ownership é validado no servidor. |
| [x] | RN-EST-010 | Escrita externa permanece desativada até autorização institucional. | Must | Feature flag/contrato impede submissão. |
| [x] | RN-EST-011 | Cálculo académico usa regra identificada e versionada. | Must | Resultado guarda regra e entradas. |
| [x] | RN-EST-012 | Média de bolsa 16 é hipótese configurável até confirmação. | Must | UI não a chama regra oficial sem aprovação. |
| [x] | RN-EST-013 | Simulação nunca altera nota oficial. | Must | Cenário usa armazenamento/namespace próprio. |
| [x] | RN-EST-014 | Ranking usa apenas participantes elegíveis e contexto compatível. | Must | Curso/turma/período são filtros obrigatórios. |
| [x] | RN-EST-015 | Ranking mostra cobertura e tamanho da amostra. | Must | Resposta sem ambos é inválida. |
| [x] | RN-EST-016 | Ranking não expõe nome ou nota individual de colega. | Must | API retorna apenas posição/agregados do titular. |
| [x] | RN-EST-017 | Limiar mínimo impede publicação inferível. | Must | Grupo pequeno retorna `insufficient_sample`. |
| [x] | RN-EST-018 | Retirada de participação atualiza agregações necessárias. | Must | Estudante deixa de contribuir conforme política. |
| [x] | RN-EST-019 | Previsão curricular é sempre estimativa. | Must | Método/pressupostos são apresentados. |
| [x] | RN-EST-020 | Informação comunitária não substitui silenciosamente a oficial. | Must | Ambas permanecem distinguíveis. |
| [x] | RN-EST-021 | Reporte comunitário expira ou é revalidado. | Must | Estado antigo não permanece vigente indefinidamente. |
| [x] | RN-EST-022 | Avaliação pedagógica exige associação à cadeira/período. | Must | Não elegível recebe negação. |
| [x] | RN-EST-023 | Identidade pública do avaliador é protegida. | Must | Resultado e comentário não expõem autor. |
| [x] | RN-EST-024 | Resultado pedagógico agregado exige amostra mínima. | Must | Grupo abaixo do limiar fica oculto. |
| [x] | RN-EST-025 | Relação de explicador é `estudante + explicador + cadeira + período`. | Must | Escopo não se propaga a outras cadeiras. |
| [x] | RN-EST-026 | Explicador nunca recebe acesso financeiro por essa relação. | Must | Permissão é incompatível e rejeitada. |
| [x] | RN-EST-027 | Revogação impede novos acessos imediatamente. | Must | Cache/sessão delegada é invalidado. |
| [x] | RN-EST-028 | Pedido coletivo exige aprovação individual informada. | Must | Representante não adiciona participante unilateralmente. |
| [x] | RN-EST-029 | Participante pode retirar-se antes da submissão. | Must | Composição e auditoria são atualizadas. |
| [x] | RN-EST-030 | Rascunho de recurso não equivale a submissão oficial. | Must | Estado/origem são explícitos. |
| [x] | RN-EST-031 | UOR Estudante não processa ou movimenta dinheiro. | Must | Apenas consulta/partilha referência oficial. |
| [x] | RN-EST-032 | Partilhar referência não partilha finanças completas. | Must | Payload contém somente dados autorizados. |
| [x] | RN-EST-033 | Responsável não recebe acesso geral automático. | Must | Cada finalidade exige autorização própria. |
| [x] | RN-EST-034 | Autorização define ação, recurso, dados, validade e usos. | Must | Pedido incompleto é rejeitado. |
| [x] | RN-EST-035 | Autorização não pode ser delegada pelo representante. | Must | Cadeia de delegação é rejeitada salvo nova autorização do titular. |
| [x] | RN-EST-036 | OTP é ligado a operação e contexto concretos. | Must | Reutilização cruzada falha. |
| [x] | RN-EST-037 | OTP expira e possui tentativas/reenvios limitados. | Must | Limites são aplicados atomicamente. |
| [x] | RN-EST-038 | Operação não é concluída sem confirmação verificável. | Must | Estado permanece pendente/desconhecido. |
| [x] | RN-EST-039 | SMS não contém notas, dívida completa ou segredo. | Must | Template e logs são redigidos. |
| [ ] | RN-EST-040 | Mercado expõe apenas dados necessários ao contacto/transação. | Must | Perfil académico sensível permanece privado. |
| [x] | RN-EST-041 | Anúncio vendido não pode ser reservado novamente. | Must | Transição incompatível é rejeitada. |
| [x] | RN-EST-042 | Moderação não concede acesso automático a notas/finanças. | Must | Papel é limitado a conteúdo comunitário. |
| [ ] | RN-EST-043 | Não existe permissão genérica de acesso completo. | Must | Catálogo rejeita wildcard universal. |
| [ ] | RN-EST-044 | Acesso emergencial é curto, justificado, aprovado e auditado. | Must | Expira/revoga automaticamente. |
| [x] | RN-EST-045 | UOR Direção recebe Estudante somente por read models autorizados. | Must | Não há consulta direta às tabelas privadas. |
| [ ] | RN-EST-046 | Consentimento transversal gere mecanismo; produto define finalidade. | Must | Registo contém produto e finalidade. |
| [x] | RN-EST-047 | Auditoria técnica e significado funcional têm ownership distinto. | Must | Schema identifica produto/evento. |
| [x] | RN-EST-048 | Operação idempotente usa chave contextual única. | Must | Retentativa não duplica efeito. |
| [x] | RN-EST-049 | Estado `stale` preserva valor e data originais. | Must | Não apresenta atualização inexistente. |
| [x] | RN-EST-050 | Dados de instituições diferentes nunca são agregados sem intenção explícita. | Must | Tenant/instituição faz parte da consulta. |
| [x] | RN-EST-051 | Alteração do número académico preserva relações e histórico. | Must | ID interno continua estável. |
| [x] | RN-EST-052 | URLs sensíveis não usam número académico como único localizador. | Must | ID opaco + autorização são obrigatórios. |
| [x] | RN-EST-053 | Configuração académica tem versão e vigência. | Must | Cálculo histórico usa regra do período correto. |
| [x] | RN-EST-054 | Toda conclusão factual da auditoria indica nível de evidência. | Must | Matriz usa vocabulário controlado. |
| [x] | RN-EST-055 | `[x]` significa exclusivamente estado `verified`. | Must | Validador rejeita combinação diferente. |
| [x] | RN-EST-056 | Resposta upstream não prova efeito sem pós-condição. | Must | Comando só termina em sucesso após resultado oficial inequívoco ou reconciliação. |
| [x] | RN-EST-057 | Falha ambígua proíbe repetição automática. | Must | Estado fica `UNKNOWN`/`VERIFYING`; apenas leitura reconciliadora é permitida. |
| [x] | RN-EST-058 | Pagamento só aparece como pago após confirmação oficial. | Must | Referência gerada ou cobrança ausente não implica pagamento. |
| [x] | RN-EST-059 | UOR Estudante não inicia, cancela ou processa pagamentos. | Must | API limita-se a referências, cobranças, estados e recibos oficiais. |
| [x] | RN-EST-060 | Terminar sessão, desligar integração e eliminar dados são intenções distintas. | Must | Cada ação possui rota, confirmação e efeito próprios. |
