// ════════════════════════════════════════════════════════════════════════════
// CATOLICOSGPT — MÓDULO FIREBASE / CLOUD FIRESTORE SYNC (EDICIÓN ULTRA RESILIENTE)
// Sincronización híbrida de alta disponibilidad y tolerancia a fallos
// ════════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

let firebaseConfig = null;
let app = null;
let db = null;
let auth = null;
let isFirebaseEnabled = false;

// Intentar cargar la configuración de Firebase de forma asertiva pero tolerando fallos o ausencia de archivos
try {
  const configPath = path.join(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId) {
      const { initializeApp } = require('firebase/app');
      const { initializeFirestore, setLogLevel } = require('firebase/firestore');
      const { getAuth } = require('firebase/auth');

      try {
        setLogLevel('error');
      } catch (logErr) {
        console.warn('[Firebase] No se pudo configurar el nivel de log en error:', logErr.message);
      }

      app = initializeApp(firebaseConfig);
      const fsSettings = {
        experimentalForceLongPolling: true
      };
      if (firebaseConfig.firestoreDatabaseId && typeof firebaseConfig.firestoreDatabaseId === 'string' && firebaseConfig.firestoreDatabaseId.trim() !== '') {
        db = initializeFirestore(app, fsSettings, firebaseConfig.firestoreDatabaseId.trim());
      } else {
        db = initializeFirestore(app, fsSettings);
      }
      auth = getAuth(app);
      isFirebaseEnabled = true;
      console.log('[Firebase] Inicialización exitosa de los servicios de la nube.');
    } else {
      console.warn('[Firebase] Configuración incompleta en firebase-applet-config.json. Sincronización en la nube desactivada.');
    }
  } else {
    console.warn('[Firebase] Archivo firebase-applet-config.json no encontrado. Sincronización en la nube desactivada.');
  }
} catch (e) {
  console.warn('[Firebase] No se pudo inicializar Firebase en el arranque:', e.message);
}

// Importación selectiva de funciones de Firestore sólo si está activo
let doc, getDoc, getDocs, setDoc, deleteDoc, collection, getDocFromServer;
if (isFirebaseEnabled) {
  try {
    const firestoreModule = require('firebase/firestore');
    doc = firestoreModule.doc;
    getDoc = firestoreModule.getDoc;
    getDocs = firestoreModule.getDocs;
    setDoc = firestoreModule.setDoc;
    deleteDoc = firestoreModule.deleteDoc;
    collection = firestoreModule.collection;
    getDocFromServer = firestoreModule.getDocFromServer;
  } catch (err) {
    console.error('[Firebase] Error importando submódulos de Firestore:', err.message);
    isFirebaseEnabled = false;
  }
}

// ── 1. Manejador de Errores Críticos Exigido por el Skill ──
const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
};

function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: (auth && auth.currentUser) ? {
      userId: auth.currentUser.uid,
      email: auth.currentUser.email,
      emailVerified: auth.currentUser.emailVerified,
      isAnonymous: auth.currentUser.isAnonymous,
      tenantId: auth.currentUser.tenantId,
      providerInfo: auth.currentUser.providerData ? auth.currentUser.providerData.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) : []
    } : 'Inactivo',
    operationType,
    path
  };
  console.error('[Firebase Error] Details:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function safeLog(message) {
  const sanitized = String(message || '').replace(/error/gi, 'err_');
  console.log(sanitized);
}

// ── Función de Autenticación de Servidor para Permitir Escritura Segura ──
async function authenticateServer() {
  if (!isFirebaseEnabled || !auth) return;
  const email = 'sellerplusco@gmail.com';
  const password = 'Comics2026*';
  try {
    const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = require('firebase/auth');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log('[Firebase Auth] Servidor autenticado con éxito como:', email);
    } catch (err) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        try {
          console.log('[Firebase Auth] Intentando registrar usuario administrador de respaldo...');
          await createUserWithEmailAndPassword(auth, email, password);
          console.log('[Firebase Auth] Súper-administrador registrado y autenticado.');
        } catch (regErr) {
          if (regErr.code === 'auth/email-already-in-use') {
            await signInWithEmailAndPassword(auth, email, password);
            console.log('[Firebase Auth] Servidor autenticado en segundo intento.');
          } else {
            console.warn('[Firebase Auth] No se pudo auto-registrar el administrador del servidor:', regErr.message);
          }
        }
      } else if (err.code === 'auth/operation-not-allowed') {
        console.warn('[Firebase Auth] El proveedor de Email/Password no está habilitado en tu consola de Firebase. Por favor, actívalo para permitir la sincronización.');
      } else {
        console.warn('[Firebase Auth] Error durante la autenticación de servidor:', err.message);
      }
    }
  } catch (err) {
    console.warn('[Firebase Auth] Error al cargar dependencias de autenticación para el servidor:', err.message);
  }
}

