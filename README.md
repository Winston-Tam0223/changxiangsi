

## 在线访问
- Vercel: https://changxiangsi.vercel.app
- Render(备用): https://changxiangsi.onrender.com# 长相思匹配时间发布系统 · 完整建站包（v4.0）

前端（5页）+ 后端（Node.js/Express）+ Supabase 云数据库与账号体系，全部免费，可部署到 Render 上线。

## 功能清单
- 登录（账号密码由管理员后台创建，**用户不能自助注册**）
- 登录成功欢迎弹窗 3 秒进入首页
- 首页倒计时（按访问者本地时区显示）
- 任务管理：新增 / 编辑 / 删除倒计时任务（仅管理员）
- 用户账号管理：新增 / **禁用 / 启用 / 删除 / 重置密码**（仅管理员）
- 禁用账号登录时提示「该账号已被管理员禁止登录」
- 登录日志：记录账号、输入密码、IP、国家/地区、登录结果（仅管理员），可导出 CSV
- 浅绿色 UI，手机 / PC 自适应

## 目录结构
```
changxiangsi-full/
├── server.js          # 后端主程序
├── package.json       # 依赖
├── setup.sql          # Supabase 建表脚本
├── .env.example       # 环境变量模板（复制为 .env）
├── README.md
└── public/
    ├── login.html         # 登录页
    ├── index.html         # 倒计时首页
    ├── admin.html         # 任务管理（仅管理员）
    ├── user-manage.html   # 用户管理（仅管理员）
    └── login-log.html     # 登录日志（仅管理员）
```

## 一、申请 Supabase（免费）
1. 打开 https://supabase.com → GitHub 登录 → New project
2. 填项目名、设数据库密码，Region 选 Southeast Asia (Singapore)
3. 创建后：
   - **关闭自助注册**：左侧 Authentication → Settings → Email Auth → 取消勾选 "Allow new users to sign up"
   - **建表**：左侧 SQL Editor → New query → 粘贴 setup.sql 全部内容 → Run
   - **记录密钥**：左侧 Project Settings → API，复制 Project URL、anon public key、service_role secret 三个值

## 二、本地运行
```bash
cd changxiangsi-full
cp .env.example .env    # 填入你的三个密钥
npm install
node server.js
```
浏览器打开 http://localhost:3000

## 三、创建管理员账号
Supabase 后台 → Authentication → Users → Add user
- 邮箱：1757349561@qq.com（或你自己定）
- 密码：Tt1757349561
- 然后在 Users 列表找到该用户 → 编辑 → User Metadata 填入：
  ```json
  { "isAdmin": true, "status": "active" }
  ```

## 四、部署到 Render（免费上线）
1. 推送代码到 GitHub（公开仓库）
   ```bash
   git init && git add . && git commit -m "system"
   git branch -M main
   git remote add origin https://github.com/你的用户名/仓库名.git
   git push -u origin main
   ```
2. 打开 https://render.com → GitHub 登录 → New → Web Service → 选仓库
3. 配置：
   - Build Command：`npm install`
   - Start Command：`node server.js`
   - Plan：Free
4. Advanced → Environment Variables 添加：
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - ADMIN_EMAIL（可选，默认 1757349561@qq.com）
5. Create Web Service → 部署完成 → 访问 https://你的应用.onrender.com

## 五、上线后自测
1. 管理员登录 → 欢迎弹窗 → 首页
2. 用户账号管理：新建普通账号、禁用账号、重置密码、删除账号
3. 用禁用账号登录 → 提示「该账号已被管理员禁止登录」
4. 任务管理：增删改倒计时任务，首页实时更新
5. 登录日志：查看成功/失败记录（含IP地区），导出 CSV

## 六、注意事项
- service_role 密钥只能放在后端环境变量，**绝不能写进前端代码**
- 免费版限制：Render 闲置 15 分钟休眠（首次打开慢几秒）；Supabase 一周无活动暂停（数据仍在）
- 登录日志里「输入密码」为明文，仅用于内部审计，请勿对非信任环境公开
