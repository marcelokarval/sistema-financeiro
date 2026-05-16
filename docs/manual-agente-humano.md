# Manual de Operação: Workflow Humano ↔ Agente IA

> **Versão:** 1.1.0
> **Data:** 2026-04-19
> **Autor:** Marcelo Karval & Z.ai Code Agent
> **Projeto:** Sistema Financeiro Pessoal
>
> **Changelog v1.1.0:** Correções baseadas em revisão detalhada

---

## 1. Visão Geral

Este manual documenta a metodologia de colaboração entre um desenvolvedor humano e um agente de IA (Z.ai Code Agent) para construção de software. O objetivo é estabelecer um fluxo claro, previsível e controlável — onde o humano é o **diretor estratégico** e o agente é o **executor tático**.

### 1.1 Princípios Fundamentais

| Princípio | Descrição |
|---|---|
| **Humano no comando** | Toda decisão estratégica, priorização e aprovação parte do humano |
| **Agente como executor** | O agente implementa, refatora, corrige e documenta — nunca decide sozinho o rumo |
| **Arquivos como memória** | O agente não tem memória entre sessões. Tudo é persistido em arquivos (worklog, docs, código) |
| **Comunicação via prompts** | A única forma de instruir o agente é através de mensagens de texto (prompts) |
| **Cron como automação** | Jobs agendados permitem execução autônoma, mas apenas seguindo tarefas previamente definidas |
| **Revisão humana obrigatória** | Sempre que possível, o humano deve revisar o que o agente produziu antes de prosseguir |

### 1.2 O que o Agente É e Não É

```
✅ O AGENTE É:                    ❌ O AGENTE NÃO É:

- Um executor de código           - Um arquiteto de software autônomo
- Um revisor de QA automatizado   - Um gerente de projeto
- Um assistente de documentação   - Um tomador de decisões estratégicas
- Um par programador              - Um substituto para code review humano
- Um trabalhador 24/7 (via cron)  - Infalível (ele erra, e muito)
```

---

## 2. Arquitetura do Sistema

### 2.1 Componentes

```
┌─────────────────────────────────────────────────────────────────┐
│                        PLATAFORMA Z.AI                          │
│                                                                 │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────────┐  │
│  │   CHAT UI   │───→│  AGENT CORE  │───→│  FERRAMENTAS      │  │
│  │ (interface  │    │  (LLM + sys  │    │  ─────────────    │  │
│  │   humano)   │    │   prompt)    │    │  • Read/Write     │  │
│  └─────────────┘    └──────┬───────┘    │  • Edit/MultiEdit │  │
│                            │            │  • Bash           │  │
│                            │            │  • Glob/Grep      │  │
│                            │            │  • Task (subagent) │  │
│                            │            │  • Cron           │  │
│                            │            │  • agent-browser  │  │
│                            │            │  • Skills (VLM,   │  │
│                            │            │    TTS, LLM, etc)  │  │
│                            │            └───────────────────┘  │
│                            │                                   │
│                    ┌───────▼────────┐                          │
│                    │  SANDBOX DISCO  │                          │
│                    │  /home/z/       │                          │
│                    │   my-project/   │                          │
│                    │                 │                          │
│                    │  • src/         │                          │
│                    │  • prisma/      │                          │
│                    │  • docs/        │                          │
│                    │  • worklog.md   │                          │
│                    │  • .env         │                          │
│                    └─────────────────┘                          │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              CRONJOB GATEWAY (serviço interno)           │   │
│  │                                                          │   │
│  │  Agenda jobs → Dispara sessões de agente → Rotina        │   │
│  │  Permite execução autônoma quando humano não está ativo  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Fluxo de Dados

```
Humano ──→ Mensagem ──→ Agente (sessão) ──→ Ferramentas ──→ Disco
                                                                         │
                    ←── Resposta ←── Leitura do disco ←──────────────┘
