// INICIATIVA (sincronizada entre Narrador e todos os Jogadores)
// ═══════════════════════════════════════
// INITIATIVE: [{ id, tipo:'jogador'|'aliado'|'inimigo', playerId?, name, roll }]
// turnoAtualId: id da entrada de INITIATIVE cujo turno é agora (não um índice,
// assim a marcação do turno atual não se perde quando a lista é reordenada).
// combatAtivo: true enquanto o Narrador mantiver esse combate em andamento.

// Retorna a ordem de exibição: quem já rolou primeiro (do maior pro menor),
// e quem ainda não rolou depois, na ordem em que foi adicionado.
function ordemIniciativa() {
  return [...INITIATIVE].sort((a, b) => {
    if (a.roll === null && b.roll === null) return 0;
    if (a.roll === null) return 1;
    if (b.roll === null) return -1;
    return b.roll - a.roll;
  });
}

// Ajusta os contadores de quantos Inimigos/Aliados (NPCs) entrarão no
// próximo combate — só existe localmente no navegador do Narrador até
// "Iniciar Combate" ser clicado.
function stepInitSetup(campo, delta) {
  if (campo === 'inimigos') initSetupInimigos = Math.max(0, Math.min(20, initSetupInimigos + delta));
  else initSetupAliados = Math.max(0, Math.min(20, initSetupAliados + delta));
  renderInit();
}

// Narrador inicia um novo combate: todos os Jogadores entram automaticamente
// Narrador inicia um novo combate: todos os Jogadores entram automaticamente
// na ordem (aguardando rolar), todos os NPCs já criados nesta campanha também
// entram sozinhos — já classificados como Aliado ou Inimigo conforme a
// escolha feita na criação deles — mais os Inimigos/Aliados genéricos (sem
// ficha) que o Narrador quiser adicionar avulsos pelos contadores.
function iniciarCombate() {
  const jogadores = PLAYERS.filter(p => !p.isNPC).map(p => ({ id: 'init_pl_' + p.id, tipo: 'jogador', playerId: p.id, name: p.name, roll: null }));
  const npcs = PLAYERS.filter(p => p.isNPC).map(p => ({ id: 'init_npc_' + p.id, tipo: 'npc', playerId: p.id, name: p.name, roll: null }));
  const aliados = Array.from({ length: initSetupAliados }, (_, i) => ({ id: 'init_al_' + Date.now() + '_' + i, tipo: 'aliado', name: `Aliado ${i + 1}`, roll: null }));
  const inimigos = Array.from({ length: initSetupInimigos }, (_, i) => ({ id: 'init_en_' + Date.now() + '_' + i, tipo: 'inimigo', name: `Inimigo ${i + 1}`, roll: null }));
  INITIATIVE = [...jogadores, ...npcs, ...aliados, ...inimigos];
  turnoAtualId = null;
  combatAtivo = true;
  saveState();
  renderAll();
}

// Encerra o combate atual e limpa toda a ordem de iniciativa.
function encerrarCombate() {
  if (!confirm('Encerrar o combate atual e limpar a ordem de iniciativa?')) return;
  INITIATIVE = [];
  turnoAtualId = null;
  combatAtivo = false;
  saveState();
  renderAll();
}

// Narrador adiciona mais um Inimigo/Aliado (NPC) no meio do combate.
function addIniciativaNPC(tipo) {
  const n = INITIATIVE.filter(e => e.tipo === tipo).length + 1;
  const idBase = tipo === 'inimigo' ? 'init_en_' : 'init_al_';
  INITIATIVE.push({ id: idBase + Date.now() + '_' + Math.random().toString(36).slice(2, 5), tipo, name: (tipo === 'inimigo' ? 'Inimigo ' : 'Aliado ') + n, roll: null });
  saveState();
  renderAll();
}

function removeIniciativaNPC(id) {
  INITIATIVE = INITIATIVE.filter(e => e.id !== id);
  if (turnoAtualId === id) turnoAtualId = null;
  saveState();
  renderAll();
}

function renomearIniciativaNPC(id, novoNome) {
  const e = INITIATIVE.find(x => x.id === id);
  if (!e) return;
  e.name = (novoNome || '').trim() || e.name;
  saveState();
  renderAll();
}

// Narrador rola manualmente a iniciativa de um NPC (1d20 simples).
function rolarIniciativaNPC(id) {
  const e = INITIATIVE.find(x => x.id === id);
  if (!e) return;
  e.roll = 1 + Math.floor(Math.random() * 20);
  saveState();
  renderAll();
}

// Cada Jogador rola a própria Iniciativa (o Narrador também pode rolar por
// qualquer um deles). Reaproveita o Teste de Iniciativa configurado na aba
// de Testes: 1d20 + maestria de Agilidade, com Mega Vantagem/Desvantagem e
// Bônus, e o resultado já entra na ordem do combate.
function rolarIniciativaJogador(pid) {
  const total = rolarTeste(pid, 'iniciativa');
  if (total === null) return;
  let entry = INITIATIVE.find(e => (e.tipo === 'jogador' || e.tipo === 'npc') && e.playerId === pid);
  if (!entry) {
    if (!combatAtivo) return;
    const p = PLAYERS.find(x => x.id === pid);
    if (!p) return;
    entry = p.isNPC
      ? { id: 'init_npc_' + pid, tipo: 'npc', playerId: pid, name: p.name, roll: null }
      : { id: 'init_pl_' + pid, tipo: 'jogador', playerId: pid, name: p.name, roll: null };
    INITIATIVE.push(entry);
  }
  entry.roll = total;
  saveState();
  renderAll();
}

// Avança/retrocede quem age agora, seguindo a ordem por maior iniciativa.
// Unificado com a passagem de turno global: ao avançar (dir=1) e a ordem
// "dar a volta" — ou seja, o próximo a agir é de novo o primeiro da lista,
// fechando uma rodada completa — dispara automaticamente o mesmo reset do
// botão "Próximo Turno" (turnGlobal++, ações e recargas de todos). Assim
// não é preciso clicar nos dois botões separadamente durante o combate.
// Retroceder (dir=-1) nunca dispara o reset, só corrige quem está na vez.
function avancarTurno(dir) {
  const ordem = ordemIniciativa();
  if (!ordem.length) return;
  let idx = ordem.findIndex(e => e.id === turnoAtualId);
  const idxAnterior = idx; // -1 = ninguém estava com o turno ainda (começo do combate)
  if (idx === -1) idx = dir > 0 ? -1 : 0;
  idx = (idx + dir + ordem.length) % ordem.length;
  turnoAtualId = ordem[idx].id;

  // Nova rodada: só conta quando já havia alguém com o turno (idxAnterior
  // !== -1, senão seria o primeiro "Próximo" do combate) e avançamos para
  // frente "voltando" ao início da lista (idx <= idxAnterior).
  const novaRodada = dir > 0 && idxAnterior !== -1 && idx <= idxAnterior;
  if (novaRodada) {
    aplicarResetDeTurno();
    showRodadaToast();
  }

  saveState();
  renderAll();
}
function nextI() { avancarTurno(1); }
function prevI() { avancarTurno(-1); }

// Se um personagem novo (Jogador OU NPC) for criado/chamado com um combate já
// em andamento, garante que ele entre na ordem de iniciativa (aguardando
// rolar), em vez de ficar de fora até alguém lembrar de adicioná-lo
// manualmente. NPCs entram já classificados como Aliado/Inimigo.
function sincronizarJogadoresNaIniciativa() {
  if (!combatAtivo) return;
  PLAYERS.forEach(p => {
    if (p.isNPC) {
      if (!INITIATIVE.some(e => e.tipo === 'npc' && e.playerId === p.id)) {
        INITIATIVE.push({ id: 'init_npc_' + p.id, tipo: 'npc', playerId: p.id, name: p.name, roll: null });
      }
    } else if (!INITIATIVE.some(e => e.tipo === 'jogador' && e.playerId === p.id)) {
      INITIATIVE.push({ id: 'init_pl_' + p.id, tipo: 'jogador', playerId: p.id, name: p.name, roll: null });
    }
  });
}

// Narrador: card completo de Iniciativa (setup de NPCs + lista + controles).
// Evita perder o que o Narrador está digitando no nome de um Inimigo/Aliado
// sempre que a tela é redesenhada por causa de qualquer outra ação (rolar um
// dado, ajustar vida de alguém, sincronizar com os Jogadores etc.) — o app
// redesenha a tela inteira a cada ação, o que resetava o campo de texto no
// meio da digitação. Aqui guardamos o valor/cursor atual antes de redesenhar
// e devolvemos ao mesmo campo depois.
function capturarFocoIniciativa(container) {
  const ativo = document.activeElement;
  if (!ativo || !container.contains(ativo) || !ativo.classList.contains('iname-input')) return null;
  return {
    id: ativo.dataset.initId,
    value: ativo.value,
    selStart: ativo.selectionStart,
    selEnd: ativo.selectionEnd
  };
}
function restaurarFocoIniciativa(container, foco) {
  if (!foco) return;
  const input = container.querySelector(`.iname-input[data-init-id="${foco.id}"]`);
  if (!input) return;
  input.value = foco.value;
  input.focus();
  try { input.setSelectionRange(foco.selStart, foco.selEnd); } catch (e) {}
}

function renderInit() {
  const el = document.getElementById('init-container');
  if (!el) return;
  sincronizarJogadoresNaIniciativa();
  const foco = capturarFocoIniciativa(el);
  const listaAntiga = el.querySelector('.init-list');
  const scrollTop = listaAntiga ? listaAntiga.scrollTop : 0;
  const turnoMudou = turnoAtualId !== ultimoTurnoRenderNarrador;
  ultimoTurnoRenderNarrador = turnoAtualId;

  if (!combatAtivo || !INITIATIVE.length) {
    el.innerHTML = `
      <div class="init-setup">
        <div class="init-setup-row">
          <span class="itype it-en">Inimigos</span>
          <div class="init-counter">
            <button onclick="stepInitSetup('inimigos',-1)">−</button>
            <span>${initSetupInimigos}</span>
            <button onclick="stepInitSetup('inimigos',1)">+</button>
          </div>
        </div>
        <div class="init-setup-row">
          <span class="itype it-al">Aliados (NPC)</span>
          <div class="init-counter">
            <button onclick="stepInitSetup('aliados',-1)">−</button>
            <span>${initSetupAliados}</span>
            <button onclick="stepInitSetup('aliados',1)">+</button>
          </div>
        </div>
        <div class="init-setup-hint">${PLAYERS.filter(p => !p.isNPC).length} jogador(es) e ${PLAYERS.filter(p => p.isNPC).length} NPC(s) desta campanha entrarão automaticamente na ordem.</div>
        <button class="btn btn-success" style="width:100%" onclick="iniciarCombate()"><i class="ti ti-swords"></i> Iniciar Combate</button>
      </div>`;
    return;
  }

  const ordem = ordemIniciativa();
  el.innerHTML = `
    <div class="init-list">
      ${ordem.map(e => {
        const cur = e.id === turnoAtualId ? 'cur' : '';
        if (e.tipo === 'jogador') {
          return `<div class="iitem ${cur}">
            <span class="inum">${e.roll ?? '—'}</span>
            <span class="iname">${escHtml(e.name)}</span>
            <span class="itype it-pl">Jogador</span>
            <button class="init-roll-btn" onclick="rolarIniciativaJogador(${e.playerId})" title="Rolar por ele"><i class="ti ti-dice"></i></button>
          </div>`;
        }
        if (e.tipo === 'npc') {
          // NPC com ficha completa: rola pela própria Iniciativa dele (com
          // maestria/MV/MD/Bônus, igual jogador) — só muda o rótulo/cor
          // (Aliado ou Inimigo, conforme classificado na criação) e pode
          // ser tirado do combate sem excluir o personagem da campanha.
          const pNpc = PLAYERS.find(x => x.id === e.playerId);
          const nomeNpc = pNpc ? pNpc.name : e.name;
          const npcTipoClasse = pNpc && pNpc.npcTipo === 'inimigo' ? 'it-en' : 'it-al';
          const npcTipoLabel  = pNpc && pNpc.npcTipo === 'inimigo' ? 'Inimigo' : 'Aliado';
          return `<div class="iitem ${cur}">
            <span class="inum">${e.roll ?? '—'}</span>
            <span class="iname">${escHtml(nomeNpc)}</span>
            <span class="itype ${npcTipoClasse}">${npcTipoLabel}</span>
            <button class="init-roll-btn" onclick="rolarIniciativaJogador(${e.playerId})" title="Rolar pela ficha"><i class="ti ti-dice"></i></button>
            <button class="init-del-btn" onclick="removeIniciativaNPC('${e.id}')" title="Tirar do combate (não exclui o NPC)"><i class="ti ti-x"></i></button>
          </div>`;
        }
        const tipoClasse = e.tipo === 'inimigo' ? 'it-en' : 'it-al';
        const tipoLabel  = e.tipo === 'inimigo' ? 'Inimigo' : 'Aliado';
        return `<div class="iitem ${cur}">
          <span class="inum">${e.roll ?? '—'}</span>
          <input class="iname-input" type="text" data-init-id="${e.id}" value="${escHtml(e.name)}"
            onchange="renomearIniciativaNPC('${e.id}', this.value)"
            onkeydown="if(event.key==='Enter') this.blur()">
          <span class="itype ${tipoClasse}">${tipoLabel}</span>
          <button class="init-roll-btn" onclick="rolarIniciativaNPC('${e.id}')" title="Rolar 1d20"><i class="ti ti-dice"></i></button>
          <button class="init-del-btn" onclick="removeIniciativaNPC('${e.id}')" title="Remover"><i class="ti ti-x"></i></button>
        </div>`;
      }).join('')}
    </div>
    <div class="init-add-row">
      <button class="btn" onclick="addIniciativaNPC('inimigo')"><i class="ti ti-plus"></i> Inimigo</button>
      <button class="btn" onclick="addIniciativaNPC('aliado')"><i class="ti ti-plus"></i> Aliado</button>
    </div>
    <div class="init-btns">
      <button class="btn" onclick="avancarTurno(-1)"><i class="ti ti-chevron-left"></i> Anterior</button>
      <button class="btn" onclick="avancarTurno(1)" title="Ao completar a volta na ordem, reseta ações e recargas de todos automaticamente">Próximo <i class="ti ti-chevron-right"></i></button>
    </div>
    <button class="btn btn-danger" style="width:100%;margin-top:8px" onclick="encerrarCombate()"><i class="ti ti-x"></i> Encerrar Combate</button>`;
  restaurarFocoIniciativa(el, foco);
  const listaNova = el.querySelector('.init-list');
  if (listaNova) {
    const curEl = turnoMudou ? listaNova.querySelector('.iitem.cur') : null;
    if (curEl) curEl.scrollIntoView({ block: 'nearest' });
    else listaNova.scrollTop = scrollTop;
  }
}

