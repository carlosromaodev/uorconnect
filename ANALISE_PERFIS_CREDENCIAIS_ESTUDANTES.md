# Analise de perfis de estudantes e credenciais digitais

Data: 2026-05-05
Projeto: UOR Connect

## Objetivo

Esta analise reune mudancas de logica e boas praticas para lidar com perfis de estudantes, membros do nucleo/equipa, acesso administrativo, credenciais digitais e credenciais imprimiveis. O foco e transformar o perfil do estudante numa fonte unica e confiavel, evitando pedir dados em excesso, melhorando a experiencia do utilizador e tornando as credenciais profissionais, verificaveis e operacionais.

## Estado atual do projeto

O projeto ja tem uma base importante:

- `Student`: guarda numero de estudante, nome, email, curso, turma/ano/periodo, telefone, foto, login e relacoes com candidaturas, votos, comentarios, comunidade, presenca e certificados.
- `AdminAuthorizedStudent`: controla quais numeros de estudante tem acesso administrativo, com equipa, role e permissoes.
- `EventTeamCredential`: cria credenciais de equipa/nucleo, com convite, perfil publico, foto, equipa, cargo, nivel de acesso, QR e PDF.
- `AttendanceCredential`: cria credencial de presenca por estudante, com token e QR validavel.
- `Certificate`: emite certificados com codigo, token de validacao, PDF e QR.
- `MinhaArea`: ja concentra jornada do estudante, foto de perfil, QR de check-in, certificados, inscricoes e submisssoes.
- `TeamCredentialInvitation` e `TeamMemberProfile`: permitem completar perfil de membro e mostrar perfil publico com passe.
- `/admin`: agora tem gate para completar cadastro administrativo antes de abrir a consola.

O ponto fraco principal e que existem perfis/credenciais com responsabilidades sobrepostas: perfil de estudante, perfil de membro da equipa, credencial de presenca, certificado e perfil publico. Isso funciona, mas precisa de uma camada de identidade mais clara para evitar duplicacao e inconsistencias.

## Problemas de logica encontrados

1. O estudante e a identidade administrativa ainda nao estao totalmente unificados.

Hoje o estudante entra com numero UOR, mas o acesso administrativo e a credencial de equipa podem ser ligados por nome. A comparacao por primeiro e ultimo nome e util como fallback, mas nao deve ser a chave principal.

Mudanca recomendada: a lista oficial do nucleo/equipa deve guardar `studentNumber` sempre que a pessoa for estudante UOR. O nome deve validar, mas nao identificar sozinho.

2. `EventTeamCredential.notes` esta a ser usado como deposito JSON para extras.

Isto e aceitavel como solucao temporaria, mas nao deve ser a estrutura final. Dados como morada, redes sociais, estado de completude, consentimento e visibilidade devem ter campos proprios ou uma tabela propria.

Mudanca recomendada: criar `StudentProfileExtra` ou expandir `EventTeamCredential` com campos estruturados.

3. Foto em base64 dentro de `avatarUrl/photoUrl` pode crescer demais.

O projeto aceita imagens em data URI. Para prototipo funciona; para producao, isso aumenta banco, payloads, PDFs e backups.

Mudanca recomendada: guardar imagens em storage (`/uploads`, S3, R2, MinIO ou pasta publica controlada) e salvar apenas URL + metadados.

4. Ha muitos perfis com nomes diferentes.

Temos `Student.avatarUrl`, `EventTeamCredential.photoUrl`, `AttendanceCredential.studentName`, `Certificate.recipientName`, autores da comunidade e dados de submissao. Alguns sao snapshots, outros deveriam ser dados vivos.

Mudanca recomendada: separar claramente:

- Perfil vivo: dados atuais do estudante.
- Snapshot: dados congelados no momento de emissao de certificado, check-in ou credencial impressa.
- Perfil publico: dados que o estudante autorizou mostrar.

5. Credenciais digitais e impressas ainda devem ter politica de validade.

As credenciais tem token e QR, mas falta uma politica explicita de expiracao, revogacao, versao, reemissao e historico.

