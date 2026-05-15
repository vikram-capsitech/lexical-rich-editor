# Contributing to @tarviks/lexical-rich-editor

Thank you for your interest in contributing! This document outlines how to get started.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/vikram-capsitech/lexical-rich-editor.git
cd lexical-rich-editor

# Install dependencies (uses yarn workspaces)
yarn install

# Build the library
yarn build

# Run the example playground (hot-reload)
yarn dev
```

## Project Structure

```
lexical-rich-editor/
├── src/                  # Library source
│   ├── Nodes/            # Custom Lexical nodes
│   ├── Plugins/          # Editor plugins
│   └── ContentEditorComponent.tsx
├── example/              # Playground / demo app (Vite + React)
└── dist/                 # Built output (do not edit)
```

## How to Contribute

### Reporting Bugs
Open a [Bug Report](https://github.com/vikram-capsitech/lexical-rich-editor/issues/new?template=bug_report.yml) with a minimal reproduction.

### Requesting Features
Open a [Feature Request](https://github.com/vikram-capsitech/lexical-rich-editor/issues/new?template=feature_request.yml) describing the use-case.

### Submitting a Pull Request

1. Fork the repo and create a branch: `git checkout -b feat/your-feature`
2. Make your changes in `src/`
3. Run `yarn build` and fix any TypeScript errors (`yarn lint`)
4. Update `example/src/App.tsx` if you added/changed a prop or API
5. Open a PR against `main` — fill in the PR template

### Commit Style
Use [Conventional Commits](https://www.conventionalcommits.org/):
- `feat: add wordLimit callback`
- `fix: toolbar z-index on mobile`
- `docs: update Quick Start example`
- `chore: bump lexical to 0.45`

## Code Style
- TypeScript strict mode — no `any` in public APIs
- No default comments; use self-documenting names
- Keep plugins self-contained in `src/Plugins/`
- Peer dependencies stay as peer deps (never move to `dependencies`)

## Questions?
Use [GitHub Discussions](https://github.com/vikram-capsitech/lexical-rich-editor/discussions) for questions and ideas. Issues are for bugs and concrete feature requests.
