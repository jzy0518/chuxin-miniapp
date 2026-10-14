// 动作纠正：动作类型列表 + 纠正点增删改查
const express = require('express')
const { pool } = require('../db')
const auth = require('../middleware/auth')

const router = express.Router()

// GET /api/actions  动作列表（含本人已纠正/待纠正数，供进度环展示）
router.get('/actions', auth, async (req, res) => {
  try {
    const [actions] = await pool.query(
      `SELECT a.id, a.code, a.name, a.category, a.icon,
              COALESCE(SUM(c.status = 1), 0) AS done_count,
              COALESCE(SUM(c.status = 0), 0) AS todo_count
       FROM action_type a
       LEFT JOIN action_correct c
         ON c.action_type_id = a.id AND c.user_id = ?
       WHERE a.is_active = 1
       GROUP BY a.id
       ORDER BY a.sort_order`,
      [req.user.userId]
    )
    const data = actions.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      category: a.category,
      icon: a.icon,
      doneCount: Number(a.done_count) || 0,
      todoCount: Number(a.todo_count) || 0,
    }))
    res.json({ code: 0, msg: 'ok', data })
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message })
  }
})

// GET /api/actions/:id/corrects  某动作的纠正点列表
router.get('/actions/:id/corrects', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, action_type_id, point_name, status, note, corrected_at
       FROM action_correct
       WHERE user_id = ? AND action_type_id = ?
       ORDER BY status ASC, id DESC`,
      [req.user.userId, req.params.id]
    )
    const data = rows.map((r) => ({
      id: r.id,
      actionTypeId: r.action_type_id,
      pointName: r.point_name,
      status: r.status, // 0 待纠正 / 1 已纠正
      note: r.note,
      correctedAt: r.corrected_at,
    }))
    res.json({ code: 0, msg: 'ok', data })
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message })
  }
})

// POST /api/actions/:id/corrects  新增纠正点  { pointName, note? }
router.post('/actions/:id/corrects', auth, async (req, res) => {
  const { pointName, note } = req.body || {}
  if (!pointName || !String(pointName).trim()) {
    return res.status(400).json({ code: 400, msg: '纠正点名称不能为空' })
  }
  try {
    const [r] = await pool.query(
      'INSERT INTO action_correct (user_id, action_type_id, point_name, status, note) VALUES (?, ?, ?, 0, ?)',
      [req.user.userId, req.params.id, String(pointName).trim(), note || null]
    )
    res.json({ code: 0, msg: 'ok', data: { id: r.insertId } })
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message })
  }
})

// PUT /api/corrects/:id  更新纠正点  { status?, pointName?, note? }（status 0/1）
router.put('/corrects/:id', auth, async (req, res) => {
  const { status, pointName, note } = req.body || {}
  try {
    const [rows] = await pool.query(
      'SELECT * FROM action_correct WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.userId]
    )
    if (rows.length === 0) {
      return res.status(404).json({ code: 404, msg: '纠正点不存在' })
    }
    const old = rows[0]
    const nextStatus = status === undefined ? old.status : status ? 1 : 0
    const nextName = pointName !== undefined ? String(pointName).trim() : old.point_name
    const nextNote = note !== undefined ? note : old.note
    const correctedAt = nextStatus === 1 ? new Date() : null

    await pool.query(
      'UPDATE action_correct SET status = ?, point_name = ?, note = ?, corrected_at = ? WHERE id = ?',
      [nextStatus, nextName, nextNote, correctedAt, old.id]
    )
    res.json({ code: 0, msg: 'ok', data: { id: old.id, status: nextStatus } })
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message })
  }
})

// DELETE /api/corrects/:id  删除纠正点
router.delete('/corrects/:id', auth, async (req, res) => {
  try {
    const [r] = await pool.query('DELETE FROM action_correct WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.userId,
    ])
    if (r.affectedRows === 0) {
      return res.status(404).json({ code: 404, msg: '纠正点不存在' })
    }
    res.json({ code: 0, msg: 'ok' })
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message })
  }
})

module.exports = router