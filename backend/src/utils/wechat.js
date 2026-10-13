// 微信 code2session：用 wx.login 的 code 换 openid
const crypto = require('crypto')
const config = require('../config')

async function code2session(code) {
  // mock 模式：未配置 WX_SECRET，用 code 稳定地模拟出一个 openid（本地联调用）
  if (config.wx.mockLogin) {
    const fake = crypto.createHash('md5').update(code).digest('hex').slice(0, 24)
    return { openid: 'mock_' + fake }
  }

  // 真实模式：调微信官方接口
  const url =
    'https://api.weixin.qq.com/sns/jscode2session' +
    `?appid=${config.wx.appid}&secret=${config.wx.secret}` +
    `&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`
  const res = await fetch(url)
  const data = await res.json()
  if (!data.openid) {
    throw new Error(data.errmsg || '微信登录失败')
  }
  return data // { openid, session_key, unionid? }
}

module.exports = { code2session }