```

### 2.3 O Sistema de Skills

#### Como as Skills funcionam
O Z.ai possui um sistema de skills — módulos de instruções especializadas que o agente pode carregar sob demanda. Existem **71 skills instaladas** no diretório `skills/`.

#### Mecanismo de carregamento
1. O sistema varre `/home/z/my-project/skills/`
2. Para cada diretório, lê o `SKILL.md` (frontmatter YAML)
3. Extrai `name` + `description` de cada skill
4. Injeta TODAS as descrições no system prompt (campo `<available_skills>`)
5. Quando o agente decide que uma skill é relevante, ele chama `Skill(command="nome")`
6. O SKILL.md COMPLETO é carregado no contexto

#### Diretórios de skills
| Diretório | Função | Lido pelo sistema? |
|-----------|--------|-------------------|
| `skills/` | **PRIMÁRIO** — 71 skills instaladas | ✅ SIM — alimenta o `<available_skills>` |
| `examples/skills/` | Backup estático — 36 cópias de referência | ❌ NÃO — é apenas arquivo morto |

⚠️ **IMPORTANTE:** Skills instaladas em `examples/skills/` NÃO são carregadas pelo sistema. Se uma skill precisa estar disponível para o agente, ela DEVE estar em `skills/`.

#### Limitação: Não existe enforcement obrigatório
O Z.ai **NÃO possui** mecanismo de "mandatory always-on" skill. O agente SEMPRE decide quando usar uma skill baseado na descrição. Não há hooks automáticos que forcem o carregamento de uma skill.

A melhor aproximação de enforcement é:
1. Instalar a skill em `skills/` com uma descrição forte na `description`
2. Referenciar a skill explicitamente no `payload.message` dos crons
3. Mencionar a skill no `worklog.md` como instrução para próximas sessões

#### Skills relevantes para engenharia
| Skill | Função |
|-------|--------|
| `coding-agent` | Workflow Request→Plan→Execute→Verify→Deliver |
| `fullstack-dev` | Next.js 16 full-stack |
| `napkin-discipline` | Guardrail de execução |
| `prompt-hardening` | Bounded execution frames |
| `nextjs-best-practices` | Melhores práticas Next.js |
| `front-react-shadcn` | Componentes shadcn/ui |
| `ascii-wireframe` | Diagramas ASCII |
| `qa-release-gate` | Gate de release |
| `verification-before-completion` | Gate de fechamento |

---

## 3. O Ciclo de Vida de uma Sessão

### 3.1 O que é uma Sessão?

Uma sessão é **uma interação completa** entre você e o agente. Ela começa quando você envia uma mensagem e termina quando o agente para de responder.

**Características críticas:**

| Aspecto | Detalhe |
|---|---|
| **Estado** | Stateless — o agente não lembra de sessões anteriores |
| **Contexto** | Recebe o histórico da conversa atual + system prompt + ferramentas |
| **Memória** | Só existe via arquivos no disco (worklog.md, docs/, código) |
| **Sandbox** | Cada sessão acessa o mesmo diretório `/home/z/my-project/` |
| **Timeout** | Limitada pelo contexto da janela de conversa |

### 3.2 O que Persiste Entre Sessões

```
PERSISTE (disco):                    NÃO PERSISTE (memória):

