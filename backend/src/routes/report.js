// 报告：视频分析完成后的诊断报告（按动作类型归档）
// 数据来源：video_analysis（status=1 完成）JOIN video JOIN action_type
const express = require('express')
const { pool } = require('../db')
const auth = require('../middleware/auth')

const router = express.Router()

// 从 result_json 解析纠正点清单（兼容字符串/对象两种形态）
function parseCorrects(resultJson) {
  if (!resultJson) return []
  let r = resultJson
  if (typeof r === 'string') {
    try { r = JSON.parse(r) } catch (e) { return [] }
  }
  return Array.isArray(r && r.corrects) ? r.corrects : []
}

// mysql2 默认把 DATETIME 返回成 Date 对象，这里统一格式化成 YYYY-MM-DD
function fmtDate(d) {
  if (!d) return ''
  if (d instanceof Date && !isNaN(d.getTime())) {
    const m = ('0' + (d.getMonth() + 1)).slice(-2)
    const day = ('0' + d.getDate()).slice(-2)
    return d.getFullYear() + '-' + m + '-' + day
  }
  return String(d).slice(0, 10)
}

// GET /api/reports  我的报告列表（按动作类型分组）
router.get('/reports', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.id, a.video_id, a.score, a.result_json, a.updated_at,
              v.action_type_id, v.thumb_url,
              t.name AS action_name, t.category, t.sort_order
       FROM video_analysis a
       JOIN video v ON v.id = a.video_id
       LEFT JOIN action_type t ON t.id = v.action_type_id
       WHERE v.user_id = ? AND a.status = 1
       ORDER BY t.sort_order, a.updated_at DESC`,
      [req.user.userId]
    )
    // 按动作类型分组
    const map = new Map()
    rows.forEach((r) => {
      const key = r.action_type_id || 0
      if (!map.has(key)) {
        map.set(key, {
          actionTypeId: r.action_type_id,
          actionName: r.action_name || '未知动作',
          category: r.category || '',
          reports: [],
        })
      }
      const corrects = parseCorrects(r.result_json)
      const issueCount = corrects.filter((c) => c.correct === false).length
      map.get(key).reports.push({
        id: r.id,
        videoId: r.video_id,
        score: r.score,
        issueCount,
        thumbUrl: r.thumb_url,
        date: fmtDate(r.updated_at),
      })
    })
    const data = Array.from(map.values()).map((g) => {
      g.count = g.reports.length
      return g
    })
    res.json({ code: 0, msg: 'ok', data })
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message })
  }
})

// GET /api/reports/:id  报告详情（含纠正点清单 + 视频信息）
router.get('/reports/:id', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.id, a.video_id, a.score, a.result_json, a.updated_at,
              v.title, v.file_url, v.thumb_url, v.duration_sec,
              t.name AS action_name, t.category
       FROM video_analysis a
       JOIN video v ON v.id = a.video_id
       LEFT JOIN action_type t ON t.id = v.action_type_id
       WHERE a.id = ? AND v.user_id = ?`,
      [req.params.id, req.user.userId]
    )
    if (rows.length === 0) {
      return res.status(404).json({ code: 404, msg: '报告不存在' })
    }
    const r = rows[0]
    res.json({
      code: 0,
      msg: 'ok',
      data: {
        id: r.id,
        videoId: r.video_id,
        actionName: r.action_name || '动作报告',
        category: r.category || '',
        score: r.score,
        date: fmtDate(r.updated_at),
        title: r.title || '',
        videoUrl: r.file_url,
        thumbUrl: r.thumb_url,
        durationSec: r.duration_sec || 0,
        corrects: parseCorrects(r.result_json),
      },
    })
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message })
  }
})

module.exports = router