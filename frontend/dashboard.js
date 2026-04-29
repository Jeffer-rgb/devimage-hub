// ── FONDO HEXAGONAL ────────────────────────────────────────
(function () {
  const canvas = document.getElementById('bg');
  if (!canvas) return; // 🔥 protección

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
          x: c * S * 1.75 + (r % 2) * S * 0.875,
          y: r * S * 1.5,
          phase: Math.random() * Math.PI * 2,
          speed: 0.4 + Math.random() * 0.8
        });
  }

  function hexPath(cx, cy, s) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i - 30);
      i === 0 ? ctx.moveTo(cx + s * Math.cos(a), cy + s * Math.sin(a))
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

// ── ESTADO GLOBAL ──────────────────────────────────────────
const API = '';
let token, username;
let filtroActual = 'todos';
let ordenActual = 'reciente';
let imagenes = [];
let imagenActualVer = null;

// ── INIT ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  token = localStorage.getItem('token');
  username = localStorage.getItem('username');
  const theme = localStorage.getItem('theme') || 'dark';

  if (!token) { window.location.href = '/'; return; }

  document.getElementById('navUsername').textContent = username;
  document.getElementById('navAvatar').textContent = username.charAt(0).toUpperCase();

  // Cargar tema guardado
  if (theme === 'light') {
    document.body.classList.add('light-mode');
    document.getElementById('sunIcon').style.display = 'none';
    document.getElementById('moonIcon').style.display = 'block';
  }

  document.getElementById('btnThemeToggle').addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    document.getElementById('sunIcon').style.display = isLight ? 'none' : 'block';
    document.getElementById('moonIcon').style.display = isLight ? 'block' : 'none';
  });

  cargarImagenes();
  cargarStats();

  // Events
  setupNavigation();
  setupSidebar();
  setupFilters();
  setupUpload();
  setupModales();

  setInterval(cargarImagenes, 5000);
});

// ── NAVBAR ──────────────────────────────────────────────────
function setupNavigation() {
  document.querySelectorAll('.nav-link').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (section === 'subir') {
        document.getElementById('modalSubir').style.display = 'flex';
      } else if (section === 'mis-imagenes') {
        cargarMisImagenes();
      } else {
        cargarImagenes();
      }
    });
  });

  document.getElementById('btnLogout').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = '/';
  });
}

// ── SIDEBAR ────────────────────────────────────────────────
function setupSidebar() {
  document.querySelectorAll('[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-cat]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filtroActual = btn.dataset.cat;
      renderGaleria();
    });
  });

  document.querySelectorAll('[data-sort]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-sort]').forEach(b => b.classList.remove('active-sort'));
      btn.classList.add('active-sort');
      ordenActual = btn.dataset.sort;
      renderGaleria();
    });
  });
}

// ── FILTROS (chips) ────────────────────────────────────────
function setupFilters() {
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      filtroActual = chip.dataset.cat;
      renderGaleria();
    });
  });

  document.getElementById('searchInput').addEventListener('input', (e) => {
    const search = e.target.value.trim();
    if (search) {
      imagenes = imagenes.filter(img => 
        img.title.toLowerCase().includes(search) || 
        (img.tags && img.tags.toLowerCase().includes(search))
      );
    } else {
      cargarImagenes();
    }
    renderGaleria();
  });
}

// ── CARGAR IMÁGENES (con paginación) ────────────────────
let paginaActual = 1;
let totalPaginas = 1;
let cargandoMas = false;

async function cargarImagenes(page = 1) {
  try {
    const limit = 12;
    const res = await fetch(`${API}/images?page=${page}&limit=${limit}&category=${filtroActual}`);
    const result = await res.json();
    
    if (page === 1) {
      imagenes = result.data;
    } else {
      imagenes = [...imagenes, ...result.data];
    }
    
    paginaActual = result.page;
    totalPaginas = result.pages;
    
    renderGaleria();
    actualizarContadores();
    
    // Mostrar botón de "cargar más" si hay más páginas
    const loadMoreBtn = document.getElementById('btnCargarMas');
    if (loadMoreBtn) {
      loadMoreBtn.style.display = paginaActual < totalPaginas ? 'block' : 'none';
    }
  } catch (e) {
    console.error('Error cargando imágenes:', e);
  }
}

