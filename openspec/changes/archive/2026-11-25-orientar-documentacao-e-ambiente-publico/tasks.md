## 1. Higiene de Ambiente, Configs e Documentação Pública

- [x] 1.1 Cobrir em `.zscripts/tests/packaging.test.ts` (RED -> GREEN) e atualizar `.env.example` (`DATABASE_URL="file:../db/custom.db"`), remover `.env.local` preservando `.env`, atualizar `.gitignore` (`.env.*`, `!.env.example`, `.playwright-cli/`) e remover `"examples"`, `"examples/**"` e `"skills"` de `tsconfig.json` e `eslint.config.mjs`
- [x] 1.2 Cobrir em `.zscripts/tests/packaging.test.ts` (RED -> GREEN) e criar `README.md` raiz em pt-BR (`marcelokarval/sistema-financeiro`), reescrever `AGENTS.md` enxuto e remover os 3 links quebrados das linhas 3 e 7 de `docs/reference/design-system.contract.md` mantendo intactos os demais links e o contrato de `quiet-navigation.test.tsx`
