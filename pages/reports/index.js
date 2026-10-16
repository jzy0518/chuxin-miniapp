// pages/reports/index.js —— 我的报告（按动作类型归档）
const { listReports, BASE_URL } = require('../../utils/api')

Page({
  data: {
    groups: [],
    loading: true,
  },

  onShow() {
    this.load()
  },

  load() {
    listReports()
      .then((groups) => {
        const data = (groups || []).map((g) => ({
          actionTypeId: g.actionTypeId,
          actionName: g.actionName,
          category: g.category,
          count: g.count,
          reports: (g.reports || []).map((r) => ({
            id: r.id,
            score: r.score,
            issueCount: r.issueCount,
            thumbUrl: this.fullUrl(r.thumbUrl),
            dateText: this.fmtDate(r.date),
          })),
        }))
        this.setData({ groups: data, loading: false })
      })
      .catch((e) => {
        this.setData({ loading: false })
        wx.showToast({ title: e.message, icon: 'none' })
      })
  },

  goBack() {
    wx.navigateBack()
  },

  onOpen(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: '/pages/report/detail?report_id=' + id })
  },

  // 相对路径补全为完整地址
  fullUrl(url) {
    if (!url) return ''
    return /^https?:/.test(url) ? url : BASE_URL + url
  },

  // 'YYYY-MM-DD' → 'M月D日'
  fmtDate(s) {
    if (!s) return ''
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
    if (!m) return s
    return m[2] + '月' + m[3] + '日'
  },
})