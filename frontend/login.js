// ── FONDO HEXAGONAL ────────────────────────────────────────
(function () {
  const canvas = document.getElementById('bg');
  if (!canvas) return; // 🔥 protección en ambos

  const ctx = canvas.getContext('2d');
  let W, H, hexes = [];
  const S = 28;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    hexes = [];
    const cols = Math.ceil(W / (S * 1.75)) + 2;
    const rows = Math.ceil(H / (S * 1.5))  + 2;
    for (let r = -1; r < rows; r++)
      for (let c = -1; c < cols; c++)
        hexes.push({
          x:     c * S * 1.75 + (r % 2) * S * 0.875,
          y:     r * S * 1.5,
          phase: Math.random() * Math.PI * 2,
          speed: 0.4 + Math.random() * 0.8
        });
  }

  function hexPath(cx, cy, s) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i - 30);
      i === 0
        ? ctx.moveTo(cx + s * Math.cos(a), cy + s * Math.sin(a))
        : ctx.lineTo(cx + s * Math.cos(a), cy + s * Math.sin(a));
    }
    ctx.closePath();
  }

  function draw() {
    ctx.fillStyle = '#050d1a';
    ctx.fillRect(0, 0, W, H);
    const t = Date.now() / 1000;
    hexes.forEach(h => {
      const pulse = 0.5 + 0.5 * Math.sin(t * h.speed + h.phase);
      hexPath(h.x, h.y, S - 2);
      ctx.fillStyle   = `rgba(34,211,238,${0.03 + 0.12 * pulse})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(34,211,238,${0.07 + 0.28 * pulse})`;
      ctx.lineWidth   = 0.8;
      ctx.stroke();
      if (pulse > 0.85) {
        hexPath(h.x, h.y, S - 2);
        ctx.strokeStyle = `rgba(165,243,252,${(pulse - 0.85) * 1.4})`;
        ctx.lineWidth   = 1.5;
        ctx.stroke();
      }
    });
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  draw();
})();

// ── UTILIDADES ──────────────────────────────────────────────
const API = '';

function setLoading(btn, on) {
  btn.classList.toggle('loading', on);
  btn.disabled = on;
}

function setStatus(id, tipo, msg) {
  const el = document.getElementById(id);
  el.className   = tipo ? `status-bar show-${tipo}` : 'status-bar';
  el.textContent = msg || '';
}

function setFieldError(inputId, msgId, msg) {
  const input = document.getElementById(inputId);
  const label = document.getElementById(msgId);
  if (msg) {
    input.classList.add('input-error');
    input.classList.remove('input-ok');
    label.textContent = msg;
  } else {
    input.classList.remove('input-error');
    input.classList.add('input-ok');
    if (label) label.textContent = '';
  }
}

function clearErrors(...pairs) {
  pairs.forEach(([iId, mId]) => {
    document.getElementById(iId)?.classList.remove('input-error','input-ok');
    const el = document.getElementById(mId);
    if (el) el.textContent = '';
  });
}

function cambiarVista(v) {
  document.getElementById('wrapperLogin').style.display    = v === 'login'    ? '' : 'none';
  document.getElementById('wrapperRegistro').style.display = v === 'registro' ? '' : 'none';
}