✅ Código-fonte                      ❌ Variáveis do agente
✅ worklog.md                        ❌ Estado mental do agente
✅ Documentos (docs/)                ❌ Contexto de conversas anteriores
✅ Banco de dados                    ❌ Decisões não documentadas
✅ Git history                       ❌ Intenções implícitas
✅ Cron jobs                         ❌ "O que eu quis dizer com..."
```

**Regra de ouro:** Se não está escrito em um arquivo, o agente não sabe.

---

## 4. O Workflow Completo: Do PRD ao Código

### 4.1 Fase 1 — Planejamento (Humano-dirigido)

Nesta fase, você é 100% ativo. O agente é um assistente de documentação.

```
┌─────────────────────────────────────────────────────────┐
│  PASSO 1: Entregar o PRD                                 │
│                                                          │
│  Você: "Aqui está meu PRD de 50 páginas para um sistema  │
│         financeiro pessoal"                               │
│                                                          │
│  O agente:                                                │
│  1. Lê o documento                                        │
│  2. Identifica funcionalidades                            │
│  3. Mapeia requisitos técnicos                            │
│  4. Faz perguntas esclarecedoras                          │
│  5. Sugere melhorias ou alerta sobre riscos              │
│                                                          │
│  Arquivo criado: docs/PRD.md (ou lido do que você envio) │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  PASSO 2: Criar o SDD (Software Design Document)         │
│                                                          │
│  Você: "Transforma em SDD seguindo minha metodologia X"   │
│                                                          │
│  O agente:                                                │
│  1. Lê o PRD                                             │
│  2. Define arquitetura (layers, padrões, stack)          │
│  3. Modela dados (schema, relacionamentos)               │
│  4. Define APIs (endpoints, request/response)            │
│  5. Lista componentes (UI, páginas, widgets)             │
│  6. Define estrutura de pastas                            │
│  7. Documenta decisões técnicas                          │
│                                                          │
│  Arquivo criado: docs/SDD.md                              │
│                                                          │
│  Você revisa, ajusta, aprova.                              │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  PASSO 3: Quebrar em Tasks                               │
│                                                          │
│  Você: "Quebra o SDD em N tasks, prioriza e identifica   │
│         dependências"                                     │
│                                                          │
│  O agente cria docs/TASKS.md com formato:                │
│                                                          │
│  ## Task 001: Schema do Banco de Dados                   │
│  - **Prioridade:** P0 (bloqueante)                       │
│  - **Dependências:** Nenhuma                             │
│  - **Estimativa:** ~2h                                   │
│  - **Critérios de aceitação:**                           │
│    - [ ] 7 modelos definidos no Prisma schema            │
│    - [ ] Schema pushed ao banco                          │
│    - [ ] Seed data funcional                             │
│    - [ ] `bun run db:push` sem erros                     │
│  - **Arquivos:** prisma/schema.prisma, prisma/seed.ts    │
│  - **Status:** ⏳ Pendente                               │
│                                                          │
│  ## Task 002: API Routes                                 │
│  - **Prioridade:** P0                                    │
│  - **Dependências:** Task 001                            │
│  - **Estimativa:** ~3h                                   │
│  - **Status:** ⏳ Pendente                               │
│                                                          │
│  ...                                                      │
│                                                          │
│  ## Task 015: Relatórios Financeiros                     │
│  - **Prioridade:** P2                                    │
│  - **Dependências:** Task 001, 002, 005                  │
│  - **Status:** ⏳ Pendente                               │
│                                                          │
│  Você revisa, reordena, ajusta estimativas, aprova.       │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Fase 2 — Execução Manual (Humano-dirigido)

Você diz o que fazer, o agente faz.

```
┌─────────────────────────────────────────────────────────┐
│  Você: "Executa a Task 001"                              │
│                                                          │
│  Agente:                                                 │
│  1. Lê docs/TASKS.md → identifica Task 001               │
│  2. Lê docs/SDD.md → entende o design                   │
│  3. Implementa (código, schema, seed)                    │
│  4. Testa (lint, build, curl nos endpoints)              │
│  5. Commita no git                                       │
│  6. Atualiza docs/TASKS.md: Task 001 → ✅ Concluída     │
│  7. Atualiza worklog.md com detalhes do que foi feito    │
│                                                          │
│  Você: "Olha o commit, ficou bom. Task 002"              │
│  Agente: [mesmo fluxo]                                   │
│                                                          │
│  Você: "Para! A Task 003 precisa ajustar — o modelo X    │
│         precisa do campo Y"                               │
│  Agente: Ajusta, re-testa, re-commita                   │
└─────────────────────────────────────────────────────────┘
```

**Nesta fase, cada interação é deliberada.** Você no controle.

### 4.3 Fase 3 — Automação via Crons (Agente-dirigido)

Aqui a balança inverte. O agente opera de forma autônoma.

