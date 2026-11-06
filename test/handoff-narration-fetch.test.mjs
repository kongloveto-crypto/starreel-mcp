// 交接包旁白分轨：fetch_pack.py 要把干净厂商原片与旁白独立轨一起下载，并改写成本地路径。
// 干净原片就是 clip 本身时（clip 本来不带旁白）不重复下载。没有 narration 字段的旧清单照旧能下。
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const exec = promisify(execFile)
const script = fileURLToPath(new URL('../assets/handoff/fetch_pack.py', import.meta.url))
const env = { ...process.env, NO_PROXY: '127.0.0.1', no_proxy: '127.0.0.1' }

test('fetch_pack 下载干净原片 + 旁白独立轨，同文件不重复下', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'nar-fetch-'))
  const hits = []
  const server = createServer((q, res) => { hits.push(q.url); res.end(`bytes:${q.url}`) })
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  const o = `http://127.0.0.1:${server.address().port}`
  try {
    const m = {
      manifest_version: '0.2', render_target: {}, shots: [
        { shot_number: 1, clip: { url: o + '/clip1', duration_ms: 2000 },
          narration: { status: 'available', clip_contains_narration: true,
            clean_vendor_clip: { url: o + '/clean1', same_file_as_clip: false, aligned_with_clip: true },
            narration_stem: { url: o + '/stem1.m4a', offset_ms: 0, aligned_with_clip: true, source: 'completion_overlay' } } },
        { shot_number: 2, clip: { url: o + '/clip2', duration_ms: 2000 },
          narration: { status: 'partial', clip_contains_narration: false,
            clean_vendor_clip: { url: o + '/clip2', same_file_as_clip: true, aligned_with_clip: true }, narration_stem: null } },
        { shot_number: 3, clip: { url: o + '/clip3', duration_ms: 2000 } },   // 没有 narration 字段的旧形状
      ],
    }
    const input = join(dir, 'm.json'), out = join(dir, 'pack')
    writeFileSync(input, JSON.stringify(m))
    await exec('python3', [script, input, '-o', out], { env })
    const local = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'))
    assert.equal(local.shots[0].narration.clean_vendor_clip.file, 'clips/clean/shot_001.mp4')
    assert.equal(local.shots[0].narration.narration_stem.file, 'audio/narration/shot_001.m4a')
    assert.equal(readFileSync(join(out, 'clips/clean/shot_001.mp4'), 'utf8'), 'bytes:/clean1')
    assert.equal(readFileSync(join(out, 'audio/narration/shot_001.m4a'), 'utf8'), 'bytes:/stem1.m4a')
    assert.equal(local.shots[1].narration.clean_vendor_clip.file, 'clips/shot_002.mp4')
    assert.equal(existsSync(join(out, 'clips/clean/shot_002.mp4')), false)
    assert.equal(hits.filter(h => h === '/clip2').length, 1)
    assert.equal(local.shots[0].narration.clean_vendor_clip.url, undefined)   // 签名 URL 不落进本地清单
    assert.equal(existsSync(join(out, 'clips/shot_003.mp4')), true)
  } finally {
    await new Promise(r => server.close(r))
    rmSync(dir, { recursive: true, force: true })
  }
})
