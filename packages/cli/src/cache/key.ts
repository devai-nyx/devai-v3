// 08 C.4 Key: sha256(nodeId ‖ nodeVersion ‖ toolchainDigest ‖ configDigest ‖ runtimeMode ‖
// sortedInputDigests ‖ dependencyResultDigests), every component length-framed as `<len>:<bytes>`.
import { sha256 } from '../candidate/digest.js';

/** `<len>:<bytes>`, len = the byte length in decimal. */
export function frame(component: Buffer | string): Buffer {
  const bytes = typeof component === 'string' ? Buffer.from(component, 'utf8') : component;
  return Buffer.concat([Buffer.from(`${bytes.length}:`, 'utf8'), bytes]);
}

/** A list component: each element framed, the concatenation framed again by `cacheKey`. */
export const frameList = (items: readonly string[]): Buffer => Buffer.concat(items.map((i) => frame(i)));

export interface KeyParts {
  nodeId: string;
  nodeVersion: string;
  toolchainDigest: string;
  configDigest: string;
  /** `runtimeMode`, or `db-apply`'s `schemaDigest` for DB-backed nodes (W3). */
  runtimeOrSchema: string;
  /** sha256 of `<path>:<content sha256>` per declared input; sorted here. */
  inputDigests: readonly string[];
  /** `resultDigest` of each prerequisite, in prerequisite order (the caller's DAG order). */
  dependencyResultDigests: readonly string[];
  /** Node-specific trailing components: `sql-typed`'s phase, the model components of B.24/B.27. */
  extra?: readonly string[];
}

export function cacheKey(p: KeyParts): string {
  const sorted = [...p.inputDigests].sort();
  return sha256(
    Buffer.concat([
      frame(p.nodeId),
      frame(p.nodeVersion),
      frame(p.toolchainDigest),
      frame(p.configDigest),
      frame(p.runtimeOrSchema),
      frame(frameList(sorted)),
      frame(frameList(p.dependencyResultDigests)),
      ...(p.extra ?? []).map((e) => frame(e)),
    ]),
  );
}

/** One `sortedInputDigests` element: sha256 of `<path>:<blob sha>` (the content sha256 from C.6). */
export const inputDigest = (path: string, contentSha256: string | null): string => sha256(`${path}:${contentSha256 ?? 'absent'}`);

/** `configDigest`: the node's config files as framed `<path>:<content sha256|absent>`, sorted by path. */
export const configDigest = (files: readonly { path: string; sha256: string | null }[]): string =>
  sha256(frameList([...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)).map((f) => `${f.path}:${f.sha256 ?? 'absent'}`)));

/** `nodeVersion` = the DEVAI CLI version + a per-node integer bumped when a contract changes. */
export const nodeVersion = (cliVersion: string, contract: number): string => `${cliVersion}+${contract}`;
