# Retrospective — `internacionalizar-visoes-e-widgets-financeiros`

## O que funcionou bem
- A divisão em 4 frentes paralelas sem sobreposição de escrita (`1.1` Shared/Resumo/Notificações/Assistente, `1.2` Metas/Análises, `1.3` Operações/Recibos, `1.4` Carteiras/Obrigações) permitiu localizar todos os 70 módulos de produção e os 16 namespaces (`48` JSONs) antes da integração única na Task `2.1`.
- O uso obrigatório de `useSafeTranslations` e `useSafeLocale` (`@/i18n/provider`) em `src/components/{shared,finance}` preservou renderizações standalone sem provider (`CardsView` e `DashboardContent` em `src/lib/purchase-date.test.ts`), evitando erros de contexto ausente.
- A extração de catálogos puros de enums e helpers de locale para `analytics-i18n.ts`, `operations-i18n.ts` e `portfolio-i18n.ts` manteve todos os componentes originalmente `<= 500` linhas abaixo do limite de `500` linhas e preservou intactas as 6 identidades aprovadas no baseline do gate AST (`arch:check`).

## Pontos de atenção e lições aprendidas
- A validação estrita de tipagem do `next-intl` sobre chaves dinâmicas exigiu catálogos tipados em `analytics-i18n.ts` e `portfolio-i18n.ts` (corrigidos durante as rodadas de verificação estática de `1.2` e `1.4`), reforçando o valor de rodar `tsc --noEmit` cedo sobre os namespaces compostos.
- `quiet-i18n.qa.mjs` complementou os 14 runners `.qa.mjs` existentes ao exercitar `pt`, `es` e `en` nas 6 células (`360/390/1440 × light/dark`) com checagem de ausência de `MISSING_MESSAGE`/chaves cruas, preservação de `BRL` e ausência de overflow horizontal.
