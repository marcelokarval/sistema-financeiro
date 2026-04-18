# Skills Repository — Projeto Financeiro v3.0.0

> Todas as 36 skills copiadas integralmente com seus conteúdos, scripts e pastas internas.
> Origem: `/tmp/my-project/skills/` → Destino: `examples/skills/`

---

## Resumo

| Métrica | Valor |
|---------|-------|
| **Total de Skills** | 36 |
| **Total de Arquivos** | 377 |
| **Tamanho Total** | 17 MB |

---

## Grupo 1 — AI/ML Core (9 skills)

### 1. ASR (Speech-to-Text)
- **Pasta:** `ASR/`
- **Arquivos:** 3 (SKILL.md, LICENSE.txt, scripts/asr.ts)
- **Funcionalidade:** Reconhecimento automático de fala (ASR). Converte áudio em texto usando o z-ai-web-dev-sdk. Suporta arquivos de áudio codificados em base64 e retorna transcrições textuais precisas. Pode ser usado para entrada de voz no registro de transações financeiras.

### 2. LLM (Chat/Conversação)
- **Pasta:** `LLM/`
- **Arquivos:** 3 (SKILL.md, LICENSE.txt, scripts/chat.ts)
- **Funcionalidade:** Modelo de linguagem grande (LLM) para geração de texto e chatbot. Suporta conversas multi-turno, system prompts e gerenciamento de contexto. Já utilizado no componente AI Advisor (`ai-advisor.tsx`) do projeto para fornecer conselhos financeiros inteligentes.

### 3. TTS (Text-to-Speech)
- **Pasta:** `TTS/`
- **Arquivos:** 3 (SKILL.md, LICENSE.txt, tts.ts)
- **Funcionalidade:** Síntese de voz a partir de texto. Converte texto em fala natural usando o z-ai-web-dev-sdk. Suporta múltiplas vozes, velocidade ajustável e vários formatos de áudio. Pode ser usado para ler resumos financeiros e alertas em voz alta.

### 4. VLM (Visão/Image Understanding)
- **Pasta:** `VLM/`
- **Arquivos:** 3 (SKILL.md, LICENSE.txt, scripts/vlm.ts)
- **Funcionalidade:** Modelo de linguagem visual para análise de imagens. Compreende conteúdo visual combinando visão com IA conversacional. Suporta URLs de imagens e imagens codificadas em base64. Pode ser usado para escanear e interpretar recibos, notas fiscais e documentos financeiros.

### 5. image-generation
- **Pasta:** `image-generation/`
- **Arquivos:** 3 (SKILL.md, LICENSE.txt, scripts/image-generation.ts)
- **Funcionalidade:** Geração de imagens por IA a partir de descrições textuais. Suporta múltiplos tamanhos de imagem e retorna imagens codificadas em base64. Inclui ferramenta CLI para geração rápida. Pode ser usado para criar assets visuais e ilustrações para o app.

### 6. image-edit
- **Pasta:** `image-edit/`
- **Arquivos:** 3 (SKILL.md, LICENSE.txt, scripts/image-edit.ts)
- **Funcionalidade:** Edição de imagens por IA. Permite modificar, ajustar e manipular imagens existentes usando instruções textuais. Suporta remoção de fundo, ajustes de cor e transformações diversas.

### 7. image-understand
- **Pasta:** `image-understand/`
- **Arquivos:** 3 (SKILL.md, LICENSE.txt, scripts/image-understand.ts)
- **Funcionalidade:** Compreensão e análise de imagens. Extrai informações visuais de imagens, identifica objetos, textos e elementos. Pode ser usado para OCR de recibos e extração de dados de documentos financeiros.

### 8. video-generation
- **Pasta:** `video-generation/`
- **Arquivos:** 3 (SKILL.md, LICENSE.txt, scripts/video.ts)
- **Funcionalidade:** Geração de vídeos por IA a partir de prompts textuais ou imagens. Suporta gerenciamento assíncrono de tarefas com polling de status e recuperação de resultados. Pode criar conteúdo de vídeo para tutoriais financeiros.

### 9. video-understand
- **Pasta:** `video-understand/`
- **Arquivos:** 3 (SKILL.md, LICENSE.txt, scripts/video-understand.ts)
- **Funcionalidade:** Análise e compreensão de conteúdo de vídeo. Entende sequências de movimento e temporais, extrai informações de frames. Otimizado para MP4, AVI, MOV e outros formatos comuns.

---

## Grupo 2 — Finanças & Dados (5 skills)

