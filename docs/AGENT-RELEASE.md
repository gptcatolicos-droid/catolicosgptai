# Evolución del agente CatólicosGPT — 15 de septiembre de 2026

## Qué incluye

- API nueva `/api/agent`: recuperación inicial de Magisterium, hasta dos investigaciones complementarias solicitadas por OpenAI y síntesis con referencias estructuradas.
- Endpoints oficiales: `https://www.magisterium.com/api/v1/search` y `/chat/completions`; modelo `magisterium-1`, búsqueda con `numResults` y categoría documentada.
- Respuesta, análisis, resumen, mapa conceptual (relaciones), cuadro sinóptico, cronología, comparativo y guía.
- Descarga real `.docx` y `.pdf`, sin otra llamada a IA. El contenido se procesa en memoria y no se almacena en el servidor.
- Interfaz limitada a la página principal, con selector de material, fuentes desplegables y cancelación. Conserva el chat anterior como ruta independiente.
- Dos guías infantiles con dibujos JPG originales: Buen Pastor y Jesús bendice a los niños. Fuentes, actividad, preguntas y evaluación; enlaces en `/ninos`.
- Favicon PNG real, títulos sin duplicar marca, canonical sin parámetros, zoom accesible, sitemap sin fechas ficticias y exclusión de infografías no publicadas.
- Página `/como-funciona` con metodología, límites y usos del agente.

## Activación controlada

El agente permanece DESACTIVADO por defecto. Para activarlo tras pruebas reales, establecer:

```
CATHOLIC_AGENT_ENABLED=1
OPENAI_AGENT_MODEL=gpt-4.1-mini
OPENAI_AGENT_MONTHLY_BUDGET_USD=30
OPENAI_AGENT_DAILY_BUDGET_USD=2
AGENT_DAILY_CLIENT_REQUESTS=10
MAGISTERIUM_AGENT_DAILY_CALLS=1500
AGENT_BUDGET_DIR=/var/data
PUBLIC_SITE_URL=https://www.catolicosgpt.com
```

Reutiliza `MAGISTERIUM_API_KEY` y `OPENAI_API_KEY` del servidor. No incluir claves en el repositorio. Ajustar AGENT_BUDGET_DIR al volumen persistente real, no copiar la ruta sin revisar la configuración de Render.

Los límites monetarios son valores iniciales propuestos para la revisión; no son una compra ni un cambio de plan. No se ha activado ningún cobro a usuarios. No hay generación de imágenes por API en el producto. Los JPG son recursos estáticos creados una vez.

## Costes y límites

Reservas conservadoras antes de cada llamada nueva a OpenAI y conciliación con `usage.input_tokens` / `usage.output_tokens`. Caché de entrada se factura conservadoramente como entrada completa. Se conserva la reserva cuando una respuesta no incluye métricas o la conexión falla. Modelo desconocido requiere tarifas explícitas en `OPENAI_AGENT_INPUT_USD_PER_MILLION` y `OPENAI_AGENT_OUTPUT_USD_PER_MILLION`.

El libro `agent-budget.json` registra agregados, nunca consultas ni respuestas. La cuota diaria usa HMAC de la IP y fecha; una red compartida comparte cuota. No es todavía una cuota por usuario ni un sistema de suscripciones. Antes de monetizar: identidad autenticada, cuotas por cuenta y facturación. Los límites cubren EL NUEVO AGENTE, no las llamadas editoriales o el chat antiguo ni otros servicios que compartan la clave. El presupuesto estimado no sustituye la factura del proveedor. La cuota Magisterium reserva tres ciclos de búsqueda+chat por solicitud, conservadoramente incluso si no se usan todos.

Libro durable para UNA instancia/proceso. No escalar horizontalmente sin contador transaccional compartido. La escritura es atómica y usa lock; si cae el proceso durante la escritura puede quedar lock residual: reconciliar el estado antes de retirarlo. No borrar el libro para resolver errores: bloqueará nuevas investigaciones si está corrupto o no es escribible.

## Evidencia y límites de validación

Pruebas locales con respuestas simuladas de proveedores: seguimiento de herramientas, referencias, errores, presupuesto, exportaciones y paginación. No equivalen a una evaluación doctrinal ni a un test real con las claves de producción.

La instalación completa local se bloqueó por la política de red del entorno. Las pruebas del motor usan las dependencias disponibles del entorno. CI verifica `npm ci`, tests, sintaxis y build.

La página privada `account/documents` y el proyecto de ChatGPT requieren sesión; no se han auditado esos contenidos privados. Se localizó y leyó `CatolicosGPT_BrandBook_2026.pdf` (12 de septiembre) para los nuevos dibujos. Paleta: #061A3A, #0B2B67, #28C7C9, #D7AA45, #F7F1DE.

MCP de Magisterium usa OAuth y su propia cuota; no sustituir el endpoint comercial con la cuenta Pro sin verificar condiciones y capacidad. No se ha instalado MCP en la app: la investigación actual usa las APIs documentadas con la clave existente.

## Antes de publicar

- Comprobar CI y probar en staging con claves reales: pregunta breve, investigación, seguimiento, fallo de proveedor y ambos formatos.
- Verificar el volumen persistente y el presupuesto acordado.
- Revisar la experiencia móvil en el bootstrap completo de producción, que aplica varias capas históricas de presentación.
- Evaluación doctrinal humana de una muestra representativa antes de anunciar precisión o superioridad.
- Tras publicar, solicitar nuevo rastreo de home/favicon en Search Console. La visibilidad del favicon y las posiciones dependen de Google.

## Fuentes técnicas

- https://www.magisterium.com/es/developers/docs/chat/making-first-request
- https://www.magisterium.com/es/developers/docs/chat/citations
- https://www.magisterium.com/es/developers/docs/search/api-reference
- https://www.magisterium.com/es/developers/docs/mcp
- https://developers.openai.com/api/docs/guides/function-calling
- https://developers.openai.com/api/docs/models/gpt-4.1-mini
- https://developers.google.com/search/docs/appearance/favicon-in-search
