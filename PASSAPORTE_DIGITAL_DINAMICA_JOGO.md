# Passaporte Digital UOR Connect - Dinamica do jogo

## Visao geral

O Passaporte Digital UOR Connect transforma a participacao do estudante no evento numa jornada interativa. Cada estudante autenticado tem um passaporte na Minha Area, com mapa de atividades, missoes, pontos, selos e ranking.

A logica central e simples: o estudante circula pelo evento, escaneia QR Codes oficiais e desbloqueia pontos conforme participa em workshops, visita expositores, responde desafios e interage com estudantes de outros cursos.

O QR deixa de ser apenas validacao de presenca. Ele passa a ser o mecanismo principal de jogo, descoberta e comprovacao de participacao real.

## Objetivo da experiencia

- Aumentar participacao real nas atividades.
- Levar estudantes aos workshops, palestras e stands.
- Incentivar interacao entre cursos diferentes.
- Dar visibilidade aos expositores.
- Criar uma experiencia tecnologica, jovem e divertida.
- Criar descoberta pela feira com QR surpresa espalhados em pontos estrategicos.
- Permitir premiar estudantes mais participativos com dados auditaveis.

## Conceito do mapa

O estudante ve um mapa de jornada no Passaporte Digital. Cada ponto do mapa representa uma missao.

Exemplo:

```txt
Entrada -> Workshop -> Stand -> Desafio do Expositor -> Networking -> Quiz -> Jornada Completa
```

Cada missao pode estar num destes estados:

- Bloqueada: ainda nao esta disponivel.
- Disponivel: ja pode ser concluida.
- Concluida: estudante cumpriu a acao.
- Expirada: o horario da atividade terminou.
- Em revisao: precisa de validacao administrativa ou regra extra.

## Identificacao do estudante

Sempre que um estudante escaneia um QR, o sistema deve identificar quem esta a realizar a acao atraves da sessao ativa.

Fluxo esperado:

1. Estudante abre o scanner ou link do QR.
2. Sistema verifica cookie/sessao autenticada.
3. Se estiver logado, registra a acao no passaporte.
4. Se nao estiver logado, redireciona para login.
5. Depois do login, retorna automaticamente para o QR escaneado.
6. Sistema conclui a missao se as regras forem cumpridas.

O QR nunca deve depender do nome digitado pelo estudante. A identidade vem da sessao e do numero de estudante.

## Tipos de QR

### QR de entrada no evento

Fica na entrada principal. Confirma presenca geral.

Pontuacao sugerida: `+10 pontos`

Regras:

- Conta apenas uma vez por estudante.
- Pode ter janela de horario.
- Deve registrar data, hora e origem do scan.

### QR de workshop ou palestra

Fica na entrada do auditorio ou sala onde decorre a atividade.

Pontuacao sugerida: `+20 pontos`

Regras:

- Conta apenas uma vez por atividade.
- Deve estar ativo apenas dentro do horario permitido.
- Pode ter tolerancia, por exemplo 15 minutos antes e 20 minutos depois do inicio.
- Deve permitir saber quais estudantes estiveram em cada workshop.

### QR de stand ou expositor

Fica no stand ou no passe do membro expositor.

Objetivo: validar visita ao stand e abrir desafio do expositor.

Pontuacao sugerida:

- Visita ao stand: `+10 pontos`
- Resposta correta ao desafio do expositor: `+15 pontos`

Regras:

- Visita conta uma vez por stand/projeto.
- O expositor pode cadastrar uma pergunta simples para o estudante responder.
- O estudante so ganha pontos do desafio se responder corretamente.
- O scan tambem ajuda a medir fluxo de visitantes por stand.

### QR de desafio do expositor

Ao escanear o QR de um expositor, o estudante pode receber uma pergunta criada pelo expositor.

Exemplo:

```txt
Qual problema o nosso projeto resolve?
A) Gestao de biblioteca
B) Pagamentos digitais
C) Controle de estoque
```

Pontuacao sugerida: `+15 pontos`

Regras:

- Cada estudante so pode pontuar uma vez por desafio de cada expositor.
- O expositor pode trocar a pergunta, mas o historico de respostas deve ser preservado.
- O sistema deve evitar respostas repetidas por tentativa infinita.

### QR de networking intercurso

Cada estudante tem um QR pessoal no seu passaporte. Outro estudante pode escanear esse QR para validar networking.

Pontuacao sugerida: `+10 pontos`

Regras:

