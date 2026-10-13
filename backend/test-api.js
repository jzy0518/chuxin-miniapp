// 接口测试脚本：覆盖健康检查/登录/用户/动作纠正/视频上传全链路
// 用法：
//   1) 先启动服务：npm start
//   2) 另开终端运行：npm test   （即 node test-api.js）
// 脚本用独立测试用户跑，结束后自动清理数据库记录与上传文件。
const fs = require('fs')
const path = require('path')
const { pool } = require('./src/db')
const config = require('./src/config')

const BASE = process.env.TEST_BASE || `http://127.0.0.1:${config.port}`

let passed = 0
let failed = 0
let token = ''
let testUser = null
let createdCorrectIds = []
let createdVideoIds = []
let uploadedFiles = []

// ---------- 小工具 ----------

function log(ok, name, detail) {
  const mark = ok ? 'PASS' : 'FAIL'
  const tag = ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'
  ok ? passed++ : failed++
  console.log(`[${tag}] ${name}${detail ? '  => ' + detail : ''}`)
}

// 发起请求：token 透传、json / form 二选一
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
  try {
    data = await res.json()
  } catch (e) {
    data = null
  }
  return { status: res.status, data }
}

async function cleanup() {
  try {
    if (testUser) {
      await pool.query('DELETE FROM video WHERE user_id = ?', [testUser.id])
      await pool.query('DELETE FROM action_correct WHERE user_id = ?', [testUser.id])
      await pool.query('DELETE FROM `user` WHERE id = ?', [testUser.id])
    }
    for (const f of uploadedFiles) {
      fs.unlink(path.join(config.uploadDir, f), () => {})
    }
  } catch (e) {
    console.log('清理失败（可忽略）:', e.message)
  }
  await pool.end()
}

// ---------- 测试步骤 ----------

async function main() {
  console.log(`测试目标: ${BASE}\n`)

  // 1. 健康检查
  {
    const { status, data } = await req('GET', '/api/health')
    log(status === 200 && data && data.code === 0, '健康检查 GET /api/health', JSON.stringify(data))
  }

  // 2. 登录（mock 模式：用随机 code 生成独立测试用户）
  {
    const { status, data } = await req('POST', '/api/login', {
      json: { code: 'api-test-' + Date.now(), nickName: '接口测试员', avatarUrl: '' },
    })
    const ok = status === 200 && data.code === 0 && data.data && data.data.token
    if (ok) {
      token = data.data.token
      testUser = data.data.user
    }
    log(ok, '登录 POST /api/login', ok ? `userId=${testUser.id}` : JSON.stringify(data))
  }

  // 3. 未带 token 访问受保护接口应 401
  {
    const { status } = await req('GET', '/api/videos')
    log(status === 401, '鉴权拦截（无 token 应 401）', `status=${status}`)
  }

  // 4. 查询我的信息
  {
    const { status, data } = await req('GET', '/api/user/me', { token })
    log(status === 200 && data.code === 0, '我的信息 GET /api/user/me', JSON.stringify(data.data && data.data.stats))
  }

  // 5. 更新用户资料
  {
    const { status, data } = await req('PUT', '/api/user/me', {
      token,
      json: { nickName: '接口测试员2号', skillLevel: 5 },
    })
    const ok = status === 200 && data.code === 0 && data.data.skill_level === 5
    log(ok, '更新资料 PUT /api/user/me', ok ? `skillLevel=${data.data.skill_level}` : JSON.stringify(data))
  }

  // 6. 动作列表
  {
    const { status, data } = await req('GET', '/api/actions', { token })
    const ok = status === 200 && data.code === 0 && Array.isArray(data.data) && data.data.length === 9
    log(ok, '动作列表 GET /api/actions', ok ? `共 ${data.data.length} 个动作` : JSON.stringify(data))
  }

  // 7. 新增纠正点（高远球 id=1）
  {
    const { status, data } = await req('POST', '/api/actions/1/corrects', {
      token,
      json: { pointName: '持拍手肘抬太低', note: '引拍时肘部应高于肩' },
    })
    const ok = status === 200 && data.code === 0
    if (ok) createdCorrectIds.push(data.data.id)
    log(ok, '新增纠正点 POST /api/actions/1/corrects', ok ? `id=${data.data.id}` : JSON.stringify(data))
  }

  // 8. 标记已纠正
  {
    const id = createdCorrectIds[0]
    const { status, data } = await req('PUT', `/api/corrects/${id}`, { token, json: { status: 1 } })
    log(status === 200 && data.code === 0 && data.data.status === 1, `标记已纠正 PUT /api/corrects/${id}`, JSON.stringify(data.data))
  }

  // 9. 动作列表应统计到 1 个已纠正
  {
    const { status, data } = await req('GET', '/api/actions', { token })
    const gaoyuan = data.data.find((a) => a.id === 1)
    log(status === 200 && gaoyuan && gaoyuan.doneCount === 1, '纠正统计校验（高远球 done=1）', gaoyuan ? `done=${gaoyuan.doneCount}, todo=${gaoyuan.todoCount}` : '')
  }

  // 10. 删除纠正点
  {
    const id = createdCorrectIds[0]
    const { status, data } = await req('DELETE', `/api/corrects/${id}`, { token })
    log(status === 200 && data.code === 0, `删除纠正点 DELETE /api/corrects/${id}`, '')
  }

  // 11. 上传视频
  {
    const form = new FormData()
    const blob = new Blob(['fake mp4 bytes for test'], { type: 'video/mp4' })
    form.append('video', blob, 'test-video.mp4')
    form.append('title', '接口测试视频')
    form.append('duration', '8')
    const { status, data } = await req('POST', '/api/videos', { token, form })
    const ok = status === 200 && data.code === 0 && data.data.url
    if (ok) {
      createdVideoIds.push(data.data.id)
      uploadedFiles.push(path.basename(data.data.url))
    }
    log(ok, '上传视频 POST /api/videos', ok ? `url=${data.data.url}` : JSON.stringify(data))
  }

  // 12. 视频列表
  {
    const { status, data } = await req('GET', '/api/videos', { token })
    const ok = status === 200 && data.code === 0 && Array.isArray(data.data) && data.data.length >= 1
    log(ok, '视频列表 GET /api/videos', ok ? `共 ${data.data.length} 条` : JSON.stringify(data))
  }

  // 13. 404 接口
  {
    const { status } = await req('GET', '/api/not-exist', { token })
    log(status === 404, '未知接口应 404', `status=${status}`)
  }

  console.log(`\n====================================`)
  console.log(`通过 ${passed} 项，失败 ${failed} 项`)
  if (failed > 0) {
    console.log('存在失败项，请检查服务日志（npm start 的终端输出）')
    await cleanup()
    process.exit(1)
  } else {
    console.log('全部通过 🎉')
    await cleanup()
    console.log('测试数据已清理')
    process.exit(0)
  }
}

main().catch(async (e) => {
  console.error('\n[脚本异常]', e.message)
  console.error('请确认服务已启动（npm start），且 MySQL 服务（MySQL8.4）正在运行')
  await cleanup().catch(() => {})
  process.exit(1)
})