// Cargar más imágenes (infinite scroll simulado)
function cargarMas() {
  if (cargandoMas || paginaActual >= totalPaginas) return;
  cargandoMas = true;
  cargarImagenes(paginaActual + 1).finally(() => { cargandoMas = false; });
}

async function cargarMisImagenes(page = 1) {
  try {
    const limit = 12;
    const res = await fetch(`${API}/my-images?page=${page}&limit=${limit}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    
    if (page === 1) {
      imagenes = result.data;
    } else {
      imagenes = [...imagenes, ...result.data];
    }
    
    paginaActual = result.page;
    totalPaginas = result.pages;
    document.getElementById('statSubidas').textContent = result.total;
    
    renderGaleria();
  } catch (e) {
    console.error('Error:', e);
  }
}

// ── ACTUALIZAR CONTADORES ─────────────────────────────────
function actualizarContadores() {
  const contar = (cat) => imagenes.filter(i => cat === 'todos' || i.category === cat).length;
  document.getElementById('countTodos').textContent = imagenes.length;
  document.getElementById('countWallpaper').textContent = contar('wallpaper');
  document.getElementById('countFanart').textContent = contar('fanart');
  document.getElementById('countPerfil').textContent = contar('perfil');
  document.getElementById('countUi').textContent = contar('ui');
}

// ── RENDERIZAR GALERÍA ──────────────────────────────────────
function renderGaleria() {
  let filtered = imagenes;

  if (filtroActual !== 'todos') {
    filtered = filtered.filter(i => i.category === filtroActual);
  }

  if (ordenActual === 'popular') {
    filtered.sort((a, b) => (b.likes || 0) - (a.likes || 0));
  }

  const gallery = document.getElementById('gallery');
  if (filtered.length === 0) {
    gallery.style.display = 'none';
    document.getElementById('emptyState').style.display = 'flex';
    return;
  }

  gallery.style.display = 'grid';
  document.getElementById('emptyState').style.display = 'none';
  gallery.innerHTML = filtered.map(img => `
    <div class="img-card" onclick="abrirModal(${img.id})">
      <div class="img-thumb">
        <img src="${img.imageUrl}" alt="${img.title}" loading="lazy">
        <div class="img-overlay">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </div>
        <span class="badge-cat badge-${img.category}">${img.category}</span>
      </div>
      <div class="img-meta">
        <div class="img-title">${img.title}</div>
        <div class="img-sub">${img.autor} · ${img.likes || 0} ❤️</div>
      </div>
    </div>
  `).join('');

  // Lazy loading con Intersection Observer
  const images = document.querySelectorAll('img[loading="lazy"]');
  if ('IntersectionObserver' in window) {
    const lazyObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.src;
          img.loading = 'eager';
          lazyObserver.unobserve(img);
        }
      });
    });
    images.forEach(img => lazyObserver.observe(img));
  }
}

// ── MODAL VER IMAGEN ───────────────────────────────────────
function abrirModal(id) {
  imagenActualVer = imagenes.find(i => i.id === id);
  if (!imagenActualVer) return;

  document.getElementById('verImg').src = imagenActualVer.imageUrl;
  document.getElementById('verTitle').textContent = imagenActualVer.title;
  document.getElementById('verSub').textContent = `${imagenActualVer.autor} · ${new Date(imagenActualVer.createdAt).toLocaleDateString()}`;
  document.getElementById('verTags').textContent = imagenActualVer.tags ? `Tags: ${imagenActualVer.tags}` : '';
  document.getElementById('favCount').textContent = imagenActualVer.likes || 0;

  const btnDelete = document.getElementById('btnDelete');
  if (imagenActualVer.userId && imagenActualVer.userId === JSON.parse(atob(token.split('.')[1])).userId) {
    btnDelete.style.display = 'inline-flex';
  } else {
    btnDelete.style.display = 'none';
  }

  document.getElementById('modalVer').style.display = 'flex';
}

// ── UPLOAD ──────────────────────────────────────────────────
function setupUpload() {
  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('fileInput');
  const previewWrap = document.getElementById('previewWrap');
  const previewImg = document.getElementById('previewImg');

  uploadArea.addEventListener('click', () => fileInput.click());
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = 'rgba(34,211,238,0.5)';
  });
  uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.borderColor = 'rgba(34,211,238,0.2)';
  });
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = 'rgba(34,211,238,0.2)';
    const files = e.dataTransfer.files;
    if (files.length) mostrarPreview(files[0]);
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) mostrarPreview(e.target.files[0]);
  });

  document.getElementById('previewRemove').addEventListener('click', () => {
    fileInput.value = '';
    previewWrap.style.display = 'none';
    uploadArea.style.display = 'flex';
  });

  document.getElementById('btnConfirmarSubida').addEventListener('click', subirImagen);
}

function mostrarPreview(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('previewImg').src = e.target.result;
    document.getElementById('previewWrap').style.display = 'block';
    document.getElementById('uploadArea').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

async function subirImagen() {
  const fileInput = document.getElementById('fileInput');
  const title = document.getElementById('uploadTitle').value.trim();
  const cat = document.getElementById('uploadCat').value;
  const tags = document.getElementById('uploadTags').value;
  const btn = document.getElementById('btnConfirmarSubida');

  if (!fileInput.files.length || !title) {
    setStatus('statusUpload', 'error', 'Faltan datos');
    return;
  }

  const formData = new FormData();
  formData.append('image', fileInput.files[0]);
  formData.append('title', title);
  formData.append('category', cat);
  formData.append('tags', tags);

  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const res = await fetch(`${API}/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();

    if (!res.ok) { setStatus('statusUpload', 'error', data.message); return; }

    setStatus('statusUpload', 'success', 'Imagen publicada');
    setTimeout(() => {
      document.getElementById('modalSubir').style.display = 'none';
      fileInput.value = '';
      document.getElementById('uploadTitle').value = '';
      document.getElementById('uploadTags').value = '';
      document.getElementById('previewWrap').style.display = 'none';
      document.getElementById('uploadArea').style.display = 'flex';
      cargarImagenes();
    }, 1500);

  } catch { setStatus('statusUpload', 'error', 'Error al subir'); }
  finally { btn.classList.remove('loading'); btn.disabled = false; }
}

// ── LIKE ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    document.getElementById('btnFav')?.addEventListener('click', async () => {
      if (!imagenActualVer) return;
      const res = await fetch(`${API}/images/${imagenActualVer.id}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      imagenActualVer.likes = (imagenActualVer.likes || 0) + (data.liked ? 1 : -1);
      document.getElementById('favCount').textContent = imagenActualVer.likes;
      cargarImagenes();
    });
  }, 500);
});

// ── DELETE ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    document.getElementById('btnDelete')?.addEventListener('click', async () => {
      if (!imagenActualVer) return;
      
      const confirmed = confirm(`¿Estás seguro de que quieres eliminar "${imagenActualVer.title}"?\n\nEsta acción no se puede deshacer.`);
      if (!confirmed) return;

      const res = await fetch(`${API}/images/${imagenActualVer.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        document.getElementById('modalVer').style.display = 'none';
        cargarImagenes();
      }
    });
  }, 500);
});

