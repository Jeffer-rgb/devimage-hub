const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const xss = require('xss');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const fs = require('fs');

const app = express();
const SECRET = process.env.JWT_SECRET || 'devimage_secret_2024';
const PORT = process.env.PORT || 3000;

// ── MIDDLEWARE ──
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '20mb' }));

// frontend + uploads
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── RATE LIMIT ──
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));

// ── MULTER ──
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadsDir),
  filename: (_, file, cb) =>
    cb(null, Date.now() + '-' + Math.random().toString(36).substring(7) + '.webp')
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo imágenes'));
  }
});

// ── AUTH ──
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Sin token' });

  try {
    const data = jwt.verify(token, SECRET);
    req.userId = data.userId;
    next();
  } catch {
    res.status(403).json({ message: 'Token inválido' });
  }
}

// ── SANITIZE ──
const sanitize = str => xss(str || '').trim();

// ── FRONT ──
app.get('/', (_, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));
app.get('/dashboard', (_, res) => res.sendFile(path.join(__dirname, '../frontend/dashboard.html')));

// ── REGISTER ──
app.post('/register', async (req, res) => {
  let { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ message: 'Campos incompletos' });

  username = sanitize(username);
  email = sanitize(email);

  const hash = await bcrypt.hash(password, 10);

  db.run(
    `INSERT INTO users (username, email, password) VALUES (?, ?, ?)`,
    [username, email, hash],
    err => {
      if (err) return res.status(500).json({ message: 'Usuario ya existe' });
      res.json({ message: 'Usuario creado' });
    }
  );
});

// ── LOGIN ──
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.get(`SELECT * FROM users WHERE username = ?`, [username], async (_, user) => {
    if (!user) return res.status(401).json({ message: 'Credenciales incorrectas' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: 'Credenciales incorrectas' });

    const token = jwt.sign({ userId: user.id }, SECRET);
    res.json({ token, username: user.username });
  });
});

// ── UPLOAD ──
app.post('/upload', auth, upload.single('image'), (req, res) => {
  const { title, category, tags } = req.body;
  if (!req.file) return res.status(400).json({ message: 'No image' });

  const imageUrl = `/uploads/${req.file.filename}`;

  db.run(
    `INSERT INTO images (userId, imageUrl, title, category, tags)
     VALUES (?, ?, ?, ?, ?)`,
    [
      req.userId,
      imageUrl,
      sanitize(title) || 'Sin título',
      sanitize(category) || 'wallpaper',
      sanitize(tags) || ''
    ],
    err => {
      if (err) return res.status(500).json({ message: 'Error al subir' });
      res.json({ message: 'Subida exitosa' });
    }
  );
});

// ── GET IMAGES ──
app.get('/images', (_, res) => {
  db.all(`SELECT images.*, users.username as autor
          FROM images
          JOIN users ON users.id = images.userId
          ORDER BY createdAt DESC`, [], (_, rows) => {
    res.json({ data: rows, page: 1, pages: 1 });
  });
});

// ── FALLBACK ──
app.get('*', (_, res) =>
  res.sendFile(path.join(__dirname, '../frontend/index.html'))
);

// ── START ──
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));