# RF, RNF e regras de negócio — Passaporte do Expositor e Pontuação da UOR Eventos

> **Classificação v2:** requisito normativo legado do produto UOR Eventos. Não define a visão do ecossistema UOR Connect. A autoridade de fronteira é [`SDD-003-UOR-EVENTOS.md`](docs/vision/uor-connect-v2/SDD-003-UOR-EVENTOS.md).

## Objetivo

Definir os requisitos funcionais, requisitos nao funcionais e regras de negocio para a atualizacao completa do sistema de votacao dos projetos no UOR Connect.

A atualizacao substitui a vitoria por numero bruto de votos por um modelo de pontuacao auditavel, com voto ponderado por curso, voto de juri com peso superior, Passaporte do Expositor, embaixadores, rondas, multiplicadores temporais, streaks, missoes, bonus, penalizacoes, ranking em tempo real, congelamento de resultado e auditoria administrativa.

## Principio central

O projeto vencedor deve ser definido pela melhor pontuacao final auditada, nao apenas pela maior quantidade de votos.

A pontuacao deve premiar:

- capacidade do projeto de explicar a ideia a estudantes de cursos diferentes;
- diversidade real de publico alcancado;
- qualidade de apresentacao no stand;
- contribuicao dos membros fora do stand;
- feedback qualificado;
- avaliacao dos juris;
- consistencia durante todas as rondas da feira;
- cumprimento das regras operacionais.

## Escopo

Inclui:

- Pontuacao de votos por curso.
- Bonus por primeiro voto de curso novo.
- Voto de juri com peso configuravel.
- Feedback qualificado aprovado.
- Passaporte do Expositor.
- Separacao entre expositor ativo no stand e embaixador em campo.
- Limite de ate 2 membros ativos no stand.
- Rondas configuraveis da feira.
- Multiplicadores temporais por ronda.
- Streaks por sequencia de cursos novos.
- Missoes de embaixador.
- Missoes de expositor.
- Niveis Bronze, Prata e Ouro por membro.
- Bonus de equipa.
- Ranking individual de embaixadores para auditoria.
- Penalizacoes operacionais e disciplinares.
- Ledger auditavel de todos os pontos.
- Configuracao administrativa de pesos.
- Versionamento de regras por `scoreConfigVersion`.
- Recalculo controlado.
- Congelamento de ranking.
- Exportacao do resultado final auditavel.

Nao inclui nesta especificacao:

- Calculo definitivo de dispensa academica por cadeira.
- Conversao automatica em nota da 2a prova parcelar.
- Integracao financeira.
- Pagamento automatico de premios.
- Comunicacao automatica por SMS/WhatsApp aos vencedores, salvo quando reaproveitada por modulo ja existente.

Observacao: criterios de dispensa, nota e aptidao academica devem ser definidos em documento academico proprio por curso, professor ou coordenacao.

## Estado da implementacao apos sequencia

Atualizado em: 2026-05-15.

Legenda:

- `[x]` Entregue no codigo e verificado localmente.
- `[]` Ainda nao entregue ou entregue apenas parcialmente.

Entregue nesta sequencia:

- [x] Motor de pontuacao do expositor com ledger auditavel.
- [x] Voto publico convertido em pontos do projeto.
- [x] Peso por curso do votante: mesmo curso +1 e curso diferente +2.
- [x] Bonus de primeiro curso alcancado com protecao atomica.
- [x] Voto de juri com peso alto e regra exclusiva.
- [x] Bloqueio e anulacao de auto-voto.
- [x] Penalizacao administrativa manual.
- [x] Pontuacao manual positiva para feedback/bonus administrativo.
- [x] Ranking publico e administrativo ordenado por pontuacao.
- [x] Backfill dos votos existentes para eventos de pontuacao.
- [x] Configuracao administrativa versionada de pesos, rondas e streaks.
- [x] Rondas ativas resolvidas por horario ou chave explicita.
- [x] Multiplicadores aplicados automaticamente em votos elegiveis.
- [x] Curso por confirmar sem bonus de primeiro curso.
- [x] Streak de diversidade por cursos novos alcancados.
- [x] Check-in/check-out de expositor ou embaixador por ledger.
- [x] Limite de 2 expositores ativos no stand por ronda.
- [x] Penalizacao auditavel de stand vazio por ronda.
- [x] Moderacao de feedback qualificado com aprovar, rejeitar e revogar.
- [x] Niveis Bronze, Prata e Ouro por membro com bonus incremental idempotente.
- [x] Congelamento de eventos validos por `lockedAt`.
- [x] Snapshot persistido do ranking congelado.
- [x] Exportacao JSON do ranking atual ou congelado.
- [x] Exportacao CSV e PDF do ranking atual ou congelado.
- [x] Recalculo de eventos nao bloqueados com trilha antes/depois.
- [x] Tratamento administrativo de membros externos ou sem acesso academico.
- [x] Missoes automaticas: Explorador de Cursos, Primeiro Contacto, Conversor Rapido, Embaixador Completo, Diversidade Maxima, Sem Fronteiras, Anfitriao de Elite, Apresentacao Perfeita e Zero Penalizacoes.
- [x] Bonus automatico de stand ativo com 2 expositores registados na ronda.
- [x] Bonus MVP da equipa: conversoes, cursos, streak, missoes e equipa Bronze+.
- [x] Ranking interno de embaixadores/membros por conversoes, cursos, missoes, penalizacoes, contribuicao, streak maximo e rondas inativas.
- [x] Alertas administrativos para auto-voto, concentracao por curso, rajada de conversoes por membro, feedback repetido, QR fora de contexto e eventos pendentes de revisao.
- [x] Unicidade de voto por estudante/projeto/edicao com `StudentVote.eventKey`.
- [x] Feedback qualificado repetido pelo mesmo estudante/projeto aprovado sem nova pontuacao.
- [x] Desempate competitivo por juri, diversidade, penalizacoes, feedback e missoes.
- [x] Endpoint do estudante para resumo do Passaporte do Expositor na Minha Area.
- [x] Mapa visual do Passaporte do Expositor reaproveitando o design do Passaporte Digital.
- [x] Selos, ranking, missoes, pontos atuais e movimentos recentes visiveis ao estudante expositor.
- [x] Acoes continuas visiveis no Mapa do Expositor para deixar claro que votos, cursos, feedback, stand ativo, embaixadores, juri e boas praticas continuam a render impacto.
- [x] Bonus e missoes extras visiveis no Mapa do Expositor, sem limitar a experiencia as etapas principais.
- [x] Modal e som existentes reaproveitados para avisos de ganho e perda de pontos do expositor.
- [x] Testes unitarios e build/lint principais executados localmente.

Fechado nesta sequencia para completar o MVP:

- [x] Missoes automaticas restantes: Primeiro Contacto, Conversor Rapido, Embaixador Completo, Sem Fronteiras, Apresentacao Perfeita e Zero Penalizacoes.
- [x] Streak maximo por embaixador e inatividade por ronda no ranking interno.
- [x] Exportacao PDF do resultado competitivo.
- [x] Alertas avancados: QR fora de contexto, feedback repetido e eventos pendentes que saem temporariamente do ranking.

## Glossario

### Passaporte Digital

