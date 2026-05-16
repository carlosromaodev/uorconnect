# RF, RNF e regras de negocio - perfis, credenciais e admin

Data: 2026-05-05
Base: `ANALISE_PERFIS_CREDENCIAIS_ESTUDANTES.md`
Escopo: perfis de estudantes, nucleo/equipa, credenciais digitais, credenciais imprimiveis, admin e privacidade.

## Legenda

- `[x]` Ja implementado ou parcialmente implementado no estado atual do projeto.
- `[ ]` Pendente.
- `Prioridade Alta` deve ser tratado antes de melhorias visuais secundarias.
- `Prioridade Media` melhora escala, governanca e operacao.
- `Prioridade Baixa` e desejavel, mas nao bloqueia o fluxo principal.

## Checklist geral

### Identidade e perfil

- [x] Login de estudante com conta UOR/Secretaria.
- [x] Persistencia local do estudante em `Student`.
- [x] Atualizacao parcial de perfil do estudante em `/auth/me`.
- [x] Foto de perfil em `Minha Area`.
- [x] Criar tabela `StudentProfileExtra` para bio, redes sociais, morada reduzida, consentimentos e visibilidade.
- [x] Migrar extras guardados em `EventTeamCredential.notes` para campos/tabela estruturada.
- [x] Criar score de completude do perfil.
- [x] Criar estados de perfil: `BASIC`, `CONTACT_READY`, `PUBLIC_READY`, `TEAM_READY`, `ADMIN_READY`.
- [x] Separar campos verificados por sistema dos campos declarados pelo estudante.
- [x] Criar historico de alteracoes sensiveis do perfil.

### Nucleo, equipa e admin

- [x] Admin com acesso por numero de estudante autorizado.
- [x] Admin sem navbar/footer do site publico.
- [x] `admin.uorconnect.space` preparado no Caddy.
- [x] Shell administrativo imersivo com resumo operacional, busca de modulos e area ativa.
- [x] Gate de completar cadastro administrativo antes de abrir a consola.
- [x] Cadastro administrativo pede foto, contacto, area/curso, morada opcional, bio e redes sociais.
- [x] Criar tabela `TeamMembership` como cadastro digital versionado do nucleo/equipa.
- [x] Validar admin por `TeamMembership.studentNumber` como chave forte.
- [x] Usar primeiro e ultimo nome apenas como sugestao/fallback, nunca como chave principal.
- [x] Criar revisao manual para correspondencias ambiguas de nome.
- [x] Associar permissoes administrativas ao cargo/area da `TeamMembership`.
- [x] Criar relatorio de membros com perfil incompleto.
- [x] Criar ciclo de mandato/status: ativo, suspenso, removido, antigo membro.

### Credenciais digitais

- [x] Credencial de equipa com token, slug publico, perfil publico, QR e PDF.
- [x] Credencial de presenca por estudante com token e QR validavel.
- [x] Certificados com codigo, token de validacao, QR e PDF.
- [x] Pagina publica `/validar/:token` para validacao.
- [x] Criar modelo generico `Credential` ou normalizar politica comum entre credenciais.
- [x] Adicionar status comum: `DRAFT`, `ISSUED`, `ACTIVE`, `EXPIRED`, `REVOKED`.
- [x] Adicionar `issuedAt`, `expiresAt`, `revokedAt`, `revokedReason`, `version`, `issuedByStudentNumber`.
- [x] Criar logs de validacao/scans para cada credencial.
- [x] Criar fluxo de revogacao e reemissao.
- [x] Criar painel admin para revogar/reemitir credenciais.
- [x] Garantir que QR contenha apenas token/URL e nunca dados pessoais diretos.

### Credenciais imprimiveis

- [x] PDF de passe de equipa em folha A4.
- [x] Linhas de corte e area segura no passe A4.
- [x] QR de validacao dentro do passe.
- [x] Criar frente e verso do passe.
- [x] Criar lote A4 com multiplas credenciais em paginas sequenciais, mantendo tamanho real do passe.
- [x] Criar templates por categoria: nucleo, staff, expositor, juri, palestrante, protocolo.
- [x] Criar designer/admin de cores por categoria.
- [x] Alinhar o design do passe individual e do lote A4 com a mesma identidade das credenciais.
- [x] Lote A4 deve gerar cada passe no mesmo tamanho/estrutura do passe individual, com frente e verso em paginas separadas.
- [x] Aplicar cores por categoria e por area/funcao do Nucleo na admin de credenciais.
- [x] Quando o Nucleo nao tiver template customizado, derivar cor visual pela area/função: presidencia, secretaria, tesouraria, academica, tecnologia, comunicacao, eventos, relacoes, logistica ou apoio.
- [x] Criar pre-visualizacao antes de imprimir.
- [x] Testar impressao em preto/branco.
- [x] Incluir texto de uso: pessoal, intransmissivel e sujeito a validacao.

### Privacidade, consentimento e seguranca

- [x] Admin protegido por token e permissoes.
- [x] Dados de contacto nao aparecem na validacao publica de certificados/presenca.
- [x] Criar consentimentos explicitos: foto no passe, perfil publico, redes sociais, SMS, WhatsApp.
- [x] Criar configuracao de visibilidade por campo.
- [x] Criar politica de minimizacao de dados.
- [x] Criar auditoria para emissao/revogacao de credenciais.
- [x] Criar permissao especifica para exportacao de dados pessoais.
- [x] Criar periodo de retencao para logs e credenciais expiradas.

### Experiencia do utilizador

- [x] Formulario de completar credencial com secoes e preview.
- [x] Preview visual da credencial no cadastro.
- [x] Barra de progresso no convite de credencial.
- [x] Admin com experiencia propria, separada do site publico.
- [x] Carteira digital em `Minha Area`.
- [x] Mostrar todas as credenciais do estudante numa unica zona.
- [x] Permitir baixar passe/certificado diretamente da carteira.
- [x] Mostrar estado de perfil e proximas acoes.
- [x] Explicar finalidade de cada dado pedido.
- [x] Permitir editar perfil publico com consentimento.

## Requisitos funcionais

### RF-PC-001 - Perfil raiz do estudante

Prioridade: Alta
Estado: Implementado

O sistema deve manter `Student` como identidade raiz de todo estudante UOR autenticado.

Checklist:

- [x] Guardar `studentNumber` como identificador unico.
- [x] Guardar nome, curso, email, telefone e foto quando disponiveis.
- [x] Sincronizar dados academicos vindos da Secretaria.
- [x] Identificar a fonte de cada campo: Secretaria, estudante, admin ou importacao.
- [x] Mostrar a data da ultima sincronizacao academica.
- [x] Impedir que nome/curso oficiais sejam sobrescritos sem indicar a fonte.

Regras associadas:

- O numero de estudante e a chave forte.
- Nome e telefone podem ajudar na associacao, mas nao substituem o numero.
- Dados oficiais e dados declarados devem ser diferenciados.

### RF-PC-002 - Perfil extra e consentimentos



Prioridade: Alta
Estado: Implementado

O sistema deve guardar dados opcionais/sensiveis numa estrutura separada do `Student`.

Checklist:

- [x] Criar `StudentProfileExtra`.
- [x] Guardar bio curta.
- [x] Guardar morada reduzida, nao morada completa obrigatoria.
- [x] Guardar redes sociais opcionais.
- [x] Guardar consentimento por finalidade.
- [x] Guardar configuracao de visibilidade por campo.
- [x] Migrar dados atualmente em `EventTeamCredential.notes`.

Regras associadas:

- Redes sociais nunca devem ser obrigatorias.
- Morada deve ser opcional e reduzida.
- Campos publicos so devem aparecer com consentimento.

### RF-PC-003 - Completude de perfil

Prioridade: Alta
Estado: Implementado

