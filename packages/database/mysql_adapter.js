import mysql from 'mysql2/promise';
import { DatabaseSync } from 'node:sqlite';
import { hashPassword } from '../security/index.js';
import dotenv from 'dotenv';
dotenv.config();

let mysqlPool = null;
let sqliteDb = null;

export function getDbMode() {
  return process.env.DB_ENGINE || 'mysql';
}

export async function getMysqlPool() {
  if (mysqlPool) return mysqlPool;
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USERNAME || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_DATABASE || 'pdhsafetyfire';

  // Ensure DB exists
  try {
    const sysConn = await mysql.createConnection({ host, port, user, password });
    await sysConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await sysConn.end();
  } catch (err) {
    console.warn('MySQL root DB creation check warning:', err.message);
  }

  mysqlPool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 0,
    charset: 'utf8mb4'
  });

  return mysqlPool;
}

export async function executeQuery(sql, params = []) {
  if (getDbMode() === 'sqlite') {
    if (!sqliteDb) sqliteDb = new DatabaseSync(':memory:');
    // Convert MySQL ? params if needed
    const stmt = sqliteDb.prepare(sql);
    if (sql.trim().toUpperCase().startsWith('SELECT') || sql.trim().toUpperCase().startsWith('SHOW')) {
      return stmt.all(...params);
    }
    const info = stmt.run(...params);
    return { insertId: info.lastInsertRowid, affectedRows: info.changes };
  }

  const pool = await getMysqlPool();
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export async function executeTransaction(callback) {
  if (getDbMode() === 'sqlite') {
    if (!sqliteDb) sqliteDb = new DatabaseSync(':memory:');
    sqliteDb.exec('BEGIN');
    try {
      const res = await callback({
        query: async (sql, params = []) => {
          const stmt = sqliteDb.prepare(sql);
          if (sql.trim().toUpperCase().startsWith('SELECT')) return stmt.all(...params);
          const info = stmt.run(...params);
          return { insertId: info.lastInsertRowid, affectedRows: info.changes };
        }
      });
      sqliteDb.exec('COMMIT');
      return res;
    } catch (e) {
      sqliteDb.exec('ROLLBACK');
      throw e;
    }
  }

  const pool = await getMysqlPool();
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  try {
    const txHelper = {
      query: async (sql, params = []) => {
        const [rows] = await connection.execute(sql, params);
        return rows;
      }
    };
    const res = await callback(txHelper);
    await connection.commit();
    return res;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}
