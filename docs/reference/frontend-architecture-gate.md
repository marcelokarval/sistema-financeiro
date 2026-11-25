# Gate de arquitetura de frontend

O gate analisa TSX próprio de produção com a API do TypeScript já instalada no projeto. Não executa componentes, não resolve imports e não consulta APIs ou banco. O recorte é `src/app`, `src/components/finance` e `src/components/shared`, inclusive subpastas. Exclui `src/app/api`, `*.test.tsx`, `*.spec.tsx`, `*.fixture.tsx` e os diretórios de testes/fixtures (`__tests__`, `__fixtures__`, `test`, `tests`, `fixtures`). `src/components/ui` (shadcn) e `examples` ficam fora do recorte. É uma checagem dedicada, não uma substituição do ESLint nem uma prova de paridade visual/financeira.

## Erros e avisos

- **`raw-conditional-class-name`**: a expressão do atributo JSX `className` é um template literal e pelo menos uma interpolação é uma ternária cujos dois resultados são literais de string, inclusive a string vazia. Parênteses não ocultam esse padrão. `cn()`, classes fixas, a própria ternária sem template, outros atributos e estilos técnicos (p. ex. proporções via `style`, cor dinâmica e impressão) não geram esse erro.
- **Avisos de revisão**: arquivo acima de 500 linhas, profundidade JSX de 10 ou mais níveis, callback passado diretamente a uma chamada com 12 ou mais tags JSX e template de `className` com interpolação não literal, quando o atributo não viola a regra bloqueante. Esses sinais não exigem extração cosmética nem mudam a saída do processo. Semântica nativa e wrappers técnicos podem ser a melhor composição.

A identidade usa regra + caminho relativo + símbolo léxico + SHA-256 da representação AST da tag e do template: a hierarquia de nós e tokens do TypeScript, sem comentários nem espaços ou quebras de linha entre tokens. Preserva a grafia e os espaços dentro de literais. A linha é só localização diagnóstica, nunca chave. Cada entrada versionada declara a multiplicidade exata, a justificativa, o dono e quando retirar (`removeWhen`). Não há dispensa por arquivo inteiro.

## Calibração inicial (0022)

Na raiz do checkout exclusivo, com Bun local e sem carregar arquivos de ambiente:

```sh
bun --no-env-file test ./.zscripts/check-frontend-architecture.test.ts
bun --no-env-file .zscripts/check-frontend-architecture.ts --initial-base eb76f7d
```

Antes do aceite do candidato, registrar `git rev-parse HEAD`, `git diff --name-only eb76f7d --` e `git ls-files --others --exclude-standard`. O modo inicial exige `HEAD` exatamente em `eb76f7d0f3ced99248ed3c8e5334fcc8792a348f`; o delta rastreado e os novos arquivos devem se restringir aos quatro caminhos de 0022. O diretório não rastreado da change r8 é inventariado à parte e nunca entra na prova. TSX próprio ignorado ou caminhos ocultos por flags de índice invalidam a prova. As entradas TSX do scanner são caminhos e blobs da revisão Git, sem extrair checkout nem ler o TSX de trabalho. A configuração de análise é explícita no gate; não carrega a configuração ESLint, o `tsconfig.json` nem manifesto da árvore candidata como política. Não rodar esta calibração num checkout sujeito a escrita concorrente.

## Integração e revalidação (0023)

Só o integrador registra o hash completo do **commit aprovado** da calibração como `ARCH_BASE_REF`, depois do review e da checagem de escopo. Uma branch, tag, `HEAD` ou hash abreviado não serve de autorização. Não obtenha o hash da configuração do candidato. Sem commit aprovado e árvore estável, não fechar 0022 nem integrar outras folhas de produto.

```sh
git diff --name-only eb76f7d "$ARCH_BASE_REF" --
git show "$ARCH_BASE_REF:.zscripts/frontend-architecture-baseline.json" | sha256sum
bun --no-env-file .zscripts/check-frontend-architecture.ts --baseline-ref "$ARCH_BASE_REF"
```

O primeiro comando deve listar apenas os quatro arquivos de 0022. Compare o SHA-256 do segundo com o impresso pelo gate: o teto é o JSON lido do blob aprovado; o JSON local só declara as exceções ainda necessárias. Nesse modo o scanner verifica TSX atual (inclusive adições não ignoradas) e não usa o candidato como fonte de autorização. Os modos são exclusivos e referência ausente, inválida ou ilegível falha.

- **`unbaselined`**: ocorrência confirmada não declarada ou multiplicidade observada maior que a declarada.
- **`orphan`**: entrada ou parte da multiplicidade já não tem ocorrência.
- **`ceiling-exceeded`**: o candidato tenta introduzir uma identidade não autorizada (também se trocar o hash da antiga) ou exceder a multiplicidade aprovada. Adicionar ao JSON não autoriza a regressão.

Ao sanar uma ocorrência, registre a evidência por fatia. Na reconciliação autorizada, retire a entrada sanada (ou reduza seu `count`) e rode as fixtures e o gate com o mesmo `ARCH_BASE_REF`. Não substitua IDs ou hashes para acomodar uma mudança de símbolo, caminho ou impressão. Mudança legítima da regra, da normalização AST ou da política exige revalidação e revisão explícita, separadas do candidato que ela limita.

## Evidência da calibração

- **RED:** fixtures iniciais, 13 falhas esperadas antes do scanner/ratchet; depois, 3 falhas esperadas antes da seleção das referências. Com o JSON vazio, a execução real contra `eb76f7d` rejeitou as 38 ocorrências não declaradas.
- **GREEN:** 16 fixtures passaram, inclusive ocorrências novas incluídas no JSON candidato, multiplicidade crescente, troca de hash, entrada órfã e seleção do modo. Os avisos permaneceram não bloqueantes.
- **REFACTOR:** imports tipados dos fixtures substituíram a sonda de ausência usada no RED. Cada uma das 38 ocorrências do baseline tem justificativa própria e multiplicidade 1.
- **Revisão da identidade:** a fixture que altera apenas as quebras de linha da ternária falhou antes da correção na serialização do AST; a suíte revisada também verifica que espaços dentro de strings e de templates continuam significativos. Os hashes foram recalculados sem alterar a classificação das ocorrências.

Para a revisão da identidade, apenas os 38 blobs TSX Git permitidos foram transmitidos ao scanner isolado; o preflight Git foi observado separadamente. Essa evidência não é uma execução isolada de ponta a ponta do CLI `--initial-base` e não autentica um `ARCH_BASE_REF`. O hash do commit aprovado e o readback do blob ficam a cargo do integrador.
