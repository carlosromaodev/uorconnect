# Passaporte Digital - QR Polivalente Dinamico

## Objetivo

Consolidar a evolucao do QR surpresa do Passaporte Digital para um modelo mais rico, auditavel e profissional: cada QR impresso passa a ser um ponto de jogo polivalente, capaz de aplicar diferentes efeitos no momento do scan.

O estudante nao deve saber antes do scan se o QR vai dar pontos, tirar pontos, multiplicar, dividir, revelar pista ou ativar uma recuperacao. A surpresa e parte da experiencia. A organizacao, por outro lado, precisa ter controlo total, simulacao, auditoria e limites para evitar injustica, reclamacoes ou falhas durante a atividade.

## Decisao principal

O estado dinamico muda por QR individual.

O lote serve para criar, numerar, imprimir e gerir muitos QR de uma vez, mas a inteligencia de cada QR e independente.

Exemplo:

- `QR-001` teve 4 perdas e pode mudar para uma fase mais favoravel.
- `QR-002` continua no seu proprio estado.
- `QR-003` pode estar pausado sem afetar os outros.

Isto evita que um QR muito usado altere indevidamente o comportamento de todos os outros QR do lote.

## Estado atual do sistema

O sistema ja tem uma base aproveitavel:

- QR surpresa com efeitos fixos.
- Lote numerado de QR surpresa.
- PDF de lote.
- `displayCode`, `batchCode`, `dynamicRulesJson` e `printedAt`.
- Ledger de efeitos por estudante.
- Integracao com o scanner e modal do Passaporte Digital.
- Regras basicas de limite por estudante e limite total.
- Regra simples de conversao: depois de X perdas, um QR de risco pode virar bonus.

Esta spec nao cria um segundo sistema. Ela evolui o QR surpresa existente para um motor de resolucao dinamica.

## Conceito

### QR polivalente

Cada QR impresso passa a ser criado como `UNIVERSAL_DYNAMIC`, mesmo que continue reaproveitando internamente os tipos atuais do scanner.

Um QR polivalente tem uma identidade estavel:

- id;
- token;
- codigo impresso, por exemplo `QR-001`;
- lote;
- estado ativo/pausado;
- regras de limite;
- historico de scans;
- configuracao de probabilidades;
- historico de efeitos aplicados.

O efeito nao fica fixo no QR. O efeito e resolvido no momento do scan.

### Motor de resolucao

Quando o estudante escaneia o QR, o backend calcula qual efeito sera aplicado. O calculo usa:

- estado atual daquele QR;
- quantidade de perdas naquele QR;
- quantidade de ganhos naquele QR;
- saldo atual do estudante;
- historico recente do estudante;
- limites de perdas por estudante;
- quantidade de vezes que o estudante ja usou aquele QR;
- janela de horario;
- configuracao administrativa;
- semente auditavel para a escolha aleatoria.

O resultado final deve ser guardado no ledger com todos os dados usados na decisao.

## Efeitos suportados no MVP

O MVP deve suportar estes efeitos, todos disponiveis para qualquer QR polivalente:

| Efeito | Descricao | Regra segura |
| --- | --- | --- |
| `ADD_POINTS` | adiciona pontos ao Passaporte Digital | respeita teto de pontos de QR surpresa |
| `SUBTRACT_POINTS` | remove pontos | respeita limite de perda por estudante e por QR |
| `MULTIPLY_POINTS` | multiplica saldo elegivel | usa teto e nao multiplica saldo total sem limite |
| `DIVIDE_POINTS` | divide saldo elegivel | nunca cria saldo invalido |
| `NEUTRAL_HINT` | nao altera pontos, mas revela pista | usado quando o sistema quer reduzir frustracao |
| `RECOVERY_POINTS` | recupera parte de perdas anteriores | usado para saldos negativos ou recuperacao controlada |

Os nomes internos podem reaproveitar os efeitos existentes quando fizer sentido:

- `MULTIPLY_BONUS` pode evoluir para `MULTIPLY_POINTS` com escopo controlado.
- `DIVIDE_BONUS` pode evoluir para `DIVIDE_POINTS` com escopo controlado.

## Estado individual de cada QR

Cada QR deve ter contadores e estado derivados do ledger:

- total de scans validos;
- total de estudantes unicos;
- total de efeitos positivos;
- total de efeitos negativos;
- total de efeitos neutros;
- soma de pontos dados;
- soma de pontos removidos;
- ultima mudanca de comportamento;
- ultimo efeito aplicado;
- taxa de repeticao;
- estudantes bloqueados por limite.

O estado pode ser calculado do ledger ou materializado em tabela auxiliar se a performance exigir.

## Regra dinamica recomendada

Cada QR usa uma tabela de probabilidades ajustavel:

