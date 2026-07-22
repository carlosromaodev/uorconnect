# Estudo de viabilidade — API de Integração da Secretaria

```yaml
document_id: UOR-SECRETARIA-FEASIBILITY
status: approved
owner: Integrações UOR Estudante
authority: informative
version: 1.1
last_reviewed: 2026-07-21
depends_on:
  - vision/uor-connect-v2/SDD-002-UOR-ESTUDANTE.md
  - vision/uor-connect-v2/adrs/ADR-005-INTEGRACOES-EXTERNAS.md
```

**Data:** 21 de julho de 2026
**Sistema analisado:** netPA da Universidade Óscar Ribas
**Âmbito:** funções disponíveis ao perfil de estudante e viabilidade de exposição segura no UOR Connect

## 1. Resumo executivo

A API é **viável por fases**, começando em modo estritamente de leitura. O portal disponibiliza um conjunto amplo de dados pessoais, académicos e financeiros, mas não foi encontrada evidência de uma API pública/documentada. A integração atual do UOR Connect autentica por formulário HTML, mantém cookies da sessão e já conhece uma chamada AJAX interna de inscrições/notas. Esta abordagem permite um MVP, mas é frágil e não deve ser tratada como integração definitiva.

O maior bloqueador de produção é de segurança: o endereço atualmente usado é HTTP, sem TLS. Credenciais, cookies e dados académicos não devem circular dessa forma numa integração de produção. Antes do lançamento, é necessário obter HTTPS válido ou um canal privado/VPN junto da Universidade/fornecedor.

**Parecer:**

- MVP de consulta de perfil, situação curricular, inscrições e notas: **viável**, com risco técnico médio.
- Consulta de horários, exames, sumários, faltas e presenças: **provavelmente viável**, após validar os endpoints AJAX e formatos.
- Consulta financeira: **provavelmente viável**, mas exige controlos reforçados e validação funcional.
- Operações de escrita (matrícula, candidaturas, revisão de notas, fotografia, senha, pagamentos): **não recomendadas na primeira fase**.
- Integração estável de longo prazo: **depende de cooperação institucional**, API oficial, acesso à base por vistas controladas ou contrato técnico com o fornecedor do netPA.

## 2. Método e limites da análise

Foi usada a conta de teste fornecida para autenticação e navegação somente de leitura. Não foram submetidos pedidos, candidaturas, inscrições, alterações de dados, pagamentos, fotografia ou senha.

Atualização de 2026-07-22: depois do diagnóstico inicial, contas adicionais autorizadas permitiram validar escrita controlada. Foi gerada apenas uma referência de pagamento para uma cobrança de recurso e extraído o respetivo PDF; nenhum pagamento foi iniciado ou liquidado. Também foram confirmados os contratos de propinas, valores em dívida, histórico de pagamentos e detalhes imprimíveis de itens pagos.

O login respondeu com HTTP 200 e apresentou a área privada e respetivo menu. Foram identificados 29 destinos internos. Contudo, o sistema legado devolveu a mesma página de validação de navegador ao coletor HTTP para os diferentes destinos. Portanto:

- os módulos e destinos do menu estão **confirmados**;
- o conteúdo detalhado de cada módulo e os seus campos estão **parcialmente confirmados** pelo conector já existente e pela nomenclatura das páginas;
- ações de escrita, regras de negócio e todos os endpoints AJAX ainda precisam de captura controlada num navegador real;
- este estudo cobre o perfil de estudante testado, não perfis administrativos da Secretaria.

## 3. Inventário funcional observado