```
┌─────────────────────────────────────────────────────────┐
│  CONDIÇÃO: Tasks bem definidas em docs/TASKS.md         │
│                                                          │
│  Você: "Liga o cron para continuar as tasks pendentes"   │
│                                                          │
│  Agente cria cron:                                       │
│  ┌─────────────────────────────────────────────┐        │
│  │ nome: "Sistema Financeiro - Exec Tasks"      │        │
│  │ schedule: fixed_rate 900 (15 min)            │        │
│  │ payload.kind: agentTurn                      │        │
│  │ payload.message:                             │        │
│  │                                              │        │
│  │   "Siga ESTRIITAMENTE docs/TASKS.md:         │        │
│  │    1. Leia docs/TASKS.md                     │        │
│  │    2. Encontre a próxima task com ⏳         │        │
│  │    3. Verifique se dependências estão ✅     │        │
│  │    4. Execute seguindo critérios de aceite   │        │
│  │    5. Teste com agent-browser e lint         │        │
│  │    6. Commit e push no GitHub                │        │
│  │    7. Marque ✅ em docs/TASKS.md             │        │
│  │    8. Atualize worklog.md                    │        │
│  │    9. Se encontrar blocker, pare e registre  │        │
│  │   10. NÃO invente tasks extras               │        │
│  │   11. NÃO modifique tasks já concluídas"     │        │
│  └─────────────────────────────────────────────┘        │
│                                                          │
│  A cada 15 min, UMA NOVA SESSÃO de agente:               │
│                                                          │
│  Sessão A (15:00):                                       │
│  → Lê tasks → Task 003 ⏳ → Executa → Marca ✅          │
│  → Atualiza worklog                                      │
│                                                          │
│  Sessão B (15:15):                                       │
│  → Lê tasks → Task 004 ⏳ → Executa → Marca ✅          │
│  → Atualiza worklog                                      │
│                                                          │
│  Sessão C (15:30):                                       │
│  → Lê tasks → Task 005 ⏳ → Depende de 004 ✅ → OK     │
│  → Executa → Marca ✅                                    │
│                                                          │
│  Sessão D (15:45):                                       │
│  → Lê tasks → Task 006 ⏳ → Depende de 008 (⏳)        │
│  → Bloqueada! Registra no worklog e PARA                │
│                                                          │
│  Você: Verifica commits no GitHub                         │
│  Você: "Pare o cron, preciso revisar a Task 006"         │
└─────────────────────────────────────────────────────────┘
```

> **Nota:** `agentTurn` é o tipo de payload mais adequado para execução de tasks. `webDevReview` é uma alternativa que inclui acesso ao `agent-browser` para testes visuais. Não existe um payload tipo 'orchestrator' — a orquestração tem que ser simulada via instruções no `payload.message`.

### 4.4 Fase 4 — Monitoramento e Revisão (Humano-dirigido)

```
┌─────────────────────────────────────────────────────────┐
│  ATIVIDADES DO HUMANO:                                   │
│                                                          │
│  1. Verificar commits no GitHub                          │
│     → `git log --oneline`                                │
│     → Ler diffs das alterações                           │
│                                                          │
│  2. Testar no navegador                                   │
│     → Acessar o Preview Panel                            │
│     → Verificar funcionalidades                          │
│     → Testar edge cases                                  │
│                                                          │
│  3. Revisar worklog.md                                   │
│     → O que foi feito?                                   │
│     → Teve algum problema?                               │
│     → O trabalho está alinhado com o SDD?               │
│                                                          │
│  4. Corrigir rumo                                        │
│     → "Refaz a Task 7, o approach estava errado"        │
│     → "Pula a Task 8 por enquanto"                       │
│     → "Adiciona a Task 16: autenticação"                │
│                                                          │
│  5. Decisão sobre o cron                                 │
│     → "Continua automatizado"                            │
│     → "Para o cron, volto a dirigir manualmente"         │
│     → "Muda intervalo para 1 hora"                       │
└─────────────────────────────────────────────────────────┘
```

---

## 5. O Sistema de Crons em Detalhe

### 5.1 O que é um Cron Job?

Um cron job é uma **tarefa agendada** que dispara automaticamente uma nova sessão de agente em intervalos regulares.

### 5.2 Componentes de um Cron

```json
{
  "name": "Nome descritivo do job",
  "schedule": {
    "kind": "cron",          // ou "fixed_rate" ou "one_time"
    "expr": "0 */15 * * * ?", // expressão cron (6 dígitos)
    "tz": "America/Bahia"    // timezone
  },
  "payload": {
    "kind": "webDevReview",  // tipo de execução
    "message": "As instruções detalhadas que o agente vai seguir..."
  }
}
```

### 5.3 Tipos de Schedule

