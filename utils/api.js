// utils/api.js
// 后端接口统一封装：自动登录、自动带 token、上传进度回调
// 注意：开发阶段需在微信开发者工具勾选「不校验合法域名」
const BASE_URL = 'http://127.0.0.1:3000'

let loginPromise = null // 登录去重：避免并发时重复调 wx.login

// 静默登录：wx.login 拿 code 换 token（已登录则直接返回）
function ensureLogin() {
  const token = wx.getStorageSync('token')
  if (token) return Promise.resolve({ token })
  if (loginPromise) return loginPromise

  loginPromise = new Promise((resolve, reject) => {
    wx.login({
      success: (res) => {
        wx.request({
          url: BASE_URL + '/api/login',
          method: 'POST',
          data: { code: res.code },
          success: (r) => {
            if (r.data && r.data.code === 0) {
              const { token, user } = r.data.data
              wx.setStorageSync('token', token)
              wx.setStorageSync('userInfo', user)
              resolve({ token, user })
            } else {
              reject(new Error((r.data && r.data.msg) || '登录失败'))
            }
          },
          fail: () => reject(new Error('无法连接服务器，请确认后端已启动')),
          complete: () => { loginPromise = null },
        })
      },
      fail: () => reject(new Error('微信登录失败')),
    })
  })
  return loginPromise
}

// 通用请求：返回 Promise<data>（仅业务数据部分）
function request(method, url, data, needAuth = true) {
  return ensureLogin().then(({ token }) => {
    return new Promise((resolve, reject) => {
      wx.request({
        url: BASE_URL + url,
        method,
        data,
        header: needAuth ? { Authorization: 'Bearer ' + token } : {},
        success: (r) => {
          if (r.statusCode === 401) {
            // token 失效：清除，下次调用自动重新登录
            wx.removeStorageSync('token')
            reject(new Error('登录已过期，请重试'))
            return
          }
          if (r.data && r.data.code === 0) resolve(r.data.data)
          else reject(new Error((r.data && r.data.msg) || '请求失败(' + r.statusCode + ')'))
        },
        fail: () => reject(new Error('网络错误，无法连接服务器')),
      })
    })
  })
}

// 上传视频：filePath 为本地临时路径，onProgress 回调真实进度(0-100)
function uploadVideo(filePath, formData, onProgress) {
  return ensureLogin().then(({ token }) => {
    return new Promise((resolve, reject) => {
      const task = wx.uploadFile({
        url: BASE_URL + '/api/videos',
        filePath,
        name: 'video',
        formData,
        header: { Authorization: 'Bearer ' + token },
        success: (r) => {
          let data = null
          try { data = JSON.parse(r.data) } catch (e) { /* 忽略解析错误 */ }
          if (data && data.code === 0) resolve(data.data)
          else reject(new Error((data && data.msg) || '上传失败'))
        },
        fail: () => reject(new Error('上传失败，请检查网络')),
      })
      // wx.uploadFile 不返回进度，需通过 UploadTask 监听
      if (onProgress && task.onProgressUpdate) {
        task.onProgressUpdate((res) => onProgress(res.progress))
      }
    })
  })
}

// 提交视频分析任务（AI 异步分析）：返回 { id }，之后用 getAnalysis 轮询状态
function submitAnalysis(videoId, actionTypeId) {
  return request('POST', '/api/analysis', { videoId, actionTypeId: actionTypeId || null })
}

// 查询分析任务状态：0 排队中 / 1 完成 / 2 失败（完成时带 score 和 resultJson）
function getAnalysis(id) {
  return request('GET', '/api/analysis/' + id)
}

// 退出登录：清本地登录态
function logout() {
  wx.removeStorageSync('token')
  wx.removeStorageSync('userInfo')
}

module.exports = { BASE_URL, ensureLogin, request, uploadVideo, submitAnalysis, getAnalysis, logout }