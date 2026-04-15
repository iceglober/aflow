# Contributing

Thanks for your interest in glorious! Here's how to get set up.

## Prerequisites

- **agentic**: [Bun](https://bun.sh) 1.1+, Node.js 20+
- **assume**: Rust 1.75+ (via [rustup](https://rustup.rs))

## Setup

```bash
git clone https://github.com/iceglober/glorious.git
cd glorious
bun install
```

## Building & Testing

### agentic (TypeScript)

```bash
cd packages/agentic
bun run build        # bundle to dist/index.js
bun run typecheck    # type-check without emitting
bun test             # run test suite
```

### assume (Rust)

```bash
cd packages/assume
cargo build
cargo test
cargo clippy -- -D warnings
cargo fmt --check
```

## Submitting Changes

1. Fork the repo and create a branch from `main`.
2. Make your changes. Add tests if applicable.
3. Ensure `bun test` and/or `cargo test` pass.
4. Open a pull request with a clear description of what changed and why.

## Code Style

- **TypeScript**: Follows the conventions in `packages/agentic/CLAUDE.md`. Uses `cmd-ts` for CLI commands, `src/lib/fmt.ts` for terminal output.
- **Rust**: Standard `cargo fmt` + `cargo clippy` with warnings denied.

## Reporting Issues

Open an issue on [GitHub](https://github.com/iceglober/glorious/issues) with steps to reproduce.
