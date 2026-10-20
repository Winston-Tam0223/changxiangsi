/* ============================================================
   长相思 · 深色科技风 交互引擎
   Canvas 粒子 + 漂浮几何体 + 鼠标视差 + 滚动渐入 + 涟漪微交互
   零外部依赖（不加载 Three.js CDN，国内访问更稳）
   ============================================================ */
(function(){
  'use strict';

  /* ---------- 粒子背景画布 ---------- */
  var canvas = document.createElement('canvas');
  canvas.id = 'fx-bg';
  document.body.appendChild(canvas);
  var ctx = canvas.getContext('2d');
  var W = 0, H = 0, DPR = 1;

  function resize(){
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();

  /* 粒子（近远两层，近层速度×2） */
  var N = W < 640 ? 34 : 62;
  var parts = [];
  for (var i = 0; i < N; i++){
    parts.push({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .3, vy: (Math.random() - .5) * .3,
      r: Math.random() * 1.9 + 1.1,
      a: Math.random() * .5 + .22,
      near: Math.random() < .3,
      tw: Math.random() * Math.PI * 2
    });
  }

  /* 漂浮几何体：三角 / 菱形 / 圆环 */
  var shapes = [];
  var types = ['tri', 'dia', 'ring'];
  for (var k = 0; k < 7; k++){
    shapes.push({
      type: types[k % 3],
      x: Math.random() * W, y: Math.random() * H,
      size: 18 + Math.random() * 46,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - .5) * .011,
      vx: (Math.random() - .5) * .14,
      vy: (Math.random() - .5) * .14 + .025,
      a: Math.random() * .15 + .05
    });
  }

  /* 鼠标视差 */
  var tx = 0, ty = 0;
  window.addEventListener('mousemove', function(e){
    tx = e.clientX / W - .5;
    ty = e.clientY / H - .5;
  }, { passive: true });

  var running = true;
  document.addEventListener('visibilitychange', function(){
    running = !document.hidden;
    if (running) loop();
  });

  function drawShape(s){
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot);
    ctx.globalAlpha = s.a;
    ctx.strokeStyle = '#56c98a';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (s.type === 'tri'){
      ctx.moveTo(0, -s.size * .7);
      ctx.lineTo(s.size * .6, s.size * .45);
      ctx.lineTo(-s.size * .6, s.size * .45);
      ctx.closePath();
    } else if (s.type === 'dia'){
      ctx.moveTo(0, -s.size * .6);
      ctx.lineTo(s.size * .6, 0);
      ctx.lineTo(0, s.size * .6);
      ctx.lineTo(-s.size * .6, 0);
      ctx.closePath();
    } else {
      ctx.arc(0, 0, s.size * .45, 0, Math.PI * 2);
    }
    ctx.stroke();
    ctx.restore();
  }

  var t = 0;
  function loop(){
    if (!running) return;
    requestAnimationFrame(loop);
    t += .016;
    ctx.clearRect(0, 0, W, H);
    var px = tx * -16, py = ty * -11;   /* 视差整体偏移 */
    var i, j;

    /* 粒子 */
    for (i = 0; i < parts.length; i++){
      var p = parts[i];
      var sp = p.near ? 1 : .55;
      p.x += p.vx * sp; p.y += p.vy * sp;
      if (p.x < -24) p.x = W + 24; else if (p.x > W + 24) p.x = -24;
      if (p.y < -24) p.y = H + 24; else if (p.y > H + 24) p.y = -24;
      var tw = Math.sin(t * 1.3 + p.tw) * .09 + .32;
      ctx.beginPath();
      ctx.arc(p.x + px * sp, p.y + py * sp, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(86,201,138,' + (p.a * tw).toFixed(3) + ')';
      ctx.fill();
    }

    /* 近距离连线 */
    for (i = 0; i < parts.length; i++){
      for (j = i + 1; j < parts.length; j++){
        var a = parts[i], b = parts[j];
        var dx = a.x - b.x, dy = a.y - b.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < 118){
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = 'rgba(86,201,138,' + ((1 - d / 118) * .10).toFixed(3) + ')';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    /* 漂浮几何体 */
    for (i = 0; i < shapes.length; i++){
      var s = shapes[i];
      s.x += s.vx; s.y += s.vy; s.rot += s.vr;
      if (s.x < -70) s.x = W + 70; else if (s.x > W + 70) s.x = -70;
      if (s.y < -70) s.y = H + 70; else if (s.y > H + 70) s.y = -70;
      drawShape(s);
    }
  }
  loop();
  window.addEventListener('resize', resize);

  /* ---------- 滚动渐入 ---------- */
  document.documentElement.classList.add('js');
  var REVEAL_SEL = '.card,.login-card,.logo,.head,.table-wrap,.toolbar,.entry-row,.vt-box,.welcome-box';
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if (en.isIntersecting){
        en.target.classList.add('in');
        io.unobserve(en.target);
      }
    });
  }, { threshold: .12 });

  function setupReveal(root){
    var els = (root || document).querySelectorAll(REVEAL_SEL);
    for (var i = 0; i < els.length; i++){
      var el = els[i];
      if (!el.classList.contains('reveal')){
        el.classList.add('reveal');
        io.observe(el);
      }
    }
  }
  setupReveal(document);
  if (window.MutationObserver){
    new MutationObserver(function(){
      setupReveal(document);
    }).observe(document.body, { childList: true, subtree: true });
  }

  /* ---------- 涟漪微交互 ---------- */
  document.addEventListener('click', function(e){
    var b = e.target.closest('.btn,.login-btn,.lang-btn');
    if (!b) return;
    var r = b.getBoundingClientRect();
    var d = Math.max(r.width, r.height) * 1.3;
    var s = document.createElement('span');
    s.className = 'ripple';
    s.style.width = s.style.height = d + 'px';
    s.style.left = (e.clientX - r.left - d / 2) + 'px';
    s.style.top = (e.clientY - r.top - d / 2) + 'px';
    b.appendChild(s);
    setTimeout(function(){ if (s.parentNode) s.parentNode.removeChild(s); }, 650);
  });

  /* ---------- 卡片入场错峰（避免全部同时出现）---------- */
  setTimeout(function(){
    document.querySelectorAll('.reveal:not(.in)').forEach(function(el, idx){
      el.style.transitionDelay = Math.min(idx % 6, 5) * 55 + 'ms';
    });
  }, 60);
})();
