(function(){
  const A = () => window.App;
  let editingId = "";
  let modalEditingId = "";
  let allPosts = [];
  const selected = new Set();
  const state = {
    query: "",
    category: "all",
    interaction: "all",
    sort: "newest",
    status: "published",
    page: 1,
    pageSize: 10
  };

  const STATUS = {
    all: {label:"Todos", icon:"📚"},
    published: {label:"Publicados", icon:"✅"},
    draft: {label:"Borradores", icon:"📝"},
    scheduled: {label:"Programados", icon:"⏰"},
    archived: {label:"Archivados", icon:"🗄️"},
    deleted: {label:"Papelera", icon:"🗑️"}
  };


  const attachmentState = {
    create: { existing: [], files: [], links: [] },
    edit: { existing: [], files: [], links: [] }
  };

  function makeAttachmentId(prefix="att"){
    return `${prefix}_${Math.random().toString(36).slice(2,9)}_${Date.now()}`;
  }

  function attachmentLimits(){
    return window.SCHOOL_CONFIG.attachments || {};
  }

  function bytesToSize(bytes){
    const n = Number(bytes || 0);
    if(!n) return "";
    if(n < 1024) return `${n} B`;
    if(n < 1024 * 1024) return `${(n/1024).toFixed(1)} KB`;
    return `${(n/1024/1024).toFixed(1)} MB`;
  }

  function typeFromFile(file){
    const mime = String(file?.type || "");
    const name = String(file?.name || "").toLowerCase();
    if(mime.startsWith("image/")) return "image";
    if(mime.startsWith("video/")) return "video";
    if(/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name)) return "image";
    if(/\.(mp4|webm|mov|m4v|avi|mkv)$/.test(name)) return "video";
    return "document";
  }

  function typeLabel(type){
    return type === "image" ? "Imagen" : type === "video" ? "Video" : type === "document" ? "Documento" : "Link";
  }

  function typeIcon(type){
    return type === "image" ? "🖼️" : type === "video" ? "🎥" : type === "document" ? "📄" : "🔗";
  }

  function normalizeAttachment(att){
    if(!att) return null;
    const type = att.type || "link";
    return {
      id: att.id || makeAttachmentId("att"),
      type,
      name: att.name || typeLabel(type),
      url: att.url || "",
      size: att.size || 0,
      mime: att.mime || "",
      source: att.source || (att.file ? "file" : "url"),
      createdAt: att.createdAt || Date.now()
    };
  }

  function getPostAttachments(post){
    const list = Array.isArray(post?.attachments) ? post.attachments.map(normalizeAttachment).filter(Boolean) : [];
    const hasUrl = (url) => !!url && list.some(a => a.url === url);
    if(post?.imageUrl && !hasUrl(post.imageUrl)){
      list.unshift(normalizeAttachment({id:`legacy_img_${post.id||Date.now()}`, type:"image", name:"Imagen del aviso", url:post.imageUrl, source:"legacy"}));
    }
    if(post?.videoUrl && !hasUrl(post.videoUrl)){
      list.push(normalizeAttachment({id:`legacy_vid_${post.id||Date.now()}`, type:"video", name:"Video externo", url:post.videoUrl, source:"legacy"}));
    }
    if(post?.linkUrl && !hasUrl(post.linkUrl)){
      list.push(normalizeAttachment({id:`legacy_link_${post.id||Date.now()}`, type:"link", name:"Link externo", url:post.linkUrl, source:"legacy"}));
    }
    return list;
  }

  function primaryImage(post){
    return getPostAttachments(post).find(a => a.type === "image" && a.url)?.url || post?.imageUrl || "";
  }

  function adminThumbHTML(post){
    const img = primaryImage(post);
    if(img) return `<div class="notice-thumb"><img src="${A().escapeHTML(img)}" alt=""></div>`;
    const count = getPostAttachments(post).length;
    return `<div class="notice-thumb"><span>${count ? "📎" : "📢"}</span></div>`;
  }

  function countAttachments(post){
    return getPostAttachments(post).length;
  }

  function allScopeAttachments(scope){
    const s = attachmentState[scope];
    return [...s.existing, ...s.links, ...s.files];
  }

  function savedScopeAttachments(scope){
    const s = attachmentState[scope];
    return [...s.existing, ...s.links].map(normalizeAttachment).filter(Boolean);
  }

  function newScopeFiles(scope){
    return attachmentState[scope].files.map(item => ({
      id: item.id,
      file: item.file,
      type: item.type,
      name: item.name,
      size: item.size,
      mime: item.mime
    }));
  }

  function resetAttachmentState(scope){
    attachmentState[scope]?.files?.forEach(a => { if(a.previewUrl) URL.revokeObjectURL(a.previewUrl); });
    attachmentState[scope] = { existing: [], files: [], links: [] };
    renderAttachmentPreview(scope);
  }

  function validateFile(file, currentItems){
    const limits = attachmentLimits();
    const maxMB = Number(limits.maxFileSizeMB || 50);
    if(file.size > maxMB * 1024 * 1024){
      alert(`"${file.name}" pesa más de ${maxMB} MB. No se agregó.`);
      return false;
    }
    const type = typeFromFile(file);
    const next = [...currentItems, {type}];
    const total = next.length;
    const count = (t) => next.filter(x => x.type === t).length;
    if(limits.maxTotal && total > limits.maxTotal){ alert(`Máximo ${limits.maxTotal} adjuntos por aviso.`); return false; }
    if(type === "image" && limits.maxImages && count("image") > limits.maxImages){ alert(`Máximo ${limits.maxImages} imágenes por aviso.`); return false; }
    if(type === "video" && limits.maxVideos && count("video") > limits.maxVideos){ alert(`Máximo ${limits.maxVideos} videos por aviso.`); return false; }
    if(type === "document" && limits.maxDocuments && count("document") > limits.maxDocuments){ alert(`Máximo ${limits.maxDocuments} documentos por aviso.`); return false; }
    return true;
  }

  function addFilesToScope(scope, fileList){
    const s = attachmentState[scope];
    Array.from(fileList || []).forEach(file => {
      if(!validateFile(file, allScopeAttachments(scope))) return;
      const type = typeFromFile(file);
      const previewUrl = (type === "image" || type === "video") ? URL.createObjectURL(file) : "";
      s.files.push({
        id: makeAttachmentId("file"),
        type,
        name: file.name,
        size: file.size,
        mime: file.type || "",
        file,
        url: previewUrl,
        previewUrl,
        source: "pending"
      });
    });
    renderAttachmentPreview(scope);
  }

  function addExternalToScope(scope){
    const prefix = scope === "edit" ? "edit" : "";
    const typeEl = A().$(`#${prefix ? "editExternalType" : "externalType"}`);
    const nameEl = A().$(`#${prefix ? "editExternalName" : "externalName"}`);
    const urlEl = A().$(`#${prefix ? "editExternalUrl" : "externalUrl"}`);
    if(!urlEl) return;
    const url = urlEl.value.trim();
    if(!url) return alert("Escribe el link primero.");
    const type = typeEl?.value || "link";
    const name = nameEl?.value.trim() || (type === "video" ? "Video externo" : type === "document" ? "Documento externo" : "Link externo");
    const s = attachmentState[scope];
    const limits = attachmentLimits();
    const linkCount = allScopeAttachments(scope).filter(a => ["link","video","document"].includes(a.type) && a.source === "url").length;
    if(limits.maxLinks && linkCount >= limits.maxLinks) return alert(`Máximo ${limits.maxLinks} links externos por aviso.`);
    s.links.push(normalizeAttachment({id: makeAttachmentId("url"), type, name, url, source:"url"}));
    if(nameEl) nameEl.value = "";
    urlEl.value = "";
    renderAttachmentPreview(scope);
  }

  function removeAttachment(scope, kind, id){
    const s = attachmentState[scope];
    if(kind === "existing") s.existing = s.existing.filter(a => a.id !== id);
    if(kind === "file") s.files = s.files.filter(a => {
      const keep = a.id !== id;
      if(!keep && a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      return keep;
    });
    if(kind === "link") s.links = s.links.filter(a => a.id !== id);
    renderAttachmentPreview(scope);
  }

  function attachmentPreviewHTML(att, kind){
    const isImage = att.type === "image" && att.url;
    const isVideo = att.type === "video" && att.url && (String(att.url).startsWith("blob:") || String(att.url).startsWith("data:"));
    return `
      <div class="attachment-admin-card">
        <button class="attachment-remove" type="button" data-remove-attachment="${A().escapeHTML(att.id)}" data-remove-kind="${kind}" title="Quitar adjunto">×</button>
        <div class="attachment-admin-thumb">
          ${isImage ? `<img src="${A().escapeHTML(att.url)}" alt="">` : isVideo ? `<video src="${A().escapeHTML(att.url)}" muted></video>` : `<span>${typeIcon(att.type)}</span>`}
        </div>
        <div class="attachment-admin-info">
          <strong>${A().escapeHTML(att.name || typeLabel(att.type))}</strong>
          <small>${typeLabel(att.type)}${att.size ? " · " + bytesToSize(att.size) : ""}${kind === "file" ? " · pendiente" : ""}</small>
        </div>
      </div>
    `;
  }

  function renderAttachmentPreview(scope){
    const box = A().$(scope === "edit" ? "#editAttachmentsPreview" : "#attachmentsPreview");
    if(!box) return;
    const s = attachmentState[scope];
    const rows = [
      ...s.existing.map(a => ({...a, kind:"existing"})),
      ...s.links.map(a => ({...a, kind:"link"})),
      ...s.files.map(a => ({...a, kind:"file"}))
    ];
    if(!rows.length){
      box.innerHTML = `<div class="notice info">No hay adjuntos seleccionados. Puedes agregar imágenes, videos, documentos o links.</div>`;
      return;
    }
    box.innerHTML = `
      <div class="attachments-admin-head">
        <strong>${rows.length} adjunto(s)</strong>
        <span>Solo se guardan al publicar o al guardar cambios.</span>
      </div>
      <div class="attachments-admin-grid">
        ${rows.map(a => attachmentPreviewHTML(a, a.kind)).join("")}
      </div>
    `;
    box.querySelectorAll("[data-remove-attachment]").forEach(btn => btn.addEventListener("click", ()=>{
      removeAttachment(scope, btn.dataset.removeKind, btn.dataset.removeAttachment);
    }));
  }

  function initAttachmentControls(){
    const bindings = [
      ["create", "attachmentImages"],
      ["create", "attachmentVideos"],
      ["create", "attachmentDocs"],
      ["edit", "editAttachmentImages"],
      ["edit", "editAttachmentVideos"],
      ["edit", "editAttachmentDocs"]
    ];
    bindings.forEach(([scope, id])=>{
      const input = A().$(`#${id}`);
      input?.addEventListener("change", ()=>{
        addFilesToScope(scope, input.files);
        input.value = "";
      });
    });
    A().$("#addExternalBtn")?.addEventListener("click", ()=>addExternalToScope("create"));
    A().$("#editAddExternalBtn")?.addEventListener("click", ()=>addExternalToScope("edit"));
    A().$("#externalUrl")?.addEventListener("keydown", e => { if(e.key === "Enter"){ e.preventDefault(); addExternalToScope("create"); } });
    A().$("#editExternalUrl")?.addEventListener("keydown", e => { if(e.key === "Enter"){ e.preventDefault(); addExternalToScope("edit"); } });
    renderAttachmentPreview("create");
    renderAttachmentPreview("edit");
  }

  function adminAllowed(){ return !!A().currentUser && A().isAdmin(); }
  function normalStatus(post){ return post.status || "published"; }
  function cleanText(value){ return String(value || "").trim().toLowerCase(); }
  function shortText(value, max=140){
    const text = String(value || "").replace(/\s+/g, " ").trim();
    return text.length > max ? text.slice(0, max) + "..." : text;
  }

  function renderGate(){
    const gate = A().$('#adminGate');
    const content = A().$('#adminContent');
    if(!gate || !content) return false;
    if(!A().currentUser){
      gate.innerHTML = `<div class="notice danger"><strong>Acceso protegido.</strong><br>Inicia sesión como admin para ver esta sección.</div>`;
      content.classList.add('hidden');
      return false;
    }
    if(!A().isAdmin()){
      gate.innerHTML = `<div class="notice danger"><strong>No tienes permisos.</strong><br>Tu usuario existe, pero no tiene rol de administrador.</div>`;
      content.classList.add('hidden');
      return false;
    }
    gate.innerHTML = '';
    content.classList.remove('hidden');
    return true;
  }

  function fillCategories(){
    const options = window.SCHOOL_CONFIG.categories.map(c=>`<option>${A().escapeHTML(c)}</option>`).join('');
    const sel = A().$('#category');
    if(sel) sel.innerHTML = options;

    const editSel = A().$('#editCategory');
    if(editSel) editSel.innerHTML = options;

    const filter = A().$('#noticeCategoryFilter');
    if(filter){
      filter.innerHTML = `<option value="all">Todas las categorías</option>` +
        window.SCHOOL_CONFIG.categories.map(c=>`<option value="${A().escapeHTML(c)}">${A().escapeHTML(c)}</option>`).join('');
    }
  }

  function getFormData(){
    return {
      id: editingId || "",
      title: A().$('#title').value.trim(),
      content: A().$('#content').value.trim(),
      category: A().$('#category').value,
      visibility: A().$('#visibility').value,
      status: A().$('#postStatus')?.value || "published",
      allowComments: A().$('#allowComments').checked,
      allowReactions: A().$('#allowReactions').checked,
      pinned: A().$('#pinned').checked,
      urgent: A().$('#urgent').checked,
      attachments: savedScopeAttachments("create")
    };
  }

  function clearForm(){
    editingId = "";
    const form = A().$('#postForm');
    form?.reset();
    if(A().$('#postStatus')) A().$('#postStatus').value = "published";
    if(A().$('#currentImageUrl')) A().$('#currentImageUrl').value = "";
    resetAttachmentState("create");
    A().$('#formTitle').textContent = "Crear nuevo aviso";
    A().$('#saveBtn').textContent = "Publicar aviso";
  }

  function normalizePost(post){
    return {...post, status: normalStatus(post)};
  }

  function getFilteredPosts(){
    const q = cleanText(state.query);
    let posts = allPosts.map(normalizePost);

    if(state.status !== "all") posts = posts.filter(p => p.status === state.status);
    if(state.category !== "all") posts = posts.filter(p => p.category === state.category);

    if(q){
      posts = posts.filter(p => [p.title, p.content, p.category, p.authorName].some(v => cleanText(v).includes(q)));
    }

    switch(state.interaction){
      case "comments_on": posts = posts.filter(p => !!p.allowComments); break;
      case "comments_off": posts = posts.filter(p => !p.allowComments); break;
      case "reactions_on": posts = posts.filter(p => !!p.allowReactions); break;
      case "reactions_off": posts = posts.filter(p => !p.allowReactions); break;
      case "urgent": posts = posts.filter(p => !!p.urgent); break;
      case "pinned": posts = posts.filter(p => !!p.pinned); break;
      case "public": posts = posts.filter(p => p.visibility !== "registered"); break;
      case "registered": posts = posts.filter(p => p.visibility === "registered"); break;
    }

    switch(state.sort){
      case "oldest": posts.sort((a,b)=>(a.createdAt||0)-(b.createdAt||0)); break;
      case "title": posts.sort((a,b)=>String(a.title||"").localeCompare(String(b.title||""), "es")); break;
      case "pinned": posts.sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned) || (b.createdAt||0)-(a.createdAt||0)); break;
      case "urgent": posts.sort((a,b)=>Number(!!b.urgent)-Number(!!a.urgent) || (b.createdAt||0)-(a.createdAt||0)); break;
      default: posts.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    }
    return posts;
  }

  function renderStats(){
    const box = A().$('#adminStats');
    if(!box) return;
    const posts = allPosts.map(normalizePost);
    const count = (status) => posts.filter(p => p.status === status).length;
    const urgent = posts.filter(p => p.status === "published" && p.urgent).length;
    const pinned = posts.filter(p => p.status === "published" && p.pinned).length;
    box.innerHTML = `
      <div class="manager-kpi"><span>Total</span><strong>${posts.length}</strong><small>avisos creados</small></div>
      <div class="manager-kpi"><span>Publicados</span><strong>${count("published")}</strong><small>visibles en el muro</small></div>
      <div class="manager-kpi"><span>Urgentes</span><strong>${urgent}</strong><small>publicados con alerta</small></div>
      <div class="manager-kpi"><span>Fijados</span><strong>${pinned}</strong><small>arriba del muro</small></div>
      <div class="manager-kpi"><span>Borradores</span><strong>${count("draft")}</strong><small>sin publicar</small></div>
    `;
  }

  function renderTabs(){
    const box = A().$('#noticeStatusTabs');
    if(!box) return;
    const posts = allPosts.map(normalizePost);
    const items = Object.entries(STATUS).map(([key, info])=>{
      const total = key === "all" ? posts.length : posts.filter(p => p.status === key).length;
      return `<button class="${state.status===key?'active':''}" data-status-tab="${key}" type="button"><span>${info.icon}</span> ${info.label} <strong>${total}</strong></button>`;
    }).join('');
    box.innerHTML = items;
    box.querySelectorAll('[data-status-tab]').forEach(btn => btn.addEventListener('click', ()=>{
      state.status = btn.dataset.statusTab;
      state.page = 1;
      selected.clear();
      renderManager();
    }));
  }

  function postChips(p){
    const attCount = countAttachments(p);
    return `
      <span class="tag status-${A().escapeHTML(p.status)}">${STATUS[p.status]?.icon || '📄'} ${STATUS[p.status]?.label || 'Publicado'}</span>
      ${p.pinned ? '<span class="tag pinned">📌 Fijado</span>' : ''}
      ${p.urgent ? '<span class="tag urgent">⚠️ Urgente</span>' : ''}
      ${p.visibility === 'registered' ? '<span class="tag lock">🔒 Registrados</span>' : '<span class="tag">🌎 Público</span>'}
      ${p.allowComments ? '<span class="tag">💬 Comentarios</span>' : '<span class="tag lock">🚫 Comentarios</span>'}
      ${p.allowReactions ? '<span class="tag">✅ Reacciones</span>' : '<span class="tag lock">🚫 Reacciones</span>'}
      ${attCount ? `<span class="tag">📎 ${attCount} adjunto(s)</span>` : ''}
    `;
  }

  function actionButtons(p){
    const common = `
      <button class="btn small secondary" data-preview="${A().escapeHTML(p.id)}" type="button">Ver</button>
      <button class="btn small secondary" data-edit="${A().escapeHTML(p.id)}" type="button">Editar</button>
      <button class="btn small ghost" data-duplicate="${A().escapeHTML(p.id)}" type="button">Duplicar</button>
    `;
    if(p.status === "deleted"){
      return `${common}<button class="btn small" data-restore="${A().escapeHTML(p.id)}" type="button">Restaurar</button><button class="btn small danger" data-del-permanent="${A().escapeHTML(p.id)}" type="button">Eliminar definitivo</button>`;
    }
    if(p.status === "archived"){
      return `${common}<button class="btn small" data-publish="${A().escapeHTML(p.id)}" type="button">Publicar</button><button class="btn small danger" data-trash="${A().escapeHTML(p.id)}" type="button">Papelera</button>`;
    }
    if(p.status === "draft" || p.status === "scheduled"){
      return `${common}<button class="btn small" data-publish="${A().escapeHTML(p.id)}" type="button">Publicar</button><button class="btn small ghost" data-archive="${A().escapeHTML(p.id)}" type="button">Archivar</button><button class="btn small danger" data-trash="${A().escapeHTML(p.id)}" type="button">Papelera</button>`;
    }
    return `${common}<button class="btn small ghost" data-archive="${A().escapeHTML(p.id)}" type="button">Archivar</button><button class="btn small danger" data-trash="${A().escapeHTML(p.id)}" type="button">Papelera</button>`;
  }

  function renderBulkBar(currentPagePosts){
    const bar = A().$('#bulkBar');
    if(!bar) return;
    if(!selected.size){ bar.classList.add('hidden'); bar.innerHTML = ''; return; }
    bar.classList.remove('hidden');
    bar.innerHTML = `
      <strong>${selected.size} seleccionado(s)</strong>
      <button class="btn small" data-bulk="published" type="button">Publicar</button>
      <button class="btn small secondary" data-bulk="archived" type="button">Archivar</button>
      <button class="btn small danger" data-bulk="deleted" type="button">Mandar a papelera</button>
      <button class="btn small ghost" id="clearSelectionBtn" type="button">Limpiar selección</button>
    `;
    bar.querySelectorAll('[data-bulk]').forEach(btn => btn.addEventListener('click', async ()=>{
      if(!confirm(`¿Cambiar ${selected.size} aviso(s) a estado "${btn.dataset.bulk}"?`)) return;
      await bulkStatus(btn.dataset.bulk);
    }));
    A().$('#clearSelectionBtn')?.addEventListener('click', ()=>{ selected.clear(); renderManager(); });
  }

  function renderPagination(total){
    const box = A().$('#adminPagination');
    if(!box) return;
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    if(state.page > totalPages) state.page = totalPages;
    const start = total ? ((state.page-1)*state.pageSize)+1 : 0;
    const end = Math.min(total, state.page*state.pageSize);
    const pages = [];
    const min = Math.max(1, state.page-2);
    const max = Math.min(totalPages, state.page+2);
    for(let i=min;i<=max;i++) pages.push(i);
    box.innerHTML = `
      <span>Mostrando ${start}-${end} de ${total}</span>
      <div class="pagination-buttons">
        <button class="btn small secondary" data-page="prev" ${state.page<=1?'disabled':''} type="button">Anterior</button>
        ${pages.map(p=>`<button class="btn small ${p===state.page?'':'secondary'}" data-page="${p}" type="button">${p}</button>`).join('')}
        <button class="btn small secondary" data-page="next" ${state.page>=totalPages?'disabled':''} type="button">Siguiente</button>
      </div>
    `;
    box.querySelectorAll('[data-page]').forEach(btn => btn.addEventListener('click', ()=>{
      const value = btn.dataset.page;
      if(value === "prev") state.page = Math.max(1, state.page-1);
      else if(value === "next") state.page = Math.min(totalPages, state.page+1);
      else state.page = Number(value);
      renderManager();
    }));
  }

  function renderManager(){
    const list = A().$('#adminPosts');
    if(!list || !adminAllowed()) return;
    renderStats();
    renderTabs();

    const filtered = getFilteredPosts();
    const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
    if(state.page > totalPages) state.page = totalPages;
    const start = (state.page-1) * state.pageSize;
    const pagePosts = filtered.slice(start, start + state.pageSize);

    renderBulkBar(pagePosts);
    renderPagination(filtered.length);

    if(!filtered.length){
      list.innerHTML = `<div class="empty">No hay avisos con estos filtros. Prueba cambiar búsqueda, categoría o estado.</div>`;
      return;
    }

    list.innerHTML = `<div class="notice-list">${pagePosts.map(p => `
      <article class="notice-admin-card ${selected.has(p.id)?'selected':''}">
        <label class="select-check"><input type="checkbox" data-select-post="${A().escapeHTML(p.id)}" ${selected.has(p.id)?'checked':''}></label>
        ${adminThumbHTML(p)}
        <div class="notice-main">
          <div class="notice-line">
            <h3>${A().escapeHTML(p.title || 'Sin título')}</h3>
            <span class="post-meta">${A().fmtDate(p.createdAt)}</span>
          </div>
          <p>${A().escapeHTML(shortText(p.content))}</p>
          <div class="post-tags compact-tags">${postChips(p)}</div>
        </div>
        <div class="notice-actions">${actionButtons(p)}</div>
      </article>`).join('')}</div>`;

    list.querySelectorAll('[data-select-post]').forEach(input => input.addEventListener('change', ()=>{
      if(input.checked) selected.add(input.dataset.selectPost);
      else selected.delete(input.dataset.selectPost);
      renderManager();
    }));
    list.querySelectorAll('[data-preview]').forEach(btn => btn.addEventListener('click', ()=>previewPost(btn.dataset.preview)));
    list.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', ()=>loadForEdit(btn.dataset.edit)));
    list.querySelectorAll('[data-duplicate]').forEach(btn => btn.addEventListener('click', ()=>duplicatePost(btn.dataset.duplicate)));
    list.querySelectorAll('[data-archive]').forEach(btn => btn.addEventListener('click', ()=>changeStatus(btn.dataset.archive, "archived")));
    list.querySelectorAll('[data-trash]').forEach(btn => btn.addEventListener('click', ()=>changeStatus(btn.dataset.trash, "deleted")));
    list.querySelectorAll('[data-restore]').forEach(btn => btn.addEventListener('click', ()=>changeStatus(btn.dataset.restore, "published")));
    list.querySelectorAll('[data-publish]').forEach(btn => btn.addEventListener('click', ()=>changeStatus(btn.dataset.publish, "published")));
    list.querySelectorAll('[data-del-permanent]').forEach(btn => btn.addEventListener('click', async ()=>{
      if(confirm('¿Eliminar definitivamente este aviso y sus comentarios? Esta acción no se puede deshacer.')){
        await A().db.deletePost(btn.dataset.delPermanent);
        selected.delete(btn.dataset.delPermanent);
        await renderAdminPosts();
      }
    }));
  }

  async function renderAdminPosts(){
    if(!adminAllowed()) return;
    allPosts = (await A().db.getPosts({includeRegistered:true})).map(normalizePost);
    renderManager();
  }

  function getEditData(){
    return {
      id: modalEditingId || A().$('#editPostId')?.value || "",
      title: A().$('#editTitle').value.trim(),
      content: A().$('#editContent').value.trim(),
      category: A().$('#editCategory').value,
      visibility: A().$('#editVisibility').value,
      status: A().$('#editPostStatus')?.value || "published",
      allowComments: A().$('#editAllowComments').checked,
      allowReactions: A().$('#editAllowReactions').checked,
      pinned: A().$('#editPinned').checked,
      urgent: A().$('#editUrgent').checked,
      attachments: savedScopeAttachments("edit")
    };
  }

  function closeEditModal(){
    const modal = A().$('#editPostModal');
    const form = A().$('#editPostForm');
    form?.reset();
    modalEditingId = "";
    resetAttachmentState("edit");
    if(A().$('#editCurrentImageUrl')) A().$('#editCurrentImageUrl').value = "";
    if(A().$('#editPostId')) A().$('#editPostId').value = "";
    modal?.classList.add('hidden');
    modal?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  function openEditModalWithPost(p){
    modalEditingId = p.id;
    A().$('#editPostId').value = p.id || '';
    A().$('#editTitle').value = p.title || '';
    A().$('#editContent').value = p.content || '';
    A().$('#editCategory').value = p.category || 'Aviso general';
    A().$('#editVisibility').value = p.visibility || 'public';
    if(A().$('#editPostStatus')) A().$('#editPostStatus').value = normalStatus(p);
    A().$('#editAllowComments').checked = !!p.allowComments;
    A().$('#editAllowReactions').checked = !!p.allowReactions;
    A().$('#editPinned').checked = !!p.pinned;
    A().$('#editUrgent').checked = !!p.urgent;
    if(A().$('#editCurrentImageUrl')) A().$('#editCurrentImageUrl').value = p.imageUrl || '';
    attachmentState.edit = {
      existing: getPostAttachments(p),
      files: [],
      links: []
    };
    renderAttachmentPreview("edit");
    const modal = A().$('#editPostModal');
    modal?.classList.remove('hidden');
    modal?.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    setTimeout(()=>A().$('#editTitle')?.focus(), 50);
  }

  async function loadForEdit(id){
    const p = await A().db.getPost(id);
    if(!p) return;
    openEditModalWithPost(normalizePost(p));
  }

  function initEditModal(){
    const form = A().$('#editPostForm');
    const modal = A().$('#editPostModal');
    if(!form || !modal) return;

    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      if(!A().isAdmin()) return alert('No tienes permisos de admin.');
      const data = getEditData();
      if(!data.id) return alert('No se encontró el aviso que se está editando.');
      if(!data.title || !data.content) return alert('Falta título o contenido.');
      const files = newScopeFiles("edit");
      const btn = A().$('#editSaveBtn');
      if(btn){ btn.disabled = true; btn.textContent = 'Guardando...'; }
      try{
        await A().db.savePost(data, files, A().currentUser);
        closeEditModal();
        selected.clear();
        await renderAdminPosts();
        alert('Cambios guardados.');
      }catch(err){
        alert('Error al guardar cambios: ' + (err.message || err));
      }
      if(btn){ btn.disabled = false; btn.textContent = 'Guardar cambios'; }
    });

    A().$('#editModalClose')?.addEventListener('click', closeEditModal);
    A().$('#editCancelBtn')?.addEventListener('click', closeEditModal);
    modal.addEventListener('click', (e)=>{
      if(e.target === modal) closeEditModal();
    });
    document.addEventListener('keydown', (e)=>{
      if(e.key === 'Escape' && !modal.classList.contains('hidden')) closeEditModal();
    });
  }

  async function changeStatus(id, status){
    const p = await A().db.getPost(id);
    if(!p) return;
    await A().db.savePost({...p, id:p.id, status}, null, A().currentUser);
    selected.delete(id);
    await renderAdminPosts();
  }

  async function bulkStatus(status){
    const ids = Array.from(selected);
    for(const id of ids){
      const p = await A().db.getPost(id);
      if(p) await A().db.savePost({...p, id:p.id, status}, null, A().currentUser);
    }
    selected.clear();
    await renderAdminPosts();
  }

  async function duplicatePost(id){
    const p = await A().db.getPost(id);
    if(!p) return;
    const copy = {
      ...p,
      id:"",
      title:`Copia de ${p.title || 'aviso'}`,
      status:"draft",
      pinned:false,
      urgent:false
    };
    await A().db.savePost(copy, null, A().currentUser);
    state.status = "draft";
    state.page = 1;
    await renderAdminPosts();
    alert('Aviso duplicado como borrador. Revísalo antes de publicarlo.');
  }

  async function previewPost(id){
    const p = await A().db.getPost(id);
    if(!p) return;
    const total = countAttachments(p);
    const msg = `${p.title || 'Sin título'}

${p.content || ''}

Categoría: ${p.category || 'Aviso'}
Estado: ${STATUS[normalStatus(p)]?.label || 'Publicado'}
Visibilidad: ${p.visibility === 'registered' ? 'Solo registrados' : 'Público'}
Adjuntos: ${total}`;
    alert(msg);
  }

  function initManagerControls(){
    const search = A().$('#noticeSearch');
    const category = A().$('#noticeCategoryFilter');
    const interaction = A().$('#noticeInteractionFilter');
    const sort = A().$('#noticeSort');
    const pageSize = A().$('#noticePageSize');
    const selectVisible = A().$('#selectVisibleBtn');

    search?.addEventListener('input', ()=>{ state.query = search.value; state.page = 1; renderManager(); });
    category?.addEventListener('change', ()=>{ state.category = category.value; state.page = 1; renderManager(); });
    interaction?.addEventListener('change', ()=>{ state.interaction = interaction.value; state.page = 1; renderManager(); });
    sort?.addEventListener('change', ()=>{ state.sort = sort.value; state.page = 1; renderManager(); });
    pageSize?.addEventListener('change', ()=>{ state.pageSize = Number(pageSize.value) || 10; state.page = 1; renderManager(); });
    selectVisible?.addEventListener('click', ()=>{
      const filtered = getFilteredPosts();
      const start = (state.page-1) * state.pageSize;
      filtered.slice(start, start + state.pageSize).forEach(p => selected.add(p.id));
      renderManager();
    });
  }

  function initForm(){
    const form = A().$('#postForm');
    if(!form) return;
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      if(!A().isAdmin()) return alert('No tienes permisos de admin.');
      const data = getFormData();
      if(!data.title || !data.content) return alert('Falta título o contenido.');
      const files = newScopeFiles("create");
      A().$('#saveBtn').disabled = true;
      A().$('#saveBtn').textContent = 'Guardando...';
      try{
        await A().db.savePost(data, files, A().currentUser);
        clearForm();
        selected.clear();
        await renderAdminPosts();
        alert('Aviso guardado.');
      }catch(err){ alert('Error al guardar: ' + (err.message || err)); }
      A().$('#saveBtn').disabled = false;
      A().$('#saveBtn').textContent = editingId ? 'Guardar cambios' : 'Publicar aviso';
    });
    A().$('#clearBtn')?.addEventListener('click', clearForm);
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    if(!A().$('#postForm')) return;
    fillCategories();
    initAttachmentControls();
    initForm();
    initEditModal();
    initManagerControls();
    A().onAuthChange(()=>{
      if(renderGate()) renderAdminPosts();
    });
  });
})();
