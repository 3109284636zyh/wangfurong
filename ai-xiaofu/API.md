# AI小福 后端 API 文档

## 基础信息

- **Base URL**: `https://wfr.ccvo.top/api`
- **认证方式**: JWT Bearer Token（管理后台接口）
- **响应格式**: JSON

### 标准响应格式

**成功响应：**
```json
{
  "code": 200,
  "data": { ... },
  "message": "操作成功"
}
```

**错误响应：**
```json
{
  "code": 400/401/403/404/500,
  "message": "错误描述"
}
```

---

## 公开接口（无需认证）

### 1. 健康检查

**接口**: `GET /api/health`

**响应示例：**
```json
{
  "code": 200,
  "data": {
    "status": "ok",
    "timestamp": "2024-06-18T12:00:00.000Z",
    "uptime": 12345.67,
    "environment": "production",
    "database": "connected"
  }
}
```

---

### 2. 生成AI回复（核心接口）

**接口**: `POST /api/chat/generate`

**请求参数：**
```json
{
  "question": "建一个企业官网多少钱？",
  "session_id": "wx_1234567890_abcdef",
  "mode": "work"  // work=客服模式, chat=AI小福模式
}
```

**响应示例：**
```json
{
  "code": 200,
  "data": {
    "reply": "您好！企业官网的报价根据需求不同...",
    "api": "DeepSeek主接口",
    "response_time_ms": 1234,
    "is_violation": false
  }
}
```

**错误代码：**
- `400`: 输入参数错误
- `500`: AI服务调用失败

---

### 3. 获取公开信息

**接口**: `GET /api/chat/public-info`

**响应示例：**
```json
{
  "code": 200,
  "data": {
    "opening": "您好！我是您的专属建站顾问小福😊"
  }
}
```

---

### 4. 获取公开产品列表

**接口**: `GET /api/products/public`

**响应示例：**
```json
{
  "code": 200,
  "data": [
    {
      "id": 1,
      "name": "企业官网标准版",
      "category_name": "企业官网搭建",
      "standard_price": 2999.00,
      "discount_price": 1999.00,
      "description": "包含5-8个页面...",
      "included_services": "域名注册、服务器配置...",
      "delivery_days": "7-10个工作日"
    }
  ]
}
```

---

## 认证接口

### 5. 管理员登录

**接口**: `POST /api/auth/login`

**请求参数：**
```json
{
  "password": "zyh123456"
}
```

**响应示例：**
```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**注意：** Token有效期30分钟

---

### 6. 验证Token

**接口**: `GET /api/auth/verify`

**Headers**: `Authorization: Bearer {token}`

**响应示例：**
```json
{
  "code": 200,
  "message": "token有效"
}
```

---

## 管理后台接口（需要认证）

所有以下接口都需要在Header中携带：
```
Authorization: Bearer {token}
```

### AI设置

#### 7. 获取AI设置

**接口**: `GET /api/ai-settings`

**响应示例：**
```json
{
  "code": 200,
  "data": {
    "id": 1,
    "personality": "你是一个专业耐心的建站客服...",
    "reply_max_length": 500,
    "reply_tone": "专业温和",
    "memory_enabled": 1,
    "memory_retention_days": 30
  }
}
```

---

#### 8. 更新AI设置

**接口**: `PUT /api/ai-settings`

**请求参数：**
```json
{
  "personality": "更新后的性格描述",
  "reply_max_length": 800,
  "reply_tone": "热情亲切",
  "memory_enabled": 1
}
```

---

#### 9. 清空全部记忆

**接口**: `POST /api/ai-settings/clear-memories`

**响应示例：**
```json
{
  "code": 200,
  "message": "已清空123条记忆"
}
```

---

### 产品管理

#### 10. 获取产品列表

**接口**: `GET /api/products`

**查询参数：**
- `page`: 页码（默认1）
- `limit`: 每页数量（默认50）
- `category_id`: 分类ID（可选）
- `keyword`: 关键词搜索（可选）

**响应示例：**
```json
{
  "code": 200,
  "data": {
    "list": [...],
    "total": 10,
    "page": 1
  }
}
```

---

#### 11. 添加产品

**接口**: `POST /api/products`

**请求参数：**
```json
{
  "name": "企业官网豪华版",
  "category_id": 1,
  "standard_price": 5999.00,
  "discount_price": 3999.00,
  "description": "详细介绍...",
  "included_services": "包含的服务...",
  "delivery_days": "10-15个工作日"
}
```

---

#### 12. 更新产品

**接口**: `PUT /api/products/{id}`

---

#### 13. 删除产品

**接口**: `DELETE /api/products/{id}`

---

#### 14. 上架/下架产品

**接口**: `PUT /api/products/{id}/toggle`

---

#### 15. 导出Excel

**接口**: `GET /api/products/export`

**响应**: Excel文件下载

---

#### 16. 导入Excel

**接口**: `POST /api/products/import`

**Content-Type**: `multipart/form-data`

**参数**: `file` (Excel文件)

---

### API管理

#### 17. 获取API列表

**接口**: `GET /api/apis`

---

#### 18. 添加API配置

**接口**: `POST /api/apis`

**请求参数：**
```json
{
  "name": "DeepSeek备用",
  "api_type": "deepseek",
  "api_key": "sk-xxxxxxxxxxxx",
  "api_url": "https://api.deepseek.com/v1/chat/completions",
  "model": "deepseek-chat",
  "temperature": 0.7,
  "max_tokens": 2000,
  "timeout_seconds": 30
}
```

---

#### 19. 测试API连通性

**接口**: `POST /api/apis/{id}/test`

**响应示例：**
```json
{
  "code": 200,
  "message": "连接成功",
  "data": {
    "response": "测试成功",
    "response_time_ms": 856,
    "model": "deepseek-chat"
  }
}
```

---

#### 20. 设为主API

**接口**: `PUT /api/apis/{id}/primary`

---

### 对话日志

#### 21. 获取日志列表

**接口**: `GET /api/logs`

**查询参数：**
- `page`: 页码
- `limit`: 每页数量
- `keyword`: 搜索关键词
- `date_from`: 开始日期（YYYY-MM-DD）
- `date_to`: 结束日期（YYYY-MM-DD）

---

#### 22. 获取统计数据

**接口**: `GET /api/logs/stats`

**响应示例：**
```json
{
  "code": 200,
  "data": {
    "today": 156,
    "total": 5432,
    "violations": 23,
    "avg_response_ms": 1245
  }
}
```

---

### 违禁词管理

#### 23. 获取违禁词列表

**接口**: `GET /api/banned-words`

---

#### 24. 添加违禁词

**接口**: `POST /api/banned-words`

**请求参数：**
```json
{
  "word": "微信",
  "category": "联系方式",
  "is_regex": 0,
  "is_active": 1
}
```

---

#### 25. 检测文本违禁词

**接口**: `POST /api/banned-words/check`

**请求参数：**
```json
{
  "text": "加我微信号：xxxxx"
}
```

**响应示例：**
```json
{
  "code": 200,
  "data": {
    "has_violation": true,
    "violations": ["微信", "微信号"]
  }
}
```

---

## 错误码说明

| 错误码 | 说明 |
|-------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未认证或Token过期 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |
| 503 | 服务不可用 |

---

## 限流规则

| 接口类型 | 限制 |
|---------|------|
| `/api/chat/generate` | 10次/分钟/IP |
| 管理后台接口 | 100次/分钟/Token |
| 公开接口 | 30次/分钟/IP |