Jornada individual do estudante visitante. Inclui check-ins, visitas, desafios, networking, missoes pessoais, pontos do estudante e ranking do estudante.

Nao define sozinho o vencedor dos projetos.

### Passaporte do Expositor

Score acumulado do projeto/equipa. Inclui votos, bonus, missoes, pontos de juri, feedback qualificado, desempenho de embaixadores, atividade do stand e penalizacoes.

Define a classificacao competitiva dos projetos.

### Projeto

Submissao aprovada e elegivel para competicao. No sistema atual corresponde a uma `Submission` aprovada, normalmente do tipo projeto academico.

### Expositor

Membro ativo no stand. Apresenta o projeto, recebe visitantes, garante QR visivel, atende juris e mantem a presenca operacional do stand.

Cada projeto pode ter no maximo 2 expositores ativos no stand em simultaneo.

### Embaixador

Membro do projeto que circula pela feira para convidar estudantes, explicar rapidamente o projeto, levar visitantes ao stand e gerar conversoes validas.

### Conversao

Acao validada gerada por um expositor ou embaixador. Exemplos:

- voto valido;
- visita confirmada ao stand;
- feedback qualificado aprovado;
- voto de juri;
- missao concluida.

Convite sem conversao vale 0 pontos.

### Ronda

Janela de tempo dentro da feira. Exemplo padrao: 45 minutos por ronda.

Cada ronda pode ter multiplicador, tarefas obrigatorias e bonus especificos.

### Streak

Sequencia de conversoes de cursos novos geradas sem interrupcao. A streak premia diversidade continua.

### scoreConfigVersion

Versao da tabela de pesos ativa no momento em que o evento de pontuacao foi criado.

Toda alteracao de pesos pelo admin deve criar nova versao.

### lockedAt

Data/hora em que um evento de pontuacao fica bloqueado contra recalculo automatico.

Eventos bloqueados so podem ser alterados por acao retroativa explicita de admin autorizado.

## Formula oficial

```txt
Score final do projeto =
votos ponderados
+ bonus de curso novo
+ feedback qualificado
+ votos de juri
+ bonus de stand
+ missoes de embaixador
+ missoes de expositor
+ bonus de streak
+ bonus de nivel
+ bonus de equipa
+ efeitos de multiplicador por ronda
- penalizacoes
```

Regra de ouro:

- votos de estudante podem receber multiplicador de ronda;
- conversoes de estudante podem receber multiplicador de ronda quando a regra permitir;
- votos de juri nunca recebem multiplicador;
- penalizacoes nunca recebem multiplicador;
- pontos bloqueados por `lockedAt` nao mudam em recalculo normal.

## Valores padrao da Fase 1 - MVP Avancado Ativo

Todos os valores abaixo devem ser configuraveis pelo admin.

### Pontos positivos base

| Acao | Valor padrao | Regra |
| --- | ---: | --- |
| Voto de estudante do mesmo curso | +1 pt | Curso do votante igual ao curso base do projeto |
| Voto de estudante de curso diferente | +2 pts | Curso do votante diferente do curso base do projeto |
| Primeiro voto de curso novo | +3 pts | Primeiro voto daquele curso para aquele projeto naquela edicao |
| Feedback qualificado aprovado | +2 pts | 1 vez por estudante/projeto |
| Voto de juri | +500 pts | Configuravel pelo admin; nao acumula com voto normal |
| Visita confirmada ao stand | +1 pt | Opcional; 1 vez por estudante/projeto/ronda quando ativado |
| Stand ativo com 2 expositores | +5 pts | Por ronda completa |
| Stand completo com juri presente | +10 pts | Bonus unico por visita de juri validada |

### Streaks

| Sequencia | Bonus |
| --- | ---: |
| 4 cursos novos consecutivos | +10 pts |
| 6 cursos novos consecutivos | +20 pts |
| 8 cursos novos consecutivos | +35 pts |
| 10 ou mais cursos novos consecutivos | +55 pts |

Observacao: como existem varias turmas e varios projetos, streaks pequenos nao devem gerar bonus por padrao. O objetivo e premiar diversidade real e esforco coordenado, nao apenas duas ou tres conversoes faceis.

### Missoes de embaixador

| Missao | Criterio | Recompensa ao projeto | Recompensa interna ao embaixador |
| --- | --- | ---: | ---: |
| Explorador de Cursos | 3 estudantes de cursos diferentes na mesma ronda | +15 pts | +5 pts internos |
| Primeiro Contacto | Ser o primeiro a trazer estudante de curso ainda nao alcancado | +10 pts | +3 pts internos |
| Conversor Rapido | 2 conversoes nos primeiros 15 min da ronda | +8 pts | +2 pts internos |
| Embaixador Completo | Voto + feedback qualificado do mesmo estudante na mesma ronda | +12 pts | +4 pts internos |
| Diversidade Maxima | 5 cursos diferentes ao longo da feira | +25 pts | 0 pts internos |
| Sem Fronteiras | Todos os cursos da instituicao alcancados | +50 pts | badge especial |

### Missoes de expositor

| Missao | Criterio | Recompensa |
| --- | --- | ---: |
| Stand Sempre Ativo | 2 expositores registados em todas as rondas | +20 pts |
| Apresentacao Perfeita | Juri recebido com stand completo e feedback positivo | +15 pts |
| Anfitriao de Elite | 10 visitas confirmadas na mesma ronda | +10 pts ao projeto e +3 pts internos ao expositor |
| Zero Penalizacoes | Feira concluida sem penalizacao operacional | +10 pts |

### Niveis por membro

| Nivel | Criterios minimos | Bonus ao projeto |
| --- | --- | ---: |
| Bronze | 2 conversoes, 1 curso diferente, 1 missao, sem penalizacao grave | +5 pts |
| Prata | 5 conversoes, 3 cursos diferentes, 2 missoes, streak minimo de 2 cursos | +15 pts |
| Ouro | 10 conversoes, 5 cursos diferentes, 4 missoes, streak minimo de 4 cursos | +30 pts |

### Bonus MVP da equipa

| Bonus | Criterio | Valor |
| --- | --- | ---: |
| Embaixador com mais conversoes | Maior total de conversoes da equipa | +20 pts |
| Embaixador com mais cursos alcancados | Maior diversidade de cursos | +15 pts |
| Embaixador com maior streak | Maior sequencia de cursos novos | +15 pts |
| Membro com mais missoes | Maior numero de missoes concluidas | +10 pts |
| Equipa Bronze+ | Todos os membros alcancam pelo menos Bronze | +25 pts |

### Penalizacoes

| Infracao | Penalizacao | Regra |
| --- | ---: | --- |
| Falha operacional leve | -10 pts | Manual/admin com motivo obrigatorio |
| Stand sem representacao em ronda | -10 pts | Aplicavel quando nenhum expositor ativo estiver registado |
| Check-in de stand incompleto na Ronda 1 | -5 pts | Menos de 2 expositores registados ate fim da ronda |
| Embaixador inativo | -5 pts/ronda | Apos 1 ronda de tolerancia sem conversao |
| Auto-voto simples | 0 pts e voto anulado | Tentativa registada no ledger |
| Auto-voto ou abuso confirmado | -50 pts | Admin confirma padrao abusivo |
| QR indevido | Valor definido pelo admin | Pode incluir anulacao de pontos |
| Voto combinado/fraude | Valor definido pelo admin | Pode incluir desqualificacao |
| Feedback falso/repetido | 0 pts e possivel penalizacao | Modera e registra motivo |

