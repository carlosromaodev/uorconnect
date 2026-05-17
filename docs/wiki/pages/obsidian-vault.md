# Vault Obsidian

Status: ativo
Última atualização: 2026-05-17
Fontes principais: `raw/obsidian-cofre/Bem-vindo.md`, `.obsidian/`

## Decisão

O antigo `cofre/` foi migrado para `docs/wiki/`. A partir de agora, `docs/wiki/` é o cofre oficial do Obsidian e também a wiki persistente do projeto UOR Connect.

## Estrutura Nova

```text
docs/wiki/
  .obsidian/              # configuração do vault
  README.md               # orientação rápida
  schema.md               # regras de organização
  index.md                # índice navegável
  log.md                  # histórico de manutenção
  raw/obsidian-cofre/     # notas antigas preservadas
  pages/                  # sínteses vivas e atualizadas
```

## Regra de Uso

Abrir `docs/wiki/` no Obsidian, não a pasta antiga `cofre/`.

As notas antigas foram preservadas como fonte. O trabalho novo deve acontecer em `pages/`, com atualização de `index.md` e `log.md`.

## O Que Foi Migrado

- `Bem-vindo.md`
- `UOR Connect - Estado atual do projeto.md`
- `Deploy - Nova VPS.md`
- `Passaporte UOR Connect - Regras e estado.md`
- `Relatorios gerais - Estado e calculos.md`
- `Formadores - Link generico.md`

## O Que Não Deve Ser Versionado

O estado local do Obsidian, como `workspace.json`, fica ignorado no Git porque muda conforme janelas e abas abertas no computador.
