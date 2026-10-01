# Stack Guidelines

Use these guidelines only after verifying the project actually uses the relevant stack.

## Toolchain And Script Contract

- Read `package.json`, lockfiles, workspace config, runtime pinning, and repository guidance before choosing commands or versions.
- Preserve the pinned Node/package-manager and dependency policy unless alignment is the requested task.
- Do not replace reviewed version ranges with `latest`.
- Prefer stable script names such as `dev`, `build`, `lint`, `typecheck`, `test`, and `check` when the repository standard defines them.
- Keep validation scripts read-only. Use explicit `:fix`, format-write, or equivalent commands for rewrites.
- Read the effective ESLint/Oxlint/Biome/TypeScript configuration, ignore
  boundaries, generated-file ownership, and CI invocation before changing a
  lint rule or declaring the scanned surface clean. Type-aware rules require
  the repository's real project configuration and must not be inferred from a
  syntax-only run.
- Treat ESLint flat-config conversion, ESLint-to-Oxlint adoption, formatter
  replacement, or lint-rule-family changes as explicit migrations. Keep the
  old and new checks comparable until unsupported rules, plugins, ignores,
  severity, editor, and CI behavior are accounted for; generated config is a
  starting point, not proof of parity.
- For Oxlint type-aware parity, verify pinned Oxlint and `oxlint-tsgolint`
  versions, actual type-aware enablement, TypeScript/`tsconfig` compatibility,
  supported rules, and representative diagnostics. Retain ESLint for gaps, and
  do not replace a repository-owned `tsc` gate without a separate explicit
  compatibility decision.
- For `.eslintrc*` to flat config, compare the actual linted file set and
  representative effective configs across ordinary files, nested globs,
  dotfiles, `.eslintignore`/generated paths, overrides/processors, and affected
  CLI flags before deleting the legacy configuration.

## Directory Classes

- React Router SPA projects normally route through their established `routes` layer.
- Next.js App Router projects keep `app`; Astro keeps `pages`; other frameworks keep their native router convention.
- Use repository-defined plural directories and kebab-case for new files when present. Preserve documented legacy naming until an explicit alignment task.
- Do not copy a Tauri, content-site, admin SPA, or web-monorepo layout into another class mechanically.

## Vite / Next.js / TanStack Router

- Treat `vite.config.*`, `tsconfig.*`, aliases, env prefixes, proxy config, and build targets as project contracts.
- Do not change alias, proxy, base path, env names, or build output paths for a component-level task.
- Preserve route paths, params, loaders/actions, query handling, layouts, and navigation conventions.
- Prefer existing scripts from `package.json`, docs, or repo guidance.
- Detect the installed Vite/framework version and effective builder before
  changing configuration. Vite 8 uses Rolldown and exposes
  `build.rolldownOptions`; the deprecated `build.rollupOptions` alias is a
  compatibility fact, not a reason to migrate an unaffected application.
- In a normal Vite application, do not install standalone Rolldown or create a
  separate `rolldown.config.*` merely because Vite uses it internally. Use the
  repository's `vite.config.*` and only add configuration required by an
  explicit behavior, compatibility, performance, or deployment need.
- Treat `rolldown-vite` for older Vite projects, Vite-major upgrades, and
  Rollup-to-Rolldown option/plugin changes as explicit migrations. Read the
  applicable migration guide, preserve plugin and output semantics, and prove
  dev, production build, preview/deployment, SSR, library, and sourcemap
  behavior that the project actually uses.
- Do not cargo-cult chunk splitting, minifier, dependency optimization, or
  plugin settings. Establish a route/workload/bundle baseline and verify the
  resulting output before keeping performance-oriented configuration.
- Treat every client-exposed env prefix, including Vite's default `VITE_`, as
  public bundle data. Never place secrets there. Preserve mode precedence,
  explicit parsing of string values, and the repository's distinction between
  Vite mode and `NODE_ENV`; validate every changed mode used by build or deploy.

## React Correctness And Performance

- Keep components and hooks pure during render: do not mutate props, state, Hook
  arguments/return values, or non-local values while rendering. Side effects
  that synchronize external systems belong in event handlers or Effects and
  must follow dependency, ownership, cleanup, and cancellation contracts.
  Follow the Rules of Hooks and the repository's official
  `eslint-plugin-react-hooks` configuration.
- Use effects to synchronize with external systems, with complete dependencies
  and cleanup. Keep event-specific logic in events rather than effects.
- Treat `memo`, `useMemo`, `useCallback`, lazy loading, virtualization, and
  store/context splitting as measured optimizations. Verify the actual render,
  calculation, route, request, or bundle path; do not apply them by default.
- Component co-location, file count, export style, and prop-passing depth follow
  repository ownership and change reasons. Extract only a stable responsibility
  or demonstrated coordinated-change seam.

## Layout Selection

- Prefer Flexbox for one-dimensional horizontal or vertical composition, including parent-owned alignment and centering.
- Use Grid for real two-dimensional row/column relationships.
- Do not add wrappers only to apply `display`, alignment, centering, or duplicated spacing when the semantic parent can own it.
- Let children fill or contract through the project's grow, shrink, basis, wrapping, and minimum-size conventions; avoid fixed dimensions for naturally adaptive content.
- Keep page-edge spacing at one shell, content, or page owner. Reusable components should not reapply outer margins or padding already supplied by their parent.
- Keep each CSS responsibility in one selector, token, variant, or component prop; remove duplicate and shadowing declarations after consolidation.

## Desktop Webviews

- Treat Tauri/Electron frontend code as UI code plus a native boundary.
- Keep shell, file, platform, and process access inside established IPC, command, or platform helper layers.
- Validate inputs before invoking native commands and show native command errors in the UI.
- Use `ops-client` for process, launch-command, CGWindowID, and real-window evidence.
- Treat frontend files and `src-tauri` as separate ownership boundaries; use `dev-rust` for Rust shell/backend changes.
