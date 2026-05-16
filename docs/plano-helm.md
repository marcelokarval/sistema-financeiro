# Plano de Criação: helm — accelerate adaptado para Z.ai

> **Versão:** 2.0.0
> **Data:** 2026-06-23
> **Autor:** Marcelo Karval & Z.ai Code Agent
> **Fonte:** [github.com/marcelokarval/accelerate](https://github.com/marcelokarval/accelerate)
> **Alvo:** Plataforma Z.ai (5 subagentes, 71 skills, 2 payload kinds)
>
> **Changelog:**
> - v1.0.0: Primeiro plano (nome "accelerate")
> - v1.1.0: Renomeado para "helm"
> - **v2.0.0: REESCRITA COMPLETA — abordagem "adaptar, não reescrever"**

---

## 0. Por que este plano é diferente do v1.1.0

### O problema do plano anterior (v1.1.0)

O plano v1.1.0 cometia um erro fundamental de abordagem:

```
PLANO v1.1.0 (ERRADO):
├── LER o accelerate (~40 arquivos, ~21K palavras)
├── DESCONSIDERAR tudo como "material de referência"
├── REESCREVER um SKILL.md compacto de ~1.360 palavras
├── COMPACTAR toda a profundidade em um monolito
├── REFERENCIAR skills existentes como se fosse composição
└── RESULTADO: jogar fora anos de pensamento e design iterativo

Princípio do v1.1.0: "Não é um fork. É uma reinterpretação."
→ Isso significava: DESCARTAR e REFAZER
```

**Consequências:**
- A branch-enforcement-matrix original tem **1.766 palavras** de regras detalhadas por branch (skills obrigatórias, gates, artefatos, evidências, blockers). O v1.1.0 compactava isso em uma tabela de 7 linhas.
- O workflow-catalog original tem **19 workflows nomeados** com pipelines explícitos. O v1.1.0 reduz a uma lista de mapeamentos.
- O executive-matrix original define **11 personas** com skills obrigatórias, triggers e outputs. O v1.1.0 ignora completamente.
- O README original tem **2.596 palavras** de guia operacional com 9 exemplos concretos. O v1.1.0 propõe reescrever tudo.

### A abordagem correta (v2.0.0)

```
PLANO v2.0.0 (CORRETO):
├── CLONAR a estrutura modular do accelerate
├── ADAPTAR cada módulo (trocar apenas o que muda para Z.ai)
│   ├── Claude/Codex → Z.ai
│   ├── *.toml agents → 5 subagentes Task tool
│   ├── Linear/GitHub → docs/ + worklog.md
│   ├── manage.py/makemigrations → bun/prisma
│   ├── .accelerate/ → docs/helm/
│   ├── Playwright → agent-browser
│   └── Chrome DevTools → agent-browser
├── MANTER a profundidade e modularidade
├── CRIAR apenas o que NÃO existe (Z.ai adapters)
└── RESULTADO: accelerate funcionando nativamente no Z.ai

Princípio do v2.0.0: "É o accelerate. Adaptado para Z.ai."
→ Isso significa: PRESERVAR e ADAPTAR
```

**Consequências:**
- Cada módulo mantém sua profundidade original
- A branch-enforcement-matrix é adaptada (não reescrita) — mesmas regras, nova plataforma
- Os 19 workflows são mantidos — apenas trocados os mecanismos de execução
- O README é adaptado — mesmos exemplos, nova plataforma
- O executive-matrix é mantido — personas mapeadas para subagentes Z.ai

---

## 1. Inventário Completo do accelerate

### 1.1 Estrutura do Repositório

O repo accelerate contém **~40 arquivos** em uma arquitetura em camadas:

```
accelerate/                              PALAVRAS
├── SKILL.md (886w)                      ← Constituição (always-on root)
├── AGENTS.md (810w)                     ← Leis do repositório
├── README.md (2.596w)                   ← Guia operacional rico
│
├── core/                                ← SUPERFÍCIE NATIVA (~8.670w)
│   ├── README.md
│   ├── control-plane/
│   │   ├── branch-enforcement-matrix.md (1.766w)  ← 12 branches detalhadas
│   │   └── quick-invocation-map.md
│   ├── delegation/
│   │   └── subagent-model.md (515w)             ← Spawn/non-spawn criteria
│   ├── hardening/
│   │   └── prompt-hardening.md (124w)           ← Gate de hardening
│   ├── issue-topology/
│   │   └── issue-driven-mutation-stack.md (429w)
│   ├── lanes/
│   │   ├── README.md
│   │   └── manager-lane-model.md (104w)         ← 6 manager lanes
│   ├── personas/
│   │   ├── README.md
│   │   ├── model.md (416w)                      ← Modelo de personas
│   │   ├── executive-matrix.md (380w)           ← 11 personas mapeadas
│   │   └── mandatory-skills.md (328w)           ← Skills por persona
│   ├── closure/
│   │   ├── README.md
│   │   └── authority-boundary.md (166w)         ← Root vs bounded authority
│   ├── review/
│   │   ├── product-critical-surfaces.md (801w)  ← Product-critical rules
│   │   └── premium-interface-production.md (770w)
│   ├── risk/
│   │   └── enforcement-surfaces.md (687w)       ← Risk enforcement
│   ├── runtime-packets/
│   │   └── qa-proof-stack.md (540w)             ← 5 camadas de proof
│   └── workflows/
│       ├── catalog.md (931w)                    ← 19 workflows nomeados
│       ├── operational-calibration.md (951w)     ← Calibração proporcional
│       ├── self-evolution.md (633w)             ← Auto-evolução
│       └── maturity-control.md (523w)           ← Controle de maturidade
│
├── docs/architecture/                    ← DOCUMENTOS DE ARQUITETURA (~3.000w)
│   ├── accelerate-classification-matrix.md (931w)
│   ├── accelerate-onboarding-model.md (731w)
│   ├── accelerate-sdd-v1.md (1.331w)
│   ├── accelerate-control-plane.md
│   ├── accelerate-pre-agents-baseline.md
│   └── accelerate-migration-plan.md
│
├── docs/bootstrap/                      ← ORIGEM DO PROJETO
│   ├── context-and-origin.md
│   ├── decisions-and-final-state.md
│   └── prd-initial-platform-foundation.md
│
├── onboarding/                          ← SISTEMA DE ONBOARDING (431w)
│   └── README.md
│
├── planning/                            ← CAMADA DE PLANNING (330w)
│   └── README.md
│
├── adapters/                            ← ADAPTADORES (438w)
│   ├── workflow/README.md
│   └── runtime/README.md
│
└── references/                          ← DOUTRINA HERDADA (~2.000w+)
    ├── README.md
    ├── subagent-model.md (547w)
    ├── runtime-packet-templates.md (326w)
    ├── executive-operating-matrix.md
    ├── qa-proof-stack.md
    ├── issue-stack.md
    ├── runtime-observability-cadence.md
    ├── team-operating-model.md
    └── codex-agents/
        ├── README.md
        ├── active-risk-detection-signals.md
        ├── agent-pooling-model.md
        ├── issue-topology-policy.md
        ├── lane-governance-model.md
        ├── manager-lane-map.md
        ├── risk-enforcement-matrix.md
        ├── risk-enforcement-model.md
        └── root-vs-agent-authority-boundary.md
```

**Total: ~21.000 palavras de conteúdo estruturado**

### 1.2 O que Cada Camada Faz

```
CAMADA 0 — SKILL.md + AGENTS.md
├── SKILL.md: "Lei constitucional" — o que é, o que não é, leis fundamentais
├── AGENTS.md: "Leis do repositório" — regras de commit, migração, estrutura
└── Função: Primeiros arquivos que qualquer sessão deve ler

CAMADA 1 — core/ (superfície nativa)
├── control-plane: Classificação + branch routing + enforcement
├── delegation: Quando e como delegar para subagentes
├── hardening: Gate de prompt hardening (bloqueia execução até clareza)
├── issue-topology: Topologia de issues (single/sibling/parent+child)
├── lanes: 6 lanes de raciocínio gerencial
├── personas: 11 personas com skills obrigatórias e outputs esperados
├── closure: Autoridade do root vs bounded execution
├── review: Product-critical + premium interface rules
├── risk: Enforcement surfaces (detector, signal, owner, blocker)
├── runtime-packets: Proof stack (5 camadas) + templates
└── workflows: 19 workflows nomeados + calibração + evolução

CAMADA 2 — docs/architecture/
├── Classification matrix: Mapeia material upstream para camadas alvo
├── Onboarding model: Como o accelerate entra em um novo repo
├── SDD v1: Design document do próprio accelerate
└── Outros docs de baseline e controle

CAMADA 3 — onboarding/ + planning/
├── Onboarding: Discovery loop para landing em repositórios
└── Planning: Artefatos de planejamento (PRD, SDD, migration, promotion)

CAMADA 4 — adapters/
├── Workflow adapters: Linear, GitHub (issue trackers)
└── Runtime adapters: Python/uv, Node, Chrome DevTools, Playwright
└── NOTA: Estes são CONTRATOS ABSTRATOS — não implementações

CAMADA 5 — references/
├── Doctrine herdada do incubação (Prop4You)
├── Modelos detalhados que complementam core/
└── NOTA: Material de apoio, não superfície nativa
```

---

## 2. Mapeamento: accelerate → helm (Z.ai)

### 2.1 Princípio: Adaptar, Não Reescrever

Cada arquivo do accelerate cai em uma de **4 categorias de destino**:

| Categoria | O que fazer | Exemplos |
|---|---|---|
| **ADAPTAR** | Manter o conteúdo, trocar referências de plataforma | SKILL.md, branch-enforcement-matrix, qa-proof-stack, subagent-model |
| **CRIAR Z.AI ADAPTER** | O conceito existe, mas precisa de implementação Z.ai nova | Runtime adapter (bun/prisma), Workflow adapter (docs/), Onboarding adapter |
| **MANTER COMO ESTÁ** | O conteúdo é plataforma-agnóstico e funciona no Z.ai | Operational calibration, Self-evolution, Maturity control, Classification contract |
| **MARCAR COMO N/A** | O conceito não se aplica ao Z.ai | Agent promotion (*.toml), Linear/GitHub adapter, Playwright adapter |

### 2.2 Mapeamento Arquivo por Arquivo

#### ARQUIVOS RAIZ (camada 0)

| Arquivo accelerate | Ação | Destino helm | Tipo de mudança |
|---|---|---|---|
| `SKILL.md` (886w) | **ADAPTAR** | `skills/helm/SKILL.md` | Trocar: "Claude/Codex" → "Z.ai", "always-on" → "description forte", adicionar seção Z.ai constraints, adicionar camada de enforcement Z.ai |
| `AGENTS.md` (810w) | **ADAPTAR** | `skills/helm/AGENTS.md` | Trocar: "Claude" → "Z.ai", "*.toml" → "5 subagentes", ".claude/" → "skills/", "commit discipline" → adaptado para Z.ai |
| `README.md` (2.596w) | **ADAPTAR** | `skills/helm/README.md` | Trocar: todos os exemplos de "Claude + Linear + Django" para "Z.ai + docs/ + bun/Next.js", manter os 9 exemplos adaptados |

#### CORE/ (camada 1)

| Arquivo accelerate | Palavras | Ação | Destino helm | Tipo de mudança |
|---|---|---|---|---|
| `control-plane/branch-enforcement-matrix.md` | 1.766 | **ADAPTAR** | `core/control-plane/branch-enforcement-matrix.md` | Trocar skills obrigatórias de Claude para skills Z.ai equivalentes, trocar "manage.py" → "bun run lint", trocar "Playwright" → "agent-browser" |
| `control-plane/quick-invocation-map.md` | ~200 | **ADAPTAR** | `core/control-plane/quick-invocation-map.md` | Trocar invocações de Claude para Z.ai |
| `delegation/subagent-model.md` | 515 | **ADAPTAR** | `core/delegation/subagent-model.md` | Trocar "Safe Role Catalog" (implementation worker, planner sidecar, etc.) para mapeamento dos 5 subagentes Z.ai. Trocar spawn criteria para Task tool patterns |
| `hardening/prompt-hardening.md` | 124 | **REFERENCIAR** | `core/hardening/README.md` | Criar README curto que referencia `skills/prompt-hardening/` (já existe no Z.ai) |
| `issue-topology/issue-driven-mutation-stack.md` | 429 | **ADAPTAR** | `core/issue-topology/issue-driven-mutation-stack.md` | Trocar "Linear/GitHub issue" → "docs/TASKS.md entry", trocar "AI Review Report" → "worklog.md Stage Summary" |
| `lanes/manager-lane-model.md` | 104 | **MANTER** | `core/lanes/manager-lane-model.md` | Sem mudanças — as 6 lanes são conceito puro (executive routing, technical, lifecycle, design-contract, proof, trust) |
| `lanes/README.md` | ~200 | **MANTER** | `core/lanes/README.md` | Sem mudanças |
| `personas/model.md` | 416 | **ADAPTAR** | `core/personas/model.md` | Trocar "persona activation" → "skill activation via description", trocar "agent role" → "subagent type" |
| `personas/executive-matrix.md` | 380 | **ADAPTAR** | `core/personas/executive-matrix.md` | Trocar skills obrigatórias por equivalentes Z.ai, trocar "active workflow adapter" → "docs/TASKS.md + worklog" |
| `personas/mandatory-skills.md` | 328 | **ADAPTAR** | `core/personas/mandatory-skills.md` | Trocar todas as skills Claude por skills Z.ai equivalentes |
| `closure/authority-boundary.md` | 166 | **ADAPTAR** | `core/closure/authority-boundary.md` | Trocar "move issue to Done/In Review" → "update docs/TASKS.md status", trocar "bounded execution unit" → "Task tool subagent" |
| `review/product-critical-surfaces.md` | 801 | **ADAPTAR** | `core/review/product-critical-surfaces.md` | Trocar skills obrigatórias por Z.ai equivalentes, trocar proof methods (Chrome DevTools → agent-browser, manage.py → bun lint) |
| `review/premium-interface-production.md` | 770 | **ADAPTAR** | `core/review/premium-interface-production.md` | Trocar "Stitch/Figma artifact" → "ascii-wireframe output", trocar proof methods |
| `risk/enforcement-surfaces.md` | 687 | **ADAPTAR** | `core/risk/enforcement-surfaces.md` | Trocar exemplos de "Django query" → "Prisma query", trocar "Linear signal" → "docs/TASKS.md signal" |
| `runtime-packets/qa-proof-stack.md` | 540 | **ADAPTAR** | `core/runtime-packets/qa-proof-stack.md` | Trocar "Playwright persistence" → "agent-browser validation", trocar "manage.py check" → "bun run lint", manter a estrutura de 5 camadas |
| `workflows/catalog.md` | 931 | **ADAPTAR** | `core/workflows/catalog.md` | Trocar mecanismos de cada workflow: "active workflow adapter" → "docs/TASKS.md", "Chrome DevTools" → "agent-browser", "Playwright" → "N/A", etc. |
| `workflows/operational-calibration.md` | 951 | **MANTER** | `core/workflows/operational-calibration.md` | Conceito é plataforma-agnóstico. Trocar apenas exemplos de toolchain |
| `workflows/self-evolution.md` | 633 | **ADAPTAR** | `core/workflows/self-evolution.md` | Trocar "auto-promote agent" → "human decides to create/update skill", trocar "evidence accumulation" → "worklog.md patterns" |
| `workflows/maturity-control.md` | 523 | **MANTER** | `core/workflows/maturity-control.md` | Conceito é plataforma-agnóstico |

#### DOCS/ARCHITECTURE/ (camada 2)

| Arquivo accelerate | Palavras | Ação | Destino helm | Tipo de mudança |
|---|---|---|---|---|
| `classification-matrix.md` | 931 | **ADAPTAR** | `docs/architecture/classification-matrix.md` | Atualizar classification legend para incluir "Z.ai skill" como camada. Mapear todo material upstream para nova estrutura helm |
| `onboarding-model.md` | 731 | **ADAPTAR** | `docs/architecture/onboarding-model.md` | Trocar ".accelerate/ workspace" → "docs/helm/", trocar "Claude" → "Z.ai" |
| `sdd-v1.md` | 1.331 | **ADAPTAR** | `docs/architecture/sdd-v1.md` | Atualizar para refletir que helm é o produto (não accelerate), trocar stack defaults |
| `control-plane.md` | ~800 | **ADAPTAR** | `docs/architecture/control-plane.md` | Trocar referências de plataforma |
| `pre-agents-baseline.md` | ~500 | **MANTER** | `docs/architecture/pre-agents-baseline.md` | O Z.ai ESTÁ em fase pre-agents — este doc é diretamente aplicável |
| `migration-plan.md` | ~400 | **N/A** | Não migrar | Plano de migração do incubação — já completo |

#### DOCS/BOOTSTRAP/ (camada 2)

| Arquivo accelerate | Ação | Destino helm | Tipo de mudança |
|---|---|---|---|
| `context-and-origin.md` | **MANTER** | `docs/bootstrap/context-and-origin.md` | Histórico de origem — sem mudanças |
| `decisions-and-final-state.md` | **MANTER** | `docs/bootstrap/decisions-and-final-state.md` | Documento histórico — sem mudanças |
| `prd-initial-platform-foundation.md` | **MANTER** | `docs/bootstrap/prd-initial-platform-foundation.md` | PRD original — preservar como referência |

#### ONBOARDING/ (camada 3)

| Arquivo accelerate | Palavras | Ação | Destino helm | Tipo de mudança |
|---|---|---|---|---|
| `README.md` | 431 | **ADAPTAR** | `onboarding/README.md` | Trocar ".accelerate/ workspace" → "docs/helm/", trocar "Claude" → "Z.ai", criar Z.ai-specific onboarding flow |

#### PLANNING/ (camada 3)

| Arquivo accelerate | Palavras | Ação | Destino helm | Tipo de mudança |
|---|---|---|---|---|
| `README.md` | 330 | **MANTER** | `planning/README.md` | Conceito é plataforma-agnóstico |

#### ADAPTERS/ (camada 4) — NOVO CONTEÚDO NECESSÁRIO

| Arquivo accelerate | Ação | Destino helm | Tipo de mudança |
|---|---|---|---|
| `workflow/README.md` | **CRIAR Z.AI ADAPTER** | `adapters/workflow/zai-adapter.md` | Criar adapter: Linear/GitHub → docs/TASKS.md + worklog.md. Definir contrato de issue tracking baseado em arquivos markdown |
| `runtime/README.md` | **CRIAR Z.AI ADAPTER** | `adapters/runtime/zai-adapter.md` | Criar adapter: Python/uv/Node/Chrome → bun/prisma/agent-browser/next-themes. Definir comandos de proof (bun run lint, agent-browser, etc.) |
| **NOVO** | **CRIAR** | `adapters/enforcement/zai-enforcement.md` | Criar enforcement adapter: como o Z.ai enforce (description forte, payload.message, worklog references). Equivalente ao "always-on" do Claude |

#### REFERENCES/ (camada 5)

| Arquivo accelerate | Ação | Destino helm | Tipo de mudança |
|---|---|---|---|
| `README.md` | **MANTER** | `references/README.md` | Preservar doutrina herdada |
| `subagent-model.md` (547w) | **ADAPTAR** | `references/subagent-model.md` | Adicionar nota: "Para Z.ai, veja core/delegation/subagent-model.md para mapeamento atualizado" |
| `runtime-packet-templates.md` (326w) | **MANTER** | `references/runtime-packet-templates.md` | Templates são plataforma-agnósticos |
| `executive-operating-matrix.md` | **MANTER** | `references/executive-operating-matrix.md` | Conceito é plataforma-agnóstico |
| `qa-proof-stack.md` | **REFERENCIAR** | `references/qa-proof-stack.md` | Adicionar nota: "Versão adaptada em core/runtime-packets/qa-proof-stack.md" |
| `codex-agents/*` (9 arquivos) | **MANTER** | `references/codex-agents/*` | Preservar como doutrina herdada, marcar como "original Codex model" |

### 2.3 Resumo Quantitativo

| Ação | Quantidade | Palavras originais | Estimativa de trabalho |
|---|---|---|---|
| **ADAPTAR** | ~25 arquivos | ~15.000w | Trocar referências de plataforma, manter estrutura |
| **MANTER** | ~10 arquivos | ~4.000w | Copiar como está, sem mudanças |
| **CRIAR Z.AI ADAPTER** | 3 novos arquivos | ~2.000w (estimativa) | Conteúdo novo para preencher gaps do Z.ai |
| **REFERENCIAR** | 3 arquivos | ~1.000w | Criar ponte para skills Z.ai existentes |
| **N/A** | ~3 arquivos | ~2.000w | Não migrar (específico de outra plataforma) |
| **TOTAL** | ~40 arquivos | ~21.000w | ~17.000w mantidas + ~2.000w novas |

---

## 3. O que Especificamente Muda em Cada Adaptação

### 3.1 Substituições Sistemáticas (todas as ADAPTAÇÕES)

Estas substituições se aplicam a **todos** os arquivos marcados como ADAPTAR:

| No accelerate (Claude/Codex) | No helm (Z.ai) | Contexto |
|---|---|---|
| `Claude` | `Z.ai agent` | Plataforma |
| `Codex` | `Z.ai` | Plataforma |
| `always-on root skill` | `skill com description forte` | Mecanismo de enforcement |
| `*.toml agents` | `5 subagentes via Task tool` | Modelo de delegação |
| `promoted agent` | `subagent type selection` | Hierarquia |
| `Implementation Worker` | `full-stack-developer subagent` | Papel |
| `Governance Auditor` | `Plan subagent` ou master review | Papel |
| `Specification PM` | `prompt-hardening skill` | Persona |
| `Product Planner` | `Plan subagent` | Persona |
| `Linear` | `docs/TASKS.md` | Workflow backend |
| `GitHub Issues` | `docs/TASKS.md` | Workflow backend |
| `active workflow adapter` | `docs/TASKS.md + worklog.md` | Workflow adapter |
| `issue #` | `task ID in docs/TASKS.md` | Referência de issue |
| `move issue to Done` | `update docs/TASKS.md status` | Closure |
| `move issue to In Review` | `subagent returns evidence to master` | Handoff |
| `.accelerate/` workspace | `docs/helm/` | Workspace local |
| `workspace.toml` | `docs/helm/config.md` | Config |
| `.claude/napkin.md` | `worklog.md` | Memória de sessão |
| `Chrome DevTools` | `agent-browser` | Browser proof |
| `Playwright` | `N/A (use agent-browser)` | Proof persistente |
| `manage.py check` | `bun run lint` | Backend proof |
| `makemigrations` | `bun run db:push` | DB proof |
| `type-check (npm)` | `bun run lint` (inclui TS) | Type check |
| `EXPLAIN (PostgreSQL)` | `N/A (SQLite)` | Query proof |
| `AI Review Report (Linear)` | `worklog.md Stage Summary` | Review report |
| `Django ORM` | `Prisma ORM` | Database |
| `Python/uv` | `bun/Next.js` | Runtime |
| `Stitch/Figma artifact` | `ascii-wireframe output` | Visual artifact |
| `AGENTS.md` | `skills/helm/AGENTS.md` | Repo laws |
| `SKILL.md` | `skills/helm/SKILL.md` | Constituição |
| `references/` | `skills/helm/references/` | Doutrina herdada |
| `personas/model.md` | Adaptado: persona = skill activation | Ativação |
| `persona activation` | `skill invocation via Skill tool` | Mecanismo |

### 3.2 Branch Enforcement Matrix — Exemplo de Adaptação

**Original (Claude):**
```
| Branch | Mandatory Skills | Mandatory Gates | Expected Artifacts |
|---|---|---|---|
| product-critical user surface | product-runtime-review, ascii-wireframe, server-prop-governance, front-react-shadcn, tailwind-design-system | Backend Product Contract Protocol, Wireframe Before UI | backend product packet, wireframe, truth model, action model |
```

**Adaptado (Z.ai):**
```
| Branch | Mandatory Skills | Mandatory Gates | Expected Artifacts |
|---|---|---|---|
| product-critical user surface | product-runtime-review, ascii-wireframe, front-react-shadcn, nextjs-best-practices | Agent-browser visual QA, Wireframe Before UI (via ascii-wireframe) | backend product packet, wireframe (ascii), agent-browser screenshot, worklog entry |
```

**Note:** A estrutura da tabela é idêntica. Apenas os nomes de skills e mecanismos mudam.

### 3.3 Subagent Model — Exemplo de Adaptação

**Original (Claude/Codex):**
```
Safe Role Catalog:
- implementation worker
- decomposition or planner sidecar
- governance auditor
- runtime or browser reviewer
- verification sidecar

Persona-To-Subagent Mapping:
- master-only: Master Integrator, Closure/Forensic Reviewer, Delivery PM
- delegate-possible: Implementation Designer, Runtime/Product Reviewer, Governance Auditor
- master-preferred: Specification PM, Product Planner
```

**Adaptado (Z.ai):**
```
Safe Subagent Catalog (Z.ai Task Tool):
- full-stack-developer → equivalent to implementation worker + planner sidecar
- Plan → equivalent to governance auditor + decomposition
- frontend-styling-expert → equivalent to runtime/product reviewer
- Explore → equivalent to verification sidecar
- general-purpose → equivalent to research + multi-step exploration

Persona-To-Subagent Mapping (Z.ai):
- master-only: Master (classification, topology, integration, closure)
- delegate-possible: full-stack-developer (bounded implementation), Plan (architecture review)
- master-preferred: prompt-hardening skill (Specification PM), Plan subagent (Product Planner)
```

**Note:** O conceito é mantido — apenas o vocabulário muda.

---

## 4. Arquivos Novos (Z.ai-specific)

### 4.1 `adapters/enforcement/zai-enforcement.md`

Este arquivo NÃO existe no accelerate original. Ele documenta como o Z.ai enforcement funciona:

```markdown
# Z.ai Enforcement Adapter

## Problem
O accelerate assume "always-on root skill" — o SKILL.md é carregado em toda sessão.
O Z.ai NÃO tem esse mecanismo — skills são carregadas sob demanda via Skill tool.

## Solution: 3-Layer Enforcement

### Layer 1 — Skill Description (passive)
A description no frontmatter do SKILL.md é injetada no <available_skills>.
Se a description for forte o suficiente, o agente INFERE que helm é relevante.
→ Funciona quando: a request menciona engenharia, implementação, código, feature, bug

### Layer 2 — payload.message (active for crons)
Ao criar crons (agentTurn ou webDevReview), incluir instruções explícitas:
"Leia skills/helm/SKILL.md e siga TODAS as instruções antes de qualquer trabalho."
→ Funciona quando: crons são a forma de trabalho contínuo

### Layer 3 — worklog.md Reference (active between sessions)
Mencionar helm no worklog como instrução permanente:
"Projetos deste repo devem usar helm. Veja skills/helm/"
→ Funciona quando: o agente lê o worklog no início da sessão

## What This Means
- Enforcement no Z.ai é SOFT, não hard
- O agente PODE ignorar — não há gate técnico
- Mitigação: description forte + payload.message explícito + worklog reference
- O humano é o enforcement final
```

### 4.2 `adapters/workflow/zai-adapter.md`

Substitui o Linear/GitHub workflow adapter por um sistema baseado em arquivos:

```markdown
# Z.ai Workflow Adapter

## Contract
No Z.ai, o equivalente a um issue tracker é o sistema docs/ + worklog.md.

### docs/TASKS.md (Issue Tracker)
```
## TASKS
| ID | Title | Status | Branch | Assigned | Priority |
|----|-------|--------|--------|----------|----------|
| 001 | Criar dashboard | done | product-critical | full-stack-dev | P0 |
| 002 | Adicionar export CSV | in-progress | trivial | master | P1 |
```

### worklog.md (Activity Log)
```
---
Task ID: 002
Agent: full-stack-developer
...
Stage Summary:
- Completed CSV export endpoint
- Lint: zero errors
- Browser QA: passed
```

### docs/TASKS.md Status Values
- `pending` — Not started
- `in-progress` — Currently being worked on
- `in-review` — Subagent returned evidence, awaiting master review
- `blocked` — Blocked by dependency or blocker
- `done` — Master reviewed, forensic closure passed
```

### 4.3 `adapters/runtime/zai-adapter.md`

Define os comandos e ferramentas do runtime Z.ai:

```markdown
# Z.ai Runtime Adapter

## Toolchain
| Capability | Command/Tool | Notes |
|---|---|---|
| Lint + TS check | `bun run lint` | Inclui ESLint + TypeScript checking |
| Database sync | `bun run db:push` | Prisma push to SQLite |
| Database seed | `npx tsx prisma/seed.ts` | Seed data |
| Dev server | `bun run dev` | Auto-restart on change |
| Browser QA | `agent-browser` | Headless browser automation |
| Visual QA | `agent-browser --snapshot` | Page screenshot |
| Web search | `z-ai function -n web_search` | SDK CLI |
| Page reading | `z-ai function -n page_reader` | SDK CLI |

## Proof Methods
| Proof Layer | Z.ai Method |
|---|---|
| Implementation Proof | `bun run lint` (zero errors) |
| Backend QA | `curl` API endpoints, verify 200 responses |
| Frontend QA | `agent-browser` for visual validation |
| Browser Truth | `agent-browser --snapshot` for screenshot evidence |
| Persistent Regression | Not available (use agent-browser as substitute) |
| Forensic Closure | `forensic-review` skill invocation |

## NOT Available in Z.ai
- Playwright (persistent E2E)
- EXPLAIN (PostgreSQL query analysis)
- manage.py (Django admin)
- Chrome DevTools (manual inspection)
```

---

## 5. Estrutura Final do helm

```
skills/helm/                              ← REPO HELM (Z.ai adaptation of accelerate)
│
├── SKILL.md                              ← ADAPTADO do accelerate SKILL.md
├── AGENTS.md                             ← ADAPTADO do accelerate AGENTS.md
├── README.md                             ← ADAPTADO do accelerate README.md
│
├── core/                                 ← ADAPTADO do accelerate core/
│   ├── README.md
│   ├── control-plane/
│   │   ├── branch-enforcement-matrix.md  ← ADAPTADO (1.766w → ~1.800w)
│   │   └── quick-invocation-map.md       ← ADAPTADO
│   ├── delegation/
│   │   └── subagent-model.md             ← ADAPTADO (515w → ~600w)
│   ├── hardening/
│   │   └── README.md                     ← NOVO (referencia prompt-hardening skill)
│   ├── issue-topology/
│   │   └── issue-driven-mutation-stack.md ← ADAPTADO (429w → ~500w)
│   ├── lanes/
│   │   ├── README.md                     ← MANTIDO
│   │   └── manager-lane-model.md         ← MANTIDO (104w)
│   ├── personas/
│   │   ├── README.md                     ← MANTIDO
│   │   ├── model.md                      ← ADAPTADO (416w → ~500w)
│   │   ├── executive-matrix.md           ← ADAPTADO (380w → ~450w)
│   │   └── mandatory-skills.md           ← ADAPTADO (328w → ~400w)
│   ├── closure/
│   │   ├── README.md                     ← MANTIDO
│   │   └── authority-boundary.md         ← ADAPTADO (166w → ~200w)
│   ├── review/
│   │   ├── product-critical-surfaces.md  ← ADAPTADO (801w → ~900w)
│   │   └── premium-interface-production.md ← ADAPTADO (770w → ~850w)
│   ├── risk/
│   │   └── enforcement-surfaces.md       ← ADAPTADO (687w → ~750w)
│   ├── runtime-packets/
│   │   └── qa-proof-stack.md             ← ADAPTADO (540w → ~600w)
│   └── workflows/
│       ├── catalog.md                    ← ADAPTADO (931w → ~1.000w)
│       ├── operational-calibration.md    ← MANTIDO (951w)
│       ├── self-evolution.md             ← ADAPTADO (633w → ~700w)
│       └── maturity-control.md           ← MANTIDO (523w)
│
├── docs/
│   ├── architecture/
│   │   ├── classification-matrix.md      ← ADAPTADO (931w → ~1.000w)
│   │   ├── onboarding-model.md           ← ADAPTADO (731w → ~800w)
│   │   ├── sdd-v1.md                     ← ADAPTADO (1.331w → ~1.400w)
│   │   ├── control-plane.md              ← ADAPTADO
│   │   └── pre-agents-baseline.md        ← MANTIDO
│   └── bootstrap/
│       ├── context-and-origin.md         ← MANTIDO
│       ├── decisions-and-final-state.md  ← MANTIDO
│       └── prd-initial-platform-foundation.md ← MANTIDO
│
├── onboarding/
│   └── README.md                         ← ADAPTADO (431w → ~500w)
│
├── planning/
│   └── README.md                         ← MANTIDO (330w)
│
├── adapters/                             ← NOVOS (Z.ai-specific)
│   ├── enforcement/
│   │   └── zai-enforcement.md            ← NOVO (~500w)
│   ├── workflow/
│   │   ├── README.md                     ← MANTIDO (contrato abstrato)
│   │   └── zai-adapter.md                ← NOVO (~400w)
│   └── runtime/
│       ├── README.md                     ← MANTIDO (contrato abstrato)
│       └── zai-adapter.md                ← NOVO (~350w)
│
└── references/                           ← MANTIDO (doutrina herdada)
    ├── README.md
    ├── subagent-model.md                 ← ADAPTADO (nota Z.ai)
    ├── runtime-packet-templates.md       ← MANTIDO (326w)
    ├── executive-operating-matrix.md     ← MANTIDO
    ├── qa-proof-stack.md                 ← REFERENCIAR (nota para core/)
    └── codex-agents/                     ← MANTIDO (doutrina original)
        ├── README.md
        ├── active-risk-detection-signals.md
        ├── agent-pooling-model.md
        ├── issue-topology-policy.md
        ├── lane-governance-model.md
        ├── manager-lane-map.md
        ├── risk-enforcement-matrix.md
        ├── risk-enforcement-model.md
        └── root-vs-agent-authority-boundary.md
```

### Contagem de palavras estimada

| Categoria | Palavras |
|---|---|
| Arquivos ADAPTADOS | ~15.000 (leves adições às mudanças) |
| Arquivos MANTIDOS | ~4.000 (sem mudanças) |
| Arquivos NOVOS (Z.ai adapters) | ~1.250 |
| **TOTAL** | **~20.250 palavras** |

**Comparação com v1.1.0:**
- v1.1.0 propunha: 1 SKILL.md de ~1.360 palavras + docs complementares
- v2.0.0 propõe: ~40 arquivos com ~20.250 palavras (praticamente o mesmo volume do original)

---

## 6. Plano de Implementação (Fases)

### Fase 0 — Clonar e Estruturar
**Objetivo:** Copiar a estrutura do accelerate para `skills/helm/`

| # | Ação | Artefato |
|---|---|---|
| 0.1 | Criar diretório `skills/helm/` | filesystem |
| 0.2 | Clonar estrutura de diretórios do accelerate | `skills/helm/{core,docs,onboarding,planning,adapters,references}` |
| 0.3 | Copiar todos os arquivos MANTIDOS como estão | ~10 arquivos |
| 0.4 | Backup do plano v1.1.0 | `docs/plano-helm-v1.1.0.bak` |

### Fase 1 — Adaptar Raiz (SKILL.md + AGENTS.md + README.md)
**Objetivo:** Adaptar os 3 arquivos raiz que definem o helm

| # | Ação | Artefato | Estimativa |
|---|---|---|---|
| 1.1 | Copiar SKILL.md original | `skills/helm/SKILL.md` | 5min |
| 1.2 | Aplicar substituições sistemáticas | `skills/helm/SKILL.md` | 30min |
| 1.3 | Adicionar seção Z.ai Constraints | `skills/helm/SKILL.md` | 20min |
| 1.4 | Adicionar seção Enforcement (3 layers) | `skills/helm/SKILL.md` | 15min |
| 1.5 | Copiar AGENTS.md original | `skills/helm/AGENTS.md` | 5min |
| 1.6 | Aplicar substituições sistemáticas | `skills/helm/AGENTS.md` | 20min |
| 1.7 | Copiar README.md original | `skills/helm/README.md` | 5min |
| 1.8 | Adaptar os 9 exemplos do README | `skills/helm/README.md` | 1h |
| 1.9 | Adicionar seção Z.ai Examples (se necessário) | `skills/helm/README.md` | 30min |

### Fase 2 — Adaptar core/ (módulo por módulo)
**Objetivo:** Adaptar todos os módulos em core/

| # | Ação | Artefato | Estimativa |
|---|---|---|---|
| 2.1 | Adaptar branch-enforcement-matrix | `core/control-plane/` | 1h |
| 2.2 | Adaptar subagent-model | `core/delegation/` | 30min |
| 2.3 | Criar hardening README (referência) | `core/hardening/` | 15min |
| 2.4 | Adaptar issue-driven-mutation-stack | `core/issue-topology/` | 30min |
| 2.5 | Copiar lanes (manter) | `core/lanes/` | 5min |
| 2.6 | Adaptar personas (model + matrix + mandatory-skills) | `core/personas/` | 1h |
| 2.7 | Adaptar closure authority-boundary | `core/closure/` | 15min |
| 2.8 | Adaptar review (product-critical + premium-interface) | `core/review/` | 1h |
| 2.9 | Adaptar risk enforcement-surfaces | `core/risk/` | 30min |
| 2.10 | Adaptar qa-proof-stack | `core/runtime-packets/` | 30min |
| 2.11 | Adaptar workflow catalog | `core/workflows/catalog.md` | 45min |
| 2.12 | Adaptar self-evolution | `core/workflows/` | 20min |
| 2.13 | Copiar calibration + maturity (manter) | `core/workflows/` | 5min |

### Fase 3 — Adaptar docs/ e criar adapters/
**Objetivo:** Documentação de arquitetura + Z.ai adapters

| # | Ação | Artefato | Estimativa |
|---|---|---|---|
| 3.1 | Adaptar classification-matrix | `docs/architecture/` | 30min |
| 3.2 | Adaptar onboarding-model | `docs/architecture/` | 30min |
| 3.3 | Adaptar sdd-v1 | `docs/architecture/` | 45min |
| 3.4 | Copiar bootstrap docs (manter) | `docs/bootstrap/` | 5min |
| 3.5 | Adaptar onboarding README | `onboarding/` | 15min |
| 3.6 | **CRIAR** Z.ai enforcement adapter | `adapters/enforcement/` | 30min |
| 3.7 | **CRIAR** Z.ai workflow adapter | `adapters/workflow/` | 30min |
| 3.8 | **CRIAR** Z.ai runtime adapter | `adapters/runtime/` | 30min |
| 3.9 | Copiar references (manter + notas) | `references/` | 10min |

### Fase 4 — Validação
**Objetivo:** Verificar que funciona no runtime Z.ai

| # | Ação | Artefato |
|---|---|---|
| 4.1 | Teste: classificar uma request trivial usando helm | Conversa Z.ai |
| 4.2 | Teste: classificar uma request non-trivial | Conversa Z.ai |
| 4.3 | Teste: verificar inferência via description | Conversa Z.ai |
| 4.4 | Teste: criar cron com helm no payload.message | Cron Z.ai |
| 4.5 | Teste: subagent recebe instruções de persona via helm | Task tool |
| 4.6 | Ajustar descrição do SKILL.md se inferência fraca | `skills/helm/SKILL.md` |

### Fase 5 — Publicação
**Objetivo:** Disponibilizar no GitHub

| # | Ação | Artefato |
|---|---|---|
| 5.1 | Commit final | git |
| 5.2 | Push para branch `feat/helm` | GitHub |
| 5.3 | Criar PR | GitHub PR |

---

## 7. Comparação: v1.1.0 vs v2.0.0

| Critério | v1.1.0 (reinterpretation) | v2.0.0 (adaptation) |
|---|---|---|
| **Abordagem** | Descartar e recriar | Preservar e adaptar |
| **Volume de conteúdo** | ~1.360w (SKILL.md) + docs | ~20.250w (~40 arquivos) |
| **Branch enforcement** | Tabela compacta de 7 linhas | Matriz completa adaptada (1.800w) |
| **Workflow catalog** | Lista de mapeamentos | 19 workflows nomeados com pipelines |
| **Persona model** | Ignorado | Executive matrix adaptada (11 personas) |
| **Subagent model** | Tabela simples de 5 linhas | Modelo completo com spawn criteria |
| **README** | Reescrito do zero | Adaptado com 9 exemplos convertidos |
| **Proof stack** | Enumeração de 5 itens | Documento completo (600w) com detalhes |
| **Onboarding** | "Via SKILL.md + docs/" | Sistema de onboarding adaptado |
| **Self-evolution** | Protocolo manual curto | Documento completo (700w) adaptado |
| **Maturity control** | "Documentar" | Documento completo mantido (523w) |
| **Calibration** | Tabela de 4 linhas | Documento completo mantido (951w) |
| **Risk enforcement** | "Embed compacto" | Documento completo adaptado (750w) |
| **Z.ai adapters** | Nenhum (embed tudo no SKILL.md) | 3 adapters dedicados (enforcement, workflow, runtime) |
| **Provenance** | "Inspired by accelerate" | "accelerate adaptado para Z.ai" |
| **Evolução futura** | Difícil (monolito compacto) | Fácil (módulos independentes) |
| **Manutenção** | Mudança toca SKILL.md inteiro | Mudança toca apenas módulo afetado |

---

## 8. Decisões Arquiteturais

| # | Decisão | v1.1.0 escolheu | v2.0.0 escolhe | Por quê |
|---|---|---|---|---|
| D1 | Abordagem | Reinterpretação (do zero) | Adaptação (preservar) | O accelerate já foi pensado, iterado e validado. Reescrever perde essa profundidade |
| D2 | Volume | Compacto (~1.500w) | Completo (~20.000w) | O SKILL.md é carregado inteiro quando invocado — não há "context budget limit" |
| D3 | Estrutura | 1 SKILL.md monolito | 40+ arquivos modulares | Modularidade permite manutenção seletiva e evolução independente |
| D4 | Branch matrix | Tabela compacta | Matriz completa adaptada | Cada branch tem skills, gates, artefatos, evidências, blockers — não dá para compactar sem perder |
| D5 | Personas | Ignorado | Mantido e adaptado | As personas guiam qual skill/subagent usar em cada fase — são essenciais |
| D6 | Workflows | Mapeamentos | 19 workflows nomeados | Os workflows são execution lanes — colapsar em mapeamentos perde a riqueza |
| D7 | Adapters | Embed no SKILL.md | Arquivos dedicados | Os adapters de enforcement, workflow e runtime são Z.ai-specific e merecem documento próprio |

---

## 9. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Context budget ao carregar helm completa | Baixa | Médio | O agente carrega SKILL.md por default (frontmatter). Arquivos em core/ são abertos sob demanda |
| Agente ignora submódulos de core/ | Média | Alto | SKILL.md referencia cada módulo no "Minimum Truth Stack" — o agente sabe quando abrir qual |
| Substituições inconsistentes | Média | Médio | Fase de validação com grep global para termos "Claude", "Codex", "Linear", "*.toml" |
| Skills existentes do Z.ai entram em conflito | Baixa | Baixo | Helm ORQUESTRA as skills — não as substitui. Referência cruzada clara |
| Diferença de volume vs v1.1.0 confunde usuário | Média | Baixo | docs/helm/guide.md explica a diferença e por quê a abordagem mudou |

---

## 10. Cronograma

```
SEMANA 1:
  ├── Fase 0: Clonar e estruturar (2h)
  ├── Fase 1: Adaptar raiz SKILL+AGENTS+README (3h)
  └── Fase 2: Adaptar core/ — parte 1 (4h)

SEMANA 2:
  ├── Fase 2: Adaptar core/ — parte 2 (4h)
  ├── Fase 3: Adaptar docs/ + criar adapters (3h)
  └── Fase 4: Validação (2h)

SEMANA 3:
  └── Fase 5: Publicação (1h)
      ├── Commit + Push
      └── PR com descrição

TOTAL ESTIMADO: ~19 horas de trabalho humano + agente
```

---

## 11. Provenance

```
helm é:
├── O accelerate (github.com/marcelokarval/accelerate)
├── Adaptado para a plataforma Z.ai
├── Com a mesma estrutura modular
├── Com os mesmos conceitos e profundidade
├── Com Z.ai adapters onde o accelerate tinha Claude/Codex adapters
└── Com enforcement adaptado para as limitações do Z.ai

helm NÃO é:
├── Um fork (não há git history compartilhado)
├── Uma reimplementação (não foi reescrito do zero)
├── Um subset (não foi compactado ou reduzido)
├── Um monolito (não foi colapsado em um arquivo)
└── Uma réplica (mudanças foram feitas onde necessário)
```

---

> *Este plano é um documento vivo. Atualize conforme a adaptação revelar novos insights.*
> *Próxima revisão: após conclusão da Fase 1.*
> *Nome: **helm** — o leme que governa a direção do trabalho.*
> *Origem: accelerate — adaptado, não reescrito.*