// Jogador: mostra a mesma ordem (somente leitura), com botão de "Rolar
// minha iniciativa" apenas na linha do personagem selecionado no momento.
function toggleJogIniciativa() {
  jogIniciativaCollapsed = !jogIniciativaCollapsed;
  renderIniciativaJogador();
}
function renderIniciativaJogador() {
  const el = document.getElementById('jog-iniciativa');
  if (!el) return;
  if (!combatAtivo || !INITIATIVE.length) { el.innerHTML = ''; ultimoTurnoRenderJogador = undefined; return; }

  const turnoMudou = turnoAtualId !== ultimoTurnoRenderJogador;
  ultimoTurnoRenderJogador = turnoAtualId;
  const listaAntiga = el.querySelector('.init-list');
  const scrollTop = listaAntiga ? listaAntiga.scrollTop : 0;

  const ordem = ordemIniciativa();
  const pselEl = document.getElementById('psel');
  const selectedPid = pselEl ? Number(pselEl.value) : null;

  el.innerHTML = `
    <div class="card init-card-jog">
      <div class="card-title init-card-title" onclick="toggleJogIniciativa()">
        <i class="ti ti-swords"></i> Ordem de Iniciativa
        <i class="ti ${jogIniciativaCollapsed ? 'ti-chevron-down' : 'ti-chevron-up'} gt-chevron" style="margin-left:auto"></i>
      </div>
      ${jogIniciativaCollapsed ? '' : `<div class="init-list">
        ${ordem.map(e => {
          const isMe = e.tipo === 'jogador' && e.playerId === selectedPid;
          const pNpc = e.tipo === 'npc' ? PLAYERS.find(x => x.id === e.playerId) : null;
          const nomeExibido = pNpc ? pNpc.name : e.name;
          const tipoClasse = e.tipo === 'jogador' ? 'it-pl' : (e.tipo === 'npc' ? (pNpc && pNpc.npcTipo === 'inimigo' ? 'it-en' : 'it-al') : (e.tipo === 'inimigo' ? 'it-en' : 'it-al'));
          const tipoLabel  = e.tipo === 'jogador' ? 'Jogador' : (e.tipo === 'npc' ? (pNpc && pNpc.npcTipo === 'inimigo' ? 'Inimigo' : 'Aliado') : (e.tipo === 'inimigo' ? 'Inimigo' : 'Aliado'));
          const rollBtn = isMe
            ? `<button class="init-roll-btn" onclick="event.stopPropagation();rolarIniciativaJogador(${e.playerId})" title="Rolar minha iniciativa"><i class="ti ti-dice"></i></button>`
            : '';
          return `<div class="iitem ${e.id === turnoAtualId ? 'cur' : ''} ${isMe ? 'iitem-me' : ''}">
            <span class="inum">${e.roll ?? '—'}</span>
            <span class="iname">${escHtml(nomeExibido)}</span>
            <span class="itype ${tipoClasse}">${tipoLabel}</span>
            ${rollBtn}
          </div>`;
        }).join('')}
      </div>`}
    </div>`;

  if (jogIniciativaCollapsed) return;

  const listaNova = el.querySelector('.init-list');
  if (listaNova) {
    const curEl = turnoMudou ? listaNova.querySelector('.iitem.cur') : null;
    if (curEl) curEl.scrollIntoView({ block: 'nearest' });
    else listaNova.scrollTop = scrollTop;
  }
}


function renderNoteTags() {
  const ntags = document.getElementById('ntags');
  const notaArea = document.getElementById('nota-area');
  if (!ntags || !notaArea) return;
  ntags.innerHTML = NOTETAGS.map(t => `<span class="ntag ${t.toLowerCase()===activeNote?'on':''}" onclick="switchNota('${t.toLowerCase()}')">${t}</span>`).join('');
  notaArea.value = notes[activeNote] || '';
}
function switchNota(t) { activeNote = t; renderNoteTags(); }
function saveNota() {
  const notaArea = document.getElementById('nota-area');
  if (!notaArea) return;
  notes[activeNote] = notaArea.value; saveState();
}

// ═══════════════════════════════════════
// MODAL HABILIDADE
// ═══════════════════════════════════════
function openModal(pid) {
  modalPid = pid;
  modalSkid = null;
  modalColor = 'green';

  document.getElementById('modal-title').textContent = 'Nova Habilidade';
  document.getElementById('m-btn-del').style.display = 'none';
  document.getElementById('m-btn-save').textContent = 'Adicionar';

  document.getElementById('m-name').value = '';
  if(document.getElementById('m-desc')) document.getElementById('m-desc').value = '';
  document.getElementById('m-cost').value = '1';
  document.getElementById('m-tipo').value = 'perturn';
  document.getElementById('m-usos').value = '2';
  document.getElementById('m-turnos').value = '2';

  document.querySelectorAll('.color-opt').forEach(el => el.classList.remove('selected'));
  document.querySelector('.co-green').classList.add('selected');

  updateModal();
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(() => document.getElementById('m-name').focus(), 50);
}

function editSkill(pid, skid) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  const sk = p.skills.find(x => x.id === skid);
  if (!sk) return;

  modalPid = pid;
  modalSkid = skid;
  modalColor = sk.color;

  document.getElementById('modal-title').textContent = 'Editar Habilidade';
  document.getElementById('m-btn-del').style.display = 'inline-block';
  document.getElementById('m-btn-save').textContent = 'Salvar';

  document.getElementById('m-name').value = sk.name;
  if(document.getElementById('m-desc')) document.getElementById('m-desc').value = sk.desc || '';
  document.getElementById('m-cost').value = sk.cost.toString();
  document.getElementById('m-tipo').value = sk.tipo;
  document.getElementById('m-usos').value = sk.usosMax || 2;
  document.getElementById('m-turnos').value = sk.turnosRecarga || 2;

  document.querySelectorAll('.color-opt').forEach(el => el.classList.remove('selected'));
  document.querySelector(`.co-${sk.color}`).classList.add('selected');

  updateModal();
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(() => document.getElementById('m-name').focus(), 50);
}

function deleteSkill() {
  if (!modalSkid || !modalPid) return;
  if (!confirm('Tem certeza que deseja excluir esta habilidade? Esta ação não pode ser desfeita.')) return;
  const p = PLAYERS.find(x => x.id === modalPid);
  if (p) {
    p.skills = p.skills.filter(x => x.id !== modalSkid);
    saveState();
    renderAll();
  }
  closeModal();
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if(overlay) overlay.classList.remove('open');
}

// ═══════════════════════════════════════
// MODAL — BANCO DE HABILIDADES DE SUBCLASSE
// ═══════════════════════════════════════
let bancoPid = null;
let bancoClasseAtiva = null;
let bancoTabAtiva = null;
let origemSangrentaPid = null;
let origemSangrentaClasseAtiva = null;
let origemSangrentaTabAtiva = null;

function openBancoModal(pid) {
  bancoPid = pid;
  const p = PLAYERS.find(x => x.id === pid);
  // Abre já na própria Classe/Subclasse do personagem.
  bancoClasseAtiva = p ? (p.classeBase || getBaseClass(p.cls) || null) : null;
  bancoTabAtiva = p ? p.cls : null;
  renderBancoModal(pid);
  document.getElementById('modal-banco-overlay').classList.add('open');
}

function closeBancoModal() {
  const overlay = document.getElementById('modal-banco-overlay');
  if (overlay) overlay.classList.remove('open');
}

// Troca a Classe ativa (1º nível de aba) — ao trocar de Classe, a Subclasse
// ativa é zerada pra cair na primeira Subclasse dessa Classe automaticamente.
function trocarClasseBanco(className) {
  bancoClasseAtiva = className;
  bancoTabAtiva = null;
  renderBancoModal(bancoPid);
}

// Troca a aba (subclasse) ativa dentro do modal, sem fechar/reabrir.
function trocarAbaBanco(subNome) {
  bancoTabAtiva = subNome;
  renderBancoModal(bancoPid);
}

