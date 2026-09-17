// ══════════════════════════════════════════════════════════════════
// CATOLICOSGPT v4.1 — MÓDULO DE AUTENTICACIÓN
// JWT + bcrypt + límites configurables por admin + Firestore Cloud Sync
// ══════════════════════════════════════════════════════════════════

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const firebaseSync = require('./firebase-module');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) { try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch(e) {} }

const USERS_PATH    = path.join(DATA_DIR, 'users.json');
const COUPONS_PATH  = path.join(DATA_DIR, 'coupons.json');
const CONFIG_PATH   = path.join(DATA_DIR, 'plan-config.json');
const JWT_SECRET    = process.env.JWT_SECRET || 'cgpt-jwt-secret-2026-change-in-production';

// Backup files if disk is secondary
const USERS_BACKUP    = path.join(__dirname, 'data', 'users.json');
const COUPONS_BACKUP  = path.join(__dirname, 'data', 'coupons.json');
const CONFIG_BACKUP   = path.join(__dirname, 'data', 'plan-config.json');

// ── Loaders ──
function loadUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_PATH, 'utf-8')); } catch(e) {}
  try { return JSON.parse(fs.readFileSync(USERS_BACKUP, 'utf-8')); } catch(e) {}
  return { users: [] };
}
function saveUsers(d) {
  const json = JSON.stringify(d, null, 2);
  try { fs.writeFileSync(USERS_PATH, json, 'utf-8'); } catch(e) { console.error('[Auth] Error users save:', e.message); }
  try { fs.writeFileSync(USERS_BACKUP, json, 'utf-8'); } catch(e) {}

  // Sincronización asincrónica de fondo hacia Firestore (Pillar 6, 12, 13)
  if (d && Array.isArray(d.users)) {
    d.users.forEach(u => {
      firebaseSync.syncUploadUser(u).catch(err => {
        console.error('[Firebase Sync] Error al sincronizar usuario:', err.message);
      });
    });
  }
}

function loadCoupons() {
  try { return JSON.parse(fs.readFileSync(COUPONS_PATH, 'utf-8')); } catch(e) {}
  try { return JSON.parse(fs.readFileSync(COUPONS_BACKUP, 'utf-8')); } catch(e) {}
  return { coupons: [] };
}
function saveCoupons(d) {
  const json = JSON.stringify(d, null, 2);
  try { fs.writeFileSync(COUPONS_PATH, json, 'utf-8'); } catch(e) { console.error('[Auth] Error coupons save:', e.message); }
  try { fs.writeFileSync(COUPONS_BACKUP, json, 'utf-8'); } catch(e) {}

  // Sincronización asincrónica de fondo hacia Firestore
  if (d && Array.isArray(d.coupons)) {
    d.coupons.forEach(c => {
      firebaseSync.syncUploadCoupon(c).catch(err => {
        console.error('[Firebase Sync] Error al sincronizar cupón:', err.message);
      });
    });
  }
}

function loadPlanConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')); } catch(e) {}
  try { return JSON.parse(fs.readFileSync(CONFIG_BACKUP, 'utf-8')); } catch(e) {}
  return { planes: { free:{infografiasCount:1,periodo:'daily'}, premium:{infografiasCount:-1,periodo:'unlimited'}, admin:{infografiasCount:-1,periodo:'unlimited'} } };
}
function savePlanConfig(d) {
  d.updatedAt = new Date().toISOString();
  const json = JSON.stringify(d, null, 2);
  try { fs.writeFileSync(CONFIG_PATH, json, 'utf-8'); } catch(e) { console.error('[Auth] Error plan-config save:', e.message); }
  try { fs.writeFileSync(CONFIG_BACKUP, json, 'utf-8'); } catch(e) {}
}