| Tipo | Formato | Exemplo | Uso |
|---|---|---|---|
| `cron` | Expressão cron (6 campos) | `0 */15 * * * ?` | A cada 15 minutos |
| `fixed_rate` | Segundos entre execuções | `900` (15 min), `3600` (1h) | Intervalo fixo simples |
| `one_time` | Timestamp ou epoch ms | `2026-04-20 09:00:00` | Execução única |

### 5.4 Tipos de Payload

| Kind | Descrição | Ferramentas |
|---|---|---|
| `agentTurn` | Agente geral, processa o prompt normalmente | Todas as ferramentas |
| `webDevReview` | Agente especializado em web dev, usa `agent-browser` para testar | Todas + agent-browser |

⚠️ **Nota:** Não existe `payload.kind: "orchestrator"` ou similar. A orquestração de tasks (verificar pendências, classificar prioridades, criar SDDs) tem que ser simulada via instruções detalhadas no `payload.message`. O payload.kind define apenas QUAL TIPO de agente será disparado, não COMO ele trabalha.

### 5.5 O Ciclo de Execução de um Cron

```
cronjob-gateway-prod
        │
        │ (a cada intervalo)
        ▼
┌──────────────────────┐
│ 1. Criar nova sessão │ ← Com im_context (chat_id, user_id, session_id)
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 2. Enviar payload    │ ← payload.message vira o "prompt do usuário"
│    como prompt       │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 3. Agente processa   │ ← Lê worklog, executa tarefas, testa
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 4. Sessão encerra    │ ← Agente atualiza worklog, commita
└──────────┴───────────┘
           │
           │ (espera próximo intervalo)
           │
           ▼
      Repete...
```

### 5.6 Cuidados com Crons

```
⚠️  CUIDADOS:

1. NUNCA ligue um cron sem tasks bem definidas
   → O agente vai inventar trabalho (churn cosmético)
   → Seu git history vai virar lixo

2. Cuidado com múltiplos crons rodando a mesma coisa
   → Concorrência! Dois agentes editando os mesmos arquivos
   → Sempre delete crons antigos antes de criar novos

3. Sempre inclua instruções de PARADA no prompt do cron
   → "Se encontrar blocker, pare e registre"
   → "Se todas as tasks estiverem ✅, não faça nada"
   → "NÃO invente tasks extras"

4. Monitore periodicamente
   → Verifique os commits que o cron está gerando
   → Verifique o worklog.md para erros

5. Desligue quando não precisar
   → Não há benefício em ter um rodando sem trabalho real
   → Cada execução consome recursos
```

---

## 6. Subagentes: Quando e Como Usar

### 6.1 O que são Subagentes?

Subagentes são processos filhos que o agente principal dispara para executar tarefas específicas. Eles são independentes, compartilham o mesmo sandbox, e retornam resultados para o agente pai.

### 6.2 Tipos Disponíveis

| Subagente | Especialidade | Quando Usar |
|---|---|---|
| `general-purpose` | Pesquisa geral, multi-step, buscas | Buscas complexas no código, tarefas que exigem múltiplas rodadas de grep/read |
| `Explore` | Exploração rápida de codebase | Encontrar arquivos por padrão, entender estrutura, buscas simples |
| `Plan` | Arquitetura e planejamento | Decisões de design, trade-offs, avaliação de impacto de mudanças |
| `frontend-styling-expert` | CSS, Tailwind, responsivo, UI/UX | Problemas visuais, layout, animações, responsividade |
| `full-stack-developer` | Next.js 16 completo | Criar features completas (API + UI + DB), refatorações grandes |

### 6.3 Fluxo com Subagentes