## Rondas e multiplicadores

### Configuracao padrao

| Ronda | Janela padrao | Multiplicador | Foco |
| --- | --- | ---: | --- |
| Ronda 1 | 00:00 - 00:45 | x1.5 | Abertura e cursos novos |
| Ronda 2 | 00:45 - 01:30 | x1.0 | Pontuacao normal |
| Ronda 3 | 01:30 - 02:15 | x1.2 | Feedback e consistencia |
| Ronda 4 | 02:15 - encerramento | x2.0 | Sprint final |

### Regras de multiplicador

- Multiplicador aplica-se apenas a eventos elegiveis de estudantes.
- Multiplicador da Ronda 1 aplica-se preferencialmente a votos de cursos novos.
- Multiplicador da Ronda 2 e neutro.
- Multiplicador da Ronda 3 pode aplicar-se a feedback qualificado e conversoes.
- Multiplicador da Ronda 4 aplica-se a votos e conversoes de estudante.
- Voto de juri sempre usa multiplicador x1.0.
- Penalizacao sempre usa multiplicador x1.0.
- Bonus de nivel e bonus de equipa nao devem ser multiplicados.
- Cada evento deve guardar `multiplierApplied`.
- Cada evento deve guardar os pontos antes e depois do multiplicador.

### Tarefas obrigatorias por ronda

| Ronda | Funcao | Tarefa | Consequencia |
| --- | --- | --- | --- |
| Ronda 1 | Expositor | Check-in de 2 membros no stand ate fim da ronda | -5 pts se nao cumprir |
| Ronda 1 | Embaixador | Pelo menos 1 convite com conversao | Sem bonus de abertura |
| Ronda 2 | Embaixador | Pelo menos 2 cursos diferentes na ronda | Sem bonus de streak da ronda |
| Ronda 3 | Qualquer membro | Pelo menos 1 feedback qualificado | Perde bonus de feedback x2 |
| Ronda 4 | Expositor | Pelo menos 1 membro ativo ate encerramento | -10 pts por abandono |
| Todas | Lider | Rever ranking antes do encerramento da ronda | Recomendado; nao penaliza |

## Requisitos funcionais

Legenda de estado pos-sequencia de implementacao:

- `[x]` Entregue no codigo e verificado localmente.
- `[]` Ainda nao entregue ou entregue apenas parcialmente.

### [x] RF-PEX-001 - Ativar Passaporte do Expositor

Prioridade: Critica

O sistema deve ativar o Passaporte do Expositor para projetos aprovados e elegiveis para competicao.

Checklist:

- [x] Criar score do projeto a partir da submissao aprovada.
- [x] Associar score a `submissionId`.
- [x] Associar score a `eventKey` ou edicao da feira.
- [x] Ignorar submissao rejeitada, removida ou nao elegivel.
- [x] Mostrar estado do passaporte: pendente, ativo, congelado, encerrado.

### [x] RF-PEX-002 - Separar Passaporte Digital e Passaporte do Expositor

Prioridade: Critica

O sistema deve manter separados os pontos individuais do estudante e os pontos competitivos do projeto.

Checklist:

- [x] Pontos do estudante continuam no Passaporte Digital.
- [x] Pontos do projeto ficam no Passaporte do Expositor.
- [x] A mesma acao pode gerar registros diferentes quando necessario.
- [x] A interface deve deixar claro qual ranking esta sendo exibido.
- [x] Relatorios devem separar estudante, projeto e embaixador.

### [x] RF-PEX-003 - Voto ponderado por curso

Prioridade: Critica

O sistema deve pontuar votos de estudantes com base no curso do votante em relacao ao curso base do projeto.

Checklist:

- [x] Voto de estudante do mesmo curso vale +1.
- [x] Voto de estudante de curso diferente vale +2.
- [x] Curso relevante e sempre o curso do votante.
- [x] Curso do embaixador nao altera a pontuacao do voto.
- [x] Curso ausente deve ser tratado como "Curso por confirmar".
- [x] Curso por confirmar nao deve gerar bonus de curso novo.

### [x] RF-PEX-004 - Unicidade do voto

Prioridade: Critica

Cada estudante deve votar no maximo uma vez por projeto em cada edicao.

Checklist:

- [x] Impedir voto duplicado por `studentId + submissionId + eventKey`.
- [x] Se o voto ja existe, retornar resultado idempotente.
- [x] Nao duplicar ledger em chamada repetida.
- [x] Manter historico da primeira tentativa valida.
- [x] Registrar tentativas recusadas quando houver abuso ou auto-voto.

### [x] RF-PEX-005 - Bonus de primeiro curso novo

Prioridade: Alta

O sistema deve atribuir +3 pontos quando um projeto recebe o primeiro voto valido de um curso ainda nao alcancado naquela edicao.

Checklist:

- [x] Chave unica: `eventKey + submissionId + voterCourse`.
- [x] Atribuir bonus apenas ao primeiro voto valido daquele curso no projeto.
- [x] Usar operacao atomica para evitar race condition.
- [x] Nao atribuir bonus quando curso estiver vazio ou por confirmar.
- [x] Registrar no ledger com `ruleApplied=FIRST_COURSE`.

### [x] RF-PEX-006 - Voto de juri

Prioridade: Critica

O sistema deve permitir que juris votem em projetos com peso superior configuravel.

Checklist:

- [x] Valor padrao do voto de juri: +500.
- [x] Valor deve ser configuravel pelo admin.
- [x] Voto de juri nao acumula com voto de estudante.
- [x] Voto de juri nao recebe multiplicador de ronda.
- [x] Cada juri vota no maximo uma vez por projeto por criterio configurado.
- [x] Registrar `juryMemberId`, `submissionId`, `pointsApplied`, `scoreConfigVersion`.
- [x] Permitir auditoria por juri, projeto e horario.

### [x] RF-PEX-007 - Feedback qualificado

Prioridade: Alta

O sistema deve permitir feedback qualificado de estudantes sobre projetos, com pontuacao apos aprovacao.

Checklist:

- [x] Feedback aprovado vale +2 pontos.
- [x] Feedback so pontua 1 vez por estudante/projeto.
- [x] Feedback deve ter conteudo minimo configuravel.
- [x] Feedback deve passar por moderacao automatica ou manual.
- [x] Feedback repetido, vazio ou sem relacao deve valer 0.
- [x] Admin pode aprovar, rejeitar ou revogar feedback.
- [x] Ledger deve registrar `ruleApplied=FEEDBACK_APPROVED`.

### [x] RF-PEX-008 - Definir funcoes da equipa

Prioridade: Critica

O sistema deve permitir distinguir membros ativos no stand e membros embaixadores.

Checklist:

- [x] Cada membro confirmado pode assumir funcao de expositor ou embaixador.
- [x] No maximo 2 membros podem estar ativos no stand ao mesmo tempo.
- [x] Restantes membros atuam como embaixadores.
- [x] Funcao pode mudar por ronda se houver check-in/checkout.
- [x] Historico de funcao deve ser preservado para auditoria.

