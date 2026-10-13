// pages/train/index.js
Page({
  data: {
    actions: [
      { id: 'clear', icon: '🏸', name: '高远球' },
      { id: 'smash', icon: '⚡', name: '杀球' },
      { id: 'drop', icon: '🎾', name: '吊球' },
      { id: 'lift', icon: '🔄', name: '挑球' },
      { id: 'net', icon: '🕊', name: '放网' },
      { id: 'transition', icon: '👟', name: '过渡' },
    ],
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
  },

  onTap(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.actions.find((a) => a.id === id)
    wx.navigateTo({ url: '/pages/action/index?action=' + (item ? item.name : '') })
  },
})