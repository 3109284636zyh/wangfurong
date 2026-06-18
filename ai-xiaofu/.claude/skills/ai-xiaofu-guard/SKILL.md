---
name: ai-xiaofu-guard
description: Use before changing any AI小福 project code, documentation, database, API, mini program page, admin page, backend route, or configuration. Enforces current product direction, incremental edits, user-code protection, and work/chat/human mode boundaries.
---

# AI小福项目改动守护

## 使用场景

修改 AI小福项目任何文件前，先按本 skill 做检查，尤其是：

- 小程序页面、逻辑、样式、配置修改
- 后端接口、middleware、鉴权、限流、错误处理修改
- 管理后台页面或接口对接修改
- 数据库 SQL、字段、索引、迁移修改
- README、API、IMPROVEMENTS、CLAUDE.md 等文档修改
- 涉及客服模式、AI小福聊天模式、真人聊天模式、违禁词、风控、报价库的修改

## 必须先执行

1. 阅读项目规则文件：`CLAUDE.md`。
2. 检查当前工作区，确认已有未提交改动：
   - `git status --short`
   - `git diff --stat`
   - `git diff --name-only`
3. 判断本次修改影响范围：小程序、后端 API、管理后台、数据库、文档、配置、风控/违禁词/AI 模式。
4. 修改前必须确认：
   - 不覆盖用户或其他代理已有未提交改动
   - 不整体重写已有模块
   - 不改变项目核心方向
   - 不破坏客服模式风控
   - 不引入注册、登录、付费、会员、充值等新方向
   - 不写入敏感信息

## 绝对禁止

- 禁止全部推翻重写。
- 禁止无用户明确要求时重构整个小程序、后台或后端。
- 禁止把 AI小福改成普通通用聊天产品。
- 禁止破坏建站接单、产品报价库、平台合规、违禁词过滤。
- 禁止在 `work` / 客服模式跳过违禁词检测。
- 禁止随意更换生产域名 `wfr.ccvo.top`。
- 禁止改变 API 统一响应格式 `{ code, data, message }`。
- 禁止把 `.env`、API Key、JWT_SECRET、数据库密码等敏感信息写入仓库。
- 禁止直接破坏已有数据库结构和数据。

## 当前项目方向

AI小福不是普通聊天 App，而是“建站接单客服助手 + AI小福陪伴聊天”的小程序：

- `work`：客服模式，负责客户咨询、建站报价、产品库匹配、平台合规、违禁词风控。
- `chat`：AI小福聊天模式，负责陪伴聊天和记忆。
- `human`：真人/独立聊天页形态，按 AI小福聊天方向处理。

任何新增能力都必须服务于这个方向；如果需求会改变产品定位，先向用户确认。

## 分区检查

### 小程序

必须保持微信原生小程序结构，不引入无必要构建链。当前页面至少包括：

- `miniprogram/pages/index/index.*`
- `miniprogram/pages/chat/chat.*`

不要再按旧文档误判为单页小程序。

### 后端

必须保持 Express + MySQL 架构，优先复用现有 middleware/routes：

- `backend/middleware/rateLimit.js`
- `backend/middleware/validate.js`
- `backend/middleware/errorHandler.js`
- `backend/routes/*.js`

新增接口必须保持 `{ code, data, message }` 响应风格，并考虑鉴权、输入校验、限流、错误处理。

### 管理后台

必须保持 Vue3 + Element Plus CDN 单页后台方向。主要文件：

- `admin/index.html`
- `admin/js/app.js`

不得无明确要求改成构建型前端项目。

### 数据库

修改数据库前必须说明：

- 为什么需要改表或加字段
- 新部署 SQL 怎么写入 `database.sql`
- 已部署数据库如何通过升级脚本迁移
- 是否会影响已有数据

不得直接删除字段、删除表、清空数据。

### 风控与模式边界

- `work` / 客服模式：必须执行平台合规规则和违禁词检测。
- `chat` / AI小福聊天模式：可跳过客服风控，但不能影响客服模式。
- `human` / 真人或独立聊天形态：按 AI小福聊天方向处理，不应套用客服违禁词过滤。

## 修改完成检查清单

提交结果前自查：

- 是否只是小步增量修改，而不是整体重写？
- 是否保护了用户已有未提交改动？
- 是否保持 AI小福建站接单客服助手的核心方向？
- 是否保持 work/chat/human 模式边界？
- 是否没有新增注册、登录、付费、会员、充值等违背当前方向的功能？
- 是否没有写入敏感信息？
- 是否同步更新必要文档？
- 是否说明了验证方式；如果没有验证，明确说明原因？
