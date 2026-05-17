# Estado Atual do UOR Connect

Status: ativo
Última atualização: 2026-05-17
Fontes principais: `raw/obsidian-cofre/UOR Connect - Estado atual do projeto.md`, `docs/wiki/index.md`

## Visão Geral

O UOR Connect é a plataforma principal da atividade, reunindo site público, Minha Área do estudante, área administrativa, submissão de projetos, credenciais, passaportes, votação, SMS/WhatsApp, relatórios, PDFs e deploy em VPS.

## Produção

- VPS principal: `178.105.109.96`
- Caminho em produção: `/opt/uorconnect`
- API: `https://api.uorconnect.space`
- Site: `https://uorconnect.space`
- Admin: `https://admin.uorconnect.space`
- Health check: `https://api.uorconnect.space/health`

Serviços esperados:

- `postgres`
- `backend`
- `frontend`
- `caddy`
- `evolution-api`
- `redis`

## Áreas Principais

- Frontend público: home, projetos, cursos, palestrantes, agenda, conteúdo ao vivo e divulgação do Passaporte UOR Connect.
- Minha Área: perfil, projetos, credenciais, passes, certificados, desafios, QR e submissões.
- Admin: estudantes, cursos, projetos, SMS/WhatsApp, relatórios, ODIN, credenciais, passaportes e conteúdos.
- Backend: autenticação, perfis, projetos, cursos, votos, pontuação, PDFs, SMS, relatórios, segurança e integrações.

## Regras Importantes Atuais

- O design aprovado deve ser preservado; alterações devem reaproveitar componentes existentes.
- Passaporte Digital e Passaporte do Expositor devem ser ligados sem misturar regras obrigatórias de cada um.
- Pontos e bônus são tratados como pontos no desafio.
- O fluxo de projeto precisa respeitar identidade real do membro autenticado.
- A admin precisa manter ações críticas com confirmação e auditoria.
- O ODIN acompanha comportamento suspeito por dispositivo, conta e voto.

## Pendências Que Continuam Relevantes

- Manter a wiki atualizada sempre que houver decisão de regra.
- Validar PDFs gerados com dados reais, além dos testes automatizados.
- Consolidar as regras de identidade UOR/ISPTEC e temporários.
- Continuar organizando documentos antigos em páginas vivas.

## Fonte Bruta

Ver nota original preservada em [`raw/obsidian-cofre/UOR Connect - Estado atual do projeto.md`](../raw/obsidian-cofre/UOR%20Connect%20-%20Estado%20atual%20do%20projeto.md).
