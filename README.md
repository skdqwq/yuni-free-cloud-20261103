# 屿YUNI 日程管理应用

## 配色范围修正与原官网恢复（2026年11月13日）

应用仅晨间页使用浅暖色；日程、聊天、档案、睡前小岛、纸条和偏好设置均使用深色，包括挂载到页面根部的弹窗。官网恢复原部署包中的深蓝夜景和原始配色，只补充各展示屏底部及页脚的应用超链接，保留 NiNi 动画和图片压缩。应用与官网各自加载独立样式，避免主题相互覆盖。

## 晨间暖色、夜间深色与腾讯云转发（2026年11月12日）

`app-themes.css` 恢复晨间暖色、其他功能深色，背景使用已压缩的房间照片。日程优先的功能层次保持不变。NiNi 桌宠恢复显示，可拖动、键盘移动和打开互动。官网 NiNi 在可见区域自动准备并播放打招呼，提供暂停与重播；后台或离开视口暂停，减少动态效果或省流模式下需主动播放。待机只移动、旋转整个模型，不缩放身体和翅膀。

腾讯云部署脚本为 `tools/deploy-tencent.py --commit <完整提交号>`。脚本复用服务器已有数据库和 AI 环境配置，创建独立候选容器，验证资产与健康后切换 Caddy，保留旧容器及配置备份。请先完成腾讯云发布及外部验证，再启用 Render 转发模式。

Render 转发模式使用以下环境变量（启用前确保上游已部署完成）：

```text
YUNI_RUNTIME_MODE=edge-proxy
YUNI_PROXY_APP_ORIGIN=https://yuni.pars-study.cn
YUNI_PROXY_SITE_ORIGIN=https://yuni.pars-study.cn
YUNI_PROXY_SITE_PATH=/showcase
```

