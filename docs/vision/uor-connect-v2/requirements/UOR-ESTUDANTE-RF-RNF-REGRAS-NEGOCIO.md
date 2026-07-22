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

O estado de implementação não vive neste catálogo; consultar a [matriz de rastreabilidade](UOR-ESTUDANTE-MATRIZ-RASTREABILIDADE.md).

## Requisitos funcionais

### Identidade, sessão e perfil

| ID | Requisito | Prioridade | Fase | Critério de aceitação |
| --- | --- | --- | --- | --- |
| RF-EST-001 | Autenticar estudante por provedor institucional autorizado. | Must | F1 | Credencial válida cria sessão UOR Estudante sem expor segredo upstream. |
| RF-EST-002 | Identificar perfil por instituição e número académico. | Must | F1 | Dois números iguais em instituições diferentes coexistem sem colisão. |
| RF-EST-003 | Usar ID interno opaco nas relações e contratos públicos. | Must | F1 | URL/ownership não dependem apenas do número académico. |
| RF-EST-004 | Consultar o próprio perfil institucional. | Must | F1 | Resposta contém instituição, número, curso, turma, estado e proveniência por campo. |
| RF-EST-005 | Completar campos pessoais permitidos. | Must | F1 | Campos editáveis não sobrescrevem silenciosamente dados oficiais. |
| RF-EST-006 | Gerir visibilidade e consentimentos do perfil. | Must | F1 | Alteração é validada, auditada e revogável. |
| RF-EST-007 | Terminar sessões próprias e externas associadas. | Must | F1 | Logout invalida sessão UOR e remove/revoga envelopes externos aplicáveis. |
| RF-EST-008 | Solicitar exportação e eliminação dos dados próprios. | Should | F1 | Pedido informa escopo, retenções, estado e resultado auditável. |

### Integrações e sincronização

| ID | Requisito | Prioridade | Fase | Critério de aceitação |
| --- | --- | --- | --- | --- |
| RF-EST-009 | Ligar uma conta Moodle ao perfil autenticado. | Must | F1 | Sessão cifrada fica associada apenas ao titular. |
| RF-EST-010 | Desligar a conta Moodle. | Must | F1 | Segredos e sessão são revogados sem apagar histórico sujeito a retenção. |
| RF-EST-011 | Sincronizar perfil pedagógico do Moodle. | Must | F1 | Perfil contém origem, sincronização, cobertura e estado. |
| RF-EST-012 | Sincronizar cursos e secções Moodle. | Must | F1 | Snapshot publicado é consistente e pertencente ao estudante. |
| RF-EST-013 | Sincronizar e abrir materiais Moodle por proxy autorizado. | Must | F1 | Locator upstream não é exposto e ownership é validado. |
| RF-EST-014 | Iniciar sincronização Moodle assíncrona/idempotente. | Must | F1 | Pedido duplicado não cria publicação concorrente inválida. |
| RF-EST-015 | Consultar estado e falhas da sincronização Moodle. | Must | F1 | Mostra fase, cobertura, contadores e erro seguro. |
| RF-EST-016 | Criar sessão isolada com a Secretaria. | Must | F1 | Credencial cria sessão externa cifrada sem permanecer em logs. |
| RF-EST-017 | Consultar perfil oficial da Secretaria. | Must | F1 | Campos oficiais são normalizados e identificados. |
| RF-EST-018 | Sincronizar inscrições e contexto académico da Secretaria. | Must | F1 | Ano, período, turma, estado e cadeiras são persistidos com proveniência. |
| RF-EST-019 | Consultar saúde e cobertura de cada provedor. | Must | F1 | Estado distingue configurado, indisponível, parcial e não sincronizado. |
| RF-EST-020 | Executar atualização manual limitada. | Should | F1 | Rate limit, lock e feedback impedem abuso/concorrência. |
| RF-EST-021 | Apresentar último dado válido quando o provedor falhar. | Must | F1 | Valor anterior permanece com `stale` e data. |
| RF-EST-022 | Detetar alteração inesperada do contrato upstream. | Must | F1 | Snapshot inválido é rejeitado e gera alerta técnico. |

### Vida académica e desempenho

