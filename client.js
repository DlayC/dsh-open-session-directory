/**
 * Client half of `dsh-open-session-folder`.
 *
 * Adds two rows to the Session row's "..." menu
 * (`sidebar.workspaces.session.menu.item`):
 *
 * 1. `在资源管理器中打开工作区` — the Session's working directory.
 * 2. `在资源管理器中打开会话记录` — the Session's own folder under the
 *    session-log root, derived from the documented on-disk layout
 *    `<root>/--<normalized cwd>--/<encoded session id>/`.
 *
 * Both hand an absolute path to the Host's `session/openWorkspacePath` endpoint,
 * which verifies the path against the composed filesystem and opens it with the
 * operating system's file manager. Neither row retains, resumes, or activates
 * the Session.
 *
 * The log root reaches this half as the plugin row's volatile `sessionsRoot`
 * Config value through the Client settings form store; `index.js` computes its
 * default in the Host process.
 */
window.__ModuleLoader__.load({
  id: 'dsh-open-session-folder',
  factory: (require) => {
    const React = require('react');
    const h = React.createElement;
    /** Locale namespace; also the prefix of both menu-entry ids. */
    const NS = 'dsh-open-session-folder';
    /** Session row "..." menu list slot. */
    const SLOT = 'sidebar.workspaces.session.menu.item';
    /** Profile patch row id: this plugin's settings form namespace. */
    const ENTRY_ID = 'open-session-folder';
    const PACKAGE = 'dsh-open-session-folder';

    /**
     * Host menu primitive and icons, resolved through the loader's baseline
     * externals. The local button and SVG icons below carry the same look, so a
     * package that cannot resolve the primitive still renders consistent rows.
     */
    let primitives;
    try {
      primitives = require('@deepseek-ai/dsh-client-ui-primitives');
    } catch {
      primitives = undefined;
    }
    const MenuItemButton = typeof primitives?.MenuItemButton === 'function' ? primitives.MenuItemButton : undefined;
    const IconFolder = typeof primitives?.IconFolderOpenOutlineRegular === 'function'
      ? primitives.IconFolderOpenOutlineRegular
      : undefined;
    const IconRecords = typeof primitives?.IconDatabaseOutlineRegular === 'function'
      ? primitives.IconDatabaseOutlineRegular
      : undefined;

    const zh = {
      openWorkspace: '在资源管理器中打开工作区',
      openRecords: '在资源管理器中打开会话记录',
      opening: '正在打开…',
      noFolder: '这个会话还没有本地工作目录，没有可以打开的文件夹。',
      noRoot: '没有读到会话日志根目录（sessionsRoot 配置缺失），无法定位这个会话的记录文件夹。',
      failed: '打不开这个文件夹：',
    };

    const en = {
      openWorkspace: 'Open Workspace in File Explorer',
      openRecords: 'Open Session Records in File Explorer',
      opening: 'Opening…',
      noFolder: 'This session has no working directory yet, so there is no folder to open.',
      noRoot: 'The session-log root is unavailable (no sessionsRoot value), so this session\'s record folder cannot be located.',
      failed: 'Could not open this folder:',
    };

    const ROW_CSS = `
.dsh-osf-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
  margin: 0;
  padding: 7px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  line-height: 18px;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}
.dsh-osf-item:hover { background: var(--dsw-alias-bg-layer-2); }
.dsh-osf-item:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: -2px;
}
.dsh-osf-item:disabled { color: var(--dsw-alias-label-secondary); cursor: default; }
.dsh-osf-notice {
  position: fixed;
  left: 50%;
  bottom: 88px;
  transform: translateX(-50%);
  max-width: min(560px, calc(100vw - 32px));
  padding: 10px 14px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px;
  background: var(--dsw-alias-bg-overlay);
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 18px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 18%);
  pointer-events: none;
  z-index: 60;
}
`;

    /** Same 14px outline style the host menu icons use. */
    function FallbackIcon({ kind }) {
      const stroke = {
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      };
      if (kind === 'records') {
        return h('svg', { width: 14, height: 14, viewBox: '0 0 14 14', 'aria-hidden': true }, [
          h('ellipse', { key: 'top', cx: 7, cy: 3.5, rx: 4.5, ry: 2, ...stroke }),
          h('path', { key: 'body', d: 'M2.5 3.5v7c0 1.1 2 2 4.5 2s4.5-.9 4.5-2v-7', ...stroke }),
          h('path', { key: 'mid', d: 'M2.5 7c0 1.1 2 2 4.5 2s4.5-.9 4.5-2', ...stroke }),
        ]);
      }
      return h('svg', { width: 14, height: 14, viewBox: '0 0 14 14', 'aria-hidden': true }, [
        h('path', {
          key: 'folder',
          d: 'M1.5 4.2c0-.7.6-1.2 1.2-1.2h2.6L6.6 4.4h4.2c.7 0 1.2.6 1.2 1.2v4.9c0 .7-.6 1.2-1.2 1.2H2.7c-.7 0-1.2-.6-1.2-1.2z',
          ...stroke,
        }),
      ]);
    }

    /**
     * Unwrap a Remote result: generated Client methods answer with the value or
     * with `{ ok: false, error }`; a plain value passes through.
     * @param result - the Remote response.
     * @returns the value, or undefined for a failure.
     */
    function unwrap(result) {
      if (result === null || result === undefined) return undefined;
      if (typeof result.ok === 'boolean') return result.ok ? result.value : undefined;
      return result;
    }

    /**
     * Read the failure message a Remote response carries.
     * @param result - the Remote response.
     * @returns the message, or undefined when the call succeeded.
     */
    function failureOf(result) {
      if (result === null || result === undefined) return undefined;
      if (result.ok !== false) return undefined;
      return result.error?.message ?? result.error?.code ?? 'unknown error';
    }

    /** Whether this deployment can hand a path to the OS file manager. */
    const availability = {
      known: false,
      openable: true,
      listeners: new Set(),
    };

    function publishOpenable(openable) {
      availability.known = true;
      availability.openable = openable === true;
      for (const listener of availability.listeners) listener();
    }

    function useOpenable() {
      const [, bump] = React.useState(0);
      React.useEffect(() => {
        const listener = () => bump((value) => value + 1);
        availability.listeners.add(listener);
        return () => availability.listeners.delete(listener);
      }, []);
      return availability;
    }

    /** One transient frame-wide notice, owned by this package. */
    const notice = {
      text: '',
      listeners: new Set(),
      timer: undefined,
    };

    function publishNotice() {
      for (const listener of notice.listeners) listener();
    }

    function showNotice(text) {
      notice.text = text;
      publishNotice();
      if (notice.timer !== undefined) clearTimeout(notice.timer);
      notice.timer = setTimeout(() => {
        notice.timer = undefined;
        notice.text = '';
        publishNotice();
      }, 8000);
    }

    /** Coalesce the list read: a menu click needs one row, not one call per row. */
    let listAt = 0;
    let listPromise;

    function sessionRows(remote) {
      const now = Date.now();
      if (listPromise !== undefined && now - listAt < 5000) return listPromise;
      listAt = now;
      listPromise = Promise.resolve()
        .then(() => remote.list({}))
        .then((result) => {
          const failure = failureOf(result);
          if (failure !== undefined) throw new Error(failure);
          const value = unwrap(result);
          return Array.isArray(value?.items) ? value.items : [];
        })
        .catch((error) => {
          listPromise = undefined;
          throw error;
        });
      return listPromise;
    }

    /**
     * The session-log backend's project directory key.
     *
     * Mirrors the documented on-disk layout: separators collapse to one `-`,
     * unsafe code units become `~XXXX`, and the readable key is wrapped in `--`
     * and bounded for filesystem component limits.
     * @param cwd - the Session's working directory.
     * @returns the project directory name under the log root.
     */
    function projectKey(cwd) {
      let readable = '';
      let separatorRun = false;
      for (let index = 0; index < cwd.length; index += 1) {
        const code = cwd.charCodeAt(index);
        const ch = String.fromCharCode(code);
        if (ch === '/' || ch === '\\' || ch === ':') {
          if (!separatorRun) readable += '-';
          separatorRun = true;
        } else if (ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch)) {
          readable += ch;
          separatorRun = false;
        } else {
          readable += `~${code.toString(16).toUpperCase().padStart(4, '0')}`;
          separatorRun = false;
        }
      }
      return `--${(readable.replace(/^-+/, '') || 'root').slice(0, 251)}--`;
    }

    /**
     * The session-log backend's single-segment id encoding.
     * @param raw - the Session id.
     * @returns one filesystem-safe path segment.
     */
    function encodeSegment(raw) {
      if (raw === '.') return '~002E';
      if (raw === '..') return '~002E~002E';
      let out = '';
      for (let index = 0; index < raw.length; index += 1) {
        const code = raw.charCodeAt(index);
        const ch = String.fromCharCode(code);
        if (ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch)) out += ch;
        else out += `~${code.toString(16).toUpperCase().padStart(4, '0')}`;
      }
      return out;
    }

    /**
     * Join path segments with the separator style the root uses.
     * @param parts - root first, then child names.
     * @returns the joined absolute path.
     */
    function joinPath(...parts) {
      const [root] = parts;
      const separator = typeof root === 'string' && root.includes('\\') ? '\\' : '/';
      return parts
        .filter((part) => typeof part === 'string' && part.length > 0)
        .map((part, index) => (index === 0 ? part.replace(/[\\/]+$/, '') : part.replace(/^[\\/]+|[\\/]+$/g, '')))
        .join(separator);
    }

    /**
     * Derive one Session's record directory from the documented layout.
     * @param root - the configured session-log root.
     * @param cwd - the Session's working directory, or undefined.
     * @param sessionId - the Session whose folder is wanted.
     * @returns the absolute directory path.
     */
    function recordsDirectory(root, cwd, sessionId) {
      const project = typeof cwd === 'string' && cwd !== '' ? projectKey(cwd) : '_no-cwd';
      return joinPath(root, project, encodeSegment(sessionId));
    }

    /**
     * Read one string field from the plugin's settings form snapshot.
     * @param store - the Client config-form store, when available.
     * @param key - field name.
     * @returns the value, or undefined when absent.
     */
    function configValue(store, key) {
      if (store === undefined || store === null) return undefined;
      let snapshot;
      try {
        snapshot = typeof store.getSnapshot === 'function' ? store.getSnapshot() : store;
      } catch {
        return undefined;
      }
      const sources = [snapshot?.value, snapshot?.inherited, snapshot?.defaults, snapshot?.schema?.defaults];
      for (const source of sources) {
        if (source === null || typeof source !== 'object') continue;
        let raw = source[key];
        if (raw === undefined || raw === null) continue;
        if (typeof raw?.get === 'function') raw = raw.get();
        if (typeof raw === 'string' && raw !== '') return raw;
      }
      return undefined;
    }

    /**
     * Find this plugin's own settings form among the Loader-defined entry keys.
     * @param forms - the Client `configForms` service.
     * @returns the store, or undefined.
     */
    function pickFormStore(forms) {
      if (forms === undefined || forms === null) return undefined;
      for (const key of [ENTRY_ID, `include:${ENTRY_ID}`, PACKAGE]) {
        try {
          const store = typeof forms.get === 'function' ? forms.get(key) : undefined;
          if (store !== undefined && store !== null) return store;
        } catch {
          // Try the next candidate key.
        }
      }
      return undefined;
    }

    /**
     * Open one absolute path through the Host's native opener.
     * @param remote - the Client `session` Remote namespace.
     * @param path - absolute Host path.
     * @param t - bound translator for this package's namespace.
     */
    async function openPath(remote, path, t) {
      const result = await remote.openWorkspacePath({ path });
      const failure = failureOf(result);
      if (failure !== undefined) showNotice(`${t('failed')} ${path} — ${failure}`);
    }

    /**
     * Open one Session's working directory.
     * @param remote - the Client `session` Remote namespace.
     * @param sessionId - Session whose folder the row belongs to.
     * @param t - bound translator for this package's namespace.
     */
    async function openWorkspace(remote, sessionId, t) {
      const rows = await sessionRows(remote);
      const row = rows.find((item) => item?.sessionId === sessionId);
      const path = typeof row?.cwd === 'string' && row.cwd !== '' ? row.cwd : undefined;
      if (path === undefined) {
        showNotice(t('noFolder'));
        return;
      }
      await openPath(remote, path, t);
    }

    /**
     * Open one Session's record directory under the session-log root.
     * @param remote - the Client `session` Remote namespace.
     * @param transport - shared plugin state, carrying the settings store.
     * @param sessionId - Session whose folder the row belongs to.
     * @param t - bound translator for this package's namespace.
     */
    async function openRecords(remote, transport, sessionId, t) {
      const root = configValue(transport.configStore, 'sessionsRoot');
      if (root === undefined) {
        showNotice(t('noRoot'));
        return;
      }
      const rows = await sessionRows(remote);
      const row = rows.find((item) => item?.sessionId === sessionId);
      const cwd = typeof row?.cwd === 'string' && row.cwd !== '' ? row.cwd : undefined;
      await openPath(remote, recordsDirectory(root, cwd, sessionId), t);
    }

    /** One Session row's menu entry; `kind` selects workspace or records. */
    function SessionFolderRow(props, kind) {
      const t = typeof props.t === 'function' ? props.t : (key) => key;
      const remote = props.transport?.sessionRemote;
      const state = useOpenable();
      const [busy, setBusy] = React.useState(false);

      // The menu's own open state, bound by the owner into this occurrence.
      const hook = props.useMenuOpenState;
      const pair = typeof hook === 'function' ? hook() : undefined;
      const setMenuOpen = Array.isArray(pair) ? pair[1] : undefined;

      if (state.known && !state.openable) return null;

      const select = () => {
        if (busy) return;
        if (typeof setMenuOpen === 'function') setMenuOpen(false);
        setBusy(true);
        void Promise.resolve()
          .then(() => (kind === 'records'
            ? openRecords(remote, props.transport, props.sessionId, t)
            : openWorkspace(remote, props.sessionId, t)))
          .catch((error) => showNotice(`${t('failed')} ${String(error?.message ?? error)}`))
          .finally(() => setBusy(false));
      };

      const Icon = kind === 'records' ? IconRecords : IconFolder;
      const icon = Icon !== undefined
        ? h(Icon, { size: 14 })
        : h(FallbackIcon, { kind });
      const label = busy ? t('opening') : t(kind === 'records' ? 'openRecords' : 'openWorkspace');

      return h(React.Fragment, null, [
        h('style', { key: 'style' }, ROW_CSS),
        MenuItemButton !== undefined
          ? h(MenuItemButton, { key: 'item', icon, onSelect: select }, label)
          : h('button', {
            key: 'item',
            type: 'button',
            role: 'menuitem',
            className: 'dsh-osf-item',
            onClick: select,
          }, [icon, h('span', { key: 'label' }, label)]),
      ]);
    }

    function WorkspaceRow(props) {
      return SessionFolderRow(props, 'workspace');
    }

    function RecordsRow(props) {
      return SessionFolderRow(props, 'records');
    }

    /** The package's single transient notice, rendered in the frame overlay. */
    function NoticeOverlay() {
      const [, bump] = React.useState(0);
      React.useEffect(() => {
        const listener = () => bump((value) => value + 1);
        notice.listeners.add(listener);
        return () => notice.listeners.delete(listener);
      }, []);
      if (notice.text === '') return null;
      return h('div', { className: 'dsh-osf-notice', role: 'status', 'aria-live': 'polite' }, notice.text);
    }

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'open-session-folder: dictionaries');
      const t = typeof ctx.locale.bind === 'function' ? ctx.locale.bind(NS) : (key) => key;
      const transport = { sessionRemote: undefined, configStore: undefined };
      let registered = false;

      // Both rows need the Remote face; the settings store is optional because a
      // deployment without the settings service still opens working directories.
      const registerRows = () => {
        if (registered || transport.sessionRemote === undefined) return;
        registered = true;
        ctx.slots.inject(SLOT, () => ctx.slots.register({
          name: SLOT,
          id: NS,
          order: 425,
          locale: NS,
          label: () => t('openWorkspace'),
          inject: () => ({ transport }),
        }, WorkspaceRow));
        ctx.slots.inject(SLOT, () => ctx.slots.register({
          name: SLOT,
          id: `${NS}-records`,
          order: 435,
          locale: NS,
          label: () => t('openRecords'),
          inject: () => ({ transport }),
        }, RecordsRow));
      };

      ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: `${NS}-notice`,
        order: 900,
      }, NoticeOverlay));

      ctx.inject(['configForms'], (owner) => {
        transport.configStore = pickFormStore(owner.configForms);
        registerRows();
      });

      ctx.inject(['remote', 'remote.session'], (owner) => {
        const remote = owner.remote?.session;
        if (remote === undefined || remote === null) return;
        transport.sessionRemote = remote;

        // Ask once whether this deployment owns a native opener. A deployment
        // without one hides both rows instead of failing on every click.
        Promise.resolve()
          .then(() => remote.canOpenWorkspacePath())
          .then((result) => {
            const value = unwrap(result);
            publishOpenable(typeof value === 'boolean' ? value : true);
          })
          .catch(() => publishOpenable(true));

        registerRows();
      });
    }

    return { apply, inject: ['slots', 'locale'] };
  },
});