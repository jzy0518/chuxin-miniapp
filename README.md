# chuxin 羽毛球动作纠正小程序

羽毛球动作纠正小程序：上传挥拍视频 → AI 分析动作问题 → 输出**纠正报告档案**，帮用户快速定位自身动作问题。

**产品定位：只诊断，不教学。** 本应用仅提供动作问题诊断报告，不提供纠正教学内容；用户依据报告自行完成纠正。

## 功能与页面

底部三个 tab（自定义 tabBar）：

| Tab | 页面 | 说明 |
|---|---|---|
| 动作检测 | `pages/train/index` | 动作分类列表（正手高远球 / 反手高远 / 杀球 / 吊球 / 挑球 / 放网），点击进入上传检测页 |
| 实战 | `pages/battle/index` | 从相册上传挥拍视频 → 自动进入 AI 分析队列，查看历史视频与最新分析状态 |
| 我的 | `pages/mine/index` | 微信登录、头像昵称、**纠正报告档案**（最新报告卡 + 问题部位人体图谱 + 改善追踪 + 历史报告） |

非 tab 页面：

- `pages/action/index` — 上传检测页：选视频上传 + 拍摄说明；上传成功后**页内原地展示视频回看 + 报告**（不跳转，规避开发者工具路由渲染问题），分析在后台静默提交、可手动/自动刷新
- `pages/report/detail` — 报告详情页（历史报告直出：得分 + 纠正点 + 视频回看，路由 `?report_id=xxx&t=xx`）

### 「我的」页 · 纠正报告档案

以动作为核心的纠正报告档案，聚焦「快速定位动作问题」：

- **最新报告卡**：动作名、检测日期、一句话问题总结
- **问题部位人体图谱**：剪影 + 热点标注，支持按部位（肘/腕、右肩、膝/步法）筛选
- **问题列表**：按严重程度排序（高危 / 注意 / 轻微），每条带证据时间点
- **改善追踪卡**：对比上次报告，展示已解决 / 待解决 / 新增问题数
- **历史报告列表**：点击进入报告详情

> 报告详情页当前为骨架，核心交互是「点击问题时间点跳转回看对应视频片段」，待后端报告接口（标准报告 JSON 契约）定型后实现。

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
├── pages/                    小程序页面
│   ├── train/               动作检测（动作列表）
│   ├── action/              上传检测页
│   ├── battle/              实战（上传 + 历史列表）
│   ├── mine/                我的（纠正报告档案）
│   └── report/detail        报告详情页
├── custom-tab-bar/           自定义底部 tabBar
├── utils/api.js              前端接口封装（BASE_URL 在这里改）
├── app.js / app.json        小程序入口与页面配置
├── project.config.json      小程序项目配置（appid 在这里改）
└── backend/
    ├── src/                 Express 应用、路由、鉴权中间件
    ├── db/schema.sql        建库建表脚本（幂等，可重复执行）
    ├── ai_worker/           Python 推理 worker（接模型只改这里）
    ├── test-api.js          接口回归测试（13 项）
    ├── .env.example         配置模板（复制为 .env 后修改）
    └── package.json
```

> `pages/correct/`、`pages/index/`、`pages/logs/`、`components/navigation-bar/` 为历史遗留文件，已在 2026-10-16 清理移除。

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

只改一个文件、一个函数：`backend/ai_worker/worker.py` → `analyze_video(video_path, task)`。

```python
def analyze_video(video_path: str, task: dict) -> dict:
    # TODO: 在这里加载你的权重、推理
    return {
        "score": 86,                    # 必须：0-100 的总分
        "corrects": [                   # 可选：识别出的纠正点
            {"pointName": "架拍过高", "correct": False, "confidence": 0.92, "frameTime": 5.2},
        ],
        "model": "your-model-v1",       # 模型标识，方便追踪
        "raw": {},                      # 可选：原始输出，原样存库
    }
```

- worker 自动轮询排队任务、定位视频文件（同机读取 `backend/uploads/`）、回调后端落库
- 推理抛异常时任务自动标记失败，不会卡死队列
- 依赖装进 `ai_worker/requirements.txt`（如 torch / onnxruntime）
- 回调密钥：`.env` 的 `ANALYSIS_WORKER_KEY` 必须与 worker 使用的一致（两端要同步）

## .env 配置说明

| 键 | 说明 | 默认 |
|---|---|---|
| PORT | 后端端口 | 3000 |
| DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME | MySQL 连接 | 127.0.0.1:3306 chuxin/chuxin123 |
| JWT_SECRET | JWT 签名密钥，部署时务必改随机串 | — |
| WX_APPID / WX_SECRET | 微信登录。**WX_SECRET 留空 = mock 登录**（无需任何微信配置即可跑通全流程）；填上即真实登录 | — |
| ANALYSIS_WORKER_KEY | worker 回调密钥，两端一致 | — |
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

## 更新记录

> 后续每次改动在上方追加一条，格式：`日期 · 类型 · 简述`。类型约定为 `feat`（新功能）/ `fix`（修复）/ `ui`（界面）/ `refactor`（重构）/ `docs`（文档）。

- 2026-10-16 · fix · 修复「上传视频后小程序重启回首页」：上传视频写入项目内的 `backend/uploads` 会触发开发者工具热重载/重新编译导致小程序重启，已将上传目录移到项目外 `E:/chuxin_uploads`（后端 `.env` 与 `start-worker.bat` 均设 `UPLOAD_DIR`），现有视频已迁移
- 2026-10-16 · refactor · 动作检测上传后改为**页内原地展示视频+报告**（`pages/action/index` 内完成，不再跳转新页面），彻底规避开发者工具在 custom tabBar 下的 redirectTo/navigateTo 渲染层 bug；分析后台静默提交，报告 pending 时自动重查（最多 3 次）+ 手动刷新；移除 `report/video` 页
- 2026-10-16 · fix · 修复报告页「重新分析」失效、登录失败后请求卡死、自定义 tabBar 防重判断失效、上传接口缺 401 处理、轮询超时误报失败等 BUG；清理未注册的遗留页面与 navigation-bar 组件
- 2026-10-15 · feat · 「我的」页重构为「纠正报告档案」（只诊断不教学）：最新报告卡 + 问题部位人体图谱 + 改善追踪 + 历史报告；新增报告详情页骨架并注册路由（`pages/report/detail`）
- 2026-10-14 · ui · 动作列表图标替换为球场轨迹图；上传页改版（底部固定上传按钮 + 顶部可折叠拍摄说明）
- 2026-10-14 · refactor · 动作列表收敛为 6 项动作、下线纠正点管理页入口，点击动作直达上传检测页
- 更早 · 见 git 提交历史（后端接口全链路、AI 分析 worker、登录鉴权、一键启动脚本、数据库备份脚本等）