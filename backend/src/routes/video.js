// 实战视频：上传（multipart）与列表
const fs = require('fs')
const path = require('path')
const express = require('express')
const multer = require('multer')
const { pool } = require('../db')
const config = require('../config')
const auth = require('../middleware/auth')

const router = express.Router()

// 上传目录（backend/uploads），随库记录相对 key
fs.mkdirSync(config.uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4'
    cb(null, Date.now() + '_' + Math.round(Math.random() * 1e6) + ext)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: config.uploadMaxMB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('video/')) return cb(null, true)
    cb(new Error('只支持视频文件'))
  },
})

// POST /api/videos  上传视频（form-data 字段名 video，可带 title/duration）
router.post('/videos', auth, upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ code: 400, msg: '缺少视频文件' })
  }
  const filename = req.file.filename
  const title = (req.body && req.body.title) || req.file.originalname || '现场视频'
  const duration = Number((req.body && req.body.duration)) || 0

  try {
    const [r] = await pool.query(
      'INSERT INTO video (user_id, title, file_key, file_url, duration_sec, status) VALUES (?, ?, ?, ?, ?, 0)',
      [req.user.userId, title, filename, '/files/' + filename, duration]
    )
    res.json({ code: 0, msg: '上传成功', data: { id: r.insertId, url: '/files/' + filename } })
  } catch (e) {
    // 写库失败则清理已落盘文件
    fs.unlink(req.file.path, () => {})
    res.status(500).json({ code: 500, msg: e.message })
  }
})

// GET /api/videos  我的视频列表（附带每个视频最新一次分析状态）
router.get('/videos', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT v.id, v.title, v.file_url, v.duration_sec, v.status, v.created_at,
              a.status AS a_status, a.score
       FROM video v
       LEFT JOIN video_analysis a ON a.id =
         (SELECT id FROM video_analysis WHERE video_id = v.id ORDER BY id DESC LIMIT 1)
       WHERE v.user_id = ?
       ORDER BY v.id DESC`,
      [req.user.userId]
    )
    const data = rows.map((r) => ({
      id: r.id,
      title: r.title,
      url: r.file_url,
      durationSec: r.duration_sec,
      status: r.status,
      createdAt: r.created_at,
      // 最新分析状态：null=未分析 0=排队中 1=完成 2=失败
      analysis: r.a_status == null ? null : { status: r.a_status, score: r.score },
    }))
    res.json({ code: 0, msg: 'ok', data })
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message })
  }
})

module.exports = router