import {DatabaseSync} from 'node:sqlite';
import {hashPassword} from '../security/index.js';
export function createDatabase(path,password) {
 const db=new DatabaseSync(path);db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY);
 CREATE TABLE IF NOT EXISTS tenants(id TEXT PRIMARY KEY,name TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,disabled INTEGER DEFAULT 0);
 CREATE TABLE IF NOT EXISTS memberships(user_id TEXT REFERENCES users(id),tenant_id TEXT REFERENCES tenants(id),role TEXT NOT NULL,PRIMARY KEY(user_id,tenant_id));
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),tenant_id TEXT REFERENCES tenants(id),expires_at INTEGER);
 CREATE TABLE IF NOT EXISTS feedback(id INTEGER PRIMARY KEY AUTOINCREMENT,tenant_id TEXT REFERENCES tenants(id),subject TEXT,category TEXT,status TEXT,priority TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS audit_logs(id INTEGER PRIMARY KEY,tenant_id TEXT,actor TEXT,action TEXT,resource TEXT,resource_id TEXT,old_value TEXT,new_value TEXT,ip TEXT,user_agent TEXT,request_id TEXT,timestamp TEXT DEFAULT CURRENT_TIMESTAMP);
 INSERT OR IGNORE INTO migrations VALUES(1);`);
 if(!db.prepare('SELECT id FROM tenants LIMIT 1').get()) {
 db.exec('BEGIN');try {for(const [id,name] of [['demo','Tomvis Demo Workspace'],['other','Isolation Test Workspace']]) db.prepare('INSERT INTO tenants VALUES(?,?)').run(id,name);
 for(const [id,name,email,role] of [['admin','Demo Administrator','admin@tomvis.demo','admin'],['staff','Demo Staff','staff@tomvis.demo','staff'],['viewer','Demo Viewer','viewer@tomvis.demo','viewer']]) {db.prepare('INSERT INTO users(id,email,name,password) VALUES(?,?,?,?)').run(id,email,name,hashPassword(password));db.prepare('INSERT INTO memberships VALUES(?,?,?)').run(id,'demo',role);}
 seed(db,'demo');seed(db,'other');db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}
 return db;
}
export function seed(db,tenant) {for(const [subject,category,status,priority] of [['ปรับปรุงขั้นตอนการให้บริการ','Service','open','high'],['เพิ่มช่องทางติดต่อออนไลน์','Suggestion','in_progress','medium'],['ขอบคุณทีมงานสำหรับการดูแล','Appreciation','resolved','low'],['แจ้งปัญหาการเข้าสู่ระบบ','Technical','open','high'],['เสนอเพิ่มรายงานสรุปรายเดือน','Suggestion','in_progress','medium'],['ประสบการณ์ใช้งานที่ยอดเยี่ยม','Appreciation','resolved','low']])db.prepare('INSERT INTO feedback(tenant_id,subject,category,status,priority) VALUES(?,?,?,?,?)').run(tenant,subject,category,status,priority);}