```txt
Base:
50% dar pontos
25% tirar pontos
10% multiplicar
10% dividir
5% pista neutra
```

Depois, o motor ajusta por estado individual:

```txt
Se este QR ja causou 4 perdas validas:
70% dar pontos
10% tirar pontos
10% multiplicar
5% dividir
5% pista neutra
```

```txt
Se este QR ja deu muitos pontos seguidos:
35% dar pontos
25% tirar pontos
15% multiplicar
15% dividir
10% pista neutra
```

```txt
Se o estudante ja perdeu 2 vezes no dia:
0% perda pesada
maior chance de pista, bonus pequeno ou recuperacao
```

Esta regra mantem o jogo imprevisivel, mas evita uma experiencia injusta.

## Aleatoriedade auditavel

O resultado deve parecer aleatorio para o estudante, mas precisa ser explicavel para a organizacao.

Cada decisao deve guardar:

- `resolverVersion`;
- `seed`;
- `randomRoll`;
- pesos antes do ajuste;
- pesos depois do ajuste;
- efeito escolhido;
- valor calculado;
- motivo da escolha;
- saldo antes;
- saldo depois;
- limites aplicados;
- snapshot do estado individual do QR.

A semente pode ser derivada de:

```txt
studentNumber + qrId + qrActionScanId + scanTimestampBucket + serverSecret
```

Isto impede manipulacao simples e permite reconstituir a decisao se houver reclamacao.

## PDF de impressao em lote

O PDF de lote deve ter dois tipos de pagina:

1. Paginas com QR numerados.
2. Paginas de arte e explicacao do desafio.

### Paginas com QR

Cada QR deve exibir:

- codigo grande, por exemplo `QR-001`;
- QR Code;
- texto curto: `Escaneia no Passaporte Digital`;
- aviso curto: `O efeito e revelado no telemovel`;
- marca UOR Connect;
- indicacao visual de recorte quando necessario.

O PDF deve permitir definir:

- quantidade de QR;
- prefixo;
- numero inicial;
- quantidade de QR por pagina;
- se inclui paginas explicativas;
- frequencia das paginas explicativas.

### Paginas explicativas entre os QR

Entre cada 3 paginas de QR, o PDF deve inserir 1 pagina de arte explicando o desafio.

Exemplo:

```txt
Pagina 1: QR
Pagina 2: QR
Pagina 3: QR
Pagina 4: Explicacao do desafio
Pagina 5: QR
Pagina 6: QR
Pagina 7: QR
Pagina 8: Explicacao do desafio
```

Tambem pode existir uma primeira pagina de abertura antes dos QR quando o admin marcar essa opcao.

### Conteudo das paginas explicativas

As paginas explicativas sao para estudantes que ainda nao se inscreveram ou ainda nao entenderam o desafio.

Devem explicar:

- o que e o Passaporte Digital;
- como entrar no site;
- que e necessario fazer login oficial;
- que o QR pode premiar ou desafiar;
- que os pontos aparecem na Minha Area;
- que alguns QR podem revelar pistas;
- que repetir o mesmo QR pode nao dar novos pontos;
- que o ranking e auditado pela organizacao;
- que os efeitos nao mexem em certificados ou presencas oficiais.

Texto base:

```txt
Encontraste um QR do Passaporte Digital UOR Connect.

Entra em uorconnect.space, faz login, abre Minha Area e participa no desafio.
Cada QR pode revelar pontos, pistas, bonus ou pequenos riscos. O resultado so aparece depois do scan.

Explora a feira, visita stands, participa em palestras, interage com colegas e acompanha o teu ranking.
```

### Direcao visual das paginas explicativas

As paginas explicativas devem ter arte propria, mas alinhada ao sistema:

- identidade UOR Connect;
- preto, branco e laranja como base;
- acentos pequenos em verde, ciano ou violeta para estados de jogo;
- titulo grande e direto;
- passos curtos;
- QR ou URL do site principal;
- layout legivel em impressao A4;
- sem revelar quais QR dao ou tiram pontos.

Essas paginas devem parecer cartazes de jogo, nao paginas tecnicas.

## Admin

A area admin deve permitir:

- criar lote de QR polivalente;
- definir quantidade;
- definir prefixo e numero inicial;
- definir paginas explicativas no PDF;
- definir frequencia das paginas explicativas;
- definir limite por estudante;
- definir limite total por QR;
- definir teto de perda por estudante;
- definir probabilidades base;
- definir regras de ajuste por QR individual;
- pausar QR individual;
- pausar lote inteiro;
- simular resultados antes de imprimir;
- ver historico por QR;
- ver estudantes afetados;
- exportar ledger.

## Experiencia do estudante

O estudante deve sentir que esta num jogo, mas sem confusao.