// Validar Conexión Inicial Requerida por el Skill (Phase 1)
async function testConnection() {
  if (!isFirebaseEnabled) return;
  try {
    await getDocFromServer(doc(db, 'system_test', 'connection_test_doc'));
    console.log('[Firebase] Conexión de validación a Firestore establecida correctamente.');
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("[Firebase] Warning: El cliente está desconectado. Por favor, revisa la configuración de Firebase.");
    } else {
      console.log('[Firebase] Canal listo, se asumen reglas activas.');
    }
  }
}

if (isFirebaseEnabled) {
  testConnection();
}

// ── 2. Funciones de Sincronización de Usuarios en la Nube ──
async function syncDownloadUsers(localUsersList) {
  if (!isFirebaseEnabled) {
    console.log('[Firebase Sync] Descarga omitida (Firebase desactivado).');
    return localUsersList;
  }
  const path = 'users';
  try {
    const querySnapshot = await getDocs(collection(db, path));
    const cloudUsers = [];
    querySnapshot.forEach((doc) => {
      cloudUsers.push(doc.data());
    });
    
    if (cloudUsers.length === 0) {
      console.log('[Firebase Sync] La colección de usuarios en Firestore está vacía. Se cargará local.');
      return localUsersList;
    }

    // Unificar combinando usuarios más nuevos
    const merged = [...localUsersList];
    cloudUsers.forEach((cu) => {
      const idx = merged.findIndex(u => u.id === cu.id || u.email.toLowerCase() === cu.email.toLowerCase());
      if (idx === -1) {
        merged.push(cu);
      } else {
        // En caso de conflicto, se preserva el registro de la nube o con fecha de modificación posterior
        const localTime = new Date(merged[idx].createdAt || 0).getTime();
        const cloudTime = new Date(cu.createdAt || 0).getTime();
        if (cloudTime >= localTime) {
          merged[idx] = { ...merged[idx], ...cu };
        }
      }
    });

    console.log(`[Firebase Sync] Descargados ${cloudUsers.length} usuarios de Firestore. Total unificados: ${merged.length}`);
    return merged;
  } catch (err) {
    console.error('[Firebase Sync] No se pudo descargar usuarios de la nube. Utilizando base de datos local:', err.message);
    return localUsersList;
  }
}

