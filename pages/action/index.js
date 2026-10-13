// pages/action/index.js
const { uploadVideo } = require('../../utils/api')

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
      success: (res) => {
        const file = res.tempFiles[0]
        this._filePath = file.tempFilePath
        this._duration = (file && file.duration) || 0
        this.upload()
      },
      fail: (err) => {
        if (err.errMsg && /cancel/.test(err.errMsg)) return
        wx.showToast({ title: '选择视频失败', icon: 'none' })
      },
    })
  },

  // 真实上传到后端（真实进度，标题带动作名）
  upload() {
    this.setData({ status: 'uploading', progress: 0 })
    uploadVideo(
      this._filePath,
      { title: this.data.actionName + '练习视频', duration: String(this._duration || 0) },
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
})