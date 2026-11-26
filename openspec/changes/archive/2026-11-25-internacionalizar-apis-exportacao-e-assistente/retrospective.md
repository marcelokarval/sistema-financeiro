# Retrospective — `internacionalizar-apis-exportacao-e-assistente`

## O que funcionou bem
- A introdução do módulo puro `src/lib/server-i18n.ts` com catálogos `src/messages/{pt,es,en}/api.json` permitiu dividir as rotas em 3 frentes paralelas disjuntas (`1.2`, `1.3`, `1.4`) sem conflitos de escrita.
- O mecanismo `hasExplicitLocaleSignal(request)` garantiu retrocompatibilidade total com os contratos legados das suítes `test:sqlite` (`installments/route.test.ts` e `purchases/route-integrity.test.ts`), mantendo o código de erro exposto em `X-Error-Code` e JSON `{ error, code }` sempre que um locale é sinalizado ou nas rotas padronizadas.
- Chaves ISO aditivas (`monthKey`, `monthKeys`, `dateKey`, `dayIndex`, `estimatedCompletionKey`) e `amountRaw` mantiveram integrações independentes do idioma de exibição.

## Pontos de atenção e lições aprendidas
- Manter assinatura opcional `request?: NextRequest` em handlers `GET` evitou regressões em testes unitários que invocam `GET()` sem argumentos.
- A preservação de `BRL` contábil, escape CSV anti-formula-injection e delimitação `<user_context>` em `/api/advisor` foi validada nos 3 idiomas sem abrir exceções de segurança.
