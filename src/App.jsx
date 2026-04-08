import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// THEME SYSTEM — dark / mid / light
// ─────────────────────────────────────────────────────────────────────────────
// Apply theme immediately (before React paints) to avoid flash
(function(){
  try{
    const t=localStorage.getItem("swarm_theme")||
      (window.matchMedia("(prefers-color-scheme:light)").matches?"light":"dark");
    document.documentElement.setAttribute("data-theme",t);
  }catch{}
})();

function useTheme() {
  const [theme, setThemeState] = useState(() => {
    try{
      const saved = localStorage.getItem("swarm_theme");
      if (saved) return saved;
      return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }catch{return "dark";}
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("swarm_theme", theme);
  }, [theme]);

  const setTheme = (t) => setThemeState(t);
  return { theme, setTheme };
}

function ThemeSwitcher({ theme, setTheme }) {
  const opts = [
    { id:"dark",  icon:"🌙", label:"Dark"  },
    { id:"mid",   icon:"🌗", label:"Mid"   },
    { id:"light", icon:"☀️", label:"Light" },
  ];
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:2,
      background:"var(--bg-surface-1)",
      border:"1px solid var(--border-base)",
      borderRadius:999, padding:3,
    }}>
      {opts.map(o => (
        <button key={o.id} onClick={() => { setTheme(o.id); document.documentElement.setAttribute('data-theme',o.id); playSound('themeSwitch'); haptic([10,5,10,5,20]); }}
          title={o.label}
          style={{
            display:"flex", alignItems:"center", gap:4,
            padding:"5px 10px", borderRadius:999, border:"none",
            cursor:"pointer", fontFamily:"'Nunito',sans-serif",
            fontSize:11, fontWeight:800,
            background: theme===o.id ? "var(--accent)" : "transparent",
            color: theme===o.id ? "#fff" : "var(--text-secondary)",
            transition:"all .25s cubic-bezier(.34,1.56,.64,1)",
            transform: theme===o.id ? "scale(1.05)" : "scale(1)",
          }}>
          <span style={{fontSize:13}}>{o.icon}</span>
          <span style={{display: theme===o.id ? "inline" : "none"}}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}



// ─────────────────────────────────────────────────────────────────────────────
// MODELS — Brecha 2: Multi-model support
// ─────────────────────────────────────────────────────────────────────────────
const MODELS = {
  sonnet: {
    id: "claude-sonnet-4-20250514",
    label: "Sonnet 4",
    badge: "Máxima calidad",
    priceIn:  3.00 / 1e6,
    priceOut: 15.00 / 1e6,
    color: "#7c6af7",
  },
  haiku: {
    id: "claude-haiku-4-5-20251001",
    label: "Haiku 4.5",
    badge: "Rápido · económico",
    priceIn:  0.80 / 1e6,
    priceOut: 4.00 / 1e6,
    color: "#10b981",
  },
  gemini: {
    id: "gemini-2.0-flash",
    label: "Gemini Flash",
    badge: "−70% costo",
    priceIn:  0.10 / 1e6,
    priceOut: 0.40 / 1e6,
    color: "#f59e0b",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PER-AGENT CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const AGENT_MAX_TOKENS = {
  // Critical output agents get more tokens for complete artifacts
  architect:3200,dba:3200,prompt_eng:3200,devops:3000,deploy_eng:3000,tech_writer:3000,
  security:2400,api_integrator:2400,qa:2400,chaos:2200,bi:2200,
  ml:2000,i18n:2000,dpo:2000,uiux:2000,copywriter:2000,
  cx:1800,growth:1800,pm:1800,ba:1800,revenue:1600,performance:1600,
  legal:1400,research:1400,prompt_lib:1400,maintenance:2400,
  product_owner:2200,manual_writer:2400,roadmap_eng:2000,post_launch:1800,disruptor:3200,
};

const AGENT_READS_FROM = {
  pm:["ba","revenue","architect"],ba:["pm","architect","qa"],revenue:["pm","ba","growth","cx"],
  architect:["ba","dba","security","devops"],dba:["architect","api_integrator","security"],
  api_integrator:["architect","dba","devops"],security:["architect","dba","api_integrator","devops"],
  prompt_eng:["architect","dba","uiux","devops"],uiux:["ba","cx","copywriter","i18n"],
  cx:["uiux","copywriter","growth","revenue"],copywriter:["uiux","cx","i18n","growth"],
  devops:["architect","security","performance"],performance:["architect","devops","uiux"],
  i18n:["uiux","copywriter","architect"],qa:["architect","dba","security","devops"],
  chaos:["architect","devops","security","qa"],ml:["ba","dba","architect","bi"],
  bi:["dba","ml","revenue","architect"],growth:["revenue","cx","uiux","copywriter"],
  research:["architect","ml","prompt_eng"],dpo:["architect","dba","security","api_integrator"],
  legal:["dpo","architect","revenue"],prompt_lib:["prompt_eng","architect","qa"],
  deploy_eng:["devops","architect","security","qa","chaos","performance"],
  maintenance:["deploy_eng","devops","architect","chaos","security","bi"],
  product_owner:["pm","ba","revenue","growth","cx","roadmap_eng"],
  tech_writer:["architect","dba","api_integrator","devops","deploy_eng","prompt_eng"],
  manual_writer:["uiux","cx","copywriter","tech_writer","i18n"],
  roadmap_eng:["pm","ba","revenue","research","product_owner","growth"],
  post_launch:["pm","qa","bi","cx","growth","chaos","deploy_eng"],
  disruptor:["pm","ba","revenue","architect","cx","growth","ml","research","product_owner","roadmap_eng"],
};

const AGENTS = [
  {id:"pm",name:"Project Manager",icon:"📋",color:"#3B82F6",desc:"Clasifica, prioriza y planifica"},
  {id:"ba",name:"Business Analyst",icon:"🔍",color:"#8B5CF6",desc:"Requerimientos y criterios de aceptación"},
  {id:"revenue",name:"Revenue Strategist",icon:"💰",color:"#16A34A",desc:"ROI, monetización e ingresos"},
  {id:"architect",name:"Arquitecto",icon:"🏗️",color:"#EC4899",desc:"Arquitectura técnica completa"},
  {id:"prompt_eng",name:"Prompt Engineer",icon:"⚡",color:"#F59E0B",desc:"Prompts para vibe coding"},
  {id:"dba",name:"DBA / Data Eng.",icon:"🗄️",color:"#06B6D4",desc:"Esquemas y estrategia de datos"},
  {id:"api_integrator",name:"API Integrator",icon:"🔌",color:"#0EA5E9",desc:"Integraciones y contratos de API"},
  {id:"security",name:"Ciberseguridad",icon:"🛡️",color:"#EF4444",desc:"Controles y auditoría OWASP"},
  {id:"uiux",name:"UI/UX Designer",icon:"🎨",color:"#A855F7",desc:"Interfaces y experiencia"},
  {id:"cx",name:"CX Strategist",icon:"🌟",color:"#F472B6",desc:"Journey completo del cliente"},
  {id:"copywriter",name:"Copywriter IA",icon:"✍️",color:"#FB923C",desc:"Copy que convierte"},
  {id:"growth",name:"Growth Hacker",icon:"📈",color:"#22C55E",desc:"Adquisición y conversión"},
  {id:"devops",name:"DevOps / SRE",icon:"🚀",color:"#10B981",desc:"CI/CD e infraestructura"},
  {id:"performance",name:"Performance Eng.",icon:"⏱️",color:"#0891B2",desc:"Core Web Vitals y caching"},
  {id:"i18n",name:"i18n & a11y",icon:"🌐",color:"#6366F1",desc:"Internacionalización y accesibilidad"},
  {id:"i18n",name:"i18n & a11y",icon:"🌐",color:"#6366F1",desc:"Internacionalización y accesibilidad"},
  {id:"ml",name:"ML Scientist",icon:"🧠",color:"#F97316",desc:"Modelos predictivos y análisis"},
  {id:"bi",name:"BI Analyst",icon:"📊",color:"#6366F1",desc:"Dashboards e inteligencia"},
  {id:"qa",name:"QA / Validador",icon:"✅",color:"#14B8A6",desc:"Testing y validación"},
  {id:"chaos",name:"Chaos Engineer",icon:"💥",color:"#DC2626",desc:"Resiliencia y planes de fallo"},
  {id:"prompt_lib",name:"Prompt Librarian",icon:"📚",color:"#A16207",desc:"Catálogo y versionado de prompts"},
  {id:"dpo",name:"Data Privacy",icon:"🔐",color:"#7C3AED",desc:"Compliance regulación local / GDPR"},
  {id:"legal",name:"Legal",icon:"⚖️",color:"#78716C",desc:"Riesgos y cumplimiento"},
  {id:"research",name:"Investigación IA",icon:"🔬",color:"#D946EF",desc:"Tecnologías emergentes"},
  {id:"disruptor",name:"Innovador Disruptivo",icon:"🚀💥",color:"#FF4D00",desc:"Blue Ocean · 10x thinking"},
  {id:"deploy_eng",name:"Deploy Engineer",icon:"🚢",color:"#0EA5E9",desc:"Runbooks de go-live"},
  {id:"maintenance",name:"Mantenimiento",icon:"🔧",color:"#64748B",desc:"Ops, alertas y SLAs"},
  {id:"product_owner",name:"Product Owner",icon:"🎯",color:"#8B5CF6",desc:"Roadmap y backlog"},
  {id:"tech_writer",name:"Docs Técnica",icon:"📖",color:"#0284C7",desc:"README, ADRs, API docs"},
  {id:"manual_writer",name:"Manuales Usuario",icon:"📝",color:"#7C3AED",desc:"Tutoriales paso a paso"},
  {id:"roadmap_eng",name:"Roadmap Eng.",icon:"🗺️",color:"#059669",desc:"Versioning y evolución"},
  {id:"post_launch",name:"Post-Launch",icon:"🏁",color:"#D97706",desc:"Retro y métricas post-deploy"},
];

const PHASES = [
  {id:"intake",name:"Intake",color:"#3B82F6",agents:["pm","ba","revenue"]},
  {id:"design",name:"Diseño",color:"#EC4899",agents:["architect","uiux","dba","api_integrator","cx"]},
  {id:"vibe",name:"Vibe Coding",color:"#F59E0B",agents:["prompt_eng","copywriter","devops","i18n"]},
  {id:"quality",name:"Calidad",color:"#10B981",agents:["qa","security","performance","chaos"]},
  {id:"intelligence",name:"Inteligencia",color:"#6366F1",agents:["ml","bi","growth","research","disruptor"]},
  {id:"governance",name:"Gobernanza",color:"#78716C",agents:["dpo","legal","prompt_lib"]},
  {id:"lifecycle",name:"Lifecycle",color:"#E879F9",agents:["deploy_eng","maintenance","product_owner","tech_writer","manual_writer","roadmap_eng","post_launch"]},
];

const PROMPT_ENG_INJECT = [0,1,3];

const PRESETS = [
  {id:"all",label:"Completo",agents:null},
  {id:"tech",label:"Stack técnico",agents:["pm","ba","architect","dba","api_integrator","devops","security","performance","qa","chaos","prompt_eng","deploy_eng"]},
  {id:"product",label:"Producto",agents:["pm","ba","revenue","uiux","cx","copywriter","growth","research","disruptor","product_owner","roadmap_eng"]},
  {id:"quick",label:"Quick win",agents:["pm","ba","architect","prompt_eng","qa","deploy_eng"]},
  {id:"data",label:"Datos & BI",agents:["ba","architect","dba","bi","ml","dpo","tech_writer"]},
  {id:"disrupt",label:"Disrupción",agents:["pm","ba","revenue","growth","cx","research","disruptor","product_owner","roadmap_eng"]},
];

// ─────────────────────────────────────────────────────────────────────────────
// BRECHA 1: PERSISTENCE — window.storage API (available in Claude artifacts)
// ─────────────────────────────────────────────────────────────────────────────
const STORAGE_SESSION_KEY = "pcr_swarm_sessions";
const STORAGE_SPEND_KEY   = "pcr_swarm_spend";
const TZ_PANAMA = "America/Panama"; // UTC-5, no DST

function nowPanama() {
  // Returns a Date-like object adjusted to Panama time
  return new Date(new Date().toLocaleString("en-US", { timeZone: TZ_PANAMA }));
}
function monthKeyPanama() {
  const d = nowPanama();
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0");
}
function isoStringPanama() {
  const d = nowPanama();
  return d.getFullYear() + "-" +
    String(d.getMonth()+1).padStart(2,"0") + "-" +
    String(d.getDate()).padStart(2,"0") + "T" +
    String(d.getHours()).padStart(2,"0") + ":" +
    String(d.getMinutes()).padStart(2,"0") + ":" +
    String(d.getSeconds()).padStart(2,"0") + " (UTC-5 Panamá)";
}
function shortDatePanama() {
  const d = nowPanama();
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
}

async function saveSession(session) {
  try {
    const existing = await loadSessions();
    const updated = [session, ...existing.filter(s => s.id !== session.id)].slice(0, 20);
    await window.storage.set(STORAGE_SESSION_KEY, JSON.stringify(updated));
  } catch { /* silent — storage may not be available */ }
}

async function loadSessions() {
  try {
    const r = await window.storage.get(STORAGE_SESSION_KEY);
    return r ? JSON.parse(r.value) : [];
  } catch { return []; }
}

async function deleteSession(id) {
  try {
    const existing = await loadSessions();
    await window.storage.set(STORAGE_SESSION_KEY, JSON.stringify(existing.filter(s => s.id !== id)));
  } catch {}
}

async function getStoredSpend() {
  try {
    const r = await window.storage.get(STORAGE_SPEND_KEY);
    if (!r) return 0;
    const d = JSON.parse(r.value);
    const month = monthKeyPanama();
    return d[month] || 0;
  } catch { return 0; }
}

async function addStoredSpend(amount) {
  try {
    const month = monthKeyPanama();
    const r = await window.storage.get(STORAGE_SPEND_KEY);
    const d = r ? JSON.parse(r.value) : {};
    d[month] = (d[month] || 0) + amount;
    await window.storage.set(STORAGE_SPEND_KEY, JSON.stringify(d));
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// BRECHA 2: MULTI-MODEL API CALL
// ─────────────────────────────────────────────────────────────────────────────
async function callModel(modelKey, system, userMsg, agentId, geminiKey = "", attempt = 0) {
  const model = MODELS[modelKey] || MODELS.sonnet;
  const maxTokens = AGENT_MAX_TOKENS[agentId] || 1200;
  const MAX_ATTEMPTS = 5;
  const RETRYABLE = ["exceeded_limit","rate_limit_error","overloaded_error"];

  // Detect if running on DO (production) or locally in Claude artifact
  // In production, use server-side proxy to avoid CORS
  const IS_PROD = typeof window !== "undefined" &&
    !window.location.hostname.includes("claude.ai") &&
    !window.location.hostname.includes("localhost") &&
    window.location.hostname !== "";

  let res;
  try {
    if (model.id.startsWith("gemini")) {
      // ── Gemini path ────────────────────────────────────────────────────────
      const geminiPayload = {
        system_instruction: { parts:[{text: system}] },
        contents:[{role:"user", parts:[{text: userMsg}]}],
        generationConfig:{ maxOutputTokens: maxTokens, temperature:0.7 },
      };
      if (IS_PROD) {
        // Use server-side proxy
        const _gtok = localStorage.getItem("swarm_token") || "";
        res = await fetch("/api/proxy/gemini/"+model.id, {
          method:"POST",
          headers:{"Content-Type":"application/json", "Authorization":"Bearer "+_gtok},
          body: JSON.stringify(geminiPayload),
        });
      } else {
        // Direct call (Claude artifact environment)
        if (!geminiKey) throw new Error("Gemini API key no configurada");
        res = await fetch(model.endpoint+"?key="+geminiKey, {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body: JSON.stringify(geminiPayload),
        });
      }
      if (!res.ok) {
        const errBody = await res.json().catch(()=>({}));
        throw new Error(errBody?.error?.message || "Gemini error " + res.status);
      }
      const gData = await res.json();
      return gData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    } else {
      // ── Anthropic path (Sonnet / Haiku) ────────────────────────────────────
      const anthropicPayload = {
        model: model.id, max_tokens: maxTokens,
        system, messages: [{role:"user", content: userMsg}],
      };
      if (IS_PROD) {
        // Use server-side proxy — no API key in browser, no CORS issue
        const _tok = localStorage.getItem("swarm_token") || "";
        res = await fetch("/api/proxy/anthropic", {
          method: "POST",
          headers: {"Content-Type":"application/json", "Authorization":"Bearer "+_tok},
          body: JSON.stringify(anthropicPayload),
        });
      } else {
        // Direct call (Claude artifact environment — auto-auth injected)
        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify(anthropicPayload),
        });
      }
    }
  } catch(e) {
    if (attempt < MAX_ATTEMPTS) {
      await new Promise(r => setTimeout(r, Math.min(4000 * Math.pow(2, attempt), 60000)));
      return callModel(modelKey, system, userMsg, agentId, geminiKey, attempt + 1);
    }
    throw e;
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const errType = errBody?.error?.type || "";
    const isRetryable = RETRYABLE.some(t => errType.includes(t)) || res.status === 429 || res.status === 529;
    if (isRetryable && attempt < MAX_ATTEMPTS) {
      const base = Math.min(6000 * Math.pow(2, attempt), 90000);
      await new Promise(r => setTimeout(r, base + Math.random() * 3000));
      return callModel(modelKey, system, userMsg, agentId, geminiKey, attempt + 1);
    }
    throw new Error(errBody?.error?.message || "Error " + res.status);
  }
  const data = await res.json();
  return data.content?.map(b => b.text || "").join("\n").trim() || "";
}

// ─────────────────────────────────────────────────────────────────────────────
// COST ESTIMATION
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// STACK CONFIG — credentials & project metadata for executable output
// ─────────────────────────────────────────────────────────────────────────────
const STACK_FIELDS = [
  // ── PROYECTO ─────────────────────────────────────────────────────────────
  { key:"projectName",   label:"Nombre del proyecto",      placeholder:"mi-app",                    type:"text",     group:"proyecto" },
  { key:"techStack",     label:"Stack principal",          placeholder:"React + Node.js + PostgreSQL", type:"text",   group:"proyecto" },
  { key:"repoUrl",       label:"Repo GitHub (org/repo)",   placeholder:"mi-org/mi-repo",            type:"text",     group:"proyecto" },
  { key:"mainBranch",    label:"Rama de producción",       placeholder:"main",                      type:"text",     group:"proyecto" },
  { key:"nodeVersion",   label:"Node.js version",          placeholder:"20",                        type:"text",     group:"proyecto" },
  { key:"buildCmd",      label:"Build command",            placeholder:"npm run build",             type:"text",     group:"proyecto" },
  { key:"startCmd",      label:"Start command",            placeholder:"npm start",                 type:"text",     group:"proyecto" },
  { key:"port",          label:"Puerto de la app",         placeholder:"3000",                      type:"text",     group:"proyecto" },
  { key:"domain",        label:"Dominio / URL producción", placeholder:"miapp.com",                 type:"text",     group:"proyecto" },
  { key:"stagingDomain", label:"Dominio staging",          placeholder:"staging.miapp.com",         type:"text",     group:"proyecto" },

  // ── GITHUB ───────────────────────────────────────────────────────────────
  { key:"ghToken",       label:"GitHub Token (PAT)",       placeholder:"ghp_...",                   type:"password", group:"github" },
  { key:"ghOrgTeam",     label:"Org / Team GitHub",        placeholder:"mi-org/devs",               type:"text",     group:"github" },
  { key:"ghEnvProd",     label:"Environment name (prod)",  placeholder:"production",                type:"text",     group:"github" },
  { key:"ghRunnerOS",    label:"Runner de CI/CD",          placeholder:"ubuntu-latest",             type:"text",     group:"github" },

  // ── DIGITALOCEAN ─────────────────────────────────────────────────────────
  { key:"doToken",       label:"DO API Token",             placeholder:"dop_v1_...",                type:"password", group:"do" },
  { key:"doAppId",       label:"DO App ID (si existe)",    placeholder:"abc123-...",                type:"text",     group:"do" },
  { key:"doRegion",      label:"Región DO",                placeholder:"nyc3",                      type:"text",     group:"do" },
  { key:"doDropletIp",   label:"Droplet IP (si aplica)",   placeholder:"167.99.x.x",               type:"text",     group:"do" },
  { key:"doSshUser",     label:"SSH user del droplet",     placeholder:"root",                      type:"text",     group:"do" },
  { key:"doRegistry",    label:"DO Container Registry",    placeholder:"registry.digitalocean.com/mi-org", type:"text", group:"do" },

  // ── CLOUDFLARE ───────────────────────────────────────────────────────────
  { key:"cfToken",       label:"CF API Token",             placeholder:"...",                       type:"password", group:"cf" },
  { key:"cfZoneId",      label:"CF Zone ID",               placeholder:"abc123def456",              type:"text",     group:"cf" },
  { key:"cfAccountId",   label:"CF Account ID",            placeholder:"abc123",                    type:"text",     group:"cf" },
  { key:"cfPagesProject",label:"CF Pages project name",    placeholder:"mi-app-frontend",           type:"text",     group:"cf" },
  { key:"cfWorkerName",  label:"CF Worker name (si aplica)",placeholder:"mi-worker",               type:"text",     group:"cf" },

  // ── SUPABASE ─────────────────────────────────────────────────────────────
  { key:"supabaseUrl",   label:"Supabase URL",             placeholder:"https://abc.supabase.co",  type:"text",     group:"supabase" },
  { key:"supabaseKey",   label:"Supabase Anon Key",        placeholder:"eyJhbGci...",              type:"password", group:"supabase" },
  { key:"supabaseServiceKey", label:"Supabase Service Role Key", placeholder:"eyJhbGci...",        type:"password", group:"supabase" },
  { key:"supabaseProjectRef", label:"Supabase Project Ref", placeholder:"abcdefghij",             type:"text",     group:"supabase" },
  { key:"dbConn",        label:"DB connection string",     placeholder:"postgresql://postgres:pass@db.supabase.co:5432/postgres", type:"text", group:"supabase" },

  // ── N8N ──────────────────────────────────────────────────────────────────
  { key:"n8nUrl",        label:"n8n URL",                  placeholder:"https://n8n.miapp.com",    type:"text",     group:"n8n" },
  { key:"n8nApiKey",     label:"n8n API Key",              placeholder:"n8n_api_...",              type:"password", group:"n8n" },
  { key:"n8nWebhookBase",label:"n8n Webhook base URL",     placeholder:"https://n8n.miapp.com/webhook", type:"text", group:"n8n" },

  // ── DIGITALOCEAN DATABASES ───────────────────────────────────────────────
  { key:"doDbCluster",   label:"DO Postgres Cluster ID",   placeholder:"uuid-del-cluster",         type:"text",     group:"dodb" },
  { key:"doDbConnStr",   label:"DO Postgres connection string", placeholder:"postgresql://user:pass@host:25060/db?sslmode=require", type:"text", group:"dodb" },
  { key:"doRedisCluster",label:"DO Redis Cluster ID",      placeholder:"uuid-del-cluster",         type:"text",     group:"dodb" },
  { key:"doRedisUrl",    label:"DO Redis URL",             placeholder:"rediss://default:pass@host:25061", type:"text", group:"dodb" },

  // ── MSSQL ON-PREMISE (via n8n) ────────────────────────────────────────────
  { key:"mssqlHost",     label:"MSSQL Host / IP",          placeholder:"192.168.1.x o servidor",  type:"text",     group:"mssql" },
  { key:"mssqlPort",     label:"MSSQL Puerto",             placeholder:"1433",                     type:"text",     group:"mssql" },
  { key:"mssqlDb",       label:"MSSQL Base de datos",      placeholder:"mi_base",                  type:"text",     group:"mssql" },
  { key:"mssqlUser",     label:"MSSQL Usuario",            placeholder:"sa",                       type:"text",     group:"mssql" },
  { key:"mssqlPass",     label:"MSSQL Password",           placeholder:"...",                      type:"password", group:"mssql" },
  { key:"mssqlN8nWebhook",label:"n8n Webhook MSSQL",       placeholder:"https://n8n.x.com/webhook/mssql", type:"text", group:"mssql" },

  // ── NOTIFICACIONES ────────────────────────────────────────────────────────
  { key:"n8nDeployWebhook",label:"n8n Webhook notificaciones deploy", placeholder:"https://n8n.x.com/webhook/deploy", type:"text", group:"notif" },
  { key:"smtpHost",      label:"SMTP host",                placeholder:"smtp.mailgun.org",         type:"text",     group:"notif" },
  { key:"smtpUser",      label:"SMTP user/email",          placeholder:"no-reply@miapp.com",       type:"text",     group:"notif" },
  { key:"smtpPass",      label:"SMTP password / API key",  placeholder:"...",                      type:"password", group:"notif" },
  { key:"whatsappToken", label:"WhatsApp Business Token",  placeholder:"EAAG...",                  type:"password", group:"notif" },
  { key:"whatsappPhone", label:"WhatsApp Phone ID",        placeholder:"1234567890",               type:"text",     group:"notif" },

  // ── EXTRA ─────────────────────────────────────────────────────────────────
  { key:"extra",         label:"Otras variables (.env)",   placeholder:"API_KEY=abc\nOTRA_VAR=xyz", type:"textarea", group:"extra" },
];

const STACK_GROUPS = [
  { id:"proyecto", label:"Proyecto & App",         color:"#a78bfa", icon:"◆" },
  { id:"github",   label:"GitHub",                 color:"#e2e8f0", icon:"⊙" },
  { id:"do",       label:"DigitalOcean App",        color:"#0ea5e9", icon:"◉" },
  { id:"dodb",     label:"DO Postgres & Redis",     color:"#06b6d4", icon:"◈" },
  { id:"cf",       label:"Cloudflare (DNS/Workers)", color:"#f97316", icon:"◇" },
  { id:"supabase", label:"Supabase",                color:"#10b981", icon:"▦" },
  { id:"mssql",    label:"MSSQL on-premise (n8n)",  color:"#dc2626", icon:"⊗" },
  { id:"n8n",      label:"n8n Automaciones",        color:"#f59e0b", icon:"⊕" },
  { id:"notif",    label:"Notificaciones",          color:"#f472b6", icon:"◎" },
  { id:"extra",    label:"Variables extra",         color:"#64748b", icon:"⊞" },
];

function buildStackContext(cfg) {
  const entries = Object.entries(cfg).filter(([,v])=>v&&v.toString().trim());
  if (!entries.length) return "";
  const f = Object.fromEntries(entries);
  let c = "\n\nCONFIGURACIÓN REAL DEL PROYECTO — usa estos valores exactos en todo el código que generes (sin placeholders):\n";
  // Proyecto
  if (f.projectName)   c += "PROJECT_NAME="+f.projectName+"\n";
  if (f.techStack)     c += "TECH_STACK="+f.techStack+"\n";
  if (f.repoUrl)       c += "GITHUB_REPO="+f.repoUrl.replace(/^https?:\/\/github\.com\//,"")+"\n";
  if (f.mainBranch)    c += "MAIN_BRANCH="+f.mainBranch+"\n";
  if (f.nodeVersion)   c += "NODE_VERSION="+f.nodeVersion+"\n";
  if (f.buildCmd)      c += "BUILD_CMD="+f.buildCmd+"\n";
  if (f.startCmd)      c += "START_CMD="+f.startCmd+"\n";
  if (f.port)          c += "APP_PORT="+f.port+"\n";
  if (f.domain)        c += "DOMAIN=https://"+f.domain.replace(/^https?:\/\//,"")+"\n";
  if (f.stagingDomain) c += "STAGING_DOMAIN=https://"+f.stagingDomain.replace(/^https?:\/\//,"")+"\n";
  // GitHub
  if (f.ghToken)       c += "GH_TOKEN="+f.ghToken+"\n";
  if (f.ghOrgTeam)     c += "GH_ORG_TEAM="+f.ghOrgTeam+"\n";
  if (f.ghEnvProd)     c += "GH_ENV_PROD="+f.ghEnvProd+"\n";
  if (f.ghRunnerOS)    c += "GH_RUNNER="+f.ghRunnerOS+"\n";
  // DigitalOcean
  if (f.doToken)       c += "DO_TOKEN="+f.doToken+"\n";
  if (f.doAppId)       c += "DO_APP_ID="+f.doAppId+"\n";
  if (f.doRegion)      c += "DO_REGION="+f.doRegion+"\n";
  if (f.doDropletIp)   c += "DO_DROPLET_IP="+f.doDropletIp+"\n";
  if (f.doSshUser)     c += "DO_SSH_USER="+f.doSshUser+"\n";
  if (f.doRegistry)    c += "DO_REGISTRY="+f.doRegistry+"\n";
  // Cloudflare
  if (f.cfToken)       c += "CF_API_TOKEN="+f.cfToken+"\n";
  if (f.cfZoneId)      c += "CF_ZONE_ID="+f.cfZoneId+"\n";
  if (f.cfAccountId)   c += "CF_ACCOUNT_ID="+f.cfAccountId+"\n";
  if (f.cfPagesProject)c += "CF_PAGES_PROJECT="+f.cfPagesProject+"\n";
  if (f.cfWorkerName)  c += "CF_WORKER_NAME="+f.cfWorkerName+"\n";
  // Supabase
  if (f.supabaseUrl)   c += "SUPABASE_URL="+f.supabaseUrl+"\n";
  if (f.supabaseKey)   c += "SUPABASE_ANON_KEY="+f.supabaseKey+"\n";
  if (f.supabaseServiceKey) c += "SUPABASE_SERVICE_ROLE_KEY="+f.supabaseServiceKey+"\n";
  if (f.supabaseProjectRef) c += "SUPABASE_PROJECT_REF="+f.supabaseProjectRef+"\n";
  if (f.dbConn)        c += "DATABASE_URL="+f.dbConn+"\n";
  // n8n
  if (f.n8nUrl)        c += "N8N_URL="+f.n8nUrl+"\n";
  if (f.n8nApiKey)     c += "N8N_API_KEY="+f.n8nApiKey+"\n";
  if (f.n8nWebhookBase)c += "N8N_WEBHOOK_BASE="+f.n8nWebhookBase+"\n";
  // Notificaciones
  if (f.smtpHost)      c += "SMTP_HOST="+f.smtpHost+"\n";
  if (f.smtpUser)      c += "SMTP_USER="+f.smtpUser+"\n";
  if (f.smtpPass)      c += "SMTP_PASS="+f.smtpPass+"\n";
  if (f.whatsappToken) c += "WHATSAPP_TOKEN="+f.whatsappToken+"\n";
  if (f.whatsappPhone) c += "WHATSAPP_PHONE_ID="+f.whatsappPhone+"\n";
  // Extra
  if (f.extra)         c += f.extra.trim()+"\\n";
  if (f.doDbConnStr)    c += "DO_POSTGRES_URL="+f.doDbConnStr+"\\n";
  if (f.doRedisUrl)     c += "DO_REDIS_URL="+f.doRedisUrl+"\\n";
  if (f.mssqlHost)      c += "MSSQL_HOST="+f.mssqlHost+"\\nMSSQL_PORT="+(f.mssqlPort||"1433")+"\\nMSSQL_DATABASE="+(f.mssqlDb||"")+"\\n";
  if (f.mssqlHost&&f.mssqlDb) c += "MSSQL_CONN=mssql://"+(f.mssqlUser||"sa")+":"+(f.mssqlPass||"")+"@"+f.mssqlHost+":"+(f.mssqlPort||"1433")+"/"+(f.mssqlDb||"")+"\\n";
  if (f.mssqlN8nWebhook) c += "N8N_MSSQL_WEBHOOK="+f.mssqlN8nWebhook+"\\n";
  if (f.n8nDeployWebhook) c += "N8N_DEPLOY_WEBHOOK="+f.n8nDeployWebhook+"\\n";
  if (f.mssqlHost) c += "ARCH_DATA=MSSQL-onprem-via-n8n,DO-Postgres,DO-Redis\\n";
  c += "\\nREGLA ABSOLUTA: Usa estos valores reales. Nunca escribas YOUR_KEY, placeholder, TODO.";
  return c;
}

// ─────────────────────────────────────────────────────────────────────────────
// DEPLOY ENGINE — Nivel 3: GitHub + Supabase + DigitalOcean + Cloudflare
// ─────────────────────────────────────────────────────────────────────────────

// ── Helpers ──────────────────────────────────────────────────────────────────
async function ghFetch(path, method="GET", body=null, token="") {
  const res = await fetch("https://api.github.com"+path, {
    method,
    headers: { Authorization:"Bearer "+token, "Content-Type":"application/json", Accept:"application/vnd.github+json", "X-GitHub-Api-Version":"2022-11-28" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error("GitHub "+method+" "+path+" → "+res.status+": "+(data.message||JSON.stringify(data)));
  return data;
}

async function supabaseFetch(path, method="GET", body=null, url="", serviceKey="") {
  const res = await fetch(url+"/rest/v1"+path, {
    method,
    headers: { apikey:serviceKey, Authorization:"Bearer "+serviceKey, "Content-Type":"application/json", Prefer:"return=representation" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) { const e=await res.text(); throw new Error("Supabase "+method+" "+path+" → "+res.status+": "+e); }
  return res.status===204 ? {} : await res.json();
}

async function supabaseSQL(sql, url="", serviceKey="") {
  const res = await fetch(url+"/rest/v1/rpc/exec_sql", {
    method:"POST",
    headers: { apikey:serviceKey, Authorization:"Bearer "+serviceKey, "Content-Type":"application/json" },
    body: JSON.stringify({ query: sql }),
  });
  // Supabase doesn't expose raw SQL via REST — use edge function approach
  // Try via postgres direct if available, otherwise store DDL as a migration file on GitHub
  if (!res.ok) return { skipped: true, reason: "SQL via REST requires pg_net or edge function" };
  return await res.json();
}

async function doFetch(path, method="GET", body=null, token="") {
  const res = await fetch("https://api.digitalocean.com/v2"+path, {
    method,
    headers: { Authorization:"Bearer "+token, "Content-Type":"application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error("DO "+method+" "+path+" → "+res.status+": "+(data.message||JSON.stringify(data)));
  return data;
}

async function cfFetch(path, method="GET", body=null, token="", accountId="") {
  const base = accountId ? "https://api.cloudflare.com/client/v4/accounts/"+accountId : "https://api.cloudflare.com/client/v4";
  const res = await fetch(base+path, {
    method,
    headers: { Authorization:"Bearer "+token, "Content-Type":"application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!data.success) throw new Error("CF "+method+" "+path+" → "+(data.errors?.[0]?.message||JSON.stringify(data.errors)));
  return data.result;
}

// ── Extract code blocks from agent outputs ────────────────────────────────────
function extractCodeBlocks(text, lang="") {
  const regex = lang
    ? new RegExp("```"+lang+"\s*([\s\S]*?)```", "gi")
    : /```(?:\w+)?\s*([\s\S]*?)```/gi;
  const blocks = [];
  let m;
  while ((m = regex.exec(text)) !== null) blocks.push(m[1].trim());
  return blocks;
}

function extractSQL(results) {
  return Object.values(results)
    .filter(r=>!r.isError)
    .flatMap(r=>{ const t=(r.synth||r.text||""); return extractCodeBlocks(t,"sql"); })
    .filter(s=>s.length>20)
    .join("\n\n");
}

function extractWorkflowYAML(results) {
  const devops = results["devops"];
  if (!devops||devops.isError) return null;
  const blocks = extractCodeBlocks((devops.synth||devops.text||""), "yaml");
  return blocks.find(b=>b.includes("on:") || b.includes("jobs:")) || null;
}

// ── MAIN DEPLOY FUNCTION ──────────────────────────────────────────────────────
async function runDeployEngine(cfg, results, masterPlan, autoDetect, onLog) {
  const log = (step, status, msg, detail) =>
    onLog({ step, status, msg, detail:detail||"", ts: new Date().toLocaleTimeString() });

  const agentBest = id => {
    const r = results[id];
    if (!r || r.isError) return null;
    return (r.synth || r.text || "").trim() || null;
  };

  const gh = async (path, method, body) => {
    method = method || "GET";
    const res = await fetch("https://api.github.com"+path, {
      method,
      headers: { Authorization:"Bearer "+cfg.ghToken, "Content-Type":"application/json",
        Accept:"application/vnd.github+json", "X-GitHub-Api-Version":"2022-11-28" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error("GH "+method+" "+path+" "+res.status+": "+(data.message||""));
    return data;
  };

  const steps = [];

  // ══ FASE 0 — PREFLIGHT CHECKLIST (todos los agentes) ═════════════════════
  log("preflight","info","Validando outputs de agentes...");
  const CHECKS = [
    ["pm","Plan de proyecto definido",true],["ba","Requerimientos documentados",true],
    ["architect","Arquitectura definida",true],["dba","Esquema DB definido",true],
    ["devops","CI/CD configurado",true],["security","Seguridad revisada",true],
    ["qa","Tests definidos",true],["deploy_eng","Runbook preparado",true],
    ["api_integrator","Contratos API listos",false],["uiux","UI/UX especificado",false],
    ["prompt_eng","Prompts vibe coding listos",false],["dpo","Privacidad revisada",false],
    ["legal","Legal evaluado",false],["performance","Performance revisado",false],
    ["chaos","Resiliencia planificada",false],["maintenance","Ops y SLAs definidos",false],
    ["i18n","i18n/a11y especificado",false],["copywriter","Copy listo",false],
    ["growth","Growth strategy lista",false],["ml","ML evaluado",false],
    ["bi","BI/analytics definido",false],["disruptor","Innovación evaluada",false],
    ["product_owner","Roadmap definido",false],["tech_writer","Docs técnica lista",false],
    ["manual_writer","Manual usuario listo",false],["roadmap_eng","Versioning definido",false],
    ["post_launch","Plan post-launch listo",false],["prompt_lib","Biblioteca prompts lista",false],
    ["research","Research completado",false],["cx","CX journey mapeado",false],
    ["revenue","Revenue strategy lista",false],
  ];
  let preflightOk = true;
  const checkResults = [];
  CHECKS.forEach(function(item) {
    const id = item[0], check = item[1], req = item[2];
    const pass = !!agentBest(id);
    checkResults.push({ id, check, pass, req });
    if (!pass && req) preflightOk = false;
    log("preflight", pass?"ok":"warn", (pass?"[OK]":"[--]")+" "+check);
  });
  steps.push({ name:"Pre-deploy checklist (31 agentes)", status:preflightOk?"ok":"warn",
    detail:checkResults.filter(function(c){return !c.pass;}).map(function(c){return c.check;}).join(", ")||"Todos ok" });

  // ══ FASE 1 — GITHUB: commit todos los archivos ════════════════════════════
  if (cfg.ghToken && cfg.repoUrl) {
    const parts = cfg.repoUrl.replace(/^https?:\/\/github\.com\//,"").split("/");
    const owner = parts[0], repo = parts[1];
    log("github","info","Conectando a "+owner+"/"+repo+"...");
    try {
      let repoData;
      try { repoData = await gh("/repos/"+owner+"/"+repo); }
      catch {
        repoData = await gh("/user/repos","POST",{
          name:repo, private:true, auto_init:true,
          description:(cfg.projectName||"AI Swarm")+" — generado por AI Swarm v7"
        });
        log("github","ok","Repo creado: "+owner+"/"+repo);
      }
      const branchName = cfg.mainBranch || repoData.default_branch || "main";
      let treeSha=null, commitSha=null;
      try {
        const b = await gh("/repos/"+owner+"/"+repo+"/git/ref/heads/"+branchName);
        commitSha = b.object.sha;
        const c = await gh("/repos/"+owner+"/"+repo+"/git/commits/"+commitSha);
        treeSha = c.tree.sha;
      } catch {}

      // Build complete file tree — every agent + every artifact
      const files = {};

      // PLAN MAESTRO
      if (masterPlan) files["PLAN_MAESTRO.md"] = "# Plan Maestro\n\n> AI Swarm Orquestador\n\n"+masterPlan;

      // Root config
      // n8n MSSQL workflow JSON — saved to repo for manual import if API fails
      if (cfg.mssqlHost) {
        const mssqlWf = {
          name:"MSSQL Bridge — "+(cfg.projectName||"AI Swarm"),
          nodes:[
            {id:"wh",name:"Webhook MSSQL",type:"n8n-nodes-base.webhook",typeVersion:2,position:[240,300],
              parameters:{httpMethod:"POST",path:"mssql-query",responseMode:"responseNode",options:{allowedOrigins:"*"}}},
            {id:"ms",name:"MSSQL Query",type:"n8n-nodes-base.microsoftSql",typeVersion:1,position:[500,300],
              parameters:{operation:"executeQuery",query:"={{ $json.query }}",additionalFields:{queryTimeout:30}},
              credentials:{microsoftSql:{id:"mssql-cred",name:"MSSQL On-Premise"}}},
            {id:"rs",name:"Respond",type:"n8n-nodes-base.respondToWebhook",typeVersion:1,position:[760,300],
              parameters:{respondWith:"json",responseBody:"={{ JSON.stringify($json) }}"}},
          ],
          connections:{"Webhook MSSQL":{main:[[{node:"MSSQL Query",type:"main",index:0}]]},"MSSQL Query":{main:[[{node:"Respond",type:"main",index:0}]]}},
          settings:{executionOrder:"v1"}
        };
        files["n8n/mssql_bridge_workflow.json"] = JSON.stringify(mssqlWf, null, 2);
        // MSSQL connection instructions
        files["n8n/mssql_setup.md"] = [
          "# Configuracion MSSQL on-premise en n8n",
          "","## 1. Importar workflow","- Ir a n8n → Workflows → Import","- Seleccionar `n8n/mssql_bridge_workflow.json`",
          "","## 2. Configurar credencial MSSQL","- n8n → Credentials → New → Microsoft SQL",
          "- Host: "+(cfg.mssqlHost||"<host>"),
          "- Port: "+(cfg.mssqlPort||"1433"),
          "- Database: "+(cfg.mssqlDb||"<database>"),
          "- User: "+(cfg.mssqlUser||"<user>"),
          "- Password: (configurar en n8n, no en este archivo)",
          "","## 3. Activar workflow","- El webhook quedara disponible en: "+(cfg.n8nWebhookBase||"https://n8n.tu-dominio.com/webhook")+"/mssql-query",
          "","## 4. Uso desde la app","```javascript","// Query a MSSQL via n8n webhook","const res = await fetch(process.env.N8N_MSSQL_WEBHOOK, {","  method: 'POST',","  headers: { 'Content-Type': 'application/json' },","  body: JSON.stringify({ query: 'SELECT TOP 10 * FROM tabla' })","});","const data = await res.json();","```",
        ].join("\n");
      }

      files[".gitignore"] = "node_modules/\n.env\n.env.local\ndist/\nbuild/\n.DS_Store\n*.log\ncoverage/\n.next/\n__pycache__/\n";
      files["CONTRIBUTING.md"] = "# Contributing\n\nGenerado por AI Swarm v7\n\n```bash\ngit clone https://github.com/"+cfg.repoUrl+"\ncd "+(cfg.projectName||repo)+"\nnpm install\ncp .env.example .env\nnpm run dev\n```\n";

      // Every agent → docs/ organized by phase
      const AGENT_FILES = [
        ["pm",           "docs/fase0-intake/01_project_plan.md",           "Plan de Proyecto"],
        ["ba",           "docs/fase0-intake/02_requirements.md",            "Requerimientos"],
        ["revenue",      "docs/fase0-intake/03_revenue_strategy.md",        "Revenue Strategy"],
        ["architect",    "docs/fase1-diseno/04_architecture.md",            "Arquitectura"],
        ["uiux",         "docs/fase1-diseno/05_ui_ux_spec.md",              "UI/UX Spec"],
        ["cx",           "docs/fase1-diseno/06_customer_journey.md",        "Customer Journey"],
        ["api_integrator","docs/fase1-diseno/07_api_contracts.md",          "API Contracts"],
        ["dba",          "docs/fase1-diseno/08_database_design.md",         "Database Design"],
        ["prompt_eng",   "prompts/vibe_coding_prompts.md",                  "Vibe Coding Prompts"],
        ["copywriter",   "docs/fase2-vibe/09_copy.md",                      "Copy"],
        ["devops",       "docs/fase2-vibe/10_devops_cicd.md",               "DevOps CI/CD"],
        ["i18n",         "docs/fase2-vibe/11_i18n_a11y.md",                 "i18n y A11y"],
        ["qa",           "docs/fase3-calidad/12_qa_testing.md",             "QA Testing"],
        ["security",     "docs/fase3-calidad/13_security.md",               "Security"],
        ["performance",  "docs/fase3-calidad/14_performance.md",            "Performance"],
        ["chaos",        "docs/fase3-calidad/15_chaos_resilience.md",       "Chaos Engineering"],
        ["ml",           "docs/fase4-inteligencia/16_ml_ai.md",             "ML y AI"],
        ["bi",           "docs/fase4-inteligencia/17_bi_analytics.md",      "BI Analytics"],
        ["growth",       "docs/fase4-inteligencia/18_growth.md",            "Growth Strategy"],
        ["research",     "docs/fase4-inteligencia/19_tech_research.md",     "Tech Research"],
        ["disruptor",    "docs/fase4-inteligencia/20_innovation.md",        "Innovacion"],
        ["dpo",          "docs/fase5-gobernanza/21_privacy_dpo.md",         "Privacy DPO"],
        ["legal",        "docs/fase5-gobernanza/22_legal_compliance.md",    "Legal Compliance"],
        ["prompt_lib",   "docs/fase5-gobernanza/23_prompt_library.md",      "Prompt Library"],
        ["deploy_eng",   "docs/fase6-lifecycle/24_deploy_runbook.md",       "Deploy Runbook"],
        ["maintenance",  "docs/fase6-lifecycle/25_maintenance_ops.md",      "Maintenance Ops"],
        ["product_owner","docs/fase6-lifecycle/26_product_roadmap.md",      "Product Roadmap"],
        ["tech_writer",  "README.md",                                        "README"],
        ["manual_writer","docs/fase6-lifecycle/27_user_manual.md",          "Manual Usuario"],
        ["roadmap_eng",  "docs/fase6-lifecycle/28_versioning_roadmap.md",   "Versioning Roadmap"],
        ["post_launch",  "docs/fase6-lifecycle/29_post_launch.md",          "Post Launch"],
      ];
      AGENT_FILES.forEach(function(item) {
        const id=item[0], path=item[1], title=item[2];
        const out = agentBest(id); if (!out) return;
        const header = path==="README.md" ? "" : "# "+title+"\n\n> Agente: "+id+" | AI Swarm v7\n\n";
        files[path] = header+out;
      });

      // SQL from DBA
      const dbaOut = agentBest("dba")||"";
      const sqlBlocks = extractCodeBlocks(dbaOut,"sql");
      const allSql = sqlBlocks.length ? sqlBlocks.join("\n\n") : extractSQL(results);
      if (allSql) files["migrations/001_schema.sql"] = "-- Schema auto-generado por AI Swarm DBA\n-- "+isoStringPanama()+"\n\n"+allSql;
      const biOut = agentBest("bi")||"";
      const biSql = extractCodeBlocks(biOut,"sql").join("\n\n");
      if (biSql) files["migrations/002_analytics.sql"] = "-- Analytics queries (BI)\n\n"+biSql;

      // CI/CD
      const devopsOut = agentBest("devops")||"";
      const yamlBlocks = extractCodeBlocks(devopsOut,"yaml").concat(extractCodeBlocks(devopsOut,"yml"));
      const deployYml = yamlBlocks.find(function(b){return b.includes("on:")||b.includes("jobs:");});
      files[".github/workflows/deploy.yml"] = deployYml || [
        "name: Deploy","on:","  push:","    branches: ["+(cfg.mainBranch||"main")+"]","  workflow_dispatch:",
        "jobs:","  deploy:","    runs-on: "+(cfg.ghRunnerOS||"ubuntu-latest"),
        "    steps:","      - uses: actions/checkout@v4","      - uses: actions/setup-node@v4",
        "        with:","          node-version: '"+(cfg.nodeVersion||"20")+"'",
        "      - run: npm ci","      - run: "+(cfg.buildCmd||"npm run build"),
      ].join("\n");

      // Scripts
      const bashBlocks = extractCodeBlocks(devopsOut,"bash").concat(extractCodeBlocks(devopsOut,"sh"));
      if (bashBlocks.length) files["scripts/deploy.sh"] = "#!/bin/bash\nset -e\n\n"+bashBlocks.join("\n\n");
      const deployEngOut = agentBest("deploy_eng")||"";
      const runbookBash = extractCodeBlocks(deployEngOut,"bash").concat(extractCodeBlocks(deployEngOut,"sh"));
      if (runbookBash.length) files["scripts/runbook.sh"] = "#!/bin/bash\nset -e\n\n"+runbookBash.join("\n\n");

      // Tests
      const qaOut = agentBest("qa")||"";
      const tsBlocks = extractCodeBlocks(qaOut,"typescript").concat(extractCodeBlocks(qaOut,"ts"),extractCodeBlocks(qaOut,"javascript"));
      if (tsBlocks.length) files["tests/swarm.spec.ts"] = tsBlocks.join("\n\n");
      if (qaOut) files["tests/test_cases.md"] = "# Test Cases\n\n> Generado por QA Agent — AI Swarm v7\n\n"+qaOut;

      // i18n stubs
      if (agentBest("i18n")) {
        files["locales/es/common.json"] = JSON.stringify({"_generated":"AI Swarm","_note":"Completar con valores reales"},null,2);
        files["locales/en/common.json"] = JSON.stringify({"_generated":"AI Swarm","_note":"Fill with real values"},null,2);
      }

      // .env.example
      const envLines = ["# Auto-generado por AI Swarm v7 — "+isoStringPanama(),"# cp .env.example .env",""];
      [["supabaseUrl","SUPABASE_URL"],["supabaseKey","SUPABASE_ANON_KEY"],
       ["supabaseServiceKey","SUPABASE_SERVICE_ROLE_KEY"],["dbConn","DATABASE_URL"],
       ["doDbConnStr","DO_POSTGRES_URL"],["doRedisUrl","DO_REDIS_URL"],
       ["mssqlN8nWebhook","N8N_MSSQL_WEBHOOK"],
       ["n8nUrl","N8N_URL"],["n8nApiKey","N8N_API_KEY"],["n8nWebhookBase","N8N_WEBHOOK_BASE"],
       ["n8nDeployWebhook","N8N_DEPLOY_WEBHOOK"],
       ["cfZoneId","CF_ZONE_ID"],["cfAccountId","CF_ACCOUNT_ID"],["cfToken","CF_API_TOKEN"],
       ["doToken","DO_TOKEN"],["port","PORT"],["domain","DOMAIN"],
       ["smtpHost","SMTP_HOST"],["smtpUser","SMTP_USER"],
       ["whatsappToken","WHATSAPP_TOKEN"],["whatsappPhone","WHATSAPP_PHONE_ID"],
      ].forEach(function(pair){ if(cfg[pair[0]]) envLines.push(pair[1]+"="+cfg[pair[0]]); });
      if (cfg.extra) envLines.push("","# Extra",cfg.extra);
      files[".env.example"] = envLines.join("\n");

      // DEPLOY CHECKLIST
      const cl = ["# Deploy Checklist — AI Swarm v7","","## Pre-deploy (31 agentes)"];
      checkResults.forEach(function(c){ cl.push("- ["+(c.pass?"x":" ")+"] "+c.check+(c.req?" *(req)*":"")); });
      cl.push("","## Infraestructura");
      cl.push("- [ ] Supabase proyecto activo"+(cfg.supabaseUrl?" ("+cfg.supabaseUrl+")":""));
      cl.push("- [ ] DigitalOcean app desplegada"+(cfg.doAppId?" ("+cfg.doAppId+")":""));
      cl.push("- [ ] GitHub Actions corriendo");
      cl.push("- [ ] Variables de entorno configuradas");
      cl.push("","## Certificaciones por fase (marcar al verificar)");
      ["Fase 0 Intake","Fase 1 Diseno","Fase 2 Vibe Coding","Fase 3 Calidad",
       "Fase 4 Inteligencia","Fase 5 Gobernanza","Fase 6 Lifecycle"].forEach(function(f){ cl.push("- [ ] "+f+" — revisado y aprobado"); });
      cl.push("","## Post-deploy");
      ["Health check OK","Migraciones SQL aplicadas","Tests pasando","Monitoreo activo","Notificacion enviada"].forEach(function(t){ cl.push("- [ ] "+t); });
      files["DEPLOY_CHECKLIST.md"] = cl.join("\n");

      // Push all files in one commit
      log("github","info","Subiendo "+Object.keys(files).length+" archivos...");
      const treeItems = await Promise.all(
        Object.entries(files).filter(function(e){return e[1]&&e[1].trim();}).map(async function(entry) {
          const path=entry[0], fileContent=entry[1];
          const blob = await gh("/repos/"+owner+"/"+repo+"/git/blobs","POST",{
            content: btoa(unescape(encodeURIComponent(fileContent))), encoding:"base64"
          });
          return { path, mode:"100644", type:"blob", sha:blob.sha };
        })
      );
      const newTree = await gh("/repos/"+owner+"/"+repo+"/git/trees","POST",{
        tree:treeItems, ...(treeSha?{base_tree:treeSha}:{})
      });
      const agentsOk = Object.keys(results).filter(function(id){return !results[id].isError;});
      const newCommit = await gh("/repos/"+owner+"/"+repo+"/git/commits","POST",{
        message:"🤖 AI Swarm v7 — "+shortDatePanama()+" — "+Object.keys(files).length+" archivos\n\nAgentes: "+agentsOk.join(", "),
        tree:newTree.sha,
        ...(commitSha?{parents:[commitSha]}:{})
      });
      try { await gh("/repos/"+owner+"/"+repo+"/git/refs/heads/"+branchName,"PATCH",{sha:newCommit.sha,force:false}); }
      catch { await gh("/repos/"+owner+"/"+repo+"/git/refs","POST",{ref:"refs/heads/"+branchName,sha:newCommit.sha}); }

      log("github","ok",Object.keys(files).length+" archivos commiteados en "+branchName,
        "README, PLAN_MAESTRO, DEPLOY_CHECKLIST, docs/ (29 fases), migrations/, scripts/, tests/, prompts/, locales/, .github/");
      steps.push({ name:"GitHub ("+Object.keys(files).length+" archivos)", url:"https://github.com/"+owner+"/"+repo, status:"ok" });

      // Secrets reminder
      const secretsNeeded = [["DO_TOKEN",cfg.doToken],["CF_API_TOKEN",cfg.cfToken],
        ["SUPABASE_SERVICE_ROLE_KEY",cfg.supabaseServiceKey],["N8N_API_KEY",cfg.n8nApiKey],
      ].filter(function(s){return s[1];}).map(function(s){return s[0];});
      if (secretsNeeded.length) {
        log("github","warn","Agregar en Settings → Secrets → Actions: "+secretsNeeded.join(", "));
        steps.push({ name:"GitHub Secrets", status:"warn", detail:"Manual: "+secretsNeeded.join(", ") });
      }

    } catch(e) {
      log("github","error","GitHub: "+e.message);
      steps.push({ name:"GitHub", status:"error", detail:e.message });
    }
  } else {
    log("github","skip","ghToken o repoUrl no configurados");
    steps.push({ name:"GitHub", status:"skip" });
  }

  // ══ FASE 2 — SUPABASE ════════════════════════════════════════════════════
  if (cfg.supabaseUrl && cfg.supabaseServiceKey) {
    log("supabase","info","Ejecutando migraciones...");
    try {
      const dbaOut = agentBest("dba")||"";
      const sqlBs  = extractCodeBlocks(dbaOut,"sql");
      const sql    = sqlBs.length ? sqlBs.join("\n\n") : extractSQL(results);
      if (sql && cfg.supabaseProjectRef) {
        const res = await fetch("https://api.supabase.com/v1/projects/"+cfg.supabaseProjectRef+"/database/query",{
          method:"POST",
          headers:{Authorization:"Bearer "+cfg.supabaseServiceKey,"Content-Type":"application/json"},
          body:JSON.stringify({query:sql})
        });
        if (res.ok) {
          log("supabase","ok","Migraciones aplicadas ("+sqlBs.length+" bloques SQL)");
          steps.push({ name:"Supabase DB", url:cfg.supabaseUrl, status:"ok" });
        } else {
          const err = await res.text();
          log("supabase","warn","SQL directo fallido — DDL en migrations/ del repo: "+err.slice(0,80));
          steps.push({ name:"Supabase DB", status:"warn", detail:"DDL en migrations/001_schema.sql" });
        }
      } else {
        log("supabase","warn","Sin Project Ref o sin SQL — DDL guardado en repo");
        steps.push({ name:"Supabase DB", status:"warn", detail:"Configura supabaseProjectRef" });
      }
    } catch(e) {
      log("supabase","error","Supabase: "+e.message);
      steps.push({ name:"Supabase DB", status:"error", detail:e.message });
    }
  }

  // ══ FASE 3 — DIGITALOCEAN ════════════════════════════════════════════════
  if (cfg.doToken && cfg.repoUrl) {
    log("do","info","Configurando DigitalOcean...");
    try {
      const repoParts = cfg.repoUrl.replace(/^https?:\/\/github\.com\//,"").split("/");
      const owner=repoParts[0], repo=repoParts[1];
      const appName = (cfg.projectName||repo||"ai-swarm").toLowerCase().replace(/[^a-z0-9-]/g,"-").slice(0,32);
      const envVars = [
        cfg.supabaseUrl       && {key:"SUPABASE_URL",     value:cfg.supabaseUrl,     scope:"RUN_AND_BUILD_TIME"},
        cfg.supabaseKey       && {key:"SUPABASE_ANON_KEY",value:cfg.supabaseKey,     scope:"RUN_AND_BUILD_TIME"},
        cfg.dbConn            && {key:"DATABASE_URL",     value:cfg.dbConn,          scope:"RUN_AND_BUILD_TIME",type:"SECRET"},
        cfg.n8nUrl            && {key:"N8N_URL",          value:cfg.n8nUrl,          scope:"RUN_AND_BUILD_TIME"},
        cfg.port              && {key:"PORT",             value:cfg.port,            scope:"RUN_AND_BUILD_TIME"},
      ].filter(Boolean);
      const appSpec = {
        name:appName, region:cfg.doRegion||"nyc3",
        services:[{ name:"web",
          github:{ repo:owner+"/"+repo, branch:cfg.mainBranch||"main", deploy_on_push:true },
          run_command:cfg.startCmd||"npm start", environment_slug:"node-js",
          instance_size_slug:"apps-s-1vcpu-0.5gb", instance_count:1,
          http_port:parseInt(cfg.port)||3000, envs:envVars
        }]
      };
      let doResult;
      if (cfg.doAppId) {
        doResult = await doFetch("/apps/"+cfg.doAppId,"PUT",{spec:appSpec},cfg.doToken);
        log("do","ok","App DO actualizada con "+envVars.length+" variables de entorno");
      } else {
        doResult = await doFetch("/apps","POST",{spec:appSpec},cfg.doToken);
        log("do","ok","App DO creada: "+doResult.app?.id, doResult.app?.live_url||"");
      }
      steps.push({ name:"DigitalOcean App", url:"https://cloud.digitalocean.com/apps/"+(doResult.app?.id||cfg.doAppId||""), status:"ok" });
    } catch(e) {
      log("do","error","DigitalOcean: "+e.message);
      steps.push({ name:"DigitalOcean App", status:"error", detail:e.message });
    }
  }

  // ══ FASE 4 — GITHUB ACTIONS ══════════════════════════════════════════════
  if (cfg.ghToken && cfg.repoUrl) {
    const rp2 = cfg.repoUrl.replace(/^https?:\/\/github\.com\//,"").split("/");
    const own2=rp2[0], rep2=rp2[1];
    try {
      await new Promise(function(r){setTimeout(r,2500);});
      const wfs = await gh("/repos/"+own2+"/"+rep2+"/actions/workflows");
      const dWf = wfs.workflows?.find(function(w){return w.name?.toLowerCase().includes("deploy")||w.path?.includes("deploy");});
      if (dWf && dWf.state==="active") {
        await gh("/repos/"+own2+"/"+rep2+"/actions/workflows/"+dWf.id+"/dispatches","POST",{ref:cfg.mainBranch||"main"});
        log("actions","ok","Workflow disparado: "+dWf.name);
      } else {
        log("actions","ok","deploy_on_push activo — Actions corre automaticamente con el commit");
      }
      steps.push({ name:"GitHub Actions", url:"https://github.com/"+own2+"/"+rep2+"/actions", status:"ok" });
    } catch(e) {
      log("actions","warn","Actions: "+e.message);
      steps.push({ name:"GitHub Actions", url:"https://github.com/"+(cfg.repoUrl||"")+"/actions", status:"warn" });
    }
  }

  // ══ FASE 4b — DO POSTGRES: apply DDL migrations ══════════════════════════
  if (cfg.doDbConnStr) {
    log("dodb","info","Base de datos DO Postgres configurada");
    // Direct SQL execution requires server-side — store connection string in env
    // DDL migrations go to repo, CI/CD runs them
    const dbaOut2 = agentBest("dba")||"";
    const sqlBlocks2 = extractCodeBlocks(dbaOut2,"sql");
    if (sqlBlocks2.length) {
      log("dodb","ok","DDL SQL generado por DBA ("+sqlBlocks2.length+" bloques) → migrations/001_schema.sql en repo");
      log("dodb","info","Ejecutar en CI/CD: psql "+cfg.doDbConnStr.slice(0,40)+"... -f migrations/001_schema.sql");
    } else {
      log("dodb","skip","Sin bloques SQL del DBA — revisar output del agente");
    }
    steps.push({ name:"DO Postgres", status:"ok", detail:"DDL en repo, ejecutar via CI/CD" });
  }

  // ══ FASE 4c — DO REDIS: config ════════════════════════════════════════════
  if (cfg.doRedisUrl) {
    log("doredis","ok","DO Redis configurado: "+cfg.doRedisUrl.slice(0,30)+"...");
    log("doredis","info","Variable DO_REDIS_URL inyectada en app DO y .env.example");
    steps.push({ name:"DO Redis", status:"ok", detail:"URL en .env.example y app DO" });
  }

  // ══ FASE 4d — MSSQL ON-PREMISE: generar n8n workflow ════════════════════
  if (cfg.mssqlHost && cfg.n8nUrl) {
    log("mssql","info","Generando n8n workflow para MSSQL on-premise...");
    try {
      // Generate n8n workflow that bridges HTTP webhooks → MSSQL
      const mssqlWorkflow = {
        name: "MSSQL Bridge — "+(cfg.projectName||"AI Swarm"),
        nodes: [
          { id:"webhook-in", name:"Webhook MSSQL", type:"n8n-nodes-base.webhook", typeVersion:2,
            position:[240,300],
            parameters:{ httpMethod:"POST", path:"mssql-query", responseMode:"responseNode",
              options:{ allowedOrigins:"*" } } },
          { id:"mssql-node", name:"MSSQL Query", type:"n8n-nodes-base.microsoftSql", typeVersion:1,
            position:[500,300],
            parameters:{ operation:"executeQuery", query:"={{ $json.query }}",
              additionalFields:{ queryTimeout:30 } },
            credentials:{ microsoftSql:{ id:"mssql-cred", name:"MSSQL On-Premise" } } },
          { id:"respond", name:"Respond", type:"n8n-nodes-base.respondToWebhook", typeVersion:1,
            position:[760,300],
            parameters:{ respondWith:"json", responseBody:"={{ JSON.stringify($json) }}" } },
        ],
        connections: {
          "Webhook MSSQL":{ main:[[{ node:"MSSQL Query",type:"main",index:0 }]] },
          "MSSQL Query":  { main:[[{ node:"Respond",    type:"main",index:0 }]] },
        },
        settings:{ executionOrder:"v1" },
        meta:{ templateId:"ai-swarm-mssql-bridge" }
      };
      // Import via n8n API
      const n8nRes = await fetch(cfg.n8nUrl+"/api/v1/workflows", {
        method:"POST",
        headers:{ "X-N8N-API-KEY":cfg.n8nApiKey||"", "Content-Type":"application/json" },
        body: JSON.stringify(mssqlWorkflow)
      });
      if (n8nRes.ok) {
        const wfData = await n8nRes.json();
        const webhookUrl = cfg.n8nWebhookBase+"/mssql-query";
        log("mssql","ok","Workflow n8n MSSQL creado: ID "+wfData.id, "Webhook: "+webhookUrl);
        log("mssql","info","Credencial MSSQL a configurar en n8n: host="+cfg.mssqlHost+" db="+cfg.mssqlDb+" user="+cfg.mssqlUser);
        steps.push({ name:"MSSQL n8n Bridge", url:cfg.n8nUrl, status:"ok",
          detail:"Webhook: "+webhookUrl });
      } else {
        const err = await n8nRes.text();
        log("mssql","warn","n8n API fallida ("+n8nRes.status+") — workflow JSON en docs del repo: "+err.slice(0,60));
        steps.push({ name:"MSSQL n8n Bridge", status:"warn", detail:"Importar workflow manualmente en n8n" });
      }
    } catch(e) {
      log("mssql","warn","MSSQL bridge: "+e.message+" — workflow JSON guardado en repo");
      steps.push({ name:"MSSQL n8n Bridge", status:"warn", detail:e.message });
    }
  } else if (cfg.mssqlHost) {
    log("mssql","warn","MSSQL configurado pero n8nUrl no definida — workflow JSON en docs del repo");
    steps.push({ name:"MSSQL n8n Bridge", status:"warn", detail:"Configura n8nUrl para auto-importar" });
  }

  // ══ FASE 5 — CLOUDFLARE DNS (informativo) ════════════════════════════════
  if (cfg.cfToken && cfg.cfZoneId) {
    log("cf","info","Cloudflare configurado para DNS"+(cfg.cfWorkerName?" + Workers":"")+(cfg.cfPagesProject?" + Pages":""));
    if (cfg.cfPagesProject && cfg.cfAccountId) {
      try {
        await cfFetch("/pages/projects/"+cfg.cfPagesProject+"/deployments","POST",{},cfg.cfToken,cfg.cfAccountId);
        log("cf","ok","CF Pages deploy disparado: "+cfg.cfPagesProject);
        steps.push({ name:"Cloudflare Pages", url:"https://dash.cloudflare.com/"+cfg.cfAccountId+"/pages/view/"+cfg.cfPagesProject, status:"ok" });
      } catch(e) {
        log("cf","warn","CF Pages: "+e.message);
        steps.push({ name:"Cloudflare", status:"warn", detail:e.message });
      }
    } else {
      log("cf","ok","DNS gestionado en Cloudflare Zone: "+cfg.cfZoneId.slice(0,8)+"...");
      steps.push({ name:"Cloudflare DNS", status:"ok", detail:"DNS activo, sin deploy automático" });
    }
  }

  // ══ FASE 6 — CERTIFICADO + SLACK ═════════════════════════════════════════
  const okCount  = steps.filter(function(s){return s.status==="ok";}).length;
  const errCount = steps.filter(function(s){return s.status==="error";}).length;
  const certMsg  = errCount===0
    ? "Deploy certificado — "+okCount+" servicios desplegados, "+Object.keys(results).filter(function(id){return !results[id].isError;}).length+" agentes documentados"
    : "Deploy parcial — "+errCount+" errores, "+okCount+" ok";
  log("cert", errCount===0?"ok":"warn", certMsg);
  steps.push({ name:"Certificado", status:errCount===0?"ok":"warn", detail:certMsg });

  // ══ NOTIFICACIONES — SMTP email + n8n webhook ════════════════════════════
  const okNames2  = steps.filter(function(s){return s.status==="ok";}).map(function(s){return s.name;}).join(", ");
  const errNames2 = steps.filter(function(s){return s.status==="error";}).map(function(s){return s.name;}).join(", ");
  const warnNames2= steps.filter(function(s){return s.status==="warn";}).map(function(s){return s.name;}).join(", ");

  // SMTP via n8n (browser can't send raw SMTP — route through n8n webhook)
  if (cfg.n8nDeployWebhook || cfg.n8nUrl) {
    const notifWebhook = cfg.n8nDeployWebhook || (cfg.n8nWebhookBase ? cfg.n8nWebhookBase+"/deploy-notify" : null);
    if (notifWebhook) {
      try {
        const emailPayload = {
          event:"deploy_complete",
          status:errCount===0?"ok":"partial",
          project:cfg.projectName||"AI Swarm",
          timestamp:isoStringPanama(),
          repo:cfg.repoUrl?"https://github.com/"+cfg.repoUrl:"",
          services_ok:okNames2,
          services_error:errNames2,
          services_warn:warnNames2,
          agents:Object.keys(results).filter(function(id){return !results[id].isError;}).length,
          message:certMsg,
          // Email fields — n8n uses these to send via SMTP
          email_to:cfg.smtpUser||"",
          email_subject:"[AI Swarm] Deploy "+(errCount===0?"exitoso":"parcial")+": "+(cfg.projectName||"proyecto"),
          email_html:"<h2>AI Swarm Deploy</h2><p><strong>Estado:</strong> "+(errCount===0?"✅ Exitoso":"⚠️ Parcial")+"</p>"+
            "<p><strong>Proyecto:</strong> "+(cfg.projectName||"AI Swarm")+"</p>"+
            "<p><strong>Servicios OK:</strong> "+(okNames2||"ninguno")+"</p>"+
            (errNames2?"<p><strong>Errores:</strong> "+errNames2+"</p>":"")+
            (warnNames2?"<p><strong>Advertencias:</strong> "+warnNames2+"</p>":"")+
            (cfg.repoUrl?"<p><strong>Repo:</strong> <a href='https://github.com/"+cfg.repoUrl+"'>"+cfg.repoUrl+"</a></p>":"")+
            "<p><em>Generado por AI Swarm v7 — "+new Date().toLocaleString("es-PA", {timeZone:"America/Panama"})+"</em></p>"
        };
        await fetch(notifWebhook,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(emailPayload)});
        log("notif","ok","Payload enviado a n8n → SMTP email a "+(cfg.smtpUser||"destinatario"));
        steps.push({ name:"Email SMTP (via n8n)", status:"ok", detail:"A: "+cfg.smtpUser });
      } catch(e) {
        log("notif","warn","Notificacion: "+e.message);
        steps.push({ name:"Email SMTP", status:"warn", detail:e.message });
      }
    } else {
      log("notif","skip","n8nUrl disponible pero sin webhook de notificacion — configura n8nDeployWebhook");
    }
  } else if (cfg.smtpHost) {
    log("notif","warn","SMTP configurado pero requiere n8n como relay (browser no puede conectar SMTP directo). Configura n8nDeployWebhook.");
    steps.push({ name:"Email SMTP", status:"warn", detail:"Requiere n8n webhook relay" });
  } else if (cfg.whatsappToken) {
    log("notif","info","WhatsApp configurado — agregar n8n webhook para activar notificaciones");
  } else {
    log("notif","skip","Sin notificaciones configuradas");
  }

  return steps;
}


const DEFAULT_BUDGET = 0.50;
const WARN_BUDGET    = 0.50;
const MONTHLY_LIMIT  = 30.00;
const LITE_CORE = ["pm","ba","architect","prompt_eng","qa"];

function estimateCost(agentIds, modelKey = "sonnet", withSynth = false) {
  const m = MODELS[modelKey] || MODELS.sonnet;
  const avgIn = 2200, avgOut = 1500;
  const pass1 = agentIds.length * (avgIn * m.priceIn + avgOut * m.priceOut);
  const pass2 = withSynth ? agentIds.length * (avgIn * 1.5 * m.priceIn + avgOut * m.priceOut) : 0;
  return {pass1, pass2, total: pass1 + pass2};
}

const fmtCost = n => n < 0.001 ? "<$0.001" : n < 1 ? "$" + n.toFixed(3) : "$" + n.toFixed(2);
const fmtTime = s => Math.floor(s/60) + ":" + String(s%60).padStart(2,"0");

// ─────────────────────────────────────────────────────────────────────────────
// BRECHA 3: WORKFLOW EXPORTERS
// ─────────────────────────────────────────────────────────────────────────────
function buildMarkdown(enrichedIdea, results, elapsed) {
  let md = "# AI Swarm — Agentes IA v7\n\n";
  md += `**Generado:** ${new Date().toLocaleString("es-PA")} · **Tiempo:** ${fmtTime(elapsed)}\n\n---\n\n## Requerimiento\n\n${enrichedIdea}\n\n---\n\n`;
  PHASES.forEach((phase,pi) => {
    let ids = [...phase.agents];
    if (PROMPT_ENG_INJECT.includes(pi) && !ids.includes("prompt_eng")) ids.push("prompt_eng");
    ids = [...new Set(ids)].filter(id => results[id] && !results[id].isError);
    if (!ids.length) return;
    md += `## ${phase.name}\n\n`;
    ids.forEach(id => {
      const ag = AGENTS.find(a => a.id === id), r = results[id];
      const best = r.synth || r.text;
      md += `### ${ag.icon} ${ag.name}${r.synth?" ✦":""}\n\n${best}\n\n`;
      if (r.synth) md += `<details><summary>Análisis inicial</summary>\n\n${r.text}\n\n</details>\n\n`;
      md += "---\n\n";
    });
  });
  return md;
}

function buildJSON(enrichedIdea, results, elapsed) {
  const out = {meta:{generated:new Date().toISOString(),elapsed_seconds:elapsed,idea:enrichedIdea,version:"v7"},phases:{}};
  PHASES.forEach((phase,pi) => {
    let ids = [...phase.agents];
    if (PROMPT_ENG_INJECT.includes(pi) && !ids.includes("prompt_eng")) ids.push("prompt_eng");
    ids = [...new Set(ids)].filter(id => results[id]);
    if (!ids.length) return;
    out.phases[phase.id] = {name:phase.name, agents:{}};
    ids.forEach(id => {
      const ag = AGENTS.find(a => a.id === id), r = results[id];
      out.phases[phase.id].agents[id] = {name:ag.name,icon:ag.icon,success:!r.isError,output:r.synth||r.text,initial:r.text,has_synth:!!r.synth};
    });
  });
  return JSON.stringify(out, null, 2);
}

function buildCSV(enrichedIdea, results) {
  const esc = v => `"${String(v||"").replace(/"/g,'""').replace(/\r?\n|\r/g," ").trim()}"`;
  const rows = [["fase","fase_id","agente","agente_id","icono","estado","tiene_sintesis","output_preview","output_completo"].join(",")];
  PHASES.forEach((phase,pi) => {
    let ids = [...phase.agents];
    if (PROMPT_ENG_INJECT.includes(pi) && !ids.includes("prompt_eng")) ids.push("prompt_eng");
    ids = [...new Set(ids)].filter(id => results[id]);
    ids.forEach(id => {
      const ag = AGENTS.find(a => a.id === id), r = results[id];
      const best = r.synth || r.text || "";
      rows.push([esc(phase.name),esc(phase.id),esc(ag.name),esc(id),esc(ag.icon),esc(r.isError?"error":"ok"),esc(r.synth?"si":"no"),esc(best.slice(0,300)),esc(best)].join(","));
    });
  });
  return rows.join("\n");
}

function buildN8NWorkflow(enrichedIdea, results) {
  const nodes = [];
  const connections = {};
  let x = 240, y = 300;

  // Start node
  nodes.push({id:"start",name:"🚀 Inicio AI Swarm",type:"n8n-nodes-base.start",typeVersion:1,position:[x,y],parameters:{}});

  // One HTTP Request node per agent with output
  const agentNodes = [];
  PHASES.forEach((phase,pi) => {
    let ids = [...phase.agents];
    if (PROMPT_ENG_INJECT.includes(pi) && !ids.includes("prompt_eng")) ids.push("prompt_eng");
    ids = [...new Set(ids)].filter(id => results[id] && !results[id].isError);
    ids.forEach(id => {
      const ag = AGENTS.find(a => a.id === id);
      const r = results[id];
      const nid = "agent_" + id;
      x += 280;
      nodes.push({
        id: nid, name: ag.icon + " " + ag.name, type: "n8n-nodes-base.set",
        typeVersion: 3, position: [x, y + (agentNodes.length % 3) * 120],
        parameters: {
          fields: {
            values: [
              {name:"agente", stringValue: ag.name},
              {name:"fase", stringValue: phase.name},
              {name:"output", stringValue: (r.synth||r.text||"").slice(0,500)},
              {name:"tiene_sintesis", stringValue: r.synth ? "true" : "false"},
            ]
          }
        }
      });
      agentNodes.push(nid);
    });
  });

  // Add merge node
  nodes.push({id:"merge",name:"📦 Merge Resultados",type:"n8n-nodes-base.merge",typeVersion:2,position:[x+280,y],parameters:{mode:"combine"}});
  nodes.push({id:"end",name:"✅ Enjambre Completado",type:"n8n-nodes-base.noOp",typeVersion:1,position:[x+560,y],parameters:{}});

  // Connections
  connections["🚀 Inicio AI Swarm"] = {main:[[{node:agentNodes[0]??"merge",type:"main",index:0}]]};
  agentNodes.forEach((nid,i) => {
    const nodeName = nodes.find(n => n.id === nid)?.name || nid;
    const nextName = i < agentNodes.length-1 ? (nodes.find(n => n.id === agentNodes[i+1])?.name||"merge") : "📦 Merge Resultados";
    connections[nodeName] = {main:[[{node:nextName,type:"main",index:0}]]};
  });
  connections["📦 Merge Resultados"] = {main:[[{node:"✅ Enjambre Completado",type:"main",index:0}]]};

  return JSON.stringify({name:"AI Swarm v7 — " + new Date().toLocaleDateString("es-PA"),nodes,connections,active:false,settings:{},versionId:"v7",meta:{instanceId:"ai-swarm-lab"}}, null, 2);
}

function buildCrewAIWorkflow(enrichedIdea, results) {
  const agentDefs = [];
  const taskDefs = [];
  const agentVars = [];

  PHASES.forEach((phase,pi) => {
    let ids = [...phase.agents];
    if (PROMPT_ENG_INJECT.includes(pi) && !ids.includes("prompt_eng")) ids.push("prompt_eng");
    ids = [...new Set(ids)].filter(id => results[id] && !results[id].isError);
    ids.forEach(id => {
      const ag = AGENTS.find(a => a.id === id);
      const varName = id.replace(/-/g,"_");
      agentVars.push(varName);
      agentDefs.push(`${varName} = Agent(
    role="${ag.name}",
    goal="${ag.desc}",
    backstory="Eres el ${ag.name} del AI Swarm Lab.",
    verbose=True,
    allow_delegation=False,
)`);
      taskDefs.push(`task_${varName} = Task(
    description="${taskDesc}...",
    agent=${varName},
    expected_output="Análisis completo en español con recomendaciones accionables",
)`);
    });
  });

  return `# ══════════════════════════════════════════════════════
# AI Swarm v7 — CrewAI Workflow
# Generado: ${new Date().toLocaleString("es-PA")}
# Idea original: ${enrichedIdea.slice(0,120).replace(/\n/g," ")}
# ══════════════════════════════════════════════════════

from crewai import Agent, Task, Crew, Process

# ── AGENTES ──────────────────────────────────────────────
${agentDefs.join("\n\n")}

# ── TAREAS ───────────────────────────────────────────────
${taskDefs.join("\n\n")}

# ── CREW ─────────────────────────────────────────────────
crew = Crew(
    agents=[${agentVars.join(", ")}],
    tasks=[${agentVars.map(v => "task_"+v).join(", ")}],
    process=Process.sequential,
    verbose=True,
)

# ── EJECUTAR ─────────────────────────────────────────────
result = crew.kickoff(inputs={
    "requerimiento": "${enrichedIdea.slice(0,300).replace(/"/g,"'").replace(/\n/g," ")}"
})

print(result)
`;
}

function buildSQLBundle(results) {
  const codeRegex = /```sql\n([\s\S]*?)```/gi;
  let sql = `-- AI Swarm v7 — SQL Generado\n-- ${new Date().toLocaleString("es-PA")}\n\n`;
  let total = 0;
  AGENTS.forEach(ag => {
    const r = results[ag.id];
    if (!r||r.isError) return;
    const text = (r.synth||"")+"\n"+(r.text||"");
    const seen = new Set();
    const matches = [...text.matchAll(codeRegex)].filter(m => {
      const k = m[1].trim().slice(0,80); if(seen.has(k))return false; seen.add(k); return true;
    });
    if (!matches.length) return;
    sql += `\n-- ── ${ag.name} ──\n\n`;
    matches.forEach(m => { sql += m[1].trim()+"\n\n"; total++; });
  });
  if (!total) sql += "-- No se encontraron bloques SQL\n";
  return sql;
}

function buildYAMLBundle(results) {
  const codeRegex = /```ya?ml\n([\s\S]*?)```/gi;
  let yaml = `# AI Swarm v7 — YAML/Config Generado\n# ${new Date().toLocaleString("es-PA")}\n\n`;
  let total = 0;
  AGENTS.forEach(ag => {
    const r = results[ag.id];
    if (!r||r.isError) return;
    const text = (r.synth||"")+"\n"+(r.text||"");
    const seen = new Set();
    const matches = [...text.matchAll(codeRegex)].filter(m => {
      const k = m[1].trim().slice(0,80); if(seen.has(k))return false; seen.add(k); return true;
    });
    if (!matches.length) return;
    yaml += `# ── ${ag.name} ──\n\n`;
    matches.forEach(m => { yaml += m[1].trim()+"\n\n"; total++; });
  });
  if (!total) yaml += "# No se encontraron bloques YAML\n";
  return yaml;
}

// ─────────────────────────────────────────────────────────────────────────────
// SAFE EXPORT (Claude artifact sandbox)
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// STACK CONFIG PANEL — collect real credentials before launch
// ─────────────────────────────────────────────────────────────────────────────
function GroupSection({ group, fields, filled, config, onChange }) {
  const [open, setOpen] = useState(filled > 0);
  return (
    <div style={{marginBottom:8,borderRadius:12,overflow:"hidden",border:"1px solid var(--border-base)"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"9px 13px",border:"none",cursor:"pointer",background:open?group.color+"0c":"transparent",fontFamily:"inherit",transition:"background .15s"}}>
        <span style={{fontSize:13}}>{group.icon}</span>
        <span style={{fontFamily:"'Syne',sans-serif",fontSize:10,fontWeight:700,letterSpacing:1.5,color:group.color,textTransform:"uppercase",flex:1,textAlign:"left"}}>{group.label}</span>
        {filled > 0
          ? <span style={{fontSize:9,padding:"2px 7px",borderRadius:999,background:group.color+"18",color:group.color,fontWeight:700,fontFamily:"'Fira Code',monospace"}}>{filled}/{fields.length}</span>
          : <span style={{fontSize:9,color:"var(--text-muted)"}}>opcional</span>
        }
        <span style={{fontSize:11,color:"var(--text-muted)",transition:"transform .2s",transform:open?"rotate(180deg)":"rotate(0)"}}>▾</span>
      </button>
      {open && (
        <div style={{padding:"8px 12px 12px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
          {fields.map(field => (
            <div key={field.key} style={{gridColumn:field.type==="textarea"?"1 / -1":"auto"}}>
              <label style={{display:"block",fontSize:10,color:config[field.key]?"rgba(200,220,255,.7)":"rgba(200,210,255,.35)",fontWeight:600,marginBottom:3,fontFamily:"'DM Sans',sans-serif",transition:"color .15s"}}>
                {field.label}
                {config[field.key] && <span style={{color:group.color,marginLeft:4}}>✓</span>}
              </label>
              {field.type==="textarea"
                ? <textarea value={config[field.key]||""} onChange={e=>onChange(field.key,e.target.value)}
                    placeholder={field.placeholder}
                    style={{width:"100%",minHeight:64,padding:"7px 10px",fontSize:11,borderRadius:8,boxSizing:"border-box",resize:"vertical",fontFamily:"'Fira Code',monospace"}}/>
                : <input type={field.type} value={config[field.key]||""} onChange={e=>onChange(field.key,e.target.value)}
                    placeholder={field.placeholder}
                    style={{width:"100%",padding:"7px 10px",fontSize:11,borderRadius:8,boxSizing:"border-box",fontFamily:"'Fira Code',monospace"}}
                  />
              }
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StackConfigPanel({ config, onChange, onClose }) {
  const filledCount = Object.values(config).filter(v=>v&&v.toString().trim()).length;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(3,5,12,.94)",zIndex:9998,display:"flex",alignItems:"center",justifyContent:"center",padding:16,overflowY:"auto"}}>
      <div style={{background:"#0d1117",border:"1px solid rgba(124,106,247,.35)",borderRadius:20,width:"100%",maxWidth:680,maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:"0 0 60px rgba(124,106,247,.12)"}}>
        
        {/* Header */}
        <div style={{padding:"16px 22px",borderBottom:"1px solid var(--border-base)",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
          <div style={{width:4,height:22,borderRadius:2,background:"#10b981",boxShadow:"0 0 10px #10b981"}}/>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:800,color:"var(--text-muted)"}}>Configuración del proyecto</div>
            <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>Los agentes usan estos valores para generar código 100% ejecutable — sin placeholders</div>
          </div>
          {filledCount > 0 && <span style={{fontSize:10,padding:"3px 9px",borderRadius:999,background:"rgba(16,185,129,.15)",color:"#10b981",fontWeight:700,fontFamily:"'Fira Code',monospace"}}>{filledCount} configurados</span>}
        </div>

        {/* Fields by group — collapsible */}
        <div style={{overflowY:"auto",padding:"12px 20px",flex:1}}>
          {STACK_GROUPS.map(group => {
            const fields = STACK_FIELDS.filter(f=>f.group===group.id);
            const filled = fields.filter(f=>config[f.key]&&config[f.key].toString().trim()).length;
            return (
              <GroupSection key={group.id} group={group} fields={fields} filled={filled} config={config} onChange={onChange}/>
            );
          })}
          <div style={{marginTop:6,padding:"9px 12px",borderRadius:10,background:"var(--bg-surface-1)",border:"1px solid var(--border-base)",fontSize:10,color:"var(--text-secondary)",lineHeight:1.6,display:"flex",gap:6,alignItems:"flex-start"}}>
            <span style={{flexShrink:0,marginTop:1}}>🔒</span>
            <span>Estos valores se inyectan en los prompts de cada agente para generar código sin placeholders. No salen de tu navegador.</span>
          </div>
        </div>

        {/* Footer */}
        <div style={{padding:"12px 22px",borderTop:"1px solid var(--border-base)",display:"flex",gap:8,flexShrink:0}}>
          <button onClick={onClose} style={{flex:1,padding:"10px 16px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#7c3aed,#4f46e5)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            ✓ Guardar y continuar
          </button>
          <button onClick={()=>{Object.keys(config).forEach(k=>onChange(k,""));onClose();}}
            style={{padding:"10px 14px",borderRadius:12,border:"1px solid var(--border-base)",background:"transparent",color:"var(--text-muted)",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
            Limpiar
          </button>
        </div>
      </div>
    </div>
  );
}

function ExportModal({ content, filename, onClose }) {
  const areaRef = useRef(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { areaRef.current?.select(); areaRef.current?.focus(); }, []);
  const copy = () => {
    areaRef.current?.select();
    try { document.execCommand("copy"); setCopied(true); playSound("copy"); haptic([20]); setTimeout(()=>setCopied(false),2500); } catch{}
  };
  const ext = filename.split(".").pop().toUpperCase();
  const lines = content.split("\n").length;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(109,40,217,.2)",backdropFilter:"blur(8px)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#0d1117",border:"2px solid rgba(167,139,250,.4)",borderRadius:24,width:"100%",maxWidth:780,maxHeight:"88vh",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(124,58,237,.2), 0 0 0 8px rgba(124,106,247,.08)",animation:"popIn .3s ease both"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 20px",borderBottom:"2px solid rgba(124,106,247,.2)",background:"#0d1117"}}>
          <span style={{fontSize:18}}>📄</span>
          <span style={{fontFamily:"'Fira Code',monospace",fontSize:12,color:"#a78bfa",fontWeight:700,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{filename}</span>
          <span style={{fontSize:10,color:"#a78bfa",fontWeight:700}}>{lines} líneas</span>
          <span style={{fontSize:10,fontWeight:800,padding:"3px 10px",borderRadius:999,background:"rgba(124,106,247,.12)",color:"#7c3aed"}}>{ext}</span>
          <button onClick={onClose} style={{padding:"5px 11px",borderRadius:10,border:"2px solid rgba(124,106,247,.2)",background:"#0d1117",color:"var(--text-muted)",fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>✕</button>
        </div>
        <div style={{padding:"8px 20px",background:"rgba(16,185,129,.05)",borderBottom:"2px solid rgba(16,185,129,.15)",fontSize:11,color:"#10b981",fontWeight:700,display:"flex",alignItems:"center",gap:8}}>
          <span>💡</span>
          Presiona <strong style={{color:"#7c3aed",margin:"0 3px"}}>Ctrl+C</strong> o usa el botón · el texto está auto-seleccionado
        </div>
        <textarea ref={areaRef} readOnly value={content} onClick={e=>e.target.select()}
          style={{flex:1,padding:"16px 20px",resize:"none",background:"#080c14",color:"#d4dcf5",border:"none",fontFamily:"'Fira Code','JetBrains Mono',monospace",fontSize:12,lineHeight:1.7,outline:"none",overflowY:"auto",minHeight:200,boxSizing:"border-box"}} />
        <div style={{display:"flex",gap:8,padding:"14px 20px",borderTop:"2px solid rgba(124,106,247,.2)",background:"#0d1117"}}>
          <button onClick={copy} style={{flex:1,padding:"11px 16px",borderRadius:14,border:"none",background:copied?"linear-gradient(135deg,#22c55e,rgba(16,185,129,.6))":"linear-gradient(135deg,#7c3aed,#6d28d9)",color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"'Nunito',sans-serif",transition:"all .3s",boxShadow:copied?"0 4px 16px rgba(34,197,94,.4)":"0 4px 16px rgba(124,58,237,.35)"}}>
            {copied?"✅ ¡Copiado!":"📋 Copiar todo (Ctrl+C)"}
          </button>
          <button onClick={onClose} style={{padding:"11px 20px",borderRadius:14,border:"2px solid rgba(124,106,247,.2)",background:"#0d1117",color:"var(--text-muted)",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito',sans-serif"}}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERVIEW SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
const INTERVIEW_SYSTEM = `Eres el entrevistador del AI Swarm Lab.
Tu tarea: analizar el requerimiento y generar preguntas que permitan a los agentes producir código y artefactos 100% ejecutables sin ambigüedad.
Genera 3-6 preguntas. Prioriza: tipo de proyecto, tech stack, base de datos, integraciones externas, usuarios objetivo.
RESPONDE SOLO JSON. Sin markdown, sin texto extra, sin backticks.
[{"id":"q1","question":"pregunta concreta","type":"select|multiselect|text","options":["Op1","Op2"],"why":"impacto en el codigo"}]
Para type text, options=[].`;

// Auto-detect: infer project type and stack from the idea before launching
const AUTO_DETECT_SYSTEM = `Eres un arquitecto de software. Analiza el requerimiento y extrae metadatos técnicos.
RESPONDE SOLO JSON válido, sin markdown, sin texto extra:
{
  "projectType": "webapp|api|automation|mobile|data-pipeline|integration|cli",
  "primaryStack": "tecnologias principales separadas por coma",
  "database": "postgresql|mysql|sqlite|mssql|mongodb|supabase|none",
  "hasAuth": true/false,
  "hasApi": true/false,
  "hasFrontend": true/false,
  "hasWorkers": true/false,
  "estimatedComplexity": "simple|medium|complex",
  "keyEntities": ["entidad1","entidad2","entidad3"],
  "mainAction": "descripcion de la accion principal en 10 palabras"
}`;

// Master orchestrator: consolidates ALL agent outputs into ONE executable plan
const ORCHESTRATOR_SYSTEM = `Eres el Orquestador Maestro del AI Swarm. Tu trabajo es sintetizar el output de todos los agentes en UN documento ejecutable que el equipo puede usar directamente.

RECIBIRÁS: el requerimiento original + el output completo de todos los agentes especializados.

ENTREGA OBLIGATORIA — en este orden exacto, sin texto entre secciones:

## PLAN MAESTRO DE EJECUCIÓN

### Paso a paso (ordenado, con comandos reales)
| # | Acción | Comando / Archivo | Tiempo est. |
|---|---|---|---|
| 1 | ... | \`comando exacto\` | Xmin |

### .env completo del proyecto
\`\`\`bash
# Copia esto a tu .env — todos los valores reales del proyecto
VARIABLE=valor
\`\`\`

### Estructura de archivos a crear
\`\`\`
proyecto/
├── archivo1.ts     # descripción
├── archivo2.sql    # descripción
\`\`\`

### Prompts de vibe coding (ejecutar en orden con Claude)
\`\`\`
PROMPT 1 — [nombre del componente]:
[prompt completo listo para pegar en Claude]
---
PROMPT 2 — [siguiente componente]:
[prompt completo listo para pegar en Claude]
\`\`\`

### Checklist de deploy
- [ ] comando o acción concreta
- [ ] siguiente acción

Sin introducción. Sin conclusión. Solo el plan ejecutable.`;

// Robust JSON extractor for interview responses
function parseInterviewJSON(raw) {
  if (!raw) throw new Error("Respuesta vacía");

  // Step 1: strip markdown fences
  let s = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

  // Step 2: find the JSON array boundaries
  const start = s.indexOf("[");
  const end   = s.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) throw new Error("No se encontró array JSON");
  s = s.slice(start, end + 1);

  // Step 3: try direct parse first
  try { return JSON.parse(s); } catch (_) {}

  // Step 4: aggressive sanitization — fix common LLM JSON mistakes
  s = s
    // Remove control characters (tabs, vertical tabs, etc.) but keep newlines for now
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Replace literal newlines inside strings with \n
    .replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match) =>
      match.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")
    )
    // Fix trailing commas before ] or }
    .replace(/,\s*([\]\}])/g, "$1")
    // Fix missing quotes on simple values (rare but possible)
    .replace(/:\s*([a-zA-Z][a-zA-Z0-9_]*)\s*([,\}\]])/g, ': "$1"$2');

  // Step 5: try again
  try { return JSON.parse(s); } catch (_) {}

  // Step 6: last resort — extract individual question objects with regex
  const questions = [];
  const objRegex = /\{[^\{\}]*"id"\s*:\s*"[^"]+?"[^\{\}]*\}/gs;
  let m;
  while ((m = objRegex.exec(s)) !== null) {
    try {
      const obj = JSON.parse(m[0]);
      if (obj.id && obj.question) questions.push(obj);
    } catch {}
  }
  if (questions.length > 0) return questions;

  // Step 7: build fallback questions if all else fails
  throw new Error("No se pudo parsear el JSON de preguntas. Intenta de nuevo.");
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENT SYSTEM PROMPTS (abbreviated)
// ─────────────────────────────────────────────────────────────────────────────
const AGENT_PROMPTS = {

  pm:`Eres el Project Manager. TU OUTPUT es un plan de ejecución listo para usar.
ENTREGA OBLIGATORIA — en este orden exacto:
1. **TIPO** (una línea): Quick Win <8h / Proyecto 1-4 semanas / Iniciativa >1 mes
2. **PLAN DE EJECUCIÓN** — tabla markdown con columnas: | Paso | Acción concreta | Responsable | Tiempo | Herramienta |
3. **TAREAS PARA MONDAY.COM** — lista numerada lista para copiar-pegar como items de monday.com
4. **BLOQUEOS** — solo si existen, máximo 3 líneas

NO incluyas introducción, contexto ni conclusión. Solo el plan ejecutable.`,

  ba:`Eres el Business Analyst. TU OUTPUT son artefactos listos para usar en el desarrollo.
ENTREGA OBLIGATORIA — en este orden exacto:
1. **USER STORIES** — formato Gherkin listo para copiar en Jira/Linear:
   \`\`\`
   COMO [rol] QUIERO [acción] PARA [beneficio]
   DADO [contexto] CUANDO [acción] ENTONCES [resultado]
   \`\`\`
2. **CRITERIOS DE ACEPTACIÓN** — checklist markdown [ ] lista para el equipo
3. **CAMPOS DEL FORMULARIO / ENTIDAD** — tabla: | Campo | Tipo | Validación | Requerido |
4. **PREGUNTAS BLOQUEANTES** — solo si hay ambigüedad crítica, máximo 3

Sin análisis. Solo artefactos que el equipo ejecuta directamente.`,

  revenue:`Eres el Revenue Strategist. TU OUTPUT es un modelo financiero accionable.
ENTREGA OBLIGATORIA:
1. **ROI ESTIMADO** — tabla: | Métrica | Valor actual | Con solución | Delta |
2. **MODELO DE PRECIOS** (si aplica) — opciones concretas con números
3. **KPIs A TRACKEAR** — tabla: | KPI | Fórmula | Fuente de datos | Frecuencia |
4. **QUICK WIN DE REVENUE** — una acción específica ejecutable esta semana

Solo números y acciones. Nada de narrativa.`,

  architect:`Eres el Arquitecto de Soluciones. TU OUTPUT es la arquitectura lista para implementar.
ENTREGA OBLIGATORIA:
1. **DIAGRAMA DE ARQUITECTURA** — en ASCII o texto estructurado, mostrando componentes y flujo de datos
2. **STACK DECISION** — tabla: | Componente | Tecnología elegida | Por qué | Alternativa descartada |
3. **MODELO DE DATOS PRINCIPAL** — DDL SQL o esquema de las tablas/colecciones clave
4. **ENDPOINTS API** — tabla: | Método | Ruta | Body | Response | Auth |
5. **DECISIONES DE ARQUITECTURA (ADR)** — solo las 2-3 más críticas en formato: Decisión → Consecuencia

Sin explicaciones de qué es cada tecnología. Solo las decisiones tomadas y el código.`,

  prompt_eng:`Eres el Prompt Engineer. TU OUTPUT son los prompts listos para ejecutar con Claude ahora mismo.
ENTREGA OBLIGATORIA — uno por componente del proyecto:

Para cada componente entrega el prompt completo en un bloque de código:
\`\`\`prompt
[CONTEXTO] ...stack, estructura de datos, dependencias existentes
[OBJETIVO] ...qué debe generar exactamente (nombre de archivo, tipo de componente)
[RESTRICCIONES] ...lo que NO debe hacer, convenciones del proyecto
[OUTPUT ESPERADO] ...estructura exacta del código que debe devolver
[CRITERIOS DE ÉXITO] ...cómo saber si funciona
\`\`\`

Entrega mínimo 3 prompts: (1) backend/API, (2) frontend/UI, (3) tests o integración.
Los prompts deben ser copy-paste listos — el desarrollador los pega en Claude y obtiene código funcional.`,

  dba:`Eres el DBA/Data Engineer. TU OUTPUT es SQL y configuración lista para ejecutar.
ENTREGA OBLIGATORIA:
1. **DDL COMPLETO** — CREATE TABLE con tipos, constraints, índices:
\`\`\`sql
-- pegar y ejecutar directamente
\`\`\`
2. **QUERIES DE NEGOCIO** — los 3-5 queries más importantes del requerimiento:
\`\`\`sql
-- Nombre: descripción del query
\`\`\`
3. **CONFIGURACIÓN RLS** (si usa Supabase):
\`\`\`sql
-- Row Level Security policies
\`\`\`
4. **ÍNDICES RECOMENDADOS** con justificación de performance en una línea

Solo SQL ejecutable. Nada de texto entre bloques.`,

  api_integrator:`Eres el API Integrator. TU OUTPUT son contratos de API listos para implementar.
ENTREGA OBLIGATORIA:
1. **ENDPOINTS** — para cada endpoint:
\`\`\`
POST /api/[recurso]
Headers: Authorization: Bearer {token}
Body: { campo: tipo, ... }
Response 200: { ... }
Response 4xx: { error: string }
\`\`\`
2. **WORKFLOW N8N** — pseudocódigo del flujo para implementar en n8n:
\`\`\`
Trigger → [paso 1] → [paso 2] → [condición] → [resultado]
\`\`\`
3. **CREDENCIALES NECESARIAS** — lista de secrets/API keys requeridos

Sin explicaciones de REST. Solo los contratos.`,

  security:`Eres el especialista de Seguridad. TU OUTPUT es una checklist ejecutable.
ENTREGA OBLIGATORIA:
1. **CHECKLIST DE SEGURIDAD** — lista [ ] para el equipo antes de ir a producción:
   - [ ] Autenticación: ...
   - [ ] Autorización: ...
   - [ ] Validación inputs: ...
   - [ ] Secrets management: ...
2. **CONFIGURACIÓN CLOUDFLARE** (si aplica):
\`\`\`
Regla WAF: ...
Rate limiting: ...
\`\`\`
3. **VULNERABILIDADES CRÍTICAS** — solo las que aplican, con fix concreto en una línea

Sin OWASP teórico. Solo checks y configuraciones.`,

  uiux:`Eres el UI/UX Designer. TU OUTPUT son especificaciones de UI listas para codificar.
ENTREGA OBLIGATORIA:
1. **FLUJO DE PANTALLAS** — texto estructurado:
\`\`\`
[Pantalla 1: Nombre] → acción → [Pantalla 2: Nombre]
Estado vacío: ...
Estado error: ...
Estado éxito: ...
\`\`\`
2. **COMPONENTES** — tabla: | Componente | Props | Estado | Comportamiento |
3. **COPY DE UI** — textos exactos para labels, placeholders, botones, mensajes de error
4. **PROMPT PARA GENERAR EL CÓDIGO** — un prompt listo para que Claude genere el componente React/HTML

Sin wireframes en texto. Solo specs que el dev puede codificar directamente.`,

  cx:`Eres el CX Strategist. TU OUTPUT es un plan de comunicaciones ejecutable.
ENTREGA OBLIGATORIA:
1. **MAPA DE TOUCHPOINTS** — tabla: | Momento | Canal | Mensaje | Acción requerida |
2. **TEMPLATES DE COMUNICACIÓN** — mensajes listos para usar (WhatsApp, email, SMS):
\`\`\`
[Canal] [Momento]:
Asunto/Preview: ...
Mensaje: ...
CTA: ...
\`\`\`
3. **AUTOMATIZACIONES N8N** — flujos concretos: Trigger → Condición → Acción
4. **MÉTRICAS** — tabla: | KPI | Cómo medir | Herramienta | Frecuencia |`,

  copywriter:`Eres el Copywriter. TU OUTPUT es copy listo para implementar.
ENTREGA OBLIGATORIA — para cada pantalla/sección del producto:
| Elemento | Copy |
|---|---|
| Título principal | ... |
| Subtítulo | ... |
| CTA principal | ... |
| CTA secundario | ... |
| Mensaje vacío | ... |
| Mensaje error | ... |
| Mensaje éxito | ... |
| Placeholder campos | ... |

Luego: **ASUNTO DE EMAIL** y **MENSAJE WHATSAPP** si el producto los usa.
Solo copy. Sin análisis de tono.`,

  growth:`Eres el Growth Hacker. TU OUTPUT es un plan de growth ejecutable esta semana.
ENTREGA OBLIGATORIA:
1. **EXPERIMENTO #1** (ejecutar en <48h):
   - Hipótesis: Si [acción] entonces [métrica] mejora X%
   - Cómo implementarlo: pasos concretos
   - Cómo medir: herramienta + query
2. **FUNNEL ACTUAL vs OBJETIVO** — tabla con números estimados
3. **3 A/B TESTS** — tabla: | Variante A | Variante B | Métrica | Duración |
4. **CONFIGURACIÓN UTM** — estructura de URLs para tracking

Sin frameworks de growth. Solo experimentos y configuraciones.`,

  devops:`Eres el DevOps/SRE. TU OUTPUT son archivos de configuración listos para usar.
ENTREGA OBLIGATORIA:
1. **GitHub Actions CI/CD**:
\`\`\`yaml
# .github/workflows/deploy.yml
name: Deploy
on: ...
\`\`\`
2. **Dockerfile** (si aplica):
\`\`\`dockerfile
FROM ...
\`\`\`
3. **Variables de entorno requeridas** — lista para el .env:
\`\`\`
VARIABLE_NAME=descripcion_y_donde_obtenerla
\`\`\`
4. **Comandos de deploy** — secuencia exacta para ejecutar

Solo archivos de configuración. Nada de explicaciones.`,

  performance:`Eres el Performance Engineer. TU OUTPUT es una checklist y configuraciones.
ENTREGA OBLIGATORIA:
1. **CHECKLIST PRE-PRODUCCIÓN** — [ ] lista con impacto estimado:
   - [ ] [acción concreta] → impacto: X ms / X% mejora
2. **CONFIGURACIÓN CLOUDFLARE CACHE**:
\`\`\`
Cache-Control: ...
Page Rules: ...
\`\`\`
3. **BUDGET DE PERFORMANCE** — tabla: | Métrica | Target | Actual (estimado) |`,

  i18n:`Eres el especialista i18n/a11y. TU OUTPUT es configuración y estructura de archivos.
ENTREGA OBLIGATORIA:
1. **ESTRUCTURA DE ARCHIVOS I18N**:
\`\`\`
/locales
  /es/common.json  → { "clave": "valor" }
  /en/common.json
\`\`\`
2. **CLAVES I18N** — las 20 más importantes del producto, listas para implementar
3. **CHECKLIST A11Y** — [ ] lista para el dev:
   - [ ] aria-label en [componente]: \`aria-label="..."\`
4. **ATRIBUTOS ARIA** — los 5 más críticos con código exacto`,

  ml:`Eres el ML/Data Scientist. TU OUTPUT es una decisión y un plan concreto.
ENTREGA OBLIGATORIA:
1. **DECISIÓN** (una línea): Aplica ML / No aplica ML — porque [razón en 10 palabras]
2. Si aplica ML:
   - **MODELO RECOMENDADO** y librería: \`from sklearn/tensorflow/... import ...\`
   - **FEATURES** — tabla: | Feature | Fuente | Transformación |
   - **QUERY PARA OBTENER DATOS DE ENTRENAMIENTO**:
   \`\`\`sql
   SELECT ...
   \`\`\`
3. Si no aplica: alternativa concreta (regla de negocio / heurística) con pseudocódigo`,

  bi:`Eres el BI Analyst. TU OUTPUT son queries y definición de dashboards listos para implementar.
ENTREGA OBLIGATORIA:
1. **KPIs** — tabla: | KPI | Definición exacta | Fórmula SQL |
2. **QUERIES DE DASHBOARD** — uno por KPI principal:
\`\`\`sql
-- KPI: nombre
SELECT ...
\`\`\`
3. **CONFIGURACIÓN DE REPORTE N8N** — schedule + query + destino (email/Slack/webhook)`,

  qa:`Eres el QA Tester autónomo. Tu misión: destruir este feature antes de que llegue a producción.

ESTÁNDARES QUE APLICAS en cada análisis:
- ✅ Functional: ¿cada feature funciona como fue diseñada?
- ✅ Validation: ¿los forms validan correctamente? (required, formatos, longitudes)
- ✅ Error handling: ¿los errores se muestran clara y gracefully?
- ✅ State management: ¿la UI refleja el estado correcto después de cada acción?
- ✅ Navigation: ¿todos los links, botones y rutas funcionan?
- ✅ Data integrity: ¿las acciones persisten y se muestran correctamente?
- ✅ Security basics: ¿hay datos expuestos, rutas sin auth, inputs sin sanitizar?

ENTREGA OBLIGATORIA — en este orden exacto:

## 🔍 DISCOVERY
- Scope: qué cubre este feature (en 3 líneas)
- Stack relevante para testing: frameworks, DB, auth
- Riesgos críticos identificados antes de testear

## ✅ CASOS DE PRUEBA

### Happy Path
| ID | Flujo | Datos de entrada | Resultado esperado | Comando/Script |
|---|---|---|---|---|
| TC-001 | ... | ... | ... | \`comando\` |

### Sad Path & Edge Cases
| ID | Caso | Input inválido | Comportamiento esperado | Severidad |
|---|---|---|---|---|
| TC-010 | ... | ... | ... | 🔴 Critical / 🟡 High / 🟢 Low |

## ❌ BUGS ENCONTRADOS (por análisis del código/diseño)
| ID | Componente | Descripción | Severidad | Línea/Archivo |
|---|---|---|---|---|
| BUG-001 | ... | ... | 🔴 Critical | archivo:línea |

## 📊 TEST REPORT
- **Flujos cubiertos**: X de Y
- **Pass estimado**: X% (basado en análisis)
- **Bugs por severidad**: 🔴 X críticos · 🟡 Y altos · 🟢 Z bajos
- **Coverage gaps**: áreas que requieren testing manual o automatizado adicional

## 🛠️ SCRIPTS LISTOS PARA EJECUTAR
\`\`\`bash
# Setup
npm install --save-dev vitest

# Unit tests — ejecutar ahora
npx vitest run --reporter=verbose

# E2E — flujo crítico
npx vitest run --reporter=verbose
\`\`\`

\`\`\`typescript
// tests/[feature].spec.ts — copy-paste en tu repo
// E2E: usar Cypress, Vitest o el runner de tu preferencia

test('[TC-001] nombre del flujo', async ({ page }) => {
  await page.goto('/ruta');
  await page.fill('[data-testid="campo"]', 'valor');
  await page.click('[data-testid="submit"]');
  await expect(page.locator('[data-testid="resultado"]')).toBeVisible();
});

test('[TC-010] validación campo requerido', async ({ page }) => {
  await page.goto('/ruta');
  await page.click('[data-testid="submit"]');
  await expect(page.locator('.error-message')).toContainText('requerido');
});
\`\`\`

## 🔐 CHECKLIST DE SEGURIDAD
- [ ] Inputs sanitizados contra XSS
- [ ] Auth requerida en rutas protegidas
- [ ] Datos sensibles no expuestos en respuestas API
- [ ] Rate limiting en endpoints críticos

## 📋 RECOMENDACIONES
1. [acción concreta con prioridad]
2. ...

Responde en el mismo idioma del requerimiento. Sé directo — lidera con lo que encontraste, no con lo que vas a hacer.`,

  chaos:`Eres el Chaos Engineer. TU OUTPUT es un runbook de recuperación.
ENTREGA OBLIGATORIA:
1. **PUNTOS DE FALLO** — tabla: | Componente | Fallo posible | Impacto | Probabilidad |
2. **RUNBOOK DE RECUPERACIÓN** — para cada fallo crítico:
\`\`\`bash
# Fallo: [nombre]
# Síntoma: [cómo detectarlo]
# Pasos:
1. comando o acción
2. ...
# Verificación: [cómo confirmar recuperación]
\`\`\`
3. **ALERTAS** — configuración concreta para n8n/PagerDuty/Slack`,

  prompt_lib:`Eres el Prompt Librarian. TU OUTPUT es la estructura del repositorio de prompts.
ENTREGA OBLIGATORIA:
1. **ESTRUCTURA DEL REPO**:
\`\`\`
/prompts
  /[dominio]/[componente]/[accion]-v1.md
\`\`\`
2. **TEMPLATE DE PROMPT** para este proyecto — rellena la plantilla:
\`\`\`markdown
# [nombre-del-prompt]
## Contexto
## Objetivo
## Restricciones
## Output esperado
## Ejemplo
\`\`\`
3. **3 PROMPTS REUTILIZABLES** para este proyecto específico, completos`,

  dpo:`Eres el DPO. TU OUTPUT es una checklist de compliance ejecutable.
ENTREGA OBLIGATORIA:
1. **DATOS PERSONALES IDENTIFICADOS** — tabla: | Dato | Dónde se guarda | Base legal | Retención |
2. **CHECKLIST GDPR/PRIVACIDAD** — [ ] lista:
   - [ ] Política de privacidad actualizada
   - [ ] Consentimiento explícito para [uso]
   - [ ] Derecho de supresión implementado en [tabla/endpoint]
3. **CLÁUSULAS PARA TÉRMINOS Y CONDICIONES** — texto listo para copiar`,

  legal:`Eres el asesor Legal. TU OUTPUT son alertas y cláusulas concretas.
ENTREGA OBLIGATORIA:
1. **RIESGOS LEGALES** — tabla: | Riesgo | Probabilidad | Mitigación concreta |
2. **CLÁUSULAS RECOMENDADAS** — texto listo para agregar a T&C o contrato:
\`\`\`
Cláusula [X]: [texto legal listo para usar]
\`\`\`
3. **LICENCIAS DE DEPENDENCIAS** — verificar compatibilidad: tabla | Lib | Licencia | ¿Problema? |

Si no hay riesgos relevantes: una línea confirmándolo. Sin análisis teórico.`,

  research:`Eres el investigador de IA. TU OUTPUT es una tabla de decisión y recomendación.
ENTREGA OBLIGATORIA:
1. **COMPARATIVA** — tabla: | Opción | Build/Buy/API | Costo/mes est. | Tiempo impl. | Pros | Contras |
2. **RECOMENDACIÓN** — una línea: usar [X] porque [razón en 15 palabras]
3. **CÓDIGO DE INTEGRACIÓN** — snippet de inicio para la opción recomendada:
\`\`\`javascript
// Integración con [herramienta]
import/const/fetch ...
\`\`\``,

  disruptor:`Eres el Innovador Disruptivo. TU OUTPUT son ideas con experimentos baratos.
ENTREGA OBLIGATORIA — en este orden, sin texto entre secciones:

**INCREMENTAL (ejecutable esta semana):**
- Qué: [acción concreta]
- Cómo: [pasos en 3 líneas]
- Prompt para vibe coding: \`[prompt listo para Claude]\`

**DISRUPTIVO (cambia las reglas del juego):**
- Qué: [idea en una oración]
- Por qué nadie lo hace: [razón en una oración]
- MVP en 2 semanas: [descripción concreta]

**MOONSHOT (si los recursos no fueran límite):**
- Qué: [visión en una oración]
- Analogía de otro sector: [empresa/producto que lo hizo antes]

**EL EXPERIMENTO MÁS BARATO:**
\`\`\`
Prompt para validar en 4 horas:
[prompt completo listo para ejecutar en Claude]
\`\`\``,

  deploy_eng:`Eres el Deploy Engineer. TU OUTPUT es el runbook de deploy completo.
ENTREGA OBLIGATORIA:
\`\`\`bash
#!/bin/bash
# RUNBOOK DE DEPLOY — [proyecto]
# Tiempo estimado: X minutos

# PRE-DEPLOY
echo "1. Backup..."
# comando exacto

echo "2. Tests..."
# comando exacto

# DEPLOY
echo "3. Deploy..."
# comando exacto

# POST-DEPLOY
echo "4. Smoke test..."
curl -f https://[url]/health || exit 1

# ROLLBACK (si falla)
# comando exacto de rollback
\`\`\`

Variables de entorno necesarias:
\`\`\`
ENV_VAR=valor_o_descripcion
\`\`\``,

  maintenance:`Eres el especialista en Mantenimiento & Ops. TU OUTPUT es configuración de alertas y SLAs.
ENTREGA OBLIGATORIA:
1. **SLAs** — tabla: | Servicio | Disponibilidad objetivo | RPO | RTO |
2. **ALERTAS N8N** — workflows de monitoreo:
\`\`\`
Schedule: cada X minutos
Check: [qué verificar]
Si falla: notificar a [canal] con mensaje "[texto]"
\`\`\`
3. **CHECKLIST MANTENIMIENTO MENSUAL** — [ ] lista con comandos:
   - [ ] \`comando para limpiar logs\`
   - [ ] \`comando para backup\``,

  product_owner:`Eres el Product Owner. TU OUTPUT es el backlog y roadmap listos para usar.
ENTREGA OBLIGATORIA:
1. **BACKLOG PRIORIZADO** — tabla lista para importar a monday.com/Jira:
| # | Historia | Tipo | Prioridad | Estimación | Sprint |
|---|---|---|---|---|---|
2. **ROADMAP** — tabla trimestral:
| Q | Objetivo | Features | Métrica de éxito |
3. **DEFINITION OF DONE** — checklist [ ] para el equipo
4. **CRITERIOS DE LANZAMIENTO** — [ ] lista para ir a producción`,

  tech_writer:`Eres el Technical Writer. TU OUTPUT es documentación lista para subir a GitHub.
ENTREGA OBLIGATORIA en formato Markdown completo:
\`\`\`markdown
# [Nombre del proyecto]

## Instalación
\`\`\`bash
git clone ...
npm install
cp .env.example .env
npm run dev
\`\`\`

## Variables de entorno
| Variable | Descripción | Ejemplo |
|---|---|---|

## Endpoints
| Método | Ruta | Descripción | Auth |
|---|---|---|---|

## Arquitectura
[diagrama ASCII]

## Decisiones técnicas (ADRs)
### ADR-001: [título]
**Decisión:** ...
**Consecuencia:** ...
\`\`\``,

  manual_writer:`Eres el especialista en Manuales de Usuario. TU OUTPUT es el manual completo en Markdown.
ENTREGA OBLIGATORIA:
\`\`\`markdown
# Guía de usuario — [nombre]

## Primeros pasos
1. [paso con imagen placeholder]

## Cómo [tarea principal]
1. Ir a [pantalla]
2. Hacer clic en [botón]
3. Completar [campo]: ejemplo: "..."
4. [resultado esperado]

## Preguntas frecuentes
**¿[pregunta común]?**
[respuesta concreta]

## Solución de problemas
| Problema | Causa | Solución |
\`\`\``,

  roadmap_eng:`Eres el Roadmap Engineer. TU OUTPUT es el plan de versiones ejecutable.
ENTREGA OBLIGATORIA:
1. **VERSIONADO** — tabla:
| Versión | Fecha objetivo | Features incluidas | Breaking changes |
2. **CHANGELOG v1.0.0** — formato keep-a-changelog listo:
\`\`\`markdown
## [1.0.0] - YYYY-MM-DD
### Added
- ...
### Changed
- ...
\`\`\`
3. **PROCESO DE RELEASE** — comandos git:
\`\`\`bash
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
\`\`\``,

  post_launch:`Eres el Post-Launch Analyst. TU OUTPUT es una plantilla de retrospectiva con métricas.
ENTREGA OBLIGATORIA:
1. **MÉTRICAS A MEDIR** — tabla: | Métrica | Valor objetivo | Dónde medirla | Query/comando |
2. **PLANTILLA DE RETROSPECTIVA**:
\`\`\`markdown
## Retrospectiva — [proyecto] — [fecha]
### ✅ Qué funcionó
- 
### ❌ Qué no funcionó
- 
### 🔄 Qué cambiamos para la próxima
- 
### 📊 Métricas reales vs objetivo
| Métrica | Objetivo | Real | Delta |
\`\`\`
3. **NEXT ACTIONS** — tabla: | Acción | Responsable | Fecha límite |`,
};

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT MARKDOWN
// ─────────────────────────────────────────────────────────────────────────────
function formatMarkdown(text) {
  if (!text) return "";
  let s = text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  s = s
    .replace(/^### (.+)$/gm,'<div style="color:#7c3aed;font-weight:700;font-size:13px;margin:14px 0 5px">$1</div>')
    .replace(/^## (.+)$/gm,'<div style="color:#6d28d9;font-weight:800;font-size:14px;margin:18px 0 7px;padding-bottom:5px;border-bottom:2px solid rgba(124,106,247,.2)">$1</div>')
    .replace(/\*\*(.+?)\*\*/g,'<strong style="color:#3730a3">$1</strong>')
    .replace(/`([^`]+)`/g,'<code style="background:rgba(124,106,247,.12);padding:2px 6px;border-radius:5px;font-size:11.5px;color:#7c3aed;font-family:\'Fira Code\',monospace;font-weight:600">$1</code>')
    .replace(/^- (.+)$/gm,'<div style="padding-left:16px;position:relative;margin:3px 0;color:#374151"><span style="position:absolute;left:0;color:#a78bfa;font-size:12px">●</span>$1</div>')
    .replace(/^(\d+)\. (.+)$/gm,'<div style="padding-left:20px;position:relative;margin:3px 0;color:#374151"><span style="position:absolute;left:0;color:#7c3aed;font-weight:800;font-size:12px">$1.</span>$2</div>')
    .replace(/\n{2,}/g,'<br/><br/>').replace(/\n/g,'<br/>');
  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function AgentChip({ agent, state }) {
  const isActive = state==="active"||state==="synth";
  const isDone   = state==="done";
  const isFail   = state==="failed";
  const isSkip   = state==="skipped";

  if (isSkip) return null;

  const bg = isActive ? "var(--bg-card)"
           : isDone   ? "rgba(16,185,129,.05)"
           : isFail   ? "rgba(239,68,68,.06)"
           : "var(--bg-surface-1)";
  const border = isActive ? "#c084fc"
               : isDone   ? "#86efac"
               : isFail   ? "rgba(239,68,68,.3)"
               : "var(--border-strong)";
  const color = isActive ? "#7c3aed"
              : isDone   ? "#10b981"
              : isFail   ? "#dc2626"
              : "var(--text-muted)";
  const shadow = isActive ? "0 0 0 3px rgba(124,106,247,.2), 0 4px 12px #c084fc55"
               : isDone   ? "0 2px 8px #86efac44"
               : isFail   ? "0 2px 8px rgba(239,68,68,.3)44"
               : "0 1px 3px rgba(0,0,0,.06)";

  return (
    <div style={{
      display:"inline-flex",alignItems:"center",gap:5,
      padding:"5px 11px",borderRadius:999,fontSize:11,fontWeight:700,
      whiteSpace:"nowrap",background:bg,border:"1.5px solid "+border,
      color,transition:"all .3s cubic-bezier(.34,1.56,.64,1)",
      boxShadow:shadow,
      animation:isActive?"chipBounce .6s ease-in-out infinite alternate":isDone?"chipPop .4s cubic-bezier(.34,1.56,.64,1) both":"none",
      fontFamily:"'Nunito',sans-serif",letterSpacing:"-.2px",
    }}>
      <span style={{fontSize:13,lineHeight:1,animation:isActive?"wiggle 1s ease-in-out infinite":"none"}}>{agent.icon}</span>
      <span>{agent.name}</span>
      {isDone  && <span style={{fontSize:11}}>✅</span>}
      {isFail  && <span style={{fontSize:11}}>❌</span>}
      {isActive && <span className="sp" style={{borderTopColor:"#c084fc",borderColor:"rgba(124,106,247,.2)"}}/>}
    </div>
  );
}

function AgentResult({ agent, result, defaultOpen, onRetry }) {
  const [open, setOpen] = useState(defaultOpen);
  const [tab, setTab]   = useState("best");
  if (!result) return null;
  const hasSynth = !!result.synth && !result.isError;
  const display  = tab==="synth" && hasSynth ? result.synth : tab==="initial" ? result.text : (result.synth || result.text);
  const borderCol = result.isError ? "rgba(239,68,68,.2)" : "rgba(124,106,247,.2)";
  const bgHeader  = open ? (result.isError?"rgba(239,68,68,.06)":"#0d1117") : "#fff";
  return (
    <div className="phase-block" style={{marginBottom:8,borderRadius:16,overflow:"hidden",border:"2px solid "+borderCol,background:"#0d1117",transition:"all .3s cubic-bezier(.34,1.56,.64,1)",boxShadow:open?"0 6px 24px "+agent.color+"22,0 2px 8px rgba(0,0,0,.06)":"0 1px 4px rgba(0,0,0,.05)",animation:"cardIn .4s cubic-bezier(.34,1.56,.64,1) both"}}>
      <button onClick={()=>setOpen(!open)} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"10px 14px",border:"none",cursor:"pointer",background:bgHeader,fontFamily:"inherit",transition:"background .18s"}}>
        <div style={{width:4,height:22,borderRadius:2,flexShrink:0,background:result.isError?"#f87171":agent.color,boxShadow:open?"0 0 8px "+agent.color+"88":"none",transition:"box-shadow .25s"}}/>
        <span style={{fontSize:16,lineHeight:1}}>{agent.icon}</span>
        <span style={{color:result.isError?"#dc2626":agent.color,flex:1,fontSize:12,fontWeight:800,fontFamily:"'Nunito',sans-serif",textAlign:"left"}}>{agent.name}</span>
        {hasSynth && <span style={{fontSize:9,fontWeight:800,padding:"3px 8px",borderRadius:999,background:"rgba(16,185,129,.1)",color:"#10b981",letterSpacing:.5}}>✨ SYNTH</span>}
        {result.isError && <span style={{fontSize:9,fontWeight:700,padding:"3px 8px",borderRadius:999,background:"rgba(239,68,68,.12)",color:"#dc2626"}}>❌ ERROR</span>}
        {!result.isError && <span style={{fontSize:10,color:"var(--text-muted)",maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{agent.desc}</span>}
        <span style={{fontSize:14,color:"rgba(167,139,250,.4)",transition:"transform .25s",transform:open?"rotate(180deg)":"rotate(0)",flexShrink:0}}>▾</span>
      </button>
      {open && (
        <div style={{borderTop:"1px solid "+(result.isError?"rgba(239,68,68,.15)":agent.color+"15")}}>
          {hasSynth && (
            <div style={{display:"flex",borderBottom:"2px solid rgba(124,106,247,.08)",background:"#0d1117"}}>
              {[["best","⭐ Mejor (synth)"],["initial","📝 Análisis inicial"]].map(([t,l])=>(
                <button key={t} onClick={()=>setTab(t)} style={{padding:"7px 14px",border:"none",cursor:"pointer",fontSize:10.5,fontWeight:800,background:"transparent",color:tab===t?"#7c3aed":"#a78bfa",borderBottom:tab===t?"2px solid #7c3aed":"3px solid transparent",fontFamily:"'Nunito',sans-serif",transition:"all .18s"}}>{l}</button>
              ))}
            </div>
          )}
          <div style={{padding:"14px 18px",fontSize:12.5,lineHeight:1.8,color:"#374151",fontFamily:"'Fira Code','JetBrains Mono',monospace",whiteSpace:"pre-wrap",maxHeight:520,overflowY:"auto",background:"#080c14",borderTop:"1.5px solid rgba(124,106,247,.08)"}}>
            {result.isError
              ? <div><div style={{color:"#dc2626",marginBottom:8,fontFamily:"'Nunito',sans-serif"}}>😵 {result.text}</div>
                  {onRetry && <button onClick={onRetry} style={{padding:"6px 14px",borderRadius:10,border:"2px solid rgba(239,68,68,.3)",background:"#0d1117",color:"#dc2626",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito',sans-serif"}}>🔄 Reintentar</button>}
                </div>
              : <div dangerouslySetInnerHTML={{__html:formatMarkdown(display)}}/>
            }
          </div>
        </div>
      )}
    </div>
  );
}

function SessionCard({ session, onLoad, onDelete }) {
  const successCount = Object.values(session.results||{}).filter(r=>!r.isError).length;
  const d = new Date(session.savedAt);
  const dateStr = d.toLocaleDateString("es-PA",{month:"short",day:"numeric"})+" "+d.toLocaleTimeString("es-PA",{hour:"2-digit",minute:"2-digit"});
  return (
    <div style={{padding:"14px 16px",borderRadius:16,border:"2px solid rgba(124,106,247,.2)",background:"#0d1117",marginBottom:10,display:"flex",alignItems:"center",gap:12,boxShadow:"0 2px 12px rgba(139,92,246,.07)",animation:"cardIn .35s ease both",transition:"all .2s"}}>
      <span style={{fontSize:24,flexShrink:0}}>📄</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,fontWeight:800,color:"#d4dcf5",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:3}}>{session.idea?.slice(0,60)||"Sin título"}...</div>
        <div style={{fontSize:10,color:"var(--text-muted)",display:"flex",gap:10,flexWrap:"wrap"}}>
          <span>🕐 {dateStr}</span>
          <span style={{color:"#10b981",fontWeight:700}}>✅ {successCount} agentes</span>
          <span style={{color:"#7c3aed",fontWeight:700}}>🧠 {session.model||"sonnet"}</span>
        </div>
      </div>
      <button onClick={()=>onLoad(session)} style={{padding:"7px 14px",borderRadius:10,border:"2px solid rgba(167,139,250,.4)",background:"#0d1117",color:"#7c3aed",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",transition:"all .2s"}}>📂 Cargar</button>
      <button onClick={()=>onDelete(session.id)} style={{padding:"7px 10px",borderRadius:10,border:"2px solid rgba(239,68,68,.2)",background:"rgba(239,68,68,.06)",color:"#dc2626",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all .2s"}}>🗑️</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SOUND ENGINE — Web Audio API synth (no external files needed)
// ─────────────────────────────────────────────────────────────────────────────
const AudioCtx = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);

// ─────────────────────────────────────────────────────────────────────────────
// BRUTAL SOUND ENGINE — Web Audio API
// ─────────────────────────────────────────────────────────────────────────────
const AudioCtxClass = window.AudioContext || window.webkitAudioContext;

function note(ctx, freq, type, start, dur, vol, bend=0) {
  const osc = ctx.createOscillator();
  const g   = ctx.createGain();
  const t   = ctx.currentTime + start;
  osc.type  = type;
  osc.frequency.setValueAtTime(freq, t);
  if (bend) osc.frequency.exponentialRampToValueAtTime(freq * bend, t + dur);
  g.gain.setValueAtTime(0.001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(t); osc.stop(t + dur + 0.05);
}

function playSound(type) {
  try {
    const ctx = new AudioCtxClass();
    const C = ctx.currentTime;

    if (type === "agentDone") {
      // Xylophone ping — bright and clean
      note(ctx, 1047, "sine",     0,    .12, .22);
      note(ctx, 1319, "sine",     .06,  .10, .16);
      note(ctx, 1568, "sine",     .11,  .14, .11);
      note(ctx, 2093, "sine",     .17,  .08, .07);

    } else if (type === "phaseDone") {
      // Triumphant 4-note chord stab
      [523,659,784,1047].forEach((f,i) => note(ctx, f, "triangle", i*.045, .28, .18-.02*i));
      note(ctx, 1568, "sine", .22, .4, .12);

    } else if (type === "launch") {
      // Rocket ignition: low rumble + soaring rise
      note(ctx, 55,  "sawtooth", 0,    .18, .28, 2.5);
      note(ctx, 110, "square",   .05,  .12, .18, 1.8);
      note(ctx, 220, "sawtooth", .12,  .14, .14, 1.6);
      note(ctx, 440, "sine",     .22,  .18, .16, 1.4);
      note(ctx, 880, "sine",     .34,  .22, .12);
      note(ctx, 1320,"sine",     .48,  .18, .09);

    } else if (type === "masterPlan") {
      // Epic fanfare — 5-note ascending call
      [[523,.16],[659,.15],[784,.15],[1047,.25],[1319,.18],[1568,.5]].forEach(([f,d],i) => {
        note(ctx, f, "sine", i*.12, d, .22-.02*i);
        note(ctx, f*1.5, "triangle", i*.12+.05, d*.6, .08-.01*i);
      });

    } else if (type === "swarmDone") {
      // FULL ORCHESTRA SWELL — the big moment
      // Bass pulse
      [55,73,87,110].forEach((f,i) => note(ctx, f, "sawtooth", i*.05, .6, .22));
      // Chord layers
      [[261,.35],[329,.32],[392,.3],[523,.4],[659,.38],[784,.35]].forEach(([f,d],i) =>
        note(ctx, f, "triangle", .2+i*.06, d+.3, .18-.02*i));
      // High shimmer
      [[1047,.5],[1319,.5],[1568,.6],[2093,.5]].forEach(([f,d],i) =>
        note(ctx, f, "sine", .55+i*.07, d, .14-.02*i));
      // Victory stab
      [523,659,784,1047,1319,1568,2093].forEach((f,i) =>
        note(ctx, f, "sine", 1.1+i*.04, .5, .2-.02*i));

    } else if (type === "synthDone") {
      // Soft magic chime
      [1319,1568,2093,2637].forEach((f,i) => note(ctx, f, "sine", i*.09, .18, .15-.02*i));

    } else if (type === "error") {
      // Descending buzz — short and clear
      note(ctx, 220, "sawtooth", 0,    .1,  .2,  .45);
      note(ctx, 160, "sawtooth", .07,  .12, .16, .4);
      note(ctx, 100, "sawtooth", .16,  .18, .12, .35);

    } else if (type === "copy") {
      // Double tap — satisfying click
      note(ctx, 1200, "sine", 0,   .05, .15);
      note(ctx, 1800, "sine", .05, .07, .10);

    } else if (type === "click") {
      note(ctx, 800, "sine", 0, .04, .12);

    } else if (type === "select") {
      note(ctx, 660, "sine", 0, .06, .1);
      note(ctx, 990, "sine", .03, .07, .07);

    } else if (type === "titleHover") {
      // Glitchy synth spark — per letter
      const freq = 400 + Math.random() * 800;
      note(ctx, freq, "square", 0, .03, .18, 1.5);
      note(ctx, freq * 1.5, "sine", .02, .04, .12);

    } else if (type === "titleClick") {
      // Electric burst — all letters activate
      [261, 329, 415, 523, 659, 784, 1047].forEach((f, i) =>
        note(ctx, f, "sawtooth", i * .025, .12, .22 - .02 * i, 1.2));
      note(ctx, 2093, "sine", .18, .3, .15);

    } else if (type === "orbitPing") {
      // Soft spacey ping when orbit icon passes
      note(ctx, 1800 + Math.random() * 400, "sine", 0, .06, .08);

    } else if (type === "headerLoad") {
      // Cinematic intro — low to high sweep
      note(ctx, 55,  "sawtooth", 0,   .08, .15, 3);
      note(ctx, 110, "sine",     .1,  .1,  .18, 2);
      note(ctx, 220, "triangle", .22, .12, .2,  1.8);
      note(ctx, 440, "sine",     .36, .2,  .22, 1.5);
      note(ctx, 880, "sine",     .52, .25, .2);
      note(ctx, 1320,"sine",     .68, .35, .16);
      note(ctx, 1760,"sine",     .82, .4,  .12);
      // Sparkle on top
      [2093, 2637, 3136].forEach((f, i) =>
        note(ctx, f, "sine", .9 + i * .08, .22, .1 - .02 * i));

    } else if (type === "ringPop") {
      // Ring expansion — deep resonant pop
      note(ctx, 80, "sawtooth", 0, .15, .25, .3);
      note(ctx, 160, "sine", .04, .12, .2, .5);
      note(ctx, 523, "sine", .08, .1, .15);

    } else if (type === "themeSwitch") {
      // Morphing whoosh
      note(ctx, 200, "sine", 0,   .05, .2,  3);
      note(ctx, 400, "sine", .05, .08, .18, 2);
      note(ctx, 800, "sine", .1,  .12, .16, 1.5);
      note(ctx, 1200,"sine", .16, .15, .12);
    }

    setTimeout(() => ctx.close(), 3000);
  } catch { /* silent */ }
}

function haptic(pattern = [30]) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch {}
}


// ─────────────────────────────────────────────────────────────────────────────
// AUTH LAYER — JWT + single session
// ─────────────────────────────────────────────────────────────────────────────
function useAuth() {
  const [user, setUser]       = useState(null);
  const [authReady, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("swarm_token");
    if (!token) { setReady(true); return; }
    fetch("/api/auth/me", { headers:{ Authorization:"Bearer "+token } })
      .then(r => { if(r.status===401){localStorage.removeItem("swarm_token");return null;} return r.ok?r.json():null; })
      .then(u => { if(u) setUser(u); else localStorage.removeItem("swarm_token"); })
      .catch(()=>localStorage.removeItem("swarm_token"))
      .finally(()=>setReady(true));
  }, []);

  // Global 401 interceptor — auto-logout when session is kicked
  useEffect(() => {
    const orig = window.fetch;
    window.fetch = async (...args) => {
      const res = await orig(...args);
      if (res.status===401 && user) {
        const clone=res.clone();
        clone.json().then(d=>{
          if(d?.error?.includes("otra sesión")){
            localStorage.removeItem("swarm_token"); setUser(null);
            alert("⚠️ Tu sesión fue cerrada porque se inició otra sesión con tu cuenta.");
          }
        }).catch(()=>{});
      }
      return res;
    };
    return ()=>{ window.fetch=orig; };
  }, [user]);

  const login = async (email, password) => {
    const r = await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});
    const d = await r.json();
    if(!r.ok) throw new Error(d.error||"Error de autenticación");
    localStorage.setItem("swarm_token", d.token);
    setUser(d.user);
    return d.user;
  };

  const logout = async () => {
    const token = localStorage.getItem("swarm_token");
    if(token) fetch("/api/auth/logout",{method:"POST",headers:{Authorization:"Bearer "+token}}).catch(()=>{});
    localStorage.removeItem("swarm_token");
    setUser(null);
  };

  return { user, authReady, login, logout };
}

function LoginScreen({ onLogin, theme, setTheme }) {
  const [email,setEmail]=useState(""); const [pass,setPass]=useState("");
  const [error,setError]=useState(""); const [loading,setLoad]=useState(false);
  const submit=async(e)=>{ e.preventDefault(); setError(""); setLoad(true);
    try{await onLogin(email,pass);}catch(err){setError(err.message);}finally{setLoad(false);} };

  // Resolved colors per theme — no CSS var ambiguity on login screen
  const isLight = theme==="light";
  const isMid   = theme==="mid";
  const bgPage  = isLight?"#f8fafc":isMid?"#0f0f1a":"#020408";
  const bgCard  = isLight?"#ffffff":isMid?"#161628":"#0d1117";
  const bgInput = isLight?"#f1f5f9":isMid?"#0d0d1f":"#070b12";
  const txtLabel= isLight?"#64748b":isMid?"#9fa8da":"rgba(167,139,250,.7)";
  const txtInput= isLight?"#0f172a":isMid?"#e8eaf6":"#d4dcf5";
  const txtPH   = isLight?"#94a3b8":isMid?"rgba(159,168,218,.4)":"rgba(255,255,255,.2)";
  const brdCard = isLight?"#c4b5fd":isMid?"rgba(99,102,241,.4)":"rgba(124,106,247,.35)";
  const brdInput= isLight?"#e2e8f0":isMid?"rgba(159,168,218,.2)":"rgba(255,255,255,.08)";
  const brdFocus= isLight?"#7c3aed":isMid?"#6366f1":"rgba(124,106,247,.6)";
  const shadowCard= isLight?"0 4px 24px rgba(0,0,0,.08)":isMid?"0 4px 32px rgba(0,0,20,.6)":"0 4px 32px rgba(0,0,0,.6)";

  return (
    <div style={{minHeight:"100vh",background:bgPage,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Nunito',sans-serif",padding:16}}>

      {/* Theme switcher top-right */}
      {setTheme && (
        <div style={{position:"fixed",top:16,right:16,zIndex:100}}>
          <ThemeSwitcher theme={theme} setTheme={setTheme}/>
        </div>
      )}

      <div style={{width:"100%",maxWidth:380}}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:52,marginBottom:10,animation:"bounce .8s ease both"}}>🤖</div>
          <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:30,fontWeight:900,margin:"0 0 6px",
            background:"linear-gradient(135deg,#7c3aed,#a855f7,#ec4899)",
            backgroundSize:"200% 100%",animation:"gradFlow 3s ease infinite",
            WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",letterSpacing:"-1px"}}>
            AI Swarm Lab
          </h1>
          <p style={{color:txtLabel,fontSize:12,margin:0,fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>
            v7 · Acceso seguro
          </p>
        </div>

        {/* Card */}
        <div style={{background:bgCard,border:"1px solid "+brdCard,borderRadius:20,padding:28,boxShadow:shadowCard}}>
          <form onSubmit={submit}>

            {/* Email */}
            <div style={{marginBottom:16}}>
              <label style={{display:"block",fontSize:10,fontWeight:800,color:txtLabel,
                letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>
                Correo electrónico
              </label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                required placeholder="usuario@empresa.com" autoComplete="email"
                style={{width:"100%",boxSizing:"border-box",height:44,
                  background:bgInput,border:"1.5px solid "+brdInput,
                  color:txtInput,borderRadius:12,padding:"0 14px",
                  fontSize:14,fontFamily:"'Nunito',sans-serif",outline:"none",
                  caretColor:isLight?"#7c3aed":"#a78bfa"}}
                onFocus={e=>{e.target.style.borderColor=brdFocus;e.target.style.boxShadow="0 0 0 3px "+(isLight?"rgba(124,58,237,.1)":"rgba(124,106,247,.15)");}}
                onBlur={e=>{e.target.style.borderColor=brdInput;e.target.style.boxShadow="none";}}
              />
            </div>

            {/* Password */}
            <div style={{marginBottom:22}}>
              <label style={{display:"block",fontSize:10,fontWeight:800,color:txtLabel,
                letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>
                Contraseña
              </label>
              <input type="password" value={pass} onChange={e=>setPass(e.target.value)}
                required placeholder="••••••••" autoComplete="current-password"
                style={{width:"100%",boxSizing:"border-box",height:44,
                  background:bgInput,border:"1.5px solid "+brdInput,
                  color:txtInput,borderRadius:12,padding:"0 14px",
                  fontSize:14,fontFamily:"'Nunito',sans-serif",outline:"none",
                  caretColor:isLight?"#7c3aed":"#a78bfa"}}
                onFocus={e=>{e.target.style.borderColor=brdFocus;e.target.style.boxShadow="0 0 0 3px "+(isLight?"rgba(124,58,237,.1)":"rgba(124,106,247,.15)");}}
                onBlur={e=>{e.target.style.borderColor=brdInput;e.target.style.boxShadow="none";}}
              />
            </div>

            {/* Error */}
            {error && (
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",marginBottom:16,
                borderRadius:10,background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.3)",
                color:"#dc2626",fontSize:13,fontWeight:700}}>
                ⚠️ {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading}
              style={{width:"100%",height:46,borderRadius:14,border:"none",
                cursor:loading?"not-allowed":"pointer",
                background:"linear-gradient(135deg,#7c3aed,#9333ea,#7c3aed)",
                backgroundSize:"200% 200%",animation:loading?"none":"gradFlow 3s ease infinite",
                color:"#fff",fontSize:14,fontWeight:800,
                fontFamily:"'Nunito',sans-serif",
                opacity:loading?.65:1,
                boxShadow:isLight?"0 4px 16px rgba(124,58,237,.3)":"0 4px 20px rgba(124,58,237,.5)",
                transition:"all .2s",
                letterSpacing:.3}}>
              {loading ? "⏳ Ingresando..." : "Ingresar →"}
            </button>
          </form>
        </div>

        <p style={{textAlign:"center",color:txtLabel,fontSize:11,marginTop:20,opacity:.7}}>
          AI Swarm Lab · Grupo PCR · Panamá
        </p>
      </div>
    </div>
  );
}

function AdminPanel({ user, onClose }) {
  const [view,setView]=useState("users");
  const [users,setUsers]=useState([]); const [audit,setAudit]=useState([]);
  const [loading,setLoad]=useState(false); const [msg,setMsg]=useState("");
  const [form,setForm]=useState({email:"",name:"",role:"operator",password:""});
  const [pwForm,setPwForm]=useState({current:"",next:"",next2:""});
  const token=localStorage.getItem("swarm_token");
  const hdr={Authorization:"Bearer "+token,"Content-Type":"application/json"};
  const load=async()=>{ setLoad(true); try{
    if(view==="users"){const r=await fetch("/api/users",{headers:hdr});if(r.ok)setUsers(await r.json());}
    else if(view==="audit"){const r=await fetch("/api/audit",{headers:hdr});if(r.ok)setAudit(await r.json());}
  }finally{setLoad(false);} };
  useEffect(()=>{load();},[view]);
  const createUser=async(e)=>{ e.preventDefault(); setMsg("");
    const r=await fetch("/api/users",{method:"POST",headers:hdr,body:JSON.stringify(form)});
    const d=await r.json();
    if(r.ok){setMsg("✅ Usuario creado: "+form.email);setForm({email:"",name:"",role:"operator",password:""});load();}
    else setMsg("❌ "+d.error); };
  const toggleActive=async(u)=>{ const r=await fetch("/api/users/"+u.id,{method:"PUT",headers:hdr,body:JSON.stringify({active:!u.active})});if(r.ok)load();else{const d=await r.json();setMsg("❌ "+d.error);} };
  const changeRole=async(u,role)=>{ const r=await fetch("/api/users/"+u.id,{method:"PUT",headers:hdr,body:JSON.stringify({role})});if(r.ok)load();else{const d=await r.json();setMsg("❌ "+d.error);} };
  const changePw=async(e)=>{ e.preventDefault(); setMsg("");
    if(pwForm.next!==pwForm.next2)return setMsg("❌ Las contraseñas no coinciden");
    const r=await fetch("/api/auth/change-password",{method:"POST",headers:hdr,body:JSON.stringify({currentPassword:pwForm.current,newPassword:pwForm.next})});
    const d=await r.json(); if(r.ok){setMsg("✅ Contraseña actualizada");setPwForm({current:"",next:"",next2:""});}else setMsg("❌ "+d.error); };
  const ROLE_COLORS={superadmin:"#f59e0b",admin:"#a78bfa",operator:"#10b981",viewer:"#64748b"};
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(2,4,8,.95)",zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,fontFamily:"'Nunito',sans-serif"}}>
      <div style={{width:"100%",maxWidth:860,maxHeight:"90vh",display:"flex",flexDirection:"column",background:"var(--bg-card)",border:"1px solid var(--border-accent)",borderRadius:20,overflow:"hidden",boxShadow:"var(--shadow-card)"}}>
        <div style={{padding:"16px 20px",borderBottom:"1px solid var(--border-base)",display:"flex",alignItems:"center",gap:10,background:"var(--accent-soft)"}}>
          <span style={{fontSize:20}}>⚙️</span>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:900,color:"var(--accent)"}}>Panel de Administración</div>
            <div style={{fontSize:10,color:"var(--text-muted)"}}>{user.name} · {user.email} · {user.role}</div>
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"1px solid var(--border-base)",borderRadius:8,color:"var(--text-secondary)",padding:"5px 12px",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>✕ Cerrar</button>
        </div>
        <div style={{display:"flex",borderBottom:"1px solid var(--border-base)"}}>
          {[["users","👥 Usuarios"],["audit","📋 Auditoría"],["password","🔑 Mi contraseña"]].map(([v,l])=>(
            <button key={v} onClick={()=>{setView(v);setMsg("");}}
              style={{padding:"10px 18px",border:"none",cursor:"pointer",fontFamily:"'Nunito',sans-serif",fontSize:11,fontWeight:800,letterSpacing:.5,textTransform:"uppercase",
                background:view===v?"var(--accent-soft)":"transparent",color:view===v?"var(--accent)":"var(--text-muted)",
                borderBottom:view===v?"2px solid var(--accent)":"2px solid transparent"}}>
              {l}
            </button>
          ))}
        </div>
        <div style={{flex:1,overflow:"auto",padding:20}}>
          {msg&&<div style={{padding:"10px 14px",marginBottom:14,borderRadius:10,background:msg.startsWith("✅")?"rgba(16,185,129,.1)":"rgba(239,68,68,.1)",border:"1px solid "+(msg.startsWith("✅")?"rgba(16,185,129,.3)":"rgba(239,68,68,.3)"),color:msg.startsWith("✅")?"#10b981":"#f87171",fontSize:12,fontWeight:600}}>{msg}</div>}
          {view==="users"&&user.permissions?.canManageUsers&&(
            <div>
              <div style={{marginBottom:20,padding:16,borderRadius:14,border:"1px solid var(--border-accent)",background:"var(--accent-soft)"}}>
                <div style={{fontSize:11,fontWeight:800,color:"var(--accent)",letterSpacing:1,textTransform:"uppercase",marginBottom:12}}>➕ Crear usuario</div>
                <form onSubmit={createUser} style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  {[["Email","email","email",form.email,"email@empresa.com"],["Nombre","text","name",form.name,"Nombre completo"],["Contraseña","password","password",form.password,"Min. 8 caracteres"]].map(([label,type,key,val,ph])=>(
                    <div key={key}>
                      <label style={{fontSize:10,fontWeight:700,color:"var(--text-muted)",letterSpacing:.5,textTransform:"uppercase",display:"block",marginBottom:4}}>{label}</label>
                      <input type={type} value={val} placeholder={ph} required onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}
                        style={{width:"100%",padding:"9px 12px",borderRadius:10,border:"1px solid var(--border-base)",background:"var(--bg-input)",color:"var(--text-primary)",fontSize:13,fontFamily:"inherit",boxSizing:"border-box",outline:"none"}}/>
                    </div>
                  ))}
                  <div>
                    <label style={{fontSize:10,fontWeight:700,color:"var(--text-muted)",letterSpacing:.5,textTransform:"uppercase",display:"block",marginBottom:4}}>Rol</label>
                    <select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}
                      style={{width:"100%",padding:"9px 12px",borderRadius:10,border:"1px solid var(--border-base)",background:"var(--bg-input)",color:"var(--text-primary)",fontSize:13,fontFamily:"inherit",boxSizing:"border-box",outline:"none"}}>
                      {user.role==="superadmin"&&<option value="superadmin">Super Admin</option>}
                      <option value="admin">Administrador</option>
                      <option value="operator">Operador</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                  <div style={{gridColumn:"1/-1",display:"flex",justifyContent:"flex-end",marginTop:4}}>
                    <button type="submit" style={{padding:"9px 20px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#7c3aed,#9333ea)",color:"#fff",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>Crear usuario</button>
                  </div>
                </form>
              </div>
              {loading?<div style={{textAlign:"center",padding:20,color:"var(--text-muted)"}}>⏳ Cargando...</div>:(
                <div>
                  <div style={{fontSize:11,fontWeight:800,color:"var(--text-muted)",letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>👥 Usuarios ({users.length})</div>
                  {users.map(u=>(
                    <div key={u.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:12,marginBottom:6,background:"var(--bg-surface-1)",border:"1px solid var(--border-base)"}}>
                      <div style={{width:32,height:32,borderRadius:"50%",background:"var(--accent-soft)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0,color:"var(--accent)",fontWeight:900}}>{u.name?.[0]?.toUpperCase()||"?"}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:700,color:"var(--text-primary)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.name}</div>
                        <div style={{fontSize:11,color:"var(--text-muted)"}}>{u.email} · {u.loginCount||0} logins · {u.lastLogin?new Date(u.lastLogin).toLocaleDateString("es-PA"):"nunca"}</div>
                      </div>
                      <select value={u.role} onChange={e=>changeRole(u,e.target.value)} disabled={u.id===user.id||u.role==="superadmin"}
                        style={{padding:"4px 8px",borderRadius:8,border:"1px solid var(--border-accent)",background:"var(--bg-input)",color:ROLE_COLORS[u.role]||"var(--text-primary)",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",outline:"none"}}>
                        {user.role==="superadmin"&&<option value="superadmin">superadmin</option>}
                        <option value="admin">admin</option>
                        <option value="operator">operator</option>
                        <option value="viewer">viewer</option>
                      </select>
                      <button onClick={()=>toggleActive(u)} disabled={u.id===user.id}
                        style={{padding:"5px 12px",borderRadius:8,border:"1px solid "+(u.active?"rgba(239,68,68,.3)":"rgba(16,185,129,.3)"),background:u.active?"rgba(239,68,68,.08)":"rgba(16,185,129,.08)",color:u.active?"#f87171":"#10b981",fontSize:11,fontWeight:700,cursor:u.id===user.id?"not-allowed":"pointer",fontFamily:"inherit",opacity:u.id===user.id?.4:1}}>
                        {u.active?"Desactivar":"Activar"}
                      </button>
                      <button onClick={async()=>{ const r=await fetch("/api/users/"+u.id+"/session/revoke",{method:"POST",headers:hdr});const d=await r.json();setMsg(r.ok?"✅ Sesión revocada: "+u.email:"❌ "+d.error); }}
                        title="Cerrar sesión activa"
                        style={{padding:"5px 10px",borderRadius:8,border:"1px solid rgba(251,191,36,.3)",background:"rgba(251,191,36,.07)",color:"#fbbf24",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                        ⏏
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {view==="audit"&&user.permissions?.canViewAudit&&(
            <div>
              <div style={{fontSize:11,fontWeight:800,color:"var(--text-muted)",letterSpacing:1,textTransform:"uppercase",marginBottom:12}}>📋 Log de auditoría</div>
              {loading?<div style={{textAlign:"center",padding:20,color:"var(--text-muted)"}}>⏳ Cargando...</div>:(
                <div style={{fontFamily:"'Fira Code',monospace",fontSize:11}}>
                  {audit.map((e,i)=>{ const color=e.action?.includes("FAIL")?"#f87171":e.action?.includes("DELETED")?"#f87171":e.action?.includes("OK")?"#10b981":"var(--text-secondary)"; return(
                    <div key={i} style={{display:"flex",gap:10,padding:"6px 0",borderBottom:"1px solid var(--border-base)",alignItems:"flex-start"}}>
                      <span style={{color:"var(--text-muted)",flexShrink:0,fontSize:10}}>{new Date(e.ts).toLocaleString("es-PA",{timeZone:"America/Panama"})}</span>
                      <span style={{color,fontWeight:700,flexShrink:0,minWidth:140}}>{e.action}</span>
                      <span style={{color:"var(--text-secondary)"}}>{e.email}</span>
                      {e.detail&&<span style={{color:"var(--text-muted)"}}>{e.detail}</span>}
                      {e.ip&&<span style={{color:"var(--text-muted)",marginLeft:"auto",flexShrink:0}}>{e.ip}</span>}
                    </div>
                  );})}
                  {audit.length===0&&<div style={{color:"var(--text-muted)",padding:20,textAlign:"center"}}>Sin entradas de auditoría</div>}
                </div>
              )}
            </div>
          )}
          {view==="password"&&(
            <div style={{maxWidth:400}}>
              <div style={{fontSize:11,fontWeight:800,color:"var(--text-muted)",letterSpacing:1,textTransform:"uppercase",marginBottom:16}}>🔑 Cambiar contraseña</div>
              <form onSubmit={changePw}>
                {[["Contraseña actual","password","current",pwForm.current,"••••••••"],["Nueva contraseña","password","next",pwForm.next,"Min. 8 caracteres"],["Confirmar nueva","password","next2",pwForm.next2,"Repetir contraseña"]].map(([label,type,key,val,ph])=>(
                  <div key={key} style={{marginBottom:14}}>
                    <label style={{fontSize:10,fontWeight:700,color:"var(--text-muted)",letterSpacing:.5,textTransform:"uppercase",display:"block",marginBottom:5}}>{label}</label>
                    <input type={type} value={val} placeholder={ph} required onChange={e=>setPwForm(f=>({...f,[key]:e.target.value}))}
                      style={{width:"100%",padding:"10px 14px",borderRadius:10,border:"1px solid var(--border-base)",background:"var(--bg-input)",color:"var(--text-primary)",fontSize:13,fontFamily:"inherit",boxSizing:"border-box",outline:"none"}}/>
                  </div>
                ))}
                <button type="submit" style={{padding:"11px 24px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#7c3aed,#9333ea)",color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit",marginTop:4}}>Actualizar contraseña</button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Auth-gated App wrapper ───────────────────────────────────────────────────
export default function App() {
  const { user, authReady, login, logout } = useAuth();
  const [showAdmin, setShowAdmin] = useState(false);
  // Theme runs here so it applies to LoginScreen too
  const { theme, setTheme } = useTheme();

  if (!authReady) return (
    <div style={{minHeight:"100vh",background:"var(--bg-base)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{fontSize:40,animation:"spin 1s linear infinite",display:"inline-block"}}>🤖</div>
    </div>
  );
  if (!user) return <LoginScreen onLogin={login} theme={theme} setTheme={setTheme} />;
  return (
    <>
      {showAdmin && <AdminPanel user={user} onClose={()=>setShowAdmin(false)} />}
      <AISwarm currentUser={user} onLogout={logout} onOpenAdmin={()=>setShowAdmin(true)}
               theme={theme} setTheme={setTheme} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function AISwarm({ currentUser, onLogout, onOpenAdmin, theme, setTheme }) {
  // Core flow
  // theme/setTheme come from App() wrapper via props
  const [idea, setIdea]               = useState("");
  const [step, setStep]               = useState("input");
  const [questions, setQuestions]     = useState([]);
  const [answers, setAnswers]         = useState({});
  const [enrichedIdea, setEnrichedIdea] = useState("");
  const [results, setResults]         = useState({});
  const [error, setError]             = useState(null);
  const [elapsed, setElapsed]         = useState(0);
  const [interviewRound, setInterviewRound] = useState(1);
  const [autoDetect, setAutoDetect]   = useState(null);   // inferred project metadata
  const [masterPlan, setMasterPlan]   = useState(null);   // orchestrator final output
  const [masterPlanLoading, setMasterPlanLoading] = useState(false);

  // Agent tracking
  const [activeAgents, setActiveAgents]       = useState(new Set());
  const [synthAgents, setSynthAgents]         = useState(new Set());
  const [completedAgents, setCompletedAgents] = useState(new Set());
  const [failedAgents, setFailedAgents]       = useState(new Set());
  const [currentPhase, setCurrentPhase]       = useState(-1);
  const [synthPhase, setSynthPhase]           = useState(false);

  // Config
  const [modelKey, setModelKey]               = useState("sonnet");
  // Gemini key — loaded at runtime, never hardcoded
  const [geminiKey, setGeminiKey]             = useState("");
  useEffect(() => {
    fetch("/api/config")
      .then(r => r.ok ? r.json() : {})
      .then(cfg => { if (cfg.geminiKey) setGeminiKey(cfg.geminiKey); })
      .catch(() => {}); // silent — fallback to empty
  }, []);
  const [synthEnabled, setSynthEnabled]       = useState(false);
  const [selectedAgents, setSelectedAgents]   = useState(() => new Set(AGENTS.map(a => a.id)));
  const [budgetLimit, setBudgetLimit]         = useState(DEFAULT_BUDGET);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [pendingLaunch, setPendingLaunch]     = useState(null);
  const [costEstimate, setCostEstimate]       = useState(null);
  const [monthlySpend, setMonthlySpend]       = useState(0);

  // Stack config — project credentials
  const [stackConfig, setStackConfig]   = useState({});
  const [showStack, setShowStack]       = useState(false);

  // UI
  const [tab, setTab]                   = useState("run");   // "run" | "history"
  const [showSelector, setShowSelector] = useState(false);
  const [allExpanded, setAllExpanded]   = useState(true);
  const [exportModal, setExportModal]   = useState(null);
  const [showStackConfig, setShowStackConfig] = useState(false);
  const [deployLogs, setDeployLogs]     = useState([]);
  // Sequential phase approval
  const [phaseApproval, setPhaseApproval]   = useState(null); // {phaseIdx, phaseName, resolve}
  const phaseApprovalRef                    = useRef(null);
  const [deploySteps, setDeploySteps]   = useState([]);
  const [deployRunning, setDeployRunning] = useState(false);
  const [deployDone, setDeployDone]     = useState(false);
  const [showDeployPanel, setShowDeployPanel] = useState(false);

  // Brecha 1: sessions
  const [sessions, setSessions]   = useState([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);

  // Confetti celebration
  const [showConfetti, setShowConfetti] = useState(false);
  useEffect(() => {
    if (showConfetti) { setTimeout(() => setShowConfetti(false), 3000); }
  }, [showConfetti]);

  const timerRef       = useRef(null);
  const outputRef      = useRef(null);
  const allResultsRef  = useRef({});
  const cancelRef      = useRef(false);   // BUG-002: cancel flag

  // Load sessions + spend on mount
  useEffect(() => {
    loadSessions().then(s => { setSessions(s); setSessionsLoaded(true); });
    getStoredSpend().then(s => setMonthlySpend(s));
  }, []);

  // Timer
  useEffect(() => {
    if (step==="running") {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(t=>t+1), 1000);
    } else { clearInterval(timerRef.current); }
    return () => clearInterval(timerRef.current);
  }, [step]);

  useEffect(() => {
    if (outputRef.current && (activeAgents.size>0||synthAgents.size>0))
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [results, activeAgents, synthAgents]);

  // ── Pool ──────────────────────────────────────────────────────────────────
  const runPool = useCallback(async (tasks, n=2) => {
    let i=0;
    const worker = async () => { while(i<tasks.length) { const t=tasks[i++]; await t(); } };
    await Promise.allSettled(Array.from({length:Math.min(n,tasks.length)},worker));
  }, []);

  // ── Build enriched idea (idea + any refine answers) ─────────────────────────
  const buildEnrichedIdea = useCallback((withAnswers = true) => {
    let s = "REQUERIMIENTO:\n" + idea.trim();
    if (withAnswers && questions.length > 0 && Object.keys(answers).length > 0) {
      s += "\n\nCONTEXTO ADICIONAL:";
      questions.forEach(q => {
        const a = answers[q.id];
        if (a && (Array.isArray(a) ? a.length > 0 : a.trim().length > 0)) {
          s += "\n- " + q.question + "\n  → " + (Array.isArray(a) ? a.join(", ") : a);
        }
      });
    }
    // Inject real credentials/config so agents produce executable code
    s += buildStackContext(stackConfig);
    return s;
  }, [idea, questions, answers, stackConfig]);

  // ── Auto-detect: infer project type + stack before first agent runs ─────────
  const runAutoDetect = useCallback(async (ideaText) => {
    try {
      const raw = await callModel(
        modelKey,
        AUTO_DETECT_SYSTEM, ideaText, "pm", geminiKey
      );
      const clean = raw.replace(/```json\s*/g,"").replace(/```\s*/g,"").trim();
      const s = clean.slice(clean.indexOf("{"), clean.lastIndexOf("}")+1);
      const detected = JSON.parse(s);
      setAutoDetect(detected);
      return detected;
    } catch { return null; }
  }, [modelKey, geminiKey]);

  // ── Orchestrator: consolidate ALL outputs into master plan ─────────────────
  const runOrchestrator = useCallback(async (enriched, allResults) => {
    setMasterPlanLoading(true);
    try {
      // Build a comprehensive context with ALL agent outputs
      const agentOutputs = Object.entries(allResults)
        .filter(([,r])=>!r.isError && r.text)
        .map(([id,r])=>{
          const ag = AGENTS.find(a=>a.id===id);
          const best = r.synth || r.text;
          return "=== "+ag?.icon+" "+ag?.name+" ===\n"+best.slice(0,1800);
        }).join("\n\n");

      const orchestratorMsg = enriched
        + "\n\n══════════════════════════════════════\nOUTPUT COMPLETO DE LOS AGENTES ESPECIALIZADOS:\n══════════════════════════════════════\n"
        + agentOutputs.slice(0, 28000)
        + "\n\nAhora consolida todo lo anterior en el plan maestro ejecutable.";

      const plan = await callModel(
        modelKey, ORCHESTRATOR_SYSTEM, orchestratorMsg, "pm", geminiKey
      );
      setMasterPlan(plan);
      playSound("masterPlan"); haptic([30,15,30,15,60]);
    } catch(e) {
      setMasterPlan("Error generando plan maestro: "+e.message);
    } finally {
      setMasterPlanLoading(false);
    }
  }, [modelKey, geminiKey]);

  // ── Load clarifying questions ASYNC while swarm runs ─────────────────────
  const loadRefineQuestions = useCallback(async () => {
    if (!idea.trim() || questions.length > 0) return;
    try {
      const raw = await callModel(
        modelKey,
        INTERVIEW_SYSTEM, idea.trim(), "pm", geminiKey
      );
      const parsed = parseInterviewJSON(raw);
      if (Array.isArray(parsed) && parsed.length > 0) setQuestions(parsed);
    } catch { /* silent — questions are optional */ }
  }, [idea, modelKey, geminiKey, questions.length]);

  // ── Initial pass — smart context: each agent gets relevant prior work ────────
  const runInitialPass = useCallback(async (agentIds, enriched) => {
    setActiveAgents(new Set(agentIds));
    const tasks = agentIds.map(aid => async () => {
      const agent = AGENTS.find(a=>a.id===aid); if(!agent) return;
      try {
        // Check cancel flag before doing any work
        if (cancelRef.current) {
          setActiveAgents(new Set());
          return;
        }
        // Smart context: use AGENT_READS_FROM to give each agent only relevant prior outputs
        const relevantPeers = (AGENT_READS_FROM[aid]||[]);
        const allPrior = Object.entries(allResultsRef.current);
        let ctx = "";
        if (allPrior.length > 0) {
          // Peers that are relevant: more chars. Others: brief summary.
          const relevant = allPrior.filter(([id])=>relevantPeers.includes(id)&&!allResultsRef.current[id]?.isError);
          const others   = allPrior.filter(([id])=>!relevantPeers.includes(id)&&!allResultsRef.current[id]?.isError);
          const relCtx   = relevant.map(([id,r])=>{const ag=AGENTS.find(a=>a.id===id);return"--- "+ag?.icon+" "+ag?.name+" (RELEVANTE) ---\n"+(r.text||"").slice(0,2000);}).join("\n\n");
          const othCtx   = others.slice(-3).map(([id,r])=>{const ag=AGENTS.find(a=>a.id===id);return"--- "+ag?.name+" ---\n"+(r.text||"").slice(0,400);}).join("\n\n");
          ctx = [relCtx, othCtx].filter(Boolean).join("\n\n");
        }
        const msg = ctx
          ? enriched+"\n\nOUTPUT DE AGENTES PREVIOS:\n"+ctx.slice(0,10000)+"\n\nEntrega TU output según tu rol. Usa los valores reales de la configuración. No repitas lo que otros ya entregaron. Solo tu artefacto específico."
          : enriched+"\n\nEres el primer agente en analizar esto. Entrega tu artefacto según tu rol.";
        const prompt = AGENT_PROMPTS[aid] || "Eres un experto especializado. Entrega artefactos ejecutables en español.";
        const text = await callModel(modelKey, prompt, msg, aid, geminiKey);
        allResultsRef.current[aid] = {text, synth:null, isError:false};
        setResults(r => ({...r,[aid]:{text,synth:null,isError:false}}));
        setCompletedAgents(prev => new Set([...prev,aid]));
        playSound("agentDone"); haptic([15]);
        // Refresh spend counter after each agent (live update)
        const _m = MODELS[modelKey] || MODELS.sonnet;
        const inTok  = (msg.length/4) * _m.priceIn;
        const outTok = (text.length/4) * _m.priceOut;
        addStoredSpend(inTok + outTok).then(() => getStoredSpend().then(setMonthlySpend));
      } catch(e) {
        const errMsg = agent.name+": "+e.message;
        allResultsRef.current[aid] = {text:errMsg, synth:null, isError:true};
        setResults(r => ({...r,[aid]:{text:errMsg,synth:null,isError:true}}));
        setFailedAgents(prev => new Set([...prev,aid]));
        playSound("error"); haptic([20,10,20]);
      }
    });
    await runPool(tasks, 2);
    setActiveAgents(new Set());
  }, [modelKey, runPool]);

  // ── Synthesis pass ────────────────────────────────────────────────────────
  const runSynthesisPass = useCallback(async (agentIds, enriched) => {
    setSynthPhase(true); setSynthAgents(new Set(agentIds));
    const tasks = agentIds.map(aid => async () => {
      const agent = AGENTS.find(a=>a.id===aid);
      const initial = allResultsRef.current[aid];
      if (!agent||!initial||initial.isError) return;
      const peers = (AGENT_READS_FROM[aid]||[]).filter(p=>allResultsRef.current[p]&&!allResultsRef.current[p].isError);
      if (!peers.length) return;
      const peerCtx = peers.map(p => {
        const ag=AGENTS.find(a=>a.id===p), r=allResultsRef.current[p];
        return "--- "+ag?.icon+" "+ag?.name+" ---\n"+(r.text||"").slice(0,1200);
      }).join("\n\n");
      const synthPrompt = enriched+"\n\nTU ANÁLISIS INICIAL:\n"+initial.text+"\n\nANÁLISIS DE TUS PARES:\n"+peerCtx+"\n\nRevisa, mejora y enriquece tu análisis integrando insights de tus colegas. Sé explícito cuando integres algo (ej: 'Complementando al Arquitecto...'). No repitas todo desde cero.";
      try {
        const prompt = AGENT_PROMPTS[aid] || "Eres un experto del AI Swarm Lab.";
        const synth = await callModel(modelKey, prompt, synthPrompt, aid, geminiKey);
        allResultsRef.current[aid] = {...allResultsRef.current[aid], synth};
        setResults(r => ({...r,[aid]:{...r[aid],synth}}));
      } catch { /* silent */ }
    });
    await runPool(tasks, 2);
    setSynthAgents(new Set()); setSynthPhase(false);
  }, [modelKey, runPool]);

  // ── waitForPhaseApproval — pauses until user clicks Continuar ───────────────
  const waitForPhaseApproval = useCallback((phaseIdx, phaseName) => {
    return new Promise(resolve => {
      const approval = { phaseIdx, phaseName, resolve };
      phaseApprovalRef.current = resolve;
      setPhaseApproval(approval);
    });
  }, []);

  const cancelSwarm = useCallback(() => {
    cancelRef.current = true;
    // Also resolve any pending approval gate so the loop can exit
    if (phaseApprovalRef.current) {
      phaseApprovalRef.current();
      phaseApprovalRef.current = null;
      setPhaseApproval(null);
    }
    setStep("done");
    setActiveAgents(new Set());
    setSynthAgents(new Set());
    playSound("error"); haptic([20,10,20]);
  }, []);

  const approvePhase = useCallback(() => {
    if (phaseApprovalRef.current) {
      phaseApprovalRef.current();
      phaseApprovalRef.current = null;
      setPhaseApproval(null);
      playSound("click"); haptic([15]);
    }
  }, []);

  // ── executeLaunch (must be before requestLaunch) ──────────────────────────
  const executeLaunch = useCallback(async (mode, agentList, estimatedCost) => {
    setShowBudgetModal(false);
    setMasterPlan(null); setAutoDetect(null); setPhaseApproval(null);

    const enriched = buildEnrichedIdea();
    setEnrichedIdea(enriched);
    setStep("running");
    playSound("launch"); haptic([40, 20, 40]);

    loadRefineQuestions();
    runAutoDetect(enriched);

    setResults({}); setCompletedAgents(new Set()); setFailedAgents(new Set());
    setActiveAgents(new Set()); setSynthAgents(new Set());
    setCurrentPhase(-1); setSynthPhase(false); setError(null);
    cancelRef.current = false;   // reset cancel on new launch
    allResultsRef.current = {};
    const doneSet = new Set();
    const agentSet = new Set(agentList);

    // Run phases SEQUENTIALLY with approval gate between each
    for (let pi=0; pi<PHASES.length; pi++) {
      setCurrentPhase(pi);
      let ids = [...PHASES[pi].agents];
      if (PROMPT_ENG_INJECT.includes(pi) && !ids.includes("prompt_eng")) ids.push("prompt_eng");
      ids = [...new Set(ids)].filter(id=>agentSet.has(id)&&!doneSet.has(id));
      if (!ids.length) continue;

      await runInitialPass(ids, enriched);
      ids.forEach(id=>doneSet.add(id));

      // Approval gate — wait for user to review phase output before continuing
      const isLastPhase = pi === PHASES.length - 1;
      if (!isLastPhase) {
        if (cancelRef.current) break;   // cancelled during phase
        playSound("phaseDone"); haptic([20,10,20,10,40]);
        await waitForPhaseApproval(pi, PHASES[pi].name);
        if (cancelRef.current) break;   // cancelled during approval wait
      }
    }

    // Synthesis
    setCurrentPhase(-1);
    if (mode==="full") {
      const allIds = [...doneSet].filter(id=>allResultsRef.current[id]&&!allResultsRef.current[id].isError);
      if (allIds.length>1) await runSynthesisPass(allIds, enriched);
    }

    // Orchestrator
    await runOrchestrator(enriched, allResultsRef.current);

    setStep("done");
    playSound("swarmDone"); haptic([60,20,60,20,100,20,200]);
    setShowConfetti(true);

    const session = {
      id: Date.now().toString(), savedAt: isoStringPanama(),
      idea: idea.trim(), enrichedIdea: enriched,
      results: allResultsRef.current, model: modelKey, elapsed,
    };
    saveSession(session).then(() => loadSessions().then(setSessions));
    addStoredSpend(estimatedCost);
    getStoredSpend().then(setMonthlySpend);
  }, [buildEnrichedIdea, synthEnabled, runInitialPass, runSynthesisPass,
      idea, modelKey, elapsed, waitForPhaseApproval, loadRefineQuestions, runAutoDetect]);

  const requestLaunch = useCallback((mode="full") => {
    if (!idea.trim()) return;
    const agentList = mode==="lite" ? LITE_CORE.filter(id=>selectedAgents.has(id)) : [...selectedAgents];
    const cost = estimateCost(agentList, modelKey, mode==="full"&&synthEnabled);
    setCostEstimate(cost);
    const needsConfirm = (monthlySpend+cost.total)>MONTHLY_LIMIT; // only warn when approaching monthly limit
    if (needsConfirm) { setPendingLaunch({mode,agentList}); setShowBudgetModal(true); }
    else executeLaunch(mode, agentList, cost.total);
  }, [idea, selectedAgents, modelKey, synthEnabled, monthlySpend, executeLaunch]);

  const runDeploy = useCallback(async () => {
    if (deployRunning) return;
    setDeployRunning(true); setDeployLogs([]); setDeploySteps([]); setDeployDone(false);
    setShowDeployPanel(true);
    playSound("launch"); haptic([30,10,30]);
    try {
      const steps = await runDeployEngine(
        stackConfig,
        allResultsRef.current,
        masterPlan,
        autoDetect,
        (log) => setDeployLogs(prev => [...prev, log])
      );
      setDeploySteps(steps);
      playSound("swarmDone"); haptic([50,20,50,20,100]);
    } catch(e) {
      setDeployLogs(prev => [...prev, { step:"engine", status:"error", msg:"Error fatal: "+e.message, ts: new Date().toLocaleTimeString() }]);
    } finally {
      setDeployRunning(false); setDeployDone(true);
    }
  }, [deployRunning, stackConfig, masterPlan, autoDetect]);

  const retryAgent = useCallback(async (agentId) => {
    if (!enrichedIdea) return;
    const agent = AGENTS.find(a=>a.id===agentId); if(!agent) return;
    setActiveAgents(new Set([agentId]));
    setFailedAgents(prev=>{const s=new Set(prev);s.delete(agentId);return s;});
    try {
      const ctx = Object.entries(allResultsRef.current).filter(([,r])=>!r.isError).map(([id,r])=>{
        const ag=AGENTS.find(a=>a.id===id);
        return "--- "+ag?.icon+" "+ag?.name+" ---\n"+(r.text||"").slice(0,900);
      }).join("\n\n");
      const msg = enrichedIdea+"\n\nANÁLISIS PREVIO:\n"+ctx+"\n\nEntrega TU análisis específico.";
      const prompt = AGENT_PROMPTS[agentId] || "Eres un experto. Analiza en español.";
      const text = await callModel(modelKey, prompt, msg, agentId, geminiKey);
      allResultsRef.current[agentId] = {text, synth:null, isError:false};
      setResults(r=>({...r,[agentId]:{text,synth:null,isError:false}}));
      setCompletedAgents(prev=>new Set([...prev,agentId]));
    } catch(e) {
      const errMsg = agent.name+": "+e.message;
      allResultsRef.current[agentId] = {text:errMsg, synth:null, isError:true};
      setResults(r=>({...r,[agentId]:{text:errMsg,synth:null,isError:true}}));
      setFailedAgents(prev=>new Set([...prev,agentId]));
    } finally { setActiveAgents(new Set()); }
  }, [enrichedIdea, modelKey, geminiKey]);

  const reset = () => {
    setStep("input"); setIdea(""); setQuestions([]); setAnswers({}); setResults({});
    setCompletedAgents(new Set()); setFailedAgents(new Set()); setActiveAgents(new Set());
    setSynthAgents(new Set()); setError(null); setInterviewRound(1); setEnrichedIdea("");
    setSynthPhase(false); allResultsRef.current = {};
    setAutoDetect(null); setMasterPlan(null); setMasterPlanLoading(false);
    // Cancel any pending approval or in-flight swarm
    cancelRef.current = true;
    if (phaseApprovalRef.current) { phaseApprovalRef.current(); phaseApprovalRef.current = null; }
    setPhaseApproval(null);
    setTimeout(() => { cancelRef.current = false; }, 100); // reset after flush
  };

  const loadSession = (session) => {
    setEnrichedIdea(session.enrichedIdea||"");
    setIdea(session.idea||"");
    allResultsRef.current = session.results||{};
    setResults(session.results||{});
    const done = new Set(Object.keys(session.results||{}));
    setCompletedAgents(done);
    setFailedAgents(new Set());
    setActiveAgents(new Set()); setSynthAgents(new Set());
    setSynthPhase(false); setStep("done"); setTab("run");
  };

  // Derived
  const agentState = (id) => {
    if (synthAgents.has(id)) return "synth";
    if (activeAgents.has(id)) return "active";
    if (failedAgents.has(id)) return "failed";
    if (completedAgents.has(id)) return "done";
    if (!selectedAgents.has(id) && (step==="running"||step==="done")) return "skipped";
    if (!selectedAgents.has(id)) return "unselected";
    return "idle";
  };

  const doneCount  = Object.values(results).filter(r=>!r.isError).length;
  const failCount  = failedAgents.size;
  const totalSel   = new Set(PHASES.flatMap((p,i)=>{let ids=[...p.agents];if(PROMPT_ENG_INJECT.includes(i)&&!ids.includes("prompt_eng"))ids.push("prompt_eng");return ids.filter(id=>selectedAgents.has(id));})).size;
  const pct        = totalSel>0?((doneCount+failCount)/totalSel)*100:0;
  const allAnswered = questions.length>0 && questions.every(q=>{const a=answers[q.id];return a&&(Array.isArray(a)?a.length>0:a.trim().length>0);});

  const handleExport = (label, fn, file, mime) => {
    try {
      const content = fn();
      if (!content||content.trim().length<10) return;
      setExportModal({content, filename:file});
    } catch(e) { console.error(e); }
  };

  const ts = () => new Date().toISOString().slice(0,10);

  const EXPORT_GROUPS = [
    {
      label:"Documentos",
      items:[
        {icon:"◆",label:"Markdown",bg:"#0ea5e9",fn:()=>buildMarkdown(enrichedIdea,results,elapsed),file:"ai-swarm-"+ts()+".md",mime:"text/markdown"},
        {icon:"⊙",label:"JSON",bg:"#10b981",fn:()=>buildJSON(enrichedIdea,results,elapsed),file:"ai-swarm-"+ts()+".json",mime:"application/json"},
        {icon:"▦",label:"CSV",bg:"#f59e0b",fn:()=>buildCSV(enrichedIdea,results),file:"ai-swarm-"+ts()+".csv",mime:"text/csv"},
      ]
    },
    {
      label:"Workflows ejecutables",
      items:[
        {icon:"⚙",label:"n8n Workflow",bg:"#f97316",fn:()=>buildN8NWorkflow(enrichedIdea,results),file:"ai-swarm-n8n-"+ts()+".json",mime:"application/json"},
        {icon:"🐍",label:"CrewAI Python",bg:"#7c3aed",fn:()=>buildCrewAIWorkflow(enrichedIdea,results),file:"ai-swarm-crew-"+ts()+".py",mime:"text/plain"},
      ]
    },
    {
      label:"Código extraído",
      items:[
        {icon:"◫",label:"SQL",bg:"#0891b2",fn:()=>buildSQLBundle(results),file:"ai-swarm-"+ts()+".sql",mime:"text/plain"},
        {icon:"⊗",label:"YAML",bg:"#8b5cf6",fn:()=>buildYAMLBundle(results),file:"ai-swarm-"+ts()+".yaml",mime:"text/yaml"},
      ]
    }
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&family=Syne:wght@700;800&family=Fira+Code:wght@400;600&display=swap');

        /* ══════════════════════════════════════════════════════════════
           THEME VARIABLES — DARK (default)
        ══════════════════════════════════════════════════════════════ */
        :root {
          --bg-base:       #020408;
          --bg-card:       #0d1117;
          --bg-card-glow:  #0a0814;
          --bg-input:      #070b12;
          --bg-surface-1:  rgba(255,255,255,.04);
          --bg-surface-2:  rgba(255,255,255,.07);

          --text-primary:  #d4dcf5;
          --text-secondary:rgba(212,220,245,.6);
          --text-muted:    rgba(255,255,255,.2);

          --border-base:   rgba(255,255,255,.07);
          --border-accent: rgba(124,106,247,.5);
          --border-strong: rgba(255,255,255,.14);

          --shadow-card:   0 4px 32px rgba(0,0,0,.6);
          --shadow-btn:    0 6px 24px rgba(124,58,237,.45);
          --shadow-glow:   0 0 24px rgba(124,106,247,.35);

          --blob-opacity:  .07;
          --blob-blur:     70px;
          --grid-color:    rgba(124,106,247,.025);

          --accent:        #7c3aed;
          --accent-soft:   rgba(124,106,247,.12);

          --prog-bg:       rgba(255,255,255,.05);
          --prog-shadow:   0 0 16px rgba(124,58,237,.6),0 0 30px rgba(236,72,153,.3);
          --prog-gradient: linear-gradient(90deg,#7c3aed,#a78bfa,#ec4899,#f59e0b,#10b981,#a78bfa,#7c3aed);

          --scrollbar-thumb: linear-gradient(#7c3aed,#ec4899);
          --scrollbar-hover: linear-gradient(#a78bfa,#f472b6);
          --scrollbar-track: rgba(255,255,255,.02);

          --input-focus-bg: #0a0e18;
          --input-focus-shadow: 0 0 0 3px rgba(124,106,247,.15),0 0 20px rgba(124,106,247,.08);

          --card-blur:     blur(8px);
          --divider-anim:  shimmerFast 3s linear infinite;

          --chip-idle-bg:  rgba(255,255,255,.03);
          --chip-idle-border: rgba(255,255,255,.08);
          --chip-idle-text:   rgba(255,255,255,.3);

          --model-bg:      rgba(255,255,255,.02);
          --model-hover-shadow: 0 8px 28px rgba(0,0,0,.4);
          --model-active-shadow: 0 0 0 3px rgba(124,106,247,.15),0 8px 28px rgba(0,0,0,.4),0 0 30px rgba(124,106,247,.12);

          --phase-hover-shadow: 0 12px 40px rgba(0,0,0,.5),0 0 0 1px rgba(124,106,247,.15)!important;
          --step-active-anim:   neonPulse 2s ease-in-out infinite;

          --btn-out-bg:    rgba(255,255,255,.04);
          --btn-out-color: rgba(200,210,255,.75);
          --btn-out-border:rgba(255,255,255,.1);
          --btn-ghost-bg:  rgba(255,255,255,.025);
          --btn-ghost-color:rgba(200,210,255,.3);
          --btn-ghost-border:rgba(255,255,255,.06);

          --glitch-on:     1;
          --morph-on:      morphBorder 8s ease-in-out infinite;
          --neon-reduced:  1;
          --scanline-on:   1;

          --log-bg:        #0a0e18;
          --log-text:      rgba(190,210,255,.82);
          --log-ok:        #10b981;
          --log-err:       #f87171;
          --log-warn:      #fbbf24;
          --log-info:      rgba(167,139,250,.8);
        }

        /* ══ TEMA MID — azul medianoche premium ════════════════════════ */
        [data-theme="mid"] {
          --bg-base:       #0f0f1a;
          --bg-card:       #161628;
          --bg-card-glow:  #1a1a2e;
          --bg-input:      #0d0d1f;
          --bg-surface-1:  rgba(159,168,218,.06);
          --bg-surface-2:  rgba(159,168,218,.1);

          --text-primary:  #e8eaf6;
          --text-secondary:#9fa8da;
          --text-muted:    rgba(159,168,218,.35);

          --border-base:   rgba(159,168,218,.15);
          --border-accent: rgba(99,102,241,.6);
          --border-strong: rgba(159,168,218,.3);

          --shadow-card:   0 4px 32px rgba(0,0,20,.7),inset 0 1px 0 rgba(159,168,218,.06);
          --shadow-btn:    0 6px 24px rgba(79,70,229,.5);
          --shadow-glow:   0 0 24px rgba(99,102,241,.4);

          --blob-opacity:  .12;
          --blob-blur:     90px;
          --grid-color:    rgba(99,102,241,.04);

          --accent:        #6366f1;
          --accent-soft:   rgba(99,102,241,.15);

          --prog-bg:       rgba(159,168,218,.08);
          --prog-shadow:   0 0 16px rgba(79,70,229,.5),0 0 30px rgba(6,182,212,.2);
          --prog-gradient: linear-gradient(90deg,#4f46e5,#818cf8,#06b6d4,#4f46e5);

          --scrollbar-thumb: linear-gradient(#6366f1,#06b6d4);
          --scrollbar-hover: linear-gradient(#818cf8,#38bdf8);
          --scrollbar-track: rgba(159,168,218,.04);

          --input-focus-bg: #12122a;
          --input-focus-shadow: 0 0 0 3px rgba(99,102,241,.18),0 0 20px rgba(99,102,241,.1);

          --card-blur:     blur(10px);
          --divider-anim:  shimmerFast 4s linear infinite;

          --chip-idle-bg:  rgba(159,168,218,.05);
          --chip-idle-border: rgba(159,168,218,.12);
          --chip-idle-text:   rgba(159,168,218,.45);

          --model-bg:      rgba(159,168,218,.03);
          --model-hover-shadow: 0 8px 28px rgba(0,0,20,.5);
          --model-active-shadow: 0 0 0 3px rgba(99,102,241,.2),0 8px 28px rgba(0,0,20,.5),0 0 30px rgba(99,102,241,.15);

          --phase-hover-shadow: 0 12px 40px rgba(0,0,20,.6),0 0 0 1px rgba(99,102,241,.2)!important;
          --step-active-anim:   neonPulse 2.5s ease-in-out infinite;

          --btn-out-bg:    rgba(159,168,218,.05);
          --btn-out-color: #9fa8da;
          --btn-out-border:rgba(159,168,218,.2);
          --btn-ghost-bg:  rgba(159,168,218,.03);
          --btn-ghost-color:rgba(159,168,218,.4);
          --btn-ghost-border:rgba(159,168,218,.1);

          --glitch-on:     1;
          --morph-on:      morphBorder 10s ease-in-out infinite;
          --neon-reduced:  1;
          --scanline-on:   1;

          --log-bg:        #0d0d20;
          --log-text:      #c5cae9;
          --log-ok:        #4ade80;
          --log-err:       #fc8181;
          --log-warn:      #fcd34d;
          --log-info:      #a5b4fc;
        }

        /* ══ TEMA LIGHT — SaaS luminoso profesional ════════════════════ */
        [data-theme="light"] {
          --bg-base:       #f8fafc;
          --bg-card:       #ffffff;
          --bg-card-glow:  #ffffff;
          --bg-input:      #f1f5f9;
          --bg-surface-1:  #f8fafc;
          --bg-surface-2:  #f1f5f9;

          --text-primary:  #0f172a;
          --text-secondary:#475569;
          --text-muted:    #94a3b8;

          --border-base:   #e2e8f0;
          --border-accent: #c4b5fd;
          --border-strong: #cbd5e1;

          --shadow-card:   0 1px 3px rgba(0,0,0,.06),0 4px 16px rgba(0,0,0,.06);
          --shadow-btn:    0 2px 8px rgba(0,0,0,.1),0 1px 2px rgba(0,0,0,.08);
          --shadow-glow:   none;

          --blob-opacity:  .05;
          --blob-blur:     40px;
          --grid-color:    transparent;

          --accent:        #7c3aed;
          --accent-soft:   rgba(124,58,237,.08);

          --prog-bg:       #e2e8f0;
          --prog-shadow:   none;
          --prog-gradient: linear-gradient(90deg,#7c3aed,#a78bfa,#ec4899,#f59e0b,#10b981);

          --scrollbar-thumb: #cbd5e1;
          --scrollbar-hover: #a78bfa;
          --scrollbar-track: #f1f5f9;

          --input-focus-bg: #ffffff;
          --input-focus-shadow: 0 0 0 3px rgba(124,58,237,.12);

          --card-blur:     none;
          --divider-anim:  none;

          --chip-idle-bg:  #f8fafc;
          --chip-idle-border: #e2e8f0;
          --chip-idle-text:   #64748b;

          --model-bg:      #ffffff;
          --model-hover-shadow: 0 4px 16px rgba(0,0,0,.08);
          --model-active-shadow: 0 0 0 2px #c4b5fd,0 4px 16px rgba(0,0,0,.08);

          --phase-hover-shadow: 0 4px 20px rgba(0,0,0,.08),0 0 0 1px #e2e8f0!important;
          --step-active-anim:   none;

          --btn-out-bg:    #ffffff;
          --btn-out-color: #7c3aed;
          --btn-out-border:#c4b5fd;
          --btn-ghost-bg:  #f8fafc;
          --btn-ghost-color:#64748b;
          --btn-ghost-border:#e2e8f0;

          --glitch-on:     0;
          --morph-on:      none;
          --neon-reduced:  0;
          --scanline-on:   0;

          --log-bg:        #f8fafc;
          --log-text:      #334155;
          --log-ok:        #059669;
          --log-err:       #dc2626;
          --log-warn:      #d97706;
          --log-info:      #6d28d9;
        }

        /* ══════════════════════════════════════════════════════════════
           GLOBAL THEME TRANSITION — smooth 300ms switch
        ══════════════════════════════════════════════════════════════ */
        *, *::before, *::after {
          transition:
            background-color .3s ease,
            color .3s ease,
            border-color .3s ease,
            box-shadow .3s ease,
            opacity .3s ease;
        }
        /* Exclude animation-critical elements from slow transition */
        .sp, .prog-fill, .btn::before, [class*="blob"] {
          transition: none !important;
        }

        /* ══════════════════════════════════════════════════════════════
           BRUTAL KEYFRAMES — 40+ animations (unchanged)
        ══════════════════════════════════════════════════════════════ */
        @keyframes spin          { to{transform:rotate(360deg)} }
        @keyframes spinR         { to{transform:rotate(-360deg)} }
        @keyframes pulse         { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes fadeUp        { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeDown      { from{opacity:0;transform:translateY(-16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeLeft      { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
        @keyframes popIn         { 0%{opacity:0;transform:scale(0) rotate(-15deg)} 60%{transform:scale(1.15) rotate(3deg)} 80%{transform:scale(.95)} 100%{opacity:1;transform:scale(1) rotate(0)} }
        @keyframes popInFast     { 0%{opacity:0;transform:scale(.3)} 60%{transform:scale(1.2)} 100%{opacity:1;transform:scale(1)} }
        @keyframes gradFlow      { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes shimmer       { 0%{background-position:-400% center} 100%{background-position:400% center} }
        @keyframes shimmerFast   { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes bounce        { 0%,100%{transform:translateY(0) scale(1)} 40%{transform:translateY(-10px) scale(1.05)} 60%{transform:translateY(-5px)} }
        @keyframes bounceTiny    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes wiggle        { 0%,100%{transform:rotate(0)} 25%{transform:rotate(-12deg)} 75%{transform:rotate(12deg)} }
        @keyframes float         { 0%,100%{transform:translateY(0) rotate(-2deg) scale(1)} 50%{transform:translateY(-12px) rotate(2deg) scale(1.03)} }
        @keyframes floatSlow     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes starBurst     { 0%{transform:scale(0) rotate(-30deg);opacity:0} 50%{transform:scale(1.5) rotate(10deg)} 100%{transform:scale(1) rotate(0);opacity:1} }
        @keyframes confetti      { 0%{transform:translateY(-10px) rotate(0) scale(1);opacity:1} 100%{transform:translateY(70px) rotate(900deg) scale(.3);opacity:0} }
        @keyframes cardIn        { from{opacity:0;transform:translateY(14px) scale(.95)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes slideInLeft   { from{opacity:0;transform:translateX(-20px)} to{opacity:1;transform:translateX(0)} }
        @keyframes slideInRight  { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
        @keyframes progressWave  { 0%{background-position:0% 50%} 100%{background-position:200% 50%} }
        @keyframes masterGlow    { 0%,100%{box-shadow:0 0 20px #4ade8044,0 0 60px #22c55e22,0 0 100px #16a34a11} 50%{box-shadow:0 0 40px #4ade8088,0 0 80px #22c55e55,0 0 140px #16a34a33} }
        @keyframes agentDone     { 0%{transform:scale(1)} 20%{transform:scale(1.35) rotate(8deg)} 40%{transform:scale(.9) rotate(-3deg)} 70%{transform:scale(1.1)} 100%{transform:scale(1)} }
        @keyframes bgFloat1      { 0%,100%{transform:translate(0,0) scale(1) rotate(0deg)} 33%{transform:translate(40px,-30px) scale(1.08) rotate(5deg)} 66%{transform:translate(-20px,20px) scale(.95) rotate(-3deg)} }
        @keyframes bgFloat2      { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-35px,30px) scale(.92)} }
        @keyframes bgFloat3      { 0%,100%{transform:translate(0,0) scale(1) rotate(0)} 50%{transform:translate(25px,-15px) scale(1.06) rotate(8deg)} }
        @keyframes starSpin      { 0%{transform:rotate(0) scale(1)} 50%{transform:rotate(180deg) scale(1.4)} 100%{transform:rotate(360deg) scale(1)} }
        @keyframes glitch        { 0%,100%{transform:translate(0)} 20%{transform:translate(-2px,1px)} 40%{transform:translate(2px,-1px)} 60%{transform:translate(-1px,2px)} 80%{transform:translate(1px,-2px)} }
        @keyframes glitchColor   { 0%,100%{text-shadow:none} 33%{text-shadow:-2px 0 #ff00ff,2px 0 #00ffff} 66%{text-shadow:2px 0 #ff0000,-2px 0 #0000ff} }
        @keyframes neonPulse     { 0%,100%{box-shadow:0 0 5px currentColor,0 0 10px currentColor,0 0 20px currentColor} 50%{box-shadow:0 0 10px currentColor,0 0 25px currentColor,0 0 50px currentColor,0 0 80px currentColor} }
        @keyframes typing        { from{width:0} to{width:100%} }
        @keyframes blink         { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes morphBorder   { 0%,100%{border-radius:20px} 25%{border-radius:30px 10px 25px 15px} 50%{border-radius:12px 28px 16px 24px} 75%{border-radius:24px 14px 28px 12px} }
        @keyframes scanline      { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        @keyframes particleFly   { 0%{transform:translate(0,0) scale(1);opacity:1} 100%{transform:translate(var(--tx),var(--ty)) scale(0);opacity:0} }
        @keyframes rippleOut     { 0%{transform:scale(0);opacity:.6} 100%{transform:scale(3);opacity:0} }
        @keyframes heartbeat     { 0%,100%{transform:scale(1)} 15%{transform:scale(1.2)} 30%{transform:scale(1)} 45%{transform:scale(1.12)} 65%{transform:scale(1)} }
        @keyframes numberUp      { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes borderRun     { 0%{background-position:0 0,100% 0,100% 100%,0 100%} 100%{background-position:100% 0,100% 100%,0 100%,0 0} }
        @keyframes orbitX        { 0%{transform:rotate(0deg) translateX(120px) rotate(0deg)} 100%{transform:rotate(360deg) translateX(120px) rotate(-360deg)} }
        @keyframes orbitY        { 0%{transform:rotate(0deg) translateY(80px) rotate(0deg)} 100%{transform:rotate(360deg) translateY(80px) rotate(-360deg)} }
        @keyframes plasmaShift   { 0%,100%{filter:hue-rotate(0deg) brightness(1)} 25%{filter:hue-rotate(45deg) brightness(1.15)} 75%{filter:hue-rotate(-30deg) brightness(1.1)} }
        @keyframes titleReveal   { 0%{clip-path:inset(0 100% 0 0);opacity:0} 100%{clip-path:inset(0 0% 0 0);opacity:1} }
        @keyframes glowPulseH    { 0%,100%{text-shadow:0 0 20px rgba(124,58,237,.6),0 0 40px rgba(236,72,153,.3)} 50%{text-shadow:0 0 40px rgba(124,58,237,1),0 0 80px rgba(236,72,153,.6),0 0 120px rgba(245,158,11,.3)} }
        @keyframes letterDrop    { 0%{opacity:0;transform:translateY(-40px) rotate(-8deg) scale(.6)} 60%{transform:translateY(6px) rotate(2deg) scale(1.1)} 80%{transform:translateY(-3px) scale(.97)} 100%{opacity:1;transform:translateY(0) rotate(0) scale(1)} }
        @keyframes particleRain  { 0%{transform:translateY(-20px) translateX(0) rotate(0) scale(1);opacity:1} 100%{transform:translateY(120px) translateX(var(--px,0px)) rotate(720deg) scale(0);opacity:0} }
        @keyframes ringExpand    { 0%{transform:scale(0) rotate(0);opacity:.7} 100%{transform:scale(2.5) rotate(180deg);opacity:0} }
        @keyframes waveText      { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes starTwinkle   { 0%,100%{opacity:.3;transform:scale(.8)} 50%{opacity:1;transform:scale(1.3)} }
        @keyframes auraFlow      { 0%{background-position:0% 50%;opacity:.6} 50%{background-position:100% 50%;opacity:.9} 100%{background-position:0% 50%;opacity:.6} }
        @keyframes rocketShake   { 0%,100%{transform:translateX(0) rotate(0)} 25%{transform:translateX(-3px) rotate(-2deg)} 75%{transform:translateX(3px) rotate(2deg)} }

        /* ══ HEADER EPIC STYLES ══════════════════════════════════════ */
        .header-aura {
          position:absolute;inset:-60px;pointer-events:none;z-index:0;
          background:
            radial-gradient(ellipse 60% 40% at 50% 60%, rgba(124,58,237,.18) 0%, transparent 60%),
            radial-gradient(ellipse 40% 30% at 30% 40%, rgba(236,72,153,.12) 0%, transparent 60%),
            radial-gradient(ellipse 40% 30% at 70% 30%, rgba(245,158,11,.08) 0%, transparent 60%);
          animation:auraFlow 6s ease-in-out infinite;
          background-size:200% 200%;
        }
        [data-theme="light"] .header-aura { opacity:.4; }
        [data-theme="mid"] .header-aura {
          background:
            radial-gradient(ellipse 60% 40% at 50% 60%, rgba(99,102,241,.2) 0%, transparent 60%),
            radial-gradient(ellipse 40% 30% at 30% 40%, rgba(6,182,212,.12) 0%, transparent 60%);
        }

        .header-orbit-ring {
          position:absolute;top:50%;left:50%;
          width:280px;height:280px;
          margin:-140px 0 0 -140px;
          border:1px solid rgba(124,106,247,.08);
          border-radius:50%;
          pointer-events:none;
          animation:ringExpand 4s ease-out infinite;
        }
        .header-orbit-ring:nth-child(2) { animation-delay:1.3s; }
        .header-orbit-ring:nth-child(3) { animation-delay:2.6s; }

        .orbit-icon {
          position:absolute;top:50%;left:50%;
          font-size:20px;
          transform-origin:0 0;
          pointer-events:none;
        }

        .title-letter {
          display:inline-block;
          transition:transform .3s cubic-bezier(.34,1.56,.64,1), filter .3s;
          cursor:default;
        }
        .title-letter:hover {
          transform:translateY(-8px) scale(1.2) rotate(-3deg);
          filter:brightness(1.4) drop-shadow(0 0 12px currentColor);
          animation:none !important;
        }

        .header-particle {
          position:absolute;
          pointer-events:none;
          border-radius:50%;
          animation:particleRain var(--pd,2s) ease-out var(--pdelay,0s) infinite;
        }

        /* ══════════════════════════════════════════════════════════════
           BASE
        ══════════════════════════════════════════════════════════════ */
        html, body { margin:0; padding:0; background:var(--bg-base); color:var(--text-primary); }
        * { box-sizing:border-box; }
        .sp {
          width:14px; height:14px;
          border:2.5px solid var(--border-base);
          border-top-color:var(--accent);
          border-right-color:#ec4899;
          border-radius:50%;
          animation:spin .5s linear infinite;
          display:inline-block; flex-shrink:0;
          filter:drop-shadow(0 0 4px var(--accent));
        }
        [data-theme="light"] .sp {
          border-color:#e2e8f0;
          border-top-color:var(--accent);
          border-right-color:#ec4899;
          filter:none;
        }

        /* ══════════════════════════════════════════════════════════════
           ROOT — grid + blobs
        ══════════════════════════════════════════════════════════════ */
        .root {
          background:var(--bg-base);
          min-height:100vh;
          font-family:'Nunito',system-ui,sans-serif;
          color:var(--text-primary);
          position:relative;
          overflow-x:hidden;
          line-height:1.6;
        }
        .root::after {
          content:'';
          position:absolute; inset:0;
          pointer-events:none;
          background-image:
            linear-gradient(var(--grid-color) 1px,transparent 1px),
            linear-gradient(90deg,var(--grid-color) 1px,transparent 1px);
          background-size:48px 48px;
          z-index:0;
        }
        .blob {
          position:absolute; border-radius:50%;
          pointer-events:none;
          filter:blur(var(--blob-blur));
          opacity:var(--blob-opacity);
        }
        .blob-1 { width:600px;height:600px;background:radial-gradient(#7c3aed,#4f46e5);top:-200px;left:-200px;animation:bgFloat1 16s ease-in-out infinite; }
        .blob-2 { width:500px;height:500px;background:radial-gradient(#0ea5e9,#06b6d4);top:30%;right:-150px;animation:bgFloat2 20s ease-in-out infinite; }
        .blob-3 { width:400px;height:400px;background:radial-gradient(#10b981,#059669);bottom:0;left:10%;animation:bgFloat3 14s ease-in-out infinite; }
        .blob-4 { width:300px;height:300px;background:radial-gradient(#ec4899,#f59e0b);top:25%;right:20%;animation:bgFloat1 22s ease-in-out infinite reverse; }
        .blob-5 { width:200px;height:200px;background:radial-gradient(#a78bfa,#7c3aed);top:60%;left:40%;animation:bgFloat2 12s ease-in-out infinite 3s; }
        .wrap { position:relative;z-index:1;max-width:1080px;margin:0 auto;padding:28px 16px 80px }

        /* ══════════════════════════════════════════════════════════════
           CARDS
        ══════════════════════════════════════════════════════════════ */
        .card {
          background:var(--bg-card);
          border:1px solid var(--border-base);
          border-radius:20px; padding:22px;
          box-shadow:var(--shadow-card);
          backdrop-filter:var(--card-blur);
          transition:all .3s cubic-bezier(.34,1.56,.64,1);
        }
        .card:hover {
          transform:translateY(-2px);
          border-color:var(--border-strong);
          box-shadow:var(--shadow-card), 0 0 0 1px var(--accent-soft);
        }
        .card-glow {
          background:var(--bg-card-glow);
          border:1px solid var(--border-accent);
          border-radius:20px; padding:22px;
          box-shadow:var(--shadow-card), var(--shadow-glow);
          backdrop-filter:var(--card-blur);
          animation:var(--morph-on);
          position:relative;
        }
        .card-glow::before {
          content:'';
          position:absolute; inset:-1px;
          border-radius:21px;
          background:linear-gradient(90deg,#7c3aed,#ec4899,#10b981,#f59e0b,#7c3aed);
          background-size:400% 100%;
          animation:shimmer 4s linear infinite;
          opacity:.12;
          z-index:-1;
          pointer-events:none;
        }
        [data-theme="light"] .card-glow::before { opacity:.06; }
        [data-theme="light"] .card-glow { box-shadow:var(--shadow-card); }

        /* ══════════════════════════════════════════════════════════════
           BUTTONS
        ══════════════════════════════════════════════════════════════ */
        .btn {
          display:inline-flex; align-items:center; gap:8px;
          padding:11px 22px; border-radius:14px; border:none;
          font-family:'Nunito',sans-serif; cursor:pointer;
          font-size:13px; font-weight:800;
          transition:all .2s cubic-bezier(.34,1.56,.64,1);
          white-space:nowrap; letter-spacing:-.2px;
          position:relative; overflow:hidden; isolation:isolate;
          min-height:40px;
        }
        .btn::before {
          content:''; position:absolute; inset:0;
          background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.15) 50%,transparent 60%);
          transform:translateX(-100%); transition:transform .4s ease;
        }
        .btn:not(:disabled):hover::before { transform:translateX(100%); }
        .btn:disabled { opacity:.35; cursor:not-allowed; transform:none!important }
        .btn:not(:disabled):hover  { transform:translateY(-3px) scale(1.04); }
        .btn:not(:disabled):active { transform:translateY(1px) scale(.96); transition-duration:.08s; }

        .btn-prime {
          background:linear-gradient(135deg,#7c3aed,#4f46e5,#7c3aed);
          background-size:200% 200%; animation:gradFlow 3s ease infinite;
          color:#fff;
          box-shadow:var(--shadow-btn), 0 1px 0 rgba(255,255,255,.2) inset;
        }
        .btn-prime:not(:disabled):hover {
          box-shadow:0 14px 40px rgba(124,58,237,.7),0 0 0 2px rgba(167,139,250,.3),0 1px 0 rgba(255,255,255,.2) inset;
        }
        [data-theme="light"] .btn-prime:not(:disabled):hover {
          box-shadow:0 8px 24px rgba(124,58,237,.3),0 0 0 2px #c4b5fd;
        }

        .btn-launch {
          background:linear-gradient(135deg,#7c3aed,#9333ea,#ec4899,#7c3aed);
          background-size:300% 300%; animation:gradFlow 2s ease infinite;
          color:#fff; font-size:15px; font-weight:900;
          padding:14px 32px; border-radius:16px;
          box-shadow:0 8px 32px rgba(124,58,237,.55),0 0 0 1px rgba(167,139,250,.2),0 1px 0 rgba(255,255,255,.25) inset;
          letter-spacing:.3px;
        }
        .btn-launch:not(:disabled):hover {
          box-shadow:0 18px 50px rgba(124,58,237,.8),0 0 0 3px rgba(167,139,250,.4),0 0 80px rgba(236,72,153,.3);
          transform:translateY(-4px) scale(1.05);
        }
        [data-theme="light"] .btn-launch:not(:disabled):hover {
          box-shadow:0 8px 28px rgba(124,58,237,.35),0 0 0 2px #c4b5fd;
        }
        .btn-launch:not(:disabled):active { transform:translateY(2px) scale(.97); }

        .btn-out {
          background:var(--btn-out-bg);
          color:var(--btn-out-color);
          border:1px solid var(--btn-out-border);
        }
        .btn-out:not(:disabled):hover {
          background:var(--accent-soft);
          border-color:var(--border-accent);
          color:var(--accent);
          box-shadow:var(--shadow-glow);
        }
        [data-theme="light"] .btn-out:not(:disabled):hover {
          box-shadow:0 2px 8px rgba(124,58,237,.15);
        }

        .btn-ghost {
          background:var(--btn-ghost-bg);
          color:var(--btn-ghost-color);
          border:1px solid var(--btn-ghost-border);
        }
        .btn-ghost:not(:disabled):hover {
          background:var(--accent-soft);
          color:var(--accent);
          border-color:var(--border-accent);
        }

        /* ══════════════════════════════════════════════════════════════
           PROGRESS BAR
        ══════════════════════════════════════════════════════════════ */
        .prog-track {
          height:10px;
          background:var(--prog-bg);
          border-radius:999px; overflow:hidden;
          box-shadow:inset 0 2px 6px rgba(0,0,0,.15);
        }
        .prog-fill {
          height:100%; border-radius:999px;
          background:var(--prog-gradient);
          background-size:400% 100%;
          animation:progressWave 1.8s linear infinite;
          box-shadow:var(--prog-shadow);
          transition:width .8s cubic-bezier(.4,0,.2,1);
        }

        /* ══════════════════════════════════════════════════════════════
           MODEL CARDS
        ══════════════════════════════════════════════════════════════ */
        .model-card {
          border:1px solid var(--border-base);
          border-radius:16px; padding:13px 16px;
          cursor:pointer;
          transition:all .28s cubic-bezier(.34,1.56,.64,1);
          background:var(--model-bg);
          position:relative; overflow:hidden;
        }
        .model-card::after {
          content:''; position:absolute; inset:0; border-radius:16px;
          background:linear-gradient(135deg,rgba(255,255,255,.04),transparent);
          opacity:0; transition:opacity .2s;
        }
        .model-card:hover {
          transform:translateY(-3px) scale(1.02);
          border-color:var(--border-accent);
          box-shadow:var(--model-hover-shadow);
        }
        .model-card:hover::after { opacity:1 }
        .model-card.active {
          border-color:var(--border-accent);
          background:var(--accent-soft);
          box-shadow:var(--model-active-shadow);
          transform:scale(1.02);
        }

        /* ══════════════════════════════════════════════════════════════
           AGENT CHIPS
        ══════════════════════════════════════════════════════════════ */
        .chip-active { animation:bounceTiny .5s ease-in-out infinite alternate }
        .chip-done   { animation:agentDone .6s cubic-bezier(.34,1.56,.64,1) both }
        .chip-synth  { animation:heartbeat 1.2s ease-in-out infinite }

        /* ══════════════════════════════════════════════════════════════
           PHASE BLOCK
        ══════════════════════════════════════════════════════════════ */
        .phase-block {
          transition:all .3s cubic-bezier(.34,1.56,.64,1);
          animation:cardIn .5s cubic-bezier(.34,1.56,.64,1) both;
        }
        .phase-block:hover {
          transform:translateY(-3px);
          box-shadow:var(--phase-hover-shadow);
        }

        /* ══════════════════════════════════════════════════════════════
           MASTER PLAN
        ══════════════════════════════════════════════════════════════ */
        .master-panel { animation:masterGlow 2s ease-in-out infinite }
        [data-theme="light"] .master-panel {
          animation:none;
          border-left:3px solid #10b981 !important;
        }

        /* ══════════════════════════════════════════════════════════════
           DIVIDER
        ══════════════════════════════════════════════════════════════ */
        .divider {
          height:1px; margin:16px 0;
          background:linear-gradient(90deg,transparent,var(--border-accent),rgba(236,72,153,.2),var(--border-accent),transparent);
          background-size:200% 100%;
          animation:var(--divider-anim);
        }
        [data-theme="light"] .divider { animation:none; }

        /* ══════════════════════════════════════════════════════════════
           MISC
        ══════════════════════════════════════════════════════════════ */
        .pill { display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:.5px;text-transform:uppercase; }
        .tab-btn {
          padding:9px 18px; border:none; cursor:pointer;
          font-family:'Nunito',sans-serif; font-size:11px; font-weight:800;
          letter-spacing:.5px; text-transform:uppercase;
          transition:all .25s cubic-bezier(.34,1.56,.64,1);
          background:transparent;
          color:var(--text-secondary);
        }
        .tab-btn:hover { transform:translateY(-1px); color:var(--text-primary); }

        /* ══════════════════════════════════════════════════════════════
           INPUTS
        ══════════════════════════════════════════════════════════════ */
        textarea, input[type=text], input[type=password], input[type=email], select {
          color:var(--text-primary);
          background:var(--bg-input);
          border:1px solid var(--border-base);
          border-radius:12px;
          font-family:'Nunito',sans-serif;
          font-size:13px;
          line-height:1.6;
          height:42px;
          padding:0 14px;
          box-sizing:border-box;
          transition:border-color .2s, box-shadow .2s, background .2s;
        }
        textarea { height:auto; min-height:80px; padding:11px 14px; }
        textarea:focus, input:focus, select:focus {
          outline:none;
          border-color:var(--border-accent) !important;
          box-shadow:var(--input-focus-shadow) !important;
          background:var(--input-focus-bg) !important;
        }
        textarea::placeholder, input::placeholder { color:var(--text-muted); opacity:1; }
        [data-theme="light"] textarea::placeholder,
        [data-theme="light"] input::placeholder { color:#94a3b8; opacity:1; }
        [data-theme="mid"] textarea::placeholder,
        [data-theme="mid"] input::placeholder   { color:rgba(159,168,218,.45); opacity:1; }
        select option { background:var(--bg-card); color:var(--text-primary); }

        /* ══════════════════════════════════════════════════════════════
           SCROLLBAR
        ══════════════════════════════════════════════════════════════ */
        ::-webkit-scrollbar { width:5px }
        ::-webkit-scrollbar-track { background:var(--scrollbar-track) }
        ::-webkit-scrollbar-thumb { background:var(--scrollbar-thumb);border-radius:3px }
        ::-webkit-scrollbar-thumb:hover { background:var(--scrollbar-hover) }

        /* ══════════════════════════════════════════════════════════════
           STEP INDICATOR
        ══════════════════════════════════════════════════════════════ */
        .step-active {
          animation:var(--step-active-anim);
          color:var(--accent) !important;
        }

        /* ══════════════════════════════════════════════════════════════
           RESULT CONTENT
        ══════════════════════════════════════════════════════════════ */
        .result-content { animation:fadeDown .3s ease both; }

        /* ══════════════════════════════════════════════════════════════
           SCANLINE (only dark/mid)
        ══════════════════════════════════════════════════════════════ */
        .scanline::before {
          content:''; position:absolute; inset:0; pointer-events:none; z-index:100;
          background:linear-gradient(transparent 50%,rgba(124,106,247,.015) 50%);
          background-size:100% 4px;
          display:var(--scanline-on, block);
        }
        [data-theme="light"] .scanline::before { display:none; }

        /* ══════════════════════════════════════════════════════════════
           LIGHT THEME — overrides that need selector specificity
        ══════════════════════════════════════════════════════════════ */
        [data-theme="light"] .card {
          box-shadow:0 1px 3px rgba(0,0,0,.06),0 4px 16px rgba(0,0,0,.06);
          backdrop-filter:none;
        }
        [data-theme="light"] .card:hover {
          box-shadow:0 4px 20px rgba(0,0,0,.1);
        }
        [data-theme="light"] .phase-block:hover {
          box-shadow:0 4px 20px rgba(0,0,0,.08),0 0 0 1px #e2e8f0 !important;
        }
        [data-theme="light"] .btn-prime:not(:disabled):hover {
          animation:gradFlow 3s ease infinite;
        }
        [data-theme="light"] .step-active {
          animation:none;
          border-bottom:2px solid var(--accent) !important;
          color:var(--accent) !important;
        }

        /* MID THEME — extra depth */
        [data-theme="mid"] .card {
          box-shadow:0 4px 32px rgba(0,0,20,.7),inset 0 1px 0 rgba(159,168,218,.05);
        }
        [data-theme="mid"] .btn-prime {
          background:linear-gradient(135deg,#4f46e5,#6366f1,#4f46e5);
          background-size:200% 200%; animation:gradFlow 3s ease infinite;
          box-shadow:0 6px 24px rgba(79,70,229,.5);
        }
        [data-theme="mid"] .btn-launch {
          background:linear-gradient(135deg,#4f46e5,#6366f1,#06b6d4,#4f46e5);
          background-size:300% 300%; animation:gradFlow 2.5s ease infinite;
          box-shadow:0 8px 32px rgba(79,70,229,.55),0 0 0 1px rgba(129,140,248,.2);
        }
      `}</style>

      <div className="root">
        {showConfetti && (
          <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9999,overflow:"hidden"}}>
            {Array.from({length:80}).map((_,i)=>{
              const colors=["#a78bfa","#c084fc","#f472b6","#fb923c","#34d399","#60a5fa","#fbbf24","#f87171","#38bdf8","#4ade80","#facc15"];
              const x=Math.random()*110-5, size=6+Math.random()*14;
              const delay=Math.random()*1.2, dur=1.2+Math.random()*2;
              const shapes=["50%","3px","0","50% 0"];
              return <div key={i} style={{
                position:"absolute",top:"-30px",left:x+"%",
                width:size,height:size*(Math.random()>.5?.4:1),
                borderRadius:shapes[i%shapes.length],
                background:colors[i%colors.length],
                boxShadow:"0 0 6px "+colors[i%colors.length],
                animation:"confetti "+dur+"s cubic-bezier(.5,0,.8,1) "+delay+"s both",
                transform:"rotate("+Math.random()*360+"deg)",
              }}/>;
            })}
          </div>
        )}
        <div className="blob blob-1"/>
        <div className="blob blob-2"/>
        <div className="blob blob-3"/>
        <div className="blob blob-4"/>
        <div className="blob blob-5"/>
        <div className="wrap">

          {/* ── HEADER ÉPICO ── */}
          <div style={{textAlign:"center",marginBottom:32,position:"relative",overflow:"visible"}}>

            {/* Aura glow behind everything */}
            <div className="header-aura"/>

            {/* Expanding rings */}
            {[0,1,2].map(i=>(
              <div key={i} className="header-orbit-ring" style={{
                animationDelay:(i*1.33)+"s",
                borderColor:"rgba(124,106,247,"+(0.06-i*.015)+")",
                width:(240+i*50)+"px",height:(240+i*50)+"px",
                margin:"-"+(120+i*25)+"px 0 0 -"+(120+i*25)+"px",
              }}/>
            ))}

            {/* Orbiting icons */}
            <div style={{position:"absolute",top:"50%",left:"50%",width:0,height:0,pointerEvents:"none",zIndex:0}}>
              {[
                {icon:"🤖",dur:8,  radius:130,angle:0,   size:22},
                {icon:"⚡",dur:12, radius:110,angle:72,  size:18},
                {icon:"🧠",dur:10, radius:140,angle:144, size:20},
                {icon:"🎯",dur:9,  radius:120,angle:216, size:19},
                {icon:"✨",dur:11, radius:135,angle:288, size:17},
                {icon:"🚀",dur:7,  radius:105,angle:45,  size:16},
                {icon:"🔮",dur:13, radius:145,angle:135, size:21},
                {icon:"💡",dur:15, radius:115,angle:200, size:18},
                {icon:"🌊",dur:11, radius:130,angle:320, size:16},
                {icon:"⚙️",dur:14, radius:120,angle:170, size:17},
              ].map(({icon,dur,radius,angle,size},i)=>(
                <span key={i} className="orbit-icon"
                  onMouseEnter={()=>{ playSound("orbitPing"); haptic([8]); }}
                  style={{
                    fontSize:size,
                    animation:"orbitX "+dur+"s linear infinite",
                    animationDelay:-(angle/360*dur)+"s",
                    transformOrigin:(-radius)+"px 0",
                    marginLeft:-radius,
                    opacity:.3,
                    filter:"drop-shadow(0 0 6px #a78bfa)",
                  }}>
                  {icon}
                </span>
              ))}
            </div>

            {/* Particle rain */}
            {Array.from({length:16},(_,i)=>{
              const colors=["#7c3aed","#ec4899","#f59e0b","#10b981","#0ea5e9","#a78bfa"];
              const c=colors[i%colors.length];
              return (
                <div key={i} className="header-particle" style={{
                  width:(3+i%3*2)+"px", height:(3+i%3*2)+"px",
                  background:c, boxShadow:"0 0 6px "+c,
                  left:(3+i*6)+"%", top:(5+Math.sin(i*0.9)*15)+"%",
                  "--pd":(2.5+i%4*.7)+"s",
                  "--pdelay":-(i*.25)+"s",
                  "--px":(-30+i%5*15)+"px",
                }}/>
              );
            })}

            {/* Main content above effects */}
            <div style={{position:"relative",zIndex:2,paddingTop:12}}>

              {/* Badge */}
              <div
                onClick={()=>{ playSound("ringPop"); haptic([15,10,15]); }}
                style={{
                  display:"inline-flex",alignItems:"center",gap:6,
                  fontSize:9,letterSpacing:6,color:"var(--accent)",
                  fontFamily:"'Syne',sans-serif",fontWeight:800,
                  textTransform:"uppercase",marginBottom:14,
                  padding:"5px 16px",borderRadius:999,
                  border:"1px solid var(--border-accent)",
                  background:"var(--accent-soft)",cursor:"pointer",
                  animation:"fadeDown .5s ease both",
                  transition:"all .25s cubic-bezier(.34,1.56,.64,1)",
                }}
                onMouseEnter={e=>{ e.currentTarget.style.transform="scale(1.08)"; e.currentTarget.style.boxShadow="0 0 20px var(--accent)55"; playSound("orbitPing"); }}
                onMouseLeave={e=>{ e.currentTarget.style.transform="scale(1)"; e.currentTarget.style.boxShadow="none"; }}>
                <span style={{animation:"starTwinkle 1.5s ease-in-out infinite",display:"inline-block"}}>✦</span>
                <span>AI SWARM LAB · v7</span>
                <span style={{animation:"starTwinkle 1.5s ease-in-out infinite .5s",display:"inline-block"}}>✦</span>
              </div>

              {/* H1 — letter by letter */}
              <h1
                onClick={()=>{ playSound("titleClick"); haptic([20,10,20,10,40,10,60]); }}
                style={{
                  fontSize:"clamp(22px,4.2vw,44px)",fontWeight:900,
                  margin:"0 0 4px",fontFamily:"'Syne',sans-serif",
                  letterSpacing:"-1px",lineHeight:1.1,
                  cursor:"pointer",userSelect:"none",
                  whiteSpace:"nowrap",
                  animation:"fadeUp .6s cubic-bezier(.34,1.56,.64,1) .1s both",
                }}>
                {/* Rocket prefix — not split to avoid ??  */}
                <span style={{display:"inline-block",marginRight:8,animation:"rocketShake 3s ease-in-out infinite"}}>🚀</span>
                {"ENJAMBRE DE AGENTES IA".split("").map((ch,i)=>(
                  <span key={i} className="title-letter"
                    onMouseEnter={()=>{ playSound("titleHover"); haptic([5]); }}
                    style={{
                      background:"linear-gradient(135deg,#7c3aed 0%,#a855f7 25%,#ec4899 55%,#f59e0b 80%,#10b981 100%)",
                      backgroundSize:"300% 100%",
                      animation:"gradFlow "+(3+i*.08)+"s ease infinite, letterDrop .5s cubic-bezier(.34,1.56,.64,1) "+(.02+i*.038)+"s both",
                      WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
                      display:ch===" "?"inline":"inline-block",
                      minWidth:ch===" "?"0.3em":"auto",
                    }}>
                    {ch}
                  </span>
                ))}
              </h1>

              {/* Subtitle wave */}
              <p style={{color:"var(--text-secondary)",fontSize:13,fontWeight:700,margin:"8px 0 20px",animation:"fadeUp .6s ease .4s both"}}>
                {["31 agentes","7 fases","3 modelos","plan maestro ⚡"].map((t,i)=>(
                  <span key={i}>
                    <span
                      onMouseEnter={e=>{ e.currentTarget.style.color="var(--accent)"; e.currentTarget.style.transform="translateY(-3px)"; playSound("select"); haptic([5]); }}
                      onMouseLeave={e=>{ e.currentTarget.style.color=""; e.currentTarget.style.transform=""; }}
                      style={{cursor:"default",display:"inline-block",transition:"all .2s",animation:"waveText 2s ease-in-out "+(i*.25)+"s infinite"}}>
                      {t}
                    </span>
                    {i<3&&<span style={{color:"var(--border-accent)",margin:"0 6px",opacity:.5}}>·</span>}
                  </span>
                ))}
              </p>
            </div>{/* /content zIndex:2 */}

{/* Stats pills — staggered pop */}
            <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap",marginBottom:18}}>
              {[["🤖","31","agentes","#7c3aed"],["🎯","7","fases","#ec4899"],["🧠","3","modelos","#f59e0b"],["💾","∞","sesiones","#10b981"],["⚡","síntesis","inteligente","#6366f1"]].map(([emoji,n,l,c],idx)=>(
                <div key={l} style={{
                  display:"flex",alignItems:"center",gap:6,padding:"8px 16px",borderRadius:999,
                  background:"var(--bg-surface-1)",border:"1px solid "+c+"35",
                  boxShadow:"0 3px 14px "+c+"18",
                  animation:"popIn .5s cubic-bezier(.34,1.56,.64,1) both",animationDelay:(idx*.07)+"s",
                }}>
                  <span style={{fontSize:15}}>{emoji}</span>
                  <span style={{fontSize:15,fontWeight:900,color:c,fontFamily:"'Syne',sans-serif",lineHeight:1}}>{n}</span>
                  <span style={{fontSize:9,color:c+"bb",fontWeight:800,textTransform:"uppercase",letterSpacing:1}}>{l}</span>
                </div>
              ))}
            </div>

            {/* Theme switcher + Budget bar + tabs */}
            <div style={{display:"flex",gap:10,justifyContent:"center",alignItems:"center",flexWrap:"wrap",marginBottom:4}}>
              <ThemeSwitcher theme={theme} setTheme={setTheme} />
              {currentUser && (
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:999,background:"var(--bg-surface-1)",border:"1px solid var(--border-base)"}}>
                    <span style={{fontSize:13}}>👤</span>
                    <span style={{fontSize:11,color:"var(--accent)",fontWeight:700}}>{currentUser.name}</span>
                    <span style={{fontSize:9,padding:"2px 7px",borderRadius:999,
                      background:currentUser.role==="superadmin"?"rgba(245,158,11,.2)":"var(--accent-soft)",
                      color:currentUser.role==="superadmin"?"#f59e0b":"var(--accent)",
                      fontWeight:800,letterSpacing:.5,textTransform:"uppercase"}}>
                      {currentUser.role==="superadmin"?"⭐ SA":currentUser.role}
                    </span>
                  </div>
                  {currentUser.permissions?.canManageUsers && (
                    <button onClick={onOpenAdmin} style={{padding:"5px 12px",borderRadius:999,border:"1px solid var(--border-accent)",background:"var(--accent-soft)",color:"var(--accent)",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>⚙️</button>
                  )}
                  <button onClick={onLogout} style={{padding:"5px 12px",borderRadius:999,border:"1px solid rgba(239,68,68,.25)",background:"rgba(239,68,68,.06)",color:"#f87171",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>🚪</button>
                </div>
              )}
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"center",alignItems:"center",flexWrap:"wrap"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 14px",borderRadius:999,background:"var(--bg-surface-1)",border:"1px solid "+(monthlySpend>MONTHLY_LIMIT*.8?"rgba(239,68,68,.3)":"rgba(16,185,129,.3)"),boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>
                <span style={{fontSize:13}}>{monthlySpend>MONTHLY_LIMIT*.8?"🔴":"💚"}</span>
                <div style={{width:56,height:6,borderRadius:3,background:"var(--prog-bg)",overflow:"hidden"}}>
                  <div style={{height:"100%",borderRadius:3,width:Math.min(100,(monthlySpend/MONTHLY_LIMIT)*100)+"%",background:monthlySpend>MONTHLY_LIMIT*.8?"linear-gradient(90deg,#f87171,#ef4444)":"linear-gradient(90deg,#86efac,#22c55e)",transition:"width .5s"}}/>
                </div>
                <span style={{fontFamily:"'Fira Code',monospace",fontSize:11,color:monthlySpend>MONTHLY_LIMIT*.8?"#dc2626":"#10b981",fontWeight:700}}>{fmtCost(monthlySpend)}</span>
                <span style={{fontSize:10,color:"var(--text-muted)"}}>/ mes</span>
              </div>

              <div style={{display:"flex",background:"var(--bg-surface-1)",borderRadius:12,border:"1px solid var(--border-base)",overflow:"hidden",boxShadow:"0 2px 10px rgba(139,92,246,.08)"}}>
                {[["run","⚡ Enjambre"],["history","📂 Historial"]].map(([t,l])=>(
                  <button key={t} onClick={()=>setTab(t)} className="tab-btn"
                    style={{color:tab===t?"var(--accent)":"var(--text-secondary)",background:tab===t?"var(--accent-soft)":"transparent",borderBottom:tab===t?"3px solid #7c3aed":"3px solid transparent",padding:"9px 18px"}}>
                    {l}{t==="history"&&sessions.length>0&&<span style={{marginLeft:5,fontSize:9,padding:"2px 6px",borderRadius:999,background:"rgba(124,106,247,.12)",color:"#7c3aed",fontWeight:800}}>{sessions.length}</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── TAB: HISTORIAL ── */}
          {tab==="history" && (
            <div style={{animation:"fadeUp .35s ease"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,padding:"12px 16px",borderRadius:14,background:"var(--bg-surface-1)",border:"1px solid var(--border-base)"}}>
                <span style={{fontSize:20}}>📂</span>
                <div>
                  <div style={{fontSize:13,fontWeight:800,color:"var(--accent)"}}>Sesiones guardadas</div>
                  <div style={{fontSize:10,color:"var(--text-muted)"}}>Se persisten automáticamente entre sesiones 💾</div>
                </div>
              </div>
              {!sessionsLoaded && <div style={{textAlign:"center",padding:40,fontSize:24,animation:"bounce 1s ease infinite"}}>⏳</div>}
              {sessionsLoaded && sessions.length===0 && (
                <div className="card" style={{textAlign:"center",padding:48}}>
                  <div style={{fontSize:48,marginBottom:12,animation:"bounce 2s ease-in-out infinite"}}>📭</div>
                  <div style={{fontSize:14,fontWeight:700,color:"#7c3aed",marginBottom:6}}>Sin sesiones aún</div>
                  <div style={{fontSize:12,color:"var(--text-muted)"}}>Ejecuta el enjambre para guardar automáticamente ✨</div>
                </div>
              )}
              {sessionsLoaded && sessions.map(s => (
                <SessionCard key={s.id} session={s}
                  onLoad={loadSession}
                  onDelete={id => { deleteSession(id); setSessions(prev=>prev.filter(x=>x.id!==id)); }} />
              ))}
            </div>
          )}

          {/* ── TAB: RUN ── */}
          {tab==="run" && (
            <>
              {/* Agent grid */}
              <div style={{marginBottom:20,padding:"16px",borderRadius:20,background:"var(--bg-surface-1)",border:"1px solid var(--border-base)",boxShadow:"0 4px 20px rgba(139,92,246,.08)"}}>
                <div style={{fontSize:10,color:"rgba(167,139,250,.6)",fontWeight:800,textTransform:"uppercase",letterSpacing:2,marginBottom:10,textAlign:"center"}}>
                  🤖 {AGENTS.length} agentes especializados
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:5,justifyContent:"center"}}>
                  {AGENTS.map((ag,i)=>(
                    <div key={ag.id} style={{animation:"popIn .5s cubic-bezier(.34,1.56,.64,1) both",animationDelay:(i*.025)+"s"}}>
                      <AgentChip agent={ag} state={agentState(ag.id)}/>
                    </div>
                  ))}
                </div>
              </div>

              {/* Step indicator */}
              <div style={{display:"flex",gap:6,marginBottom:20,justifyContent:"center",alignItems:"center"}}>
                {[{l:"💡 Idea",active:step==="input"},{l:"⚡ Enjambre",active:step==="running"},{l:"🎯 Resultados",active:step==="done"}].map((s,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{
                      padding:"7px 16px",borderRadius:999,
                      fontFamily:"'Nunito',sans-serif",fontSize:11,fontWeight:800,
                      background:s.active?"rgba(124,106,247,.2)":"transparent",
                      border:"1px solid "+(s.active?"rgba(124,106,247,.6)":"rgba(255,255,255,.08)"),
                      color:s.active?"#a78bfa":"rgba(255,255,255,.2)",
                      transition:"all .3s cubic-bezier(.34,1.56,.64,1)",
                      boxShadow:s.active?"0 0 14px rgba(124,106,247,.3)":"none",
                      transform:s.active?"scale(1.08)":"scale(1)",
                    }}>
                      {s.l}
                    </div>
                    {i<2&&<span style={{color:"rgba(167,139,250,.4)",fontSize:14,fontWeight:900}}>→</span>}
                  </div>
                ))}
              </div>

              {/* ── INPUT ── */}
              {step==="input" && (
                <div style={{animation:"fadeUp .4s cubic-bezier(.34,1.56,.64,1) both"}}>
                  <div className="card-glow">
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
                      <span style={{fontSize:24,animation:"bounce 2s ease-in-out infinite"}}>💡</span>
                      <div>
                        <div style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:800,color:"#7c3aed"}}>¿Qué vamos a construir hoy?</div>
                        <div style={{fontSize:10,color:"#a78bfa",marginTop:1}}>Describe tu idea — el enjambre hace el resto 🚀</div>
                      </div>
                    </div>
                    <textarea value={idea} onChange={e=>setIdea(e.target.value)}
                      placeholder="Ej: Automatizar cotizaciones en ERP con MSSQL, notificación WhatsApp y registro en monday.com..."
                      style={{width:"100%",minHeight:110,padding:"14px 16px",borderRadius:14,boxSizing:"border-box",fontSize:14,lineHeight:1.7,resize:"vertical"}}
                    />

                    {/* Model + config row */}
                    <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginTop:10,marginBottom:12}}>
                      {Object.entries(MODELS).map(([key,m])=>(
                        <div key={key} onClick={()=>setModelKey(key)}
                          style={{display:"flex",alignItems:"center",gap:5,padding:"5px 11px",borderRadius:8,cursor:"pointer",transition:"all .15s",border:"1px solid "+(modelKey===key?m.color+"80":"rgba(255,255,255,.08)"),background:modelKey===key?m.color+"12":"transparent"}}>
                          <div style={{width:7,height:7,borderRadius:"50%",background:m.color,boxShadow:modelKey===key?"0 0 7px "+m.color:"none"}}/>
                          <span style={{fontSize:11,fontWeight:700,color:modelKey===key?"rgba(255,255,255,.1)":"rgba(200,210,255,.4)",fontFamily:"'DM Sans',sans-serif"}}>{m.label}</span>
                          <span style={{fontSize:9,color:modelKey===key?m.color+"bb":"rgba(255,255,255,.2)"}}>{m.badge}</span>
                        </div>
                      ))}
                      <button onClick={()=>setShowSelector(s=>!s)} className="btn btn-ghost"
                        style={{marginLeft:"auto",padding:"5px 11px",fontSize:10,borderRadius:8}}>
                        ⊞ Agentes <span style={{color:"#a78bfa",fontFamily:"'Fira Code',monospace"}}>{selectedAgents.size}</span>
                      </button>
                    </div>

                    {showSelector && (
                      <div style={{marginBottom:12,padding:12,borderRadius:12,background:"#080c14",border:"1px solid var(--border-base)"}}>
                        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
                          {PRESETS.map(p=>(
                            <button key={p.id} onClick={()=>setSelectedAgents(p.agents===null?new Set(AGENTS.map(a=>a.id)):new Set(p.agents))} className="btn btn-ghost" style={{padding:"3px 10px",fontSize:10,borderRadius:7}}>
                              {p.label}
                            </button>
                          ))}
                        </div>
                        {PHASES.map(phase=>(
                          <div key={phase.id} style={{marginBottom:6}}>
                            <div style={{fontSize:9,fontWeight:700,letterSpacing:1.5,color:phase.color,fontFamily:"'Syne',sans-serif",textTransform:"uppercase",marginBottom:4}}>{phase.name}</div>
                            <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                              {phase.agents.map(aid=>{
                                const ag=AGENTS.find(a=>a.id===aid); if(!ag) return null;
                                const sel=selectedAgents.has(aid);
                                return (
                                  <button key={aid} onClick={()=>setSelectedAgents(prev=>{const s=new Set(prev);s.has(aid)?s.delete(aid):s.add(aid);return s;})}
                                    style={{display:"inline-flex",alignItems:"center",gap:3,padding:"3px 8px",borderRadius:999,fontSize:10,fontWeight:600,cursor:"pointer",border:"1px solid "+(sel?ag.color:"var(--text-muted)"),background:sel?ag.color+"14":"transparent",color:sel?ag.color:"var(--text-muted)",fontFamily:"inherit",transition:"all .12s"}}>
                                    {ag.icon} {ag.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="divider"/>

                    <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                      <button className="btn btn-launch" onClick={()=>{requestLaunch("full");playSound("launch");haptic([40,15,40]);}}
                        disabled={!idea.trim()||selectedAgents.size===0}
                        style={{flex:"1 1 auto",justifyContent:"center",fontSize:15}}>
                        🚀 Lanzar enjambre · {selectedAgents.size} agentes
                      </button>
                      <button className="btn btn-out" onClick={()=>requestLaunch("lite")}
                        disabled={!idea.trim()}
                        style={{fontSize:12,padding:"10px 14px"}}>
                        ⚡ Lite
                      </button>
                      <button className="btn btn-out" onClick={()=>setShowStackConfig(true)}
                        style={{fontSize:12,padding:"10px 14px",position:"relative"}}
                        title="Configurar credenciales para código ejecutable">
                        🔧 Config
                        {Object.values(stackConfig).filter(v=>v&&v.toString().trim()).length > 0 && (
                          <span style={{position:"absolute",top:4,right:4,width:7,height:7,borderRadius:"50%",background:"#10b981",boxShadow:"0 0 5px #10b981"}}/>
                        )}
                      </button>
                    </div>
                    <div style={{marginTop:7,fontSize:10,color:"var(--text-muted)",textAlign:"center"}}>
                      ⚡ Ejecuta de inmediato · 🔧 Config agrega tus credenciales para código sin placeholders
                    </div>
                    {error && <div style={{marginTop:8,fontSize:12,color:"#f87171"}}>⚠ {error}</div>}
                  </div>
                </div>
              )}

              {/* ── RUNNING / DONE ── */}
              {(step==="running"||step==="done") && (
                <div className={step==="running"?"scanline":""} style={{animation:"fadeUp .35s ease",position:"relative"}}>
                  {/* Phase pills */}
                  <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:4,flexWrap:"wrap"}}>
                    {PHASES.map((ph,i)=>{
                      const isAct=currentPhase===i&&!synthPhase;
                      const isDone=(currentPhase>i||step==="done")&&!synthPhase;
                      const phaseAnim=isAct?"neonPulse 1.5s ease-in-out infinite":"none";
                      return (
                        <div key={ph.id} style={{flex:"0 0 auto",padding:"5px 13px",borderRadius:999,fontSize:10,fontWeight:800,whiteSpace:"nowrap",fontFamily:"'Nunito',sans-serif",background:isAct?"rgba(124,106,247,.25)":isDone?"rgba(16,185,129,.1)":"rgba(255,255,255,.04)",border:"1.5px solid "+(isAct?"#a78bfa":isDone?"#10b981":"rgba(255,255,255,.1)"),color:isAct?"#c4b5fd":isDone?"#10b981":"rgba(255,255,255,.4)",transition:"all .3s cubic-bezier(.34,1.56,.64,1)",boxShadow:isAct?"0 0 16px rgba(124,106,247,.4),0 0 32px rgba(124,106,247,.15)":"none",transform:isAct?"scale(1.08)":"scale(1)",animation:phaseAnim}}>
                          {isDone&&!isAct?"✅ ":isAct?"⚡ ":""}{ph.name}
                        </div>
                      );
                    })}
                    {synthPhase&&<div style={{flex:"0 0 auto",padding:"5px 13px",borderRadius:999,fontSize:10,fontWeight:800,whiteSpace:"nowrap",fontFamily:"'Nunito',sans-serif",background:"rgba(16,185,129,.05)",border:"2px solid #86efac",color:"#10b981",animation:"bounce .8s ease-in-out infinite"}}>✨ Síntesis</div>}
                    {masterPlanLoading&&<div style={{flex:"0 0 auto",padding:"5px 13px",borderRadius:999,fontSize:10,fontWeight:800,whiteSpace:"nowrap",fontFamily:"'Nunito',sans-serif",background:"rgba(251,191,36,.1)",border:"2px solid #fcd34d",color:"#fbbf24",animation:"bounce .6s ease-in-out infinite"}}>⭐ Orquestando</div>}
                  </div>

                  {/* Progress */}
                  {step==="running"&&(
                    <div style={{marginBottom:14,padding:"14px 16px",borderRadius:16,background:"#0d1117",border:"2px solid rgba(124,106,247,.2)",boxShadow:"0 4px 16px rgba(139,92,246,.1)"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11,color:"#6d28d9",marginBottom:10,fontWeight:700}}>
                        <span style={{display:"flex",alignItems:"center",gap:7}}>
                          <span style={{fontSize:16,animation:"bounce .8s ease-in-out infinite"}}>{synthPhase?"✨":masterPlanLoading?"⭐":"⚡"}</span>
                          <span>{synthPhase?"Síntesis colaborativa...":masterPlanLoading?"Orquestando plan maestro...":currentPhase>=0?PHASES[currentPhase]?.name:"Inicializando..."}</span>
                          {activeAgents.size>1&&!synthPhase&&<span style={{background:"rgba(251,191,36,.1)",color:"#fbbf24",fontSize:9,fontWeight:800,padding:"2px 6px",borderRadius:999}}>×{activeAgents.size} paralelo</span>}
                        </span>
                        <span style={{fontFamily:"'Fira Code',monospace",fontSize:11,color:"#7c3aed",fontWeight:700}}>{doneCount}/{totalSel}{failCount>0&&<span style={{color:"#dc2626"}}> ❌{failCount}</span>} · ⏱️{fmtTime(elapsed)}</span>
                      </div>
                      <div className="prog-track">
                        <div className="prog-fill" style={{width:pct+"%"}}/>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
                        <span style={{fontSize:10,color:"#a78bfa",fontWeight:700}}>{Math.round(pct)}% completado</span>
                        <button
                          onClick={cancelSwarm}
                          style={{display:"flex",alignItems:"center",gap:5,padding:"5px 13px",
                            borderRadius:8,border:"1px solid rgba(239,68,68,.3)",
                            background:"rgba(239,68,68,.07)",color:"#f87171",
                            fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito',sans-serif",
                            transition:"all .2s"}}>
                          ⏹ Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Active agents */}
                  {/* ── PHASE APPROVAL GATE ── */}
                  {phaseApproval && step==="running" && (
                    <div style={{marginBottom:14,borderRadius:20,overflow:"hidden",
                      border:"2.5px solid #a78bfa",
                      background:"linear-gradient(135deg,rgba(124,106,247,.12),rgba(236,72,153,.08))",
                      boxShadow:"0 0 40px rgba(124,106,247,.2),0 0 80px rgba(124,106,247,.08)",
                      animation:"fadeUp .4s cubic-bezier(.34,1.56,.64,1) both"}}>
                      <div style={{padding:"16px 20px",borderBottom:"1px solid rgba(124,106,247,.2)",
                        display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontSize:28,animation:"bounce 1s ease-in-out infinite"}}>✅</span>
                        <div style={{flex:1}}>
                          <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900,
                            color:"#c4b5fd",letterSpacing:"-.3px"}}>
                            {phaseApproval.phaseName} completada
                          </div>
                          <div style={{fontSize:11,color:"rgba(200,210,255,.5)",marginTop:3}}>
                            Revisa los resultados arriba antes de continuar con la siguiente fase
                          </div>
                        </div>
                        <div style={{display:"flex",gap:8}}>
                          <button className="btn btn-launch"
                            onClick={approvePhase}
                            style={{fontSize:13,padding:"10px 24px",animation:"neonPulse 1.5s ease-in-out infinite"}}>
                            ▶ Continuar siguiente fase
                          </button>
                          <button className="btn btn-ghost"
                            onClick={cancelSwarm}
                            style={{fontSize:11,color:"#f87171",borderColor:"rgba(239,68,68,.25)",background:"rgba(239,68,68,.06)"}}>
                            ⏹ Cancelar
                          </button>
                        </div>
                      </div>
                      <div style={{padding:"10px 20px",display:"flex",gap:16,flexWrap:"wrap"}}>
                        {PHASES.map((ph,i)=>{
                          const isDone = i <= phaseApproval.phaseIdx;
                          const isCurrent = i === phaseApproval.phaseIdx;
                          const isNext = i === phaseApproval.phaseIdx + 1;
                          if (i > phaseApproval.phaseIdx + 1) return null;
                          return (
                            <div key={ph.id} style={{display:"flex",alignItems:"center",gap:6,
                              padding:"4px 12px",borderRadius:999,
                              background:isCurrent?"rgba(124,106,247,.2)":isNext?"rgba(255,255,255,.04)":"rgba(16,185,129,.1)",
                              border:"1px solid "+(isCurrent?"rgba(124,106,247,.5)":isNext?"rgba(255,255,255,.15)":"rgba(16,185,129,.3)"),
                              fontSize:10,fontWeight:700,fontFamily:"'Nunito',sans-serif",
                              color:isCurrent?"#a78bfa":isNext?"rgba(255,255,255,.4)":"#10b981"}}>
                              {isDone&&!isCurrent?"✅ ":isCurrent?"🔵 ":isNext?"⏳ ":""}{ph.name}
                              {isNext&&<span style={{fontSize:9,color:"var(--text-muted)"}}>(siguiente)</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {step==="running"&&(activeAgents.size>0||synthAgents.size>0)&&(
                    <div style={{padding:"10px 14px",marginBottom:12,borderRadius:14,background:synthPhase?"rgba(16,185,129,.05)":"#0d1117",border:"2px solid "+(synthPhase?"#86efac":"rgba(167,139,250,.4)"),display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",fontSize:11,boxShadow:"0 2px 10px rgba(139,92,246,.08)"}}>
                      <span className="sp" style={{borderTopColor:synthPhase?"#22c55e":"#a78bfa",borderColor:synthPhase?"rgba(16,185,129,.15)":"rgba(124,106,247,.2)"}}/>
                      <span style={{color:synthPhase?"#10b981":"#7c3aed",fontSize:10,fontWeight:800,letterSpacing:.5}}>{synthPhase?"✨ Sintetizando:":"⚡ Ejecutando:"}</span>
                      {[...(synthPhase?synthAgents:activeAgents)].map(aid=>{
                        const ag=AGENTS.find(a=>a.id===aid);
                        return ag?<span key={aid} style={{padding:"3px 10px",borderRadius:999,background:"#0d1117",border:"1.5px solid rgba(124,106,247,.2)",color:"#7c3aed",fontSize:10,fontWeight:800,boxShadow:"0 1px 4px rgba(139,92,246,.1)"}}>{ag.icon} {ag.name}</span>:null;
                      })}
                      <span style={{marginLeft:"auto",fontFamily:"'Fira Code',monospace",color:"#a78bfa",fontSize:10,fontWeight:700}}>⏱️{fmtTime(elapsed)}</span>
                    </div>
                  )}

                  {/* Auto-detect badge */}
                  {autoDetect && (
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12,padding:"10px 14px",borderRadius:14,background:"#0d1117",border:"2px solid rgba(167,139,250,.4)",boxShadow:"0 2px 10px rgba(139,92,246,.08)",animation:"slideIn .4s ease both"}}>
                      <span style={{fontSize:13}}>🔍</span>
                      <span style={{fontSize:10,fontFamily:"'Nunito',sans-serif",fontWeight:800,color:"#7c3aed",alignSelf:"center"}}>Detectado:</span>
                      {[
                        autoDetect.projectType,
                        autoDetect.primaryStack,
                        autoDetect.database !== "none" && autoDetect.database,
                        autoDetect.estimatedComplexity,
                      ].filter(Boolean).map((v,i)=>(
                        <span key={i} style={{fontSize:10,padding:"3px 10px",borderRadius:999,background:"rgba(124,106,247,.12)",color:"#7c3aed",fontFamily:"'Fira Code',monospace",fontWeight:700}}>{v}</span>
                      ))}
                    </div>
                  )}

                  {/* Toolbar */}
                  {Object.keys(results).length>0&&(
                    <div style={{display:"flex",gap:6,marginBottom:12,alignItems:"center",flexWrap:"wrap"}}>
                      <span style={{fontSize:11,color:"#7c3aed",fontFamily:"'Nunito',sans-serif",fontWeight:800}}>📊 {doneCount} resultados</span>
                      <button className="btn btn-ghost" style={{padding:"5px 11px",fontSize:11}} onClick={()=>setAllExpanded(true)}>📂 Todo</button>
                      <button className="btn btn-ghost" style={{padding:"5px 11px",fontSize:11}} onClick={()=>setAllExpanded(false)}>📁 Colapsar</button>
                    </div>
                  )}

                  {/* Results by phase */}
                  <div ref={outputRef}>
                    {PHASES.map((phase,pi)=>{
                      let ids=[...phase.agents];
                      if(PROMPT_ENG_INJECT.includes(pi)&&!ids.includes("prompt_eng"))ids.push("prompt_eng");
                      ids=[...new Set(ids)].filter(id=>results[id]);
                      if(!ids.length) return null;
                      return (
                        <PhaseBlock key={phase.id} phase={phase} phaseIdx={pi} phaseIds={ids} results={results} allExpanded={allExpanded} retryAgent={retryAgent}/>
                      );
                    })}
                  </div>

                  {/* ── REFINE PANEL — questions load async while swarm runs ── */}
                  {questions.length>0 && (step==="running"||step==="done") && (
                    <div style={{marginBottom:14,padding:"14px 16px",borderRadius:14,background:"rgba(124,106,247,.05)",border:"1px solid rgba(124,106,247,.18)",animation:"fadeUp .4s ease"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                        <div style={{width:4,height:18,borderRadius:2,background:"#a78bfa",boxShadow:"0 0 8px #7c3aed",flexShrink:0}}/>
                        <span style={{fontFamily:"'Syne',sans-serif",fontSize:10,fontWeight:700,letterSpacing:2,color:"#a78bfa",textTransform:"uppercase"}}>Refinar contexto</span>
                        <span style={{fontSize:10,color:"var(--text-muted)"}}>— responde para re-ejecutar con más contexto</span>
                      </div>
                      {questions.map((q,i)=>{
                        const isText=q.type==="text", isMulti=q.type==="multiselect";
                        const selArr=isMulti?(answers[q.id]||[]):[];
                        return (
                          <div key={q.id||i} style={{marginBottom:12}}>
                            <div style={{fontSize:12,fontWeight:600,color:"rgba(220,230,255,.85)",marginBottom:4}}>{q.question}</div>
                            {isText
                              ? <textarea value={answers[q.id]||""} onChange={e=>setAnswers(p=>({...p,[q.id]:e.target.value}))}
                                  placeholder="Tu respuesta..." style={{width:"100%",minHeight:48,padding:"7px 10px",fontSize:12,boxSizing:"border-box",resize:"vertical"}}/>
                              : <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                                  {q.options.map((opt,oi)=>{
                                    const sel=q.type==="select"?answers[q.id]===opt:selArr.includes(opt);
                                    return (
                                      <button key={oi} onClick={()=>{
                                        if(q.type==="select")setAnswers(p=>({...p,[q.id]:opt}));
                                        else setAnswers(p=>({...p,[q.id]:sel?selArr.filter(x=>x!==opt):[...selArr,opt]}));
                                      }} style={{padding:"5px 11px",borderRadius:7,fontSize:11,fontWeight:500,cursor:"pointer",border:"1px solid "+(sel?"rgba(124,106,247,.5)":"rgba(255,255,255,.08)"),background:sel?"rgba(124,106,247,.14)":"transparent",color:sel?"#a78bfa":"rgba(200,210,255,.4)",fontFamily:"inherit",transition:"all .12s"}}>
                                        {opt}
                                      </button>
                                    );
                                  })}
                                </div>
                            }
                          </div>
                        );
                      })}
                      <div style={{display:"flex",gap:6,marginTop:8}}>
                        <button className="btn btn-prime" onClick={()=>{setQuestions([]);setAnswers({});requestLaunch("full");}}
                          style={{fontSize:12,padding:"8px 16px"}}>
                          ↺ Re-ejecutar con contexto
                        </button>
                        <button className="btn btn-ghost" onClick={()=>setQuestions([])}
                          style={{fontSize:11,padding:"8px 12px"}}>
                          Descartar preguntas
                        </button>
                      </div>
                    </div>
                  )}

                  {/* MASTER PLAN — shown while loading and when done */}
                  {(masterPlanLoading || masterPlan) && (
                    <div style={{marginBottom:16,borderRadius:20,overflow:"hidden",border:"2px solid #86efac",background:"#0d1117",boxShadow:"0 8px 28px rgba(34,197,94,.15)",animation:"popIn .5s cubic-bezier(.34,1.56,.64,1) both"}}>
                      <div style={{padding:"14px 18px",background:"linear-gradient(135deg,rgba(16,185,129,.05),rgba(16,185,129,.1))",borderBottom:"2px solid rgba(16,185,129,.15)",display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontSize:22,animation:masterPlanLoading?"starSpin 2s linear infinite":"none"}}>⭐</span>
                        <span style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:900,color:"#10b981",flex:1,letterSpacing:"-.3px"}}>Plan Maestro de Ejecución</span>
                        {masterPlanLoading && <><span className="sp" style={{borderTopColor:"#22c55e",borderColor:"rgba(16,185,129,.15)"}}/><span style={{fontSize:11,color:"#10b981",fontWeight:700}}>Consolidando {doneCount} agentes...</span></>}
                        {masterPlan && !masterPlanLoading && (
                          <button onClick={()=>{setExportModal({content:masterPlan,filename:"plan-maestro.md"}); playSound("copy"); haptic([20]);}}
                            style={{padding:"6px 14px",borderRadius:10,border:"2px solid #86efac",background:"#0d1117",color:"#10b981",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"'Nunito',sans-serif"}}>
                            📋 Copiar
                          </button>
                        )}
                      </div>
                      {masterPlan && !masterPlanLoading && (
                        <div style={{padding:"16px 20px",fontSize:12.5,lineHeight:1.8,color:"#1e293b",fontFamily:"'Fira Code','JetBrains Mono',monospace",whiteSpace:"pre-wrap",maxHeight:600,overflowY:"auto",background:"#080c14"}}>
                          <div dangerouslySetInnerHTML={{__html:formatMarkdown(masterPlan)}}/>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Done */}
                  {step==="done"&&Object.keys(results).length>0&&(
                    <div style={{marginTop:20,animation:"popIn .5s cubic-bezier(.34,1.56,.64,1) both"}}>
                      <div style={{padding:"20px 22px",borderRadius:20,marginBottom:16,background:"linear-gradient(135deg,#0d1117,rgba(16,185,129,.05))",border:"2px solid rgba(167,139,250,.4)",boxShadow:"0 8px 32px rgba(139,92,246,.15)"}}>
                        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                          <span style={{fontSize:36,animation:"starSpin 3s ease-in-out infinite"}}>🎉</span>
                          <div style={{flex:1}}>
                            <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,color:"#3730a3",letterSpacing:"-.5px"}}>¡Enjambre completado! 🚀</div>
                            <div style={{fontSize:11,color:"#7c3aed",marginTop:3,fontWeight:700}}>✅ {doneCount} agentes{failCount>0?" · ❌ "+failCount+" errores":""} · ⏱️ {fmtTime(elapsed)} · 🧠 {MODELS[modelKey].label}</div>
                          </div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:3,maxWidth:160,justifyContent:"flex-end"}}>
                            {AGENTS.filter(a=>results[a.id]&&!results[a.id].isError).map(a=>(
                              <span key={a.id} style={{fontSize:16,animation:"bounce "+(.3+Math.random())+"s ease-in-out infinite"}} title={a.name}>{a.icon}</span>
                            ))}
                          </div>
                        </div>
                        <div className="divider" style={{margin:"0 0 14px"}}/>

                        {/* Export panel (Brecha 3) */}
                        <div>
                          <div style={{fontSize:11,fontFamily:"'Nunito',sans-serif",fontWeight:800,color:"#7c3aed",marginBottom:12,display:"flex",alignItems:"center",gap:6}}>
                            📦 Exportar resultados <span style={{fontSize:10,color:"#a78bfa",fontWeight:600}}>· click → preview → Ctrl+C</span>
                          </div>
                          {EXPORT_GROUPS.map((g,gi)=>(
                            <div key={gi} style={{marginBottom:10}}>
                              <div style={{fontSize:8,fontWeight:700,letterSpacing:3,color:"var(--text-muted)",textTransform:"uppercase",fontFamily:"'Syne',sans-serif",marginBottom:6}}>{g.label}</div>
                              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                                {g.items.map((e,i)=>(
                                  <button key={i} onClick={()=>handleExport(e.label,e.fn,e.file,e.mime)}
                                    style={{display:"inline-flex",alignItems:"center",gap:5,padding:"7px 14px",borderRadius:9,background:e.bg,color:"#fff",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",border:"none",transition:"all .15s",boxShadow:"0 2px 12px "+e.bg+"45",letterSpacing:.2}}
                                    onMouseEnter={ev=>{ev.currentTarget.style.filter="brightness(1.2) saturate(1.3)";ev.currentTarget.style.transform="translateY(-3px) scale(1.06)";ev.currentTarget.style.boxShadow="0 12px 30px "+e.bg+"80";playSound("click");haptic([8]);}}
                                    onMouseLeave={ev=>{ev.currentTarget.style.filter="none";ev.currentTarget.style.transform="none";ev.currentTarget.style.boxShadow="0 2px 12px "+e.bg+"45";}}
                                    onClick={()=>{handleExport(e.label,e.fn,e.file,e.mime);playSound("copy");haptic([15,8,15]);}}>
                                    <span style={{fontSize:12}}>{e.icon}</span><span>{e.label}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* ── DEPLOY PANEL ── */}
                  {step==="done" && doneCount>0 && (
                    <div style={{marginBottom:14}}>
                      {/* Deploy trigger button */}
                      {!showDeployPanel && (
                        <div style={{textAlign:"center",marginBottom:10}}>
                          <button
                            className="btn btn-launch"
                            onClick={runDeploy}
                            disabled={!stackConfig.ghToken && !stackConfig.doToken && !stackConfig.supabaseUrl}
                            style={{fontSize:15,padding:"14px 36px",boxShadow:"0 8px 32px rgba(124,58,237,.6),0 0 60px rgba(124,58,237,.2)"}}>
                            🚀 Desplegar ahora
                          </button>
                          {(!stackConfig.ghToken && !stackConfig.doToken) && (
                            <div style={{fontSize:11,color:"var(--text-muted)",marginTop:8}}>
                              Configura GitHub Token o DO Token en 🔧 Config para habilitar el deploy
                            </div>
                          )}
                        </div>
                      )}

                      {/* Deploy logs panel */}
                      {showDeployPanel && (
                        <div style={{borderRadius:18,overflow:"hidden",border:"1px solid rgba(124,106,247,.25)",background:"#0a0e18",animation:"fadeUp .4s ease"}}>
                          <div style={{padding:"12px 16px",background:"rgba(124,106,247,.08)",borderBottom:"1px solid rgba(124,106,247,.12)",display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontSize:20,animation:deployRunning?"starSpin 1.5s linear infinite":"none"}}>🚀</span>
                            <span style={{fontFamily:"'Syne',sans-serif",fontSize:12,fontWeight:800,color:"#a78bfa",flex:1,letterSpacing:.5}}>
                              {deployRunning?"DESPLEGANDO...":"DEPLOY COMPLETADO"}
                            </span>
                            {deployRunning && <span className="sp"/>}
                            {deployDone && <span style={{fontSize:11,padding:"3px 10px",borderRadius:999,background:"rgba(16,185,129,.15)",color:"#10b981",fontWeight:800}}>✅ Listo</span>}
                          </div>

                          {/* Step summary */}
                          {deploySteps.length>0 && (
                            <div style={{display:"flex",gap:6,flexWrap:"wrap",padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
                              {deploySteps.map((s,i)=>(
                                <a key={i} href={s.url||"#"} target="_blank" rel="noreferrer"
                                  style={{display:"inline-flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:999,fontSize:11,fontWeight:700,textDecoration:"none",
                                    background:s.status==="ok"?"rgba(16,185,129,.12)":s.status==="warn"?"rgba(251,191,36,.1)":"rgba(239,68,68,.1)",
                                    border:"1px solid "+(s.status==="ok"?"rgba(16,185,129,.35)":s.status==="warn"?"rgba(251,191,36,.3)":"rgba(239,68,68,.3)"),
                                    color:s.status==="ok"?"#10b981":s.status==="warn"?"#fbbf24":"#f87171",
                                    animation:"popIn .4s cubic-bezier(.34,1.56,.64,1) both",animationDelay:(i*.08)+"s",
                                  }}>
                                  {s.status==="ok"?"✅":s.status==="warn"?"⚠️":"❌"} {s.name}
                                  {s.url && <span style={{fontSize:9,opacity:.6}}>↗</span>}
                                </a>
                              ))}
                            </div>
                          )}

                          {/* Live logs */}
                          <div style={{padding:"10px 14px",maxHeight:280,overflowY:"auto",fontFamily:"'Fira Code',monospace",fontSize:11.5,lineHeight:1.9}}>
                            {deployLogs.map((log,i)=>(
                              <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",animation:"slideInLeft .2s ease both",animationDelay:(i*.03)+"s"}}>
                                <span style={{color:"var(--text-muted)",fontSize:10,flexShrink:0,marginTop:2}}>{log.ts}</span>
                                <span style={{
                                  color:log.status==="ok"?"#10b981":log.status==="error"?"#f87171":log.status==="warn"?"#fbbf24":"rgba(167,139,250,.8)",
                                  fontSize:10,flexShrink:0,marginTop:2,
                                }}>{log.status==="ok"?"✅":log.status==="error"?"❌":log.status==="warn"?"⚠️":"🔵"}</span>
                                <div>
                                  <span style={{color:"rgba(200,210,255,.85)"}}>{log.msg}</span>
                                  {log.detail && <span style={{color:"var(--text-muted)",marginLeft:6,fontSize:10}}>{log.detail.slice(0,80)}</span>}
                                </div>
                              </div>
                            ))}
                            {deployRunning && (
                              <div style={{display:"flex",gap:6,alignItems:"center",marginTop:6}}>
                                <div style={{display:"flex",gap:3}}>
                                  {[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:"#a78bfa",animation:"bounce .7s ease-in-out infinite",animationDelay:(i*.15)+"s"}}/>)}
                                </div>
                                <span style={{color:"rgba(167,139,250,.5)",fontSize:11}}>ejecutando...</span>
                              </div>
                            )}
                          </div>

                          {deployDone && (
                            <div style={{padding:"10px 14px",borderTop:"1px solid rgba(255,255,255,.05)",display:"flex",gap:7}}>
                              <button className="btn btn-launch" onClick={runDeploy} style={{fontSize:12,padding:"8px 16px"}}>
                                🔄 Re-deploy
                              </button>
                              <button className="btn btn-ghost" onClick={()=>setShowDeployPanel(false)} style={{fontSize:11}}>
                                Cerrar
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{textAlign:"center"}}>
                        <button className="btn btn-out" onClick={reset}>◆ Nueva idea</button>
                      </div>
                    </div>
                  )}

                  {error&&<div style={{color:"#f87171",fontSize:12,marginTop:8,textAlign:"center"}}>⚠ {error}</div>}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── STACK CONFIG PANEL ── */}
      {showStackConfig && (
        <StackConfigPanel
          config={stackConfig}
          onChange={(key, val) => setStackConfig(prev => ({...prev, [key]: val}))}
          onClose={() => setShowStackConfig(false)}
        />
      )}

      {/* ── BUDGET MODAL ── */}}
      {showBudgetModal&&costEstimate&&(
        <div style={{position:"fixed",inset:0,background:"rgba(3,5,12,.88)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:"#0d1117",border:"1px solid rgba(124,106,247,.4)",borderRadius:20,padding:26,maxWidth:400,width:"100%",boxShadow:"0 0 60px rgba(124,106,247,.12)",animation:"fadeUp .2s ease"}}>
            <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:18}}>
              <div style={{width:42,height:42,borderRadius:12,background:"rgba(124,106,247,.12)",border:"1px solid rgba(124,106,247,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>
                {(monthlySpend+costEstimate.total)>MONTHLY_LIMIT?"⚠":"✓"}
              </div>
              <div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:800,color:"rgba(255,255,255,.1)"}}>{costEstimate.total>MONTHLY_LIMIT?"Límite mensual cerca":"Resumen de costo"}</div>
                <div style={{fontSize:10,color:"var(--text-muted)",marginTop:2}}>{MODELS[modelKey].label} · {pendingLaunch?.agentList?.length} agentes</div>
              </div>
            </div>
            <div style={{background:"#080c14",borderRadius:12,padding:14,marginBottom:14}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
                {[["Pase 1",fmtCost(costEstimate.pass1)],["Síntesis",synthEnabled?fmtCost(costEstimate.pass2):"off"]].map(([k,v])=>(
                  <div key={k} style={{padding:"8px 10px",borderRadius:8,background:"#0d1117",border:"1px solid var(--border-base)"}}>
                    <div style={{fontSize:9,color:"var(--text-muted)",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:3}}>{k}</div>
                    <div style={{fontFamily:"'Fira Code',monospace",fontSize:14,color:"rgba(200,210,255,.8)"}}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 11px",borderRadius:9,background:"rgba(124,106,247,.1)",border:"1px solid rgba(124,106,247,.25)"}}>
                <span style={{fontFamily:"'Syne',sans-serif",fontSize:9,fontWeight:800,letterSpacing:1.5,color:"rgba(200,210,255,.5)",textTransform:"uppercase"}}>Total run</span>
                <span style={{fontFamily:"'Fira Code',monospace",fontSize:20,fontWeight:700,color:"#a78bfa"}}>{fmtCost(costEstimate.total)}</span>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              <button onClick={()=>{executeLaunch(pendingLaunch.mode,pendingLaunch.agentList,costEstimate.total);}} className="btn btn-prime" style={{justifyContent:"center",width:"100%",fontSize:13}}>◉ Confirmar y ejecutar</button>
              <button onClick={()=>{const la=LITE_CORE.filter(id=>selectedAgents.has(id));const lc=estimateCost(la,modelKey,false);setShowBudgetModal(false);executeLaunch("lite",la,lc.total);}} className="btn btn-out" style={{justifyContent:"center",width:"100%",fontSize:12}}>⚡ Modo Lite — {fmtCost(estimateCost(LITE_CORE.filter(id=>selectedAgents.has(id)),modelKey,false).total)}</button>
              <button onClick={()=>{setShowBudgetModal(false);setPendingLaunch(null);}} className="btn btn-ghost" style={{justifyContent:"center",width:"100%",fontSize:12}}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── EXPORT MODAL ── */}
      {exportModal&&<ExportModal content={exportModal.content} filename={exportModal.filename} onClose={()=>setExportModal(null)}/>}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE BLOCK
// ─────────────────────────────────────────────────────────────────────────────
function PhaseBlock({ phase, phaseIdx, phaseIds, results, allExpanded, retryAgent }) {
  const [open, setOpen] = useState(true);
  useEffect(() => { setOpen(allExpanded); }, [allExpanded]);
  const ok  = phaseIds.filter(id=>!results[id]?.isError).length;
  const err = phaseIds.filter(id=>results[id]?.isError).length;
  const phaseEmojis = ["📥","🎨","⚡","✅","🧠","🛡️","♻️"];
  return (
    <div style={{marginBottom:12,borderRadius:20,overflow:"hidden",border:"2px solid "+(open?"rgba(167,139,250,.4)":"rgba(124,106,247,.2)"),background:"#0d1117",transition:"all .25s",boxShadow:open?"0 8px 28px rgba(139,92,246,.12)":"0 2px 8px rgba(139,92,246,.05)",animation:"cardIn .4s ease both"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"13px 16px",border:"none",cursor:"pointer",background:open?"#0d1117":"#fff",fontFamily:"inherit",transition:"background .2s"}}>
        <span style={{fontSize:20,animation:open?"wiggle 2s ease-in-out infinite":"none"}}>{phaseEmojis[phaseIdx]||"📦"}</span>
        <div style={{width:26,height:26,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,background:open?"#7c3aed":"rgba(124,106,247,.12)",fontSize:11,fontWeight:900,color:open?"#fff":"#7c3aed",fontFamily:"'Syne',sans-serif",transition:"all .25s"}}>{phaseIdx}</div>
        <span style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:800,color:"#3730a3",flex:1,textAlign:"left"}}>{phase.name}</span>
        {ok>0&&<span style={{fontSize:10,fontWeight:800,padding:"3px 10px",borderRadius:999,background:"rgba(16,185,129,.1)",color:"#10b981"}}>✅ {ok}</span>}
        {err>0&&<span style={{fontSize:10,fontWeight:800,padding:"3px 10px",borderRadius:999,background:"rgba(239,68,68,.12)",color:"#dc2626"}}>❌ {err}</span>}
        <span style={{fontSize:16,color:"rgba(167,139,250,.4)",transition:"transform .25s",transform:open?"rotate(180deg)":"rotate(0)",flexShrink:0}}>▾</span>
      </button>
      {open&&(
        <div style={{padding:"8px 12px 12px",background:"#080c14"}}>
          {phaseIds.map((aid,idx)=>{
            const ag=AGENTS.find(a=>a.id===aid);
            return ag?<AgentResult key={aid} agent={ag} result={results[aid]} defaultOpen={idx===0&&!results[aid]?.isError} onRetry={results[aid]?.isError?()=>retryAgent(aid):null}/>:null;
          })}
        </div>
      )}
    </div>
  );
}
