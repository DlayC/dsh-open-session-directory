/**
 * Host half of `dsh-open-session-folder`.
 *
 * Both menu rows open a directory through the Session Controller's native
 * opener, which the Client already calls directly, so the Host half owns no
 * state and handles no process. Its one job is to publish the session-log root
 * the Client needs for the "open session records" row: the `sessionsRoot`
 * Config field below, defaults to `<DSH_HOME>/sessions` as computed here, in the
 * Host process that actually knows that home directory.
 *
 * The field is volatile so the settings service publishes this row's form
 * document, which is how the Client reads the effective value without the
 * Host and the browser sharing any memory.
 *
 * @module dsh-open-session-folder
 */
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

const require = createRequire(import.meta.url);

/** @returns the Harness home directory, honouring `$DSH_HOME`. */
function resolveDshHome() {
  const configured = process.env.DSH_HOME;
  if (typeof configured === 'string' && configured.trim() !== '') return configured.trim();
  return join(homedir(), '.dsh');
}

/**
 * Resolve a package that ships inside the dsh installation.
 *
 * A bundle authored in a workspace is installed as a link, so Node resolves its
 * bare imports against the workspace rather than the profile's module store.
 * The desktop Host passes the dsh runtime directory as its second argument, and
 * that directory's own `node_modules` holds the copy this plugin is built
 * against; the install anchor and the bare specifier are the fallbacks.
 * @param name - Package name, such as `@deepseek-ai/schemastery`.
 * @returns an absolute package path, or the bare name when nothing else resolves.
 */
function resolveShippedPackage(name) {
  const runtimeDir = process.argv[2];
  if (typeof runtimeDir === 'string' && runtimeDir !== '' && isAbsolute(runtimeDir)) {
    const candidate = join(runtimeDir, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) return candidate;
  }
  try {
    let directory = import.meta.resolve('@deepseek-ai/dsh-home-paths');
    for (let depth = 0; depth < 8 && directory.length > 3; depth += 1) {
      directory = directory.slice(0, directory.lastIndexOf('/'));
      if (directory.endsWith('/node_modules')) {
        const candidate = `${directory}/${name}`;
        if (existsSync(`${candidate}/package.json`)) return candidate;
      }
    }
  } catch {
    // The anchor is optional; fall through to the bare specifier.
  }
  return name;
}

/**
 * Load the schema factory from the dsh installation.
 * @returns the schemastery default export, or undefined when it is unavailable.
 */
function loadSchemaFactory() {
  try {
    const loaded = require(resolveShippedPackage('@deepseek-ai/schemastery'));
    const factory = loaded?.default ?? loaded;
    if (typeof factory?.object === 'function') return factory;
  } catch {
    // Without the factory the row keeps its bundle defaults and no form exists.
  }
  return undefined;
}

const z = loadSchemaFactory();

/**
 * Mark one field volatile so the settings service publishes this row's form.
 * @param field - Field schema.
 * @returns the field carrying `meta.volatile`.
 */
function volatileField(field) {
  if (typeof field.volatile === 'function') return field.volatile();
  return field.extra('volatile', true);
}

/** The session-log root the Client derives per-session directories from. */
const DEFAULT_SESSIONS_ROOT = join(resolveDshHome(), 'sessions');

export const Config = z === undefined ? undefined : z.object({
  sessionsRoot: volatileField(z.string().default(DEFAULT_SESSIONS_ROOT)
    .description(
      '会话日志根目录，用来定位每个会话在磁盘上的记录文件夹；默认 $DSH_HOME/sessions / '
      + 'Root directory of per-Session logs, used to locate each Session\'s on-disk record folder; '
      + 'defaults to $DSH_HOME/sessions',
    )),
});

export function apply() {}