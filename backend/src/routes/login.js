// 登录：wx.login 的 code 换 openid，建/查用户，签发 JWT
const express = require('express')
const jwt = require('jsonwebtoken')
const { pool } = require('../db')
const config = require('../config')
const { code2session } = require('../utils/wechat')

const router = express.Router()

// POST /api/login  { code, nickName?, avatarUrl? }
router.post('/login', async (req, res) => {
  const { code, nickName, avatarUrl } = req.body || {}
  if (!code) {
    return res.status(400).json({ code: 400, msg: '缺少 code' })
  }

  try {
    const { openid } = await code2session(code)

    let user
    const [rows] = await pool.query('SELECT * FROM `user` WHERE openid = ?', [openid])

    if (rows.length === 0) {
      // 首次登录：创建用户
      const name = nickName || '羽毛球爱好者'
      const avatar = avatarUrl || ''
      const [r] = await pool.query(
        'INSERT INTO `user` (openid, nick_name, avatar_url) VALUES (?, ?, ?)',
        [openid, name, avatar]
      )
      user = { id: r.insertId, openid, nick_name: name, avatar_url: avatar, skill_level: 0 }
    } else {
      user = rows[0]
      // 已存在：若带新资料则顺带更新
      if ((nickName && user.nick_name !== nickName) || (avatarUrl && user.avatar_url !== avatarUrl)) {
        await pool.query(
          'UPDATE `user` SET nick_name = ?, avatar_url = ? WHERE id = ?',
          [nickName || user.nick_name, avatarUrl || user.avatar_url, user.id]
        )
        user.nick_name = nickName || user.nick_name
        user.avatar_url = avatarUrl || user.avatar_url
      }
    }

    const token = jwt.sign({ userId: user.id, openid }, config.jwtSecret, { expiresIn: '30d' })
    res.json({ code: 0, msg: 'ok', data: { token, user } })
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message })
  }
})

module.exports = router