O sistema deve calcular a completude do perfil do estudante e orientar o utilizador sobre o que falta.

Checklist:

- [x] Criar score de completude.
- [x] Separar completude de estudante comum, expositor, membro da equipa e admin.
- [x] Mostrar estado em `Minha Area`.
- [x] Mostrar estado no admin para membros da equipa.
- [x] Criar lista de perfis incompletos.

Regras associadas:

- Estudante comum nao deve ser bloqueado por falta de foto ou redes.
- Admin/nucleo pode ser bloqueado por falta de foto e dados operacionais.
- O sistema deve explicar por que cada dado e pedido.

### RF-PC-004 - Cadastro digital do nucleo/equipa

Prioridade: Alta
Estado: Implementado

O sistema deve ter uma entidade propria para o cadastro digital do nucleo/equipa. No Nucleo, a lista operacional deve nascer preferencialmente das tomadas de posse aprovadas, nao de PDF, seed ou importacao fixa.

Checklist:

- [x] Criar `TeamMembership`.
- [x] Manter membros em cadastro digital, nao em PDF.
- [x] Desativar importacao/seed como fluxo principal do Nucleo.
- [x] Criar CRUD administrativo para membros do nucleo/equipa.
- [x] Permitir preencher `studentNumber`.
- [x] Permitir estado: ativo, suspenso, removido, antigo membro.
- [x] Permitir mandato/periodo.
- [x] Guardar quem verificou cada membro.
- [x] Permitir revisao manual de correspondencias ambiguas.

Regras associadas:

- `studentNumber` e a chave principal quando existir.
- Primeiro e ultimo nome servem apenas para sugestao ou validacao secundaria.
- Um estudante removido da equipa deve perder acesso administrativo automaticamente.

### RF-PC-005 - Acesso administrativo por area

Prioridade: Alta
Estado: Implementado

O sistema deve dar acesso administrativo conforme area, cargo e permissoes do membro.

Checklist:

- [x] Controlar acesso por `AdminAuthorizedStudent`.
- [x] Separar admin do site publico.
- [x] Mostrar apenas modulos permitidos.
- [x] Exigir completar cadastro administrativo antes de abrir a admin.
- [x] Derivar permissoes de `TeamMembership`.
- [x] Revogar permissoes quando o membro deixa a equipa.
- [x] Criar perfis padrao por area: direcao, protocolo, marketing, logistica, relacoes internas, relacoes externas, explicadores.

Regras associadas:

- Super admin pode gerir todas as areas.
- Membro comum so ve os modulos da sua area.
- Acesso administrativo exige perfil administrativo completo.

### RF-PC-006 - Credencial digital de equipa

Prioridade: Alta
Estado: Implementado

O sistema deve emitir credencial digital para membros do nucleo/equipa e outros perfis operacionais.

Checklist:

- [x] Criar convite de credencial.
- [x] Completar perfil via link.
- [x] Criar perfil publico.
- [x] Baixar PDF.
- [x] Validar por QR/link.
- [x] Ligar credencial a `TeamMembership`.
- [x] Adicionar expiracao/revogacao.
- [x] Criar historico de reemissao.
- [x] Criar logs de validacao.

Regras associadas:

- QR contem apenas token/URL.
- Perfil publico nao mostra contacto privado.
- Credencial deve poder ser revogada.

### RF-PC-007 - Credencial de presenca

Prioridade: Media
Estado: Implementado

O sistema deve emitir e validar credenciais de presenca para estudantes.

Checklist:

- [x] Criar `AttendanceCredential`.
- [x] Mostrar QR em `Minha Area`.
- [x] Validar QR publicamente.
- [x] Registrar check-in.
- [x] Criar PDF/print card da credencial de presenca.
- [x] Criar logs de scans invalidos.
- [x] Criar validade por evento/sessao.

Regras associadas:

- Uma credencial de presenca deve ser unica por estudante e evento.
- Check-in deve guardar snapshot de nome, curso e numero.
- Check-in deve registrar quem validou.

### RF-PC-008 - Certificados

Prioridade: Media
Estado: Implementado

O sistema deve emitir certificados digitais com validacao publica e PDF profissional.

Checklist:

- [x] Emitir certificado.
- [x] Gerar codigo unico.
- [x] Validar por token.
- [x] Baixar PDF.
- [x] Criar revogacao com motivo.
- [x] Criar reemissao/versionamento.
- [x] Criar templates por tipo de certificado.
- [x] Criar auditoria detalhada de emissao.

Regras associadas:

- Certificado usa snapshot do nome/curso no momento da emissao.
- Alterar perfil depois da emissao nao muda certificado ja emitido.
- Certificado revogado deve aparecer como invalido na validacao publica.

### RF-PC-009 - Carteira digital do estudante

Prioridade: Media
Estado: Implementado

O sistema deve agrupar credenciais, certificados e presencas numa carteira digital em `Minha Area`.

Checklist:

- [x] Criar secao "Carteira UOR Connect".
- [x] Mostrar QR de presenca.
- [x] Mostrar passe de equipa quando aplicavel.
- [x] Mostrar certificados.
- [x] Mostrar historico de check-ins.
- [x] Permitir download de PDFs.
- [x] Mostrar estado: valido, expirado, revogado, pendente.

Regras associadas:

- Carteira deve mostrar apenas documentos pertencentes ao estudante autenticado.
- Documentos publicos devem abrir por link de validacao.
- Dados privados nao devem aparecer no modo publico.

### RF-PC-010 - Impressao profissional de credenciais

Prioridade: Media
Estado: Implementado

O sistema deve gerar credenciais imprimiveis com padrao profissional.

Checklist:

- [x] Passe A4 individual com linhas de corte.
- [x] Criar frente e verso.
- [x] Criar lote com multiplas credenciais em A4.
- [x] Criar templates por categoria.
- [x] Criar pre-visualizacao de impressao.
- [x] Criar modo preto/branco.
- [x] Criar margens/sangria configuraveis.

Regras associadas:

- Nome e categoria devem ser legiveis a distancia.
- QR deve ter tamanho minimo adequado para leitura.
- Documento deve ter codigo legivel alem do QR.

## Requisitos nao funcionais

### RNF-PC-001 - Privacidade por desenho

Prioridade: Alta

Checklist:

- [x] Minimizar dados pedidos.
- [x] Separar dados publicos e privados.
- [x] Exigir consentimento para perfil publico e redes sociais.
- [x] Ocultar telefone, email e morada em validacoes publicas.
- [x] Minimizar nome, numero e curso na validacao publica quando o detalhe completo nao for indispensavel.
- [x] Permitir revogar consentimentos.

### RNF-PC-002 - Seguranca de tokens

Prioridade: Alta

Checklist:

- [x] Tokens opacos para credenciais/certificados.
- [x] QR aponta para URL/token, nao para dados pessoais.
- [x] Adicionar expiracao quando aplicavel.
- [x] Adicionar revogacao.
- [x] Registrar validacoes e scans.
- [x] Rate limit em endpoints publicos de validacao.
- [x] Proteger documentos sensiveis de submissao por sessao, permissao ou token temporario.

### RNF-PC-003 - Performance de imagens

Prioridade: Alta

Checklist:

- [x] Migrar imagens base64 para storage.
- [x] Criar migracao retroativa para fotos antigas de perfil/credencial que ainda estejam em base64.
- [x] Guardar apenas URL e metadados.
- [x] Gerar thumbnails.
- [x] Limitar tamanho e dimensoes.
- [x] Comprimir imagens antes de usar em PDF.

### RNF-PC-004 - Acessibilidade

Prioridade: Media

Checklist:

- [x] Admin sem navbar publica e com foco operacional.
- [x] Garantir labels visiveis em todos os campos de perfil.
- [x] Garantir foco visivel em botoes e inputs.
- [x] Garantir contraste em credenciais e PDFs.
- [x] Testar navegação por teclado na admin e nos formularios de perfil.

