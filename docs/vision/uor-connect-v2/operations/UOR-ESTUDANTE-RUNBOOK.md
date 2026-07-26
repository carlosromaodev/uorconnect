# UOR Estudante — operação, continuidade e incidentes

```yaml
document_id: UOR-EST-OPS-001
status: approved
owner: Engenharia UOR Estudante
authority: operational
version: 1.0
approved_by: Project owner via backend implementation authorization
approved_at: 2026-07-22
review_cycle: trimestral e após incidente ou restore
next_review: 2026-10-22
depends_on:
  - ../SDD-002-UOR-ESTUDANTE.md
  - ../SDD-005-CAPACIDADES-TRANSVERSAIS.md
```

## Objetivos de continuidade

| Classe | Dados | RPO | RTO |
| --- | --- | ---: | ---: |
| crítica | identidade, autorizações, comandos externos e auditoria | 15 minutos | 2 horas |
| importante | snapshots oficiais, Moodle e configurações | 1 hora | 4 horas |
| reconstruível | caches, projeções derivadas e notificações deduplicáveis | 24 horas | 8 horas |

O piloto só pode abrir quando existir um restore PostgreSQL ensaiado nos últimos 90 dias. A evidência deve registar data, operador, hash do backup, base isolada, tempos observados, verificações e incidentes encontrados. Ausência de evidência mantém `RNF-EST-027` e `RNF-EST-039` fora de `verified`.

## Backup e restore

- Executar backup cifrado a cada 15 minutos para dados críticos, com retenção diária de 35 dias e mensal de 12 meses.
- Guardar a chave de backup fora da base, no gestor de segredos; nunca em `.env`, logs ou no próprio artefacto.
- Usar `npm run backup:uor-student -- backup --output <caminho>` com `DATABASE_URL` e `UOR_STUDENT_BACKUP_KEY_BASE64` injetados pelo gestor de segredos.
- Restaurar somente numa base PostgreSQL vazia e isolada: `npm run backup:uor-student -- restore --input <caminho> --confirm-isolated-target`.
- Verificar tabelas críticas, contagens, integridade referencial, leitura de um snapshot, revogação de uma autorização e reconciliação somente-leitura de comando.
- Não promover a base restaurada sem decisão formal de incidente e rotação dos segredos externos.

## Incidente de credencial ou sessão externa

1. Declarar incidente, severidade, produto, tenant, provedor e `traceId`; preservar evidência sem copiar segredos.
2. Desativar a capacidade afetada por flag. Escritas independentes permanecem isoladas.
3. Revogar sessões e envelopes comprometidos, incrementar a geração de conexão e bloquear retries automáticos da credencial rejeitada.
4. Rodar chaves com janela de leitura da chave anterior; recriptografar envelopes e remover a chave antiga após confirmação.
5. Identificar estudantes e comandos afetados por auditoria, nunca por conteúdo de logs sensíveis.
6. Comunicar estado e ação necessária sem nota, dívida, senha, cookie ou referência completa.
7. Recuperar por leitura oficial, reconciliar estados `UNKNOWN` e reativar uma capability por vez.
8. Registar causa, linha temporal, contenção, recuperação, evidência e ações corretivas.

## Incidente de drift do portal

- O parser deve falhar fechado e manter o último snapshot válido como `stale`.
- Desativar apenas o contrato/capability afetado; não inferir seletores nem reenviar escrita ambígua.
- Preservar resposta sanitizada, hash, estado HTTP, domínio e correlação para análise.
- Atualizar fixture, contrato e teste antes da reativação.
- Uma resposta upstream bem-sucedida não prova efeito: confirmar pela pós-condição oficial ou deixar o comando `UNKNOWN`/`VERIFYING`.

## Monitorização e alertas

- Sinais: latência p50/p95/p99 por rota, taxa de erro, jobs por estado/idade, lease expirado, snapshots `stale`, drift, OTP falhado/bloqueado, SMS falhado, comandos `UNKNOWN`, restauração e uso administrativo.
- Dimensões obrigatórias: `product=uor_student`, domínio, tenant, provedor, resultado e correlação; nunca número académico completo nem payload financeiro.
- Alertar quando: p95 de leitura local exceder 500 ms por 15 minutos; job mais antigo exceder duas TTL; drift ocorrer; comando ficar `UNKNOWN` por 15 minutos; OTP/SMS falhar acima do limiar; backup não concluir em 30 minutos; restore de 90 dias vencer.

## Checklist de recuperação

- [ ] Capacidade afetada isolada por flag.
- [ ] Evidência e correlação preservadas.
- [ ] Segredos revogados/rotacionados quando aplicável.
- [ ] Restore ou rollback executado em alvo explícito.
- [ ] Integridade e ownership verificados.
- [ ] Snapshots e comandos reconciliados por leitura.
- [ ] Comunicação minimizada enviada.
- [ ] Métricas regressaram ao SLO.
- [ ] Pós-incidente e atualização documental concluídos.
