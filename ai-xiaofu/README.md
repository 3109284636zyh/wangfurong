# 🤖 AI小福 - 建站接单客服助手

微信小程序 + 网页管理后台 + 后端API 全套源码

---

## 📋 项目概述

AI小福是一个**建站接单客服辅助工具**，专为在闲鱼/淘宝/拼多多接建站单的开发者设计。

**核心功能**：复制客户咨询 → 一键生成合规回复 → 复制发送给客户

AI自动结合你后台录入的产品报价库、AI人设、电商平台风控规则，生成专业合规的客服回复。

---

## 🏗️ 项目结构

```
ai-xiaofu/
├── backend/              # Node.js 后端API服务
│   ├── server.js          # 服务入口
│   ├── db.js              # MySQL数据库连接
│   ├── routes/
│   │   ├── auth.js        # 登录认证（仅密码）
│   │   ├── ai-settings.js # AI个性配置
│   │   ├── products.js    # 产品库CRUD + Excel导入导出
│   │   ├── apis.js        # 大模型API管理 + 连通测试
│   │   ├── chat.js        # 核心：一键生成回复 + 风控过滤
│   │   ├── logs.js        # 对话日志
│   │   └── banned-words.js# 违禁词库管理
│   └── middleware/
│       └── auth.js        # JWT认证（30分钟超时）
├── admin/                 # Vue3 + Element Plus 管理后台
│   ├── index.html         # 单页面应用
│   ├── css/
│   └── js/
│       └── app.js         # 后台全部逻辑
├── miniprogram/           # 微信小程序源码
│   ├── app.js
│   ├── app.json
│   ├── app.wxss
│   ├── project.config.json
│   └── pages/index/
│       ├── index.wxml     # 一键应答主界面
│       ├── index.wxss
│       ├── index.js
│       └── index.json
└── database.sql           # MySQL数据库建表SQL
```

---

## 🚀 一键部署教程

### 前置要求

- **Node.js** 18+ ([下载](https://nodejs.org/))
- **MySQL** 5.7+ 或 8.0+ ([下载](https://dev.mysql.com/downloads/))
- **微信开发者工具** ([下载](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html))
- 一台服务器（绑定域名 `wfr.ccvo.top`）

---

### 第一步：创建数据库

```bash
# 登录MySQL
mysql -u root -p

# 执行建库SQL
source /你的项目路径/database.sql;
```

### 第二步：配置后端

```bash
cd backend

# 安装依赖
npm install

# 编辑 .env 文件，修改以下配置：
```

编辑 `backend/.env`：

```env
PORT=3000
DOMAIN=wfr.ccvo.top
JWT_SECRET=xiaofu_jwt_secret_2024_secure

# MySQL数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你的MySQL密码
DB_NAME=ai_xiaofu

# DeepSeek API（你在DeepSeek平台申请的key）
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DEEPSEEK_API_URL=https://api.deepseek.com/v1/chat/completions
DEEPSEEK_MODEL=deepseek-chat
```

### 第三步：启动后端

```bash
cd backend
npm start
```

看到以下输出表示成功：
```
✓ MySQL数据库连接成功
========================================
  🤖 AI小福建站接单客服助手
  服务地址: http://localhost:3000
  管理后台: http://localhost:3000/admin
  绑定域名: wfr.ccvo.top
========================================
```

### 第四步：配置Nginx反向代理

```nginx
server {
    listen 80;
    server_name wfr.ccvo.top;

    # 管理后台
    location /admin {
        proxy_pass http://127.0.0.1:3000/admin;
    }

    # API接口
    location /api {
        proxy_pass http://127.0.0.1:3000/api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
# 重载Nginx
nginx -s reload
```

### 第五步：配置HTTPS（微信小程序要求）

```bash
# 使用Let's Encrypt免费SSL证书
certbot --nginx -d wfr.ccvo.top
```

### 第六步：登录管理后台

1. 打开浏览器访问：`https://wfr.ccvo.top/admin`
2. 输入密码：`zyh123456`
3. 登录后配置：
   - 🎭 **AI个性设置**：设置小福的性格、回复习惯
   - 📦 **产品库管理**：录入你的建站服务产品和报价
   - 🔌 **API管理**：填入DeepSeek API Key并测试连通性
   - 🛡️ **违禁词库**：查看/编辑风控违禁词

### 第七步：导入微信开发者工具

1. 打开**微信开发者工具**
2. 选择"导入项目"
3. 目录选择 `miniprogram/` 文件夹
4. 填入你的小程序 AppID
5. 在 `app.js` 中确认 `apiBase` 设置为 `https://wfr.ccvo.top`
6. 编译运行

---

## 🔌 API配置教程

### 获取DeepSeek API Key

1. 访问 [DeepSeek开放平台](https://platform.deepseek.com/)
2. 注册/登录账号
3. 进入"API Keys"页面
4. 点击"创建API Key"
5. 复制生成的 Key（格式：`sk-xxxxxxxxxxxxxxxx`）
6. 在管理后台 → API管理 → 添加/编辑API中粘贴

### 添加备用API（可选）

支持所有兼容OpenAI格式的API：

| 服务商 | API地址 |
|--------|---------|
| DeepSeek | `https://api.deepseek.com/v1/chat/completions` |
| OpenAI | `https://api.openai.com/v1/chat/completions` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` |
| 讯飞星火 | 兼容OpenAI格式的地址 |
| 其他 | 任何兼容 `/v1/chat/completions` 格式的API |

---

## 📦 产品库Excel批量导入

1. 在管理后台 → 产品库 → 点击"导出Excel"获取模板
2. 按模板格式填写产品信息
3. 点击"批量导入Excel"上传
4. 导入后AI会自动调用产品数据进行回复

---

## 🛡️ 风控机制说明

以下逻辑已内置，无需手动干预：

1. **系统提示词强制拼接**：每次调用API自动注入电商平台合规规则
2. **违禁词二次过滤**：AI回复后检测违禁词，触发则自动重新生成
3. **API超时切换**：主API超时5秒自动切换备用API
4. **兜底回复**：无效输入/API全故障时使用预设话术

---

## 🔑 关键信息

| 项目 | 值 |
|------|-----|
| 主域名 | `wfr.ccvo.top` |
| 后台地址 | `https://wfr.ccvo.top/admin` |
| 登录密码 | `zyh123456`（固定，不可修改） |
| 登录超时 | 30分钟无操作自动退出 |
| 主API | DeepSeek |

---

## ⚠️ 注意事项

- 禁止在小程序中添加用户注册/登录/付费功能
- 禁止修改后台登录密码
- 所有接口必须绑定 `wfr.ccvo.top` 域名
- AI回复严格遵循电商平台规则，不包含任何站外引流话术

---

## 📄 技术栈

| 端 | 技术 |
|----|------|
| 小程序 | 原生微信小程序 |
| 后台 | Vue3 + Element Plus |
| 后端 | Node.js + Express |
| 数据库 | MySQL |
| AI | DeepSeek API（支持扩展） |
