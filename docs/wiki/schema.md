# Schema da Wiki

## Objetivo

Manter uma camada organizada entre os ficheiros brutos do projeto e as respostas futuras do agente. A wiki deve acumular conhecimento, não apenas listar ficheiros.

## Camadas

### Fontes

Fontes são documentos originais, relatórios, planos, imagens, PDFs, requisitos e notas criadas durante o trabalho. Elas devem ser preservadas com o menor número possível de alterações.

Exemplos atuais:

- Requisitos na raiz: `RF_RNF_*.md`
- Planos em `docs/superpowers/plans/`
- Specs em `docs/superpowers/specs/`
- Notas técnicas em `backend/*.md`, `frontend/*.md`, `deploy/*.md`

### Wiki

As páginas em `docs/wiki/pages/` são sínteses mantidas pelo agente. Elas podem combinar várias fontes, apontar contradições e indicar decisões atuais.

### Índice e Log

- `index.md` é o mapa de navegação por tema.
- `log.md` é cronológico e append-only.

## Convenções de Páginas

Cada página sintetizada deve usar este cabeçalho:

```markdown
# Título

Status: ativo | rascunho | obsoleto
Última atualização: AAAA-MM-DD
Fontes principais: `ficheiro.md`, `docs/...`
```

## Regras de Organização

1. Não criar novos `.md` soltos na raiz, exceto quando forem documentação principal do repositório.
2. Colocar documentação nova em `docs/wiki/pages/`, `docs/superpowers/`, ou na pasta específica do módulo.
3. Manter materiais temporários em `tmp/`.
4. Manter materiais oficiais/entregáveis em `docs/` ou em storage próprio do sistema.
5. Não mover ficheiros antigos em massa sem validar referências.
6. Ao mover um documento, atualizar links e mencionar no `log.md`.
7. Quando uma resposta do agente definir regra de negócio, fluxo operacional ou decisão de arquitetura, registrar a síntese na wiki.

## Regras Para Código

Backend:

- Código por domínio em `backend/src/modules/<dominio>/`.
- HTTP/routes dentro de `http/`.
- Regras de aplicação dentro de `application/`.
- Contratos e testes junto do domínio quando possível.
- Utilitários realmente partilhados em `backend/src/core/`.

Frontend:

- Telas grandes por feature em `frontend/src/features/`.
- Componentes reutilizáveis por área em `frontend/src/components/`.
- Chamadas à API e tipos em `frontend/src/lib/api.ts`, ou em ficheiros dedicados quando crescerem.
- Testes de contrato próximos da área que validam.
- Reaproveitar design existente antes de criar padrão visual novo.

Documentação:

- Requisitos duráveis em `docs/wiki/pages/` ou `docs/superpowers/specs/`.
- Planos de execução em `docs/superpowers/plans/`.
- Relatórios antigos podem ficar onde estão, mas devem ser indexados.
