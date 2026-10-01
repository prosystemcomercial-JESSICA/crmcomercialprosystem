# SVG Icon System Contract

Load this reference when an accepted UI source, shared-system change, or Feature Spec
contains icons that must be delivered as SVG. `ui-spec` defines the visual and
acceptance contract; `dev-frontend` owns SVG source changes and implementation.

## Authority And Reuse

1. Resolve the current icon library, wrapper, asset directory, theme owner, and real
   consumers before proposing a new icon.
2. Prefer `reuse`, then a bounded adaptation, then a new asset only when the accepted
   source cannot be represented by an existing owner. Record the decision per role.
3. Record source identity, revision, rights/license, semantic role, and fallback.
   Missing rights or a P1 owner/fallback keeps the slice `Not Ready`.
4. Do not treat a generic gradient, emoji, font glyph, or unrelated library icon as
   the normal fallback for a product-specific role.

## Shared Visual Contract

When icon style is shared across surfaces, place it under `## Components` as
`### Iconography` in the adopted `<design-root>/DESIGN.md`. Record only approved or
explicitly proposed semantics:

- family and style, such as outline, filled, or duotone;
- canonical `viewBox`, optical live area, and safe-area rule;
- rendering sizes and any proven optical variants;
- stroke width, line caps, line joins, fill behavior, and corner character;
- color inheritance, interaction states, motion, and disabled treatment;
- library/asset owner, naming policy, rights, and fallback policy.

Do not universalize a `24 24` viewBox, 2px stroke, fixed header/sidebar dimensions,
or fixed palette. Those values are exact only when source-extracted or approved.
Prefer one canonical SVG geometry rendered at accepted sizes; require separate source
files only when an accepted source proves that optical variants are necessary.

## Feature-Spec Mapping

For every applicable icon role, record:

| Field | Required contract |
| --- | --- |
| Role | semantic name and task meaning, not a filename guess |
| Owner | existing library/wrapper/asset, bounded adaptation, or approved new asset |
| Presentation | approved family, render size, state, alignment, and text relationship |
| Color | accepted owner/source coloring strategy; prefer `currentColor` for ordinary single-color controls, while preserving approved brand, token, mask, paint-server, or multicolor behavior |
| Accessibility | decorative or meaningful; accessible name belongs to the enclosing control when it performs the action |
| Fallback | accepted isolated failure behavior, or `None` with evidence |
| Evidence | source identity and one allowed evidence level |

Keep SVG path data, framework props, imports, and source paths out of the Feature Spec.

## SVG Delivery Constraints

The downstream implementation contract requires:

- a self-contained SVG with no scripts, event-handler attributes, `foreignObject`,
  or external URL references;
- an accepted coloring strategy; prefer CSS/state-driven `currentColor` for ordinary
  single-color controls, but preserve source-backed brand, token, mask, paint-server,
  or multicolor behavior and do not invent product colors in path data;
- one coherent family per accepted scope, including consistent optical weight,
  caps, joins, alignment, and corner treatment;
- decorative icons hidden from assistive technology and removed from keyboard focus;
  meaningful standalone graphics named according to product semantics;
- no silent replacement with an unapproved generic fallback.

Sanitization, component APIs, sprite/build strategy, and generated source are owned by
the implementation repository. `ui-spec` must not create or edit SVG code.

## Acceptance

Require an icon-gallery or equivalent focused fixture covering every changed icon at
the required render sizes, themes, and interaction states. Acceptance checks clipping,
optical centering, baseline alignment, weight consistency, accepted color behavior,
focus/accessible naming, and fallback isolation. The downstream runtime owner must
also verify icons in the same viewport and state as each required page acceptance;
source review or gallery success alone is not runtime proof.
