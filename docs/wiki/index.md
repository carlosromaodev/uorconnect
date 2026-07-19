# Índice da Wiki

Última atualização: 2026-05-17

## Orientação da Wiki

- [README](README.md): como usar esta pasta.
- [Schema](schema.md): regras de manutenção, organização e evolução.
- [Log](log.md): histórico cronológico da wiki.
- [Organização de Arquivos](pages/organizacao-de-arquivos.md): onde colocar código, docs, fontes e entregáveis.
- [Vault Obsidian](pages/obsidian-vault.md): como o antigo `cofre/` foi migrado para a wiki.

## Sínteses Vivas do Projeto

- [Estado Atual do UOR Connect](pages/uor-connect-estado-atual.md): visão consolidada do produto, infraestrutura, áreas e pendências.
- [Deploy na Nova VPS](pages/deploy-nova-vps.md): operação principal de deploy e saúde da VPS.
- [Deploy na VPS Antiga](pages/deploy-vps-antiga.md): fallback histórico em `135.181.47.46` e cuidados para publicar sem sobrescrever segredos.
- [Passaporte UOR Connect](pages/passaporte-uor-connect.md): regras do desafio, mapa, QR surpresa, convites e proteções.
- [Relatórios Gerais da Admin](pages/relatorios-gerais-admin.md): objetivo, cálculos, PDFs e cuidados.
- [Formadores - Link Genérico](pages/formadores-link-generico.md): especificação do fluxo de cadastro de formadores.

## Requisitos e Regras de Negócio

- [`RF_RNF_REGRAS_PASSAPORTE_DIGITAL.md`](../../RF_RNF_REGRAS_PASSAPORTE_DIGITAL.md): requisitos do Passaporte Digital.
- [`PASSAPORTE_DIGITAL_DINAMICA_JOGO.md`](../../PASSAPORTE_DIGITAL_DINAMICA_JOGO.md): dinâmica de jogo do Passaporte Digital.
- [`RF_RNF_REGRAS_PASSAPORTE_EXPOSITOR_PONTUACAO.md`](../../RF_RNF_REGRAS_PASSAPORTE_EXPOSITOR_PONTUACAO.md): sistema de pontuação, expositor, votos e bónus.
- [`RF_RNF_REGRAS_PERFIS_CREDENCIAIS.md`](../../RF_RNF_REGRAS_PERFIS_CREDENCIAIS.md): perfis, credenciais e regras associadas.
- [`backend/REQUISITOS.md`](../../backend/REQUISITOS.md): requisitos do backend.
- [`frontend/REQUISITOS.md`](../../frontend/REQUISITOS.md): requisitos do frontend.

## Operação, Deploy e Infraestrutura

- [`DEPLOY_VPS_ONLY.md`](../../DEPLOY_VPS_ONLY.md): deploy na VPS.
- [`DEPLOY_VERCEL_HETZNER.md`](../../DEPLOY_VERCEL_HETZNER.md): notas de deploy Vercel/Hetzner.
- [`docs/DEPLOY_NOVA_VPS.md`](../DEPLOY_NOVA_VPS.md): nova VPS.
- [`docs/DEPLOY_VPS_ANTIGA.md`](../DEPLOY_VPS_ANTIGA.md): VPS antiga.
- [`NGROK_SETUP.md`](../../NGROK_SETUP.md): configuração de túnel local.
- [`deploy/TESTE_LOCAL_WAHA.md`](../../deploy/TESTE_LOCAL_WAHA.md): testes locais do WAHA.

## Áreas do Produto

- Passaporte Digital: ver requisitos e dinâmica de jogo acima.
- Passaporte do Expositor e Pontuação: ver `RF_RNF_REGRAS_PASSAPORTE_EXPOSITOR_PONTUACAO.md`.
- Credenciais e passes: ver `RF_RNF_REGRAS_PERFIS_CREDENCIAIS.md`.
- Admin e responsividade: ver relatórios antigos indexados abaixo.
- Login UOR/ISPTEC: ver [`backend/isptec.md`](../../backend/isptec.md).
- Segurança e anti-fraude ODIN: implementação no módulo `backend/src/modules/security/`.

## Planos e Specs Recentes

- [`docs/superpowers/plans/2026-05-16-game-sms-passport-exhibitor.md`](../superpowers/plans/2026-05-16-game-sms-passport-exhibitor.md): SMS, jogo, QR surpresa e expositor.
- [`docs/superpowers/plans/2026-05-16-project-public-details-mobile-manual.md`](../superpowers/plans/2026-05-16-project-public-details-mobile-manual.md): detalhes públicos e manual mobile.
- [`docs/superpowers/plans/2026-05-14-exhibitor-scoring-completion.md`](../superpowers/plans/2026-05-14-exhibitor-scoring-completion.md): conclusão do scoring do expositor.
- [`docs/superpowers/specs/2026-05-15-passaporte-expositor-minha-area-visual-design.md`](../superpowers/specs/2026-05-15-passaporte-expositor-minha-area-visual-design.md): design visual na Minha Área.

## Relatórios Antigos Ainda Úteis

- [`INDEX_RELATORIOS.md`](../../INDEX_RELATORIOS.md): índice dos relatórios de responsividade admin.
- [`RESUMO_EXECUTIVO_ADMIN.md`](../../RESUMO_EXECUTIVO_ADMIN.md): resumo executivo da responsividade admin.
- [`ANALISE_RESPONSIVIDADE_ADMIN.md`](../../ANALISE_RESPONSIVIDADE_ADMIN.md): análise técnica.
- [`IMPLEMENTACAO_FIXES_ADMIN.md`](../../IMPLEMENTACAO_FIXES_ADMIN.md): proposta de fixes.
- [`VISUAL_ANTES_DEPOIS.md`](../../VISUAL_ANTES_DEPOIS.md): comparativo visual.
- [`CHECKLIST_IMPLEMENTACAO.md`](../../CHECKLIST_IMPLEMENTACAO.md): checklist operacional.
- [`ANALISE_PERFIS_CREDENCIAIS_ESTUDANTES.md`](../../ANALISE_PERFIS_CREDENCIAIS_ESTUDANTES.md): análise de perfis, credenciais e estudantes.

## Fontes da Mentalidade LLM Wiki

- [`backend/llm-wiki.md`](../../backend/llm-wiki.md): fonte original usada para criar a skill local `llm-wiki`.

## Fontes Importadas do Antigo Cofre Obsidian

- [`raw/obsidian-cofre/Bem-vindo.md`](raw/obsidian-cofre/Bem-vindo.md): nota inicial do cofre antigo.
- [`raw/obsidian-cofre/UOR Connect - Estado atual do projeto.md`](raw/obsidian-cofre/UOR%20Connect%20-%20Estado%20atual%20do%20projeto.md): mapa geral antigo.
- [`raw/obsidian-cofre/Deploy - Nova VPS.md`](raw/obsidian-cofre/Deploy%20-%20Nova%20VPS.md): nota operacional antiga.
- [`raw/obsidian-cofre/Passaporte UOR Connect - Regras e estado.md`](raw/obsidian-cofre/Passaporte%20UOR%20Connect%20-%20Regras%20e%20estado.md): nota antiga do desafio.
- [`raw/obsidian-cofre/Relatorios gerais - Estado e calculos.md`](raw/obsidian-cofre/Relatorios%20gerais%20-%20Estado%20e%20calculos.md): nota antiga dos relatórios.
- [`raw/obsidian-cofre/Formadores - Link generico.md`](raw/obsidian-cofre/Formadores%20-%20Link%20generico.md): nota antiga dos formadores.
