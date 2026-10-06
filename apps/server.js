import http from 'node:http';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {mkdirSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createDatabase,seed} from '../packages/database/index.js';
import {verifyPassword,redact} from '../packages/security/index.js';
import {can,roles} from '../packages/rbac/index.js';

export function createApp(db,{mode='sandbox'}={}) {
 if(!['sandbox','demo','development'].includes(mode))throw Error('This alpha supports isolated local environments only');
 const limits=new Map();
 const digest=token=>createHash('sha256').update(token).digest('hex');
 const atomic=run=>{db.exec('BEGIN');try{const result=run();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}};
 return http.createServer(async(req,res)=>{
 const requestId=randomUUID();res.setHeader('X-Request-ID',requestId);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");res.setHeader('Cache-Control','no-store');
 const reply=(status,data,error)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(error?{success:false,error:{code:error,message:data}}:{success:true,data,meta:{request_id:requestId,mode}}));};
 const fail=(status,message)=>{const e=new Error(message);e.status=status;throw e;};
 try {
 const hostname=(req.headers.host||'').split(':')[0];if(!['localhost','127.0.0.1'].includes(hostname))fail(403,'Local host required');
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/health')return reply(200,{status:'ok',version:'2.0.0-alpha.1'});
 if(!url.pathname.startsWith('/api/')) {if(req.method!=='GET')return reply(405,'Method not allowed','METHOD_NOT_ALLOWED');const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css'};const file=files[url.pathname];if(!file)return reply(404,'Not found','NOT_FOUND');res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html; charset=utf-8');return res.end(readFileSync(fileURLToPath(new URL(`./public/${file}`,import.meta.url))));}
 const now=Date.now();const ip=req.socket.remoteAddress;for(const [key,value] of limits)if(value.until<now)limits.delete(key);let bucket=limits.get(ip);if(!bucket){bucket={count:0,until:now+60000};limits.set(ip,bucket);}if(++bucket.count>120)return reply(429,'Too many requests','RATE_LIMITED');
 if(['POST','PATCH','DELETE'].includes(req.method)) {if(req.headers['sec-fetch-site']==='cross-site')fail(403,'Cross-site request blocked');if(req.headers.origin!==`http://${req.headers.host}`)fail(403,'Origin rejected');if(!req.headers['content-type']?.startsWith('application/json'))fail(415,'JSON required');}
 let body={};if(['POST','PATCH'].includes(req.method)){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>16384)fail(413,'Request too large');}try{body=JSON.parse(raw||'{}');}catch{fail(400,'Invalid JSON');}if(!body||typeof body!=='object'||Array.isArray(body))fail(422,'Invalid body');}
 const token=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('tv_session='))?.slice(11);
 const user=token&&db.prepare('SELECT u.id,u.name,u.email,u.disabled,s.tenant_id,m.role FROM sessions s JOIN users u ON u.id=s.user_id JOIN memberships m ON m.user_id=u.id AND m.tenant_id=s.tenant_id WHERE s.token=? AND s.expires_at>?').get(digest(token),now);
 const audit=(action,resource,id,oldValue,newValue,actor=user)=>db.prepare('INSERT INTO audit_logs(tenant_id,actor,action,resource,resource_id,old_value,new_value,ip,user_agent,request_id) VALUES(?,?,?,?,?,?,?,?,?,?)').run(actor?.tenant_id||'demo',actor?.id||'anonymous',action,resource,String(id||''),JSON.stringify(redact(oldValue??null)),JSON.stringify(redact(newValue??null)),ip,req.headers['user-agent']||'',requestId);
 if(url.pathname==='/api/v1/login'&&req.method==='POST') {
 if(bucket.count>20)fail(429,'Login rate limit reached');if(typeof body.email!=='string'||typeof body.password!=='string'||body.password.length>256)fail(422,'Invalid credentials');
 const account=db.prepare('SELECT * FROM users WHERE email=?').get(body.email);if(!account||account.disabled||!verifyPassword(body.password,account.password)){audit('login.failed','session','',null,null);fail(401,'Email or password incorrect');}
 const member=db.prepare('SELECT * FROM memberships WHERE user_id=? ORDER BY tenant_id LIMIT 1').get(account.id);if(!member)fail(403,'No workspace membership');const session=randomBytes(32).toString('hex');atomic(()=>{db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(digest(session),account.id,member.tenant_id,now+8*3600000);audit('login.success','session','',null,null,{id:account.id,tenant_id:member.tenant_id});});res.setHeader('Set-Cookie',`tv_session=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`);return reply(200,{name:account.name});}
 if(!user||user.disabled)fail(401,'Please sign in');
 const requirePermission=p=>{if(!can(user.role,p))fail(403,'Permission denied');};
 if(url.pathname==='/api/v1/me'&&req.method==='GET')return reply(200,{...user,roles,mode,workspace:db.prepare('SELECT name FROM tenants WHERE id=?').get(user.tenant_id).name});
 if(url.pathname==='/api/v1/logout'&&req.method==='POST'){atomic(()=>{db.prepare('DELETE FROM sessions WHERE token=?').run(digest(token));audit('logout','session','',null,null);});res.setHeader('Set-Cookie','tv_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return reply(200,{});}
 if(url.pathname==='/api/v1/feedback'&&req.method==='GET'){requirePermission('feedback.view');const q=(url.searchParams.get('q')||'').slice(0,200);return reply(200,db.prepare('SELECT id,subject,category,status,priority,created_at FROM feedback WHERE tenant_id=? AND subject LIKE ? ORDER BY id DESC LIMIT 100').all(user.tenant_id,`%${q}%`));}
 if(url.pathname==='/api/v1/feedback'&&req.method==='POST'){requirePermission('feedback.manage');if(typeof body.subject!=='string'||!body.subject.trim()||body.subject.length>200||!['Service','Suggestion','Appreciation','Technical'].includes(body.category)||!['low','medium','high'].includes(body.priority))fail(422,'Invalid feedback');const result=atomic(()=>{const row=db.prepare('INSERT INTO feedback(tenant_id,subject,category,status,priority) VALUES(?,?,?,?,?)').run(user.tenant_id,body.subject.trim(),body.category,'open',body.priority);audit('feedback.created','feedback',row.lastInsertRowid,null,{subject:body.subject.trim(),category:body.category,priority:body.priority});return row;});return reply(201,{id:Number(result.lastInsertRowid)});}
 const match=url.pathname.match(/^\/api\/v1\/feedback\/(\d+)$/);if(match&&req.method==='PATCH'){requirePermission('feedback.manage');if(!['open','in_progress','resolved'].includes(body.status))fail(422,'Invalid status');const old=db.prepare('SELECT * FROM feedback WHERE id=? AND tenant_id=?').get(match[1],user.tenant_id);if(!old)fail(404,'Feedback not found');atomic(()=>{db.prepare('UPDATE feedback SET status=? WHERE id=? AND tenant_id=?').run(body.status,match[1],user.tenant_id);audit('feedback.updated','feedback',match[1],old,{status:body.status});});return reply(200,{});}
 if(url.pathname==='/api/v1/users'&&req.method==='GET'){requirePermission('users.view');return reply(200,db.prepare('SELECT u.name,u.email,m.role,u.disabled FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.tenant_id=?').all(user.tenant_id));}
 if(url.pathname==='/api/v1/audit'&&req.method==='GET'){requirePermission('audit.view');return reply(200,db.prepare('SELECT actor,action,resource,timestamp,request_id FROM audit_logs WHERE tenant_id=? ORDER BY id DESC LIMIT 100').all(user.tenant_id));}
 if(url.pathname==='/api/v1/sandbox/reset'&&req.method==='POST'){requirePermission('sandbox.reset');if(body.confirm!=='RESET')fail(422,'Confirmation required');db.exec('BEGIN');try{db.prepare('DELETE FROM feedback WHERE tenant_id=?').run(user.tenant_id);seed(db,user.tenant_id);audit('sandbox.reset','tenant',user.tenant_id,null,{synthetic:true});db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return reply(200,{});}
 return reply(404,'Not found','NOT_FOUND');
 }catch(e){reply(e.status||500,e.status?e.message:'Internal server error',`HTTP_${e.status||500}`);}
 });
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {const password=process.env.TOMVIS_DEMO_PASSWORD;if(!password||password.length<12)throw Error('Set TOMVIS_DEMO_PASSWORD to at least 12 characters');const mode=process.env.TOMVIS_MODE||'sandbox';if(!['sandbox','demo','development'].includes(mode))throw Error('Production/staging unsupported in this alpha');mkdirSync('data',{recursive:true});const db=createDatabase(`data/${mode}.sqlite`,password);createApp(db,{mode}).listen(Number(process.env.PORT||3000),'127.0.0.1',()=>console.log(`Tomvis ${mode}: http://localhost:${process.env.PORT||3000}`));}
