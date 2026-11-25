## ADDED Requirements

### Requirement: Atomicidade transacional e isolamento de transferências entre contas
O endpoint `POST /api/transfer` MUST executar a verificação de contas e saldo, o débito condicional da conta de origem, o crédito da conta de destino e a criação das duas transações dentro de uma única transação atômica `db.$transaction`, gravando ambas as transações com `type: "TRANSFER"`. Os agregadores de fluxo financeiro que distinguem receitas de despesas MUST excluir `TRANSFER` do cômputo de receitas e despesas.

#### Scenario: Transferência válida com saldo suficiente
- **WHEN** `POST /api/transfer` recebe contas distintas existentes e saldo suficiente na origem
- **THEN** debita a conta de origem, credita a conta de destino e grava as duas transações com `type: "TRANSFER"` atomicamente, retornando HTTP 201

#### Scenario: Transferência concorrente ou com saldo insuficiente (TOCTOU)
- **WHEN** o saldo na origem é insuficiente ou duas requisições concorrentes disputam o mesmo saldo disponível
- **THEN** no máximo uma transferência é efetivada e a requisição sem saldo retorna HTTP 400 sem alterar saldos nem criar transações parciais

#### Scenario: Agregadores não somam TRANSFER como despesa ou receita
- **WHEN** existem transações `type: "TRANSFER"` persistidas e são consultados `/api/financial-calendar`, `/api/timeline`, `/api/quick-stats`, `/api/networth` e `/api/advisor`
- **THEN** os totais de receitas e despesas ignoram `TRANSFER` e o resumo de transações recentes identifica `TRANSFER` sem rotular como despesa

### Requirement: Atomicidade e validação estrita na criação de transações
O endpoint `POST /api/transactions` MUST validar `type` (`INCOME`, `EXPENSE` ou `TRANSFER`), `amount` finito positivo, `description` não vazia e `date` válida, executando a criação da transação e a atualização do saldo da conta atomicamente dentro de `db.$transaction`.

#### Scenario: Criação de transação com entrada inválida
- **WHEN** `POST /api/transactions` recebe `type` fora do enum permitido, `amount` menor ou igual a zero, `NaN`, `Infinity` ou `date` inválida
- **THEN** retorna HTTP 400 sem persistir transação nem alterar saldo de conta

#### Scenario: Falha parcial ao atualizar saldo na criação
- **WHEN** `POST /api/transactions` falha na atualização da conta vinculada
- **THEN** a transação inteira sofre rollback e nenhum registro de `Transaction` permanece órfão

### Requirement: Pagamento atômico de parcelas de consórcio e parcelamentos
Os endpoints `POST /api/consortiums/installments` e `POST /api/installments/pay` MUST executar leitura, guarda condicional `status: { not: "PAID" }` via `updateMany` e atualização dos contadores do plano/consórcio com `{ increment }` atômico dentro de `db.$transaction`.

#### Scenario: Pagamento concorrente da mesma parcela
- **WHEN** duas requisições simultâneas tentam pagar o mesmo `installmentId` em `/api/consortiums/installments` ou `/api/installments/pay`
- **THEN** exatamente uma marca a parcela como `PAID` e incrementa o contador em 1, enquanto a segunda retorna HTTP 400 sem duplicar incremento ou valor financiado

#### Scenario: Conclusão automática ao pagar a última parcela
- **WHEN** o pagamento atômico faz o total pago atingir `installmentCount`
- **THEN** o consórcio ou plano de parcelamento é atualizado para `status: "COMPLETED"` na mesma transação

### Requirement: Processamento idempotente de transações recorrentes devidas
O endpoint `POST /api/recurring/process` MUST processar as recorrências vencidas dentro de `db.$transaction` utilizando reivindicação condicional por `id`, `isActive: true` e `nextDate` esperada antes de criar a transação e atualizar o saldo da conta.

#### Scenario: Execução concorrente ou falha parcial no processamento recorrente
- **WHEN** duas chamadas simultâneas invocam `POST /api/recurring/process` para a mesma recorrência devida ou ocorre erro ao atualizar saldo
- **THEN** a recorrência é processada no máximo uma vez com avanço único de `nextDate`, ou sofre rollback completo em caso de erro

### Requirement: Validação estrita na criação de transações de investimento
O endpoint `POST /api/investments/transactions` MUST validar `amount` com `Number.isFinite(Number(amount))` maior que zero e `date` válida (alinhado ao `PUT`), aplicando os deltas numéricos atomicamente ao investimento.

#### Scenario: Rejeição de valor ou data inválidos no POST de investimento
- **WHEN** `POST /api/investments/transactions` recebe `amount` menor ou igual a zero, `NaN`, `Infinity` ou `date` inválida
- **THEN** retorna HTTP 400 sem alterar `currentBalance` ou `investedAmount` do investimento

### Requirement: Reconstrução retroativa de balanceSparkline em quick-stats
O endpoint `GET /api/quick-stats` MUST reconstruir `balanceSparkline` retroativamente a partir do `netWorth` atual para que o último ponto (`balanceSparkline[5]`) seja igual ao `netWorth` arredondado, excluindo `TRANSFER` de receitas e despesas.

#### Scenario: Reconstrução retroativa da série de patrimônio em quick-stats
- **WHEN** há receitas, despesas, compras e transferências nos últimos 6 meses em `GET /api/quick-stats`
- **THEN** `balanceSparkline[5]` equivale ao `netWorth` atual e cada ponto anterior reflete a subtração do saldo líquido mensal posterior, sem incluir `TRANSFER`

### Requirement: Apuração de dívidas e passivos históricos em networth
O endpoint `GET /api/networth` MUST incluir dívidas ativas de `Consortium`, somar parcelas `PENDING` e `OVERDUE` nos parcelamentos, filtrar `TRANSFER` dos fluxos mensais e preservar passivos históricos positivos com `assets - liabilities === netWorth` mesmo sob `netWorth` negativo.

#### Scenario: Apuração de dívidas e passivos históricos negativos em networth
- **WHEN** existem consórcios ativos, parcelas `PENDING`/`OVERDUE`, transações `TRANSFER` e meses históricos com `netWorth` negativo ou menor ou igual a `-currentLiabilities`
- **THEN** `GET /api/networth` inclui `consortiumDebt` e a soma real das parcelas em `liabilities`, ignora `TRANSFER` nos fluxos mensais e retorna `liabilities > 0` com `assets - liabilities === netWorth` sem zerar passivos históricos
