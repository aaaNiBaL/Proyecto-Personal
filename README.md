# MangaVerse

Base de una plataforma de catálogo y comunidad de lectores de manga. La
exploración, búsqueda, fichas, registro/inicio de sesión, biblioteca privada y
propuestas editoriales con moderación están implementados en el cliente. Cada
migración debe aplicarse en Supabase antes de usar su funcionalidad.

## Conectar un proyecto Supabase alojado

1. Crea un proyecto en Supabase o abre uno de desarrollo.
2. En el dashboard, ve a **Project Settings → API Keys** y copia el **Project
   URL** y la **Publishable key** (`sb_publishable_...`). Si tu proyecto solo
   muestra la clave `anon` heredada, también puedes usarla como clave pública.
3. Abre `.env.local` en la raíz y pega los valores:

   ```dotenv
   VITE_SUPABASE_URL=https://tu-project-ref.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_tu_clave_publica
   ```

4. En Supabase **SQL Editor**, crea una consulta nueva, pega el contenido de
   `supabase/migrations/20261014210000_catalog.sql` y ejecútala en la base de
   datos del proyecto.
5. Si quieres cargar las primeras fichas bibliográficas, abre una consulta
   nueva, pega `supabase/seeds/catalogo_inicial.sql` y pulsa **Run**. Añade
   One Piece y Dragon Ball con enlaces editoriales de VIZ Media; no inventa
   sinopsis, autores ni estado de publicación. Puedes ejecutarlo de nuevo sin
   duplicar esas fichas.
6. Reinicia Vite (`Ctrl+C` y `npm run dev`) y abre `/explorar`.

El archivo `.env.local` está excluido de Git. No compartas ni subas claves
privadas. La clave `service_role` / `secret` y la contraseña de la base de datos
no van en el frontend ni en variables `VITE_*`. La Publishable key está pensada
para el navegador; RLS sigue siendo imprescindible.

### Alternativa: Supabase local

Requiere Supabase CLI y Docker Desktop:

```sh
npx supabase start
npx supabase db reset
npx supabase status
```

En `.env.local`, utiliza `API_URL` como `VITE_SUPABASE_URL` y `ANON_KEY` como
`VITE_SUPABASE_PUBLISHABLE_KEY` desde la salida de `npx supabase status -o env`.
Luego ejecuta `npm run dev`. `supabase db reset` aplica la migración localmente.

Para migrar un proyecto remoto con CLI, autentícate con Supabase CLI, enlaza el
proyecto y ejecuta `npx supabase db push` solo después de revisar la migración y
confirmar el destino. No apuntes el comando a producción sin una revisión y
copia de seguridad adecuadas.

## Comprobaciones

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

## Configuración del cliente

`src/services/supabase/client.ts` lee `VITE_SUPABASE_URL` y
`VITE_SUPABASE_PUBLISHABLE_KEY` (también acepta `VITE_SUPABASE_ANON_KEY` para
proyectos con claves heredadas). `.env.example` documenta los nombres; `.env.local`
es el archivo local preparado para tus valores y no se versiona.

La migración `supabase/migrations/20261014210000_catalog.sql` crea el esquema
del catálogo, índices de búsqueda, permisos RLS y funciones de lectura. El
archivo `supabase/seeds/catalogo_inicial.sql` agrega dos fichas con fuentes
editoriales para probar el catálogo. Las escrituras al catálogo están
deshabilitadas directamente desde el cliente; las propuestas editoriales usan
el flujo controlado descrito abajo.

La autenticación y biblioteca personal están definidas en
`supabase/migrations/20261014220000_private_library.sql`. Después de aplicar
esa migración, habilita la confirmación de correo en **Authentication → URL
Configuration** y agrega `http://localhost:5173` y
`http://127.0.0.1:5173` a las URLs de redirección permitidas. La biblioteca
aplica RLS por propietario; las notas y enlaces privados no se publican.

La migración de biblioteca es una adición al esquema ya aplicado; ejecútala
como una consulta SQL separada en el mismo proyecto. No vuelvas a ejecutar la
migración inicial del catálogo.

