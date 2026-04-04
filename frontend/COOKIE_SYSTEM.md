# UOR Connect Cookie System

## Categorias

### Essenciais
- `uor_auth`
  - Finalidade: sessão autenticada com JWT em cookie `httpOnly`
  - Duração: 7 dias
  - Gestão: criado no login e limpo no logout
- `uor_csrf`
  - Finalidade: proteção CSRF por double-submit token
  - Duração: 7 dias
  - Gestão: renovado no login
- `uor_session_hint`
  - Finalidade: indicar ao frontend que existe sessão ativa por cookie
  - Duração: 7 dias
  - Gestão: criado no login e limpo no logout
- `uor_device`
  - Finalidade: identificar o dispositivo para contexto de segurança
  - Duração: 180 dias
  - Gestão: essencial, criado no login
- `uor_last_connection`
  - Finalidade: registar a última conexão para sinais de sessão suspeita
  - Duração: 7 dias
  - Gestão: essencial, atualizado no login

### Analytics
- `uor_visitor_id`
  - Finalidade: identificar visitante anónimo para page views, scroll, tempo e conversões
  - Duração: 90 dias
  - Gestão: só existe com consentimento analytics
- `uor_analytics_session`
  - Finalidade: agrupar eventos por sessão
  - Duração: 1 dia
  - Gestão: só existe com consentimento analytics

### Funcionalidade
- `uor_functional_state`
  - Finalidade: última página visitada, filtros, interesses temporários e estados de visualização
  - Duração: 30 dias
  - Gestão: só existe com consentimento funcional

### Marketing
- `uor_marketing_attribution`
  - Finalidade: persistir UTMs e origem de campanhas
  - Duração: 30 dias
  - Gestão: só existe com consentimento marketing

## Consentimento

- O consentimento é guardado em `uor_consent_state`
- Versão atual: `2026.03`
- Categorias geríveis:
  - `essential`
  - `analytics`
  - `functional`
  - `marketing`
- O utilizador pode:
  - aceitar tudo
  - recusar opcionais
  - abrir o centro de preferências
  - revogar consentimento a qualquer momento pelo botão `Gerir cookies`

## JWT + Cookies

- O sistema mantém compatibilidade com o fluxo antigo em `Authorization: Bearer`
- O fluxo novo passa também a emitir `uor_auth` em cookie `httpOnly`
- O backend prioriza o cookie quando ele existe
- Em pedidos autenticados por cookie, o backend exige `x-csrf-token` igual ao valor do cookie `uor_csrf`
- O frontend envia `credentials: include` automaticamente

## Privacidade

- Sem consentimento explícito, não são criados cookies opcionais de analytics, funcionalidade ou marketing
- O backend guarda `ipHash` anonimizado em vez de IP bruto
- Eventos de consentimento são registados separadamente para auditoria

## Gestão no Admin

- A aba `Analytics` mostra:
  - visitantes
  - sessões
  - conversão
  - top páginas
  - top eventos
  - campanhas
  - consentimento
  - eventos recentes
- Exportação disponível em CSV
