# Passaporte do Expositor na Minha Area - Design

## Decisao

O Passaporte do Expositor deve reutilizar o design existente do Passaporte Digital. Nao deve introduzir uma nova linguagem visual, novos cards decorativos ou novo modal.

## Experiencia

- A aba `Inicio` da `Minha Area` mostra o mapa do expositor para estudantes ligados a projetos aprovados/elegiveis, como responsavel ou membro confirmado.
- A aba `Desafio` continua dedicada ao Passaporte Digital.
- O bloco visual usa o mesmo padrao do mapa atual: hero/resumo, progresso circular, lista de missoes/etapas com conector, proxima etapa, selos e historico recente.
- Os dados visiveis incluem pontuacao do projeto, ranking, progresso, etapas, acoes continuas, oportunidades de bonus, selos desbloqueados e ultimos eventos de ganho/perda.
- O mapa nao deve parecer limitado a poucas etapas principais: abaixo da trilha devem existir blocos reaproveitados do Passaporte Digital para "Continuar a ganhar pontos" e "Bonus e missoes extras".
- Quando surgir um novo evento de pontuacao do expositor, a pagina usa o mesmo modal `scanCelebration`, o mesmo som e os mesmos efeitos de ganhar/perder pontos ja usados no Passaporte Digital.

## Dados

O backend deve expor um resumo protegido do Passaporte do Expositor do estudante autenticado:

- projetos ligados ao estudante;
- projeto ativo para o mapa;
- pontos atuais;
- ranking do projeto;
- etapas derivadas do ledger;
- acoes continuas/repetiveis derivadas do ledger;
- oportunidades extras de bonus e missoes derivadas do ledger;
- selos derivados de missoes, niveis e bonus;
- eventos recentes, incluindo pontos positivos, negativos e motivo.

## Fora do escopo

- Criar um novo design.
- Misturar pontos do Passaporte Digital com pontos do Expositor.
- Mostrar ranking individual interno de embaixadores ao publico geral.
- Permitir edicao de regras nesta tela.

## Criterios de aceite

- O visual reaproveita classes e estrutura do mapa do Passaporte Digital.
- Estudante sem projeto elegivel nao ve o mapa do expositor.
- Estudante com projeto elegivel ve etapas, pontos, ranking e selos.
- Estudante com projeto elegivel ve acoes repetiveis e bonus extras para entender que ha varias formas de continuar a pontuar.
- Evento positivo novo abre modal de ganho de pontos.
- Evento negativo novo abre modal de perda de pontos.
- Backend e frontend passam nos testes/build principais.
