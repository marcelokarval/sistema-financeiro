# AGENTS.md — Sistema Financeiro Pessoal

> **Guia de conduta para agentes de IA neste repositório (`marcelokarval/sistema-financeiro`).**
> Leia antes de alterar código, configuração ou documentação.

---

## 1. Estrutura do Repositório

```
sistema-financeiro/
├── src/
│   ├── app/
│   │   ├── api/            # Rotas API (uma subpasta por recurso)
│   │   ├── globals.css     # CSS global (importa o tema Quiet Financial OS)
│   │   ├── layout.tsx
│   │   └── page.tsx        # Shell da SPA (9 visões)
│   ├── components/
│   │   ├── finance/        # Componentes de negócio (kebab-case.tsx)
│   │   ├── shared/         # Primitivos financeiros compartilhados
│   │   └── ui/             # Componentes shadcn/ui (NÃO editar manualmente)
│   ├── hooks/              # Hooks React customizados
│   └── lib/                # store.ts (Zustand), db.ts (Prisma), helpers.ts, utils.ts (cn), api-validation.ts
├── prisma/
│   ├── schema.prisma       # Schema SQLite
│   └── seed.ts             # Massa opcional para desenvolvimento/demo
├── mini-services/
│   └── finance-ws/         # Servidor Socket.io auxiliar (porta 3004)
├── .zscripts/              # build.sh, start.sh, mini-services-start.sh, test-sqlite.sh, gate AST e testes
├── docs/
│   ├── operacao-empacotamento.md  # Runbook oficial de build e start de release
│   └── reference/          # Contrato visual Quiet Financial OS, tokens e gate AST
├── download/               # Capturas de QA visual e README.md de índice
├── openspec/               # config.yaml (superpowers-bridge), specs/ canônicas e changes/
├── .github/workflows/ci.yml
├── Caddyfile               # Proxy :81 -> :3000 e XTransformPort=3004 -> :3004
├── .env.example            # Template inerte (DATABASE_URL="file:../db/custom.db")
├── README.md               # Documentação pública do projeto
└── AGENTS.md               # Este arquivo
```

### Onde colocar cada artefato
- Novo componente de negócio → `src/components/finance/<kebab-case>.tsx`
- Componente financeiro compartilhado → `src/components/shared/<kebab-case>.tsx`
- Nova rota API → `src/app/api/<recurso>/route.ts`
- Mudanças planejadas e specs → `openspec/changes/<change>/` (`schema: superpowers-bridge`)
- Capturas de QA → `download/` (nunca na raiz)
- Artefatos temporários → `.tmp/` (ignorado pelo Git)

---

## 2. Convenções de Código e Quiet Financial OS

- **Runtime e pacotes:** Bun `1.4.2` (`bun.lock`). **NÃO** usar `npm` ou `yarn`.
- **Naming:** arquivos em `kebab-case`, rotas API em `kebab-case`, hooks em `use-kebab-case.ts`, variáveis do design system em `--ds-kebab-case`.
- **Imports (ordem):** `react` → `next` → third-party → `@/components` → `@/lib` → `@/hooks`.
  ```typescript
  import { useState } from 'react';
  import { toast } from 'sonner';
  import { Card } from '@/components/ui/card';
  import { currencyFmt } from '@/lib/helpers';
  import { cn } from '@/lib/utils';
  import { useRealtime } from '@/hooks/use-realtime';
  ```
- **Componentes e UI:**
  - Widgets e views em `src/components/finance/` usam `'use client'`, estado de navegação via `src/lib/store.ts` e moeda formatada com `currencyFmt()`.
  - Compose classes condicionais com `cn()` (`@/lib/utils`). **VETO a `raw-conditional-class-name`** (template literal em `className` com ternária de strings), verificado por `bun --no-env-file run arch:check`.
  - **VETO a `framer-motion`**: proibido importar `framer-motion` em `src/`.
  - **NÃO** hardcode cores hex/oklch nos componentes; preserve o import de `docs/reference/design-system.premium-theme.css` em `src/app/globals.css` e use variáveis Tailwind / `--ds-*`.
  - **NÃO** edite componentes em `src/components/ui/` manualmente — use a CLI do shadcn.
  - Mantenha UI em **pt-BR**, moeda em **BRL** e verifique **dark mode e light mode**.

---

## 3. Fluxo OpenSpec (`superpowers-bridge`)

- `openspec/config.yaml` define `schema: superpowers-bridge`.
- Cada mudança não trivial segue o ciclo `brainstorm.md` → `proposal.md` → `design.md` → `specs/<capability>/spec.md` → `tasks.md` → `plan.md` (`Bridge task contract: 1`) + `candidate-manifest.json` → `preflight` → TDD (`RED -> GREEN`) → `candidate` → revisão independente → `verify.md` (`evidence.json`) → `retrospective.md`.
- Consulte [docs/reference/design-system.contract.md](docs/reference/design-system.contract.md) ao alterar telas ou navegação.

---

## 4. Comandos de Verificação e Banco

Em checkouts limpos ou após alterar `prisma/schema.prisma`, gere o Prisma Client **antes** de `typecheck`:

```bash
bun install                        # Instalar dependências
bun --no-env-file run db:generate  # Gerar Prisma Client (obrigatório pré-typecheck em checkout limpo)
bun run db:push                    # Sincronizar schema com SQLite local (apenas dev explícito)
bun run dev                        # Servidor Next.js em desenvolvimento (porta 3000)
bun --no-env-file run check        # typecheck + lint + arch:check + test + test:scripts
bun --no-env-file run arch:check   # Gate AST (baseline 25b44535c5068b99044afa03f7ecf318e7a9726f)
bun --no-env-file run test:scripts # Suítes de empacotamento e arquitetura em .zscripts/
bun --no-env-file run test:sqlite  # 5 suítes opt-in SQLite isoladas (bwrap + tmpfs)
bun --no-env-file run build        # Build Next (requer DATABASE_URL sintática; não empacota release)
```

---

## 5. Governança, Release e Segurança

- **GitHub / CI:** o workflow `.github/workflows/ci.yml` executa todos os gates em `ubuntu-latest` (Bun `1.4.2`). O ruleset leve `main-ci-protection` (`id: 28102433`) já está ativo na branch `main` de `marcelokarval/sistema-financeiro`, exigindo o status check do CI.
- **Banco local vs. release:** `db/custom.db` é apenas caminho local de desenvolvimento (`DATABASE_URL="file:../db/custom.db"` em `.env.example`), nunca insumo de release ou fallback. Para produzir/validar tarball ou subir o pacote com SQLite externo, siga [docs/operacao-empacotamento.md](docs/operacao-empacotamento.md).
- **Segredos e higiene:** **NUNCA** commitar `.env`, `.env.*` (exceto `.env.example`), `db/custom.db`, `.tmp/`, `.playwright-cli/` ou `node_modules/`, nem expor valores de `.env` em logs/mensagens.
