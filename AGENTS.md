# AGENTS.md — Sistema Financeiro Pessoal

> **Guia de conduta para agentes de IA trabalhando neste projeto.**
> Leia este arquivo antes de qualquer alteração no código ou estrutura.

---

## 1. Sobre o Projeto

Sistema Financeiro Pessoal — Single Page Application para gestão financeira doméstica.

- **Stack:** Next.js 16 + TypeScript + Prisma (SQLite) + shadcn/ui + Tailwind CSS v4 + Zustand + Recharts + Framer Motion
- **Runtime:** Bun (lockfile: `bun.lock`). **NÃO usar npm/yarn.**
- **Banco:** SQLite via Prisma. `db/custom.db` é um caminho de desenvolvimento, não um insumo de release nem fallback de execução. Não trate regras de ignore como prova de que um arquivo sensível não é rastreado.
- **Idioma da UI:** Português Brasileiro (pt-BR), moeda BRL
- **Tema:** Dark/Light com design system premium (variáveis CSS `--ds-*` em `docs/reference/`)

---

## 2. Estrutura de Diretórios — ONDE COLOCAR CADA COISA

```
sistema-financeiro/
├── src/
│   ├── app/
│   │   ├── api/          # Rotas API (uma subpasta por recurso)
│   │   │   ├── accounts/route.ts
│   │   │   ├── investments/route.ts    # ← NOVO sistema de investimentos
│   │   │   └── ...
│   │   ├── globals.css   # CSS global (importa design system)
│   │   ├── layout.tsx
│   │   └── page.tsx      # Página principal (SPA)
│   ├── components/
│   │   ├── finance/      # Componentes de negócio (UM arquivo por widget)
│   │   ├── shared/       # Componentes compartilhados reutilizáveis
│   │   └── ui/           # Componentes shadcn/ui (NÃO editar manualmente)
│   ├── hooks/            # Custom React hooks
│   └── lib/              # Utilidades, store (Zustand), db (Prisma client)
├── prisma/
│   └── schema.prisma     # Schema do banco de dados
├── public/               # Assets estáticos
├── mini-services/        # Microserviços auxiliares
├── agent-ctx/            # Contexto para agents (task-specific)
├── docs/
│   ├── reference/        # Design system contracts, temas, specs
│   ├── helm/             # Planejamento e controle do agent
│   ├── prompts/          # Prompts reutilizáveis
│   └── research/         # Pesquisas e convenções
├── download/
│   ├── archive/          # Worklogs de CRs concluídas (CR6, CR7, CR8, CR9...)
│   ├── *.png             # Screenshots de QA
│   └── README.md         # Índice de downloads
├── .zscripts/            # Scripts de build/dev (ambiente Z)
├── .env.example          # Template de variáveis de ambiente
├── worklog.md            # Worklog ativo (CR atual)
└── AGENTS.md             # ← ESTE ARQUIVO
```

### Regras de organização:

| Tipo de arquivo | Onde colocar | Exemplo |
|---|---|---|
| Novo componente de negócio | `src/components/finance/` | `investments-view.tsx` |
| Componente compartilhado | `src/components/shared/` | `widget-card.tsx` |
| Nova rota API | `src/app/api/<recurso>/route.ts` | `api/investments/route.ts` |
| Worklog de CR concluída | `download/archive/` | `CR8-worklog.md` |
| Worklog ativo (em andamento) | Raiz: `worklog.md` | — |
| Contexto de task para agent | `agent-ctx/` | `CR9-goals-dashboard-main.md` |
| Screenshot de QA | `download/` | `qa-dashboard.png` |
| Artefato temporário | `.tmp/` (ignorado pelo git) | renders, testes visuais |
| Banco de dados local | `db/` (ignorado pelo git) | `custom.db` |

### **NUNCA** coloque na raiz:
- Worklogs de CRs concluídas → `download/archive/`
- Screenshots → `download/`
- Scripts auxiliares → `.zscripts/`
- Documentação → `docs/`

---

## 3. Convenções de Código

### Naming
- Componentes: `kebab-case.tsx` → `investments-view.tsx`
- Rotas API: `kebab-case` → `/api/investments/transactions`
- Hooks: `use-kebab-case.ts` → `use-realtime.ts`
- CSS variables: `--ds-kebab-case` para design system, `--kebab-case` para shadcn

### Imports
```typescript
// Ordem: react → next → third-party → @/ components → @/ lib → @/ hooks
import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { currencyFmt } from '@/lib/helpers';
import { useRealtime } from '@/hooks/use-realtime';
```

### Componentes
- Todo componente de widget em `finance/` é `'use client'`
- Usa Zustand store (`src/lib/store.ts`) para estado global de navegação
- Fetching via hooks customizados ou fetch direto nos componentes
- Formatação de moeda SEMPRE via `currencyFmt()` de `helpers.ts`

### Design System
- O CSS global importa `docs/reference/design-system.premium-theme.css`
- Todas as cores/theme vão por variáveis CSS `--ds-*`
- **NÃO** hardcoded oklch/hex nos componentes — use as variáveis Tailwind (`bg-card`, `text-primary`, etc.)
- Glass effects: classe `glass-card` quando necessário

### Banco de dados
- Schema: `prisma/schema.prisma`
- Para mudanças no schema em desenvolvimento: `bun run db:push` como operação explícita. O launcher de release exige `DATABASE_URL` explícita para um SQLite externo já provisionado; não cria, popula nem sincroniza a base.
- **NUNCA** commitar `db/custom.db`

---

## 4. Fluxo de Trabalho (Change Requests)

1. **Task context** → criar arquivo em `agent-ctx/CR<n>-<nome>.md` com scope e detalhes
2. **Implementar** → seguir estrutura de diretórios acima
3. **Worklog ativo** → documentar progresso em `worklog.md` (raiz)
4. **Ao concluir CR** → mover worklog para `download/archive/CR<n>-worklog.md`
5. **Screenshots de QA** → salvar em `download/`

---

## 5. Comandos

```bash
bun install          # Instalar dependências
bun run dev          # Dev server (porta 3000)
bun run build        # Compilar Next; não equivale a empacotar uma release
bun run db:push      # Sync schema com banco local
bun run db:generate  # Gerar Prisma client
```

Para produzir e verificar o `tar.gz` de release ou iniciar o pacote, siga o [guia de operação do pacote](<docs/operacao-empacotamento.md>). Não execute o empacotador a partir de um checkout com segredos ou dados reais.

---

## 6. Regras de Segurança

- **NUNCA** commitar `.env`, `db/custom.db`, `.tmp/`, ou `node_modules/`
- **NUNCA** editar componentes em `src/components/ui/` manualmente — usar CLI do shadcn
- **NUNCA** remover o import do design system premium em `globals.css`
- **SEMPRE** testar dark mode E light mode ao alterar estilos
- **SEMPRE** manter textos em pt-BR e moeda em BRL
