import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {registerProduceTools} from '../dist/tools/produce.js'
import {COMMON_REQUESTS} from '../dist/tools/guide-data.js'

// 镜头图被质检拒收时 frame_status 仍是 failed（机器枚举刻意不改），但对客户说「失败」太吓人。
// 门面每镜带 frame_status_label（full 与 view=summary 都有）。工具描述必须让 agent 用它对客户转述，
// 同时说清判分支仍看 frame_status / fail_reason / retryable——不能把枚举本身改掉或让 agent 按文案判分支。
function descs(){
 const m=new Map()
 registerProduceTools({tool:(name,desc)=>m.set(name,desc)},new Proxy({},{get:()=>async()=>({})}))
 return m
}
test('get_storyboards 描述讲清 frame_status_label 的用途与两种视图都有',()=>{
 const d=descs().get('get_storyboards')
 assert.match(d,/frame_status_label/)
 assert.match(d,/未通过质检/)
 assert.match(d,/view=summary/)
 assert.match(d,/别照 frame_status=failed 说「失败」/)
 assert.match(d,/判下一步分支仍看 frame_status \/ fail_reason \/ retryable/)
 // 旧功能不许坏：枚举清单仍在
 assert.match(d,/ready\/pending\/authorizing\/rejected\/failed\/none\/not_required/)
})
test('generate_frames 与流程说明不再把 failed 直接叫「真失败」',()=>{
 const m=descs()
 for (const k of ['generate_frames','set_script','rewrite_script','extract_assets']) {
  const d=m.get(k)
  // 2026-11-10：产线总纲只留 set_script 一处，rewrite_script / extract_assets 改成指向它
  if (k==='rewrite_script'||k==='extract_assets') assert.match(d,/产线总纲[^\n]*只写在 set_script 的描述里/,k)
  else assert.match(d,/frame_status_label/,k)
  assert.doesNotMatch(d,/failed=才是真失败/,k)
 }
})
test('客户话术「图片一直没出来」指向 frame_status_label',()=>{
 const row=COMMON_REQUESTS.find(r=>r.customer_says==='图片一直没出来')
 assert.ok(row)
 assert.match(row.do,/frame_status_label/)
 assert.doesNotMatch(row.do,/failed 才是失败/)
})
test('机翻源表与源码同步、英文表也提到 frame_status_label',()=>{
 const zh=JSON.parse(readFileSync(new URL('../src/i18n/tools.zh-CN.json',import.meta.url),'utf8'))
 const en=JSON.parse(readFileSync(new URL('../src/i18n/tools.en.json',import.meta.url),'utf8'))
 const m=descs()
 for (const k of ['get_storyboards','generate_frames','set_script','rewrite_script','extract_assets']) {
  assert.equal(zh[k],m.get(k),k)
  assert.match(en[k],/frame_status_label/,k)
 }
})
