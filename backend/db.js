const sqlite3 = require('sqlite3').verbose();
const path    = require('path');

const db = new sqlite3.Database(path.join(__dirname, '../database.db'));

db.serialize(() => {

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT    UNIQUE NOT NULL,
      email      TEXT    UNIQUE NOT NULL,
      password   TEXT    NOT NULL,
      createdAt  DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS images (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      userId     INTEGER NOT NULL,
      imageUrl   TEXT    NOT NULL,
      title      TEXT    NOT NULL,
      category   TEXT    DEFAULT 'wallpaper',
      tags       TEXT    DEFAULT '',
      likes      INTEGER DEFAULT 0,
      createdAt  DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_images_userId ON images(userId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_images_category ON images(category)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_images_createdAt ON images(createdAt DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_images_likes ON images(likes DESC)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS likes (
      userId   INTEGER NOT NULL,
      imageId  INTEGER NOT NULL,
      PRIMARY KEY (userId, imageId),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (imageId) REFERENCES images(id) ON DELETE CASCADE
    )
  `);

});

module.exports = db;
