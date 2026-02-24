# Supabase 文档上传与文件管理系统（Next.js）

这是一个完整的示例项目，包含：
- 前端：Next.js 页面，支持上传、列表展示、下载、删除。
- 后端：Next.js API Route，负责与 Supabase Storage 和 Postgres 表交互。
- 数据结构：`public.files` 表记录文件元数据。

## 1. 环境要求

- Node.js >= 18
- 一个可用的 Supabase 项目

## 2. 配置 Supabase（必须执行）

1. 登录 [Supabase 控制台](https://supabase.com/dashboard)，创建或选择一个项目。
2. 在 `SQL Editor` 执行 `supabase/migrations/001_init.sql`，创建 `files` 表。
3. 在 `Storage` 中新建一个 bucket（建议名称：`documents`）。
   - 建议设置为 **Private**（私有）。
4. 在 `Project Settings -> API` 中获取：
   - `Project URL`
   - `service_role` key

## 3. 配置环境变量

1. 复制示例环境文件：

```bash
cp .env.example .env.local
```

2. 编辑 `.env.local` 并填写真实值：

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_STORAGE_BUCKET=documents
```

## 4. 安装依赖并启动

```bash
npm install
npm run dev
```

启动后访问：
- [http://localhost:3000](http://localhost:3000)

## 5. 功能说明

### 5.1 上传文件
- 前端选择文件后调用 `POST /api/files`。
- 后端执行：
  1. 校验文件大小（当前限制 10MB）
  2. 上传到 Supabase Storage
  3. 写入 `public.files` 元数据

### 5.2 文件列表
- 前端调用 `GET /api/files`。
- 后端按 `created_at desc` 返回列表。

### 5.3 下载文件
- 前端调用 `GET /api/files/:id/download`。
- 后端根据 `storage_path` 生成 60 秒有效的签名下载链接。

### 5.4 删除文件
- 前端调用 `DELETE /api/files/:id`。
- 后端先删 Storage 文件，再删数据库记录。

## 6. 项目结构

```text
app/
  api/files/route.ts                  # GET(列表) + POST(上传)
  api/files/[id]/route.ts             # DELETE(删除)
  api/files/[id]/download/route.ts    # GET(签名下载链接)
  globals.css                         # 页面样式
  layout.tsx                          # 根布局
  page.tsx                            # 上传和文件管理页面
lib/
  env.ts                              # 环境变量检查
  supabase-admin.ts                   # Supabase 管理端 client
supabase/migrations/
  001_init.sql                        # 初始化 SQL
```

## 7. 常见问题

1. 报错 `Missing required environment variable`
- 检查 `.env.local` 是否存在并且变量名完全一致。

2. 上传时报权限错误
- 确认 bucket 名字与 `SUPABASE_STORAGE_BUCKET` 一致。
- 确认使用的是 `service_role` key，不是 `anon` key。

3. 下载链接打不开
- 签名链接默认 60 秒有效，过期后重新点击下载即可。

## 8. 生产建议（可选）

- 增加用户认证与多租户隔离（例如 `user_id` 字段 + RLS policy）。
- 增加文件类型白名单、病毒扫描、审计日志。
- 将最大上传限制与签名链接有效期做成可配置项。

## 9. 作业提交截图清单（建议按此顺序）

以下截图建议放到仓库中的 `docs/screenshots/` 目录，并在本 README 中按编号引用，便于老师核对。

### 9.1 开发过程截图（Process）

01. Git 提交过程截图（第一次）  
- 展示初始化后的首次提交记录。  
![01-init-commit](/Users/songxiaowen/File-upload/docs/screenshots/01-init-commit.png)

02. Git 提交过程截图（中间迭代）  
- 展示功能开发过程中的提交记录。  
![02-mid-commit](/Users/songxiaowen/File-upload/docs/screenshots/02-mid-commit.png)

03. GitHub 推送记录截图  
- 展示代码已推送到 GitHub 远程仓库。  
![03-github-push](/Users/songxiaowen/File-upload/docs/screenshots/03-github-push.png)

### 9.2 本地测试截图（Local Testing）

04. 本地页面运行截图  
- `npm run dev` 后 `http://localhost:3000` 页面可访问。  
![04-local-home](/Users/songxiaowen/File-upload/docs/screenshots/04-local-home.png)

05. 本地上传成功截图  
- 选择文件并上传成功，页面出现状态提示，列表出现新文件。  
![05-local-upload-success](/Users/songxiaowen/File-upload/docs/screenshots/05-local-upload-success.png)

06. 本地下载功能测试截图  
- 点击下载后浏览器可打开/下载文件。  
![06-local-download-success](/Users/songxiaowen/File-upload/docs/screenshots/06-local-download-success.png)

07. 本地删除功能测试截图  
- 删除后列表中文件消失，页面显示“删除成功”。  
![07-local-delete-success](/Users/songxiaowen/File-upload/docs/screenshots/07-local-delete-success.png)

08. API 测试截图（GET /api/files）  
- 使用 Postman/Thunder Client/curl 调用成功。  
![08-api-get-files](/Users/songxiaowen/File-upload/docs/screenshots/08-api-get-files.png)

09. API 测试截图（POST/DELETE）  
- 展示 `POST /api/files` 或 `DELETE /api/files/:id` 成功响应。  
![09-api-post-delete](/Users/songxiaowen/File-upload/docs/screenshots/09-api-post-delete.png)

### 9.3 Supabase 对象存储截图（关键要求）

10. Supabase SQL 执行成功截图  
- 在 SQL Editor 执行迁移成功，`files` 表已创建。  
![10-supabase-sql](/Users/songxiaowen/File-upload/docs/screenshots/10-supabase-sql.png)

11. Supabase Storage Bucket 截图  
- Storage 页面能看到 bucket（例如 `documents`）。  
![11-supabase-bucket](/Users/songxiaowen/File-upload/docs/screenshots/11-supabase-bucket.png)

12. Supabase Storage 文件截图（必须）  
- bucket 内能看到上传后的文档对象。  
![12-supabase-storage-object](/Users/songxiaowen/File-upload/docs/screenshots/12-supabase-storage-object.png)

13. Supabase 数据表记录截图  
- `Table Editor -> files` 中能看到对应元数据记录。  
![13-supabase-table-files](/Users/songxiaowen/File-upload/docs/screenshots/13-supabase-table-files.png)

### 9.4 Vercel 部署与线上验证截图（Deployment）

14. Vercel 部署成功截图  
- Vercel Dashboard 显示 `Ready` / `Production`。  
![14-vercel-ready](/Users/songxiaowen/File-upload/docs/screenshots/14-vercel-ready.png)

15. 线上功能验证截图（可拼图或多图）  
- 至少包含线上上传、下载、删除成功的证据。  
![15-vercel-e2e](/Users/songxiaowen/File-upload/docs/screenshots/15-vercel-e2e.png)

## 10. README 中建议附加的测试结论模板

可在提交前补充如下简短结论（示例）：

- 本地环境（日期：YYYY-MM-DD）已验证上传、列表、下载、删除均正常。  
- Supabase Storage 与 `public.files` 表数据一致。  
- Vercel 生产环境（日期：YYYY-MM-DD）已验证同样功能均正常。  
- 已按开发过程进行多次提交并推送到 GitHub。
