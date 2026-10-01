# Component System And Reuse

## Contents

- Reuse Decision
- Primitive And Feature Boundaries
- shadcn/ui And Local Systems
- Console Components
- Adopted UI Boundary And Token Pipeline

Evidence basis: Twenty's dedicated UI package, Outline's reusable components
versus scene-owned components, Appwrite's consistent Console library, and
shadcn/ui's registry, composition trees, variants, slots, and Radix primitives.

## Reuse Decision

Before creating a component:

1. Search by interaction, role, visible copy, imported primitive, props, and
   style/token names, not only by the proposed filename.
2. Compare semantics, ownership, states, accessibility, density, and API.
3. Choose:
   - direct reuse when behavior and ownership match;
   - composition/slot when structure differs but the primitive contract fits;
   - variant when the difference is a stable visual or behavioral axis;
   - feature-local adaptation when the nearest implementation is a useful
     reference but has different business ownership;
   - new component only with an explicit gap.

For React, inspect boolean props as an API state space rather than flagging their count.
Report a composition problem only when mutually exclusive flags permit invalid states,
callers repeatedly assemble the same coordinated structure, or a child must reach
through unrelated props to control shared state. Prefer an established variant, slot,
explicit component, or compound composition that makes valid states clear. Preserve
independent booleans and simple prop APIs when composition would only add indirection.

Do not clone a component for a minor style change. Do not force unrelated
business cases into one abstraction merely because their JSX resembles each
other.

For Vue SFCs, search templates, imported components, emitted event names,
`v-model` arguments, slot names/scopes, provide/inject keys, and registered
names in addition to filenames. Template similarity alone does not establish a
shared component contract.

## Primitive And Feature Boundaries

- Keep buttons, dialogs, menus, popovers, fields, tables, feedback shells, and
  layout primitives business-neutral.
- Keep permissions, domain actions, entity labels, workflow decisions, and
  remote calls in feature components.
- Prefer primitive props, variants, and composition over CSS overrides that
  bypass the design system.
- A wrapper must add semantics, layout ownership, accessibility, state,
  integration, or repeated composition. Delete a one-use pass-through wrapper
  when it adds no boundary.
- Promote a feature component only after real consumers share stable behavior,
  not after an arbitrary occurrence count.
- In Vue, keep props read-only and emits explicit; preserve payload types,
  `v-model` arguments/modifiers, named/scoped slots, fallthrough attributes,
  and component names used by keep-alive or tooling.
- Treat provide/inject as an ownership contract, not an invisible replacement
  for props or a store. Review the key/default, reactive owner, mutation API,
  consumer lifetime, and cleanup before recommending it.

## shadcn/ui And Local Systems

Treat shadcn/ui as source-owned code with compositional conventions, not as an
external black box:

- inspect the installed local primitive before adding or regenerating it;
- inspect `components.json` and preserve the project's schema/style, selected
  base, tokens, icon choice, variant utility, aliases, and registry ownership;
- treat generator output as project-owned source: compare local edits and
  consumers before updating rather than assuming regeneration is harmless;
- keep compound component hierarchy valid;
- keep compound context scoped to the owning composition and fail clearly when a
  required child is rendered outside it;
- use `asChild`/slot composition only when element semantics and refs remain
  correct;
- retain dialog/menu/popover focus and labeling behavior supplied by the
  underlying primitive;
- do not introduce shadcn/ui when the feature already has another consistent
  component system.

## Console Components

For tables, filters, pagination, action bars, dialogs, empty states, and toasts,
search for the Console-wide implementation first. Page-local copies are allowed
only when their interaction contract is genuinely feature-specific.

## Adopted UI Boundary And Token Pipeline

When the inspected project declares an adoption record, audit it against live source
rather than assuming `components/ui` or a Registry exists everywhere:

- trace restricted third-party imports to declared adapter roots and bounded escape
  hatches; broad disables or undeclared business imports are boundary drift;
- compare the human component contract, Registry source/public imports, files on disk,
  exports, dependencies, and real consumers without treating the Registry as the props
  or runtime authority;
- verify `Component -> Semantic -> Primitive`, generated output parity, business-only
  Semantic consumption, component-token owner containment, and rejection of unknown,
  cyclic, bypass, or authored CSS self-references;
- distinguish static validator evidence from keyboard, focus, responsive, theme, and
  rendered visual evidence. Whole-image similarity metrics are diagnostic and cannot
  replace critical state, computed-style, geometry, or accessibility checks.

If the project has no adopted structured Registry or token pipeline, do not create a
finding merely because those optional assets are absent.