### RNF-PC-005 - Auditabilidade

Prioridade: Alta

Checklist:

- [x] Existe `AdminAuditLog`.
- [x] Auditar emissao de credenciais.
- [x] Auditar revogacao/reemissao.
- [x] Auditar mudancas de permissoes.
- [x] Auditar exportacoes de dados pessoais.
- [x] Auditar alteracoes de `TeamMembership`.

### RNF-PC-006 - Confiabilidade documental

Prioridade: Alta

Checklist:

- [x] Certificados usam codigo unico.
- [x] Validacao publica mostra status do certificado.
- [x] Credenciais devem ter versao.
- [x] PDFs devem guardar snapshots.
- [x] Reemissao deve preservar historico.
- [x] Revogacao deve ser refletida imediatamente na validacao publica.
- [x] Perfil publico, PDF, carteira e validacao devem usar a mesma politica de estado da credencial.

## Regras de negocio

### RN-PC-001 - Identidade forte

- [x] O numero de estudante e a chave forte de identidade.
- [x] Nome nunca deve ser chave unica.
- [x] Telefone nunca deve substituir numero de estudante.
- [x] Nome + telefone pode sugerir associacao, mas exige confirmacao.

### RN-PC-002 - Dados obrigatorios por tipo de utilizador

Estudante comum:

- [x] Numero de estudante obrigatorio.
- [x] Foto opcional.
- [x] Telefone recomendado.
- [x] Redes sociais opcionais.
- [x] Morada opcional e reduzida.

Membro do nucleo/equipa:

- [x] Nome obrigatorio.
- [x] Foto obrigatoria para entrar na admin.
- [x] Area/cargo obrigatorios na credencial.
- [x] Numero de estudante obrigatorio para membro do Nucleo confirmado ou criado pela admin.
- [x] Telefone recomendado.
- [x] Redes opcionais.

Expositor:

- [x] Responsavel e contacto obrigatorios.
- [x] Membros podem ser declarados.
- [x] Membros devem poder confirmar por login.
- [x] Certificados devem priorizar membros confirmados.

### RN-PC-003 - Admin bloqueada por perfil incompleto

- [x] Admin nao abre se o perfil administrativo estiver incompleto.
- [x] Perfil administrativo exige foto.
- [x] Depois de guardar, a admin abre.
- [x] O sistema deve mostrar qual requisito falta.
- [x] Super admin pode ver relatorio de perfis incompletos.

### RN-PC-004 - Perfil publico

- [x] Perfil publico de membro existe.
- [x] Perfil publico pode mostrar bio e redes guardadas.
- [x] Perfil publico deve respeitar consentimentos.
- [x] Telefone, email e morada nao devem aparecer publicamente por padrao.
- [x] Estudante deve poder controlar visibilidade.

### RN-PC-005 - Credenciais

- [x] Credencial deve ter token unico.
- [x] Credencial deve ter QR.
- [x] Credencial deve ter PDF.
- [x] Credencial deve ter status.
- [x] Credencial deve poder expirar.
- [x] Credencial deve poder ser revogada.
- [x] Credencial deve ter historico de reemissao.
- [x] QR nunca deve conter dados pessoais diretos.

### RN-PC-006 - Certificados

- [x] Certificado emitido deve ter codigo unico.
- [x] Certificado deve ter QR de validacao.
- [x] Certificado deve guardar snapshot do destinatario.
- [x] Certificado revogado deve aparecer como invalido.
- [x] Reemissao deve criar nova versao ou novo codigo relacionado.
- [x] Alteracao posterior do perfil nao altera certificado ja emitido.

### RN-PC-007 - Impressao

- [x] Passe deve ser gerado em A4.
- [x] Passe deve ter linhas de corte.
- [x] Passe deve ter area segura.
- [x] Passe deve ter frente e verso.
- [x] Passe em lote deve manter tamanho real, com uma frente ou verso por pagina A4.
- [x] Impressao deve manter legibilidade em impressoras comuns.

### RN-PC-008 - Consentimento

- [x] Uso de foto em credencial deve ter consentimento registrado.
- [x] Exibicao de redes sociais deve ter consentimento registrado.
- [x] Envio de SMS/WhatsApp deve respeitar consentimento ou base operacional.
- [x] Dados sensiveis devem ter finalidade documentada.

### RN-PC-009 - Revogacao de acesso

- [x] Se membro sair da equipa, perde permissoes administrativas.
- [x] Se credencial for revogada, QR deve mostrar status revogado.
- [x] Revogar admin nao deve apagar historico.
- [x] Revogar credencial nao deve apagar certificado ou check-in ja historico.

### RN-PC-010 - Snapshots documentais

- [x] Certificados guardam nome/numero/curso do destinatario.
- [x] Check-ins guardam nome/numero/curso no momento.
- [x] Credenciais de equipa devem guardar snapshot de emissao.
- [x] Reemissoes devem gerar nova versao/snapshot.

### RN-PC-011 - Documentos sensiveis de submissao

- [x] Talão de submissao pertence ao estudante responsavel e a organizacao.
- [x] Comprovativo de pagamento nunca deve ser servido a visitante anonimo.
- [x] Admin/juri autorizado pode consultar documentos para revisao operacional.
- [x] Link publico de documento sensivel exige token temporario quando partilha externa for necessaria.

### RN-PC-012 - Estado pronto de credencial

- [x] `PROFILE_READY`, `ACTIVE` e `ISSUED` representam credencial publicamente utilizavel quando nao expirada/revogada/desativada.
- [x] `INVITED`, `DRAFT`, `EXPIRED`, `REVOKED` e `DISABLED` nao devem liberar perfil publico, PDF ou validacao positiva.
- [x] A mesma regra deve valer para carteira, admin, PDF e QR.

### RN-PC-013 - Separacao entre perfil e credencial operacional

- [x] Completar perfil comum nao publica credencial de equipa, nucleo, expositor ou admin.
- [x] Credencial operacional so fica pronta apos fluxo contextual com vinculo validado.
- [x] Foto obrigatoria em credencial operacional deve ser comunicada antes da emissao.

### RN-PC-014 - Minimizacao na validacao publica

- [x] Validacao publica deve provar autenticidade sem expor dados pessoais desnecessarios.
- [x] Dados completos de presenca devem ficar para contexto operacional autenticado.
- [x] Quando exibicao publica for necessaria, numero de estudante deve poder aparecer mascarado.

## Auditoria de coerencia do projeto - 2026-05-08

Esta auditoria lista pontos encontrados no fluxo atual que podem parecer sem sentido para o utilizador, fragilizar a seguranca, tornar a operacao amadora ou dificultar escala/manutencao. Estes pontos devem ser tratados como requisitos de qualidade do produto, nao apenas como melhorias visuais.

### RF-AUD-001 - Separar onboarding de edicao de perfil

Prioridade: Alta
Estado: Implementado

O fluxo `/completar-perfil` deve ser usado apenas para primeiro cadastro. A edicao posterior deve acontecer numa tela/modal propria de perfil, usando `PATCH /auth/me`, sem cair numa tela de "perfil ja concluido".

Checklist:

- [x] Criar tela ou modal `Editar Perfil` em `Minha Area`.
- [x] Alterar o botao "Editar perfil" para apontar para o fluxo editavel, nao para `/completar-perfil`.
- [x] Manter `/completar-perfil` apenas para onboarding inicial.
- [x] Garantir que perfil concluido nunca bloqueia a edicao dos dados editaveis.
- [x] Mostrar claramente que dados academicos oficiais nao sao livres para edicao.

### RF-AUD-002 - Remover bloqueio de foto para estudante comum

Prioridade: Alta
Estado: Implementado

