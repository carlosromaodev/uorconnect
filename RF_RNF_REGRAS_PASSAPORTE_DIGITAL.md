# RF, RNF e regras de negócio — Passaporte Digital da UOR Eventos

> **Classificação v2:** requisito normativo legado do produto UOR Eventos. Não define a visão do ecossistema UOR Connect. A autoridade de fronteira é [`SDD-003-UOR-EVENTOS.md`](docs/vision/uor-connect-v2/SDD-003-UOR-EVENTOS.md).

## Objetivo

Definir os requisitos funcionais, requisitos nao funcionais e regras de negocio do Passaporte Digital UOR Connect, uma experiencia gamificada baseada em QR Code, presenca, missoes, pontuacao, ranking e interacao entre estudantes, expositores e atividades do evento.

## Escopo

Inclui:

- QR de entrada no evento.
- QR de workshop/palestra.
- QR de stand/expositor.
- QR pessoal do estudante para networking intercurso.
- Desafios/perguntas de expositores.
- QR surpresa espalhados pela feira com bonus, penalidade e multiplicadores.
- Pontuacao e ranking.
- Mapa de jornada na Minha Area.
- Painel administrativo de missoes, QR, ranking e auditoria.
- Definicao do premio oficial e exportacao de vencedores.

Nao inclui nesta fase:

- Processamento financeiro automatico do premio.
- Integracao externa com sorteios.
- Comunicacao automatica por SMS/WhatsApp para vencedores, salvo quando implementada em modulo proprio.

## Requisitos funcionais

### RF-PDG-001 - Passaporte digital do estudante

Prioridade: Alta

O estudante autenticado deve ter acesso ao Passaporte Digital na Minha Area.

Checklist:

- [x] Mostrar pontuacao total.
- [x] Mostrar progresso da jornada.
- [x] Mostrar missoes disponiveis.
- [x] Mostrar missoes concluidas.
- [x] Mostrar selos conquistados.
- [x] Mostrar posicao no ranking quando permitido.
- [x] Disponibilizar scanner QR.

### RF-PDG-002 - Identificacao por sessao no scan

Prioridade: Critica

Ao escanear um QR, o sistema deve identificar o estudante pela sessao/cookie autenticado.

Checklist:

- [x] Se estiver logado, registrar scan diretamente.
- [x] Se nao estiver logado, redirecionar para login.
- [x] Depois do login, retornar para o QR escaneado.
- [x] Usar numero de estudante como chave principal.
- [x] Nunca usar nome como chave de identidade.

### RF-PDG-003 - Cadastro de missoes

Prioridade: Alta

A admin deve permitir criar e gerir missoes do Passaporte Digital.

Tipos de missao:

- `EVENT_CHECKIN`
- `WORKSHOP_CHECKIN`
- `STAND_VISIT`
- `EXHIBITOR_CHALLENGE`
- `NETWORKING_CROSS_COURSE`
- `SPECIAL_QUIZ`
- `FAIR_BONUS_QR`
- `FAIR_PENALTY_QR`
- `FAIR_MULTIPLIER_QR`
- `FAIR_DIVIDER_QR`
- `JOURNEY_COMPLETION`

Checklist:

- [x] Criar missao.
- [x] Editar missao.
- [x] Ativar/desativar missao.
- [x] Definir pontuacao.
- [x] Definir horario valido.
- [x] Definir limite de pontuacao por contexto via chave idempotente.
- [x] Associar missao a atividade, stand, expositor ou QR.

### RF-PDG-004 - Geracao de QR Codes

Prioridade: Alta

O sistema deve gerar QR Codes oficiais para missoes e entidades do evento.

Checklist:

- [x] Gerar QR de entrada do evento.
- [x] Gerar QR de workshop/palestra.
- [x] Gerar QR de stand/expositor.
- [x] Gerar QR pessoal do estudante.
- [x] Gerar QR especial de quiz.
- [x] Gerar QR surpresa espalhado pela feira.
- [x] Permitir revogar/desativar QR.
- [x] QR nao deve conter dados pessoais diretos.

