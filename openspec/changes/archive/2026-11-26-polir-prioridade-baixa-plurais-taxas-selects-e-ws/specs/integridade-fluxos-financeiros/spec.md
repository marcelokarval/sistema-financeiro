# Delta Specification — integridade-fluxos-financeiros (Pacote 3)

## ADDED Requirements

### Requirement: Opção explícita de desseleção nos selects opcionais de investimentos e parcelas
Os seletores opcionais de `InvestmentEditor` (`accountId`, `categoryId`) e `InstallmentPlanEditor` (`cardId`, `categoryId`) MUST oferecer item `"Nenhum(a)"` traduzido que limpa o campo e persiste `null` ao remover um vínculo existente.

#### Scenario: Usuário limpa vínculo opcional selecionado anteriormente
- **WHEN** o usuário abre `InvestmentEditor` ou `InstallmentPlanEditor` e seleciona `"Nenhum(a)"` (`none`) em conta, cartão ou categoria
- **THEN** o estado do formulário volta a vazio (`''`), novos registros são enviados sem vínculo (`null`/`undefined`) e edição de investimento com vínculo prévio envia `null` para limpar a relação no banco

### Requirement: Reconexão WebSocket finita com backoff exponencial e fallback silencioso
O hook `useRealtime` em `src/hooks/use-realtime.ts` MUST limitar reconexões automáticas a número finito de tentativas com backoff exponencial e tratar `connect_error` e `reconnect_failed` silenciosamente preservando `reconnect()` manual e `SERVER_SNAPSHOT`.

#### Scenario: Serviço WebSocket indisponível em execução standalone
- **WHEN** `useRealtime` tenta conectar com o serviço `:3004` indisponível
- **THEN** o socket realiza no máximo `3` tentativas com atraso exponencial (`2000ms` a `30000ms`), desconecta ao atingir `reconnect_failed` sem lançar erros ou spam no console, e permite nova tentativa via `reconnect()`
