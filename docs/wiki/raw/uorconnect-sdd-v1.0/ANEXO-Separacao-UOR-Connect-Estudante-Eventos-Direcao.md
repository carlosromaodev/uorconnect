# Separação de Produtos e Integrações da UOR Connect

```yaml
document_id: UOR-SEPARATION-ANNEX-V1
status: superseded
owner: CAVINOVA
authority: historical
version: 1.0
last_reviewed: 2026-07-21
superseded_by: ../../../vision/uor-connect-v2/SDD-000-ECOSSISTEMA-UOR-CONNECT.md
```

> Preservado como histórico. A separação normativa vigente está no SDD-000 v2.

## 1. Contexto

A UOR Connect está a evoluir de uma plataforma focada em eventos académicos para um ecossistema digital mais amplo da Universidade Óscar Ribas.

Essa evolução cria três experiências distintas:

1. **UOR Connect Estudante**
2. **UOR Connect Eventos**
3. **UOR Connect Direção**

Embora possam partilhar autenticação, identidade visual, infraestrutura e alguns serviços internos, não devem ser tratadas como um único produto com menus misturados.

Cada experiência resolve problemas diferentes, trabalha com dados diferentes e atende utilizadores com objetivos diferentes.

Misturar tudo numa só interface aumentaria a complexidade, confundiria permissões e faria o estudante atravessar funcionalidades administrativas e de eventos para encontrar uma simples nota. A tecnologia já complica o suficiente sem ajuda deliberada.

---

# 2. Princípio de separação

A UOR Connect deve ser entendida como uma plataforma central com produtos especializados.

```text
UOR Connect Platform
│
├── UOR Connect Estudante
├── UOR Connect Eventos
└── UOR Connect Direção
```

Cada produto deverá possuir:

- objetivo próprio;
- público principal;
- navegação própria;
- permissões próprias;
- APIs próprias;
- modelo de dados próprio;
- indicadores próprios;
- ciclo de desenvolvimento próprio.

A partilha deverá acontecer apenas em componentes transversais, como:

- autenticação;
- identidade institucional;
- gestão de utilizadores;
- notificações;
- auditoria;
- ficheiros;
- permissões;
- observabilidade;
- infraestrutura.

---

# 3. UOR Connect Estudante

## 3.1 Objetivo

A UOR Connect Estudante será a experiência central da vida académica do estudante.

O seu objetivo é reunir informação pedagógica, académica, financeira e institucional num único ambiente, organizando os dados de forma clara e orientada às necessidades reais do estudante.

A plataforma não substitui o Moodle nem o Sistema da Secretaria.

Ela funciona como uma camada de integração, organização e orientação.

## 3.2 Fontes principais

### Moodle

Fonte pedagógica para:

- disciplinas;
- materiais;
- secções;
- atividades;
- trabalhos;
- questionários;
- calendário pedagógico;
- mensagens;
- avisos;
- progresso de aprendizagem.

### Sistema da Secretaria

Fonte oficial para:

- notas oficiais;
- pautas;
- médias;
- situação académica;
- inscrições;
- matrículas;
- plano curricular;
- situação financeira;
- propinas;
- pagamentos;
- dívidas;
- multas;
- documentos;
- requerimentos;
- certificados;
- declarações.

### UOR Connect

Responsável por:

- normalizar os dados;
- apresentar uma experiência unificada;
- criar alertas;
- mostrar prioridades;
- gerar análises;
- explicar estados;
- organizar o percurso académico;
- reduzir a necessidade de navegar por vários sistemas.

## 3.3 Áreas do produto

A UOR Connect Estudante poderá ser organizada em:

- Hoje
- Vida Académica
- Aprendizagem
- Agenda
- Finanças
- Serviços
- Biblioteca
- Comunicação
- Meu Percurso

## 3.4 Dores resolvidas

A UOR Connect Estudante deverá resolver:

- informação espalhada entre Moodle, Secretaria e canais externos;
- dificuldade em encontrar materiais;
- perda de prazos;
- falta de visão sobre progresso;
- confusão entre resultados pedagógicos e notas oficiais;
- dificuldade em acompanhar pagamentos;
- falta de transparência em requerimentos;
- dificuldade em entender a situação académica;
- ausência de agenda unificada;
- comunicação institucional dispersa;
- falta de histórico organizado do percurso universitário.

