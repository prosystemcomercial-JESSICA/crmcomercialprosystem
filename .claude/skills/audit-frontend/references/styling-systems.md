# Styling Systems

Select only the styling profiles present in the audited boundary. A project may deliberately mix systems; audit each owner separately instead of forcing convergence.

## Shared Evidence

- Identify configuration, imports, tokens, variables, class helpers, variants, breakpoints, theme providers, generated primitives, and nearby precedents.
- Check whether routine values use the established scale and whether stable product geometry has a named owner.
- Flag parallel systems only when they duplicate the same responsibility inside the selected scope.
- Treat visual and responsive claims without rendered evidence as `Not verified`.

## Tailwind

- Detect the installed major and effective source of truth. Audit v3-style
  config/content globs differently from v4 CSS-first `@theme` and source
  directives; a missing `tailwind.config.*` is not automatically a defect.
- Verify utilities use the configured scale, tokens, breakpoints, variants, and class-composition helpers.
- Look for repeated arbitrary values, conflicting responsive utilities, duplicated parent/child spacing, class-order conflicts, and utilities fighting component-library tokens.
- Check that state-dependent utilities remain discoverable by the installed
  compiler or an explicit repository-owned source/safelist contract; dynamic
  string fragments can silently omit production CSS.
- Distinguish justified product geometry from routine dimensions that should use the project scale.
- Do not recommend Tailwind adoption, config expansion, or a global utility convention when the target layer owns another system.

## CSS Modules

- Verify selectors remain locally owned, imports match usage, and composition follows repository conventions.
- Look for unused selectors, copied literals that bypass existing tokens, duplicate declarations, and accidental global leakage.
- Do not treat local scoping alone as evidence of good ownership; trace token, layout, and component responsibility.

## Sass Or Less

- Verify variables, mixins, modules/imports, nesting, and build configuration follow the existing pipeline.
- Look for duplicated token hierarchies, deep specificity, global overrides, and mixins that obscure ownership.
- Prefer existing theme variables and component APIs over selector escalation.

## CSS-in-JS

- Verify the actual library, theme provider, server-rendering or extraction setup, variant mechanism, and prop/state ownership.
- Look for recreated static styles, unbounded dynamic values, duplicate themes, injection-order dependencies, and another CSS-in-JS runtime in the same feature.
- Require runtime or bundle evidence before claiming performance impact.

## Ant Design

- Verify wrappers, theme tokens, `ConfigProvider`, forms, tables, overlays, locale, and generated-class override boundaries.
- Check installed-major behavior for static `message`, `notification`, and
  modal APIs when theme, locale, prefix, or other provider context matters.
- Look for brittle selector overrides, duplicated validation/state behavior, and controls replaced by parallel primitives.

## shadcn/ui

- Verify `components.json`, local generated source, schema/style and aliases,
  Radix or Base UI composition, Tailwind integration, `cn`, variants, and
  compound accessibility contracts.
- Look for copied primitives, generator drift, local edits without consumer checks, and feature-specific behavior pushed into business-neutral primitives.

## Mixed Stacks

- Record why the mix exists and which boundary owns each system.
- Flag only unsupported overlap, duplicated responsibility, or cross-system token/behavior drift.
- Do not recommend a migration unless the audit scope explicitly includes it and evidence shows a stable target owner.