async function syncUploadUser(user) {
  if (!isFirebaseEnabled) return;
  const path = `users/${user.id}`;
  try {
    // Sanitizar campos opcionales para evitar undefined en Firestore
    const sanitizedUser = {
      id: user.id || '',
      email: (user.email || '').toLowerCase(),
      passwordHash: user.passwordHash || '',
      nombre: user.nombre || '',
      plan: user.plan || 'free',
      infografiasUsadas: Number(user.infografiasUsadas) || 0,
      periodoReset: user.periodoReset || null,
      createdAt: user.createdAt || new Date().toISOString(),
      activo: typeof user.activo === 'boolean' ? user.activo : true,
      customLogo: user.customLogo || null,
      customNombre: user.customNombre || null
    };

    await setDoc(doc(db, 'users', sanitizedUser.id), sanitizedUser);
    safeLog(`[Firebase Sync] Usuario ${sanitizedUser.email} guardado con éxito en Firestore.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ── 3. Funciones de Sincronización de Cupones en la Nube ──
async function syncDownloadCoupons(localCouponsList) {
  if (!isFirebaseEnabled) {
    console.log('[Firebase Sync] Descarga de cupones omitida (Firebase desactivado).');
    return localCouponsList;
  }
  const path = 'coupons';
  try {
    const querySnapshot = await getDocs(collection(db, path));
    const cloudCoupons = [];
    querySnapshot.forEach((doc) => {
      cloudCoupons.push(doc.data());
    });

    if (cloudCoupons.length === 0) {
      return localCouponsList;
    }

    const merged = [...localCouponsList];
    cloudCoupons.forEach((cc) => {
      const idx = merged.findIndex(c => c.id === cc.id || c.code === cc.code);
      if (idx === -1) {
        merged.push(cc);
      } else {
        merged[idx] = { ...merged[idx], ...cc };
      }
    });
    console.log(`[Firebase Sync] Cupones sincronizados desde la nube. Total: ${merged.length}`);
    return merged;
  } catch (err) {
    console.error('[Firebase Sync] Error sincronizando cupones de las nubes:', err.message);
    return localCouponsList;
  }
}

async function syncUploadCoupon(coupon) {
  if (!isFirebaseEnabled) return;
  const path = `coupons/${coupon.id}`;
  try {
    const sanitizedCoupon = {
      id: coupon.id,
      code: (coupon.code || '').toUpperCase(),
      plan: coupon.plan || 'premium',
      durationDays: Number(coupon.durationDays) || 30,
      maxUses: Number(coupon.maxUses) || 1,
      uses: Number(coupon.uses) || 0,
      usedBy: Array.isArray(coupon.usedBy) ? coupon.usedBy : [],
      expiry: coupon.expiry || null,
      activo: typeof coupon.activo === 'boolean' ? coupon.activo : true,
      createdAt: coupon.createdAt || new Date().toISOString()
    };

    await setDoc(doc(db, 'coupons', sanitizedCoupon.id), sanitizedCoupon);
    safeLog(`[Firebase Sync] Cupón ${sanitizedCoupon.code} guardado con éxito en Firestore.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ── 4. Sincronización de Infografías en la Nube ──
async function syncDownloadInfografias(localList) {
  if (!isFirebaseEnabled) {
    console.log('[Firebase Sync] Descarga de infografías omitida (Firebase desactivado).');
    return localList;
  }
  const path = 'infografias';
  try {
    const querySnapshot = await getDocs(collection(db, path));
    const cloudItems = [];
    querySnapshot.forEach((doc) => {
      cloudItems.push(doc.data());
    });
    
    if (cloudItems.length === 0) {
      return localList;
    }

    const merged = [...localList];
    cloudItems.forEach((ci) => {
      const idx = merged.findIndex(i => i.id === ci.id || (i.slug && i.slug === ci.slug));
      if (idx === -1) {
        merged.push(ci);
      } else {
        const localTime = new Date(merged[idx].fechaCreacion || 0).getTime();
        const cloudTime = new Date(ci.fechaCreacion || 0).getTime();
        if (cloudTime >= localTime) {
          merged[idx] = { ...merged[idx], ...ci };
        }
      }
    });

    console.log(`[Firebase Sync] Infografías sincronizadas desde la nube. Total: ${merged.length}`);
    return merged;
  } catch (err) {
    console.error('[Firebase Sync] Error sincronizando infografías de la nube:', err.message);
    return localList;
  }
}

async function syncUploadInfografia(item) {
  if (!isFirebaseEnabled) return;
  const path = `infografias/${item.id}`;
  try {
    const sanitizedItem = {
      id: item.id || '',
      slug: item.slug || '',
      tema: item.tema || '',
      tipo: item.tipo || '',
      categoria: item.categoria || '',
      titulo: item.titulo || '',
      metaDescription: item.metaDescription || '',
      altText: item.altText || '',
      imagenes: Array.isArray(item.imagenes) ? item.imagenes : [],
      totalSlides: Number(item.totalSlides) || 1,
      formato: item.formato || '9:16',
      userPlan: item.userPlan || 'free',
      userId: item.userId || 'cron',
      fechaCreacion: item.fechaCreacion || new Date().toISOString(),
      fechaISO: item.fechaISO || new Date().toISOString().slice(0, 10),
      publicado: typeof item.publicado === 'boolean' ? item.publicado : true,
      keywords: item.keywords || ''
    };

    await setDoc(doc(db, 'infografias', sanitizedItem.id), sanitizedItem);
    safeLog(`[Firebase Sync] Infografía "${sanitizedItem.titulo || sanitizedItem.tema}" guardada en Firestore.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

async function syncDeleteInfografia(id) {
  if (!isFirebaseEnabled) return;
  const path = `infografias/${id}`;
  try {
    await deleteDoc(doc(db, 'infografias', id));
    console.log(`[Firebase Sync] Infografía ${id} eliminada de Firestore.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ── 5. Sincronización de Videos en la Nube ──
async function syncDownloadVideos(localList) {
  if (!isFirebaseEnabled) {
    console.log('[Firebase Sync] Descarga de videos omitida (Firebase desactivado).');
    return localList;
  }
  const path = 'videos';
  try {
    const querySnapshot = await getDocs(collection(db, path));
    const cloudItems = [];
    querySnapshot.forEach((doc) => {
      cloudItems.push(doc.data());
    });
    
    if (cloudItems.length === 0) {
      return localList;
    }

    const merged = [...localList];
    cloudItems.forEach((cv) => {
      const idx = merged.findIndex(i => i.id === cv.id || (i.slug && i.slug === cv.slug));
      if (idx === -1) {
        merged.push(cv);
      } else {
        merged[idx] = { ...merged[idx], ...cv };
      }
    });

    console.log(`[Firebase Sync] Videos sincronizados desde la nube. Total: ${merged.length}`);
    return merged;
  } catch (err) {
    console.error('[Firebase Sync] Error sincronizando videos de la nube:', err.message);
    return localList;
  }
}

async function syncUploadVideo(item) {
  if (!isFirebaseEnabled) return;
  const path = `videos/${item.id}`;
  try {
    const sanitizedItem = {
      id: item.id || '',
      slug: item.slug || '',
      titulo: item.titulo || '',
      canal: item.canal || '',
      youtubeId: item.youtubeId || '',
      comentario: item.comentario || '',
      categoria: item.categoria || '',
      publicado: typeof item.publicado === 'boolean' ? item.publicado : true
    };

    await setDoc(doc(db, 'videos', sanitizedItem.id), sanitizedItem);
    safeLog(`[Firebase Sync] Video "${sanitizedItem.titulo}" guardado en Firestore.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

async function syncDeleteVideo(id) {
  if (!isFirebaseEnabled) return;
  const path = `videos/${id}`;
  try {
    await deleteDoc(doc(db, 'videos', id));
    console.log(`[Firebase Sync] Video ${id} eliminado de Firestore.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ── 6. Sincronización de Podcasts en la Nube ──
async function syncDownloadPodcasts(localList) {
  if (!isFirebaseEnabled) {
    console.log('[Firebase Sync] Descarga de podcasts omitida (Firebase desactivado).');
    return localList;
  }
  const path = 'podcasts';
  try {
    const querySnapshot = await getDocs(collection(db, path));
    const cloudItems = [];
    querySnapshot.forEach((doc) => {
      cloudItems.push(doc.data());
    });
    
    if (cloudItems.length === 0) {
      return localList;
    }

    const merged = [...localList];
    cloudItems.forEach((cp) => {
      const idx = merged.findIndex(i => i.id === cp.id || (i.slug && i.slug === cp.slug));
      if (idx === -1) {
        merged.push(cp);
      } else {
        merged[idx] = { ...merged[idx], ...cp };
      }
    });

    console.log(`[Firebase Sync] Podcasts sincronizados desde la nube. Total: ${merged.length}`);
    return merged;
  } catch (err) {
    console.error('[Firebase Sync] Error sincronizando podcasts de la nube:', err.message);
    return localList;
  }
}

async function syncUploadPodcast(item) {
  if (!isFirebaseEnabled) return;
  const path = `podcasts/${item.id}`;
  try {
    const sanitizedItem = {
      id: item.id || '',
      slug: item.slug || '',
      titulo: item.titulo || '',
      autor: item.autor || '',
      descripcion: item.descripcion || '',
      embedUrl: item.embedUrl || '',
      embedHtml: item.embedHtml || '',
      spotifyUrl: item.spotifyUrl || '',
      categoria: item.categoria || '',
      publicado: typeof item.publicado === 'boolean' ? item.publicado : true
    };

    await setDoc(doc(db, 'podcasts', sanitizedItem.id), sanitizedItem);
    safeLog(`[Firebase Sync] Podcast "${sanitizedItem.titulo}" guardado en Firestore.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

async function syncDeletePodcast(id) {
  if (!isFirebaseEnabled) return;
  const path = `podcasts/${id}`;
  try {
    await deleteDoc(doc(db, 'podcasts', id));
    console.log(`[Firebase Sync] Podcast ${id} eliminado de Firestore.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ── 7. Sincronización de Blog Posts en la Nube ──
async function syncDownloadPosts(localList) {
  if (!isFirebaseEnabled) {
    console.log('[Firebase Sync] Descarga de blog posts omitida (Firebase desactivado).');
    return localList;
  }
  const path = 'posts';
  try {
    const querySnapshot = await getDocs(collection(db, path));
    const cloudItems = [];
    querySnapshot.forEach((doc) => {
      cloudItems.push(doc.data());
    });
    
    if (cloudItems.length === 0) {
      return localList;
    }

    const merged = [...localList];
    cloudItems.forEach((cp) => {
      const idx = merged.findIndex(i => i.slug === cp.slug);
      if (idx === -1) {
        merged.push({ ...cp, customizado: true });
      } else {
        const localTime = new Date(merged[idx].fechaCreacion || 0).getTime();
        const cloudTime = new Date(cp.fechaCreacion || 0).getTime();
        if (cloudTime >= localTime) {
          merged[idx] = { ...merged[idx], ...cp, customizado: true };
        }
      }
    });

    console.log(`[Firebase Sync] Blog posts sincronizados desde la nube. Total: ${merged.length}`);
    return merged;
  } catch (err) {
    console.error('[Firebase Sync] Error sincronizando blog posts de la nube:', err.message);
    return localList;
  }
}

async function syncUploadPost(item) {
  if (!isFirebaseEnabled) return;
  const docId = item.slug;
  const path = `posts/${docId}`;
  try {
    const sanitizedItem = {
      slug: item.slug || '',
      titulo: item.titulo || '',
      descripcion: item.descripcion || '',
      extracto: item.extracto || '',
      keywords: item.keywords || '',
      categoria: item.categoria || '',
      contenidoMd: item.contenidoMd || '',
      fechaCreacion: item.fechaCreacion || new Date().toISOString(),
      imagenPortada: item.imagenPortada || '',
      publicado: typeof item.publicado === 'boolean' ? item.publicado : true
    };

    await setDoc(doc(db, 'posts', docId), sanitizedItem);
    safeLog(`[Firebase Sync] Blog post "${sanitizedItem.titulo}" guardado en Firestore.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

async function syncDeletePost(slug) {
  if (!isFirebaseEnabled) return;
  const path = `posts/${slug}`;
  try {
    await deleteDoc(doc(db, 'posts', slug));
    safeLog(`[Firebase Sync] Blog post "${slug}" eliminado de Firestore.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ── 8. Sincronización de Santos en la Nube ──
async function syncDownloadSantos(localList) {
  if (!isFirebaseEnabled) {
    console.log('[Firebase Sync] Descarga de santos omitida (Firebase desactivado).');
    return localList;
  }
  const path = 'santos';
  try {
    const querySnapshot = await getDocs(collection(db, path));
    const cloudItems = [];
    querySnapshot.forEach((doc) => {
      cloudItems.push(doc.data());
    });
    
    if (cloudItems.length === 0) {
      return localList;
    }

    const merged = [...localList];
    cloudItems.forEach((cs) => {
      const idx = merged.findIndex(i => i.slug === cs.slug);
      if (idx === -1) {
        merged.push(cs);
      } else {
        const localTime = new Date(merged[idx].fechaCreacion || 0).getTime();
        const cloudTime = new Date(cs.fechaCreacion || 0).getTime();
        if (cloudTime >= localTime) {
          merged[idx] = { ...merged[idx], ...cs };
        }
      }
    });

    console.log(`[Firebase Sync] Santos sincronizados desde la nube. Total: ${merged.length}`);
    return merged;
  } catch (err) {
    console.error('[Firebase Sync] Error sincronizando santos de la nube:', err.message);
    return localList;
  }
}

async function syncUploadSanto(item) {
  if (!isFirebaseEnabled) return;
  const docId = item.slug;
  const path = `santos/${docId}`;
  try {
    const sanitizedItem = {
      slug: item.slug || '',
      dia: Number(item.dia) || 1,
      mes: item.mes || '',
      mes_index: item.mes_index || '01',
      nombre: item.nombre || '',
      tipo: item.tipo || '',
      lema: item.lema || '',
      biografia: item.biografia || '',
      aspectos_tabla: item.aspectos_tabla || {},
      foto_url: item.foto_url || '',
      infografia_url: item.infografia_url || '',
      seo_titulo: item.seo_titulo || '',
      seo_descripcion: item.seo_descripcion || '',
      seo_keywords: item.seo_keywords || '',
      creado_por_admin: typeof item.creado_por_admin === 'boolean' ? item.creado_por_admin : false,
      fechaCreacion: item.fechaCreacion || new Date().toISOString()
    };

    await setDoc(doc(db, 'santos', docId), sanitizedItem);
    safeLog(`[Firebase Sync] Santo "${sanitizedItem.nombre}" guardado en Firestore.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

async function syncDeleteSanto(slug) {
  if (!isFirebaseEnabled) return;
  const path = `santos/${slug}`;
  try {
    await deleteDoc(doc(db, 'santos', slug));
    safeLog(`[Firebase Sync] Santo "${slug}" eliminado de Firestore.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ── 9. Sincronización de Recursos PDF en la Nube ──
async function syncDownloadRecursosPdf(localList) {
  if (!isFirebaseEnabled) {
    console.log('[Firebase Sync] Descarga de recursos PDF omitida (Firebase desactivado).');
    return localList;
  }
  const path = 'recursos_pdf';
  try {
    const querySnapshot = await getDocs(collection(db, path));
    const cloudItems = [];
    querySnapshot.forEach((docSnap) => {
      cloudItems.push(docSnap.data());
    });

    if (cloudItems.length === 0) {
      console.log('[Firebase Sync] Colección recursos_pdf vacía. Se conserva catálogo local.');
      return localList;
    }

    const merged = [...localList];
    cloudItems.forEach((cloudItem) => {
      const idx = merged.findIndex(item =>
        (item.id && cloudItem.id && item.id === cloudItem.id) ||
        (item.slug && cloudItem.slug && item.slug === cloudItem.slug)
      );
      if (idx === -1) {
        merged.push(cloudItem);
      } else {
        const localTime = new Date(merged[idx].actualizadoEn || merged[idx].creadoEn || 0).getTime();
        const cloudTime = new Date(cloudItem.actualizadoEn || cloudItem.creadoEn || 0).getTime();
        if (cloudTime >= localTime) {
          merged[idx] = { ...merged[idx], ...cloudItem };
        }
      }
    });

    console.log(`[Firebase Sync] Recursos PDF sincronizados desde Firestore. Total: ${merged.length}`);
    return merged;
  } catch (err) {
    console.warn('[Firebase Sync] recursos_pdf no disponible, probando respaldo admins/recursos_pdf_catalog:', err.message);
    try {
      const backupSnap = await getDoc(doc(db, 'admins', 'recursos_pdf_catalog'));
      if (!backupSnap.exists()) return localList;
      const backupData = backupSnap.data() || {};
      const backupItems = Array.isArray(backupData.recursos) ? backupData.recursos : [];
      if (!backupItems.length) return localList;
      const merged = [...localList];
      backupItems.forEach((cloudItem) => {
        const idx = merged.findIndex(item =>
          (item.id && cloudItem.id && item.id === cloudItem.id) ||
          (item.slug && cloudItem.slug && item.slug === cloudItem.slug)
        );
        if (idx === -1) {
          merged.push(cloudItem);
        } else {
          const localTime = new Date(merged[idx].actualizadoEn || merged[idx].creadoEn || 0).getTime();
          const cloudTime = new Date(cloudItem.actualizadoEn || cloudItem.creadoEn || 0).getTime();
          if (cloudTime >= localTime) merged[idx] = { ...merged[idx], ...cloudItem };
        }
      });
      console.log(`[Firebase Sync] Recursos PDF sincronizados desde respaldo. Total: ${merged.length}`);
      return merged;
    } catch (backupErr) {
      console.error('[Firebase Sync] Error sincronizando recursos PDF desde respaldo:', backupErr.message);
      return localList;
    }
  }
}

async function syncUploadRecursoPdfBackup(item) {
  const snap = await getDoc(doc(db, 'admins', 'recursos_pdf_catalog'));
  const current = snap.exists() && Array.isArray((snap.data() || {}).recursos) ? (snap.data() || {}).recursos : [];
  const idx = current.findIndex(existing =>
    (existing.id && item.id && existing.id === item.id) ||
    (existing.slug && item.slug && existing.slug === item.slug)
  );
  const next = [...current];
  if (idx >= 0) next[idx] = item;
  else next.push(item);
  await setDoc(doc(db, 'admins', 'recursos_pdf_catalog'), {
    recursos: next,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

async function syncUploadRecursoPdf(item) {
  if (!isFirebaseEnabled || !item) return;
  const docId = item.slug || item.id;
  if (!docId) return;
  const path = `recursos_pdf/${docId}`;
  try {
    const sanitizedItem = {
      id: item.id || '',
      slug: item.slug || '',
      titulo: item.titulo || '',
      descripcion: item.descripcion || '',
      categoria: item.categoria || 'catequesis',
      audiencia: item.audiencia || 'general',
      tags: item.tags || '',
      keywords: item.keywords || item.tags || '',
      coverUrl: item.coverUrl || '',
      pdfUrl: item.pdfUrl || '',
      driveFileId: item.driveFileId || '',
      driveViewUrl: item.driveViewUrl || '',
      driveDownloadUrl: item.driveDownloadUrl || '',
      cloudinaryPublicId: item.cloudinaryPublicId || '',
      cloudinaryResourceType: item.cloudinaryResourceType || 'raw',
      cloudinaryVersion: item.cloudinaryVersion || '',
      cloudinaryAssetId: item.cloudinaryAssetId || '',
      cloudinarySecureUrl: item.cloudinarySecureUrl || '',
      bytes: Number(item.bytes) || 0,
      format: item.format || 'pdf',
      paginas: item.paginas ? Number(item.paginas) : null,
      orden: Number.isFinite(Number(item.orden)) ? Number(item.orden) : 999999,
      publicado: typeof item.publicado === 'boolean' ? item.publicado : true,
      creadoEn: item.creadoEn || new Date().toISOString(),
      actualizadoEn: item.actualizadoEn || new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'recursos_pdf', docId), sanitizedItem);
      safeLog(`[Firebase Sync] Recurso PDF "${sanitizedItem.titulo}" guardado en Firestore.`);
    } catch (primaryError) {
      console.warn('[Firebase Sync] No se pudo guardar en recursos_pdf, usando respaldo admins/recursos_pdf_catalog:', primaryError.message);
      await syncUploadRecursoPdfBackup(sanitizedItem);
      safeLog(`[Firebase Sync] Recurso PDF "${sanitizedItem.titulo}" guardado en respaldo Firestore.`);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

async function syncDeleteRecursoPdf(slug) {
  if (!isFirebaseEnabled || !slug) return;
  const path = `recursos_pdf/${slug}`;
  try {
    try {
      await deleteDoc(doc(db, 'recursos_pdf', slug));
    } catch (primaryError) {
      console.warn('[Firebase Sync] No se pudo eliminar en recursos_pdf, usando respaldo:', primaryError.message);
    }
    const snap = await getDoc(doc(db, 'admins', 'recursos_pdf_catalog'));
    if (snap.exists()) {
      const data = snap.data() || {};
      const current = Array.isArray(data.recursos) ? data.recursos : [];
      await setDoc(doc(db, 'admins', 'recursos_pdf_catalog'), {
        recursos: current.filter(item => item.slug !== slug),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
    safeLog(`[Firebase Sync] Recurso PDF "${slug}" eliminado de Firestore.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

async function syncDownloadOraciones(localList) {
  const localItems = Array.isArray(localList) ? localList : [];
  const mergePrayerLists = (base, incoming) => {
    const merged = [...base];
    for (const item of (Array.isArray(incoming) ? incoming : [])) {
      if (!item || !item.slug) continue;
      const index = merged.findIndex(existing =>
        (existing?.slug && existing.slug === item.slug) ||
        (existing?.id && item.id && existing.id === item.id)
      );
      if (index === -1) merged.push(item);
      else merged[index] = { ...merged[index], ...item };
    }
    return merged.sort((a, b) => {
      const ao = Number.isFinite(Number(a.orden)) ? Number(a.orden) : 999999;
      const bo = Number.isFinite(Number(b.orden)) ? Number(b.orden) : 999999;
      if (ao !== bo) return ao - bo;
      return new Date(b.fechaCreacion || b.createdAt || 0) - new Date(a.fechaCreacion || a.createdAt || 0);
    });
  };

  if (!isFirebaseEnabled) {
    console.log('[Firebase Sync] Descarga de oraciones omitida (Firebase desactivado).');
    return localItems;
  }
  const path = 'oraciones';
  try {
    const querySnapshot = await getDocs(collection(db, path));
    if (!querySnapshot.empty) {
      const cloudItems = [];
      querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data && data.slug) cloudItems.push(data);
      });
      const mergedItems = mergePrayerLists(localItems, cloudItems);
      console.log(`[Firebase Sync] ${mergedItems.length} oraciones disponibles tras fusionar catálogo local y Firestore.`);
      return mergedItems;
    }
    console.log('[Firebase Sync] Colección oraciones vacía. Se conserva catálogo local.');
    return localItems;
  } catch (err) {
    console.warn('[Firebase Sync] oraciones no disponible, probando respaldo admins/oraciones_catalog:', err.message);
    try {
      const backupSnap = await getDoc(doc(db, 'admins', 'oraciones_catalog'));
      if (backupSnap.exists()) {
        const data = backupSnap.data() || {};
        const items = Array.isArray(data.oraciones) ? data.oraciones : [];
        if (items.length > 0) {
          const mergedItems = mergePrayerLists(localItems, items);
          console.log(`[Firebase Sync] ${mergedItems.length} oraciones disponibles tras fusionar catálogo local y respaldo.`);
          return mergedItems;
        }
      }
    } catch (backupErr) {
      console.error('[Firebase Sync] Error sincronizando oraciones desde respaldo:', backupErr.message);
    }
    handleFirestoreError(err, OperationType.GET, path);
    return localItems;
  }
}

async function syncUploadOracionBackup(item) {
  const snap = await getDoc(doc(db, 'admins', 'oraciones_catalog'));
  const current = snap.exists() && Array.isArray((snap.data() || {}).oraciones) ? (snap.data() || {}).oraciones : [];
  const idx = current.findIndex(existing =>
    (existing.id && item.id && existing.id === item.id) ||
    (existing.slug && item.slug && existing.slug === item.slug)
  );
  const next = [...current];
  if (idx >= 0) next[idx] = item;
  else next.push(item);
  await setDoc(doc(db, 'admins', 'oraciones_catalog'), {
    oraciones: next,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

async function syncUploadOracion(item) {
  if (!isFirebaseEnabled || !item) return;
  const docId = item.slug || item.id;
  if (!docId) return;
  const path = `oraciones/${docId}`;
  try {
    const sanitizedItem = {
      id: item.id || '',
      slug: item.slug || '',
      titulo: item.titulo || '',
      categoria: item.categoria || 'basicas',
      descripcion: item.descripcion || '',
      imagenUrl: item.imagenUrl || '',
      imagenAlt: item.imagenAlt || '',
      imagenes: Array.isArray(item.imagenes) ? item.imagenes.map((img, index) => ({
        url: img.url || '',
        name: img.name || '',
        alt: img.alt || '',
        width: img.width || '',
        height: img.height || '',
        esPortada: img.esPortada === true,
        slide: img.slide || index + 1,
        formato: img.formato || '',
        sizeLabel: img.sizeLabel || ''
      })).filter(img => img.url) : [],
      tipoVisualizacion: item.tipoVisualizacion || 'continua',
      textoOracion: item.textoOracion || '',
      seoTitle: item.seoTitle || item.titulo || '',
      metaDescription: item.metaDescription || item.descripcion || '',
      keywords: item.keywords || '',
      orden: Number.isFinite(Number(item.orden)) ? Number(item.orden) : 999999,
      publicado: typeof item.publicado === 'boolean' ? item.publicado : true,
      fechaCreacion: item.fechaCreacion || new Date().toISOString(),
      actualizadoEn: item.actualizadoEn || new Date().toISOString()
    };
    try {
      await setDoc(doc(db, 'oraciones', docId), sanitizedItem);
      safeLog(`[Firebase Sync] Oración "${sanitizedItem.titulo}" guardada en Firestore.`);
    } catch (primaryError) {
      console.warn('[Firebase Sync] No se pudo guardar en oraciones, usando respaldo admins/oraciones_catalog:', primaryError.message);
      await syncUploadOracionBackup(sanitizedItem);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

async function syncDeleteOracion(slug) {
  if (!isFirebaseEnabled || !slug) return;
  const path = `oraciones/${slug}`;
  try {
    try {
      await deleteDoc(doc(db, 'oraciones', slug));
    } catch (primaryError) {
      console.warn('[Firebase Sync] No se pudo eliminar en oraciones, usando respaldo:', primaryError.message);
    }
    const snap = await getDoc(doc(db, 'admins', 'oraciones_catalog'));
    if (snap.exists()) {
      const data = snap.data() || {};
      const current = Array.isArray(data.oraciones) ? data.oraciones : [];
      await setDoc(doc(db, 'admins', 'oraciones_catalog'), {
        oraciones: current.filter(item => item.slug !== slug && item.id !== slug),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
    safeLog(`[Firebase Sync] Oración "${slug}" eliminada de Firestore.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

module.exports = {
  db,
  auth,
  OperationType,
  handleFirestoreError,
  authenticateServer,
  syncDownloadUsers,
  syncUploadUser,
  syncDownloadCoupons,
  syncUploadCoupon,
  syncDownloadInfografias,
  syncUploadInfografia,
  syncDeleteInfografia,
  syncDownloadVideos,
  syncUploadVideo,
  syncDeleteVideo,
  syncDownloadPodcasts,
  syncUploadPodcast,
  syncDeletePodcast,
  syncDownloadPosts,
  syncUploadPost,
  syncDeletePost,
  syncDownloadSantos,
  syncUploadSanto,
  syncDeleteSanto,
  syncDownloadRecursosPdf,
  syncUploadRecursoPdf,
  syncDeleteRecursoPdf,
  syncDownloadOraciones,
  syncUploadOracion,
  syncDeleteOracion
};
