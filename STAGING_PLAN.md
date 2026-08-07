# CatólicosGPT — staging seguro

Esta rama prueba cambios sin tocar producción.

## Objetivos
1. Recuperar exactamente el layout responsive original.
2. Mantener el contenido intacto.
3. Verificar Cloud Run / PORT=8080.
4. Construir después la sección Especiales.

## Regla de despliegue
Nunca promover cambios a `main` hasta validar móvil y escritorio en un servicio de staging separado.