Para aplicarla en Supabase: abre `supabase/migrations/20261014220000_private_library.sql`
en VS Code, copia todo el archivo, crea una consulta nueva en **SQL Editor**,
pégala y pulsa **Run**. Luego configura las URLs de Auth indicadas arriba y
recarga MangaVerse. Si el SQL Editor informa un error, no continúes con el
registro hasta resolverlo.

El formulario de registro permite elegir el nombre de usuario desde el inicio.
Para que Supabase lo guarde en el perfil al crear la cuenta, aplica también
`supabase/migrations/20261015060000_signup_username.sql` después de la
migración de biblioteca. Los nombres aceptados tienen entre 3 y 24 caracteres
y solo permiten letras minúsculas, números y guion bajo; deben ser únicos.

### Progreso de lectura y logros

La biblioteca privada muestra un resumen de obras en lectura, terminadas y con
capítulos registrados, además de logros por hitos. Después de aplicar la
migración de biblioteca, ejecuta una sola vez
`supabase/migrations/20261015000000_reading_achievements.sql` en SQL Editor.
La migración crea el catálogo de logros, desbloquea automáticamente los hitos
actuales de bibliotecas existentes y conserva los desbloqueos futuros. Las
definiciones son visibles para cuentas autenticadas; cada persona solo puede
consultar sus propios logros.

### Activar contribuciones y moderación

Después de aplicar las migraciones de catálogo y biblioteca:

1. Abre `supabase/migrations/20261014230000_wiki_contributions.sql` en VS Code,
   copia todo el archivo, pégalo en una consulta nueva de Supabase **SQL Editor**
   y pulsa **Run**. Es una migración adicional; no vuelvas a ejecutar las
   anteriores.
2. Las personas con sesión iniciada pueden proponer correcciones o títulos
   alternativos desde una ficha. Cada propuesta exige una fuente HTTPS y no
   modifica el catálogo hasta ser aprobada.
3. Para habilitar al primer moderador, reemplaza el correo en esta consulta por
   el correo exacto de una cuenta que ya se haya registrado y ejecútala en SQL
   Editor:

   ```sql
   insert into public.catalog_editor_roles (user_id, role)
   select id, 'admin'
   from auth.users
   where email = 'correo-del-moderador@example.com'
   on conflict (user_id) do update set role = excluded.role;
   ```

   La asignación de roles no está disponible desde la aplicación. Los
   moderadores y administradores pueden revisar propuestas en `/moderacion`;
   cada usuario ve el estado de sus envíos en `/contribuciones`.

La migración fue aplicada en el proyecto Supabase conectado; el flujo de envío
y revisión fue probado desde la aplicación. La corrección de la función de
revisión evita la ambigüedad entre la variable y la columna `field_key`.

La migración `supabase/migrations/20261014230000_wiki_contributions.sql`
define roles editoriales, propuestas, revisiones auditables, políticas RLS y
funciones transaccionales para enviar y revisar cambios. Añade las páginas de
propuestas propias y moderación, el formulario en las fichas y el historial
público de cambios aprobados. Debe aplicarse después de las dos migraciones
anteriores.

Si ya aplicaste esa migración y al aprobar aparece `column reference "field_key"
is ambiguous`, ejecuta únicamente
`supabase/migrations/20261014231000_fix_wiki_review_field_key.sql` en una
consulta nueva del SQL Editor. Esta corrección reemplaza solo la función de
revisión y se puede ejecutar sin volver a crear tablas ni perder propuestas.

### Reseñas y puntuaciones

La función de reseñas ya está disponible en la ficha del manga. Para activarla
en Supabase, ejecuta el contenido de
`supabase/migrations/20261014232000_reviews_ratings.sql` en una consulta nueva
del SQL Editor, después de las migraciones de catálogo y biblioteca. Cada
cuenta puede publicar una puntuación de 1 a 5 y una reseña opcional por obra,
editarla o eliminarla. Las reseñas de obras publicadas son públicas y RLS
restringe los cambios a su autor. Los spoilers se ocultan hasta que quien lee
elige mostrarlos.

La portada también muestra obras mejor valoradas cuando tienen al menos tres
puntuaciones. Para habilitar esa clasificación, aplica
`supabase/migrations/20261015010000_homepage_popular_manga.sql` en una consulta
nueva del SQL Editor, después de la migración de reseñas.

### Perfiles públicos

