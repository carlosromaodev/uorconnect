# UOR Connect - Estado atual do projeto

Atualizado em: 2026-05-12
Ambiente principal: nova VPS `178.105.109.96`

Esta nota resume o estado atual do UOR Connect depois das últimas correções, decisões de produto, ajustes de design, regras do desafio, PDFs, admin, projetos, cursos e deploy.

## Visão geral

O UOR Connect é a plataforma principal da atividade, reunindo:

- Página pública com projetos, cursos, palestrantes, destaques e publicidade do Passaporte UOR Connect.
- Área do estudante, com perfil, projetos, credenciais, inscrições, desafio/passaporte e submissões.
- Área administrativa, com gestão de projetos, cursos, estudantes, SMS, relatórios, QRs, votações, passaporte, credenciais e conteúdos.
- Backend com API, banco de dados, geração de PDFs, regras de pontuação, autenticação, SMS, relatórios e integrações operacionais.

O projeto já foi migrado para a nova VPS mais potente. A VPS antiga continua sendo referência histórica apenas quando for necessário recuperar dados antigos ou comparar estado anterior.

## Produção e infraestrutura

- Nova VPS: `178.105.109.96`.
- Caminho do projeto em produção: `/opt/uorconnect`.
- Docker Compose de produção: `/opt/uorconnect/deploy/docker-compose.prod.yml`.
- Arquivo de ambiente de produção: `/opt/uorconnect/deploy/.env`.
- API: `https://api.uorconnect.space`.
- Site: `https://uorconnect.space`.
- Admin: `https://admin.uorconnect.space`.
- Health check usado após deploy: `https://api.uorconnect.space/health`.
- Backup diário configurado no servidor às `02:15`, usando o script em `/opt/uorconnect/scripts/backup-postgres.sh`.

Serviços esperados na VPS:

- `postgres`
- `backend`
- `frontend`
- `caddy`
- `evolution-api`
- `redis`

## Última atualização enviada para a VPS

A última subida para a VPS incluiu a correção do relatório geral da admin:

- Cálculos financeiros com `decimal.js`.
- Leitura mais robusta de valores em Kz/AOA, incluindo formatos como `25.000 Kz`, `25,000 Kz` e valores decimais.
- Exclusão de projetos recusados da receita prevista e da receita pendente.
- Exclusão de submissões eliminadas dos cálculos principais.
- Apresentação de projetos recusados numa página compacta e separada.
- Gráficos com escala coerente para crescimento, finanças e volume.
- Testes automatizados para os cálculos e para o PDF do relatório.

Verificações locais feitas antes do deploy:

- Testes do relatório: passaram.
- Build do backend: passou.

Verificações em produção após o deploy:

- Backend recriado no Docker Compose.
- Container `backend` ficou em estado `healthy`.
- `https://api.uorconnect.space/health` respondeu `{"status":"ok"}`.

## Frontend

O frontend é a experiência pública e administrativa do UOR Connect. As áreas mais trabalhadas foram:

- Home pública.
- Minha Área.
- Admin Workspace.
- Página de projetos.
- Página de submissão de expositor.
- Credenciais.
- Desafio/passaporte.
- Fluxo de convite.

Principais decisões e ajustes:

- O design novo deve ser preservado. Alterações pedidas pelo utilizador devem ser feitas sem mudar estilo quando o pedido for apenas responsividade ou lógica.
- O card do Passaporte UOR Connect foi incluído na home, seguindo a opção visual aprovada pelo utilizador.
- O logo oficial deve ser o `logoworconnect` presente em `public`, sem fundo branco e sem voltar ao logotipo antigo.
- Metadados de partilha/social preview foram ajustados para usar o logotipo novo.
- O fluxo de convite deve mostrar primeiro o modal profissional de convite, antes de qualquer redirecionamento para Minha Área.

## Backend

O backend concentra:

- Autenticação.
- Perfis.
- Projetos/expositores.
- Cursos.
- Pagamentos.
- Passaporte/desafio.
- Votos.
- SMS.
- Relatórios.
- Geração de PDFs.
- Uploads e recuperação de imagens.

Pontos importantes já tratados:

- Correções de erros de referência no frontend, como variáveis usadas antes da inicialização.
- Correções de imports ausentes, como ícones não importados.
- Correções de falhas de conexão local quando o backend não estava rodando em `127.0.0.1:3333`.
- Ajustes de endpoints e regras para manter dados consistentes entre frontend e backend.

## Projetos e expositores

O fluxo de projeto/expositor passou por várias correções de regra.

### Regras atuais

- Um projeto eliminado deixa de contar nas verificações principais.
- Confirmação de presença é por projeto, não global.
- Se um estudante submete um projeto, a confirmação dos membros afeta apenas aquele projeto.
- Um projeto recusado já não deve exigir confirmação de membros para desbloquear ações que não fazem sentido depois da recusa.
- Perfil público aprovado e confirmação de presença são coisas diferentes.
- A confirmação de presença do grupo não deve ser confundida com aprovação de perfil público.
- Membros do grupo, além do responsável, devem conseguir ver o projeto na sua Minha Área.
- Membros do grupo também podem baixar o manual do expositor quando o projeto cumprir os requisitos.
- O estudante que submete o projeto entra automaticamente como primeiro membro da equipa.
- O limite de membros foi ajustado para permitir até 11 membros.

### Formulário de submissão

Foram simplificados textos no frontend para reduzir a complexidade percebida:

- `Nome da candidatura` virou `Nome do projeto`.
- `Descrição` virou `Descrição do projeto`.
- O bloco `Representante da equipa` foi removido do fluxo visual quando não era necessário.
- A área de equipa passou a orientar melhor o utilizador.
- O placeholder dos membros deve seguir a ordem: primeiro membro, segundo membro, terceiro membro, e assim por diante.

### Capas dos projetos

Foi investigado o problema das fotos de capa enviadas pelo responsável do grupo que não apareciam na home nem na página de projeto. A regra esperada é:

- Fotos carregadas devem ser persistidas no backend/storage.
- A home e a página de projeto devem consumir a mesma URL correta.
- Caso fotos antigas tenham sido enviadas antes de correções de storage, pode ser necessário recuperar na VPS antiga ou no banco anterior.

### Identidade dos membros

Foi analisado o caso do projeto SafeDrive Mod, em que estudantes selecionaram um membro mas fizeram login com outra identidade.

Lacuna identificada:

- O fluxo permitia confirmar presença selecionando uma pessoa, mas autenticando como outra.

Regra necessária:

- Ao confirmar presença, a identidade autenticada deve bater com o membro selecionado.
- Se não bater, o sistema deve bloquear a confirmação e explicar que o estudante precisa entrar com a conta correta.
- A UI deve deixar claro qual membro está sendo confirmado antes de concluir.

## Manuais e PDFs de expositor

Os PDFs do expositor seguem o design atual dos manuais já existentes. A regra principal é não criar um design novo do zero quando o pedido for apenas conteúdo, regra ou organização.

O manual do expositor foi ajustado para:

- Separar categorias que concorrem a votação das categorias que não concorrem.
- Usar um manual diferente para categorias como produto e negócio quando não entram na votação.
- Explicar a obrigatoriedade de criar perguntas para estudantes.
- Explicar por que as perguntas fazem parte da didática do desafio.
- Usar um card com coloração violeta para deixar claro que a orientação pertence ao Passaporte/Desafio.
- Evitar repetição de informação.
- Organizar normas, etapas e responsabilidades de forma mais uniforme.

Regra didática importante:

- O expositor cria perguntas porque o desafio precisa transformar a visita ao stand em interação real.
- O estudante deve conversar, entender a proposta e responder com base no que aprendeu.
- Isso evita que o desafio seja apenas escanear códigos QR sem aprendizagem.

## Passaporte UOR Connect e desafio

O Passaporte UOR Connect é a mecânica de desafio gamificado da atividade.

### Regras importantes

- Não existe separação entre bônus e pontos. Bônus e pontos foram unificados como `pontos`.
- Quando o estudante cumpre uma tarefa, recebe pontos.
- Quando escaneia um QR que tira pontos, os pontos são descontados diretamente do saldo.
- Até o estudante aceitar o passaporte, os outros cards do desafio não devem aparecer.
- O passo `Aceitar desafio` deve aparecer como concluído quando o estudante já aceitou o desafio.
- Ao iniciar o desafio, a pontuação inicial deve refletir corretamente os pontos da etapa de aceitação, evitando mostrar `0 pontos` quando a etapa dá `10 pontos`.

