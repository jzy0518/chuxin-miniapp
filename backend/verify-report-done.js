// verify-report-done.js —— 端到端验证「报告已生成」分支
// 流程：登录 → 上传视频 → 提交分析(status=0) → 模拟 worker 回调(status=1+报告) → 查询状态 → 取报告详情
// 正好覆盖 pages/action/index 的 loadReport() done 分支依赖的接口
// 用法：先 npm start 起服务，再 node verify-report-done.js
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
  if (opts.workerKey) headers['x-worker-key'] = opts.workerKey
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
  console.log(`验证「报告已生成」分支，目标: ${BASE}\n`)

  // 1. 登录
  {
    const code = 'done-test-' + Date.now()
    const { status, data } = await req('POST', '/api/login', { json: { code } })
    const ok = status === 200 && data.code === 0 && data.data && data.data.token
    if (ok) { token = data.data.token; openid = data.data.user.openid }
    log(ok, '1. 登录', ok ? `userId=${data.data.user.id}` : JSON.stringify(data))
    if (!ok) return
  }

  // 2. 上传视频
  {
    const form = new FormData()
    const blob = new Blob(['fake mp4 bytes for done flow'], { type: 'video/mp4' })
    form.append('video', blob, 'done-test.mp4')
    form.append('title', '正手高远球练习视频')
    form.append('duration', '8')
    form.append('source', '1')
    form.append('actionTypeId', '1')
    const { status, data } = await req('POST', '/api/videos', { token, form })
    const ok = status === 200 && data.code === 0 && data.data && data.data.id
    if (ok) { videoId = data.data.id; uploadedFile = path.basename(data.data.url) }
    log(ok, '2. 上传视频', ok ? `videoId=${videoId}` : JSON.stringify(data))
    if (!ok) return
  }

  // 3. 提交分析（status=0 排队中）
  {
    const { status, data } = await req('POST', '/api/analysis', { token, json: { videoId, actionTypeId: 1 } })
    const ok = status === 200 && data.code === 0 && data.data && data.data.id
    if (ok) analysisId = data.data.id
    log(ok, '3. 提交分析', ok ? `analysisId=${analysisId} status=${data.data.status}` : JSON.stringify(data))
    if (!ok) return
  }

  // 4. 模拟 worker 回调：标记完成 + 写入报告 resultJson
  {
    const resultJson = {
      score: 86,
      corrects: [
        { pointName: '架拍过高', correct: false, confidence: 0.92, frameTime: 5.2 },
        { pointName: '手腕提前发力', correct: false, confidence: 0.81, frameTime: 7.5 },
        { pointName: '侧身转体', correct: true, confidence: 0.88, frameTime: 3.1 },
      ],
      model: 'mock-verify-v1',
      raw: {},
    }
    const { status, data } = await req('POST', `/api/analysis/${analysisId}/result`, {
      workerKey: config.workerKey,
      json: { status: 1, score: resultJson.score, resultJson },
    })
    const ok = status === 200 && data.code === 0
    log(ok, '4. 模拟 worker 回调 POST /api/analysis/:id/result', ok ? '已写入报告' : JSON.stringify(data))
    if (!ok) return
  }

  // 5. 前端 loadReport 第一步：按 videoId 查最新分析 → 应为 status=1
  {
    const { status, data } = await req('GET', `/api/analysis?videoId=${videoId}`, { token })
    const latest = data && data.data && data.data[0]
    const ok = status === 200 && data.code === 0 && latest && latest.status === 1
    log(ok, '5. 查询报告状态（应 status=1 → 前端走 done 分支）', latest ? `status=${latest.status}` : JSON.stringify(data))
    if (!ok) return
  }

  // 6. 前端 loadReport 第二步：getReport(analysisId) 取报告详情（得分 + 纠正点）
  {
    const { status, data } = await req('GET', `/api/reports/${analysisId}`, { token })
    const d = data && data.data
    const ok = status === 200 && data.code === 0 && d && d.score === 86 && Array.isArray(d.corrects) && d.corrects.length === 3
    log(ok, '6. 取报告详情 GET /api/reports/:id', d ? `score=${d.score} 纠正点=${d.corrects.length} 个 actionName=${d.actionName}` : JSON.stringify(data))
    if (d && d.corrects) {
      d.corrects.forEach((c) => console.log(`       · ${c.correct ? '✓' : '✕'} ${c.pointName}（置信度 ${Math.round((c.confidence || 0) * 100)}%，t=${c.frameTime}s）`))
    }
  }

  console.log('\n「报告已生成」分支验证完成。')
}

main()
  .catch((e) => { console.error('脚本异常:', e) })
  .finally(cleanup)
