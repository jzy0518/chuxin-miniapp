// pages/mine/index.js
Page({
  data: {
    loggedIn: false,
    user: { nickName: '', avatarUrl: '' },
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    this.loadUser()
  },

  // 读取本地登录态
  loadUser() {
    const user = wx.getStorageSync('userInfo')
    this.setData({ loggedIn: !!user, user: user || { nickName: '', avatarUrl: '' } })
  },

  // 登录（获取微信授权头像昵称）
  login() {
    wx.getUserProfile({
      desc: '用于展示你的个人资料',
      success: (res) => {
        const user = {
          nickName: res.userInfo.nickName,
          avatarUrl: res.userInfo.avatarUrl,
        }
        wx.setStorageSync('userInfo', user)
        this.setData({ loggedIn: true, user })
        wx.showToast({ title: '登录成功', icon: 'success' })
      },
      fail: () => {
        wx.showToast({ title: '已取消登录', icon: 'none' })
      },
    })
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('userInfo')
          this.setData({ loggedIn: false, user: { nickName: '', avatarUrl: '' } })
          wx.showToast({ title: '已退出', icon: 'none' })
        }
      },
    })
  },
})