# interface-quiet-financial-os Specification (Delta)

## Purpose

Estender a especificação visual Quiet Financial OS com o seletor de idioma `LanguageSwitcher` e os ícones de bandeira SVG decorativos no cabeçalho e na navegação móvel, preservando acessibilidade, conformidade de tema e regras do gate AST.

## ADDED Requirements

### Requirement: Seletor de idioma Quiet Financial OS com bandeiras SVG decorativas
O sistema MUST disponibilizar o componente `LanguageSwitcher` no `AppHeader` (modo compacto) e no menu `Mais` da `MobileNav` (modo completo), exibindo `LocaleFlagIcon` puramente decorativo, autônimos (`Português`, `Español`, `English`), siglas (`PT`, `ES`, `EN`) e indicador visual ativo, em conformidade com o gate AST.

#### Scenario: Seleção e persistência de idioma pelo usuário
- **WHEN** o usuário abre o `LanguageSwitcher` no cabeçalho ou no painel móvel e seleciona `Español` ou `English`
- **THEN** o cookie `NEXT_LOCALE` é atualizado para `'es'` ou `'en'`, o item ativo exibe o ícone `Check` e o shell passa a exibir os textos no novo idioma após atualização.

#### Scenario: Acessibilidade, bandeiras decorativas e conformidade visual
- **WHEN** o `LanguageSwitcher` é inspecionado por leitor de tela, teclado e gate `arch:check` em tema claro ou escuro
- **THEN** o gatilho possui nome acessível, as opções são navegáveis por teclado com `Enter`/`Space`/setas/`Escape`, cada `<img />` de `/locale-flags/{pt,es,en}.svg` usa `alt=""` e `aria-hidden="true"`, e o código usa `cn()` sem `framer-motion` nem `raw-conditional-class-name`.