### [x] RF-PEX-009 - Check-in de expositor no stand

Prioridade: Alta

O expositor deve poder registrar presenca ativa no stand por ronda.

Checklist:

- [x] Check-in deve identificar membro e projeto.
- [x] Check-in deve estar ligado a uma ronda.
- [x] Permitir check-out ou expiracao automatica no fim da ronda.
- [x] Validar limite de 2 expositores ativos.
- [x] Registrar ausencia ou stand vazio quando aplicavel.
- [x] Atribuir bonus de stand ativo quando regra for cumprida.

### [x] RF-PEX-010 - Embaixadores e conversoes

Prioridade: Alta

O sistema deve atribuir conversoes ao embaixador que trouxe ou acompanhou o visitante.

Checklist:

- [x] Permitir associar conversao a `memberId`.
- [x] Conversao valida pode ser voto, visita, feedback ou acao de juri.
- [x] Convite sem conversao vale 0.
- [x] Embaixador nao altera curso usado na pontuacao.
- [x] Embaixador nao pode gerar pontos para auto-voto.
- [x] Ranking individual de embaixadores deve usar conversoes atribuidas.

### [x] RF-PEX-011 - Missoes de embaixador

Prioridade: Alta

O sistema deve gerar e avaliar missoes de embaixador na Fase 1.

Checklist:

- [x] Criar missoes por ronda.
- [x] Avaliar missao Explorador de Cursos.
- [x] Avaliar missao Primeiro Contacto.
- [x] Avaliar missao Conversor Rapido.
- [x] Avaliar missao Embaixador Completo.
- [x] Avaliar missao Diversidade Maxima.
- [x] Avaliar missao Sem Fronteiras.
- [x] Registrar bonus no ledger com `ruleApplied=MISSION_<key>`.

### [x] RF-PEX-012 - Missoes de expositor

Prioridade: Alta

O sistema deve avaliar missoes relacionadas ao stand.

Checklist:

- [x] Avaliar Stand Sempre Ativo.
- [x] Avaliar Apresentacao Perfeita.
- [x] Avaliar Anfitriao de Elite.
- [x] Avaliar Zero Penalizacoes.
- [x] Registrar bonus no ledger.
- [x] Permitir revisao manual quando depender de juri ou observacao da organizacao.

### [x] RF-PEX-013 - Streak de cursos novos

Prioridade: Alta

O sistema deve calcular bonus por sequencia de cursos novos consecutivos.

Checklist:

- [x] Identificar cursos novos por projeto.
- [x] Manter streak por projeto e por embaixador quando houver atribuicao.
- [x] Atribuir +5, +10, +20 ou +35 conforme sequencia.
- [x] Quebrar streak quando houver voto de curso ja alcancado.
- [x] Quebrar streak quando houver inatividade em ronda aplicavel.
- [x] Quebrar streak quando evento for anulado.
- [x] Registrar `ruleApplied=STREAK_<n>`.

### [x] RF-PEX-014 - Rondas

Prioridade: Critica

O admin deve configurar rondas da feira.

Checklist:

- [x] Criar rondas com nome, inicio, fim e multiplicador.
- [x] Definir se ronda esta ativa, encerrada ou congelada.
- [x] Associar cada evento de pontuacao a uma ronda.
- [x] Aplicar multiplicador correto.
- [x] Mostrar progresso da ronda no painel admin.
- [x] Permitir ajustar rondas antes de congelar eventos.

### [x] RF-PEX-015 - Multiplicadores temporais

Prioridade: Alta

O sistema deve aplicar multiplicadores temporais conforme a ronda ativa.

Checklist:

- [x] Aplicar x1.5 na Ronda 1 quando elegivel.
- [x] Aplicar x1.0 na Ronda 2.
- [x] Aplicar x1.2 na Ronda 3 quando elegivel.
- [x] Aplicar x2.0 na Ronda 4 quando elegivel.
- [x] Nao multiplicar votos de juri.
- [x] Nao multiplicar penalizacoes.
- [x] Nao multiplicar bonus finais de nivel/equipa.
- [x] Registrar `basePoints`, `multiplierApplied` e `pointsApplied`.

### [x] RF-PEX-016 - Niveis Bronze, Prata e Ouro

Prioridade: Media

O sistema deve calcular nivel individual de cada membro no encerramento.

Checklist:

- [x] Calcular Bronze.
- [x] Calcular Prata.
- [x] Calcular Ouro.
- [x] Atribuir bonus do nivel ao projeto.
- [x] Registrar criterios usados.
- [x] Nao atribuir nivel quando houver penalizacao grave impeditiva.

### [x] RF-PEX-017 - Bonus MVP da equipa

Prioridade: Media

O sistema deve atribuir bonus coletivos no encerramento.

Checklist:

- [x] Embaixador com mais conversoes.
- [x] Embaixador com mais cursos alcancados.
- [x] Embaixador com maior streak.
- [x] Membro com mais missoes.
- [x] Equipa com todos os membros Bronze+.
- [x] Resolver empates por regra configuravel.
- [x] Registrar bonus no ledger.

### [x] RF-PEX-018 - Penalizacoes

Prioridade: Critica

O admin deve poder aplicar penalizacoes com motivo obrigatorio.

Checklist:

- [x] Aplicar penalizacao operacional leve.
- [x] Aplicar penalizacao por stand vazio.
- [x] Aplicar penalizacao por embaixador inativo.
- [x] Anular auto-voto.
- [x] Aplicar -50 por abuso confirmado.
- [x] Aplicar penalizacao grave customizada.
- [x] Desqualificar projeto quando necessario.
- [x] Toda penalizacao deve ter ator, motivo, data e evidencias opcionais.

### [x] RF-PEX-019 - Bloqueio de auto-voto

Prioridade: Critica

Membro de projeto nao pode votar no proprio projeto.

Checklist:

- [x] Verificar `SubmissionMember.studentId`.
- [x] Verificar `SubmissionMember.studentNumber`.
- [x] Verificar lider da submissao.
- [x] Anular voto quando houver correspondencia.
- [x] Registrar tentativa.
- [x] Permitir admin classificar como abuso confirmado.

### [x] RF-PEX-020 - Ledger de pontuacao

Prioridade: Critica

Toda pontuacao positiva, negativa ou anulada deve ser registrada em ledger auditavel.

Checklist:

- [x] Registrar `eventKey`.
- [x] Registrar `submissionId`.
- [x] Registrar `studentId` quando houver estudante.
- [x] Registrar `studentNumber`.
- [x] Registrar `juryMemberId` quando houver juri.
- [x] Registrar `memberId` quando houver embaixador/expositor.
- [x] Registrar `course`.
- [x] Registrar `actionType`.
- [x] Registrar `basePoints`.
- [x] Registrar `multiplierApplied`.
- [x] Registrar `pointsApplied`.
- [x] Registrar `ruleApplied`.
- [x] Registrar `roundId`.
- [x] Registrar `scoreConfigVersion`.
- [x] Registrar `status`.
- [x] Registrar `reason`.
- [x] Registrar `metadataJson`.
- [x] Registrar `createdAt`.
- [x] Registrar `lockedAt`.