```
┌─────────────────────────────────────────────────┐
│  AGENTE PRINCIPAL (você conversa com ele)       │
│                                                   │
│  Você: "Cria um sistema de relatórios"           │
│                                                   │
│  Agente: "Vou delegar para subagentes:"          │
│                                                   │
│  ┌─────────────────────┐                         │
│  │ Plan Agent           │                         │
│  │ "Planeja a feature"  │                         │
│  │ → Retorna plano      │                         │
│  └──────────┬──────────┘                         │
│             │                                      │
│             ▼                                      │
│  ┌─────────────────────┐                         │
│  │ full-stack-developer │  (pode rodar em        │
│  │ Task 1: API route   │   paralelo com Task 2) │
│  └──────────┬──────────┘                         │
│             │                                      │
│  ┌─────────────────────────┐                     │
│  │ frontend-styling-expert │                     │
│  │ Task 2: UI components   │                     │
│  └──────────┬──────────────┘                     │
│             │                                      │
│             ▼                                      │
│  Agente Principal:                                 │
│  → Integra resultados                              │
│  → Faz QA final                                    │
│  → Reporta a você                                  │
└─────────────────────────────────────────────────┘
```

---

## 7. O worklog.md: A Memória do Projeto

### 7.1 O que é?

O `worklog.md` é o **documento mais importante** para a continuidade entre sessões. É onde cada agente registra o que fez, para que o próximo saiba de onde continuar.

### 7.2 Formato Recomendado

```markdown
---
Task ID: <identificador único>
Agent: <nome do agente>
Task: <descrição da tarefa>

Work Log:
- <passo concreto 1>
- <passo concreto 2>
- ...

Stage Summary:
- <resultados principais / decisões / artefatos produzidos>

---

## NOVAS SESSÕES SÃO ADICIONADAS ABAIXO (append)
```

### 7.3 Seções Recomendadas para o Resumo

```markdown
## Current Project Status
- Descrição do estado atual do projeto
- "STABLE", "IN DEVELOPMENT", "HAS KNOWN BUGS"

## Current Goals / Completed Modifications / Verification Results
- O que foi feito nesta rodada
- Resultados de testes e QA
- Commits realizados

## Unresolved Issues / Risks / Next Steps
- Bugs conhecidos com prioridade
- Riscos identificados
- Recomendações ordenadas para a próxima fase
```

### 7.4 Por que é tão importante?

```
Sem worklog:
  Sessão A: "Fiz as APIs"
  Sessão B: "Quais APIs? Não sei o que foi feito."
  → Trabalho duplicado ou perdido

Com worklog:
  Sessão A: "Fiz as APIs de accounts, cards, transactions"
  Sessão B: Lê worklog → "APIs feitas. Vou fazer as views."
  → Continuidade perfeita
```

---

## 8. Metodologia Proposta: O Pipeline Completo

### 8.1 Visão Geral do Pipeline

```
┌───────────────────────────────────────────────────────────────────────────┐
│                                                                           │
│  ① PRÉ-PRD → ② PRD → ③ SDD → ④ TASKS → ⑤ EXECUÇÃO → ⑥ REVISÃO        │
│                                                                           │
│  Humano     Humano    Humano+   Humano+    Humano → Agente → Humano      │
│  brainstorm  entrega   Agente    Agente     ou Agente (cron)             │
│                                                                           │
│  ●──────●───────●───────●──────────●──────────────●─────────●             │
│  Ideação  Docs   Conversa  Planejamento  Código       QA/GitHub           │
│          estáticos         (execução)                                       │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

#### 8.1.1 A Fase Pré-PRD (Exploração)

Antes de formalizar um PRD, existe uma fase de exploração onde:
- Você brainstorma ideias com o agente
- Definem user stories iniciais
- Exploram escopo e tradeoffs
- Tomam decisões de produto

Esta fase é **conversacional** e informal. Não produz artefatos formais.
O agente atua como um "sparring partner" — questionando, sugerindo, alertando.

Quando as ideias estão maduras o suficiente, você formaliza o PRD.

### 8.2 Templates de Documentos

#### Template de TASKS.md

```markdown
# Task List: [Nome do Projeto]

> Última atualização: YYYY-MM-DD
> Versão do SDD: X.Y

## Legenda
- ✅ Concluída
- 🔄 Em andamento
- ⏳ Pendente
- ⛔ Bloqueada
- ⏭️ Pulada (com motivo)

---

## Task 001: [Título]
- **Prioridade:** P0 | P1 | P2 | P3
- **Dependências:** Nenhuma | Task XXX
- **Estimativa:** ~Xh
- **Critérios de aceitação:**
  - [ ] Critério 1
  - [ ] Critério 2
  - [ ] Critério 3
