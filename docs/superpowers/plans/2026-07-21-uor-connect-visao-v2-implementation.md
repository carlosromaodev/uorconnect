# Plano de implementação — Visão documental UOR Connect v2

```yaml
document_id: UOR-VISION-V2-IMPLEMENTATION-PLAN
status: approved
owner: CAVINOVA
authority: informative
version: 1.0
last_reviewed: 2026-07-21
depends_on:
  - ../specs/2026-07-21-uor-connect-visao-v2-design.md
```

## Objetivo

Criar a fonte normativa v2 do ecossistema UOR Connect, diagnosticar o estado real do projeto e retirar autoridade concorrente dos Markdown de visão anteriores, sem refatorar código nem executar operações externas de escrita.

## Restrições

- Preservar alterações existentes no worktree.
- Auditar código e integrações inicialmente em modo de leitura.
- Não escrever na Secretaria, Moodle ou produção.
- Não marcar requisito como verificado apenas pela existência de código.
- Não detalhar UOR Eventos ou UOR Direção além da evidência disponível.
- Não apagar documentos históricos.

## Fase 1 — Inventário documental

1. Listar os Markdown do repositório, excluindo dependências geradas.
2. Identificar documentos que definem missão, produtos, arquitetura-alvo, dados, identidade, requisitos, permissões ou roadmap.
3. Classificar cada documento como normativo, informativo, operacional ou histórico.
4. Mapear documentos de visão anteriores para a autoridade v2.
5. Registar documentos específicos de Eventos sem os promover a visão do ecossistema.

Entregas:

- inventário no `README.md` v2;
- mapa de migração no `MIG-001`;
- lista de fontes substituídas e preservadas.

## Fase 2 — Diagnóstico técnico

1. Inventariar aplicações, módulos, rotas e serviços de deploy.
2. Classificar responsabilidades entre Estudante, Eventos, Direção e transversal.
3. Inspecionar schemas, migrações, integrações e testes relevantes à UOR Estudante.
4. Identificar implementações completas, parciais, declarativas e ausentes.
5. Executar apenas testes locais focados e sem efeitos externos.
6. Registar mistura de domínios, dependências e divergências.

Entregas:

- diagnóstico no `MIG-001`;
- estado factual na matriz de rastreabilidade;
- questões abertas nos documentos normativos.

## Fase 3 — Fonte normativa v2

Criar:

1. `README.md` — índice, governação e Open Questions.
2. `SDD-000` — ecossistema, fronteiras e propriedade dos dados.
3. `SDD-002` — UOR Estudante baseado no SDD aprovado pelo utilizador.
4. `SDD-003` — fronteira inicial da UOR Eventos, em `draft`.
5. `SDD-004` — fronteira inicial da UOR Direção, em `draft`.
6. `SDD-005` — mecanismos transversais.
7. `MIG-001` — estado atual, alvo, transição e compatibilidade.
8. `GLOSSARIO-E-MODELO-CONCEPTUAL.md`.
9. ADRs 001 a 005.

## Fase 4 — Requisitos da UOR Estudante

1. Derivar RFs do SDD-002 por capacidade e fluxo.
2. Derivar RNFs mensuráveis de segurança, privacidade, experiência, desempenho, disponibilidade, interoperabilidade, operação e manutenção.
3. Formalizar regras de negócio, estados e transições.
4. Atribuir IDs únicos, prioridade, fase, dependências e critérios de aceitação.
5. Relacionar requisitos com SDDs e ADRs sem duplicar autoridade.

## Fase 5 — Rastreabilidade

1. Criar uma entrada para cada RF, RNF e RN.
2. Usar apenas os estados controlados aprovados.
3. Marcar `[x]` exclusivamente para `verified`.
4. Associar evidência, testes, ambiente, commit e data.
5. Distinguir evidência estática, teste automatizado, integração, runtime e produção.
6. Manter `[ ]` quando a evidência for insuficiente ou a capacidade estiver misturada com outro produto.

## Fase 6 — Migração dos documentos vivos

1. Adicionar metadados de substituição ao pacote SDD v1.0.
2. Atualizar páginas vivas de arquitetura, separação, SDD e migração.
3. Atualizar o índice da wiki.
4. Corrigir nomenclatura normativa dos produtos em documentos de integração relevantes.
5. Classificar requisitos legados de Eventos e administração no produto correto.
6. Preservar relatórios, memórias, planos concluídos e documentos operacionais.

## Fase 7 — Validação

Executar verificações para:

- links Markdown locais;
- IDs documentais e requisitos duplicados;
- estados fora dos vocabulários controlados;
- `[x]` sem estado `verified`, evidência ou teste;
- termos normativos substituídos;
- documentos `superseded` sem destino;
- contradições de precedência e propriedade;
- espaços em branco e erros de diff.

## Critério de conclusão

A execução termina somente quando a fonte v2 estiver completa, os documentos anteriores estiverem classificados, a matriz refletir conservadoramente o projeto e o relatório de validação não contiver erros estruturais não explicados.
