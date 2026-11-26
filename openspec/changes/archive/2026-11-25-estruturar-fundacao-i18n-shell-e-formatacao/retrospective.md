# Retrospective — `estruturar-fundacao-i18n-shell-e-formatacao`

## O que funcionou bem
- A arquitetura modular com `next-intl@4.7.0` sem roteamento por URL (`NEXT_LOCALE` + `Accept-Language`) preservou integralmente os 9 destinos da SPA, `output: "standalone"` e a allowlist de testes SQLite isolados.
- `AppIntlBridgeContext` + `useSafeTranslations()` garantiu fallback seguro ao português para componentes renderizados diretamente em `renderToStaticMarkup` sem provider externo.
- A separação estrita entre data civil (`timeZone: 'UTC'`) e instante histórico em `src/lib/helpers.ts` e `src/lib/purchase-date.ts` manteve zero regressões entre `UTC` e `America/Bahia`.

## Pontos de atenção e lições aprendidas
- A inclusão do `<LocaleFlagIcon />` no `AppHeader` adicionou requisições locais `/locale-flags/{pt,es,en}.svg` que o bloqueador de rede `routeAll` dos 4 harnesses `.qa.mjs` originalmente interceptava como rede externa; servir esses 3 SVGs locais diretamente da memória do runner (mantendo bloqueio estrito para qualquer outra URL) e atualizar o `shellHash` de `page.tsx` resolveu o problema na rodada 2 sem afrouxar o isolamento do sandbox `bwrap`.
- Para a Onda 2 (`internacionalizar-visoes-e-widgets-financeiros`), os harnesses `.qa.mjs` das visões e o `AppIntlProvider` já fornecem a base de teste e QA necessária para validar textos em `pt`, `es` e `en` nas 6 células.
