import test from 'node:test'
import assert from 'node:assert/strict'
import { registerProduceTools } from '../dist/tools/produce.js'
import { readFileSync } from 'node:fs'

// 剧级旁白音色：旁白是一个角色，但角色表里常常没有这一行 ⇒ set_character_voice 无处可绑，旁白只能落平台兜底声线
// （所有没配旁白的剧都是同一个声音）。本测试钉住：查 / 设两件套存在、打的是门面路径、描述讲清来源与设计流程；
// 设计音色的工具描述把客户引到 set_narrator_voice。

function collect() {
  const tools = new Map()
  const calls = []
  const client = new Proxy({}, {
    get: (_t, method) => async (path, body) => { calls.push({ method, path, body }); return {} },
  })
  registerProduceTools({ tool: (name, desc, schema, handler) => tools.set(name, { desc, schema, handler }) }, client)
  return { tools, calls }
}

test('get_narrator_voice 走 GET /dramas/:id/narrator-voice，描述讲清四种来源并引导设计', async () => {
  const { tools, calls } = collect()
  const t = tools.get('get_narrator_voice')
  assert.ok(t, '缺 get_narrator_voice')
  await t.handler({ drama_id: 9 })
  assert.deepEqual(calls.at(-1), { method: 'produceGet', path: '/dramas/9/narrator-voice', body: undefined })
  for (const s of ['explicit', 'sole_protagonist', 'derived', 'fixed']) assert.match(t.desc, new RegExp(s))
  assert.match(t.desc, /design_voice/)
  assert.match(t.desc, /set_narrator_voice/)
})

test('set_narrator_voice 走 POST /dramas/:id/narrator-voice，透传音色库 id', async () => {
  const { tools, calls } = collect()
  const t = tools.get('set_narrator_voice')
  assert.ok(t, '缺 set_narrator_voice')
  await t.handler({ drama_id: 9, voice_id: 'lib:12' })
  assert.deepEqual(calls.at(-1), { method: 'producePost', path: '/dramas/9/narrator-voice', body: { library_id: 'lib:12' } })
  assert.match(t.desc, /自动补建/)
  assert.match(t.desc, /免费/)
})

test('设计音色流程把旁白引到 set_narrator_voice', () => {
  const { tools } = collect()
  assert.match(tools.get('save_designed_voice').desc, /set_narrator_voice/)
  assert.match(tools.get('revoice_narration').desc, /set_narrator_voice/)
  const en = JSON.parse(readFileSync(new URL('../src/i18n/tools.en.json', import.meta.url), 'utf8'))
  for (const k of ['get_narrator_voice', 'set_narrator_voice']) assert.ok(en[k], `英文目录缺 ${k}`)
})
