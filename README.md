# chuxin 羽毛球动作纠正小程序

羽毛球技术纠正小程序：上传挥拍视频 → AI 分析动作错误 → 记录与跟踪纠正进度。

三个 tab：

- **动作纠正**：按动作（高远球/杀球/吊球/网前/步法等）管理纠正点，记录已纠正/待纠正进度
- **实战**：从相册上传挥拍视频，自动进入 AI 分析队列，查看历史视频与分析状态
- **我的**：微信登录、头像昵称、纠正统计与技术画像

## 技术栈

| 部分 | 技术 |
|---|---|
| 小程序前端 | 原生微信小程序（自定义 tabBar） |
| 后端 | Node.js（Express）+ mysql2，JWT 鉴权 |
| 数据库 | MySQL 8.x |
| AI 推理 | Python worker（异步任务 + 回调，模型可插拔） |
| 登录 | 微信 `wx.login` + `jscode2session`（未配 secret 时自动走 mock 模式） |

## 架构

```
小程序(微信开发者工具)
   │  HTTP / 上传 (127.0.0.1:3000)
   ▼
Node 后端(Express) ── MySQL(chuxin 库)
   │
   │ ①上传成功后自动创建分析任务(video_analysis.status=0)
   ▼
Python worker（轮询任务 → 调你的模型推理 → 回调后端落库）
```

模型接入点只有一处：`backend/ai_worker/worker.py` 的 `analyze_video()` 函数。

## 目录结构

```
chuxin-Frontend/
├── pages/              小程序页面（train/correct/battle/mine ...）
├── utils/api.js        前端接口封装（BASE_URL 在这里改）
├── app.js / app.json   小程序入口与配置
├── project.config.json 小程序项目配置（appid 在这里改）
└── backend/
    ├── src/            Express 应用与路由
    ├── db/schema.sql   建库建表脚本（幂等，可重复执行）
    ├── ai_worker/      Python 推理 worker（接模型只改这里）
    ├── test-api.js     接口回归测试（13 项）
    ├── .env.example    配置模板（复制为 .env 后修改）
    └── package.json
```

## 环境要求

- **Node.js** >= 18（开发时使用 24 LTS）
- **MySQL** >= 8.0（开发时使用 8.4 LTS）
- **Python** >= 3.10（只用 AI 分析时需要）
- **微信开发者工具**（稳定版即可）

## 快速开始（从零到跑通）

### 第一步：克隆代码

```bash
git clone <仓库地址>
cd chuxin-Frontend
```

### 第二步：初始化数据库

安装并启动 MySQL 8 后执行（脚本自带建库、建表、种子数据、创建 `chuxin` 应用账号）：

```bash
mysql -u root -p < backend/db/schema.sql
```

> 脚本是幂等的，重复执行不会报错、不会重复插入数据。
> 脚本会创建应用账号 `chuxin / chuxin123`（仅授权 chuxin 库），后端默认用它连接。

### 第三步：启动后端

```bash
cd backend
cp .env.example .env        # Windows: copy .env.example .env
# 编辑 .env：把 DB_PASSWORD 改成你数据库实际密码（若按脚本默认则不用改）
npm install
npm start
```

看到 `[server] chuxin backend listening on http://127.0.0.1:3000` 即成功。健康检查：<http://127.0.0.1:3000/api/health>

可选：跑一遍接口回归测试

```bash
npm test   # 13 项用例，全部 PASS 即后端就绪
```

### 第四步：启动 AI worker（需要分析功能时）

```bash
cd backend/ai_worker
pip install -r requirements.txt
python worker.py
```

> 打开 `worker.py`，`analyze_video()` 目前是模拟实现。接自己的模型见下文。
> 不启动 worker 也能正常使用小程序，只是分析任务会一直显示「排队中」（超过 30 分钟自动标记失败）。

### 第五步：导入小程序（微信开发者工具）

1. 微信开发者工具 → 导入项目 → 选择**项目根目录**（`chuxin-Frontend`）
2. `project.config.json` 里把 `appid` 换成**你自己的小程序 appid**（没有的话选「测试号」）
3. 开发阶段必须：右上角「详情 → 本地设置 → 勾选 ☑ 不校验合法域名」
4. 编译运行。后端没启动时页面会显示静态兜底数据，启动后端后自动切换为真实数据

### 真机预览（可选）

`utils/api.js` 里的 `BASE_URL` 默认 `http://127.0.0.1:3000` 只适合模拟器。真机预览时改成你电脑的局域网 IP（如 `http://192.168.1.100:3000`），手机与电脑连同一 Wi-Fi。

## 接入自己的模型（核心）

只改一个文件、一个函数：`backend/ai_worker/worker.py` → `analyze_video(video_path)`。

```python
def analyze_video(video_path: str) -> dict:
    # TODO: 在这里加载你的权重、推理
    return {
        "score": 86,                    # 必须：0-100 的总分
        "corrects": [                   # 可选：识别出的纠正点
            {"pointName": "架拍过高", "correct": False, "confidence": 0.92},
        ],
        "model": "your-model-v1",       # 模型标识，方便追踪
        "raw": {},                      # 可选：原始输出，原样存库
    }
```

- worker 自动轮询排队任务、定位视频文件（同机读取 `backend/uploads/`）、回调后端落库
- 推理抛异常时任务自动标记失败，不会卡死队列
- 依赖装进 `ai_worker/requirements.txt`（如 torch / onnxruntime）
- 回调密钥：`.env` 的 `ANALYSIS_WORKER_KEY` 必须与 worker 使用的一致（默认两端都是 `chuxin-worker-dev-key`，改了要同步）

## .env 配置说明

| 键 | 说明 | 默认 |
|---|---|---|
| PORT | 后端端口 | 3000 |
| DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME | MySQL 连接 | 127.0.0.1:3306 chuxin/chuxin123 |
| JWT_SECRET | JWT 签名密钥，部署时务必改随机串 | — |
| WX_APPID / WX_SECRET | 微信登录。**WX_SECRET 留空 = mock 登录**（无需任何微信配置即可跑通全流程）；填上即真实登录 | — |
| ANALYSIS_WORKER_KEY | worker 回调密钥，两端一致 | chuxin-worker-dev-key |
| UPLOAD_MAX_MB | 视频上传大小上限(MB)，可选 | 200 |

## 常见问题

| 现象 | 原因与解决 |
|---|---|
| `npm: command not found` | 未安装 Node 或旧终端没有 PATH，重开终端 |
| 后端启动失败 `Access denied` | `.env` 的 DB_PASSWORD 与 MySQL 实际密码不一致 |
| 视频/头像存在接口成功但界面不显示 | 数据没问题，确认模拟器已「不校验合法域名」、后端已启动 |
| 上传后分析一直「排队中」 | worker 没启动：`cd backend/ai_worker && python worker.py` |
| 手机预览请求失败 | BASE_URL 要改为电脑局域网 IP，且手机电脑同 Wi-Fi |

## 数据库备份

数据不在 git 仓库。备份方式（建议周期性执行）：

```bash
mysqldump -u chuxin -pchuxin123 chuxin > chuxin_backup_$(date +%F).sql
```

项目内另附 `backend/scripts/backup-db.ps1`（Windows 一键备份，自动保留最近 30 份，双击 `backup-db.bat` 生效）。