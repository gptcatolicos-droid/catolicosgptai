// ════════════════════════════════════════════════════════════════════════════
// CATOLICOSGPT — MÓDULO FIREBASE / CLOUD FIRESTORE SYNC
// Sincronización híbrida de alta disponibilidad y tolerancia a fallos
// ════════════════════════════════════════════════════════════════════════════

const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  collection,
  getDocFromServer
} = require('firebase/firestore');
const { getAuth } = require('firebase/auth');
const fs = require('fs');
const path = require('path');

const firebaseConfig = require('./firebase-applet-config.json');

// Inicializar Aplicación Web de Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
const auth = getAuth(app);

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
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('[Firebase Error] Details:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validar Conexión Inicial Requerida por el Skill (Phase 1)
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'system_test', 'connection_test_doc'));
    console.log('[Firebase] Conexión de validación a Firestore establecida correctamente.');
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("[Firebase] Warning: El cliente está desconectado. Por favor, revisa la configuración de Firebase.");
    } else {
      // Ignoramos errores de permisos en este documento de prueba, ya que no existe un documento real
      console.log('[Firebase] Canal listo, se asumen reglas activas.');
    }
  }
}
testConnection();

// ── 2. Funciones de Sincronización de Usuarios en la Nube ──
async function syncDownloadUsers(localUsersList) {
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
    // No arrojamos para mantener la resiliencia offline de CatólicosGPT, pero guardamos reporte en server
    return localUsersList;
  }
}

async function syncUploadUser(user) {
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
    console.log(`[Firebase Sync] Usuario ${sanitizedUser.email} guardado con éxito en Firestore.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ── 3. Funciones de Sincronización de Cupones en la Nube ──
async function syncDownloadCoupons(localCouponsList) {
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
    console.error('[Firebase Sync] Error sincronizando cupones de la nube:', err.message);
    return localCouponsList;
  }
}

async function syncUploadCoupon(coupon) {
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
    console.log(`[Firebase Sync] Cupón ${sanitizedCoupon.code} guardado con éxito en Firestore.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

module.exports = {
  db,
  auth,
  OperationType,
  handleFirestoreError,
  syncDownloadUsers,
  syncUploadUser,
  syncDownloadCoupons,
  syncUploadCoupon
};