// ── LOGIN ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // toggle password
  const togglePw = document.getElementById('togglePw');
  const passInput = document.getElementById('loginPass');
  togglePw.addEventListener('click', () => {
    const vis = passInput.type === 'text';
    passInput.type = vis ? 'password' : 'text';
    document.getElementById('eyeOpen').style.display   = vis ? '' : 'none';
    document.getElementById('eyeClosed').style.display = vis ? 'none' : '';
    togglePw.classList.toggle('active', !vis);
  });

  // limpiar errores al escribir
  document.getElementById('loginUser').addEventListener('input', () => setFieldError('loginUser','errLoginUser',''));
  document.getElementById('loginPass').addEventListener('input', () => setFieldError('loginPass','errLoginPass',''));

  // botón login
  document.getElementById('btnLogin').addEventListener('click', async () => {
    const username = document.getElementById('loginUser').value.trim();
    const password = document.getElementById('loginPass').value;
    const btn      = document.getElementById('btnLogin');

    clearErrors(['loginUser','errLoginUser'],['loginPass','errLoginPass']);
    setStatus('statusLogin','','');

    let err = false;
    if (!username) { setFieldError('loginUser','errLoginUser','Campo requerido'); err = true; }
    if (!password) { setFieldError('loginPass','errLoginPass','Campo requerido'); err = true; }
    if (err) return;

    setLoading(btn, true);
    try {
      const res  = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) { setStatus('statusLogin','error', data.message); return; }

      localStorage.setItem('token',    data.token);
      localStorage.setItem('username', data.username);
      setStatus('statusLogin','success','Acceso concedido — redirigiendo...');
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 800);

    } catch { setStatus('statusLogin','error','Error de conexión con el servidor'); }
    finally  { setLoading(btn, false); }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && document.getElementById('wrapperLogin').style.display !== 'none')
      document.getElementById('btnLogin').click();
  });

  document.getElementById('btnIrRegistro').addEventListener('click', () => {
    setStatus('statusLogin','','');
    clearErrors(['loginUser','errLoginUser'],['loginPass','errLoginPass']);
    cambiarVista('registro');
  });

  // ── REGISTRO ──────────────────────────────────────────────
  ['regUser','regEmail','regPass','regPass2'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      const errMap = { regUser:'errRegUser', regEmail:'errRegEmail', regPass:'errRegPass', regPass2:'errRegPass2' };
      setFieldError(id, errMap[id], '');
    });
  });

  document.getElementById('btnRegistrar').addEventListener('click', async () => {
    const username = document.getElementById('regUser').value.trim();
    const email    = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPass').value;
    const pass2    = document.getElementById('regPass2').value;
    const btn      = document.getElementById('btnRegistrar');

    clearErrors(['regUser','errRegUser'],['regEmail','errRegEmail'],['regPass','errRegPass'],['regPass2','errRegPass2']);
    setStatus('statusReg','','');

    let err = false;

    if (!username) { setFieldError('regUser','errRegUser','Campo requerido'); err = true; }
    else if (username.length < 3) { setFieldError('regUser','errRegUser','Mínimo 3 caracteres'); err = true; }
    else if (!/^[a-zA-Z0-9_]+$/.test(username)) { setFieldError('regUser','errRegUser','Solo letras, números y _'); err = true; }

    if (!email) { setFieldError('regEmail','errRegEmail','Campo requerido'); err = true; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFieldError('regEmail','errRegEmail','Email inválido'); err = true; }

    if (!password) { setFieldError('regPass','errRegPass','Campo requerido'); err = true; }
    else if (password.length < 6) { setFieldError('regPass','errRegPass','Mínimo 6 caracteres'); err = true; }

    if (!pass2) { setFieldError('regPass2','errRegPass2','Campo requerido'); err = true; }
    else if (password !== pass2) { setFieldError('regPass2','errRegPass2','Las contraseñas no coinciden'); err = true; }

    if (err) return;

    setLoading(btn, true);
    try {
      const res  = await fetch(`${API}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });
      const data = await res.json();
      if (!res.ok) { setStatus('statusReg','error', data.message); return; }

      setStatus('statusReg','success','Cuenta creada. Ahora inicia sesión.');
      setTimeout(() => {
        ['regUser','regEmail','regPass','regPass2'].forEach(id => document.getElementById(id).value = '');
        clearErrors(['regUser','errRegUser'],['regEmail','errRegEmail'],['regPass','errRegPass'],['regPass2','errRegPass2']);
        cambiarVista('login');
      }, 1500);

    } catch { setStatus('statusReg','error','Error de conexión con el servidor'); }
    finally  { setLoading(btn, false); }
  });

  document.getElementById('btnIrLogin').addEventListener('click', () => {
    setStatus('statusReg','','');
    cambiarVista('login');
  });

  // redirigir si ya tiene sesión
  if (localStorage.getItem('token')) window.location.href = '/dashboard';
});