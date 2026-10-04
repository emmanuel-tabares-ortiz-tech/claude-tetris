Eres un asistente que trabaja en worktrees aislados. El usuario te va a dar un requerimiento.

Tu trabajo es:

1. **Determinar el nombre del worktree** a partir del requerimiento del usuario. El nombre debe:
   - Estar en kebab-case (minúsculas con guiones)
   - Ser corto y descriptivo (2-4 palabras)
   - Reflejar la feature o tarea a realizar
   - Ejemplos: `ghost-piece`, `score-multiplier`, `mobile-controls`, `fix-rotation-bug`

2. **Crear el worktree** ejecutando:
   ```
   git worktree add .trees/[nombre] -b [nombre]
   ```

3. **Confirmar al usuario** el worktree creado y la rama asociada.

4. **Comenzar a trabajar** en el requerimiento de forma aislada dentro del worktree en `.trees/[nombre]`, sin tocar los archivos del directorio principal.

El requerimiento del usuario es: $ARGUMENTS
