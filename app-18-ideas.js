/* ================= TABLERO DE IDEAS Y MEJORAS (2026-09-19) =================
   Pedido del usuario: "necesitamos un feedback board a Dusty". Contexto: Google
   rechazó el acceso a producción el 2026-09-18 ("requires more testing") y lo que
   mira en la segunda vuelta es feedback REAL de los testers e iteración sobre él.
   "Reportar un problema" (feedback/ en app-06) es un buzón ciego: el tester manda
   y no ve nada más. Esto es un tablero PÚBLICO: cualquiera con cuenta propone una
   idea o cuenta un problema, ve lo de los demás, vota 👍, y el dueño le pone estado
   (Recibida / En camino / Lista / No por ahora) y responde. Vive como tarjeta del
   Dashboard ("Ideas y mejoras") y se abre como hoja a pantalla completa, igual que
   Cotizaciones (svcSheet en app-15).

   DATOS: colección raíz ideas/{id} — una idea por doc:
     {kind:'idea'|'bug', title, body, uid, author, lang, createdAt(ISO), voters:[uid],
      status:'new'|'planned'|'done'|'declined', reply, repliedAt, updatedAt}
   NO se guarda el email: lo leen todos los testers, y el nombre que se muestra es
   ideaAuthorName() (displayName, o lo que hay antes de la @). Los votos son la lista
   de uids en `voters` (arrayUnion/arrayRemove: atómico e idempotente); el conteo es
   voters.length — a la escala de un tablero de testers (decenas, no millones) no
   hace falta un contador aparte, y las reglas pueden verificar que cada quien solo
   se agrega o se quita a SÍ MISMO.
   REGLAS (firestore.rules, match /ideas): leer = cualquier sesión; crear/votar =
   cuenta real (no anónima de prueba); estado/respuesta = solo IDEAS_ADMIN_EMAILS;
   borrar = el autor o el dueño.

   Suscripción en vivo (onSnapshot) SOLO mientras la hoja está abierta; al cerrarla
   se corta. La tarjeta del Dashboard usa la última foto en memoria (o un get()
   único al arrancar con sesión) para mostrar "N nuevas" desde la última visita. */

const IDEAS_ADMIN_EMAILS = ['sergioleon47@hotmail.com'];
const IDEA_KINDS = ['idea', 'bug'];
const IDEA_STATUSES = ['new', 'planned', 'done', 'declined'];
const IDEAS_MAX_TITLE = 120, IDEAS_MAX_BODY = 1000, IDEAS_MAX_REPLY = 1000;
const IDEAS_POST_COOLDOWN_MS = 60 * 1000;

let showIdeasSheet = false, showIdeaModal = false;
let ideaList = [], ideasLoading = false, ideasError = false, ideasLoadedOnce = false;
let ideasSort = 'top', ideasStatusFilter = 'all';
let ideaDraft = null, ideaModalError = '', ideaSubmitting = false, ideaLastPostAt = 0;
let ideaReplyOpenId = null, ideaBusyId = null;
let ideasUnsub = null, ideasPrefetchStarted = false;

/* ---------- ayudantes puros (con pruebas en app-ideas.test.js) ---------- */
function ideasIsAdmin(user){
  return !!(user && !user.isAnonymous && user.email && IDEAS_ADMIN_EMAILS.includes(String(user.email).toLowerCase()));
}
/* Nombre público del autor: lo que hay antes de la @ si no tiene displayName. Nunca
   el email entero — lo ven los demás testers. */
function ideaAuthorName(user){
  if(!user) return '';
  let n = String(user.displayName || '').trim();
  if(!n && user.email) n = String(user.email).split('@')[0];
  return n.slice(0, 40);
}
function ideaVoteCount(idea){ return Array.isArray(idea && idea.voters) ? idea.voters.length : 0; }
function ideaVotedBy(idea, uid){ return !!(uid && Array.isArray(idea && idea.voters) && idea.voters.includes(uid)); }
/* Orden y filtro de la lista: 'top' = más votadas (empate → más nueva primero);
   'new' = más recientes. El filtro de estado 'all' muestra todo salvo las
   descartadas ('declined'), que solo aparecen al elegirlas a propósito — un
   tablero lleno de "no por ahora" desanima a proponer. */