| Domínio | Funções observadas | Stage/destino identificado | Potencial de API |
|---|---|---|---|
| Identidade | Dados pessoais | `BoletimMatricula` | Alto, leitura |
| Privacidade | Consentimentos | `myconsents` | Médio; dados sensíveis e possível escrita |
| Preferências | Configurar alertas | não exposto claramente como stage próprio | Médio; deixar para fase posterior |
| Candidaturas | Calendário de candidaturas | `DatasCandidatura` | Alto, leitura |
| Candidaturas | Candidatura a curso | `CSSnetHomePrivada` | Baixo no MVP; fluxo transacional |
| Candidaturas | Consultar candidaturas | `CandidaturasExistentes` | Alto, leitura |
| Académico | Plano de estudos / situação curricular | `situacaodealuno` | Alto, leitura |
| Académico | Unidades curriculares e notas | `ConsultaNotasAluno` | Alto; parcialmente conhecido |
| Académico | Horário | `ListarAulasAluno` | Alto, leitura |
| Académico | Exames | `CalendarioExamesAluno` | Alto, leitura |
| Académico | Sumários | associado à área de consultas | Médio; confirmar destino/endpoints |
| Académico | Faltas | `ConsultaFaltasAlunos` | Alto, leitura |
| Académico | Presenças | `ConsultaPresencasAlunos` | Alto, leitura |
| Matrícula | Matrícula/inscrição | `BoletimMatricula` | Leitura alta; escrita não recomendada inicialmente |
| Formação | Formação avançada | `MinhasFormacoesAvancadas` | Médio; depende de dados existentes |
| Formação | Estágios | `MeusEstagios` | Médio; depende de dados existentes |
| Avaliação | Inscrição a exames | `ConsultaInscricaoEpocas` | Leitura média; escrita de risco alto |
| Avaliação | Pedidos de revisão de notas | `ListaPedidosRevisaoNotasAluno` | Consulta alta; submissão só após contrato funcional |
| Atividades | Atividades curriculares | área agrupadora no menu | Médio; confirmar fonte |
| Atividades | Atividades extracurriculares | `AtividadesExtraCurricularesAluno` | Médio, leitura |
| Competências | Competências linguísticas | `CompetenciasLinguisticasAluno` | Médio, leitura |
| Financeiro | Resumo financeiro | `SituacaoFinanceira` | Alto, leitura; sensibilidade elevada |
| Financeiro | Propinas, dívidas, pagamentos e comprovativos | `SituacaoFinanceira`, `DIFTasks` e `StepSeleccionarItemsConta` | Alto, leitura e geração de referência confirmadas; liquidação fora da API |
| Diretórios | Cursos | `CursosDiretorioPublico` | Alto, leitura e cacheável |
| Diretórios | Unidades curriculares | menu confirmado; destino a validar | Alto, leitura e cacheável |
| Diretórios | Horários | menu confirmado; destino a validar | Alto, leitura |
| Diretórios | Avaliações | menu confirmado; destino a validar | Médio, leitura |
| Perfil | Alterar fotografia | `AtualizarFotografia` | Não incluir no MVP |
| Segurança | Alterar senha | `changepasswordstage` | Não intermediar pela API do UOR Connect |

Também foram observados destinos técnicos de layout/sessão (`difhomestage`, `difheader`, `difrightnavbar`, `diffooter`, `browservalidator`, `Accessibility` e `LogoutStage`), que não representam recursos de negócio da API.

## 4. Evidência técnica já existente no projeto

O conector atual em `backend/src/modules/auth/infra/secretaria-client.ts` demonstra:

- autenticação por `POST /netpa/page?stage=loginstage`;
- sessão mantida por cookies;
- consulta de perfil em `BoletimMatricula`;
- acesso ao ecrã `ConsultaNotasAluno`;
- chamada AJAX `GET /netpa/ajax/consultanotasaluno/inscricoes`;
- extração de número, nome, email, curso, nascimento, nacionalidade e telefone;
- inferência de ano letivo, período, ano curricular, disciplina, turma e estado da inscrição.

Atualização de 2026-07-22: `backend/src/modules/secretaria` já contém a API isolada, sessão cifrada, leituras normalizadas, snapshots e comandos duráveis controlados por feature flag. O diagnóstico original de rota apenas planeada fica preservado como estado anterior ao início da implementação.

## 5. Arquitetura recomendada

```text
UOR Connect frontend
        |
        v
API UOR Connect / integrations/secretaria
        |
        +-- cofre de sessão efémera e cifrada
        +-- adaptadores por domínio
        +-- normalização e validação de schemas
        +-- cache privado curto + auditoria
        |
        v
netPA (HTML/AJAX) ou API oficial futura
```

Regras essenciais:

1. O frontend nunca recebe cookies, URLs internas, HTML ou IDs técnicos do netPA.
2. A senha não é persistida; deve ser usada apenas para criar/renovar a sessão.
3. Cookies de upstream ficam cifrados, com TTL curto, revogação e associação ao utilizador.
4. Toda resposta informa `source`, `syncedAt`, `stale`, `coverage` e `traceId`.
5. Notas e finanças são sempre marcadas como oficiais da Secretaria.
6. Falhas parciais não viram valores zero; devem usar `null`, `partial`, `stale` ou `failed`.
7. Escrita fica desativada até haver documentação, idempotência, auditoria e autorização institucional.

## 6. API proposta por fases

### Fase 0 — descoberta técnica

- Capturar, num navegador real, as requisições XHR/fetch de cada módulo.
- Documentar parâmetros, paginação, formatos, códigos de erro e expiração da sessão.
- Confirmar se existe CSRF token, captcha, limitação de requisições e sessão única.
- Obter autorização formal da UOR e confirmar termos/licença do netPA.
- Resolver HTTPS ou canal privado.

