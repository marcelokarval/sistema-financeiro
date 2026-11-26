## 1. Higienização do Índice Git, Legados e Resíduos Locais

- [x] 1.1 Remover `db/custom.db` apenas do índice Git (`git rm --cached db/custom.db`) preservando o arquivo intacto no disco local (`204.800` bytes)
- [x] 1.2 Remover via `git rm -f` todos os 486 arquivos legados (os 485 listados em `candidate-manifest.json` mais `examples/skills/ppt/scripts/tectonic`), limpar diretórios vazios e excluir resíduos locais (`.tmp`, `dev.log`, `.playwright-cli`), preservando os ativos vigentes de `download/` e `docs/`