function ideasSorted(list, sort, statusFilter){
  const arr = (list || []).filter(i => i && (statusFilter === 'all' ? i.status !== 'declined' : i.status === statusFilter));
  arr.sort((a, b) => {
    if(sort === 'top'){
      const d = ideaVoteCount(b) - ideaVoteCount(a);
      if(d) return d;
    }
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });
  return arr;
}
/* Cuántas ideas de OTROS se publicaron después de la última visita (para la
   tarjeta del Dashboard). Sin visita previa no se cuenta nada: la primera vez la
   tarjeta invita, no presiona. */
function ideasNewCount(list, seenIso, myUid){
  if(!seenIso) return 0;
  return (list || []).filter(i => i && i.uid !== myUid && String(i.createdAt || '') > seenIso).length;
}
function ideaStatusClass(st){ return st === 'done' ? 'ok' : st === 'planned' ? 'warn' : st === 'declined' ? 'off' : ''; }

/* ---------- Firestore ---------- */
function ideasCol(){ return firebase.firestore().collection('ideas'); }
function ideasCanUseCloud(){ return typeof firebase !== 'undefined' && !!currentUser; }
function ideasSeenIso(){ try{ return localStorage.getItem('patron_ideas_seen') || ''; }catch(e){ return ''; } }
function ideasMarkSeen(){ try{ localStorage.setItem('patron_ideas_seen', new Date().toISOString()); }catch(e){} }
function ideasApplySnapshot(snap){
  ideaList = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
  ideasLoading = false; ideasError = false; ideasLoadedOnce = true;
}
/* Suscripción viva mientras la hoja está abierta. Idempotente: se llama desde el
   render de la hoja para cubrir el arranque (la sesión llega un momento después
   de que el usuario ya abrió la hoja). */
function ideasEnsureSub(){
  if(ideasUnsub || !ideasCanUseCloud()) return;
  ideasLoading = !ideasLoadedOnce; ideasError = false;
  try{
    ideasUnsub = ideasCol().orderBy('createdAt', 'desc').limit(300).onSnapshot(snap => {
      ideasApplySnapshot(snap);
      render();
    }, err => {
      console.error('[Dusty] ideas subscribe failed:', err);
      ideasLoading = false; ideasError = true;
      render();
    });
  }catch(e){
    console.error('[Dusty] ideas subscribe threw:', e);
    ideasLoading = false; ideasError = true;
  }
}
function ideasStopSub(){ if(ideasUnsub){ try{ ideasUnsub(); }catch(e){} ideasUnsub = null; } }
/* Una lectura al arrancar con sesión, para que la tarjeta del Dashboard pueda decir
   "N nuevas" sin abrir la hoja. Una sola vez por carga de página. */
function ideasPrefetch(){
  if(ideasPrefetchStarted || ideasLoadedOnce || !ideasCanUseCloud() || isOffline) return;
  ideasPrefetchStarted = true;
  ideasCol().orderBy('createdAt', 'desc').limit(300).get().then(snap => {
    if(ideasUnsub) return; // la hoja ya está viva, su foto manda
    ideasApplySnapshot(snap);
    render();
  }).catch(err => { console.error('[Dusty] ideas prefetch failed:', err); });
}

/* ---------- abrir / cerrar ---------- */
function openIdeasSheet(){
  ideaReplyOpenId = null;
  svcShow(() => { showIdeasSheet = true; });
  ideasEnsureSub();
}
function closeIdeasSheet(){
  ideasMarkSeen();
  ideasStopSub();
  ideaReplyOpenId = null;
  svcShow(() => { showIdeasSheet = false; });
}
/* Proponer/votar pide cuenta real: la cuenta anónima de prueba no puede escribir en
   ideas/ (regla), y un tablero público con autores sin nombre no sirve. */
function ideasRequireRealAccount(){
  if(!currentUser){ openAuthModal(t('ideas_signin_note')); return false; }
  if(currentUser.isAnonymous){ openUpgradeModal(t('ideas_signin_note')); return false; }
  return true;
}
function openIdeaModal(){
  if(!ideasRequireRealAccount()) return;
  ideaDraft = { kind: 'idea', title: '', body: '' };
  ideaModalError = ''; ideaSubmitting = false;
  showIdeaModal = true; render();
}
function closeIdeaModal(){ showIdeaModal = false; ideaDraft = null; ideaModalError = ''; render(); }
function readIdeaDraftFromDom(){
  if(!ideaDraft) return;
  const ti = document.getElementById('idea-title'), bo = document.getElementById('idea-body');
  if(ti) ideaDraft.title = ti.value;
  if(bo) ideaDraft.body = bo.value;
}

