// 视频：上传（multipart）、缩略图上传、列表（按来源过滤）、统计
// source：1=动作检测 2=实战（两类共用一个 video 表，靠 source 区分）
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

// 缩略图上传（图片）
const thumbUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) return cb(null, true)
    cb(new Error('只支持图片文件'))
  },
})

// POST /api/videos  上传视频（form-data 字段名 video，可带 title/duration/source/actionTypeId）
router.post('/videos', auth, upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ code: 400, msg: '缺少视频文件' })
  }
  const filename = req.file.filename
  const title = (req.body && req.body.title) || req.file.originalname || '现场视频'
  const duration = Number((req.body && req.body.duration)) || 0
  const source = Number((req.body && req.body.source)) === 1 ? 1 : 2
  const actionTypeId = Number((req.body && req.body.actionTypeId)) || null

  try {
    const [r] = await pool.query(
      'INSERT INTO video (user_id, source, action_type_id, title, file_key, file_url, duration_sec, status) VALUES (?, ?, ?, ?, ?, ?, ?, 0)',
      [req.user.userId, source, actionTypeId, title, filename, '/files/' + filename, duration]
    )
    res.json({ code: 0, msg: '上传成功', data: { id: r.insertId, url: '/files/' + filename } })
  } catch (e) {
    fs.unlink(req.file.path, () => {})
    res.status(500).json({ code: 500, msg: e.message })
  }
})

// POST /api/videos/:id/thumb  上传视频缩略图（图片，form-data 字段名 thumb）
router.post('/videos/:id/thumb', auth, thumbUpload.single('thumb'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ code: 400, msg: '缺少缩略图文件' })
  }
  const filename = req.file.filename
  try {
    const [videos] = await pool.query('SELECT id FROM video WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.userId,
    ])
    if (videos.length === 0) {
      fs.unlink(req.file.path, () => {})
      return res.status(404).json({ code: 404, msg: '视频不存在' })
    }
    await pool.query('UPDATE video SET thumb_url = ? WHERE id = ?', ['/files/' + filename, req.params.id])
    res.json({ code: 0, msg: 'ok', data: { thumbUrl: '/files/' + filename } })
  } catch (e) {
    fs.unlink(req.file.path, () => {})
    res.status(500).json({ code: 500, msg: e.message })
  }
})

// GET /api/videos  我的视频列表（可 ?source=1|2 过滤；附带动作名与最新分析状态）
router.get('/videos', auth, async (req, res) => {
  const source = Number(req.query.source)
  const filtered = source === 1 || source === 2
  try {
    const sql = `
      SELECT v.id, v.source, v.action_type_id, v.title, v.file_url, v.thumb_url,
             v.duration_sec, v.status, v.created_at,
             t.name AS action_name,
             a.status AS a_status, a.score
      FROM video v
      LEFT JOIN action_type t ON t.id = v.action_type_id
      LEFT JOIN video_analysis a ON a.id =
        (SELECT id FROM video_analysis WHERE video_id = v.id ORDER BY id DESC LIMIT 1)
      WHERE v.user_id = ?${filtered ? ' AND v.source = ?' : ''}
      ORDER BY v.id DESC`
    const params = filtered ? [req.user.userId, source] : [req.user.userId]
    const [rows] = await pool.query(sql, params)
    const data = rows.map((r) => ({
      id: r.id,
      source: r.source,
      actionTypeId: r.action_type_id,
      actionName: r.action_name || '',
      title: r.title,
      url: r.file_url,
      thumbUrl: r.thumb_url,
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

// GET /api/videos/stats  各来源视频计数（动作检测/实战）
router.get('/videos/stats', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT source, COUNT(*) AS cnt FROM video WHERE user_id = ? GROUP BY source',
      [req.user.userId]
    )
    let detect = 0
    let battle = 0
    rows.forEach((r) => {
      if (r.source === 1) detect = r.cnt
      else if (r.source === 2) battle = r.cnt
    })
    res.json({ code: 0, msg: 'ok', data: { detect, battle, total: detect + battle } })
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message })
  }
})

// DELETE /api/videos/all  清空当前用户所有视频与报告（含磁盘视频/缩略图文件）
router.delete('/videos/all', auth, async (req, res) => {
  try {
    // 1. 先取出文件引用，用于删除磁盘文件
    const [videos] = await pool.query(
      'SELECT file_key, thumb_url FROM video WHERE user_id = ?',
      [req.user.userId]
    )
    // 2. 删分析记录（子表，受外键约束需先删）
    await pool.query(
      'DELETE va FROM video_analysis va JOIN video v ON va.video_id = v.id WHERE v.user_id = ?',
      [req.user.userId]
    )
    // 3. 删视频记录
    const [r] = await pool.query('DELETE FROM video WHERE user_id = ?', [req.user.userId])
    // 4. 异步清理磁盘文件（不阻塞响应）
    videos.forEach((v) => {
      if (v.file_key) fs.unlink(path.join(config.uploadDir, v.file_key), () => {})
      if (v.thumb_url) fs.unlink(path.join(config.uploadDir, path.basename(v.thumb_url)), () => {})
    })
    res.json({ code: 0, msg: '已清空', data: { deleted: r.affectedRows } })
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message })
  }
})

module.exports = router