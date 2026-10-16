// verify-action-flow.js —— 端到端模拟「动作检测」上传页（pages/action/index）的完整调用链
// 覆盖前端 upload() / submitAnalysis() / loadReport() 依赖的所有后端接口
// 用法：先 npm start 起服务，再 node verify-action-flow.js
const path = require('path')
const fs = require('fs')
const { pool } = require('./src/db')
const config = require('./src/config')

const BASE = process.env.TEST_BASE || `http://127.0.0.1:${config.port}`
let token = ''
let videoId = null
let analysisId = null
let uploadedFile = null
let openid = null

function log(ok, name, detail) {
  const tag = ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'
  console.log(`[${tag}] ${name}${detail ? '  => ' + detail : ''}`)
}

async function req(method, url, opts = {}) {
  const headers = {}
  if (opts.token) headers.Authorization = 'Bearer ' + opts.token
  let body
  if (opts.form) {
    body = opts.form
  } else if (opts.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.json)
  }
  const res = await fetch(BASE + url, { method, headers, body })
  let data = null
  try { data = await res.json() } catch (e) { /* 非 JSON */ }
  return { status: res.status, data }
}

async function cleanup() {
  try {
    if (analysisId) await pool.query('DELETE FROM video_analysis WHERE id = ?', [analysisId])
    if (videoId) await pool.query('DELETE FROM video WHERE id = ?', [videoId])
    if (openid) await pool.query('DELETE FROM `user` WHERE openid = ?', [openid])
    if (uploadedFile) fs.unlink(path.join(config.uploadDir, uploadedFile), () => {})
  } catch (e) { /* 忽略 */ }
  await pool.end()
}

async function main() {
  console.log(`模拟「动作检测上传页」调用链，目标: ${BASE}\n`)

  // 1. 登录
  {
    const code = 'flow-test-' + Date.now()
    const { status, data } = await req('POST', '/api/login', { json: { code } })
    const ok = status === 200 && data.code === 0 && data.data && data.data.token
    if (ok) { token = data.data.token; openid = data.data.user.openid }
    log(ok, '1. 登录 POST /api/login', ok ? `userId=${data.data.user.id}` : JSON.stringify(data))
    if (!ok) return
  }

  // 2. 上传视频（source=1 动作检测，带 actionTypeId=1 正手高远球）
  {
    const form = new FormData()
    const blob = new Blob(['fake mp4 bytes for action flow'], { type: 'video/mp4' })
    form.append('video', blob, 'action-test.mp4')
    form.append('title', '正手高远球练习视频')
    form.append('duration', '8')
    form.append('source', '1')
    form.append('actionTypeId', '1')
    const { status, data } = await req('POST', '/api/videos', { token, form })
    const ok = status === 200 && data.code === 0 && data.data && data.data.id
    if (ok) { videoId = data.data.id; uploadedFile = path.basename(data.data.url) }
    log(ok, '2. 上传视频 POST /api/videos (source=1, actionTypeId=1)', ok ? `videoId=${videoId} url=${data.data.url}` : JSON.stringify(data))
    if (!ok) return
  }

  // 3. 静默提交分析（前端 upload() 里的 submitAnalysis）
  {
    const { status, data } = await req('POST', '/api/analysis', { token, json: { videoId, actionTypeId: 1 } })
    const ok = status === 200 && data.code === 0 && data.data && data.data.id
    if (ok) analysisId = data.data.id
    log(ok, '3. 静默提交分析 POST /api/analysis', ok ? `analysisId=${analysisId} status=${data.data.status}` : JSON.stringify(data))
    if (!ok) return
  }

  // 4. 查询该视频的报告状态（前端 loadReport() 调的 GET /api/analysis?videoId=）
  {
    const { status, data } = await req('GET', `/api/analysis?videoId=${videoId}`, { token })
    const ok = status === 200 && data.code === 0 && Array.isArray(data.data)
    const latest = ok && data.data[0]
    // worker 未启动时任务停在 status=0（排队中）→ 前端显示「报告生成中」
    const statusOk = ok && latest && latest.id === analysisId && latest.status === 0
    log(statusOk, '4. 查询报告状态 GET /api/analysis?videoId=', ok ? `status=${latest.status}（0=排队中，前端显示"报告生成中"）` : JSON.stringify(data))
  }

  // 5. 视频列表（确认动作检测视频带 actionName，前端列表/视频区用）
  {
    const { status, data } = await req('GET', '/api/videos?source=1', { token })
    const ok = status === 200 && data.code === 0 && Array.isArray(data.data)
    const v = ok && data.data.find((x) => x.id === videoId)
    const okAll = ok && v && v.actionName === '正手高远球' && v.analysis && v.analysis.status === 0
    log(okAll, '5. 动作检测视频列表 GET /api/videos?source=1', v ? `actionName=${v.actionName} analysis.status=${v.analysis && v.analysis.status}` : JSON.stringify(data))
  }

  console.log('\n调用链验证完成。')
}

main()
  .catch((e) => { console.error('脚本异常:', e) })
  .finally(cleanup)
