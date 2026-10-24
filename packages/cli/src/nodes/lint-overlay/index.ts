// 08 B.3 the v3 ESLint overlay: flat-config blocks laid over the published STYNX profiles. It adds only
// what `@stynx-nyx/eslint-config` 3.0.0 lacks [fact: its plugin ships `stynx/no-authored-cjs`,
// `stynx/require-package-index-tsdoc`, `stynx/require-idempotent-route-decorator`,
// `P:@stynx-nyx/eslint-config@3.0.0/plugin.mjs:43-164`; the strict default already sets D-013's
// levels, the idempotent-route rule and `boundaries/dependencies` `'disallow'`, `index.mjs:117-161,266`;
// D-089 a1]: the five `devai/*` rules, and `@angular-eslint/template/i18n` for `*.html`, which
// `createAngularConfig`'s template block does not enable (`index.mjs:292-313`). The rule→standard map
// (B.3 Findings) is here too, read by the `lint` adapter.
//
// The rules are plain ESLint rule objects over the ESTree that `@typescript-eslint/parser` produces;
// nothing here imports ESLint or a plugin (07 §7: the overlay is data plus five visitors).

/** The ESTree subset the visitors read. */
interface Node {
  type: string;
  parent?: Node;
  [key: string]: unknown;
}
interface RuleContext {
  filename: string;
  options: readonly unknown[];
  sourceCode: { parserServices?: ParserServices };
  report(d: { node: Node; messageId: string; data?: Record<string, string> }): void;
}
/** typescript-eslint's typed services, when the profile gives the parser a `project`. */
interface ParserServices {
  program?: { getTypeChecker(): Checker } | null;
  esTreeNodeToTSNodeMap?: { get(n: Node): unknown };
}
interface TsSymbol { getName(): string }
interface TsType {
  aliasSymbol?: TsSymbol;
  getSymbol(): TsSymbol | undefined;
  isUnion(): boolean;
  isIntersection(): boolean;
  types?: TsType[];
  isClassOrInterface(): boolean;
}
interface Checker {
  getTypeAtLocation(n: unknown): TsType;
  getBaseTypes(t: TsType): TsType[];
}
export interface Rule {
  meta: { type: 'problem' | 'suggestion'; docs: { description: string }; messages: Record<string, string>; schema: unknown[] };
  create(context: RuleContext): Record<string, (node: Node) => void>;
}

const basename = (path: string): string => path.split(/[\\/]/).pop() ?? path;
const identName = (n: unknown): string | null => {
  const node = n as Node | null | undefined;
  return node?.type === 'Identifier' ? (node['name'] as string) : null;
};
/** The called name of a decorator, `@X()` or `@X`. */
const decoratorName = (d: Node): string | null => {
  const e = d['expression'] as Node;
  return e.type === 'CallExpression' ? identName(e['callee']) : identName(e);
};

const noEnum: Rule = {
  meta: { type: 'problem', docs: { description: 'S-36: no enum; use a string-literal union or an as const object' }, messages: { enum: 'enum {{name}} is not allowed (S-36)' }, schema: [] },
  create: (context) => ({
    TSEnumDeclaration(node) {
      context.report({ node, messageId: 'enum', data: { name: identName(node['id']) ?? '?' } });
    },
  }),
};

/** S-38: tool-mandated config entry points follow the tool's contract (08 B.3). */
const DEFAULT_EXPORT_EXEMPT = /^(eslint|vitest|playwright)\.config\.[^/]+$/;
const namedExportsOnly: Rule = {
  meta: { type: 'suggestion', docs: { description: 'S-36/S-38: named exports only' }, messages: { default: 'default export is not allowed; export by name (S-38)' }, schema: [] },
  create: (context) => {
    if (DEFAULT_EXPORT_EXEMPT.test(basename(context.filename))) return {};
    return {
      ExportDefaultDeclaration(node) {
        context.report({ node, messageId: 'default' });
      },
      ExportSpecifier(node) {
        const exported = node['exported'] as Node;
        if (identName(exported) === 'default' || exported['value'] === 'default') context.report({ node, messageId: 'default' });
      },
    };
  },
};