La configuración del perfil está disponible en `/perfil` para cuentas con
sesión iniciada. Para habilitarla en Supabase, aplica
`supabase/migrations/20261014233000_public_profiles.sql` después de las
migraciones de biblioteca y reseñas. La migración añade nombre público,
biografía y visibilidad opcional; el perfil público muestra esos campos y hasta
20 reseñas, con spoilers ocultos. Las cuentas nuevas empiezan con el perfil
privado. Desde una reseña, se puede abrir el perfil del autor cuando esté
publicado.

### Listas públicas de mangas

La gestión de listas está disponible en `/listas` para usuarios autenticados.
Ejecuta `supabase/migrations/20261014234000_public_manga_lists.sql` en SQL
Editor después de las migraciones de perfiles y reseñas. Las listas pueden ser
privadas o públicas, contienen hasta 100 obras publicadas y se pueden editar,
compartir o eliminar. Las listas públicas aparecen en el perfil público del
autor y tienen una página compartible en `/listas/<id>`; las privadas solo son
visibles para su dueño.

### Denuncias y moderación comunitaria

Ejecuta `supabase/migrations/20261014235000_community_reports.sql` en el SQL
Editor de Supabase después de las migraciones de listas, perfiles y reseñas.
Ejecuta esta migración nueva una sola vez; no vuelvas a ejecutar las anteriores.
Las personas con sesión pueden
denunciar reseñas, perfiles públicos y listas públicas; se limita el envío a
cinco denuncias por hora y una denuncia pendiente por persona/contenido.
Moderadores y administradores (roles de catálogo ya existentes) pueden revisar
la cola desde `/moderacion`, abrir el contenido, añadir una nota y marcar la
denuncia como atendida o descartarla. Las denuncias no eliminan contenido
automáticamente; esa decisión sigue siendo del equipo moderador.

### Comentarios comunitarios

Para habilitar comentarios en fichas de mangas y reseñas, ejecuta una sola vez
`supabase/migrations/20261014236000_community_comments.sql` en el SQL Editor,
después de las migraciones de reseñas y denuncias. No vuelvas a ejecutar las
migraciones anteriores. Los comentarios requieren sesión, admiten hasta 2000
caracteres y tienen un límite de 20 publicaciones por hora. Cada autor puede
eliminar sus comentarios y cualquier persona autenticada puede denunciarlos
para que aparezcan en la cola de `/moderacion`.

Para mostrar la escritura de cada título alternativo en las fichas, aplica
`supabase/migrations/20261015020000_detail_alias_script.sql` después de la
migración del catálogo. Para habilitar el botón **Reportar información** y la
revisión de denuncias de fichas en `/moderacion`, aplica
`supabase/migrations/20261015030000_report_manga_information.sql` después de
las migraciones de denuncias y comentarios.

Los perfiles incluyen favoritos privados, separados de la biblioteca. Ejecuta
`supabase/migrations/20261015040000_profile_favorites.sql` para habilitar la
tabla protegida; después se pueden guardar o quitar obras desde la ficha y
consultarlas en la pestaña **Favoritos** de `/perfil`.

### Ajustes de cuenta

Ejecuta `supabase/migrations/20261015050000_account_settings.sql` después de
las migraciones de favoritos y logros. Añade preferencias de privacidad para
mostrar favoritos e insignias en perfiles públicos, además de preferencias de
notificación. Estas últimas se guardan, pero el envío de correos todavía no
está habilitado. La pantalla `/ajustes` también permite cambiar el tema en este
dispositivo y descargar los datos personales en JSON. La eliminación de cuenta
requiere desplegar `supabase/functions/delete-account` con
`npx supabase functions deploy delete-account`. La función verifica la sesión
del usuario y usa `SUPABASE_SERVICE_ROLE_KEY` solo en el backend; configura ese
secreto con `npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...` y nunca lo
guardes en variables `VITE_*`. En ajustes se solicita escribir `ELIMINAR` antes
de confirmar el borrado. Los toggles de notificación almacenan preferencias,
pero no envían correos hasta configurar el servicio de notificaciones.
La vista del perfil `/perfil` está separada del formulario de edición
`/perfil/editar`.

## Estado

Consulta [la arquitectura inicial](docs/arquitectura-inicial.md) para el
alcance del MVP, el modelo de datos y las etapas planificadas.
