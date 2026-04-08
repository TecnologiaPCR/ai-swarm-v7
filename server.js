// ═══════════════════════════════════════════════════════════════════════════
// AI SWARM v7 — Production Server
// Auth: JWT + bcrypt | Users: JSON file DB | Audit log | Security headers
// ═══════════════════════════════════════════════════════════════════════════
const http   = require("http");
const fs     = require("fs");
const path   = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt    = require("jsonwebtoken");

const PORT       = process.env.PORT || 8080;
const DIST       = path.join(__dirname, "dist");
const DATA_DIR   = process.env.DATA_DIR || path.join(__dirname, "data");
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString("hex");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const USERS_FILE = path.join(DATA_DIR, "users.json");
const AUDIT_FILE = path.join(DATA_DIR, "audit.log");

const ROLES = {
  admin:    { label:"Administrador", canManageUsers:true,  canRunSwarm:true,  canViewAudit:true  },
  operator: { label:"Operador",      canManageUsers:false, canRunSwarm:true,  canViewAudit:false },
  viewer:   { label:"Viewer",        canManageUsers:false, canRunSwarm:false, canViewAudit:false },
};

// ── User store ────────────────────────────────────────────────────────────
function readUsers()   { try { return JSON.parse(fs.readFileSync(USERS_FILE,"utf8")); } catch { return []; } }
function writeUsers(u) { fs.writeFileSync(USERS_FILE, JSON.stringify(u,null,2)); }
function findUser(email) { return readUsers().find(u => u.email.toLowerCase()===email.toLowerCase()); }

// Seed default admin
(function seed() {
  if (readUsers().length > 0) return;
  const pass  = process.env.ADMIN_PASSWORD || "Admin2024!";
  const email = process.env.ADMIN_EMAIL    || "admin@aiswarm.lab";
  writeUsers([{ id:crypto.randomUUID(), email, name:"Administrador", role:"admin",
    password:bcrypt.hashSync(pass,12), active:true, createdAt:new Date().toISOString(),
    lastLogin:null, loginCount:0 }]);
  console.log("Admin created:", email, "/ pass:", pass);
})();

// ── Audit ─────────────────────────────────────────────────────────────────
function audit(uid,email,action,detail,ip) {
  fs.appendFileSync(AUDIT_FILE, JSON.stringify({ts:new Date().toISOString(),uid,email,action,detail,ip})+"\n");
}
function readAudit(n=300) {
  try {
    return fs.readFileSync(AUDIT_FILE,"utf8").trim().split("\n").filter(Boolean)
      .slice(-n).reverse().map(l=>{try{return JSON.parse(l);}catch{return null;}}).filter(Boolean);
  } catch { return []; }
}

// ── JWT ───────────────────────────────────────────────────────────────────
const sign  = (u, sid) => jwt.sign({id:u.id,email:u.email,role:u.role,name:u.name,sid},JWT_SECRET,{expiresIn:"12h"});
const verify= t  => { try{return jwt.verify(t,JWT_SECRET);}catch{return null;} };
function getToken(req) {
  const a=(req.headers["authorization"]||""); if(a.startsWith("Bearer "))return a.slice(7);
  const c=(req.headers["cookie"]||"").match(/swarm_token=([^;]+)/); return c?c[1]:null;
}
function requireAuth(req,res,perm=null) {
  const p=verify(getToken(req));
  if(!p){res.writeHead(401,{...SEC,"Content-Type":"application/json"});res.end('{"error":"No autorizado"}');return null;}
  const u=findUser(p.email);
  if(!u||!u.active){res.writeHead(401,{...SEC,"Content-Type":"application/json"});res.end('{"error":"No autorizado"}');return null;}
  // ── SINGLE SESSION: reject if token's sid doesn't match active session ──
  if(u.activeSession !== p.sid){
    res.writeHead(401,{...SEC,"Content-Type":"application/json"});
    res.end('{"error":"Sesión expirada — otra sesión fue iniciada"}');
    return null;
  }
  if(perm&&!ROLES[p.role]?.[perm]){res.writeHead(403,{...SEC,"Content-Type":"application/json"});res.end('{"error":"Permisos insuficientes"}');return null;}
  return p;
}

