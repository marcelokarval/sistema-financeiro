## 1. Atomicidade transacional, guarda TOCTOU e type TRANSFER

- [x] 1.1 Envolver POST /api/transfer em db.$transaction com guarda TOCTOU de saldo, gravar type TRANSFER e filtrar/distinguir TRANSFER nos agregadores com ramo else (financial-calendar, timeline, advisor)
- [x] 1.2 Envolver POST /api/transactions em db.$transaction e alinhar validacoes de type, amount, description e date com PUT
- [x] 1.3 Tornar POST /api/consortiums/installments atomico em db.$transaction com updateMany condicional e incrementos atomicos
- [x] 1.4 Tornar POST /api/recurring/process atomico em db.$transaction com reivindicacao condicional contra duplo processamento
- [x] 1.5 Endurecer POST /api/installments/pay contra TOCTOU com updateMany condicional dentro de tx e increment atomico
- [x] 1.6 Alinhar validacao de amount e date em POST /api/investments/transactions com PUT

## 2. Correcoes matematicas em leitura (quick-stats e networth)

- [x] 2.1 Corrigir reconstrucao retroativa de balanceSparkline e validar exclusao de TRANSFER em GET /api/quick-stats
- [x] 2.2 Incluir divida de Consortium, somar parcelas PENDING/OVERDUE, filtrar TRANSFER e impedir zeramento de passivos historicos negativos em GET /api/networth