| ID | Requisito | Prioridade | Fase | Critério de aceitação |
| --- | --- | --- | --- | --- |
| RF-EST-023 | Consultar unidades curriculares e inscrições oficiais. | Must | F2 | Lista filtra período e mostra estado/origem. |
| RF-EST-024 | Consultar notas oficiais por avaliação e cadeira. | Must | F2 | Nota não disponível permanece nula, nunca zero fabricado. |
| RF-EST-025 | Consultar resumo académico por período. | Must | F2 | Resumo separa valores oficiais e calculados. |
| RF-EST-026 | Calcular média por unidade curricular. | Must | F2 | Fórmula/versionamento e entradas ficam visíveis. |
| RF-EST-027 | Calcular média geral e por período. | Must | F2 | Resultado reproduzível usa apenas entradas elegíveis. |
| RF-EST-028 | Simular notas futuras sem alterar dado oficial. | Must | F3 | Cenário é isolado, editável e identificado como estimativa. |
| RF-EST-029 | Calcular nota necessária para aprovação. | Must | F3 | Regra aplicável e lacunas são apresentadas. |
| RF-EST-030 | Calcular nota necessária para dispensa. | Should | F3 | Só opera quando regra institucional configurada. |
| RF-EST-031 | Simular média necessária para bolsa. | Should | F3 | Resultado indica hipótese/regra e não promete elegibilidade. |
| RF-EST-032 | Mostrar evolução temporal de desempenho. | Should | F3 | Série preserva período, fonte e mudanças. |

### Rankings e percurso curricular

| ID | Requisito | Prioridade | Fase | Critério de aceitação |
| --- | --- | --- | --- | --- |
| RF-EST-033 | Participar em rankings académicos mediante política aplicável. | Should | F2 | Participação/retirada recalcula agregações necessárias. |
| RF-EST-034 | Consultar posição e percentil privados. | Should | F2 | Mostra amostra, cobertura, período e atualização sem nomes de terceiros. |
| RF-EST-035 | Filtrar ranking por contexto compatível. | Should | F2 | Instituição, curso, turma, cadeira e período não são misturados indevidamente. |
| RF-EST-036 | Ocultar ranking abaixo do limiar de privacidade. | Must | F2 | API/UI não revelam resultado inferível. |
| RF-EST-037 | Visualizar mapa curricular. | Must | F2 | Distingue concluída, atual, pendente, reprovada e bloqueada. |
| RF-EST-038 | Consultar créditos e percentagem de conclusão. | Should | F2 | Valores ausentes não são estimados como oficiais. |
| RF-EST-039 | Visualizar precedências entre unidades curriculares. | Should | F2 | Bloqueios e dependências são explicáveis. |
| RF-EST-040 | Estimar data/período de conclusão. | Should | F3 | Exibe método, pressupostos e incerteza. |

### Histórico, agenda e assiduidade

| ID | Requisito | Prioridade | Fase | Critério de aceitação |
| --- | --- | --- | --- | --- |
| RF-EST-041 | Consultar histórico de alterações sincronizadas. | Must | F2 | Cada entrada tem antes, depois, fonte e deteção. |
| RF-EST-042 | Receber alerta configurável para alteração relevante. | Should | F3 | Duplicações são suprimidas e preferência respeitada. |
| RF-EST-043 | Consultar agenda académica unificada. | Must | F2 | Combina fontes sem perder proveniência. |
| RF-EST-044 | Criar eventos e lembretes pessoais. | Should | F2 | Evento privado pertence ao titular e pode ser removido. |
| RF-EST-045 | Detetar conflitos de horário. | Should | F3 | Conflito identifica itens, fontes e intervalo. |
| RF-EST-046 | Detetar períodos de sobrecarga. | Should | F3 | Resultado é recomendação explicável, não decisão oficial. |
| RF-EST-047 | Consultar horário e alterações oficiais. | Must | F2 | Mostra período, sala, docente, atualização e estado. |
| RF-EST-048 | Consultar exames e épocas. | Must | F2 | Mostra cadeira, data, local, época e origem. |
| RF-EST-049 | Consultar faltas e presenças. | Must | F2 | Ausência de sincronização não é mostrada como zero. |

### Comunidade, docentes e explicadores