### RF-PDG-005 - Check-in no evento

Prioridade: Alta

O estudante deve ganhar pontos ao escanear o QR de entrada do evento.

Regra base:

- Pontuacao sugerida: `10 pontos`

Checklist:

- [x] Registrar presenca geral.
- [x] Pontuar apenas uma vez por estudante.
- [x] Registrar data/hora.
- [x] Registrar origem do QR.

### RF-PDG-006 - Check-in em workshop/palestra

Prioridade: Alta

O estudante deve ganhar pontos ao escanear QR na entrada do auditorio/sala.

Regra base:

- Pontuacao sugerida: `20 pontos`

Checklist:

- [x] Associar QR a uma atividade.
- [x] Validar janela de horario quando a missao/QR tiver inicio, fim ou expiracao.
- [x] Pontuar uma vez por estudante por atividade.
- [x] Mostrar participacao no passaporte.
- [x] Permitir relatorio de presencas por atividade.

### RF-PDG-007 - Visita a stand/expositor

Prioridade: Alta

O estudante deve ganhar pontos ao escanear QR de stand ou passe do expositor.

Regra base:

- Pontuacao sugerida: `10 pontos por stand unico`

Checklist:

- [x] Associar QR ao projeto/stand/expositor.
- [x] Registrar visita unica por estudante e stand.
- [x] Mostrar stand visitado no mapa.
- [x] Permitir relatorio de visitantes por expositor.

### RF-PDG-008 - Desafio do expositor

Prioridade: Alta

Ao escanear o QR de um expositor, o estudante pode responder uma pergunta criada pelo expositor.

Regra base:

- Pontuacao sugerida: `15 pontos por resposta correta`

Checklist:

- [x] Expositor/admin cria pergunta.
- [x] Expositor/admin define resposta correta.
- [x] Estudante responde depois do scan.
- [x] Pontuar somente resposta correta.
- [x] Limitar tentativas.
- [x] Guardar historico de respostas.

### RF-PDG-009 - Networking intercurso

Prioridade: Alta

O estudante deve ganhar pontos ao escanear o QR pessoal de outro estudante de curso diferente.

Regra base:

- Pontuacao sugerida: `10 pontos`

Checklist:

- [x] Cada estudante tem QR pessoal.
- [x] Bloquear scan do proprio QR.
- [x] Comparar curso do scanner com curso do dono do QR.
- [x] Pontuar apenas se os cursos forem diferentes.
- [x] Pontuar apenas uma vez por par de estudantes.
- [x] Guardar historico da interacao.

### RF-PDG-010 - Ranking

Prioridade: Alta

O sistema deve calcular ranking dos estudantes com base nas regras do passaporte.

Checklist:

- [x] Ranking geral.
- [x] Ranking por curso.
- [x] Ranking por tipo de missao.
- [x] Ranking por periodo.
- [x] Ocultar dados sensiveis.
- [x] Permitir exportar vencedores.
- [x] Permitir recalculo auditavel.

### RF-PDG-011 - Selos e conquistas

Prioridade: Media

O sistema deve atribuir selos quando o estudante cumpre metas.

Exemplos:

- Presenca Confirmada.
- Explorador de Stands.
- Mestre dos Workshops.
- Conector Intercurso.
- Desafiante.
- Jornada Completa.

Checklist:

- [x] Definir regras de selos.
- [x] Mostrar selos no passaporte.
- [x] Registrar data de conquista.
- [x] Evitar selo duplicado.

### RF-PDG-012 - Auditoria de scans e pontos

Prioridade: Critica

Toda acao pontuada deve gerar registro auditavel.

Checklist:

- [x] Guardar estudante que escaneou.
- [x] Guardar QR escaneado.
- [x] Guardar tipo de missao.
- [x] Guardar pontos atribuidos.
- [x] Guardar data/hora.
- [x] Guardar motivo quando scan for recusado.
- [x] Permitir revisao pela admin.