Quando escaneia:

- se nao estiver logado, vai para login e volta ao QR;
- se estiver logado, recebe modal de revelacao;
- efeito positivo usa animacao e som de ganho;
- efeito negativo usa animacao e som de perda controlada;
- efeito neutro usa animacao de pista;
- historico mostra o que aconteceu;
- saldo atualiza imediatamente.

Mensagens devem ser em portugues e sem termos tecnicos.

Exemplos:

```txt
Boa descoberta: ganhaste +15 pontos.
```

```txt
Este QR trouxe risco: perdeste 5 pontos, mas ainda estas na corrida.
```

```txt
Pista revelada: procura um QR perto da zona dos projetos.
```

```txt
Este QR ja foi descoberto por ti. Continua a explorar a feira.
```

## SMS e WhatsApp

As notificacoes devem continuar suspensas fora da janela oficial da atividade, conforme decisao anterior.

Quando forem ativadas, podem ser usadas para:

- avisar ganho importante;
- avisar perda e sugerir recuperacao;
- mandar pista depois de perda;
- mandar pista depois de marco de pontos;
- chamar o estudante para explorar outra zona.

As mensagens devem parecer humanas, curtas e claras.

Exemplo:

```txt
UOR Connect: esse QR foi arriscado, mas ha pistas no jogo. Procura um QR numerado perto dos stands e tenta recuperar pontos.
```

## Recuperacao de pontos

A recuperacao paga de `300 Kz` por `60 pontos` deve continuar controlada e revisada pela organizacao.

Regra recomendada:

- so aparece para estudante com saldo negativo;
- nao deve criar vantagem acima de zero sem aprovacao explicita;
- deve gerar pedido pendente;
- admin confirma pagamento;
- ledger registra recuperacao com valor, estudante, data e responsavel.

## Anti-abuso

O motor deve proteger contra:

- scan repetido do mesmo QR em massa;
- troca de contas no mesmo dispositivo;
- uso fora de horario;
- uso por estudantes sem login oficial;
- QR pausado;
- tentativa de manipular URL;
- estudante tentando prever efeitos;
- erros de concorrencia em scans simultaneos.

Toda acao bloqueada deve retornar erro em portugues.

## Testes obrigatorios

### Unitarios

- resolver escolhe efeito conforme pesos base;
- resolver muda comportamento depois de X perdas naquele QR;
- mudanca de `QR-001` nao afeta `QR-002`;
- efeito negativo respeita limite por estudante;
- multiplicador respeita teto;
- divisor nunca gera saldo invalido;
- seed e metadata sao gravados.

### Integracao

- scan cria ledger de efeito e ledger de pontos;
- scan repetido respeita limite;
- QR pausado nao aplica efeito;
- lote cria codigos numerados unicos;
- PDF gera paginas explicativas na frequencia correta.

### Carga

Simular pelo menos:

- 1.000 scans em um lote;
- 10.000 scans distribuidos por varios QR;
- scans simultaneos no mesmo QR;
- estudantes repetindo QR ja usado;
- muitos estudantes no mesmo minuto.

### PDF

- `pdftotext` deve encontrar codigos impressos;
- o numero de QR no PDF deve bater com a quantidade criada;
- a pagina explicativa deve aparecer apos cada 3 paginas de QR;
- URL/site do desafio deve estar legivel;
- QR deve ser escaneavel depois de renderizado.

## Criterios de aceite

- Admin consegue criar lote de QR polivalente.
- Cada QR do lote tem estado individual.
- Cada QR pode aplicar qualquer efeito suportado.
- O efeito ativo e decidido no scan por motor auditavel.
- O sistema guarda pesos, seed, efeito e saldo antes/depois.
- PDF de lote inclui paginas explicativas entre grupos de paginas de QR.
- Estudante nao inscrito entende como entrar no desafio lendo a pagina de arte.
- Estudante inscrito ve modal, som e historico corretamente.
- Testes unitarios, integracao, PDF e carga cobrem o fluxo principal.

## Fora do escopo deste MVP

- Ranking por dinheiro pago.
- QR que altera certificado ou presenca oficial.
- Efeitos sem limite de pontos.
- Sorteio sem auditoria.
- Alteracao retroativa silenciosa de ledger ja aplicado.
- Revelar antecipadamente se um QR esta favoravel ou arriscado.

## Proxima etapa

Depois de aprovada esta spec, o proximo passo e criar o plano de implementacao com tarefas pequenas:

1. Modelo de regras dinamicas por QR.
2. Motor de resolucao auditavel.
3. Evolucao do PDF de lote com paginas explicativas.
4. Admin para configurar probabilidades e simulacao.
5. Testes de escala e concorrencia.
6. Deploy controlado.