/* ---------- escrituras ---------- */
function submitIdea(){
  if(!ideaDraft || ideaSubmitting) return;
  if(!ideasRequireRealAccount()) return;
  readIdeaDraftFromDom();
  const title = ideaDraft.title.trim().slice(0, IDEAS_MAX_TITLE);
  const body = ideaDraft.body.trim().slice(0, IDEAS_MAX_BODY);
  if(title.length < 3){ ideaModalError = t('ideas_err_title'); render(); return; }
  if(Date.now() - ideaLastPostAt < IDEAS_POST_COOLDOWN_MS){ ideaModalError = t('ideas_err_cooldown'); render(); return; }
  ideaSubmitting = true; ideaModalError = ''; render();
  const doc = {
    kind: IDEA_KINDS.includes(ideaDraft.kind) ? ideaDraft.kind : 'idea',
    title, body, uid: currentUser.uid, author: ideaAuthorName(currentUser),
    lang: uiLang === 'es' ? 'es' : 'en', createdAt: new Date().toISOString(),
    voters: [currentUser.uid], status: 'new'
  };
  ideasCol().add(doc).then(() => {
    ideaLastPostAt = Date.now();
    showIdeaModal = false; ideaDraft = null; ideaSubmitting = false;
    ideasSort = 'new'; ideasStatusFilter = 'all';
    showToast(t('ideas_posted'), 'success');
    if(typeof hapticAviso === 'function') try{ hapticAviso(); }catch(e){}
    render();
  }).catch(err => {
    console.error('[Dusty] idea post failed:', err);
    ideaSubmitting = false; ideaModalError = t('ideas_err_send'); render();
  });
}
function toggleIdeaVote(id){
  if(!ideasRequireRealAccount()) return;
  const idea = ideaList.find(i => i.id === id);
  if(!idea || ideaBusyId === id) return;
  const uid = currentUser.uid;
  const FV = firebase.firestore.FieldValue;
  const voted = ideaVotedBy(idea, uid);
  // Optimista: el 👍 cambia al toque; la foto de Firestore lo confirma o lo revierte.
  idea.voters = voted ? (idea.voters || []).filter(u => u !== uid) : (idea.voters || []).concat([uid]);
  ideaBusyId = id; render();
  ideasCol().doc(id).update({ voters: voted ? FV.arrayRemove(uid) : FV.arrayUnion(uid) }).catch(err => {
    console.error('[Dusty] idea vote failed:', err);
    idea.voters = voted ? (idea.voters || []).concat([uid]) : (idea.voters || []).filter(u => u !== uid);
    showToast(t('ideas_err_send'), 'error');
  }).then(() => { ideaBusyId = null; render(); });
}
function setIdeaStatus(id, status){
  if(!ideasIsAdmin(currentUser) || !IDEA_STATUSES.includes(status)) return;
  const idea = ideaList.find(i => i.id === id);
  if(!idea || idea.status === status) return;
  const prev = idea.status;
  idea.status = status; render();
  ideasCol().doc(id).update({ status, updatedAt: new Date().toISOString() }).catch(err => {
    console.error('[Dusty] idea status failed:', err);
    idea.status = prev; showToast(t('ideas_err_send'), 'error'); render();
  });
}
function saveIdeaReply(id){
  if(!ideasIsAdmin(currentUser)) return;
  const ta = document.getElementById('idea-reply-' + id);
  const reply = ta ? ta.value.trim().slice(0, IDEAS_MAX_REPLY) : '';
  const idea = ideaList.find(i => i.id === id);
  if(!idea) return;
  const now = new Date().toISOString();
  idea.reply = reply; idea.repliedAt = reply ? now : null;
  ideaReplyOpenId = null; render();
  ideasCol().doc(id).update({ reply, repliedAt: reply ? now : null, updatedAt: now }).catch(err => {
    console.error('[Dusty] idea reply failed:', err);
    showToast(t('ideas_err_send'), 'error');
  });
}
function deleteIdea(id){
  const idea = ideaList.find(i => i.id === id);
  if(!idea || !currentUser) return;
  if(!(idea.uid === currentUser.uid || ideasIsAdmin(currentUser))) return;
  if(!confirm(t('ideas_delete_confirm'))) return;
  ideaList = ideaList.filter(i => i.id !== id); render();
  ideasCol().doc(id).delete().catch(err => {
    console.error('[Dusty] idea delete failed:', err);
    showToast(t('ideas_err_send'), 'error');
  });
}

