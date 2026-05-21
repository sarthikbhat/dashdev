# DevDash

DevDash is a local web dashboard for running multi-step developer workflows. Define workflows as YAML or JS files and execute them with a single click from your browser.

## Quick Start

```bash
npm install
npm run dev:all
```

Then open [http://localhost:3847](http://localhost:3847).

## Adding Workflows

Drop `.yml` or `.js` workflow files into `~/.devdash/workflows/`. DevDash picks them up automatically — no restart needed.

Example YAML workflow (`~/.devdash/workflows/deploy.yml`):

```yaml
name: Deploy
steps:
  - name: Run tests
    command: npm test
  - name: Build
    command: npm run build
  - name: Deploy
    command: ./scripts/deploy.sh
```

## Build Binary

Requires [Bun](https://bun.sh).

```bash
bash scripts/build-binary.sh
```

Produces a self-contained `./devdash` binary (macOS arm64).

## Team Install

Run from the repo root:

```bash
bash scripts/install.sh
```

Installs a `devdash` launcher to `~/.local/bin`. Add it to your PATH if needed:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Then just run `devdash` from anywhere.