Estudante comum nao deve ser impedido de entrar na plataforma por falta de fotografia. Foto deve ser obrigatoria apenas em contextos que exigem identificacao visual: admin, nucleo/equipa, expositor, staff ou credencial imprimivel.

Checklist:

- [x] Ajustar onboarding comum para exigir nome, nao foto.
- [x] Manter foto obrigatoria em `ADMIN_READY`, `TEAM_READY` e `EXPOSITOR_READY`.
- [x] Permitir que estudante comum complete onboarding sem foto.
- [x] Mostrar foto como recomendada, nao obrigatoria, na jornada do estudante comum.
- [x] Garantir que PDF/credencial que exige foto mostre requisito especifico antes da emissao.

### RF-AUD-003 - Consentimento explicito e nao automatico

Prioridade: Alta
Estado: Implementado

Consentimentos para foto em credencial, perfil publico, redes sociais, SMS e WhatsApp nao devem ser ativados automaticamente apenas porque o utilizador preencheu um campo.

Checklist:

- [x] Criar controlos explicitos de consentimento no frontend.
- [x] Impedir `consentPublicProfile`, `consentPhotoCredential` e `consentSocialLinks` automaticos sem acao do utilizador.
- [x] Auditar alteracoes de consentimento.
- [x] Permitir revogar consentimentos.
- [x] Fazer perfil publico respeitar consentimento e visibilidade por campo.

### RF-AUD-004 - Fechar submissao publica insegura de credenciais

Prioridade: Critica
Estado: Implementado

A rota publica de submissao de credenciais nao deve conseguir marcar credenciais sensiveis como `PROFILE_READY` sem autenticacao e sem validacao de vinculo. Categorias como `NUCLEO` e `EXPOSITOR` devem usar apenas fluxos protegidos.

Checklist:

- [x] Restringir `POST /team-credentials/invitations/:token/submit` para nao aceitar categorias sensiveis.
- [x] Bloquear `EXPOSITOR` nessa rota publica; expositor deve usar `expositor-claim`.
- [x] Bloquear `NUCLEO` nessa rota publica; nucleo deve usar `nucleus-claim`.
- [x] Validar sempre vinculo com `TeamMembership` ou submissao aprovada antes de `PROFILE_READY`.
- [x] Auditar tentativas recusadas de claim/submissao de credencial.

### RF-AUD-005 - Suportar multiplas credenciais e multiplos papeis por estudante

Prioridade: Alta
Estado: Implementado

Um estudante pode ser membro do nucleo e expositor, ou ter mais de uma funcao operacional. O modelo atual usa `TeamMembership.studentNumber` unico e `GET /team-credentials/me` devolve apenas uma credencial, o que limita a carteira e pode associar expositor ao membership errado.

Checklist:

- [x] Permitir multiplos vinculos operacionais por estudante quando fizer sentido.
- [x] Rever `TeamMembership.studentNumber @unique` ou criar entidade de ligacao estudante-papel.
- [x] Alterar `/team-credentials/me` para devolver lista de credenciais e memberships.
- [x] Atualizar Carteira UOR Connect para listar todas as credenciais do estudante.
- [x] Garantir que claim de expositor nao reutiliza membership do nucleo por engano.

### RF-AUD-006 - Normalizar estados e validade das credenciais

Prioridade: Alta
Estado: Implementado

Credencial em `INVITED` nao deve aparecer como credencial valida na validacao publica. Estados calculados como `EXPIRED` devem ter label correto e comportamento consistente no perfil publico, carteira, PDF e validacao.

Checklist:

- [x] Criar politica comum para `DRAFT`, `INVITED`, `PROFILE_READY`, `ACTIVE`, `EXPIRED`, `REVOKED`, `DISABLED`.
- [x] Fazer validacao publica considerar valida apenas credencial emitida/pronta e nao revogada/expirada.
- [x] Adicionar label explicita para `EXPIRED`.
- [x] Ocultar perfil publico/PDF de credencial que ainda esta `INVITED`, expirada, revogada ou desativada.
- [x] Aplicar a mesma regra na carteira, admin e PDF.

### RF-AUD-007 - Migrar ficheiros e imagens para storage

Prioridade: Alta
Estado: Implementado

Fotos, anexos, comprovativos e banners em base64 no banco prejudicam performance, aumentam payloads e dificultam cache/backup. O sistema deve guardar ficheiros em storage e persistir apenas URLs/metadados.

Checklist:

- [x] Criar servico de upload/storage para imagens e documentos.
- [x] Migrar `avatarUrl`, `photoUrl`, banners e comprovativos base64 para URLs.
- [x] Converter fotos antigas de `Student.avatarUrl`, `EventTeamCredential.photoUrl`, `TeamMembershipClaim.photoUrl` e `Speaker.avatarUrl` sem obrigar o utilizador a refazer o perfil.
- [x] Gerar thumbnails para uso em listas, cards e carteira.
- [x] Comprimir imagem antes de gerar PDFs.
- [x] Definir limites, retencao e limpeza de ficheiros orfaos.

### RF-AUD-008 - Remover `any` e bypasses de tipos em rotas de producao

Prioridade: Media
Estado: Implementado

Rotas de producao nao devem depender de `prisma as any`, `as any` ou comentarios que escondem tipos gerados. Isso mascara erros reais e deixa refactors perigosos.

Checklist:

- [x] Remover `prisma as any` de validation/attendance quando o Prisma Client ja tiver os modelos.
- [x] Tipar payloads de interacoes e submissions sem `any`.
- [x] Manter `any` apenas em testes ou adaptadores inevitaveis, com justificativa.
- [x] Fazer `npm --prefix backend run lint` passar completo.

### RF-AUD-009 - Politica consistente de remocao e integridade referencial

Prioridade: Alta
Estado: Implementado

Remover estudante, projeto ou credencial deve respeitar relacoes novas e historicas. Operacoes de delete manuais incompletas podem falhar ou apagar contexto necessario para auditoria.

Checklist:

- [x] Revisar `deleteWithRelations` de estudante com todas as relacoes atuais.
- [x] Garantir que historico documental nao seja apagado indevidamente.
- [x] Usar `onDelete` coerente entre perfil, logs, certificados, check-ins e credenciais.
- [x] Criar testes de remocao para estudante, submissao e credencial.
- [x] Preferir soft delete quando houver valor historico/auditavel.

### RF-AUD-010 - Idempotencia e duplicados em certificados

Prioridade: Media
Estado: Implementado

Emissoes em massa devem ser idempotentes por tipo, destinatario e origem. O sistema nao deve gerar certificados duplicados para a mesma finalidade por erro operacional ou clique repetido.

Checklist:

- [x] Definir chave de negocio para duplicados por `type`, `sourceType`, `sourceId` e destinatario.
- [x] Aplicar protecao em emissao individual e em massa.
- [x] Mostrar quantos certificados foram emitidos, ignorados e por que motivo.
- [x] Auditar tentativas duplicadas.

### RF-AUD-011 - Reconciliar permissao administrativa com estado da equipa

Prioridade: Alta
Estado: Implementado

Um membro removido/suspenso da equipa deve perder acesso administrativo automaticamente. Registos em `AdminAuthorizedStudent` nao devem manter acesso indefinido sem revisao quando houver `TeamMembership` suspenso/removido.

Checklist:

- [x] Definir precedencia entre `AdminAuthorizedStudent` e `TeamMembership`.
- [x] Bloquear acesso quando o membership oficial estiver suspenso/removido, salvo excecao explicita de super admin.
- [x] Auditar conflitos de permissao.
- [x] Criar relatorio de admins autorizados sem membership ativo.

### RF-AUD-012 - Unificar UX de perfil, credencial e carteira

Prioridade: Media
Estado: Implementado

O utilizador nao deve precisar entender diferencas tecnicas entre `Student`, `AttendanceCredential`, `EventTeamCredential` e `Certificate`. A interface deve mostrar proximas acoes por finalidade e evitar formularios duplicados.

