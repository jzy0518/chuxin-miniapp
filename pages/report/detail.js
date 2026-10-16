// pages/report/detail.js —— 我的报告详情（历史报告直出：得分 + 纠正点 + 视频回看）
const { getReport, BASE_URL } = require('../../utils/api')

Page({
  data: {
    report: null,
    corrects: [],
    loading: true,
  },

  onLoad(options) {
    console.log('[report] onLoad options:', JSON.stringify(options))
    this.initTime = Number(options.t) || 0
    this.reportId = options.report_id || ''
    this.load()
  },

  goBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
    } else {
      wx.switchTab({ url: '/pages/mine/index' })
    }
  },

  load() {
    console.log('[report] 开始加载报告 report_id=' + this.reportId)
    getReport(this.reportId)
      .then((d) => {
        console.log('[report] 报告数据返回:', JSON.stringify(d).slice(0, 200))
        const corrects = (d.corrects || []).map((c, i) => ({
          pointName: c.pointName || '',
          correct: c.correct,
          confidenceText: Math.round((c.confidence || 0) * 100) + '%',
          tText: this.fmtT(c.frameTime || 0),
          t: c.frameTime || 0,
          idx: i + 1,
        }))
        this.setData({
          report: {
            actionName: d.actionName,
            category: d.category,
            score: d.score,
            dateText: this.fmtDate(d.date),
            videoUrl: this.fullUrl(d.videoUrl),
            thumbUrl: this.fullUrl(d.thumbUrl),
            durationSec: d.durationSec,
          },
          corrects,
          loading: false,
        })
        wx.nextTick(() => {
          this.videoCtx = wx.createVideoContext('reportVideo', this)
          if (this.initTime > 0) this.videoCtx.seek(this.initTime)
        })
      })
      .catch((e) => {
        console.error('[report] 加载报告失败:', JSON.stringify(e))
        this.setData({ loading: false })
        wx.showToast({ title: e.message, icon: 'none' })
      })
  },

  // 点击纠正点 → 跳转到视频对应时间点回看
  onTimeTap(e) {
    const t = Number(e.currentTarget.dataset.t) || 0
    if (!this.videoCtx) this.videoCtx = wx.createVideoContext('reportVideo', this)
    this.videoCtx.seek(t)
    this.videoCtx.play()
  },

  fullUrl(url) {
    if (!url) return ''
    return /^https?:/.test(url) ? url : BASE_URL + url
  },

  fmtDate(s) {
    if (!s) return ''
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
    if (!m) return s
    return m[2] + '月' + m[3] + '日'
  },

  fmtT(t) {
    const n = Number(t) || 0
    const m = Math.floor(n / 60)
    const s = Math.floor(n % 60)
    return m + ':' + (s < 10 ? '0' + s : s)
  },
})