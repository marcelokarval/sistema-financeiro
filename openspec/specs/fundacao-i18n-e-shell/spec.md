# fundacao-i18n-e-shell Specification

## Purpose

Especificar a fundação de internacionalização com `next-intl` sem roteamento por URL, normalização de locales canônicos (`pt`, `es`, `en`), formatação monetária e temporal segura, compatibilidade com testes e internacionalização do shell transversal do FinanceApp.

## Requirements

### Requirement: Resolução canônica de idioma via cookie e cabeçalho HTTP
O sistema MUST suportar os idiomas canônicos `pt`, `es` e `en` (padrão `pt`), normalizando variantes regionais em `normalizeLocale()` e lendo o cookie `NEXT_LOCALE` com fallback em `Accept-Language` no servidor sem alterar as rotas da SPA.

#### Scenario: Normalização de variantes regionais e fallback
- **WHEN** `normalizeLocale()` recebe `'pt-BR'`, `'es-419'`, `'en-US'` ou um código desconhecido `'fr-FR'`
- **THEN** retorna respectivamente `'pt'`, `'es'`, `'en'` e `'pt'` como fallback seguro.

#### Scenario: Prioridade de resolução no servidor
- **WHEN** uma requisição chega com o cookie `NEXT_LOCALE=es` e cabeçalho `Accept-Language: en-US,en;q=0.9`
- **THEN** `getRequestConfig` resolve o locale `'es'` e `RootLayout` renderiza `<html lang="es-ES">`.

### Requirement: Catálogos estáticos, tipagem estrita e compatibilidade standalone
A configuração de `next-intl` MUST compor `src/messages/{pt,es,en}/{common,shell}.json` via imports estáticos em `src/i18n/messages.ts`, delegados por `src/i18n/request.ts`, expor `AppMessages`/`AppConfig` em `src/i18n/types.ts`, manter paridade de chaves e suportar `output: "standalone"` com Turbopack.

#### Scenario: Paridade estrutural e de placeholders entre idiomas
- **WHEN** a suíte de invariantes compara os catálogos compostos e os arquivos `src/messages/{pt,es,en}/{common,shell}.json`
- **THEN** todos os três idiomas possuem exatamente as mesmas chaves aninhadas, valores não vazios e conjunto idêntico de placeholders ICU.

#### Scenario: Build standalone com plugin next-intl
- **WHEN** `next build` executa com `createNextIntlPlugin('./src/i18n/request.ts')` e `output: "standalone"`
- **THEN** a compilação conclui sem erros de resolução de módulo em servidor ou cliente.

### Requirement: Fallback seguro para testes unitários e harnesses isolados
Os componentes internacionalizados do shell MUST renderizar com fallback seguro para o catálogo padrão `'pt'` quando invocados fora de `NextIntlClientProvider`, e o projeto MUST prover helper de teste e suporte nos harnesses `qa.mount`.

#### Scenario: Renderização isolada em renderToStaticMarkup
- **WHEN** um teste unitário chama `renderToStaticMarkup(<AppHeader ... />)` ou `renderToStaticMarkup(<Sidebar ... />)` sem envolver o componente em `AppIntlProvider`
- **THEN** o componente renderiza integralmente os rótulos em português padrão sem lançar erro de contexto ausente.

#### Scenario: Renderização explícita em múltiplos idiomas no bun test
- **WHEN** um teste usa `renderWithIntl(<AppHeader ... />, 'en')` de `src/test-utils/intl.tsx`
- **THEN** o markup resultante contém os rótulos e atributos acessíveis traduzidos para inglês.

### Requirement: Formatação monetária em BRL fixa e datas civis em UTC
Os formatadores em `src/lib/helpers.ts` e `src/lib/purchase-date.ts` MUST aceitar locale opcional, aplicar convenções numéricas e de data de `INTL_LOCALE` mantendo a moeda contábil fixa em `BRL` sem conversão cambial, e formatar datas civis `YYYY-MM-DD` com `timeZone: 'UTC'`.

#### Scenario: Formatação de moeda BRL sem conversão cambial
- **WHEN** `currencyFmt(1234.56, 'en')` e `currencyFmt(1234.56, 'es')` são chamados
- **THEN** ambos formatam o mesmo montante numérico em Real brasileiro (`BRL`), sem aplicar taxa de conversão para USD ou EUR.

#### Scenario: Imutabilidade do dia civil entre fusos horários
- **WHEN** `formatPurchaseDate('2026-11-19T00:00:00.000Z', 'date', 'en')` ou `dateFmt('2026-11-19', 'pt')` executa em `TZ=America/Bahia` ou `TZ=UTC`
- **THEN** a saída preserva o dia civil `19` (`11/19/2026` em `en-US` e `19/11/2026` em `pt-BR`) sem recuar para dia `18`.

### Requirement: Internacionalização do shell transversal da SPA
O shell (`src/app/page.tsx`, `app-header.tsx`, `sidebar.tsx`, `mobile-nav.tsx`, `quick-actions.tsx`, `global-search.tsx`, `global-search-result.tsx` e `app-overlays.tsx`) MUST exibir títulos, navegação, atalhos, busca e estados no locale ativo preservando os nove destinos e contratos existentes.

#### Scenario: Troca de idioma refletida na navegação e busca global
- **WHEN** o shell é renderizado nos locales `'pt'`, `'es'` e `'en'`
- **THEN** os nove destinos na `Sidebar` e `MobileNav`, os quatro atalhos em `QuickActions` e os rótulos da `GlobalSearch` refletem o idioma ativo mantendo todos os destinos e callbacks intactos.
