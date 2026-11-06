import test from 'node:test'
import assert from 'node:assert/strict'
import { registerProduceTools } from '../dist/tools/produce.js'
import { readFileSync } from 'node:fs'

// 配乐分幕结构 + 失败可见（剧 852 集 11694）：自动分幕只按情绪强度/场景，客户想在某镜换曲或骤停没有入口；
// 生成失败时 get_bgm_status 只会从 running 变 false。本测试钉住：set_bgm_structure 存在、打门面 PUT 路径、
// 整体透传 structure（含 null 清除）；get_bgm_status / get_bgm_plan 的描述讲清 last_run 与按镜指定的入口。

function collect() {
  const tools = new Map()
  const calls = []
  const client = new Proxy({}, {
    get: (_t, method) => async (path, body) => { calls.push({ method, path, body }); return {} },
  })
  registerProduceTools({ tool: (name, desc, schema, handler) => tools.set(name, { desc, schema, handler }) }, client)
  return { tools, calls }
}

test('set_bgm_structure 走 PUT /episodes/:id/bgm-structure，整体透传', async () => {
  const { tools, calls } = collect()
  const t = tools.get('set_bgm_structure')
  assert.ok(t, '缺 set_bgm_structure')
  const structure = { act_breaks: [13], silences: [{ from_shot: 10, to_shot: 12, mode: 'cut' }] }
  await t.handler({ episode_id: 7, structure })
  assert.deepEqual(calls.at(-1), { method: 'producePut', path: '/episodes/7/bgm-structure', body: { structure } })
  await t.handler({ episode_id: 7, structure: null })
  assert.deepEqual(calls.at(-1), { method: 'producePut', path: '/episodes/7/bgm-structure', body: { structure: null } })
  assert.match(t.desc, /免费/)
  assert.match(t.desc, /generate_bgm/)
})

test('get_bgm_status 讲清 last_run 失败原因与超长说明；get_bgm_plan 指到 set_bgm_structure', () => {
  const { tools } = collect()
  const st = tools.get('get_bgm_status').desc
  assert.match(st, /last_run/)
  assert.match(st, /over_limit/)
  assert.match(tools.get('get_bgm_plan').desc, /set_bgm_structure/)
  const en = JSON.parse(readFileSync(new URL('../src/i18n/tools.en.json', import.meta.url), 'utf8'))
  assert.ok(en.set_bgm_structure, '英文目录缺 set_bgm_structure')
  assert.match(en.get_bgm_status, /last_run/)
})