- **Arquivos esperados:** lista de arquivos
- **Notas:** observações adicionais
- **Status:** ⏳

---

## Task 002: [Título]
...
```

#### Template de Prompt de Cron

```
Siga ESTRIITAMENTE docs/TASKS.md:

1. Leia docs/TASKS.md e identifique a próxima task com status ⏳
2. Verifique se todas as dependências estão ✅
   - Se não, marque como ⛔ e registre no worklog
3. Leia docs/SDD.md para entender o design esperado
4. Execute a task seguindo os critérios de aceitação
5. Teste:
   - `bun run lint` (zero erros)
   - `agent-browser` para testar visualmente
   - Verifique se APIs retornam 200
6. Commit com mensagem descritiva
7. Push para o GitHub
8. Atualize docs/TASKS.md (marque ✅)
9. Atualize worklog.md (registro detalhado)
10. Se encontrar blocker ou erro que não consegue resolver:
    - Registre no worklog com detalhes
    - Pare e não tente contornar sozinho

NÃO:
- Invente tasks extras
- Modifique tasks já concluídas
- Pule tasks sem justificativa
- Faça mudanças cosméticas sem relação com a task
```

---

## 9. Comandos e Operações Rápidas

### 9.1 Gerenciamento de Crons

```bash
# Listar todos os crons
cron list

# Criar novo cron (via agente)
cron create --name "nome" --schedule "0 */15 * * * ?" --message "..."

# Deletar cron
cron delete --jobId XXXXX

# Ver detalhes de um cron
cron get --jobId XXXXX
```

### 9.2 Monitoramento

```bash
# Ver últimos commits
git log --oneline -20

# Ver diff do último commit
git show --stat

# Verificar lint
bun run lint

# Ver log do dev server
tail -50 dev.log
```

---

## 10. Anti-Padrões (O que NÃO fazer)

### 10.1 Anti-Padrão: "Melhore algo"

```
❌ "Liga um cron pra melhorar o app"
   → Agente vira gerador de churn
   → Padding de 4 → 6 → 8 → 4 (loop infinito)
   → Widgets desnecessários criados
   → Git history poluído com centenas de commits cosméticos
```

### 10.2 Anti-Padrão: "Faz tudo"

```
❌ "Liga um cron pra fazer o projeto inteiro"
   → Sem tasks definidas, o agente improvisa
   → Arquitetura fica inconsistente
   → Sem revisão humana, bugs se acumulam
   → Impossível rastrear o que foi feito e por quê
```

### 10.3 Anti-Padrão: Múltiplos Crons Paralelos

```
❌ Criar 3 crons para o mesmo projeto
   → Concorrência: agente A edita arquivo X enquanto B edita o mesmo
   → Conflitos de git
   → worklog.md corrompido (duas sessões appendando ao mesmo tempo)
```

### 10.4 Anti-Padrão: "Trabalha 24h"

```
❌ Cron de 5 minutos rodando a noite toda
   → Desperdício de recursos
   → Sem revisão, erros se propagam
   → No dia seguinte, você tem 288 commits para revisar
```

### 10.5 Anti-Padrão: Prompts Vagos

```
❌ "Continue o desenvolvimento"
   → Sem direção, o agente adivinha

✅ "Execute a Task 003 de docs/TASKS.md"
   → Direção clara, resultado previsível
```

---

## 11. Melhores Práticas

### 11.1 Prompts Precisos

```
✅ BOM:
"Leia docs/TASKS.md, execute a Task 005 (API de transferência).
 Siga os critérios de aceitação listados.
 Teste com curl após implementar.
 Commit com mensagem: 'feat: transfer API endpoint'"

❌ RUIM:
"Faz a API de transferência de um jeito legal"
```

### 11.2 Trabalho Incremental

```
✅ Comece com tasks pequenas e bem definidas
✅ Execute manualmente as primeiras para calibrar
✅ Só automatize quando o fluxo estiver maduro
✅ Sempre revise o que o agente fez antes de prosseguir
```

### 11.3 Documentação Viva

```
✅ Atualize docs/TASKS.md a cada task concluída
✅ Mantenha worklog.md atualizado (append, nunca reescreva)
✅ Documente decisões e razões no SDD
✅ Use commits descritivos (conventional commits)
```

### 11.4 Quando Usar vs Não Usar Crons

```
✅ USE CRONS QUANDO:
- Há tasks bem definidas e pendentes
- O fluxo de trabalho está calibrado
- Você vai ficar offline por um período
- Quer QA automatizado periódico
- Tasks são independentes (sem concorrência)

