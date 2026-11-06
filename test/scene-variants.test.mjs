import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerProduceTools } from '../dist/tools/produce.js'

// 场景变体对 MCP 曾完全不可见：网页端会自动建 lighting_* / 破坏状态一类变体卡（多数「未生成」），
// agent 被问起答不上来；link_world_state_scene_variant 要 variant_id 却没有任何工具列得出它 ⇒ 实际调不通。
// 本测试钉住：列变体 / 报价 / 生成三件套存在、打的是门面路径、描述讲清「没图的变体不起作用」与光位一致性风险；
// 以及建剧两处自由文本（世界观 Brief、时代契约 positive）会被注入每张空景基板的警告。

function collect() {
  const tools = new Map()
  const calls = []
  const client = new Proxy({}, {
    get: (_t, method) => async (path, body) => { calls.push({ method, path, body }); return {} },
  })
  registerProduceTools({ tool: (name, desc, schema, handler) => tools.set(name, { desc, schema, handler }) }, client)
  return { tools, calls }
}

test('get_scene_variants 列出某场景的变体（GET 门面 /scenes/:id/variants）', async () => {
  const { tools, calls } = collect()
  const t = tools.get('get_scene_variants')
  assert.ok(t, '缺 get_scene_variants')
  await t.handler({ scene_id: 12 })
  assert.deepEqual(calls.at(-1), { method: 'produceGet', path: '/scenes/12/variants', body: undefined })
  // 必须讲清：只有已出图的变体才会被出图自动匹配；没图的不起作用、可以不出
  assert.match(t.desc, /已经有图|已有图/)
  assert.match(t.desc, /不起作用|不生效/)
  assert.match(t.desc, /可以不出|不必出/)
  // 与账本关联的唯一 variant_id 来源
  assert.match(t.desc, /link_world_state_scene_variant/)
})

test('quote_scene_variant_image → generate_scene_variant_image 走报价确认', async () => {
  const { tools, calls } = collect()
  const q = tools.get('quote_scene_variant_image')
  const g = tools.get('generate_scene_variant_image')
  assert.ok(q && g, '缺报价/生成工具')
  await q.handler({ variant_id: 7 })
  assert.equal(calls.at(-1).path, '/scene-variants/7/image/quote')
  assert.equal(calls.at(-1).method, 'producePost')
  await g.handler({ variant_id: 7, quote_id: 'q_x' })
  assert.equal(calls.at(-1).path, '/scene-variants/7/image/generate')
  assert.deepEqual(calls.at(-1).body, { quote_id: 'q_x' })
  // quote_id 必填（新端点不留无报价的旧路径）
  assert.equal(g.schema.quote_id.safeParse(undefined).success, false)
  // 光位变体会让同场不同镜拿到不同背景：一致性优先时别乱出
  for (const d of [q.desc, g.desc]) {
    assert.match(d, /光位/)
    assert.match(d, /一致/)
  }
  assert.match(q.desc, /estimated_points/)
  assert.match(q.desc, /typical_points/)
})

test('link_world_state_scene_variant 指明 variant_id 从哪里来、要先有图', () => {
  const { tools } = collect()
  const d = tools.get('link_world_state_scene_variant').desc
  assert.match(d, /get_scene_variants/)
  assert.match(d, /generate_scene_variant_image/)
})

test('get_scenes 描述提到变体计数字段', () => {
  const { tools } = collect()
  const d = tools.get('get_scenes').desc
  assert.match(d, /variant_count/)
  assert.match(d, /variants_with_image/)
})

test('建剧引导：世界观 Brief 与时代契约 positive 会注入每张空景基板，具体元素写进分镜', () => {
  const { tools } = collect()
  const briefs = [
    tools.get('create_drama').schema.setting_brief.description,
    tools.get('update_project_settings').schema.setting_brief.description,
    tools.get('set_era_contract').schema.positive.description,
  ]
  for (const b of briefs) {
    assert.match(b, /空景基板|场景基板/, b)
    assert.match(b, /每一张|每张/, b)
    assert.match(b, /分镜/, b)
    // 讲的是「世界观层面的约束」，不是叫人别写
    assert.match(b, /世界观层面/, b)
  }
})

test('机翻源表与源码描述同步（改描述后要重跑 i18n-extract-tools）', () => {
  const zh = JSON.parse(readFileSync(new URL('../src/i18n/tools.zh-CN.json', import.meta.url), 'utf8'))
  const en = JSON.parse(readFileSync(new URL('../src/i18n/tools.en.json', import.meta.url), 'utf8'))
  const { tools } = collect()
  for (const name of ['get_scene_variants', 'quote_scene_variant_image', 'generate_scene_variant_image', 'link_world_state_scene_variant', 'get_scenes']) {
    assert.equal(zh[name], tools.get(name).desc, `${name} 中文源表未同步`)
    assert.ok(typeof en[name] === 'string' && en[name].length > 0, `${name} 缺英文描述`)
    assert.ok(en[name].includes(name === 'get_scenes' ? 'variant_count' : 'variant'), `${name} 英文描述未更新`)
  }
})

test('轮询看 status 不看 has_image（重出时旧图一直在，PR#1510 Codex P2）', () => {
  const { tools } = collect()
  assert.match(tools.get('get_scene_variants').desc, /generating/)
  assert.match(tools.get('get_scene_variants').desc, /generation_status/)
  const g = tools.get('generate_scene_variant_image').desc
  assert.match(g, /status/)
  assert.match(g, /别只看 has_image/)
  assert.doesNotMatch(g, /轮询 get_scene_variants 看 has_image/)
})
