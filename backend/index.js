const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors    = require('cors');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const multer  = require('multer');
const sharp   = require('sharp');
const xss     = require('xss');
const rateLimit = require('express-rate-limit');
const db      = require('./db');
const fs      = require('fs');

const app    = express();
const SECRET = process.env.JWT_SECRET || 'devimage_secret_2024';
const PORT   = process.env.PORT || 3000;

// ── MIDDLEWARE ──────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Demasiadas solicitudes, intenta más tarde',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
});

app.use(limiter);

// ── MULTER ──────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).substring(7)}.webp`)
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  }
});

// ── COMPRESSION ──────────────────────────────────────────────
async function compressImage(inputPath, outputPath) {
  try {
    await sharp(inputPath)
      .webp({ quality: 80 })
      .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
      .toFile(outputPath);
    fs.unlinkSync(inputPath);
    return outputPath;
  } catch (e) {
    console.error('Error compressing:', e);
    return inputPath;
  }
}

// ── AUTH MIDDLEWARE ─────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Sin token' });
  try {
    const data   = jwt.verify(token, SECRET);
    req.userId   = data.userId;
    req.username = data.username;
    next();
  } catch (e) {
    if (e.name === 'TokenExpiredError')
      return res.status(401).json({ message: 'Token expirado' });
    res.status(403).json({ message: 'Token inválido' });
  }
}

// ── SANITIZE ─────────────────────────────────────────────────
function sanitize(str) {
  return xss(str, { whiteList: {}, stripIgnoredTag: true }).trim();
}

// ── PÁGINAS ─────────────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, '../frontend/dashboard.html')));

// ── REGISTER ────────────────────────────────────────────────
app.post('/register', authLimiter, async (req, res) => {
  let { username, email, password } = req.body;

  if (!username || !email || !password)
    return res.status(400).json({ message: 'Completa todos los campos' });

  username = sanitize(username);
  email = sanitize(email);

  if (username.length < 3)
    return res.status(400).json({ message: 'Usuario: mínimo 3 caracteres' });

  if (!/^[a-zA-Z0-9_]+$/.test(username))
    return res.status(400).json({ message: 'Usuario: solo letras, números y _' });

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ message: 'Email inválido' });

  if (password.length < 6)
    return res.status(400).json({ message: 'Contraseña: mínimo 6 caracteres' });

  const hash = await bcrypt.hash(password, 10);

  db.run(`INSERT INTO users (username, email, password) VALUES (?, ?, ?)`, [username, email, hash],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE'))
          return res.status(409).json({ message: 'Usuario o email ya registrado' });
        return res.status(500).json({ message: 'Error del servidor' });
      }
      res.json({ message: 'Cuenta creada exitosamente', id: this.lastID });
    }
  );
});

// ── LOGIN ────────────────────────────────────────────────────
app.post('/login', authLimiter, (req, res) => {
  let { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ message: 'Completa todos los campos' });

  username = sanitize(username);

  db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
    if (err)   return res.status(500).json({ message: 'Error del servidor' });
    if (!user) return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok)   return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });

    const token = jwt.sign({ userId: user.id, username: user.username }, SECRET, { expiresIn: '7d' });
    res.json({ token, username: user.username });
  });
});

// ── UPLOAD (con compresión) ─────────────────────────────────
app.post('/upload', auth, uploadLimiter, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No se recibió imagen' });

  let { title, category, tags } = req.body;
  title = sanitize(title);
  tags = sanitize(tags);

  if (!title || title === '')
    return res.status(400).json({ message: 'El título es requerido' });

  const validCats = ['wallpaper', 'fanart', 'perfil', 'ui'];
  const cat = validCats.includes(category) ? category : 'wallpaper';

  try {
    const compressedPath = path.join(uploadsDir, `${Date.now()}-${Math.random().toString(36).substring(7)}.webp`);
    await compressImage(req.file.path, compressedPath);
    const imageUrl = `/uploads/${path.basename(compressedPath)}`;

    db.run(`INSERT INTO images (userId, imageUrl, title, category, tags) VALUES (?, ?, ?, ?, ?)`,
      [req.userId, imageUrl, title, cat, tags],
      function (err) {
        if (err) return res.status(500).json({ message: 'Error al guardar imagen' });
        res.json({ message: 'Imagen publicada', id: this.lastID });
      }
    );
  } catch (e) {
    console.error('Upload error:', e);
    res.status(500).json({ message: 'Error al procesar imagen' });
  }
});

