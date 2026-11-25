## 1. Hardening do proxy e lifecycle dos launchers

- [x] 1.1 Restringir `@transform_port_query` no `Caddyfile` para `XTransformPort=3004` com testes automatizados
- [x] 1.2 Validar `caddy` antes dos serviços e implementar teardown com preservação de exit code em `.zscripts/start.sh`
- [x] 1.3 Registrar `trap cleanup EXIT INT TERM` com preservação de exit code em `.zscripts/mini-services-start.sh`

## 2. Higiene de ambiente, scripts legados e índice Git

- [x] 2.1 Remover scripts legados de mini-serviços e sanitizar `.env.example`
- [x] 2.2 Remover `.zscripts/dev.pid` e `skills/` do índice Git mantendo `skills/` no disco e adicionar `*.pid` ao `.gitignore`

## 3. Reconciliação documental

- [x] 3.1 Atualizar `docs/operacao-empacotamento.md` para smoke check em `GET /` e restrição do proxy `:3004`