Checklist:

- [x] Criar componente reutilizavel de perfil por contexto: estudante, admin, nucleo, expositor.
- [x] Mostrar na carteira todas as credenciais com estado e acao principal.
- [x] Explicar finalidade de cada dado pedido no momento certo.
- [x] Evitar duplicacao de formularios e validacoes entre `CompletarPerfil`, admin e convite de credencial.

### RF-AUD-013 - Remover Comunidade incompleta do produto visivel

Prioridade: Critica
Estado: Implementado

O frontend possuia app de Comunidade, telas de feed, mensagens e perfil, e o schema possui tabelas `CommunityPost`, `CommunityChatThread` e relacionadas. Porem nao ha rotas backend registadas para `/community/*`. Por decisao de produto, a Comunidade deve sair do fluxo visivel ate existir modulo backend, moderacao e governanca. Links externos de comunidade/WhatsApp em cursos ou candidaturas nao fazem parte deste modulo e podem continuar quando forem beneficios permitidos.

Checklist:

- [x] Remover roteamento visivel de `/comunidade`.
- [x] Remover tratamento dedicado do host `app.uorconnect.space` no frontend.
- [x] Remover telas frontend e client API `/community/*` que apontavam para endpoints inexistentes.
- [x] Manter apenas links externos de comunidade/WhatsApp quando vierem de cursos/candidaturas reais.
- [x] Limpar definitivamente schema/tabelas de Comunidade se a decisao for remover do escopo de longo prazo.
- [x] Se voltar ao roadmap, implementar backend `/community`, moderacao, permissoes e auditoria antes de expor a UI.

### RF-AUD-014 - Endurecer sessao, tokens e ambiente de producao

Prioridade: Critica
Estado: Implementado

A sessao deve ter uma estrategia unica e segura. Hoje o backend emite cookie HttpOnly, mas o frontend tambem persiste JWT em `localStorage`; alem disso `JWT_SECRET` tem default de desenvolvimento e `CORS_ORIGIN` aceita `*` por omissao.

Checklist:

- [x] Em producao, recusar iniciar com `JWT_SECRET=dev-secret-change-me` ou segredo fraco/default.
- [x] Definir estrategia principal de sessao: cookie HttpOnly + CSRF, evitando guardar JWT em `localStorage`.
- [x] Definir refresh/logout/revogacao de sessao e limpar sessoes invalidadas.
- [x] Exigir `CORS_ORIGIN` explicito em producao, sem wildcard com credenciais.
- [x] Rever rate limit por endpoint sensivel: login, codigos, convites, validacao, uploads e scans.

### RF-AUD-015 - Remover dados operacionais hardcoded do codigo

Prioridade: Alta
Estado: Implementado

Dados vivos da organizacao nao devem ficar fixos em rotas ou dominio. Cadastro do nucleo, super admin default, nomes de autoridades em certificados, URLs publicas e valores financeiros precisam vir de banco, env ou painel administrativo.

Checklist:

- [x] Remover `DEFAULT_ADMIN_STUDENT_NUMBERS` hardcoded e substituir por bootstrap seguro/configurado.
- [x] Remover importacao operacional por `NUCLEUS_MEMBERS_JSON`; Nucleo passa a crescer por solicitacao aprovada.
- [x] Parametrizar assinaturas, autoridade, textos e instituicao dos certificados.
- [x] Centralizar URLs publicas (`uorconnect.space`, `api.uorconnect.space`, hosts dedicados) em runtime config/env.
- [x] Remover textos de placeholder/demo de producao, incluindo SEO generico e exemplos com numeros reais.

### RF-AUD-016 - Tornar permissoes administrativas declarativas e auditaveis

Prioridade: Alta
Estado: Implementado

As permissoes administrativas nao devem depender de `path.includes(...)` no middleware. Cada rota/operacao critica deve declarar permissao propria, e a regra deve diferenciar quando basta uma permissao e quando sao necessarias varias.

Checklist:

- [x] Criar helper declarativo por rota, por exemplo `requireAdminPermission(["SECURITY"])`.
- [x] Evitar inferir permissao por string de URL.
- [x] Definir semantica `ANY` vs `ALL` para permissoes compostas.
- [x] Auditar negacoes de acesso e conflitos de permissao.
- [x] Cobrir com testes as rotas de admin mais sensiveis.

### RF-AUD-017 - Usar jobs duraveis e cache para PDFs/documentos pesados

Prioridade: Alta
Estado: Implementado

Varios PDFs ainda sao gerados de forma sincrona abrindo Chromium por requisicao. A fila atual de PDF e em memoria, expira rapido e perde estado ao reiniciar o servidor. Isto afeta desempenho, escala e confiabilidade.

Checklist:

- [x] Gerar documentos pesados por job duravel em banco/queue, nao apenas em memoria.
- [x] Cachear PDFs finais por versao/snapshot quando o conteudo nao muda.
- [x] Reutilizar browser/pool ou servico de render quando houver alto volume.
- [x] Mostrar estado de processamento ao utilizador/admin.
- [x] Definir politica de expiracao, reprocessamento e limpeza dos ficheiros gerados.

### RF-AUD-018 - Separar pagamento declarado de pagamento confirmado

Prioridade: Alta
Estado: Implementado

`paymentConfirmed` representa declaracao do utilizador, nao confirmacao financeira da organizacao. Cursos, candidaturas e comprovativos precisam de estados claros, com revisor, data, motivo e impacto no acesso a beneficios.

Checklist:

- [x] Distinguir `SUBMITTED_BY_USER`, `PENDING_REVIEW`, `CONFIRMED_BY_ADMIN`, `REJECTED` e `CANCELED`.
- [x] Registrar quem confirmou/rejeitou pagamento, quando e com que observacao.
- [x] Nao liberar comunidade/beneficios de cursos enquanto pagamento exigido estiver pendente.
- [x] Nao liberar comunidade/beneficios de candidaturas enquanto a candidatura estiver em analise.
- [x] Nao liberar credencial de expositor ou certificado enquanto pagamento exigido estiver pendente.
- [x] Mostrar ao utilizador uma linha do tempo simples do pagamento.
- [x] Padronizar a regra entre candidaturas e cursos.

### RF-AUD-019 - Paginar feeds e dashboards com agregacoes no banco

Prioridade: Media
Estado: Implementado

Alguns endpoints carregam muitas relacoes e calculam contagens em memoria, como feed publico de projetos com likes/comentarios/votos e analytics com amostras grandes. Isto funciona em volume pequeno, mas degrada quando o evento cresce.

Checklist:

- [x] Paginar `/interactions/projects` e detalhes com limites claros.
- [x] Retornar contagens agregadas em vez de carregar listas completas quando a tela so precisa de totais.
- [x] Mover calculos de dashboards para queries agregadas no banco.
- [x] Criar indices para filtros reais usados por admin, feed, analytics e comunicacao.
- [x] Adicionar testes de payload maximo e tempo de resposta para endpoints criticos.

### RF-AUD-020 - Governar comunicacoes automaticas SMS/WhatsApp

Prioridade: Alta
Estado: Implementado

Mensagens automaticas afetam reputacao da organizacao. O sistema deve garantir consentimento, deduplicacao, fila com retry, historico claro e protecao contra disparos acidentais em massa.

Checklist:

- [x] Exigir consentimento valido antes de SMS/WhatsApp nao essencial.
- [x] Usar fila duravel para campanhas e automacoes, com retry e backoff.
- [x] Deduplicar destinatarios por campanha/evento.
- [x] Guardar resultado por destinatario, erro do provider e possibilidade de reenvio controlado.
- [x] Criar modo pre-visualizacao/aprovacao antes de disparos grandes.