// ── ¿Merece la pena bajar esta colección? ──────────────────────────────────
// Antes se bajaba TODO en cada arranque. El catálogo del blog son más de dos
// mil quinientos documentos y Firestore cobra una lectura por documento, así
// que un par de despliegues agotaban la cuota diaria gratuita del proyecto y a
// partir de ahí fallaba hasta lo pequeño: usuarios, cupones, el registro de
// borrados. Y el aviso de Google es tajante: esta base de datos no puede
// superar el límite gratuito ni activando facturación.
//
// Ahora primero se pregunta cuántos documentos hay -tres lecturas en vez de dos
// mil quinientas- y solo se baja el catálogo si la cuenta no cuadra con lo que
// ya hay en el disco. Con disco persistente eso significa bajarlo una vez y no
// volver a tocarlo mientras nadie añada ni borre nada.
//
// El precio de esta decisión: si alguien EDITA un documento en la consola de
// Firebase sin añadir ni borrar ninguno, la cuenta no cambia y el cambio no se
// baja. Para esos casos está FIREBASE_FORZAR_DESCARGA=1, que baja todo igual
// que antes.
async function debeDescargar(nombreColeccion, cuantosEnDisco) {
  if (process.env.FIREBASE_FORZAR_DESCARGA === '1') {
    console.log(`[Firebase Sync] ${nombreColeccion}: descarga forzada por FIREBASE_FORZAR_DESCARGA.`);
    return true;
  }
  if (typeof firebaseSync.contarEnLaNube !== 'function') return true;
  const enLaNube = await firebaseSync.contarEnLaNube(nombreColeccion);
  // Sin conteo no se sabe nada; se baja, que es como se comportaba antes.
  if (enLaNube === null) return true;
  if (enLaNube === 0) {
    console.log(`[Firebase Sync] ${nombreColeccion}: la nube está vacía; no hay nada que bajar.`);
    return false;
  }
  if (enLaNube === cuantosEnDisco) {
    console.log(`[Firebase Sync] ${nombreColeccion}: ${cuantosEnDisco} en el disco y ${enLaNube} en la nube; no se baja nada.`);
    return false;
  }
  console.log(`[Firebase Sync] ${nombreColeccion}: ${cuantosEnDisco} en el disco frente a ${enLaNube} en la nube; bajando el catálogo.`);
  return true;
}