| ID | Requisito | Prioridade | Fase | Critério de aceitação |
| --- | --- | --- | --- | --- |
| RF-EST-050 | Reportar alteração comunitária de horário/aula. | Could | F6 | Reporte contém contexto, autor protegido e expiração. |
| RF-EST-051 | Confirmar ou contestar informação comunitária. | Could | F6 | Estado reflete confirmações independentes e contestação. |
| RF-EST-052 | Consultar docente associado à cadeira/período. | Should | F4 | Associação exibe origem e período. |
| RF-EST-053 | Avaliar experiência pedagógica elegível. | Should | F4 | Só estudante associado avalia uma vez conforme política. |
| RF-EST-054 | Consultar avaliação agregada de docente/cadeira. | Could | F4 | Limiar e anonimato são aplicados. |
| RF-EST-055 | Denunciar comentário pedagógico inadequado. | Must | F4 | Denúncia entra em fila de moderação auditada. |
| RF-EST-056 | Criar perfil de explicador por cadeira. | Should | F4 | Validação e disponibilidade são registadas. |
| RF-EST-057 | Pesquisar explicadores por cadeira e disponibilidade. | Should | F4 | Resultado minimiza dados e respeita estado ativo. |
| RF-EST-058 | Solicitar e aceitar acompanhamento. | Should | F4 | Relação só ativa após aceitação/condições. |
| RF-EST-059 | Conceder acesso granular ao explicador. | Must | F4 | Escopo é cadeira, dados, período e validade. |
| RF-EST-060 | Gerir plano, tarefas e sessões de estudo. | Should | F4 | Ações pertencem à relação e são auditáveis. |
| RF-EST-061 | Revogar acompanhamento e acessos. | Must | F4 | Novos acessos cessam imediatamente. |

### Recursos, representação e finanças

| ID | Requisito | Prioridade | Fase | Critério de aceitação |
| --- | --- | --- | --- | --- |
| RF-EST-062 | Preparar recurso/revisão de nota. | Should | F5 | Rascunho não é apresentado como submetido externamente. |
| RF-EST-063 | Acompanhar estado e histórico de recurso. | Should | F5 | Estado identifica origem e confirmação. |
| RF-EST-064 | Criar pedido coletivo contextual. | Could | F6 | Conteúdo, cadeira, período e criador ficam registados. |
| RF-EST-065 | Aprovar/rejeitar participação individual. | Must | F6 | Ninguém é incluído sem ação própria verificável. |
| RF-EST-066 | Retirar participação antes da submissão. | Must | F6 | Retirada atualiza composição e auditoria. |
| RF-EST-067 | Consultar resumo financeiro oficial. | Must | F2 | Distingue dívida, cobrança, pagamento, saldo e atualização. |
| RF-EST-068 | Consultar propinas, vencimentos e dívidas. | Must | F2 | Valores usam moeda, estado e fonte oficiais. |
| RF-EST-069 | Consultar referências de pagamento. | Must | F2 | Referência exibe validade e estado sem processar dinheiro. |
| RF-EST-070 | Consultar histórico/estado de pagamentos. | Should | F2 | Pagamento só é concluído após confirmação oficial. |
| RF-EST-071 | Partilhar referência com pessoa autorizada. | Should | F5 | Partilha não concede visão financeira total. |
| RF-EST-072 | Associar responsável a finalidade financeira. | Should | F5 | Associação exige confirmação, escopo e revogação. |

### Autorizações, OTP, notificações e mercado