// ── Rate limiter ──────────────────────────────────────────────────────────
const rl=new Map();
function rateOk(ip){
  const now=Date.now(),e=rl.get(ip)||{n:0,r:now+900000};
  if(now>e.r){rl.set(ip,{n:1,r:now+900000});return true;}
  if(e.n>=10)return false; e.n++; rl.set(ip,e); return true;
}

// ── Helpers ───────────────────────────────────────────────────────────────
const MIME={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".svg":"image/svg+xml",".png":"image/png",".ico":"image/x-icon",".json":"application/json",".woff2":"font/woff2"};
const SEC={"X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","Referrer-Policy":"strict-origin-when-cross-origin","X-XSS-Protection":"1; mode=block"};
const j200=(res,d)=>{res.writeHead(200,{...SEC,"Content-Type":"application/json","Cache-Control":"no-store"});res.end(JSON.stringify(d));};
const j400=(res,m)=>{res.writeHead(400,{...SEC,"Content-Type":"application/json"});res.end(JSON.stringify({error:m}));};
const j404=(res)=>{res.writeHead(404,{...SEC,"Content-Type":"application/json"});res.end('{"error":"Not found"}');};
const ip  =(req)=>(req.headers["x-forwarded-for"]||req.socket?.remoteAddress||"").split(",")[0].trim();
function body(req){
  return new Promise((ok,err)=>{let b="";req.on("data",d=>{b+=d;if(b.length>20000)err(new Error("Too large"));});req.on("end",()=>{try{ok(JSON.parse(b));}catch{err(new Error("Invalid JSON"));}});req.on("error",err);});
}

