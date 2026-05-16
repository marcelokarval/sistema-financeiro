# Hardening

## Z.ai Integration
O helm delega prompt hardening para o skill `prompt-hardening` já existente na plataforma Z.ai.

Quando o workflow de hardening é acionado (ver `core/control-plane/branch-enforcement-matrix.md`):
1. O master invoca `Skill(command="prompt-hardening")`
2. O skill analisa a request e produz um prompt hardened
3. O master executa o trabalho usando o prompt hardened

## Referência
- Skill nativo: `prompt-hardening` (disponível via Skill tool)
- Documentação original: ver skill-creator para detalhes do skill

## Conceito Original
O accelerate define hardening como um gate que bloqueia execução até que o prompt
esteja claro o suficiente. Este conceito é preservado — a implementação é via skill
nativo do Z.ai em vez de módulo próprio.
