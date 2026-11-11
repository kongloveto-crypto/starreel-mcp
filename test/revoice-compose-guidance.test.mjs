/**
 * 换轨（对白重配 / 旁白换轨 / 批量修台词 / 声线统一）后的重拼引导必须是 compose_episode，不是 rerender_episode。
 *
 * 2026-11-11 剧 310 实测与代码核实：
 *   ① 换轨落库同批清 karaoke_timings（persistShotReplaceProduct / voice-unify 回写），re-render 的过期重建路径
 *      刻意不跑词级对齐 ⇒ 本镜字幕只能按字数估算，实测早出 2.1s；compose_episode（ffmpeg-merge 预对齐，
 *      转写源 = 换轨产物）重新对齐后与真实人声逐字一致。
 *   ② 换轨后原片 video_url 仍挂在镜上，旧时间轴里引用原片的 clip **不会**被 findStaleVideoClips 判过期
 *      ⇒ rerender_episode 可能直接沿用旧时间轴，连声音都还是旧的（310 那次能换上是碰巧赶上配乐签名过期）。
 * 判据：这四个工具描述里出现的 rerender_episode 只许是「别用 rerender_episode」，且都要给出 compose_episode。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const PRODUCE = readFileSync(new URL('../src/tools/produce.ts', import.meta.url), 'utf8')
const GUIDE = readFileSync(new URL('../src/tools/guide-data.ts', import.meta.url), 'utf8')
const SKILL = readFileSync(new URL('../SKILL.md', import.meta.url), 'utf8')

function toolBlock(name) {
  const i = PRODUCE.indexOf(`'${name}',`)
  assert.ok(i > 0, `找不到工具 ${name}`)
  const j = PRODUCE.indexOf('server.tool(', i)
  return PRODUCE.slice(i, j === -1 ? undefined : j)
}

for (const name of ['replace_shot_dialogue', 'revoice_narration', 'repair_episode_dialogue', 'unify_voices']) {
  test(`${name}：换轨后引导 compose_episode，rerender_episode 只能以「别用」出现`, () => {
    const b = toolBlock(name)
    assert.match(b, /compose_episode/, `${name} 没给 compose_episode`)
    for (const m of b.matchAll(/rerender_episode/g)) {
      const before = b.slice(Math.max(0, m.index - 3), m.index)
      assert.equal(before, '别用 ', `${name} 仍把 rerender_episode 当重拼入口：…${b.slice(Math.max(0, m.index - 30), m.index + 20)}…`)
    }
  })
}

test('能力指南「改已生成镜头」：换过音频的镜走 compose_episode（写在 note，不进 4000 字符上限的 instructions）', () => {
  const i = GUIDE.indexOf("note: '改了台词而视频已存在")
  assert.ok(i > 0)
  const note = GUIDE.slice(i, GUIDE.indexOf("flow:", i))
  assert.match(note, /换过音频[^']*`compose_episode`[^']*别用 `rerender_episode`/)
})

test('SKILL.md 声线统一：applied 的镜用 compose_episode 进成片', () => {
  assert.doesNotMatch(SKILL, /Recompose \(`rerender_episode`\) for `applied` shots/)
  assert.match(SKILL, /`compose_episode`[^\n]*`applied` shots|`applied` shots[^\n]*`compose_episode`/)
})
