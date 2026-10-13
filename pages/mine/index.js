// pages/mine/index.js
const { ensureLogin, request, logout, uploadAvatar, BASE_URL } = require('../../utils/api')

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
      avatarUrl: this.fullUrl(u.avatar_url || u.avatarUrl || ''),
      skillLevel: u.skill_level != null ? u.skill_level : 0,
    }
  },

  // 相对路径(如 /files/avatars/x.jpg)补全为完整地址——小程序 image 不认相对路径
  fullUrl(url) {
    if (!url) return ''
    return /^https?:/.test(url) ? url : BASE_URL + url
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

  // 选择新头像（微信官方组件）：上传到后端并更新资料
  onChooseAvatar(e) {
    const tempPath = e.detail.avatarUrl
    if (!tempPath) return
    wx.showLoading({ title: '上传头像' })
    uploadAvatar(tempPath)
      .then((d) => {
        wx.hideLoading()
        this.setData({ 'user.avatarUrl': this.fullUrl(d.avatarUrl) })
        this.syncLocalUser()
        wx.showToast({ title: '头像已更新', icon: 'success' })
      })
      .catch((err) => {
        wx.hideLoading()
        wx.showToast({ title: err.message, icon: 'none' })
      })
  },

  // 昵称输入实时更新页面显示
  onNickInput(e) {
    this.setData({ 'user.nickName': e.detail.value })
  },

  // 昵称失焦保存
  onNickSave(e) {
    const nickName = (e.detail.value || '').trim()
    request('PUT', '/api/user/me', { nickName })
      .then(() => {
        this.setData({ 'user.nickName': nickName })
        this.syncLocalUser()
        wx.showToast({ title: '昵称已保存', icon: 'success' })
      })
      .catch((err) => wx.showToast({ title: err.message, icon: 'none' }))
  },

  // 把最新昵称/头像同步进本地缓存
  syncLocalUser() {
    const local = wx.getStorageSync('userInfo') || {}
    local.nick_name = this.data.user.nickName
    local.avatar_url = this.data.user.avatarUrl
    wx.setStorageSync('userInfo', local)
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