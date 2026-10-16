// pages/videos/index.js —— 我的视频：动作检测 + 实战 统一归档
const { listVideos, videoStats, BASE_URL } = require('../../utils/api')

const TABS = [
  { key: 'all', label: '全部', source: null },
  { key: 'detect', label: '动作检测', source: 1 },
  { key: 'battle', label: '实战', source: 2 },
]

// 分析状态徽章：null未分析 / 0排队中 / 1完成 / 2失败
function badgeOf(analysis) {
  if (!analysis) return { text: '未分析', cls: 'none' }
  if (analysis.status === 0) return { text: '排队中', cls: 'queue' }
  if (analysis.status === 1) return { text: '得分 ' + (analysis.score != null ? analysis.score : '--'), cls: 'done' }
  return { text: '分析失败', cls: 'fail' }
}

// 来源标签：1=动作检测 2=实战
function srcOf(source) {
  return source === 1 ? { text: '动作检测', cls: 'detect' } : { text: '实战', cls: 'battle' }
}

// 时间文本：2026-10-13 15:10:27 → 10-13 15:10
function fmtTime(t) {
  return String(t || '').replace(/^\d{4}-/, '').slice(0, 11).trim()
}

// 时长文本：秒 → 1分05秒 / 42秒
function fmtDuration(sec) {
  const s = Number(sec) || 0
  if (s <= 0) return ''
  const m = Math.floor(s / 60)
  const r = s % 60
  return m > 0 ? m + '分' + r + '秒' : r + '秒'
}

// 缩略图相对路径补全为完整地址
function fullUrl(u) {
  if (!u) return ''
  return /^https?:/.test(u) ? u : BASE_URL + u
}

Page({
  data: {
    tabs: TABS,
    active: 'all',
    videos: [],
    loading: false,
    counts: { total: 0, detect: 0, battle: 0 },
  },

  onShow() {
    this.load()
  },

  onTabTap(e) {
    const key = e.currentTarget.dataset.key
    if (key === this.data.active) return
    this.setData({ active: key })
    this.load()
  },

  load() {
    const tab = TABS.find((t) => t.key === this.data.active)
    this.setData({ loading: true })
    listVideos(tab.source)
      .then((list) => {
        const videos = (list || []).map((v) => {
          const b = badgeOf(v.analysis)
          const s = srcOf(v.source)
          return {
            id: v.id,
            title: v.title,
            actionName: v.actionName,
            thumbUrl: fullUrl(v.thumbUrl),
            timeText: fmtTime(v.createdAt),
            durationText: fmtDuration(v.durationSec),
            badgeText: b.text,
            badgeCls: b.cls,
            srcText: s.text,
            srcCls: s.cls,
          }
        })
        this.setData({ videos, loading: false })
      })
      .catch(() => this.setData({ loading: false }))
    videoStats()
      .then((s) => this.setData({ counts: { total: s.total, detect: s.detect, battle: s.battle } }))
      .catch(() => {})
  },

  goBack() {
    wx.navigateBack()
  },
})