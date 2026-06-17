
// ===============================================================
// CONFIGURACIÓN PRINCIPAL
// ===============================================================
// 1) Para probar sin internet/base de datos, déjalo como está: MODO DEMO.
// 2) Para usarlo real, crea tu proyecto en Firebase y reemplaza estos datos.
// 3) El primer super admin se controla aquí por correo fijo.

window.SCHOOL_CONFIG = {
  schoolName: "COBACH EMSaD 01 Ukúm",
  shortName: "EMSaD Ukúm",
  location: "Predio particular, Ukúm, Hopelchén, Campeche. C.P. 24615",
  phone: "(01996) 82 2-02-91",
  email: "emsad01@cobacam.edu.mx",

  // Cambia este correo si el super admin será otra persona.
  // Puede ser un correo Gmail o Google Workspace.
  superAdminEmails: ["emsad01@cobacam.edu.mx"],

  // Llena esto con los datos que te da Firebase Console.
  firebaseConfig: {
    apiKey: "CAMBIA_ESTO",
    authDomain: "CAMBIA_ESTO.firebaseapp.com",
    projectId: "CAMBIA_ESTO",
    storageBucket: "CAMBIA_ESTO.appspot.com",
    messagingSenderId: "CAMBIA_ESTO",
    appId: "CAMBIA_ESTO"
  },

  reactionTypes: [
    { key: "enterado", label: "✅ Enterado" },
    { key: "me_gusta", label: "👍 Me gusta" },
    { key: "importante", label: "❤️ Importante" },
    { key: "duda", label: "❓ Tengo duda" }
  ],

  categories: [
    "Aviso general",
    "Urgente",
    "Suspensión de clases",
    "Eventos",
    "Exámenes",
    "Becas",
    "Documentos",
    "Reuniones",
    "Actividades deportivas",
    "Actividades culturales"
  ],

  // Límites para adjuntos por aviso.
  attachments: {
    maxTotal: 20,
    maxImages: 10,
    maxVideos: 5,
    maxDocuments: 10,
    maxLinks: 10,
    maxFileSizeMB: 50,
    allowedDocumentExtensions: ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt"]
  }
};
