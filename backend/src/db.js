// MySQL 连接池（mysql2/promise）
const mysql = require('mysql2/promise')
const config = require('./config')

const pool = mysql.createPool(config.db)

// 探活查询，启动时验证数据库可用
async function ping() {
  const conn = await pool.getConnection()
  try {
    await conn.ping()
  } finally {
    conn.release()
  }
}

module.exports = { pool, ping }