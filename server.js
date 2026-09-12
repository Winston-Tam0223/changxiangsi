require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
// 获取真实IP（部署在 Render 等反向代理后必须）
app.set('trust proxy', true);

// ============ Supabase 配置（从环境变量读取） ============
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '1757349561@qq.com';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ 缺少环境变量 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// 客户端连接（用于普通登录校验）
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// 管理端连接（service_role，用于创建/禁用/删除/重置用户、写日志）
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============ 工具函数 ============

// 取客户端真实 IP
function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || '未知IP';
}

function isPrivateIp(ip) {
  if (!ip) return true;
  const c = String(ip).replace(/^::ffff:/, '');
  return c === '::1' || c === '127.0.0.1' || c.startsWith('127.') || c.startsWith('10.') ||
    c.startsWith('192.168.') || c.startsWith('172.');
}

// IP → 国家/地区（Node 18+ 自带 fetch，无需 axios）
async function getIpGeo(ip) {
  if (isPrivateIp(ip)) return '内网地址';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: ctrl.signal, headers: { 'User-Agent': 'changxiangsi' }
    });
    if (!res.ok) return '地区解析失败';
    const g = await res.json();
    const txt = [g.country_name, g.region, g.city].filter(Boolean).join(' ');
    return txt.trim() || '未知地区';
  } catch (e) {
    return '地区解析失败';
  } finally {
    clearTimeout(timer);
  }
}

// 鉴权中间件
async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: '未登录' });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: '登录失效' });
  req.user = user;
  next();
}

// 判断是否管理员
function isAdmin(user) {
  return user.email === ADMIN_EMAIL || user.user_metadata?.isAdmin === true;
}

// 写登录日志
async function writeLog(email, pwd, ip, area, status) {
  try {
    await supabaseAdmin.from('login_logs').insert([{
      email, input_pwd: pwd, ip, area, status
    }]);
  } catch (e) { /* 日志失败不影响登录 */ }
}

// ============ 认证接口 ============

// 登录（成功/失败都记录日志；禁用账号拦截）
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  const ip = clientIp(req);
  const area = await getIpGeo(ip);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    await writeLog(email || '', password || '', ip, area, 'fail');
    return res.status(401).json({ error: '账号或密码错误' });
  }
  // 登录成功
  const meta = data.user.user_metadata || {};
  if (meta.status === 'disabled') {
    await writeLog(email, password, ip, area, 'fail');
    return res.status(403).json({ error: '该账号已被管理员禁止登录' });
  }
  await writeLog(email, password, ip, area, 'success');
  res.json({
    token: data.session.access_token,
    user: { email: data.user.email, isAdmin: isAdmin(data.user), status: meta.status || 'active' }
  });
});

// 当前登录用户信息
app.get('/api/user', authMiddleware, (req, res) => {
  const meta = req.user.user_metadata || {};
  res.json({ email: req.user.email, isAdmin: isAdmin(req.user), status: meta.status || 'active' });
});

// ============ 任务接口 ============

app.get('/api/tasks', authMiddleware, async (req, res) => {
  const { data, error } = await supabaseAdmin.from('tasks').select('*').order('id');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// 批量保存任务（新增/更新，并删除不在列表中的任务）
app.post('/api/tasks', authMiddleware, async (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: '无权限' });
  const list = req.body || [];
  const keepIds = [];
  for (const item of list) {
    if (item.id) {
      keepIds.push(item.id);
      await supabaseAdmin.from('tasks').update({ name: item.name, target_beijing_time: item.targetBeijingTime }).eq('id', item.id);
    } else {
      const { data } = await supabaseAdmin.from('tasks').insert({ name: item.name, target_beijing_time: item.targetBeijingTime }).select();
      if (data && data[0]) keepIds.push(data[0].id);
    }
  }
  // 删除列表中已不存在的任务（兜底）
  const { data: all } = await supabaseAdmin.from('tasks').select('id');
  const delIds = (all || []).filter(t => !keepIds.includes(t.id)).map(t => t.id);
  if (delIds.length) await supabaseAdmin.from('tasks').delete().in('id', delIds);
  res.json({ ok: true });
});

// 删除单个任务
app.delete('/api/task/:id', authMiddleware, async (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: '无权限' });
  await supabaseAdmin.from('tasks').delete().eq('id', req.params.id);
  res.json({ ok: true });
});

// ============ 用户管理接口（仅管理员） ============

app.get('/api/all-users', authMiddleware, async (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: '无权限' });
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.users);
});

app.post('/api/create-user', authMiddleware, async (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: '无权限' });
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: '邮箱和密码不能为空' });
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { isAdmin: false, status: 'active' }
  });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/set-user-status', authMiddleware, async (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: '无权限' });
  const { userId, status } = req.body || {};
  if (userId === 'disabled') return res.status(400).json({ error: '无效参数' });
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: { status }
  });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/reset-pwd', authMiddleware, async (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: '无权限' });
  const { userId, newPwd } = req.body || {};
  if (!userId || !newPwd) return res.status(400).json({ error: '参数不完整' });
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPwd });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

app.delete('/api/user/:uid', authMiddleware, async (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: '无权限' });
  await supabaseAdmin.auth.admin.deleteUser(req.params.uid);
  res.json({ ok: true });
});

// ============ 登录日志接口（仅管理员） ============

app.get('/api/login-logs', authMiddleware, async (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: '无权限' });
  const { data, error } = await supabaseAdmin.from('login_logs').select('*').order('id', { ascending: false }).limit(500);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// 首页
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

// 404 兜底：非 API 路径一律回登录页
app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('==============================================');
  console.log('  长相思匹配时间发布系统 v4.0（完整建站版）');
  console.log(`  访问地址：http://localhost:${PORT}`);
  console.log(`  管理员账号：${ADMIN_EMAIL}`);
  console.log('==============================================');
});