// ── Inicialización de la Sincronización de Fondo con Firestore ──
async function initFirebaseSync() {
  console.log('[Firebase Sync] Intentando autenticar servidor en la nube...');
  if (typeof firebaseSync.authenticateServer === 'function') {
    await firebaseSync.authenticateServer().catch(err => {
      console.warn('[Firebase Sync] No se pudo autenticar el servidor:', err.message);
    });
  }

  console.log('[Firebase Sync] Iniciando sincronización bidireccional con Firestore...');
  
  // 1. Unificar usuarios
  let localUsersData = loadUsers();
  try {
    const mergedUsers = await firebaseSync.syncDownloadUsers(localUsersData.users || []);
    localUsersData.users = mergedUsers;
    
    // Guardar unificados localmente
    const jsonUsers = JSON.stringify(localUsersData, null, 2);
    try { fs.writeFileSync(USERS_PATH, jsonUsers, 'utf-8'); } catch(e) {}
    try { fs.writeFileSync(USERS_BACKUP, jsonUsers, 'utf-8'); } catch(e) {}

    // Subir todos los locales (por si había nuevos locales no registrados en Firestore)
    for (const u of mergedUsers) {
      await firebaseSync.syncUploadUser(u).catch(() => {});
    }
  } catch (err) {
    console.error('[Firebase Sync] Error sincronizando usuarios en inicio:', err.message);
  }

  // 2. Unificar cupones
  let localCouponsData = loadCoupons();
  try {
    const mergedCoupons = await firebaseSync.syncDownloadCoupons(localCouponsData.coupons || []);
    localCouponsData.coupons = mergedCoupons;

    const jsonCoupons = JSON.stringify(localCouponsData, null, 2);
    try { fs.writeFileSync(COUPONS_PATH, jsonCoupons, 'utf-8'); } catch(e) {}
    try { fs.writeFileSync(COUPONS_BACKUP, jsonCoupons, 'utf-8'); } catch(e) {}

    for (const c of mergedCoupons) {
      await firebaseSync.syncUploadCoupon(c).catch(() => {});
    }
  } catch (err) {
    console.error('[Firebase Sync] Error sincronizando cupones en inicio:', err.message);
  }

  // 3. Unificar Infografías
  try {
    console.log('[Firebase Sync] Unificando infografías con la nube...');
    const infografiasModule = require('./infografias-module');
    const registroEliminadas = require('./infografias-eliminadas');
    // El registro de borrados se lee de la nube ANTES de bajar el catálogo:
    // sin disco persistente, Firestore es lo único que recuerda lo que el
    // administrador borró tras el último despliegue, y sin esa lista la
    // descarga volvería a meter esas infografías en el catálogo.
    await registroEliminadas.hydrateFromCloud();
    let localInfografiasData = infografiasModule.loadCatalog({ incluirEliminadas: true });
    const localInfografias = localInfografiasData.infografias || [];
    const bajadasInfografias = (await debeDescargar('infografias', localInfografias.length))
      ? await firebaseSync.syncDownloadInfografias(localInfografias)
      : localInfografias;
    const mergedInfografias = registroEliminadas.filter(bajadasInfografias);
    const driveRecovery = require('./drive-infografias-migration');
    const migrated = driveRecovery.migrateInfografiasToDrive(mergedInfografias);
    localInfografiasData.infografias = migrated.items;
    localInfografiasData.total = migrated.items.length;
    infografiasModule.saveCatalog(localInfografiasData);
    if (migrated.urlCount) {
      console.log(`[Drive Recovery] Sincronización: ${migrated.changes.length} infografías, ${migrated.urlCount} URLs recuperadas.`);
      await driveRecovery.persistDriveChanges(firebaseSync.db, migrated.changes);
    }
  } catch (err) {
    console.error('[Firebase Sync] Error sincronizando infografías en inicio:', err.message);
  }

  // 4. Unificar Videos
  try {
    console.log('[Firebase Sync] Unificando videos con la nube...');
    const videosModule = require('./videos-module');
    let localVideosData = videosModule.loadVideos();
    const localVideos = localVideosData.videos || [];
    const mergedVideos = (await debeDescargar('videos', localVideos.length))
      ? await firebaseSync.syncDownloadVideos(localVideos)
      : localVideos;
    localVideosData.videos = mergedVideos;
    localVideosData.total = mergedVideos.length;
    videosModule.saveVideos(localVideosData);
  } catch (err) {
    console.error('[Firebase Sync] Error sincronizando videos en inicio:', err.message);
  }

  // 5. Unificar Podcasts
  try {
    console.log('[Firebase Sync] Unificando podcasts con la nube...');
    const podcastModule = require('./podcast-module');
    let localPodcastsData = podcastModule.loadPodcasts();
    const localPodcasts = localPodcastsData.podcasts || [];
    const mergedPodcasts = (await debeDescargar('podcasts', localPodcasts.length))
      ? await firebaseSync.syncDownloadPodcasts(localPodcasts)
      : localPodcasts;
    localPodcastsData.podcasts = mergedPodcasts;
    localPodcastsData.total = mergedPodcasts.length;
    podcastModule.savePodcasts(localPodcastsData);
  } catch (err) {
    console.error('[Firebase Sync] Error sincronizando podcasts en inicio:', err.message);
  }

  // 6. Unificar Blog Posts
  try {
    console.log('[Firebase Sync] Unificando blog posts con la nube...');
    const blogModule = require('./blog-module');
    let localBlogData = blogModule.loadBlog();
    const localPosts = localBlogData.posts || [];
    const mergedPosts = (await debeDescargar('posts', localPosts.length))
      ? await firebaseSync.syncDownloadPosts(localPosts)
      : localPosts;
    localBlogData.posts = mergedPosts;
    localBlogData.total = mergedPosts.length;
    blogModule.saveBlog(localBlogData);
  } catch (err) {
    console.error('[Firebase Sync] Error sincronizando blog posts en inicio:', err.message);
  }

  console.log('[Firebase Sync] Sincronización inicial exitosa.');
}

