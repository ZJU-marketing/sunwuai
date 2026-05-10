# SunwuAI CLI

Team knowledge and skill distribution tool for SunwuAI agents.

## Installation

### Development

```bash
cd cli
npm install
npm link
```

### From GitHub

```bash
npm install -g github:ZJU-marketing/sunwu-cli
```

## Prerequisites

- Node.js >= 18
- [GitHub CLI](https://cli.github.com) (`gh`)
- Git
- OpenClaw (for memory indexing)

## Quick Start

1. **Login to GitHub with required scopes:**

```bash
sunwuai auth login
```

This will authenticate with GitHub and request the following scopes:
- `repo` - Repository operations
- `project` - GitHub Projects access
- `workflow` - GitHub Actions
- `read:org` - Organization info

2. **Sync team resources:**

```bash
sunwuai sync
```

This will:
- Clone/update `sunwu-memory` to `~/.openclaw/workspace/memory/sunwu-memory/`
- Clone/update `skills` to `~/.openclaw/workspace/sunwu/skills/`
- Reindex memory for OpenClaw

## Commands

### Authentication

```bash
sunwuai auth login   # Login to GitHub with required scopes
sunwuai auth status  # Check authentication status
```

### Sync All

```bash
sunwuai sync  # Sync both memory and skills
```

### Memory

```bash
sunwuai memory sync           # Sync team memory
sunwuai memory status         # Show memory index status
sunwuai memory search <query> # Search team memory
```

### Skills

```bash
sunwuai skill sync              # Sync all team skills from remote
sunwuai skill list              # List available shared skills
sunwuai skill install <name>    # Install one skill from shared repo
sunwuai skill upgrade <name>    # Upgrade one installed skill
sunwuai skill upgrade --all     # Upgrade all shared skills
sunwuai skill create <name>     # Create a new skill in shared repo
sunwuai skill publish <name>    # Publish/update a workspace skill to shared repo
sunwuai skill push <name>       # Alias of publish
```

## Configuration

Default configuration is in `config/default.json`:

```json
{
  "repos": {
    "memory": "ZJU-marketing/sunwu-memory",
    "skills": "ZJU-marketing/sunwuai-skills"
  },
  "paths": {
    "workspace": "~/.openclaw/workspace",
    "memory": "memory/sunwu-memory",
    "skillsDir": "skills"
  }
}
```

## Directory Structure

After running `sunwuai sync`, your workspace will look like:

```
~/.openclaw/workspace/
├── memory/
│   └── sunwu-memory/     # Team memory (from ZJU-marketing/sunwu-memory)
│       ├── agents/
│       ├── architecture/
│       ├── members/
│       ├── process/
│       ├── projects/
│       └── roles/
└── sunwu/
    └── skills/           # Team skills (from ZJU-marketing/sunwuai-skills)
        ├── skill-1/
        ├── skill-2/
        └── ...
```

## License

MIT