// Repinta o catálogo (chamado ao abrir, ao trocar de Classe/aba, e após
// adicionar algo, pra atualizar o estado "já adicionada" de cada item sem
// fechar o modal). Dois níveis de aba: 1º a Classe (própria + outras, via
// Aprendizagem Élfica/Transcendência Intelectual), 2º a Subclasse dentro da
// Classe escolhida — antes era uma lista só, corrida, com todas as
// Subclasses de todas as Classes misturadas e marcadas "(NomeDaClasse)",
// o que ficava poluído e difícil de navegar.
function renderBancoModal(pid) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  const todosItens = getBancoHabilidades(p);
  const COLOR_LABEL = { green: 'Técnica', red: 'Golpe', blue: 'Feitiço', gray: 'Neutra' };
  const clsBase = p.classeBase || getBaseClass(p.cls) || '';

  document.getElementById('banco-subclasse-nome').textContent = clsBase;

  const classeTabsEl = document.getElementById('banco-classe-tabs');
  const tabsEl = document.getElementById('banco-tabs');
  const lista = document.getElementById('banco-lista');
  const progressoEl = document.getElementById('banco-progresso');

  if (!todosItens.length) {
    classeTabsEl.innerHTML = '';
    tabsEl.innerHTML = '';
    lista.innerHTML = `<div style="font-size:12px;color:var(--text3);padding:10px 0">Nenhuma Habilidade cadastrada ainda para ${clsBase || 'esta classe'}.</div>`;
    if (progressoEl) progressoEl.innerHTML = '';
    return;
  }

  // Progresso de escolhas do banco, conforme o Nível do personagem.
  const { nivel, maxOutras, maxTotal } = getBancoLimites(p);
  const { propria, outras, total } = contarBancoEscolhas(p);
  const temOutraClasse = temFonteOutraClasse(p);
  const limiteOutra = getLimiteOutraClasse(p);
  const usadoOutra = contarOutraClasseEscolhas(p);
  const clsBaseAtualProgresso = p.classeBase || getBaseClass(p.cls) || '';
  if (progressoEl) {
    progressoEl.innerHTML = `Nível ${nivel} · Escolhidas: <strong style="color:var(--text)">${total}/${maxTotal}</strong>`
      + ` (própria subclasse: ${propria} · outras subclasses: ${outras}/${maxOutras})`
      + (total >= maxTotal ? ' <span style="color:var(--accent2)">— limite atingido, suba de Nível para desbloquear mais</span>' : '')
      + (temOutraClasse ? `<br>✨ ${labelFontesOutraClasse(p)} (Habilidade de outra Classe): <strong style="color:var(--text)">${usadoOutra}/${limiteOutra}</strong>` : '');
  }

  // 1º nível — Classes presentes (a própria primeiro, depois as liberadas
  // por Aprendizagem Élfica/Transcendência Intelectual), na ordem em que
  // aparecem no catálogo.
  const classesPresentes = [];
  todosItens.forEach(item => {
    if (!classesPresentes.includes(item.classeOrigem)) classesPresentes.push(item.classeOrigem);
  });
  if (!bancoClasseAtiva || !classesPresentes.includes(bancoClasseAtiva)) bancoClasseAtiva = classesPresentes[0];

  classeTabsEl.innerHTML = classesPresentes.map(cn => {
    const ativa = cn === bancoClasseAtiva;
    const propria = cn === clsBaseAtualProgresso;
    return `<button type="button" class="banco-tab ${ativa ? 'active' : ''}" onclick="trocarClasseBanco('${cn}')">${propria ? '★ ' : ''}${cn}</button>`;
  }).join('');

  // 2º nível — Subclasses (Caminhos) dentro da Classe ativa.
  const subsPresentes = [];
  todosItens.forEach(item => {
    if (item.classeOrigem === bancoClasseAtiva && !subsPresentes.includes(item.subclasseOrigem)) subsPresentes.push(item.subclasseOrigem);
  });
  if (!bancoTabAtiva || !subsPresentes.includes(bancoTabAtiva)) bancoTabAtiva = subsPresentes[0];

  tabsEl.innerHTML = subsPresentes.map(sub => {
    const ativa = sub === bancoTabAtiva;
    const propria = sub === p.cls;
    return `<button type="button" class="banco-tab ${ativa ? 'active' : ''}" onclick="trocarAbaBanco('${sub}')">${propria ? '★ ' : ''}${sub}</button>`;
  }).join('');

  const itens = todosItens.filter(item => item.subclasseOrigem === bancoTabAtiva);
  const abaEhPropria = bancoTabAtiva === p.cls;
  const abaEhOutraClasse = temOutraClasse && itens.length > 0 && itens[0].classeOrigem !== clsBaseAtualProgresso;

  lista.innerHTML = itens.map(item => {
    const jaTem = (p.skills || []).some(sk => sk.bancoId === item.id);
    // Bloqueia por limite de Nível: total geral esgotado, ou (se for de outra
    // subclasse) cota "livre" esgotada — ou, se for uma aba de outra Classe
    // (Aprendizagem Élfica/Transcendência Intelectual), a cota separada.
    let bloqueadaPorLimite, labelBtn = 'Adicionar à ficha';
    if (abaEhOutraClasse) {
      bloqueadaPorLimite = !jaTem && usadoOutra >= limiteOutra;
      if (jaTem) labelBtn = '✓ Já adicionada';
      else if (bloqueadaPorLimite) labelBtn = `🔒 Cota de ${labelFontesOutraClasse(p)} esgotada (${usadoOutra}/${limiteOutra})`;
    } else {
      bloqueadaPorLimite = !jaTem && (total >= maxTotal || (!abaEhPropria && outras >= maxOutras));
      if (jaTem) labelBtn = '✓ Já adicionada';
      else if (bloqueadaPorLimite) labelBtn = total >= maxTotal ? `🔒 Limite do Nível ${nivel} atingido` : `🔒 Cota livre esgotada (${outras}/${maxOutras})`;
    }
    const desabilitado = jaTem || bloqueadaPorLimite;
    return `
    <div class="skill-card sk-${item.color}" style="margin:0">
      <div class="sk-name">${item.name}</div>
      <div class="sk-tags">
        <span class="sk-tag">${COLOR_LABEL[item.color] || ''}</span>
        <span class="sk-tag">${item.cost} ${item.cost === 1 ? 'ação' : 'ações'}</span>
        <span class="sk-tag">${tipoLabel(item)}</span>
        ${item.concedeNota ? `<span class="sk-tag" style="background:var(--bardo-dim);color:#f0dba0">🎵 ${item.concedeNota === 'qualquer' ? 'escolha uma nota' : item.concedeNota}</span>` : ''}
      </div>
      <div style="font-size:11px;color:var(--text2);margin-bottom:12px;line-height:1.5;white-space:pre-wrap;max-height:110px;overflow-y:auto;padding-right:4px;">${item.desc}</div>
      ${renderEfeitoSecundarioHtml(p, item)}
      <button class="btn ${desabilitado ? '' : 'btn-primary'}" style="width:100%;justify-content:center" ${desabilitado ? 'disabled' : ''} onclick="adicionarHabilidadeDoBanco(${p.id}, '${item.id}')">
        ${labelBtn}
      </button>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════
// MODAL — BANCO DE TALENTOS INFERIORES
// ═══════════════════════════════════════
let talentosPid = null;

function openTalentosModal(pid) {
  talentosPid = pid;
  renderTalentosModal(pid);
  document.getElementById('modal-talentos-overlay').classList.add('open');
}

function closeTalentosModal() {
  const overlay = document.getElementById('modal-talentos-overlay');
  if (overlay) overlay.classList.remove('open');
}

// Repinta o catálogo fixo de Talentos Inferiores (chamado ao abrir e após
// adicionar um talento, pra atualizar o estado "já adicionado" sem fechar
// o modal). Lista corrida, sem abas — o catálogo é pequeno.
function renderTalentosModal(pid) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;

  const limite = getLimiteTalentosInferiores(p);
  const escolhidos = getTalentosInferioresEscolhidos(p);
  const podeRepetir = temTalentoSuperior(p, 'base_solida');

  const progressoEl = document.getElementById('talentos-progresso');
  if (progressoEl) {
    progressoEl.innerHTML = p.isNPC
      ? `Escolhidos: <strong style="color:var(--text)">${escolhidos.length}</strong> — <span style="color:var(--green)">NPC: sem limite</span>` + (podeRepetir ? ' <span style="color:var(--accent2)">· Base Sólida: pode repetir um já escolhido</span>' : '')
      : (limite > 0
        ? `Escolhidos: <strong style="color:var(--text)">${escolhidos.length}/${limite}</strong>` + (escolhidos.length >= limite ? ' <span style="color:var(--accent2)">— limite atingido, suba de Nível para desbloquear mais</span>' : '') + (podeRepetir ? ' <span style="color:var(--accent2)">· Base Sólida: pode repetir um já escolhido</span>' : '')
        : `Disponível a partir do Nível 2 · Nível atual: ${p.level || 1}`);
  }

  const lista = document.getElementById('talentos-lista');
  if (!lista) return;
  lista.innerHTML = TALENTOS_INFERIORES.map(item => {
    const qtd = escolhidos.filter(pas => pas.talentoInferiorId === item.id).length;
    const jaTem = qtd > 0;
    const limiteAtingido = escolhidos.length >= limite;
    const desabilitado = limiteAtingido || (jaTem && !podeRepetir);
    let labelBtn;
    if (desabilitado) {
      labelBtn = (jaTem && !podeRepetir)
        ? '✓ Já adicionado'
        : (limite === 0 ? '🔒 Disponível no Nível 2' : `🔒 Limite atingido (${escolhidos.length}/${limite})`);
    } else if (jaTem && podeRepetir) {
      labelBtn = `➕ Repetir (já tem ${qtd}x)`;
    } else {
      labelBtn = 'Adicionar à ficha';
    }
    return `
    <div class="skill-card sk-gray" style="margin:0">
      <div class="sk-name">${item.name}</div>
      <div style="font-size:11px;color:var(--text2);margin-bottom:12px;line-height:1.5;white-space:pre-wrap;max-height:130px;overflow-y:auto;padding-right:4px;">${item.desc}</div>
      <button class="btn ${desabilitado ? '' : 'btn-primary'}" style="width:100%;justify-content:center" ${desabilitado ? 'disabled' : ''} onclick="adicionarTalentoInferior(${p.id}, '${item.id}')">
        ${labelBtn}
      </button>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════
// MODAL — BANCO DE TALENTOS SUPERIORES
// ═══════════════════════════════════════
let talentosSuperioresPid = null;

function openTalentosSuperioresModal(pid) {
  talentosSuperioresPid = pid;
  renderTalentosSuperioresModal(pid);
  document.getElementById('modal-talentos-superiores-overlay').classList.add('open');
}

function closeTalentosSuperioresModal() {
  const overlay = document.getElementById('modal-talentos-superiores-overlay');
  if (overlay) overlay.classList.remove('open');
}

// Repinta o catálogo fixo de Talentos Superiores (mesmo padrão do modal de
// Talentos Inferiores, liberado a partir do Nível 4).
function renderTalentosSuperioresModal(pid) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;

  const limite = getLimiteTalentosSuperiores(p);
  const escolhidos = getTalentosSuperioresEscolhidos(p);

  const progressoEl = document.getElementById('talentos-superiores-progresso');
  if (progressoEl) {
    progressoEl.innerHTML = p.isNPC
      ? `Escolhidos: <strong style="color:var(--text)">${escolhidos.length}</strong> — <span style="color:var(--green)">NPC: sem limite</span>`
      : (limite > 0
        ? `Escolhidos: <strong style="color:var(--text)">${escolhidos.length}/${limite}</strong>` + (escolhidos.length >= limite ? ' <span style="color:var(--accent2)">— limite atingido, suba de Nível para desbloquear mais</span>' : '')
        : `Disponível a partir do Nível 4 · Nível atual: ${p.level || 1}`);
  }

  const lista = document.getElementById('talentos-superiores-lista');
  if (!lista) return;
  lista.innerHTML = TALENTOS_SUPERIORES.map(item => {
    const jaTem = escolhidos.some(pas => pas.talentoSuperiorId === item.id);
    const bloqueado = !jaTem && escolhidos.length >= limite;
    let labelBtn = 'Adicionar à ficha';
    if (jaTem) labelBtn = '✓ Já adicionado';
    else if (bloqueado) labelBtn = limite === 0 ? '🔒 Disponível no Nível 4' : `🔒 Limite atingido (${escolhidos.length}/${limite})`;
    const desabilitado = jaTem || bloqueado;
    return `
    <div class="skill-card sk-gray" style="margin:0">
      <div class="sk-name">${item.name}</div>
      <div style="font-size:11px;color:var(--text2);margin-bottom:12px;line-height:1.5;white-space:pre-wrap;max-height:130px;overflow-y:auto;padding-right:4px;">${item.desc}</div>
      <button class="btn ${desabilitado ? '' : 'btn-primary'}" style="width:100%;justify-content:center" ${desabilitado ? 'disabled' : ''} onclick="adicionarTalentoSuperior(${p.id}, '${item.id}')">
        ${labelBtn}
      </button>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════
// MODAL — BANCO DE FEITIÇOS LENDÁRIOS
// ═══════════════════════════════════════
let feiticosLendariosPid = null;

function openFeiticosLendariosModal(pid) {
  feiticosLendariosPid = pid;
  renderFeiticosLendariosModal(pid);
  document.getElementById('modal-feiticos-lendarios-overlay').classList.add('open');
}

function closeFeiticosLendariosModal() {
  const overlay = document.getElementById('modal-feiticos-lendarios-overlay');
  if (overlay) overlay.classList.remove('open');
}

// Repinta o catálogo fixo de Feitiços Lendários (mesmo padrão dos modais de
// Talentos, mas indica também a maestria especial — Intelecto/2 — de cada
// Feitiço, já calculada para o personagem atual).
function renderFeiticosLendariosModal(pid) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;

  const limite = getLimiteFeiticosLendarios(p);
  const escolhidos = getFeiticosLendariosEscolhidos(p);
  const mstLendaria = getMaestriaLendaria(p);

  const progressoEl = document.getElementById('feiticos-lendarios-progresso');
  if (progressoEl) {
    progressoEl.innerHTML = limite > 0
      ? `Escolhidos: <strong style="color:var(--text)">${escolhidos.length}/${limite}</strong>` + (escolhidos.length >= limite ? ' <span style="color:var(--accent2)">— limite atingido</span>' : '') + ` · Maestria Lendária: <strong style="color:var(--text)">+${mstLendaria}</strong> (Intelecto/2)`
      : `Sem acesso ainda — precisa ser Conjurador no Nível 5 ou ter o Talento Superior "Transcendência Mental".`;
  }

  const lista = document.getElementById('feiticos-lendarios-lista');
  if (!lista) return;
  lista.innerHTML = FEITICOS_LENDARIOS.map(item => {
    const jaTem = escolhidos.some(sk => sk.id === 'sk_lendario_' + item.id);
    const bloqueado = !jaTem && escolhidos.length >= limite;
    let labelBtn = 'Adicionar à ficha';
    if (jaTem) labelBtn = '✓ Já adicionado';
    else if (bloqueado) labelBtn = limite === 0 ? '🔒 Sem acesso' : `🔒 Limite atingido (${escolhidos.length}/${limite})`;
    const desabilitado = jaTem || bloqueado;
    return `
    <div class="skill-card sk-blue" style="margin:0">
      <div class="sk-name">${item.name}</div>
      <div class="sk-tags"><span class="sk-tag">${item.cost === 0 ? '0 ações' : item.cost === 1 ? '1 ação' : '2 ações'}</span><span class="sk-tag">${item.usosMax}x/sessão</span><span class="sk-tag sk-tag-mst">🌟 +${mstLendaria} maestria (lendária)</span></div>
      <div style="font-size:11px;color:var(--text2);margin:8px 0 12px;line-height:1.5;white-space:pre-wrap;max-height:130px;overflow-y:auto;padding-right:4px;">${item.desc}</div>
      <button class="btn ${desabilitado ? '' : 'btn-primary'}" style="width:100%;justify-content:center" ${desabilitado ? 'disabled' : ''} onclick="adicionarFeiticoLendario(${p.id}, '${item.id}')">
        ${labelBtn}
      </button>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════
// MODAL — BANCO DE RITUAIS MACABROS
// ═══════════════════════════════════════
let rituaisMacabrosPid = null;

function openRituaisMacabrosModal(pid) {
  rituaisMacabrosPid = pid;
  renderRituaisMacabrosModal(pid);
  document.getElementById('modal-rituais-macabros-overlay').classList.add('open');
}

function closeRituaisMacabrosModal() {
  const overlay = document.getElementById('modal-rituais-macabros-overlay');
  if (overlay) overlay.classList.remove('open');
}

// Repinta o catálogo fixo de Rituais Macabros. Cada card já mostra o bloco
// colapsável de Corromper (custo em dado de Sanidade), igual ao que aparece
// depois na ficha.
function renderRituaisMacabrosModal(pid) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;

  const limite = getLimiteRituaisMacabros(p);
  const escolhidos = getRituaisMacabrosEscolhidos(p);

  const progressoEl = document.getElementById('rituais-macabros-progresso');
  if (progressoEl) {
    progressoEl.innerHTML = limite > 0
      ? `Escolhidos: <strong style="color:var(--text)">${escolhidos.length}/${limite}</strong>` + (escolhidos.length >= limite ? ' <span style="color:var(--accent2)">— limite atingido</span>' : '')
      : `Sem acesso ainda — precisa do Talento Superior "Vínculo Místico".`;
  }

  const lista = document.getElementById('rituais-macabros-lista');
  if (!lista) return;
  lista.innerHTML = RITUAIS_MACABROS.map(item => {
    const jaTem = escolhidos.some(sk => sk.id === 'sk_ritual_' + item.id);
    const bloqueado = !jaTem && escolhidos.length >= limite;
    let labelBtn = 'Adicionar à ficha';
    if (jaTem) labelBtn = '✓ Já adicionado';
    else if (bloqueado) labelBtn = limite === 0 ? '🔒 Sem acesso' : `🔒 Limite atingido (${escolhidos.length}/${limite})`;
    const desabilitado = jaTem || bloqueado;
    return `
    <div class="skill-card sk-gray" style="margin:0">
      <div class="sk-name">${item.name}</div>
      <div class="sk-tags"><span class="sk-tag">${item.cost === 0 ? '0 ações' : item.cost === 1 ? '1 ação' : '2 ações'}</span><span class="sk-tag">${tipoLabel(item)}</span>${item.concedeNota ? `<span class="sk-tag" style="background:var(--bardo-dim);color:#f0dba0">🎵 ${item.concedeNota === 'qualquer' ? 'escolha uma nota' : item.concedeNota}</span>` : ''}</div>
      <div style="font-size:11px;color:var(--text2);margin:8px 0 12px;line-height:1.5;white-space:pre-wrap;max-height:110px;overflow-y:auto;padding-right:4px;">${item.desc}</div>
      ${renderCorromperHtml('modal-' + item.id, item)}
      <button class="btn ${desabilitado ? '' : 'btn-primary'}" style="width:100%;justify-content:center;margin-top:10px" ${desabilitado ? 'disabled' : ''} onclick="adicionarRitualMacabro(${p.id}, '${item.id}')">
        ${labelBtn}
      </button>
    </div>`;
  }).join('');
}

function selColor(c, el) {
  modalColor = c;
  document.querySelectorAll('.color-opt').forEach(x => x.classList.remove('selected'));
  el.classList.add('selected');
}

function updateModal() {
  const tipo = document.getElementById('m-tipo').value;
  document.getElementById('m-usos-row').style.display = (tipo==='luta'||tipo==='sessao') ? 'block' : 'none';
  document.getElementById('m-turnos-row').style.display = tipo==='turno_N' ? 'block' : 'none';
  if (tipo==='luta') document.getElementById('m-usos-label').textContent = 'Usos por luta';
  if (tipo==='sessao') document.getElementById('m-usos-label').textContent = 'Usos por sessão';
}

function saveSkill() {
  const name = document.getElementById('m-name').value.trim();
  if (!name) { document.getElementById('m-name').focus(); return; }

  const desc = document.getElementById('m-desc') ? document.getElementById('m-desc').value.trim() : '';
  const tipo = document.getElementById('m-tipo').value;
  const cost = parseInt(document.getElementById('m-cost').value);
  const usosMax = parseInt(document.getElementById('m-usos').value) || 2;
  const turnosRecarga = parseInt(document.getElementById('m-turnos').value) || 2;

  const p = PLAYERS.find(x => x.id === modalPid);
  if (p) {
    if (modalSkid) {
      const sk = p.skills.find(x => x.id === modalSkid);
      if (sk) {
        sk.name = name; sk.desc = desc; sk.color = modalColor; sk.cost = cost; sk.tipo = tipo;
        if (tipo === 'infinite') { sk.usosMax = 99; sk.usosAtuais = 99; sk.cdRestante = 0; }
        else { sk.usosMax = usosMax; sk.turnosRecarga = turnosRecarga; sk.usosAtuais = Math.min(sk.usosAtuais, usosMax); }
      }
    } else {
      p.skills.push({
        id: 'sk_' + Date.now(),
        name, desc, color: modalColor, cost, tipo,
        usosMax: tipo==='infinite'?99:usosMax,
        usosAtuais: tipo==='infinite'?99:usosMax,
        cdRestante: 0, turnosRecarga
      });
    }
    saveState();
    renderAll();
  }
  closeModal();
}

// ═══════════════════════════════════════
// MODAL PASSIVA / TALENTO
// ═══════════════════════════════════════
function openPassivaModal(pid) {
  modalPassivaPid = pid;
  modalPassivaId = null;

  document.getElementById('modal-passiva-title').textContent = 'Nova Passiva / Talento';
  document.getElementById('mp-btn-del').style.display = 'none';
  document.getElementById('mp-btn-save').textContent = 'Adicionar';

  document.getElementById('mp-name').value = '';
  document.getElementById('mp-desc').value = '';

  document.getElementById('modal-passiva-overlay').classList.add('open');
  setTimeout(() => document.getElementById('mp-name').focus(), 50);
}

function editPassiva(pid, pasid) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  const pas = (p.passivas || []).find(x => x.id === pasid);
  if (!pas) return;

  modalPassivaPid = pid;
  modalPassivaId = pasid;

  document.getElementById('modal-passiva-title').textContent = 'Editar Passiva / Talento';
  document.getElementById('mp-btn-del').style.display = 'inline-block';
  document.getElementById('mp-btn-save').textContent = 'Salvar';

  document.getElementById('mp-name').value = pas.name;
  document.getElementById('mp-desc').value = pas.desc || '';

  document.getElementById('modal-passiva-overlay').classList.add('open');
  setTimeout(() => document.getElementById('mp-name').focus(), 50);
}

function deletePassiva() {
  if (!modalPassivaId || !modalPassivaPid) return;
  if (!confirm('Tem certeza que deseja excluir esta passiva? Esta ação não pode ser desfeita.')) return;
  const p = PLAYERS.find(x => x.id === modalPassivaPid);
  if (p) {
    const pas = (p.passivas || []).find(x => x.id === modalPassivaId);
    if (pas && pas.racialId) {
      if (!Array.isArray(p.racialPassivasRemovidas)) p.racialPassivasRemovidas = [];
      if (!p.racialPassivasRemovidas.includes(pas.racialId)) p.racialPassivasRemovidas.push(pas.racialId);
    }
    if (pas && pas.subclasseId) {
      if (!Array.isArray(p.subclassePassivasRemovidas)) p.subclassePassivasRemovidas = [];
      if (!p.subclassePassivasRemovidas.includes(pas.subclasseId)) p.subclassePassivasRemovidas.push(pas.subclasseId);
    }
    if (pas && pas.classeId) {
      if (!Array.isArray(p.classePassivasRemovidas)) p.classePassivasRemovidas = [];
      if (!p.classePassivasRemovidas.includes(pas.classeId)) p.classePassivasRemovidas.push(pas.classeId);
    }
    p.passivas = (p.passivas || []).filter(x => x.id !== modalPassivaId);
    saveState();
    renderAll();
  }
  closePassivaModal();
}

function closePassivaModal() {
  const overlay = document.getElementById('modal-passiva-overlay');
  if (overlay) overlay.classList.remove('open');
}

function savePassiva() {
  const name = document.getElementById('mp-name').value.trim();
  if (!name) { document.getElementById('mp-name').focus(); return; }
  const desc = document.getElementById('mp-desc').value.trim();

  const p = PLAYERS.find(x => x.id === modalPassivaPid);
  if (p) {
    if (!Array.isArray(p.passivas)) p.passivas = [];
    if (modalPassivaId) {
      const pas = p.passivas.find(x => x.id === modalPassivaId);
      if (pas) { pas.name = name; pas.desc = desc; }
    } else {
      p.passivas.push({ id: 'pas_' + Date.now(), name, desc });
    }
    saveState();
    renderAll();
  }
  closePassivaModal();
}

// Narrador: alterna a exibição das passivas de um personagem específico (sem sincronizar entre dispositivos)
function toggleNarPassivas(pid) {
  narPassivasExpanded[pid] = !narPassivasExpanded[pid];
  renderAll();
}

function toggleNarSkills(pid) {
  narSkillsExpanded[pid] = !narSkillsExpanded[pid];
  renderAll();
}

// Narrador: alterna a exibição do Inventário de um personagem específico
// (mesmo componente usado no jogador — ver renderInventarioArea).
function toggleNarInventario(pid) {
  narInventarioExpanded[pid] = !narInventarioExpanded[pid];
  renderAll();
}

function toggleJogSkillGroup(cor) {
  jogSkillsCollapsed[cor] = !jogSkillsCollapsed[cor];
  renderJogador();
}

// ─── Seletor de Classe / Subclasse ───────────────────────────────────────────
// Popula os botões de classe (c-class-btns) e limpa as subclasses.
// Ao selecionar uma classe, chama updateSubclasseOpts() para preencher as subs.
function buildClassSelector() {
  const btnWrap = document.getElementById('c-class-btns');
  const subWrap = document.getElementById('c-sub-btns');
  if (!btnWrap) return;

  btnWrap.innerHTML = CLASSES.map(cls =>
    `<button type="button" class="cls-btn" data-cls="${cls.name}"
       onclick="selectClasse('${cls.name}')">${cls.name}</button>`
  ).join('');
  if (subWrap) subWrap.innerHTML = '';
  const note = document.getElementById('c-bruxo-note');
  if (note) note.style.display = 'none';
  updateDeusSelector(null, null);
}

function selectClasse(clsName, keepSub) {
  document.querySelectorAll('.cls-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.cls === clsName)
  );
  const cls = CLASSES.find(c => c.name === clsName);
  if (!cls) return;
  const subWrap = document.getElementById('c-sub-btns');
  if (!subWrap) return;
  const note = document.getElementById('c-bruxo-note');
  if (note) note.style.display = (clsName === 'Bruxo') ? 'block' : 'none';
  const bardoNote = document.getElementById('c-bardo-note');
  if (bardoNote) bardoNote.style.display = (clsName === 'Bardo') ? 'block' : 'none';
  updateDeusSelector(clsName, null);
  const ATTR_LABEL = { agi: 'AGI', forca: 'FOR', intel: 'INT' };
  const ATTR_COLOR = { agi: 'var(--green)', forca: 'var(--red)', intel: 'var(--blue)' };
  subWrap.innerHTML = cls.subs.map(sub =>
    `<button type="button" class="sub-btn" data-sub="${sub.name}"
       onclick="selectSubclasse('${sub.name}')"
       title="Atributo principal: ${ATTR_LABEL[sub.attr]}">
       ${sub.name}
       <span class="sub-attr-badge" style="color:${ATTR_COLOR[sub.attr]}">${ATTR_LABEL[sub.attr]}</span>
     </button>`
  ).join('');
  if (!keepSub) {
    document.querySelectorAll('.sub-btn').forEach(b => b.classList.remove('active'));
  }
  // Trocar de Classe geralmente limpa a Subclasse escolhida — recalcula a
  // Vida base (ex: deixa de ter o bônus de Maestro Macabro).
  if (typeof resetHpParaBaseEfetiva === 'function') resetHpParaBaseEfetiva();
}

// Mostra/monta o seletor de Divindade (só relevante para Clérigo). Reaproveita
// o mesmo padrão visual do seletor de Origem.
function updateDeusSelector(clsName, selectedDeus) {
  const container = document.getElementById('c-deus-container');
  if (!container) return;
  if (clsName !== 'Clérigo') {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }
  container.style.display = 'block';
  container.innerHTML = `
    <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:6px;">Divindade</label>
    <div class="cls-btn-group" id="c-deus-btns" style="flex-wrap:wrap;gap:6px">
      ${DEUSES_LISTA.map(nome =>
        `<button type="button" class="cls-btn ${nome === selectedDeus ? 'active' : ''}" data-deus="${nome}" onclick="selectDeus('${nome}')">${nome}</button>`
      ).join('')}
    </div>
    <input type="hidden" id="c-deus" value="${selectedDeus || ''}">
  `;
}

function selectDeus(nome) {
  const hiddenEl = document.getElementById('c-deus');
  if (hiddenEl) hiddenEl.value = nome;
  document.querySelectorAll('#c-deus-btns .cls-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.deus === nome)
  );
}

function selectSubclasse(subName) {
  document.querySelectorAll('.sub-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.sub === subName)
  );
  // Maestro Macabro concede +20 de Vida base — recalcula ao trocar de Subclasse.
  if (typeof resetHpParaBaseEfetiva === 'function') resetHpParaBaseEfetiva();
}

// Retorna a subclasse atualmente selecionada no modal (ou '' se nenhuma)
function getSelectedSubclasse() {
  const b = document.querySelector('.sub-btn.active');
  return b ? b.dataset.sub : '';
}

// Define classe+subclasse no modal (ex: ao editar um personagem existente)
function setClasseSubclasse(clsName, subName) {
  buildClassSelector();
  if (clsName) selectClasse(clsName, true);
  if (subName) selectSubclasse(subName);
}

// ─── Seletor de Origem Racial ─────────────────────────────────────────────────
// Atualiza (ou cria) o bloco de seleção de Origem dentro do modal de personagem,
// logo abaixo do seletor de Raça. Chamado sempre que a raça muda.
function updateOrigemSelector(raceName, selectedOrigemId) {
  // Troll tem Vida base 5 ao invés de 10 — recalcula sempre que a Raça muda.
  if (typeof resetHpParaBaseEfetiva === 'function') resetHpParaBaseEfetiva();
  // Troll também escolhe em qual atributo recai o +1 de Maestria da Tatuagem
  // Rúnica — mostra/esconde o seletor correspondente.
  const trollWrap = document.getElementById('c-troll-maestria-container');
  if (trollWrap) trollWrap.style.display = (raceName === 'Troll') ? '' : 'none';
  const container = document.getElementById('c-origem-container');
  if (!container) return;
  const origens = getRaceOrigens(raceName);
  if (!origens.length) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'block';
  const origemLabel = raceName === 'Dragão' ? 'Revoada' : 'Origem';
  container.innerHTML = `
    <label class="form-label" style="margin-bottom:6px;display:block">${origemLabel}</label>
    <div class="cls-btn-group" id="c-origem-btns" style="flex-wrap:wrap;gap:6px">
      ${origens.map(o => `
        <button type="button"
          class="cls-btn ${selectedOrigemId === o.id ? 'active' : ''}"
          data-origem="${o.id}"
          onclick="selectOrigem('${o.id}')"
          title="${o.desc}">
          ${o.name}
        </button>`).join('')}
    </div>
    <input type="hidden" id="c-origem" value="${selectedOrigemId || ''}">
    <div id="c-origem-desc" style="font-size:11px;color:var(--text2);margin-top:6px;line-height:1.5;min-height:16px">
      ${selectedOrigemId ? (() => {
        const o = origens.find(x => x.id === selectedOrigemId);
        if (!o) return '';
        const item = o.skill || o.passiva;
        const tipo = o.skill ? '🗡 Habilidade' : '✨ Passiva';
        return item ? `<strong>${tipo} — ${item.name}:</strong> ${item.desc}` : '';
      })() : ''}
    </div>`;
}

function selectOrigem(origemId) {
  const hiddenEl = document.getElementById('c-origem');
  if (hiddenEl) hiddenEl.value = origemId;
  document.querySelectorAll('#c-origem-btns .cls-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.origem === origemId)
  );
  // Atualiza descrição da passiva ou habilidade
  const descEl = document.getElementById('c-origem-desc');
  if (descEl) {
    const race = getRacaSelecionada();
    const origens = getRaceOrigens(race);
    const o = origens.find(x => x.id === origemId);
    if (o) {
      const item = o.skill || o.passiva;
      const tipo = o.skill ? '🗡 Habilidade' : '✨ Passiva';
      descEl.innerHTML = item ? `<strong>${tipo} — ${item.name}:</strong> ${item.desc}` : '';
    } else {
      descEl.innerHTML = '';
    }
  }
}

// ─── Sistema de Point Buy ───────────────────────────────────────────────────
// Pontos base por nível: 35 no Nv 1, +5 por nível adicional
// Base fixa: HP 10, AGI/FOR/INT 5 cada → total base gasto = 25
// Atributos (AGI/FOR/INT) têm um limite por Nível: 20 no Nv 1, subindo +5 a
// cada Nível (25 no Nv 2, 30 no Nv 3, 35 no Nv 4, 40 no Nv 5 — nível máximo).
//
// Peculiaridades de Vida base por Raça/Subclasse:
// - Troll ("Tatuagem Rúnica"): Vida base é 5 ao invés de 10.
// - Maestro Macabro ("Maestro Demoníaco"): +20 de Vida base.
// As duas se acumulam (ex: Troll Maestro Macabro começa com 25 de Vida base).
const POINT_BUY_BASE = 35;
const ATTR_BASE_HP = 10;
const ATTR_BASE_STAT = 5;
const ATTR_LIMITE_NV1 = 20;
const ATTR_LIMITE_POR_NIVEL = 5;
const TROLL_BASE_HP = 5;
const MAESTRO_MACABRO_HP_BONUS = 20;
// Tauren ("De bem com a Vida"): +4 de Vida a cada Nível, aplicado automaticamente
// (fora do orçamento normal de pontos de atributo). Usado tanto ao subir de
// Nível (ver onLevelUp) quanto ao já criar um personagem Tauren acima do
// Nível 1 (ver getEffectiveBaseHp) — nesse caso os níveis "pulados" já
// concedem o bônus acumulado desde a criação.
const TAUREN_HP_POR_NIVEL = 4;
function getTaurenBonusNivel(level) {
  return Math.max(0, (level || 1) - 1) * TAUREN_HP_POR_NIVEL;
}

// Calcula a Vida base efetiva dado um nome de Raça e de Subclasse.
function getBaseHpFor(race, subclasse) {
  let base = (race === 'Troll') ? TROLL_BASE_HP : ATTR_BASE_HP;
  if (subclasse === 'Maestro Macabro') base += MAESTRO_MACABRO_HP_BONUS;
  return base;
}

// Vida base efetiva para o estado atual do formulário (funciona tanto na
// criação quanto na edição, já que ambas usam os mesmos campos/botões de
// Raça e Subclasse — o campo de Vida em si não é sobrescrito aqui, apenas
// usado para calcular custo/limite do point-buy). Para Tauren, já soma o
// bônus automático de Vida por Nível (mesmo criando o personagem direto
// acima do Nível 1).
function getEffectiveBaseHp() {
  const race = getRacaSelecionada();
  const sub = (typeof getSelectedSubclasse === 'function') ? getSelectedSubclasse() : '';
  let base = getBaseHpFor(race, sub);
  if (race === 'Tauren') {
    const level = modalCharId ? (PLAYERS.find(x => x.id === modalCharId)?.level || 1) : creationLevel;
    base += getTaurenBonusNivel(level);
  }
  return base;
}

function getAttrLimiteNivel(level) {
  return ATTR_LIMITE_NV1 + (Math.max(1, level || 1) - 1) * ATTR_LIMITE_POR_NIVEL;
}

// Chamado pelos botões de Nível na criação de personagem novo (Nv 1 a 5).
// Reseta os atributos pra base ao trocar de Nível, pra evitar estados
// inconsistentes (ex: pontos investidos que já não caberiam no novo total).
function selectCreationLevel(n) {
  creationLevel = Math.max(1, Math.min(5, n));
  document.querySelectorAll('.creation-level-btn').forEach(b =>
    b.classList.toggle('active', parseInt(b.dataset.lvl) === creationLevel)
  );
  const hpEl = document.getElementById('c-hp');
  const agiEl = document.getElementById('c-agi');
  const forEl = document.getElementById('c-for');
  const intEl = document.getElementById('c-int');
  if (hpEl) hpEl.value = getEffectiveBaseHp();
  if (agiEl) agiEl.value = ATTR_BASE_STAT;
  if (forEl) forEl.value = ATTR_BASE_STAT;
  if (intEl) intEl.value = ATTR_BASE_STAT;
  updatePointBuy(creationLevel);
  if (creationLevel < 2) wizardTalentosEscolhidos = [];
  if (creationLevel < 4) wizardTalentosSuperioresEscolhidos = [];
  if (typeof renderWizardTalentosStep === 'function') renderWizardTalentosStep();
  if (typeof renderWizardTalentosSuperioresStep === 'function') renderWizardTalentosSuperioresStep();
  if (typeof renderWizardFeiticosLendariosStep === 'function') renderWizardFeiticosLendariosStep();
}

// Reseta apenas o campo de Vida para a base efetiva atual (chamado sempre
// que a Raça ou a Subclasse mudam durante a criação, já que ambas podem
// alterar a Vida base — Troll e Maestro Macabro). Não faz nada na edição de
// um personagem já existente (nesse caso o valor vem da ficha salva).
function resetHpParaBaseEfetiva() {
  if (modalCharId) return;
  const hpEl = document.getElementById('c-hp');
  if (hpEl) hpEl.value = getEffectiveBaseHp();
  if (typeof updatePointBuy === 'function') updatePointBuy();
}

function getPointBuyTotal(level) {
  return POINT_BUY_BASE + (Math.max(1, level || 1) - 1) * POINT_BUY_PER_LEVEL;
}

// Calcula quantos pontos foram gastos ALÉM das bases fixas
function getPointsSpent() {
  const baseHp = getEffectiveBaseHp();
  const hp    = parseInt(document.getElementById('c-hp')?.value)  || baseHp;
  const agi   = parseInt(document.getElementById('c-agi')?.value) || ATTR_BASE_STAT;
  const forca = parseInt(document.getElementById('c-for')?.value) || ATTR_BASE_STAT;
  const intel = parseInt(document.getElementById('c-int')?.value) || ATTR_BASE_STAT;
  return (hp - baseHp) + (agi - ATTR_BASE_STAT) + (forca - ATTR_BASE_STAT) + (intel - ATTR_BASE_STAT);
}

// Tauren possui a passiva "De bem com a Vida": ao subir de Nível recebe +4
// de Vida automaticamente (ver onLevelUp) e, em contrapartida, não pode mais
// investir Pontos de Atributo em Vida a partir do Nível 2 — mas isso só vale
// depois que o personagem já foi criado (edição). Durante a CRIAÇÃO ainda é
// possível investir pontos em Vida normalmente, mesmo começando acima do
// Nível 1 — só que, nesse caso, a Vida fica limitada a
// TAUREN_HP_CRIACAO_MAX (ver stepStat/getMaxHpCriacao).
function isTaurenHpLocked() {
  if (!modalCharId) return false;
  const p = PLAYERS.find(x => x.id === modalCharId);
  return !!p && p.race === 'Tauren' && (p.level || 1) > 1;
}

// Teto de PONTOS INVESTIDOS em Vida, exclusivo da criação de personagem
// (Tauren): mesmo que o point-buy do Nível permitisse mais, o jogador não
// pode investir mais que 35 pontos em Vida além da base efetiva (que já
// inclui o bônus automático de Nível — ver getEffectiveBaseHp). Ex: Tauren
// Nv2 → base 10 + bônus de Nível 4 + até 35 investidos = 49 de Vida máxima
// na criação. Não se aplica depois de salvo (edição).
const TAUREN_PONTOS_VIDA_CRIACAO_MAX = 35;
function getMaxHpCriacao(race) {
  if (modalCharId || race !== 'Tauren') return Infinity;
  return getEffectiveBaseHp() + TAUREN_PONTOS_VIDA_CRIACAO_MAX;
}

// Botões +/− para cada atributo com point-buy
function stepStat(field, delta) {
  const input = document.getElementById('c-' + field);
  if (!input) return;

  const base = field === 'hp' ? getEffectiveBaseHp() : ATTR_BASE_STAT;
  const cur  = parseInt(input.value) || base;
  const next = cur + delta;

  // NPC: Narrador pode investir quantos pontos quiser em qualquer atributo,
  // sem teto de Nível nem de orçamento — só não deixa ir abaixo de 1.
  if (isWizardTargetNPC()) {
    if (next < 1) return;
    input.value = next;
    updatePointBuy();
    return;
  }

  if (field === 'hp' && delta > 0 && isTaurenHpLocked()) return;

  const level = modalCharId ? (PLAYERS.find(x => x.id === modalCharId)?.level || 1) : creationLevel;
  const total = getPointBuyTotal(level);
  const limite = getAttrLimiteNivel(level);

  // Não vai abaixo da base
  if (next < base) return;
  // Limite de atributo do Nível atual (20 no Nv1, +5 por Nível)
  if (field !== 'hp' && next > limite) return;
  // Tauren: teto de Vida exclusivo da criação de personagem (35)
  if (field === 'hp') {
    const race = getRacaSelecionada();
    if (next > getMaxHpCriacao(race)) return;
  }
  // Não gasta mais pontos do que o disponível
  const spent = getPointsSpent();
  const left  = total - spent;
  if (delta > 0 && left <= 0) return;

  input.value = next;
  updatePointBuy();
}

function updatePointBuy(levelOverride) {
  // NPC: sem teto de pontos — mostra a barra sempre cheia/verde, os botões
  // de +/- nunca ficam desabilitados por falta de pontos, e cada campo só é
  // limitado por não poder ir abaixo de 1 (ver stepStat).
  if (isWizardTargetNPC()) {
    const baseHpNpc = getEffectiveBaseHp();
    const fillEl = document.getElementById('c-points-bar-fill');
    if (fillEl) { fillEl.style.width = '100%'; fillEl.style.background = 'var(--green)'; }
    const dispEl = document.getElementById('c-points-display');
    if (dispEl) { dispEl.textContent = 'Sem limite (NPC)'; dispEl.style.color = 'var(--green)'; }
    const hintEl = document.getElementById('c-points-hint');
    if (hintEl) hintEl.textContent = 'NPC: sem Nível e sem teto de pontos — distribua Vida, AGI, FOR e INT como o Narrador quiser.';
    ['agi','for','int'].forEach(a => {
      const lbl = document.getElementById(`c-${a}-limit`);
      if (lbl) lbl.style.display = 'none';
    });
    ['hp','agi','for','int'].forEach(key => {
      const incBtn = document.getElementById(`c-${key}-inc`);
      const decBtn = document.getElementById(`c-${key}-dec`);
      const inputEl = document.getElementById(`c-${key}`);
      const base = key === 'hp' ? baseHpNpc : ATTR_BASE_STAT;
      const val  = parseInt(inputEl?.value) || base;
      const costEl = document.getElementById(`c-${key}-cost`);
      if (costEl) { const cost = val - base; costEl.textContent = cost !== 0 ? (cost > 0 ? `+${cost} pts` : `${cost} pts`) : '—'; costEl.style.color = cost !== 0 ? 'var(--accent2)' : 'var(--text3)'; }
      if (incBtn) { incBtn.disabled = false; incBtn.style.opacity = '1'; incBtn.style.cursor = 'pointer'; }
      if (decBtn) { const atMin = val <= 1; decBtn.disabled = atMin; decBtn.style.opacity = atMin ? '0.35' : '1'; decBtn.style.cursor = atMin ? 'not-allowed' : 'pointer'; }
    });
    return;
  }

  let level = levelOverride;
  if (level == null) {
    if (modalCharId) {
      const p = PLAYERS.find(x => x.id === modalCharId);
      level = p ? (p.level || 1) : 1;
    } else {
      level = creationLevel;
    }
  }

  const total  = getPointBuyTotal(level);
  const baseHp = getEffectiveBaseHp();
  const hp     = parseInt(document.getElementById('c-hp')?.value)  || baseHp;
  const agi    = parseInt(document.getElementById('c-agi')?.value) || ATTR_BASE_STAT;
  const forca  = parseInt(document.getElementById('c-for')?.value) || ATTR_BASE_STAT;
  const intel  = parseInt(document.getElementById('c-int')?.value) || ATTR_BASE_STAT;
  const costs  = {
    hp:  hp    - baseHp,
    agi: agi   - ATTR_BASE_STAT,
    for: forca - ATTR_BASE_STAT,
    int: intel - ATTR_BASE_STAT,
  };
  const spent = costs.hp + costs.agi + costs.for + costs.int;
  const left  = total - spent;
  const limite = getAttrLimiteNivel(level);

  // Barra de progresso
  const pct  = Math.max(0, Math.min(100, (left / total) * 100));
  const barColor = left < 0 ? '#f08080' : left === 0 ? 'var(--green)' : 'var(--accent2)';
  const fillEl = document.getElementById('c-points-bar-fill');
  if (fillEl) { fillEl.style.width = pct + '%'; fillEl.style.background = barColor; }

  // Texto do contador
  const dispEl = document.getElementById('c-points-display');
  if (dispEl) { dispEl.textContent = left + ' / ' + total; dispEl.style.color = left < 0 ? '#f08080' : left === 0 ? 'var(--green)' : 'var(--accent2)'; }

  // Hint
  const hintEl = document.getElementById('c-points-hint');
  const taurenLocked = isTaurenHpLocked();
  const raceAtualHint = getRacaSelecionada();
  const maxHpCriacaoHint = getMaxHpCriacao(raceAtualHint);
  if (hintEl) hintEl.textContent = taurenLocked
    ? `Base fixa: Vida ${baseHp} · AGI 5 · FOR 5 · INT 5. Tauren não pode investir pontos em Vida a partir do Nível 2 (recebe +4 automático a cada Nível). Limite de ${limite} por atributo no Nv ${level}.`
    : (maxHpCriacaoHint < Infinity
      ? `Base fixa: Vida ${baseHp} · AGI 5 · FOR 5 · INT 5. Limite de ${limite} por atributo no Nv ${level}. Vida limitada a ${maxHpCriacaoHint} durante a criação.`
      : `Base fixa: Vida ${baseHp} · AGI 5 · FOR 5 · INT 5. Limite de ${limite} por atributo no Nv ${level}.`);

  // Labels de limite (mostra o valor atual, escalando com o Nível)
  ['agi','for','int'].forEach(a => {
    const lbl = document.getElementById(`c-${a}-limit`);
    if (lbl) { lbl.style.display = ''; lbl.textContent = `(máx ${limite})`; }
  });

  // Custo individual por campo
  Object.entries(costs).forEach(([key, cost]) => {
    const el = document.getElementById(`c-${key}-cost`);
    if (el) {
      el.textContent = cost > 0 ? `+${cost} pts` : '—';
      el.style.color = cost > 0 ? 'var(--accent2)' : 'var(--text3)';
    }
  });

  // Botão + bloqueado se não há pontos OU se atingiu limite Nv1 (ou, no caso
  // da Vida do Tauren durante a criação, o teto de 35)
  const noPoints = left <= 0;
  ['hp','agi','for','int'].forEach(key => {
    const incBtn = document.getElementById(`c-${key}-inc`);
    const decBtn = document.getElementById(`c-${key}-dec`);
    const inputEl = document.getElementById(`c-${key}`);
    const base = key === 'hp' ? baseHp : ATTR_BASE_STAT;
    const val  = parseInt(inputEl?.value) || base;
    const atLimit = key !== 'hp' ? (val >= limite) : (val >= maxHpCriacaoHint);
    if (incBtn) {
      const blocked = noPoints || atLimit || (key === 'hp' && taurenLocked);
      incBtn.disabled = blocked;
      incBtn.style.opacity = blocked ? '0.35' : '1';
      incBtn.style.cursor  = blocked ? 'not-allowed' : 'pointer';
    }
    if (decBtn) {
      const atBase = val <= base;
      decBtn.disabled = atBase;
      decBtn.style.opacity = atBase ? '0.35' : '1';
      decBtn.style.cursor  = atBase ? 'not-allowed' : 'pointer';
    }
  });
}

// ─── Assistente de Criação (Wizard) ─────────────────────────────────────────
// Na criação de um novo personagem, o formulário é dividido em 4 passos:
// 1) Nome, 2) Raça, 3) Classe, 4) Distribuição de pontos.
// Na edição de um personagem existente, todos os campos ficam visíveis de uma vez
// (sem navegação por passos) — ver setModalMode().
let wizardStep = 1;

function setModalMode(isEdit) {
  const modal = document.querySelector('#modal-char-overlay .modal');
  if (!modal) return;
  modal.classList.toggle('editmode', !!isEdit);
  modal.classList.toggle('wizard', !isEdit);
}

function showWizardStep(n) {
  wizardStep = n;
  document.querySelectorAll('.modal-step').forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.step, 10) === n);
  });
  document.querySelectorAll('.wstep').forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.step, 10) <= n);
  });
  // Rola o modal para o topo a cada troca de passo
  const modal = document.querySelector('#modal-char-overlay .modal');
  if (modal) modal.scrollTop = 0;
}

