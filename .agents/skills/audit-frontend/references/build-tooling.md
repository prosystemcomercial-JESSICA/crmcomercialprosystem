# Frontend Build And Tooling Audit

Select this profile only when the request materially concerns the frontend
toolchain, bundler, scripts, build output, SSR/library behavior, or deployment
contract.

## Establish The Effective Toolchain

- Read package manifests, lockfiles, workspace configuration, runtime pins,
  scripts, framework configuration, CI/deploy commands, and generated-output
  ownership.
- Identify the installed framework and bundler versions from repository
  evidence. Distinguish direct dependencies from framework-owned internals and
  compatibility aliases.
- For Vite, inspect `vite.config.*`, mode/env loading, plugins, aliases, server
  proxy/base, `build.outDir`, targets, SSR/library settings, sourcemaps, chunking,
  and deployment assumptions that apply to the audited surface.
- Treat client-exposed env prefixes such as Vite's default `VITE_` as public
  bundle data. Check secrets, string parsing, mode precedence, ignored local
  env files, and the distinction between Vite mode and `NODE_ENV` against each
  build/deploy command actually used.

## Vite And Rolldown

- Vite 8 uses Rolldown and exposes `build.rolldownOptions`; older or migration
  paths may use Rollup-compatible options or `rolldown-vite`. Report the actual
  installed contract, not a generic “Vite 8 migration.”
- Do not recommend standalone Rolldown or a separate `rolldown.config.*` for a
  normal Vite app unless the repository has a direct Rolldown workflow that
  Vite does not own.
- Treat a Vite-major upgrade, `rolldown-vite` adoption, plugin replacement, or
  Rollup-to-Rolldown option conversion as an explicit migration with
  compatibility evidence.

## Evidence And Findings

- A missing config file is not a finding when defaults satisfy the repository's
  contract. A config key is not justified merely because another project uses
  it.
- For correctness, trace dev and production resolution, env exposure, base and
  asset URLs, plugin ordering, SSR/client boundaries, library externals, and
  deploy output.
- For performance, require a representative route/workload and before/after
  bundle, chunk, build-time, startup, or runtime evidence. One large chunk or a
  popular split-vendor recipe is only a signal.
- Mark preview, deployment, SSR, browser compatibility, or production runtime
  `Not verified` when it was not exercised directly.

## Lint And Static Analysis

- Identify the effective ESLint flat/legacy config, Oxlint/Biome config,
  TypeScript project, ignore rules, generated paths, editor integration, CI
  command, and whether type-aware rules actually ran.
- A clean syntax-only or reduced-rule run does not prove parity with a
  type-aware ESLint baseline. During an ESLint-to-Oxlint or formatter migration,
  compare rule coverage, unsupported plugins, ignore semantics, severities,
  output, fix behavior, and CI/editor adoption before retiring the old gate.
- When an ESLint-to-Oxlint migration includes type-aware rules, verify the
  pinned Oxlint and `oxlint-tsgolint` versions, effective type-aware enablement,
  TypeScript/`tsconfig` compatibility, supported-rule coverage, and
  representative diagnostics. Keep ESLint for unsupported rules. Replacing a
  repository-owned `tsc` gate with Oxlint type checking is a separate decision
  that needs explicit compatibility and diagnostic evidence.
- Treat legacy `.eslintrc*` to flat-config conversion as distinct from an
  ESLint-to-Oxlint migration. Compare the actual linted file set and effective
  config for representative ordinary, nested, dotfile, ignored/generated, and
  override/processor paths; account for `.eslintignore`, glob-base, dotfile,
  and removed/replaced CLI-flag semantics before retiring the legacy config.
- Keep non-mutating check and mutating fix commands distinct. Do not report a
  repository clean after a command silently rewrote source or skipped the
  selected package, target, or generated boundary.
