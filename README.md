<div align="center">

<br/>

# `glorious`

**AI-native development tools.**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/iceglober/glorious/ci-agentic.yml?style=flat-square&label=agentic)](https://github.com/iceglober/glorious/actions)
[![CI](https://img.shields.io/github/actions/workflow/status/iceglober/glorious/ci-assume.yml?style=flat-square&label=assume)](https://github.com/iceglober/glorious/actions)

<br/>

</div>

## Why

Building with AI agents is powerful, but the surrounding workflow is still manual — planning what to build, tracking progress across tasks, managing credentials across cloud accounts, reviewing AI-generated code. **glorious** is a pair of CLI tools that fill those gaps: one orchestrates the AI development loop end-to-end, the other handles the credential plumbing so agents (and humans) can actually talk to cloud services.

## Packages

| Package | What it does | Language | Install |
|:--|:--|:--|:--|
| [`glorious-agentic`](packages/agentic/) | AI workflows for product & engineering, powered by Claude Code | TypeScript/Bun | `curl -fsSL https://raw.githubusercontent.com/iceglober/glorious/main/packages/agentic/install.sh \| bash` |
| [`glorious-assume`](packages/assume/) | Multi-cloud SSO credential manager with per-shell context switching | Rust | `curl -fsSL https://raw.githubusercontent.com/iceglober/glorious/main/packages/assume/install.sh \| bash` |

### glorious-agentic

Installs slash commands into Claude Code (`/work`, `/ship`, `/deep-plan`, `/qa`, etc.) that turn a description into a planned, implemented, tested, and shipped PR. Includes a built-in task tracker with epics, dependency graphs, and a browser dashboard — so you always know where you are in a multi-step build.

### glorious-assume

Authenticate to AWS SSO once, then switch contexts per-shell instantly. Credentials are encrypted at rest (AES-256-GCM), served by a local daemon, and auto-refresh in the background. Includes an MCP server and agent permission system so AI tools can access cloud resources with explicit approval.

## Development

```bash
bun install              # install workspace dependencies
bun run build            # build all packages
bun run typecheck        # typecheck agentic
bun test                 # test agentic
```

For `glorious-assume` (Rust):

```bash
cd packages/assume
cargo build              # debug build
cargo test               # run tests
cargo clippy             # lint
```

See each package's README for detailed usage.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to build, test, and submit changes.

---

<div align="center">
<sub>MIT License</sub>
</div>
