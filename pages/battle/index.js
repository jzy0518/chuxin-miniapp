// pages/battle/index.js
Page({
  data: {
    // 上传状态: idle(空闲) / uploading(上传中) / done(完成)
    status: 'idle',
    progress: 0,
    videoName: '',
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
  },

  // 从相册选择视频
  chooseVideo() {
    if (this.data.status === 'uploading') return

    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      sourceType: ['album'],
      success: (res) => {
        const file = res.tempFiles[0]
        const videoName =
          (file && file.tempFilePath) || (file && file.name) || '现场视频'
        this.setData({ videoName })
        this.simulateUpload()
      },
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

  reset() {
    this.setData({ status: 'idle', progress: 0, videoName: '' })
  },
})