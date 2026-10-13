// AI 视频分析：任务提交 / 状态查询 / worker 结果回调（异步三段式）
// 接入真实模型：把 Python 推理服务实现为 worker，分析完成后回调 /api/analysis/:id/result
const express = require('express')
const { pool } = require('../db')
const config = require('../config')
const auth = require('../middleware/auth')

const router = express.Router()

// POST /api/analysis  提交分析任务  { videoId, actionTypeId? }
router.post('/analysis', auth, async (req, res) => {
  const { videoId, actionTypeId } = req.body || {}
  if (!videoId) {
    return res.status(400).json({ code: 400, msg: '缺少 videoId' })
  }
  try {
    // 只能分析自己的视频
    const [videos] = await pool.query('SELECT id FROM video WHERE id = ? AND user_id = ?', [
      videoId,
      req.user.userId,
    ])
    if (videos.length === 0) {
      return res.status(404).json({ code: 404, msg: '视频不存在' })
    }
    const [r] = await pool.query(
      'INSERT INTO video_analysis (video_id, action_type_id, status) VALUES (?, ?, 0)',
      [videoId, actionTypeId || null]
    )
    res.json({ code: 0, msg: 'ok', data: { id: r.insertId, status: 0 } })
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message })
  }
})

// GET /api/analysis/:id  查询任务状态与结果（前端轮询用）
router.get('/analysis/:id', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.id, a.video_id, a.action_type_id, a.status, a.score, a.result_json, a.error_msg, a.created_at, a.updated_at
       FROM video_analysis a
       JOIN video v ON v.id = a.video_id
       WHERE a.id = ? AND v.user_id = ?`,
      [req.params.id, req.user.userId]
    )
    if (rows.length === 0) {
      return res.status(404).json({ code: 404, msg: '分析任务不存在' })
    }
    res.json({ code: 0, msg: 'ok', data: rows[0] })
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message })
  }
})

// GET /api/analysis?videoId=  某视频的全部分析记录
router.get('/analysis', auth, async (req, res) => {
  const { videoId } = req.query
  if (!videoId) {
    return res.status(400).json({ code: 400, msg: '缺少 videoId' })
  }
  try {
    const [rows] = await pool.query(
      `SELECT a.id, a.action_type_id, a.status, a.score, a.result_json, a.error_msg, a.created_at
       FROM video_analysis a
       JOIN video v ON v.id = a.video_id
       WHERE a.video_id = ? AND v.user_id = ?
       ORDER BY a.id DESC`,
      [videoId, req.user.userId]
    )
    res.json({ code: 0, msg: 'ok', data: rows })
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message })
  }
})

// POST /api/analysis/:id/result  worker 结果回调（Python 推理服务专用，需内部密钥）
// 入参：{ status: 1|2, score?, resultJson?, errorMsg? }
// resultJson 建议结构：{ score, corrects:[{pointName,correct,confidence,frameTime}], model, raw }
router.post('/analysis/:id/result', async (req, res) => {
  const key = req.headers['x-worker-key'] || ''
  if (!config.workerKey || key !== config.workerKey) {
    return res.status(403).json({ code: 403, msg: '无效的 worker 密钥' })
  }
  const { status, score, resultJson, errorMsg } = req.body || {}
  try {
    if (status === 2) {
      await pool.query('UPDATE video_analysis SET status = 2, error_msg = ? WHERE id = ?', [
        errorMsg ? String(errorMsg).slice(0, 255) : '分析失败',
        req.params.id,
      ])
    } else {
      const finalScore = score != null && !Number.isNaN(Number(score)) ? Math.max(0, Math.min(100, Number(score))) : null
      await pool.query(
        'UPDATE video_analysis SET status = 1, score = ?, result_json = ? WHERE id = ?',
        [finalScore, resultJson ? JSON.stringify(resultJson) : null, req.params.id]
      )
    }
    res.json({ code: 0, msg: 'ok' })
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message })
  }
})

module.exports = router