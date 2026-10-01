# Styling Systems

Select the styling profile from manifests, configuration, imports, nearby components, and generated conventions. Preserve deliberate mixed stacks boundary by boundary.

## Shared Rules

- Reuse existing tokens, variables, variants, class helpers, breakpoints, component props, cascade, and inheritance.
- Keep each CSS responsibility in one selector, token, utility, variant, or component prop.
- Use project-scale values for routine spacing and sizing; put stable product geometry in named tokens, variables, variants, or classes.
- Do not add a parallel styling system, theme provider, reset, token scale, icon set, or UI kit for a local change.

## Tailwind

- Use Tailwind only where the same UI layer already uses utilities.
- Detect the installed major and effective configuration before editing:
  JavaScript/TypeScript configuration and content globs are common in v3,
  while v4 may use CSS-first imports, `@theme`, and source directives. Do not
  require one model in a repository using the other.
- Reuse the configured spacing, sizing, color, radius, typography, shadow, breakpoint, and variant scales plus existing class-composition helpers.
- Prefer scale utilities such as `h-12`, `gap-3`, or `px-4` for routine dimensions.
- Do not scatter arbitrary pixel utilities such as `h-[22px]`, `w-[88px]`, or `mt-[7px]` for routine UI dimensions.
- Put real product or layout constants in named classes, component variants, tokens, or CSS variables.
- Keep utility names statically discoverable by the installed compiler unless
  the repository owns an explicit source/safelist pattern. Do not build class
  fragments dynamically when complete class alternatives or an established
  variant helper can express the state.
- Do not fight component-library tokens with utility overrides unless the feature already owns that integration pattern.

## CSS Modules

- Preserve local module ownership, naming, composition, and import conventions.
- Prefer existing tokens or CSS variables over copied literal values.
- Remove unused selectors and duplicate declarations made obsolete by the change; do not turn a local module into global CSS incidentally.

## Sass Or Less

- Preserve the repository's variables, mixins, nesting depth, import/module convention, and build pipeline.
- Reuse existing theme variables and mixins; do not create a second token hierarchy.
- Avoid deeper selector specificity or global overrides when a component prop, token, or local owner exists.

## CSS-in-JS

- Preserve the installed library, theme provider, server-rendering setup, extraction pipeline, and variant convention.
- Keep dynamic styles derived from explicit props or state and avoid recreating static style objects on every render when the local library provides a stable pattern.
- Do not introduce another runtime or zero-runtime CSS-in-JS library into the same feature.

## Ant Design

- Prefer existing wrappers, theme tokens, `ConfigProvider`, table/form/modal/drawer conventions, and locale setup.
- Preserve validation, field names, pagination, row keys, loading states, and overlay lifecycle.
- Avoid brittle overrides against generated class names when props, tokens, or owned wrappers exist.
- Preserve `ConfigProvider`/`App` context for theme, locale, prefix, message,
  notification, and modal behavior. Before using static feedback APIs, verify
  the installed major and whether that call can consume the required context.
- Do not replace Ant Design controls with custom or shadcn/ui controls unless requested.

## shadcn/ui

- Reuse existing generated components and local composition/variant patterns before changing primitives.
- Confirm `components.json`, schema/style, Radix or Base UI choice, Tailwind
  setup, aliases, `cn`, component paths, icon choice, and variant utilities
  before importing or regenerating.
- Do not rerun generators or alter shared primitives for one page unless that shared change is requested.
- Do not introduce shadcn/ui into an Ant Design or non-shadcn feature without established precedent or explicit direction.

## Mixed Stacks

- Follow the target feature's nearest precedent instead of choosing a global favorite.
- State each component-system and styling boundary when a requested change crosses them.
- Keep each side on its existing tokens, components, and styling mechanism unless migration is explicitly in scope.
