# Delegation

This layer is the native home of bounded delegation and subagent governance for
the standalone `helm` platform (Z.ai adaptation).

Native authority now starts here:

- `subagent-model.md`

Supporting inherited doctrine may still exist in `references/`, but delegation
should no longer depend primarily on imported modules.

## Z.ai Subagent Model

The helm platform uses the Z.ai Task tool for subagent delegation. The 5
subagent types available are:

- `full-stack-developer` — implementation work
- `Plan` — architecture and governance review
- `frontend-styling-expert` — frontend and visual review
- `Explore` — verification and exploration
- `general-purpose` — research and multi-step tasks

See `subagent-model.md` for the complete model including spawn/non-spawn
criteria and output contracts.
