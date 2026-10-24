// 10 §4 / 08 B.24, B.27 Observation (D-057, D-058): no tokenizer. Before a call the input is admitted by
// the proxy `ceil(utf8Bytes / 3.5)`; after it, the CLI-reported usage is binding (cli.ts `classify`).
export const proxyTokens = (text: string): number => Math.ceil(Buffer.byteLength(text, 'utf8') / 3.5);

/** B.24: output ≤ 2000 tokens; wall time 120 s (02 §4). The input bound is `agentic.permissionsPattern.maxInputTokens`. */
export const SENSOR_OUTPUT_BOUND = 2000;
export const SENSOR_TIMEOUT_MS = 120_000;

/** B.27 / 02 §9: ≤ 150k input, ≤ 4k output, ≤ 20 tool calls across both phases, ≤ 5 min in all. */
export const REVIEW_INPUT_BOUND = 150_000;
export const REVIEW_OUTPUT_BOUND = 4000;
export const REVIEW_TOOL_CALLS = 20;
export const REVIEW_TIMEOUT_MS = 300_000;
