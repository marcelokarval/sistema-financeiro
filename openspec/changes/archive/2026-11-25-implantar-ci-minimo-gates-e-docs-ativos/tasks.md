## 1. CI Mínimo, Runner SQLite e Gates Estáticos

- [x] 1.1 Criar script executável `.zscripts/test-sqlite.sh` para executar as 5 suítes opt-in de SQLite em sandbox isolado (`mktemp -d` + `bwrap` com `tmpfs`) sem tocar em `db/custom.db`
- [x] 1.2 Endurecer `next.config.ts`, configurar regras críticas e ignores em `eslint.config.mjs` e atualizar scripts canônicos em `package.json` preservando `dependencies` e `bun.lock`
- [x] 1.3 Criar workflow mínimo de CI `.github/workflows/ci.yml` com job único `ubuntu-latest` executando todos os gates obrigatórios sem rodar `.qa.mjs`

## 2. Governança OpenSpec e Reconciliação Documental Ativa

- [x] 2.1 Atualizar `openspec/config.yaml` para `superpowers-bridge` e reconciliar links, contagem AST (`34 avisos`) e orientações em `download/README.md`, `docs/reference/design-system.contract.md`, `docs/reference/frontend-componentization-coverage.md` e `AGENTS.md`