Render 原网址根路径进入应用，`/showcase/` 进入官网。HTTPS 上游固定，不接受客户端指定目标；会话 Cookie、Origin、流式响应和 WebSocket 均转发。内部状态与本机模型管理接口仍不开放。现有 Render 服务 `srv-dbkinmd9fdbs73bef6f0` 在识别到 Render 平台时自动使用上述腾讯云路由，部署本提交前必须先完成上游发布和公网核验。识别方式采用 Render 官方提供的 `RENDER` 与 `RENDER_SERVICE_ID` 环境变量，见[官方文档](https://render.com/docs/environment-variables)。其他服务、仓库副本和本地运行默认启动完整应用。腾讯云容器明确设置 `YUNI_RUNTIME_MODE=application`；Render 也可设置此值恢复完整应用模式。转发入口仍受 Render 实例额度与休眠规则影响。

验收：`node tools/check-runtime-config.cjs`；`node tools/check-render-edge.cjs`；`node tools/check-voice-mode.cjs`；`node tools/check-schedule-home.cjs`（最后一项只针对本地隔离预览）。

## 官网预览版 2026年11月12日

`web/showcase/index.html` 为优化后的独立官网：日程优先的产品介绍、台灯与 NiNi 首屏、真实规则试排演示、可选陪伴介绍和按需加载的 NiNi 3D 动画。预览地址为 https://yuni-free-cloud-20261103.onrender.com/showcase/index.html 。官网不会读取用户数据或调用 AI，正式应用入口保留在根路径。腾讯云通过独立容器运行官网；Render 的 `/showcase/` 入口通过上述固定 HTTPS 路由访问。


## 云端声音设置修复 2026年11月12日

线上版本仅显示设备系统声音与语速，不再请求本机模型管理接口；已有本地音色偏好在云端自动回退至系统声音。本地桌面入口保留模型功能，公网代理继续关闭模型管理接口。验收命令：`node tools/check-voice-mode.cjs`。

## Render 日程优先版 2026年11月12日

当前发布代码包含直接填写任务、按空闲时段试排并确认保存、按状态管理计划的日程首页，睡前空间和聊天作为附加入口。保留原账号、数据库及模型环境配置。`web/release.json` 记录本次前端版本和关键资源哈希，便于核对线上是否已更新。

`.github/workflows/yuni-today-wake.yml` 通过云端定时健康请求，在北京时间 2026年11月15日24时前尽量保持实例可访问，届时停止请求并尝试禁用任务。定时调度可能延迟，因此不保证绝不休眠；持续运行仍消耗 Render 免费实例时数。无需打开本地电脑。


## 日程优先首页（2026-11-11，已部署腾讯云）

新版采用三级功能层次：第一层直接填写任务、时长和截止时间，并在同页预览按空闲时段拆分的日程；第二层管理待办、已完成和已撤销的计划，可重新试排、完成或撤销；第三层折叠显示小岛、纸条、聊天和晨间陪伴。NiNi 以小尺寸静态形象配合台灯出现。

`web/schedule-home.js` 和 `web/schedule-home.css` 是首页源代码。日程复用 `planner-core.js` 规则引擎、现有账户和 `/api/planner` 持久化接口，不需要通过聊天才能创建任务。预览在用户确认后才写入；确认时重新检查版本与可用时段，数据发生变化会要求重新确认。页面在手机上按填写、预览、计划、可选陪伴的顺序排列。

本地验收使用独立 H2 数据库 `data/schedule-preview`，不会连接线上用户数据。2026-11-11 已将该版本部署到腾讯云，沿用原 Neon 数据库与服务器上的 AI 配置。应用为 https://app.yunii.cn/ ，官网展示页为 https://yunii.cn/ 。旧入口 https://yuni.pars-study.cn/ 和 `/showcase/` 继续保留。Render 发布后以同一日程首页作为主入口。

本地预览：双击 `启动YUNI本地预览.cmd`，保持窗口开启，然后访问 `http://127.0.0.1:18080/`。界面和日程规则不依赖付费 AI 请求。验收命令为 `node tools/check-schedule-home.cjs`，只创建本地测试账号验证规则、保存、版本冲突和账号隔离。

## 睡前空间（2026-11）

登录后从“今晚的睡前空间”进入：用户可选择临时 AI 对话、封存卡和陪伴偏好。封存卡和偏好按账号保存在应用数据库中，可单独删除；删除账号数据也会清除它们。新空间中的对话只保留在当前页面内，关闭或刷新后不再保留；用户提交的内容和最近几轮对话会发送给已配置的模型服务。原有聊天和事务功能及其数据保持独立。

语音输入依赖浏览器的语音识别和麦克风授权，不能保证所有手机浏览器支持。15 分钟是非强制的休息提示，不会中断用户对话。新空间内提供危机表达的固定提示，不能替代诊断、治疗或危机服务。

服务需要数据库账户有建表权限，启动时会创建 `yuni_night_cards` 和 `yuni_night_preferences`。部署前应备份数据库并在测试环境验证；更新代码后重新构建镜像，保留环境变量和现有数据库。

已从交接包中的 Java 参考代码重建后端，并通过 Maven package。

已完成：
- 保留现有网页与 NiNi 功能文件。
- 修复反编译 Java 的类型错误。
- 新增 PostgreSQL 云端配置，事务/陪伴数据改由数据库保存，不依赖临时文件。
- 事务写入带版本冲突检查；增加运行记录的账号归属检查；登录后更新会话。
- 提供 Dockerfile、启动管理器和 Render 免费计划配置。
- 支持通过 YUNI_LLM_KEY 环境变量接入 DeepSeek。

验证：
- H2 隔离测试库中完成网页、注册登录、预设聊天回复、事务读写、冲突处理、账号隔离和 Java 重启后数据恢复。
- 内部存储接口与本机语音管理接口不通过公网代理开放。
- Maven 编译与打包、腾讯云 Docker 构建及真实 PostgreSQL 日程保存、版本冲突、登录持久化和账号隔离检查通过；390px 手机布局及 HTTPS 已检查。此次没有另外进行公网 WebSocket 验证。
- 没有运行收费模型调用测试。包内不包含模型密钥、数据库密码、测试账号或用户数据。

构建：安装 Java 21 和 Maven，在工程目录运行 mvn package。产物位于 target/yuni-backend-0.2.0.jar。
云端：使用仓库根目录 Dockerfile 构建，Render 必须选择 Free。
环境变量：
YUNI_DB_URL=jdbc:postgresql://数据库主机/neondb?sslmode=require
YUNI_DB_USER=数据库用户名
YUNI_DB_PASSWORD=数据库密码
SPRING_PROFILES_ACTIVE=cloud
YUNI_GATEWAY_URL=（空）
YUNI_LLM_MODEL=deepseek-chat
YUNI_LLM_KEY=（在 Render 保密配置里填写，不提交仓库）

当前云端进度：
- 仓库：https://github.com/skdqwq/yuni-free-cloud-20261103
- Neon：YUNI，项目 misty-shadow-66819600，界面显示 Free plan。
- 腾讯云：上海轻量服务器 `123.207.204.4`，应用 https://app.yunii.cn/ ，官网 https://yunii.cn/ ，Caddy 提供 HTTPS 并自动续期证书。部署记录见 `../yuni-tencent-update-20261111/上线记录.md`。新域名 ICP 备案状态尚未核实。
- Render：https://yuni-free-cloud-20261103.onrender.com/ ，本次同步日程优先版。

免费托管会休眠且受额度限制；DeepSeek API 使用会消耗用户的模型余额。
云端版本只支持设备系统语音，本地语音模型和声音克隆不包含在云端运行方案中。
