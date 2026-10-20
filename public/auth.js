// 统一登录状态助手：支持"记住我"（localStorage 持久）与会话模式（sessionStorage）
function getToken(){ return localStorage.getItem('sb_token') || sessionStorage.getItem('sb_token'); }
function getRefresh(){ return localStorage.getItem('sb_refresh') || sessionStorage.getItem('sb_refresh'); }
function getRemember(){ return localStorage.getItem('sb_remember') === '1'; }

// 保存登录状态：remember=true 存 localStorage（关浏览器仍在），否则存 sessionStorage（关浏览器清除）
function saveAuth(token, refresh, remember){
  localStorage.removeItem('sb_token'); sessionStorage.removeItem('sb_token');
  localStorage.removeItem('sb_refresh'); sessionStorage.removeItem('sb_refresh');
  localStorage.removeItem('sb_loginUser'); sessionStorage.removeItem('sb_loginUser');
  localStorage.removeItem('sb_loginIsAdmin'); sessionStorage.removeItem('sb_loginIsAdmin');
  localStorage.setItem('sb_remember', remember ? '1' : '0');
  (remember ? localStorage : sessionStorage).setItem('sb_token', token);
  if(refresh) (remember ? localStorage : sessionStorage).setItem('sb_refresh', refresh);
}

// 辅助：保存账号信息（首页/管理页展示用）
function saveUserInfo(email, isAdmin){
  localStorage.setItem('loginUser', email);
  localStorage.setItem('loginIsAdmin', isAdmin);
}

function clearAuth(){
  localStorage.removeItem('sb_token'); sessionStorage.removeItem('sb_token');
  localStorage.removeItem('sb_refresh'); sessionStorage.removeItem('sb_refresh');
  localStorage.removeItem('sb_remember');
  localStorage.removeItem('loginUser'); sessionStorage.removeItem('loginUser');
  localStorage.removeItem('loginIsAdmin'); sessionStorage.removeItem('loginIsAdmin');
}

// 仅在非登录页时跳转登录页（登录页上静默返回 null，避免循环刷新）
function gotoLogin(){
  if(!location.pathname.endsWith('login.html')) window.location.href='./login.html';
}

// 确保有效 token：token 失效时自动用 refresh_token 换取新 token（实现"记住我"长期免登录）
async function ensureToken(){
  let t = getToken();
  if(!t){ gotoLogin(); return null; }
  let userRes;
  try{
    userRes = await fetch('/api/user',{headers:{Authorization:'Bearer '+t}});
  }catch(e){
    // 网络异常（如临时断网/访问慢）：不清登录状态，静默等待下次再试
    return null;
  }
  if(userRes.ok) return t;
  // token 被服务器拒绝（过期等）→ 尝试用 refresh_token 刷新
  const rt = getRefresh();
  if(!rt){ clearAuth(); gotoLogin(); return null; }
  let rr, rd;
  try{
    rr = await fetch('/api/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:rt})});
    rd = await rr.json();
  }catch(e){
    // 刷新请求网络失败：不清状态，下次再试
    return null;
  }
  if(!rr.ok || !rd.token){ clearAuth(); gotoLogin(); return null; }
  saveAuth(rd.token, rd.refresh_token, getRemember());
  return rd.token;
}

function logout(){
  clearAuth();
  gotoLogin();
}

// 带鉴权的请求：token 失效时自动刷新并重试一次
async function authFetch(path, options){
  const doFetch = (tok) => fetch(path, {...(options||{}), headers:{...(options?.headers||{}), 'Authorization':'Bearer '+tok}});
  let res = await doFetch(getToken());
  if(res.status === 401){
    const nt = await ensureToken();
    if(!nt) return res;
    res = await doFetch(nt);
  }
  return res;
}