// ── STATS ──────────────────────────────────────────────────
async function cargarStats() {
  try {
    const res = await fetch(`${API}/stats`);
    const data = await res.json();
    document.getElementById('totalImagenes').textContent = data.totalImagenes;
    document.getElementById('totalUsuarios').textContent = data.totalUsuarios;

    const myCount = imagenes.filter(i => i.autor === username).length;
    document.getElementById('statSubidas').textContent = myCount;
  } catch (e) {
    console.error('Error stats:', e);
  }
}

// ── MODALES ────────────────────────────────────────────────
function setupModales() {
  document.getElementById('modalSubirClose').addEventListener('click', () => {
    document.getElementById('modalSubir').style.display = 'none';
  });

  document.getElementById('modalVerClose').addEventListener('click', () => {
    document.getElementById('modalVer').style.display = 'none';
  });

  document.getElementById('btnDescargar').addEventListener('click', (e) => {
    if (imagenActualVer) {
      e.target.href = imagenActualVer.imageUrl;
      e.target.download = imagenActualVer.title;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.getElementById('modalSubir').style.display = 'none';
      document.getElementById('modalVer').style.display = 'none';
    }
  });
}

// ── STATUS BAR ──────────────────────────────────────────────
function setStatus(id, tipo, msg) {
  const el = document.getElementById(id);
  el.className = tipo ? `status-bar show-${tipo}` : 'status-bar';
  el.textContent = msg || '';
}