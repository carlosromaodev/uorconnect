# Hoppscotch - UOR Connect

Esta pasta contém a coleção Hoppscotch para validar os fluxos críticos antes e durante a actividade.

## Ficheiros

- `uor-connect.collection.json`: coleção principal.
- `environments/local.example.json`: ambiente local sem passwords reais.
- `environments/vps.example.json`: modelo para VPS/produção.
- `environments/*.local.json`: ambientes locais com segredos, ignorados pelo Git.

## Preparar local

```bash
cp hoppscotch/environments/local.example.json hoppscotch/environments/local.local.json
```

Depois edita `hoppscotch/environments/local.local.json` e preenche:

- `studentNumber` e `studentPassword`
- `isptecStudentNumber` e `isptecPassword`
- `adminStudentNumber` e `adminPassword`
- `submissionId`, `certificateId` e `passportChallengeId` com dados existentes na base local

## Importar no Hoppscotch

1. Abre Hoppscotch.
2. Importa `hoppscotch/uor-connect.collection.json`.
3. Importa o ambiente local ou VPS.
4. Seleciona o ambiente e executa a coleção por secção.

## Executar por CLI

O CLI atual do Hoppscotch requer Node.js 22+. Com Node 22 ativo:

```bash
npm run hoppscotch:run:local
```

## Validar estrutura da coleção

Este comando não chama a API; só confirma que a coleção e os ambientes têm os fluxos obrigatórios:

```bash
npm run hoppscotch:check
```

## Cobertura principal

- Login UOR
- Login ISPTEC
- Login admin
- Minha Área
- Mapa do desafio do expositor
- Votação via QR do expositor
- Feedback qualificado
- Passaporte Digital
- Ranking/overview do Passaporte
- Configuração, ranking, alertas e embaixadores do expositor na admin
- Certificados do estudante e certificados na admin

Pedidos destrutivos, como reset de votos/passaporte, ficam fora da coleção principal para evitar acidentes em plena actividade.
