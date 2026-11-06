# dsh-open-session-folder

Two rows in every Session's `...` menu in the sidebar:

| Row | Opens |
|---|---|
| **在资源管理器中打开工作区** / **Open Workspace in File Explorer** | the Session's working directory (`cwd`) |
| **在资源管理器中打开会话记录** / **Open Session Records in File Explorer** | the Session's own folder under the session-log root |

- Both live in `sidebar.workspaces.session.menu.item`: `order 425` (working
  folder) and `435` (records), after Archive (400) and before Copy Session ID
  (450), using the host's `MenuItemButton` and 14px outline icons.
- Opening uses `session/openWorkspacePath`, the Session Controller's existing
  native opener. It verifies the path against the composed filesystem and does
  not require the path to be a registered Workspace, so a log directory under
  `$DSH_HOME` opens the same way.
- The records directory follows the session-log backends' documented layout:
  `<root>/--<normalized cwd>--/<encoded session id>/`. The normalization and the
  id encoding are mirrored in `client.js` (separators collapse to `-`, unsafe
  code units become `~XXXX`, the key is wrapped in `--` and bounded).
- The log root reaches the Client as this row's volatile `sessionsRoot` Config
  value through the Client settings form; its default is computed in the Host
  process as `$DSH_HOME/sessions`. Set it in the row config for a custom root.
- Both rows hide when `session/canOpenWorkspacePath` reports no native opener
  (for example a plain remote browser). A missing folder, missing `cwd`, or a
  Host refusal raises one transient notice from `shell.overlay` naming the path
  and the reason.

## Per-row switches on the Plugins page

Clicking the bundle on **Plugins → Installed plugins** opens its page, which
renders this package's configuration card between the description and the rows:
one switch for each Session menu row.

| Config field | Default | Effect |
|---|---|---|
| `workspaceRow` | `true` | shows/hides **在资源管理器中打开工作区** |
| `recordsRow` | `true` | shows/hides **在资源管理器中打开会话记录** |
| `sessionsRoot` | `$DSH_HOME/sessions` | root the records row derives its folder from |

The card is the `plugins.bundle.config` slot keyed by the package name; it reads
and writes the same row Config the Client menu rows read, so a change applies to
the open page without a reload. Turning a row off only hides it — the menu item
and its click path stay loaded.

The Host half owns no state, process handling, or file I/O.

## Development

The plugin is a git repository at this directory. Install it into the desktop
profile by pointing `plugin_manager` `install_bundle` at this absolute path;
the profile links the directory, so a commit is all that is needed to record a
version.