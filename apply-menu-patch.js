const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'server.js');
let source = fs.readFileSync(serverPath, 'utf8');

if (source.includes('// === ADMIN MENU CONTROLS ===')) {
  console.log('[Menu Patch] El control de menús ya está aplicado.');
  process.exit(0);
}

const runtimeSnippet = fs.readFileSync(path.join(__dirname, 'menu-runtime-snippet.txt'), 'utf8');
const routesSnippet = fs.readFileSync(path.join(__dirname, 'menu-routes-snippet.txt'), 'utf8');

const dataDirAnchor = "if (!fs.existsSync(DATA_DIR)) {\n  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch(e) {}\n}";
if (!source.includes(dataDirAnchor)) {
  throw new Error('No se encontró el bloque DATA_DIR para insertar la configuración del menú.');
}
source = source.replace(dataDirAnchor, `${dataDirAnchor}\n\n${runtimeSnippet}`);

const menuKeysByHref = {
  '/': 'chatIA',
  '/oracion-del-dia': 'oracionDelDia',
  '/santoral': 'santoral',
  '/infografias': 'infografias',
  '/oraciones': 'oraciones',
  '/ninos': 'ninos',
  '/videos': 'videos',
  '/podcasts': 'podcasts',
  '/blog': 'blog',
  '/catequesis-ia': 'catequesisIA',
  '/misas': 'misas'
};

for (const [href, key] of Object.entries(menuKeysByHref)) {
  if (href === '/') continue;
  const pattern = new RegExp(`<a href="${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g');
  source = source.replace(pattern, `<a data-menu-key="${key}" href="${href}"`);
}

source = source.replace(
  /<a href="\$\{todaySaintTarget\.path\}"/g,
  '<a data-menu-key="santoDelDia" href="${todaySaintTarget.path}"'
);

const desktopSantoralAnchor = '<a data-menu-key="santoral" href="/santoral" class="nav-link';
if (!source.includes(desktopSantoralAnchor)) {
  throw new Error('No se encontró el menú de Santoral en escritorio.');
}
source = source.replace(desktopSantoralAnchor, `<a data-menu-key="chatIA" href="/" class="nav-link \${req.originalUrl==='/'?'active':''}">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 9h8M8 13h5"/></svg>
                Chat IA
              </a>
              ${desktopSantoralAnchor}`);

const mobileSantoralAnchor = '<a data-menu-key="santoral" href="/santoral" onclick="toggleMobileMenu()" class="nav-link">Santoral</a>';
if (!source.includes(mobileSantoralAnchor)) {
  throw new Error('No se encontró el menú de Santoral en móvil.');
}
source = source.replace(mobileSantoralAnchor, `<a data-menu-key="chatIA" href="/" onclick="toggleMobileMenu()" class="nav-link">Chat IA</a>
                ${mobileSantoralAnchor}`);

const headAnchor = '</head>\n<body class="bg-cream h-full flex flex-col">';
if (!source.includes(headAnchor)) {
  throw new Error('No se encontró el cierre del head de renderPage.');
}
source = source.replace(headAnchor, '${getMenuVisibilityCss()}\n</head>\n<body class="bg-cream h-full flex flex-col">');

const profileLinkText = 'Ajustes de Perfil\n          </a>';
const adminMenuLink = `Ajustes de Perfil
          </a>
          \${isStrictAdminUser(user) ? \`
            <a href="/admin/menu" class="w-full text-center text-xs bg-maroon hover:bg-gold text-white font-bold py-2 rounded transition flex items-center justify-center gap-1">
              Administrar menú
            </a>
          \` : ''}`;
source = source.replaceAll(profileLinkText, adminMenuLink);

const listenIndex = source.lastIndexOf('app.listen(');
if (listenIndex === -1) {
  throw new Error('No se encontró app.listen para insertar las rutas del menú.');
}
source = `${source.slice(0, listenIndex)}${routesSnippet}\n\n${source.slice(listenIndex)}`;

fs.writeFileSync(serverPath, source, 'utf8');
console.log('[Menu Patch] Control de menús aplicado correctamente.');
