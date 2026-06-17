# Configuración Firebase para la versión real

Esta web está preparada para funcionar con:

- Firebase Authentication: inicio de sesión con Google.
- Cloud Firestore: usuarios, avisos, comentarios y reacciones.
- Firebase Storage: imágenes de avisos.
- Firebase Hosting: publicar la web.

## 1. Crear proyecto Firebase

1. Entra a Firebase Console.
2. Crea un proyecto.
3. Agrega una app Web.
4. Copia la configuración `firebaseConfig`.

## 2. Activar Google Login

En Firebase Console:

```txt
Authentication > Sign-in method > Google > Enable
```

## 3. Crear Firestore

En Firebase Console:

```txt
Firestore Database > Create database
```

Inicia en modo producción y luego pega las reglas de `firestore.rules`.

## 4. Crear Storage

En Firebase Console:

```txt
Storage > Get started
```

Luego pega las reglas de `storage.rules`.

## 5. Pegar configuración en la web

Abre:

```txt
assets/js/config.js
```

Cambia:

```js
firebaseConfig: {
  apiKey: "CAMBIA_ESTO",
  authDomain: "CAMBIA_ESTO.firebaseapp.com",
  projectId: "CAMBIA_ESTO",
  storageBucket: "CAMBIA_ESTO.appspot.com",
  messagingSenderId: "CAMBIA_ESTO",
  appId: "CAMBIA_ESTO"
}
```

Por los datos reales de Firebase.

## 6. Cambiar correo fijo del super admin

En el mismo archivo:

```js
superAdminEmails: ["emsad01@cobacam.edu.mx"]
```

Pon el correo Google del dueño principal.

Ejemplo:

```js
superAdminEmails: ["director@gmail.com"]
```

## 7. Publicar con Firebase Hosting

Instala Firebase CLI y ejecuta:

```bash
firebase login
firebase init hosting
firebase deploy
```

Selecciona esta carpeta como carpeta pública.

## Notas de seguridad

- No basta con ocultar botones en HTML.
- La seguridad real está en `firestore.rules` y `storage.rules`.
- Solo el super admin debe poder cambiar roles.
- Los admins publican avisos, pero no deben convertir a otros usuarios en admin.
