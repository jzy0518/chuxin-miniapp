// custom-tab-bar/index.js
Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/train/index', text: '动作检测', icon: 'train', center: false },
      { pagePath: '/pages/battle/index', text: '实战', icon: 'bolt', center: true },
      { pagePath: '/pages/mine/index', text: '我的', icon: 'mine', center: false },
    ],
  },
  methods: {
    switchTab(e) {
      const index = Number(e.currentTarget.dataset.index)
      const item = this.data.list[index]
      if (index === this.data.selected) return
      wx.switchTab({
        url: item.pagePath,
      })
    },
  },
})