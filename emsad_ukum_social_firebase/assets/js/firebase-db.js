
(function(){
  function isConfigured(){
    const cfg = window.SCHOOL_CONFIG.firebaseConfig || {};
    return !!cfg.apiKey && !String(cfg.apiKey).includes("CAMBIA") && typeof firebase !== "undefined";
  }
  function tsValue(v){
    if(!v) return Date.now();
    if(typeof v === "number") return v;
    if(v.toMillis) return v.toMillis();
    if(v.seconds) return v.seconds * 1000;
    return Date.now();
  }
  function clean(obj){
    const out = {};
    Object.keys(obj).forEach(k => {
      if(obj[k] !== undefined) out[k] = obj[k];
    });
    return out;
  }
  function isSuperEmail(email){
    return (window.SCHOOL_CONFIG.superAdminEmails || []).map(x=>x.toLowerCase()).includes(String(email||"").toLowerCase());
  }

  window.FirebaseDB = {
    mode:"firebase",
    enabled:false,
    app:null, auth:null, db:null, storage:null,
    init(){
      if(!isConfigured()) return false;
      if(!firebase.apps.length) firebase.initializeApp(window.SCHOOL_CONFIG.firebaseConfig);
      this.app = firebase.app();
      this.auth = firebase.auth();
      this.db = firebase.firestore();
      this.storage = firebase.storage();
      this.enabled = true;
      return true;
    },
    async signInWithGoogle(){
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await this.auth.signInWithPopup(provider);
      return result.user;
    },
    async signOut(){ return this.auth.signOut(); },
    onAuthStateChanged(cb){ return this.auth.onAuthStateChanged(cb); },
    async ensureProfile(fUser){
      if(!fUser) return null;
      const ref = this.db.collection("users").doc(fUser.uid);
      const snap = await ref.get();
      const base = {
        uid:fUser.uid,
        name:fUser.displayName || fUser.email || "Usuario",
        email:fUser.email || "",
        photoURL:fUser.photoURL || "",
        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
      };
      if(!snap.exists){
        const role = isSuperEmail(fUser.email) ? "super_admin" : "user";
        await ref.set({...base, role, status:"active", createdAt:firebase.firestore.FieldValue.serverTimestamp()});
      } else {
        const data = snap.data() || {};
        const patch = {...base};
        if(isSuperEmail(fUser.email) && data.role !== "super_admin") patch.role = "super_admin";
        await ref.set(patch, {merge:true});
      }
      const finalSnap = await ref.get();
      const user = finalSnap.data();
      return {...user, uid:fUser.uid, createdAt:tsValue(user.createdAt), lastLogin:tsValue(user.lastLogin)};
    },
    async getUsers(){
      const snap = await this.db.collection("users").get();
      return snap.docs.map(d=>({id:d.id, ...d.data(), uid:d.id, createdAt:tsValue(d.data().createdAt), lastLogin:tsValue(d.data().lastLogin)}))
        .sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    },
    async updateUser(uid, patch){
      await this.db.collection("users").doc(uid).set({...patch, updatedAt:firebase.firestore.FieldValue.serverTimestamp()}, {merge:true});
      const s = await this.db.collection("users").doc(uid).get();
      return {uid:s.id, ...s.data()};
    },
    async getPosts({includeRegistered=false}={}){
      const snap = await this.db.collection("posts").get();
      let posts = snap.docs.map(d=>({id:d.id, ...d.data(), createdAt:tsValue(d.data().createdAt), updatedAt:tsValue(d.data().updatedAt)}));
      if(!includeRegistered) posts = posts.filter(p=>p.visibility !== "registered");
      return posts.sort((a,b)=> Number(b.pinned)-Number(a.pinned) || (b.createdAt||0)-(a.createdAt||0));
    },
    async getPost(id){
      const snap = await this.db.collection("posts").doc(id).get();
      return snap.exists ? {id:snap.id, ...snap.data(), createdAt:tsValue(snap.data().createdAt), updatedAt:tsValue(snap.data().updatedAt)} : null;
    },
    async uploadAttachment(item, currentUser){
      const file = item?.file || item;
      if(!file) return null;
      const safeName = String(file.name || "archivo").replace(/[^a-zA-Z0-9_.-]/g,"_");
      const type = item?.type || (String(file.type || "").startsWith("image/") ? "image" : String(file.type || "").startsWith("video/") ? "video" : "document");
      const ref = this.storage.ref(`post-attachments/${currentUser.uid}/${Date.now()}-${safeName}`);
      await ref.put(file, {contentType:file.type || undefined});
      const url = await ref.getDownloadURL();
      return {
        id:item?.id || `${type}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
        type,
        name:item?.name || file.name || "Archivo",
        url,
        size:item?.size || file.size || 0,
        mime:item?.mime || file.type || "",
        source:"storage",
        createdAt:Date.now()
      };
    },
    async uploadImage(file, currentUser){
      const att = await this.uploadAttachment({file, type:"image", name:file?.name || "Imagen"}, currentUser);
      return att?.url || "";
    },
    normalizeAttachment(att){
      if(!att) return null;
      return {
        id: att.id || `att_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
        type: att.type || "link",
        name: att.name || "Adjunto",
        url: att.url || "",
        size: att.size || 0,
        mime: att.mime || "",
        source: att.source || "url",
        createdAt: att.createdAt || Date.now()
      };
    },
    legacyFieldsFromAttachments(attachments){
      const image = attachments.find(a => a.type === "image" && a.url);
      const video = attachments.find(a => a.type === "video" && a.url);
      const link = attachments.find(a => a.type === "link" && a.url);
      return {
        imageUrl: image?.url || "",
        videoUrl: video?.url || "",
        linkUrl: link?.url || ""
      };
    },
    async savePost(data, files, currentUser){
      const incoming = Array.isArray(data.attachments) ? data.attachments.map(a => this.normalizeAttachment(a)).filter(Boolean) : [];
      if(data.imageUrl && !incoming.some(a => a.url === data.imageUrl)) incoming.unshift(this.normalizeAttachment({type:"image", name:"Imagen del aviso", url:data.imageUrl, source:"legacy"}));
      if(data.videoUrl && !incoming.some(a => a.url === data.videoUrl)) incoming.push(this.normalizeAttachment({type:"video", name:"Video externo", url:data.videoUrl, source:"legacy"}));
      if(data.linkUrl && !incoming.some(a => a.url === data.linkUrl)) incoming.push(this.normalizeAttachment({type:"link", name:"Link externo", url:data.linkUrl, source:"legacy"}));

      const arr = Array.isArray(files) ? files : files ? [{file:files}] : [];
      const uploaded = [];
      for(const item of arr){
        const att = await this.uploadAttachment(item, currentUser);
        if(att) uploaded.push(att);
      }
      const attachments = [...incoming, ...uploaded];
      const legacy = this.legacyFieldsFromAttachments(attachments);

      const payload = clean({
        title:data.title,
        content:data.content,
        category:data.category,
        visibility:data.visibility,
        status:data.status || "published",
        allowComments:!!data.allowComments,
        allowReactions:!!data.allowReactions,
        pinned:!!data.pinned,
        urgent:!!data.urgent,
        attachments,
        imageUrl:legacy.imageUrl,
        videoUrl:legacy.videoUrl,
        linkUrl:legacy.linkUrl,
        authorId: currentUser.uid,
        authorName: currentUser.name,
        authorPhoto: currentUser.photoURL || "",
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      if(data.id){
        await this.db.collection("posts").doc(data.id).set(payload, {merge:true});
      } else {
        await this.db.collection("posts").add({...payload, createdAt:firebase.firestore.FieldValue.serverTimestamp()});
      }
      return true;
    },
    async deletePost(postId){
      await this.db.collection("posts").doc(postId).delete();
      const comments = await this.db.collection("comments").where("postId","==",postId).get();
      const reactions = await this.db.collection("reactions").where("postId","==",postId).get();
      const batch = this.db.batch();
      comments.docs.forEach(d=>batch.delete(d.ref));
      reactions.docs.forEach(d=>batch.delete(d.ref));
      await batch.commit();
      return true;
    },
    async getComments(postId){
      const snap = await this.db.collection("comments").where("postId","==",postId).get();
      return snap.docs.map(d=>({id:d.id, ...d.data(), createdAt:tsValue(d.data().createdAt)}))
        .filter(c=>c.status !== "hidden")
        .sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
    },
    async addComment(postId, text, currentUser){
      await this.db.collection("comments").add({
        postId,
        userId:currentUser.uid,
        userName:currentUser.name,
        userPhoto:currentUser.photoURL || "",
        text,
        status:"visible",
        createdAt:firebase.firestore.FieldValue.serverTimestamp()
      });
      return true;
    },
    async deleteComment(commentId){ await this.db.collection("comments").doc(commentId).delete(); return true; },
    async getReactions(postId){
      const snap = await this.db.collection("reactions").where("postId","==",postId).get();
      return snap.docs.map(d=>({id:d.id, ...d.data(), createdAt:tsValue(d.data().createdAt)}));
    },
    async setReaction(postId, type, currentUser){
      const id = `${postId}_${currentUser.uid}`;
      await this.db.collection("reactions").doc(id).set({postId,userId:currentUser.uid,type,createdAt:firebase.firestore.FieldValue.serverTimestamp()}, {merge:true});
      return true;
    }
  };
})();
