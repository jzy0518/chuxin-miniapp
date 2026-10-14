// pages/action/index.js
const { uploadVideo, submitAnalysis } = require('../../utils/api')

Page({
  data: {
    actionName: '',
    status: 'idle',
    progress: 0,
    tipsExpanded: true, // 拍摄说明默认展开
    // ↓ 拍摄说明内容在这里修改，每行一条
    tips: [
      '示例说明第 1 条：请正对手机镜头，完整拍摄一次挥拍动作。',
      '示例说明第 2 条：光线充足、背景简单，识别效果更好。',
      '示例说明第 3 条：视频时长建议 3~15 秒。',
    ],
  },

  onLoad(options) {
    this.setData({
      actionName: options.action || '动作',
      actionId: options.actionId ? Number(options.actionId) : null,
    })
  },

  goBack() {
    wx.navigateBack()
  },

  // 展开/收起拍摄说明
  toggleTips() {
    this.setData({ tipsExpanded: !this.data.tipsExpanded })
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
      .then((res) => {
        this.setData({ status: 'done', progress: 100 })
        // 上传成功后自动发起 AI 分析（带动作 id，worker 按动作模型处理）
        if (res && res.id) {
          submitAnalysis(res.id, this.data.actionId).catch(() => { /* 分析排队失败不阻塞上传结果 */ })
          wx.showToast({ title: '上传完成，已加入分析队列', icon: 'success' })
        } else {
          wx.showToast({ title: '上传完成', icon: 'success' })
        }
      })
      .catch((e) => {
        this.setData({ status: 'idle', progress: 0 })
        wx.showToast({ title: e.message, icon: 'none' })
      })
  },
})