### [x] RF-PEX-021 - Configuracao de pesos

Prioridade: Critica

O admin deve configurar todos os pesos da pontuacao.

Checklist:

- [x] Editar peso de voto mesmo curso.
- [x] Editar peso de voto curso diferente.
- [x] Editar bonus de curso novo.
- [x] Editar peso de juri.
- [x] Editar peso de feedback.
- [x] Editar penalizacoes.
- [x] Editar multiplicadores.
- [x] Editar bonus de missoes.
- [x] Editar criterios de nivel.
- [x] Toda alteracao cria nova `scoreConfigVersion`.

### [x] RF-PEX-022 - Ranking em tempo real

Prioridade: Alta

O sistema deve exibir ranking de projetos por pontuacao.

Checklist:

- [x] Mostrar posicao.
- [x] Mostrar pontuacao total.
- [x] Mostrar votos de estudantes.
- [x] Mostrar pontos de juri.
- [x] Mostrar bonus.
- [x] Mostrar penalizacoes.
- [x] Mostrar cursos alcancados.
- [x] Mostrar ultima atualizacao.
- [x] Permitir visao publica simplificada.
- [x] Permitir visao admin completa.

### [x] RF-PEX-023 - Ranking individual de embaixadores

Prioridade: Media

O admin deve acompanhar desempenho individual dos membros.

Checklist:

- [x] Conversoes totais.
- [x] Cursos unicos alcancados.
- [x] Missoes completadas.
- [x] Streak maximo.
- [x] Rondas sem inatividade.
- [x] Nivel atribuido.
- [x] Penalizacoes associadas.
- [x] Ranking interno nao deve ser publico por padrao.

### [x] RF-PEX-024 - Congelamento de ranking

Prioridade: Critica

O admin deve conseguir congelar o ranking final.

Checklist:

- [x] Criar snapshot do ranking.
- [x] Definir `lockedAt` nos eventos incluidos quando aplicavel.
- [x] Impedir recalculo automatico de eventos bloqueados.
- [x] Registrar admin responsavel.
- [x] Registrar nota de congelamento.
- [x] Permitir exportacao do snapshot.

### [x] RF-PEX-025 - Recalculo auditavel

Prioridade: Critica

O sistema deve permitir recalcular pontos sem quebrar integridade historica.

Checklist:

- [x] Recalcular apenas eventos sem `lockedAt` por padrao.
- [x] Usar `scoreConfigVersion` apropriada.
- [x] Permitir acao retroativa explicita para admin autorizado.
- [x] Registrar antes/depois quando recalculo alterar pontuacao.
- [x] Nunca apagar ledger antigo sem trilha de auditoria.

### [x] RF-PEX-026 - Exportacao de resultado

Prioridade: Alta

O admin deve exportar resultado final.

Checklist:

- [x] Exportar ranking geral.
- [x] Exportar ranking por projeto.
- [x] Exportar pontos por categoria.
- [x] Exportar votos por curso.
- [x] Exportar votos de juri.
- [x] Exportar penalizacoes.
- [x] Exportar snapshot congelado.
- [x] Exportar CSV e/ou PDF.

### [x] RF-PEX-027 - Tratamento de projetos sem stand ativo

Prioridade: Alta

O sistema deve tratar projeto sem representacao no stand.

Checklist:

- [x] Permitir que o projeto continue recebendo votos se estiver elegivel.
- [x] Remover bonus de stand ativo.
- [x] Aplicar penalizacao quando regra da ronda exigir presenca.
- [x] Registrar motivo.
- [x] Mostrar alerta ao admin.

### [x] RF-PEX-028 - Casos especiais de membros

Prioridade: Alta

O sistema deve suportar membros de outras universidades ou sem acesso ao sistema academico.

Checklist:

- [x] Permitir marcacao manual de membro externo.
- [x] Permitir associacao por telefone/documento quando nao houver `studentId`.
- [x] Nao penalizar automaticamente casos previamente comunicados.
- [x] Exigir revisao admin para confirmar excecao.
- [x] Registrar justificativa da excecao.

### [x] RF-PEX-029 - Moderacao de feedback

Prioridade: Alta

Feedback deve poder ser moderado.

Checklist:

- [x] Listar feedbacks pendentes.
- [x] Aprovar feedback.
- [x] Rejeitar feedback.
- [x] Revogar feedback aprovado.
- [x] Aplicar ou retirar pontos conforme estado.
- [x] Guardar motivo de revisao.

### [x] RF-PEX-030 - Auditoria de atividade suspeita

Prioridade: Critica

O sistema deve sinalizar atividade suspeita.

Checklist:

- [x] Muitos votos em intervalo curto.
- [x] Muitos votos do mesmo curso para o mesmo projeto.
- [x] Muitos votos gerados pelo mesmo embaixador em pouco tempo.
- [x] Votos de membros do projeto.
- [x] Feedback repetido.
- [x] QR usado fora do contexto da feira.
- [x] Pontos suspeitos podem ficar pendentes.

### [x] RF-PEX-031 - Mapa do Expositor na Minha Area

Prioridade: Alta

O estudante expositor deve acompanhar o Passaporte do Expositor na aba Inicio da Minha Area sem aprender uma nova interface visual.

Checklist:

- [x] Reaproveitar os cards, mapa, lista de missoes, selos e anel de progresso do Passaporte Digital.
- [x] Mostrar projeto ativo, papel do utilizador, pontos atuais, ranking, total disponivel e missoes concluida/disponivel/bloqueada.
- [x] Mostrar selos desbloqueados e bloqueados com o mesmo estilo visual do Passaporte Digital.
- [x] Mostrar movimentos recentes de ganho e perda de pontos do projeto.
- [x] Reaproveitar o modal de aviso e o som do Passaporte Digital para ganho e perda de pontos.
- [x] Mostrar um fluxo horizontal compacto das rondas com horario, multiplicador ativo, proxima janela e minutos restantes conforme a hora atual.
- [x] Mostrar os alvos de "Streaks grandes" no mesmo bloco para o expositor perceber que diversidade forte exige varias turmas/cursos.
- [x] Nao criar novo design paralelo para o Passaporte do Expositor.

### [x] RF-PEX-032 - Acoes continuas e oportunidades extras no Mapa do Expositor

Prioridade: Alta

O Mapa do Expositor nao deve transmitir a ideia de que existem apenas poucas etapas fechadas. Alem da trilha principal, a interface deve mostrar formas repetiveis e extras de evoluir a pontuacao.

Checklist:

- [x] Mostrar bloco "Continuar a ganhar pontos" com votos validos, cursos novos, feedback qualificado, stand ativo, trabalho de embaixador, avaliacao de juri e boas praticas.
- [x] Mostrar bloco "Bonus e missoes extras" com Primeiro Contacto, Explorador de Cursos, Conversor Rapido, Embaixador Completo, Diversidade Maxima, Sem Fronteiras, Anfitriao de Elite, Apresentacao Perfeita, Zero Penalizacoes, niveis de membros e Equipa Bronze+.
- [x] Cada item deve mostrar valor ou regra de pontuacao, estado e progresso quando ja existirem eventos no ledger.
- [x] As oportunidades extras devem reaproveitar cards/modulos do Passaporte Digital.
- [x] Penalizacoes devem aparecer como atencao, para reforcar boas praticas e risco de perda de pontos.

