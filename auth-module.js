// Iniciar sincronización de fondo con pequeño delay para acelerar el arranque y la escucha de puerto de Express en Cloud Run
setTimeout(() => {
  console.log('[Firebase Sync] Iniciando sincronización de fondo diferida...');
  initFirebaseSync().catch(err => {
    console.error('[Firebase Sync] Falló el proceso de inicio de sincronización:', err.message);
  });
}, 2000);
