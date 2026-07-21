# Implementação da API Secretaria → UOR Estudante

## Referência

Implementar `docs/superpowers/specs/2026-07-21-secretaria-uor-estudante-api-design.md` sem persistir ou expor credenciais de teste.

## Sequência executável

### 1. Fundação

- Adicionar configuração validada, erros seguros, modelos normalizados e portas.
- Compor aplicação habilitada/desabilitada no registo de rotas.
- Reaproveitar padrões do módulo Moodle sem criar dependência entre domínios.

### 2. Segurança e sessão

- Implementar envelopes AES-256-GCM separados para credencial e cookie jar.
- Persistir ligação por estudante, geração e estado.
- Validar identidade netPA antes de guardar segredos.
- Implementar terminar sessão e desligar integração como operações distintas.

### 3. Gateway netPA

- Implementar cookie jar, login, renovação, allowlist, timeout e limite de resposta.
- Implementar chamadas AJAX confirmadas e normalização sem HTML/IDs internos.
- Detetar login expirado, HTTP 200 com erro e alteração de contrato.

### 4. Leituras e sincronização

- Expor sessão, capabilities, perfil, resumo académico, inscrições/notas, exames, aulas, faltas, presenças, finanças, referências/pagamentos e processos em leitura.
- Persistir snapshots genéricos versionados com cobertura e frescura.
- Disponibilizar sync idempotente e estado da execução.

### 5. Escritas controladas

- Implementar fundação durável de comandos e idempotência.
- Ativar geração/extração de referência depois de capturar o contrato upstream.
- Manter as restantes mutações desativadas até cumprirem os critérios da especificação.

### 6. Verificação

- Testar parsers, cifragem, sessão, ownership, respostas, contract drift e ausência de segredos.
- Executar lint, build e testes focados.
- Fazer smoke test autorizado no netPA com credenciais fornecidas apenas em memória.
- Atualizar rastreabilidade conservadoramente; `[x]` somente para `verified`.