### RF-AUD-021 - Corrigir base publica de marca, SEO e acessibilidade

Prioridade: Media
Estado: Implementado

A pagina publica ainda tem `lang="en"` e metadados como `UOR Generated Project`. Detalhes assim passam sensacao de prototipo e prejudicam partilha, indexacao e confianca.

Checklist:

- [x] Alterar `lang` para `pt-AO` ou idioma real da pagina.
- [x] Substituir meta description/OG/Twitter genericos por textos institucionais reais.
- [x] Definir imagem OG propria e consistente com a marca.
- [x] Garantir que logos/favicons referenciados existem em todos os ambientes.
- [x] Fazer revisao basica de acessibilidade em formularios, botoes iconicos, contraste e estados de erro.

### RF-AUD-022 - Instituir qualidade de entrega antes de deploy

Prioridade: Alta
Estado: Implementado

O projeto precisa de uma barreira de qualidade previsivel. Build passar nao basta se lint, testes antigos, migrations, schema deploy e smoke checks nao estiverem sincronizados.

Checklist:

- [x] Fazer `lint`, testes principais, build frontend/backend e `git diff --check` passarem antes de deploy.
- [x] Garantir que `schema.prisma`, `schema.deploy.prisma` e migrations ficam sincronizados.
- [x] Criar smoke test para login, completar perfil, minha area, admin, submissao, curso e validacao QR.
- [x] Remover ou corrigir specs antigas que falham por contratos obsoletos.
- [x] Documentar comando unico de verificacao local/CI.

## Auditoria de fluxo backend/frontend - 2026-05-09

Esta auditoria complementa a lista anterior depois da revisao componente a componente do backend e frontend. Os pontos abaixo corrigem inconsistencias reais encontradas em rotas, estados e experiencia do utilizador.

### RF-AUD-023 - Proteger documentos sensiveis de submissao

Prioridade: Critica
Estado: Implementado

Taloes, comprovativos e PDFs com dados pessoais ou financeiros nao podem ser expostos por `id` publico. O acesso deve exigir dono da submissao, admin/juri autorizado ou token assinado temporario.

Checklist:

- [x] Proteger `GET /submissions/:id/boarding-pass.pdf`.
- [x] Proteger `GET /submissions/:id/payment-proof`.
- [x] Manter acesso de dono da submissao.
- [x] Manter acesso administrativo autorizado.
- [x] Retornar `401/403` em vez de servir ficheiro a visitante anonimo.

### RF-AUD-024 - Usar fonte unica para validade publica de credenciais

Prioridade: Alta
Estado: Implementado

Carteira, validacao publica, perfil publico, PDF e admin devem usar a mesma regra para decidir se uma credencial esta pronta. `ACTIVE`, `PROFILE_READY` e `ISSUED` nao podem ter comportamentos contraditorios entre backend e frontend.

Checklist:

- [x] Fazer `/validar/:token` respeitar a politica comum.
- [x] Fazer perfil publico e PDF aceitarem os mesmos estados publicamente validos.
- [x] Fazer carteira aceitar os mesmos estados publicamente validos.
- [x] Evitar duplicidade de claim quando ja existir credencial `ACTIVE`, `ISSUED` ou `PROFILE_READY`.
- [x] Relatorio admin de perfis incompletos deve tratar estados prontos de forma consistente.

### RF-AUD-025 - Onboarding comum nao deve emitir credencial operacional

Prioridade: Alta
Estado: Implementado

`/auth/complete-profile` deve completar apenas o perfil raiz do estudante. Credenciais de nucleo, admin, staff ou expositor so podem ficar prontas nos fluxos especificos que validam vinculo, foto, consentimento e requisitos do contexto.

Checklist:

- [x] Remover promocao automatica de `EventTeamCredential` dentro de `/auth/complete-profile`.
- [x] Manter claim de nucleo/expositor como fluxo responsavel por `PROFILE_READY`.
- [x] Manter gate administrativo como fluxo responsavel por perfil admin.
- [x] Criar teste de regressao para garantir que onboarding comum nao publica credencial operacional.

### RF-AUD-026 - Sessao expirada deve ter saida clara no frontend

Prioridade: Alta
Estado: Implementado

Telas autenticadas nao devem ficar em estado vazio quando a sessao expira. O utilizador deve ser levado para login com retorno para a pagina pretendida.

Checklist:

- [x] Redirecionar `/minha-area` para login quando APIs principais retornarem `401`.
- [x] Limpar token/sinal de sessao invalido.
- [x] Preservar retorno para `/minha-area`.

### RF-AUD-027 - Convite de credencial deve comunicar requisitos reais

Prioridade: Media
Estado: Implementado

O formulario de convite nao deve dizer que foto e opcional quando a submissao bloqueia sem fotografia. A UI deve separar campos obrigatorios de campos recomendados.

Checklist:

- [x] Corrigir texto principal do convite.
- [x] Corrigir texto do upload de fotografia.
- [x] Usar a mesma regra de estado pronto no convite e na carteira.

### RF-AUD-028 - Sincronizar edicao de perfil com perfil publico de credencial

Prioridade: Media
Estado: Implementado

Quando o estudante edita bio, redes e consentimentos em `Minha Area`, o perfil publico de membro deve refletir a fonte de verdade definida pelo produto. Hoje existe risco de consentimento vir de `StudentProfileExtra`, mas os valores exibidos virem de `EventTeamCredential`.

Checklist:

- [x] Definir fonte de verdade: perfil vivo do estudante para dados editaveis e consentimentos.
- [x] Mesclar valores de `StudentProfileExtra` e `Student` no payload publico.
- [x] Manter snapshot da credencial para historico documental e emissao.
- [x] Criar teste para revogacao de consentimento e remocao imediata do dado publico.

### RF-AUD-029 - Minimizar dados pessoais na validacao publica

Prioridade: Media
Estado: Implementado

Validacao publica deve provar autenticidade sem revelar mais dados pessoais do que o necessario. Dados completos de presenca devem ficar para scanner/admin autenticado quando houver risco de exposicao publica.

Checklist:

- [x] Definir payload publico minimo para certificado, presenca e credencial.
- [x] Mascara de numero de estudante quando exibicao completa nao for necessaria.
- [x] Separar validacao publica de validacao operacional autenticada.
- [x] Atualizar `PublicValidation` para mostrar apenas dados autorizados.

### RF-AUD-030 - Acoes publicas devem respeitar estado real da credencial

Prioridade: Media
Estado: Implementado

Carteira e telas de perfil nao devem mostrar acao publica para credencial pendente, expirada, revogada ou desativada.

Checklist:

- [x] Ocultar link de perfil publico quando a credencial ainda nao esta pronta.
- [x] Manter download de passe bloqueado quando a credencial nao esta pronta.
- [x] Usar helper unico de estado pronto no frontend.

### RF-AUD-031 - Transformar lista do Nucleo em cadastro digital operacional

Prioridade: Critica
Estado: Implementado

A lista de estudantes do Nucleo nao deve depender de PDF, imagem, documento externo ou seed fixo para operar. A fonte oficial deve ser `TeamMembership`, criada por aprovacao de `TeamMembershipClaim` ou ajuste manual auditado, com numero de estudante obrigatorio, historico, estados e permissoes por area.

Checklist:

- [x] Usar `TeamMembership` como cadastro oficial do Nucleo/equipa.
- [x] Criar membros diretamente no painel administrativo.
- [x] Editar nome, numero, categoria, area, cargo, estado, notas e permissoes.
- [x] Exigir numero de estudante para criar, aprovar ou manter membro ativo do Nucleo.
- [x] Remover membro por soft delete (`REMOVED`) preservando historico.
- [x] Desativar credenciais operacionais ao remover membro do cadastro digital.
- [x] Retirar importacao/seed do fluxo operacional do Nucleo.

