// 任务类工具默认回精简版(2026-11-10):get_jobs / regenerate_shot_video 等此前把整段派发提示词、
// 输入快照、参考素材清单原样回给 agent(单次 8~20K 字符,get_jobs 每个任务一份),轮询几次上下文就满。
// 验收:
//   正例 默认省略大字段并留下字数/条数,状态与错误信息一个不少;verbose=true 逐字节原样
//   负例 短字段(≤200 字)不动;不是大字段的键不动;诊断类工具(get_image_dispatch / get_shot_prompts)不受影响
//   旧功能 请求路径与请求体不变(verbose 不传给后端)
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {registerProduceTools} from '../dist/tools/produce.js'
import {slimHeavy, HEAVY_KEYS} from '../dist/tools/slim.js'

const LONG='QA占位'.repeat(400) // 1600 字
const row=()=>({id:7,status:'processing',storyboardId:3,errorMsg:null,videoUrl:null,prompt:LONG,
 inputSnapshot:JSON.stringify({dependencies:[1,2,3],referenceUrls:['https://x/1.png'],pad:LONG}),
 referenceImageUrls:JSON.stringify(['https://x/1.png','https://x/2.png']),referenceVideoUrls:null,
 routingReason:LONG,createdAt:'2026-11-10T00:00:00.000Z',maxChargePoints:401})

test('slimHeavy:大字段省略并留字数/条数,其余原样',()=>{
 const s=slimHeavy(row())
 assert.equal(s.prompt,undefined)
 assert.equal(s.prompt_chars,1600)
 assert.equal(s.inputSnapshot,undefined)
 assert.ok(s.inputSnapshot_chars>1600)
 assert.equal(s.referenceImageUrls,undefined)
 assert.equal(s.referenceImageUrls_count,2)
 assert.equal(s.routingReason,undefined)
 for(const k of ['id','status','storyboardId','errorMsg','videoUrl','createdAt','maxChargePoints','referenceVideoUrls']) assert.deepEqual(s[k],row()[k],k)
 assert.ok(JSON.stringify(s).length<400)
})
test('slimHeavy:嵌套(items[] / generation)同样处理;短值与无关键不动;不改入参',()=>{
 const input={counts:{open:2},items:[{kind:'video',...row()},{kind:'image',id:8,status:'failed',errorMsg:'QA-失败原因',prompt:'短提示词'}],generation:row(),note:LONG}
 const copy=JSON.parse(JSON.stringify(input))
 const s=slimHeavy(input)
 assert.deepEqual(input,copy,'入参被改了')
 assert.equal(s.items[0].prompt_chars,1600)
 assert.equal(s.items[1].prompt,'短提示词')
 assert.equal(s.items[1].errorMsg,'QA-失败原因')
 assert.equal(s.generation.prompt,undefined)
 assert.equal(s.note,LONG,'不在名单里的长字段不许动')
 assert.deepEqual(s.counts,{open:2})
 assert.equal(typeof s._slim,'string')
 assert.match(s._slim,/verbose/)
})
test('slimHeavy:没有省掉任何东西就不加 _slim;非对象原样',()=>{
 assert.deepEqual(slimHeavy({id:1,status:'ok'}),{id:1,status:'ok'})
 assert.equal(slimHeavy(null),null)
 assert.equal(slimHeavy('x'),'x')
 assert.ok(HEAVY_KEYS.has('prompt')&&HEAVY_KEYS.has('inputSnapshot'))
})

const tools=new Map()
const calls=[]
const reply={items:[{kind:'video',...row()}],generation:row(),...row()}
const client=new Proxy({},{get:(_,m)=>async(path,body)=>{calls.push({m,path,body});return JSON.parse(JSON.stringify(reply))}})
registerProduceTools({tool:(name,desc,shape,handler)=>tools.set(name,{desc,shape,handler})},client)
const SLIMMED=['get_jobs','regenerate_shot_video','edit_video_shot','repaint_shot_video','reskin_shot_video','get_repaint_status','align_prev_shot']
const args={drama_id:1,storyboard_id:3,generation_id:7,quote_id:'q',instruction:'QA'}

for(const name of SLIMMED){
 test(`${name}:默认精简,verbose=true 原样;verbose 不传给后端`,async()=>{
  const t=tools.get(name)
  assert.ok(t,`${name} 未注册`)
  assert.ok(t.shape.verbose,'缺 verbose 参数')
  assert.match(t.desc,/verbose/,'描述没讲 verbose')
  calls.length=0
  const slim=JSON.parse((await t.handler({...args})).content[0].text)
  assert.equal(slim.prompt,undefined)
  assert.equal(slim.prompt_chars,1600)
  assert.equal(slim.status,'processing')
  const full=JSON.parse((await t.handler({...args,verbose:true})).content[0].text)
  assert.deepEqual(full,reply)
  for(const c of calls){assert.doesNotMatch(String(c.path),/verbose/);assert.ok(!c.body||!('verbose' in c.body),'verbose 泄到请求体')}
 })
}
test('诊断类工具不精简(本来就是来看提示词的)',async()=>{
 for(const name of ['get_image_dispatch','get_shot_prompts']){
  const t=tools.get(name);assert.ok(t,name)
  assert.equal(t.shape.verbose,undefined)
 }
})