---

# 4. API da Secretaria

## 4.1 Objetivo

A API da Secretaria será a camada de integração entre o Sistema da Secretaria e a UOR Connect Estudante.

Ela deverá consumir, normalizar e disponibilizar dados oficiais académicos, administrativos e financeiros.

Essa API não deverá alterar diretamente os dados da Secretaria na primeira fase.

A primeira versão deverá ser prioritariamente de leitura.

## 4.2 Responsabilidade institucional

O Sistema da Secretaria continuará a ser a fonte oficial.

```text
Sistema da Secretaria
→ origem e autoridade dos dados oficiais

API de Integração da Secretaria
→ autenticação, leitura, normalização, cache e sincronização

UOR Connect Estudante
→ apresentação, contexto, alertas e orientação
```

A UOR Connect nunca deverá fabricar, recalcular ou substituir uma nota oficial.

Qualquer cálculo complementar deverá ser identificado como estimativa ou análise da UOR Connect.

## 4.3 Dados académicos

A API deverá analisar a possibilidade de disponibilizar:

- identificação do estudante;
- número de processo;
- curso;
- turma;
- ano académico;
- regime;
- estado da matrícula;
- plano curricular;
- disciplinas inscritas;
- notas oficiais;
- notas por avaliação;
- notas finais;
- médias;
- resultados;
- aprovações;
- reprovações;
- cadeiras em atraso;
- histórico académico;
- situação de conclusão;
- pautas publicadas.

## 4.4 Dados financeiros

A API deverá analisar a possibilidade de disponibilizar:

- propinas emitidas;
- propinas pagas;
- propinas pendentes;
- dívidas;
- multas;
- descontos;
- bolsas;
- acordos de pagamento;
- referências de pagamento;
- comprovativos;
- recibos;
- extrato financeiro;
- próximo vencimento;
- estado financeiro;
- bloqueios associados a pendências.

Valores financeiros devem ser apresentados com:

- moeda;
- valor original;
- valor pago;
- saldo;
- estado;
- data de emissão;
- data de vencimento;
- data de pagamento;
- origem;
- última sincronização.

## 4.5 Serviços administrativos

A API poderá posteriormente incluir:

- pedidos de declaração;
- pedidos de certificado;
- requerimentos;
- histórico de solicitações;
- estado do processo;
- documentos emitidos;
- motivos de rejeição;
- ações exigidas ao estudante.

## 4.6 Endpoints iniciais sugeridos

```http
POST   /integrations/secretaria/session
DELETE /integrations/secretaria/session
GET    /integrations/secretaria/session/status

GET    /integrations/secretaria/me
GET    /integrations/secretaria/overview

GET    /integrations/secretaria/academic-status
GET    /integrations/secretaria/enrolments
GET    /integrations/secretaria/curriculum
GET    /integrations/secretaria/grades
GET    /integrations/secretaria/grades/{id}
GET    /integrations/secretaria/transcript

GET    /integrations/secretaria/finance/overview
GET    /integrations/secretaria/finance/charges
GET    /integrations/secretaria/finance/payments
GET    /integrations/secretaria/finance/debts
GET    /integrations/secretaria/finance/receipts

GET    /integrations/secretaria/requests
GET    /integrations/secretaria/requests/{id}

POST   /integrations/secretaria/sync
GET    /integrations/secretaria/sync/status
```

## 4.7 Regras de segurança

A API deverá garantir:

- autenticação exclusiva de estudantes autorizados;
- isolamento por estudante e instituição;
- proteção contra IDOR e BOLA;
- credenciais cifradas;
- sessões cifradas;
- chaves fora da base de dados;
- mascaramento de logs;
- rate limit;
- proteção CSRF;
- IDs opacos;
- auditoria de acesso;
- retenção mínima;
- revogação de sessão;
- eliminação segura dos dados;
- respostas sem detalhes internos do sistema da Secretaria.

Nunca deverão aparecer em respostas, Swagger ou logs:

