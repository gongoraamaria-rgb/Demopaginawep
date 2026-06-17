
(function(){
  const A = () => window.App;
  function renderGate(){
    const gate = A().$('#usersGate');
    const content = A().$('#usersContent');
    if(!gate || !content) return false;
    if(!A().currentUser){
      gate.innerHTML = `<div class="notice danger"><strong>Acceso protegido.</strong><br>Inicia sesión como super admin para gestionar usuarios.</div>`;
      content.classList.add('hidden');
      return false;
    }
    if(!A().isSuperAdmin()){
      gate.innerHTML = `<div class="notice danger"><strong>Solo super admin.</strong><br>Los admins publican avisos; solo el super admin cambia roles y bloquea usuarios.</div>`;
      content.classList.add('hidden');
      return false;
    }
    gate.innerHTML = '';
    content.classList.remove('hidden');
    return true;
  }
  async function renderUsers(){
    const table = A().$('#usersTable');
    if(!table) return;
    if(!renderGate()) return;
    const users = await A().db.getUsers();
    table.innerHTML = `
      <div class="table-wrap"><table>
        <thead><tr><th>Usuario</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Último acceso</th><th>Acciones</th></tr></thead>
        <tbody>${users.map(u=>`
          <tr>
            <td><div class="post-author">${A().avatarHTML(u)}<strong>${A().escapeHTML(u.name||'Usuario')}</strong></div></td>
            <td>${A().escapeHTML(u.email||'')}</td>
            <td><span class="role-badge ${A().escapeHTML(u.role)}">${A().roleLabel(u.role)}</span></td>
            <td>${u.status === 'blocked' ? '<span class="role-badge blocked">Bloqueado</span>' : '<span class="role-badge user">Activo</span>'}</td>
            <td>${A().fmtDate(u.lastLogin)}</td>
            <td><div class="actions">
              <select data-role="${A().escapeHTML(u.uid)}">
                <option value="user" ${u.role==='user'?'selected':''}>usuario</option>
                <option value="admin" ${u.role==='admin'?'selected':''}>admin</option>
                <option value="super_admin" ${u.role==='super_admin'?'selected':''}>super_admin</option>
              </select>
              <select data-status="${A().escapeHTML(u.uid)}">
                <option value="active" ${u.status!=='blocked'?'selected':''}>activo</option>
                <option value="blocked" ${u.status==='blocked'?'selected':''}>bloqueado</option>
              </select>
            </div></td>
          </tr>`).join('')}</tbody>
      </table></div>`;
    table.querySelectorAll('[data-role]').forEach(sel => sel.addEventListener('change', async ()=>{
      if(sel.dataset.role === A().currentUser.uid && sel.value !== 'super_admin'){
        alert('No te quites tu propio rol de super admin desde aquí. Cambia primero otro super admin.'); renderUsers(); return;
      }
      await A().db.updateUser(sel.dataset.role, {role:sel.value});
      renderUsers();
    }));
    table.querySelectorAll('[data-status]').forEach(sel => sel.addEventListener('change', async ()=>{
      if(sel.dataset.status === A().currentUser.uid && sel.value === 'blocked'){
        alert('No puedes bloquearte a ti mismo.'); renderUsers(); return;
      }
      await A().db.updateUser(sel.dataset.status, {status:sel.value});
      renderUsers();
    }));
  }
  document.addEventListener('DOMContentLoaded', ()=>{
    if(!A().$('#usersTable')) return;
    A().onAuthChange(renderUsers);
  });
})();