/* ---------- tarjeta del Dashboard ---------- */
function ideasTileHtml(){
  ideasPrefetch();
  const n = ideasNewCount(ideaList, ideasSeenIso(), currentUser && currentUser.uid);
  const total = ideaList.filter(i => i.status !== 'declined').length;
  const done = ideaList.filter(i => i.status === 'done').length;
  let sub = t('ideas_tile_sub');
  if(ideasLoadedOnce && total > 0){
    sub = n > 0 ? t('ideas_tile_new').replace('{n}', String(n))
        : t('ideas_tile_counts').replace('{n}', String(total)).replace('{done}', String(done));
  }
  return `
    <button type="button" class="dash-tile t2" id="btn-ideas-board">
      <span class="dash-tile-icon" aria-hidden="true">💡</span>
      <span class="dash-tile-title">${t('ideas_title')}</span>
      <span class="dash-tile-sub">${sub}</span>
      ${n > 0 ? `<span class="dash-tile-count">${n > 99 ? '99+' : n}</span>` : '<span class="dash-tile-chev">›</span>'}
    </button>`;
}

/* ---------- hoja ---------- */
function ideaCardHtml(idea){
  const me = currentUser ? currentUser.uid : null;
  const admin = ideasIsAdmin(currentUser);
  const voted = ideaVotedBy(idea, me);
  const st = IDEA_STATUSES.includes(idea.status) ? idea.status : 'new';
  const mine = !!(me && idea.uid === me);
  const body = String(idea.body || '').trim();
  return `
    <article class="idea-card ${st === 'done' ? 'is-done' : ''}" data-idea-id="${escapeHtml(idea.id)}">
      <button type="button" class="idea-vote ${voted ? 'on' : ''}" data-idea-vote="${escapeHtml(idea.id)}" aria-pressed="${voted}" aria-label="${t('ideas_vote_aria')}" ${ideaBusyId === idea.id ? 'disabled' : ''}>
        <span class="idea-vote-ic" aria-hidden="true">👍</span><b>${ideaVoteCount(idea)}</b>
      </button>
      <div class="idea-main">
        <div class="idea-tags">
          <span class="idea-kind ${idea.kind === 'bug' ? 'bug' : ''}">${idea.kind === 'bug' ? '🐞 ' + t('ideas_kind_bug') : '💡 ' + t('ideas_kind_idea')}</span>
          <span class="dash-tile-badge svc-tag idea-st ${ideaStatusClass(st)}">${t('ideas_st_' + st)}</span>
        </div>
        <h4 class="idea-title">${escapeHtml(idea.title || '')}</h4>
        ${body ? `<p class="idea-body">${escapeHtml(body).replace(/\n/g, '<br>')}</p>` : ''}
        <div class="idea-meta">${t('ideas_by').replace('{name}', escapeHtml(idea.author || '—'))} · ${timeAgo(idea.createdAt)}${mine || admin ? ` · <button type="button" class="idea-link" data-idea-delete="${escapeHtml(idea.id)}">${t('ideas_delete')}</button>` : ''}</div>
        ${idea.reply ? `
        <div class="idea-reply">
          <b>${t('ideas_reply_from')}</b>
          <span>${escapeHtml(idea.reply).replace(/\n/g, '<br>')}</span>
        </div>` : ''}
        ${admin ? `
        <div class="idea-admin">
          <div class="idea-admin-row">
            ${IDEA_STATUSES.map(s => `<button type="button" class="idea-chip ${st === s ? 'on' : ''}" data-idea-status="${escapeHtml(idea.id)}:${s}">${t('ideas_st_' + s)}</button>`).join('')}
            <button type="button" class="idea-chip ghost" data-idea-reply-toggle="${escapeHtml(idea.id)}">${idea.reply ? t('ideas_reply_edit') : t('ideas_reply_btn')}</button>
          </div>
          ${ideaReplyOpenId === idea.id ? `
          <textarea id="idea-reply-${escapeHtml(idea.id)}" rows="3" maxlength="${IDEAS_MAX_REPLY}" placeholder="${t('ideas_reply_ph')}">${escapeHtml(idea.reply || '')}</textarea>
          <div class="idea-admin-row">
            <button type="button" class="btn btn-ghost btn-sm" data-idea-reply-cancel="${escapeHtml(idea.id)}">${t('btn_cancel')}</button>
            <button type="button" class="btn btn-primary btn-sm" data-idea-reply-save="${escapeHtml(idea.id)}">${t('ideas_reply_save')}</button>
          </div>` : ''}
        </div>` : ''}
      </div>
    </article>`;
}
function ideasSheet(){
  ideasEnsureSub();
  const canRead = ideasCanUseCloud();
  let list = '';
  if(!canRead){
    list = `<div class="idea-empty"><div class="idea-empty-ic">🔒</div><p>${t('ideas_signin_note')}</p><button type="button" class="btn btn-primary" id="btn-ideas-signin">${t('ideas_signin_btn')}</button></div>`;
  }else if(ideasLoading){
    list = `<div class="idea-empty"><p>${t('ideas_loading')}</p></div>`;
  }else if(ideasError){
    list = `<div class="idea-empty"><div class="idea-empty-ic">⚠️</div><p>${t('ideas_error')}</p><button type="button" class="btn btn-ghost btn-sm" id="btn-ideas-retry">${t('ideas_retry')}</button></div>`;
  }else{
    const rows = ideasSorted(ideaList, ideasSort, ideasStatusFilter);
    list = rows.length ? rows.map(ideaCardHtml).join('')
      : `<div class="idea-empty"><div class="idea-empty-ic">💡</div><p>${ideaList.length ? t('ideas_empty_filter') : t('ideas_empty')}</p></div>`;
  }
  const counts = { all: ideaList.filter(i => i.status !== 'declined').length };
  IDEA_STATUSES.forEach(s => { counts[s] = ideaList.filter(i => i.status === s).length; });
  const fchip = (k, label) => `<button type="button" class="idea-chip ${ideasStatusFilter === k ? 'on' : ''}" data-ideas-filter="${k}" aria-pressed="${ideasStatusFilter === k}">${label}${counts[k] ? ` <span>${counts[k]}</span>` : ''}</button>`;
  const body = `
    <button class="btn btn-primary" id="btn-idea-new" style="width:100%;margin:4px 0 12px;">${t('ideas_new_btn')}</button>
    ${canRead ? `
    <div class="idea-toolbar">
      <div class="idea-sort" role="group" aria-label="${t('ideas_sort_aria')}">
        <button type="button" class="${ideasSort === 'top' ? 'on' : ''}" data-ideas-sort="top" aria-pressed="${ideasSort === 'top'}">${t('ideas_sort_top')}</button>
        <button type="button" class="${ideasSort === 'new' ? 'on' : ''}" data-ideas-sort="new" aria-pressed="${ideasSort === 'new'}">${t('ideas_sort_new')}</button>
      </div>
      <div class="idea-filters">
        ${fchip('all', t('ideas_f_all'))}${fchip('new', t('ideas_st_new'))}${fchip('planned', t('ideas_st_planned'))}${fchip('done', t('ideas_st_done'))}${counts.declined ? fchip('declined', t('ideas_st_declined')) : ''}
      </div>
    </div>` : ''}
    <div class="idea-list">${list}</div>
    ${canRead && ideaList.length ? `<div class="helper-note" style="margin-top:12px;">${t('ideas_foot')}</div>` : ''}`;
  return svcSheet('ideas-sheet-overlay', t('ideas_title'), body, 'btn-close-ideas-sheet');
}

