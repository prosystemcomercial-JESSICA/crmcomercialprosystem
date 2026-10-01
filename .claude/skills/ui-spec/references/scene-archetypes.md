# Scene Archetypes and Layout Contracts

## Contents

- [Archetype Governance Rules](#archetype-governance-rules)
- [Modern SaaS Dark Dashboard](#1-modern-saas-dark-dashboard)
- [Minimalist Bento Grid](#2-minimalist-bento-grid)
- [3D Claymorphic Card](#3-3d-claymorphic-card)
- [Mobile iOS Archetype](#4-mobile-ios-archetype)
- [Technical OG / Satori Card](#5-technical-og--satori-card)
- [Acceptance and Evidence](#acceptance-and-evidence)

Load this reference when an accepted UI source, feature specification, or candidate
visual direction requires standardizing one of the five core scene archetypes:
modern SaaS dark dashboard, minimalist bento grid, 3D claymorphic card, mobile iOS
archetype, or technical OG / Satori banner card.

`ui-spec` establishes the structural, token, and slot contract; `dev-frontend`
implements component composition; and `audit-frontend` validates evidence boundaries.

## Archetype Governance Rules

1. **Negative Constraint Enforcement**:
   - Forbid hardcoded arbitrary utility values (e.g. `w-[327px]`, `text-[#1e293b]`, `p-[13px]`).
   - Forbid raw unstyled atomic HTML (`<button>`, `<input>`, unmanaged `<div>`); compose
     verified registry components.
   - Forbid ad-hoc dark mode utilities (`dark:bg-black`); bind to semantic CSS variables
     (`bg-background`, `bg-card`, `border-border`, `text-foreground`).

2. **DTCG Token Mapping**:
   - All spatial margins, gaps, padding, color steps, elevation layers, and radii must
     resolve to Design Token Community Group (DTCG) semantic tokens.

3. **Slot Protocol & Component Manifest**:
   - Explicitly define named slots for headers, media/visuals, descriptions, and action strips.
   - Never inject arbitrary margins into child components; layout parent owns distribution.

---

## 1. Modern SaaS Dark Dashboard

- **Primary Layout**: 12-column responsive adaptive grid (`grid grid-cols-12 gap-4 lg:gap-6`).
- **Elevation Hierarchy**:
  - Base: `bg-background` (`#09090b` / level 0)
  - Surface / Card: `bg-card` (`#18181b` / level 1) with `border border-border/40`
  - Elevated / Overlay: `bg-popover` (`#27272a` / level 2) with `shadow-xl`
- **Slot Composition**:
  - `Header`: Global search, tenant selector, user menu (`h-14` / `h-16`).
  - `KpiGrid`: Metric cards across columns (`col-span-12 sm:col-span-6 lg:col-span-3`).
  - `MainChart`: Primary time-series visualization (`col-span-12 lg:col-span-8 h-[340px]`).
  - `SidePanel`: Activity stream / audit log (`col-span-12 lg:col-span-4`).

---

## 2. Minimalist Bento Grid

- **Primary Layout**: Asymmetric grid (`grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[280px]`).
- **Card Micro-Interactions**:
  - Container: `group relative overflow-hidden rounded-2xl border border-border/50 bg-card`
  - Spotlight / Hover: `hover:border-primary/50 transition-colors duration-200`
- **Mandatory 3-Slot Structure**:
  1. `Slot: Header`: Icon badge + title + subtle tag.
  2. `Slot: Visual`: Interactive illustration, mini-chart, or wireframe preview (60% height).
  3. `Slot: Description`: Up to 2 lines of muted typography (`text-muted-foreground text-sm`).

---

## 3. 3D Claymorphic Card

- **Geometry**: Pill or large corner radii (`rounded-3xl` / `rounded-2xl`).
- **Inflatable Multi-Layer Shadows**:
  - Outer soft elevation: `shadow-xl shadow-black/30`
  - Inset light/dark inflation:
    `shadow-[inset_0_2px_4px_rgba(255,255,255,0.15),inset_0_-2px_4px_rgba(0,0,0,0.35)]`
- **Surface Material**:
  - Translucent soft-light surface: `bg-card/70 backdrop-blur-xl border border-white/10`
- **Constraint**: Prohibit stacking heavy 3D cards in dense data-entry tables; reserve for
  feature highlights and promotional surfaces.

---

## 4. Mobile iOS Archetype

- **Touch Target Boundary**: Minimum interactive hit target `44pt` (`min-h-[44px]` or `h-11`).
- **Safe Area Contract**:
  - Top Navigation: `sticky top-0 z-50 pt-[env(safe-area-inset-top)] backdrop-blur-md bg-background/80 border-b border-border`
  - Bottom Bar: `fixed bottom-0 left-0 right-0 pb-[env(safe-area-inset-bottom)] px-4 bg-background/80 backdrop-blur-md`
- **Native Interaction Feedback**:
  - Active state: `active:scale-[0.98] transition-transform duration-100 ease-out`
  - Typography: System font stack with dynamic type scale.

---

## 5. Technical OG / Satori Card

- **Fixed Canvas Geometry**: Fixed `1200 x 630` px canvas (`w-[1200px] h-[630px] p-16 flex flex-col justify-between`).
- **Satori / Takumi Rendering Subset**:
  - Pure Flexbox layout only (`display: flex`; `display: grid` is forbidden).
  - No CSS pseudo-elements (`::before`, `::after`).
  - Icons and graphics embedded as inline SVG or Base64 Data URI.
  - Fonts strictly bundled and registered (e.g. Inter / JetBrains Mono).
- **Slot Composition**:
  - `Header`: Brand avatar / site category + date stamp.
  - `Body`: Article title (`text-5xl font-bold leading-tight line-clamp-2`) + subtitle.
  - `Footer`: Author attribution + technology tags + domain watermark.

---

## Acceptance and Evidence

When verifying an archetype implementation:
1. Validate grid/flexbox responsive behavior against declared breakpoints.
2. Confirm zero arbitrary class violations via `eslint-plugin-tailwindcss` or AST checks.
3. Validate DOM bounding rects and computed styles under target viewport via `ops-browser`
   or Satori headless render pipeline.
4. Mark unverified visual states, animations, or external device wrappers as `Not verified`.