function wizardNext() {
  // Validação de cada passo antes de avançar
  if (wizardStep === 1) {
    const name = document.getElementById('c-name').value.trim();
    if (!name) {
      const input = document.getElementById('c-name');
      input.focus();
      input.style.borderColor = '#f08080';
      setTimeout(() => { input.style.borderColor = ''; }, 1200);
      return;
    }
  }
  if (wizardStep === 2) {
    const race = getRacaSelecionada();
    if (!race) {
      alert('Escolha uma raça para continuar.');
      return;
    }
  }
  if (wizardStep === 3) {
    const sub = getSelectedSubclasse();
    if (!sub) {
      alert('Escolha uma classe para continuar.');
      return;
    }
  }
  showWizardStep(Math.min(4, wizardStep + 1));
}

function wizardBack() {
  showWizardStep(Math.max(1, wizardStep - 1));
}

// ─── Modal Personagem ──────────────────────────────────────────────────────────
function openCharModal(isNPC) {
  modalCharId = null;
  wizardIsNPC = !!isNPC;
  document.getElementById('modal-char-overlay').classList.add('open');
  const titleEl = document.getElementById('modal-char-title');
  if (titleEl) titleEl.textContent = wizardIsNPC ? 'Novo NPC' : 'Novo Personagem';
  const saveBtn = document.getElementById('c-btn-save');
  if (saveBtn) saveBtn.textContent = 'Próximo';
  document.getElementById('c-name').value = '';
  setRaceSelectValue('');
  updateOrigemSelector('', null);
  buildClassSelector();
  document.getElementById('c-hp').value = '10';
  const trollMaestriaElNovo = document.getElementById('c-troll-maestria');
  if (trollMaestriaElNovo) trollMaestriaElNovo.value = 'agi';
  document.getElementById('c-ins').value = '0';
  document.getElementById('c-agi').value = '5';
  document.getElementById('c-for').value = '5';
  document.getElementById('c-int').value = '5';
  document.getElementById('c-passos').value = '10';
  document.getElementById('c-dinheiro').value = '100';
  const extraFields = document.getElementById('c-extra-fields');
  if (extraFields) extraFields.style.display = 'none';
  creationLevel = 1;
  document.querySelectorAll('.creation-level-btn').forEach(b =>
    b.classList.toggle('active', parseInt(b.dataset.lvl) === 1)
  );
  const levelContainerNovo = document.getElementById('c-creation-level-container');
  if (levelContainerNovo) levelContainerNovo.style.display = wizardIsNPC ? 'none' : '';
  const npcTipoContainerNovo = document.getElementById('c-npc-tipo-container');
  if (npcTipoContainerNovo) npcTipoContainerNovo.classList.toggle('hidden', !wizardIsNPC);
  selectNpcTipo('aliado');
  updatePointBuy(1);
  wizardSkillsEscolhidas = [];
  wizardBancoTabAtiva = null;
  wizardTalentosEscolhidos = [];
  wizardTalentosSuperioresEscolhidos = [];
  wizardFeiticosLendariosEscolhidos = [];
  wizardRituaisMacabrosEscolhidos = [];
  wizardArmaduraEscolhidaId = null;
  wizardElmoEscolhidaId = null;
  wizardArmaEscolhidaId = null;
  wizardArmaEscolhidaTipo = null;
  setModalMode(false);
  showWizardStep(1);
  setTimeout(() => document.getElementById('c-name').focus(), 50);
}

