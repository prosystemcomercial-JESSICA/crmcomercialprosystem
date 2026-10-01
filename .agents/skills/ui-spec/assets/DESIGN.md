---
name: "Replace with accepted design-system name"
description: "Replace with verified visual authority summary for the selected design system"
colors: {}
typography: {}
spacing: {}
rounded: {}
components: {}
---

## Overview

- Replace this section with a concise, verified summary of brand intent and audience.
- Keep prose factual and linked to accepted product ownership.

## Colors

- Replace the empty `colors` map with approved machine tokens, then name at least one
  token here in backticks and describe where it applies.

## Typography

- Replace the empty `typography` map with approved machine tokens, then bind named
  tokens here to headings, body copy, labels, and fallback behavior.

## Layout

- Replace the empty `spacing` map with approved machine tokens, then bind named tokens
  here to layout rhythm, component gaps, and container behavior.

## Elevation & Depth

- Replace with verified shadow, border, divider, and layering behavior.

## Shapes

- Replace the empty `rounded` map with approved machine tokens, then bind named tokens
  here to specific surfaces and controls.

## Components

- When shared component consumers exist, replace the empty `components` map with
  component token entries and bind at least one entry here to its states and variants.
- A genuinely unused group may instead move to frontmatter `omitted` as an object with
  `section` and a concrete `reason`; repeat that reason verbatim in its standard section.

### Iconography

- When shared SVG iconography applies, bind the approved icon family and owner to its
  canonical geometry, rendering sizes, visual states, accepted coloring strategy,
  accessibility, rights, and isolated fallback or evidenced `None` disposition.
- Keep exact viewBox, live area, stroke, cap/join, and size values source-backed or
  explicitly proposed; do not treat the starter's absence of values as permission to
  invent a universal icon system.

## Do's and Don'ts

- Do: keep implementation choices aligned to `DESIGN.md` scope and approved tokens.
- Do not: add parallel token systems or duplicate shared component semantics.
