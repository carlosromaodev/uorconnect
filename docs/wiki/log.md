# Log da Wiki

## [2026-07-21] govern | Visão UOR Connect v2

- UOR Connect consolidada como ecossistema de UOR Estudante, UOR Eventos e UOR Direção.
- Criada a fonte normativa `docs/vision/uor-connect-v2/` com SDDs, MIG, glossário, ADRs, requisitos e rastreabilidade.
- UOR Estudante documentada integralmente; Eventos e Direção mantidos como `draft` até análise própria.
- Pacote SDD v1.0 marcado como histórico/substituído, sem apagar o conteúdo.
- Páginas vivas de arquitetura, separação, migração, estado e padrão documental atualizadas.
- Auditoria local confirmou identidade/login/Moodle e registou o restante conservadoramente.

## [2026-07-19] migrate | Separação Estudante/Eventos/Direção

- Criada a síntese `docs/wiki/pages/separacao-produtos-uor-connect.md` a partir do SDD externo de separação de produtos.
- Criada a operação `docs/wiki/pages/operacao-migracao-produtos-uor-connect.md` com fases, guardrails e estado iniciado.
- Criado `docs/wiki/pages/indice-documentacao-md.md` anexando a documentação Markdown do projeto à wiki, excluindo dependências geradas e skills vendorizadas.
- Atualizado `docs/wiki/index.md` com as novas páginas e com a integração Moodle como fonte pedagógica separada.
- Importado o pacote `UOR-Connect-SDD-Package-v1.0.zip` para `docs/wiki/raw/uorconnect-sdd-v1.0/`.
- Criadas as páginas `sdd-uorconnect-v1.md`, `padrao-sdd-uorconnect.md` e `arquitetura-plataforma-uorconnect.md`.
- Atualizada a operação de migração para APIs públicas em `/api/v1`, envelope `{ data, meta }`, telemetria e critérios de remoção do legado.
- Criado endpoint-base `/api/v1/integrations/secretaria/session/status` para separar formalmente Secretaria como fonte oficial ainda não sincronizada.

## [2026-05-27] infra | Deploy na VPS antiga

- Identificada a VPS nova como `178.105.109.96` e a VPS antiga como `135.181.47.46`.
- Criado o guia `docs/DEPLOY_VPS_ANTIGA.md` com diagnostico, backup, deploy seletivo, sincronizacao completa, validacao e rollback.
- Criada a pagina sintetizada `docs/wiki/pages/deploy-vps-antiga.md` e atualizado o indice da wiki.

## [2026-05-17] setup | LLM Wiki inicial

- Instalada a skill local `llm-wiki` em `~/.codex/skills/llm-wiki/SKILL.md`.
- Criada a estrutura `docs/wiki/`.
- Criados `README.md`, `schema.md`, `index.md` e a página `pages/organizacao-de-arquivos.md`.
- Os documentos antigos foram indexados sem serem movidos, para evitar quebrar referências e histórico.

## [2026-05-17] migrate | Cofre Obsidian para docs/wiki

- Movida a configuração `.obsidian` do antigo `cofre/` para `docs/wiki/.obsidian/`, tornando `docs/wiki/` o vault oficial do Obsidian.
- Movidas as notas antigas para `docs/wiki/raw/obsidian-cofre/`, preservando-as como fontes brutas.
- Criadas páginas sintetizadas em `docs/wiki/pages/` para estado do projeto, deploy, passaporte, relatórios, formadores e operação do vault.
- Atualizado o índice da wiki com as novas páginas e fontes.