// La cuenta de administrador se restaura de inmediato, sin esperar a la nube:
// es lo que impide que el correo de admin quede libre tras un reinicio.
bootstrapAdminUser().catch(err => console.error('[Admin] Bootstrap falló:', err.message));

// Iniciar sincronización de fondo con pequeño delay para acelerar el arranque y la escucha de puerto de Express en Cloud Run.
// CATOLICOSGPT_SIN_NUBE la desactiva: sin esto, cargar este módulo en las
// pruebas abre conexiones a Firestore que tardan minutos en rendirse.
if (process.env.CATOLICOSGPT_SIN_NUBE !== '1') setTimeout(() => {
  console.log('[Firebase Sync] Iniciando sincronización de fondo diferida...');
  initFirebaseSync().catch(err => {
    console.error('[Firebase Sync] Falló el proceso de inicio de sincronización:', err.message);
  });
}, 2000);

// ── Usuarios ──
function getUserByEmail(email) { return loadUsers().users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null; }
function getUserById(id)       { return loadUsers().users.find(u => u.id === id) || null; }
function updateUser(id, updates) {
  const data = loadUsers();
  const idx  = data.users.findIndex(u => u.id === id);
  if (idx !== -1) { data.users[idx] = { ...data.users[idx], ...updates }; saveUsers(data); return data.users[idx]; }
  return null;
}

// Retira una cuenta. Solo se usa para deshacer una cuenta recién creada en un
// pago que no llegó a empezar: dejarla ahí sería una trampa, porque el comprador
// no conoce su contraseña y al reintentar se le diría que ya tiene cuenta.
function removeUser(id) {
  const data = loadUsers();
  const antes = data.users.length;
  data.users = data.users.filter(u => u.id !== id);
  if (data.users.length === antes) return false;
  saveUsers(data);
  return true;
}

// ── Cuenta de administrador a prueba de reinicios ──────────────────────────
// El servicio no tiene disco persistente: cada despliegue arranca con el
// data/users.json del repositorio, que está vacío, y Firestore lleva días sin
// cuota de lectura. Resultado: tras cada reinicio no existe ningún usuario, el
// administrador se queda fuera de su propio panel y -mucho peor- el correo de
// admin queda libre, así que CUALQUIERA podía registrarse con él y quedarse
// con la consola.
//
// Con ADMIN_PASSWORD definida en el entorno, la cuenta se recrea sola en cada
// arranque: el administrador entra siempre y el correo deja de estar libre,
// porque registrarse con un correo que ya existe falla. La contraseña vive en
// la configuración del servidor, no en el repositorio.
async function bootstrapAdminUser() {
  const email = (process.env.ADMIN_EMAIL || 'gptcatolicos@gmail.com').toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!password) return { creado: false, motivo: 'sin ADMIN_PASSWORD' };
  if (password.length < 8) {
    console.warn('[Admin] ADMIN_PASSWORD es demasiado corta (mínimo 8); no se crea la cuenta.');
    return { creado: false, motivo: 'contraseña corta' };
  }
  // Si ya existe no se toca: sobrescribirla borraría la contraseña que el
  // administrador pudo haber cambiado desde Ajustes.
  if (getUserByEmail(email)) return { creado: false, motivo: 'ya existe' };
  try {
    const data = loadUsers();
    data.users.push({
      id: `u-admin-${Date.now()}`,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      nombre: 'Administrador',
      plan: 'admin',
      infografiasUsadas: 0,
      periodoReset: null,
      customLogo: null,
      customNombre: null,
      createdAt: new Date().toISOString(),
      activo: true
    });
    saveUsers(data);
    console.log(`[Admin] Cuenta de administrador restaurada desde el entorno: ${email}`);
    return { creado: true };
  } catch (err) {
    console.error('[Admin] No se pudo restaurar la cuenta de administrador:', err.message);
    return { creado: false, motivo: err.message };
  }
}