/** D-032: selectors `<prefix>-`, DI tokens `<PREFIX>_`, classes `<Prefix>` (S-36: public modules, services, components). */
const PREFIXED_CLASS_DECORATORS = new Set(['Component', 'Injectable', 'Module', 'Controller']);
const productPrefix: Rule = {
  meta: {
    type: 'suggestion',
    docs: { description: 'S-36, D-032: product prefix on selectors, DI tokens and public classes' },
    messages: {
      class: 'class {{name}} lacks the {{prefix}} prefix (D-032)',
      selector: 'selector {{name}} lacks the {{prefix}} prefix (D-032)',
      token: 'DI token {{name}} lacks the {{prefix}} prefix (D-032)',
    },
    schema: [{ type: 'object', properties: { prefix: { type: 'string', pattern: '^[a-z][a-z0-9]*$' } }, required: ['prefix'], additionalProperties: false }],
  },
  create: (context) => {
    const prefix = (context.options[0] as { prefix: string } | undefined)?.prefix;
    if (!prefix) return {};
    const Prefix = prefix[0]!.toUpperCase() + prefix.slice(1);
    const PREFIX = prefix.toUpperCase();
    return {
      ClassDeclaration(node) {
        const decorators = ((node['decorators'] as Node[] | undefined) ?? []);
        const names = decorators.map(decoratorName);
        const name = identName(node['id']);
        if (name && node.parent?.type === 'ExportNamedDeclaration' && names.some((n) => n !== null && PREFIXED_CLASS_DECORATORS.has(n)) && !name.startsWith(Prefix)) {
          context.report({ node, messageId: 'class', data: { name, prefix: Prefix } });
        }
        for (const d of decorators) {
          if (decoratorName(d) !== 'Component') continue;
          const call = d['expression'] as Node;
          const arg = (call['arguments'] as Node[] | undefined)?.[0];
          if (arg?.type !== 'ObjectExpression') continue;
          for (const p of arg['properties'] as Node[]) {
            const value = p['value'] as Node | undefined;
            if (p.type !== 'Property' || identName(p['key']) !== 'selector' || value?.type !== 'Literal' || typeof value['value'] !== 'string') continue;
            for (const s of (value['value'] as string).split(',').map((x) => x.trim())) {
              // Element selectors only; attribute and class selectors are a directive's (Open in the W2a PR).
              if (/^[a-zA-Z]/.test(s) && !s.startsWith(`${prefix}-`)) context.report({ node: value, messageId: 'selector', data: { name: s, prefix: `${prefix}-` } });
            }
          }
        }
      },
      VariableDeclarator(node) {
        const init = node['init'] as Node | null;
        const name = identName(node['id']);
        if (name && init?.type === 'NewExpression' && identName(init['callee']) === 'InjectionToken' && !name.startsWith(`${PREFIX}_`)) {
          context.report({ node, messageId: 'token', data: { name, prefix: `${PREFIX}_` } });
        }
      },
    };
  },
};

/** 02 §2 `layout` phrase, enforced as an AST rule: `defineQuery(` only in `*.repository.ts` (08 B.3). */
const defineQueryLocation: Rule = {
  meta: { type: 'problem', docs: { description: '02 §3: defineQuery( only in *.repository.ts' }, messages: { location: 'defineQuery( outside a *.repository.ts file (02 §3)' }, schema: [] },
  create: (context) => {
    if (basename(context.filename).endsWith('.repository.ts')) return {};
    return {
      CallExpression(node) {
        const callee = node['callee'] as Node;
        const name = identName(callee) ?? (callee.type === 'MemberExpression' && !callee['computed'] ? identName(callee['property']) : null);
        if (name === 'defineQuery') context.report({ node, messageId: 'location' });
      },
    };
  },
};

/**
 * 02 §3: `.query(`/`.execute(` on `Transaction`/`PoolClient`, aliases and indirect imports included, so
 * the receiver is resolved through the type checker; without typed services (a profile without
 * `project`) the rule reports nothing (Open in the W2a PR).
 */
const RAW_RECEIVERS = new Set(['Transaction', 'PoolClient']);
function receiverNames(checker: Checker, t: TsType, seen = new Set<TsType>()): string[] {
  if (seen.has(t)) return [];
  seen.add(t);
  if ((t.isUnion() || t.isIntersection()) && t.types) return t.types.flatMap((m) => receiverNames(checker, m, seen));
  const names = [t.aliasSymbol?.getName(), t.getSymbol()?.getName()].filter((n): n is string => n !== undefined);
  if (t.isClassOrInterface()) for (const b of checker.getBaseTypes(t)) names.push(...receiverNames(checker, b, seen));
  return names;
}
const noRawQuery: Rule = {
  meta: { type: 'problem', docs: { description: '02 §3: no raw .query(/.execute( on Transaction/PoolClient' }, messages: { raw: '.{{method}}( on {{receiver}} bypasses defineQuery (02 §3)' }, schema: [] },
  create: (context) => {
    const services = context.sourceCode.parserServices;
    const program = services?.program;
    const map = services?.esTreeNodeToTSNodeMap;
    if (!program || !map) return {};
    const checker = program.getTypeChecker();
    return {
      CallExpression(node) {
        const callee = node['callee'] as Node;
        if (callee.type !== 'MemberExpression' || callee['computed']) return;
        const method = identName(callee['property']);
        if (method !== 'query' && method !== 'execute') return;
        const receiver = receiverNames(checker, checker.getTypeAtLocation(map.get(callee['object'] as Node))).find((n) => RAW_RECEIVERS.has(n));
        if (receiver) context.report({ node, messageId: 'raw', data: { method, receiver } });
      },
    };
  },
};

