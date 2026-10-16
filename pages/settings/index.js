// pages/settings/index.js —— 设置与关于（单页）
const { clearAllData, logout } = require('../../utils/api')
const VERSION = 'v0.1.0'

// 各条款说明（v1 用弹窗承载，后续可换成独立富文本页）
const DIALOGS = {
  privacy: {
    title: '隐私政策',
    content: '「羽毛球动作纠正」仅收集完成功能所必需的信息：\n1. 微信登录标识（openid）、昵称与头像；\n2. 你主动上传的挥拍视频；\n3. 由视频生成的诊断报告。\n\n以上信息仅用于生成、展示和回看你的动作诊断结果，不会向任何第三方出售或共享。',
  },
  agreement: {
    title: '用户协议',
    content: '使用本应用即表示你同意：\n1. 本应用仅提供动作问题诊断报告，不提供纠正教学内容；\n2. 报告结论由算法生成，仅供参考，不构成医疗或专业运动建议；\n3. 运动前请充分热身，纠正过程中注意安全，因个人原因造成的运动损伤由用户自行承担。',
  },
  disclaimer: {
    title: '免责声明',
    content: '本应用输出的诊断报告仅供动作参考，不保证结果完全准确。用户应结合自身实际情况进行纠正，并在运动前做好热身与防护，注意运动安全。',
  },
  feedback: {
    title: '问题反馈',
    content: '「羽毛球动作纠正」处于早期版本，如遇问题或有改进建议，欢迎反馈，我们会尽快处理与优化。',
  },
}

Page({
  data: {
    version: VERSION,
  },

  goBack() {
    wx.navigateBack()
  },

  // 清空我的数据：二次确认后，删除后端该账号下所有视频与诊断报告
  clearData() {
    wx.showModal({
      title: '清空我的数据',
      content: '将删除你上传的所有视频和诊断报告，删除后不可恢复。确定继续吗？',
      confirmText: '清空',
      confirmColor: '#e5484d',
      cancelText: '取消',
      success: (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '清空中', mask: true })
        clearAllData()
          .then(() => {
            wx.hideLoading()
            wx.showToast({ title: '已清空', icon: 'success' })
          })
          .catch((e) => {
            wx.hideLoading()
            wx.showToast({ title: e.message, icon: 'none' })
          })
      },
    })
  },

  // 隐私政策 / 用户协议 / 免责声明 / 问题反馈 弹窗
  showDialog(e) {
    const d = DIALOGS[e.currentTarget.dataset.key]
    if (!d) return
    wx.showModal({ title: d.title, content: d.content, showCancel: false, confirmText: '知道了' })
  },

  // 退出登录：二次确认后清登录态并返回「我的」页
  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      confirmText: '退出',
      confirmColor: '#e5484d',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) this.doLogout('已退出登录')
      },
    })
  },

  // 清登录态并返回「我的」页
  doLogout(tip) {
    logout()
    wx.showToast({ title: tip, icon: 'none' })
    setTimeout(() => {
      const pages = getCurrentPages()
      if (pages.length > 1) wx.navigateBack()
      else wx.switchTab({ url: '/pages/mine/index' })
    }, 300)
  },
})