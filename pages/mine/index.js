// pages/mine/index.js
const { ensureLogin, request, uploadAvatar, videoStats, BASE_URL } = require('../../utils/api')

// ============================================================
// 纠正报告 JSON 契约（与后端约定，后端就绪后替换下方 MOCK 数据）
//
// 单份报告结构：
// {
//   report_id: string   // 报告唯一 ID
//   action: string      // 动作名，如「杀球」
//   detected_at: string // 检测日期展示文案
//   summary: string     // 一句话总结（只描述现象，不写纠正方法）
//   issues: [{ part, phase, severity, text, t }]
//   trend: { resolved, remaining, new, compared_at }  // 由后端对比上次报告算好
// }
//
// severity 枚举：high 高危 / medium 注意 / low 轻微（前端映射 红/橙/黄）
// part 枚举（人体图谱热点按此预置坐标）：
//   head 头部 / neck 颈
//   shoulder_l/r 左右肩 / elbow_l/r 左右肘 / wrist_l/r 左右腕
//   hip_l/r 左右髋 / knee_l/r 左右膝 / ankle_l/r 左右踝
//   footwork_l/r 步法左/右
// t 为证据时间点（秒）；建议后续增加 start/end 片段用于视频回看定位
// ============================================================

// 人体图谱坐标系（与 figure 剪影 viewBox 0 0 90 156 对齐）
const FIG_W = 90
const FIG_H = 156
const PART_POINTS = {
  head: [45, 15], neck: [45, 27],
  shoulder_l: [32, 32], shoulder_r: [58, 32],
  elbow_l: [25, 50], elbow_r: [66, 50],
  wrist_l: [20, 68], wrist_r: [70, 68],
  hip_l: [41, 76], hip_r: [49, 76],
  knee_l: [39, 104], knee_r: [51, 104],
  ankle_l: [39, 134], ankle_r: [51, 134],
  footwork_l: [29, 141], footwork_r: [61, 141],
}

const SEVERITY_MAP = {
  high: { label: '高危', color: '#d9483c' },
  medium: { label: '注意', color: '#f5a623' },
  low: { label: '轻微', color: '#f2c94c' },
}
const SEVERITY_RANK = { high: 0, medium: 1, low: 2 }

// 问题点列表默认预览条数，其余折叠（方案二：报告卡减负）
const MAX_PREVIEW = 2

// 部位筛选分组：人体图谱的按区查看
const PART_GROUPS = [
  { key: '肘/腕', parts: ['elbow_l', 'elbow_r', 'wrist_l', 'wrist_r'] },
  { key: '右肩', parts: ['shoulder_r'] },
  { key: '膝/步法', parts: ['knee_l', 'knee_r', 'footwork_l', 'footwork_r'] },
]

const PART_LABELS = {
  head: '头部', neck: '颈部',
  shoulder_l: '左肩', shoulder_r: '右肩',
  elbow_l: '左肘', elbow_r: '右肘',
  wrist_l: '左腕', wrist_r: '右腕',
  hip_l: '左髋', hip_r: '右髋',
  knee_l: '左膝', knee_r: '右膝',
  ankle_l: '左踝', ankle_r: '右踝',
  footwork_l: '步法·左', footwork_r: '步法·右',
}

// —— MOCK 数据：后端接口就绪后删除，改为接口拉取 ——
const MOCK_LATEST_REPORT = {
  report_id: 'r_20261014_001',
  action: '杀球',
  detected_at: '10月14日',
  summary: '核心问题：击球点偏后、手腕提前发力，重点看右臂与肩部',
  issues: [
    { part: 'elbow_r', phase: '挥拍', severity: 'high', text: '击球点偏后，举拍时机晚', t: 12 },
    { part: 'wrist_r', phase: '挥拍', severity: 'high', text: '手腕提前发力，转体不充分', t: 15 },
    { part: 'shoulder_r', phase: '引拍', severity: 'medium', text: '右肩紧张，引拍幅度过小', t: 8 },
    { part: 'knee_r', phase: '落地', severity: 'low', text: '右膝屈伸不足，落地缓冲偏硬', t: 19 },
    { part: 'footwork_l', phase: '回位', severity: 'low', text: '回位步法拖沓，重心滞后', t: 21 },
    { part: 'footwork_r', phase: '启动', severity: 'low', text: '启动步缺少蹬地发力', t: 5 },
  ],
  trend: { resolved: 2, remaining: 1, new: 1, compared_at: '10月11日' },
}