### Mapa do desafio

O mapa deve manter o design atual. Alterações devem complementar o conteúdo sem alterar o estilo base.

Etapas importantes definidas:

- Aceitar o desafio.
- Convidar colegas.
- Fazer check-in no evento por QR gerado na admin.
- Escanear QRs de missões.
- Interagir com expositores.
- Responder perguntas.
- Participar de missões cooperativas.
- Recuperar pontos por recuperação inteligente.
- Competir em batalhas de pontos.
- Seguir pistas encadeadas quando configuradas.

O passo `Convidar colegas` deve ficar em segundo lugar no mapa.

### Convites e afiliados

O convite foi desenhado como uma mecânica de engajamento:

- O estudante copia um link de afiliado.
- Quem entra pelo link vê primeiro o modal de convite.
- O modal informa que foi convidado para o desafio por aquele estudante.
- O estudante convidado escolhe entre aceitar o desafio ou preferir votar/conhecer projetos.
- Se aceitar e já estiver logado como estudante UOR, é inscrito no desafio.
- Se aceitar e não estiver logado, passa pelo login correto.
- O convite deve permitir apenas login de estudantes UOR, não login por SMS genérico nem júri.
- O estudante que convidou deve ganhar pontos quando alguém entra no desafio pelo link.
- SMS de marco deve avisar quando atingir números como `+10`, `+20`, e assim por diante.

### QR surpresa

O QR surpresa não deve revelar ao estudante se é de risco ou não.

Regra:

- O estudante só sabe que é surpresa.
- A consequência aparece depois do scan.
- Isso mantém a experiência de suspense.

### Scanner

No card de escanear código:

- A prioridade visual deve ser a câmera.
- O estudante não deve conseguir escrever manualmente o mesmo código QR.
- A experiência deve levar naturalmente para abrir a câmera.

### Prêmios do desafio

Prêmios definidos para o desafio:

- Pagamento de 1 recurso para vencedor elegível.
- Certificado digital para top 3 estudantes.
- Assinatura de 1 perfil Prime Video por 1 mês.
- 1 mês de perfil HBO.
- 1 mês de Duolingo Super.

Direção estética:

- Quando os prêmios aparecem no frontend ou PDFs, pode-se usar cores associadas aos serviços para facilitar leitura visual, por exemplo azul para Prime Video, sem quebrar a identidade do UOR Connect.

## Admin

A admin recebeu várias melhorias funcionais e de usabilidade.

### Menu lateral

Problema recorrente:

- No mobile, o menu lateral ficava fixo e não deslizava.
- Ao tentar rolar o menu, a página mexia junto ou o menu ficava inacessível.

Regra desejada:

- O menu da admin deve rolar de forma independente.
- Quando o menu estiver aberto, a rolagem deve acontecer no menu.
- Quando a página estiver sendo rolada, o menu não deve interferir.
- O menu deve continuar clicável depois de aberto.

### Cursos

A área de cursos recebeu ajustes:

- Responsividade melhorada quando detalhes do curso são expandidos.
- Texto não deve ficar esmagado.
- Modal de exclusão para evitar remoções acidentais.
- Possibilidade de remover pessoas de cursos.
- CRUD de elementos nos cursos deve estar pronto.
- Correções para aprovar estudantes em cursos.
- Correções para visualizar PDFs de pagamento.
- Inclusão no relatório geral de:
  - Quantos inscritos cada curso recebeu.
  - Quanto cada curso arrecadou.

### Submissões e pagamentos

Foram corrigidos problemas como:

- `getOfficialCourseSelectOptions is not defined` no formulário de submissão.
- Erros de confirmação de pagamento.
- Fechamento/abertura de candidaturas conectado ao estado real.

Regra:

- Quando o status estiver fechado, botões de submissão de expositor devem ser desativados.
- O status aberto/fechado deve poder ser encerrado na admin de forma clara.

### Reset operacional

Foram pedidos botões administrativos para:

- Reiniciar o desafio:
  - Desinscrever todos.
  - Remover pontos.
  - Permitir recomeçar do zero.
- Remover todos os votos dos projetos:
  - Recomeçar votação no dia da abertura.

Regra de proteção:

- Essas ações devem abrir modal de confirmação via SMS.
- Número de confirmação definido: `+244937624785`.

## Relatórios gerais da admin

O relatório geral da admin foi redesenhado para seguir a mesma qualidade visual dos PDFs do expositor e do manual do desafio.

### Organização definida

- Primeira página com visão executiva.
- Gráficos de crescimento.
- Gráficos financeiros.
- Cursos com inscritos e arrecadação.
- Projetos aprovados com informação completa.
- Projetos recusados em página separada, compacta, antes das interações.
- Estudantes que interagiram nas últimas páginas.

### Correções recentes

Foram corrigidas inconsistências de cálculo e apresentação:

- Valores financeiros agora usam `decimal.js`.
- Valores formatados em Kz/AOA são interpretados de forma consistente.
- Projetos recusados não entram como aprovados.
- Projetos recusados não inflam receita esperada.
- Submissões eliminadas não entram nos cálculos principais.
- Gráficos usam escala coerente.
- Os testes cobrem parsing de dinheiro, agregados financeiros e volume por cursos/projetos.

Arquivos principais:

- `backend/src/modules/reports/http/report-calculations.ts`
- `backend/src/modules/reports/http/report-calculations.spec.ts`
- `backend/src/modules/reports/http/reports.routes.ts`
- `backend/src/modules/reports/http/reports-overview-pdf.spec.ts`

## SMS

O sistema de SMS é usado em:

- Campanhas administrativas.
- Confirmações sensíveis.
- Convites e marcos do desafio.
- Possíveis alertas de afiliado.

Foi investigado erro `400 Bad Request` ao enviar SMS pela admin. Quando aparecer novamente, verificar:

- Payload enviado pelo frontend.
- Validação do endpoint `/sms/admin/send`.
- Presença de destinatários.
- Formato dos números.
- Mensagem vazia ou acima do limite.
- Resposta detalhada do backend nos logs.

SMS criada para chegada do desafio:

> UOR Connect: chegou o Passaporte UOR Connect. Entra no site, vai em Minha Área, aceita o desafio e acumula pontos em missões, QR e interações durante a atividade.

## Branding, imagens e material promocional

Decisões importantes:

- O logo oficial é o `logoworconnect` no `public`.
- Não usar o logotipo antigo em links partilhados.
- O logo deve aparecer sem fundo branco.
- O flyer do desafio deve se inspirar em ticket/boarding pass.
- O ticket deve se parecer com o ticket de confirmação de convite.
- Proporção pedida para o post: formato de post de Instagram.
- O passo a passo deve ser discreto:
  - Entrar no site.
  - Ir em Minha Área.
  - Abrir Desafios.
  - Aceitar o Passaporte UOR Connect.

Arquivos de rascunho relacionados:

- `tmp/flyers/desafio-boarding-pass-philosophy.md`
- `.superpowers/brainstorm/583404-1778579113/content/waiting-design-approval.html`

## Formadores

O fluxo de formadores ainda está em fase de especificação. Não está implementado no código de produção.

Ideia aprovada pelo utilizador:

- Link genérico para formadores se cadastrarem.
- Login por SMS de confirmação.
- Completar perfil de forma confortável e estável.
- Solicitar apenas informações relevantes, sem ser invasivo.
- Formador escolhe o curso que vai formar entre os cursos cadastrados no sistema.
- Depois de aprovado, ganha acesso a uma área administrativa limitada.
- O formador vê apenas dados do curso dele, especialmente quantidade de estudantes inscritos.

Nota relacionada:

- [[Formadores - Link generico]]

## Pendências e próximos passos

Pendências de produto/código:

- Implementar o fluxo de link genérico para formadores.
- Validar visualmente o PDF do relatório geral com dados reais da admin.
- Revisar se todos os locais de prêmios do desafio usam a lista atual.
- Continuar testando convites afiliados com estudantes reais.
- Confirmar se imagens antigas de capas de projetos ainda existem na base antiga ou no storage antigo.
- Consolidar as regras de identidade dos membros para impedir novas trocas de pessoa no login.

Pendências operacionais:

- Fazer uma revisão de todos os arquivos locais modificados antes de um commit geral.
- Separar mudanças por tema se for abrir PR/commit organizado.
- Manter este cofre atualizado sempre que uma decisão de regra for tomada em conversa.
