(function(){
  const A = () => window.App;
  let activeCategory = "Todos";

  function reactionCounts(reactions){
    const counts = {};
    for(const r of reactions) counts[r.type] = (counts[r.type] || 0) + 1;
    return counts;
  }

  function canViewPost(post){
    if(post.visibility !== "registered") return true;
    return !!A().currentUser;
  }

  function makeAttachmentId(prefix="att"){
    return `${prefix}_${Math.random().toString(36).slice(2,9)}_${Date.now()}`;
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
      createdAt: att.createdAt || Date.now()
    };
  }

  function getPostAttachments(post){
    const list = Array.isArray(post?.attachments) ? post.attachments.map(normalizeAttachment).filter(Boolean) : [];
    const hasUrl = (url) => !!url && list.some(a => a.url === url);
    if(post?.imageUrl && !hasUrl(post.imageUrl)) list.unshift(normalizeAttachment({id:`legacy_img_${post.id||Date.now()}`, type:"image", name:"Imagen del aviso", url:post.imageUrl, source:"legacy"}));
    if(post?.videoUrl && !hasUrl(post.videoUrl)) list.push(normalizeAttachment({id:`legacy_vid_${post.id||Date.now()}`, type:"video", name:"Video externo", url:post.videoUrl, source:"legacy"}));
    if(post?.linkUrl && !hasUrl(post.linkUrl)) list.push(normalizeAttachment({id:`legacy_link_${post.id||Date.now()}`, type:"link", name:"Link externo", url:post.linkUrl, source:"legacy"}));
    return list;
  }

  function typeIcon(type){
    return type === "image" ? "🖼️" : type === "video" ? "🎥" : type === "document" ? "📄" : "🔗";
  }

  function typeLabel(type){
    return type === "image" ? "Imagen" : type === "video" ? "Video" : type === "document" ? "Documento" : "Link";
  }

  function isPdf(att){
    const name = String(att.name || "").toLowerCase();
    const mime = String(att.mime || "").toLowerCase();
    return mime.includes("pdf") || name.endsWith(".pdf") || String(att.url || "").toLowerCase().includes(".pdf");
  }

  function canPlayVideo(att){
    const url = String(att.url || "");
    return url.startsWith("data:video") || url.startsWith("blob:") || /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(url);
  }

  function renderAttachmentCard(att, index, hiddenCount){
    const label = typeLabel(att.type);
    const more = hiddenCount && index === 3 ? `<span class="attachment-more">+${hiddenCount} más</span>` : "";
    if(att.type === "image" && att.url){
      return `<button class="attachment-card image" data-open-attachment="${index}" type="button" title="Abrir imagen">
        <img src="${A().escapeHTML(att.url)}" alt="${A().escapeHTML(att.name || 'Imagen')}">${more}
      </button>`;
    }
    if(att.type === "video"){
      return `<button class="attachment-card file" data-open-attachment="${index}" type="button">
        <span class="attachment-icon">🎥</span><strong>${A().escapeHTML(att.name || 'Video')}</strong><small>${canPlayVideo(att) ? 'Reproducir' : 'Abrir video externo'}</small>${more}
      </button>`;
    }
    if(att.type === "document"){
      return `<button class="attachment-card file" data-open-attachment="${index}" type="button">
        <span class="attachment-icon">📄</span><strong>${A().escapeHTML(att.name || 'Documento')}</strong><small>${isPdf(att) ? 'Previsualizar PDF' : 'Abrir / descargar'}</small>${more}
      </button>`;
    }
    return `<button class="attachment-card file" data-open-attachment="${index}" type="button">
      <span class="attachment-icon">🔗</span><strong>${A().escapeHTML(att.name || 'Link')}</strong><small>Abrir enlace</small>${more}
    </button>`;
  }

  function renderPostAttachments(post){
    const attachments = getPostAttachments(post);
    if(!attachments.length) return "";
    const max = 4;
    const visible = attachments.slice(0, max);
    const hiddenCount = Math.max(0, attachments.length - max);
    return `
      <div class="post-attachments">
        <div class="post-attachments-head">
          <strong>Adjuntos</strong>
          <span>${attachments.length} archivo(s) / enlace(s)</span>
        </div>
        <div class="post-attachments-grid ${visible.length === 1 ? 'single' : ''}">
          ${visible.map((att, i) => renderAttachmentCard(att, i, hiddenCount)).join("")}
        </div>
      </div>
    `;
  }

  function ensureAttachmentViewer(){
    let viewer = document.getElementById("attachmentViewer");
    if(viewer) return viewer;
    viewer = document.createElement("div");
    viewer.id = "attachmentViewer";
    viewer.className = "modal-overlay hidden attachment-viewer";
    viewer.innerHTML = `<div class="modal-card attachment-viewer-card">
      <div class="modal-head">
        <div>
          <span class="modal-kicker">Adjunto del aviso</span>
          <h2 id="attachmentViewerTitle">Vista previa</h2>
          <p id="attachmentViewerMeta"></p>
        </div>
        <button class="modal-close" id="attachmentViewerClose" type="button" aria-label="Cerrar">×</button>
      </div>
      <div id="attachmentViewerBody" class="attachment-viewer-body"></div>
      <div class="modal-actions attachment-viewer-actions">
        <button class="btn secondary" id="attachmentPrevBtn" type="button">Anterior</button>
        <a class="btn" id="attachmentOpenBtn" target="_blank" rel="noopener">Abrir / descargar</a>
        <button class="btn secondary" id="attachmentNextBtn" type="button">Siguiente</button>
      </div>
    </div>`;
    document.body.appendChild(viewer);
    viewer.addEventListener("click", e => { if(e.target === viewer) closeAttachmentViewer(); });
    viewer.querySelector("#attachmentViewerClose").addEventListener("click", closeAttachmentViewer);
    return viewer;
  }

  let viewerState = { attachments: [], index: 0 };

  function closeAttachmentViewer(){
    const viewer = document.getElementById("attachmentViewer");
    viewer?.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }

  function openAttachmentViewer(attachments, index){
    viewerState = { attachments, index };
    renderAttachmentViewer();
  }

  function renderAttachmentViewer(){
    const viewer = ensureAttachmentViewer();
    const attachments = viewerState.attachments;
    const att = attachments[viewerState.index];
    if(!att) return;
    viewer.querySelector("#attachmentViewerTitle").textContent = att.name || typeLabel(att.type);
    viewer.querySelector("#attachmentViewerMeta").textContent = `${typeLabel(att.type)} · ${viewerState.index + 1} de ${attachments.length}`;
    const body = viewer.querySelector("#attachmentViewerBody");
    const open = viewer.querySelector("#attachmentOpenBtn");
    open.href = att.url || "#";
    open.classList.toggle("hidden", !att.url);

    if(att.type === "image"){
      body.innerHTML = `<img class="viewer-image" src="${A().escapeHTML(att.url)}" alt="${A().escapeHTML(att.name || 'Imagen')}">`;
    } else if(att.type === "video" && canPlayVideo(att)){
      body.innerHTML = `<video class="viewer-video" src="${A().escapeHTML(att.url)}" controls></video>`;
    } else if(att.type === "document" && isPdf(att)){
      body.innerHTML = `<iframe class="viewer-pdf" src="${A().escapeHTML(att.url)}" title="${A().escapeHTML(att.name || 'PDF')}"></iframe>`;
    } else {
      body.innerHTML = `<div class="viewer-file-card">
        <span>${typeIcon(att.type)}</span>
        <h3>${A().escapeHTML(att.name || typeLabel(att.type))}</h3>
        <p>Este archivo o enlace se abre en una pestaña nueva.</p>
      </div>`;
    }

    const prev = viewer.querySelector("#attachmentPrevBtn");
    const next = viewer.querySelector("#attachmentNextBtn");
    prev.disabled = attachments.length <= 1;
    next.disabled = attachments.length <= 1;
    prev.onclick = () => { viewerState.index = (viewerState.index - 1 + attachments.length) % attachments.length; renderAttachmentViewer(); };
    next.onclick = () => { viewerState.index = (viewerState.index + 1) % attachments.length; renderAttachmentViewer(); };

    viewer.classList.remove("hidden");
    document.body.classList.add("modal-open");
  }

  function bindAttachmentEvents(card, post){
    const attachments = getPostAttachments(post);
    card.querySelectorAll("[data-open-attachment]").forEach(btn => {
      btn.addEventListener("click", () => openAttachmentViewer(attachments, Number(btn.dataset.openAttachment)));
    });
  }

  async function renderFeed(){
    const feed = A().$('#postsFeed');
    if(!feed) return;
    const includeRegistered = !!A().currentUser;
    let posts = await A().db.getPosts({includeRegistered});
    // En el muro público solo deben aparecer avisos realmente publicados.
    // Borradores, programados, archivados y papelera quedan solo para el panel admin.
    posts = posts.filter(p => (p.status || "published") === "published");
    posts = posts.filter(canViewPost);
    if(activeCategory !== "Todos") posts = posts.filter(p => p.category === activeCategory);
    if(!posts.length){ feed.innerHTML = `<div class="empty">No hay avisos en esta categoría.</div>`; return; }
    feed.innerHTML = "";
    for(const post of posts){
      const comments = await A().db.getComments(post.id);
      const reactions = await A().db.getReactions(post.id);
      const counts = reactionCounts(reactions);
      const userReaction = reactions.find(r => r.userId === A().currentUser?.uid);
      const card = document.createElement('article');
      card.className = 'post-card';
      card.innerHTML = `
        <div class="post-head">
          <div class="post-author">
            ${A().avatarHTML({name:post.authorName, photoURL:post.authorPhoto})}
            <div><strong>${A().escapeHTML(post.authorName || 'Escuela')}</strong><div class="post-meta">${A().fmtDate(post.createdAt)} · ${A().escapeHTML(post.category || 'Aviso')}</div></div>
          </div>
          <div class="post-tags">
            ${post.pinned ? '<span class="tag pinned">📌 Fijado</span>' : ''}
            ${post.urgent ? '<span class="tag urgent">⚠️ Urgente</span>' : ''}
            ${post.visibility === 'registered' ? '<span class="tag lock">🔒 Registrados</span>' : '<span class="tag">🌎 Público</span>'}
          </div>
        </div>
        <div class="post-title"><h2>${A().escapeHTML(post.title)}</h2></div>
        <div class="post-content">${A().escapeHTML(post.content || '')}</div>
        ${renderPostAttachments(post)}
        <div class="post-tags">
          ${!post.allowComments ? '<span class="tag lock">Comentarios cerrados</span>' : ''}
          ${!post.allowReactions ? '<span class="tag lock">Reacciones cerradas</span>' : ''}
        </div>
        <div class="post-actions" data-reactions></div>
        <div class="comments" data-comments></div>
      `;
      feed.appendChild(card);
      bindAttachmentEvents(card, post);
      renderReactions(card.querySelector('[data-reactions]'), post, counts, userReaction);
      renderComments(card.querySelector('[data-comments]'), post, comments);
    }
  }

  function renderReactions(node, post, counts, userReaction){
    if(!post.allowReactions){ node.innerHTML = `<span class="post-meta">Reacciones desactivadas por el administrador.</span>`; return; }
    const logged = !!A().currentUser;
    const active = A().isActive();
    const buttons = window.SCHOOL_CONFIG.reactionTypes.map(r => `
      <button class="reaction-btn" data-react="${r.key}" ${(!logged || !active) ? 'disabled' : ''}>${r.label} <strong>${counts[r.key] || 0}</strong>${userReaction?.type === r.key ? ' · tú' : ''}</button>
    `).join('');
    node.innerHTML = `${buttons}${!logged ? '<span class="post-meta">Inicia sesión para reaccionar.</span>' : ''}${logged && !active ? '<span class="post-meta">Usuario bloqueado.</span>' : ''}`;
    node.querySelectorAll('[data-react]').forEach(btn => btn.addEventListener('click', async ()=>{
      await A().db.setReaction(post.id, btn.dataset.react, A().currentUser);
      renderFeed();
    }));
  }

  function renderComments(node, post, comments){
    if(!post.allowComments){ node.innerHTML = `<span class="post-meta">Comentarios desactivados en este aviso.</span>`; return; }
    const logged = !!A().currentUser;
    const active = A().isActive();
    node.innerHTML = `
      <strong>Comentarios (${comments.length})</strong>
      <div>${comments.map(c => `
        <div class="comment">
          ${A().avatarHTML({name:c.userName, photoURL:c.userPhoto})}
          <div class="comment-body"><strong>${A().escapeHTML(c.userName || 'Usuario')}</strong><span class="post-meta"> · ${A().fmtDate(c.createdAt)}</span><p>${A().escapeHTML(c.text)}</p></div>
          ${A().isAdmin() ? `<button class="btn small danger" data-delete-comment="${A().escapeHTML(c.id)}">Eliminar</button>` : ''}
        </div>`).join('')}</div>
      ${logged && active ? `<form class="comment-form" data-comment-form><textarea name="text" placeholder="Escribe un comentario..." required></textarea><button class="btn small">Comentar</button></form>` : logged ? '<span class="post-meta">Usuario bloqueado: no puede comentar.</span>' : '<span class="post-meta">Inicia sesión para comentar.</span>'}
    `;
    node.querySelectorAll('[data-delete-comment]').forEach(btn => btn.addEventListener('click', async ()=>{
      if(confirm('¿Eliminar comentario?')){ await A().db.deleteComment(btn.dataset.deleteComment); renderFeed(); }
    }));
    const form = node.querySelector('[data-comment-form]');
    form?.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const text = form.text.value.trim();
      if(!text) return;
      await A().db.addComment(post.id, text, A().currentUser);
      renderFeed();
    });
  }

  function renderCategories(){
    const box = A().$('#categoryFilters');
    if(!box) return;
    const cats = ["Todos", ...window.SCHOOL_CONFIG.categories];
    box.innerHTML = cats.map(c=>`<button class="${activeCategory===c?'active':''}" data-cat="${A().escapeHTML(c)}">${A().escapeHTML(c)}</button>`).join('');
    box.querySelectorAll('[data-cat]').forEach(btn => btn.addEventListener('click', ()=>{
      activeCategory = btn.dataset.cat;
      renderCategories();
      renderFeed();
    }));
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    if(!A().$('#postsFeed')) return;
    renderCategories();
    A().onAuthChange(renderFeed);
  });
})();