// Retorna o nome da raça atualmente selecionada no wizard — se for "Outros"
// (raça customizada, digitada livremente pelo Narrador), lê do campo de
// texto correspondente em vez do valor do <select>.
function getRacaSelecionada() {
  const sel = document.getElementById('c-race');
  if (!sel) return '';
  if (sel.value === '__outros__') {
    const outros = document.getElementById('c-race-outros');
    return (outros && outros.value.trim()) || '';
  }
  return sel.value;
}

// Chamado pelo onchange do <select> de Raça: mostra/esconde o campo de texto
// livre quando "Outros" é selecionado, e atualiza o seletor de Origem (raças
// customizadas não têm Origens cadastradas, então fica vazio).
function onRaceSelectChange(value) {
  const outrosInput = document.getElementById('c-race-outros');
  if (value === '__outros__') {
    if (outrosInput) { outrosInput.style.display = ''; outrosInput.focus(); }
    updateOrigemSelector('', null);
  } else {
    if (outrosInput) { outrosInput.style.display = 'none'; outrosInput.value = ''; }
    updateOrigemSelector(value, null);
  }
}

// Define o valor do <select> de Raça. Se a ficha tiver uma raça que não está
// na lista fixa atual (raça customizada "Outros", digitada pelo Narrador, ou
// uma ficha antiga de texto livre), seleciona a opção "Outros" e preenche o
// campo de texto com o nome salvo, em vez de criar uma opção temporária.
function setRaceSelectValue(raca) {
  const sel = document.getElementById('c-race');
  if (!sel) return;
  const outrosInput = document.getElementById('c-race-outros');
  const existeOpcao = Array.from(sel.options).some(o => o.value === raca && raca !== '__outros__');
  if (raca && !existeOpcao) {
    sel.value = '__outros__';
    if (outrosInput) { outrosInput.style.display = ''; outrosInput.value = raca; }
  } else {
    sel.value = raca || '';
    if (outrosInput) { outrosInput.style.display = 'none'; outrosInput.value = ''; }
  }
}

