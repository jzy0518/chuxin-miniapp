// 统一配置：从 backend/.env 读取，带默认值
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

module.exports = {
  port: Number(process.env.PORT) || 3000,

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'chuxin',
    password: process.env.DB_PASSWORD || 'chuxin123',
    database: process.env.DB_NAME || 'chuxin',
    waitForConnections: true,
    connectionLimit: 10,
  },

  jwtSecret: process.env.JWT_SECRET || 'chuxin-dev-secret',

  wx: {
    appid: process.env.WX_APPID || '',
    secret: process.env.WX_SECRET || '',
    // 未配置 secret 时走 mock 登录，方便本地联调
    mockLogin: !process.env.WX_SECRET,
  },

  uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'),
  uploadMaxMB: Number(process.env.UPLOAD_MAX_MB) || 200,

  // AI 分析 worker 回调密钥（Python 推理服务回调结果时携带）
  workerKey: process.env.ANALYSIS_WORKER_KEY || '',
}