- O estudante nao pode escanear o proprio QR.
- So pontua se os dois estudantes forem de cursos diferentes.
- O mesmo par de estudantes so pontua uma vez.
- O sistema registra estudante A, estudante B, cursos e data/hora.
- A interacao deve aparecer como missao concluida no mapa.

### QR surpresa pela feira

A feira pode ter QR Codes especiais espalhados em locais estrategicos: corredores, entrada de salas, banners, mesa do nucleo, zona de exposicao, mural do evento e pontos de passagem. A ideia e criar uma caca leve aos QR, incentivando exploracao e movimento.

Estes QR devem ter visual proprio, com moldura impressa no estilo UOR Connect e uma frase curta como:

```txt
Encontraste um sinal UOR.
Escaneia e descobre o efeito.
```

Tipos de QR surpresa:

- QR Bonus: adiciona pontos extras.
- QR Risco: tira pontos de forma limitada.
- QR Turbo: duplica um saldo definido pela regra.
- QR Fragmento: divide por 2 um saldo definido pela regra.

Pontuacao sugerida:

| Tipo | Efeito sugerido | Sensacao |
| --- | ---: | --- |
| QR Bonus comum | +5 a +10 pontos | descoberta rapida |
| QR Bonus raro | +20 a +30 pontos | achado especial |
| QR Risco | -5 a -10 pontos | surpresa controlada |
| QR Turbo | x2 no proximo bonus ou saldo bonus | momento de euforia |
| QR Fragmento | /2 no saldo bonus da caca | tensao divertida |

Regras importantes:

- QR surpresa nao deve mexer em presenca, certificados, workshops oficiais ou missoes obrigatorias.
- A recomendacao profissional e aplicar multiplicador/divisor ao saldo bonus da caca aos QR, nao ao total inteiro do Passaporte.
- QR que tira pontos nunca deve deixar estudante abaixo de zero.
- QR negativo deve ser raro e limitado por estudante.
- Cada QR surpresa deve contar uma vez por estudante.
- Admin deve poder pausar ou desativar qualquer QR surpresa durante o evento.
- Todos os efeitos devem aparecer no historico para evitar reclamacoes confusas.

Exemplos de mensagens:

```txt
UOR Pulse encontrado: +10 pontos.
UOR Turbo ativado: o proximo QR bonus vale a dobrar.
UOR Fragmento: o saldo bonus da caca foi dividido por 2.
UOR Risco: perdeste 5 pontos bonus, mas continuas na corrida.
```

## Pontuacao sugerida

| Acao | Pontos |
| --- | ---: |
| Check-in geral no evento | 10 |
| Check-in em workshop/palestra | 20 |
| Visita a stand/projeto | 10 |
| Desafio correto do expositor | 15 |
| Networking com estudante de outro curso | 10 |
| Quiz especial correto | 15 |
| QR surpresa comum | 5 a 10 |
| QR surpresa raro | 20 a 30 |
| QR risco | -5 a -10 |
| QR turbo | x2 no saldo definido |
| QR fragmento | /2 no saldo definido |
| Concluir uma trilha completa | 30 |

## Ranking

O ranking deve premiar participacao real, nao apenas volume de scans.

Fatores recomendados:

- Presenca no evento.
- Participacao em workshops.
- Numero de stands unicos visitados.
- Desafios corretos.
- Networking com cursos diferentes.
- Diversidade de atividades.
- Conclusao de trilhas.

O ranking deve evitar spam com:

- limite por tipo de acao;
- pontuacao unica por QR quando fizer sentido;
- bloqueio de scan proprio;
- verificacao de horario;
- deteccao de scans repetidos em intervalo muito curto.
- limite de QR surpresa por estudante;
- limite de efeitos negativos por estudante;
- separacao entre pontos oficiais e saldo bonus da caca.

## Selos e conquistas

Exemplos de selos:

- Presenca Confirmada: fez check-in no evento.
- Explorador de Stands: visitou pelo menos 5 stands.
- Mestre dos Workshops: participou em 2 ou mais workshops.
- Conector Intercurso: validou networking com estudante de outro curso.
- Desafiante: respondeu corretamente a desafios de expositores.
- Jornada Completa: concluiu todas as missoes principais.

## Experiencia na Minha Area

Exemplo de apresentacao:

```txt
Passaporte UOR Connect

4/8 missoes concluidas
95 pontos
Ranking: #8

Proxima missao:
Visita mais 2 stands e responde ao desafio de um expositor.
```

Elementos importantes:

- mapa visual da jornada;
- barra de progresso;
- pontuacao total;
- ranking;
- faixa compacta de telemetria no mobile com `Etapas`, `Bonus QR`, `Ranking` e `Progresso` na mesma linha;
- missoes disponiveis;
- historico de scans;
- selos conquistados;
- botao para abrir scanner QR.
- area de "Caca aos QR" com saldo bonus, efeitos ativos e ultimos achados.

### Barra compacta no mobile

No telemovel, o Passaporte deve evitar ocupar muito espaco antes do mapa. A faixa principal deve funcionar como uma telemetria curta:

```txt
Etapas 1/7 | Bonus QR 0 | Ranking #1 | Progresso 14%
```

Cada indicador deve ter:

- icone pequeno e consistente;
- cor de acento propria, sem transformar a tela numa paleta confusa;
- linha inferior animada quando houver progresso mensuravel;
- numeros com leitura rapida e sem quebra de linha;
- suporte a `prefers-reduced-motion`.

A funcao desta faixa e orientar rapidamente o estudante, nao competir com o mapa da jornada.

## Camada visual e animacao

O Passaporte deve parecer vivo, mas continuar leve no telemovel. A recomendacao e usar animacoes pequenas e funcionais:

- sprite/scanline no cartao principal para reforcar a ideia de QR e tecnologia;
- transicoes suaves quando uma missao muda de estado;
- progresso animado na barra da jornada;
- entrada em sequencia dos indicadores compactos no mobile;
- linhas de progresso dos indicadores com movimento curto e discreto;
- selos com microinteracao ao serem conquistados;
- Lottie ou GIF animado apenas em momentos especiais, como jornada completa, premio desbloqueado ou conquista rara;
- respeito a `prefers-reduced-motion` para utilizadores que preferem menos movimento.

Animacao nao deve substituir informacao. Todo estado importante precisa de texto, icone e contraste suficiente.

### Visual dos QR surpresa

O QR surpresa deve ter uma linguagem visual mais memoravel que os QR normais. A direcao recomendada e usar a identidade da logo UOR Connect: preto/institucional, branco, laranja como energia principal e pequenos acentos ciano, verde e violeta para tecnologia.

Sugestao de experiencia ao escanear:

1. O scanner confirma a leitura.
2. Surge um card escuro com borda laranja e scanline animado.
3. Um simbolo central pulsa como se fosse um chip/portal QR.
4. O efeito aparece com contador animado.
5. O historico mostra o antes/depois dos pontos.

Estados visuais:

- Bonus: brilho laranja/verde, particulas pequenas e contador subindo.
- Risco: alerta vermelho/laranja, mas com texto divertido e controlado.
- Turbo: efeito de duplicacao, duas ondas circulares e contador `x2`.
- Fragmento: efeito de quebra suave, contador `/2` e explicacao clara.

Exemplo de card:

```txt
[ UOR CONNECT ]
Sinal encontrado

QR TURBO
x2 no teu proximo bonus

Continua a explorar a feira.
```

As animacoes podem ser feitas com CSS, Lottie, GIF animado leve ou sprite animation. Para mobile, devem durar pouco e nunca bloquear o proximo scan.

## Experiencia na admin

A administracao deve ter uma area de controle do Passaporte Digital.

Funcionalidades:

- criar atividades e missoes;
- gerar QR Codes;
- definir horario valido;
- definir pontuacao;
- associar QR a workshop, stand, expositor ou networking;
- acompanhar ranking;
- ver logs de scans;
- detectar abuso;
- exportar vencedores;
- ver mapa de calor de participacao.
- criar QR surpresa com efeito, raridade, janela, limite e estado.
- acompanhar quais QR surpresa estao a gerar mais movimento.
- pausar efeitos negativos se a dinamica estiver a causar frustracao.

## Premios

Premio oficial recomendado para o vencedor principal:

- pagamento de 1 recurso no 2o semestre;
- certificado digital de destaque/participacao competitiva.

Este premio deve ser anunciado com regra clara antes do inicio da dinamica. O sistema deve apoiar a escolha do vencedor com ranking auditavel, mas o processamento financeiro do recurso deve continuar sob controle administrativo/financeiro da organizacao.

Premios ou reconhecimentos complementares podem ser atribuidos por categorias:

- estudante com mais pontos;
- estudante mais ativo em workshops;
- estudante que mais visitou stands;
- estudante com melhor networking intercurso;
- estudante que completou a jornada primeiro;
- turma ou curso com maior participacao.

## Nome do produto

Nome publico recomendado:

**Passaporte UOR Connect**

Nome interno:

**Jornada Interativa do Estudante**