function editCharacter(id) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return;
  modalCharId = id;
  wizardIsNPC = !!p.isNPC;
  document.getElementById('modal-char-overlay').classList.add('open');
  const titleEl = document.getElementById('modal-char-title');
  if (titleEl) titleEl.textContent = wizardIsNPC ? 'Editar NPC' : 'Editar Personagem';
  const saveBtn = document.getElementById('c-btn-save');
  if (saveBtn) saveBtn.textContent = 'Salvar';
  document.getElementById('c-name').value = p.name;
  setRaceSelectValue(p.race);
  updateOrigemSelector(p.race, p.origemId || null);
  // Restaura classe/subclasse: cls guarda a subclasse, classeBase guarda a classe-pai.
  // Para fichas antigas (texto livre), tenta derivar a base pelo nome da subclasse.
  const clsBase = p.classeBase || getBaseClass(p.cls) || null;
  setClasseSubclasse(clsBase, p.cls);
  updateDeusSelector(clsBase, p.deus || null);
  document.getElementById('c-hp').value = p.hpMax;
  const trollMaestriaEl = document.getElementById('c-troll-maestria');
  if (trollMaestriaEl) trollMaestriaEl.value = p.trollMaestriaEscolha || 'agi';
  document.getElementById('c-ins').value = p.ins;
  document.getElementById('c-agi').value = p.agi;
  document.getElementById('c-for').value = p.forca;
  document.getElementById('c-int').value = p.intel;
  document.getElementById('c-passos').value = (typeof p.passosBase === 'number') ? p.passosBase : p.passos;
  document.getElementById('c-dinheiro').value = (typeof p.dinheiro === 'number') ? p.dinheiro : 100;
  const extraFields = document.getElementById('c-extra-fields');
  if (extraFields) extraFields.style.display = '';
  const npcTipoContainerEdit = document.getElementById('c-npc-tipo-container');
  if (npcTipoContainerEdit) npcTipoContainerEdit.classList.toggle('hidden', !wizardIsNPC);
  selectNpcTipo(p.npcTipo || 'aliado');
  updatePointBuy(p.level || 1);
  setModalMode(true);
}

