# Passaporte UOR Connect - Regras e estado

O Passaporte UOR Connect é a dinâmica de desafio da atividade. Ele mistura check-in, QR codes, interação com expositores, convites, rankings e prêmios.

## Princípios

- A experiência deve ser simples para o estudante.
- O mapa do desafio deve manter o design atual.
- Novas etapas devem complementar o fluxo sem alterar o estilo visual existente.
- O estudante não deve ver cards avançados antes de aceitar o passaporte.
- Pontos e bônus são a mesma coisa: tudo é `pontos`.

## Pontuação

- Aceitar o desafio concede pontos conforme a configuração da etapa.
- Convidar colegas pode conceder pontos por pessoa que entra pelo link.
- QRs podem adicionar ou remover pontos.
- Se um QR remove pontos, o desconto deve aparecer diretamente no saldo.
- Não deve existir linguagem separando `bônus` de `pontos`.

## Mapa do desafio

Ordem esperada das primeiras etapas:

1. Aceitar o desafio.
2. Convidar colegas.
3. Fazer check-in no evento via QR gerado na admin.

Depois entram as missões:

- Escanear QR de atividades.
- Interagir com projetos/expositores.
- Responder perguntas criadas pelos expositores.
- Missões cooperativas.
- Pistas encadeadas.
- Batalha de pontos.
- Recuperação inteligente.

## Convite e afiliado

Fluxo desejado:

1. Estudante copia o link de convite no mapa.
2. Pessoa convidada abre o link.
3. Antes de qualquer página, aparece um modal dizendo que foi convidada para o desafio por aquele estudante.
4. O modal tem duas escolhas:
   - Aceitar o desafio.
   - Preferir votar/conhecer projetos.
5. Se aceitar e já estiver logada como estudante UOR, entra no desafio.
6. Se aceitar e não estiver logada, faz login pelo fluxo correto.
7. O login do convite não deve permitir júri nem login por SMS genérico.
8. O estudante que convidou ganha pontos quando o convidado entra no desafio.

SMS de marco:

- Enviar aviso ao convidador quando atingir marcos como `+10`, `+20`, `+30`.
- A mensagem deve celebrar o marco sem parecer spam.

## QR surpresa

O QR surpresa não pode revelar se é risco ou prêmio antes do scan.

O estudante deve ver apenas que é uma surpresa. A consequência aparece depois.

## QRs e etapas na admin

A admin deve permitir ligar:

- QR gerado.
- Etapa do mapa.
- Tipo de missão.
- Pontos ganhos ou removidos.
- Obrigatoriedade ou opcionalidade.
- Regras de repetição.

## Expositores e perguntas

Os expositores devem criar perguntas para os estudantes porque:

- Obriga uma conversa real no stand.
- Faz o estudante entender o projeto antes de pontuar.
- Dá valor pedagógico ao desafio.
- Evita que a dinâmica vire apenas uma caça a QR.

Essa regra deve aparecer no manual do expositor com destaque visual violeta, por pertencer ao universo do desafio.

## Prêmios

Prêmios atuais:

- Pagamento de 1 recurso para vencedor elegível.
- Certificado digital para top 3 estudantes.
- 1 perfil Prime Video por 1 mês.
- 1 mês de perfil HBO.
- 1 mês de Duolingo Super.

## Proteções administrativas

A admin deve ter botões para:

- Reiniciar o desafio.
- Remover pontos e reinscrições.
- Remover todos os votos dos projetos.

Essas ações só devem ser executadas com confirmação via SMS para `+244937624785`.