### Fase 1 — MVP somente leitura

```http
POST   /api/v1/integrations/secretaria/session
DELETE /api/v1/integrations/secretaria/session
GET    /api/v1/integrations/secretaria/session/status
GET    /api/v1/integrations/secretaria/me
GET    /api/v1/integrations/secretaria/academic-status
GET    /api/v1/integrations/secretaria/enrolments
GET    /api/v1/integrations/secretaria/curriculum
GET    /api/v1/integrations/secretaria/grades
GET    /api/v1/integrations/secretaria/schedule
GET    /api/v1/integrations/secretaria/exams
GET    /api/v1/integrations/secretaria/attendance
```

### Fase 2 — finanças e processos

```http
GET /api/v1/integrations/secretaria/finance/overview
GET /api/v1/integrations/secretaria/finance/charges
GET /api/v1/integrations/secretaria/finance/debts
GET /api/v1/integrations/secretaria/finance/payments
GET /api/v1/integrations/secretaria/applications
GET /api/v1/integrations/secretaria/grade-review-requests
```

### Fase 3 — transações, apenas com acordo institucional

- candidatura a curso;
- matrícula/inscrição;
- inscrição em época de exame;
- pedido de revisão de nota;
- gestão de consentimentos e alertas.

Alteração de senha e recuperação de conta devem continuar diretamente no sistema da Secretaria. Pagamentos só devem ser integrados por uma API oficial do prestador financeiro, nunca por automação cega de formulário.

## 7. Riscos e mitigação

| Risco | Probabilidade | Impacto | Mitigação |
|---|---:|---:|---|
| Tráfego upstream sem HTTPS | Alta | Crítico | TLS válido, VPN ou rede privada antes de produção |
| Mudança de HTML/stage/campos | Alta | Alto | adaptadores isolados, testes de contrato e monitorização |
| API interna não documentada | Alta | Alto | descoberta controlada e acordo com fornecedor |
| Bloqueio/limitação do portal | Média | Alto | cache, filas, backoff e limites por estudante |
| Exposição de credenciais/cookies | Média | Crítico | não persistir senha, cifrar sessão, logs redigidos |
| Dados incompletos interpretados como zero | Média | Alto | schemas com nulabilidade e cobertura explícita |
| Escrita duplicada ou parcial | Média | Crítico | excluir do MVP; depois idempotência e reconciliação |
| Dependência de uma conta/perfil | Alta | Médio | testar vários cursos, anos e estados académicos |
| Falta de autorização institucional | Média | Crítico | aprovação formal, finalidade e política de retenção |

## 8. Critérios de go/no-go

**GO para piloto interno de leitura** se:

- houver autorização formal;
- o canal até ao netPA estiver protegido;
- pelo menos três perfis representativos forem testados;
- os endpoints de perfil, inscrições e notas tiverem contratos automatizados;
- senhas não forem armazenadas e logs estiverem redigidos;
- existir alerta para mudanças de resposta e falhas de autenticação.

**NO-GO para produção** enquanto:

- o upstream continuar acessível apenas por HTTP público;
- a integração depender de scraping sem monitorização;
- não houver definição de consentimento, retenção e acesso a dados financeiros;
- operações de escrita não tiverem documentação e suporte institucional.

## 9. Estimativa preliminar

| Entrega | Esforço indicativo | Dependências |
|---|---:|---|
| Descoberta completa e contratos técnicos | 1–2 semanas | navegador real, contas de teste, autorização |
| MVP perfil + currículo + inscrições + notas | 2–4 semanas | Fase 0 concluída |
| Horários + exames + faltas/presenças | 1–2 semanas | endpoints AJAX estáveis |
| Financeiro somente leitura | 2–3 semanas | segurança e validação funcional reforçadas |
| Operações de escrita | não estimar ainda | API oficial/acordo, idempotência e auditoria |

As estimativas são de engenharia para uma pessoa familiarizada com o projeto e não incluem o tempo de negociação com a Universidade ou fornecedor.

## 10. Próxima decisão recomendada

Avançar com a **Fase 0** e, em seguida, construir o MVP somente leitura sobre o namespace já definido em `/api/v1/integrations/secretaria`. Em paralelo, solicitar à UOR/fornecedor: documentação de integração, HTTPS, política de rate limit, contas de homologação e autorização para consumo dos dados.

O estudo deve ser atualizado após a captura das chamadas reais de cada ecrã; só então os endpoints de Fase 2 podem ser classificados como confirmados.
