import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerProduceTools } from '../dist/tools/produce.js'

// 2026-11-08 — 大运镜出视频只送首帧（平台 BIGMOVE 单帧闸，防运镜回到起点 / 首尾硬插值变形），
// 平台生成的尾帧补了也不进视频。旧描述却写「跳过尾帧 ⇒ 大运镜结束又回到起点构图」，
// 把 agent 引去给大运镜补尾帧——白花点数、结尾照旧。
// 正例：讲清大运镜的尾帧不进视频，并给出能真正钉住结尾的两条路（改成固定机位且 camera_movement / action / video_prompt 三处都删运镜词——判据只看关键词不看幅度 / 客户上传自有尾帧）。
// 负例：任何工具描述都不再把「大运镜回到起点」归因于缺尾帧。
// 旧功能：「动作做不到位」的缺尾帧代价提示与两趟出帧流程仍在。
function descs() {
  const m = new Map()
  registerProduceTools({ tool: (name, desc) => m.set(name, desc) }, new Proxy({}, { get: () => async () => ({}) }))
  return m
}
const WRONG_ZH = /大运镜结束又回到起点/
const WRONG_EN = /large camera moves? (end|ending|ends)[^.]*composition/

test('负例：没有任何工具描述把大运镜回到起点归因于缺尾帧', () => {
  for (const [name, d] of descs()) assert.doesNotMatch(d, WRONG_ZH, name)
})

test('tail_frame_plan 讲清大运镜尾帧不进视频、指向固定机位（三处删运镜词）与 upload_shot_frame', () => {
  const d = descs().get('tail_frame_plan')
  assert.match(d, /大运镜[^。]*尾帧[^。]*不送进视频/)
  assert.match(d, /固定机位[^。]*camera_movement[^。]*action[^。]*video_prompt/)
  assert.match(d, /小幅/)
  assert.doesNotMatch(d, /update_shot 改 movement|运镜幅度改小/) // update_shot 没有 movement 参数（PR#1586 Codex P2）
  assert.match(d, /upload_shot_frame/)
  assert.match(d, /动作做不到位/) // 旧功能：缺尾帧的真实代价仍要讲
})

test('流程说明（尾帧别跳段）同样改口径', () => {
  const d = descs().get('set_script')
  assert.match(d, /尾帧别跳/)
  assert.match(d, /tail_frame_plan/)
  assert.match(d, /大运镜[^。]*不送进视频/)
})

test('机翻源表与源码同步、英文表同样改口径', () => {
  const zh = JSON.parse(readFileSync(new URL('../src/i18n/tools.zh-CN.json', import.meta.url), 'utf8'))
  const en = JSON.parse(readFileSync(new URL('../src/i18n/tools.en.json', import.meta.url), 'utf8'))
  const m = descs()
  assert.equal(zh.tail_frame_plan, m.get('tail_frame_plan'))
  for (const [name, d] of Object.entries(en)) assert.doesNotMatch(d, WRONG_EN, name)
  assert.match(en.tail_frame_plan, /upload_shot_frame/)
  assert.match(en.tail_frame_plan, /not sent to the video/)
  assert.match(en.tail_frame_plan, /camera_movement[^.]*action[^.]*video_prompt/)
  for (const [name, d] of Object.entries(en)) assert.doesNotMatch(d, /make the camera move smaller/, name)
})

test('SKILL.md 讲清大运镜尾帧不进视频', () => {
  const s = readFileSync(new URL('../SKILL.md', import.meta.url), 'utf8')
  assert.match(s, /big camera move[\s\S]{0,200}first frame only/)
  assert.match(s, /upload_shot_frame[\s\S]{0,200}last frame/)
  assert.match(s, /camera_movement[\s\S]{0,300}video_prompt/)
  assert.doesNotMatch(s, /make the camera move smaller/)
})
