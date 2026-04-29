# DevImage Hub v2.1

**Plataforma de galería de imágenes tech/software aesthetic - Production Ready**

## ✨ Características v2.1

### Frontend
- ✅ Fondo hexagonal animado con Canvas
- ✅ Diseño dark mode premium con DM Mono/Syne
- ✅ Dark/Light mode toggle (persistent)
- ✅ Lazy loading de imágenes
- ✅ Paginación con "cargar más"
- ✅ Búsqueda en tiempo real en BD
- ✅ Modales para subir y ver imágenes
- ✅ Sistema de likes/favoritos
- ✅ Responsive (mobile-first)

### Backend
- ✅ Autenticación con JWT (7 días)
- ✅ Contraseñas con bcrypt (10 rounds)
- ✅ SQLite con índices y relaciones
- ✅ **Compresión de imágenes automática (WebP)**
- ✅ **Rate limiting (5 login/15min, 20 uploads/hora)**
- ✅ **Sanitización XSS en todos los inputs**
- ✅ **Paginación real (limit/offset)**
- ✅ **Caché de stats (5 minutos)**
- ✅ Validación frontend + backend
- ✅ Manejo de errores robusto

## Instalación

```bash
# 1. Instala dependencias
npm install

# 2. Crea carpeta de uploads
mkdir uploads

# 3. Verifica .env
cat .env

# 4. Inicia
npm start
# Desarrollo:
npm run dev
```

Abre `http://localhost:3000`

## Credenciales de prueba

```
Usuario: test
Contraseña: 123456
```
(Regístrate primero)

## 🔒 Seguridad implementada

- **bcrypt**: Contraseñas hasheadas a 10 rounds
- **JWT**: Tokens con expiraciónde 7 días
- **Rate Limiting**: 5 intentos de login, 20 uploads/hora
- **XSS Protection**: Sanitización con librería `xss`
- **CORS**: Restringido a origen específico
- **Foreign Keys**: Eliminar usuario elimina sus imágenes
- **SQL Injection**: Prepared statements en todas las consultas

## 📊 Características de Performance

- **Compresión**: Imágenes convertidas a WebP, máx 2000px, calidad 80
- **Caché**: Stats cacheadas 5 minutos en memoria
- **Lazy Loading**: Imágenes se cargan solo cuando son visibles
- **Paginación**: 12 imágenes por página por defecto
- **Índices DB**: Creados en userId, category, createdAt, likes

## API Endpoints

### Auth
```
POST   /register               - Crear cuenta
POST   /login                  - Iniciar sesión
```

### Imágenes
```
GET    /images?page=1&limit=12&category=wallpaper&search=dark
POST   /upload                 - Subir imagen (auth required)
POST   /images/:id/like        - Like/unlike (auth required)
GET    /my-images?page=1&limit=12
DELETE /images/:id             - Eliminar (auth required, owner only)
```

### Stats
```
GET    /stats                  - Estadísticas globales
```

## Estructura

```
DevImageHub/
├── backend/
│   ├── index.js       (Express + APIs + seguridad)
│   └── db.js          (SQLite init con índices)
├── frontend/
│   ├── index.html     (Login/Registro)
│   ├── dashboard.html (Galería + modales)
│   ├── login.css      (Diseño login hex)
│   ├── login.js       (Auth + hex animation)
│   ├── dashboard.css  (Galería + dark mode)
│   └── dashboard.js   (Lógica galería + paginación)
├── uploads/           (Imágenes comprimidas)
├── database.db        (SQLite)
├── .env
├── package.json
└── README.md
```

## Próximas mejoras (nice-to-have)

- [ ] Socket.io para notificaciones en tiempo real
- [ ] Comentarios en imágenes
- [ ] Compartir en redes sociales
- [ ] Colecciones privadas
- [ ] Editar metadatos
- [ ] Avatar de usuario
- [ ] Seguir usuarios
- [ ] Progressive Web App (offline mode)
- [ ] Búsqueda avanzada con filtros
- [ ] Exportar colección como PDF

## Autor

Jeffer Saúl Soto Marcelo (SENATI)
DevImage Hub v2.1 - 2024