// ── Clave de período para reset de contador ──
function getPeriodKey(periodo) {
  const now = new Date();
  switch(periodo) {
    case 'daily':   return `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}`;
    case 'weekly': {
      const firstDay = new Date(now.getFullYear(),0,1);
      const week = Math.ceil(((now - firstDay)/86400000 + firstDay.getDay()+1)/7);
      return `${now.getFullYear()}-W${week}`;
    }
    case 'monthly': return `${now.getFullYear()}-${now.getMonth()+1}`;
    default: return 'unlimited';
  }
}

// ── Verificar límite de infografías ──
function checkInfografiaLimit(userId) {
  const user = getUserById(userId);
  if (!user) return { allowed: false, reason: 'Usuario no encontrado' };

  const config = loadPlanConfig();
  const plan   = config.planes[user.plan] || config.planes.free;

  if (plan.infografiasCount === -1) return { allowed: true, remaining: -1 };

  const periodKey    = getPeriodKey(plan.periodo);
  const usadasHoy    = user.periodoReset === periodKey ? (user.infografiasUsadas || 0) : 0;

  if (usadasHoy >= plan.infografiasCount) {
    const periodoLabel = { daily:'hoy', weekly:'esta semana', monthly:'este mes' }[plan.periodo] || 'en este periodo';
    return {
      allowed: false,
      reason: `Has usado tus ${plan.infografiasCount} infografía(s) gratuita(s) ${periodoLabel}. Actualiza a Premium para ilimitadas.`,
      remaining: 0,
      resetKey: periodKey
    };
  }

  return { allowed: true, remaining: plan.infografiasCount - usadasHoy, plan: plan.nombre };
}

function consumeInfografiaCredit(userId) {
  const user = getUserById(userId);
  if (!user) return;
  const config = loadPlanConfig();
  const plan   = config.planes[user.plan] || config.planes.free;
  if (plan.infografiasCount === -1) return;

  const periodKey = getPeriodKey(plan.periodo);
  const usadas    = user.periodoReset === periodKey ? (user.infografiasUsadas || 0) : 0;
  updateUser(userId, { infografiasUsadas: usadas + 1, periodoReset: periodKey });
}

