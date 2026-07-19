# Modelo de dados da integração Moodle UÓR

**Estado:** contrato MVP implementado em 19 de julho de 2026.

O backend converte IDs, HTML, cookies, URLs e estruturas internas do Moodle em
modelos estáveis da UOR Connect. IDs públicos são UUIDs opacos, sempre consultados
com o `studentId` autenticado. IDs e URLs Moodle nunca aparecem na resposta.

## Envelope comum

```json
{
  "data": {},
  "meta": {
    "requestId": "req-1",
    "syncedAt": "2026-07-19T12:05:00.000Z",
    "stale": false,
    "snapshotVersion": 4
  }
}
```

Listas acrescentam:

```json
{
  "pagination": {
    "returned": 20,
    "limit": 20,
    "hasMore": true,
    "nextCursor": "cursor-opaco-assinado",
    "total": 29,
    "totalStatus": "exact"
  },
  "coverage": {
    "processedCourses": 29,
    "totalCourses": 29,
    "failedCourses": 0
  }
}
```

`total` é `null` quando ainda não é conhecido. Os estados possíveis são
`exact`, `partial`, `not_synced` e `unsupported`; zero nunca substitui
“desconhecido”.

## Ligação

```json
{
  "status": "CONNECTED",
  "connected": true,
  "credentialsStored": true,
  "actionRequired": "none",
  "retryable": false,
  "lastAuthenticatedAt": "2026-07-19T12:00:00.000Z",
  "lastSuccessfulSyncAt": "2026-07-19T12:05:00.000Z"
}
```

Estados: `DISCONNECTED`, `CONNECTING`, `CONNECTED`, `REFRESHING`,
`REAUTH_REQUIRED`, `DEGRADED` e o estado operacional `UNAVAILABLE`.

## Perfil Moodle mínimo

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "studentNumber": "<STUDENT_NUMBER>",
  "displayName": "Estudante Exemplo",
  "email": "estudante@example.test",
  "timezone": "Africa/Luanda",
  "lastSyncedAt": "2026-07-19T12:00:00.000Z"
}
```

O `studentNumber` retornado pelo Moodle é normalizado e deve corresponder à
identidade UOR Connect antes de qualquer segredo ser persistido.

## Disciplina

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "name": "Algoritmos",
  "shortName": "ALG",
  "category": "Engenharia",
  "description": null,
  "startDate": "2026-02-01T00:00:00.000Z",
  "endDate": null,
  "visible": true,
  "favourite": false,
  "progressAvailable": false,
  "progressPercent": null,
  "stale": false,
  "lastSyncedAt": "2026-07-19T12:05:00.000Z"
}
```

Quando o Moodle não acompanha progresso, `progressAvailable=false` e
`progressPercent=null`. Isso é diferente de progresso real igual a `0`.

## Secção

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440003",
  "courseId": "550e8400-e29b-41d4-a716-446655440002",
  "name": "Semana 1",
  "position": 1,
  "summary": null,
  "visible": true,
  "available": true,
  "modules": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440004",
      "type": "file",
      "title": "Guia.pdf",
      "available": true,
      "kind": "material"
    }
  ],
  "stale": false,
  "lastSyncedAt": "2026-07-19T12:05:00.000Z"
}
```

No MVP, `modules` contém apenas resumos de materiais persistidos. Fóruns,
trabalhos e questionários não são convertidos em materiais nem entram nessa
contagem; os respetivos endpoints permanecem fora do MVP.

## Material

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440004",
  "courseId": "550e8400-e29b-41d4-a716-446655440002",
  "sectionId": "550e8400-e29b-41d4-a716-446655440003",
  "type": "file",
  "title": "Guia.pdf",
  "description": null,
  "available": true,
  "openAvailable": true,
  "downloadAvailable": true,
  "mimeType": "application/pdf",
  "fileName": null,
  "sizeBytes": null,
  "stale": false,
  "lastSyncedAt": "2026-07-19T12:05:00.000Z"
}
```

O locator de origem é cifrado e fica apenas na infraestrutura. `fileName` e
`sizeBytes` são nulos até serem conhecidos com confiança; o título não é usado
como nome de ficheiro inventado.

## Visão geral e contagens

Cada métrica usa `{value,status}`. Materiais só são `exact` quando a paginação de
cursos e o conteúdo de todas as disciplinas terminaram sem fallback truncado.
Atividades, trabalhos abertos, questionários abertos e notificações não lidas são
`unsupported` no MVP, em vez de devolver zeros fictícios.

## Persistência interna

- `MoodleConnection`: tombstone, perfil mínimo e envelopes cifrados separados;
- `MoodleEntityRef`: mapeia chave upstream para UUID estável por estudante;
- snapshots imutáveis de disciplina, secção e material por versão;
- `MoodleSyncRun`: fila, lease, cobertura, progresso e resultado da sincronização.

Credenciais, cookie jar, `sesskey` e locators usam AES-256-GCM com AAD por
estudante/finalidade. Nenhum destes campos pertence ao modelo HTTP.

## Modelos observados para fases posteriores

Trabalhos, questionários, calendário, notificações, mensagens, fóruns e
resultados pedagógicos foram mapeados durante a análise, mas não fazem parte do
contrato implementado. Quando forem adicionados, continuarão sem URLs/IDs Moodle
e nunca serão apresentados como dados oficiais da Secretaria.
