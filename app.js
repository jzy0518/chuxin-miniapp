// app.js
const { ensureLogin } = require('./utils/api')

App({
  onLaunch() {
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 静默登录：换 token 存入本地，失败不打断启动（页面调接口时会重试）
    ensureLogin()
      .then(({ user }) => {
        this.globalData.userInfo = user
      })
      .catch(() => {})
  },
  globalData: {
    userInfo: null
  }
})