### RF-PDG-013 - QR surpresa espalhados pela feira

Prioridade: Alta

A organizacao deve poder criar QR Codes especiais escondidos ou espalhados pela feira para gerar descoberta, movimento e diversao no evento. Estes QR nao substituem missoes principais; funcionam como camada extra de jogo.

Tipos de efeito:

- `ADD_POINTS`: adiciona pontos bonus.
- `SUBTRACT_POINTS`: remove uma quantidade limitada de pontos.
- `MULTIPLY_POINTS`: duplica uma pontuacao alvo ou saldo bonus.
- `DIVIDE_POINTS`: divide por 2 uma pontuacao alvo ou saldo bonus.

Checklist:

- [x] Admin cria QR surpresa com nome, descricao, efeito e valor.
- [x] Admin define se o QR fica visivel no mapa, semioculto ou secreto.
- [x] Admin define janela de validade e limite total de usos.
- [x] Admin define limite por estudante.
- [x] Sistema aplica efeito de forma auditavel no ledger.
- [x] Efeito negativo nunca pode deixar a pontuacao total abaixo de zero.
- [x] Multiplicador/divisor deve mostrar claramente qual saldo foi afetado.
- [x] Minha Area deve mostrar animacao especial ao encontrar QR surpresa.
- [x] Admin deve conseguir pausar/revogar QR surpresa imediatamente.

### RF-PDG-014 - Experiencia visual dos QR surpresa

Prioridade: Media

Os QR surpresa devem ter apresentacao animada, bonita e coerente com a identidade UOR Connect, usando a energia visual da logo: base institucional escura, laranja UOR como cor principal e acentos tecnologicos em verde, ciano e violeta para diferenciar efeitos.

Checklist:

- [x] Criar card animado de descoberta no estilo UOR Connect.
- [x] Usar scanline, brilho controlado, pulso circular ou sprite animation no momento do reveal.
- [x] Diferenciar visualmente bonus, penalidade, multiplicador e divisor.
- [x] Usar texto claro alem da cor para explicar o efeito.
- [x] Respeitar `prefers-reduced-motion`.
- [x] Animacoes devem ser leves para mobile.

## Requisitos nao funcionais

### RNF-PDG-001 - Seguranca

Prioridade: Critica

- [x] QR nao deve conter dados pessoais diretos.
- [x] Toda pontuacao deve depender de sessao autenticada.
- [x] Proibir scan do proprio QR no networking.
- [x] Validar permissoes administrativas para criar/editar missoes.
- [x] Permitir revogar QR comprometido.
- [x] Aplicar rate limit em scans.

### RNF-PDG-002 - Privacidade

Prioridade: Alta

- [x] Ranking publico nao deve expor telefone, email ou morada.
- [x] Perfil publico deve respeitar consentimentos.
- [x] Logs devem ter finalidade documentada.
- [x] QR pessoal do estudante deve usar token, nao numero de estudante em claro.

### RNF-PDG-003 - Performance

Prioridade: Alta

- [x] Scan deve responder rapidamente em mobile.
- [x] Ranking deve usar agregacoes no banco.
- [x] Evitar carregar listas completas para calcular ranking.
- [x] Paginar logs e relatorios.
- [x] Indexar campos de estudante, missao, QR, data e tipo de evento.

### RNF-PDG-004 - Confiabilidade

Prioridade: Alta

- [x] Scan nao deve duplicar pontos por clique repetido.
- [x] Regras de pontuacao devem ser idempotentes.
- [x] Historico de pontos nao deve ser apagado em alteracoes posteriores.
- [x] Deve ser possivel recalcular ranking a partir dos logs.

### RNF-PDG-005 - Usabilidade mobile

Prioridade: Alta

