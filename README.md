# CatólicosGPT - Portal de Oración y Formación Católica IA

¡Bienvenido al código fuente de **CatólicosGPT**! Esta es una aplicación web full-stack basada en Node.js y Express con el modelo Gemini de Google e integración con la API del Magisterio de la Iglesia.

---

## 🚀 Cómo Exportar el Código (ZIP o GitHub)

Para descargar esta aplicación o subirla directamente a tu cuenta de GitHub desde **Google AI Studio**:
1. Haz clic en el botón de **Configuración (Settings / Engranaje)** o en el menú de opciones en la esquina del entorno de AI Studio.
2. Selecciona **Export to GitHub** (para conectarlo a un repositorio directamente) o **Download ZIP** (para descargar un archivo comprimido de todo el código de forma local).

---

## 🛠️ Despliegue en Render (Paso a Paso)

Render es una plataforma excelente y gratuita para alojar aplicaciones Node.js. Sigue estos sencillos pasos:

### 1. Preparar el Repositorio de GitHub
* Sube los archivos del proyecto a un repositorio privado o público de GitHub (puedes usar la exportación directa de AI Studio o subir el ZIP extraído).

### 2. Crear un nuevo servicio web en Render
1. Inicia sesión en [Render.com](https://render.com/).
2. Haz clic en el botón **"New +"** y selecciona **"Web Service"**.
3. Conecta tu cuenta de GitHub y selecciona el repositorio de **CatólicosGPT**.

### 3. Configuración del Servicio (Settings)
Configura los siguientes campos exactamente así:
* **Runtime**: `Node`
* **Build Command**: `npm install`
* **Start Command**: `node server.js`

### 4. Variables de Entorno (Environment Variables)
Agrega las siguientes claves en la sección **Environment Variables** de tu panel de Render:
* `GEMINI_API_KEY`: Tu clave API de Google Gemini (puedes conseguirla gratis en Google AI Studio).
* `MAGISTERIUM_API_KEY`: Tu token de acceso a la API doctrinal de CatólicosGPT (si lo requieres, o déjalo vacío si el sistema corre la lógica híbrida rápida).
* `APP_URL`: La URL que Render te asigne (por ejemplo: `https://catolicosgpt.onrender.com`).

¡Eso es todo! Render compilará tu aplicación en un par de minutos y estará disponible para todo el mundo bajo tu propio subdominio gratuito o dominio personalizado.

---

## 💻 Ejecución en Local

Si deseas correr la aplicación en tu computadora de escritorio o portátil localmente:

1. Asegúrate de tener instalado **Node.js** (versión 18 o superior).
2. Clona o extrae el proyecto en una carpeta.
3. Abre una terminal dentro de la carpeta y ejecuta:
   ```bash
   npm install
   ```
4. Crea un archivo llamado `.env` en la raíz del proyecto y copia el contenido de `.env.example`, colocando tus claves reales:
   ```env
   GEMINI_API_KEY="Tu_Clave_De_Gemini"
   APP_URL="http://localhost:3000"
   ```
5. Inicia el servidor de desarrollo local corriendo:
   ```bash
   npm run start
   ```
6. Abre tu navegador preferido e ingresa a `http://localhost:3000`.

---

## 🙏 Misión y Fidelidad Doctrinal
CatólicosGPT está diseñado para servir con obediencia filial a la tradición y el magisterio inquebrantable de la Iglesia Católica, brindando consuelo espiritual sensible, guías de devoción íntegras, vidas de santos y oraciones hermosas para el recogimiento personal en la intimidad de la fe.
