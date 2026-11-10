# YUNI 重建版与免费托管准备

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
- Maven 编译与打包通过。尚未完成真实云 PostgreSQL、Docker 构建、手机和公网 WebSocket 验证。
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
- 私有仓库：https://github.com/skdqwq/yuni-free-cloud-20261103
- Neon：YUNI，项目 misty-shadow-66819600，界面显示 Free plan。
- Render：已连接仓库、选中 $0/月实例并填写环境变量；提交时要求绑卡做临时 $1 预授权，未完成服务创建，没有已上线网址。

免费托管会休眠且受额度限制；DeepSeek API 使用会消耗用户的模型余额。
云端版本只支持设备系统语音，本地语音模型和声音克隆不包含在云端运行方案中。
