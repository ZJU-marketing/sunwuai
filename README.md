# SunwuAI CLI

Team knowledge and skill distribution tool for SunwuAI agents.

## Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/ZJU-marketing/sunwuai/main/install.sh | bash
```

This will:
1. Check prerequisites (Node.js >= 18, GitHub CLI)
2. Login to GitHub with required scopes (if needed)
3. Install `sunwuai` CLI globally
4. Ready to use

## Prerequisites

- [Node.js](https://nodejs.org) >= 18
- [GitHub CLI](https://cli.github.com) (`gh`)
- Git
- Access to ZJU-marketing organization

## Usage

```bash
# Sync team memory and skills
sunwuai sync

# Check auth status
sunwuai auth status

# Memory operations
sunwuai memory sync
sunwuai memory status
sunwuai memory search <query>

# Skill operations
sunwuai skill sync
sunwuai skill list
sunwuai skill info <name>
```

## What It Does

`sunwuai` is a lightweight CLI that distributes team knowledge to AI agents:

- **Memory** — Syncs shared team knowledge (architecture, members, processes) to your OpenClaw workspace
- **Skills** — Syncs team-standard agent skills
- **Auth** — Manages GitHub authentication with the right scopes

After running `sunwuai sync`, your workspace will have:

```
~/.openclaw/workspace/
├── memory/
│   └── sunwu-memory/     # Team knowledge base
└── sunwu/
    └── skills/           # Team agent skills
```

## License

MIT
