# Wiki do Projeto UOR Connect

Esta pasta organiza o conhecimento persistente do projeto. A regra é simples: documentos soltos continuam a existir quando já são usados, mas o entendimento consolidado fica aqui, com índice e log.

Esta pasta também é agora o **vault do Obsidian** do projeto. Para abrir no Obsidian, escolha a pasta `docs/wiki/` como cofre.

## Estrutura

- `.obsidian/`: configuração partilhada do vault. O estado local de janela/workspace fica ignorado no Git.
- `schema.md`: regras de manutenção da wiki.
- `index.md`: catálogo vivo dos documentos e páginas principais.
- `log.md`: histórico cronológico das atualizações da wiki.
- `raw/`: fontes brutas ou referências a materiais originais.
- `pages/`: sínteses mantidas pelo agente, com ligações para os ficheiros de origem.

## Como Usar

1. Antes de organizar documentação, leia `schema.md`.
2. Ao adicionar conhecimento novo, crie ou atualize uma página em `pages/`.
3. Atualize `index.md`.
4. Registe a alteração em `log.md`.

Esta wiki evita que requisitos, decisões e manuais fiquem espalhados pela raiz do projeto sem contexto.
