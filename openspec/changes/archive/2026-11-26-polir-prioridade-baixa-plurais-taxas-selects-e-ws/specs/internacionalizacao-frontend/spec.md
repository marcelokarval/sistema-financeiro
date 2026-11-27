# Delta Specification — internacionalizacao-frontend (Pacote 3)

## ADDED Requirements

### Requirement: Pluralização explícita para zero em português nos catálogos UI
Todas as chaves com cláusula ICU `, plural,` nos catálogos `src/messages/pt/*.json` MUST declarar o ramo `=0 {...}` com concordância plural adequada mantendo os mesmos placeholders `{...}` de `es` e `en`.

#### Scenario: Contagens iguais a zero em português usam forma plural
- **WHEN** componentes de compras, categorias, parcelas, investimentos, notificações, busca ou análises renderizam `count = 0` no locale `pt`
- **THEN** a mensagem usa o ramo `=0` no plural (como `"0 compras encontradas"`, `"0 transações"`, `"0 planos no total"`) preservando paridade de chaves e placeholders com `es` e `en`

### Requirement: Formatação decimal localizada de taxas e percentuais
Todas as exibições de taxas de juros, rendimento, variação e participação percentual decimal em `src/components/finance/` MUST utilizar `Intl.NumberFormat` no `locale` ativo via helpers de `src/lib/helpers.ts`, respeitando vírgula em `pt`/`es` e ponto em `en`.

#### Scenario: Taxas e percentuais decimais alternam separador conforme o locale
- **WHEN** planos com taxa de juros (`1.5`), caixinhas com rendimento (`12.5`), projeções, relatórios ou estatísticas exibem percentuais decimais em `pt`, `es` e `en`
- **THEN** os números renderizam com vírgula em `pt` e `es` (`1,5%`, `12,5% a.a.`) e com ponto em `en` (`1.5%`, `12.5% p.a.`), preservando as 6 identidades do baseline AST