Mudanca recomendada: toda credencial deve ter `status`, `issuedAt`, `expiresAt`, `revokedAt`, `revokedReason`, `version`, `issuedByStudentNumber` e historico de emissao.

## Modelo recomendado de identidade

### 1. Student como identidade raiz

`Student` deve ser a entidade raiz para qualquer estudante UOR.

Campos de sistema:

| Campo | Obrigatorio | Fonte | Uso |
| --- | --- | --- | --- |
| `studentNumber` | Sim | Secretaria/Login UOR | Identificacao principal |
| `name` | Sim quando disponivel | Secretaria, confirmavel pelo aluno | Exibicao, certificados, credenciais |
| `course` | Sim quando disponivel | Secretaria | Segmentacao, relatorios, certificados |
| `classCode` | Opcional | Secretaria | Turmas, filtros internos |
| `academicYear` | Opcional | Secretaria | Relatorios academicos |
| `curricularYear` | Opcional | Secretaria | Filtros por ano curricular |
| `academicSyncedAt` | Sistema | Sistema | Saber quando os dados foram atualizados |

Campos editaveis pelo estudante:

| Campo | Obrigatorio | Visibilidade padrao | Observacao |
| --- | --- | --- | --- |
| `avatarUrl` | Recomendado, nao obrigatorio para estudante comum | Publico em comunidade | Obrigatorio apenas para admin/nucleo |
| `phone` | Recomendado | Privado | Usado para SMS/WhatsApp e associacao de submissao |
| `alternatePhone` | Opcional | Privado | Recuperacao e associacao |
| `email` | Opcional | Privado | Comunicacao formal |

Campos que nao devem ir diretamente para `Student` sem cuidado:

- Morada completa.
- Documento de identidade.
- Data de nascimento.
- Redes sociais.
- Bio publica.

Esses dados devem ter consentimento e escopo de uso.

### 2. StudentProfileExtra para dados sensiveis/opcionais

Criar uma tabela dedicada:

```prisma
model StudentProfileExtra {
  id              Int      @id @default(autoincrement())
  student         Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  studentId       Int      @unique
  bio             String?
  addressDistrict String?
  addressHint     String?
  instagramUrl    String?
  facebookUrl     String?
  linkedinUrl     String?
  githubUrl       String?
  websiteUrl      String?
  visibilityJson  String?
  consentJson     String?
  completedAt     DateTime?
  updatedAt       DateTime @updatedAt
  createdAt       DateTime @default(now())
}
```

Boas praticas:

- Nao pedir morada completa como obrigatoria.
- Pedir apenas municipio/bairro/referencia quando for necessario para logistica.
- Redes sociais devem ser opcionais e publicas apenas se o estudante autorizar.
- Bio deve ter limite curto: 240 a 500 caracteres.
- Cada campo sensivel deve ter finalidade clara.

### 3. TeamMembership para nucleo/equipa

`EventTeamCredential` hoje mistura cadastro, cargo, permissoes, perfil e passe. Recomendo separar a relacao institucional:

```prisma
model TeamMembership {
  id                     Int      @id @default(autoincrement())
  student                Student? @relation(fields: [studentId], references: [id], onDelete: SetNull)
  studentId              Int?
  studentNumber          String?
  officialFirstName      String
  officialLastName       String
  displayName            String?
  area                   String
  roleTitle              String
  roleLevel              String
  mandate                String?
  status                 String   @default("ACTIVE")
  permissions            String   @default("")
  verifiedAt             DateTime?
  verifiedByStudentNumber String?
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  @@index([studentNumber])
  @@index([area, status])
}
```

`studentNumber` deve ser a chave principal quando existir. Primeiro e ultimo nome devem ser usados para:

- validar se a conta UOR corresponde a lista do nucleo;
- sugerir correspondencias quando o numero ainda nao foi preenchido;
- marcar casos ambiguuos para revisao manual.

## Que informacoes pedir e quando pedir

### Durante login de estudante comum

Pedir:

- Numero de estudante.
- Senha UOR.

Nao pedir:

- Morada.
- Redes sociais.
- Foto obrigatoria.
- Dados que a secretaria ja fornece.

Depois do login, mostrar um perfil parcialmente preenchido pela secretaria e permitir completar foto/telefone se fizer sentido.

### Em "Minha Area"

Pedir de forma progressiva:

1. Foto de perfil.
2. Telefone principal.
3. Telefone alternativo.
4. Email.
5. Confirmacao de curso se a secretaria falhar.

Uso:

- Foto: comunidade, comentarios, chat, credenciais e admin se aplicavel.
- Telefone: WhatsApp/SMS, associacao de submissao, recuperacao operacional.
- Email: envio formal de comprovativos/certificados.
- Curso: certificados, relatorios, filtros e comunidades.

Evitar:

- pedir tudo num formulario longo antes do estudante ver valor.
- obrigar redes sociais.
- usar morada para qualquer funcionalidade que nao dependa dela.

### Para membro do nucleo/equipa/admin

Campos obrigatorios:

- Nome completo.
- Foto.
- Area/equipa.
- Cargo.
- Nivel de acesso.
- Numero de estudante se for aluno UOR.

Campos recomendados:

- Telefone.
- Email.
- Bio curta.

Campos opcionais:

- Instagram.
- LinkedIn.
- GitHub.
- Website/portfolio.
- Morada reduzida: municipio/bairro/referencia, apenas se a equipa realmente usar para logistica.

Regra de experiencia:

- A admin nao deve abrir antes do perfil administrativo estar completo.
- O formulario deve explicar por que pede cada dado.
- O preview da credencial deve aparecer em tempo real.
- O utilizador deve conseguir baixar/abrir a credencial depois de completar.

### Para expositores/projetos

Pedir:

- Responsavel.
- Numero/conta do responsavel.
- Telefone.
- Curso.
- Membros da equipa.
- Necessidades logisticas.
- Comprovativos quando aplicavel.

Melhoria recomendada:

- Membros devem ser associados por convite/login, nao apenas texto livre.
- Quando um membro confirma, guardar `studentId`, `studentNumber`, nome e snapshot.
- Certificados de projeto devem ser emitidos para membros confirmados.

## Politica de visibilidade dos dados

Separar dados por publico:

### Publico

Pode aparecer em perfil publico, comunidade ou validacao:

- Nome de exibicao.
- Foto.
- Curso/area.
- Cargo/equipa.
- Bio curta.
- Redes sociais autorizadas.
- QR de validacao.

### Privado operacional

Visivel para administradores autorizados:

- Numero de estudante.
- Telefone.
- Email.
- Morada reduzida.
- Historico de check-in.
- Estado de certificados.
- Area/cargo/permissoes.

### Restrito

Somente super admin ou area responsavel:

- Logs de acesso.
- Acoes administrativas.
- Revogacoes.
- Dados usados para auditoria.
- Metadados de emissao de certificados.

## Gestao profissional de perfis

### Completeness score

Cada perfil deve ter um score de completude. Exemplo:

- Identidade academica: numero, nome, curso.
- Contacto: telefone/email.
- Imagem: foto.
- Perfil publico: bio/redes opcionais.
- Credenciais: QR emitido, status ativo.

Estados sugeridos:

- `BASIC`: login concluido, dados academicos minimos.
- `CONTACT_READY`: telefone/email confirmados.
- `PUBLIC_READY`: foto e perfil publico prontos.
- `TEAM_READY`: area/cargo/credencial de equipa prontos.
- `ADMIN_READY`: permissoes e perfil administrativo completos.

### Campos verificados vs campos declarados

Adicionar metadados por campo:

- `source`: `SECRETARIA`, `USER`, `ADMIN`, `IMPORT`.
- `verifiedAt`.
- `verifiedBy`.
- `lastChangedAt`.

Exemplo:

- Nome vindo da secretaria: confiavel.
- Foto enviada pelo estudante: declarada.
- Cargo importado pela direcao: verificado internamente.
- Morada: declarada e privada.

