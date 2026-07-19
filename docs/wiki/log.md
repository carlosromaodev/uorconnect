# Log da Wiki

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
