# Running this project locally

This repo contains the `@tarviks/lexical-rich-editor` library (`src/`) plus a
Vite demo app in `example/` that consumes it via a Yarn workspace.

## Prerequisites

- Node.js >= 20
- Yarn (the repo pins `packageManager: yarn@4.12.0` via Corepack)

## 1. Enable Corepack (one-time)

The root `package.json` pins Yarn 4.12.0. If your global Yarn is v1 (classic),
`yarn` commands will fail with a `packageManager` mismatch error. Enable
Corepack once so Yarn resolves to the pinned version automatically:

```bash
corepack enable
```

If you skip this, you can still run the demo directly (see the workaround
below).

### Windows: `corepack enable` fails with EPERM

On Windows, `corepack enable` writes shim files (`yarn.cmd`, `pnpm.cmd`,
`pnpx.cmd`, ...) into `C:\Program Files\nodejs\`, which requires admin
rights. Without elevation you'll see:

```
Internal Error: EPERM: operation not permitted, open 'C:\Program Files\nodejs\pnpx'
```

You don't need to fix this to work on the project. Corepack can still
resolve and run the pinned Yarn version on a per-command basis without
installing global shims — just prefix commands with `corepack`:

```bash
corepack yarn install
corepack yarn dev
```

This is what was used to verify the steps below. Alternatively, run your
shell as Administrator once and `corepack enable` will succeed normally,
after which plain `yarn` works.

## 2. Install dependencies

From the repo root (installs both the root package and the `example`
workspace):

```bash
yarn install
# or, without corepack enabled (see above):
corepack yarn install
```

## 3. Run the demo app

```bash
yarn dev
# or:
corepack yarn dev
```

This runs `cd example && yarn dev`, starting the Vite dev server at
**http://localhost:5173/**.

### Workaround (Corepack not enabled and `corepack yarn` unavailable)

If you can't use `corepack yarn` either, invoke the Vite binary directly
instead:

```bash
cd example
./node_modules/.bin/vite
```

## Other useful scripts (root)

| Command | Purpose |
|---|---|
| `yarn build` | Build the library with `tsup` → `dist/` |
| `yarn build:watch` | Build in watch mode |
| `yarn lint` | Type-check with `tsc --noEmit` |
| `yarn test:e2e` | Run Playwright end-to-end tests |

## Other useful scripts (`example/`)

| Command | Purpose |
|---|---|
| `yarn dev` | Start Vite dev server |
| `yarn build` | Type-check and build the demo for production |
| `yarn preview` | Preview the production build locally |