// ── REGISTRO ──
async function register({ email, password, nombre }) {
  if (!email || !password || !nombre) throw new Error('Email, contraseña y nombre son requeridos');
  if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email inválido');
  if (getUserByEmail(email)) throw new Error('Este email ya está registrado');

  const passwordHash = await bcrypt.hash(password, 12);
  const configuredAdminEmail = (process.env.ADMIN_EMAIL || 'gptcatolicos@gmail.com').toLowerCase().trim();
  const isEmailAdmin = email.toLowerCase() === configuredAdminEmail;
  const user = {
    id: `u-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    email: email.toLowerCase(),
    passwordHash,
    nombre: nombre.trim(),
    plan: isEmailAdmin ? 'admin' : 'free',
    infografiasUsadas: 0,
    periodoReset: null,
    customLogo: null,
    customNombre: null,
    createdAt: new Date().toISOString(),
    activo: true
  };
  const data = loadUsers();
  data.users.push(user);
  saveUsers(data);
  const token = jwt.sign({ id: user.id, email: user.email, plan: user.plan }, JWT_SECRET, { expiresIn: '30d' });
  const { passwordHash: _, ...safe } = user;
  return { user: safe, token };
}

// ── LOGIN ──
async function login({ email, password }) {
  if (!email || !password) throw new Error('Email y contraseña requeridos');
  
  const targetEmail = email.toLowerCase().trim();
  const configuredAdminEmail = (process.env.ADMIN_EMAIL || 'gptcatolicos@gmail.com').toLowerCase().trim();
  // Tenía una contraseña por defecto escrita en el código y versionada: quien
  // leyera el repositorio podía entrar como administrador. Sin ADMIN_PASSWORD
  // definida, este atajo simplemente no existe y se entra por el camino normal.
  const configuredAdminPassword = process.env.ADMIN_PASSWORD || '';
  const isAdminCredentials = Boolean(configuredAdminPassword) && targetEmail === configuredAdminEmail && password === configuredAdminPassword;

  let user = getUserByEmail(targetEmail);
  
  // Si es una credencial de administración válida pero el usuario aún no existe, lo creamos automáticamente
  if (!user && isAdminCredentials) {
    const passwordHash = await bcrypt.hash(password, 12);
    user = {
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      email: targetEmail,
      passwordHash,
      nombre: 'Administrador CatólicosGPT',
      plan: 'admin',
      infografiasUsadas: 0,
      periodoReset: null,
      customLogo: null,
      customNombre: null,
      createdAt: new Date().toISOString(),
      activo: true
    };
    const data = loadUsers();
    data.users.push(user);
    saveUsers(data);
    console.log(`[Auth] Auto-creado usuario administrador para: ${targetEmail}`);
  }

  if (!user) throw new Error('Email o contraseña incorrectos');
  if (!user.activo) throw new Error('Cuenta suspendida. Contacta al administrador.');
  
  let valid = false;
  if (isAdminCredentials) {
    valid = true;
  } else {
    valid = await bcrypt.compare(password, user.passwordHash);
  }
  
  if (!valid) throw new Error('Email o contraseña incorrectos');
  
  // Garantizar plan de administración dinámico para estas cuentas bypass
  if (targetEmail === configuredAdminEmail && user.plan !== 'admin') {
    user.plan = 'admin';
    updateUser(user.id, { plan: 'admin' });
  }

  const token = jwt.sign({ id: user.id, email: user.email, plan: user.plan }, JWT_SECRET, { expiresIn: '30d' });
  const { passwordHash: _, ...safe } = user;
  return { user: safe, token };
}

// ── MIDDLEWARE ──
function authenticateToken(req, res, next) {
  const auth = req.headers['authorization'];
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch(e) { return res.status(401).json({ error: 'Token inválido o expirado' }); }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.plan !== 'admin') return res.status(403).json({ error: 'Acceso solo para administradores' });
  next();
}

// ── CUPONES ──
function validateCoupon(code) {
  const { coupons } = loadCoupons();
  const c = coupons.find(c => c.code === code.toUpperCase() && c.activo);
  if (!c || c.uses >= c.maxUses) return null;
  if (c.expiry && new Date(c.expiry) < new Date()) return null;
  return c;
}

function useCoupon(code, userId) {
  const data = loadCoupons();
  const idx  = data.coupons.findIndex(c => c.code === code.toUpperCase());
  if (idx !== -1) {
    data.coupons[idx].uses = (data.coupons[idx].uses||0)+1;
    data.coupons[idx].usedBy = [...(data.coupons[idx].usedBy||[]), userId];
    saveCoupons(data);
  }
}

function createCoupon({ code, plan, durationDays, maxUses, expiry }) {
  const data = loadCoupons();
  const coupon = {
    id: `cup-${Date.now()}`,
    code: code.toUpperCase(),
    plan: plan||'premium', durationDays: durationDays||30,
    maxUses: maxUses||1, uses: 0, usedBy: [],
    expiry: expiry||null, activo: true, createdAt: new Date().toISOString()
  };
  data.coupons.push(coupon);
  saveCoupons(data);
  return coupon;
}

function upgradePlan(userId, plan) {
  const config = loadPlanConfig();
  if (!config.planes[plan]) throw new Error('Plan inválido');
  return updateUser(userId, { plan, infografiasUsadas: 0, periodoReset: null });
}

module.exports = {
  register, login, getUserByEmail, getUserById, updateUser, loadUsers, removeUser, bootstrapAdminUser,
  authenticateToken, requireAdmin,
  checkInfografiaLimit, consumeInfografiaCredit, getPeriodKey,
  validateCoupon, useCoupon, createCoupon, upgradePlan,
  loadPlanConfig, savePlanConfig
};
