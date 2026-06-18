# AI小福 部署指南

## 快速开始

### 1. 环境要求

- **Node.js** 18+ ([下载](https://nodejs.org/))
- **MySQL** 5.7+ 或 8.0+ ([下载](https://dev.mysql.com/downloads/))
- **微信开发者工具** ([下载](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html))
- 服务器（需绑定域名 `wfr.ccvo.top` 并配置HTTPS）

---

### 2. 数据库初始化

```bash
# 登录MySQL
mysql -u root -p

# 执行建表SQL（会自动创建数据库wfr）
source /你的项目路径/database.sql;

# 验证数据库
USE wfr;
SHOW TABLES;
```

---

### 3. 后端配置与启动

```bash
cd backend

# 安装依赖
npm install

# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，填写真实配置
nano .env  # 或使用其他编辑器
```

**必须配置的环境变量：**
```env
# MySQL数据库
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=你的MySQL密码
DB_NAME=wfr

# DeepSeek API（在 https://platform.deepseek.com/ 获取）
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# JWT密钥（建议生成随机字符串）
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

**启动后端：**
```bash
npm start

# 开发模式（支持热重载）
npm run dev
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

---

### 4. 配置Nginx反向代理

```nginx
server {
    listen 80;
    server_name wfr.ccvo.top;

    # 重定向到HTTPS（微信小程序要求）
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name wfr.ccvo.top;

    # SSL证书配置（Let's Encrypt）
    ssl_certificate /etc/letsencrypt/live/wfr.ccvo.top/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wfr.ccvo.top/privkey.pem;

    # 管理后台
    location /admin {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API接口
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 超时配置
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
}
```

```bash
# 测试Nginx配置
nginx -t

# 重载Nginx
nginx -s reload
```

---

### 5. 配置HTTPS证书

```bash
# 安装certbot
apt install certbot python3-certbot-nginx  # Ubuntu/Debian
# 或
yum install certbot python3-certbot-nginx  # CentOS

# 自动配置HTTPS
certbot --nginx -d wfr.ccvo.top

# 测试自动续期
certbot renew --dry-run
```

---

### 6. 登录管理后台

1. 打开浏览器访问：`https://wfr.ccvo.top/admin`
2. 输入密码：`zyh123456`
3. 首次登录后需要配置：

#### 必须配置的项目：

**a. AI个性设置**
- 设置小福的性格、回复语气
- 配置字数限制、对话习惯
- 填写开场白和兜底回复

**b. 产品库管理**
- 录入建站服务产品和报价
- 或使用Excel批量导入

**c. API管理**
- 添加DeepSeek API配置
- 测试连通性
- （可选）添加备用API

**d. 违禁词库**
- 查看预置的违禁词
- 根据实际情况添加/删除

---

### 7. 配置微信小程序

1. 打开**微信开发者工具**
2. 选择"导入项目"
3. 目录选择 `miniprogram/` 文件夹
4. 填入你的小程序 AppID

**配置API地址：**

编辑 `miniprogram/app.js`，确认API地址：
```javascript
globalData: {
  apiBase: 'https://wfr.ccvo.top',  // 生产环境
  // apiBase: 'http://localhost:3000',  // 开发环境
}
```

**配置服务器域名白名单：**

在微信小程序后台 → 开发 → 开发管理 → 服务器域名：
- request合法域名：`https://wfr.ccvo.top`
- uploadFile合法域名：`https://wfr.ccvo.top`
- downloadFile合法域名：`https://wfr.ccvo.top`

5. 点击"编译"运行

---

## 常见问题排查

### 问题1：后端启动失败
```
❌ 缺少必需的环境变量: JWT_SECRET, DB_PASSWORD
```
**解决：** 检查 `backend/.env` 文件是否存在并正确配置

### 问题2：数据库连接失败
```
✗ MySQL连接失败: Access denied for user
```
**解决：** 
- 检查MySQL是否已启动
- 验证 `.env` 中的数据库用户名密码
- 确认数据库 `wfr` 已创建

### 问题3：小程序无法调用API
```
request:fail url not in domain list
```
**解决：** 在微信小程序后台配置服务器域名白名单

### 问题4：管理后台登录失败
```
密码不正确
```
**解决：** 
- 默认密码为 `zyh123456`
- 如需重置，删除数据库 `admin` 表记录，重启后端会自动重建

### 问题5：AI生成失败
```
AI服务未配置
```
**解决：** 
1. 登录管理后台
2. 进入"API管理"
3. 添加DeepSeek API配置并测试连通性

---

## 生产环境检查清单

部署到生产环境前，请确认：

- [ ] `.env` 文件已正确配置且不在版本控制中
- [ ] JWT_SECRET 使用了强随机字符串
- [ ] MySQL密码足够强壮
- [ ] HTTPS证书已配置并自动续期
- [ ] Nginx已配置并正常运行
- [ ] 数据库已备份
- [ ] 管理后台可正常登录
- [ ] 小程序可正常调用API
- [ ] AI对话功能正常
- [ ] 违禁词检测正常工作
- [ ] 服务器防火墙已配置（开放80、443、3306端口）
- [ ] 定时备份脚本已配置

---

## 维护与监控

### 日志查看
```bash
# 后端日志
cd backend && npm start 2>&1 | tee logs/app.log

# Nginx访问日志
tail -f /var/log/nginx/access.log

# Nginx错误日志
tail -f /var/log/nginx/error.log
```

### 数据库备份
```bash
# 手动备份
mysqldump -u root -p wfr > backup_$(date +%Y%m%d).sql

# 定时备份（添加到crontab）
0 2 * * * mysqldump -u root -p你的密码 wfr > /backup/wfr_$(date +\%Y\%m\%d).sql
```

### 健康检查
```bash
# 检查后端服务
curl https://wfr.ccvo.top/api/health

# 预期响应
{
  "code": 200,
  "data": {
    "status": "ok",
    "database": "connected",
    "uptime": 12345.67
  }
}
```

---

## 技术支持

如遇到问题，请检查：
1. README.md - 项目说明
2. CLAUDE.md - 架构文档
3. 后端日志 - 错误详情
4. 数据库日志 - SQL错误

重要提示：
- **禁止**在小程序中添加用户注册/登录/付费功能
- **禁止**修改后台登录密码（固定为 zyh123456）
- 所有接口必须绑定 `wfr.ccvo.top` 域名
