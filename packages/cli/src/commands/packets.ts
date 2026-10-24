// 08 A.5 `devai packets status`: each packet's state derived from git only (05 §4, 02 §11) and printed
// with its evidence: drafted, frozen, candidate, accepted, merged, superseded; the highest state whose
// evidence exists wins. Reads git and `.devai/`; writes nothing.
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { commitTree, digestOf } from '../candidate/digest.js';
import { CACHE_DIR } from '../cache/store.js';
import { isAncestor, log, lsTree, revParse, show } from '../git/git.js';
import type { Format } from '../main.js';
import { frontMatter, PacketInvalid, parsePacket } from '../packet/packet.js';
import { introducing, packetsAtHead, preDag } from '../packet/rules.js';
import { packetPopulation } from './check.js';
import { setup } from './packet.js';

export type State = 'drafted' | 'frozen' | 'candidate' | 'accepted' | 'merged' | 'superseded';
export interface PacketStatus { id: string; kind: string; state: State; evidence: string; after: string[]; supersedes?: string }

const abbrev = (sha: string): string => sha.slice(0, 12);

async function statusOf(root: string, path: string, text: string, committed: boolean, atHead: { path: string; fm: Record<string, unknown> | null }[], main: string | null, population: string[]): Promise<PacketStatus> {
  const fm = frontMatter(text) ?? {};
  const id = typeof fm['id'] === 'string' ? fm['id'] : basename(path, '.md');
  const kind = typeof fm['kind'] === 'string' ? fm['kind'] : '-';
  const after = Array.isArray(fm['after']) ? fm['after'].map(String) : [];
  const out = (state: State, evidence: string): PacketStatus => ({ id, kind, state, evidence, after, ...(typeof fm['supersedes'] === 'string' ? { supersedes: fm['supersedes'] } : {}) });

  const by = atHead.find((q) => q.path !== path && q.fm?.['supersedes'] === id);
  if (by) return out('superseded', `superseded by ${String(by.fm!['id'])} (PL-16)`);
  if (!committed) return out('drafted', 'not in any commit');

  const base = typeof fm['base'] === 'string' && (await revParse(root, fm['base'])) !== null ? fm['base'] : null;
  const trailer = (await log(root, ['--all', '--format=%H', `--grep=^Packet: ${id}$`])).split('\n').filter((s) => s !== '');
  if (main !== null) {
    for (const c of trailer) if (await isAncestor(root, c, main)) return out('merged', `${abbrev(c)} on main carries Packet: ${id}`);
  }
  const candidates: string[] = [];
  for (const c of trailer) if (base !== null && (await isAncestor(root, base, c))) candidates.push(c);
  if (candidates.length > 0) {
    // accepted: the committed review bound to a trailer commit's digest, and an accepted report for it (05 §4).
    const reviewBlob = await show(root, 'HEAD', `.devai/review/${id}.json`);
    let bound: string | null = null;
    try {
      const digest = (JSON.parse(reviewBlob?.toString('utf8') ?? 'null') as { candidateDigest?: unknown } | null)?.candidateDigest;
      for (const c of candidates) if (typeof digest === 'string' && digestOf(await commitTree(root, c, base)) === digest) bound = c;
      if (bound !== null && typeof digest === 'string') {
        const report = JSON.parse(readFileSync(resolve(root, CACHE_DIR, 'reports', `${digest}.json`), 'utf8')) as { accepted?: unknown };
        if (report.accepted === true) return out('accepted', `review and accepted report bound to ${abbrev(bound)}`);
      }
    } catch {
      // no parseable review or report: the evidence is absent
    }
    if (bound !== null) return out('candidate', `review bound to ${abbrev(bound)}, no accepted report`);
    return out('candidate', `${candidates.length} commit${candidates.length === 1 ? '' : 's'} carrying Packet: ${id}, latest ${abbrev(candidates[0]!)}`);
  }
  try {
    const p = parsePacket(path, text);
    await preDag(root, p, population);
  } catch (e) {
    if (e instanceof PacketInvalid) return out('drafted', `in a commit, not complete: ${e.message}`);
    throw e;
  }
  const intro = await introducing(root, path);
  return out('frozen', intro ? `introduced in ${abbrev(intro.sha)}` : 'in a commit');
}

export async function packetsStatus(opts: { campaign?: string }, format: Format, cwd: string): Promise<{ stdout: string; exitCode: 0 }> {
  const { root } = await setup(cwd);
  const population = await packetPopulation(root);
  const atHeadPaths = new Set((await lsTree(root, 'HEAD')).map((e) => e.path));
  const atHead = await packetsAtHead(root);
  const main = await revParse(root, 'main');
  const files = population.filter((p) => /^packets\/[^/]+\/PKT-[^/]+\.md$/.test(p) && (opts.campaign === undefined || p.split('/')[1] === opts.campaign));
  const campaigns = new Map<string, PacketStatus[]>();
  for (const path of files) {
    let text: string;
    try {
      text = readFileSync(resolve(root, path), 'utf8');
    } catch {
      text = (await show(root, 'HEAD', path))?.toString('utf8') ?? '';
    }
    const s = await statusOf(root, path, text, atHeadPaths.has(path), atHead, main, population);
    const cmp = path.split('/')[1]!;
    campaigns.set(cmp, [...(campaigns.get(cmp) ?? []), s]);
  }
  const sorted = [...campaigns.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([id, packets]) => ({ id, packets: packets.sort((a, b) => (a.id < b.id ? -1 : 1)) }));
  if (format === 'json') return { stdout: JSON.stringify({ campaigns: sorted, accepted: false, exitCode: 0 }) + '\n', exitCode: 0 };
  return { stdout: sorted.flatMap((c) => c.packets.map((p) => `${p.id}  ${p.kind}  ${p.state}  ${p.evidence}`)).join('\n') + (sorted.length > 0 ? '\n' : ''), exitCode: 0 };
}