- palavras-passe;
- cookies;
- tokens;
- identificadores internos;
- URLs privadas;
- HTML bruto;
- dados de outro estudante;
- detalhes técnicos do sistema upstream.

## 4.8 Estados de dados

Todos os dados sincronizados devem indicar:

- origem;
- data da última sincronização;
- estado;
- cobertura;
- nível de confiança;
- eventual desatualização.

Exemplo:

```json
{
  "source": "secretaria",
  "syncedAt": "2026-07-19T15:00:00Z",
  "stale": false,
  "status": "exact"
}
```

Estados possíveis:

- `exact`
- `partial`
- `not_synced`
- `unsupported`
- `stale`
- `failed`

---

# 5. UOR Connect Eventos

## 5.1 Objetivo

A UOR Connect Eventos será o produto dedicado à gestão e experiência de eventos académicos.

Ela deverá manter o foco em:

- participantes;
- expositores;
- palestrantes;
- projetos;
- votação;
- agenda;
- gamificação;
- QR Codes;
- passaporte digital;
- ranking;
- certificados;
- interação ao vivo.

## 5.2 Público

- estudantes participantes;
- visitantes;
- expositores;
- palestrantes;
- empresas;
- patrocinadores;
- organização do evento;
- avaliadores.

## 5.3 Funcionalidades próprias

- inscrição em eventos;
- agenda;
- sessões;
- palestrantes;
- exposição de projetos;
- submissão de projetos;
- votação;
- ranking;
- desafios;
- passaporte digital;
- leitura de QR Codes;
- certificados;
- chat ao vivo;
- notificações do evento;
- métricas de participação.

## 5.4 O que não pertence ao produto Eventos

A UOR Connect Eventos não deve ser responsável por:

- notas académicas;
- propinas;
- dívidas;
- matrículas;
- histórico curricular;
- materiais regulares do Moodle;
- processos administrativos permanentes;
- gestão executiva global da universidade.

Esses dados pertencem a outros contextos e permissões.

---

# 6. UOR Connect Direção

## 6.1 Objetivo

A UOR Connect Direção será o ambiente estratégico e administrativo para a liderança da instituição.

O seu objetivo será transformar dados autorizados em indicadores para tomada de decisão.

Não deve ser apenas um painel cheio de gráficos decorativos, porque barras coloridas não substituem gestão.

## 6.2 Público

- reitoria;
- direção académica;
- direção administrativa;
- direção financeira;
- coordenações;
- responsáveis institucionais autorizados.

## 6.3 Funcionalidades possíveis

- visão institucional;
- indicadores académicos;
- indicadores financeiros;
- participação estudantil;
- retenção;
- desempenho por curso;
- disciplinas críticas;
- evolução de matrículas;
- pagamentos e pendências agregadas;
- uso do Moodle;
- adesão à UOR Connect;
- métricas de eventos;
- relatórios;
- alertas institucionais;
- auditoria;
- acompanhamento de serviços.

## 6.4 Regras de privacidade

A Direção deverá receber preferencialmente dados:

- agregados;
- anonimizados;
- pseudonimizados;
- limitados por função;
- autorizados por necessidade institucional.

O acesso individual a dados de estudantes deverá exigir:

- finalidade legítima;
- permissão explícita;
- registo de auditoria;
- justificativa;
- escopo restrito.

A Direção não deverá possuir acesso indiscriminado apenas porque o painel existe.

---

# 7. Separação de navegação

## UOR Connect Estudante

```text
/estudante
/estudante/hoje
/estudante/academico
/estudante/aprendizagem
/estudante/agenda
/estudante/financas
/estudante/servicos
/estudante/biblioteca
/estudante/comunicacao
/estudante/percurso
```

## UOR Connect Eventos

```text
/eventos
/eventos/{eventoId}
/eventos/{eventoId}/agenda
/eventos/{eventoId}/projetos
/eventos/{eventoId}/votacao
/eventos/{eventoId}/ranking
/eventos/{eventoId}/passaporte
/eventos/{eventoId}/certificados
```

## UOR Connect Direção

```text
/direcao
/direcao/academico
/direcao/financeiro
/direcao/estudantes
/direcao/aprendizagem
/direcao/eventos
/direcao/relatorios
/direcao/auditoria
```

---

