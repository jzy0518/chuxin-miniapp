// verify-upload-dir.js —— 验证上传视频写入项目外目录（治本热重载重启问题的关键验证）
const fs = require('fs')
const path = require('path')
const { pool } = require('./src/db')
const config = require('./src/config')

const BASE = `http://127.0.0.1:${config.port}`
const PROJECT_UPLOADS = path.join(__dirname, 'uploads') // 项目内旧目录
const NEW_UPLOADS = 'E:/chuxin_uploads' // 项目外新目录

let token = '', videoId = null, openid = null, newFile = null

async function req(method, url, opts = {}) {
  const headers = {}
  if (opts.token) headers.Authorization = 'Bearer ' + opts.token
  let body
  if (opts.form) body = opts.form
  else if (opts.json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.json) }
  const res = await fetch(BASE + url, { method, headers, body })
  let data = null
  try { data = await res.json() } catch (e) {}
  return { status: res.status, data }
}

const count = (dir) => { try { return fs.readdirSync(dir).length } catch (e) { return -1 } }

async function main() {
  console.log(`config.uploadDir = ${config.uploadDir}`)
  const beforeNew = count(NEW_UPLOADS)
  const beforeProj = count(PROJECT_UPLOADS)
  console.log(`上传前: 项目外新目录=${beforeNew} 个文件, 项目内旧目录=${beforeProj} 个文件\n`)

  // 登录 + 上传
  const login = await req('POST', '/api/login', { json: { code: 'dir-test-' + Date.now() } })
  token = login.data.data.token; openid = login.data.data.user.openid
  const form = new FormData()
  form.append('video', new Blob(['fake mp4 for dir test'], { type: 'video/mp4' }), 'dir-test.mp4')
  form.append('title', '目录验证视频')
  const up = await req('POST', '/api/videos', { token, form })
  if (!(up.status === 200 && up.data.code === 0)) { console.log('上传失败:', JSON.stringify(up.data)); return }
  videoId = up.data.data.id
  newFile = path.basename(up.data.data.url)
  console.log(`上传成功: ${up.data.data.url}\n`)

  const afterNew = count(NEW_UPLOADS)
  const afterProj = count(PROJECT_UPLOADS)
  const inNew = fs.existsSync(path.join(NEW_UPLOADS, newFile))
  const inProj = fs.existsSync(path.join(PROJECT_UPLOADS, newFile))

  console.log(`上传后: 项目外新目录=${afterNew} 个文件, 项目内旧目录=${afterProj} 个文件`)
  console.log(`新文件在【项目外 E:/chuxin_uploads】: ${inNew ? '✓ 是' : '✗ 否'}`)
  console.log(`新文件在【项目内 backend/uploads】: ${inProj ? '✗ 是（不对！）' : '✓ 否'}`)
  console.log(inNew && !inProj ? '\n✓✓ 治本成功：上传文件已写入项目外目录，不会再触发小程序重新编译' : '\n✗✗ 仍写入项目内，需检查')
}

main().catch((e) => console.error(e)).finally(async () => {
  try {
    if (videoId) await pool.query('DELETE FROM video WHERE id = ?', [videoId])
    if (openid) await pool.query('DELETE FROM `user` WHERE openid = ?', [openid])
    if (newFile && fs.existsSync(path.join(NEW_UPLOADS, newFile))) fs.unlinkSync(path.join(NEW_UPLOADS, newFile))
  } catch (e) {}
  await pool.end()
})