- [x] Scanner deve funcionar bem no telemovel.
- [x] Mapa deve ser responsivo.
- [x] Resumo do passaporte no mobile deve caber em uma linha com `Etapas`, `Bonus QR`, `Ranking` e `Progresso`.
- [x] Indicadores compactos devem manter leitura clara mesmo com valores como `1/7`, `#1` e `14%`.
- [x] Botoes devem ter tamanho adequado para toque.
- [x] Estados de sucesso/erro devem ser claros.
- [x] Se o estudante nao estiver logado, login deve manter retorno para o QR.

### RNF-PDG-006 - Acessibilidade

Prioridade: Media

- [x] Usar contraste adequado no mapa e ranking.
- [x] Feedback de scan deve ter texto alem de cor.
- [x] Componentes devem permitir navegacao por teclado.
- [x] Labels devem ser claros em filtros e formularios admin.

### RNF-PDG-007 - Observabilidade

Prioridade: Media

- [x] Registrar falhas de scan.
- [x] Registrar tentativas suspeitas.
- [x] Ter metricas de scans por minuto.
- [x] Ter relatorio de missoes com maior/menor adesao.

### RNF-PDG-008 - Diversao sem frustracao

Prioridade: Alta

- [x] QR que tiram pontos devem ter limite maximo de perda por estudante.
- [x] Pontos negativos devem ser apresentados como evento de jogo, nao como erro.
- [x] Penalidades nao devem remover conquistas oficiais, certificados, presenca ou missoes obrigatorias.
- [x] Divisor e multiplicador devem afetar apenas saldo definido pela regra, preferencialmente o saldo bonus da caca aos QR.
- [x] O estudante deve ver historico claro de cada efeito aplicado.
- [x] A admin deve poder desativar efeitos negativos durante o evento se houver reclamacoes ou abuso.

### RNF-PDG-009 - Identidade visual e animacao

Prioridade: Media

- [x] Usar identidade UOR Connect: preto/institucional, branco, laranja da marca e acentos tecnologicos.
- [x] Evitar visual generico; os cards devem parecer produto oficial do evento.
- [x] Indicadores do passaporte devem ter microanimacoes, acentos visuais e linhas de progresso sem ocupar espaco excessivo.
- [x] Animacao de reveal deve ser curta, responsiva e com alternativa reduzida.
- [x] Nao bloquear o uso do scanner por animacoes longas.
- [x] Feedback de bonus, penalidade, divisor e multiplicador deve ser compreensivel em menos de 2 segundos.

## Regras de negocio

### RN-PDG-001 - Identidade do estudante

- [x] O numero de estudante e a chave principal de identidade.
- [x] Nome nao pode ser usado como chave unica.
- [x] Scan so pontua quando existe estudante autenticado.
- [x] Se a sessao expirar, o estudante deve autenticar novamente.

### RN-PDG-002 - Pontuacao unica por contexto

- [x] Check-in geral pontua uma vez por evento.
- [x] Workshop pontua uma vez por estudante e atividade.
- [x] Stand pontua uma vez por estudante e stand.
- [x] Desafio pontua uma vez por estudante e expositor/pergunta.
- [x] Networking pontua uma vez por par de estudantes.

### RN-PDG-003 - Networking intercurso

- [x] Estudante nao pode pontuar escaneando o proprio QR.
- [x] Estudantes do mesmo curso nao geram pontos de networking intercurso.
- [x] Se algum curso estiver ausente, scan pode ser registrado sem pontos ou ficar em revisao.
- [x] O par A-B e B-A deve ser considerado o mesmo par para evitar duplicidade.

### RN-PDG-004 - Workshop/palestra

- [x] QR de workshop deve estar associado a uma atividade.
- [x] Pontuacao so vale dentro da janela definida.
- [x] Admin pode definir tolerancia antes/depois do horario.
- [x] Scan fora da janela deve gerar log sem pontos.

### RN-PDG-005 - Stand e expositor

- [x] QR de stand deve estar associado a uma submissao/projeto/expositor.
- [x] Visita ao stand nao exige resposta correta.
- [x] Desafio do expositor exige resposta correta.
- [x] Expositor nao deve conseguir pontuar como visitante do proprio stand se isso gerar conflito.

