import test from 'node:test'
import assert from 'node:assert/strict'
import { registerProduceTools } from '../dist/tools/produce.js'

// 2026-11-11 — precheck-fix 的 plan 新增一类带 requires_customer_consent 的提案（把含光影 / 色温禁区词的
// 分句整句挪到 lighting 字段）。禁区词任何执行模式都必须由客户本人确认，而工具描述原先只写
// 「托管=全部采纳」——托管下 agent 会不问客户直接落库。开后端阀之前必须先让描述讲清这一条。
// 正例：plan / apply 两个工具的描述都写明「带 requires_customer_consent 的提案托管也要问客户」。
// 负例：没有任何描述再出现不带例外的「托管=全部采纳」。
// 旧功能：其余提案仍按执行模式处理（MODE_DECIDES 的托管口径还在）、blocked 与三道落库闸的说明不变。
function descs() {
  const m = new Map()
  registerProduceTools({ tool: (name, desc) => m.set(name, desc) }, new Proxy({}, { get: () => async () => ({}) }))
  return m
}

test('plan_precheck_fix 写明需客户同意的提案在托管下也要问', () => {
  const d = descs().get('plan_precheck_fix')
  assert.match(d, /requires_customer_consent[^\n]*任何执行模式都必须先问客户/)
  assert.match(d, /托管也不例外/)
  assert.match(d, /forbidden_lighting_move/)
  assert.match(d, /旧值\/新值/)
  assert.match(d, /blocked/) // 旧功能
})

test('apply_precheck_fix 写明没问过客户的这类提案不要传', () => {
  const d = descs().get('apply_precheck_fix')
  assert.match(d, /requires_customer_consent[^\n]*托管模式也必须是客户本人明确同意/)
  assert.match(d, /乐观锁/) // 旧功能
})

test('负例：不再有不带例外的「托管=全部采纳」', () => {
  for (const [name, d] of descs()) {
    if (typeof d !== 'string') continue
    for (const m of d.matchAll(/托管=全部采纳([^)]{0,40})/g)) {
      assert.match(m[1], /requires_customer_consent/, name)
    }
  }
})
