require('./server');

setTimeout(() => {
  try {
    const { restoreContent } = require('./hydrate-runtime');
    restoreContent().catch(err => console.warn('[Restore] Fallo no fatal:', err.message));
  } catch (err) {
    console.warn('[Restore] No se pudo iniciar la recuperación:', err.message);
  }
}, 3000);