export const devaiPlugin = {
  meta: { name: 'devai' },
  rules: {
    'no-enum': noEnum,
    'named-exports-only': namedExportsOnly,
    'product-prefix': productPrefix,
    'define-query-location': defineQueryLocation,
    'no-raw-query': noRawQuery,
  },
};

export interface OverlayOptions {
  /** `devai.json` `productPrefix` (D-032). */
  productPrefix: string;
  /** TypeScript files the `devai/*` rules apply to; default every `*.ts`/`*.mts`. */
  files?: string[];
}

/**
 * The overlay's flat-config blocks, appended after the STYNX profiles. The `*.html` block names
 * `@angular-eslint/template/i18n`, whose plugin `createAngularConfig` registers for `**\/*.html`.
 */
export const createDevaiOverlay = (o: OverlayOptions): Record<string, unknown>[] => [
  {
    files: o.files ?? ['**/*.ts', '**/*.mts'],
    plugins: { devai: devaiPlugin },
    rules: {
      'devai/no-enum': 'error',
      'devai/named-exports-only': 'error',
      'devai/product-prefix': ['error', { prefix: o.productPrefix }],
      'devai/define-query-location': 'error',
      'devai/no-raw-query': 'error',
    },
  },
  { files: ['**/*.html'], rules: { '@angular-eslint/template/i18n': 'error' } },
];

/** B.3 Findings: the overlay's rule→standard map, with the one-line hint (02 §10 example for S-33). */
export function standardOf(ruleId: string, message: string): { standard: string; hint: string } {
  const exact: Record<string, [string, string]> = {
    'devai/no-enum': ['S-36', 'use a string-literal union or an as const object'],
    'devai/named-exports-only': ['S-38', 'export by name'],
    'devai/product-prefix': ['S-36', 'prefix it with devai.json productPrefix (D-032)'],
    'devai/define-query-location': ['02 §3', 'move the defineQuery to a *.repository.ts file'],
    'devai/no-raw-query': ['02 §3', 'define the query with defineQuery and run it with tx.run'],
    'stynx/no-authored-cjs': ['S-31', 'use ESM import/export and import.meta.dirname/filename'],
    'stynx/require-idempotent-route-decorator': ['S-25', 'declare @Idempotent() or @NoIdempotent()'],
    '@typescript-eslint/no-explicit-any': ['S-33', 'type the value or parse it with zod'],
    '@typescript-eslint/no-unused-vars': ['S-35', 'remove it, or prefix an intentional one with _'],
    'no-unused-vars': ['S-35', 'remove it, or prefix an intentional one with _'],
    '@typescript-eslint/consistent-type-imports': ['S-50', 'use import type for type-only imports'],
    '@angular-eslint/template/i18n': ['S-16', 'mark the text i18n'],
  };
  const hit = exact[ruleId];
  if (hit) return { standard: hit[0], hint: hit[1] };
  if (ruleId.startsWith('@typescript-eslint/no-unsafe-')) return { standard: 'S-33', hint: 'type the value or parse it with zod' };
  if (ruleId === 'no-restricted-imports' || ruleId === 'no-restricted-syntax') {
    if (message.includes('PostgreSQL')) return { standard: 'S-01', hint: 'query through @stynx-nyx/data' };
    if (message.includes('S3')) return { standard: 'S-05', hint: 'go through @stynx-nyx/storage' };
    return { standard: 'S-34', hint: 'import the package barrel, not a deep path' };
  }
  if (ruleId.startsWith('boundaries/')) return { standard: 'S-37', hint: 'import only along an allowed layer direction' };
  if (ruleId.startsWith('@angular-eslint/template/')) return { standard: 'S-51', hint: 'use the form the template rule names' };
  if (ruleId.startsWith('@angular-eslint/')) return { standard: 'S-50', hint: 'follow the Angular rail rule named' };
  return { standard: 'S-41', hint: 'fix the lint finding' };
}