| ID | Requisito | Prioridade | Fase | Critério de aceitação |
| --- | --- | --- | --- | --- |
| RF-EST-073 | Criar autorização específica entre utilizadores. | Must | F5 | Regista titular, representante, ação, recurso, dados, validade e usos. |
| RF-EST-074 | Aprovar ou rejeitar autorização. | Must | F5 | Decisão é autenticada, contextual e auditada. |
| RF-EST-075 | Consultar caixa de autorizações. | Must | F5 | Separa recebidas, enviadas, ativas, usadas, expiradas e canceladas. |
| RF-EST-076 | Revogar autorização ainda utilizável. | Must | F5 | Revogação impede novo uso e notifica partes. |
| RF-EST-077 | Confirmar operação sensível por OTP contextual. | Must | F5 | OTP não funciona para outra ação, ator, recurso ou prazo. |
| RF-EST-078 | Limitar tentativas e reenvios de OTP. | Must | F5 | Abuso gera bloqueio temporário e auditoria. |
| RF-EST-079 | Notificar partes sobre ciclo da autorização. | Should | F5 | Conteúdo minimizado e preferência/canal respeitados. |
| RF-EST-080 | Publicar anúncio no mercado académico. | Could | F6 | Anúncio validado pertence a perfil institucional ativo. |
| RF-EST-081 | Pesquisar e filtrar materiais. | Could | F6 | Filtros por categoria, curso, preço e estado funcionam. |
| RF-EST-082 | Contactar, reservar e marcar item como vendido. | Could | F6 | Estado impede reservas/vendas incompatíveis. |
| RF-EST-083 | Denunciar e moderar anúncio. | Must | F6 | Denúncia possui estado, decisão e auditoria. |
| RF-EST-084 | Administrar configurações exclusivas da UOR Estudante. | Must | F1 | Permissões não concedem acesso automático a Eventos/Direção. |

### Integração Secretaria — escritas controladas

| ID | Requisito | Prioridade | Fase | Critério de aceitação |
| --- | --- | --- | --- | --- |
| RF-EST-085 | Atualizar contactos explicitamente editáveis na Secretaria. | Should | F7 | Só campos confirmados entram no patch; o formulário restante é preservado e a aceitação oficial do pedido é registada sem assumir aplicação imediata. |
| RF-EST-086 | Atualizar ou remover fotografia quando suportado. | Should | F7 | JPEG é normalizado, cifrado e submetido por comando; remoção só existe quando o portal expuser contrato verificável. |
| RF-EST-088 | Atualizar consentimentos editáveis do portal. | Must | F7 | Finalidade, versão, decisão e pós-condição oficial ficam registadas. |
| RF-EST-089 | Criar ou cancelar inscrição em época quando permitido. | Must | F7 | Referência pública é opaca, estado/ação elegíveis são validados e a inscrição oficial é relida; criação permanece indisponível sem contrato observado numa janela ativa. |
| RF-EST-090 | Preparar e submeter revisão oficial de nota sem anexos. | Should | F7 | Rascunho e submissão são distintos; pedido oficial recebe estado verificável. |
| RF-EST-091 | Gerir candidatura enquanto oficialmente editável. | Should | F7 | Transições fora do estado permitido são rejeitadas. |
| RF-EST-092 | Gerir formações, estágios, atividades e competências aprovadas. | Could | F7 | Cada capacidade possui contrato, flag e pós-condição próprios. |
| RF-EST-093 | Gerar ou extrair referência oficial de pagamento. | Must | F7 | Comando idempotente exige confirmação e devolve somente referência oficial; não processa pagamento. |
| RF-EST-095 | Consultar recibos permitidos. | Should | F2 | Conteúdo é entregue por proxy seguro quando o contrato upstream suportar. |

`RF-EST-087` e `RF-EST-094` permanecem reservados e não são reutilizados: troca de senha, payment intent, checkout e processamento de pagamento não pertencem à v1.

## Requisitos não funcionais

