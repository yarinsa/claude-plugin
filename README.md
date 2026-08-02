# yarinsa-practices

Personal Claude Code plugin. Skills I use daily, packaged so they travel across machines and projects.

## Install

```
/plugin marketplace add yarinsa/claude-plugin
/plugin install yarinsa-practices
```

## Skills

| Skill | What it does |
|-------|--------------|
| `product-acceptance-criteria` | Shared product/engineering workflow: write Given/When/Then criteria grouped by layer with explicit blocking order, run the coverage checklist, then scaffold one failing test per criterion. |
| `fe-react-patterns` | React + TypeScript pattern catalogue: component API shape, state, hooks, performance, design-system primitives, advanced TS. 16 reference docs plus runnable examples. |
| `qa-playwright-tests` | Opinionated Playwright guidance across 33 references: locators, auto-waiting, fixtures-over-POM, test data, flaky diagnosis, mocking, auth state, sharded CI with blob reports. |
| `qa-playwright-cli` | Drive a real browser from Bash - click, fill, snapshot, eval, trace, mock network, manage storage state. A context-cheap replacement for browser MCP servers. |

Skills are prefixed by domain (`product-`, `fe-`, `qa-`) so they group predictably alongside skills from other sources.

## Agents

| Agent | Owns |
|-------|------|
| `product-analyst` | Scopes tickets into testable criteria and the red test skeleton engineers start from. |
| `fe-engineer` | Component API shape, data flow, and frontend diff review. |
| `qa-engineer` | Writes and fixes Playwright tests, diagnoses flakes, drives a live browser to verify behavior. |

## License

MIT