/* ---------- modal: proponer ---------- */
function ideaModal(){
  const d = ideaDraft || { kind: 'idea', title: '', body: '' };
  return `
  <div class="overlay" id="idea-overlay">
    <div class="modal">
      <h3 class="navy">${t('ideas_new_title')}</h3>
      <div class="sub">${t('ideas_new_sub')}</div>
      <div class="idea-kinds">
        ${IDEA_KINDS.map(k => `<button type="button" class="idea-chip big ${d.kind === k ? 'on' : ''}" data-idea-kind="${k}" aria-pressed="${d.kind === k}">${k === 'bug' ? '🐞 ' + t('ideas_kind_bug') : '💡 ' + t('ideas_kind_idea')}</button>`).join('')}
      </div>
      <div class="field">
        <label for="idea-title">${t('ideas_field_title')}</label>
        <input id="idea-title" type="text" maxlength="${IDEAS_MAX_TITLE}" value="${escapeHtml(d.title)}" placeholder="${t(d.kind === 'bug' ? 'ideas_ph_title_bug' : 'ideas_ph_title_idea')}" autocomplete="off">
      </div>
      <div class="field">
        <label for="idea-body">${t('ideas_field_body')}</label>
        <textarea id="idea-body" rows="4" maxlength="${IDEAS_MAX_BODY}" placeholder="${t(d.kind === 'bug' ? 'ideas_ph_body_bug' : 'ideas_ph_body_idea')}">${escapeHtml(d.body)}</textarea>
      </div>
      ${ideaModalError ? `<div class="scan-error" role="alert" style="margin-bottom:12px;">${escapeHtml(ideaModalError)}</div>` : ''}
      <div class="helper-note" style="margin-top:4px;">${t('ideas_public_note')}</div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-cancel-idea" ${ideaSubmitting ? 'disabled' : ''}>${t('btn_cancel')}</button>
        <button class="btn btn-primary" id="btn-submit-idea" ${ideaSubmitting ? 'disabled' : ''}>${ideaSubmitting ? t('auth_loading') : t('ideas_publish')}</button>
      </div>
    </div>
  </div>`;
}