## Requisitos nao funcionais

### [x] RNF-PEX-001 - Auditabilidade

Prioridade: Critica

Todo ponto deve ser explicavel.

Checklist:

- [x] Deve ser possivel responder quem gerou o ponto.
- [x] Deve ser possivel responder para qual projeto.
- [x] Deve ser possivel responder por qual regra.
- [x] Deve ser possivel responder em qual ronda.
- [x] Deve ser possivel responder qual versao de configuracao foi usada.

### [x] RNF-PEX-002 - Idempotencia

Prioridade: Critica

Chamadas repetidas nao podem duplicar pontos.

Checklist:

- [x] Business keys unicas por tipo de evento.
- [x] Upsert ou transacao atomica em pontos criticos.
- [x] Voto duplicado retorna estado ja processado.
- [x] Bonus de curso novo protegido contra race condition.

### [x] RNF-PEX-003 - Consistencia transacional

Prioridade: Critica

Pontuacao, voto e bonus dependentes devem ser gravados de forma consistente.

Checklist:

- [x] Voto e ledger na mesma transacao.
- [x] Bonus de primeiro curso na mesma transacao ou transacao coordenada.
- [x] Streak atualizado sem conflito.
- [x] Penalizacao e anulacao registradas sem perder historico.

### [x] RNF-PEX-004 - Performance

Prioridade: Alta

Ranking deve responder rapidamente durante evento.

Checklist:

- [x] Ranking publico deve usar agregacao eficiente ou cache curta.
- [x] Painel admin pode ter dados mais completos com paginacao.
- [x] Consultas por `submissionId`, `eventKey`, `roundId`, `scoreConfigVersion` devem ser indexadas.
- [x] Exportacao pesada pode rodar assincrona.

### [x] RNF-PEX-005 - Seguranca

Prioridade: Critica

Apenas usuarios autorizados podem alterar regras, penalizacoes e ranking.

Checklist:

- [x] Admin autenticado para configuracoes.
- [x] Permissao especifica para alterar pesos.
- [x] Permissao especifica para penalizar.
- [x] Permissao especifica para congelar ranking.
- [x] Toda acao administrativa gera audit log.

### [x] RNF-PEX-006 - Privacidade

Prioridade: Alta

Ranking publico nao deve expor dados sensiveis dos estudantes.

Checklist:

- [x] Publico ve projeto, pontos e metricas agregadas.
- [x] Admin ve dados identificaveis.
- [x] Ranking individual de embaixador nao e publico por padrao.
- [x] Exportacoes com dados pessoais exigem permissao admin.

### [x] RNF-PEX-007 - Configurabilidade

Prioridade: Alta

Todos os pesos devem ser configuraveis sem deploy.

Checklist:

- [x] Pesos base.
- [x] Bonus.
- [x] Penalizacoes.
- [x] Multiplicadores.
- [x] Rondas.
- [x] Criterios de niveis.
- [x] Tolerancia de inatividade.

### [x] RNF-PEX-008 - Versionamento

Prioridade: Critica

Mudancas de regras nao podem tornar historico ambiguo.

Checklist:

- [x] Cada configuracao tem versao.
- [x] Cada evento guarda versao.
- [x] Recalculo registra a nova versao aplicada e preserva antes/depois.
- [x] Admin consegue ver quando a versao mudou.

### [x] RNF-PEX-009 - Observabilidade

Prioridade: Alta

O sistema deve permitir acompanhar saude da competicao.

Checklist:

- [x] Total de eventos por minuto.
- [x] Total de pontos aplicados.
- [x] Eventos pendentes de revisao.
- [x] Erros de pontuacao.
- [x] Tempo de resposta do ranking.
- [x] Ultimo recalculo.

### [x] RNF-PEX-010 - Recuperacao

Prioridade: Alta

Falhas durante evento nao podem destruir dados.

Checklist:

- [x] Ledger nunca deve ser sobrescrito sem historico.
- [x] Reprocessamento deve ser possivel.
- [x] Exportacao final deve usar snapshot congelado.
- [x] Falha parcial em bonus nao pode duplicar voto.

### [x] RNF-PEX-011 - Usabilidade

Prioridade: Media

Regras devem ser compreensiveis para estudantes e admin.

Checklist:

- [x] Interface publica mostra explicacao simples.
- [x] Admin ve detalhes completos.
- [x] Mensagens usam "pontos", "bonus" e "penalizacao" com clareza.
- [x] Documento oficial deve ter glossario.

### [x] RNF-PEX-012 - Acessibilidade documental

Prioridade: Media

PDFs e documentos oficiais devem ser legiveis e pesquisaveis.

Checklist:

- [x] Texto selecionavel.
- [x] Contraste suficiente.
- [x] Tabelas em texto, nao imagem.
- [x] Validacao por `pdftotext` quando PDF for gerado.
- [x] Previa visual revisada antes de envio.

## Regras de negocio

### [x] RN-PEX-001 - Elegibilidade do projeto

Somente projeto aprovado, nao removido e elegivel para competicao pode aparecer no ranking competitivo.

### [x] RN-PEX-002 - Voto de estudante

Um estudante autenticado pode votar uma vez por projeto por edicao.

### [x] RN-PEX-003 - Voto do mesmo curso

Se o curso do votante for igual ao curso base do projeto, o voto vale +1 antes de multiplicadores elegiveis.

### [x] RN-PEX-004 - Voto de curso diferente

Se o curso do votante for diferente do curso base do projeto, o voto vale +2 antes de multiplicadores elegiveis.

### [x] RN-PEX-005 - Curso por confirmar

Curso ausente ou por confirmar nao gera bonus de primeiro curso novo. O voto pode valer regra base definida pelo admin, recomendada como +1.

### [x] RN-PEX-006 - Primeiro curso novo

O primeiro voto valido de cada curso para cada projeto em cada edicao gera +3 bonus.

### [x] RN-PEX-007 - Atomicidade do bonus de curso

O bonus de curso novo deve ser protegido por chave unica e transacao para evitar atribuicao duplicada.

### [x] RN-PEX-008 - Juri

Voto de juri vale +500 por padrao e nao e multiplicado por ronda.

### [x] RN-PEX-009 - Juri nao acumula

Quando a pessoa atua como juri, aplica-se apenas a regra de juri. Nao soma +1 ou +2 de estudante.

### [x] RN-PEX-010 - Feedback

Feedback so pontua apos aprovacao. Feedback pendente vale 0 ate aprovacao.

### [x] RN-PEX-011 - Conversao

Conversao e qualquer acao validada que gere efeito no Passaporte do Expositor. Convite sem conversao vale 0.

### [x] RN-PEX-012 - Curso relevante

O curso relevante e sempre o curso do votante ou visitante que realizou a acao, nunca o curso do embaixador.

### [x] RN-PEX-013 - Limite de expositores

No maximo 2 membros podem estar ativos no stand simultaneamente.

### [x] RN-PEX-014 - Excesso de membros no stand

Excesso persistente apos aviso pode gerar penalizacao operacional.

### [x] RN-PEX-015 - Stand vazio

