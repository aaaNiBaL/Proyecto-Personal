# MangaVerse

Base inicial de una plataforma de catálogo y comunidad de lectores de manga.
La aplicación todavía no ofrece catálogo ni cuentas funcionales.

## Requisitos

- Node.js 20.19+ y npm.
- Un proyecto Supabase se necesita cuando se implemente la conexión de datos;
  no se requiere para iniciar la interfaz local.

## Desarrollo local

```sh
npm install
npm run dev
```

## Comprobaciones

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

## Configuración

`src/services/supabase/client.ts` lee `VITE_SUPABASE_URL` y
`VITE_SUPABASE_ANON_KEY`. Copia `.env.example` a `.env.local` y añade valores
de un proyecto de desarrollo cuando la aplicación necesite consultar Supabase.
La clave anon/publicable está diseñada para el cliente y debe estar protegida
por políticas RLS. Nunca uses una clave `service_role` en el frontend.

Las variables privadas de funciones backend deben configurarse en Supabase,
fuera de los archivos incluidos en el cliente. Las migraciones y políticas RLS
se añadirán junto con las tablas de catálogo y biblioteca.

## Estado

Consulta [la arquitectura inicial](docs/arquitectura-inicial.md) para el
alcance del MVP, el modelo de datos y las etapas planificadas.
