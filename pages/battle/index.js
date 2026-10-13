// pages/battle/index.js
const { uploadVideo } = require('../../utils/api')

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
        const videoName = (file && file.name) || '现场视频'
        this._filePath = file.tempFilePath
        this._duration = (file && file.duration) || 0
        this.setData({ videoName })
        this.upload()
      },
      fail: (err) => {
        if (err.errMsg && /cancel/.test(err.errMsg)) return
        wx.showToast({ title: '选择视频失败', icon: 'none' })
      },
    })
  },

  // 真实上传到后端（真实进度）
  upload() {
    this.setData({ status: 'uploading', progress: 0 })
    uploadVideo(
      this._filePath,
      { title: this.data.videoName, duration: String(this._duration || 0) },
      (p) => this.setData({ progress: p })
    )
      .then(() => {
        this.setData({ status: 'done', progress: 100 })
        wx.showToast({ title: '上传完成', icon: 'success' })
      })
      .catch((e) => {
        this.setData({ status: 'idle', progress: 0 })
        wx.showToast({ title: e.message, icon: 'none' })
      })
  },

  reset() {
    this.setData({ status: 'idle', progress: 0, videoName: '' })
  },
})