### 10. finance
- **Pasta:** `finance/`
- **Arquivos:** 2 (SKILL.md, Finance_API_Doc.md)
- **Funcionalidade:** API abrangente de dados financeiros em tempo real e históricos. Inclui cotações de ações, dados de mercado, informações financeiras de empresas, rastreamento de portfólio, notícias de mercado, screening de ações e análise técnica. **Essencial para enriquecer o dashboard financeiro com dados reais de mercado.**

### 11. stock-analysis-skill
- **Pasta:** `stock-analysis-skill/`
- **Arquivos:** 10 (SKILL.md, package.json, tsconfig.json, src/*.ts)
- **Funcionalidade:** Análise completa de ações com TypeScript. Inclui análise de dividendos, scanner de rumores, watchlist e análise técnica. Componentes modulares: analyzer, dataFetcher, dividend, rumorScanner, types, watchlist. **Diretamente relacionado ao módulo de investimentos do projeto.**

### 12. charts
- **Pasta:** `charts/`
- **Arquivos:** 12 (SKILL.md, LICENSE.txt, setup.sh, references/*.md)
- **Funcionalidade:** Visualização de dados com múltiplas bibliotecas: D3.js, ECharts, Matplotlib, Seaborn, Mermaid. Inclui templates CSS para mindmaps, grids radiais e charts via Playwright. Referências detalhadas para cada biblioteca. **Diretamente aplicável aos gráficos financeiros do app (Recharts/ECharts).**

### 13. contentanalysis
- **Pasta:** `contentanalysis/`
- **Arquivos:** 3 (SKILL.md, ExtractWisdom/SKILL.md, ExtractWisdom/Workflows/Extract.md)
- **Funcionalidade:** Análise de conteúdo para extração de sabedoria. Inclui workflows estruturados para extrair insights de textos, artigos e documentos. Pode ser aplicado para analisar relatórios financeiros e notícias de mercado.

### 14. multi-search-engine
- **Pasta:** `multi-search-engine/`
- **Arquivos:** 7 (SKILL.md, CHANGELOG.md, CHANNELLOG.md, config.json, metadata.json, _meta.json, references/*.md)
- **Funcionalidade:** Busca em múltiplos motores de busca simultaneamente. Suporta busca internacional com configurações avançadas. Pode ser usado para pesquisa abrangente de dados financeiros e comparação de preços.

---

## Grupo 3 — Desenvolvimento & Testes (5 skills)

### 15. fullstack-dev
- **Pasta:** `fullstack-dev/`
- **Arquivos:** 1 (SKILL.md)
- **Funcionalidade:** Desenvolvimento fullstack com Next.js 16, TypeScript, Tailwind CSS 4, shadcn/ui e Prisma ORM. Guia completo para construir apps web completos com UI components, APIs e operações de banco de dados. **Skill base utilizada em todo o projeto.**

### 16. coding-agent
- **Pasta:** `coding-agent/`
- **Arquivos:** 8 (SKILL.md, criteria.md, execution.md, memory-template.md, planning.md, state.md, verification.md, _meta.json)
- **Funcionalidade:** Agente de codificação com metodologia estruturada. Inclui planejamento, execução, verificação, gerenciamento de estado e template de memória. Critérios de qualidade e padrões de desenvolvimento.

### 17. agent-browser
- **Pasta:** `agent-browser/`
- **Arquivos:** 1 (SKILL.md)
- **Funcionalidade:** Automação de browser headless em Rust com fallback Node.js. Permite navegar, clicar, digitar e capturar snapshots de páginas via comandos estruturados. **Usado para testes automatizados e QA do projeto financeiro.**

### 18. skill-creator
- **Pasta:** `skill-creator/`
- **Arquivos:** 18 (SKILL.md, LICENSE.txt, agents/*.md, assets/*, eval-viewer/*, references/*.md, scripts/*.py)
- **Funcionalidade:** Criação, modificação e otimização de skills. Inclui agentes especializados (analyzer, comparator, grader), scripts de benchmark, geração de relatórios, empacotamento e validação. Viewer HTML para revisão de avaliações.

### 19. skill-vetter
- **Pasta:** `skill-vetter/`
- **Arquivos:** 1 (SKILL.md)
- **Funcionalidade:** Verificação de segurança para skills de IA. Analisa red flags, escopo de permissões e padrões suspeitos antes da instalação de skills de fontes externas (ClawdHub, GitHub).

---

## Grupo 4 — Documentos & Exportação (4 skills)

### 20. pdf
- **Pasta:** `pdf/`
- **Arquivos:** 31 (SKILL.md, LICENSE.txt, briefs/*.md, configs/*.md, references/*.tex, scripts/*.py, scripts/*.js, typesetting/*.md)
- **Funcionalidade:** Toolkit profissional de PDF com 4 linhas de produção: (1) Report — documentos estruturados via ReportLab, (2) Creative — design visual via JSON Blueprint + design_engine.py, (3) Academic — trabalhos acadêmicos via LaTeX/Tectonic, (4) Process — manipulação de PDFs (extrair, mesclar, dividir, preencher formulários). **Pode gerar relatórios financeiros em PDF.**

### 21. ppt
- **Pasta:** `ppt/`
- **Arquivos:** 75 (SKILL.md, LICENSE.txt, *.md, ooxml/schemas/*.xsd, scripts/*.py, scripts/validation/*.py, references/*.md, references/*.tex, themes.md)
- **Funcionalidade:** Criação e edição de apresentações .pptx. Suporta criação de slides, modificação de conteúdo, layouts e notas do apresentador. Inclui schemas OOXML, validação e scripts Python. Ideal para apresentações financeiras.

### 22. xlsx
- **Pasta:** `xlsx/`
- **Arquivos:** 21 (SKILL.md, LICENSE.txt, setup.sh, xlsx.py, engines/*.md, quality/*.md, scenes/*.md, templates/*.py)
- **Funcionalidade:** Toolkit completo para planilhas. Abrir, ler, editar, criar do zero, analisar dados e exportar para Excel. Suporta conversão CSV/JSON/PDF ↔ XLSX, limpeza, merge, pivot e transformação de dados. Inclui cena específica de finanças (finance.md, finance_lite.md). **Essencial para exportação de dados financeiros.**

### 23. docx
- **Pasta:** `docx/`
- **Arquivos:** 35 (SKILL.md, LICENSE.txt, setup.sh, references/*.md, routes/*.md, scenes/*.md, scripts/*.py, scripts/templates/*.xml)
- **Funcionalidade:** Criação e edição de documentos Word profissionais. Suporta tracked changes, comentários, formatação e extração de texto. Cenas especializadas: relatórios, contratos, redação, exames, documentos oficiais, resumos e trabalho acadêmico. **Pode gerar contratos e relatórios financeiros em DOCX.**

---

## Grupo 5 — Web & Busca (3 skills)

### 24. web-reader
- **Pasta:** `web-reader/`
- **Arquivos:** 3 (SKILL.md, LICENSE.txt, scripts/web-reader.ts)
- **Funcionalidade:** Extração de conteúdo de páginas web. Suporta scraping de páginas, extração de artigos, recuperação de metadados e processamento de conteúdo web. Retorna título, HTML e data de publicação automaticamente.

### 25. web-search
- **Pasta:** `web-search/`
- **Arquivos:** 3 (SKILL.md, LICENSE.txt, scripts/web_search.ts)
- **Funcionalidade:** Busca na web em tempo real. Recupera informações atualizadas além do conhecimento base. Retorna resultados estruturados com URLs, snippets e metadados. **Pode ser usado para buscar cotações e notícias financeiras em tempo real.**

### 26. web-shader-extractor
- **Pasta:** `web-shader-extractor/`
- **Arquivos:** 12 (SKILL.md, references/*.md, scripts/*.mjs, scripts/*.sh)
- **Funcionalidade:** Extração e porting de shaders web. Inclui referências para WebGL, Three.js shaders, Unicorn Studio, TSL extraction e injeção de shaders. Pode adicionar efeitos visuais avançados ao dashboard financeiro.

---

## Grupo 6 — Design & UX (3 skills)

### 27. ui-ux-pro-max
- **Pasta:** `ui-ux-pro-max/`
- **Arquivos:** 56 (SKILL.md, _meta.json, assets/data/*.csv, data/*.csv, references/*.md, scripts/*.py)
- **Funcionalidade:** Design UI/UX de nível profissional. Inclui datasets de referência para: charts, cores, ícones, landing pages, produtos, performance React, tipografia, guidelines UX, interfaces web e stacks específicas (Next.js, React, Vue, Svelte, Flutter, SwiftUI, etc.). Scripts Python para busca e design system. **Essencial para o design do app financeiro.**

### 28. visual-design-foundations
- **Pasta:** `visual-design-foundations/`
- **Arquivos:** 4 (SKILL.md, references/color-systems.md, references/spacing-iconography.md, references/typography-systems.md)
- **Funcionalidade:** Fundamentos de design visual. Referências detalhadas para sistemas de cores, tipografia, espaçamento e iconografia. Base teórica para decisões de design consistentes no projeto.

### 29. storyboard-manager
- **Pasta:** `storyboard-manager/`
- **Arquivos:** 7 (SKILL.md, index.js, package.json, references/*.md, scripts/*.py)
- **Funcionalidade:** Gerenciamento de storyboards para UX flows. Inclui referências para desenvolvimento de personagens e estruturas narrativas. Scripts para verificação de consistência e rastreamento de timeline. Pode ser usado para planejar fluxos de usuário no app.

---

## Grupo 7 — Conteúdo & Marketing (7 skills)

### 30. blog-writer
- **Pasta:** `blog-writer/`
- **Arquivos:** 12 (SKILL.md, README.md, _meta.json, style-guide.md, manage_examples.py, *.md)
- **Funcionalidade:** Criação de conteúdo para blogs. Inclui guia de estilo, exemplos de artigos publicados e script Python para gerenciar exemplos. Pode criar artigos sobre educação financeira e dicas de investimento.

### 31. content-strategy
- **Pasta:** `content-strategy/`
- **Arquivos:** 2 (SKILL.md, _meta.json)
- **Funcionalidade:** Estratégia de conteúdo. Framework para planejamento e execução de estratégias de conteúdo alinhadas com objetivos de negócio.

### 32. market-research-reports
- **Pasta:** `market-research-reports/`
- **Arquivos:** 8 (SKILL.md, assets/*.md, assets/*.tex, assets/*.sty, references/*.md, scripts/*.py)
- **Funcionalidade:** Relatórios de pesquisa de mercado. Inclui guia de estrutura, padrões de análise de dados, guia de geração visual e template LaTeX. Script Python para geração de visuais de mercado. **Relevante para análise de mercado financeiro.**

### 33. marketing-mode
- **Pasta:** `marketing-mode/`
- **Arquivos:** 5 (SKILL.md, README.md, _meta.json, mode-prompt.md, skill.json)
- **Funcionalidade:** Modo de marketing para criação de conteúdo promocional. Inclui prompt de modo especializado para geração de copy e materiais de marketing.

### 34. podcast-generate
- **Pasta:** `podcast-generate/`
- **Arquivos:** 7 (SKILL.md, LICENSE.txt, generate.ts, package.json, readme.md, tsconfig.json, test_data/*.jsonl)
- **Funcionalidade:** Geração de podcasts por IA. Ferramenta TypeScript para criar conteúdo de podcast. Suporta segmentação e geração de episódios. Pode criar podcasts sobre finanças pessoais e educação financeira.

### 35. seo-content-writer
- **Pasta:** `seo-content-writer/`
- **Arquivos:** 4 (SKILL.md, _meta.json, references/*.md)
- **Funcionalidade:** Escrita de conteúdo otimizado para SEO. Inclui templates de estrutura de conteúdo e fórmulas de títulos. Referências para maximizar visibilidade em mecanismos de busca.

### 36. writing-plans
- **Pasta:** `writing-plans/`
- **Arquivos:** 2 (SKILL.md, _meta.json)
- **Funcionalidade:** Criação de planos de escrita estruturados. Framework para planejar e organizar documentos, artigos e conteúdo de forma metodológica.

---

## Skills NÃO Copiadas (15)

As seguintes skills foram consideradas não relevantes para o contexto de um app de gestão financeira:

| Skill | Motivo |
|-------|--------|
| `ai-news-collectors` | Coleta de notícias de IA genérica, não financeira |
| `aminer-open-academic` | Pesquisa acadêmica, escopo muito específico |
| `auto-target-tracker` | Rastreamento automatizado genérico |
| `dream-interpreter` | Interpretação de sonhos, sem relevância financeira |
| `get-fortune-analysis` | Análise de fortuna/astrologia, não financeira |
| `gift-evaluator` | Avaliação de presentes, sem relevância |
| `interview-designer` | Design de entrevistas, não aplicável |
| `mindfulness-meditation` | Meditação, sem relevância financeira |
| `qingyan-research` | Ferramenta de pesquisa chinesa, idioma diferente |
| `seo-content-writer` | *(incluída na cópia)* |
| `skill-finder-cn` | Busca de skills em chinês |
| `ai-news-collectors` | Coleta de notícias genéricas de IA |

---

## Como Utilizar

Cada skill possui um arquivo `SKILL.md` que serve como documentação principal. Para usar:

1. **Navegue** até a pasta da skill desejada
2. **Leia** o `SKILL.md` para instruções detalhadas
3. **Consulte** os scripts nas subpastas `scripts/` para implementação
4. **Referencie** os arquivos em `references/` para documentação técnica

### Integração com o Projeto

- **Backend:** Use os scripts `.ts` via `z-ai-web-dev-sdk` (NUNCA no client-side)
- **APIs:** Crie rotas em `src/app/api/` que utilizam os SDKs das skills
- **Frontend:** Consuma as APIs criadas a partir dos componentes React

---

*Gerado automaticamente — Projeto Financeiro v3.0.0*
