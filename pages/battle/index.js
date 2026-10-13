// pages/battle/index.js
const { uploadVideo, submitAnalysis, listVideos } = require('../../utils/api')

// 分析状态徽章：null未分析 / 0排队中 / 1完成 / 2失败
function badgeOf(analysis) {
  if (!analysis) return { text: '未分析', cls: 'none' }
  if (analysis.status === 0) return { text: '排队中', cls: 'queue' }
  if (analysis.status === 1) return { text: '得分 ' + (analysis.score != null ? analysis.score : '--'), cls: 'done' }
  return { text: '分析失败', cls: 'fail' }
}

// 时间文本：2026-10-13 15:10:27 → 10-13 15:10
function fmtTime(t) {
  return String(t || '').replace(/^\d{4}-/, '').slice(0, 11).trim()
}

// 时长文本：秒 → 例 1分05秒 / 42秒
function fmtDuration(sec) {
  const s = Number(sec) || 0
  if (s <= 0) return ''
  const m = Math.floor(s / 60)
  const r = s % 60
  return m > 0 ? m + '分' + r + '秒' : r + '秒'
}

Page({
  data: {
    // 上传状态: idle(空闲) / uploading(上传中) / done(完成)
    status: 'idle',
    progress: 0,
    videoName: '',
    // 历史视频列表
    videos: [],
    listLoading: false,
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    this.loadVideos()
  },

  // 拉取我的视频列表（含最新分析状态）
  loadVideos() {
    listVideos()
      .then((list) => {
        const videos = (list || []).map((v) => {
          const b = badgeOf(v.analysis)
          return {
            id: v.id,
            title: v.title,
            timeText: fmtTime(v.createdAt),
            durationText: fmtDuration(v.durationSec),
            badgeText: b.text,
            badgeCls: b.cls,
          }
        })
        this.setData({ videos, listLoading: false })
      })
      .catch(() => this.setData({ listLoading: false })) // 后端未启动时静默失败，上传区仍可用
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
      .then((res) => {
        this.setData({ status: 'done', progress: 100 })
        // 上传成功后自动发起 AI 分析（异步任务，worker 处理）
        if (res && res.id) {
          submitAnalysis(res.id).catch(() => { /* 分析排队失败不阻塞上传结果 */ })
          wx.showToast({ title: '上传完成，已加入分析队列', icon: 'success' })
        } else {
          wx.showToast({ title: '上传完成', icon: 'success' })
        }
        this.loadVideos() // 刷新历史列表
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