### Atualizacao de perfil

Boas praticas:

- Mostrar "ultima sincronizacao com secretaria".
- Permitir atualizar foto sem reenviar todos os dados.
- Validar URLs de redes sociais no frontend e backend.
- Normalizar telefone Angola.
- Guardar historico de mudancas importantes para administradores.
- Em documentos ja emitidos, manter snapshot para preservar integridade.

## Credenciais digitais

Toda credencial digital deve ter:

- Token unico forte.
- QR apontando para URL publica de validacao.
- Codigo legivel alem do QR.
- Status: `DRAFT`, `ISSUED`, `ACTIVE`, `EXPIRED`, `REVOKED`.
- Tipo: estudante, membro, staff, expositor, palestrante, juri, certificado, check-in.
- Escopo: evento, area, sala, backstage, admin, laboratorio.
- Emissor.
- Data de emissao.
- Data de expiracao quando aplicavel.
- Historico de validacoes.

O QR nao deve conter dados pessoais diretamente. Deve conter apenas URL/token. A pagina de validacao decide o que mostrar.

### Validacao publica

A pagina `/validar/:token` deve mostrar:

- Valido/invalido/revogado/expirado.
- Tipo de credencial.
- Nome.
- Numero de estudante apenas quando apropriado.
- Curso/area.
- Codigo.
- Data de emissao.
- Emissor institucional.
- Ultimo check-in, se for credencial de presenca.

Nao deve mostrar:

- Telefone.
- Email.
- Morada.
- Dados administrativos internos.

## Credenciais imprimiveis

### Formato recomendado

Para passes/crachas:

- A4 com arte centralizada.
- Tamanho do passe: 85-90mm x 125-135mm.
- Marcas de corte.
- Linha de seguranca/area segura.
- Sangria de 3mm quando houver fundo colorido.
- QR com pelo menos 24mm.
- Contraste alto.
- Nome legivel a distancia.

Para certificado:

- A4 paisagem.
- QR no rodape.
- Codigo de validacao.
- Assinatura/entidade emissora.
- Data.
- Nome e curso com alta legibilidade.

### Frente do passe

Elementos:

- Logo UOR/UOR Connect.
- Foto.
- Nome.
- Categoria: Nucleo, Staff, Expositor, Juri, Palestrante.
- Equipa/area.
- Cargo.
- Nivel de acesso.
- Cor por categoria.
- Codigo curto.

### Verso do passe

Elementos:

- QR de validacao.
- URL curta.
- Texto: "Esta credencial e pessoal e intransmissivel."
- Contacto da organizacao.
- Regras rapidas de uso.
- Data/evento.

### Profissionalismo visual

Boas praticas:

- Usar uma grelha consistente.
- Evitar excesso de gradientes.
- Usar no maximo 2 familias tipograficas.
- Garantir contraste em impressao preto/branco.
- Testar em impressora comum antes do evento.
- Nao depender apenas de cor para identificar acesso; usar texto e icones.
- Usar `print-color-adjust: exact`, mas aceitar que impressoras variam.

## Mudancas de logica recomendadas

### Alta prioridade

1. Criar `TeamMembership` separado de `EventTeamCredential`.

Motivo: a lista oficial do nucleo/equipa deve ser institucional, auditavel e versionada. A credencial deve ser uma emissao derivada desse cadastro.

2. Ligar admin ao `TeamMembership`.

Fluxo ideal:

- estudante faz login;
- sistema encontra `TeamMembership.studentNumber`;
- se nao encontrar, tenta nome como sugestao;
- se houver correspondencia ambigua, exige revisao;
- se encontrar, aplica permissoes da area/cargo;
- se perfil incompleto, mostra gate de cadastro;
- so depois abre admin.

3. Migrar extras de perfil de `notes` para campos/tabela.

Motivo: `notes` em JSON dificulta filtros, relatorios, validacao, privacidade e manutencao.

4. Criar politica de status para credenciais.

Adicionar:

- `issuedAt`
- `expiresAt`
- `revokedAt`
- `revokedReason`
- `version`
- `issuedByStudentNumber`
- `lastValidatedAt`

5. Mover imagens para storage.

Motivo: reduzir peso da base de dados e melhorar PDFs, caching e backups.

### Media prioridade

6. Criar central de perfil no backend.

Um modulo `profile` poderia unificar:

- dados academicos;
- dados editaveis;
- perfil publico;
- perfil administrativo;
- completude;
- consentimentos.

7. Criar consentimentos por finalidade.

Exemplo:

- `SHOW_PUBLIC_PROFILE`
- `SHOW_SOCIAL_LINKS`
- `RECEIVE_SMS`
- `RECEIVE_WHATSAPP`
- `USE_PHOTO_ON_BADGE`
- `USE_DATA_FOR_CERTIFICATE`

8. Criar historico de emissao/reemissao.

Uma credencial pode ser reemitida se:

- foto mudou;
- cargo mudou;
- evento mudou;
- QR foi comprometido;
- credencial foi perdida.

9. Melhorar deduplicacao de estudante.

Hoje telefone e numero ajudam a associar dados. Recomendado:

- numero de estudante como chave forte;
- telefone como chave auxiliar;
- nome nunca como chave forte;
- fuzzy match apenas para sugestao/revisao.

### Baixa prioridade

10. Designer de credenciais no admin.

Permitir escolher:

- template;
- cor por categoria;
- frente/verso;
- lote A4 com multiplos passes;
- exportacao individual ou em lote.

11. Carteira digital do estudante.

Em `Minha Area`, agrupar:

- credencial de presenca;
- credenciais de equipa;
- certificados;
- inscricoes;
- QR actions concluida.

## Fluxo ideal para admin/nucleo

1. Direcao importa lista oficial do nucleo.
2. Cada membro tem area, cargo, permissoes e, idealmente, numero de estudante.
3. Membro entra em `admin.uorconnect.space`.
4. Faz login com conta UOR.
5. Sistema valida:
   - estudante existe;
   - consta na lista oficial;
   - perfil administrativo esta completo;
   - permissoes estao ativas.
6. Se faltar perfil, abre cadastro:
   - foto obrigatoria;
   - telefone/email recomendados;
   - bio/redes/morada opcionais;
   - preview da credencial.
7. Depois de completo, abre admin especifica da area.
8. A admin mostra dados relevantes para a area:
   - Protocolo: check-in, credenciais, convidados.
   - Marketing: comunicados, posts, paineis, media.
   - Logistica: necessidades, salas, equipamentos.
   - Relacoes internas: estudantes, cursos, SMS.
   - Relacoes externas: palestrantes, parceiros, convites.
   - Direcao: auditoria, permissoes, relatorios, seguranca.

## UX recomendada para perfis

### Principios

- Pedir pouco no inicio.
- Explicar o uso de cada dado.
- Mostrar progresso.
- Mostrar preview da credencial.
- Separar obrigatorio de opcional.
- Nunca bloquear o estudante comum por falta de rede social ou morada.
- Bloquear admin/nucleo apenas quando falta identidade operacional critica.

### Formulario ideal

Secoes:

1. Identidade
   - nome;
   - foto;
   - numero de estudante;
   - curso.

2. Contacto
   - telefone;
   - email;
   - telefone alternativo.

3. Perfil publico
   - bio;
   - redes sociais;
   - visibilidade.

4. Operacao
   - area;
   - cargo;
   - nivel de acesso;
   - permissoes.

5. Credencial
   - preview;
   - QR;
   - baixar PDF;
   - link publico;
   - estado.

## Seguranca e privacidade

Boas praticas essenciais:

- Nunca colocar telefone/email/morada no QR.
- QR deve apontar para token opaco.
- Tokens devem ser revogaveis.
- Credenciais administrativas devem expirar quando a pessoa sai da equipa.
- Perfis publicos devem mostrar apenas campos autorizados.
- Logs administrativos devem registrar quem fez cada acao.
- Exportacoes PDF em lote devem exigir permissao especifica.
- Dados de menores/sensiveis devem ser minimizados.
- Toda tela admin deve respeitar permissoes por modulo.