| ID | Requisito | Prioridade | Critério de aceitação |
| --- | --- | --- | --- |
| RNF-EST-001 | Segurança por negação padrão. | Must | Testes negativos cobrem ownership, tenant e finalidade. |
| RNF-EST-002 | Proteção contra IDOR/BOLA. | Must | IDs de terceiros não autorizam leitura/ação. |
| RNF-EST-003 | Segredos ausentes de frontend/logs. | Must | Scanner e testes não encontram credencial/cookie/token externo. |
| RNF-EST-004 | Criptografia de sessões externas. | Must | Persistência contém apenas envelope autenticado. |
| RNF-EST-005 | TLS em produção. | Must | Nenhum dado académico usa HTTP público. |
| RNF-EST-006 | MFA em operações privilegiadas. | Must | Direção/admin/emergência exigem segundo fator. |
| RNF-EST-007 | Rate limiting contextual. | Must | Limites por identidade, IP e provedor são observáveis. |
| RNF-EST-008 | Redação automática de logs. | Must | Campos sensíveis são removidos antes de persistência. |
| RNF-EST-009 | Auditoria íntegra e correlacionada. | Must | Ação crítica possui ator, recurso, resultado e trace. |
| RNF-EST-010 | Minimização e finalidade. | Must | Cada acesso sensível declara campos e finalidade necessários. |
| RNF-EST-011 | Retenção e eliminação definidas. | Must | Política por categoria é aplicável e testável. |
| RNF-EST-012 | Privacidade dos rankings. | Must | Limiar e proteção contra inferência são testados. |
| RNF-EST-013 | Mobile-first. | Must | Fluxos críticos funcionam a 360 px sem overflow impeditivo. |
| RNF-EST-014 | Acessibilidade WCAG 2.2 AA. | Must | Axe + teclado não apresentam violações críticas. |
| RNF-EST-015 | Baixo consumo de dados. | Should | Payloads paginados, cacheados e sem recursos supérfluos. |
| RNF-EST-016 | Tolerância a ligações instáveis. | Must | Retry seguro e estados recuperáveis preservam trabalho. |
| RNF-EST-017 | Resposta de leitura em cache p95 ≤ 500 ms. | Should | Métrica por endpoint exclui upstream forçado. |
| RNF-EST-018 | Interação principal p75 ≤ 200 ms no cliente. | Should | INP medido nos fluxos prioritários. |
| RNF-EST-019 | LCP p75 ≤ 2,5 s em rede móvel-alvo. | Should | Medição real/sintética documentada. |
| RNF-EST-020 | CLS p75 ≤ 0,1. | Should | Rotas principais não deslocam conteúdo materialmente. |
| RNF-EST-021 | Paginação obrigatória. | Must | Listas não retornam conjunto ilimitado. |
| RNF-EST-022 | Sincronização assíncrona e idempotente. | Must | Retentativa não duplica snapshot/efeito. |
| RNF-EST-023 | Disponibilidade independente dos provedores. | Must | Último dado/local funciona com upstream indisponível. |
| RNF-EST-024 | Contratos validados. | Must | Entrada/saída externa falha fechada e observável. |
| RNF-EST-025 | Observabilidade por produto/domínio. | Must | Logs, métricas e traces permitem filtrar UOR Estudante. |
| RNF-EST-026 | Alertas de mudança upstream. | Must | Falha de parsing/contrato aciona alerta. |
| RNF-EST-027 | Backups cifrados e restauração ensaiada. | Must | Evidência recente do restore existe. |
| RNF-EST-028 | Migrações expand/contract. | Must | Mudança incompatível possui janela e rollback. |
| RNF-EST-029 | Manutenibilidade modular. | Must | Domínio não importa adaptador/HTTP indevidamente. |
| RNF-EST-030 | Testes de regras críticas. | Must | Médias, ranking, autorização e OTP possuem testes determinísticos. |
| RNF-EST-031 | Testes de contrato de provedores. | Must | Fixtures cobrem campos ausentes, HTML alterado e sessão expirada. |
| RNF-EST-032 | Compatibilidade API versionada. | Must | Breaking change exige nova versão/depreciação. |
| RNF-EST-033 | IDs públicos opacos. | Must | Contratos não expõem chaves sequenciais sensíveis. |
| RNF-EST-034 | Isolamento multi-instituição. | Must | Teste impede leitura cruzada com número igual. |
| RNF-EST-035 | Qualidade e proveniência. | Must | Resposta externa informa source/syncedAt/coverage/stale. |
| RNF-EST-036 | Internacionalização de datas/moeda. | Should | Datas têm timezone; valores têm moeda/formatação local. |
| RNF-EST-037 | Operação sem microserviços prematuros. | Must | Separação lógica é demonstrável antes da física. |
| RNF-EST-038 | CI bloqueia regressões críticas. | Must | Typecheck, testes focados e validação documental são gates. |
| RNF-EST-039 | RPO/RTO definidos antes do piloto. | Must | Valores aprovados e ensaio documentado. |
| RNF-EST-040 | Resposta segura a incidentes. | Must | Runbook inclui contenção, rotação, comunicação e evidência. |
| RNF-EST-041 | Escrita externa como comando idempotente, auditável e reconciliável. | Must | Payload igual devolve o mesmo comando; resultado ambíguo não é reenviado automaticamente. |
| RNF-EST-042 | Autenticação reforçada proporcional ao risco. | Must | Confirmação recente e OTP são exigidos quando a classificação da operação determinar. |
| RNF-EST-043 | Isolamento por feature flag, contrato e circuit breaker. | Must | Drift ou falha de uma escrita não ativa nem derruba capacidades independentes. |
| RNF-EST-044 | Credencial reversível protegida por gestão externa de chaves. | Must | Envelope autenticado usa finalidade/AAD e permite rotação sem expor plaintext. |

