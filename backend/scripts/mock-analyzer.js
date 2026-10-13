// 模拟 AI 分析 worker（开发测试用）
// 用法：node scripts/mock-analyzer.js
// 作用：轮询状态为 0（排队中）的分析任务，模拟推理 2 秒后回调假结果，
//       用于打通「提交任务 -> 推理 -> 结果落库 -> 前端轮询」全链路。
// 接入真实模型后：用你的 Python 推理服务替代本脚本，回调接口不变。
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const mysql = require('mysql2/promise')
const config = require('../src/config')

const POLL_INTERVAL = 3000 // 轮询间隔(ms)
const FAKE_INFER = 2000 // 模拟推理耗时(ms)

async function main() {
  const conn = await mysql.createConnection(config.db)
  console.log('[mock-analyzer] 已连接数据库，开始轮询待分析任务...')

  setInterval(async () => {
    try {
      const [rows] = await conn.query(
        'SELECT id, video_id, action_type_id FROM video_analysis WHERE status = 0 ORDER BY id ASC LIMIT 1'
      )
      if (rows.length === 0) return
      const task = rows[0]
      console.log(`[mock-analyzer] 发现任务 #${task.id}（视频 #${task.video_id}），模拟推理中...`)

      setTimeout(async () => {
        try {
          const score = 60 + Math.floor(Math.random() * 36)
          const result = {
            score,
            corrects: [
              { pointName: '持拍手肘抬太低', correct: Math.random() > 0.5, confidence: 0.82, frameTime: 2.1 },
              { pointName: '击球点偏后', correct: Math.random() > 0.5, confidence: 0.75, frameTime: 4.6 },
            ],
            model: 'mock-pose-v0',
            raw: {},
          }
          const key = process.env.ANALYSIS_WORKER_KEY || ''
          const base = `http://127.0.0.1:${config.port}`
          const res = await fetch(`${base}/api/analysis/${task.id}/result`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-worker-key': key },
            body: JSON.stringify({ status: 1, score, resultJson: result }),
          })
          console.log(`[mock-analyzer] 任务 #${task.id} 回调完成 -> HTTP ${res.status}`)
        } catch (e) {
          console.error('[mock-analyzer] 回调失败:', e.message)
        }
      }, FAKE_INFER)
    } catch (e) {
      console.error('[mock-analyzer] 轮询失败:', e.message)
    }
  }, POLL_INTERVAL)
}

main().catch((e) => {
  console.error('[mock-analyzer] 启动失败:', e.message)
  process.exit(1)
})