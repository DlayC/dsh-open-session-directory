# dsh-open-session-folder

Adds one row to every Session's `...` menu in the sidebar: **在资源管理器中打开 /
Open in File Explorer**. The click opens that Session's working directory with the
operating system's file manager.

- Where the row goes: `sidebar.workspaces.session.menu.item`, `order: 425` — after
  Archive (400), before Copy Session ID (450).
- Which folder: the Session's working directory (`cwd`), read from the Session
  Controller list projection. A Session without a `cwd` shows a notice instead.
- How it opens: `session/openWorkspacePath`, the Session Controller's existing
  native-opening endpoint, so path verification, cancellation and platform
  differences stay with its Host owner.
- Availability: the row hides when `session/canOpenWorkspacePath` reports that
  this deployment has no native opener (for example a plain remote browser).
- A failed open, or a Session with no folder, raises one transient notice from
  `shell.overlay`; the shipped `workspace.toast` channel has a closed key set and
  is not extended by plugins.

The Host half is a row only: it owns no state, Config, or process handling.