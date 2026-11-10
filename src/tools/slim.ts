/**
 * 任务类工具返回体的默认精简（2026-11-10）。
 *
 * get_jobs / regenerate_shot_video 等把后端的任务行原样回给 agent：整段派发提示词（5~11K 字符）、
 * 输入快照（字符串套 JSON）、参考素材清单、各类内部诊断元数据。agent 做下一步决定用不上它们，
 * 轮询几次上下文就满。这里按**名单**摘掉这些字段、留下字数 / 条数；状态、错误信息、产物地址一个不少。
 *
 * 只摘名单里的键（宁可少摘：误摘一个 agent 真要用的字段，比多回几百字更糟）。
 * verbose=true 时调用方不走这里，逐字节原样。
 */

/** 长文本：超过 TEXT_KEEP_MAX 字才摘（短的原样留着，有信息量又不占地方）。 */
const HEAVY_TEXT_KEYS = new Set(['prompt', 'routingReason', 'vendorTaskHint'])
/** 结构化大块：非空即摘，留条数或字数。 */
const HEAVY_STRUCT_KEYS = new Set([
  'inputSnapshot', 'referenceImageUrls', 'referenceVideoUrls', 'referenceAudioUrls',
  'segmentReplaceJson', 'firstFrameSimilarityMeta', 'shakeMeta', 'stabilizeMeta', 'voStemsJson',
])
export const HEAVY_KEYS: ReadonlySet<string> = new Set([...HEAVY_TEXT_KEYS, ...HEAVY_STRUCT_KEYS])
const TEXT_KEEP_MAX = 200
const MAX_DEPTH = 6
export const SLIM_NOTE = '已省略整段提示词、输入快照与参考素材清单（只留 *_chars / *_count）；要全量传 verbose=true'

function sizeOf(v: unknown): { suffix: '_chars' | '_count'; n: number } {
  if (Array.isArray(v)) return { suffix: '_count', n: v.length }
  if (typeof v === 'string') {
    const t = v.trim()
    if (t.startsWith('[')) {
      try { const a = JSON.parse(t); if (Array.isArray(a)) return { suffix: '_count', n: a.length } } catch { /* 当普通字符串 */ }
    }
    return { suffix: '_chars', n: v.length }
  }
  let n = 0
  try { n = JSON.stringify(v)?.length ?? 0 } catch { /* 0 */ }
  return { suffix: '_chars', n }
}

function walk(v: unknown, depth: number, state: { dropped: boolean }): unknown {
  if (v == null || typeof v !== 'object' || depth > MAX_DEPTH) return v
  if (Array.isArray(v)) return v.map((x) => walk(x, depth + 1, state))
  const out: Record<string, unknown> = {}
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const emptyish = val == null || val === '' || (Array.isArray(val) && val.length === 0)
    const heavy = !emptyish && (
      (HEAVY_TEXT_KEYS.has(k) && typeof val === 'string' && val.length > TEXT_KEEP_MAX)
      || HEAVY_STRUCT_KEYS.has(k))
    if (heavy) {
      const s = sizeOf(val)
      out[`${k}${s.suffix}`] = s.n
      state.dropped = true
      continue
    }
    out[k] = walk(val, depth + 1, state)
  }
  return out
}

/** 返回精简后的副本（不改入参）。摘掉过东西才在顶层加 `_slim` 说明。 */
export function slimHeavy<T>(data: T): T {
  const state = { dropped: false }
  const out = walk(data, 0, state)
  if (state.dropped && out && typeof out === 'object' && !Array.isArray(out)) (out as Record<string, unknown>)._slim = SLIM_NOTE
  return out as T
}
