# Análise 360°: Accelerate + Napkin + Superuser no Workflow Z.ai

> **Versão:** 1.1.0
> **Data:** 2026-04-19
> **Escopo:** Análise completa de como o accelerate, napkin-discipline e o conceito de superuser se encaixam no workflow humano-agente na plataforma Z.ai
> **Nota v1.1.0:** Correções críticas em paths de skills, enforcement, e premissas do accelerate para Z.ai

---

## Resumo Executivo

Depois de ler **todos os 79+ arquivos** do repositório `accelerate` (SKILL.md, README.md, AGENTS.md, core/, agents/, adapters/, onboarding/, planning/, profiles/, docs/, references/), a skill `napkin-discipline`, e analisar o conceito de `superuser`, aqui está a visão 360°.

**Tese central:** O `accelerate` é, sem exagero, o framework de orquestração de engenharia mais sofisticado que já vi para agentes de IA. Mas ele foi desenhado para o **Claude/Codex** — e precisamos adaptá-lo para a realidade da **Z.ai**.

---

## 1. A Fase Pré-PRD: O Que É e Como Funciona

### 1.1 Onde ela se encaixa no Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PIPELINE COMPLETO                                │
│                                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │  PRÉ-PRD │→│   PRD    │→│   SDD    │→│  TASKS   │→│ EXECUÇÃO │ │
│  │(explora) │  │(define) │  │(design) │  │(quebra)  │  │(código)  │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
│       │                                                        │        │
│       └── Esta é a fase que NÃO EXISTE formalmente no accelerate      │
│           mas que o accelerate implicitamente resolve via               │
│           Prompt Hardening + Specification PM                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 O que acontece na fase pré-PRD

Na fase pré-PRD, você e eu estamos:

- **Brainstormando** ideias ("e se tivesse um dashboard de investimentos?")
- **Definindo user stories** ("como usuário quero ver minha saúde financeira")
- **Explorando escopo** ("vale a pena ter notificações push?")
- **Tomando decisões de produto** ("dark mode é priority 0 ou P2?")
- **Descobrindo requisitos** ("precisa de exportação CSV? PDF?")
- **Mapeando o desconhecido** ("como deve ser o fluxo de onboarding?")

### 1.3 Onde o accelerate hoje NÃO cobre isso

O accelerate **pula** da conversa direto para classificação:

```
User Request → classify → trivial/ambiguous/non-trivial → branch → execute
```

Não existe um estágio formal de "vamos pensar juntos sobre o produto antes de definir qualquer coisa". O accelerate assume que o PRD já existe (ou que a request é auto-suficiente).

### 1.4 Mas o accelerate TEM os mecanismos para cobrir

Dois mecanismos do accelerate cobrem essa lacuna **implicitamente**:

#### A. Prompt Hardening (como Specification PM)

Quando a request é "longa, ambígua, multi-objetivo, multi-fase", o accelerate:

1. Ativa o `Prompt Hardening Gate`
2. O `Specification PM` entra em ação
3. Produz: Prompt A → Prompt B (com bounded scope, non-goals, branch route)

**Isso É a fase pré-PRD disfarçada.** O prompt hardening é, na prática, o momento onde ideias vagas viram especificação.

#### B. Entry-Shaping Workflow

