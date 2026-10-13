// pages/correct/index.js  动作纠正点管理页
const { request } = require('../../utils/api')

Page({
  data: {
    actionId: null,
    actionName: '',
    corrects: [],
    doneCount: 0,
    todoCount: 0,
    newPoint: '',
  },

  onLoad(options) {
    this.setData({
      actionId: options.actionId,
      actionName: options.name || '动作',
    })
  },

  onShow() {
    this.load()
  },

  goBack() {
    wx.navigateBack()
  },

  // 拉取纠正点列表
  load() {
    request('GET', `/api/actions/${this.data.actionId}/corrects`)
      .then((list) => {
        const done = list.filter((c) => c.status === 1).length
        this.setData({ corrects: list, doneCount: done, todoCount: list.length - done })
      })
      .catch((e) => wx.showToast({ title: e.message, icon: 'none' }))
  },

  // 勾选/取消已纠正
  toggle(e) {
    const { id, status } = e.currentTarget.dataset
    const next = status === 1 ? 0 : 1
    request('PUT', `/api/corrects/${id}`, { status: next })
      .then(() => this.load())
      .catch((err) => wx.showToast({ title: err.message, icon: 'none' }))
  },

  // 删除纠正点
  del(e) {
    const { id } = e.currentTarget.dataset
    wx.showModal({
      title: '删除纠正点',
      content: '确定删除这条纠正点吗？',
      success: (res) => {
        if (!res.confirm) return
        request('DELETE', `/api/corrects/${id}`)
          .then(() => {
            this.load()
            wx.showToast({ title: '已删除', icon: 'none' })
          })
          .catch((err) => wx.showToast({ title: err.message, icon: 'none' }))
      },
    })
  },

  // 新增纠正点输入
  onInput(e) {
    this.setData({ newPoint: e.detail.value })
  },

  add() {
    const name = (this.data.newPoint || '').trim()
    if (!name) {
      wx.showToast({ title: '先输入纠正点内容', icon: 'none' })
      return
    }
    request('POST', `/api/actions/${this.data.actionId}/corrects`, { pointName: name })
      .then(() => {
        this.setData({ newPoint: '' })
        this.load()
      })
      .catch((err) => wx.showToast({ title: err.message, icon: 'none' }))
  },

  // 跳上传练习视频页
  goUpload() {
    wx.navigateTo({ url: '/pages/action/index?action=' + this.data.actionName })
  },
})