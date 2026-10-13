// 用户资料与技术画像
const express = require('express')
const { pool } = require('../db')
const auth = require('../middleware/auth')

const router = express.Router()

// GET /api/user/me  我的页面：用户信息 + 画像统计
router.get('/user/me', auth, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, openid, nick_name, avatar_url, skill_level, created_at FROM `user` WHERE id = ?',
      [req.user.userId]
    )
    if (users.length === 0) {
      return res.status(404).json({ code: 404, msg: '用户不存在' })
    }

    // 纠正统计：已纠正 / 待纠正
    const [[c]] = await pool.query(
      `SELECT COALESCE(SUM(status = 1), 0) AS done,
              COALESCE(SUM(status = 0), 0) AS todo
       FROM action_correct WHERE user_id = ?`,
      [req.user.userId]
    )
    // 视频数
    const [[v]] = await pool.query('SELECT COUNT(*) AS videos FROM video WHERE user_id = ?', [req.user.userId])

    res.json({
      code: 0,
      msg: 'ok',
      data: {
        user: users[0],
        stats: {
          done: Number(c.done) || 0,
          todo: Number(c.todo) || 0,
          videos: Number(v.videos) || 0,
        },
      },
    })
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message })
  }
})

// PUT /api/user/me  更新昵称/头像/技术等级
router.put('/user/me', auth, async (req, res) => {
  const { nickName, avatarUrl, skillLevel } = req.body || {}
  try {
    const [rows] = await pool.query('SELECT * FROM `user` WHERE id = ?', [req.user.userId])
    if (rows.length === 0) {
      return res.status(404).json({ code: 404, msg: '用户不存在' })
    }
    const old = rows[0]
    const nick = nickName !== undefined ? String(nickName) : old.nick_name
    const avatar = avatarUrl !== undefined ? String(avatarUrl) : old.avatar_url
    const level = skillLevel !== undefined && !Number.isNaN(Number(skillLevel)) ? Number(skillLevel) : old.skill_level

    await pool.query(
      'UPDATE `user` SET nick_name = ?, avatar_url = ?, skill_level = ? WHERE id = ?',
      [nick, avatar, level, req.user.userId]
    )
    res.json({ code: 0, msg: 'ok', data: { nick_name: nick, avatar_url: avatar, skill_level: level } })
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message })
  }
})

module.exports = router