Stand sem membro ativo em ronda obrigatoria perde bonus e pode receber penalizacao.

### [x] RN-PEX-016 - Auto-voto

Membro do projeto nao pode votar no proprio projeto. O voto e anulado e a tentativa e registrada.

### [x] RN-PEX-017 - Abuso confirmado

Auto-voto repetido, coordenado ou tentativa clara de manipulacao gera -50 pontos ou penalizacao maior definida pelo admin.

### [x] RN-PEX-018 - Multiplicador de ronda

Multiplicador so aplica quando a regra do evento permitir.

### [x] RN-PEX-019 - Penalizacao nao multiplica

Penalizacoes sempre usam multiplicador x1.0.

### [x] RN-PEX-020 - Streak

Streak conta sequencia de cursos novos e pode gerar bonus crescente.

### [x] RN-PEX-021 - Quebra de streak

Streak quebra por voto de curso ja alcancado, inatividade em ronda aplicavel, evento anulado ou atividade suspeita confirmada.

### [x] RN-PEX-022 - Missoes automaticas

Missoes com criterio objetivo devem ser calculadas automaticamente.

### [x] RN-PEX-023 - Missoes com julgamento

Missoes que dependem de qualidade de apresentacao ou feedback de juri podem exigir aprovacao manual.

### [x] RN-PEX-024 - Penalizacao manual

Toda penalizacao manual exige motivo obrigatorio.

### [x] RN-PEX-025 - Penalizacao grave

Fraude, QR indevido, voto combinado ou manipulacao pode gerar desqualificacao.

### [x] RN-PEX-026 - Eventos pendentes

Eventos suspeitos podem ficar pendentes e nao entrar no ranking ate revisao.

### [x] RN-PEX-027 - Recalculo

Recalculo padrao afeta apenas eventos nao bloqueados.

### [x] RN-PEX-028 - Eventos bloqueados

Evento com `lockedAt` nao muda por recalculo normal.

### [x] RN-PEX-029 - Congelamento

Ranking congelado vira snapshot oficial ate nova acao administrativa.

### [x] RN-PEX-030 - Configuracao nova

Alterar qualquer peso gera nova `scoreConfigVersion`.

### [x] RN-PEX-031 - Historico

Historico de pontuacao nunca deve ser apagado sem trilha de auditoria.

### [x] RN-PEX-032 - Empate

Empate no ranking final deve ser resolvido nesta ordem:

1. maior pontuacao de juri;
2. maior diversidade de cursos alcancados;
3. menos penalizacoes;
4. maior numero de feedbacks qualificados aprovados;
5. maior pontuacao em missoes;
6. decisao manual da organizacao registrada em auditoria.

### [x] RN-PEX-033 - Membros externos

Membros externos ou sem acesso ao sistema academico nao devem ser penalizados automaticamente quando a situacao estiver comunicada e aprovada pela organizacao.

### [x] RN-PEX-034 - Pontos internos de membro

Pontos internos de embaixador/expositor servem para ranking da equipa e bonus. Eles nao substituem os pontos oficiais do projeto.

### [x] RN-PEX-035 - Publicidade do ranking interno

Ranking individual de embaixadores e interno/admin por padrao.

## Modelo de dados recomendado

Esta secao descreve entidades conceituais. A implementacao pode usar nomes equivalentes, desde que preserve as regras.

### `ExhibitorScoreConfig`

Guarda a configuracao de pesos.

Campos recomendados:

- `id`
- `eventKey`
- `version`
- `active`
- `sameCourseVotePoints`
- `differentCourseVotePoints`
- `firstCourseBonusPoints`
- `qualifiedFeedbackPoints`
- `juryVotePoints`
- `standActiveBonusPoints`
- `standJuryBonusPoints`
- `lightPenaltyPoints`
- `selfVoteAbusePenaltyPoints`
- `roundMultipliersJson`
- `missionRewardsJson`
- `levelRewardsJson`
- `createdAt`
- `createdByStudentNumber`

### `ExhibitorRound`

Guarda rondas da feira.

Campos recomendados:

- `id`
- `eventKey`
- `name`
- `startsAt`
- `endsAt`
- `multiplier`
- `status`
- `tasksJson`
- `createdAt`
- `updatedAt`

### `ExhibitorScoreLedger`

Ledger principal de pontos do projeto.

Campos recomendados:

- `id`
- `businessKey`
- `eventKey`
- `submissionId`
- `studentId`
- `studentNumber`
- `juryMemberId`
- `memberId`
- `roundId`
- `course`
- `actionType`
- `basePoints`
- `multiplierApplied`
- `pointsApplied`
- `ruleApplied`
- `scoreConfigVersion`
- `status`
- `reason`
- `metadataJson`
- `createdAt`
- `lockedAt`
- `revokedAt`
- `revokedByStudentNumber`
- `revokeReason`

### `ExhibitorCourseReach`

Controla cursos ja alcancados por projeto.

Campos recomendados:

- `id`
- `eventKey`
- `submissionId`
- `course`
- `firstStudentId`
- `firstVoteId`
- `firstLedgerId`
- `createdAt`

Chave unica:

- `eventKey + submissionId + course`

### `ExhibitorMemberRoleSession`

Controla membro no stand ou em campo.

Campos recomendados:

- `id`
- `eventKey`
- `submissionId`
- `submissionMemberId`
- `studentId`
- `role`
- `roundId`
- `checkedInAt`
- `checkedOutAt`
- `status`

### `ExhibitorMemberMission`

Controla missoes por membro.

Campos recomendados:

- `id`
- `eventKey`
- `submissionId`
- `submissionMemberId`
- `roundId`
- `missionKey`
- `status`
- `targetValue`
- `currentValue`
- `completedAt`
- `rewardLedgerId`

### `ExhibitorRankingFreeze`

Controla snapshots finais.

Campos recomendados:

- `id`
- `eventKey`
- `active`
- `snapshotJson`
- `note`
- `frozenAt`
- `frozenByStudentNumber`

## Fluxos principais

### Fluxo 1 - Voto de estudante

1. Estudante autenticado vota no projeto.
2. Sistema valida projeto elegivel.
3. Sistema valida se estudante nao e membro do projeto.
4. Sistema verifica unicidade do voto.
5. Sistema determina curso do votante.
6. Sistema calcula pontos base.
7. Sistema verifica bonus de curso novo de forma atomica.
8. Sistema identifica ronda ativa.
9. Sistema aplica multiplicador se elegivel.
10. Sistema cria ledger.
11. Sistema atualiza ranking.

### Fluxo 2 - Voto de juri

1. Juri autenticado escolhe projeto.
2. Sistema valida permissao de juri.
3. Sistema valida projeto elegivel.
4. Sistema aplica peso de juri da configuracao ativa.
5. Sistema nao aplica multiplicador.
6. Sistema registra ledger com `juryMemberId`.
7. Sistema atualiza ranking.

### Fluxo 3 - Feedback qualificado

1. Estudante envia feedback.
2. Sistema valida unicidade por estudante/projeto.
3. Feedback fica pendente ou aprovado conforme regra.
4. Ao aprovar, sistema aplica +2 pontos.
5. Sistema atribui conversao ao embaixador se informado.
6. Sistema registra ledger.

