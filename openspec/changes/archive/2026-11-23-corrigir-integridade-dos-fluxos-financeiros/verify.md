# Verificação — Integridade dos fluxos financeiros

## Candidate

- Base HEAD: `96de0e44e4d43e574f1b920d7047d95b37261ae5`
- Digest histórico inicial (`bridge_guard`): `a3766a4882fc6020dacf70bb1c16af68833b5b62dd20d1c8c75eed440798698a`
- Revalidado na rodada final pós-Waves 1–2 (0 erros TS, 0 lint, suíte completa + provas SQLite isoladas em `bwrap` + QA visual em browser real)

## Mandatory checks

- [x] structural
- [x] tests
- [x] review

## Overall Decision

- [x] PASS

## Evidências e limites (Rodada Final)

- **Suíte padrão (`~/.bun/bin/bun --no-env-file test`)**: **277 pass, 41 skip, 0 fail** (`1.392` asserções, 31 arquivos), incluindo `consortium-selection.test.ts`, `installment-selection.test.ts`, `purchase-date.test.ts` (10 casos na suíte padrão) e `src/app/api/purchases/route.test.ts` (filtro case-insensitive compatível com SQLite).
- **Provas SQLite opt-in isoladas em `bwrap` (`--tmpfs /scratch --tmpfs /tmp --unshare-net`, sem `.env`)**: **0 skips, 0 falhas**:
  - `src/app/api/consortiums/assembly.test.ts`: 12 pass, 0 fail (`101` asserções)
  - `src/app/api/installments/route.test.ts`: 4 pass, 0 fail (`13` asserções)
  - `src/app/api/purchases/route-integrity.test.ts`: 6 pass, 0 fail (`37` asserções, com rollback atômico real)
  - `src/app/api/savings/route.test.ts`: 10 pass, 0 fail (`79` asserções)
  - `src/lib/purchase-date.test.ts` (`CALENDAR_D3_SQLITE=1` em `TZ=UTC` e `TZ=America/Bahia`): 11 pass, 0 fail (`44` asserções) em cada fuso.
- **Tipagem, lint, build e QA visual**:
  - `~/.bun/bin/bunx tsc --noEmit`: **exit 0 (0 erros)**.
  - `~/.bun/bin/bun run lint`: **exit 0**.
  - `~/.bun/bin/bun run build`: **exit 0** (Next.js 16.1.3 production build + standalone).
  - `~/.bun/bin/bun test ./.zscripts/tests/packaging.test.ts`: **44 pass, 0 fail** (`321` asserções).
  - `playwright-cli -s=quiet-qa-final` em standalone `127.0.0.1:3099` sobre `/tmp/quiet-visual-qa.db`: 9 destinos (incluindo `Compras`, `Parcelas`, `Consórcios`, `Cartões` e `Resumo`) verificados em `1440×900`, `390×844` e `360×800` claro/escuro (**54/54 OK**, 0 overflow, 0 erros de console/página/HTTP 5xx).
- **Higiene e áreas protegidas**: `git diff --check` exit 0; `src/components/ui/` e `prisma/schema.prisma` sem alterações; `db/custom.db` e `.env` preservados; `33210`, `package-lock.json`, `.tmp/quiet-qa/` e `/tmp/quiet-visual-qa.db*` removidos.
- **Status do redesign**: todas as **8/8** tarefas do redesign `recriar-interface-quiet-financial-os` concluídas e verificadas.
- **Limites preservados**: não altera regras de pagamento/cálculo nem migra registros históricos; início da janela do Calendário permanece dependente do fuso local; não há atestado de idempotência multi-cliente no servidor para pagamento de Consórcios.