const MOCK_HISTORY = [
  { report_id: 'r_20261012_001', action: '高远球', detected_at: '10月12日', issueCount: 3, delta: -1, parts: '右肩·右肘' },
  { report_id: 'r_20261009_001', action: '网前搓球', detected_at: '10月09日', issueCount: 2, delta: 0, parts: '右腕' },
  { report_id: 'r_20261006_001', action: '发球', detected_at: '10月06日', issueCount: 4, delta: 1, parts: '左髋·左踝' },
]

const MOCK_STATS = { done: 25, todo: 7, videos: 12 }
// —— MOCK 数据结束 ——

Page({
  data: {
    loggedIn: false,
    user: { nickName: '', avatarUrl: '' },
    // stats mock：后端报告统计接口就绪后替换
    stats: { done: MOCK_STATS.done, todo: MOCK_STATS.todo, videos: MOCK_STATS.videos },
    score: { found: 0, resolved: 0, rate: 0 },

    // 纠正报告档案（骨架：内容槽位暂由 mock 填充）
    latestReport: null,
    issues: [],
    visibleIssues: [],
    issueTotal: 0,
    issuesCollapsed: true,
    legend: [],
    filterGroups: [],
    activeGroup: '全部',
    trend: null,
    history: [],
  },

  onLoad() {
    this.buildReportView()
    this.buildScore()
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    this.loadUser()
    this.refreshVideoCount()
  },

  // 读取本地登录态 + 拉取服务端最新资料与画像
  loadUser() {
    const local = wx.getStorageSync('userInfo')
    if (!local) {
      this.setData({
        loggedIn: false,
        user: { nickName: '', avatarUrl: '' },
      })
      return
    }
    this.setData({ loggedIn: true, user: this.toViewUser(local) })
    // 登录态下若 stats 曾被置 0（如退出登录后），恢复 mock 值
    if (!this.data.stats.done && !this.data.stats.todo) {
      this.setData({
        stats: { done: MOCK_STATS.done, todo: MOCK_STATS.todo, videos: MOCK_STATS.videos },
      })
      this.buildScore()
    }

    request('GET', '/api/user/me')
      .then((data) => {
        this.setData({
          user: this.toViewUser(data.user),
        })
        // TODO: 后端报告统计接口就绪后，用真实数据替换 stats mock 并调用 buildScore
        // 注意：现有 /api/user/me 的 stats 仍是旧训练版字段且当前全为 0，
        // 直接覆盖会把记分牌刷成 0，故暂不使用。
      })
      .catch((e) => {
        // 服务端不可用时仍展示本地缓存
        console.warn('拉取用户信息失败:', e.message)
      })
  },

  // ========== 纠正报告档案视图构建 ==========

  // 组装最新报告：人体图谱热点、严重度图例、问题列表
  buildReportView() {
    const rep = MOCK_LATEST_REPORT // TODO: 换成 GET /api/reports/latest

    const issues = rep.issues
      .map((it, i) => {
        const p = PART_POINTS[it.part] || PART_POINTS.head
        return {
          issueId: 'i' + i,
          part: it.part,
          partLabel: PART_LABELS[it.part] || it.part,
          phase: it.phase,
          text: it.text,
          severity: it.severity,
          t: it.t,
          tText: this.fmtT(it.t),
          sev: SEVERITY_MAP[it.severity] || SEVERITY_MAP.low,
          left: ((p[0] / FIG_W) * 100).toFixed(2) + '%',
          top: ((p[1] / FIG_H) * 100).toFixed(2) + '%',
          dim: false,
        }
      })
      .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])

    const counts = { high: 0, medium: 0, low: 0 }
    issues.forEach((i) => counts[i.severity]++)
    const legend = ['high', 'medium', 'low']
      .map((k) => ({
        key: k,
        label: SEVERITY_MAP[k].label,
        count: counts[k],
        color: SEVERITY_MAP[k].color,
      }))
      .filter((l) => l.count > 0)

    const delta = rep.trend.new - rep.trend.resolved
    const posDelta = delta === 0 ? '持平' : delta > 0 ? '+' + delta : String(delta)

    this.setData({
      issues,
      visibleIssues: issues.slice(0, MAX_PREVIEW),
      issueTotal: issues.length,
      issuesCollapsed: true,
      legend,
      latestReport: {
        report_id: rep.report_id,
        action: rep.action,
        detected_at: rep.detected_at,
        summary: rep.summary,
        posTotal: '共 ' + issues.length + ' 个位置',
        posDelta,
      },
      trend: rep.trend, // 改善追踪数据保留，待报告详情页定型后展示
      history: MOCK_HISTORY.map((h) => this.toHistoryView(h)), // TODO: 换成 GET /api/reports/history
      filterGroups: ['全部'].concat(PART_GROUPS.map((g) => g.key)),
    })
  },

  // 记分牌：发现问题 = done+todo，改善率前端可算
  buildScore() {
    const num = (v) => {
      const n = typeof v === 'number' ? v : parseInt(v, 10)
      return isFinite(n) && n > 0 ? n : 0
    }
    const done = num(this.data.stats.done)
    const todo = num(this.data.stats.todo)
    const found = done + todo
    const rate = found > 0 ? Math.round((done / found) * 100) : 0
    this.setData({ score: { found, resolved: done, rate } })
  },

  // 部位筛选：切换筛选时同时调整问题列表与图谱热点（列表默认折叠预览）
  onFilterTap(e) {
    const key = e.currentTarget.dataset.key
    const group = PART_GROUPS.find((g) => g.key === key)
    const issues = this.data.issues || []
    const filtered = group
      ? issues.filter((i) => group.parts.indexOf(i.part) >= 0)
      : issues
    this.setData({
      activeGroup: key,
      issueTotal: filtered.length,
      issuesCollapsed: true,
      visibleIssues: filtered.slice(0, MAX_PREVIEW),
      issues: issues.map((i) =>
        Object.assign({}, i, { dim: !!group && group.parts.indexOf(i.part) < 0 })
      ),
    })
  },

  // 展开/收起全部问题点
  onToggleIssues() {
    const group = PART_GROUPS.find((g) => g.key === this.data.activeGroup)
    const filtered = group
      ? (this.data.issues || []).filter((i) => group.parts.indexOf(i.part) >= 0)
      : (this.data.issues || [])
    const collapsed = this.data.issuesCollapsed
    this.setData({
      issuesCollapsed: !collapsed,
      visibleIssues: collapsed ? filtered : filtered.slice(0, MAX_PREVIEW),
    })
  },

  // 历史报告项 → 视图字段（趋势箭头 + 方向语义）
  toHistoryView(h) {
    const d = h.delta || 0
    const deltaText = d > 0 ? '↑' + d : d < 0 ? '↓' + (-d) : '—'
    const deltaClass = d > 0 ? 'bad' : d < 0 ? 'good' : 'flat'
    return Object.assign({}, h, { deltaText, deltaClass })
  },

  // 打开报告详情（占位页，内容待报告契约/后端数据定型后设计）
  onOpenReport(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: '/pages/report/detail?report_id=' + id })
  },

  // 点击证据时间点 → 报告详情（未来用于跳转视频回看定位）
  onTimeTap(e) {
    const id = e.currentTarget.dataset.id
    const t = e.currentTarget.dataset.t
    wx.navigateTo({ url: '/pages/report/detail?report_id=' + id + '&t=' + t })
  },

  // 未登录空态 → 去动作检测页上传视频
  goDetect() {
    wx.switchTab({ url: '/pages/train/index' })
  },

  // 功能列表入口：我的视频 / 设置 跳二级页，其余待开发
  onMenuTap(e) {
    const key = e.currentTarget.dataset.key
    if (key === 'videos') {
      return wx.navigateTo({ url: '/pages/videos/index' })
    }
    if (key === 'share') {
      return wx.navigateTo({ url: '/pages/reports/index' })
    }
    if (key === 'settings') {
      return wx.navigateTo({ url: '/pages/settings/index' })
    }
    wx.showToast({ title: '待开发', icon: 'none' })
  },

  // 真实视频计数（「我的视频」入口右侧数字）
  // 退出登录后 userInfo 已被清除，若继续请求会触发 ensureLogin 静默重新登录，故加守卫
  refreshVideoCount() {
    if (!wx.getStorageSync('userInfo')) return
    videoStats().then((s) => this.setData({ 'stats.videos': s.total })).catch(() => { /* 后端不可用时保持现状 */ })
  },

  // 秒 → 分:秒 展示
  fmtT(t) {
    const m = Math.floor(t / 60)
    const s = t % 60
    return m + ':' + (s < 10 ? '0' + s : s)
  },

  // 后端字段(snake_case) → 页面字段(camelCase)
  toViewUser(u) {
    return {
      nickName: u.nick_name || u.nickName || '',
      avatarUrl: this.fullUrl(u.avatar_url || u.avatarUrl || ''),
      skillLevel: u.skill_level != null ? u.skill_level : 0,
    }
  },

  // 相对路径(如 /files/avatars/x.jpg)补全为完整地址——小程序 image 不认相对路径
  fullUrl(url) {
    if (!url) return ''
    return /^https?:/.test(url) ? url : BASE_URL + url
  },

  // 登录（微信静默登录，无需用户授权资料）
  login() {
    wx.showLoading({ title: '登录中' })
    ensureLogin()
      .then(() => {
        wx.hideLoading()
        wx.showToast({ title: '登录成功', icon: 'success' })
        this.loadUser()
      })
      .catch((e) => {
        wx.hideLoading()
        wx.showToast({ title: e.message, icon: 'none' })
      })
  },

  // 选择新头像（微信官方组件）：上传到后端并更新资料
  onChooseAvatar(e) {
    const tempPath = e.detail.avatarUrl
    if (!tempPath) return
    wx.showLoading({ title: '上传头像' })
    uploadAvatar(tempPath)
      .then((d) => {
        wx.hideLoading()
        this.setData({ 'user.avatarUrl': this.fullUrl(d.avatarUrl) })
        this.syncLocalUser()
        wx.showToast({ title: '头像已更新', icon: 'success' })
      })
      .catch((err) => {
        wx.hideLoading()
        wx.showToast({ title: err.message, icon: 'none' })
      })
  },

  // 昵称输入实时更新页面显示
  onNickInput(e) {
    this.setData({ 'user.nickName': e.detail.value })
  },

  // 昵称失焦保存
  onNickSave(e) {
    const nickName = (e.detail.value || '').trim()
    request('PUT', '/api/user/me', { nickName })
      .then(() => {
        this.setData({ 'user.nickName': nickName })
        this.syncLocalUser()
        wx.showToast({ title: '昵称已保存', icon: 'success' })
      })
      .catch((err) => wx.showToast({ title: err.message, icon: 'none' }))
  },

  // 把最新昵称/头像同步进本地缓存
  syncLocalUser() {
    const local = wx.getStorageSync('userInfo') || {}
    local.nick_name = this.data.user.nickName
    local.avatar_url = this.data.user.avatarUrl
    wx.setStorageSync('userInfo', local)
  },
})