O workflow catalog (#1) define:

```
User Request → Specification PM → Prompt Hardening Editor → Product Planner
```

**Isso É o pipeline de pré-PRD** — só que não é chamado assim.

### 1.5 Proposta: Tornar a Fase Pré-PRD Explícita

```
┌───────────────────────────────────────────────────────────────────┐
│  PIPELINE EXPANDIDO COM PRÉ-PRD EXPLÍCITO                         │
│                                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │  PRÉ-PRD │→│   PRD    │→│   SDD    │→│  TASKS   │→ EXECUÇÃO│
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘          │
│       │              │              │                              │
│       ▼              ▼              ▼                              │
│  Artefatos:    Artefatos:    Artefatos:                           │
│  - ideias.md   - PRD.md      - SDD.md                             │
│  - user-      - user         - arquitetura                        │
│    stories       stories     - modelos                            │
│  - decisões    - requisitos  - APIs                               │
│  - tradeoffs   - critérios   - componentes                       │
│  - scope       - non-goals   - contratos                          │
│                de aceitação                                       │
│                                                                    │
│  Persona:      Persona:      Persona:                             │
│  Specification PM  Product      Implementation                    │
│  + Product PM   Planner       Designer                             │
│  (brainstorm)  (formaliza)   (detalha)                           │
│                                                                    │
│  Mecanismo:     Mecanismo:    Mecanismo:                          │
│  Conversação   Prompt        Planning                              │
│  iterativa     Hardening     Artifact                              │
│  + napkin      Gate          Workflow                              │
│                                                                    │
└───────────────────────────────────────────────────────────────────┘
```

---

## 2. Accelerate: Análise Profunda

### 2.1 O que é (com precisão cirúrgica)

`accelerate` é **não** é:
- Um copilot que sugere código ❌
- Um chatbot de perguntas e respostas ❌
- Um wrapper em torno de skills ❌
- Um sistema que depende de agents para funcionar ❌

`accelerate` **é**:
- O **control plane** que decide **como** o trabalho deve rodar **antes** da implementação começar ✅
- Um **classificador** que rotula cada request em trivial/ambíguo/não-trivial ✅
- Um **roteador** que seleciona a branch correta (de 26 tipos) ✅
- Um **gestor de gates** que bloqueia execução até pré-requisitos serem satisfeitos ✅
- Um **gerente de proof** que exige evidência em 5 camadas antes de fechar ✅
- Um **orquestrador de personas** que ativa os papéis corretos para cada fase ✅

### 2.2 Arquitetura Interna (de verdade)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ACCELERATE — CAMADAS                         │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  SKILL.md (interface constitucional, ~237 linhas)           │    │
│  │  README.md (guia operacional rico, ~665 linhas)             │    │
│  └───────────────────────────┬─────────────────────────────────┘    │
│                              │                                      │
│  ┌───────────────────────────▼─────────────────────────────────┐    │
│  │  CORE — Leis não negociáveis                               │    │
│  │  ┌───────────────┐  ┌──────────────┐  ┌────────────────┐    │    │
│  │  │ control-plane │  │ hardening    │  │ issue-topology  │    │    │
│  │  │ - root-laws   │  │ - prompt-    │  │ - mutation     │    │    │
│  │  │ - branch      │  │   hardening  │  │   stack        │    │    │
│  │  │   enforcement │  │ - gate rule   │  │ - topology     │    │    │
│  │  │   matrix     │  │               │  │   policy       │    │    │
│  │  │ - quick       │  │               │  │               │    │    │
│  │  │   invocation │  │               │  │               │    │    │
│  │  └───────────────┘  └──────────────┘  └────────────────┘    │    │
│  │  ┌───────────────┐  ┌──────────────┐  ┌────────────────┐    │    │
│  │  │ delegation    │  │ lanes         │  │ risk           │    │    │
│  │  │ - subagent    │  │ - manager     │  │ - enforcement  │    │    │
│  │  │   model       │  │   lane model  │  │   surfaces     │    │    │
│  │  │ - spawn/non   │  │               │  │ - risk         │    │    │
│  │  │   spawn crit  │  │               │  │   enforcement  │    │    │
│  │  │ - parallelism │  │               │  │   matrix       │    │    │
│  │  └───────────────┘  └──────────────┘  └────────────────┘    │    │
│  │  ┌───────────────┐  ┌──────────────┐  ┌────────────────┐    │    │
│  │  │ review        │  │ workflows     │  │ personas       │    │    │
│  │  │ - product-    │  │ - catalog     │  │ - model        │    │    │
│  │  │   critical    │  │ - operational │  │ - executive    │    │    │
│  │  │ - premium     │  │   calibration│  │   matrix       │    │    │
│  │  │   interface   │  │ - maturity    │  │ - mandatory    │    │    │
│  │  │ - closure     │  │   control     │  │   skills       │    │    │
│  │  │   authority   │  │ - self-evo    │  │               │    │    │
│  │  └───────────────┘  └──────────────┘  └────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  AGENTS — Fábrica de agentes (pre-agents, sem runtime)      │    │
│  │  - doctrine: ontology, capability, selection, gap, pooling  │    │
│  │  - envelopes: skill envelopes por família                    │    │
│  │  - promotion: execution contract, critérios                  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  ADAPTERS — Adaptadores (contrato abstrato)                 │    │
│  │  - workflow: linear, github                                  │    │
│  │  - runtime: python-uv, node, chrome-devtools, playwright    │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  PROFILES — Defaults opinativos por stack                    │    │
│  │  - django-inertia-react (default atual)                      │    │
│  │  - nextjs-tailwind (peer, não implementado)                  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  ONBOARDING — Primeiro contato com um repositório           │    │
│  │  - discovery: inspecta repo, infere stack/workflow           │    │
│  │  - A&Q: pergunta o mínimo para decidir adaptação             │    │
│  │  - local-workspace: emite .accelerate/ no target repo        │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  PLANNING — Artefatos de planejamento                       │    │
│  │  - executive: bootstrap plans, parity decisions              │    │
│  │  - architecture: PRD-to-SDD transitions                     │    │
│  │  - migration: rehoming doctrine                             │    │
│  │  - promotion: agent promotion planning                      │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  OVERLAYS — Verdade específica do projeto                    │    │
│  │  - prop4you: específico da Prop4You (não genérico)          │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.3 Conceitos-chave do Accelerate

#### Classification Contract

Toda request DEVE ser classificada ANTES da execução:

| Classificação | Significado | O que fazer |
|---|---|---|
| `conversational / no-op` | Pergunta simples | Responder direto |
| `trivial bounded` | Tarefa pequena e bem definida | Executar direto |
| `orchestrated non-trivial` | Trabalho complexo | Pipeline completo |

#### Branch Enforcement Matrix

26 tipos de branches, cada uma com:
- Skills obrigatórias
- Gates obrigatórios
- Artefatos esperados
- Evidência esperada
- Bloqueadores típicos de closure

**Exemplo — `product-critical user surface`:**
- Skills obrigatórias: `product-runtime-review`, `ascii-wireframe`, `server-prop-governance`, `front-react-shadcn`, `tailwind-design-system`
- Gates: `Backend Product Contract Protocol`, `Wireframe Before UI`, `Artifact Sufficiency Check`
- Artefatos: backend product packet, wireframe, truth model, action model

#### Proof Stack (5 camadas)

```
1. Implementation Proof    → "O código compila?"
2. Backend/Frontend QA     → "Os testes passam?"
3. Browser Truth           → "Funciona no navegador real?"
4. Persistent Regression   → "Playwright confirma?"
5. Forensic Closure         → "requested vs implemented = OK?"
```

#### Prompt Hardening

Sempre que a request é:
- longa, ambígua, multi-objetivo, multi-fase, architecture-heavy

O agente NÃO pula pra implementação. Ele:
1. Transforma Prompt A → Prompt B
2. Define bounded scope
3. Lista explicit non-goals
4. Só depois classifica e executa

### 2.4 Onde o Accelerate brilha

| Situação | Como o accelerate resolve |
|---|---|
| Request ambígua | Prompt Hardening Gate bloqueia execução até clareza |
| Trabalho complexo | Classifica como non-trivial, abre pipeline completo |
| Múltiplas superfícies (front+back) | Branch correta com skills obrigatórias |
| Mudança em código existente | Issue Bootstrap Gate obrigatório |
| QA fraca | Proof Stack com 5 camadas, browser truth antes de Playwright |
| Decisão sobre delegates | Subagent Model com spawn/non-spawn criteria |
| Risco | Risk Enforcement com detector, signal, owner, blocker |
| Closure apressado | Root Closure Mode, só o root pode marcar Done |

### 2.5 Onde o Accelerate precisa de adaptação para Z.ai

| Ponto | Accelerate (Codex) | Z.ai | Adaptação necessária |
|---|---|---|---|
| **Workflow backend** | Linear/GitHub Issues (adaptadores) | Não há backend formal | worklog.md + docs/TASKS.md como artefatos |
| **Agentes** | Promoted *.toml agents | Subagentes via Task tool | Mapear famílias → tipos de subagentes Z.ai |
| **Runtime commands** | uv, manage.py, makemigrations | bun, prisma, lint | Criar adapter runtime bun-nextjs |
| **Persona ativa** | Claude com instruções explícitas | Agente Z.ai com system prompt | Persona = instruções no prompt |
| **Stack profile** | Django/Inertia default | Next.js/Tailwind | Criar profile nextjs-tailwind |
| **Onboarding** | .accelerate/ workspace | Não existe | Adaptar para worklog.md + docs/ |

---

## 3. Napkin-Discipline: O Guardrail de Decisões

### 3.1 O que é

O `napkin-discipline` é a skill de **disciplina de execução** que age como um "cinto de utilidades" para toda sessão de trabalho.

### 3.2 Como funciona

```
┌─────────────────────────────────────────────┐
│  NAPKIN-DISCIPLINE                          │
│                                              │
│  Core Rules:                                 │
│  1. Runtime truth over plausible narration  │
│     → Se rodou no browser, o browser é a    │
│       verdade. Narrativa não substitui.      │
│                                              │
│  2. Review recursively when complexity high  │
│     → Se é complexo, revisa recursivamente    │
│                                              │
│  3. Child results are inputs, not final truth│
│     → Subagentes retornam dados, não verdades│
│       finais. O master integra.               │
│                                              │
│  4. Partial validation is not full closure   │
│     → Passou em 3 de 5 testes? Não está      │
│       "testado". Está parcialmente testado.  │
│                                              │
│  5. Concise verdicts beat vague optimism     │
│     → "Accept", "Adjust" ou "Blocked" em     │
│       vez de "acho que tá bom"               │
│                                              │
│  Outputs:                                    │
│  - accept / adjust / blocked                 │
│  - evidence summary                          │
│  - next step recommendation                  │
└─────────────────────────────────────────────┘
```

### 3.3 Como se relaciona com o accelerate

No accelerate, o napkin aparece como:

> **Recommended Adjacent Skills:** `napkin` keeps the recurring runbook and durable tactical guidance fresh.

Ou seja, o accelerate reconhece que precisa de um "guardrail tático" e o napkin é esse guardrail.

### 3.4 O napkin no contexto Z.ai

No contexto do nosso projeto, o napkin cumpre exatamente o papel de **guardrail de decisões**:

- Quando um cron job faz uma mudança → o napkin garante que não é "plausible narration"
- Quando um subagente retorna resultado → o napkin diz "child result is input, not truth"
- Quando alguém diz "testado" → o napkin exige "evidence, not claim"

**Análogo prático:** O napkin é o auditor interno que impede que o agente se auto-engane.

---

## 4. Superuser / Using-Superpowers: A Inferência de Skills

### 4.1 O que é

O `using-superpowers` (referenciado no accelerate como "adjacent skill recomendado") é o mecanismo que **obriga o agente a inferir e ativar skills relevantes** sempre que houver **1% de chance** de a skill melhorar a tarefa.

### 4.2 Como funciona (conceito)

```
┌──────────────────────────────────────────────────────────┐
│  USING-SUPERPOWERS                                       │
│                                                           │
│  Regra:                                                  │
│  Para qualquer task, o agente DEVE:                       │
│  1. Escanear TODAS as skills disponíveis                  │
│  2. Para cada skill, avaliar:                            │
│     "Existe 1%+ de chance de esta skill                   │
│      melhorar o resultado?"                               │
│  3. Se SIM → ativar a skill                              │
│  4. Se NÃO → justificar por que não                       │
│                                                           │
│  OPOSTO ao comportamento padrão:                         │
│  ❌ Agente só usa skill quando pedem explicitamente      │
│  ✅ Agente INFERE skills proativamente                    │
│                                                           │
│  Exemplo:                                                │
│  Task: "Cria um gráfico de gastos mensais"               │
│  Skills inferidas:                                        │
│  - charts (gráfico de barras/pizza)                      │
│  - finance (formatação BRL)                               │
│  - image-generation (talvez screenshot?)                   │
│  - web-search (dados atualizados?)                        │
│                                                           │
│  Sem superuser:                                          │
│  → Agente cria gráfico com Recharts sem pensar em skills │
│                                                           │
│  Com superuser:                                          │
│  → Agente escaneia skills, ativa charts + finance        │
│  → Resulto provavelmente melhor                          │
└──────────────────────────────────────────────────────────┘
```

### 4.3 Diferença: Accelerate vs Superuser

| Aspecto | Accelerate | Superuser |
|---|---|---|
| **O que faz** | Classifica e orquestra o workflow | Inferência de skills relevantes |
| **Quando atua** | Antes e durante a execução | Durante a execução |
| **Escopo** | Macro (pipeline, branch, proof) | Micro (skill por task) |
| **Relação** | Pode RECOMENDAR skills via branch matrix | OBRIGA inferência de qualquer skill disponível |
| **Analogia** | Diretor de orquestra | Sparring partner que sugere ferramentas |

### 4.4 Superuser é análogo ao accelerate?

**Parcialmente sim, mas com diferenças fundamentais:**

| Critério | Accelerate | Superuser |
|---|---|---|
| **Analisa** quais skills usar? | Sim, via branch enforcement matrix | Sim, via escaneamento de todas as skills |
| **Decide** com base em quê? | Branch type + risk + proof lane | 1% de chance de melhoria |
| **Obriga** uso? | Sim, quando a branch define mandatory skill | Sim, quando há 1%+ de chance |
| **Escopo** | Engenharia de software | Qualquer tarefa |

**O accelerate JÁ faz inferência de skills** — mas de forma **estruturada e determinística** (via branch matrix). O superuser faz de forma **exaustiva e probabilística** (toda skill é avaliada).

### 4.5 Proposta: Superuser como complemento do Accelerate

```
┌──────────────────────────────────────────────────────────────┐
│  COMPOSIÇÃO IDEAL                                           │
│                                                               │
│  ACCELERATE (macro):                                         │
│  - "Esta task é product-critical user surface"              │
│  - "Skills obrigatórias: X, Y, Z"                           │
│  - "Branch: visual/artifact-driven frontend"                │
│                                                               │
│  SUPERUSER (micro):                                          │
│  - "Além de X, Y, Z... a skill W (image-generation)        │
│     tem 15% de chance de melhorar o resultado"              │
│  - "A skill V (charts) tem 40% de chance"                   │
│  - "Skill U (finance) é mandatória para BRL"               │
│  - "Ativando W, V, U"                                       │
│                                                               │
│  Resultado:                                                  │
│  - O accelerate garante a base (skills obrigatórias)         │
│  - O superuser amplia (skills inferidas)                    │
│  - A task fica mais rica sem perder disciplina              │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Como Tudo Se Encaixa: O Modelo Unificado

### 5.1 Stack de Skills no Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                     STACK DE SKILLS (Z.ai)                       │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  LAYER 0: ORQUESTRAÇÃO (sempre ativo)                   │    │
│  │                                                           │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐    │    │
│  │  │ accelerate  │  │ napkin-     │  │ superuser/   │    │    │
│  │  │ (control    │  │ discipline  │  │ using-super  │    │    │
│  │  │  plane)     │  │ (guardrail) │  │  powers      │    │    │
│  │  │             │  │             │  │  (inference)  │    │    │
│  │  │ Classifica  │  │ Auditor     │  │ Escaneia     │    │    │
│  │  │ Roteia      │  │ Guardrail   │  │ Infer skills  │    │    │
│  │  │ Orquestra   │  │ Anti-bull   │  │ Ativa proat.  │    │    │
│  │  │ Fecha       │  │ Verdict     │  │              │    │    │
│  │  └─────────────┘  └─────────────┘  └──────────────┘    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  LAYER 1: PRODUTO (pré-PRD + PRD)                       │    │
│  │                                                           │    │
│  │  - brainstorm / idea exploration                         │    │
│  │  - user stories                                           │    │
│  │  - decisions & tradeoffs                                  │    │
│  │  - scope definition                                       │    │
│  │                                                           │    │
│  │  Persona ativa: Specification PM                         │    │
│  │  Gate: Prompt Hardening (quando ambíguo)                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  LAYER 2: ENGENHARIA (SDD + Tasks + Execução)           │    │
│  │                                                           │    │
│  │  - SDD generation                                        │    │
│  │  - Task decomposition                                     │    │
│  │  - Implementation                                         │    │
│  │  - QA & Proof                                             │    │
│  │                                                           │    │
│  │  Persona ativa: Product Planner → Implementation          │    │
│  │    Designer → Implementer → Tester → Closer              │    │
│  │  Gate: Issue Bootstrap → Planning → Proof Stack           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  LAYER 3: INTELIGÊNCIA (skills de IA)                    │    │
│  │                                                           │    │
│  │  - LLM (chat, advisor)                                   │    │
│  │  - VLM (image understanding)                             │    │
│  │  - Image Generation                                      │    │
│  │  - TTS / ASR                                             │    │
│  │  - Web Search                                            │    │
│  │  - Finance API                                           │    │
│  │                                                           │    │
│  │  Inferidas pelo superuser quando relevantes             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  LAYER 4: EXECUÇÃO (subagentes Z.ai)                    │    │
│  │                                                           │    │
│  │  - general-purpose                                       │    │
│  │  - Explore                                               │    │
│  │  - Plan                                                  │    │
│  │  - frontend-styling-expert                               │    │
│  │  - full-stack-developer                                  │    │
│  │                                                           │    │
│  │  Selecionados pelo accelerate via subagent model         │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Fluxo de Uma Request Completa

```
Você: "Quero adicionar um dashboard de investimentos com dados reais"

┌──────────────────────────────────────────────────────────┐
│  STEP 1: ACCELERATE classifica                           │
│  → "non-trivial, product-critical user surface"          │
│  → Branch: visual/artifact-driven frontend               │
│                                                           │
│  STEP 2: PROMPT HARDENING ativa                          │
│  → Specification PM: "O que você quer ver? Quais dados?  │
│     Que interações? Quais critérios de aceite?"          │
│  → Resultado: Prompt B com scope bounded                 │
│                                                           │
│  STEP 3: SUPERUSER escaneia skills                       │
│  → finance (API de dados reais) → ATIVAR                  │
│  → charts (gráficos de investimentos) → ATIVAR           │
│  → LLM (resumo inteligente) → ATIVAR                     │
│  → web-search (cotações atualizadas?) → AVALIAR          │
│                                                           │
│  STEP 4: ISSUE BOOTSTRAP                                 │
│  → Criar task em docs/TASKS.md                            │
│  → "Task 018: Dashboard de Investimentos"                │
│                                                           │
│  STEP 5: PLANNING ARTIFACT                               │
│  → Implementation Design Packet                           │
│  → Componentes, APIs, dados, layout                      │
│                                                           │
│  STEP 6: EXECUTION (subagentes)                           │
│  → full-stack-developer: API route + schema               │
│  → frontend-styling-expert: UI components                 │
│  → Agent principal: integração                           │
│                                                           │
│  STEP 7: PROOF STACK                                     │
│  → lint: zero erros ✅                                   │
│  → agent-browser: visual QA ✅                            │
│  → Napkin verdict: "accept with notes"                    │
│                                                           │
│  STEP 8: CLOSURE                                         │
│  → Forensic review: requested vs implemented             │
│  → Master Integrator: veredict final                     │
│  → Root: marca Done                                       │
│                                                           │
│  STEP 9: SELF-EVOLUTION                                  │
│  → "A skill charts melhorou o resultado em 40%"          │
│  → Promote: adicionar charts ao mandatory bundle         │
│  → da branch "visual/artifact-driven frontend"            │
└──────────────────────────────────────────────────────────┘
```

---

## 6. Accelerate como Skill no Z.ai: A Realidade do Enforcement

### 6.1 Como skills são carregadas no Z.ai

```
┌─────────────────────────────────────────────────────────┐
│  MECANISMO DE LOADING                                    │
│                                                          │
│  1. Sistema varre /home/z/my-project/skills/             │
│  2. Lê SKILL.md de cada diretório                       │
│  3. Extrai name + description (frontmatter)              │
│  4. Injeta descrições no <available_skills>              │
│  5. Agente DECIDE quando usar (baseado na description)  │
│  6. Quando invocado, SKILL.md completo entra no contexto │
│                                                          │
│  ⚠️ NÃO EXISTE mecanismo de "mandatory always-on"       │
│  ⚠️ O agente SEMPRE decide quando usar                   │
└─────────────────────────────────────────────────────────┘
```

### 6.2 É possível enforcement real?

**NÃO.** No Z.ai atual, não existe mecanismo nativo para forçar uma skill a ser sempre carregada. O que existe são aproximações de força variável:

| Estratégia | Como funciona | Força |
|-----------|--------------|-------|
| Skill em `skills/` | Description no available_skills, agente decide usar | ⚠️ Fraco — agente pode ignorar |
| Referência no payload.message do cron | "Antes de tudo, leia skills/accelerate/SKILL.md" | 🟡 Médio — funciona em crons, não em sessões manuais |
| Referência no worklog.md | "Toda sessão deve seguir skills/accelerate/" | 🟡 Médio — se o agente ler o worklog |
| Overlay em docs/ | Regras locais do projeto | 🟡 Médio — se o agente for instruído a ler |

Nenhuma dessas estratégias garante enforcement verdadeiro. O agente pode sempre ignorar.

### 6.3 O que é realmente possível

O melhor que se pode fazer hoje:

1. **Instalar a skill em `skills/accelerate/`** — com uma descrição forte que maximize a chance de inferência
2. **Instruir explicitamente no payload.message dos crons** — "Leia skills/accelerate/SKILL.md e siga TODAS as instruções antes de qualquer trabalho"
3. **Referenciar no worklog.md** — como instrução permanente para próximas sessões

Isso é **enforcement soft** — funciona na prática quando o prompt é bem construído, mas não é garantido tecnicamente.

### 6.4 Por que um fork é necessário (não apenas adaptação)

O accelerate foi projetado com premissas do mundo Claude/Codex:

| Premissa Codex/Claude | Realidade Z.ai | Impacto |
|-----------------------|----------------|---------|
| Claude lê `.accelerate/` no workspace | Z.ai não tem workspace hook | O onboarding do accelerate não funciona |
| Claude pode usar `manage.py`, `makemigrations` | Z.ai usa `bun`, `prisma`, `lint` | Os adapters de runtime não servem |
| Claude pode criar agents promovidos via `*.toml` | Z.ai tem 5 tipos fixos de subagentes | O agent factory não funciona |
| Claude tem memória entre sessões | Z.ai é stateless (só worklog) | A doctrine de pooling não funciona |
| Claude usa Linear/GitHub Issues | Z.ai usa docs/TASKS.md + worklog | O workflow adapter precisa reescrita total |

Por isso, não basta "adaptar" — é necessário um **fork dedicado** (ex: `accelerate-zai`) que reinterpret os conceitos para a realidade do Z.ai.

### 6.5 docs/ vs .accelerate/: Qual a diferença?

O accelerate original cria um diretório `.accelerate/` no repositório alvo:

```
.accelerate/
├── workspace.toml          ← Config do workspace
├── bootstrap-plans/        ← Planos de bootstrapping
├── parity-decisions/       ← Decisões de paridade
├── migration-state/        ← Estado de migração
└── project-overrides/      ← Overrides do projeto
```

No Z.ai, a equivalência seria:

| .accelerate/ (Codex) | docs/ (Z.ai) | Por quê |
|----------------------|--------------|---------|
| workspace.toml | docs/PROJECT-CONFIG.md | Agente entende markdown melhor que TOML |
| bootstrap-plans/ | docs/BOOTSTRAP.md | Mesma função, formato diferente |
| migration-state/ | worklog.md | O worklog já é o estado |
| project-overrides/ | docs/OVERRIDES.md | Regras locais |

Nenhum diretório é "auto-lido" pelo sistema. A diferença é semântica: markdown é a língua nativa do agente.

---

## 7. Veredito Final

### 7.1 O accelerate pode ser usado no workflow Z.ai?

**SIM**, com adaptações. É a ferramenta mais sofisticada disponível para orquestrar trabalho de engenharia com agentes de IA. Mas precisa ser:

1. **Adaptado** para a realidade Z.ai (sem Linear, sem Claude, sem Django)
2. **Simplificado** para o contexto (26 branches → 8-10, 30+ personas → 6-8)
3. **Integrado** com napkin e superuser como skills complementares

### 7.2 A fase pré-PRD existe no accelerate?

**Existe implicitamente** via Prompt Hardening + Specification PM, mas não é formalizada como fase separada. Recomendo formalizar.

### 7.3 Napkin como guardrail?

**Perfeito.** O napkin é o " auditor de consciência" que complementa o accelerate (orquestrador) e o superuser (infernecedor de skills).

### 7.4 Superuser faz sentido?

**Faz sentido como complemento**, não como substituto do accelerate. O accelerate decide skills obrigatórias por branch. O superuser amplia com skills inferidas. Juntos: cobertura máxima.

### 7.5 Próximos passos sugeridos

1. **Criar fork `accelerate-zai`** — NÃO é adaptação, é reinterpretação para Z.ai
   - Instalar em `skills/accelerate-zai/` (diretório primário, NÃO em examples/)
   - Reduzir de 26 para 8-10 branches relevantes
   - Criar adapter bun-nextjs (substituir python-uv, manage.py)
   - Mapear personas para 5 tipos de subagentes Z.ai
   - Usar worklog.md + docs/ como workspace (substituir .accelerate/)

2. **Formalizar a fase pré-PRD** — template de ideias + user stories

3. **Criar skill superuser/using-superpowers** — inferência automática de skills

4. **Integrar napkin no worklog** — verdicts em cada entrada

5. **Testar o pipeline completo** — do brainstorm ao código com cron

---

> *Este documento é uma análise. As decisões sobre implementação são do humano.*
> *O accelerate decide COMO trabalhar. Você decide O QUE trabalhar.*
> 
> **Correções na v1.1.0:**
> - Corrigido: `examples/` é backup estático, não destino para skills. Skills devem ir em `skills/`.
> - Corrigido: `webDevReview` NÃO é orquestrador. Não existe payload tipo "orchestrator" no Z.ai.
> - Corrigido: Não existe enforcement obrigatório de skills. O agente sempre decide quando usar.
> - Adicionado: Mecanismo de loading de skills explicado em detalhe.
> - Adicionado: docs/ vs .accelerate/ — equivalência e por que usar docs/ no Z.ai.
> - Adicionado: Por que um fork é necessário (não apenas adaptação).