❌ NÃO USE CRONS QUANDO:
- Não há tasks definidas
- O projeto precisa de decisões criativas
- Você está ativo e prefere controlar manualmente
- Há riscos de mudanças destrutivas
- O projeto está em fase de design/exploração
```

---

## 12. FAQ

### P: O agente pode trabalhar sozinho a noite toda?
**R:** Tecnicamente sim, mas **não deveria** sem tasks bem definidas. Sem supervisão, erros se acumulam e se propagam. Ideal: cron com tasks limitadas + revisão humana na manhã seguinte.

### P: O que acontece se o agente cometer um erro no cron?
**R:** Ele commita o erro. Por isso é essencial incluir no prompt do cron: "se encontrar blocker, pare e registre". Na revisão, você faz `git revert` ou pede ao agente para corrigir.

### P: Posso ter múltiplos projetos com crons diferentes?
**R:** Sim. Cada projeto teria seu próprio docs/TASKS.md e worklog.md, e crons separados com prompts distintos.

### P: O agente revisa código de outros agentes?
**R:** Indiretamente. Cada sessão nova lê o código atual do disco (incluindo o que outros agentes modificaram). O worklog.md ajuda a entender o contexto.

### P: Quanto tempo uma sessão de agente dura?
**R:** Depende da complexidade da task. Uma task simples pode levar 2-3 minutos. Uma feature completa pode levar 10-15 minutos. O cron respeita o intervalo — se a sessão anterior ainda está rodando quando o próximo disparo chega, elas podem rodar em paralelo (cuidado!).

### P: Como faço para pausar temporariamente?
**R:** Delete o cron. Quando quiser voltar, recrie com o mesmo prompt. As tasks pendentes estarão em docs/TASKS.md esperando.

### P: Existem arquivos AGENTS.md ou SOULS no sistema?
**R:** NÃO. O Z.ai não usa arquivos AGENTS.md, SOULS ou configuração de agentes separados. Os "agents" são os 5 tipos de subagentes via Task tool (`general-purpose`, `Explore`, `Plan`, `frontend-styling-expert`, `full-stack-developer`) e as 71 skills instaladas que funcionam como "personas" especializadas.

### P: Qual a diferença entre `skills/` e `examples/skills/`?
**R:** `skills/` é o diretório **primário** — o sistema lê as skills de lá e as disponibiliza para o agente. `examples/skills/` é um **backup estático** — cópias de referência que NÃO são lidas pelo sistema. Se uma skill precisa estar disponível, ela deve estar em `skills/`.

### P: O `webDevReview` é um orquestrador de tasks?
**R:** NÃO. `webDevReview` é apenas um dos dois tipos de payload disponíveis para crons (`agentTurn` e `webDevReview`). A diferença é que `webDevReview` inclui acesso ao `agent-browser` para testes visuais. Não existe um tipo de payload "orchestrator" nativo. A orquestração (classificar tasks, verificar dependências, decidir o que executar) tem que ser implementada via instruções no `payload.message`.

---

## 13. Conclusão

```
┌─────────────────────────────────────────────────────────┐
│                                                          │
│   O fluxo ideal é:                                       │
│                                                          │
│   1. Você planeja (PRD → SDD → Tasks)                   │
│   2. Você executa manualmente as primeiras tasks         │
│   3. Você calibra o processo                             │
│   4. Você delega ao cron (com tasks bem definidas)       │
│   5. Você monitora e revisa                              │
│   6. Você corrige o rumo quando necessário               │
│   7. Você desliga o cron quando acabarem as tasks       │
│                                                          │
│   Em resumo: VOCÊ É O DIRETOR. O AGENTE É A ORQUESTRA.  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

> *Este manual é um documento vivo. Atualize conforme aprender novas práticas.*
> *Próxima revisão: após 2 semanas de uso real.*