### RN-PDG-006 - Desafios e quiz

- [x] Cada pergunta deve ter resposta correta definida.
- [x] Admin pode aprovar/editar perguntas dos expositores.
- [x] Perguntas ofensivas, irrelevantes ou confusas devem ser recusadas.
- [x] Tentativas devem ser limitadas.
- [x] Alterar pergunta nao deve apagar historico anterior.

### RN-PDG-007 - Ranking e premios

- [x] Ranking deve considerar apenas pontos validos.
- [x] Pontos recusados ou suspeitos nao entram no ranking.
- [x] Premio oficial: pagamento de 1 recurso no 2o semestre e certificado digital.
- [x] Admin pode congelar ranking antes de anunciar vencedores.
- [x] Exportacao de vencedores deve ser auditada.
- [x] Em empate, criterio sugerido: maior diversidade de missoes, depois maior numero de workshops, depois menor horario de conclusao.

### RN-PDG-008 - Anti-fraude

- [x] Bloquear scans repetidos em curto intervalo.
- [x] Detectar quantidade anormal de scans por estudante.
- [x] Detectar QR fotografado e usado fora do local/horario quando houver janela ativa.
- [x] Permitir marcar scans como suspeitos.
- [x] Admin pode remover pontos fraudulentos sem apagar historico.

### RN-PDG-009 - Auditoria

- [x] Toda atribuicao de pontos deve gerar log.
- [x] Toda remocao/manual override de pontos deve gerar log administrativo.
- [x] Toda alteracao de regra de missao deve ser auditada.
- [x] Logs historicos devem ser preservados mesmo se uma missao for desativada.

### RN-PDG-010 - Privacidade no ranking

- [x] Ranking publico deve mostrar apenas nome aprovado ou nome abreviado.
- [x] Nao mostrar telefone, email, morada ou dados sensiveis.
- [x] Estudante deve poder ver o proprio detalhe completo.
- [x] Admin pode ver detalhe completo conforme permissao.

### RN-PDG-011 - QR surpresa, bonus e penalidades

- [x] QR surpresa pode adicionar pontos extras sem depender de atividade formal.
- [x] QR surpresa pode tirar pontos, mas apenas dentro do limite configurado pela organizacao.
- [x] QR divisor deve dividir por 2 apenas o saldo definido pela regra, recomendado: saldo de bonus da caca aos QR.
- [x] QR multiplicador deve duplicar apenas o saldo definido pela regra, recomendado: proximo bonus ou saldo de bonus da caca aos QR.
- [x] Pontos de presenca, certificados, workshops oficiais e missoes obrigatorias nao devem ser removidos por QR surpresa.
- [x] Cada QR surpresa deve ter chave idempotente para nao repetir efeito por clique/scan repetido.
- [x] Um estudante nao deve conseguir farmar o mesmo QR surpresa.
- [x] Admin deve poder definir QR raro, comum, secreto ou temporario.
- [x] QR surpresa expirado deve registrar tentativa sem alterar pontos.
- [x] Todos os efeitos devem entrar no historico do estudante e no painel admin.

### RN-PDG-012 - Design dos QR surpresa

- [x] Bonus deve usar feedback positivo com brilho laranja/verde e microcelebracao.
- [x] Penalidade deve usar feedback claro, divertido e curto, sem parecer erro tecnico.
- [x] Multiplicador deve ter animacao de duplicacao, pulso ou contador subindo.
- [x] Divisor deve ter animacao de fragmentacao controlada, com texto explicando o impacto.
- [x] O visual deve combinar com a logo UOR Connect e manter legibilidade em mobile.

## Modelo de dados sugerido

Entidades principais:

- `DigitalPassport`
- `PassportMission`
- `PassportQrToken`
- `PassportScan`
- `PassportPointLedger`
- `PassportBadge`
- `PassportStudentBadge`
- `PassportChallenge`
- `PassportChallengeAnswer`
- `PassportSurpriseQr`
- `PassportEffectLedger`