### RF-AUD-032 - Governanca de areas e permissoes do Nucleo

Prioridade: Alta
Estado: Implementado

Cada area do Nucleo deve ter funcoes uteis no sistema, com acesso proporcional a sua responsabilidade. Direcao, protocolo, marketing, logistica, relacoes internas/externas e explicadores nao devem depender de permissao manual solta sem contexto organizacional.

Checklist:

- [x] Manter presets por area com categoria, cargo, nivel e permissoes sugeridas.
- [x] Permitir ajustar permissoes por membro no cadastro digital.
- [x] Usar estado da `TeamMembership` para bloquear acesso de removidos/suspensos.
- [x] Separar credencial operacional de permissao administrativa efetiva.
- [x] Auditar criacao, edicao, remocao e ligacao de credenciais ao membro oficial.

### RF-AUD-033 - Tomada de posse do Nucleo por solicitacao aprovada

Prioridade: Alta
Estado: Implementado

Membros do Nucleo devem poder iniciar sessao com dados da Secretaria, usar esses dados para completar o perfil e solicitar categoria/funcao. A escolha feita pelo utilizador nao deve emitir passe nem conceder permissao automaticamente; a admin deve aprovar ou recusar a tomada de posse.

Checklist:

- [x] Criar entidade de solicitacao de tomada de posse (`TeamMembershipClaim`).
- [x] Usar dados da Secretaria para preencher nome, numero, curso, email, telefone e foto quando existirem.
- [x] Disponibilizar categorias/areas e funcoes profissionais para o Nucleo.
- [x] Criar lista do Nucleo a partir de logins no link coletivo e aprovacao administrativa.
- [x] Usar link coletivo como porta de tomada de posse, sem escolha de nome numa lista previa.
- [x] Enviar solicitacao como `PENDING_REVIEW` sem emitir passe automaticamente.
- [x] Permitir admin aprovar, criando `TeamMembership` e credencial pronta.
- [x] Permitir admin recusar com motivo auditavel.
- [x] Auditar submissao, aprovacao e recusa.

### RF-AUD-034 - Matriz profissional de acessos administrativos por area e funcao

Prioridade: Alta
Estado: Implementado

As permissoes da admin devem nascer da responsabilidade real do membro no Nucleo e do numero de estudante, que e a chave forte de identidade usada pela seguranca. Todo membro ativo do Nucleo deve conseguir entrar na admin; cargos administrativos, coordenadores, subcoordenadores e lideres recebem acesso completo.

Principios:

- Numero de estudante e obrigatorio em `TeamMembership` do Nucleo porque o acesso administrativo e reconciliado por esse identificador.
- Todo membro ativo do Nucleo recebe acesso administrativo minimo: `OVERVIEW`, `TASKS`, `NUCLEUS` e `CREDENTIALS`.
- Cargos administrativos e liderancas recebem acesso completo a todas as permissoes administrativas, incluindo `SECURITY`, porque assumem responsabilidade de gestao.
- `NUCLEUS` controla cadastro digital, tomada de posse, areas, cargos e membros do Nucleo.
- `CREDENTIALS` controla passes, links, PDFs, revogacao e reemissao de credenciais.
- Nucleo e a organizacao; as categorias visiveis para o utilizador sao as areas funcionais dentro do Nucleo.
- As areas funcionais exibidas na admin devem vir da mesma fonte usada no link de tomada de posse.
- Codigos internos de permissao podem existir no backend, mas a interface deve mostrar nomes em portugues.
- `AUDIT`, `DATA_EXPORT` e `SECURITY` sao sensiveis e entram por acesso completo de direcao/lideranca ou ajuste auditado.
- Membro efetivo, membro colaborador e staff recebem admin basico do Nucleo; areas e cargos podem acrescentar permissoes operacionais.
- Coordenador, subcoordenador e lider de atividade recebem acesso completo quando a admin aprovar a tomada de posse.
- A admin pode ajustar permissoes antes de aprovar, mas essa alteracao deve continuar auditavel.

Catalogo de permissoes:

| Permissao | Finalidade | Perfil recomendado |
| --- | --- | --- |
| `OVERVIEW` | Visao geral operacional | Direcao, coordenacoes |
| `NUCLEUS` | Tomada de posse e cadastro digital | Direcao, Secretaria, coordenacoes autorizadas |
| `CREDENTIALS` | Passes, QR, PDF, revogacao e reemissao | Direcao, Secretaria, Tecnologia, Logistica |
| `SECURITY` | Administradores, jurados, configuracoes sensiveis | Direcao/liderancas com acesso completo ou responsavel tecnico nomeado |
| `AUDIT` | Logs e rastreabilidade | Direcao, Tesouraria, controlo interno |
| `DATA_EXPORT` | Exportacao de dados pessoais | Direcao, Secretaria, Tesouraria |
| `TASKS` | Tarefas internas | Todos os cargos operacionais autorizados |
| `STUDENTS` | Consulta/gestao de estudantes | Secretaria e Assuntos Academicos |
| `COURSES` | Cursos, inscricoes e comprovativos | Academica/Formacao, Tesouraria |
| `CERTIFICATES` | Emissao/revogacao de certificados | Academica/Formacao |
| `ATTENDANCE` | Check-in e scanners | Tecnologia, Logistica, Staff de evento |
| `EVENTO` | Conteudo e operacao do evento | Eventos, Logistica, Apoio |
| `SCHEDULE` | Agenda | Eventos, Relacoes, Logistica |
| `SPEAKERS` | Palestrantes/convidados | Relacoes, Comunicacao |
| `PANELS` | Paineis e destaques publicos | Eventos, Comunicacao, Relacoes |
| `GUIDE`/`FAQ`/`LIVE` | Conteudo publico e ao vivo | Comunicacao, Tecnologia |
| `SUBMISSIONS`/`VOTES`/`WINNERS` | Candidaturas, votacao e resultados | Eventos/Projetos |
| `SMS` | Comunicacoes SMS/WhatsApp | Comunicacao ou Relacoes com aprovacao operacional |
| `ANALYTICS` | Indicadores e comportamento publico | Direcao, Tecnologia |

Matriz por area do Nucleo:

| Area | Acessos sugeridos |
| --- | --- |
| Presidencia e Governanca | `OVERVIEW`, `NUCLEUS`, `CREDENTIALS`, `EVENTO`, `TASKS`, `AUDIT`, `DATA_EXPORT`, `ANALYTICS` |
| Secretaria Geral | `NUCLEUS`, `CREDENTIALS`, `STUDENTS`, `TASKS`, `DATA_EXPORT` |
| Tesouraria e Patrimonio | `TASKS`, `COURSES`, `DATA_EXPORT`, `AUDIT` |
| Assuntos Academicos e Formacao | `TASKS`, `COURSES`, `CERTIFICATES`, `STUDENTS`, `GUIDE` |
| Tecnologia, Sistemas e Dados | `TASKS`, `CREDENTIALS`, `ATTENDANCE`, `LIVE`, `ANALYTICS` |
| Comunicacao, Imagem e Media | `TASKS`, `GUIDE`, `FAQ`, `LIVE`, `PANELS`, `SPEAKERS` |
| Eventos, Projetos e Inovacao | `TASKS`, `EVENTO`, `SCHEDULE`, `SUBMISSIONS`, `PANELS`, `VOTES`, `WINNERS` |
| Relacoes Institucionais e Parcerias | `TASKS`, `SPEAKERS`, `PANELS`, `SCHEDULE`, `SMS` |
| Logistica, Protocolo e Operacoes | `TASKS`, `EVENTO`, `SCHEDULE`, `ATTENDANCE`, `CREDENTIALS` |
| Apoio Operacional | `TASKS`, `EVENTO` |

Matriz por funcao:

| Funcao | Regra de acesso |
| --- | --- |
| Presidente | Recebe acesso completo por direcao e responsabilidade institucional. |
| Vice-presidente | Recebe acesso completo por direcao adjunta. |
| Secretario(a)-geral | Recebe acesso completo por responsabilidade administrativa e documental. |
| Tesoureiro(a) | Recebe acesso completo por responsabilidade financeira e auditoria. |
| Coordenador(a) de area | Recebe acesso completo por lideranca de area. |
| Subcoordenador(a) de area | Recebe acesso completo quando aprovado pela admin. |
| Lider de projeto ou atividade | Recebe acesso completo para executar a iniciativa. |
| Membro efetivo | Recebe admin basico do Nucleo e permissoes da sua area. |
| Membro colaborador | Recebe admin basico do Nucleo e permissoes da sua area quando aprovado. |
| Staff de evento | Recebe admin basico do Nucleo com `EVENTO` e `ATTENDANCE` para operacao pontual. |

Checklist:

- [x] Separar `NUCLEUS` e `CREDENTIALS` de `SECURITY`.
- [x] Fazer a aba Nucleo depender de `NUCLEUS`.
- [x] Fazer a aba Credenciais depender de `CREDENTIALS`.
- [x] Permitir que `TeamMembership` ativo do Nucleo abra a admin mesmo quando a permissao antiga esteja vazia.
- [x] Garantir admin basico para membro efetivo/colaborador do Nucleo.
- [x] Garantir acesso completo para cargos administrativos e liderancas.
- [x] Associar permissoes do Nucleo ao mesmo mecanismo da aba Seguranca/Admin.
- [x] Atualizar presets profissionais de areas do Nucleo.
- [x] Documentar matriz de acessos por area e funcao.
- [x] Mostrar permissoes em portugues na admin do Nucleo.
- [x] Tratar Nucleo como organizacao e area funcional como categoria operacional.
- [x] Usar a mesma lista de areas no link de tomada de posse e na aba Nucleo.
- [x] Aplicar a mesma linguagem visual dos passes nas listas de membros, perfis prontos e credenciais da admin.

## Checklist de implementacao por fases

### Fase 0 - Correcoes criticas de coerencia e seguranca

- [x] Proteger documentos sensiveis de submissao (`RF-AUD-023`).
- [x] Unificar validade publica de credenciais (`RF-AUD-024`).
- [x] Impedir que onboarding comum emita credencial operacional (`RF-AUD-025`).
- [x] Corrigir sessao expirada em `Minha Area` (`RF-AUD-026`).
- [x] Fechar ou ocultar modulo Comunidade incompleto (`RF-AUD-013`).
- [x] Endurecer sessao, tokens, CORS e segredo de producao (`RF-AUD-014`).
- [x] Fechar submissao publica insegura de credenciais (`RF-AUD-004`).
- [x] Corrigir validacao publica de credenciais `INVITED`, `EXPIRED`, `REVOKED` (`RF-AUD-006`).
- [x] Impedir liberacao de beneficios pagos antes de confirmacao financeira (`RF-AUD-018`).
- [x] Corrigir "Editar perfil" para nao apontar para onboarding concluido (`RF-AUD-001`).
- [x] Remover obrigatoriedade de foto para estudante comum (`RF-AUD-002`).
- [x] Reconciliar permissao administrativa com estado oficial da equipa (`RF-AUD-011`).

### Fase 1 - Fechar base operacional

- [x] Remover navbar/footer publico da admin.
- [x] Criar shell administrativo imersivo.
- [x] Criar gate de completar cadastro administrativo.
- [x] Melhorar cadastro de credencial com redes, foto, morada opcional e preview.
- [x] Melhorar passe A4 com linhas de corte.
- [x] Criar relatorio de perfis administrativos incompletos.
- [x] Criar validacao explicita de campos faltantes no gate.
- [x] Transformar lista do Nucleo em cadastro digital operacional (`RF-AUD-031`).
- [x] Governar areas e permissoes do Nucleo (`RF-AUD-032`).
- [x] Criar tomada de posse do Nucleo por solicitacao aprovada (`RF-AUD-033`).
- [x] Criar matriz profissional de acessos administrativos por area e funcao (`RF-AUD-034`).
- [x] Remover dados operacionais hardcoded de codigo de producao (`RF-AUD-015`).
- [x] Tornar permissoes administrativas declarativas e auditaveis (`RF-AUD-016`).

### Fase 2 - Estruturar identidade

- [x] Criar `StudentProfileExtra`.
- [x] Criar `TeamMembership`.
- [x] Migrar extras de `notes`.
- [x] Associar admin por `TeamMembership.studentNumber`.
- [x] Criar ferramenta de correspondencia nome/numero.
- [x] Criar revisao manual de ambiguidades.
- [x] Criar consentimentos explicitos e revogaveis (`RF-AUD-003`).
- [x] Suportar multiplos papeis/credenciais por estudante (`RF-AUD-005`).

### Fase 3 - Profissionalizar credenciais

- [x] Criar status/revogacao/expiracao/versionamento.
- [x] Criar logs de validacao.
- [x] Criar frente e verso do passe.
- [x] Criar lote A4.
- [x] Criar templates por categoria.
- [x] Criar painel de reemissao/revogacao.
- [x] Normalizar estados, labels e validade das credenciais (`RF-AUD-006`).
- [x] Garantir snapshots de emissao para credenciais (`RN-PC-010`).

### Fase 4 - Carteira e governanca

- [x] Criar carteira digital em `Minha Area`.
- [x] Criar consentimentos por finalidade.
- [x] Criar configuracao de visibilidade.
- [x] Criar auditoria completa de perfis/credenciais.
- [x] Migrar imagens para storage.
- [x] Sincronizar edicao de perfil com perfil publico de credencial (`RF-AUD-028`).
- [x] Separar validacao publica de validacao operacional autenticada (`RF-AUD-029`).
- [x] Definir retencao de dados.
- [x] Remover `any`/bypasses de tipos em rotas de producao (`RF-AUD-008`).
- [x] Criar politica consistente de remocao/integridade referencial (`RF-AUD-009`).
- [x] Tornar emissao de certificados idempotente (`RF-AUD-010`).
- [x] Governar comunicacoes automaticas SMS/WhatsApp (`RF-AUD-020`).

### Fase 5 - Performance, documentos e qualidade publica

- [x] Migrar PDFs/documentos pesados para jobs duraveis e cache (`RF-AUD-017`).
- [x] Paginar feeds e dashboards com agregacoes no banco (`RF-AUD-019`).
- [x] Corrigir SEO, acessibilidade e base publica de marca (`RF-AUD-021`).
- [x] Instituir checklist de qualidade local/CI antes de deploy (`RF-AUD-022`).
- [x] Fazer smoke test fim a fim dos fluxos principais.

## Criterios de aceite globais

- [x] Nenhum utilizador comum e obrigado a preencher dados que nao precisa.
- [x] Nenhum admin entra sem perfil administrativo completo.
- [x] Toda credencial valida pode ser verificada por QR.
- [x] QR nao expoe dados pessoais diretamente.
- [x] Credenciais impressas tem corte, codigo, QR e legibilidade.
- [x] Dados publicos respeitam consentimento.
- [x] Dados privados aparecem apenas para perfis autorizados.
- [x] Alteracoes importantes ficam auditadas.
- [x] Certificados e credenciais usam snapshots para preservar integridade historica.
- [x] Nenhum modulo visivel no frontend aponta para endpoint inexistente.
- [x] Nenhum segredo, super admin ou lista operacional critica fica hardcoded no codigo.
- [x] Nenhum beneficio pago e liberado sem confirmacao financeira auditavel.
- [x] Jobs longos sobrevivem a reinicio do servidor ou falham com recuperacao clara.
- [x] Build, lint, testes essenciais e migrations estao sincronizados antes de deploy.
