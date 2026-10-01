# Desktop And Tauri

Evidence basis: GitButler's `IBackend`/Tauri adapter, Rust API and command
boundaries, generated SDK, menu events, shortcut service, and update progress;
Tauri's official command, async command, event, and channel documentation.

## Boundary

Use this dependency direction:

```text
page/component
→ feature service or frontend backend adapter
→ typed IPC command/event/channel contract
→ thin Tauri transport command
→ Rust API/domain owner
→ persistence, filesystem, Git, SQLite, or platform integration
```

- Do not call Tauri APIs throughout page components.
- Do not expose Rust crate names, internal enums, paths, locks, or database
  details as page concerns.
- Keep command arguments/results stable and serializable. Map errors to typed
  user-actionable frontend categories instead of matching strings.
- Keep business logic and resource ownership in Rust domain owners, not command
  registration functions.

## Frequency And Long Work

- Avoid high-frequency per-row/per-keystroke command calls. Batch, debounce,
  cache, move computation, or subscribe to a stream when semantics allow.
- Use async commands for heavy work.
- For long SQLite, filesystem, Git, import/export, indexing, or AI work, expose
  determinate/indeterminate progress, cancellation, terminal success/error, and
  cleanup.
- Prefer a channel or scoped event stream for progress. Define task identity,
  ordering, listener cleanup, cancellation race behavior, and what happens if
  the window closes or route changes.
- Do not fake progress with timers when real milestones exist.

## Windows, Menus, And Shortcuts

- Keep menu and shortcut identifiers centralized and consistent across Rust and
  frontend listeners.
- Unlisten on teardown and avoid duplicate registration.
- Do not trigger global shortcuts while the user is typing unless explicitly
  intended; check editable targets and composition/IME behavior.
- Restore focus after dialogs and window-level actions.
- Test platform-specific menu labels, window behavior, filesystem paths, and
  modifier keys on supported platforms or mark them `Not verified`.

## Validation

Static type checks do not prove desktop behavior. Use the real client for window,
menu, shortcut, file dialog, progress, cancellation, and native error evidence.
Route Rust implementation review to the repository's Rust workflow.