Campos importantes:

- estudante que escaneou;
- dono do QR quando aplicavel;
- tipo de missao;
- pontos;
- status do scan;
- motivo da recusa;
- data/hora;
- origem;
- token do QR;
- atividade/stand/expositor associado.
- tipo de efeito do QR surpresa;
- valor antes e depois do efeito;
- limite aplicado;
- raridade/visibilidade do QR surpresa.

## Fases de implementacao

### Fase 1 - Base do passaporte

- [x] Criar modelos de missoes, QR, scans e pontos.
- [x] Criar scanner autenticado.
- [x] Criar QR de entrada, workshop e stand.
- [x] Criar mapa basico na Minha Area.

### Fase 2 - Gamificacao

- [x] Criar desafios de expositores.
- [x] Criar networking intercurso.
- [x] Criar QR surpresa espalhados pela feira.
- [x] Criar selos.
- [x] Criar ranking.

### Fase 3 - Admin e auditoria

- [x] Criar painel administrativo do Passaporte.
- [x] Criar relatorios.
- [x] Criar auditoria de pontos.
- [x] Criar exportacao de vencedores.

### Fase 4 - Antifraude e refinamento

- [x] Criar deteccao de abusos.
- [x] Criar congelamento de ranking.
- [x] Criar recalculo auditavel.
- [x] Melhorar UX mobile e animacoes.
- [x] Criar animacoes oficiais dos QR surpresa no estilo UOR Connect.

## Implementacao local inicial - 2026-05-09

Fatia implementada na `Minha Area`:

- [x] Painel visual do Passaporte Digital com pontuacao, progresso e estado do ranking.
- [x] Mapa vertical responsivo de missoes com estados `Concluida`, `Disponivel` e `Bloqueada`.
- [x] Resumo mobile compacto em uma linha: `Etapas`, `Bonus QR`, `Ranking` e `Progresso`.
- [x] Cada indicador do resumo tem acento visual proprio, linha de progresso e entrada animada.
- [x] Missoes calculadas a partir de presenca e historico de scans existentes.
- [x] Selos visuais iniciais por marco de participacao.
- [x] Botao direto para abrir o scanner QR.
- [x] Animacao leve de rota, progresso e indicadores, respeitando `prefers-reduced-motion`.

Fatia backend implementada na sequencia:

- [x] Modelos `PassportMission`, `PassportScan`, `PassportPointLedger`, `PassportBadge` e `PassportStudentBadge`.
- [x] Endpoint `GET /passport/me` com pontos, progresso, ranking, missoes, selos e scans recentes.
- [x] Endpoint `GET /passport/admin/overview` para visao operacional e ranking.
- [x] Endpoints admin para listar/criar/editar missoes.
- [x] Scanner `/attendance/scan` integrado ao ledger do Passaporte.
- [x] Tipos de QR preparados para workshop, stand, desafio, networking e quiz.
- [x] Frontend da `Minha Area` ligado ao resumo real do Passaporte com fallback visual.
- [x] Aba `Passaporte` na admin com resumo, ranking, missoes e criacao de novas missoes.
- [x] Cadastro de QR na aba Check-in reconhece os tipos do Passaporte e permite associar uma missao especifica.
- [x] QR pessoal de networking criado automaticamente para cada estudante autenticado.
- [x] Networking valida dono do QR, bloqueia proprio scan, compara curso e usa par A-B/B-A como a mesma chave.
- [x] Modelos `PassportChallenge` e `PassportChallengeAnswer` criados para perguntas, tentativas e historico.
- [x] Scan de desafio/quiz apenas libera a pergunta; os pontos so entram depois da resposta correta.
- [x] Admin do Passaporte cria e pausa desafios/quiz, podendo associar missao e QR de acao.
- [x] Minha Area exibe QR pessoal de networking e formulario de resposta quando um QR de desafio e escaneado.

Pendencias para fechar o modulo:

- [x] Criar modelo proprio de dados do Passaporte no backend.
- [x] Criar ranking real por pontos auditaveis.
- [x] Criar painel admin visual para missoes, QR e pontuacao.
- [x] Criar controlos antifraude avancados no painel admin.
- [x] Persistir selos e pontos em ledger, nao apenas calcular visualmente.
- [x] Implementar desafio com pergunta/resposta correta antes de pontuar em cenarios competitivos.
- [x] Implementar QR pessoal real para networking intercurso com dono do QR e bloqueio do proprio scan.
- [x] Implementar QR surpresa com bonus, penalidade, divisor e multiplicador.
- [x] Implementar animacao/reveal visual dos QR surpresa.
- [x] Implementar congelamento/exportacao de vencedores.

## Sequencia implementada - 2026-05-09

Backend:

- [x] Criada migration `20260509152000_passport_challenges_networking` para desafios e respostas.
- [x] Atualizados `schema.prisma` e `schema.deploy.prisma` com `PassportChallenge` e `PassportChallengeAnswer`.
- [x] Criado `GET /passport/me/networking-qr` para entregar o QR pessoal de networking com token seguro.
- [x] Criado `POST /passport/challenges/:id/answer` para validar respostas e pontuar apenas quando corretas.
- [x] Criados endpoints admin `GET/POST/PATCH /passport/admin/challenges`.
- [x] Scanner `/attendance/scan` agora devolve `CHALLENGE_READY` para desafios/quiz em vez de pontuar no scan.
- [x] Pontuacao de networking usa `NETWORKING_PAIR` com par ordenado para impedir duplicidade A-B/B-A.

Frontend:

- [x] Tipos e client API adicionados para QR de networking, desafios e respostas.
- [x] `Minha Area` carrega e mostra o QR pessoal de networking.
- [x] `Minha Area` permite responder desafio logo depois do scan.
- [x] `/validar/qra_*` reconhece QR de acao: se houver sessao, registra o scan; se nao houver, mostra entrada com retorno para o QR.
- [x] Aba admin `Passaporte` permite criar desafios/quiz, listar os ultimos e ativar/desativar.
- [x] Feedback visual de scan diferencia sucesso, erro, desafio e networking.
- [x] Modelos `PassportSurpriseQr` e `PassportSurpriseEffectLedger` adicionados para QR surpresa.
- [x] QR surpresa suporta `ADD_POINTS`, `SUBTRACT_POINTS`, `MULTIPLY_BONUS` e `DIVIDE_BONUS`.
- [x] Penalidade, multiplicador e divisor atuam sobre o saldo bonus da caca aos QR.
- [x] Endpoint admin `GET/POST/PATCH /passport/admin/surprise-qrs` criado.
- [x] Scanner `/attendance/scan` aplica QR surpresa e devolve reveal animavel.
- [x] `Minha Area` mostra card animado de reveal e historico da caca aos QR.
- [x] Aba admin `Passaporte` cria, lista, copia link e pausa QR surpresa.

## Fechamento operacional - 2026-05-09

Backend:

- [x] Criada migration `20260509180000_passport_admin_closure` para revisao de scans e congelamento de ranking.
- [x] `PassportScan` passou a guardar `reviewStatus`, `reviewedAt`, `reviewedByStudentNumber` e `reviewNote`.
- [x] Criado modelo `PassportRankingFreeze` para snapshot auditavel do ranking antes do anuncio de vencedores.
- [x] Criado `GET /passport/admin/reports` com ranking por curso, tipo de missao, periodo, presencas por atividade e visitantes por expositor.
- [x] Criado `GET /passport/admin/logs` com paginacao, filtros e dados de revisao.
- [x] Criado `POST /passport/admin/recalculate` com log administrativo.
- [x] Criado `POST /passport/admin/ranking/freeze` com snapshot e log administrativo.
- [x] Criado `GET /passport/admin/winners/export` com premio oficial e auditoria de exportacao.
- [x] Criado `PATCH /passport/admin/scans/:id/review` para marcar scans como `AUTO`, `OK`, `SUSPECT` ou `REJECTED`.
- [x] Criado `POST /passport/admin/ledger/:id/revoke` para remover pontos fraudulentos sem apagar historico.
- [x] Ranking usa desempate por pontos, diversidade de missoes, workshops, horario de conclusao e numero de estudante.
- [x] Visita ao proprio stand pelo responsavel ou membro confirmado do expositor registra scan sem pontuar.
- [x] Relatorio operacional mostra scans por minuto, scans suspeitos e estudantes com volume anormal recente.

