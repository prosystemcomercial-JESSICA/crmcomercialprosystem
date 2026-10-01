# Styling And Layout

Evidence basis: the reference repositories each enforce one local component and
style system; shadcn primitives express variants and composition; Appwrite and
Outline expose reusable shells and feedback components. Exact CSS technology is
not portable.

## Ownership

- App/window shell owns chrome, background, global clipping, modal host, and
  desktop drag regions.
- Shared content container owns page-edge inset and broad viewport bounds.
- Page root owns page layout.
- Panels own panel bounds and internal spacing.
- One inner region owns scrolling where practical.
- Components own internal spacing, not outer page margins already supplied by a
  parent.

Do not restate padding, height, width, or overflow across shell, content, page,
panel, and component layers.

## Layout Rules

- Prefer Flexbox for one-dimensional row/column layout and parent-owned
  horizontal or vertical alignment.
- Use Grid for real two-dimensional row/column relationships.
- Let children adapt with the project's grow, shrink, basis, wrap, and minimum
  size conventions; avoid fixed dimensions when the available space owns size.
- Every wrapper must own semantics, layout, state, accessibility, animation, or
  reuse. Flatten the rest.
- Keep page title, actions, filters, content, and feedback aligned through the
  existing page/layout primitives.
- Centralize responsive breakpoints and avoid repeated near-identical media
  logic across components.

## Tokens And CSS

- Use existing spacing, radius, typography, color, shadow, and motion tokens.
- Use component variants or named product tokens for stable differences.
- Keep each CSS responsibility in one selector, token, utility, or prop.
- Recommend deleting duplicate declarations, late overrides, and margin patches after
  moving ownership.
- Do not introduce decoration or animation merely to appear more polished.
- Do not force Tailwind, CSS modules, CSS-in-JS, or another styling system into
  a project that owns a different one.

## Density

Web content may prioritize reading flow and responsive stacking. Console and
desktop surfaces may prioritize scanning, keyboard operation, persistent
panels, compact tables, and stable action placement. Preserve the target
product's density instead of importing a marketing-page composition.
