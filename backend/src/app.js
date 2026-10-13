// chuxin 羽毛球动作纠正小程序 · 后端入口
const path = require('path')
const express = require('express')
const multer = require('multer')
const config = require('./config')
const { ping } = require('./db')

const app = express()
app.use(express.json())

// 视频静态访问：/files/xxx.mp4
app.use('/files', express.static(config.uploadDir))

// 业务路由
app.use('/api', require('./routes/login'))
app.use('/api', require('./routes/user'))
app.use('/api', require('./routes/action'))
app.use('/api', require('./routes/analysis'))
app.use('/api', require('./routes/video'))

// 健康检查
app.get('/api/health', (req, res) => res.json({ code: 0, msg: 'ok', time: new Date().toISOString() }))

// 404
app.use((req, res) => res.status(404).json({ code: 404, msg: '接口不存在' }))

// 统一错误处理
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? '视频超过大小限制' : '上传失败: ' + err.code
    return res.status(400).json({ code: 400, msg })
  }
  console.error('[server error]', err)
  res.status(500).json({ code: 500, msg: err.message || '服务器错误' })
})

async function start() {
  await ping()
  console.log('[db] connected')
  app.listen(config.port, () => {
    console.log(`[server] chuxin backend listening on http://127.0.0.1:${config.port}`)
    console.log(`[server] wx login mode: ${config.wx.mockLogin ? 'mock (未配置 WX_SECRET)' : 'real'}`)
  })
}

start().catch((e) => {
  console.error('[startup failed]', e.message)
  process.exit(1)
})