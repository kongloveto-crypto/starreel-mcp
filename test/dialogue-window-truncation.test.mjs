import test from 'node:test'
import assert from 'node:assert/strict'
import { registerProduceTools } from '../dist/tools/produce.js'
import { readFileSync } from 'node:fs'

// 台词 / 旁白在成片里被截断却检测不到（2026-11-06）：工具描述必须把三件事讲给 agent——
// ① video_url 不一定是成片用的那版，看 effective_video_url；② 覆盖率按成片窗口判、截断给建议、旁白溢出单列；
// ③ 重配旁白按可用空间放、只调一次速。英文目录同步。

function collect() {
  const tools = new Map()
  const client = new Proxy({}, { get: () => async () => ({}) })
  registerProduceTools({ tool: (name, desc) => tools.set(name, desc) }, client)
  return tools
}

test('get_storyboards 讲清 effective_video_url 与 narration_overflow', () => {
  const d = collect().get('get_storyboards')
  assert.match(d, /effective_video_url/)
  assert.match(d, /video_url 不一定是成片里用的那一版/)
  assert.match(d, /narration_overflow/)
})

test('scan_dialogue_coverage 讲清成片窗口、处置建议、句尾缺失与旁白溢出', () => {
  const d = collect().get('scan_dialogue_coverage')
  for (const k of ['timeline_window_s', 'speech_span_s', 'window_truncated', 'extend_out', 'regenerate_or_split', 'narration_overflow', '句尾']) assert.ok(d.includes(k), k)
})

test('revoice_narration 讲清按可用空间放、只调一次速、预览用 effective_video_url', () => {
  const d = collect().get('revoice_narration')
  assert.match(d, /可用空间/)
  assert.match(d, /只调一次速/)
  assert.match(d, /effective_video_url/)
})

test('update_shot 讲清语速律不抬过视频真长', () => {
  assert.match(collect().get('update_shot'), /不会被抬过视频真长/)
})

test('英文目录同步', () => {
  const en = JSON.parse(readFileSync(new URL('../src/i18n/tools.en.json', import.meta.url), 'utf8'))
  assert.match(en.get_storyboards, /effective_video_url/)
  assert.match(en.scan_dialogue_coverage, /window_truncated/)
  assert.match(en.revoice_narration, /single tempo change/)
  assert.match(en.update_shot, /real length/)
})