### Fluxo 4 - Check-in de expositor no stand

1. Membro confirma presenca no stand.
2. Sistema valida que pertence ao projeto.
3. Sistema valida limite de 2 expositores ativos.
4. Sistema associa membro a ronda.
5. No fim da ronda, sistema avalia bonus ou penalizacao.

### Fluxo 5 - Streak

1. Conversao valida de curso novo entra no projeto.
2. Sistema verifica ultima sequencia ativa.
3. Se curso for novo e sequencia continuar, incrementa streak.
4. Sistema aplica bonus correspondente.
5. Se curso ja foi alcancado ou houver inatividade, streak quebra.

### Fluxo 6 - Congelamento final

1. Admin solicita congelamento.
2. Sistema recalcula eventos nao bloqueados.
3. Sistema gera snapshot.
4. Sistema marca eventos incluidos como bloqueados quando aplicavel.
5. Sistema registra audit log.
6. Sistema disponibiliza exportacao final.

## Criterios de aceitacao

### [x] CA-PEX-001 - Voto mesmo curso

Dado um projeto de Informatica, quando estudante de Informatica vota, entao o projeto recebe +1 antes de multiplicador.

### [x] CA-PEX-002 - Voto curso diferente

Dado um projeto de Informatica, quando estudante de Direito vota, entao o projeto recebe +2 antes de multiplicador.

### [x] CA-PEX-003 - Primeiro curso novo

Dado que Direito ainda nao votou no projeto, quando o primeiro estudante de Direito vota, entao o projeto recebe +2 +3 antes de multiplicador elegivel.

### [x] CA-PEX-004 - Segundo voto do mesmo curso novo

Dado que Direito ja votou no projeto, quando outro estudante de Direito vota, entao nao recebe o bonus +3.

### [x] CA-PEX-005 - Voto duplicado

Dado que estudante ja votou no projeto, quando tenta votar novamente, entao o sistema nao duplica voto nem ledger.

### [x] CA-PEX-006 - Voto de juri

Dado um juri autenticado, quando vota no projeto, entao o projeto recebe +500 e nenhum multiplicador.

### [x] CA-PEX-007 - Auto-voto

Dado que estudante e membro do projeto, quando tenta votar no proprio projeto, entao voto e anulado e tentativa e registrada.

### [x] CA-PEX-008 - Feedback aprovado

Dado feedback pendente, quando admin aprova, entao o projeto recebe +2.

### [x] CA-PEX-009 - Multiplicador de ronda

Dado Ronda 4 com x2.0, quando estudante gera voto elegivel de +2, entao ledger registra base +2, multiplier x2.0 e pointsApplied +4.

### [x] CA-PEX-010 - Penalizacao nao multiplica

Dado Ronda 4 com x2.0, quando admin aplica -10, entao pointsApplied continua -10.

### [x] CA-PEX-011 - Streak

Dado tres cursos novos consecutivos, quando a terceira conversao valida entra, entao o bonus de streak de 3 cursos e aplicado.

### [x] CA-PEX-012 - Stand ativo

Dado 2 expositores ativos durante ronda completa, quando ronda encerra, entao projeto recebe bonus de stand ativo.

### [x] CA-PEX-013 - Stand vazio

Dado nenhum expositor ativo em ronda obrigatoria, quando ronda encerra, entao projeto recebe penalizacao configurada.

### [x] CA-PEX-014 - Recalculo

Dado evento sem `lockedAt`, quando admin recalcula apos mudar regra, entao evento pode ser recalculado conforme politica.

### [x] CA-PEX-015 - Evento bloqueado

Dado evento com `lockedAt`, quando admin roda recalculo normal, entao evento nao muda.

### [x] CA-PEX-016 - Congelamento

Dado ranking congelado, quando exportado, entao exportacao usa snapshot congelado.

## Casos extremos obrigatorios

- Dois votos do mesmo curso chegam ao mesmo tempo: apenas um recebe bonus de curso novo.
- Juri tambem e estudante: se votar como juri, vale so juri.
- Estudante sem curso: nao recebe bonus de curso novo.
- Membro externo sem `studentId`: pode ser associado por revisao admin.
- Projeto sem membros no stand: continua elegivel para votos, mas perde bonus e pode ser penalizado.
- Feedback aprovado depois do congelamento: nao entra no resultado congelado sem acao retroativa.
- Peso de juri alterado no meio da feira: novos eventos usam nova `scoreConfigVersion`.
- Voto anulado: ledger original permanece, novo evento de anulacao/revogacao explica ajuste.
- Ronda alterada depois de iniciar: eventos ja criados preservam `roundId` e `scoreConfigVersion`.
- Multiplicador final muito alto: deve aparecer claramente no ledger para auditoria.

## Checklist de implementacao segura

- [x] Definir `eventKey` oficial da feira.
- [x] Criar configuracao inicial `scoreConfigVersion=1`.
- [x] Criar rondas oficiais.
- [x] Garantir unicidade de voto por estudante/projeto/edicao.
- [x] Garantir unicidade de curso alcancado por projeto/edicao/curso.
- [x] Criar ledger de pontuacao do expositor.
- [x] Integrar votos de estudante ao ledger.
- [x] Integrar votos de juri ao ledger.
- [x] Integrar feedback qualificado.
- [x] Integrar funcoes de membros.
- [x] Integrar check-in de stand.
- [x] Integrar missoes.
- [x] Integrar streaks.
- [x] Integrar penalizacoes.
- [x] Criar ranking admin.
- [x] Criar ranking publico simplificado.
- [x] Criar congelamento.
- [x] Criar exportacao.
- [x] Criar testes unitarios de calculo.
- [x] Criar testes de concorrencia do bonus de curso.
- [x] Criar testes de permissao admin.
- [x] Criar testes de recalculo e lockedAt.

## Comunicacao para estudantes e expositores

Mensagem curta recomendada:

> O vencedor dos projetos sera definido por pontuacao auditavel. Cada voto conta, mas votos de cursos diferentes, avaliacao dos juris, feedbacks qualificados, missoes dos embaixadores, presenca organizada no stand e cumprimento das regras podem aumentar ou reduzir a pontuacao final.

Pontos que devem ser comunicados com clareza:

- Nao vence apenas quem tiver mais votos brutos.
- Jurados tem peso maior.
- Cursos diferentes ajudam mais.
- Membros nao podem votar no proprio projeto.
- Apenas 2 membros ficam no stand.
- Outros membros devem atuar como embaixadores.
- Penalizacoes podem reduzir pontos.
- Ranking final sera auditado pela organizacao.

## Estado final esperado

Ao concluir esta atualizacao, o UOR Connect deve conseguir:

- [x] calcular vencedor de projeto por pontuacao final auditada;
- [x] explicar cada ponto atribuido;
- [x] impedir votos duplicados e auto-votos;
- [x] valorizar diversidade de cursos;
- [x] usar voto de juri com peso configuravel;
- [x] registrar atividades de embaixadores;
- [x] aplicar rondas, multiplicadores e streaks;
- [x] aplicar bonus e penalizacoes;
- [x] congelar resultado final;
- [x] exportar ranking com transparencia;
- [x] manter separacao clara entre Passaporte Digital do estudante e Passaporte do Expositor.
