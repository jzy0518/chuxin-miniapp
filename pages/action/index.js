// pages/action/index.js
const { uploadVideo, uploadVideoThumb, submitAnalysis, getReport, request, BASE_URL } = require('../../utils/api')

Page({
  data: {
    actionName: '',
    actionId: null,
    status: 'idle', // idle(待上传) / uploading(上传中) / done(完成，原地展示视频+报告)
    progress: 0,
    tipsExpanded: true, // 拍摄说明默认展开
    // ↓ 拍摄说明内容在这里修改，每行一条
    tips: [
      '示例说明第 1 条：请正对手机镜头，完整拍摄一次挥拍动作。',
      '示例说明第 2 条：光线充足、背景简单，识别效果更好。',
      '示例说明第 3 条：视频时长建议 3~15 秒。',
    ],
    // 上传完成后的结果态
    videoUrl: '',
    thumbUrl: '',
    report: null,
    corrects: [],
    reportStatus: 'loading', // loading / none / pending / failed / done
  },

  onLoad(options) {
    this.setData({
      actionName: options.action || '动作',
      actionId: this.toId(options.actionId),
    })
  },

  // 安全解析动作类型 ID：数字才转 Number，否则置空（避免字符串 code 被 Number() 转成 NaN）
  toId(v) {
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : null
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
        this._thumbPath = (file && file.thumbTempFilePath) || ''
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
      {
        title: this.data.actionName + '练习视频',
        duration: String(this._duration || 0),
        source: '1',
        actionTypeId: this.data.actionId || '',
      },
      (p) => this.setData({ progress: p })
    )
      .then((res) => {
        console.log('[action] 上传返回:', JSON.stringify(res))
        if (!res || !res.id) {
          console.error('[action] 上传返回缺少 id')
          return
        }
        this.videoId = res.id
        // 缩略图上传（失败不阻塞）
        if (this._thumbPath) uploadVideoThumb(res.id, this._thumbPath).catch(() => { /* 缩略图失败不阻塞 */ })
        // 上传成功：原地展示视频 + 报告（不跳转页面，规避路由渲染问题）
        this.setData({
          status: 'done',
          progress: 100,
          videoUrl: this.fullUrl(res.url),
        })
        wx.showToast({ title: '上传完成', icon: 'success' })
        // 先提交分析，完成后再加载报告——否则 loadReport 可能早于分析记录创建而查不到，误显示「暂无报告」
        submitAnalysis(res.id, this.data.actionId)
          .catch(() => { /* 排队失败不阻塞 */ })
          .then(() => this.loadReport())
      })
      .catch((e) => {
        this.setData({ status: 'idle', progress: 0 })
        wx.showToast({ title: e.message, icon: 'none' })
      })
  },

  // 拉取该视频的最新报告（不提交分析、不长时间轮询等待；pending 时最多自动重查 3 次）
  loadReport() {
    this.setData({ reportStatus: 'loading' })
    return request('GET', '/api/analysis?videoId=' + this.videoId)
      .then((rows) => {
        const latest = (rows || [])[0]
        if (!latest) {
          this.setData({ reportStatus: 'none' })
          return
        }
        if (latest.status === 0) {
          this.setData({ reportStatus: 'pending' })
          this._autoRetry = (this._autoRetry || 0) + 1
          if (this._autoRetry <= 3) {
            setTimeout(() => { if (this.data.status === 'done') this.loadReport() }, 4000)
          }
          return
        }
        if (latest.status === 2) {
          this.setData({ reportStatus: 'failed' })
          return
        }
        // status === 1：加载报告详情
        return getReport(latest.id).then((d) => {
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
              durationSec: d.durationSec,
            },
            // 若接口返回了视频/缩略图地址，用接口的（含缩略图）
            videoUrl: this.fullUrl(d.videoUrl) || this.data.videoUrl,
            thumbUrl: this.fullUrl(d.thumbUrl) || this.data.thumbUrl,
            corrects,
            reportStatus: 'done',
          })
        })
      })
      .catch(() => this.setData({ reportStatus: 'none' }))
  },

  // 手动刷新报告
  refreshReport() {
    this._autoRetry = 0
    this.loadReport()
  },

  // 点击纠正点 → 跳转视频对应时间点回看
  onTimeTap(e) {
    const t = Number(e.currentTarget.dataset.t) || 0
    if (!this.videoCtx) this.videoCtx = wx.createVideoContext('actionVideo', this)
    this.videoCtx.seek(t)
    this.videoCtx.play()
  },

  // 重置为待上传状态（done 态的「重新上传」入口）
  reset() {
    this._autoRetry = 0
    this.videoId = null
    this.setData({
      status: 'idle',
      progress: 0,
      videoUrl: '',
      thumbUrl: '',
      report: null,
      corrects: [],
      reportStatus: 'loading',
    })
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