## Proposta de arquitetura final

Camadas:

1. `Student`
   - identidade academica e dados editaveis basicos.

2. `StudentProfileExtra`
   - bio, redes, morada reduzida, consentimentos.

3. `TeamMembership`
   - relacao com nucleo/equipa, area, cargo, status e permissoes.

4. `Credential`
   - credencial generica emitida para estudante, membro, staff, expositor, certificado ou check-in.

5. `CredentialIssuance`
   - historico de emissoes/reemissoes.

6. `CredentialValidationLog`
   - scans e validacoes publicas/administrativas.

7. `Certificate`
   - documento academico/evento com snapshot permanente.

Modelo generico de credencial:

```prisma
model Credential {
  id                    Int      @id @default(autoincrement())
  token                 String   @unique
  code                  String   @unique
  type                  String
  status                String   @default("ACTIVE")
  holderStudentId       Int?
  holderStudentNumber   String?
  holderNameSnapshot    String
  holderCourseSnapshot  String?
  title                 String
  category              String?
  area                  String?
  roleTitle             String?
  accessLevel           String?
  publicSlug            String?  @unique
  validationUrl         String?
  issuedAt              DateTime @default(now())
  expiresAt             DateTime?
  revokedAt             DateTime?
  revokedReason         String?
  issuedByStudentNumber String
  metadataJson          String?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([holderStudentNumber])
  @@index([type, status])
  @@index([issuedAt])
}
```

## Roadmap sugerido

### Fase 1: organizar sem quebrar

- Manter `Student`, `EventTeamCredential`, `AttendanceCredential` e `Certificate`.
- Adicionar `TeamMembership`.
- Fazer admin validar por `studentNumber`.
- Manter fallback por nome apenas para sugestao.
- Criar tela admin para completar cadastro, ja iniciada.
- Criar relatorio de perfis incompletos.

### Fase 2: estruturar dados opcionais

- Criar `StudentProfileExtra`.
- Migrar `notes.profileExtras`.
- Adicionar consentimentos de visibilidade.
- Permitir editar perfil publico em `Minha Area`.
- Mostrar campos publicos conforme consentimento.

### Fase 3: profissionalizar credenciais

- Criar status/validade/revogacao de credenciais.
- Criar frente/verso do passe.
- Criar impressao em lote A4.
- Criar logs de validacao.
- Criar reemissao com versionamento.

### Fase 4: centralizar carteira digital

- Em `Minha Area`, criar "Carteira UOR Connect":
  - QR de presenca;
  - passe de membro;
  - certificados;
  - historico de check-ins;
  - downloads.

## Decisoes recomendadas

1. Numero de estudante deve ser a chave de identidade.
2. Nome e telefone ajudam, mas nao substituem o numero.
3. Foto deve ser obrigatoria apenas para credenciais administrativas/equipa.
4. Morada deve ser opcional e reduzida.
5. Redes sociais nunca devem ser obrigatorias.
6. Dados publicos precisam de consentimento.
7. PDFs devem usar snapshots, nao dados vivos.
8. QR deve conter apenas token/URL de validacao.
9. Credenciais precisam de status, expiracao e revogacao.
10. Admin deve ficar bloqueada ate o perfil administrativo estar completo.

## Conclusao

O projeto ja esta bem encaminhado: tem login estudantil, area do estudante, certificados, presenca, credenciais de equipa, validacao por QR e admin por permissoes. O salto de qualidade agora e transformar esses blocos num sistema coerente de identidade.

A mudanca mais importante e separar identidade, perfil, associacao de equipa e emissao de credencial. Isso vai permitir:

- menos duplicacao;
- menos erro em validacoes;
- melhor privacidade;
- credenciais mais profissionais;
- relatorios mais confiaveis;
- admin mais segura;
- experiencia mais clara para estudantes e membros do nucleo.