## Regras de negócio

| ID | Regra | Prioridade | Verificação |
| --- | --- | --- | --- |
| RN-EST-001 | A identidade institucional única é `institution_id + student_number`. | Must | Colisão interinstitucional é permitida; intrainstitucional é rejeitada. |
| RN-EST-002 | Número académico isolado não autoriza nem identifica globalmente. | Must | Ownership usa ID opaco + instituição. |
| RN-EST-003 | Cada campo sincronizado mantém fonte e atualização. | Must | Campo sem origem não é apresentado como oficial. |
| RN-EST-004 | Nota oficial provém apenas da Secretaria. | Must | Moodle/cálculo nunca recebe etiqueta oficial. |
| RN-EST-005 | Finanças académicas oficiais provêm apenas da Secretaria. | Must | Valor interno estimado é rotulado separadamente. |
| RN-EST-006 | Falha/ausência nunca vira zero. | Must | `null` + coverage/estado é utilizado. |
| RN-EST-007 | Último snapshot válido não é substituído por resposta inválida. | Must | Publicação é atómica. |
| RN-EST-008 | Sincronização não ocorre a cada renderização. | Must | TTL, ação manual ou job governa atualização. |
| RN-EST-009 | Só o titular liga/desliga o seu provedor. | Must | Ownership é validado no servidor. |
| RN-EST-010 | Escrita externa permanece desativada até autorização institucional. | Must | Feature flag/contrato impede submissão. |
| RN-EST-011 | Cálculo académico usa regra identificada e versionada. | Must | Resultado guarda regra e entradas. |
| RN-EST-012 | Média de bolsa 16 é hipótese configurável até confirmação. | Must | UI não a chama regra oficial sem aprovação. |
| RN-EST-013 | Simulação nunca altera nota oficial. | Must | Cenário usa armazenamento/namespace próprio. |
| RN-EST-014 | Ranking usa apenas participantes elegíveis e contexto compatível. | Must | Curso/turma/período são filtros obrigatórios. |
| RN-EST-015 | Ranking mostra cobertura e tamanho da amostra. | Must | Resposta sem ambos é inválida. |
| RN-EST-016 | Ranking não expõe nome ou nota individual de colega. | Must | API retorna apenas posição/agregados do titular. |
| RN-EST-017 | Limiar mínimo impede publicação inferível. | Must | Grupo pequeno retorna `insufficient_sample`. |
| RN-EST-018 | Retirada de participação atualiza agregações necessárias. | Must | Estudante deixa de contribuir conforme política. |
| RN-EST-019 | Previsão curricular é sempre estimativa. | Must | Método/pressupostos são apresentados. |
| RN-EST-020 | Informação comunitária não substitui silenciosamente a oficial. | Must | Ambas permanecem distinguíveis. |
| RN-EST-021 | Reporte comunitário expira ou é revalidado. | Must | Estado antigo não permanece vigente indefinidamente. |
| RN-EST-022 | Avaliação pedagógica exige associação à cadeira/período. | Must | Não elegível recebe negação. |
| RN-EST-023 | Identidade pública do avaliador é protegida. | Must | Resultado e comentário não expõem autor. |
| RN-EST-024 | Resultado pedagógico agregado exige amostra mínima. | Must | Grupo abaixo do limiar fica oculto. |
| RN-EST-025 | Relação de explicador é `estudante + explicador + cadeira + período`. | Must | Escopo não se propaga a outras cadeiras. |
| RN-EST-026 | Explicador nunca recebe acesso financeiro por essa relação. | Must | Permissão é incompatível e rejeitada. |
| RN-EST-027 | Revogação impede novos acessos imediatamente. | Must | Cache/sessão delegada é invalidado. |
| RN-EST-028 | Pedido coletivo exige aprovação individual informada. | Must | Representante não adiciona participante unilateralmente. |
| RN-EST-029 | Participante pode retirar-se antes da submissão. | Must | Composição e auditoria são atualizadas. |
| RN-EST-030 | Rascunho de recurso não equivale a submissão oficial. | Must | Estado/origem são explícitos. |
| RN-EST-031 | UOR Estudante não processa ou movimenta dinheiro. | Must | Apenas consulta/partilha referência oficial. |
| RN-EST-032 | Partilhar referência não partilha finanças completas. | Must | Payload contém somente dados autorizados. |
| RN-EST-033 | Responsável não recebe acesso geral automático. | Must | Cada finalidade exige autorização própria. |
| RN-EST-034 | Autorização define ação, recurso, dados, validade e usos. | Must | Pedido incompleto é rejeitado. |
| RN-EST-035 | Autorização não pode ser delegada pelo representante. | Must | Cadeia de delegação é rejeitada salvo nova autorização do titular. |
| RN-EST-036 | OTP é ligado a operação e contexto concretos. | Must | Reutilização cruzada falha. |
| RN-EST-037 | OTP expira e possui tentativas/reenvios limitados. | Must | Limites são aplicados atomicamente. |
| RN-EST-038 | Operação não é concluída sem confirmação verificável. | Must | Estado permanece pendente/desconhecido. |
| RN-EST-039 | SMS não contém notas, dívida completa ou segredo. | Must | Template e logs são redigidos. |
| RN-EST-040 | Mercado expõe apenas dados necessários ao contacto/transação. | Must | Perfil académico sensível permanece privado. |
| RN-EST-041 | Anúncio vendido não pode ser reservado novamente. | Must | Transição incompatível é rejeitada. |
| RN-EST-042 | Moderação não concede acesso automático a notas/finanças. | Must | Papel é limitado a conteúdo comunitário. |
| RN-EST-043 | Não existe permissão genérica de acesso completo. | Must | Catálogo rejeita wildcard universal. |
| RN-EST-044 | Acesso emergencial é curto, justificado, aprovado e auditado. | Must | Expira/revoga automaticamente. |
| RN-EST-045 | UOR Direção recebe Estudante somente por read models autorizados. | Must | Não há consulta direta às tabelas privadas. |
| RN-EST-046 | Consentimento transversal gere mecanismo; produto define finalidade. | Must | Registo contém produto e finalidade. |
| RN-EST-047 | Auditoria técnica e significado funcional têm ownership distinto. | Must | Schema identifica produto/evento. |
| RN-EST-048 | Operação idempotente usa chave contextual única. | Must | Retentativa não duplica efeito. |
| RN-EST-049 | Estado `stale` preserva valor e data originais. | Must | Não apresenta atualização inexistente. |
| RN-EST-050 | Dados de instituições diferentes nunca são agregados sem intenção explícita. | Must | Tenant/instituição faz parte da consulta. |
| RN-EST-051 | Alteração do número académico preserva relações e histórico. | Must | ID interno continua estável. |
| RN-EST-052 | URLs sensíveis não usam número académico como único localizador. | Must | ID opaco + autorização são obrigatórios. |
| RN-EST-053 | Configuração académica tem versão e vigência. | Must | Cálculo histórico usa regra do período correto. |
| RN-EST-054 | Toda conclusão factual da auditoria indica nível de evidência. | Must | Matriz usa vocabulário controlado. |
| RN-EST-055 | `[x]` significa exclusivamente estado `verified`. | Must | Validador rejeita combinação diferente. |
| RN-EST-056 | Resposta upstream não prova efeito sem pós-condição. | Must | Comando só termina em sucesso após resultado oficial inequívoco ou reconciliação. |
| RN-EST-057 | Falha ambígua proíbe repetição automática. | Must | Estado fica `UNKNOWN`/`VERIFYING`; apenas leitura reconciliadora é permitida. |
| RN-EST-058 | Pagamento só aparece como pago após confirmação oficial. | Must | Referência gerada ou cobrança ausente não implica pagamento. |
| RN-EST-059 | UOR Estudante não inicia, cancela ou processa pagamentos. | Must | API limita-se a referências, cobranças, estados e recibos oficiais. |
| RN-EST-060 | Terminar sessão, desligar integração e eliminar dados são intenções distintas. | Must | Cada ação possui rota, confirmação e efeito próprios. |
