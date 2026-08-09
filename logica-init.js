// LISTENERS
// ═══════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('modal-overlay');
  if(overlay) overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  // O modal de Criação/Edição de Personagem (o "wizard") NÃO fecha ao
  // clicar fora dele — vários usuários reclamaram de perder o progresso
  // (várias etapas preenchidas) ao clicar sem querer na área escura ao
  // redor. Ele só fecha pelos botões "Cancelar" de cada passo.
});

document.addEventListener('keydown', e => {
  // Mesmo motivo acima: Esc não fecha o wizard de Personagem, só o modal
  // genérico (itens, habilidades, etc.), pra evitar perda de progresso.
  if (e.key === 'Escape') { closeModal(); }
});

// ═══════════════════════════════════════
// RENDER GERAL
// ═══════════════════════════════════════
// ═══════════════════════════════════════
// NOTIFICAÇÃO DE SUBIDA DE NÍVEL (TOAST)
// ═══════════════════════════════════════
// Mostra um toast comemorativo no canto superior da tela do Jogador.
function showLevelUpToast(p) {
  let wrap = document.getElementById('toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'toast-wrap';
    wrap.className = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  const habPendentes = getHabilidadesPendentes(p);
  const subLinhas = [`Nível ${p.level} alcançado`, `${p.pontosPendentes || 0} pontos de atributo para distribuir`];
  if (habPendentes > 0) subLinhas.push(`${habPendentes} Habilidade${habPendentes === 1 ? '' : 's'} nova${habPendentes === 1 ? '' : 's'} do Banco disponível${habPendentes === 1 ? '' : 'is'}`);
  const el = document.createElement('div');
  el.className = 'toast-levelup';
  el.innerHTML = `
    <div class="toast-icon">⬆</div>
    <div class="toast-body">
      <div class="toast-title">${p.name} subiu de nível!</div>
      <div class="toast-sub">${subLinhas.join(' · ')}</div>
    </div>`;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 4700);
}

