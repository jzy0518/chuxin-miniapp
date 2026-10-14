// pages/train/index.js
const { request } = require('../../utils/api')

// 静态兜底：服务器未启动时仍展示基本动作清单
const FALLBACK_ACTIONS = [
  { id: 'clear', icon: '🏸', name: '正手高远球', category: '后场' },
  { id: 'backclear', icon: '🪃', name: '反手高远', category: '后场' },
  { id: 'smash', icon: '⚡', name: '杀球', category: '后场' },
  { id: 'drop', icon: '🎾', name: '吊球', category: '后场' },
  { id: 'lift', icon: '🔄', name: '挑球', category: '网前' },
  { id: 'net', icon: '🕊', name: '放网', category: '网前' },
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
              category: a.category,
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

  // 底部主操作：开始动作检测 → 前往实战上传视频
  goDetect() {
    wx.switchTab({ url: '/pages/battle/index' })
  },
})