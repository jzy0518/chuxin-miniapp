// pages/train/index.js
const { request } = require('../../utils/api')

// 静态兜底：服务器未启动时仍展示基本动作清单
const FALLBACK_ACTIONS = [
  { id: 'clear', icon: '🏸', name: '高远球' },
  { id: 'smash', icon: '⚡', name: '杀球' },
  { id: 'drop', icon: '🎾', name: '吊球' },
  { id: 'lift', icon: '🔄', name: '挑球' },
  { id: 'net', icon: '🕊', name: '放网' },
  { id: 'transition', icon: '👟', name: '过渡' },
]

Page({
  data: {
    actions: FALLBACK_ACTIONS,
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    this.loadActions()
  },

  // 从后端加载动作列表（含纠正统计），失败保持静态数据
  loadActions() {
    request('GET', '/api/actions')
      .then((list) => {
        if (list && list.length) {
          this.setData({
            actions: list.map((a) => ({
              id: a.id,
              icon: a.icon,
              name: a.name,
              doneCount: a.doneCount,
              todoCount: a.todoCount,
            })),
          })
        }
      })
      .catch((e) => {
        console.warn('加载动作列表失败，使用静态数据:', e.message)
      })
  },

  onTap(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.actions.find((a) => String(a.id) === String(id))
    if (!item) return
    wx.navigateTo({ url: '/pages/correct/index?actionId=' + item.id + '&name=' + item.name })
  },
})