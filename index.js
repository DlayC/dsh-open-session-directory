/**
 * Host half of `dsh-open-session-folder`.
 *
 * The whole feature is a Client-side action: the row reads the Session's
 * working directory from the Session Controller's list projection and hands the
 * path to the existing `session/openWorkspacePath` Remote endpoint, whose Host
 * owner owns native file-manager discovery, path verification, cancellation and
 * platform differences. This package therefore needs no Host state, no Config,
 * and no native process handling of its own.
 *
 * @module dsh-open-session-folder
 */
export function apply() {}
