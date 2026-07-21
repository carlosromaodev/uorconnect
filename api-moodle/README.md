# API Moodle — Integração da UOR Estudante

```yaml
document_id: UOR-MOODLE-API-README
status: approved
owner: Integrações UOR Estudante
authority: informative
version: 0.2.0
last_reviewed: 2026-07-21
depends_on:
  - ../docs/vision/uor-connect-v2/SDD-002-UOR-ESTUDANTE.md
```

Esta pasta contém o contrato público normalizado e as ferramentas de análise da
integração Moodle → UOR Estudante. O Moodle continua a ser a fonte pedagógica; o
Sistema da Secretaria continua a ser a fonte oficial académica e financeira.

O frontend consome apenas a API UOR Connect. Cookies, `sesskey`, credenciais,
HTML, URLs e IDs internos do Moodle não fazem parte do contrato.

## Estado do contrato

O `openapi.yaml` está na versão `0.2.0` e cobre o MVP aprovado:

- ligação e eliminação segura da sessão;
- perfil e visão geral;
- disciplinas, secções e materiais;
- índice agregado e download controlado de materiais;
- criação e acompanhamento da sincronização.

Cada operação contém `x-implementation-status`. As 12 operações do MVP estão
marcadas como `implemented` porque as rotas Fastify, o gateway Moodle, ownership,
schemas e testes de paridade já estão ligados. Um YAML válido, sozinho, nunca é
critério suficiente para esse estado.

Funcionalidades de fase seguinte — trabalhos, quizzes, calendário, notificações
e mensagens — foram removidas deste contrato MVP para não sugerir suporte que o
backend ainda não oferece.

## Swagger e validação

Requer Node.js 20.19+ ou 22.12+.

```bash
npm install
npm run docs:validate
npm run docs
```

A Swagger UI fica em `http://127.0.0.1:18080/docs/`. A porta e o host da própria
documentação podem ser alterados com `SWAGGER_PORT` e `SWAGGER_HOST`.

O Try it out oferece os servidores:

- backend local direto: `http://127.0.0.1:3333`;
- gateway do frontend local: `http://127.0.0.1:8082/api`;
- API direta de produção: `https://api.uorconnect.ao`.

Os paths OpenAPI começam em `/integrations/moodle`. O gateway acrescenta `/api`;
por isso esse prefixo nunca é duplicado nos paths.

Scripts de documentação:

- `npm run docs:lint`: executa Redocly com regras recomendadas;
- `npm run docs:check`: verifica paths MVP, servidores, metadados de estado,
  exemplos 2xx, cobertura dos erros, campos sensíveis, paginação e paridade com
  as rotas Fastify e schemas Zod do backend;
- `npm run docs:validate`: executa as duas validações.
- `npm run inspect:check`: testa same-origin e permissões das evidências;
- `npm run validate`: valida contrato e segurança do inspetor.

Use Bearer JWT no Try it out. A autenticação por cookie também é documentada,
mas mutações por cookie exigem `X-CSRF-Token`, obtido pela aplicação e não pela
Swagger UI.

## Convenções do contrato

- Respostas JSON usam `{ data, meta }`.
- Listas usam cursor opaco e assinado, com `total` e `totalStatus`.
- Totais derivados usam `CountMetric` (`exact`, `partial`, `not_synced` ou
  `unsupported`). Valor desconhecido é `null`, nunca zero.
- A cobertura informa disciplinas processadas, totais e falhadas.
- `progressAvailable: false` implica `progressPercent: null`.
- `sections[].modules` contém apenas materiais persistidos no MVP; não representa
  fóruns, trabalhos, quizzes ou todos os módulos visíveis no Moodle.
- Todas as respostas pessoais usam `Cache-Control: private, no-store`.
- Erros usam códigos estáveis e mensagens seguras, sem dados upstream.

## Inspeção autorizada

`scripts/inspect-moodle.mjs` existe apenas para exploração autenticada e de
leitura com autorização institucional. Requer Google Chrome em
`/usr/bin/google-chrome`.

```bash
stty -echo
npm run inspect -- "<UTILIZADOR>"
stty echo
```

O script solicita a palavra-passe pela entrada padrão e grava evidências
temporárias em `/tmp/moodle-uor-inspection`. Nunca passe a palavra-passe por
argumentos, nunca a guarde em ficheiros versionados e nunca mova evidências
brutas para o Git.

O diretório de evidências é forçado para modo `0700` e os ficheiros para `0600`.
O inspetor rejeita links simbólicos de ficheiro, limita navegação à origem exata
do Moodle, mantém o sandbox do Chrome ativo e tenta terminar a sessão no bloco
`finally`, inclusive quando a inspeção falha a meio.

Limites da inspeção:

- não submete trabalhos, quizzes, mensagens ou alterações de perfil;
- não tenta obter token de Web Service;
- não contorna permissões;
- encerra a sessão upstream ao terminar.

## Documentos relacionados

- `../docs/superpowers/specs/2026-07-19-moodle-uorconnect-api-integration-design.md`;
- `../docs/moodle-uor-api-analysis.md`;
- `../docs/moodle-uor-authentication.md`;
- `../docs/moodle-uor-data-model.md`;
- `../docs/moodle-uor-endpoints.md`;
- `../docs/moodle-uor-integration-risks.md`;
- `../docs/moodle-uor-uorconnect-mapping.md`.