// Toast rápido pro Narrador quando a iniciativa fecha uma rodada completa e
// os recursos (ações, recargas "Por Turno" e turno_N) são resetados sozinhos.
function showRodadaToast() {
  if (IS_JOGADOR) return; // só faz sentido avisar no lado do Narrador
  let wrap = document.getElementById('toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'toast-wrap';
    wrap.className = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  const el = document.createElement('div');
  el.className = 'toast-rodada';
  el.innerHTML = `
    <div class="toast-icon">🔄</div>
    <div class="toast-body">
      <div class="toast-title">Turno ${turnGlobal}</div>
      <div class="toast-sub">Rodada completa — ações e recargas resetadas.</div>
    </div>`;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// Compara o nível atual dos personagens do jogador com o último nível visto
// e dispara o toast quando detecta um aumento — não importa se a subida veio
// de um clique do próprio jogador (+XP) ou de uma sincronização vinda do
// Narrador (Firebase). Só roda na tela do Jogador.
function checkLevelUpToasts() {
  if (!IS_JOGADOR) return;
  const mine = getMyPlayers();
  if (!lastSeenLevels) {
    // Primeira execução: apenas grava o estado inicial, sem notificar
    // (evita disparar toasts ao carregar a página pela primeira vez).
    lastSeenLevels = {};
    mine.forEach(p => { lastSeenLevels[p.id] = p.level; });
    return;
  }
  mine.forEach(p => {
    const prev = lastSeenLevels[p.id];
    if (prev != null && p.level > prev) showLevelUpToast(p);
    lastSeenLevels[p.id] = p.level;
  });
}

function renderAll() {
  const tn = document.getElementById('turn-num');
  if (tn) tn.textContent = turnGlobal;
  renderNarrador();
  if (bankModeActive) {
    // PLAYERS aponta pro Banco de NPCs agora — só o card do banco faz
    // sentido; Iniciativa/Notas são da campanha e ficam intocados.
    const listaFiltrada = npcBankSearchQuery
      ? PLAYERS.filter(p => (p.name || '').toLowerCase().includes(npcBankSearchQuery))
      : PLAYERS;
    renderNarradorGroup(listaFiltrada, 'npc-bank-list', true, true);
    return;
  }
  renderNoteTags();
  renderInit();
  if (IS_JOGADOR) {
    renderPsel();
    renderJogador();
    renderIniciativaJogador();
    if (jogActiveTab === 'anotacoes') renderJogNotas();
    checkLevelUpToasts();
  }
}

// ═══════════════════════════════════════
// TELA DE LOGIN
// ═══════════════════════════════════════
function ensureUsersNode() {
  if (!firebaseConfigured) return;
  firebase.database().ref('ts_users').once('value').then(snap => {
    if (!snap.exists()) firebase.database().ref('ts_users').set({ _init: true });
  });
}

function showLoginScreen() {
  // Evita criar dois overlays
  if (document.getElementById('login-overlay')) return;

  const isNarrador = IS_NARRADOR;
  const overlay = document.createElement('div');
  overlay.id = 'login-overlay';
  overlay.innerHTML = `
    <div class="login-box">
      <div class="login-logo">Terras <span>Sombrias</span></div>
      <div class="login-sub">${isNarrador ? 'Acesso do Narrador' : 'Acesso do Jogador'}</div>

      <div id="login-error" class="login-error" style="display:none"></div>

      <div id="login-panel">
        <div class="form-row">
          <label class="form-label">Usuário</label>
          <input type="text" id="login-user" placeholder="Seu nome de usuário" autocomplete="username">
        </div>
        <div class="form-row">
          <label class="form-label">Senha</label>
          <input type="password" id="login-pass" placeholder="Sua senha" autocomplete="current-password">
        </div>
        <button class="btn btn-primary login-btn" onclick="doLogin()">
          <i class="ti ti-login"></i> Entrar
        </button>
        <div class="login-toggle">Não tem conta? <a href="#" onclick="showRegisterPanel(); return false;">${isNarrador ? 'Criar conta de Narrador' : 'Criar conta'}</a></div>
      </div>

      <div id="register-panel" style="display:none">
        <div class="form-row">
          <label class="form-label">Seu nome</label>
          <input type="text" id="reg-name" placeholder="${isNarrador ? 'Ex: Rodrigo' : 'Ex: João'}">
        </div>
        <div class="form-row">
          <label class="form-label">Usuário</label>
          <input type="text" id="reg-user" placeholder="Somente letras, números e _">
        </div>
        <div class="form-row">
          <label class="form-label">Senha</label>
          <input type="password" id="reg-pass" placeholder="Mínimo 4 caracteres">
        </div>
        <button class="btn btn-primary login-btn" onclick="doRegister()">
          <i class="ti ti-user-plus"></i> ${isNarrador ? 'Criar Conta de Narrador' : 'Criar Conta'}
        </button>
        <div class="login-toggle">Já tem conta? <a href="#" onclick="showLoginPanel(); return false;">Entrar</a></div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const regPanel = document.getElementById('register-panel');
    if (regPanel && regPanel.style.display !== 'none') doRegister();
    else doLogin();
  });

  setTimeout(() => {
    const el = document.getElementById('login-user');
    if (el) el.focus();
  }, 100);
}

function showLoginPanel() {
  document.getElementById('login-panel').style.display = '';
  document.getElementById('register-panel').style.display = 'none';
  document.getElementById('login-error').style.display = 'none';
  setTimeout(() => document.getElementById('login-user').focus(), 50);
}

function showRegisterPanel() {
  document.getElementById('login-panel').style.display = 'none';
  document.getElementById('register-panel').style.display = '';
  document.getElementById('login-error').style.display = 'none';
  setTimeout(() => document.getElementById('reg-name').focus(), 50);
}

function loginError(msg) {
  const el = document.getElementById('login-error');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

async function hashPass(pass) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pass));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function doLogin() {
  const username = (document.getElementById('login-user').value || '').trim().toLowerCase();
  const pass = document.getElementById('login-pass').value || '';
  if (!username || !pass) { loginError('Preencha usuário e senha.'); return; }

  const role = IS_NARRADOR ? 'narrator' : 'player';

  // Modo offline
  if (!firebaseConfigured) {
    setCurrentUser({ id: 'local_' + username, name: username, role });
    document.getElementById('login-overlay').remove();
    proceedAfterLogin();
    return;
  }

  const hash = await hashPass(pass);
  const ref = firebase.database().ref('ts_users/' + username);
  ref.once('value').then(snap => {
    const u = snap.val();
    if (!u) { loginError('Usuário não encontrado.'); return; }
    if (u.hash !== hash) { loginError('Senha incorreta.'); return; }
    // Narrador só pode entrar com conta de narrador
    if (IS_NARRADOR && u.role !== 'narrator') { loginError('Esta conta não tem acesso de Narrador.'); return; }
    // Jogador não pode entrar com conta de narrador
    if (IS_JOGADOR && u.role === 'narrator') { loginError('Use a página do Narrador para esta conta.'); return; }
    setCurrentUser({ id: username, name: u.name, role: u.role || 'player' });
    document.getElementById('login-overlay').remove();
    proceedAfterLogin();
  }).catch(() => loginError('Erro de conexão. Tente novamente.'));
}

async function doRegister() {
  const name     = (document.getElementById('reg-name').value || '').trim();
  const username = (document.getElementById('reg-user').value || '').trim().toLowerCase().replace(/\s+/g, '_');
  const pass     = document.getElementById('reg-pass').value || '';
  if (!name)               { loginError('Informe seu nome.'); return; }
  if (!username)           { loginError('Informe um nome de usuário.'); return; }
  if (pass.length < 4)     { loginError('Senha deve ter pelo menos 4 caracteres.'); return; }
  if (!/^[a-z0-9_]+$/.test(username)) { loginError('Usuário só pode ter letras, números e _'); return; }

  if (!firebaseConfigured) {
    setCurrentUser({ id: 'local_' + username, name, role: 'player' });
    document.getElementById('login-overlay').remove();
    proceedAfterLogin();
    return;
  }

  const hash = await hashPass(pass);
  const ref = firebase.database().ref('ts_users/' + username);
  ref.once('value').then(snap => {
    if (snap.exists()) { loginError('Este nome de usuário já existe. Escolha outro.'); return; }
    ref.set({ name, hash, role: IS_NARRADOR ? 'narrator' : 'player' }).then(() => {
      setCurrentUser({ id: username, name, role: 'player' });
      document.getElementById('login-overlay').remove();
      proceedAfterLogin();
    });
  }).catch(() => loginError('Erro ao criar conta. Tente novamente.'));
}

function renderUserBadge() {
  if (!currentUser) return;
  const header = document.querySelector('.header');
  if (!header) return;
  const old = document.getElementById('user-badge');
  if (old) old.remove();

  const badge = document.createElement('div');
  badge.id = 'user-badge';
  badge.style.cssText = 'margin-left:auto; display:flex; align-items:center; gap:10px; font-size:12px; color:var(--text2)';
  badge.innerHTML = `
    <i class="ti ti-user-circle" style="font-size:16px"></i>
    <span>${currentUser.name}</span>
    <button class="btn" style="padding:3px 10px; font-size:11px" onclick="logout()">
      <i class="ti ti-logout"></i> Sair
    </button>`;
  header.appendChild(badge);
}

// ═══════════════════════════════════════
// TELA DE SELEÇÃO DE CAMPANHA
// ═══════════════════════════════════════

// Busca as campanhas do usuário atual (criadas, se narrador; ou em que entrou, se jogador)
let cachedMyCampaigns = [];

function loadMyCampaignsList(callback) {
  if (!currentUser || !firebaseConfigured) return callback([]);
  const userCampsRef = firebase.database().ref('ts_users/' + currentUser.id + '/campaigns');
  userCampsRef.once('value').then(snap => {
    const ids = snap.val() ? Object.keys(snap.val()) : [];
    if (!ids.length) return callback([]);
    Promise.all(ids.map(id =>
      firebase.database().ref('campaigns/' + id + '/meta').once('value')
        .then(s => Object.assign({ id }, s.val() || {}))
    )).then(list => callback(list.filter(c => c.name)));
  }).catch(() => callback([]));
}

// Re-renderiza a lista de campanhas dentro do seletor já aberto (após criar/renomear/excluir)
function refreshCampaignList() {
  if (!document.getElementById('campaign-list')) return;
  loadMyCampaignsList(renderCampaignListItems);
}

function renderCampaignListItems(list) {
  cachedMyCampaigns = list;
  const el = document.getElementById('campaign-list');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = `<div style="text-align:center;color:var(--text3);font-size:12px;padding:6px 0 4px">${IS_NARRADOR ? 'Você ainda não criou nenhuma campanha.' : 'Você ainda não entrou em nenhuma campanha.'}</div>`;
    return;
  }
  el.innerHTML = list.map(c => `
    <div class="campaign-item">
      <div class="campaign-item-main" onclick="bindCampaign('${c.id}')">
        <div class="campaign-item-name">${c.name}</div>
        ${IS_NARRADOR && c.code ? `<div class="campaign-item-code">Código: ${c.code}</div>` : ''}
      </div>
      ${IS_NARRADOR ? `
        <div class="campaign-item-actions">
          <button onclick="renomearCampanhaPrompt('${c.id}')" title="Renomear campanha"><i class="ti ti-edit"></i></button>
          <button onclick="excluirCampanhaPrompt('${c.id}')" title="Excluir campanha" class="danger"><i class="ti ti-trash"></i></button>
        </div>` : `<i class="ti ti-chevron-right"></i>`}
    </div>`).join('');
}

function renomearCampanhaPrompt(id) {
  const camp = cachedMyCampaigns.find(c => c.id === id);
  const atual = camp ? camp.name : '';
  const novoNome = prompt('Novo nome da campanha:', atual);
  if (novoNome === null) return;
  const nome = novoNome.trim();
  if (!nome) return;
  firebase.database().ref('campaigns/' + id + '/meta/name').set(nome).then(() => {
    refreshCampaignList();
  }).catch(() => alert('Erro ao renomear a campanha. Tente novamente.'));
}

function excluirCampanhaPrompt(id) {
  const camp = cachedMyCampaigns.find(c => c.id === id);
  const nome = camp ? camp.name : 'esta campanha';
  if (!confirm(`Tem certeza que deseja excluir "${nome}"? Todos os personagens, anotações e progresso dessa campanha serão perdidos permanentemente.`)) return;

  const tasks = [
    firebase.database().ref('campaigns/' + id).remove(),
    firebase.database().ref('ts_users/' + currentUser.id + '/campaigns/' + id).remove()
  ];
  if (camp && camp.code) tasks.push(firebase.database().ref('campaign_codes/' + camp.code).remove());

  Promise.all(tasks).then(() => {
    refreshCampaignList();
  }).catch(() => alert('Erro ao excluir a campanha. Tente novamente.'));
}

// Renomeia a campanha que está ativa no momento (a partir do badge no cabeçalho)
function renomearCampanhaAtiva() {
  if (!activeCampaignId || !activeCampaignMeta) return;
  const novoNome = prompt('Novo nome da campanha:', activeCampaignMeta.name);
  if (novoNome === null) return;
  const nome = novoNome.trim();
  if (!nome) return;
  firebase.database().ref('campaigns/' + activeCampaignId + '/meta/name').set(nome).then(() => {
    activeCampaignMeta.name = nome;
    renderCampaignBadge();
  }).catch(() => alert('Erro ao renomear a campanha. Tente novamente.'));
}

function campaignError(msg) {
  const el = document.getElementById('campaign-error');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function showCampaignSelector() {
  if (document.getElementById('campaign-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'campaign-overlay';
  overlay.className = 'fullscreen-overlay';
  overlay.innerHTML = `
    <div class="login-box" style="max-width:400px">
      <div class="login-logo">Terras <span>Sombrias</span></div>
      <div class="login-sub">${IS_NARRADOR ? 'Suas Campanhas' : 'Entrar em uma Campanha'}</div>

      <div id="campaign-error" class="login-error" style="display:none"></div>

      <div id="campaign-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:18px;">
        <div style="text-align:center;color:var(--text3);font-size:12px;padding:10px">Carregando…</div>
      </div>

      ${IS_NARRADOR ? `
        <div class="form-row">
          <label class="form-label">Criar nova campanha</label>
          <input type="text" id="new-camp-name" placeholder="Ex: A Maldição de Karnak">
        </div>
        <button class="btn btn-primary login-btn" onclick="criarCampanha()"><i class="ti ti-plus"></i> Criar Campanha</button>
      ` : `
        <div class="form-row">
          <label class="form-label">Código da campanha</label>
          <input type="text" id="join-camp-code" placeholder="Ex: AB12CD" style="text-transform:uppercase">
        </div>
        <button class="btn btn-primary login-btn" onclick="entrarComCodigo()"><i class="ti ti-door-enter"></i> Entrar na Campanha</button>
      `}

      <div class="login-toggle"><a href="#" onclick="logout(); return false;">Sair da conta</a></div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (IS_NARRADOR) criarCampanha(); else entrarComCodigo();
  });

  loadMyCampaignsList(renderCampaignListItems);

  setTimeout(() => {
    const el = document.getElementById(IS_NARRADOR ? 'new-camp-name' : 'join-camp-code');
    if (el) el.focus();
  }, 100);
}

