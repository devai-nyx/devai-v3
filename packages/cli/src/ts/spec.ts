// The parts of a spec's machine block (06 §2) that `route-contract`, `sql-typed` static and
// `test-integrity` compare against code. A tolerant read: `spec-lint` (B.8) owns validation, and a
// block that does not parse here is simply not a comparison source. The W8 `parse-spec` (shared with
// `spec-lint`) replaces this reader.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LineCounter, parseDocument, isMap, isSeq, type Node as YamlNode } from 'yaml';

export interface SpecRoute {
  method: string;
  path: string;
  /** 1-based line of the route item in the spec file. */
  line: number;
  idempotency: { mode: string; header?: string; ttlMs?: number };
  roles: string[];
  errorContract: { status: number; code: string; messageKey: string }[];
  useCase: string;
  slo: { metric: string; percentile: number; maxMs: number };
}

export interface SpecColumn {
  name: string;
  type: string;
  limits: Record<string, unknown>;
  nullable: boolean;
}

export interface SpecQuery {
  name: string;
  params: string[];
}

export interface Spec {
  path: string;
  id: string;
  status: string;
  slug: string;
  routes: SpecRoute[];
  queries: SpecQuery[];
  tables: { name: string; columns: SpecColumn[] }[];
  requirements: { id: string; acceptance: string }[];
  /** `sources[].path`: the business sources the spec quotes (B.27 phase 1). */
  sources: string[];
}

const FENCE = /^## Contract\s*$[\s\S]*?^```yaml\s*$\n([\s\S]*?)^```\s*$/m;

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** The machine block of `text`, or null when there is none or it does not parse as YAML. */
export function readSpecText(path: string, text: string): Spec | null {
  const m = FENCE.exec(text);
  if (!m) return null;
  const blockLine = text.slice(0, m.index + m[0].indexOf(m[1]!)).split('\n').length;
  const lc = new LineCounter();
  const doc = parseDocument(m[1]!, { lineCounter: lc, uniqueKeys: true });
  if (doc.errors.length > 0) return null;
  const js = obj(doc.toJS());
  const routesNode = doc.get('routes', true) as YamlNode | undefined;
  const routeLines = isSeq(routesNode) ? routesNode.items.map((it) => (isMap(it) && it.range ? lc.linePos(it.range[0]).line + blockLine - 1 : blockLine)) : [];
  const routes = arr(js['routes']).map((r, i): SpecRoute => {
    const o = obj(r);
    const idem = obj(o['idempotency']);
    const slo = obj(o['slo']);
    return {
      method: str(o['method']).toUpperCase(),
      path: str(o['path']),
      line: routeLines[i] ?? blockLine,
      idempotency: { mode: str(idem['mode']), ...(typeof idem['header'] === 'string' ? { header: idem['header'] } : {}), ...(typeof idem['ttlMs'] === 'number' ? { ttlMs: idem['ttlMs'] } : {}) },
      roles: arr(o['roles']).map(str),
      errorContract: arr(o['errorContract']).map((e) => {
        const x = obj(e);
        return { status: Number(x['status']), code: str(x['code']), messageKey: str(x['messageKey']) };
      }),
      useCase: str(o['useCase']),
      slo: { metric: str(slo['metric']), percentile: Number(slo['percentile']), maxMs: Number(slo['maxMs']) },
    };
  });
  return {
    path,
    id: str(js['id']),
    status: str(js['status']),
    slug: str(obj(js['module'])['slug']),
    routes,
    queries: arr(js['queries']).map((q) => ({ name: str(obj(q)['name']), params: arr(obj(q)['params']).map(str) })),
    tables: arr(obj(js['data'])['tables']).map((t) => ({
      name: str(obj(t)['name']),
      columns: arr(obj(t)['columns']).map((c) => {
        const o = obj(c);
        return { name: str(o['name']), type: str(o['type']), limits: obj(o['limits']), nullable: o['nullable'] === true };
      }),
    })),
    requirements: arr(js['requirements']).map((r) => ({ id: str(obj(r)['id']), acceptance: str(obj(r)['acceptance']) })),
    sources: arr(js['sources']).map((x) => str(obj(x)['path'])).filter((x) => x !== ''),
  };
}

export function readSpec(root: string, path: string): Spec | null {
  try {
    return readSpecText(path, readFileSync(resolve(root, path), 'utf8'));
  } catch {
    return null;
  }
}

export const SPEC_FILE = /^specs\/.+\.md$/;

/** The approved spec of module `slug` among `paths` (06 §6: the one `approved`, not superseded), or null. */
export function specForModule(root: string, paths: readonly string[], slug: string): Spec | null {
  for (const p of paths.filter((x) => SPEC_FILE.test(x)).sort()) {
    const s = readSpec(root, p);
    if (s && s.slug === slug && s.status === 'approved') return s;
  }
  return null;
}

/** The spec whose `id` is `id` among `paths`, or null. */
export function specById(root: string, paths: readonly string[], id: string): Spec | null {
  for (const p of paths.filter((x) => SPEC_FILE.test(x)).sort()) {
    const s = readSpec(root, p);
    if (s && s.id === id) return s;
  }
  return null;
}

/** A spec column by `table.column` reference. */
export function column(spec: Spec, ref: string): SpecColumn | null {
  const [t, c] = ref.split('.');
  return spec.tables.find((x) => x.name === t)?.columns.find((x) => x.name === c) ?? null;
}
