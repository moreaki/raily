# Raily

Raily is a web-rendered application foundation for railway schematic editing.

## Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Zod
- Yarn

## Run

```bash
yarn
yarn dev
```

## Source layout

```text
src/
  app/                  app entry and global styles
  entities/             railway domain model and validation
  features/             interactive editor UI
  pages/                screen-level composition
  shared/               reusable UI and utilities
```

## Why this structure

- `entities` keeps the railway document model independent from rendering concerns.
- `features` holds interactive workflows that can later be reused across pages or app modes.
- `shared` prevents UI primitives and utilities from leaking domain assumptions.
- This layout adapts cleanly to web, desktop-shell, and backend-connected versions of the app.

## Long-term direction

- Keep the editor web-based for rendering and interaction.
- If you want an installable desktop app, add Tauri around this frontend rather than rewriting the UI stack.
- Add a backend only when you need accounts, sync, collaboration, or background processing.