function generateCampaignCode() {
  // Sem caracteres ambíguos (sem 0/O, 1/I)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function criarCampanha() {
  const nameInput = document.getElementById('new-camp-name');
  const name = (nameInput.value || '').trim();
  if (!name) { campaignError('Dê um nome para a campanha.'); nameInput.focus(); return; }

  const tryCreate = (attempt) => {
    if (attempt > 5) { campaignError('Erro ao gerar um código único. Tente novamente.'); return; }
    const code = generateCampaignCode();
    const codeRef = firebase.database().ref('campaign_codes/' + code);
    codeRef.once('value').then(snap => {
      if (snap.exists()) { tryCreate(attempt + 1); return; }
      const newCampRef = firebase.database().ref('campaigns').push();
      const id = newCampRef.key;
      const meta = { name, code, ownerId: currentUser.id, createdAt: Date.now() };
      Promise.all([
        newCampRef.child('meta').set(meta),
        codeRef.set(id),
        firebase.database().ref('ts_users/' + currentUser.id + '/campaigns/' + id).set(true)
      ]).then(() => {
        bindCampaign(id);
      }).catch(() => campaignError('Erro ao criar campanha. Tente novamente.'));
    }).catch(() => campaignError('Erro de conexão. Tente novamente.'));
  };
  tryCreate(0);
}

