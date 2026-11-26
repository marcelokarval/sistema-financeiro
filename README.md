# FinanceApp — Sistema Financeiro Pessoal

Aplicação web (SPA) em **pt-BR / BRL** para gestão financeira doméstica, construída com **Next.js 16**, **TypeScript**, **Prisma (SQLite)** e o sistema visual **Quiet Financial OS** (temas escuro e claro).

Repositório: [`marcelokarval/sistema-financeiro`](https://github.com/marcelokarval/sistema-financeiro)

---

## Visão Geral e Destinos da SPA

O FinanceApp centraliza controle de fluxo de caixa, cartões, compras detalhadas por itens, planejamento e patrimônio em **9 visões principais** (alternáveis pela barra lateral, navegação móvel ou busca global `Ctrl/⌘ K`):

1. **Resumo** (`dashboard`) — Posição financeira consolidada, fluxo de caixa, vencimentos próximos, orçamento mensal, metas, projeções, calendário financeiro, recibos e insights.
2. **Contas** (`accounts`) — Gestão de contas (dinheiro, banco e carteira digital), lançamentos (`Receita`, `Despesa` e `Transferência`) e transferências entre contas.
3. **Cartões** (`cards`) — Limites, faturas atuais, datas de fechamento/vencimento e histórico de compras vinculadas.
4. **Compras** (`purchases`) — Registro de compras à vista ou parceladas com discriminação opcional de itens.
5. **Categorias** (`categories`) — Organização de categorias de receita e despesa com ícones e cores.
6. **Investimentos** (`investments`) — Carteira de ativos com aportes, resgates, rendimentos e acompanhamento de posição.
7. **Parcelas** (`installments`) — Planos de parcelamento com controle e baixa individual de parcelas.
8. **Consórcios** (`consortiums`) — Grupos, cotas, controle de parcelas mensais, contemplação e próxima assembleia.
9. **Caixinhas** (`savings`) — Metas de economia e reservas com depósitos e cálculo de progresso.

Recursos transversais disponíveis no cabeçalho e sob demanda:
- **Busca global (`Ctrl/⌘ K`)** com navegação direta para registros e destinos.
- **Painel de notificações** e alternância de tema **Escuro / Claro**.
- **Exportação CSV** via `/api/export`.
- **Assistente financeiro (opcional)** sob demanda via `/api/advisor`.

---

## Stack Real do Projeto

- **Framework & UI:** Next.js `16.1.1` (App Router, saída `standalone`), React `19`, TypeScript `5`
- **Estilização & Componentes:** Tailwind CSS v4, shadcn/ui (Radix UI), tokens `--ds-*` (`docs/reference/design-system.premium-theme.css`), Lucide Icons, Sonner e utilitário `cn()` (`src/lib/utils.ts`)
- **Estado & Gráficos:** Zustand (`src/lib/store.ts`) e Recharts (`2.15.4`)
- **Persistência:** Prisma `6.11.1` + SQLite (`prisma/schema.prisma`)
- **Tempo real:** Socket.io (`socket.io-client` no frontend via `src/hooks/use-realtime.ts`) conectado ao serviço auxiliar [`mini-services/finance-ws/`](mini-services/finance-ws/) na porta `3004`, com suporte ao gateway [`Caddyfile`](Caddyfile) (`:81` encaminhando para `:3000` e `XTransformPort=3004` para `:3004`)
- **Assistente de IA (`/api/advisor`):** [`src/app/api/advisor/route.ts`](src/app/api/advisor/route.ts) utiliza `z-ai-web-dev-sdk` para enviar um resumo financeiro sanitizado a um modelo de linguagem. O aplicativo funciona normalmente sem configurar esse provedor, mas as respostas do assistente dependem de credenciais/serviço externos compatíveis com `z-ai-web-dev-sdk`.

---

## Pré-requisitos

- **Bun `1.4.2`** (gerenciador e runtime padrão do repositório; lockfile [`bun.lock`](bun.lock) — não use `npm` ou `yarn`)
- **Node.js `>= 20.9.0`** (exigido pelo executável do Next.js 16)
- **Linux `bubblewrap` (`bwrap`)** *(opcional)* — necessário apenas para executar localmente as 5 suítes SQLite isoladas (`bun --no-env-file run test:sqlite`)
- **Caddy** *(opcional)* — necessário apenas para subir o pacote de produção completo com [`Caddyfile`](Caddyfile)

---

## Setup Local Passo a Passo

1. **Configure o arquivo de ambiente:**
   ```sh
   cp .env.example .env
   ```
   O template [`.env.example`](.env.example) define `DATABASE_URL="file:../db/custom.db"`, pois o Prisma resolve caminhos SQLite relativos a [`prisma/schema.prisma`](prisma/schema.prisma) — apontando corretamente para `db/custom.db` na raiz do projeto.

2. **Instale as dependências:**
   ```sh
   bun install
   ```

3. **Gere o Prisma Client e crie o banco SQLite local:**
   ```sh
   bun --no-env-file run db:generate
   bun run db:push
   ```
   > **Nota:** `db/custom.db` e arquivos `.env` permanecem fora do controle de versão e nunca devem ser commitados.

4. **(Opcional) Popule dados de demonstração em desenvolvimento:**
   ```sh
   bun run prisma/seed.ts
   ```
   > **Atenção:** [`prisma/seed.ts`](prisma/seed.ts) apaga registros existentes antes de inserir a massa de exemplo; execute apenas em base de desenvolvimento/demonstração.

5. **Inicie a aplicação em desenvolvimento:**
   ```sh
   bun run dev
   ```
   Acesse `http://localhost:3000`.

6. **(Opcional) Inicie o serviço Socket.io de notificações em tempo real:**
   ```sh
   cd mini-services/finance-ws
   bun install
   bun run dev
   ```
   Por padrão, o serviço escuta em `127.0.0.1:3004`.

---

## Scripts Disponíveis (`package.json`)

| Script | Comando subjacente | Finalidade |
|---|---|---|
| `bun run dev` | `next dev -p 3000 2>&1 \| tee dev.log` | Servidor de desenvolvimento Next.js na porta `3000` |
| `bun run build` | `prisma generate && next build && ...` | Gera Prisma Client e compila o build `standalone` em `.next/` |
| `bun run start` | `NODE_ENV=production bun .next/standalone/server.js ...` | Inicia a saída compilada em produção |
| `bun run db:generate` | `prisma generate` | Gera o Prisma Client (execute com `--no-env-file` antes de `typecheck` em checkout limpo) |
| `bun run db:push` | `prisma db push` | Sincroniza o schema Prisma com o SQLite local de desenvolvimento |
| `bun run typecheck` | `tsc --noEmit` | Verificação estrita de tipos TypeScript |
| `bun run lint` | `eslint .` | Verificação ESLint em `src/`, `.zscripts/` e `mini-services/` |
| `bun run arch:check` | `bun --no-env-file .zscripts/check-frontend-architecture.ts ...` | Gate AST de arquitetura frontend contra o baseline aprovado |
| `bun test` | `bun test` | Suíte unitária/componente padrão |
| `bun run test:scripts` | `bun --no-env-file test ./.zscripts/tests/packaging.test.ts ./.zscripts/check-frontend-architecture.test.ts` | Testes de empacotamento, launcher, ambiente e gate AST |
| `bun run test:sqlite` | `bash .zscripts/test-sqlite.sh` | Executa as 5 suítes opt-in SQLite em sandbox `bwrap` (`tmpfs`), sem tocar em `db/custom.db` |
| `bun run check` | `typecheck && lint && arch:check && test && test:scripts` | Encadeia todos os gates estáticos e suítes padrão |

---

## CI e Proteção de Branch

O workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) executa em `ubuntu-latest` (Bun `1.4.2`) a cada `push` para `main` e `pull_request`:

1. Instalação com `bun install --frozen-lockfile` e `bubblewrap`
2. `bun --no-env-file run db:generate`
3. `typecheck`, `lint`, `arch:check`
4. `bun --no-env-file test` e `test:scripts`
5. `test:sqlite` (sandbox `bwrap` sob `$RUNNER_TEMP`)
6. `build` com `DATABASE_URL` inerte em `$RUNNER_TEMP`

As suítes manuais `.qa.mjs` de Playwright permanecem fora do CI padrão. A branch `main` é protegida pelo ruleset `main-ci-protection` (`id: 28102433`), exigindo aprovação do status check do CI.

---

## Documentação e Referências

- [Guia de operação e empacotamento de produção](docs/operacao-empacotamento.md) — build limpo via `.zscripts/build.sh`, verificação do `.tar.gz` e inicialização isolada com SQLite externo
- [Contrato visual — Quiet Financial OS](docs/reference/design-system.contract.md) — tokens, hierarquia visual e invariantes das telas
- [Guia de conduta para agentes de IA](AGENTS.md) — convenções de código, estrutura do repositório, OpenSpec (`superpowers-bridge`) e regras de segurança
- [Especificações OpenSpec](openspec/specs/) — requisitos canônicos por capability
