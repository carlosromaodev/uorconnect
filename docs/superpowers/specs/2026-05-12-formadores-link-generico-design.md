# Link generico de cadastro de formadores

Data: 2026-05-12

## Objetivo

Permitir que formadores se cadastrem por um link generico da UOR Connect, validem o telefone por SMS, completem um perfil profissional simples, escolham o curso que vao ministrar e, depois de aprovados pela administracao, acedam a uma area limitada com indicadores do seu curso.

O fluxo deve ser confortavel, estavel e sem friccao desnecessaria. Tambem deve evitar que um formador receba permissao ampla da admin por engano.

## Decisoes aprovadas

- O link sera generico, nao preso previamente a um curso.
- O formador fara login por SMS.
- O cadastro deve parecer um ambiente proprio e confiavel, nao uma tela administrativa crua.
- O perfil solicitado deve ser profissional, mas nao invasivo.
- A admin deve aprovar o cadastro antes de liberar acesso.
- O formador aprovado deve ver apenas informacoes agregadas do curso dele.

## Fluxo publico

1. O formador abre o link generico, por exemplo `/formadores/cadastro`.
2. A pagina apresenta o convite institucional para cadastro de formador UOR Connect.
3. O formador informa o telefone e recebe um codigo por SMS.
4. Depois de validar o codigo, ele completa o perfil.
5. Ele escolhe um curso ativo no sistema.
6. Envia o pedido para validacao.
7. A pagina mostra um estado claro de "pedido enviado" e orienta que a organizacao validara o acesso.

## Dados solicitados

Obrigatorios:

- Nome completo
- Telefone validado por SMS
- Area de formacao ou especialidade
- Curso que pretende ministrar
- Mini biografia profissional

Opcionais:

- Email
- Foto
- LinkedIn ou portfolio
- Empresa ou instituicao
- Formacao academica curta

Nao solicitar:

- BI
- Morada
- Dados bancarios
- Documentos anexos
- Lista completa de estudantes

## Validacao administrativa

A submissao do formador entra na admin como pedido pendente.

A administracao deve poder:

- Ver pedidos pendentes.
- Comparar perfil, telefone e curso escolhido.
- Aprovar o formador.
- Recusar com motivo curto.
- Alterar o curso escolhido antes de aprovar, se necessario.

Ao aprovar, o sistema cria ou atualiza um acesso limitado de formador ligado ao telefone validado e ao curso escolhido.

## Acesso do formador

Depois de aprovado, o formador entra pela admin usando o mesmo login SMS.

Ele nao ve a admin completa. A area dele deve ter apenas:

- Nome do curso atribuido.
- Total de inscritos.
- Inscricoes com pagamento confirmado.
- Inscricoes pendentes.
- Estado do curso.
- Ultima atualizacao dos dados.

Por privacidade e simplicidade, a primeira versao nao mostra nomes, numeros, comprovativos ou contactos dos estudantes.

## Permissoes e seguranca

O acesso do formador deve ser separado de permissoes amplas como `COURSES`, `SPEAKERS` ou `SECURITY`.

Mesmo que internamente seja reaproveitado `TeamMembership`, a permissao deve ser limitada e interpretada pelo backend com escopo de curso.

Regras:

- Um formador so pode consultar o curso atribuido.
- Formador nao pode criar, editar ou apagar cursos.
- Formador nao pode aprovar pagamentos.
- Formador nao pode aceder a SMS, estudantes, seguranca, votacoes, certificados ou candidaturas.
- Se o pedido estiver pendente ou recusado, a admin nao abre para ele.

## Estados de interface

O fluxo publico deve cobrir:

- Carregamento do link.
- Envio de codigo SMS.
- Codigo invalido ou expirado.
- Perfil incompleto.
- Curso nao selecionado.
- Pedido enviado.
- Pedido pendente.
- Pedido aprovado.
- Pedido recusado.

A tela do formador deve cobrir:

- Carregamento.
- Sem curso atribuido.
- Acesso pendente.
- Acesso recusado.
- Curso sem inscritos.
- Erro temporario de conexao.

## Dados e modelos

Preferencia de implementacao:

- Criar uma entidade propria para pedidos de formador, mantendo historico de estado.
- Reaproveitar login SMS ja existente.
- Reaproveitar cursos existentes.
- Reaproveitar a base de permissoes administrativas apenas para autenticar a entrada, mas aplicar escopo proprio nas rotas do formador.

Campos esperados para o pedido:

- id
- phone
- name
- email
- specialty
- bio
- linkedinUrl
- portfolioUrl
- organization
- selectedCourseId
- status
- reviewedAt
- reviewedByStudentNumber
- reviewNote
- approvedMembershipId
- createdAt
- updatedAt

## Endpoints esperados

Publicos:

- `GET /trainers/registration/context`
- `POST /trainers/registration/request-code`
- `POST /trainers/registration/verify-code`
- `POST /trainers/registration/submit`
- `GET /trainers/registration/status`

Admin:

- `GET /trainers/admin/requests`
- `POST /trainers/admin/requests/:id/approve`
- `POST /trainers/admin/requests/:id/reject`

Formador aprovado:

- `GET /trainers/me/dashboard`

Estes endpoints serao a referencia da implementacao. A separacao entre publico, admin e formador deve permanecer.

## Testes

Backend:

- Nao aprova formador sem curso.
- Nao aprova formador sem telefone validado.
- Formador pendente nao acede ao dashboard.
- Formador aprovado so ve o curso atribuido.
- Formador nao consegue chamar rotas administrativas gerais.
- Recusa guarda motivo e bloqueia acesso.

Frontend:

- Cadastro exige telefone validado.
- Perfil mostra mensagens claras por estado.
- Lista de cursos usa os cursos ativos.
- Dashboard do formador nao mostra dados sensiveis dos estudantes.
- Rotas bloqueadas mostram mensagem amigavel, nao "acesso negado" seco.

## Fora de escopo nesta primeira versao

- Agenda propria do formador.
- Upload de materiais.
- Chat com estudantes.
- Lista nominal de inscritos.
- Exportacao de PDF para formador.
- Multiplos cursos por formador.

Esses pontos podem entrar depois, quando o cadastro e o painel limitado estiverem estaveis.
