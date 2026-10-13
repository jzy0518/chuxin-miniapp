// pages/mine/index.js
const { ensureLogin, request, logout } = require('../../utils/api')

Page({
  data: {
    loggedIn: false,
    user: { nickName: '', avatarUrl: '' },
    stats: { done: 0, todo: 0, videos: 0 },
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    this.loadUser()
  },

  // 读取本地登录态 + 拉取服务端最新资料与画像
  loadUser() {
    const local = wx.getStorageSync('userInfo')
    if (!local) {
      this.setData({
        loggedIn: false,
        user: { nickName: '', avatarUrl: '' },
        stats: { done: 0, todo: 0, videos: 0 },
      })
      return
    }
    this.setData({ loggedIn: true, user: this.toViewUser(local) })

    request('GET', '/api/user/me')
      .then((data) => {
        this.setData({
          user: this.toViewUser(data.user),
          stats: data.stats,
        })
      })
      .catch((e) => {
        // 服务端不可用时仍展示本地缓存
        console.warn('拉取用户信息失败:', e.message)
      })
  },

  // 后端字段(snake_case) → 页面字段(camelCase)
  toViewUser(u) {
    return {
      nickName: u.nick_name || u.nickName || '',
      avatarUrl: u.avatar_url || u.avatarUrl || '',
      skillLevel: u.skill_level != null ? u.skill_level : 0,
    }
  },

  // 登录（微信静默登录，无需用户授权资料）
  login() {
    wx.showLoading({ title: '登录中' })
    ensureLogin()
      .then(() => {
        wx.hideLoading()
        wx.showToast({ title: '登录成功', icon: 'success' })
        this.loadUser()
      })
      .catch((e) => {
        wx.hideLoading()
        wx.showToast({ title: e.message, icon: 'none' })
      })
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          logout()
          this.setData({
            loggedIn: false,
            user: { nickName: '', avatarUrl: '' },
            stats: { done: 0, todo: 0, videos: 0 },
          })
          wx.showToast({ title: '已退出', icon: 'none' })
        }
      },
    })
  },
})