// ══════════════════════════════════════════════════════════════════════════
// HTTP SERVER
// ══════════════════════════════════════════════════════════════════════════
http.createServer(async(req,res)=>{
  const url=req.url.split("?")[0], m=req.method.toUpperCase(), clientIp=ip(req);

  // POST /api/auth/login
  if(url==="/api/auth/login"&&m==="POST"){
    if(!rateOk(clientIp)){res.writeHead(429,{...SEC,"Content-Type":"application/json"});res.end('{"error":"Demasiados intentos. Espera 15 min."}');return;}
    try{
      const{email,password}=await body(req);
      if(!email||!password)return j400(res,"Email y contraseña requeridos");
      const u=findUser(email);
      if(!u||!u.active){audit(null,email,"LOGIN_FAIL","user not found",clientIp);await new Promise(r=>setTimeout(r,400));res.writeHead(401,{...SEC,"Content-Type":"application/json"});res.end('{"error":"Credenciales inválidas"}');return;}
      const ok=await bcrypt.compare(password,u.password);
      if(!ok){audit(u.id,email,"LOGIN_FAIL","wrong password",clientIp);res.writeHead(401,{...SEC,"Content-Type":"application/json"});res.end('{"error":"Credenciales inválidas"}');return;}
      const users=readUsers(),idx=users.findIndex(x=>x.id===u.id);
      const sid=crypto.randomBytes(16).toString("hex");
      users[idx].lastLogin=new Date().toISOString();
      users[idx].loginCount=(users[idx].loginCount||0)+1;
      users[idx].activeSession=sid;
      writeUsers(users);
      const prevSid=u.activeSession;
      audit(u.id,email,"LOGIN_OK","role:"+u.role+(prevSid?"| prev session invalidated":""),clientIp);
      j200(res,{token:sign(u,sid),user:{id:u.id,email:u.email,name:u.name,role:u.role,permissions:ROLES[u.role]}});
    }catch(e){j400(res,e.message);}
    return;
  }

  // POST /api/auth/logout
  if(url==="/api/auth/logout"&&m==="POST"){
    const p=requireAuth(req,res); if(!p)return;
    // Clear active session so token is immediately invalidated
    const usersL=readUsers(),idxL=usersL.findIndex(u=>u.id===p.id);
    if(idxL>=0){usersL[idxL].activeSession=null;writeUsers(usersL);}
    audit(p.id,p.email,"LOGOUT","",clientIp); j200(res,{ok:true}); return;
  }

  // GET /api/auth/me
  if(url==="/api/auth/me"&&m==="GET"){
    const p=requireAuth(req,res); if(!p)return;
    const u=findUser(p.email);
    j200(res,{id:u.id,email:u.email,name:u.name,role:u.role,lastLogin:u.lastLogin,loginCount:u.loginCount||0,permissions:ROLES[u.role]});
    return;
  }

  // POST /api/auth/change-password
  if(url==="/api/auth/change-password"&&m==="POST"){
    const p=requireAuth(req,res); if(!p)return;
    try{
      const{currentPassword,newPassword}=await body(req);
      if(!currentPassword||!newPassword)return j400(res,"Campos requeridos");
      if(newPassword.length<8)return j400(res,"Mínimo 8 caracteres");
      const users=readUsers(),idx=users.findIndex(u=>u.id===p.id);
      if(!(await bcrypt.compare(currentPassword,users[idx].password)))return j400(res,"Contraseña actual incorrecta");
      users[idx].password=await bcrypt.hash(newPassword,12);users[idx].updatedAt=new Date().toISOString();writeUsers(users);
      audit(p.id,p.email,"PASSWORD_CHANGED","",clientIp); j200(res,{ok:true});
    }catch(e){j400(res,e.message);}
    return;
  }

  // GET /api/users
  if(url==="/api/users"&&m==="GET"){
    const p=requireAuth(req,res,"canManageUsers"); if(!p)return;
    j200(res,readUsers().map(u=>({id:u.id,email:u.email,name:u.name,role:u.role,active:u.active,createdAt:u.createdAt,lastLogin:u.lastLogin,loginCount:u.loginCount||0,createdBy:u.createdBy})));
    audit(p.id,p.email,"LIST_USERS","",clientIp); return;
  }

  // POST /api/users
  if(url==="/api/users"&&m==="POST"){
    const p=requireAuth(req,res,"canManageUsers"); if(!p)return;
    try{
      const{email,name,role,password}=await body(req);
      if(!email||!name||!role||!password)return j400(res,"Todos los campos requeridos");
      if(!ROLES[role])return j400(res,"Rol inválido: "+Object.keys(ROLES).join("|"));
      if(password.length<8)return j400(res,"Contraseña mínimo 8 caracteres");
      if(findUser(email))return j400(res,"Email ya registrado");
      const users=readUsers();
      const nu={id:crypto.randomUUID(),email:email.toLowerCase().trim(),name:name.trim(),role,password:await bcrypt.hash(password,12),active:true,createdAt:new Date().toISOString(),createdBy:p.email,lastLogin:null,loginCount:0};
      users.push(nu);writeUsers(users);
      audit(p.id,p.email,"USER_CREATED","email:"+email+" role:"+role,clientIp);
      j200(res,{id:nu.id,email:nu.email,name:nu.name,role:nu.role});
    }catch(e){j400(res,e.message);}
    return;
  }

  // PUT /api/users/:id
  const updMatch=url.match(/^\/api\/users\/([a-f0-9-]+)$/);
  if(updMatch&&m==="PUT"){
    const p=requireAuth(req,res,"canManageUsers"); if(!p)return;
    try{
      const tid=updMatch[1],b=await body(req),users=readUsers(),idx=users.findIndex(u=>u.id===tid);
      if(idx<0)return j404(res);
      if(b.active===false&&tid===p.id)return j400(res,"No puedes desactivarte a ti mismo");
      if(b.role&&b.role!=="admin"&&users[idx].role==="admin"){
        const admins=users.filter(u=>u.role==="admin"&&u.active).length;
        if(admins<=1)return j400(res,"Debe existir al menos un admin activo");
      }
      ["name","role","active"].forEach(k=>{if(b[k]!==undefined)users[idx][k]=b[k];});
      if(b.password){if(b.password.length<8)return j400(res,"Mínimo 8 caracteres");users[idx].password=await bcrypt.hash(b.password,12);}
      users[idx].updatedAt=new Date().toISOString();users[idx].updatedBy=p.email;writeUsers(users);
      audit(p.id,p.email,"USER_UPDATED","target:"+users[idx].email,clientIp);
      j200(res,{ok:true});
    }catch(e){j400(res,e.message);}
    return;
  }

  // POST /api/users/:id/session/revoke — admin force-logout a user
  const revokeMatch=url.match(/^\/api\/users\/([a-f0-9-]+)\/session\/revoke$/);
  if(revokeMatch&&m==="POST"){
    const p=requireAuth(req,res,"canManageUsers"); if(!p)return;
    const tid=revokeMatch[1];
    const users=readUsers(),idx=users.findIndex(u=>u.id===tid);
    if(idx<0)return j404(res);
    const email=users[idx].email;
    users[idx].activeSession=null;
    writeUsers(users);
    audit(p.id,p.email,"SESSION_REVOKED","target:"+email,clientIp);
    j200(res,{ok:true,message:"Sesión revocada para "+email});
    return;
  }

  // POST /api/users/:id/delete
  const delMatch=url.match(/^\/api\/users\/([a-f0-9-]+)\/delete$/);
  if(delMatch&&m==="POST"){
    const p=requireAuth(req,res,"canManageUsers"); if(!p)return;
    const tid=delMatch[1];
    if(tid===p.id)return j400(res,"No puedes eliminarte a ti mismo");
    const users=readUsers(),idx=users.findIndex(u=>u.id===tid);
    if(idx<0)return j404(res);
    const email=users[idx].email; users.splice(idx,1); writeUsers(users);
    audit(p.id,p.email,"USER_DELETED","email:"+email,clientIp);
    j200(res,{ok:true}); return;
  }

  // GET /api/audit
  if(url==="/api/audit"&&m==="GET"){
    const p=requireAuth(req,res,"canViewAudit"); if(!p)return;
    audit(p.id,p.email,"VIEW_AUDIT","",clientIp);
    j200(res,readAudit(500)); return;
  }

  // GET /api/config
  if(url==="/api/config"&&m==="GET"){
    j200(res,{geminiKey:process.env.GEMINI_KEY||""}); return;
  }

  // ── Health check (public — for DO health probe) ──────────────────────────
  if (url==="/health"||url==="/api/health") {
    res.writeHead(200,{"Content-Type":"application/json",...SEC});
    res.end(JSON.stringify({ok:true,ts:new Date().toISOString()}));
    return;
  }

  // ── Static files ─────────────────────────────────────────────────────────
  const isAsset=url.startsWith("/assets/")||url==="/favicon.svg";
  if(!isAsset){
    const tok=getToken(req);
    const payload=tok?verify(tok):null;
    // Validate sid against DB (single session enforcement)
    const staticUser=payload?findUser(payload.email):null;
    const validSession=staticUser&&staticUser.active&&staticUser.activeSession===payload?.sid;
    if(!payload||!validSession){
      const html=(req.headers["accept"]||"").includes("text/html");
      if(html){res.writeHead(302,{"Location":"/"});res.end();}
      else{res.writeHead(401,{...SEC,"Content-Type":"application/json"});res.end('{"error":"No autorizado"}');}
      return;
    }
  }

  let fp=path.join(DIST,url);
  if(!fp.startsWith(DIST)){res.writeHead(403);res.end();return;}
  if(!fs.existsSync(fp)||fs.statSync(fp).isDirectory()) fp=path.join(DIST,"index.html");
  const ext=path.extname(fp).toLowerCase();
  fs.readFile(fp,(err,data)=>{
    if(err){res.writeHead(404);res.end("Not found");return;}
    res.writeHead(200,{"Content-Type":MIME[ext]||"application/octet-stream","Cache-Control":isAsset?"public, max-age=31536000, immutable":"no-cache, no-store, must-revalidate",...SEC});
    res.end(data);
  });

}).listen(PORT,"0.0.0.0",()=>{
  console.log(`AI Swarm v7 ✅ :${PORT}`);
  console.log(`Auth enabled | Data: ${DATA_DIR}`);
});
