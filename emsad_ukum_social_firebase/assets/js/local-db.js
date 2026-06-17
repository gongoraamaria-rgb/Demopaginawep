
(function(){
  const PREFIX = "emsad_ukum_social_v1_";
  const now = () => Date.now();
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const SUPER_EMAIL = (window.SCHOOL_CONFIG.superAdminEmails[0] || "emsad01@cobacam.edu.mx").toLowerCase();

  function read(key, fallback){
    try { return JSON.parse(localStorage.getItem(PREFIX + key)) ?? fallback; }
    catch(e){ return fallback; }
  }
  function write(key, value){ localStorage.setItem(PREFIX + key, JSON.stringify(value)); }
  function id(prefix){ return `${prefix}_${Math.random().toString(36).slice(2,8)}_${Date.now()}`; }
  function fileToDataURL(file){
    return new Promise((resolve, reject)=>{
      if(!file) return resolve("");
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function makeAttachmentId(prefix="att"){ return `${prefix}_${Math.random().toString(36).slice(2,8)}_${Date.now()}`; }
  function typeFromFile(file){
    const mime = String(file?.type || "");
    const name = String(file?.name || "").toLowerCase();
    if(mime.startsWith("image/")) return "image";
    if(mime.startsWith("video/")) return "video";
    if(/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name)) return "image";
    if(/\.(mp4|webm|mov|m4v|avi|mkv)$/.test(name)) return "video";
    return "document";
  }
  function normalizeAttachment(att){
    if(!att) return null;
    return {
      id: att.id || makeAttachmentId("att"),
      type: att.type || "link",
      name: att.name || "Adjunto",
      url: att.url || "",
      size: att.size || 0,
      mime: att.mime || "",
      source: att.source || "url",
      createdAt: att.createdAt || now()
    };
  }
  function legacyAttachments(data, imageUrl){
    const list = Array.isArray(data.attachments) ? data.attachments.map(normalizeAttachment).filter(Boolean) : [];
    const hasUrl = (url) => !!url && list.some(a => a.url === url);
    if(imageUrl && !hasUrl(imageUrl)) list.unshift(normalizeAttachment({type:"image", name:"Imagen del aviso", url:imageUrl, source:"legacy"}));
    if(data.videoUrl && !hasUrl(data.videoUrl)) list.push(normalizeAttachment({type:"video", name:"Video externo", url:data.videoUrl, source:"legacy"}));
    if(data.linkUrl && !hasUrl(data.linkUrl)) list.push(normalizeAttachment({type:"link", name:"Link externo", url:data.linkUrl, source:"legacy"}));
    return list;
  }
  function legacyFieldsFromAttachments(attachments){
    const image = attachments.find(a => a.type === "image" && a.url);
    const video = attachments.find(a => a.type === "video" && a.url);
    const link = attachments.find(a => a.type === "link" && a.url);
    return {
      imageUrl: image?.url || "",
      videoUrl: video?.url || "",
      linkUrl: link?.url || ""
    };
  }
  async function filesToAttachments(files){
    const arr = Array.isArray(files) ? files : files ? [{file:files}] : [];
    const out = [];
    for(const item of arr){
      const file = item.file || item;
      if(!file) continue;
      const url = await fileToDataURL(file);
      out.push(normalizeAttachment({
        id: item.id || makeAttachmentId("file"),
        type: item.type || typeFromFile(file),
        name: item.name || file.name || "Archivo",
        url,
        size: item.size || file.size || 0,
        mime: item.mime || file.type || "",
        source: "local"
      }));
    }
    return out;
  }

  const seedPosts = [
    {
      id:"post_demo_1",
      title:"Bienvenidos al muro oficial del EMSaD Ukúm",
      content:"Este espacio sirve para publicar avisos escolares, actividades, documentos, suspensiones de clases y comunicados importantes. En los avisos donde esté permitido, los usuarios pueden marcar enterado, reaccionar o comentar con su cuenta.",
      category:"Aviso general",
      authorId:"demo-super",
      authorName:"Dirección escolar",
      authorPhoto:"",
      visibility:"public",
      status:"published",
      allowComments:true,
      allowReactions:true,
      pinned:true,
      urgent:false,
      imageUrl:"assets/images/fachada-color.jpg",
      videoUrl:"",
      linkUrl:"",
      createdAt: now()-86400000*2,
      updatedAt: now()-86400000*2
    },
    {
      id:"post_demo_2",
      title:"Ejemplo: no hay clases mañana por tormenta",
      content:"Este es un ejemplo de aviso urgente. El administrador puede decidir que solo se permitan reacciones, pero no comentarios, para evitar confusión.",
      category:"Suspensión de clases",
      authorId:"demo-admin",
      authorName:"Control escolar",
      authorPhoto:"",
      visibility:"public",
      status:"published",
      allowComments:false,
      allowReactions:true,
      pinned:true,
      urgent:true,
      imageUrl:"assets/images/entrada-02.png",
      videoUrl:"",
      linkUrl:"",
      createdAt: now()-86400000,
      updatedAt: now()-86400000
    },
    {
      id:"post_demo_3",
      title:"Concurso de fotografía escolar",
      content:"Sube tus dudas en comentarios. Los encargados podrán responder y moderar el muro.",
      category:"Eventos",
      authorId:"demo-admin",
      authorName:"Actividades escolares",
      authorPhoto:"",
      visibility:"registered",
      status:"published",
      allowComments:true,
      allowReactions:true,
      pinned:false,
      urgent:false,
      imageUrl:"assets/images/patio-cancha.jpg",
      videoUrl:"",
      linkUrl:"",
      createdAt: now()-3600000*8,
      updatedAt: now()-3600000*8
    }
  ];

  const seedUsers = [
    {uid:"demo-super", name:"Super Admin EMSaD", email:SUPER_EMAIL, photoURL:"", role:"super_admin", status:"active", createdAt:now()-100000, lastLogin:now()},
    {uid:"demo-admin", name:"Encargado de avisos", email:"admin.demo@escuela.mx", photoURL:"", role:"admin", status:"active", createdAt:now()-90000, lastLogin:now()},
    {uid:"demo-user", name:"Alumno demo", email:"alumno.demo@gmail.com", photoURL:"", role:"user", status:"active", createdAt:now()-80000, lastLogin:now()}
  ];

  function ensureSeed(){
    if(!localStorage.getItem(PREFIX+"seeded")){
      write("users", seedUsers);
      write("posts", seedPosts);
      write("comments", [
        {id:"comment_demo_1", postId:"post_demo_1", userId:"demo-user", userName:"Alumno demo", userPhoto:"", text:"Ya quedó claro, gracias.", status:"visible", createdAt:now()-50000}
      ]);
      write("reactions", [
        {id:"post_demo_1_demo-user", postId:"post_demo_1", userId:"demo-user", type:"enterado", createdAt:now()-40000},
        {id:"post_demo_2_demo-user", postId:"post_demo_2", userId:"demo-user", type:"enterado", createdAt:now()-30000}
      ]);
      localStorage.setItem(PREFIX+"seeded", "1");
    }
  }
  ensureSeed();

  window.LocalDB = {
    mode:"demo",
    async getCurrentSession(){ return read("session", null); },
    async setCurrentSession(user){ write("session", user); return user; },
    async clearSession(){ localStorage.removeItem(PREFIX+"session"); },
    async demoLogin(role){
      const users = read("users", []);
      let user = users.find(u => u.role === role) || users[0];
      user.lastLogin = now();
      write("users", users.map(u => u.uid === user.uid ? user : u));
      await this.setCurrentSession(user);
      return clone(user);
    },
    async upsertUser(user){
      const users = read("users", []);
      const idx = users.findIndex(u=>u.uid===user.uid);
      const existing = idx>=0 ? users[idx] : null;
      const next = {...existing, ...user, updatedAt:now()};
      if(idx>=0) users[idx]=next; else users.push({...next, createdAt:now()});
      write("users", users);
      return clone(next);
    },
    async getUsers(){ return clone(read("users", [])).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)); },
    async updateUser(uid, patch){
      const users = read("users", []);
      const next = users.map(u => u.uid===uid ? {...u,...patch,updatedAt:now()} : u);
      write("users", next);
      return clone(next.find(u=>u.uid===uid));
    },
    async getPosts({includeRegistered=false}={}){
      let posts = read("posts", []);
      if(!includeRegistered) posts = posts.filter(p=>p.visibility !== "registered");
      return clone(posts).sort((a,b)=> Number(b.pinned)-Number(a.pinned) || (b.createdAt||0)-(a.createdAt||0));
    },
    async getPost(id){ return clone(read("posts", []).find(p=>p.id===id)); },
    async savePost(data, files, currentUser){
      const posts = read("posts", []);
      const uploaded = await filesToAttachments(files);
      let attachments = legacyAttachments(data, data.imageUrl || "");
      attachments = [...attachments, ...uploaded];
      const legacy = legacyFieldsFromAttachments(attachments);
      const payload = {
        ...data,
        attachments,
        imageUrl: legacy.imageUrl,
        videoUrl: legacy.videoUrl,
        linkUrl: legacy.linkUrl,
        status: data.status || "published"
      };
      if(data.id){
        const idx = posts.findIndex(p=>p.id===data.id);
        if(idx>=0){ posts[idx] = {...posts[idx], ...payload, updatedAt:now()}; }
      } else {
        posts.push({
          ...payload,
          id:id("post"),
          authorId: currentUser.uid,
          authorName: currentUser.name,
          authorPhoto: currentUser.photoURL || "",
          createdAt:now(),
          updatedAt:now()
        });
      }
      write("posts", posts);
      return true;
    },
    async deletePost(postId){
      write("posts", read("posts", []).filter(p=>p.id!==postId));
      write("comments", read("comments", []).filter(c=>c.postId!==postId));
      write("reactions", read("reactions", []).filter(r=>r.postId!==postId));
      return true;
    },
    async getComments(postId){ return clone(read("comments", []).filter(c=>c.postId===postId && c.status!=="hidden").sort((a,b)=>(a.createdAt||0)-(b.createdAt||0))); },
    async addComment(postId, text, currentUser){
      const comments = read("comments", []);
      comments.push({id:id("comment"), postId, userId:currentUser.uid, userName:currentUser.name, userPhoto:currentUser.photoURL||"", text, status:"visible", createdAt:now()});
      write("comments", comments); return true;
    },
    async deleteComment(commentId){ write("comments", read("comments", []).filter(c=>c.id!==commentId)); return true; },
    async getReactions(postId){ return clone(read("reactions", []).filter(r=>r.postId===postId)); },
    async setReaction(postId, type, currentUser){
      let reactions = read("reactions", []);
      const rid = `${postId}_${currentUser.uid}`;
      const existing = reactions.find(r=>r.id===rid);
      if(existing){ existing.type = type; existing.createdAt = now(); }
      else reactions.push({id:rid, postId, userId:currentUser.uid, type, createdAt:now()});
      write("reactions", reactions); return true;
    }
  };
})();
