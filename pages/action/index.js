// pages/action/index.js
Page({
  data: {
    actionName: '',
    status: 'idle',
    progress: 0,
  },

  onLoad(options) {
    this.setData({ actionName: options.action || '动作' })
  },

  goBack() {
    wx.navigateBack()
  },

  // 从相册选择视频
  chooseVideo() {
    if (this.data.status === 'uploading') return

    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      sourceType: ['album'],
      success: () => this.simulateUpload(),
      fail: (err) => {
        if (err.errMsg && /cancel/.test(err.errMsg)) return
        wx.showToast({ title: '选择视频失败', icon: 'none' })
      },
    })
  },

  // 模拟上传进度（后续对接真实接口）
  simulateUpload() {
    this.setData({ status: 'uploading', progress: 0 })
    const timer = setInterval(() => {
      let p = this.data.progress + 20
      if (p >= 100) {
        clearInterval(timer)
        this.setData({ status: 'done', progress: 100 })
        wx.showToast({ title: '上传完成', icon: 'success' })
      } else {
        this.setData({ progress: p })
      }
    }, 500)
  },
})