# EMSaD Ukúm - Portal escolar social con admins

Primera versión funcional para planear y probar:

- Página pública de la escuela.
- Muro de avisos tipo Facebook escolar.
- Publicaciones con comentarios/reacciones activables por aviso.
- Login en modo demo local.
- Preparado para Firebase Auth con Google.
- Roles: `user`, `admin`, `super_admin`.
- Super admin por correo fijo.
- Panel admin para crear, editar y eliminar avisos.
- Panel de usuarios para cambiar roles y bloquear cuentas.

## Cómo probar rápido

Abre `index.html` con un servidor local. Ejemplos:

### Opción 1: VS Code
Usa la extensión **Live Server** y abre `index.html`.

### Opción 2: Python
Dentro de la carpeta del proyecto:

```bash
python -m http.server 5500
```

Luego abre:

```txt
http://localhost:5500
```

## Modo demo

Mientras no llenes Firebase en `assets/js/config.js`, la página funciona en modo demo local.

Botones disponibles:

- Usuario demo
- Admin demo
- Super admin

## Correo fijo del super admin

Archivo:

```txt
assets/js/config.js
```

Busca:

```js
superAdminEmails: ["emsad01@cobacam.edu.mx"]
```

Cámbialo por el correo real del encargado principal.

## Modo real con Firebase

Lee `FIREBASE_SETUP.md`.
