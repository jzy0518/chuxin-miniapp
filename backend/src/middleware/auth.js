// JWT 鉴权中间件：校验 Authorization: Bearer <token>
const jwt = require('jsonwebtoken')
const config = require('../config')

module.exports = function auth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    return res.status(401).json({ code: 401, msg: '未登录' })
  }
  try {
    req.user = jwt.verify(token, config.jwtSecret) // { userId, openid }
    next()
  } catch (e) {
    return res.status(401).json({ code: 401, msg: '登录已过期，请重新登录' })
  }
}