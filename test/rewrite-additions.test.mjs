/**
 * get_script 的 rewrite_additions 字段要讲清：什么时候有、两类内容、怎么处置（按执行模式）。
 * 后端判据与回放见 starreel-drama/backend/src/services/rewrite-additions.ts。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerProduceTools } from '../dist/tools/produce.js'

function collect() {
  const tools = new Map()
  const client = new Proxy({}, { get: () => async () => ({}) })
  registerProduceTools({ tool: (name, desc) => tools.set(name, { desc }) }, client)
  return tools
}

test('get_script 描述点名 rewrite_additions 两类内容与处置路径', () => {
  const d = collect().get('get_script').desc
  assert.match(d, /rewrite_additions/)
  assert.match(d, /added_voice_lines/)
  assert.match(d, /edit_directives/)
  assert.match(d, /剧本形态/)
  assert.match(d, /edit_rewritten_script 删掉/)
  assert.match(d, /执行模式/) // 托管与专业模式分别怎么处置，不许写死「一律问客户」
})

test('get_script 描述讲清 rewrite_additions 的 status 语义，不再写「否则 null」', () => {
  const d = collect().get('get_script').desc
  assert.match(d, /永不为 null/)
  for (const s of ['checked', 'not_applicable', 'not_rewritten', 'unknown', 'reason']) assert.ok(d.includes(s), s)
  assert.match(d, /空数组=没有新增/)
  assert.match(d, /rewrite_pipeline=two_pass/)
  assert.doesNotMatch(d, /否则 null/)
})

test('机翻源表与英文目录同步', () => {
  const zh = JSON.parse(readFileSync(new URL('../src/i18n/tools.zh-CN.json', import.meta.url), 'utf8'))
  const en = JSON.parse(readFileSync(new URL('../src/i18n/tools.en.json', import.meta.url), 'utf8'))
  assert.equal(zh.get_script, collect().get('get_script').desc, 'get_script 中文源表未同步（重跑 i18n-extract-tools）')
  assert.match(en.get_script, /rewrite_additions/)
  assert.match(en.get_script, /edit_directives/)
  assert.match(en.get_script, /never null/)
  assert.doesNotMatch(en.get_script, /otherwise null/)
})
