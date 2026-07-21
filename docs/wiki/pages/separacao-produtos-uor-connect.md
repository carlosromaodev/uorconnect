# Separação dos Produtos da UOR Connect

Status: ativo
Última atualização: 2026-07-21
Autoridade: síntese informativa do [SDD-000 v2](../../vision/uor-connect-v2/SDD-000-ECOSSISTEMA-UOR-CONNECT.md)

## Nomenclatura

- UOR Connect: ecossistema.
- UOR Estudante: produto académico individual.
- UOR Eventos: produto de eventos.
- UOR Direção: produto institucional analítico.

As designações antigas `UOR Connect Estudante/Eventos/Direção` estão substituídas em conteúdo normativo.

## Fronteiras

| Produto | Possui | Não possui |
| --- | --- | --- |
| Estudante | perfil académico, notas normalizadas, currículo, finanças, comunidade e autorizações | eventos/votos/passaporte ou métricas institucionais globais |
| Eventos | eventos, inscrições, projetos, votos, QR, passaporte e certificados | notas, propinas ou percurso académico |
| Direção | catálogo de métricas, read models, relatórios e decisões | tabelas transacionais ou super-admin universal |

Identidade pode ser partilhada; acesso não. Direção recebe agregações autorizadas. Eventos funciona sem Secretaria/Moodle.

## Rotas-alvo

```text
/estudante/*
/eventos/*
/direcao/*
```

Rotas legadas são removidas apenas após alternativa, telemetria, testes, comunicação e rollback.

Ver também [UOR Estudante](../../vision/uor-connect-v2/SDD-002-UOR-ESTUDANTE.md), [UOR Eventos](../../vision/uor-connect-v2/SDD-003-UOR-EVENTOS.md) e [UOR Direção](../../vision/uor-connect-v2/SDD-004-UOR-DIRECAO.md).