Frontend/admin:

- [x] Client API do Passaporte ganhou relatorios, recalculo, congelamento e exportacao de vencedores.
- [x] Aba admin `Passaporte` mostra metricas operacionais, estado do ranking e acoes de recalcular/congelar/exportar.
- [x] Exportacao baixa CSV local com vencedores, pontuacao e premio oficial.
- [x] O painel mantem o foco administrativo: missoes, QR surpresa, desafios, ranking e auditoria operacional.

## Votacao ao vivo profissional - 2026-05-10

Objetivo: transformar a aba `Votacao` da admin numa central de resultados em tempo real com leitura emocional, operacional e auditavel, inspirada em transmissao de eleicoes, placares esportivos e dashboards de eventos ao vivo.

Checklist:

- [x] Mostrar resultado como corrida viva, nao apenas tabela numerica.
- [x] Exibir projeto lider, percentagem da corrida e vantagem sobre o segundo colocado.
- [x] Mostrar votos totais, cursos ativos, votos recentes, visitantes por link e jogadores no Passaporte.
- [x] Exibir feed de votos com estudante, numero de estudante, curso e projeto votado para auditoria interna.
- [x] Exibir pulso por curso para perceber quais turmas/cursos estao a participar mais.
- [x] Mostrar momentos narrativos ao vivo: lideranca atual, curso em destaque e votos recentes.
- [x] Cruzar votos com visitas por cookie nas paginas individuais dos projetos.
- [x] Manter fundo claro, texto escuro e acentos UOR para boa leitura.
- [x] Usar animacoes leves: pulso ao vivo, barras de corrida e microtransicoes nos cards.
- [x] Respeitar `prefers-reduced-motion`.
- [x] Evitar expor telefone, email ou morada no painel de votacao.
- [x] Usar numero de estudante como identidade forte na auditoria.

Validacao local:

- [x] `npm --prefix backend run prisma:prepare:postgres`
- [x] `npm --prefix backend run prepare`
- [x] `npm --prefix backend run lint`
- [x] `npm --prefix backend run build`
- [x] `npm --prefix frontend run lint`
- [x] `npm --prefix frontend run build`

## Painel publico de votacao ao vivo - 2026-05-10

Objetivo: separar a votacao que pode ser exibida ao publico da auditoria interna da admin. O painel publico deve funcionar como ecra de transmissao para sala, feira ou projetor, com leitura rapida, emocao e privacidade.

Checklist:

- [x] Criar rota publica `/votacoes/ao-vivo` sem navbar/footer para exibicao em ecra grande.
- [x] Criar endpoint publico anonimizado `GET /interactions/votes/live`.
- [x] Mostrar lider, vantagem, percentagem da corrida e votos totais.
- [x] Mostrar podium dos 3 primeiros projetos.
- [x] Mostrar corrida dos projetos com barras e votos recentes.
- [x] Mostrar pulso por curso sem expor estudante individual.
- [x] Mostrar momentos ao vivo anonimizados por curso e projeto.
- [x] Remover nome, email e numero de estudante do painel publico.
- [x] Manter feed completo de auditoria apenas na admin.
- [x] Adicionar botao `Modo publico` na aba `Votacoes` da admin.
- [x] Atualizar automaticamente em intervalo curto sem exigir refresh manual.
- [x] Usar fundo claro, texto escuro e acentos da marca para leitura em projetor.
- [x] Respeitar animacao reduzida quando o sistema pedir menos movimento.
