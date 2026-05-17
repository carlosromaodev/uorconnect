# Organização de Arquivos

Status: ativo
Última atualização: 2026-05-17
Fontes principais: `backend/llm-wiki.md`, estrutura atual do repositório

## Princípio

O projeto deve parar de depender de documentos soltos e memória de conversa. Cada área importante precisa ter uma casa previsível: código no domínio certo, documentação persistente na wiki, planos em `docs/superpowers/`, e artefactos temporários em `tmp/`.

## Onde Colocar Documentos

Use `docs/wiki/pages/` para sínteses duráveis:

- regras de negócio consolidadas;
- decisões de arquitetura;
- fluxos de utilizador;
- explicações de áreas do sistema;
- guias que precisam continuar vivos.

Use `docs/superpowers/plans/` para planos de implementação com começo, meio e fim.

Use `docs/superpowers/specs/` para specs que ainda estão em definição.

Use `tmp/` para PDFs, screenshots, protótipos e saídas geradas durante testes.

Evite criar novos `.md` na raiz. A raiz já tem documentos antigos; eles ficam indexados até uma migração segura.

## Onde Colocar Código Backend

O padrão principal é domínio por módulo:

```text
backend/src/modules/<dominio>/
  application/   # regras de uso, serviços e orquestração
  http/          # rotas, controllers e schemas de entrada/saída
  *.spec.ts      # testes do domínio quando fizer sentido
```

Use `backend/src/core/` apenas para infraestrutura partilhada: autenticação, rotas globais, logger, plugins, env e utilitários de base.

Quando surgir uma feature nova, prefira criar ou reutilizar um módulo de domínio em vez de espalhar lógica por rotas genéricas.

## Onde Colocar Código Frontend

Use `frontend/src/features/` para experiências completas:

- admin;
- minha área;
- passaporte;
- projetos;
- login.

Use `frontend/src/components/` para componentes reutilizáveis ou componentes de área já existente, como `components/admin`.

Use `frontend/src/lib/api.ts` para contratos pequenos. Se crescer demais por domínio, separar em `frontend/src/lib/api/<dominio>.ts`.

Reaproveite componentes, modais, sons e cartões já existentes antes de criar padrões visuais novos.

## Regra Para Novas Decisões

Sempre que uma conversa definir algo importante, criar ou atualizar uma página em `docs/wiki/pages/` e linkar em `docs/wiki/index.md`.

Exemplos:

- pontuação máxima dos desafios;
- regras ODIN de suspeita;
- política de SMS/WhatsApp;
- regras de votos e jurados;
- organização de credenciais e passes;
- fluxo ISPTEC/UOR.

## Migração Segura dos Documentos Antigos

Não mover tudo de uma vez.

Sequência recomendada:

1. Indexar documentos existentes.
2. Criar páginas sintetizadas por tema.
3. Atualizar links nos documentos que apontam para ficheiros antigos.
4. Mover apenas grupos fechados de documentos.
5. Registrar no `log.md`.