/* ---------- eventos ---------- */
function attachIdeasEvents(){
  const g = (id) => document.getElementById(id);
  const on = (id, fn) => { const el = g(id); if(el) el.onclick = fn; };
  const overlayClose = (id, fn) => { const ov = g(id); if(ov) ov.onmousedown = (e) => { if(e.target === ov) fn(); }; };

  on('btn-ideas-board', openIdeasSheet);
  overlayClose('ideas-sheet-overlay', closeIdeasSheet);
  on('btn-close-ideas-sheet', closeIdeasSheet);
  on('btn-idea-new', openIdeaModal);
  on('btn-ideas-signin', () => openAuthModal(t('ideas_signin_note')));
  on('btn-ideas-retry', () => { ideasStopSub(); ideasEnsureSub(); render(); });
  document.querySelectorAll('[data-ideas-sort]').forEach(el => { el.onclick = () => { ideasSort = el.dataset.ideasSort; render(); }; });
  document.querySelectorAll('[data-ideas-filter]').forEach(el => { el.onclick = () => { ideasStatusFilter = el.dataset.ideasFilter; render(); }; });
  document.querySelectorAll('[data-idea-vote]').forEach(el => { el.onclick = () => toggleIdeaVote(el.dataset.ideaVote); });
  document.querySelectorAll('[data-idea-delete]').forEach(el => { el.onclick = () => deleteIdea(el.dataset.ideaDelete); });
  document.querySelectorAll('[data-idea-status]').forEach(el => { el.onclick = () => { const [id, st] = el.dataset.ideaStatus.split(':'); setIdeaStatus(id, st); }; });
  document.querySelectorAll('[data-idea-reply-toggle]').forEach(el => { el.onclick = () => { const id = el.dataset.ideaReplyToggle; ideaReplyOpenId = ideaReplyOpenId === id ? null : id; render(); }; });
  document.querySelectorAll('[data-idea-reply-cancel]').forEach(el => { el.onclick = () => { ideaReplyOpenId = null; render(); }; });
  document.querySelectorAll('[data-idea-reply-save]').forEach(el => { el.onclick = () => saveIdeaReply(el.dataset.ideaReplySave); });

  /* Modal de proponer */
  overlayClose('idea-overlay', closeIdeaModal);
  on('btn-cancel-idea', closeIdeaModal);
  on('btn-submit-idea', submitIdea);
  document.querySelectorAll('[data-idea-kind]').forEach(el => { el.onclick = () => { readIdeaDraftFromDom(); if(ideaDraft) ideaDraft.kind = el.dataset.ideaKind; ideaModalError = ''; render(); }; });
  const ti = g('idea-title');
  if(ti) ti.onkeydown = (e) => { if(e.key === 'Enter'){ e.preventDefault(); const bo = g('idea-body'); if(bo) bo.focus(); } };
}