function entrarComCodigo() {
  const input = document.getElementById('join-camp-code');
  const code = (input.value || '').trim().toUpperCase();
  if (!code) { campaignError('Digite o código da campanha.'); input.focus(); return; }

  firebase.database().ref('campaign_codes/' + code).once('value').then(snap => {
    const id = snap.val();
    if (!id) { campaignError('Código não encontrado. Confira com o Narrador.'); return; }
    firebase.database().ref('ts_users/' + currentUser.id + '/campaigns/' + id).set(true).then(() => {
      bindCampaign(id);
    }).catch(() => campaignError('Erro ao entrar na campanha. Tente novamente.'));
  }).catch(() => campaignError('Erro de conexão. Tente novamente.'));
}

// Badge no header mostrando a campanha ativa (+ código, para o Narrador) e botão de trocar
function renderCampaignBadge() {
  if (!activeCampaignId || activeCampaignId === 'local') return;
  const header = document.querySelector('.header');
  if (!header) return;

  let badge = document.getElementById('campaign-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'campaign-badge';
    badge.className = 'campaign-badge';
    const syncStatus = document.getElementById('sync-status');
    if (syncStatus && syncStatus.parentNode) syncStatus.parentNode.insertBefore(badge, syncStatus.nextSibling);
    else header.appendChild(badge);
  }

  const name = activeCampaignMeta ? activeCampaignMeta.name : '…';
  const codeHtml = (IS_NARRADOR && activeCampaignMeta && activeCampaignMeta.code)
    ? `<span class="camp-code" title="Compartilhe este código com seus jogadores">${activeCampaignMeta.code}</span>`
    : '';
  const editBtn = IS_NARRADOR
    ? `<button onclick="renomearCampanhaAtiva()" title="Renomear campanha"><i class="ti ti-edit"></i></button>`
    : '';
  badge.innerHTML = `<i class="ti ti-map-2"></i> <strong>${name}</strong> ${codeHtml} ${editBtn} <button onclick="trocarCampanha()" title="Trocar de campanha"><i class="ti ti-switch-horizontal"></i> Trocar</button>`;
}

// ═══════════════════════════════════════
// KICKOFF
// ═══════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  IS_JOGADOR  = !!document.getElementById('psel');
  IS_NARRADOR = !!document.getElementById('nar-players');
  loginInit();
  initFirebaseSync();
  initDiceWidget();
});

// ═══════════════════════════════════════