function deleteCharacter(id) {
  if (!confirm('Tem certeza que deseja excluir este personagem? Esta ação não pode ser desfeita.')) return;
  PLAYERS = PLAYERS.filter(x => x.id !== id);
  // Tira também da Iniciativa em andamento — só faz sentido pra exclusões
  // reais da campanha, nunca ao excluir um NPC-modelo do Banco (onde os ids
  // são de um array totalmente separado e podem coincidir por acaso).
  if (!bankModeActive) {
    const entradaRemovida = INITIATIVE.find(e => (e.tipo === 'jogador' || e.tipo === 'npc') && e.playerId === id);
    if (entradaRemovida) {
      INITIATIVE = INITIATIVE.filter(e => e.id !== entradaRemovida.id);
      if (turnoAtualId === entradaRemovida.id) turnoAtualId = null;
    }
  }
  saveState();
  const psel = document.getElementById('psel');
  if (psel && PLAYERS.length > 0) psel.value = PLAYERS[0].id;
  renderAll();
}

function closeCharModal() {
  const overlay = document.getElementById('modal-char-overlay');
  if(overlay) overlay.classList.remove('open');
}

// Valida a distribuição de pontos de atributo (Vida/AGI/FOR/INT) para o
// Nível informado. Retorna true/false; em caso de falha, já mostra o alerta
// explicando o motivo. Reaproveitada tanto na transição do passo 4 → 5 do
// wizard de criação quanto no salvamento final (edição ou criação direta).
function validatePointBuyStep(nivel) {
  if (isWizardTargetNPC()) return true;
  const baseHp = getEffectiveBaseHp();
  const hpMax  = parseInt(document.getElementById('c-hp').value)  || baseHp;
  const agi    = parseInt(document.getElementById('c-agi').value) || 5;
  const forca  = parseInt(document.getElementById('c-for').value) || 5;
  const intel  = parseInt(document.getElementById('c-int').value) || 5;

  const raceValidacao = getRacaSelecionada();
  const maxHpCriacao = getMaxHpCriacao(raceValidacao);
  if (hpMax > maxHpCriacao) {
    alert(`Durante a criação, a Vida do Tauren não pode ultrapassar ${maxHpCriacao}.`);
    return false;
  }

  const totalPontos = getPointBuyTotal(nivel);
  const gasto = (hpMax - baseHp) + (agi - ATTR_BASE_STAT) + (forca - ATTR_BASE_STAT) + (intel - ATTR_BASE_STAT);
  if (gasto > totalPontos) {
    alert(`Pontos excedidos! Você gastou ${gasto} pontos mas tem apenas ${totalPontos} disponíveis.`);
    return false;
  }
  const limitePontos = getAttrLimiteNivel(nivel);
  if (agi > limitePontos || forca > limitePontos || intel > limitePontos) {
    alert(`No Nível ${nivel}, AGI, FOR e INT não podem ultrapassar ${limitePontos}.`);
    return false;
  }
  return true;
}

// Botão "Salvar" do passo 4 (Atributos): na edição, salva direto (o passo 5
// de Habilidades é escondido — gerenciar Habilidades de um personagem já
// existente continua pelo botão "Escolher da Subclasse"). Na criação de um
// personagem novo, valida os pontos e avança para o passo 5.
function handleStep4Continue() {
  if (modalCharId) { saveCharacter(); return; }
  if (!validatePointBuyStep(creationLevel)) return;
  renderWizardBancoStep();
  showWizardStep(5);
}

// Botão "Próximo" do passo 5 (Habilidades): avança para o passo 6
// (Talentos/Feitiços/Rituais).
function handleStep5Continue() {
  renderWizardTalentosStep();
  renderWizardTalentosSuperioresStep();
  renderWizardFeiticosLendariosStep();
  renderWizardRituaisMacabrosStep();
  showWizardStep(6);
}

// Botão "Próximo" do passo 6 (Talentos/Feitiços/Rituais): avança para o
// passo 7 (Armadura Inicial).
function handleStep6Continue() {
  renderWizardArmaduraStep();
  showWizardStep(7);
}

// Botão "Próximo" do passo 7 (Armadura Inicial): avança para o passo 8
// (Elmo Inicial).
function handleStep7Continue() {
  renderWizardElmoStep();
  showWizardStep(8);
}

// Botão "Próximo" do passo 8 (Elmo Inicial): avança para o passo 9 (Arma
// Inicial), a última etapa antes de criar o personagem.
function handleStep8Continue() {
  renderWizardArmaStep();
  showWizardStep(9);
}

