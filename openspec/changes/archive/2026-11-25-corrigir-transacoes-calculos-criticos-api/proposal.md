## Why

Mutações financeiras em `/api/transfer`, `/api/transactions`, `/api/consortiums/installments`, `/api/recurring/process`, `/api/installments/pay` e `/api/investments/transactions` operam sem atomicidade transacional ou guarda TOCTOU, aceitam valores inválidos e gravam transferências como `EXPENSE`/`INCOME`. Além disso, `/api/quick-stats` infla `balanceSparkline` e `/api/networth` omite consórcios, estima parcelamentos e zera passivos históricos negativos. Corrigir esses fluxos agora garante integridade contábil nas rotas críticas em Onda 1.

## What Changes

**Atomicidade transacional, guarda TOCTOU e `type: "TRANSFER"` nas mutações**
- From: `POST /api/transfer`, `POST /api/transactions`, `POST /api/consortiums/installments` e `POST /api/recurring/process` executam leituras e múltiplas escritas fora de `db.$transaction`; `/api/installments/pay` valida `status` fora de `tx` com incremento não atômico; `POST /api/transfer` grava `EXPENSE`/`INCOME` (e `financial-calendar`, `timeline` e `advisor` tratam qualquer tipo diferente de `INCOME` como despesa); `POST /api/transactions` e `POST /api/investments/transactions` aceitam `amount` inválido e datas inválidas.
- To: Todas as mutações acima executam integralmente dentro de `db.$transaction` com guardas condicionais atômicas (`updateMany` com verificação de saldo, `status: { not: "PAID" }` ou `nextDate` esperada) e `{ increment }` / `{ decrement }`; `POST /api/transfer` grava `type: "TRANSFER"` e os agregadores `financial-calendar`, `timeline` e `advisor` excluem ou distinguem `TRANSFER` de despesas; `POST /api/transactions` e `POST /api/investments/transactions` validam `Number.isFinite(Number(amount)) > 0`, enum de `type` e `date` válida.
- Reason: Eliminar perdas parciais em falhas, condições de corrida em cliques duplos/concorrência e inflação artificial de receitas/despesas.
- Impact: Non-breaking nos contratos JSON esperados pela UI; corrige códigos HTTP para `400`/`404` em entradas inválidas ou conflitos de estado.

**Cálculos de `balanceSparkline` e evolução patrimonial (`quick-stats` e `networth`)**
- From: `GET /api/quick-stats` inicializa `runningBalance = netWorth - monthlySavings` e soma todos os 6 meses, desviando `balanceSparkline[5]` do `netWorth` atual; `GET /api/networth` omite dívidas de `Consortium`, estima parcelamentos por `totalAmount - paidInstallments * monthlyValue`, busca transações sem filtro de `type` e zera passivos históricos quando `netWorth <= -currentLiabilities`.
- To: `GET /api/quick-stats` reconstrói `balanceSparkline` retroativamente a partir de `netWorth` com `balanceSparkline[5] === netWorth` e exclusão de `TRANSFER`; `GET /api/networth` inclui `Consortium` (`totalAmount - fundedAmount`), soma parcelas `PENDING`/`OVERDUE`, filtra `TRANSFER` na consulta mensal e preserva passivos históricos coerentes com `assets - liabilities === netWorth` mesmo com patrimônio negativo.
- Reason: Garantir fidelidade matemática dos gráficos e indicadores exibidos no dashboard.
- Impact: Non-breaking na estrutura do JSON; corrige valores numéricos retornados.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `integridade-fluxos-financeiros`: adicionar requisitos normativos de atomicidade `db.$transaction`, guarda TOCTOU, validação de `POST`, registro e isolamento de `type: "TRANSFER"` e correção matemática em `quick-stats` e `networth`.

## Impact

- Rotas de API: `src/app/api/transfer/route.ts`, `src/app/api/financial-calendar/route.ts`, `src/app/api/timeline/route.ts`, `src/app/api/advisor/route.ts`, `src/app/api/transactions/route.ts`, `src/app/api/consortiums/installments/route.ts`, `src/app/api/recurring/process/route.ts`, `src/app/api/installments/pay/route.ts`, `src/app/api/investments/transactions/route.ts`, `src/app/api/quick-stats/route.ts`, `src/app/api/networth/route.ts`.
- Testes dedicados (`*.test.ts`) cobrindo RED/GREEN de cada rota alterada.
- Sequenciamento: executa em **Onda 1**; a change `endurecer-api-datas-calculos-e-schema` (Change 5) executa em **Onda 2** após conclusão desta change.