// ── GET IMAGES (paginación + búsqueda) ──────────────────────
app.get('/images', (req, res) => {
  const { category, search, page = 1, limit = 12 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let sql = `SELECT i.*, u.username as autor FROM images i JOIN users u ON i.userId = u.id WHERE 1=1`;
  const params = [];

  if (category && category !== 'todos') {
    sql += ` AND i.category = ?`;
    params.push(category);
  }

  if (search) {
    sql += ` AND (i.title LIKE ? OR i.tags LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  sql += ` ORDER BY i.createdAt DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), offset);

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ message: 'Error al obtener imágenes' });

    let countSql = `SELECT COUNT(*) as total FROM images WHERE 1=1`;
    const countParams = [];
    if (category && category !== 'todos') {
      countSql += ` AND category = ?`;
      countParams.push(category);
    }
    if (search) {
      countSql += ` AND (title LIKE ? OR tags LIKE ?)`;
      countParams.push(`%${search}%`, `%${search}%`);
    }

    db.get(countSql, countParams, (err2, result) => {
      res.json({
        data: rows,
        total: result?.total || 0,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil((result?.total || 1) / parseInt(limit))
      });
    });
  });
});

// ── STATS (con caché) ────────────────────────────────────────
let statsCache = { data: null, timestamp: 0 };
const CACHE_DURATION = 5 * 60 * 1000;

app.get('/stats', (req, res) => {
  const now = Date.now();
  if (statsCache.data && (now - statsCache.timestamp) < CACHE_DURATION) {
    return res.json(statsCache.data);
  }

  db.get(`SELECT COUNT(*) as totalImagenes FROM images`, [], (err, r1) => {
    db.get(`SELECT COUNT(*) as totalUsuarios FROM users`, [], (err2, r2) => {
      const data = { totalImagenes: r1?.totalImagenes || 0, totalUsuarios: r2?.totalUsuarios || 0 };
      statsCache.data = data;
      statsCache.timestamp = now;
      res.json(data);
    });
  });
});

// ── LIKE ─────────────────────────────────────────────────────
app.post('/images/:id/like', auth, (req, res) => {
  const imageId = req.params.id;
  const userId = req.userId;

  db.get(`SELECT * FROM likes WHERE userId = ? AND imageId = ?`, [userId, imageId], (err, row) => {
    if (row) {
      db.run(`DELETE FROM likes WHERE userId = ? AND imageId = ?`, [userId, imageId]);
      db.run(`UPDATE images SET likes = MAX(0, likes - 1) WHERE id = ?`, [imageId], () => {
        res.json({ liked: false });
      });
    } else {
      db.run(`INSERT INTO likes (userId, imageId) VALUES (?, ?)`, [userId, imageId]);
      db.run(`UPDATE images SET likes = likes + 1 WHERE id = ?`, [imageId], () => {
        res.json({ liked: true });
      });
    }
  });
});

// ── MY IMAGES ────────────────────────────────────────────────
app.get('/my-images', auth, (req, res) => {
  const { page = 1, limit = 12 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  db.all(`SELECT * FROM images WHERE userId = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
    [req.userId, parseInt(limit), offset], (err, rows) => {
      if (err) return res.status(500).json({ message: 'Error' });

      db.get(`SELECT COUNT(*) as total FROM images WHERE userId = ?`, [req.userId], (err2, result) => {
        res.json({
          data: rows,
          total: result?.total || 0,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil((result?.total || 1) / parseInt(limit))
        });
      });
    }
  );
});

// ── DELETE IMAGE ─────────────────────────────────────────────
app.delete('/images/:id', auth, (req, res) => {
  db.get(`SELECT * FROM images WHERE id = ? AND userId = ?`, [req.params.id, req.userId], (err, img) => {
    if (!img) return res.status(404).json({ message: 'No encontrado o sin permiso' });

    const filePath = path.join(__dirname, '..', img.imageUrl);
    fs.unlink(filePath, () => {});

    db.run(`DELETE FROM images WHERE id = ?`, [req.params.id], () => {
      res.json({ message: 'Imagen eliminada' });
    });
  });
});

// ── ERROR HANDLER ────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Error:', err);
  if (err instanceof multer.MulterError) {
    if (err.code === 'FILE_TOO_LARGE')
      return res.status(400).json({ message: 'Imagen muy grande (máx 10MB)' });
  }
  res.status(500).json({ message: 'Error del servidor' });
});

// ── START ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🔥 DevImage Hub v2.1 → http://localhost:${PORT}`);
  console.log(`📁 Uploads: ${uploadsDir}`);
  console.log(`⚡ Rate limiting activo`);
  console.log(`🔐 XSS sanitization activo`);
  console.log(`📦 Image compression activo (WebP)`);
});