# 8. Separação de APIs

As integrações devem existir como serviços separados.

```text
/api/integrations/moodle
/api/integrations/secretaria
/api/events
/api/student
/api/direction
```

## Moodle Integration Service

Responsável por dados pedagógicos.

## Secretaria Integration Service

Responsável por dados oficiais académicos, administrativos e financeiros.

## Events Service

Responsável por eventos, projetos, votação, ranking, gamificação e certificados.

## Student Experience API

Responsável por combinar dados autorizados do Moodle, Secretaria e serviços internos para a experiência do estudante.

## Direction Analytics API

Responsável por indicadores agregados, relatórios e análises institucionais.

---

# 9. Separação de permissões

Perfis possíveis:

- `student`
- `event_participant`
- `exhibitor`
- `speaker`
- `event_staff`
- `academic_staff`
- `finance_staff`
- `coordinator`
- `direction`
- `system_admin`

As permissões devem ser concedidas por ação e recurso, não apenas por nome do perfil.

Exemplo:

```text
student.finance.read_own
student.grades.read_own
event.project.submit
event.vote.create
direction.academic.metrics.read
direction.finance.metrics.read
secretaria.request.manage
```

---

# 10. Autenticação e experiência unificada

O utilizador poderá utilizar uma única identidade UOR Connect.

Após autenticação, a plataforma identifica:

- quem é;
- a que instituição pertence;
- quais produtos pode acessar;
- quais funções possui;
- quais dados pode consultar.

A experiência poderá usar um seletor de contexto:

```text
UOR Connect
├── Estudante
├── Eventos
└── Direção
```

O seletor só deverá mostrar produtos autorizados.

Um estudante comum não verá a Direção.

Um membro da Direção poderá ter acesso ao contexto institucional sem misturar o painel administrativo com a sua eventual experiência pessoal.

---

# 11. Componentes partilhados

Podem ser partilhados:

- autenticação;
- perfil;
- identidade institucional;
- notificações;
- pesquisa;
- ficheiros;
- auditoria;
- permissões;
- preferências;
- acessibilidade;
- design system.

Não devem ser partilhados indiscriminadamente:

- menus;
- dashboards;
- regras de negócio;
- modelos de dados;
- permissões;
- indicadores;
- estados;
- fluxos operacionais.

---

# 12. Roadmap sugerido

## Fase 1

- consolidar UOR Connect Eventos;
- concluir Moodle Integration Service;
- iniciar Secretaria Integration Service;
- criar a base da UOR Connect Estudante;
- separar rotas e permissões.

## Fase 2

- notas oficiais;
- situação académica;
- situação financeira;
- visão Hoje;
- agenda unificada;
- serviços administrativos;
- notificações académicas.

## Fase 3

- percurso académico;
- análises;
- alertas de risco;
- relatórios institucionais;
- UOR Connect Direção;
- indicadores agregados;
- integração entre eventos e percurso estudantil.

---

# 13. Critérios de aceitação

A separação estará correta quando:

- o estudante conseguir usar a plataforma sem navegar por módulos de eventos ou direção;
- eventos funcionarem como produto próprio;
- a direção possuir ambiente próprio e protegido;
- Moodle e Secretaria forem tratados como fontes diferentes;
- notas oficiais vierem apenas da Secretaria;
- finanças vierem apenas da Secretaria;
- dados pedagógicos vierem do Moodle;
- o frontend não consumir sistemas externos diretamente;
- as APIs aplicarem ownership e permissões;
- não existirem menus universais com funcionalidades irrelevantes;
- cada produto possuir documentação e roadmap próprios.

---

# 14. Decisão arquitetural

A UOR Connect não deverá ser construída como uma aplicação única com todas as funcionalidades misturadas.

Deverá ser construída como uma plataforma com experiências especializadas:

```text
UOR Connect Estudante
→ vida académica individual

UOR Connect Eventos
→ participação e gestão de eventos

UOR Connect Direção
→ visão estratégica e institucional
```

As três experiências pertencem ao mesmo ecossistema, mas não são o mesmo produto.

Essa separação reduz complexidade, melhora segurança, facilita evolução e permite que cada utilizador veja apenas aquilo de que realmente precisa.
