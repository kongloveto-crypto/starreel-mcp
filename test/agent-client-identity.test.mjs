import test from 'node:test'
import assert from 'node:assert/strict'

// 2026-11-02：管理后台要看「这个用户是通过哪个 AI agent 用 MCP 的、跑在什么系统上」。
// 换 token 时带上 User-Agent（MCP 包版本 + 本机系统）与 X-StarReel-Agent（initialize 时客户端自报的 clientInfo）。
// 只在换 token 这一个请求上带，业务请求不带——服务端只在换 token 处落记录。

async function withFetchSpy(fn) {
  const calls = []
  const realFetch = globalThis.fetch
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), headers: { ...(init.headers ?? {}) } })
    if (String(url).endsWith('/v1/agent/token')) {
      return new Response(JSON.stringify({ data: { access_token: 't', expires_in: 900 } }), { status: 200 })
    }
    return new Response(JSON.stringify({ code: 0, data: {} }), { status: 200 })
  }
  try { await fn(calls) } finally { globalThis.fetch = realFetch }
}

test('换 token 带 starreel-mcp UA（版本 + 平台）与 agent 身份头', async () => {
  const { StarReelClient } = await import('../dist/client.js')
  const { readFileSync } = await import('node:fs')
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  await withFetchSpy(async (calls) => {
    const client = new StarReelClient('srk_test_dummy_key_123456')
    client.setAgentInfoProvider(() => ({ name: 'claude-code', version: '2.1.0' }))
    await client.produce('/x').catch(() => {})
    const tok = calls.find(c => c.url.endsWith('/v1/agent/token'))
    assert.ok(tok, '应发出换 token 请求')
    assert.equal(tok.headers['user-agent'], `starreel-mcp/${pkg.version} (${process.platform}; ${process.arch}; node ${process.version})`)
    assert.equal(tok.headers['x-starreel-agent'], 'claude-code/2.1.0')
  })
})

test('客户端没自报 clientInfo 时不带 agent 头，UA 照带；畸形值被截断净化', async () => {
  const { StarReelClient } = await import('../dist/client.js')
  await withFetchSpy(async (calls) => {
    const client = new StarReelClient('srk_test_dummy_key_123456')
    await client.produce('/x').catch(() => {})
    const tok = calls.find(c => c.url.endsWith('/v1/agent/token'))
    assert.match(tok.headers['user-agent'], /^starreel-mcp\//)
    assert.equal('x-starreel-agent' in tok.headers, false)
  })
  await withFetchSpy(async (calls) => {
    const client = new StarReelClient('srk_test_dummy_key_123456')
    client.setAgentInfoProvider(() => ({ name: 'evil\r\nX-Inject: 1' + 'a'.repeat(300), version: '1' }))
    await client.produce('/x').catch(() => {})
    const v = calls.find(c => c.url.endsWith('/v1/agent/token')).headers['x-starreel-agent']
    assert.doesNotMatch(v, /[\r\n]/)
    assert.ok(v.length <= 120)
  })
})

test('业务请求不带 agent 头（只在换 token 处登记）', async () => {
  const { StarReelClient } = await import('../dist/client.js')
  await withFetchSpy(async (calls) => {
    const client = new StarReelClient('srk_test_dummy_key_123456')
    client.setAgentInfoProvider(() => ({ name: 'cursor', version: '1' }))
    await client.produce('/x').catch(() => {})
    const biz = calls.find(c => !c.url.endsWith('/v1/agent/token'))
    assert.ok(biz)
    assert.equal('x-starreel-agent' in biz.headers, false)
  })
})

test('index.ts 把 McpServer 的 clientInfo 接给 client', async () => {
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8')
  assert.match(src, /setAgentInfoProvider\(\s*\(\)\s*=>\s*server\.server\.getClientVersion\(\)/)
})
