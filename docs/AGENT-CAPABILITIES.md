# ¿Es un agente o un chat?

El flujo existente del repositorio consulta fuentes mediante una secuencia fija y usa OpenAI como editor de presentación. No contiene un bucle de herramientas decidido por el modelo.

El nuevo motor sí implementa un agente especializado sobre Responses API: recibe el objetivo, recupera evidencia, puede decidir consultar de nuevo Magisterium, recibe el resultado de la herramienta y sintetiza el material. El servidor controla herramientas permitidas, iteraciones, tiempo y presupuesto.

| Propiedad | Nuevo motor de esta rama |
|---|---|
| Objetivo en lenguaje natural | Sí |
| Herramientas elegidas por el modelo | Sí, consultar Magisterium |
| Repetir investigación según resultados | Sí, hasta tres ciclos totales |
| Contexto entre pasos | Sí |
| Continuidad conversacional | Últimos seis mensajes de la sesión de página |
| Materiales y descargas | Sí, Word y PDF deterministas |
| Referencias documentales | Sí, cuando Magisterium las devuelve |
| Medición y límites de consumo | Sí, nuevo motor |
| Memoria persistente entre visitas | No |
| Tareas largas recuperables tras reinicio | No |
| MCP OAuth de Magisterium | No, usa API comercial existente |
| Multiagente | No; no hace falta para estos flujos iniciales |
| Registrado en plataforma Agents de OpenAI | No |
| Precisión doctrinal garantizada | No; requiere evaluación humana |

OpenAI documenta tres opciones: Agents API (ejecución y sesiones gestionadas), Agents SDK (bucle en la app) y Responses API (integración controlada por la app). No es obligatorio registrar un agente en la consola Agents para construir un agente con herramientas.

Agents API aporta sesiones durables, recuperación y gestión del contexto. Su consumo depende del modelo y de las herramientas y entornos utilizados. Para preguntas y materiales de duración corta, se conserva el control del bucle en Render y exportaciones locales sin sandbox facturable de OpenAI. Evaluar Agents API para itinerarios largos reanudables cuando exista demanda y una medición de coste real.

Fuentes consultadas:
- https://developers.openai.com/api/docs/guides/agents
- https://developers.openai.com/api/docs/guides/agents-api/overview
- https://platform.openai.com/agents (la vista pública no expone la configuración privada de la cuenta)