function saveCharacter() {
  const name   = document.getElementById('c-name').value.trim() || 'Desconhecido';
  const race   = getRacaSelecionada().trim() || 'Sem Raça';
  const cls    = getSelectedSubclasse() || 'Aventureiro';
  const classeBase = getBaseClass(cls) || cls;
  const hpMax  = parseInt(document.getElementById('c-hp').value)  || 10;
  const ins    = parseInt(document.getElementById('c-ins').value) || 0;
  const agi    = parseInt(document.getElementById('c-agi').value) || 5;
  const forca  = parseInt(document.getElementById('c-for').value) || 5;
  const intel  = parseInt(document.getElementById('c-int').value) || 5;
  const passos = parseInt(document.getElementById('c-passos').value) || 10;
  const dinheiroEl = document.getElementById('c-dinheiro');
  const dinheiro = dinheiroEl && dinheiroEl.value.trim() !== '' ? Math.max(0, parseInt(dinheiroEl.value)) : 100;

  // Origem racial (ex: Anão Comum / Anão Profundezas)
  const origemEl = document.getElementById('c-origem');
  const origemId = origemEl ? (origemEl.value || null) : null;

  // Divindade (exclusivo de Clérigo)
  const deusEl = document.getElementById('c-deus');
  const deus = (classeBase === 'Clérigo' && deusEl) ? (deusEl.value || null) : null;

  // Tatuagem Rúnica (exclusivo de Troll): +1 de Maestria no atributo escolhido.
  const trollMaestriaFormEl = document.getElementById('c-troll-maestria');
  const trollMaestriaEscolha = (race === 'Troll' && trollMaestriaFormEl) ? (trollMaestriaFormEl.value || 'agi') : null;

  // Validação de point-buy
  const editLevel = modalCharId ? (PLAYERS.find(x => x.id === modalCharId)?.level || 1) : creationLevel;
  if (!validatePointBuyStep(editLevel)) return;

  if (modalCharId) {
    const p = PLAYERS.find(x => x.id === modalCharId);
    if (p) {
      const eraBruxo = p.classeBase === 'Bruxo';
      const eraBardo = p.classeBase === 'Bardo';
      p.name = name; p.race = race; p.cls = cls; p.classeBase = classeBase; p.hpMax = hpMax;
      if (p.hp > hpMax) p.hp = hpMax;
      p.agi = agi; p.forca = forca; p.intel = intel;
      p.passosBase = passos; p.dinheiro = dinheiro;
      p.origemId = origemId;
      p.deus = deus;
      p.trollMaestriaEscolha = trollMaestriaEscolha;
      if (p.isNPC) p.npcTipo = wizardNpcTipo;
      p.ins = Math.max(0, Math.min(getInsanidadeMax(p), ins));
      p.pontosPendentes = 0;
      // Humanidade: vira Bruxo agora (ou ainda não tinha o campo) → inicia
      // cheia (10/10). Se já era Bruxo, mantém o valor atual sem resetar.
      if (classeBase === 'Bruxo' && (!eraBruxo || typeof p.humanidade !== 'number')) {
        p.humanidade = HUMANIDADE_MAX;
      }
      // Notas: vira Bardo agora (ou ainda não tinha o campo) → inicia todas inativas.
      // Se já era Bardo, mantém o estado atual sem resetar.
      if (classeBase === 'Bardo' && (!eraBardo || !p.notasBardo || typeof p.notasBardo !== 'object')) {
        p.notasBardo = {};
        NOTAS_MUSICAIS.forEach(n => { p.notasBardo[n] = false; });
      }
      ensureRacePassivas(p);
      ensureCamposHarmonicos(p);
      recomputeProtMax(p);
    }
  } else {
    const newId = PLAYERS.length > 0 ? Math.max(...PLAYERS.map(p => p.id)) + 1 : 1;
    // "Origem Sangrenta" (Elfo Sangrento): começa o jogo com +200 de Dinheiro.
    // Só se aplica na criação (aqui, no branch "novo personagem") — reeditar
    // a ficha depois não deve dar +200 de novo.
    const dinheiroComOrigem = origemId === 'elfo_origem_sangrento' ? dinheiro + 200 : dinheiro;
    const novo = {
      id: newId, name, race, cls, classeBase, level: editLevel, xp: 0,
      hp: hpMax, hpMax, agi, forca, intel,
      armadura: 0, armaduraMax: 0,
      elmo: 0, elmoMax: 0,
      acoesMax: ACOES_POR_TURNO_PADRAO, acoesAtuais: ACOES_POR_TURNO_PADRAO,
      passos, passosBase: passos, dinheiro: dinheiroComOrigem, origemId, deus, trollMaestriaEscolha, skills: [], passivas: [], inventario: [],
      jogNotas: Object.fromEntries(JOG_NOTA_TAGS.map(t => [t.toLowerCase(), ''])),
      isNPC: wizardIsNPC,
      npcTipo: wizardIsNPC ? wizardNpcTipo : null,
      ownerId: wizardIsNPC ? null : (currentUser ? currentUser.id : null),
      ownerName: wizardIsNPC ? null : (currentUser ? currentUser.name : null)
    };
    novo.ins = Math.max(0, Math.min(getInsanidadeMax(novo), ins));
    if (classeBase === 'Bruxo') novo.humanidade = HUMANIDADE_MAX;
    if (classeBase === 'Bardo') {
      novo.notasBardo = {};
      NOTAS_MUSICAIS.forEach(n => { novo.notasBardo[n] = false; });
    }
    ensureGeneralSkills(novo);
    ensureRacePassivas(novo);
    ensureCamposHarmonicos(novo);
    // Habilidades do Banco escolhidas no passo 5 do wizard de criação.
    wizardSkillsEscolhidas.forEach(bancoId => {
      const item = getBancoHabilidades(novo).find(h => h.id === bancoId);
      if (item && !novo.skills.some(sk => sk.bancoId === item.id)) {
        const novaSkill = construirSkillDoBanco(item);
        if (temFonteOutraClasse(novo) && item.classeOrigem && item.classeOrigem !== novo.classeBase) {
          novaSkill.bancoOutraClasse = true;
        }
        novo.skills.push(novaSkill);
      }
    });
    // Talento Inferior escolhido no passo 5 do wizard de criação (só
    // disponível se o personagem já nasce no Nível 2 ou superior).
    wizardTalentosEscolhidos.forEach(talentoId => {
      const item = TALENTOS_INFERIORES.find(t => t.id === talentoId);
      if (!item) return;
      const qtdDoMesmo = novo.passivas.filter(pas => pas.talentoInferiorId === item.id).length;
      const instanceId = qtdDoMesmo > 0 ? `pas_talento_${item.id}_${qtdDoMesmo + 1}` : 'pas_talento_' + item.id;
      novo.passivas.push({ id: instanceId, talentoInferiorId: item.id, name: item.name, desc: item.desc });
    });
    // Talento Superior escolhido no passo 5 do wizard de criação (só
    // disponível se o personagem já nasce no Nível 4 ou superior).
    wizardTalentosSuperioresEscolhidos.forEach(talentoId => {
      const item = TALENTOS_SUPERIORES.find(t => t.id === talentoId);
      if (item && !novo.passivas.some(pas => pas.talentoSuperiorId === item.id)) {
        novo.passivas.push({ id: 'pas_talento_sup_' + item.id, talentoSuperiorId: item.id, name: item.name, desc: item.desc });
      }
    });
    // Feitiço Lendário escolhido no passo 5 do wizard de criação (só
    // disponível se o personagem já nasce Conjurador no Nível 5+ ou já
    // escolheu o Talento Superior "Transcendência Mental" no wizard).
    wizardFeiticosLendariosEscolhidos.forEach(itemId => {
      const item = FEITICOS_LENDARIOS.find(f => f.id === itemId);
      if (item && !novo.skills.some(sk => sk.lendario && sk.id === 'sk_lendario_' + item.id)) {
        novo.skills.push(construirSkillLendaria(item));
      }
    });
    // Ritual Macabro escolhido no passo 5 do wizard de criação (só
    // disponível se o personagem já escolheu o Talento Superior "Vínculo
    // Místico" no wizard).
    wizardRituaisMacabrosEscolhidos.forEach(itemId => {
      const item = RITUAIS_MACABROS.find(r => r.id === itemId);
      if (item && !novo.skills.some(sk => sk.ritualMacabro && sk.id === 'sk_ritual_' + item.id)) {
        novo.skills.push(construirSkillRitualMacabro(item));
      }
    });
    // Armadura inicial escolhida no passo 7 do wizard de criação (opções
    // filtradas pelo atributo principal da subclasse — ver getPesosArmaduraPermitidos).
    if (wizardArmaduraEscolhidaId) {
      const catItem = CATALOGO_ITENS.protecao.find(x => x.id === wizardArmaduraEscolhidaId);
      if (catItem) {
        novo.inventario.push({
          id: 'inv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          tipo: 'protecao', subtipo: catItem.subtipo, peso: catItem.peso, name: catItem.name,
          efeito: catItem.efeito || '', valor: catItem.valor != null ? catItem.valor : null,
          preco: catItem.preco != null ? catItem.preco : null,
          passosPenalidade: catItem.passosPenalidade || 0, equipado: true, aprimoramentos: [],
          usos: (catItem.usos || []).map(u => ({ ...u, usosAtuais: u.usosMax })),
        });
      }
    }
    // Elmo inicial escolhido no passo 8 do wizard de criação (mesma lógica da Armadura).
    if (wizardElmoEscolhidaId) {
      const catItemElmo = CATALOGO_ITENS.protecao.find(x => x.id === wizardElmoEscolhidaId);
      if (catItemElmo) {
        novo.inventario.push({
          id: 'inv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          tipo: 'protecao', subtipo: catItemElmo.subtipo, peso: catItemElmo.peso, name: catItemElmo.name,
          efeito: catItemElmo.efeito || '', valor: catItemElmo.valor != null ? catItemElmo.valor : null,
          preco: catItemElmo.preco != null ? catItemElmo.preco : null,
          passosPenalidade: catItemElmo.passosPenalidade || 0, equipado: true, aprimoramentos: [],
          usos: (catItemElmo.usos || []).map(u => ({ ...u, usosAtuais: u.usosMax })),
        });
      }
    }
    // Arma/Instrumento inicial escolhido no passo 9 do wizard de criação
    // (acesso exclusivo por atributo — ver getPesosArmaPermitidos).
    if (wizardArmaEscolhidaId && wizardArmaEscolhidaTipo) {
      const catItemArma = (CATALOGO_ITENS[wizardArmaEscolhidaTipo] || []).find(x => x.id === wizardArmaEscolhidaId);
      if (catItemArma) {
        novo.inventario.push({
          id: 'inv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          tipo: wizardArmaEscolhidaTipo, peso: catItemArma.peso, name: catItemArma.name,
          dano: catItemArma.dano || '', alcance: catItemArma.alcance || null,
          efeito: catItemArma.efeito || '', preco: catItemArma.preco != null ? catItemArma.preco : null,
          equipado: true, aprimoramentos: [],
          usos: (catItemArma.usos || []).map(u => ({ ...u, usosAtuais: u.usosMax })),
          ativas: (catItemArma.ativas || []).map(a => ({ ...a, usosAtuais: a.usosMax || 2 })),
          vidaMax: catItemArma.vidaMax != null ? catItemArma.vidaMax : null,
          vidaAtual: catItemArma.vidaMax != null ? catItemArma.vidaMax : null,
        });
      }
    }
    recomputeProtMax(novo);
    PLAYERS.push(novo);
    modalCharId = newId;
    // Seletores raciais que abrem sozinhos após a criação (Adaptação do
    // Espaço, Decréptico, Origem Sangrenta): antes cada um tinha seu próprio
    // setTimeout mirando o MESMO overlay, então quando um personagem tinha
    // mais de um, o último a disparar sobrescrevia os outros e só ele
    // aparecia. Agora só dispara UM de cada vez, em ordem — ver
    // abrirProximoSeletorRacial, que também é chamado ao fechar cada um
    // desses seletores, encadeando pro próximo pendente.
    setTimeout(() => abrirProximoSeletorRacial(novo.id), 300);
  }

  wizardSkillsEscolhidas = [];
  wizardBancoTabAtiva = null;
  wizardSkillsClasseSnapshot = null;
  wizardTalentosEscolhidos = [];
  wizardTalentosSuperioresEscolhidos = [];
  wizardFeiticosLendariosEscolhidos = [];
  wizardRituaisMacabrosEscolhidos = [];
  wizardArmaduraEscolhidaId = null;
  wizardElmoEscolhidaId = null;
  wizardArmaEscolhidaId = null;
  wizardArmaEscolhidaTipo = null;
  wizardIsNPC = false;

  saveState();
  renderAll();
  const psel = document.getElementById('psel');
  if(psel) psel.value = modalCharId;
  renderJogador();
  closeCharModal();
}

// ═══════════════════════════════════════
