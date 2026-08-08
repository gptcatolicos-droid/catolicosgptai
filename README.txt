CATÓLICOSGPT — HOTFIX HOME + CHAT

Reemplazar/agregar SOLO estos archivos en la raíz del repositorio:

1. AGREGAR:
   home-chat-hotfix.js

2. REEMPLAZAR:
   server-with-restore.js

No modificar:
- server.js
- package.json
- package-lock.json
- Firestore
- variables de entorno

Qué hace:
- Quita los cards del home.
- Oculta el texto "Conforme al Magisterio..." y "Puede contener imprecisiones" debajo del chat.
- Convierte el campo del chat en un composer moderno, compacto y responsive.
- Conserva el fallback móvil ya instalado.
- No cambia la lógica del chat.

Después de subir ambos archivos a main, Cloud Run debería disparar un deploy normal.
