
(function(){
  const cfg = window.SCHOOL_CONFIG;
  let currentUser = null;
  let db = null;
  const callbacks = [];

  function $(sel, root=document){ return root.querySelector(sel); }
  function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
  function escapeHTML(str=""){
    return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }
  function fmtDate(v){
    if(!v) return "";
    try { return new Intl.DateTimeFormat('es-MX',{dateStyle:'medium', timeStyle:'short'}).format(new Date(v)); }
    catch(e){ return ""; }
  }
  function roleLabel(role){ return role === "super_admin" ? "Super admin" : role === "admin" ? "Admin" : "Usuario"; }
  function isAdmin(user=currentUser){ return !!user && ["admin","super_admin"].includes(user.role); }
  function isSuperAdmin(user=currentUser){ return !!user && user.role === "super_admin"; }
  function isActive(user=currentUser){ return !!user && user.status !== "blocked"; }
  function avatarHTML(user, size=""){
    if(user?.photoURL) return `<img class="avatar ${size}" src="${escapeHTML(user.photoURL)}" alt="${escapeHTML(user.name||'Usuario')}">`;
    return `<span class="avatar ${size}">${escapeHTML((user?.name||user?.email||"U").slice(0,1).toUpperCase())}</span>`;
  }

  function selectDB(){
    if(window.FirebaseDB && window.FirebaseDB.init()){
      db = window.FirebaseDB;
      return;
    }
    db = window.LocalDB;
    const ribbon = document.createElement('div');
    ribbon.className = 'demo-ribbon';
    ribbon.textContent = 'MODO DEMO LOCAL';
    document.body.appendChild(ribbon);
  }

  function emitAuth(){ callbacks.forEach(cb => cb(currentUser)); renderAuthBox(); }
  function onAuthChange(cb){ callbacks.push(cb); if(db) cb(currentUser); }

  async function initAuth(){
    if(db.mode === "firebase"){
      db.onAuthStateChanged(async (fUser)=>{
        if(fUser){ currentUser = await db.ensureProfile(fUser); }
        else currentUser = null;
        emitAuth();
      });
    } else {
      currentUser = await db.getCurrentSession();
      emitAuth();
    }
  }

  async function login(kind="google"){
    try{
      if(db.mode === "firebase"){
        await db.signInWithGoogle();
      } else {
        const role = kind === "admin" ? "admin" : kind === "super" ? "super_admin" : "user";
        currentUser = await db.demoLogin(role);
        emitAuth();
      }
    } catch(err){ alert("No se pudo iniciar sesión: " + (err.message || err)); }
  }
  async function logout(){
    if(db.mode === "firebase") await db.signOut();
    else { await db.clearSession(); currentUser = null; emitAuth(); }
  }

  function renderAuthBox(){
    const box = $('#authBox');
    if(!box) return;
    if(currentUser){
      box.innerHTML = `
        <div class="user-pill">
          ${avatarHTML(currentUser)}
          <div><strong>${escapeHTML(currentUser.name || currentUser.email)}</strong><br><span class="role-badge ${escapeHTML(currentUser.role)}">${roleLabel(currentUser.role)}</span>${currentUser.status === 'blocked' ? ' <span class="role-badge blocked">Bloqueado</span>' : ''}</div>
        </div>
        ${isAdmin() ? '<a class="btn small gold" href="admin.html">Panel admin</a>' : ''}
        ${isSuperAdmin() ? '<a class="btn small secondary" href="usuarios.html">Usuarios</a>' : ''}
        <button class="btn small ghost" data-logout>Cerrar sesión</button>
      `;
      $('[data-logout]', box).addEventListener('click', logout);
    } else {
      if(db?.mode === "firebase"){
        box.innerHTML = `<button class="btn small" data-login-google>Iniciar sesión con Google</button>`;
        $('[data-login-google]', box).addEventListener('click', ()=>login('google'));
      } else {
        box.innerHTML = `
          <button class="btn small" data-login-demo="user">Usuario demo</button>
          <button class="btn small gold" data-login-demo="admin">Admin demo</button>
          <button class="btn small secondary" data-login-demo="super">Super admin</button>
        `;
        $all('[data-login-demo]', box).forEach(btn => btn.addEventListener('click', ()=>login(btn.dataset.loginDemo)));
      }
    }
  }

  function markActiveNav(){
    const page = document.body.dataset.page || "";
    $all('.navlinks a').forEach(a=>{
      const href = a.getAttribute('href') || '';
      a.classList.toggle('active', href.includes(page));
    });
  }

  function requireAdmin(target){
    if(!target) return;
    if(!currentUser){
      target.innerHTML = `<div class="notice danger"><strong>Acceso protegido.</strong><br>Inicia sesión como admin para ver esta sección.</div>`;
      return false;
    }
    if(!isAdmin()){
      target.innerHTML = `<div class="notice danger"><strong>No tienes permisos.</strong><br>Tu usuario existe, pero no tiene rol de administrador.</div>`;
      return false;
    }
    return true;
  }
  function requireSuperAdmin(target){
    if(!target) return;
    if(!currentUser){
      target.innerHTML = `<div class="notice danger"><strong>Acceso protegido.</strong><br>Inicia sesión como super admin para gestionar usuarios.</div>`;
      return false;
    }
    if(!isSuperAdmin()){
      target.innerHTML = `<div class="notice danger"><strong>Solo super admin.</strong><br>Los admins pueden publicar avisos, pero solo el super admin cambia roles y bloquea usuarios.</div>`;
      return false;
    }
    return true;
  }

  function commonFooter(){
    const foot = document.createElement('footer');
    foot.className = 'footer';
    foot.innerHTML = `
      <div class="container footer-grid">
        <div>
          <div class="brand" style="color:white"><div class="logo small">EMS</div><div class="brand-text"><strong>${escapeHTML(cfg.schoolName)}</strong><span style="color:#d7ece7">Muro escolar y página oficial</span></div></div>
          <p>${escapeHTML(cfg.location)}</p>
        </div>
        <div><h3>Secciones</h3><p><a href="avisos.html">Avisos</a><br><a href="oferta.html">Oferta educativa</a><br><a href="galeria.html">Galería</a><br><a href="contacto.html">Contacto</a></p></div>
        <div><h3>Contacto</h3><p>${escapeHTML(cfg.phone)}<br>${escapeHTML(cfg.email)}</p></div>
      </div>`;
    document.body.appendChild(foot);
  }

  async function init(){
    selectDB();
    markActiveNav();
    renderAuthBox();
    commonFooter();
    await initAuth();
  }

  window.App = { $, $all, escapeHTML, fmtDate, roleLabel, avatarHTML, isAdmin, isSuperAdmin, isActive, onAuthChange, login, logout, requireAdmin, requireSuperAdmin, get db(){return db}, get currentUser(){return currentUser} };
  document.addEventListener('DOMContentLoaded', init);
})();
