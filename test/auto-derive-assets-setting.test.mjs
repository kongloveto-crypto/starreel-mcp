import test from 'node:test'
import assert from 'node:assert/strict'
import {registerProduceTools} from '../dist/tools/produce.js'

// 剧级自动派生开关：update_project_settings 收 auto_derive_assets（布尔）并原样转发到门面 PUT /dramas/:id；
// extract_assets 描述讲清提取时会自动出道具图计费、怎么关。
function tools(){
 const m=new Map(); const calls=[]
 registerProduceTools({tool:(name,desc,schema,handler)=>m.set(name,{desc,schema,handler})},
  {producePut:async(path,body)=>{calls.push({path,body});return {ok:true}}})
 return {m,calls}
}
test('update_project_settings 收 auto_derive_assets 布尔，其余拒',()=>{
 const {m}=tools(); const s=m.get('update_project_settings').schema.auto_derive_assets
 assert.ok(s)
 for(const v of [true,false]) assert.equal(s.safeParse(v).success,true)
 for(const v of ['false','true',0,1,null]) assert.equal(s.safeParse(v).success,false)
})
test('原样转发到 PUT /dramas/:id；不传不带该键（旧行为）',async()=>{
 const {m,calls}=tools(); const t=m.get('update_project_settings')
 await t.handler({drama_id:9,auto_derive_assets:false})
 assert.deepEqual(calls[0],{path:'/dramas/9',body:{auto_derive_assets:false}})
 await t.handler({drama_id:9,genre:'x'})
 assert.equal('auto_derive_assets' in calls[1].body,false)
})
test('描述讲清影响范围与关掉的代价；extract_assets 写明自动出道具图按张计费与外形分析',()=>{
 const {m}=tools()
 const d=m.get('update_project_settings').desc
 assert.match(d,/auto_derive_assets/)
 assert.match(d,/逐件出道具图\(按张计费/)
 assert.match(d,/道具外形分析/)
 assert.match(d,/generate_prop_sheet/)
 const ex=m.get('extract_assets').desc
 assert.match(ex,/自动给有描述、还没有图的道具逐件出道具图/)
 assert.match(ex,/按道具张数计费/)
 assert.match(ex,/外形分析/)
 assert.match(ex,/auto_derive_assets=false/)
 assert.match(m.get('get_drama').desc,/auto_derive_assets/)
 assert.equal(m.get('create_drama').schema.auto_derive_assets,undefined)
})
