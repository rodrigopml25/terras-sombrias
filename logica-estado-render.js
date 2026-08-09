// ESTADO LOCAL
// ═══════════════════════════════════════
let PLAYERS = [];
let turnGlobal = 1;
let INITIATIVE = [];       // [{ id, tipo:'jogador'|'aliado'|'inimigo', playerId?, name, roll }]
let turnoAtualId = null;   // id da entrada de INITIATIVE cujo turno é agora
let combatAtivo = false;   // true enquanto o Narrador mantém um combate em andamento
let initSetupInimigos = 0; // contadores locais (só do Narrador) antes de iniciar o combate
let initSetupAliados = 0;
let ultimoTurnoRenderNarrador = undefined; // detecta troca de turno p/ rolar a lista até quem está na vez
let ultimoTurnoRenderJogador = undefined;
let notes = {geral:'', missão:'', inimigos:'', locais:''};
let activeNote = 'geral';

let modalPid = null;
let modalSkid = null;
let modalColor = 'green';
let modalCharId = null;
// Nível escolhido na criação de um personagem NOVO (1 a 5). Ignorado ao
// editar um personagem existente, que usa o próprio p.level.
let creationLevel = 1;
// Habilidades do Banco escolhidas durante a criação (passo 5 do wizard),
// guardadas como lista de bancoId — só é efetivada em p.skills quando o
// personagem é de fato criado em saveCharacter(). Reseta a cada abertura do
// modal para um personagem novo (ver openCharModal).
let wizardSkillsEscolhidas = [];
let wizardBancoClasseAtiva = null;
let wizardBancoTabAtiva = null;
// Guarda qual subclasse estava selecionada da última vez que o passo de
// Habilidades foi montado — se o jogador voltar e trocar de Classe/Subclasse,
// as escolhas antigas (de outra subclasse) deixam de fazer sentido e são
// descartadas automaticamente.
let wizardSkillsClasseSnapshot = null;
// Talentos Inferiores escolhidos durante a criação (passo 5 do wizard),
// guardados como lista de talentoId — só é efetivado em p.passivas quando o
// personagem é de fato criado em saveCharacter(). Reseta a cada abertura do
// modal para um personagem novo (ver openCharModal).
let wizardTalentosEscolhidos = [];
// Talento Superior escolhido durante a criação (passo 5 do wizard), guardado
// como lista de talentoId — só disponível se o personagem já nasce no Nível
// 4 ou superior. Mesmo ciclo de vida de wizardTalentosEscolhidos.
let wizardTalentosSuperioresEscolhidos = [];
// Feitiço Lendário escolhido durante a criação (passo 5 do wizard), guardado
// como lista de itemId — só disponível se o personagem já nasce Conjurador
// no Nível 5+ ou já escolheu o Talento Superior "Transcendência Mental" no
// próprio wizard. Mesmo ciclo de vida das outras listas do wizard.
let wizardFeiticosLendariosEscolhidos = [];
// Ritual Macabro escolhido durante a criação (passo 5 do wizard), guardado
// como lista de itemId — só disponível se o personagem já escolheu o
// Talento Superior "Vínculo Místico" no próprio wizard. Mesmo ciclo de vida
// das outras listas do wizard.
let wizardRituaisMacabrosEscolhidos = [];
// Armadura inicial escolhida durante a criação (passo 5 do wizard), guardada
// como o id do item no CATALOGO_ITENS.protecao (ou null = nenhuma). As opções
// disponíveis dependem do atributo principal da subclasse escolhida (ver
// getPesosArmaduraPermitidos). Mesmo ciclo de vida das outras escolhas do wizard.
let wizardArmaduraEscolhidaId = null;
// Elmo inicial escolhido no passo 8 do wizard (mesma lógica da Armadura, ver renderWizardElmoStep).
let wizardElmoEscolhidaId = null;
// Arma/Instrumento inicial escolhido no passo 9 do wizard (acesso exclusivo
// por atributo — ver renderWizardArmaStep/getPesosArmaPermitidos). Como as
// opções vêm de dois catálogos (arma/instrumento), guarda também de qual.
let wizardArmaEscolhidaId = null;
let wizardArmaEscolhidaTipo = null;
let modalPassivaPid = null;
let modalPassivaId = null;
let narPassivasExpanded = {}; // { [playerId]: true/false } — estado local, não sincroniza
let narSkillsExpanded = {};  // { [playerId]: true/false } — mostra habilidades agrupadas
let narInventarioExpanded = {}; // { [playerId]: true/false } — mostra o Inventário (reaproveita renderInventarioArea)
let jogTestesCollapsed = true;   // jogador: começa fechado
let jogIniciativaCollapsed = false; // jogador: painel de Ordem de Iniciativa começa aberto
let narTestesCollapsed = {};     // narrador: { [playerId]: true/false } — começa fechado
let jogSkillsCollapsed = { green: true, red: true, blue: true, gray: true, passivas: true, expressoes: true, campos: true, divindade: true }; // começa fechado
let jogInvCollapsed = {}; // { [playerId]: { armas, protecoes, itens } } — cada personagem tem seu próprio estado, começa fechado
let jogActiveTab = 'ficha'; // 'ficha' | 'anotacoes'
let modalInvPid = null;
let modalInvId = null;
// Aba ativa na tela do Narrador: 'jogadores' (personagens dos jogadores) ou
// 'npcs' (bonecos controlados só pelo Narrador). Ver switchNarTab.
let narActiveTab = 'jogadores';
// true quando o wizard de criação/edição (#modal-char-overlay) foi aberto a
// partir do botão "Novo NPC" — controla o título do modal e, em
// saveCharacter(), se o personagem novo nasce com p.isNPC = true (sem dono).
let wizardIsNPC = false;

// Controla a notificação (toast) de "subiu de nível" no lado do Jogador.
// null = ainda não inicializado (primeiro render após carregar dados);
// depois disso guarda { [playerId]: level } pra detectar aumentos, sejam
// eles feitos pelo próprio jogador OU sincronizados a partir do Narrador.
let lastSeenLevels = null;

let firebaseRef = null;
let firebaseOnline = false;
let firebaseConfigured = false;
let saveDebounceTimer = null;
let lastWrittenJSON = null;
let pendingSave = false;
let pendingSaveSafetyTimer = null;
// Trava de segurança contra o bug que já zerou uma campanha real (ver
// bindCampaign): só libera ESCRITA no Firebase depois que os dados da
// campanha foram genuinamente confirmados (veio PLAYERS de verdade, OU
// confirmamos — com o SDK realmente conectado ao servidor, não a um cache
// antigo — que a campanha está mesmo vazia). Enquanto não armada, saveState()
// continua salvando no localStorage (não destrutivo), só pula o .set() no
// Firebase, pra nenhuma ação do usuário durante essa janela de incerteza
// poder sobrescrever dados reais com um estado local incompleto.
let firebaseWriteArmed = false;

// ═══════════════════════════════════════
// CAMPANHAS
// ═══════════════════════════════════════
let activeCampaignId = null;     // id da campanha atualmente carregada
let activeCampaignMeta = null;   // { name, code, ownerId }
let dataListenerRef = null;      // ref do listener .on('value') atual (p/ poder desligar ao trocar campanha)
let dataListenerHandler = null;

// ─── Banco de NPCs do Narrador ───────────────────────────────────────────────
// NPCs guardados aqui pertencem à CONTA do Narrador (ts_users/{id}/npc_bank),
// não a uma campanha específica — ficam disponíveis pra serem "chamados"
// (copiados) em qualquer campanha que o Narrador esteja rodando.
//
// Truque usado: enquanto o modal do Banco está aberto, a variável global
// PLAYERS passa a APONTAR para NPC_BANK. Isso deixa reaproveitar 100% do
// wizard de criação, o card completo do Narrador e todos os modais auxiliares
// (habilidades, passivas, inventário) sem duplicar nenhuma dessas funções —
// todas elas já operam sobre "PLAYERS", então passam a operar sobre o banco
// automaticamente. Por segurança, o listener de sincronização da campanha
// atual fica pausado enquanto isso (bankModeActive), pra uma atualização em
// tempo real da campanha não sobrescrever o array errado no meio do caminho.
let NPC_BANK = [];
let bankModeActive = false;
let campaignPlayersBackup = null; // guarda o PLAYERS real da campanha enquanto o banco está aberto
let npcBankSearchQuery = ''; // filtro por nome da barra de pesquisa do Banco de NPCs
// true assim que o Banco é buscado do Firebase pela 1ª vez nesta sessão do
// navegador. Evita rebuscar (e sobrescrever com uma versão desatualizada, se
// um save anterior ainda não tiver terminado de replicar) toda vez que o
// modal é reaberto — dentro da mesma sessão, o NPC_BANK local já reflete
// tudo que foi salvo (ver saveNpcBank/closeNpcBankModal).
let npcBankLoaded = false;

// Atualiza o filtro de busca do Banco de NPCs (por nome) e re-renderiza a lista.
function filterNpcBank(valor) {
  npcBankSearchQuery = (valor || '').trim().toLowerCase();
  renderAll();
}
// Classificação do NPC sendo criado/editado no wizard: 'aliado' ou 'inimigo'
// — ver seletor no passo 1 (Nome), campo p.npcTipo salvo no personagem.
let wizardNpcTipo = 'aliado';

function snapshotState() {
  return { PLAYERS, turnGlobal, INITIATIVE, turnoAtualId, combatAtivo, notes };
}

function applyData(data) {
  PLAYERS = data.PLAYERS || [];
  PLAYERS.forEach(p => {
    if (!Array.isArray(p.skills)) p.skills = [];
    if (!Array.isArray(p.passivas)) p.passivas = [];
    if (!Array.isArray(p.inventario)) p.inventario = [];
    ensureGeneralSkills(p);
    ensureRacePassivas(p);
    ensureCamposHarmonicos(p);
    if (typeof p.armaduraMax !== 'number') p.armaduraMax = typeof p.armadura === 'number' ? p.armadura : 10;
    if (typeof p.armadura !== 'number') p.armadura = p.armaduraMax;
    if (p.armadura > p.armaduraMax) p.armadura = p.armaduraMax;
    if (typeof p.elmoMax !== 'number') p.elmoMax = typeof p.elmo === 'number' ? p.elmo : 0;
    if (typeof p.elmo !== 'number') p.elmo = p.elmoMax;
    if (p.elmo > p.elmoMax) p.elmo = p.elmoMax;
    if (typeof p.passos !== 'number') p.passos = 10;
    if (typeof p.pontosPendentes !== 'number') p.pontosPendentes = 0;
    if (typeof p.dinheiro !== 'number') p.dinheiro = 100;
    if (typeof p.cristais !== 'number') p.cristais = 0;
    // Migração: ações por turno — fichas antigas ainda não têm o campo
    if (typeof p.acoesMax !== 'number') p.acoesMax = ACOES_POR_TURNO_PADRAO;
    if (typeof p.acoesAtuais !== 'number') p.acoesAtuais = p.acoesMax;
    // Migração: notas de Bardo — fichas antigas que ainda não têm o campo
    if (p.classeBase === 'Bardo' && (!p.notasBardo || typeof p.notasBardo !== 'object')) {
      p.notasBardo = {};
      NOTAS_MUSICAIS.forEach(n => { p.notasBardo[n] = false; });
    }
    // Migração: anotações do jogador — fichas antigas
    if (!p.jogNotas || typeof p.jogNotas !== 'object') {
      p.jogNotas = {};
      JOG_NOTA_TAGS.forEach(t => { p.jogNotas[t.toLowerCase()] = ''; });
    }
    // Migração: itens de proteção criados antes do controle de "equipado" não têm
    // esse campo ainda — equipa automaticamente o primeiro de cada tipo para não
    // zerar a armadura/elmo de personagens já existentes.
    ['armadura','elmo'].forEach(sub => {
      const itensSub = p.inventario.filter(i => i.tipo === 'protecao' && i.subtipo === sub);
      const algumDefinido = itensSub.some(i => typeof i.equipado === 'boolean');
      if (!algumDefinido && itensSub.length) itensSub[0].equipado = true;
    });
    // Migração: mesma ideia acima, agora para Arma/Instrumento — Arma e
    // Instrumento contam como o mesmo "slot de mão" (só 1 equipado por vez,
    // ver toggleEquipArma), então checa os dois tipos juntos.
    {
      const itensArma = p.inventario.filter(i => i.tipo === 'arma' || i.tipo === 'instrumento');
      const algumArmaDefinido = itensArma.some(i => typeof i.equipado === 'boolean');
      if (!algumArmaDefinido && itensArma.length) itensArma[0].equipado = true;
    }
    recomputeProtMax(p);
    // Migração: testes — fichas antigas que ainda não têm o campo
    getTestePersonagem(p);
  });
  turnGlobal = data.turnGlobal || 1;
  // Migração: formato antigo de INITIATIVE não tinha "id"/"tipo" — descarta
  // com segurança em vez de tentar converter (evita quebrar a tela).
  const initRaw = Array.isArray(data.INITIATIVE) ? data.INITIATIVE : [];
  INITIATIVE = initRaw.every(e => e && e.id && e.tipo) ? initRaw : [];
  turnoAtualId = data.turnoAtualId ?? null;
  combatAtivo = !!data.combatAtivo && INITIATIVE.length > 0;
  notes = data.notes || {geral:'', missão:'', inimigos:'', locais:''};
}

function initDataLocal() {
  const localKey = 'rpg_dashboard_data_' + (activeCampaignId || 'local');
  const saved = localStorage.getItem(localKey);
  if (saved) {
    applyData(JSON.parse(saved));
  } else {
    PLAYERS = JSON.parse(JSON.stringify(DEFAULT_PLAYERS));
  }
}

function setSyncStatus(status) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  const map = {
    off:        {text: '○ Sem sincronização', color: 'var(--text3)'},
    connecting: {text: '◐ Conectando…',       color: 'var(--text3)'},
    on:         {text: '● Sincronizado',      color: 'var(--green)'},
    error:      {text: '● Erro de conexão',   color: '#f08080'},
  };
  const s = map[status] || map.off;
  el.textContent = s.text;
  el.style.color = s.color;
}

function initFirebaseSync() {
  const cfg = window.FIREBASE_CONFIG;
  firebaseConfigured = !!(cfg && cfg.apiKey && !String(cfg.apiKey).includes('COLE_AQUI'));

  if (typeof firebase === 'undefined' || !firebaseConfigured) {
    firebaseConfigured = false;
    setSyncStatus('off');
    activeCampaignId = 'local';
    initDataLocal();
    afterFirebaseReady();
    return;
  }

  setSyncStatus('off');
  try {
    try { firebase.app(); } catch(e) { firebase.initializeApp(cfg); }
  } catch (err) {
    console.error('Erro ao iniciar Firebase:', err);
    setSyncStatus('error');
    firebaseConfigured = false;
    activeCampaignId = 'local';
    initDataLocal();
    afterFirebaseReady();
    return;
  }

  firebaseOnline = true;
  ensureUsersNode();
  afterFirebaseReady();
}

// Chamado quando Firebase termina de inicializar (com ou sem erro)
// Mostra login se necessário, ou segue para a seleção/carregamento de campanha
function afterFirebaseReady() {
  if (!currentUser) {
    showLoginScreen();
  } else {
    proceedAfterLogin();
  }
}

// Decide o que mostrar depois de logado: modo local (sem campanhas),
// retomar a campanha ativa salva na sessão, ou pedir para escolher/entrar numa campanha.
function proceedAfterLogin() {
  renderUserBadge();
  if (!firebaseConfigured) {
    renderAll();
    return;
  }
  if (currentUser.activeCampaignId) {
    bindCampaign(currentUser.activeCampaignId);
  } else {
    showCampaignSelector();
  }
}

// Carrega e passa a sincronizar os dados de UMA campanha específica.
// Desliga o listener da campanha anterior (se houver) antes de trocar.
function bindCampaign(campaignId) {
  if (dataListenerRef && dataListenerHandler) {
    dataListenerRef.off('value', dataListenerHandler);
  }
  dataListenerRef = null;
  dataListenerHandler = null;

  const overlay = document.getElementById('campaign-overlay');
  if (overlay) overlay.remove();

  activeCampaignId = campaignId;
  activeCampaignMeta = null;
  if (currentUser) {
    currentUser.activeCampaignId = campaignId;
    setCurrentUser(currentUser);
  }

  setSyncStatus('connecting');
  firebaseWriteArmed = false;

  const metaRef = firebase.database().ref('campaigns/' + campaignId + '/meta');
  const dataRef = firebase.database().ref('campaigns/' + campaignId + '/data');
  firebaseRef = dataRef;
  bindRollsSync(campaignId);

  metaRef.once('value').then(snap => {
    activeCampaignMeta = snap.val() || { name: 'Campanha' };
    renderCampaignBadge();
  });

  dataRef.once('value').then(snapshot => {
    const data = snapshot.val();
    if (data) {
      applyData(data);
      // Dados reais vieram do servidor — seguro liberar escrita.
      firebaseWriteArmed = true;
    } else {
      // ATENÇÃO: NÃO escrever de volta no Firebase aqui. Uma leitura vazia
      // pode ser uma campanha genuinamente nova, MAS também pode ser uma
      // falha passageira de conexão (ex.: reconectando logo após reiniciar o
      // navegador) — nesse segundo caso, os dados reais da campanha ainda
      // existem no servidor. Como dataRef.set() é uma sobrescrita TOTAL e
      // destrutiva, escrever aqui apagaria a campanha inteira (foi
      // exatamente esse bug que zerou os personagens de uma campanha real).
      // Em vez disso, só preenche o estado LOCAL com o padrão vazio; se for
      // mesmo uma campanha nova, o primeiro saveState() real (ex.: ao
      // adicionar um personagem) já cria os dados no Firebase. Se os dados
      // reais existirem, o listener abaixo (dataRef.on) os traz assim que a
      // sincronização se estabilizar, sem nada ter sido perdido.
      PLAYERS = JSON.parse(JSON.stringify(DEFAULT_PLAYERS));
      turnGlobal = 1; INITIATIVE = []; turnoAtualId = null; combatAtivo = false;
      notes = {geral:'', missão:'', inimigos:'', locais:''};
      // A leitura vazia só é confiável se o SDK está REALMENTE conectado ao
      // servidor agora (não respondendo com um cache antigo/offline). Só
      // então libera a escrita — do contrário, qualquer clique do jogador
      // nesse meio tempo (ex.: usar uma Habilidade) chamaria saveState() e
      // sobrescreveria a campanha real com esse estado vazio.
      firebase.database().ref('.info/connected').once('value').then(connSnap => {
        if (connSnap.val() === true) firebaseWriteArmed = true;
        // Se não estiver conectado ainda, deixa desarmado: o próprio
        // listener .on('value') abaixo arma assim que trouxer uma
        // atualização real do servidor (ver dataListenerHandler).
      });
    }
    firebaseOnline = true;
    setSyncStatus('on');
    renderAll();

    dataListenerHandler = snapshot2 => {
      if (pendingSave) return;
      const incoming = snapshot2.val();
      // Qualquer disparo deste listener já é uma confirmação real de
      // sincronização com o servidor — arma a escrita mesmo se `incoming`
      // vier vazio (campanha genuinamente sem personagens ainda).
      firebaseWriteArmed = true;
      if (!incoming) return;
      const incomingJSON = JSON.stringify(incoming);
      if (incomingJSON === lastWrittenJSON) return;
      applyData(incoming);
      if (currentUser) renderAll();
    };
    dataRef.on('value', dataListenerHandler);
    dataListenerRef = dataRef;
  }).catch(err => {
    console.error('Erro ao carregar dados da campanha:', err);
    setSyncStatus('error');
  });
}

// Sai da campanha atual e volta para a tela de seleção/entrada por código
function trocarCampanha() {
  if (dataListenerRef && dataListenerHandler) {
    dataListenerRef.off('value', dataListenerHandler);
  }
  dataListenerRef = null;
  dataListenerHandler = null;
  firebaseRef = null;
  firebaseWriteArmed = false;
  activeCampaignId = null;
  activeCampaignMeta = null;
  bindRollsSync(null);
  PLAYERS = []; INITIATIVE = []; turnoAtualId = null; combatAtivo = false;
  notes = {geral:'', missão:'', inimigos:'', locais:''};
  turnGlobal = 1;

  if (currentUser) {
    delete currentUser.activeCampaignId;
    setCurrentUser(currentUser);
  }
  const badge = document.getElementById('campaign-badge');
  if (badge) badge.remove();
  renderAll();
  showCampaignSelector();
}

function saveState() {
  // Enquanto o Banco de NPCs está aberto, PLAYERS aponta para NPC_BANK — o
  // que precisa ser persistido é o banco do Narrador, não os dados da
  // campanha (que continuam intocados em campaignPlayersBackup).
  if (bankModeActive) { saveNpcBank(); return; }

  const localKey = 'rpg_dashboard_data_' + (activeCampaignId || 'local');
  localStorage.setItem(localKey, JSON.stringify(snapshotState()));
  if (!firebaseRef) return;
  if (!firebaseWriteArmed) {
    // Ainda não confirmamos os dados reais da campanha (ver bindCampaign) —
    // não arrisca sobrescrever o Firebase com um estado local incompleto.
    // O que já foi feito localmente/no localStorage não se perde: assim que
    // a trava for armada, a próxima ação do usuário (ou o próprio
    // sincronismo) salva normalmente.
    console.warn('saveState: escrita no Firebase adiada — dados da campanha ainda não confirmados.');
    return;
  }

  pendingSave = true;
  clearTimeout(pendingSaveSafetyTimer);
  pendingSaveSafetyTimer = setTimeout(() => { pendingSave = false; }, 5000);

  clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    const json = JSON.stringify(snapshotState());
    lastWrittenJSON = json;
    firebaseRef.set(JSON.parse(json)).then(() => {
      pendingSave = false;
      clearTimeout(pendingSaveSafetyTimer);
      setSyncStatus('on');
    }).catch(err => {
      console.error('Erro ao salvar no Firebase:', err);
      pendingSave = false;
      clearTimeout(pendingSaveSafetyTimer);
      setSyncStatus('error');
    });
  }, 300);
}

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════
function vidaClass(hp, max) {
  const p = hp / max; return p <= .3 ? 'bfill-vida-low' : p <= .6 ? 'bfill-vida-mid' : 'bfill-vida-ok';
}
function maestria(attr) {
  return Math.ceil((attr || 0) / 5);
}
// Maestria de um personagem em um atributo específico ('agi'|'forca'|'intel'),
// já somando o bônus racial do Troll (Tatuagem Rúnica): +1 de Maestria no
// atributo escolhido pelo jogador na criação (p.trollMaestriaEscolha).
function maestriaDe(p, campoAttr) {
  if (!p || !campoAttr) return null;
  let m = maestria(p[campoAttr]);
  if (p.race === 'Troll' && p.trollMaestriaEscolha === campoAttr) m += 1;
  return m;
}
// Bônus de Maestria que soma no Dano de Armas/Instrumentos, de acordo com o
// peso do item — usado tanto na exibição (statsRow, dentro de
// renderInventarioArea) quanto na rolagem de dano de verdade
// (construirRolagemDanoArma). Leve → INT; Média → AGI; Pesada → FOR;
// Exótica → piso(AGI/2); Mega Pesada → piso(FOR/2); Encantada → piso(INT/2).
function getArmaMaestriaBonus(p, peso) {
  if (peso === 'leve')   return { val: maestriaDe(p,'intel'), attr: 'INT', color: 'var(--blue)'  };
  if (peso === 'media')  return { val: maestriaDe(p,'agi'),   attr: 'AGI', color: 'var(--green)' };
  if (peso === 'pesada') return { val: maestriaDe(p,'forca'), attr: 'FOR', color: 'var(--red)'   };
  if (peso === 'exotica') {
    const v = Math.ceil(maestriaDe(p,'agi') / 2);
    return { val: v, attr: 'AGI/2', color: 'var(--green-dim)' };
  }
  if (peso === 'mega') {
    const v = Math.ceil(maestriaDe(p,'forca') / 2);
    return { val: v, attr: 'FOR/2', color: '#8b1f1f' };
  }
  if (peso === 'encantada') {
    const v = Math.ceil(maestriaDe(p,'intel') / 2);
    return { val: v, attr: 'INT/2', color: 'var(--accent2)' };
  }
  return null;
}

// Monta a árvore de rolagem de Dano de uma Arma/Instrumento: rola a fórmula
// de dano do item (item.dano, ex: "1d10", "1d4+3", "1d8+1d6") e soma, como
// termos à parte (nunca mexendo na fórmula base do item):
//   - Bônus de Maestria conforme o peso da arma (getArmaMaestriaBonus)
//   - Aprimoramento Dourado "Afiação Aprimorada": +1d6 real, rolado na hora
//   - "Origem das Profundezas" (Draenei): bônus fixo acumulado por nome de arma
// Ponto de extensão: qualquer novo bônus de Dano que dependa de arma/item
// (encantamentos, outros Aprimoramentos Dourados, passivas raciais futuras)
// entra aqui, como mais um termo — nunca direto na string item.dano.
function construirRolagemDanoArma(p, item, opts) {
  opts = opts || {};
  if (!p || !item) return null;
  const danoStr = (item.dano || '').trim();
  if (!danoStr) return null;

  let parsed;
  try {
    parsed = parseFormula(danoStr);
  } catch (e) {
    return null;
  }

  const baseNode = parsed.node;
  const terms = baseNode.type === 'sum' ? baseNode.terms.slice() : [{ sign: '+', node: baseNode }];
  let total = parsed.value;

  // Acerto Crítico da Arma: dobra os dados de Dano desta rolagem (ex: 1d6 →
  // 2d6, 1d8+1d6 → 2d8+2d6) — marca deixada por rolarAcertoArma quando o
  // Acerto sai Crítico (ver rollCritInfo), consumida aqui, então só vale
  // pra essa PRÓXIMA rolagem de Dano dessa Arma específica.
  const critDobro = !!item.critPendente;
  if (critDobro) {
    terms.forEach(t => {
      if (t.node.type === 'dice' && Array.isArray(t.node.results)) {
        const extra = [];
        for (let i = 0; i < t.node.count; i++) {
          extra.push(1 + Math.floor(Math.random() * t.node.sides));
        }
        const extraSum = extra.reduce((a, b) => a + b, 0);
        t.node.results = t.node.results.concat(extra);
        t.node.count = t.node.count * 2;
        t.node.sum = (t.node.sum || 0) + extraSum;
        total += (t.sign === '-' ? -extraSum : extraSum);
      }
    });
    item.critPendente = false;
  }

  // "Origem Comum" (Orc): precisa saber se a arma causou o Dano Total dela
  // mesma (todos os dados da FÓRMULA BASE do item caíram no valor máximo) —
  // por isso este cálculo tem que ser feito ANTES de empilhar os termos de
  // bônus abaixo (Maestria, Afiação Aprimorada, Profundezas não contam como
  // "dano da arma" pra este efeito).
  let temDadoNaBase = false, todosNoMaximoNaBase = true;
  terms.forEach(t => {
    if (t.node.type === 'dice') {
      temDadoNaBase = true;
      (t.node.results || []).forEach(v => { if (v < t.node.sides) todosNoMaximoNaBase = false; });
    }
  });
  const danoTotal = temDadoNaBase && todosNoMaximoNaBase;

  const mb = getArmaMaestriaBonus(p, item.peso);
  if (mb && mb.val) {
    terms.push({ sign: '+', node: { type: 'labeled_const', value: mb.val, label: 'Maestria ' + mb.attr } });
    total += mb.val;
    // "Sem Arma": a base de Dano é fixa em "1", sem dado pra dobrar no
    // Crítico — então o Crítico soma a Maestria de Força mais uma vez, no
    // lugar de dobrar dados (ver bloco de critDobro acima, que não afeta
    // termos que não são dado).
    if (item.id === 'sem_arma' && critDobro) {
      terms.push({ sign: '+', node: { type: 'labeled_const', value: mb.val, label: 'Maestria ' + mb.attr + ' (Crítico)' } });
      total += mb.val;
    }
  }

  if (typeof temAfiacaoAprimorada === 'function' && temAfiacaoAprimorada(item)) {
    const roll = 1 + Math.floor(Math.random() * 6);
    terms.push({ sign: '+', node: { type: 'dice', sides: 6, count: 1, results: [roll], sum: roll, countNode: null, label: 'Afiação Aprimorada ✨' } });
    total += roll;
  }

  const profundezasVal = (p.origemProfundezasBonus && p.origemProfundezasBonus[item.name]) || 0;
  if (profundezasVal > 0) {
    terms.push({ sign: '+', node: { type: 'labeled_const', value: profundezasVal, label: 'Profundezas' } });
    total += profundezasVal;
  }

  // "Ambidestro" (Talento Inferior): usado pela Habilidade Geral "Ataque
  // com 2 Armas" (ver rolarAcertoAtaqueGeral/opts.forcarAmbidestro) — soma o
  // Dano da 2ª arma (mão secundária) como termos extras, rolado agora na
  // hora (fórmula própria dela, igual a uma rolagem normal), sem tocar na
  // Maestria desta rolagem (a redução já aconteceu no Acerto).
  let ambidestroNome = null;
  if (opts.forcarAmbidestro) {
    const armaSec = getArmaSecundariaEquipada(p);
    const danoSecStr = armaSec && (armaSec.dano || '').trim();
    if (armaSec && danoSecStr) {
      try {
        const parsedSec = parseFormula(danoSecStr);
        const secNode = parsedSec.node;
        const secTerms = secNode.type === 'sum' ? secNode.terms.slice() : [{ sign: '+', node: secNode }];
        secTerms.forEach(t => {
          if (t.node.type === 'dice') t.node.label = `🤝 ${armaSec.name}`;
          else if (t.node.type === 'const') t.node = { type: 'labeled_const', value: t.node.value, label: `🤝 ${armaSec.name}` };
          else if (t.node.type === 'labeled_const') t.node.label = `🤝 ${armaSec.name} — ${t.node.label}`;
          terms.push(t);
        });
        total += parsedSec.value;
        ambidestroNome = armaSec.name;
      } catch (e) { /* fórmula inválida na 2ª arma — ignora o bônus */ }
    }
  }

  const tree = { type: 'sum', terms };
  const formula = `Dano — ${item.name}${critDobro ? (item.id === 'sem_arma' ? ' (🎯 Crítico! Maestria em dobro)' : ' (🎯 Crítico! dados dobrados)') : ''}${ambidestroNome ? ` (🤝 + ${ambidestroNome})` : ''}`;
  return { tree, total, formula, danoTotal };
}

// Rola o Dano de uma Arma/Instrumento e publica no feed de dados, igual a
// um Teste — chamado pela Habilidade Geral "Ataque com Arma"/"Ataque com 2
// Armas" (ver useSkill), sempre sobre a Arma/Instrumento atualmente
// equipado. opts.forcarAmbidestro/opts.labelPrefixo: ver
// construirRolagemDanoArma.
function rolarDanoArma(pid, itemId, opts) {
  opts = opts || {};
  if (!currentUser) return null;
  const p = PLAYERS.find(x => x.id === pid);
  const item = p && resolverArmaOuInstrumento(p, itemId);
  if (!p || !item) return null;
  const r = construirRolagemDanoArma(p, item, opts);
  if (!r) return null;

  // "Origem Comum" (Orc): a arma causou o Dano Total dela mesma — concede
  // +1 Ação neste turno. (A parte narrativa — atacar o alvo mais próximo,
  // a menos que seja um Golpe — é resolvida na mesa, não automatizada.)
  const origemComumAtiva = p.origemId === 'orc_origem_comum' && r.danoTotal;
  if (origemComumAtiva) {
    p.acoesAtuais = (p.acoesAtuais ?? p.acoesMax ?? ACOES_POR_TURNO_PADRAO) + 1;
  }

  const entry = {
    playerName: currentUser.name || (IS_NARRADOR ? 'Narrador' : 'Jogador'),
    charName: p.name,
    isNarrator: !!IS_NARRADOR,
    formula: opts.labelPrefixo ? `${opts.labelPrefixo} — ${item.name}` : r.formula,
    tree: r.tree,
    total: r.total,
    hidden: hiddenPadrao(p),
    rolling: true,
    ts: Date.now(),
    ...(origemComumAtiva ? { label: '🩸 Origem Comum — Dano Total! +1 Ação neste turno (ataca o alvo mais próximo, exceto se for um Golpe)' } : {})
  };

  spinDiceFab(true, 6);
  pushRollEntry(entry, key => {
    setTimeout(() => finishRollEntry(key), ROLL_ANIM_MS);
    setTimeout(() => spinDiceFab(false), ROLL_ANIM_MS);
  });

  // item.critPendente pode ter sido consumido acima (dados dobrados) — salva
  // e re-renderiza sempre, não só no caso de Origem Comum (mesma correção
  // já aplicada em rolarTeste/rolarAcertoHabilidade/rolarAcertoArma).
  saveState();
  renderAll();

  if (!dicePanelOpen) toggleDicePanel();
  else if (dicePanelTab !== 'feed') switchDiceTab('feed');

  return r.total;
}

// Monta a árvore de rolagem de Acerto de uma Arma/Instrumento — 1d20 +
// Maestria conforme o peso (getArmaMaestriaBonus), igual ao Acerto de uma
// Habilidade (construirRolagemAcertoHabilidade), incluindo os mesmos bônus
// "de mesa" que valem pra qualquer rolagem: Duelo (+1d6/-1d6 contra o Alvo)
// e Motivar (+1d12, consumido na hora).
// opts.forcarAmbidestro: usado pela Habilidade Geral "Ataque com 2 Armas"
// (ver rolarAcertoAtaqueGeral) — a Maestria cai pela metade (arredonda pra
// cima), exigindo uma Arma na mão secundária equipada (Talento Inferior
// "Ambidestro"); o ganho de Dano da 2ª arma acontece na rolagem de Dano
// (ver construirRolagemDanoArma), não aqui.
function construirRolagemAcertoArma(p, item, opts) {
  opts = opts || {};
  const sides = 20;
  const mb = getArmaMaestriaBonus(p, item.peso);
  const mst = mb ? mb.val : 0;

  const d1 = 1 + Math.floor(Math.random() * sides);
  const dadoNode = { type: 'dice', sides, count: 1, results: [d1], sum: d1, countNode: null };
  const terms = [{ sign: '+', node: dadoNode }];
  let total = d1;

  const ambidestroUsado = !!(opts.forcarAmbidestro && item.id !== 'sem_arma' && getArmaSecundariaEquipada(p));
  if (mst) {
    const mstFinal = ambidestroUsado ? Math.ceil(mst / 2) : mst;
    terms.push({ sign: '+', node: { type: 'labeled_const', value: mstFinal, label: 'Maestria ' + mb.attr + (ambidestroUsado ? ' /2 (Ambidestro)' : '') } });
    total += mstFinal;
  }

  // "Duelo" (Campeão): mesmo bônus/penalidade de +1d6/-1d6 do Teste e do
  // Acerto de Habilidade (ver construirRolagemTeste) — atacar com Arma
  // também conta como "acerto" pro efeito do Duelo.
  if (p.dueloAtivo) {
    const duRoll = 1 + Math.floor(Math.random() * 6);
    if (p.dueloContraAlvo) {
      terms.push({ sign: '+', node: { type: 'dice', sides: 6, count: 1, results: [duRoll], sum: duRoll, countNode: null, label: 'Duelo' } });
      total += duRoll;
    } else {
      terms.push({ sign: '-', node: { type: 'dice', sides: 6, count: 1, results: [duRoll], sum: duRoll, countNode: null, label: 'Duelo' } });
      total -= duRoll;
    }
  }

  // "Motivar" (Campeão): mesmo bônus de +1d12 do Teste/Acerto de Habilidade
  // — atacar com Arma também conta como "próxima Ação ou Teste" de Motivar.
  if (p.motivarPendente) {
    const motRoll = 1 + Math.floor(Math.random() * 12);
    terms.push({ sign: '+', node: { type: 'dice', sides: 12, count: 1, results: [motRoll], sum: motRoll, countNode: null, label: 'Motivar' } });
    total += motRoll;
    p.motivarPendente = false;
  }

  const tree = { type: 'sum', terms };
  const formula = `Rolagem de Acerto — ${item.name}`;
  const { critMin, fumbleMax, fumbleImune } = getCritThresholds(p, null, sides);

  return { sides, total, tree, formula, critMin, fumbleMax, fumbleImune, ambidestroUsado };
}

// Rola e publica no feed de dados a checagem de Acerto de uma Arma/
// Instrumento, exatamente como o Acerto de uma Habilidade — sem decidir
// sozinho se acertou ou não, só monta a rolagem completa (dado + maestria +
// bônus ativos) pra Narrador/Jogador julgarem o resultado. Chamada pela
// Habilidade Geral "Ataque com Arma"/"Ataque com 2 Armas" (ver
// rolarAcertoAtaqueGeral), sempre sobre a Arma/Instrumento atualmente
// equipado. opts.forcarAmbidestro/opts.labelPrefixo: ver
// construirRolagemAcertoArma.
function rolarAcertoArma(pid, itemId, opts) {
  opts = opts || {};
  if (!currentUser) return null;
  const p = PLAYERS.find(x => x.id === pid);
  const item = p && resolverArmaOuInstrumento(p, itemId);
  if (!p || !item) return null;
  const r = construirRolagemAcertoArma(p, item, opts);
  if (!r) return null;

  // Acerto Crítico: marca a Arma pra dobrar os dados na PRÓXIMA rolagem de
  // Dano dela (ver construirRolagemDanoArma), e já entra com o aviso certo
  // no feed — precisa ser calculado ANTES de montar/publicar a entry, já
  // que pushRollEntry serializa o objeto na hora (mutar depois não teria efeito).
  const critInfo = rollCritInfo({ tree: r.tree, critMin: r.critMin, fumbleMax: r.fumbleMax, fumbleImune: r.fumbleImune });
  if (critInfo.hasCrit) item.critPendente = true;

  const armaSecNome = r.ambidestroUsado && getArmaSecundariaEquipada(p) ? getArmaSecundariaEquipada(p).name : null;
  const labelPadrao = armaSecNome
    ? `🎯 Rolagem de Acerto (🤝 Ambidestro: Maestria pela metade — ${armaSecNome})`
    : '🎯 Rolagem de Acerto';

  const entry = {
    playerName: currentUser.name || (IS_NARRADOR ? 'Narrador' : 'Jogador'),
    charName: p.name,
    isNarrator: !!IS_NARRADOR,
    formula: opts.labelPrefixo ? `${opts.labelPrefixo} — ${item.name}` : r.formula,
    tree: r.tree,
    total: r.total,
    sides: r.sides,
    critMin: r.critMin,
    fumbleMax: r.fumbleMax,
    fumbleImune: r.fumbleImune,
    hidden: hiddenPadrao(p),
    rolling: true,
    ts: Date.now(),
    label: critInfo.hasCrit ? '🎯 Acerto Crítico! Próximo Dano desta Arma sai com os dados dobrados' : labelPadrao,
  };

  spinDiceFab(true, r.sides);
  pushRollEntry(entry, key => {
    setTimeout(() => finishRollEntry(key), ROLL_ANIM_MS);
    setTimeout(() => spinDiceFab(false), ROLL_ANIM_MS);
  });

  // Motivar/crítico podem ter sido consumidos/marcados acima — salva e
  // re-renderiza pra valer pra mesa inteira (mesma correção aplicada em
  // rolarTeste/rolarAcertoHabilidade).
  saveState();
  renderAll();

  if (!dicePanelOpen) toggleDicePanel();
  else if (dicePanelTab !== 'feed') switchDiceTab('feed');

  return r.total;
}
function tipoLabel(sk) {
  if (sk.tipo==='infinite') return '∞ livre';
  if (sk.tipo==='perturn')  return sk.usosMax + 'x/turno';
  if (sk.tipo==='luta')     return sk.usosMax + 'x/luta';
  if (sk.tipo==='sessao')   return sk.usosMax + (sk.resetSessao === false ? 'x/item' : 'x/sessão');
  if (sk.tipo==='turno_N')  return sk.turnosRecarga + '⏳ turnos';
  if (sk.tipo==='notas')    return '7 Notas';
  return '';
}
// isReady recebe opcionalmente o personagem (p) — necessário para o tipo
// 'notas' (Campos Harmônicos do Bardo), cuja disponibilidade depende das
// 7 Notas Musicais estarem todas ativas, e não de usos/recarga.
function isReady(sk, p) {
  if (sk.tipo==='infinite') return true;
  if (sk.tipo==='perturn')  return sk.usosAtuais > 0;
  if (sk.tipo==='luta' || sk.tipo==='sessao') return sk.usosAtuais > 0;
  if (sk.tipo==='turno_N')  return sk.cdRestante === 0 && sk.usosAtuais > 0;
  if (sk.tipo==='notas')    return !!p && countNotasAtivas(p) === 7;
  return false;
}

// ═══════════════════════════════════════
// AÇÕES GLOBAIS
// ═══════════════════════════════════════
// Vínculo entre uma Habilidade e o Teste que ela aciona automaticamente ao
// ser usada — ao ativar a habilidade, já rola o Teste correspondente
// (1d20 + maestria, respeitando Mega Vantagem/Desvantagem e o Bônus
// configurados naquele Teste), sem precisar rolar manualmente depois.
const SKILL_TESTE_LINK = {
  'sk_geral_acrobacia':   'acrobacia',
  'sk_geral_arremesso':   'arremessar',
  'sk_geral_empurrar':    'empurrar',
  'sk_geral_furtividade': 'furtividade',
  'sk_classe_clerigo_teste_devocao': 'devocao',
  'sk_banco_campeao_analise_rapida': 'percepcao',
};

// Narrador recarrega manualmente uma Habilidade de um Jogador, a qualquer
// momento — útil pra corrigir um engano, compensar algo da narrativa, ou só
// dar uma folga pro grupo. Restaura os usos ao máximo e zera a recarga
// pendente ("turno_N"). Habilidades "infinite" (sempre livres) e "notas"
// (Campos Harmônicos do Bardo, que dependem das 7 Notas ativas) não têm o
// que recarregar manualmente, então não fazem nada aqui.
function recarregarHabilidadeNarrador(pid, skid) {
  if (!IS_NARRADOR) return;
  const p = PLAYERS.find(x => x.id === pid);
  const sk = p && p.skills.find(s => s.id === skid);
  if (!sk) return;
  if (sk.tipo === 'turno_N') {
    sk.cdRestante = 0;
    sk.usosAtuais = sk.usosMax;
  } else if (sk.tipo === 'luta' || sk.tipo === 'sessao' || sk.tipo === 'perturn') {
    sk.usosAtuais = sk.usosMax;
  } else {
    return;
  }
  saveState();
  renderAll();
}

function useSkill(pid, skid) {
  const p = PLAYERS.find(x => x.id === pid);
  const sk = p && p.skills.find(s => s.id === skid);
  if (!sk) return;

  // Voltar da forma de Dragão pra forma humanóide é sempre livre: não gasta
  // ação, carga nem espera pronto.
  if (sk.id === 'sk_racial_dragao_metamorfose' && p.formaDragao) {
    setFormaDragao(p, false);
    saveState(); renderAll();
    return;
  }

  // Desfazer a Forma Sombria (Pandaren) também é sempre livre — mesma ideia
  // do Dragão. A Habilidade colorida da Forma (ex: Fruto Proibido) some da
  // lista, mas mantém os usos já gastos, e as Habilidades de outras cores
  // voltam a ficar disponíveis.
  if (p.race === 'Pandaren' && p.formaSombriaAtiva && p.formaSombriaId
      && PANDAREN_FORMAS_SOMBRIAS[p.formaSombriaId]
      && sk.id === PANDAREN_FORMAS_SOMBRIAS[p.formaSombriaId].skillNeutra.id) {
    // Os Pontos de Vida concedidos pela Forma (Bombado +20, Lutador +15,
    // Feiticeiro +10) só valem enquanto transformado — ao desfazer a Forma,
    // a Vida Máxima volta ao normal. A Vida Atual só é "cortada" se estiver
    // acima do novo Máximo (personagem cheio/pouco ferido); se já estiver
    // abaixo (por ter tomado dano na Forma), permanece como está — o dano já
    // consumiu o bônus, não pode ser descontado duas vezes.
    const formaDesfeita = PANDAREN_FORMAS_SOMBRIAS[p.formaSombriaId];
    const bonusVidaForma = formaDesfeita.bonusVida || 0;
    p.hpMax = Math.max(1, (p.hpMax || 0) - bonusVidaForma);
    p.hp = Math.max(0, Math.min(p.hp || 0, p.hpMax));
    p.formaSombriaAtiva = false;
    saveState(); renderAll();
    return;
  }

  if (!isReady(sk, p)) return;

  // Forma Sombria ativa (Pandaren): Habilidades de outra cor ficam
  // bloqueadas enquanto transformado.
  if (formaSombriaBloqueiaHabilidade(p, sk)) {
    const forma = PANDAREN_FORMAS_SOMBRIAS[p.formaSombriaId];
    alert(`Na Forma Sombria de ${forma.name}, só é possível usar Habilidades do tipo ${FORMA_SOMBRIA_COR_LABEL[forma.corPermitida]}.`);
    return;
  }

  // "Fúria de Orc": o bônus (+1d6 em Golpe, sem poder ser Aparada) vale só
  // pra PRÓXIMA Habilidade usada. Então, ao usar qualquer outra Habilidade
  // enquanto o badge estiver ativo, ele é consumido e some.
  if (p.furiaOrcAtiva && sk.id !== 'sk_racial_orc_furia') {
    p.furiaOrcAtiva = false;
  }

  // "Adaptação do Espaço" (Draenei): não pode ser usada durante uma Luta.
  if (sk.id === 'sk_racial_draenei_adaptacao' && combatAtivo) {
    alert('Adaptação do Espaço não pode ser usada durante uma Luta.');
    return;
  }

  // Ações do turno: habilidades com custo (0/1/2 ações) descontam do saldo
  // atual do personagem. Sem saldo suficiente, a ativação é bloqueada.
  const custo = sk.cost || 0;
  if (custo > 0) {
    const atuais = p.acoesAtuais ?? p.acoesMax ?? ACOES_POR_TURNO_PADRAO;
    if (atuais < custo) {
      alert(`Ações insuficientes! "${sk.name}" custa ${custo} ${custo === 1 ? 'ação' : 'ações'}, e ${p.name} só tem ${atuais} neste turno.`);
      return;
    }
  }

  if (sk.id === 'sk_racial_dragao_metamorfose') {
    sk.usosAtuais = Math.max(0, sk.usosAtuais - 1);
    if (sk.tipo === 'turno_N' && sk.usosAtuais === 0) sk.cdRestante = sk.turnosRecarga;
    setFormaDragao(p, true);
  } else if (p.race === 'Pandaren' && p.formaSombriaId && PANDAREN_FORMAS_SOMBRIAS[p.formaSombriaId]
      && sk.id === PANDAREN_FORMAS_SOMBRIAS[p.formaSombriaId].skillNeutra.id) {
    sk.usosAtuais = Math.max(0, sk.usosAtuais - 1);
    p.formaSombriaAtiva = true;
    // Concede os Pontos de Vida da Forma (Bombado +20, Lutador +15,
    // Feiticeiro +10) na Vida Atual e na Máxima — só valem enquanto estiver
    // transformado (removidos de novo ao desfazer a Forma, acima).
    const formaAssumida = PANDAREN_FORMAS_SOMBRIAS[p.formaSombriaId];
    const bonusVidaForma = formaAssumida.bonusVida || 0;
    p.hpMax = (p.hpMax || 0) + bonusVidaForma;
    p.hp = (p.hp || 0) + bonusVidaForma;
  } else if (sk.tipo === 'notas') {
    // Campo Harmônico: gasta TODAS as 7 Notas Musicais ao ser lançado.
    if (!p.notasBardo || typeof p.notasBardo !== 'object') p.notasBardo = {};
    NOTAS_MUSICAIS.forEach(n => { p.notasBardo[n] = false; });
  } else if (sk.tipo !== 'infinite') {
    sk.usosAtuais = Math.max(0, sk.usosAtuais - 1);
    if (sk.tipo === 'turno_N' && sk.usosAtuais === 0) sk.cdRestante = sk.turnosRecarga;
  }

  // Habilidades do Dançarino concedem uma Nota Musical fixa ao serem usadas
  // (ex: Breakdance ganha Fá). Quando a nota é livre ("qualquer"), não ativa
  // sozinho — o jogador escolhe manualmente nos botões de Notas da ficha.
  if (sk.concedeNota && sk.concedeNota !== 'qualquer' && NOTAS_MUSICAIS.includes(sk.concedeNota)) {
    if (!p.notasBardo || typeof p.notasBardo !== 'object') p.notasBardo = {};
    p.notasBardo[sk.concedeNota] = true;
  }

  if (custo > 0) {
    p.acoesAtuais = Math.max(0, (p.acoesAtuais ?? p.acoesMax ?? ACOES_POR_TURNO_PADRAO) - custo);
  }

  // "Fúria de Orc" acabou de ser usada: liga o badge de +1d6 em Golpe
  // (sem poder ser Aparada) na próxima Habilidade.
  if (sk.id === 'sk_racial_orc_furia') {
    p.furiaOrcAtiva = true;
  }

  // "Treinamento Militar" (Orc): liga a marca no próximo Aparar — ele fica
  // Garantido e com 50% de chance de Crítico (10 ou mais no d20). É
  // consumido automaticamente na hora de rolar o Teste de Aparar (ver
  // construirRolagemTeste/getCritThresholds), não aqui.
  if (sk.id === 'sk_racial_orc_treinamento_militar') {
    p.treinamentoMilitarPendente = true;
  }

  // "Arsenal" (Habilidade Geral): fora de Luta, trocar de Arma/Instrumento
  // equipado é sempre livre (badge direto no card do Inventário). Em Luta,
  // essa troca só é permitida depois de usar Arsenal — liga a marca aqui;
  // ela é consumida na hora da troca de verdade (ver toggleEquipArma/
  // equiparSemArma), valendo pra 1 troca só, igual ao "1x/turno" da própria
  // Habilidade.
  if (sk.id === 'sk_geral_arsenal') {
    p.arsenalPendente = true;
  }

  saveState();
  renderAll();

  // "Colosso" (Origem, Troll): usar uma Habilidade encantada (Encantamento
  // Troll) é amaldiçoado — abre a escolha de 1d6 Dano ou 1d6 Insanidade.
  if (skillEhEncantamentoTrollAmaldicoado(p, sk)) {
    abrirEncantamentoAmaldicoadoModal(pid, sk.id, sk.name);
    return;
  }

  // "Teste Mental" pode ser usada com qualquer Teste de Intelecto ou o
  // Teste de Emoção — pergunta qual rolar, em vez de decidir sozinho.
  if (sk.id === 'sk_geral_teste_mental') {
    abrirTesteMentalModal(pid);
    return;
  }

  // "Arsenal": abre direto a lista de Armas/Instrumentos do Inventário (+
  // "Sem Arma") pra escolher com um clique a nova equipada, em vez do
  // jogador precisar ir até o card certo no Inventário. Em Luta, a marca
  // p.arsenalPendente (ligada acima) libera essa troca; fora de Luta a
  // troca já é livre de qualquer forma.
  if (sk.id === 'sk_geral_arsenal') {
    abrirArsenalModal(pid);
    return;
  }

  // "Forjado a Luz" (origem racial Draenei): mostra as Bênçãos da Luz (mesmo
  // catálogo do Clérigo, ver DEUSES_CLERIGO['Luz'].bencaos) pra escolher qual
  // lançar. É só referência/narrativa — o custo de Ação e o uso já foram
  // aplicados acima, igual qualquer outra Habilidade.
  if (sk.id === 'sk_origem_draenei_forjado_luz') {
    abrirForjadoLuzModal(pid);
    return;
  }

  // "Adaptação do Espaço" (Draenei): abre o seletor de Teste (nunca Emoção)
  // pra escolher em qual Teste ficam os +3 de Vantagem fixos.
  if (sk.id === 'sk_racial_draenei_adaptacao') {
    abrirAdaptacaoEspacoModal(pid);
    return;
  }

  // "Análise Rápida" (Campeão): marca o próximo Teste de Percepção (rolado
  // automaticamente logo abaixo, via SKILL_TESTE_LINK) para receber +1d4 de
  // Vantagem e não poder tirar Falha Crítica — ver construirRolagemTeste/
  // getCritThresholds, que leem e consomem essa marca.
  if (sk.id === 'sk_banco_campeao_analise_rapida') {
    p.analiseRapidaPendente = true;
  }

  // "Conclamar" (Campeão): fora de Luta, o efeito é só chamar a atenção de
  // todos ao redor (puramente narrativo, sem automação). Em Luta, abre a
  // escolha entre chamar a atenção de um Alvo (narrativo, resolvido na
  // mesa) ou reduzir em 2 turnos a recarga de Grito de Guerra ou Motivar
  // (automatizado de verdade — ver abrirConclamarModal/escolherConclamar).
  if (sk.id === 'sk_banco_campeao_conclamar' && combatAtivo) {
    abrirConclamarModal(pid);
    return;
  }

  // "Duelo" (Campeão): ativa o status persistente — o jogador alterna
  // manualmente pelo badge no cabeçalho se cada rolagem seguinte conta como
  // "contra o Alvo" ou "contra outro Alvo" (ver toggleDueloAlvo). Começa
  // marcado como "contra o Alvo", já que acabou de escolher o Alvo agora.
  if (sk.id === 'sk_banco_campeao_duelo') {
    p.dueloAtivo = true;
    p.dueloContraAlvo = true;
    // Diferente das outras marcas acima (ex: Análise Rápida), o Duelo não
    // é consumido por uma rolagem logo em seguida — o badge/toggle precisa
    // aparecer JÁ na tela assim que a Habilidade é usada, então salva e
    // renderiza aqui mesmo (o saveState()/renderAll() geral já rodou antes
    // deste bloco, então sem isso o estado só apareceria no próximo render
    // disparado por outra ação, ou só após recarregar a página).
    saveState();
    renderAll();
  }

  // "Gambiarra de Alto Nível" (Campeão): abre o seletor de Arma pra escolher
  // se recarrega os "usos" dela ou a Munição (ver abrirGambiarraModal/
  // escolherGambiarra). O custo (1 ação) e o uso já foram aplicados acima,
  // igual qualquer outra Habilidade — o modal só resolve o efeito.
  if (sk.id === 'sk_banco_campeao_gambiarra_de_alto_nivel') {
    abrirGambiarraModal(pid);
    return;
  }

  // "Honra" (Campeão): abre a escolha entre as 3 opções (ver
  // abrirHonraModal/escolherHonra) — o custo (1 ação) e o uso já foram
  // aplicados acima, o modal só resolve o efeito.
  if (sk.id === 'sk_banco_campeao_honra') {
    abrirHonraModal(pid);
    return;
  }

  // "Motivar" (Campeão): concede +1d12 de Vantagem no próximo Teste OU
  // Acerto de Habilidade de cada Aliado (os demais Jogadores) — 1 uso só,
  // consumido na hora (ver p.motivarPendente, lido e apagado tanto em
  // construirRolagemTeste quanto em construirRolagemAcertoHabilidade,
  // qualquer que role primeiro).
  if (sk.id === 'sk_banco_campeao_motivar') {
    PLAYERS.forEach(aliado => {
      if (aliado.id !== p.id) aliado.motivarPendente = true;
    });
    saveState();
    renderAll();
  }

  // "Grito de Guerra" (Campeão): concede Mega Vantagem em TODOS os Testes
  // dos Aliados (os demais Jogadores) até o próximo turno — sem mexer no
  // botão MV manual de cada Teste; fica marcado à parte em
  // p.gritoDeGuerraAtivo (ver construirRolagemTeste, que soma essa marca à
  // condição de Mega Vantagem) e é limpo automaticamente no próximo reset de
  // turno (ver aplicarResetDeTurno). "Eles não podem Desviar" é uma
  // restrição ampla igual à de Fúria — não é bloqueada pelo app, fica por
  // conta da mesa/Narrador.
  if (sk.id === 'sk_banco_campeao_grito_de_guerra') {
    PLAYERS.forEach(aliado => {
      if (aliado.id !== p.id) aliado.gritoDeGuerraAtivo = true;
    });
    saveState();
    renderAll();
  }

  // "Fôlego Extra" (Campeão): concede 1 Ação a mais imediatamente ao ser usada.
  if (sk.id === 'sk_banco_campeao_folego_extra') {
    p.acoesAtuais = (p.acoesAtuais ?? p.acoesMax ?? ACOES_POR_TURNO_PADRAO) + 1;
    saveState();
    renderAll();
  }

  // "Recurso" (Habilidade Geral): não "acerta" nada — abre a escolha de qual
  // tipo de item pegar (Pequeno/Médio/Grande, com custo em Dinheiro decidido
  // por dado, OU Poção de Cura por um valor fixo). Ver abrirRecursoModal.
  if (sk.id === 'sk_geral_recurso') {
    abrirRecursoModal(pid);
    return;
  }

  // "Beber Poção" (Habilidade Geral): não "acerta" nada (ver
  // HABILIDADES_SEM_ACERTO), então o efeito já resolve aqui. Se o Inventário
  // tiver alguma "Poção de Cura", abre a escolha entre os dois efeitos de
  // Cura do texto da Habilidade (1d20 ou 10 de Vida) e consome 1 unidade
  // dela; sem esse item específico, fica só como consumo narrativo (outros
  // tipos de Poção não têm efeito automatizado no app).
  if (sk.id === 'sk_geral_beber_poção') {
    const pocaoCura = (p.inventario || []).find(it =>
      normalizarNomeItem(it.name).includes('pocao de cura') && (it.qtd == null || it.qtd > 0));
    if (pocaoCura) {
      abrirBeberPocaoModal(pid, pocaoCura.id);
      return;
    }
  }

  // "Ataque com Arma"/"Ataque com 2 Armas" (Habilidades Gerais): não abrem
  // modal — o "Usar Efeito" É a rolagem de Dano da Arma/Instrumento
  // equipado na mão principal (ver getArmaEquipadaPrincipal). "Ataque com 2
  // Armas" soma o Dano da 2ª arma (mão secundária) também — reaproveita
  // rolarDanoArma/opts.forcarAmbidestro, mesmo mecanismo do Talento
  // Inferior "Ambidestro" (ver rolarDanoAtaqueGeral).
  if (sk.id === 'sk_geral_ataque_com_arma' || sk.id === 'sk_geral_ataque_com_2_armas') {
    rolarDanoAtaqueGeral(pid, sk.id);
    return;
  }

  // Habilidade vinculada a um único Teste (ex: Acrobacia) — rola automaticamente.
  const testeVinculado = SKILL_TESTE_LINK[sk.id];
  if (testeVinculado) rolarTeste(pid, testeVinculado);
}

// Remove acentos/caixa pra comparar nomes de item de forma tolerante (ex:
// "Poção de Cura", "poção de cura", "POÇÃO DE CURA" todos batem igual).
function normalizarNomeItem(nome) {
  return (nome || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Reset de recursos de turno: incrementa o contador global (turnGlobal),
// devolve as Ações de todos os Jogadores, recarrega habilidades "Por Turno"
// e reduz 1 turno de recarga das habilidades "turno_N" (liberando-as quando
// zerarem). É o "coração" da passagem de turno — chamado tanto pelo botão
// "Próximo Turno" do cabeçalho (uso manual, fora de combate) quanto
// automaticamente pelo avancarTurno() quando uma rodada de iniciativa se
// completa (ver unificação abaixo).
function aplicarResetDeTurno() {
  turnGlobal++;
  PLAYERS.forEach(p => {
    p.acoesAtuais = p.acoesMax ?? ACOES_POR_TURNO_PADRAO;
    // "Grito de Guerra" (Campeão): a Mega Vantagem concedida aos Aliados vale
    // só até o próximo turno — limpa a marca aqui.
    p.gritoDeGuerraAtivo = false;
    // "Arsenal": a permissão pra trocar de Arma vale só dentro do turno em
    // que foi usada — se não foi aproveitada, não carrega pro próximo.
    p.arsenalPendente = false;
    // "Treinamento Militar" (Orc): +1 Ação garantida neste turno, escolhida
    // como recompensa do Crítico no Aparar — consome a marca ao aplicar.
    if (p.treinamentoMilitarAcaoExtra) {
      p.acoesAtuais += 1;
      p.treinamentoMilitarAcaoExtra = false;
    }
    p.skills.forEach(sk => {
      if (sk.tipo === 'perturn') { sk.usosAtuais = sk.usosMax; }
      if (sk.tipo === 'turno_N' && sk.cdRestante > 0) {
        sk.cdRestante--;
        if (sk.cdRestante === 0) sk.usosAtuais = sk.usosMax;
      }
    });
    // Usos de Arma ("Usar Nx") com escopo "Por Turno"
    resetUsosArmaPorEscopo(p, ['turno']);
  });
}

// Botão "Próximo Turno" do cabeçalho do Narrador — avança o turno global
// manualmente, sem depender da ordem de iniciativa (útil fora de combate,
// ou para forçar um reset de recursos a qualquer momento).
function nextTurnGlobal() {
  aplicarResetDeTurno();
  saveState();
  renderAll();
}

function resetLuta() {
  if (!confirm('Resetar todos os usos por luta, reiniciar os turnos e encerrar o combate atual?')) return;
  turnGlobal = 1;
  INITIATIVE = [];
  turnoAtualId = null;
  combatAtivo = false;
  PLAYERS.forEach(p => {
    p.acoesAtuais = p.acoesMax ?? ACOES_POR_TURNO_PADRAO;
    p.gritoDeGuerraAtivo = false;
    p.skills.forEach(sk => {
      if (['perturn','luta','turno_N'].includes(sk.tipo)) {
        sk.usosAtuais = sk.usosMax;
        sk.cdRestante = 0;
      }
    });
    // Usos de Arma ("Usar Nx") com escopo "Por Luta" ou "Por Turno"
    resetUsosArmaPorEscopo(p, ['luta','turno']);
    // Notas do Bardo: resetar no início de cada luta
    if (p.classeBase === 'Bardo' && p.notasBardo) {
      NOTAS_MUSICAIS.forEach(n => { p.notasBardo[n] = false; });
    }
    p.furiaOrcAtiva = false;
    p.dueloAtivo = false;
    p.arsenalPendente = false;
  });
  saveState();
  renderAll();
}

function resetSessao() {
  if (!confirm('Resetar todos os usos por sessão?')) return;
  PLAYERS.forEach(p => {
    p.skills.forEach(sk => {
      sk.cdRestante = 0;
      // resetSessao === false: usos "por item" (ex: Loucura Acumulada) —
      // não recarrega automaticamente num Reset de Sessão.
      if (sk.resetSessao === false) return;
      sk.usosAtuais = sk.usosMax;
    });
    // Usos de Arma ("Usar Nx") com escopo "Por Sessão"
    resetUsosArmaPorEscopo(p, ['sessao']);
    // Aprimoramento Dourado "Encantamento Aprimorado": restaura TODOS os usos
    // da arma/instrumento/proteção que tiver esse Aprimoramento, mesmo os
    // de escopo "Por Arma" (que normalmente não recarregam sozinhos).
    (p.inventario || []).forEach(item => {
      if ((item.tipo === 'arma' || item.tipo === 'instrumento' || item.tipo === 'protecao') && Array.isArray(item.usos) && temEncantamentoAprimorado(item)) {
        item.usos.forEach(u => { u.usosAtuais = u.usosMax; });
      }
    });
    // Notas do Bardo: resetar também no reset de sessão
    if (p.classeBase === 'Bardo' && p.notasBardo) {
      NOTAS_MUSICAIS.forEach(n => { p.notasBardo[n] = false; });
    }
    p.furiaOrcAtiva = false;
  });
  saveState();
  renderAll();
}

function adjHP(id, d) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return; p.hp = Math.max(0, Math.min(p.hpMax, p.hp + d));
  saveState(); renderAll();
}

function setHP(id, val) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return;
  const v = parseInt(val);
  if (isNaN(v)) { renderAll(); return; }
  p.hp = Math.max(0, Math.min(p.hpMax, v));
  saveState(); renderAll();
}

function adjIns(id, d) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return; p.ins = Math.max(0, Math.min(getInsanidadeMax(p), p.ins + d));
  saveState(); renderAll();
}

function setIns(id, val) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return;
  const v = parseInt(val);
  if (isNaN(v)) { renderAll(); return; }
  p.ins = Math.max(0, Math.min(getInsanidadeMax(p), v));
  saveState(); renderAll();
}

// Humanidade — exclusivo de Bruxo. Máximo sempre HUMANIDADE_MAX (fixo, não
// editável); apenas o valor Atual pode subir/baixar dentro desse limite.
function adjHumanidade(id, d) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return;
  p.humanidade = Math.max(0, Math.min(HUMANIDADE_MAX, getHumanidade(p) + d));
  saveState(); renderAll();
}

function setHumanidade(id, val) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return;
  const v = parseInt(val);
  if (isNaN(v)) { renderAll(); return; }
  p.humanidade = Math.max(0, Math.min(HUMANIDADE_MAX, v));
  saveState(); renderAll();
}

// Pecado — exclusivo de Clérigo. Sem teto fixo (sobe conforme o jogo evolui),
// só não pode ficar negativo.
function adjPecado(id, d) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return;
  p.pecado = Math.max(0, getPecado(p) + d);
  saveState(); renderAll();
}

function setPecado(id, val) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return;
  const v = parseInt(val);
  if (isNaN(v)) { renderAll(); return; }
  p.pecado = Math.max(0, v);
  saveState(); renderAll();
}

// ── Notas musicais — exclusivo de Bardo ──────────────────────────────────────
// Ativa ou desativa uma nota (toggle). Não acumula: cada nota é um slot único.
function toggleNota(id, nota) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return;
  if (!p.notasBardo || typeof p.notasBardo !== 'object') {
    p.notasBardo = {};
    NOTAS_MUSICAIS.forEach(n => { p.notasBardo[n] = false; });
  }
  p.notasBardo[nota] = !p.notasBardo[nota];
  saveState(); renderAll();
}

// Limpa todas as notas (ex: fim de sessão / reset de luta)
function resetNotasBardo(id) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return;
  p.notasBardo = {};
  NOTAS_MUSICAIS.forEach(n => { p.notasBardo[n] = false; });
  saveState(); renderAll();
}

// Aprimoramento de Armadura "Carapaça Antimagia" (ver APRIMORAMENTOS_ARMADURA):
// concede uma Armadura secundária ("Armadura Anti-Magia"), exclusiva contra
// Feitiços, com valor máx = maestria de Agilidade/2 (arredondado pra baixo).
// Só existe enquanto o personagem tiver uma Armadura equipada com esse
// Aprimoramento. Restaura manualmente (não há gatilho automático de
// "fim de Jornada/Aventura/Campanha" no app).
function temCarapacaAntimagia(p) {
  return !!(p && (p.inventario || []).some(item =>
    item.tipo === 'protecao' && item.subtipo === 'armadura' && item.equipado &&
    Array.isArray(item.aprimoramentos) && item.aprimoramentos.some(a => a.catalogId === 'carapaca_antimagia')
  ));
}

function syncArmaduraAntiMagia(p) {
  if (!temCarapacaAntimagia(p)) return;
  const max = Math.ceil(maestriaDe(p, 'agi') / 2);
  const jaTinha = typeof p.armaduraAntiMagiaMax === 'number';
  p.armaduraAntiMagiaMax = max;
  if (!jaTinha || typeof p.armaduraAntiMagia !== 'number') p.armaduraAntiMagia = max;
  if (p.armaduraAntiMagia > max) p.armaduraAntiMagia = max;
}

function adjArmaduraAntiMagia(id, d) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return;
  syncArmaduraAntiMagia(p);
  p.armaduraAntiMagia = Math.max(0, Math.min(p.armaduraAntiMagiaMax || 0, (p.armaduraAntiMagia || 0) + d));
  saveState(); renderAll();
}

function setArmaduraAntiMagia(id, val) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return;
  const v = parseInt(val);
  if (isNaN(v)) { renderAll(); return; }
  syncArmaduraAntiMagia(p);
  p.armaduraAntiMagia = Math.max(0, Math.min(p.armaduraAntiMagiaMax || 0, v));
  saveState(); renderAll();
}

function restaurarArmaduraAntiMagia(id) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return;
  syncArmaduraAntiMagia(p);
  p.armaduraAntiMagia = p.armaduraAntiMagiaMax || 0;
  saveState(); renderAll();
}

// Armadura/Elmo Dracônicos: enquanto equipados, a Armadura/Elmo do
// personagem nunca pode ser reduzida abaixo de 5 (mas ainda pode ser
// recuperada normalmente, e o teto continua sendo o Máximo de cada um).
function temArmaduraDraconicaEquipada(p) {
  return (p.inventario || []).some(it => it.dragaoForma && it.subtipo === 'armadura' && it.equipado);
}
function temElmoDraconicoEquipado(p) {
  return (p.inventario || []).some(it => it.dragaoForma && it.subtipo === 'elmo' && it.equipado);
}

function adjArmadura(id, d) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return;
  const piso = temArmaduraDraconicaEquipada(p) ? 5 : 0;
  p.armadura = Math.max(piso, Math.min(p.armaduraMax || 0, (p.armadura || 0) + d));
  saveState(); renderAll();
}

function setArmadura(id, val) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return;
  const v = parseInt(val);
  if (isNaN(v)) { renderAll(); return; }
  const piso = temArmaduraDraconicaEquipada(p) ? 5 : 0;
  p.armadura = Math.max(piso, Math.min(p.armaduraMax || 0, v));
  saveState(); renderAll();
}

function adjElmo(id, d) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return;
  const piso = temElmoDraconicoEquipado(p) ? 5 : 0;
  p.elmo = Math.max(piso, Math.min(p.elmoMax || 0, (p.elmo || 0) + d));
  saveState(); renderAll();
}

function setElmo(id, val) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return;
  const v = parseInt(val);
  if (isNaN(v)) { renderAll(); return; }
  const piso = temElmoDraconicoEquipado(p) ? 5 : 0;
  p.elmo = Math.max(piso, Math.min(p.elmoMax || 0, v));
  saveState(); renderAll();
}

function adjCristais(id, d) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return; p.cristais = Math.max(0, (p.cristais || 0) + d);
  saveState(); renderAll();
}

function setCristais(id, val) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return;
  const v = parseInt(val);
  if (isNaN(v)) { renderAll(); return; }
  p.cristais = Math.max(0, v);
  saveState(); renderAll();
}

function adjDinheiro(id, d) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return; p.dinheiro = Math.max(0, (p.dinheiro || 0) + d);
  saveState(); renderAll();
}

function setDinheiro(id, val) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return;
  const v = parseInt(val);
  if (isNaN(v)) { renderAll(); return; }
  p.dinheiro = Math.max(0, v);
  saveState(); renderAll();
}

// Ações do turno — sem teto: o Mestre pode dar ações-bônus além do normal
// (ex: 3/2), só não deixa passar de 0 pra baixo. Reseta pro valor base
// (acoesMax) a cada Próximo Turno, em nextTurnGlobal().
function adjAcoes(id, d) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return;
  p.acoesAtuais = Math.max(0, (p.acoesAtuais ?? p.acoesMax ?? ACOES_POR_TURNO_PADRAO) + d);
  saveState(); renderAll();
}

function setAcoes(id, val) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return;
  const v = parseInt(val);
  if (isNaN(v)) { renderAll(); return; }
  p.acoesAtuais = Math.max(0, v);
  saveState(); renderAll();
}

// Recalcula armaduraMax/elmoMax a partir do item de proteção EQUIPADO no
// inventário (apenas 1 armadura e 1 elmo podem estar equipados por vez).
// Se o jogador ainda não tem nenhum item daquele tipo no inventário, o valor
// atual é mantido (evita zerar fichas antigas que nunca usaram o inventário).
function recomputeProtMax(p) {
  if (!Array.isArray(p.inventario)) return;
  ['armadura', 'elmo'].forEach(sub => {
    const itensSub = p.inventario.filter(i => i.tipo === 'protecao' && i.subtipo === sub);
    if (!itensSub.length) return;
    const equipado = itensSub.find(i => i.equipado);
    const novoMax = equipado ? (Number(equipado.valor) || 0) : 0;
    if (sub === 'armadura') {
      const delta = novoMax - (p.armaduraMax || 0);
      p.armaduraMax = novoMax;
      p.armadura = Math.max(0, Math.min(novoMax, (p.armadura || 0) + (delta > 0 ? delta : 0)));
    } else {
      const delta = novoMax - (p.elmoMax || 0);
      p.elmoMax = novoMax;
      p.elmo = Math.max(0, Math.min(novoMax, (p.elmo || 0) + (delta > 0 ? delta : 0)));
    }
  });

  // Passos: proteções equipadas podem ter uma penalidade de Passos (ex.: armaduras
  // mais pesadas reduzem o deslocamento). p.passosBase guarda o valor original do
  // personagem (definido na ficha); p.passos é sempre recalculado a partir dele.
  // Exceção: na Forma de Dragão, os Passos ficam CONGELADOS no valor de antes
  // de se transformar (ver setFormaDragao) — não recalcula aqui.
  if (typeof p.passosBase !== 'number') p.passosBase = typeof p.passos === 'number' ? p.passos : 10;
  if (p.race === 'Dragão' && p.formaDragao) return;
  const equipadas = p.inventario.filter(i => i.tipo === 'protecao' && i.equipado);
  const penalidadeTotal = equipadas.reduce((acc, i) => acc + (Number(i.passosPenalidade) || 0), 0);
  // Aprimoramento de Armadura "Ligeirinho": +maestria de Agilidade/2 (arredondado
  // pra cima) em Passos, enquanto a armadura com esse Aprimoramento estiver equipada.
  const temLigeirinho = equipadas.some(i => Array.isArray(i.aprimoramentos) && i.aprimoramentos.some(a => a.catalogId === 'ligeirinho'));
  const bonusLigeirinho = temLigeirinho ? Math.ceil(maestriaDe(p, 'agi') / 2) : 0;
  // Origem Demoníaca (Draenei): +2 de Passos fixo, sempre que tiver essa origem.
  const bonusOrigemDemoniaca = (p.race === 'Draenei' && p.origemId === 'draenei_origem_demoniaco') ? 2 : 0;
  p.passos = Math.max(0, p.passosBase - penalidadeTotal + bonusLigeirinho + bonusOrigemDemoniaca);
}

// Efeitos automáticos de subida/queda de Nível dependentes de raça.
// Hoje usado apenas pelo Tauren ("De bem com a Vida": +4 de Vida a cada
// subida de Nível, fora do orçamento normal de pontos de atributo).
function onLevelUp(p) {
  if (p.race === 'Tauren') {
    p.hpMax = (p.hpMax || 0) + TAUREN_HP_POR_NIVEL;
    p.hp = (p.hp || 0) + TAUREN_HP_POR_NIVEL;
  }
  // Anão (Origem Comum): ao subir de Nível, libera 1 rolagem de 1d10 com Mega
  // Vantagem — o botão só aparece até ser usado (ver rolarOrigemComum).
  if (p.race === 'Anão' && p.origemId === 'anao_origem_comum') {
    p.origemComumPendente = true;
  }
  // Anão (Origem das Profundezas): ao subir de Nível, libera 1 escolha de
  // arma pra ganhar +1 de Dano (acumulativo, vale pra todas as cópias com o
  // mesmo nome) — ver abrirOrigemProfundezasModal.
  if (p.race === 'Anão' && p.origemId === 'anao_origem_profundezas') {
    p.origemProfundezasPendente = true;
  }
  // "Origem de Vento Bravo" (Humano): subir de Nível libera 3 escolhas
  // novas (1 Teste de cada tipo). Abre o modal sozinho na hora, em vez de
  // só mostrar um botão — assim o jogador não esquece de preencher.
  if (p.origemId === 'humano_origem_vento_bravo') {
    setTimeout(() => abrirVentoBravoModal(p.id), 300);
  }
  // "Origem de Kalindor" (Humano): mesma ideia — subir de Nível libera 1
  // escolha de Vantagem + 1 de Desvantagem novas.
  if (p.origemId === 'humano_origem_kalindor') {
    setTimeout(() => abrirKalindorModal(p.id), 300);
  }
  // "Origem Mag'har" (Orc): subir de Nível libera 1 escolha nova de
  // Habilidade pra marcar com +1d4 de Dano/Cura.
  if (p.origemId === 'orc_origem_maghar' && p.magharTesteMD) {
    setTimeout(() => abrirMagharHabModal(p.id), 300);
  }
  // Draenei (Origem Demoníaca): ao subir de Nível, +1 de Passos permanente
  // (acumula no passosBase) e 1d8 de Insanidade — rolado de verdade e
  // publicado no feed de dados (ver rolarInsanidadeOrigemDemoniaca).
  if (p.race === 'Draenei' && p.origemId === 'draenei_origem_demoniaco') {
    p.passosBase = (p.passosBase || 10) + 1;
    setTimeout(() => rolarInsanidadeOrigemDemoniaca(p.id), 400);
  }
  // Dragão: se estiver na Forma de Dragão ao subir de Nível, atualiza o
  // valor da Armadura/Elmo Dracônicos (escalam com o Nível).
  if (p.race === 'Dragão' && p.formaDragao && Array.isArray(p.inventario)) {
    p.inventario.forEach(it => {
      if (it.id === 'inv_dragao_armadura_' + p.id) it.valor = valorArmaduraDraconica(p);
      if (it.id === 'inv_dragao_elmo_' + p.id) it.valor = valorElmoDraconico(p);
    });
  }
  // "Filosofia Pandarênica" (Pandaren, Origem Comum): a passiva só existe a
  // partir do Nível 3 — assim que o personagem chega lá (ou passa disso e
  // ainda não escolheu), abre o modal de escolha sozinho, em vez de só
  // mostrar o botão na ficha (mesma ideia da Vento Bravo/Kalindor/Mag'har).
  if (p.origemId === 'pandaren_origem_comum' && (p.isNPC || (p.level || 1) >= 3) && !p.filosofiaPandarenicaCor) {
    setTimeout(() => abrirFilosofiaPandarenicaModal(p.id), 300);
  }
}
function onLevelDown(p) {
  if (p.race === 'Tauren') {
    p.hpMax = Math.max(1, (p.hpMax || 0) - TAUREN_HP_POR_NIVEL);
    p.hp = Math.min(p.hp || 0, p.hpMax);
  }
}

function addXP(id) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return;
  if (p.xp >= 10 && p.level < 5) { p.xp = 0; p.level++; p.pontosPendentes = (p.pontosPendentes || 0) + POINT_BUY_PER_LEVEL; onLevelUp(p); }
  else if (p.xp < 10) p.xp++;
  saveState(); renderAll();
}

function removeXP(id) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return;
  if (p.xp > 0) { p.xp--; }
  else if (p.level > 1) { p.level--; p.xp = 9; p.pontosPendentes = Math.max(0, (p.pontosPendentes || 0) - POINT_BUY_PER_LEVEL); onLevelDown(p); }
  saveState(); renderAll();
}

function setXPDirect(id, val) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return;
  const newVal = Math.max(0, Math.min(10, val));
  if (newVal >= 10 && p.xp < 10 && p.level < 5) {
    p.xp = 0; p.level++; p.pontosPendentes = (p.pontosPendentes || 0) + POINT_BUY_PER_LEVEL; onLevelUp(p);
  } else {
    p.xp = newVal;
  }
  saveState(); renderAll();
}

// ═══════════════════════════════════════
// RENDER NARRADOR
// ═══════════════════════════════════════
function renderNarrador() {
  // Enquanto o Banco de NPCs está aberto, PLAYERS aponta pro banco — não é a
  // lista de personagens desta campanha, então não há o que renderizar aqui.
  if (bankModeActive) return;
  renderNarradorGroup(PLAYERS.filter(p => !p.isNPC), 'nar-players', false, false);
  renderNarradorGroup(PLAYERS.filter(p => p.isNPC), 'nar-npcs', true, false);
}

// Renderiza um grupo de personagens (jogadores, NPCs desta campanha, ou os
// NPCs do Banco) no container indicado.
// `editable` diferencia os NPCs: além dos controles que o Narrador já tem
// para qualquer personagem (vida, ações, insanidade, armadura...), NPCs
// também ganham os botões de gerenciamento completo da ficha — adicionar
// habilidade, escolher da Subclasse, adicionar passiva/talento, e edição de
// inventário — os mesmos que o próprio Jogador usa na ficha dele, já que o
// NPC não tem um jogador do outro lado pra fazer isso.
// `isBank` (só true quando chamado de dentro do modal do Banco) troca o botão
// de excluir por "excluir do banco" e acrescenta o botão "Chamar para a
// campanha".
function renderNarradorGroup(list, containerId, editable, isBank) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!list.length) {
    container.innerHTML = (isBank && npcBankSearchQuery)
      ? '<div style="text-align:center; padding: 40px; color: var(--text3);">Nenhum NPC encontrado para essa busca.</div>'
      : isBank
      ? '<div style="text-align:center; padding: 40px; color: var(--text3);">Seu Banco de NPCs está vazio. Clique em "Criar NPC" para começar.</div>'
      : (editable
        ? '<div style="text-align:center; padding: 40px; color: var(--text3);">Nenhum NPC chamado nesta campanha ainda. Abra o Banco de NPCs para chamar um.</div>'
        : '<div style="text-align:center; padding: 40px; color: var(--text3);">Nenhum jogador na campanha ainda.</div>');
    return;
  }

  container.innerHTML = list.map((p, i) => {
    const av = AVATARS[i % AVATARS.length];
    const hpPct = Math.round(p.hp / p.hpMax * 100);
    const insPct = Math.round(p.ins / getInsanidadeMax(p) * 100);
    const armPct = p.armaduraMax > 0 ? Math.round(p.armadura / p.armaduraMax * 100) : 0;
    const elmPct = p.elmoMax > 0 ? Math.round(p.elmo / p.elmoMax * 100) : 0;
    const isBruxo = p.classeBase === 'Bruxo';
    const isBardo = p.classeBase === 'Bardo';
    const isClerigo = p.classeBase === 'Clérigo';
    const humanPct = Math.round(getHumanidade(p) / HUMANIDADE_MAX * 100);
    const bm = p.hp === 0;

    // ── Habilidades agrupadas por atributo ──
    const gruposNar = { green:[], red:[], blue:[], gray:[] };
    p.skills.forEach(sk => { if (!habilidadeFormaSombriaEscondida(p, sk)) gruposNar[sk.color] && gruposNar[sk.color].push(sk); });
    const narGrupoInfo = {
      green: { label: 'Agilidade', icon: '🏃', attr: p.agi, campo: 'agi' },
      red:   { label: 'Força',     icon: '⚔️',  attr: p.forca, campo: 'forca' },
      blue:  { label: 'Intelecto', icon: '✨',  attr: p.intel, campo: 'intel' },
      gray:  { label: 'Neutras',   icon: '⚙️',  attr: null, campo: null },
    };

    const skillsExpanded = !!narSkillsExpanded[p.id];
    const passivasExpanded = !!narPassivasExpanded[p.id];
    const inventarioExpanded = !!narInventarioExpanded[p.id];

    let gruposHtml = '';
    ['green','red','blue','gray'].forEach(cor => {
      if (!gruposNar[cor].length) return;
      const info = narGrupoInfo[cor];
      const mst = info.campo != null ? maestriaDe(p, info.campo) : null;
      const chips = gruposNar[cor].map(sk => {
        const temUso = isReady(sk, p);
        const bloqueadaPorForma = formaSombriaBloqueiaHabilidade(p, sk);
        const ready = temUso && !bloqueadaPorForma;
        let extra = '';
        if (sk.tipo === 'turno_N' && sk.cdRestante > 0) extra = `<span class="chip-cd">⏳${sk.cdRestante}</span>`;
        else if ((sk.tipo==='luta'||sk.tipo==='sessao') && sk.usosAtuais < sk.usosMax) extra = `<span class="chip-cd">${sk.usosAtuais}/${sk.usosMax}</span>`;
        const descTooltip = sk.desc ? `Efeito: ${sk.desc}\n\n` : '';
        const statusTooltip = bloqueadaPorForma ? `Bloqueada pela Forma Sombria (só ${FORMA_SOMBRIA_COR_LABEL[PANDAREN_FORMAS_SOMBRIAS[p.formaSombriaId].corPermitida]})` : ready ? 'Pronta para uso' : `Indisponível (${tipoLabel(sk)})`;
        const lendarioTooltip = sk.lendario ? `Feitiço Lendário — Maestria: +${getMaestriaLendaria(p)} (Intelecto/2)\n\n` : '';
        const corromperTooltip = getCorromperTextoPlano(sk);
        const efeitoSecTxt = getEfeitoSecundarioTextoPlano(p, sk);
        const efeitoSecIcone = (sk.efeitoSecundario && EFEITOS_SECUNDARIOS_ESPECIAIS[sk.efeitoSecundario.tipo] && EFEITOS_SECUNDARIOS_ESPECIAIS[sk.efeitoSecundario.tipo].icone) || '✨';
        const efeitoSecBadge = efeitoSecTxt ? `<span class="chip-badge" style="background:rgba(124,92,191,0.25);color:#b89aff;border-color:rgba(155,125,224,0.45)">${efeitoSecIcone}</span>` : '';
        const magharBadge = getMagharHabBonus(p, sk.id) ? `<span class="chip-badge" style="background:rgba(109,179,63,0.15);color:var(--green);border:1px solid var(--green-bd)" title="Origem Mag'har — +1d4 Dano/Cura ainda manual${sk.color === 'red' ? '; +2 Vantagem já entra sozinho na rolagem de Acerto' : ''}">+1d4${sk.color === 'red' ? '/+2 Vant.' : ''}</span>` : '';
        const filosofiaBadge = getFilosofiaPandarenicaBonus(p, sk) ? `<span class="chip-badge" style="background:var(--accent-bg);color:var(--accent2);border:1px solid var(--accent-bd)" title="Filosofia Pandarênica — +3 Vantagem já entra sozinho na rolagem de Acerto">+3 Vant.</span>` : '';
        const furiaOrcHabBadge = (p.furiaOrcAtiva && sk.id !== 'sk_racial_orc_furia') ? `<span class="chip-badge" style="background:var(--red-bg);color:var(--red);border:1px solid var(--red-bd)" title="Fúria de Orc — esta é a próxima Habilidade: não pode ser Aparada${sk.color === 'red' ? ' e recebe +1d6 de Dano' : ''}">😡${sk.color === 'red' ? ' +1d6' : ''}</span>` : '';
        const bloqueadaBadge = bloqueadaPorForma ? `<span class="chip-badge" style="background:var(--red-bg);color:#f08080;border:1px solid var(--red-bd)" title="Bloqueada pela Forma Sombria">🔒</span>` : '';
        // Chip da Habilidade Neutra da Forma Sombria enquanto ela estiver
        // ativa: sinaliza que clicar desativa (desfazer é sempre livre).
        const formaSombriaAtivaChip = p.race === 'Pandaren' && p.formaSombriaAtiva && p.formaSombriaId
          && PANDAREN_FORMAS_SOMBRIAS[p.formaSombriaId]
          && sk.id === PANDAREN_FORMAS_SOMBRIAS[p.formaSombriaId].skillNeutra.id;
        const formaSombriaAtivaBadge = formaSombriaAtivaChip ? `<span class="chip-badge" style="background:var(--red-bg);color:var(--red);border:1px solid var(--red-bd)" title="Clique para desativar a Forma Sombria">🐼 Desativar</span>` : '';
        const podeRecarregar = !temUso && ['turno_N','luta','sessao','perturn'].includes(sk.tipo);
        const recarregarBtn = podeRecarregar
          ? `<button class="chip-reload-btn" onclick="event.stopPropagation();recarregarHabilidadeNarrador(${p.id},'${sk.id}')" title="Recarregar agora"><i class="ti ti-reload"></i></button>`
          : '';
        return `<div class="skill-chip sc-${cor} ${(ready || formaSombriaAtivaChip)?'':'used'}" onclick="useSkill(${p.id},'${sk.id}')" title="${sk.name}\n${lendarioTooltip}${descTooltip}${corromperTooltip}${statusTooltip}${efeitoSecTxt}">
          <span class="chip-dot"></span><span class="chip-name">${sk.lendario ? '✨ ' : ''}${sk.ritualMacabro ? '🌀 ' : ''}${sk.encantamentoItemId ? '🔮 ' : ''}${sk.name}</span><span class="chip-badge">${tipoLabel(sk)}</span>${efeitoSecBadge}${magharBadge}${filosofiaBadge}${furiaOrcHabBadge}${bloqueadaBadge}${formaSombriaAtivaBadge}${extra}${recarregarBtn}
        </div>`;
      }).join('');
      gruposHtml += `<div class="nar-skill-group">
        <div class="nar-skill-group-header sc-${cor}">
          <span>${info.icon} ${info.label}${mst != null ? ` <span class="nar-skill-mst">+${mst} maestria</span>` : ''}</span>
          <span class="nar-skill-count">${gruposNar[cor].length} habilidade${gruposNar[cor].length !== 1 ? 's' : ''}</span>
        </div>
        <div class="skills-chips">${chips}</div>
      </div>`;
    });

    // ── Passivas ──
    const passivasList = Array.isArray(p.passivas) ? p.passivas : [];
    const origemObj = getOrigemPersonagem(p);
    const passivasHtml = passivasList.length
      ? passivasList.map(pas => {
          let tag = '';
          if (pas.origemId) tag = ` <span style="font-size:10px;color:var(--accent2);font-weight:400">(origem · ${origemObj ? origemObj.name : ''})</span>`;
          else if (pas.racialId) tag = ` <span style="font-size:10px;color:var(--text3);font-weight:400">(racial · ${p.race})</span>`;
          else if (pas.subclasseId) tag = ` <span style="font-size:10px;color:var(--text3);font-weight:400">(subclasse · ${p.cls})</span>`;
          else if (pas.classeId) tag = ` <span style="font-size:10px;color:var(--text3);font-weight:400">(classe · ${p.classeBase})</span>`;
          else if (pas.talentoInferiorId) tag = ` <span style="font-size:10px;color:var(--text3);font-weight:400">(talento inferior)</span>`;
          else if (pas.talentoSuperiorId) tag = ` <span style="font-size:10px;color:var(--accent2);font-weight:400">(talento superior)</span>`;
          return `<div class="nar-passiva-item"><div class="nar-passiva-name">${pas.name}${tag}</div><div class="nar-passiva-desc">${pas.desc || '<em>Nenhum efeito descrito.</em>'}</div>${pas.racialId === 'anao_criacao' ? (p.criacaoAnaoUsada ? `<div style="font-size:11px;color:var(--text3);margin-top:4px">✓ Já usada</div>` : `<button class="btn" style="margin-top:6px;font-size:11px;padding:4px 10px" onclick="abrirCriacaoAnaoModal(${p.id})">Fundir Armas</button>`) : ''}${pas.racialId === 'anao_origem_comum_passiva' && p.origemComumPendente ? `<button class="btn" style="margin-top:6px;font-size:11px;padding:4px 10px" onclick="rolarOrigemComum(${p.id})">🎲 Rolar 1d10 (Mega Vantagem)</button>` : ''}${pas.racialId === 'anao_origem_profundezas_passiva' && p.origemProfundezasPendente ? `<button class="btn" style="margin-top:6px;font-size:11px;padding:4px 10px" onclick="abrirOrigemProfundezasModal(${p.id})">Escolher Arma (+1 Dano)</button>` : ''}${pas.racialId === 'elfo_decreptico' ? `<button class="btn" style="margin-top:6px;font-size:11px;padding:4px 10px" onclick="abrirDecrepticoModal(${p.id})">Escolher Testes</button>` : ''}${pas.racialId === 'tauren_brutao' ? `<button class="btn" style="margin-top:6px;font-size:11px;padding:4px 10px" onclick="abrirBrutaoModal(${p.id})">Escolher Testes</button>` : ''}${maestriaTipoDoSubclasseId(pas.subclasseId) ? `<button class="btn" style="margin-top:6px;font-size:11px;padding:4px 10px" onclick="abrirMaestriaModal(${p.id},'${maestriaTipoDoSubclasseId(pas.subclasseId)}')">Escolher Teste</button>` : ''}${pas.racialId === 'troll_encantamento_troll' ? `<button class="btn" style="margin-top:6px;font-size:11px;padding:4px 10px" onclick="abrirEncantamentoTrollModal(${p.id})">Escolher Habilidade</button>` : ''}${pas.racialId === 'troll_origem_comum_passiva' ? `<button class="btn" style="margin-top:6px;font-size:11px;padding:4px 10px" onclick="abrirOrigemComumModal(${p.id})">Configurar Troca</button>` : ''}${pas.racialId === 'elfo_origem_sangrento_passiva' && !p.origemSangrentaUsado ? `<button class="btn" style="margin-top:6px;font-size:11px;padding:4px 10px" onclick="abrirOrigemSangrentaModal(${p.id})">Escolher Habilidade</button>` : ''}${pas.racialId === 'elfo_origem_noturno_passiva' && !p.origemNoturnaUsada ? `<button class="btn" style="margin-top:6px;font-size:11px;padding:4px 10px" onclick="abrirOrigemNoturnaModal(${p.id})">Escolher Caminho</button>` : ''}${pas.racialId === 'humano_origem_vento_bravo_passiva' ? `<button class="btn" style="margin-top:6px;font-size:11px;padding:4px 10px" onclick="abrirVentoBravoModal(${p.id})">Configurar Testes</button>` : ''}${pas.racialId === 'humano_origem_kalindor_passiva' ? `<button class="btn" style="margin-top:6px;font-size:11px;padding:4px 10px" onclick="abrirKalindorModal(${p.id})">Configurar Testes</button>` : ''}${pas.racialId === 'orc_origem_maghar_passiva' && !p.magharTesteMD ? `<button class="btn" style="margin-top:6px;font-size:11px;padding:4px 10px" onclick="abrirMagharModal(${p.id})">Escolher Teste (MD)</button>` : ''}${pas.racialId === 'orc_origem_maghar_passiva' && p.magharTesteMD ? `<button class="btn" style="margin-top:6px;font-size:11px;padding:4px 10px" onclick="abrirMagharHabModal(${p.id})">Configurar Habilidades</button>` : ''}${pas.racialId === 'pandaren_origem_comum_passiva' && !p.filosofiaPandarenicaCor ? `<button class="btn" style="margin-top:6px;font-size:11px;padding:4px 10px" onclick="abrirFilosofiaPandarenicaModal(${p.id})">Escolher Tipo de Habilidade</button>` : ''}${pas.racialId === 'pandaren_origem_comum_passiva' && p.filosofiaPandarenicaCor ? `<div style="font-size:11px;color:var(--text3);margin-top:4px">✓ Tipo escolhido: ${{blue:'Feitiço',red:'Golpe',green:'Técnica'}[p.filosofiaPandarenicaCor]}</div>` : ''}</div>`;
        }).join('')
      : '<div style="font-size:12px;color:var(--text3);padding:4px 0">Nenhuma passiva cadastrada.</div>';

    const origemSubLabel = origemObj ? ` · <span style="color:var(--accent2);font-size:11px">⛏ ${origemObj.name}</span>` : '';
    const pendBadge = (p.pontosPendentes > 0) ? ` <span title="Personagem subiu de nível e tem pontos de atributo não distribuídos" style="display:inline-flex;align-items:center;gap:3px;background:rgba(124,92,191,0.18);border:1px solid rgba(124,92,191,0.5);color:var(--accent2);font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;margin-left:6px;vertical-align:middle">⬆ ${p.pontosPendentes} pts</span>` : '';
    const habPendentes = getHabilidadesPendentes(p);
    const pendHabBadge = (habPendentes > 0) ? ` <span title="Personagem subiu de nível e tem Habilidades do Banco não escolhidas" style="display:inline-flex;align-items:center;gap:3px;background:rgba(124,92,191,0.18);border:1px solid rgba(124,92,191,0.5);color:var(--accent2);font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;margin-left:6px;vertical-align:middle">📖 ${habPendentes} hab.</span>` : '';
    const talentosPendentes = getTalentosInferioresPendentes(p);
    const pendTalentoBadge = (talentosPendentes > 0) ? ` <span title="Personagem tem Talento Inferior não escolhido" style="display:inline-flex;align-items:center;gap:3px;background:rgba(124,92,191,0.18);border:1px solid rgba(124,92,191,0.5);color:var(--accent2);font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;margin-left:6px;vertical-align:middle">🎖 ${talentosPendentes} talento</span>` : '';
    const talentosSuperioresPendentes = getTalentosSuperioresPendentes(p);
    const pendTalentoSuperiorBadge = (talentosSuperioresPendentes > 0) ? ` <span title="Personagem tem Talento Superior não escolhido" style="display:inline-flex;align-items:center;gap:3px;background:rgba(124,92,191,0.18);border:1px solid rgba(124,92,191,0.5);color:var(--accent2);font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;margin-left:6px;vertical-align:middle">👑 ${talentosSuperioresPendentes} talento sup.</span>` : '';
    const feiticosLendariosPendentes = getFeiticosLendariosPendentes(p);
    const pendFeiticoLendarioBadge = (feiticosLendariosPendentes > 0) ? ` <span title="Personagem tem Feitiço Lendário não escolhido" style="display:inline-flex;align-items:center;gap:3px;background:rgba(124,92,191,0.18);border:1px solid rgba(124,92,191,0.5);color:var(--accent2);font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;margin-left:6px;vertical-align:middle">✨ ${feiticosLendariosPendentes} lendário</span>` : '';
    const rituaisMacabrosPendentes = getRituaisMacabrosPendentes(p);
    const pendRitualMacabroBadge = (rituaisMacabrosPendentes > 0) ? ` <span title="Personagem tem Ritual Macabro não escolhido" style="display:inline-flex;align-items:center;gap:3px;background:rgba(124,92,191,0.18);border:1px solid rgba(124,92,191,0.5);color:var(--accent2);font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;margin-left:6px;vertical-align:middle">🌀 ${rituaisMacabrosPendentes} ritual</span>` : '';
    const formaDragaoBadge = (p.race === 'Dragão' && p.formaDragao) ? ` <span title="Em forma de Dragão: Sopro, Iniciar Voo, Impacto de Pouso e Garras Dracônicas disponíveis" style="display:inline-flex;align-items:center;gap:3px;background:var(--red-bg);border:1px solid var(--red-bd);color:var(--red);font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;margin-left:6px;vertical-align:middle">🐉 Forma de Dragão</span>` : '';
    const formaSombriaAtivaObj = (p.race === 'Pandaren' && p.formaSombriaAtiva && p.formaSombriaId) ? PANDAREN_FORMAS_SOMBRIAS[p.formaSombriaId] : null;
    const formaSombriaBadge = formaSombriaAtivaObj ? ` <span title="Forma Sombria ativa: só pode usar Habilidades de ${FORMA_SOMBRIA_COR_LABEL[formaSombriaAtivaObj.corPermitida]}" style="display:inline-flex;align-items:center;gap:3px;background:var(--accent-bg);border:1px solid var(--accent-bd);color:var(--accent2);font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;margin-left:6px;vertical-align:middle">🐼 ${formaSombriaAtivaObj.name}</span>` : '';
    // NPC não passa pela tela obrigatória de Nível-up do Jogador — então, se
    // tiver a Origem Lun'fan (Pandaren) e ainda não escolheu a Forma Sombria,
    // ganha aqui um badge clicável pra abrir a escolha manualmente.
    const pendFormaSombriaBadge = precisaEscolherFormaSombria(p)
      ? ` <span onclick="event.stopPropagation();renderFormaSombriaModal(PLAYERS.find(x=>x.id===${p.id}))" title="Escolher a Forma Sombria do Caminho Lun'fan" style="cursor:pointer;display:inline-flex;align-items:center;gap:3px;background:rgba(124,92,191,0.18);border:1px solid rgba(124,92,191,0.5);color:var(--accent2);font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;margin-left:6px;vertical-align:middle">🐼 Escolher Forma Sombria</span>`
      : '';
    // "Duelo" (Campeão): enquanto ativo, o jogador alterna manualmente se a
    // PRÓXIMA rolagem (Acerto ou Teste) conta como "contra o Alvo do Duelo"
    // (+1d6 de Vantagem) ou "contra outro Alvo" (-1d6 de Desvantagem) — o
    // app não sabe quem é o alvo de cada rolagem, então quem decide é o
    // jogador, clicando no badge antes de rolar (ver toggleDueloAlvo/
    // construirRolagemTeste/construirRolagemAcertoHabilidade). O ✕ encerra o
    // Duelo por completo (ex: perdeu ou desistiu da Luta).
    const dueloBadge = p.dueloAtivo
      ? ` <span onclick="event.stopPropagation();toggleDueloAlvo(${p.id})" title="Duelo — clique para alternar: rolagem atual contra o Alvo (+1d6) ou contra outro Alvo (−1d6)" style="cursor:pointer;display:inline-flex;align-items:center;gap:3px;background:${p.dueloContraAlvo ? 'var(--green-bg)' : 'var(--red-bg)'};border:1px solid ${p.dueloContraAlvo ? 'var(--green-bd)' : 'var(--red-bd)'};color:${p.dueloContraAlvo ? 'var(--green)' : '#f08080'};font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;margin-left:6px;vertical-align:middle">⚔️ Duelo: ${p.dueloContraAlvo ? '+1d6 vs Alvo' : '−1d6 vs outro'}</span><span onclick="event.stopPropagation();desativarDuelo(${p.id})" title="Encerrar o Duelo" style="cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;background:var(--surface);border:1px solid var(--border2);color:var(--text2);font-size:9px;font-weight:700;border-radius:50%;margin-left:3px;vertical-align:middle">✕</span>`
      : '';
    const npcTipoClasse = p.isNPC ? (p.npcTipo === 'inimigo' ? 'npc-inimigo' : 'npc-aliado') : '';
    const npcTipoBadge = p.isNPC
      ? (p.npcTipo === 'inimigo'
        ? ` <span title="Inimigo" style="display:inline-flex;align-items:center;gap:3px;background:var(--red-bg);border:1px solid var(--red-bd);color:#f08080;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;margin-left:6px;vertical-align:middle">⚔️ Inimigo</span>`
        : ` <span title="Aliado" style="display:inline-flex;align-items:center;gap:3px;background:var(--blue-bg);border:1px solid var(--blue-bd);color:var(--blue);font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;margin-left:6px;vertical-align:middle">🛡️ Aliado</span>`)
      : '';
    return `<div class="prow ${bm ? 'beira-morte' : ''} ${npcTipoClasse}">
      <div class="prow-header">
        <div class="av" style="background:${av.bg};color:${av.color}">${p.name.slice(0,2).toUpperCase()}</div>
        <div><div class="prow-name">${p.name}${npcTipoBadge}${pendBadge}${pendHabBadge}${pendTalentoBadge}${pendTalentoSuperiorBadge}${pendFeiticoLendarioBadge}${pendRitualMacabroBadge}${formaDragaoBadge}${formaSombriaBadge}${pendFormaSombriaBadge}${dueloBadge}</div><div class="prow-sub">${[p.race + origemSubLabel, p.classeBase || p.cls, p.classeBase ? p.cls : null, p.isNPC ? null : 'Nv ' + p.level].filter(Boolean).join(' · ')}${p.ownerName ? ' · <span style="color:var(--accent);font-size:11px">👤 ' + p.ownerName + '</span>' : ''}</div></div>
        <div class="mini-stats">
          <span class="mstat mstat-hp">❤ ${p.hp}/${p.hpMax}</span><span class="mstat mstat-acoes">⚡ ${p.acoesAtuais ?? p.acoesMax ?? ACOES_POR_TURNO_PADRAO}/${p.acoesMax ?? ACOES_POR_TURNO_PADRAO}</span><span class="mstat mstat-ins">🧠 ${p.ins}</span>${p.gritoDeGuerraAtivo ? `<span class="mstat mstat-grito" title="Grito de Guerra: Mega Vantagem em todos os Testes até o próximo turno — não pode Desviar">📣 Grito</span>` : ''}${p.motivarPendente ? `<span class="mstat mstat-motivar" title="Motivar: +1d12 de Vantagem no próximo Teste ou Acerto">📢 Motivar</span>` : ''}${p.honraMegaVantagemPendente ? `<span class="mstat mstat-honra" title="Honra: Mega Vantagem no Acerto da próxima Técnica ou Golpe">⚔️ Honra</span>` : ''}${isBruxo ? `<span class="mstat mstat-human">🩸 ${getHumanidade(p)}/${HUMANIDADE_MAX}</span>` : ''}${isBardo ? `<span class="mstat mstat-bardo">🎵 ${countNotasAtivas(p)}/7</span>` : ''}${isClerigo ? `<span class="mstat mstat-pecado">😈 ${getPecado(p)}</span>` : ''}<span class="mstat mstat-arm">🛡 ${p.armadura || 0}/${p.armaduraMax || 0}</span>${temCarapacaAntimagia(p) ? (() => { syncArmaduraAntiMagia(p); return `<span class="mstat mstat-antimagia">🔮 ${p.armaduraAntiMagia || 0}/${p.armaduraAntiMagiaMax || 0}</span>`; })() : ''}<span class="mstat mstat-elm">⛑ ${p.elmo || 0}/${p.elmoMax || 0}</span><span class="mstat mstat-passos">👣 ${p.passos || 0}</span><span class="mstat mstat-money">💰 ${p.dinheiro || 0}</span>
          ${(p.inventario || []).some(i => i.peso === 'exotica' || (Array.isArray(i.aprimoramentos) && i.aprimoramentos.length > 0 && !i.aprimoramentos.every(a => (a.dourado || a.name === 'Dourado')))) ? `<span class="mstat" style="color:var(--accent2)">💎 ${p.cristais || 0}</span>` : ''}
          ${bm ? '<span class="mstat mstat-bm">⚠ Beira Morte</span>' : ''}
        </div>
        <button class="prow-edit-btn ${skillsExpanded ? 'prow-passiva-on' : ''}" onclick="toggleNarSkills(${p.id})" title="Ver habilidades agrupadas por atributo"><i class="ti ti-sword"></i></button>
        <button class="prow-edit-btn ${passivasExpanded ? 'prow-passiva-on' : ''}" onclick="toggleNarPassivas(${p.id})" title="Ver passivas / talentos"><i class="ti ti-sparkles"></i></button>
        <button class="prow-edit-btn ${inventarioExpanded ? 'prow-passiva-on' : ''}" onclick="toggleNarInventario(${p.id})" title="Ver inventário"><i class="ti ti-backpack"></i></button>
        <button class="prow-edit-btn ${narTestesCollapsed[p.id] === false ? 'prow-passiva-on' : ''}" onclick="toggleNarTestes(${p.id})" title="Ver testes"><i class="ti ti-hexagon-letter-d"></i></button>
        <button class="prow-edit-btn" onclick="editCharacter(${p.id})" title="Editar ficha do personagem"><i class="ti ti-edit"></i></button>
        ${editable ? `<button class="prow-edit-btn" onclick="deleteCharacter(${p.id})" title="${isBank ? 'Excluir do Banco' : 'Excluir NPC desta campanha'}" style="color:var(--red)"><i class="ti ti-trash"></i></button>` : ''}
        ${isBank ? `<button class="prow-edit-btn" onclick="summonNpcToCampaign(${p.id})" title="Chamar para esta campanha" style="color:var(--green)"><i class="ti ti-send"></i></button>` : ''}
      </div>
      ${isBank ? '' : `<div class="bars">
        <div class="bar-wrap vida"><div class="bar-lbl">Vida</div><div class="bar-track"><div class="bar-fill ${vidaClass(p.hp,p.hpMax)}" style="width:${hpPct}%"></div></div></div>
        <div class="bar-wrap ins"><div class="bar-lbl">Insanidade</div><div class="bar-track"><div class="bar-fill bfill-ins" style="width:${insPct}%"></div></div></div>
        ${isBruxo ? `<div class="bar-wrap human"><div class="bar-lbl">Humanidade</div><div class="bar-track"><div class="bar-fill bfill-human" style="width:${humanPct}%"></div></div></div>` : ''}
        <div class="bar-wrap arm"><div class="bar-lbl">Armadura</div><div class="bar-track"><div class="bar-fill bfill-arm" style="width:${armPct}%"></div></div></div>
        <div class="bar-wrap elm"><div class="bar-lbl">Elmo</div><div class="bar-track"><div class="bar-fill bfill-elm" style="width:${elmPct}%"></div></div></div>
      </div>`}
      ${isBank ? '' : `<div class="nar-ctrl-row">
        <div class="nar-ctrl-group">
          <span class="nar-ctrl-lbl">❤ Vida</span>
          <div class="nar-ctrl-btns">
            <button onclick="adjHP(${p.id},-5)">−5</button>
            <button onclick="adjHP(${p.id},-1)">−1</button>
            <input type="number" class="nar-ctrl-input" value="${p.hp}" onchange="setHP(${p.id}, this.value)">
            <button onclick="adjHP(${p.id},+1)">+1</button>
            <button onclick="adjHP(${p.id},+5)">+5</button>
          </div>
        </div>
        <div class="nar-ctrl-group">
          <span class="nar-ctrl-lbl">⚡ Ações <span style="font-size:10px;color:var(--text3);font-weight:400">(máx ${p.acoesMax ?? ACOES_POR_TURNO_PADRAO}/turno)</span></span>
          <div class="nar-ctrl-btns">
            <button onclick="adjAcoes(${p.id},-1)" title="Tirar 1 ação deste turno">−1</button>
            <input type="number" class="nar-ctrl-input" value="${p.acoesAtuais ?? p.acoesMax ?? ACOES_POR_TURNO_PADRAO}" onchange="setAcoes(${p.id}, this.value)">
            <button onclick="adjAcoes(${p.id},+1)" title="Dar 1 ação extra neste turno">+1</button>
          </div>
        </div>
        <div class="nar-ctrl-group">
          <span class="nar-ctrl-lbl">🧠 Insanidade</span>
          <div class="nar-ctrl-btns">
            <button onclick="adjIns(${p.id},-10)">−10</button>
            <button onclick="adjIns(${p.id},-5)">−5</button>
            <input type="number" class="nar-ctrl-input" value="${p.ins}" onchange="setIns(${p.id}, this.value)">
            <button onclick="adjIns(${p.id},+5)">+5</button>
            <button onclick="adjIns(${p.id},+10)">+10</button>
          </div>
        </div>
        ${isBruxo ? `
        <div class="nar-ctrl-group">
          <span class="nar-ctrl-lbl">🩸 Humanidade</span>
          <div class="nar-ctrl-btns">
            <button onclick="adjHumanidade(${p.id},-1)">−1</button>
            <input type="number" class="nar-ctrl-input" value="${getHumanidade(p)}" onchange="setHumanidade(${p.id}, this.value)">
            <button onclick="adjHumanidade(${p.id},+1)">+1</button>
          </div>
        </div>` : ''}
        ${isBardo ? `
        <div class="nar-ctrl-group">
          <span class="nar-ctrl-lbl">🎵 Notas do Bardo</span>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            ${NOTAS_MUSICAIS.map(n => { const ativa = getNotasBardo(p)[n]; return `<button class="nota-btn nota-btn-sm ${ativa?'nota-ativa':''}" onclick="toggleNota(${p.id},'${n}')">${n}</button>`; }).join('')}
            <button class="btn" style="font-size:10px;padding:3px 7px;margin-left:4px" onclick="resetNotasBardo(${p.id})" title="Usar todas as notas"><i class="ti ti-music"></i></button>
          </div>
        </div>` : ''}
        ${isClerigo ? `
        <div class="nar-ctrl-group">
          <span class="nar-ctrl-lbl">😈 Pecado</span>
          <div class="nar-ctrl-btns">
            <button onclick="adjPecado(${p.id},-1)">−1</button>
            <input type="number" class="nar-ctrl-input" value="${getPecado(p)}" onchange="setPecado(${p.id}, this.value)">
            <button onclick="adjPecado(${p.id},+1)">+1</button>
          </div>
        </div>` : ''}
        <div class="nar-ctrl-group">
          <span class="nar-ctrl-lbl">🛡 Armadura</span>
          <div class="nar-ctrl-btns">
            <button onclick="adjArmadura(${p.id},-1)">−1</button>
            <input type="number" class="nar-ctrl-input" value="${p.armadura || 0}" onchange="setArmadura(${p.id}, this.value)">
            <button onclick="adjArmadura(${p.id},+1)">+1</button>
          </div>
        </div>
        ${temCarapacaAntimagia(p) ? (() => { syncArmaduraAntiMagia(p); return `
        <div class="nar-ctrl-group">
          <span class="nar-ctrl-lbl">🔮 Armadura Anti-Magia</span>
          <div class="nar-ctrl-btns">
            <button onclick="adjArmaduraAntiMagia(${p.id},-1)">−1</button>
            <input type="number" class="nar-ctrl-input" value="${p.armaduraAntiMagia || 0}" onchange="setArmaduraAntiMagia(${p.id}, this.value)">
            <button onclick="adjArmaduraAntiMagia(${p.id},+1)">+1</button>
            <button onclick="restaurarArmaduraAntiMagia(${p.id})" title="Restaurar (fim de Jornada/Aventura/Campanha)"><i class="ti ti-refresh"></i></button>
          </div>
        </div>`; })() : ''}
        <div class="nar-ctrl-group">
          <span class="nar-ctrl-lbl">⛑ Elmo</span>
          <div class="nar-ctrl-btns">
            <button onclick="adjElmo(${p.id},-1)">−1</button>
            <input type="number" class="nar-ctrl-input" value="${p.elmo || 0}" onchange="setElmo(${p.id}, this.value)">
            <button onclick="adjElmo(${p.id},+1)">+1</button>
          </div>
        </div>
        <div class="nar-ctrl-group">
          <span class="nar-ctrl-lbl">💰 Dinheiro</span>
          <div class="nar-ctrl-btns">
            <button onclick="adjDinheiro(${p.id},-10)">−10</button>
            <button onclick="adjDinheiro(${p.id},-1)">−1</button>
            <input type="number" class="nar-ctrl-input" value="${p.dinheiro || 0}" onchange="setDinheiro(${p.id}, this.value)">
            <button onclick="adjDinheiro(${p.id},+1)">+1</button>
            <button onclick="adjDinheiro(${p.id},+10)">+10</button>
          </div>
        </div>
        ${(p.inventario || []).some(i => i.peso === 'exotica' || (Array.isArray(i.aprimoramentos) && i.aprimoramentos.length > 0 && !i.aprimoramentos.every(a => (a.dourado || a.name === 'Dourado')))) ? `
        <div class="nar-ctrl-group">
          <span class="nar-ctrl-lbl">💎 Cristais</span>
          <div class="nar-ctrl-btns">
            <button onclick="adjCristais(${p.id},-1)">−1</button>
            <input type="number" class="nar-ctrl-input" value="${p.cristais || 0}" onchange="setCristais(${p.id}, this.value)">
            <button onclick="adjCristais(${p.id},+1)">+1</button>
          </div>
        </div>` : ''}
        ${p.isNPC ? '' : `<div class="nar-ctrl-group">
          <span class="nar-ctrl-lbl">⭐ XP <span style="font-size:10px;color:var(--text3);font-weight:400">(Nv ${p.level})</span></span>
          <div class="nar-ctrl-btns">
            <button onclick="removeXP(${p.id})" title="Remover XP">−XP</button>
            <div class="xp-pips" style="display:flex;align-items:center;gap:3px;padding:0 4px">${Array.from({length:10},(_,i)=>`<span onclick="setXPDirect(${p.id},${i+1})" title="Definir ${i+1} XP" style="width:10px;height:10px;border-radius:50%;background:${(p.xp||0)>i?'var(--accent2)':'var(--border2)'};cursor:pointer;transition:background .15s;flex-shrink:0"></span>`).join('')}</div>
            <button onclick="addXP(${p.id})" title="Adicionar XP">+XP</button>
          </div>
        </div>`}
      </div>`}
      ${skillsExpanded ? `<div class="nar-skills-box">${gruposHtml}
        ${editable ? `<div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
          <button class="add-skill-btn" onclick="openModal(${p.id})"><i class="ti ti-plus"></i> Adicionar habilidade</button>
          ${p.cls ? `<button class="add-skill-btn" onclick="openBancoModal(${p.id})"><i class="ti ti-book"></i> Escolher da Subclasse</button>` : ''}
        </div>` : ''}
      </div>` : ''}
      ${inventarioExpanded ? renderInventarioArea(p, !editable) : ''}
      ${passivasExpanded ? `<div class="nar-passivas-box">
        <div class="nar-passivas-title"><i class="ti ti-sparkles"></i> Passivas / Talentos</div>
        ${passivasHtml}
        ${editable ? `<div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
          <button class="add-skill-btn" onclick="openPassivaModal(${p.id})"><i class="ti ti-plus"></i> Adicionar passiva / talento</button>
          <button class="add-skill-btn" onclick="openTalentosModal(${p.id})"><i class="ti ti-award"></i> Escolher Talento Inferior</button>
          <button class="add-skill-btn" onclick="openTalentosSuperioresModal(${p.id})"><i class="ti ti-crown"></i> Escolher Talento Superior</button>
          ${temAcessoFeiticoLendario(p) ? `<button class="add-skill-btn" onclick="openFeiticosLendariosModal(${p.id})"><i class="ti ti-sparkles"></i> Escolher Feitiço Lendário</button>` : ''}
          ${temAcessoRitualMacabro(p) ? `<button class="add-skill-btn" onclick="openRituaisMacabrosModal(${p.id})"><i class="ti ti-eye"></i> Escolher Ritual Macabro</button>` : ''}
        </div>` : ''}
        ${getExpressoesEtereas(p).length ? `
        <div class="nar-passivas-title" style="margin-top:14px;color:var(--eter)"><i class="ti ti-atom-2"></i> Expressões Etéreas <span style="font-size:10px;color:var(--text3);font-weight:400">(crítico → 1d6)</span></div>
        <div class="expressoes-grid">${getExpressoesEtereas(p).map(ex => {
          const origemTag = ex.origemName ? ` <span style="font-size:10px;color:var(--eter);font-weight:400;opacity:.8">(${ex.origemName})</span>` : '';
          return `
          <div class="expressao-card">
            <div class="expressao-indice">${ex.indice}</div>
            <div class="expressao-name"><i class="ti ti-atom-2"></i> ${ex.name}${origemTag}</div>
            <div class="expressao-desc">${ex.desc}</div>
          </div>`;
        }).join('')}</div>
        ` : ''}
        ${getCamposHarmonicos(p).length ? `
        <div class="nar-passivas-title" style="margin-top:14px;color:var(--bardo)"><i class="ti ti-music"></i> Campos Harmônicos <span style="font-size:10px;color:var(--text3);font-weight:400">(7 Notas · 2 Ações · sem recarga)</span></div>
        <div class="skills-grid">${getCamposHarmonicos(p).map(sk => {
          const ready = isReady(sk, p);
          const state = ready ? 'ready' : 'exhausted';
          const notasStatus = ready ? 'Pronta' : `${countNotasAtivas(p)}/7 notas`;
          return `
          <div class="skill-card sk-bardo ${state}" onclick="useSkill(${p.id},'${sk.id}')">
            <div class="sk-name">${sk.name}</div>
            <div class="sk-tags"><span class="sk-tag">2 ações</span><span class="sk-tag">${tipoLabel(sk)}</span></div>
            <div style="font-size: 11px; color: var(--text2); margin-bottom: 12px; line-height: 1.5; white-space: pre-wrap; max-height: 110px; overflow-y: auto; padding-right: 4px;">${sk.desc}</div>
            <div class="sk-bottom">
              ${precisaAcertoHabilidade(p, sk) ? `<button class="sk-btn sk-btn-acerto" onclick="event.stopPropagation();rolarAcertoHabilidadeClick(${p.id},'${sk.id}')" ${!ready?'disabled':''} title="Rola 1d20 + maestria + bônus, só pra checar se acertou — não gasta a Habilidade">🎯 Acerto</button>` : ''}
              <button class="sk-btn" onclick="event.stopPropagation();useSkill(${p.id},'${sk.id}')" ${!ready?'disabled':''}>Usar Efeito</button>
              <span class="sk-cd">${notasStatus}</span>
            </div>
          </div>`;
        }).join('')}</div>
        ` : ''}
        ${getDivindadeItens(p).length ? `
        <div class="nar-passivas-title" style="margin-top:14px;color:var(--divino)"><i class="ti ti-sun"></i> ${p.deus} <span style="font-size:10px;color:var(--text3);font-weight:400">(referência · sem recarga nem ações)</span></div>
        <div class="divindades-grid">${getDivindadeItens(p).map(item => `
          <div class="divindade-card">
            <div class="divindade-indice">${item.sigla}</div>
            <div class="divindade-name"><i class="ti ti-sun"></i> ${item.name}</div>
            <div class="divindade-desc">${item.desc}</div>
          </div>`).join('')}</div>
        ` : ''}
      </div>` : ''}
      ${renderTestes(p, true)}
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════
// RENDER JOGADOR
// ═══════════════════════════════════════
function getMyPlayers() {
  if (!currentUser || currentUser.role === 'narrator') return PLAYERS.filter(p => !p.isNPC);
  return PLAYERS.filter(p => !p.isNPC && (p.ownerId === currentUser.id || p.ownerId == null));
}

function renderPsel() {
  const psel = document.getElementById('psel');
  if (!psel) return;
  const myPlayers = getMyPlayers();
  const currentVal = psel.value;
  psel.innerHTML = myPlayers.map(p => `<option value="${p.id}">${p.name} — ${p.race} ${p.cls}</option>`).join('');
  if (currentVal && myPlayers.find(p => p.id == currentVal)) psel.value = currentVal;
}

// ─── Toggle collapse dos Testes ─────────────────────────────────────────────
function toggleJogTestes() {
  jogTestesCollapsed = !jogTestesCollapsed;
  renderJogador();
}
function toggleNarTestes(pid) {
  // Padrão: fechado. Só abre quando o valor guardado for explicitamente false.
  const estaFechado = narTestesCollapsed[pid] !== false;
  narTestesCollapsed[pid] = !estaFechado;
  renderAll();
}

// ─── Ações dos Testes ────────────────────────────────────────────────────────
function setTesteMV(pid, testeId, val) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  // "Origem de Vento Bravo" (Humano): essa é a única Origem que REALMENTE
  // bloqueia a Mega Vantagem — nunca tem, em Teste nenhum, sem exceção
  // (diferente de Brutão/Mag'har/Mente Equilibrada/Maestria, que só
  // pré-marcam um padrão destravável).
  if (val && p.origemId === 'humano_origem_vento_bravo') return;
  getTestePersonagem(p);
  p.testes[testeId].mv = val;
  if (val) p.testes[testeId].md = false; // MV e MD são exclusivos
  saveState(); renderAll();
}

function setTesteMD(pid, testeId, val) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  getTestePersonagem(p);
  p.testes[testeId].md = val;
  if (val) p.testes[testeId].mv = false;
  saveState(); renderAll();
}

function setTesteBonus(pid, testeId, val) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  getTestePersonagem(p);
  p.testes[testeId].bonus = val;
  saveState();
}

// Renderiza a seção de testes para o jogador (editável)
function renderTestes(p, readonly) {
  readonly = !!readonly;
  getTestePersonagem(p);
  const grupos = [
    { label: 'Agilidade',  cor: 'green',  attr: 'agi',    ids: ['acrobacia','desviar','furtividade','percepcao'] },
    { label: 'Força',      cor: 'red',    attr: 'forca',  ids: ['aparar','arremessar','empurrar','resistir']      },
    { label: 'Intelecto',  cor: 'blue',   attr: 'intel',  ids: ['arcano','mistico','geografia','historia']        },
    { label: 'Neutros',    cor: 'gray',   attr: 'neutro', ids: p.classeBase === 'Clérigo' ? ['iniciativa','emocao','devocao'] : ['iniciativa','emocao'] },
  ];

  const corMap = { green: 'var(--green)', red: 'var(--red)', blue: 'var(--blue)', gray: 'var(--gray)' };
  const bgMap  = { green: 'var(--green-bg)', red: 'var(--red-bg)', blue: 'var(--blue-bg)', gray: 'var(--gray-bg)' };
  const bdMap  = { green: 'var(--green-bd)', red: 'var(--red-bd)', blue: 'var(--blue-bd)', gray: 'var(--gray-bd)' };

  const colunas = grupos.map(g => {
    const mst = g.attr !== 'neutro' ? maestriaDe(p, g.attr) : null;
    const mstLabel = mst != null ? ` <span class="nar-skill-mst">+${mst} maestria</span>` : '';

    const rows = g.ids.map(tid => {
      const def  = TESTES_LISTA.find(t => t.id === tid);
      const t    = p.testes[tid];
      const hasMV = t.mv, hasMD = t.md, hasBonus = t.bonus && t.bonus.trim();
      const hasAdaptacao = p.adaptacaoTesteId === tid;
      const hasTreinamentoMilitar = tid === 'aparar' && !!p.treinamentoMilitarPendente;
      // Nenhuma passiva/Origem trava mais os botões MV/MD — todas elas (Vento
      // Bravo, Mag'har, Brutão, Mente Equilibrada, Maestria) só pré-marcam um
      // valor PADRÃO no toggle normal, na hora da escolha (ver
      // escolherBrutaoForca/Agilidade, confirmarMagharMD, escolherMaestriaTeste
      // e ensureRacePassivas p/ Mente Equilibrada). Os badges abaixo são só
      // informativos, indicando de onde veio aquele padrão.
      // "Origem de Vento Bravo" (Humano): a única que REALMENTE bloqueia a
      // Mega Vantagem — nunca tem, em Teste nenhum. Diferente das outras
      // abaixo (Mag'har/Brutão/Maestria/Mente Equilibrada), que só
      // pré-marcam um padrão destravável.
      const mvBloqueadaOrigem = p.origemId === 'humano_origem_vento_bravo';
      const origemMagharAqui = p.origemId === 'orc_origem_maghar' && p.magharTesteMD === tid;
      const temBrutaoAqui = (p.passivas || []).some(pas => pas.racialId === 'tauren_brutao');
      const brutaoForcaAqui = temBrutaoAqui && p.brutaoTesteForca === tid;
      const brutaoAgilidadeAqui = temBrutaoAqui && p.brutaoTesteAgilidade === tid;
      const maestriaTipoAqui = maestriaForcadaAqui(p, tid);
      const menteEquilibradaAqui = tid === 'emocao' && p.race === 'Pandaren'
        && (p.passivas || []).some(pas => pas.racialId === 'pandaren_mente_equilibrada');
      const bonusVB = getVentoBravoBonus(p, tid);
      const papelKal = getKalindorPapel(p, tid);
      // "Comum" (Origem, Troll): Arcano/Místico recebem +1 fixo se não houver
      // troca, ou o Teste escolhido "empresta" a maestria pro Arcano/Místico
      // trocado — ver construirRolagemTeste.
      const origemComumBonusAqui = (tid === 'arcano' || tid === 'mistico')
        && p.origemId === 'troll_origem_comum' && !p.origemComumTrocaArea;
      const origemComumTrocaDestino = p.origemId === 'troll_origem_comum'
        && p.origemComumTrocaArea && p.origemComumTrocaTesteId === tid
        ? TESTES_LISTA.find(t => t.id === p.origemComumTrocaArea)
        : null;
      const badgesPassivas = `${hasAdaptacao ? ` <span class="chip-badge" style="background:var(--accent-bg);color:var(--accent2);border:1px solid var(--accent-bd)" title="Adaptação do Espaço">+3</span>` : ''}${hasTreinamentoMilitar ? ` <span class="chip-badge" style="background:var(--green-bg);color:var(--green);border:1px solid var(--green-bd)" title="Treinamento Militar — este Aparar é Garantido, com 50% de chance de Crítico">⚔️ Pronto</span>` : ''}${p.decrepticoTeste1 === tid ? ` <span class="chip-badge" style="background:var(--accent-bg);color:var(--accent2);border:1px solid var(--accent-bd)" title="Decréptico">+1</span>` : ''}${p.decrepticoTeste2 === tid ? ` <span class="chip-badge" style="background:var(--accent-bg);color:var(--accent2);border:1px solid var(--accent-bd)" title="Decréptico">+3</span>` : ''}${(tid === 'resistir' && p.race === 'Elfo' && (p.passivas || []).some(pas => pas.racialId === 'elfo_decreptico')) ? ` <span class="chip-badge" style="background:var(--red-bg);color:#f08080;border:1px solid var(--red-bd)" title="Decréptico">−2</span>` : ''}${(p.race === 'Humano' && !['iniciativa', 'devocao'].includes(tid)) ? ` <span class="chip-badge" title="Normal">+${tid === 'emocao' ? 10 : 2}</span>` : ''}${bonusVB > 0 ? ` <span class="chip-badge" style="background:var(--accent-bg);color:var(--accent2);border:1px solid var(--accent-bd)" title="Origem de Vento Bravo">+${bonusVB}</span>` : ''}${papelKal === 'bonus' ? ` <span class="chip-badge" style="background:rgba(109,179,63,0.15);color:var(--green);border:1px solid var(--green-bd)" title="Origem de Kalindor">+1d4</span>` : ''}${papelKal === 'penalidade' ? ` <span class="chip-badge" style="background:var(--red-bg);color:#f08080;border:1px solid var(--red-bd)" title="Origem de Kalindor">−1d4</span>` : ''}${origemMagharAqui ? ` <span class="chip-badge" style="background:var(--red-bg);color:#f08080;border:1px solid var(--red-bd)" title="Origem Mag'har — Mega Desvantagem padrão, pode ser desligada manualmente">★ Mag'har</span>` : ''}${brutaoForcaAqui ? ` <span class="chip-badge" style="background:var(--accent-bg);color:var(--accent2);border:1px solid var(--accent-bd)" title="Brutão — Mega Vantagem padrão, pode ser desligada manualmente">★ Brutão</span>` : ''}${brutaoAgilidadeAqui ? ` <span class="chip-badge" style="background:var(--red-bg);color:#f08080;border:1px solid var(--red-bd)" title="Brutão — Mega Desvantagem padrão, pode ser desligada manualmente">★ Brutão</span>` : ''}${maestriaTipoAqui ? ` <span class="chip-badge" style="background:var(--accent-bg);color:var(--accent2);border:1px solid var(--accent-bd)" title="${MAESTRIA_LABEL[maestriaTipoAqui]} — Mega Vantagem padrão, pode ser desligada manualmente">★ ${MAESTRIA_LABEL[maestriaTipoAqui]}</span>` : ''}${(tid === 'geografia' && p.origemId === 'tauren_origem_alta_montanha') ? ` <span class="chip-badge" style="background:var(--accent-bg);color:var(--accent2);border:1px solid var(--accent-bd)" title="Alta Montanha — +2, ou +4 se o Teste for baseado em Natureza (pergunta ao rolar)">+2/+4</span>` : ''}${origemComumBonusAqui ? ` <span class="chip-badge" style="background:var(--accent-bg);color:var(--accent2);border:1px solid var(--accent-bd)" title="Comum — sem troca configurada">+1</span>` : ''}${origemComumTrocaDestino ? ` <span class="chip-badge" style="background:var(--accent-bg);color:var(--accent2);border:1px solid var(--accent-bd)" title="Comum — empresta a maestria pro Teste de ${escHtml(origemComumTrocaDestino.name)}">→ ${escHtml(origemComumTrocaDestino.name)}</span>` : ''}${menteEquilibradaAqui ? ` <span class="chip-badge" style="background:var(--accent-bg);color:var(--accent2);border:1px solid var(--accent-bd)" title="Mente Equilibrada — Mega Vantagem padrão (pode ser desligada), resultado sempre em módulo">★ Mente Equilibrada · módulo</span>` : ''}`;

      if (readonly) {
        // Narrador: chip com os mesmos controles do Jogador (MV/MD/Bônus),
        // pra poder dar Mega Vantagem/Desvantagem ou um bônus/penalidade
        // pontual num Teste específico (ex: terreno difícil, emboscada,
        // vantagem narrativa) sem precisar pedir pro jogador mexer na ficha.
        const badges = [badgesPassivas];
        return `<div class="skill-chip sc-${g.cor}">
          <button class="teste-roll-btn" onclick="event.stopPropagation();rolarTesteClick(${p.id},'${tid}')" title="Rolar ${def.name}"><i class="ti ti-dice"></i></button>
          <span class="chip-dot"></span>
          <span class="chip-name">${def.name}</span>
          ${badges.join('')}
          <div class="teste-ctrl" onclick="event.stopPropagation()">
            <button class="teste-mv-btn ${hasMV && !mvBloqueadaOrigem ? 'ativo' : ''}" ${mvBloqueadaOrigem ? 'disabled style="opacity:.3;cursor:not-allowed"' : ''} onclick="${mvBloqueadaOrigem ? '' : `setTesteMV(${p.id},'${tid}',${!hasMV})`}" title="${mvBloqueadaOrigem ? 'Bloqueado pela Origem de Vento Bravo' : 'Dar Mega Vantagem'}">MV</button>
            <button class="teste-md-btn ${hasMD ? 'ativo' : ''}" onclick="setTesteMD(${p.id},'${tid}',${!hasMD})" title="Dar Mega Desvantagem">MD</button>
            <input class="teste-bonus-input" type="text" value="${t.bonus || ''}" placeholder="Bônus" maxlength="8"
              onchange="setTesteBonus(${p.id},'${tid}',this.value)"
              title="Bônus/penalidade pontual (ex: +3, -1d4)" style="width:52px">
          </div>
        </div>`;
      }


      // Jogador: editável
      return `<div class="teste-row">
        <button class="teste-roll-btn" onclick="rolarTesteClick(${p.id},'${tid}')" title="Rolar ${def.name} (${tid === 'emocao' ? '1d100 − insanidade' : tid === 'devocao' ? '1d100 − (20×pecado)' : '1d20' + (mst ? '+' + mst + ' maestria' : '')})"><i class="ti ti-dice"></i></button>
        <span class="teste-nome">${def.name}${badgesPassivas}</span>
        <div class="teste-ctrl">
          <button class="teste-mv-btn ${hasMV && !mvBloqueadaOrigem ? 'ativo' : ''}" ${mvBloqueadaOrigem ? 'disabled style="opacity:.3;cursor:not-allowed"' : ''} onclick="${mvBloqueadaOrigem ? '' : `setTesteMV(${p.id},'${tid}',${!hasMV})`}" title="${mvBloqueadaOrigem ? 'Bloqueado pela Origem de Vento Bravo' : 'Mega Vantagem'}">MV</button>
          <button class="teste-md-btn ${hasMD ? 'ativo' : ''}" onclick="setTesteMD(${p.id},'${tid}',${!hasMD})" title="Mega Desvantagem">MD</button>
          <input class="teste-bonus-input" type="text" value="${t.bonus || ''}" placeholder="Bônus" maxlength="8"
            onchange="setTesteBonus(${p.id},'${tid}',this.value)"
            title="Bônus/penalidade (ex: +3, -1d4)">
        </div>
      </div>`;
    }).join('');

    if (readonly) {
      // Narrador: grupo igual ao padrão das Habilidades (.nar-skill-group)
      return `<div class="nar-skill-group">
        <div class="nar-skill-group-header sc-${g.cor}">
          <span>${g.label}${mstLabel}</span>
          <span class="nar-skill-count">${g.ids.length} teste${g.ids.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="skills-chips">${rows}</div>
      </div>`;
    }

    // Jogador: cartão colorido
    return `<div class="teste-col teste-col-card" style="border-color:${bdMap[g.cor]};background:${bgMap[g.cor]}">
      <div class="teste-col-header" style="color:${corMap[g.cor]}">${g.label}${mstLabel}</div>
      ${rows}
    </div>`;
  }).join('');

  const collapsed = readonly
    ? narTestesCollapsed[p.id] !== false   // narrador: fechado por padrão, só abre se explicitamente false
    : jogTestesCollapsed;
  const toggleFn = readonly
    ? `toggleNarTestes(${p.id})`
    : `toggleJogTestes()`;

  // Conta testes configurados para badge no header quando fechado
  const totalConfig = TESTES_LISTA.filter(t => {
    const tv = p.testes[t.id];
    return tv && (tv.mv || tv.md || (tv.bonus && tv.bonus.trim()));
  }).length;
  const readyBadge = '';

  if (readonly) {
    return collapsed ? '' : `<div class="testes-section testes-section-nar">
      <div class="testes-title-nar">
        <i class="ti ti-hexagon-letter-d"></i> Testes
        ${readyBadge}
      </div>
      <div class="testes-grid-nar-chips">${colunas}</div>
    </div>`;
  }

  // Jogador: mesmo cabeçalho usado nas Habilidades / Passivas (.group-title)
  return `<div class="testes-section">
    <div class="group-title group-title-toggle" style="margin-top:24px" onclick="${toggleFn}">
      <span class="gt-dot" style="background:var(--accent2)"></span>
      Testes
      <span class="gt-collapse-info">${readyBadge}</span>
      <i class="ti ${collapsed ? 'ti-chevron-down' : 'ti-chevron-up'} gt-chevron"></i>
    </div>
    ${collapsed ? '' : `<div class="testes-legend-row"><span class="teste-badge mv">MV</span> Mega Vantagem &nbsp; <span class="teste-badge md">MD</span> Mega Desvantagem</div>`}
    ${collapsed ? '' : `<div class="testes-grid">${colunas}</div>`}
  </div>`;
}

// Renderiza (e mostra/esconde) a tela obrigatória de escolha de Forma
// Sombria. Recebe o personagem pendente (ou null para esconder o modal).
function renderFormaSombriaModal(p) {
  const overlay = document.getElementById('modal-forma-overlay');
  if (!overlay) return;
  if (!p) { overlay.classList.remove('open'); return; }

  const cores = { red: 'red', green: 'green', blue: 'blue' };
  const cardsHtml = Object.values(PANDAREN_FORMAS_SOMBRIAS).map(f => {
    const cor = cores[f.skillColorida.color] || 'gray';
    return `
      <div class="forma-sombria-card forma-${cor}" onclick="escolherFormaSombria(${p.id}, '${f.id}')">
        <div class="forma-sombria-name">${f.name}</div>
        <div class="forma-sombria-tagline">${f.tagline}</div>
        <div class="forma-sombria-skill">
          <span class="forma-sombria-skill-tag tag-gray">${f.skillNeutra.name}</span>
          <div class="forma-sombria-skill-desc">${f.skillNeutra.desc}</div>
        </div>
        <div class="forma-sombria-skill">
          <span class="forma-sombria-skill-tag tag-${cor}">${f.skillColorida.name}</span>
          <div class="forma-sombria-skill-desc">${f.skillColorida.desc}</div>
        </div>
      </div>`;
  }).join('');

  overlay.innerHTML = `
    <div class="modal" style="max-width:520px">
      <h3><i class="ti ti-moon-stars"></i> Escolha sua Forma Sombria</h3>
      <div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:16px">
        <strong>${p.name}</strong> chegou ao Nível 3 pelo Caminho Lun'fan e desbloqueou o acesso às Sombras e ao Chi. Escolha permanentemente uma das 3 Formas Sombrias abaixo — cada uma libera 2 Habilidades exclusivas.
      </div>
      <div class="forma-sombria-grid">${cardsHtml}</div>
    </div>`;
  overlay.classList.add('open');
}

// Renderiza (e mostra/esconde) a tela obrigatória de escolha do Estilo de
// Encantamento (Arcano ou Místico). Recebe o personagem pendente (ou null
// para esconder o modal) — ver precisaEscolherEstiloEncantamento.
function renderEscolhaEstiloEncantamentoModal(p) {
  const overlay = document.getElementById('modal-encantamento-estilo-overlay');
  if (!overlay) return;
  if (!p) { overlay.classList.remove('open'); return; }

  const listaHtml = (lista) => lista.map(e => {
    const c = e.concede;
    return `<div class="forma-sombria-skill">
      <span class="forma-sombria-skill-tag ${c.tipoConcedido === 'ritual' ? 'tag-gray' : 'tag-blue'}">${e.name}</span>
      <div class="forma-sombria-skill-desc">${c.tipoConcedido === 'ritual' ? 'Ritual' : 'Feitiço'}: <strong>${c.name}</strong> — ${c.desc}</div>
    </div>`;
  }).join('');

  const todosEncantamentos = [...ENCANTAMENTOS_EQUIPAMENTO, ...ENCANTAMENTOS_ELMO, ...ENCANTAMENTOS_ARMA];
  const arcanos  = todosEncantamentos.filter(e => e.estilo === 'arcano');
  const misticos = todosEncantamentos.filter(e => e.estilo === 'mistico');

  overlay.innerHTML = `
    <div class="modal" style="max-width:560px">
      <h3><i class="ti ti-wand"></i> Escolha o Estilo de Encantamento</h3>
      <div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:16px">
        <strong>${p.name}</strong> adquiriu o Talento Inferior "Equipamento Encantado". Escolha permanentemente o Estilo de Encantamento — Arcano ou Místico — que valerá para todos os seus equipamentos encantados. Cada equipamento encantado tem espaço para apenas 1 Encantamento.
      </div>
      <div class="forma-sombria-grid">
        <div class="forma-sombria-card forma-blue" onclick="escolherEstiloEncantamento(${p.id}, 'arcano')">
          <div class="forma-sombria-name">Arcano</div>
          <div class="forma-sombria-tagline">Concede Feitiços</div>
          ${listaHtml(arcanos)}
        </div>
        <div class="forma-sombria-card forma-gray" onclick="escolherEstiloEncantamento(${p.id}, 'mistico')">
          <div class="forma-sombria-name">Místico</div>
          <div class="forma-sombria-tagline">Concede Rituais Místicos</div>
          ${listaHtml(misticos)}
        </div>
      </div>
    </div>`;
  overlay.classList.add('open');
}

function renderJogador() {
  const content = document.getElementById('jog-content');
  const psel = document.getElementById('psel');
  if (!content || !psel) return;

  if (!PLAYERS || PLAYERS.length === 0) {
    content.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--text3); width: 100%; grid-column: span 2;">Nenhum personagem disponível. Crie um novo!</div>';
    return;
  }

  const myPlayers = getMyPlayers();
  if (!myPlayers || myPlayers.length === 0) {
    content.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--text3); width: 100%; grid-column: span 2;">Você ainda não tem personagens. Crie um novo clicando em "Novo Personagem"!</div>';
    return;
  }

  // Se algum dos seus personagens acabou de chegar no Nível 3 pelo caminho
  // Lun'fan e ainda não escolheu sua Forma Sombria, força a seleção dele no
  // dropdown e exibe a tela de escolha obrigatória antes de qualquer outra coisa.
  const pendente = myPlayers.find(precisaEscolherFormaSombria);
  if (pendente && parseInt(psel.value) !== pendente.id) {
    psel.value = pendente.id;
  }
  renderFormaSombriaModal(pendente || null);

  // O Estilo de Encantamento (Arcano/Místico) não usa mais uma tela
  // separada forçada — trava sozinho no primeiro Encantamento que o
  // personagem ganha/compra (ver saveInvItem), então não há mais nada
  // pendente aqui pra checar antes de renderizar a ficha.

  const pid = parseInt(psel.value) || myPlayers[0].id;
  const p = myPlayers.find(x => x.id === pid) || myPlayers[0];
  const i = PLAYERS.indexOf(p);
  const av = AVATARS[i % AVATARS.length];
  const hpPct = Math.round(p.hp / p.hpMax * 100);
  const insPct = Math.round(p.ins / getInsanidadeMax(p) * 100);
  const armPct = p.armaduraMax > 0 ? Math.round(p.armadura / p.armaduraMax * 100) : 0;
  const elmPct = p.elmoMax > 0 ? Math.round(p.elmo / p.elmoMax * 100) : 0;
  const xpPct = Math.round(p.xp / 10 * 100);
  const bm = p.hp === 0;
  const temSeq = p.ins >= 25;
  const isBruxo = p.classeBase === 'Bruxo';
  const isBardo = p.classeBase === 'Bardo';
  const isClerigo = p.classeBase === 'Clérigo';
  const humanPct = Math.round(getHumanidade(p) / HUMANIDADE_MAX * 100);

  const grupos = { green:[], red:[], blue:[], gray:[] };
  p.skills.forEach(sk => { if (!habilidadeFormaSombriaEscondida(p, sk)) grupos[sk.color] && grupos[sk.color].push(sk); });
  const nomesGrupo = { green: 'Técnicas — Agilidade', red: 'Golpes — Força', blue: 'Feitiços — Intelecto', gray: 'Neutras' };
  const dotColor = {green:'#6db33f', red:'#c94040', blue:'#4a8fd4', gray:'#7a7e95'};
  const campoGrupo = { green: 'agi', red: 'forca', blue: 'intel', gray: null };

  let skillsHtml = '';
  ['green','red','blue','gray'].forEach(cor => {
    if (!grupos[cor].length) return;
    const collapsed = !!jogSkillsCollapsed[cor];
    const mst = campoGrupo[cor] != null ? maestriaDe(p, campoGrupo[cor]) : null;
    const mstTag = mst != null ? `<span class="sk-tag sk-tag-mst">+${mst} maestria</span>` : '';
    const readyCount = grupos[cor].filter(sk => isReady(sk, p) && !formaSombriaBloqueiaHabilidade(p, sk)).length;
    const totalCount = grupos[cor].length;
    const cards = collapsed ? '' : grupos[cor].map(sk => {
      const bloqueadaPorForma = formaSombriaBloqueiaHabilidade(p, sk);
      const ready = isReady(sk, p) && !bloqueadaPorForma;
      // Card da Habilidade Neutra ("Bombado"/"Lutador"/"Feitiçeiro") enquanto
      // a Forma Sombria correspondente estiver ativa: mostra "Desativar" em
      // vez de "Usar" (desfazer a forma é sempre livre, ver useSkill).
      const formaSombriaAtivaCard = p.race === 'Pandaren' && p.formaSombriaAtiva && p.formaSombriaId
        && PANDAREN_FORMAS_SOMBRIAS[p.formaSombriaId]
        && sk.id === PANDAREN_FORMAS_SOMBRIAS[p.formaSombriaId].skillNeutra.id;
      const mstTagCard = sk.lendario
        ? `<span class="sk-tag sk-tag-mst">🌟 +${getMaestriaLendaria(p)} maestria (lendária)</span>`
        : mstTag;
      const state = bloqueadaPorForma ? 'exhausted' : formaSombriaAtivaCard ? 'ready' : sk.tipo==='infinite' ? 'ready' : ready ? 'ready' : sk.cdRestante>0 ? 'cooldown' : 'exhausted';
      let cdHtml = '', dotsHtml = '';
      if (sk.tipo === 'turno_N') cdHtml = sk.cdRestante > 0 ? `<span class="sk-cd">⏳ ${sk.cdRestante} turno${sk.cdRestante>1?'s':''}</span>` : `<span class="sk-cd">Pronta</span>`;
      else if (sk.tipo==='luta' || sk.tipo==='sessao') {
        const spent = sk.usosMax - sk.usosAtuais;
        dotsHtml = `<div class="sk-dots">${Array.from({length:sk.usosMax},(_,di)=>`<div class="sdot ${di<spent?'spent':''}"></div>`).join('')}</div>`;
      } else if (sk.tipo === 'perturn') cdHtml = `<span class="sk-cd">${ready ? 'Pronta' : 'Usada'}</span>`;
      else if (sk.tipo === 'infinite') cdHtml = `<span class="sk-cd">∞</span>`;

      return `<div class="skill-card sk-${cor} ${state}" onclick="useSkill(${p.id},'${sk.id}')">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div class="sk-name">${sk.name}</div>
          <button onclick="event.stopPropagation(); editSkill(${p.id}, '${sk.id}')" title="Editar" style="background:none; border:none; color:var(--text3); cursor:pointer; padding:0; margin-left:8px;">
            <i class="ti ti-edit" style="font-size:16px;"></i>
          </button>
        </div>
        <div class="sk-tags">
          <span class="sk-tag">${sk.cost===0?'0 ações':sk.cost===1?'1 ação':'2 ações'}</span>
          <span class="sk-tag">${tipoLabel(sk)}</span>
          ${mstTagCard}
          ${sk.lendario ? `<span class="sk-tag" style="background:rgba(124,92,191,0.18);color:var(--accent2)">✨ Feitiço Lendário</span>` : ''}
          ${sk.ritualMacabro ? `<span class="sk-tag" style="background:rgba(124,92,191,0.18);color:var(--accent2)">🌀 Ritual Macabro</span>` : ''}
          ${sk.encantamentoItemId ? `<span class="sk-tag" style="background:rgba(124,92,191,0.18);color:var(--accent2)">🔮 Encantamento</span>` : ''}
          ${(p.encantamentoTrollEscolhas || []).some(e => e.skillId === sk.id) ? `<span class="sk-tag" style="background:rgba(124,92,191,0.18);color:var(--accent2)" title="Encantamento Troll — o Acerto já usa um Teste de Arcano OU Místico completo (maestria, Mega Vantagem/Desvantagem e Bônus configurados nesse Teste), à escolha a cada uso">🔮 Encantada (Arcano/Místico)</span>` : ''}
          ${sk.concedeNota ? `<span class="sk-tag" style="background:var(--bardo-dim);color:#f0dba0">🎵 ${sk.concedeNota === 'qualquer' ? 'escolha uma nota' : sk.concedeNota}</span>` : ''}
          ${getMagharHabBonus(p, sk.id) ? `<span class="sk-tag" style="background:rgba(109,179,63,0.15);color:var(--green)" title="Origem Mag'har — +1d4 Dano/Cura ainda manual${sk.color === 'red' ? '; +2 Vantagem já entra sozinho na rolagem de Acerto' : ''}">+1d4 Dano/Cura${sk.color === 'red' ? ' · +2 Vantagem' : ''}</span>` : ''}
          ${getFilosofiaPandarenicaBonus(p, sk) ? `<span class="sk-tag" style="background:var(--accent-bg);color:var(--accent2)" title="Filosofia Pandarênica — +3 Vantagem já entra sozinho na rolagem de Acerto">+3 Vantagem</span>` : ''}
          ${(p.furiaOrcAtiva && sk.id !== 'sk_racial_orc_furia') ? `<span class="sk-tag" style="background:var(--red-bg);color:var(--red)" title="Fúria de Orc — esta é a próxima Habilidade: não pode ser Aparada${sk.color === 'red' ? ' e recebe +1d6 de Dano' : ''}">😡 Não Aparável${sk.color === 'red' ? ' · +1d6 Dano' : ''}</span>` : ''}
          ${bloqueadaPorForma ? `<span class="sk-tag" style="background:var(--red-bg);color:var(--red)" title="Bloqueada pela Forma Sombria — só ${FORMA_SOMBRIA_COR_LABEL[PANDAREN_FORMAS_SOMBRIAS[p.formaSombriaId].corPermitida]} podem ser usados agora">🔒 Bloqueada</span>` : ''}
          ${formaSombriaAtivaCard ? `<span class="sk-tag" style="background:var(--red-bg);color:var(--red)" title="Forma Sombria ativa">🐼 Ativa</span>` : ''}
        </div>
        <div style="font-size: 11px; color: var(--text2); margin-bottom: 12px; line-height: 1.5; white-space: pre-wrap; max-height: 110px; overflow-y: auto; padding-right: 4px;">
            ${sk.desc || '<em>Nenhum efeito descrito.</em>'}
        </div>
        ${renderEfeitoSecundarioHtml(p, sk)}
        ${renderCorromperHtml(p.id + '-' + sk.id, sk)}
        <div class="sk-bottom">
          ${precisaAcertoHabilidade(p, sk) ? `<button class="sk-btn sk-btn-acerto" onclick="event.stopPropagation();rolarAcertoHabilidadeClick(${p.id},'${sk.id}')" ${!ready?'disabled':''} title="Rola 1d20 + maestria + bônus, só pra checar se acertou — não gasta a Habilidade">🎯 Acerto</button>` : ''}
          <button class="sk-btn ${formaSombriaAtivaCard ? 'sk-btn-desativar' : ''}" onclick="event.stopPropagation();useSkill(${p.id},'${sk.id}')" ${(!ready && !formaSombriaAtivaCard)?'disabled':''}>
            ${formaSombriaAtivaCard ? 'Desativar' : 'Usar Efeito'}
          </button>
          ${dotsHtml}${cdHtml}
        </div>
      </div>`;
    }).join('');

    skillsHtml += `
      <div class="group-title group-title-toggle" onclick="toggleJogSkillGroup('${cor}')">
        <span class="gt-dot" style="background:${dotColor[cor]}"></span>
        ${nomesGrupo[cor]}${mst != null ? ` <span class="group-title-mst">(+${mst})</span>` : ''}
        <span class="gt-collapse-info">${collapsed ? `<span class="gt-ready-badge">${readyCount}/${totalCount} prontas</span>` : ''}</span>
        <i class="ti ${collapsed ? 'ti-chevron-down' : 'ti-chevron-up'} gt-chevron"></i>
      </div>
      ${collapsed ? '' : `<div class="skills-grid">${cards}</div>`}`;
  });

  const passivasList = Array.isArray(p.passivas) ? p.passivas : [];
  const passivasCollapsed = !!jogSkillsCollapsed['passivas'];
  const origemObjJog = getOrigemPersonagem(p);
  const passivasHtml = passivasCollapsed ? '' : passivasList.map(pas => {
    let tag = '', tagCls = 'passiva-tag';
    if (pas.origemId) { tag = `(origem · ${origemObjJog ? origemObjJog.name : ''})`; tagCls += ' passiva-tag-origem'; }
    else if (pas.racialId) tag = `(racial · ${p.race})`;
    else if (pas.subclasseId) tag = `(subclasse · ${p.cls})`;
    else if (pas.classeId) tag = `(classe · ${p.classeBase})`;
    else if (pas.talentoInferiorId) tag = `(talento inferior)`;
    else if (pas.talentoSuperiorId) tag = `(talento superior)`;
    return `
    <div class="passiva-card">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
        <div style="min-width:0; flex:1;">
          <div class="passiva-name"><i class="ti ti-sparkles"></i> <span>${pas.name}</span></div>
          ${tag ? `<div class="${tagCls}">${tag}</div>` : ''}
        </div>
        <button onclick="editPassiva(${p.id}, '${pas.id}')" title="Editar" style="background:none; border:none; color:var(--text3); cursor:pointer; padding:0; margin-left:8px; flex-shrink:0;">
          <i class="ti ti-edit" style="font-size:16px;"></i>
        </button>
      </div>
      <div class="passiva-desc">${pas.desc || '<em>Nenhum efeito descrito.</em>'}</div>
      ${pas.racialId === 'anao_criacao' ? (p.criacaoAnaoUsada ? `<div style="font-size:11px;color:var(--text3);margin-top:6px">✓ Já usada</div>` : `<button class="btn" style="margin-top:8px;font-size:12px;padding:5px 12px" onclick="abrirCriacaoAnaoModal(${p.id})">Fundir Armas</button>`) : ''}
      ${pas.racialId === 'anao_origem_comum_passiva' && p.origemComumPendente ? `<button class="btn" style="margin-top:8px;font-size:12px;padding:5px 12px" onclick="rolarOrigemComum(${p.id})">🎲 Rolar 1d10 (Mega Vantagem)</button>` : ''}
      ${pas.racialId === 'anao_origem_profundezas_passiva' && p.origemProfundezasPendente ? `<button class="btn" style="margin-top:8px;font-size:12px;padding:5px 12px" onclick="abrirOrigemProfundezasModal(${p.id})">Escolher Arma (+1 Dano)</button>` : ''}
      ${pas.racialId === 'elfo_decreptico' ? `<button class="btn" style="margin-top:8px;font-size:12px;padding:5px 12px" onclick="abrirDecrepticoModal(${p.id})">Escolher Testes</button>` : ''}
      ${pas.racialId === 'tauren_brutao' ? `<button class="btn" style="margin-top:8px;font-size:12px;padding:5px 12px" onclick="abrirBrutaoModal(${p.id})">Escolher Testes</button>` : ''}
      ${maestriaTipoDoSubclasseId(pas.subclasseId) ? `<button class="btn" style="margin-top:8px;font-size:12px;padding:5px 12px" onclick="abrirMaestriaModal(${p.id},'${maestriaTipoDoSubclasseId(pas.subclasseId)}')">Escolher Teste</button>` : ''}
      ${pas.racialId === 'troll_encantamento_troll' ? `<button class="btn" style="margin-top:8px;font-size:12px;padding:5px 12px" onclick="abrirEncantamentoTrollModal(${p.id})">Escolher Habilidade</button>` : ''}
      ${pas.racialId === 'troll_origem_comum_passiva' ? `<button class="btn" style="margin-top:8px;font-size:12px;padding:5px 12px" onclick="abrirOrigemComumModal(${p.id})">Configurar Troca</button>` : ''}
      ${pas.racialId === 'elfo_origem_sangrento_passiva' && !p.origemSangrentaUsado ? `<button class="btn" style="margin-top:8px;font-size:12px;padding:5px 12px" onclick="abrirOrigemSangrentaModal(${p.id})">Escolher Habilidade</button>` : ''}
      ${pas.racialId === 'elfo_origem_noturno_passiva' && !p.origemNoturnaUsada ? `<button class="btn" style="margin-top:8px;font-size:12px;padding:5px 12px" onclick="abrirOrigemNoturnaModal(${p.id})">Escolher Caminho</button>` : ''}
      ${pas.racialId === 'humano_origem_vento_bravo_passiva' ? `<button class="btn" style="margin-top:8px;font-size:12px;padding:5px 12px" onclick="abrirVentoBravoModal(${p.id})">Configurar Testes</button>` : ''}
      ${pas.racialId === 'humano_origem_kalindor_passiva' ? `<button class="btn" style="margin-top:8px;font-size:12px;padding:5px 12px" onclick="abrirKalindorModal(${p.id})">Configurar Testes</button>` : ''}
      ${pas.racialId === 'orc_origem_maghar_passiva' && !p.magharTesteMD ? `<button class="btn" style="margin-top:8px;font-size:12px;padding:5px 12px" onclick="abrirMagharModal(${p.id})">Escolher Teste (MD)</button>` : ''}
      ${pas.racialId === 'orc_origem_maghar_passiva' && p.magharTesteMD ? `<button class="btn" style="margin-top:8px;font-size:12px;padding:5px 12px" onclick="abrirMagharHabModal(${p.id})">Configurar Habilidades</button>` : ''}
      ${pas.racialId === 'pandaren_origem_comum_passiva' && !p.filosofiaPandarenicaCor ? `<button class="btn" style="margin-top:8px;font-size:12px;padding:5px 12px" onclick="abrirFilosofiaPandarenicaModal(${p.id})">Escolher Tipo de Habilidade</button>` : ''}
      ${pas.racialId === 'pandaren_origem_comum_passiva' && p.filosofiaPandarenicaCor ? `<div style="font-size:11px;color:var(--text3);margin-top:6px">✓ Tipo escolhido: ${{blue:'Feitiço',red:'Golpe',green:'Técnica'}[p.filosofiaPandarenicaCor]}</div>` : ''}
    </div>`;
  }).join('');

  const expressoesList = getExpressoesEtereas(p);
  const expressoesCollapsed = !!jogSkillsCollapsed['expressoes'];
  const expressoesHtml = expressoesCollapsed ? '' : expressoesList.map(ex => {
    const origemTag = ex.origemName ? ` <span style="font-size:10px;color:var(--eter);font-weight:400;opacity:.8">(${ex.origemName})</span>` : '';
    return `
    <div class="expressao-card">
      <div class="expressao-indice">${ex.indice}</div>
      <div class="expressao-name"><i class="ti ti-atom-2"></i> ${ex.name}${origemTag}</div>
      <div class="expressao-desc">${ex.desc}</div>
    </div>`;
  }).join('');

  const camposHarmonicosList = getCamposHarmonicos(p);
  const camposHarmonicosCollapsed = !!jogSkillsCollapsed['campos'];
  const camposHarmonicosHtml = camposHarmonicosCollapsed ? '' : camposHarmonicosList.map(sk => {
    const ready = isReady(sk, p);
    const state = ready ? 'ready' : 'exhausted';
    const notasStatus = ready ? 'Pronta' : `${countNotasAtivas(p)}/7 notas`;
    return `<div class="skill-card sk-bardo ${state}" onclick="useSkill(${p.id},'${sk.id}')">
      <div class="sk-name">${sk.name}</div>
      <div class="sk-tags"><span class="sk-tag">2 ações</span><span class="sk-tag">${tipoLabel(sk)}</span></div>
      <div style="font-size: 11px; color: var(--text2); margin-bottom: 12px; line-height: 1.5; white-space: pre-wrap; max-height: 110px; overflow-y: auto; padding-right: 4px;">
          ${sk.desc || '<em>Nenhum efeito descrito.</em>'}
      </div>
      <div class="sk-bottom">
        ${precisaAcertoHabilidade(p, sk) ? `<button class="sk-btn sk-btn-acerto" onclick="event.stopPropagation();rolarAcertoHabilidadeClick(${p.id},'${sk.id}')" ${!ready?'disabled':''} title="Rola 1d20 + maestria + bônus, só pra checar se acertou — não gasta a Habilidade">🎯 Acerto</button>` : ''}
        <button class="sk-btn" onclick="event.stopPropagation();useSkill(${p.id},'${sk.id}')" ${!ready?'disabled':''}>Usar Efeito</button>
        <span class="sk-cd">${notasStatus}</span>
      </div>
    </div>`;
  }).join('');

  const divindadeItensList = getDivindadeItens(p);
  const divindadeCollapsed = !!jogSkillsCollapsed['divindade'];
  const divindadeHtml = divindadeCollapsed ? '' : divindadeItensList.map(item => `
    <div class="divindade-card">
      <div class="divindade-indice">${item.sigla}</div>
      <div class="divindade-name"><i class="ti ti-sun"></i> ${item.name}</div>
      <div class="divindade-desc">${item.desc}</div>
    </div>`).join('');

  content.innerHTML = `
    <div class="jog-inner-grid">
    <div class="j-sidebar">
      <div class="j-id-card">
        <div style="display:flex; justify-content: flex-end; gap: 8px; margin-bottom: -15px; position: relative; z-index: 10;">
            <button onclick="editCharacter(${p.id})" title="Editar Personagem" style="background:none; border:none; color:var(--text3); cursor:pointer;"><i class="ti ti-edit" style="font-size:18px;"></i></button>
            <button onclick="deleteCharacter(${p.id})" title="Excluir Personagem" style="background:none; border:none; color:var(--red); cursor:pointer;"><i class="ti ti-trash" style="font-size:18px;"></i></button>
        </div>
        <div class="char-av-big" style="background:${av.bg};color:${av.color}">${p.name.slice(0,2).toUpperCase()}</div>
        <div class="char-name">${p.name}</div><div class="char-sub">${p.race} · ${p.classeBase ? p.classeBase + ' / ' : ''}${p.cls}</div>
        ${(p.race === 'Dragão' && p.formaDragao) ? `
        <div style="display:flex;align-items:center;gap:8px;background:var(--red-bg);border:1px solid var(--red-bd);border-radius:10px;padding:8px 12px;margin-top:10px">
          <span style="font-size:18px">🐉</span>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:700;color:var(--red)">Forma de Dragão ativa</div>
            <div style="font-size:11px;color:var(--text2)">Sopro, Iniciar Voo, Impacto de Pouso e Garras Dracônicas disponíveis</div>
          </div>
        </div>` : ''}
        ${(p.race === 'Pandaren' && p.formaSombriaAtiva && p.formaSombriaId && PANDAREN_FORMAS_SOMBRIAS[p.formaSombriaId]) ? `
        <div style="display:flex;align-items:center;gap:8px;background:var(--accent-bg);border:1px solid var(--accent-bd);border-radius:10px;padding:8px 12px;margin-top:10px">
          <span style="font-size:18px">🐼</span>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:700;color:var(--accent2)">Forma Sombria ativa: ${PANDAREN_FORMAS_SOMBRIAS[p.formaSombriaId].name}</div>
            <div style="font-size:11px;color:var(--text2)">Só pode usar Habilidades de ${FORMA_SOMBRIA_COR_LABEL[PANDAREN_FORMAS_SOMBRIAS[p.formaSombriaId].corPermitida]} · toque em "${PANDAREN_FORMAS_SOMBRIAS[p.formaSombriaId].name}" pra desfazer</div>
          </div>
        </div>` : ''}
        ${p.dueloAtivo ? `
        <div style="display:flex;align-items:center;gap:8px;background:${p.dueloContraAlvo ? 'var(--green-bg)' : 'var(--red-bg)'};border:1px solid ${p.dueloContraAlvo ? 'var(--green-bd)' : 'var(--red-bd)'};border-radius:10px;padding:8px 12px;margin-top:10px">
          <span style="font-size:18px">⚔️</span>
          <div style="flex:1;cursor:pointer" onclick="toggleDueloAlvo(${p.id})">
            <div style="font-size:12px;font-weight:700;color:${p.dueloContraAlvo ? 'var(--green)' : '#f08080'}">Duelo ativo: ${p.dueloContraAlvo ? '+1d6 contra o Alvo' : '−1d6 contra outro Alvo'}</div>
            <div style="font-size:11px;color:var(--text2)">Toque para trocar antes de rolar</div>
          </div>
          <button onclick="event.stopPropagation();desativarDuelo(${p.id})" title="Encerrar o Duelo" style="background:none;border:1px solid var(--border2);color:var(--text2);width:22px;height:22px;border-radius:50%;cursor:pointer;font-size:11px;flex-shrink:0">✕</button>
        </div>` : ''}
        ${p.gritoDeGuerraAtivo ? `
        <div style="display:flex;align-items:center;gap:8px;background:var(--green-bg);border:1px solid var(--green-bd);border-radius:10px;padding:8px 12px;margin-top:10px">
          <span style="font-size:18px">📣</span>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:700;color:var(--green)">Grito de Guerra ativo</div>
            <div style="font-size:11px;color:var(--text2)">Mega Vantagem em todos os Testes até o próximo turno — não pode Desviar</div>
          </div>
        </div>` : ''}
        ${p.motivarPendente ? `
        <div style="display:flex;align-items:center;gap:8px;background:var(--green-bg);border:1px solid var(--green-bd);border-radius:10px;padding:8px 12px;margin-top:10px">
          <span style="font-size:18px">📢</span>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:700;color:var(--green)">Motivar ativo</div>
            <div style="font-size:11px;color:var(--text2)">+1d12 de Vantagem no próximo Teste ou Acerto — some sozinho ao ser usado</div>
          </div>
        </div>` : ''}
        ${p.honraMegaVantagemPendente ? `
        <div style="display:flex;align-items:center;gap:8px;background:var(--green-bg);border:1px solid var(--green-bd);border-radius:10px;padding:8px 12px;margin-top:10px">
          <span style="font-size:18px">⚔️</span>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:700;color:var(--green)">Honra ativa</div>
            <div style="font-size:11px;color:var(--text2)">Mega Vantagem no Acerto da próxima Técnica ou Golpe — some sozinho ao ser usado</div>
          </div>
        </div>` : ''}
        ${p.pontosPendentes > 0 ? `
        <div onclick="editCharacter(${p.id})" style="cursor:pointer;display:flex;align-items:center;gap:8px;background:rgba(124,92,191,0.15);border:1px solid rgba(124,92,191,0.45);border-radius:10px;padding:8px 12px;margin-top:10px">
          <span style="font-size:18px">⬆</span>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:700;color:var(--accent2)">Você subiu de nível!</div>
            <div style="font-size:11px;color:var(--text2)">${p.pontosPendentes} pontos de atributo para distribuir · toque para editar</div>
          </div>
        </div>` : ''}
        ${getRituaisMacabrosPendentes(p) > 0 ? `
        <div onclick="openRituaisMacabrosModal(${p.id})" style="cursor:pointer;display:flex;align-items:center;gap:8px;background:rgba(124,92,191,0.15);border:1px solid rgba(124,92,191,0.45);border-radius:10px;padding:8px 12px;margin-top:10px">
          <span style="font-size:18px">🌀</span>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:700;color:var(--accent2)">Ritual Macabro disponível!</div>
            <div style="font-size:11px;color:var(--text2)">${getRituaisMacabrosPendentes(p)} escolha${getRituaisMacabrosPendentes(p) === 1 ? '' : 's'} de Ritual Macabro · toque para escolher</div>
          </div>
        </div>` : ''}
        ${getFeiticosLendariosPendentes(p) > 0 ? `
        <div onclick="openFeiticosLendariosModal(${p.id})" style="cursor:pointer;display:flex;align-items:center;gap:8px;background:rgba(124,92,191,0.15);border:1px solid rgba(124,92,191,0.45);border-radius:10px;padding:8px 12px;margin-top:10px">
          <span style="font-size:18px">✨</span>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:700;color:var(--accent2)">Feitiço Lendário disponível!</div>
            <div style="font-size:11px;color:var(--text2)">${getFeiticosLendariosPendentes(p)} escolha${getFeiticosLendariosPendentes(p) === 1 ? '' : 's'} de Feitiço Lendário · toque para escolher</div>
          </div>
        </div>` : ''}
        ${getTalentosSuperioresPendentes(p) > 0 ? `
        <div onclick="openTalentosSuperioresModal(${p.id})" style="cursor:pointer;display:flex;align-items:center;gap:8px;background:rgba(124,92,191,0.15);border:1px solid rgba(124,92,191,0.45);border-radius:10px;padding:8px 12px;margin-top:10px">
          <span style="font-size:18px">👑</span>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:700;color:var(--accent2)">Talento Superior disponível!</div>
            <div style="font-size:11px;color:var(--text2)">${getTalentosSuperioresPendentes(p)} escolha${getTalentosSuperioresPendentes(p) === 1 ? '' : 's'} de Talento Superior · toque para escolher</div>
          </div>
        </div>` : ''}
        ${getTalentosInferioresPendentes(p) > 0 ? `
        <div onclick="openTalentosModal(${p.id})" style="cursor:pointer;display:flex;align-items:center;gap:8px;background:rgba(124,92,191,0.15);border:1px solid rgba(124,92,191,0.45);border-radius:10px;padding:8px 12px;margin-top:10px">
          <span style="font-size:18px">🎖</span>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:700;color:var(--accent2)">Talento Inferior disponível!</div>
            <div style="font-size:11px;color:var(--text2)">${getTalentosInferioresPendentes(p)} escolha${getTalentosInferioresPendentes(p) === 1 ? '' : 's'} de Talento Inferior · toque para escolher</div>
          </div>
        </div>` : ''}
        ${getHabilidadesPendentes(p) > 0 ? `
        <div onclick="openBancoModal(${p.id})" style="cursor:pointer;display:flex;align-items:center;gap:8px;background:rgba(124,92,191,0.15);border:1px solid rgba(124,92,191,0.45);border-radius:10px;padding:8px 12px;margin-top:10px">
          <span style="font-size:18px">📖</span>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:700;color:var(--accent2)">Novas Habilidades disponíveis!</div>
            <div style="font-size:11px;color:var(--text2)">${getHabilidadesPendentes(p)} escolha${getHabilidadesPendentes(p) === 1 ? '' : 's'} do Banco de Habilidades · toque para escolher</div>
          </div>
        </div>` : ''}
        <div class="xp-bar-wrap">
          <div class="xp-lbl"><span>XP — ${p.xp}/10</span><span>Nv ${p.level}${p.level<5?' → '+(p.level+1):' (máx)'}</span></div>
          <div class="xp-track"><div class="xp-fill" style="width:${xpPct}%"></div></div>
        </div>
        <div style="margin-top:8px;display:flex;gap:5px">
          <button class="btn" style="flex:1;justify-content:center" onclick="removeXP(${p.id})">− XP</button>
          <button class="btn" style="flex:1;justify-content:center" onclick="addXP(${p.id})">+ XP</button>
        </div>
      </div>
      <div class="stat-block">
        <div class="stat-row"><span class="stat-lbl"><i class="ti ti-heart" style="color:var(--red)"></i> Vida</span><span class="stat-val" style="color:${bm?'var(--red)':'var(--text)'}">${p.hp}/${p.hpMax}</span></div>
        <div class="bar-track" style="margin:5px 0"><div class="bar-fill ${vidaClass(p.hp,p.hpMax)}" style="width:${hpPct}%"></div></div>
        <div class="hp-ctrl hp-ctrl-5">
          <button onclick="adjHP(${p.id},-5)">−5</button><button onclick="adjHP(${p.id},-1)">−1</button>
          <input type="number" class="stat-input" value="${p.hp}" onchange="setHP(${p.id}, this.value)">
          <button onclick="adjHP(${p.id},+1)">+1</button><button onclick="adjHP(${p.id},+5)">+5</button>
        </div>
        <div class="bm-alert ${bm?'show':''}">⚠ Beira Morte<br><small>Emoção 1d100 ≥ 50 · Resistência 1d20 ≥ 10</small></div>
        <div class="stat-row" style="margin-top:10px"><span class="stat-lbl"><i class="ti ti-bolt" style="color:var(--accent2)"></i> Ações do turno</span><span class="stat-val" style="color:var(--accent2)">${p.acoesAtuais ?? p.acoesMax ?? ACOES_POR_TURNO_PADRAO}/${p.acoesMax ?? ACOES_POR_TURNO_PADRAO}</span></div>
        <div class="stat-row" style="margin-top:10px"><span class="stat-lbl"><i class="ti ti-brain" style="color:var(--rose)"></i> Insanidade</span><span class="stat-val" style="color:var(--rose)">${p.ins}/${getInsanidadeMax(p)}</span></div>
        <div class="bar-track" style="margin:5px 0"><div class="bar-fill bfill-ins" style="width:${insPct}%"></div></div>
        <div class="ins-ctrl ins-ctrl-5">
          <button onclick="adjIns(${p.id},+10)">+10</button><button onclick="adjIns(${p.id},+5)">+5</button>
          <input type="number" class="stat-input" value="${p.ins}" onchange="setIns(${p.id}, this.value)">
          <button onclick="adjIns(${p.id},-5)">−5</button><button onclick="adjIns(${p.id},-10)">−10</button>
        </div>
        <div class="seq-alert ${temSeq?'show':''}">Sequela emocional — ${Math.floor(p.ins/25)} marca(s). Role 1d6.</div>
      </div>
      ${isBruxo ? `
      <div class="stat-block">
        <div class="stat-row"><span class="stat-lbl"><i class="ti ti-droplet-filled" style="color:var(--accent2)"></i> Humanidade</span><span class="stat-val" style="color:var(--accent2)">${getHumanidade(p)}/${HUMANIDADE_MAX}</span></div>
        <div class="bar-track" style="margin:5px 0"><div class="bar-fill bfill-human" style="width:${humanPct}%"></div></div>
        <div class="arm-ctrl arm-ctrl-3">
          <button onclick="adjHumanidade(${p.id},-1)">−1</button>
          <input type="number" class="stat-input" value="${getHumanidade(p)}" onchange="setHumanidade(${p.id}, this.value)">
          <button onclick="adjHumanidade(${p.id},+1)">+1</button>
        </div>
      </div>` : ''}
      ${isBardo ? `
      <div class="stat-block">
        <div class="stat-row" style="margin-bottom:10px">
          <span class="stat-lbl"><i class="ti ti-music" style="color:var(--bardo)"></i> Notas Musicais</span>
          <span class="stat-val" style="color:var(--bardo)">${countNotasAtivas(p)}/7</span>
        </div>
        <div class="notas-grid">
          ${NOTAS_MUSICAIS.map(n => {
            const ativa = getNotasBardo(p)[n];
            return `<button class="nota-btn ${ativa ? 'nota-ativa' : ''}" onclick="toggleNota(${p.id},'${n}')" title="${ativa ? 'Desativar ' + n : 'Ativar ' + n}"><span class="nota-simbolo">${n}</span></button>`;
          }).join('')}
        </div>
        <button class="btn" style="width:100%;margin-top:10px;font-size:11px;justify-content:center" onclick="resetNotasBardo(${p.id})"><i class="ti ti-music"></i> Usar todas</button>
      </div>` : ''}
      ${isClerigo ? `
      <div class="stat-block">
        <div class="stat-row"><span class="stat-lbl"><i class="ti ti-flame" style="color:var(--red)"></i> Pecado</span><span class="stat-val" style="color:var(--red)">${getPecado(p)}</span></div>
        <div class="arm-ctrl arm-ctrl-3">
          <button onclick="adjPecado(${p.id},-1)">−1</button>
          <input type="number" class="stat-input" value="${getPecado(p)}" onchange="setPecado(${p.id}, this.value)">
          <button onclick="adjPecado(${p.id},+1)">+1</button>
        </div>
      </div>` : ''}
      <div class="stat-block">
        <div class="stat-row"><span class="stat-lbl"><i class="ti ti-shield" style="color:var(--amber)"></i> Armadura</span><span class="stat-val" style="color:var(--amber)">${p.armadura}/${p.armaduraMax}</span></div>
        <div class="bar-track" style="margin:5px 0"><div class="bar-fill bfill-arm" style="width:${armPct}%"></div></div>
        <div class="arm-ctrl arm-ctrl-3">
          <button onclick="adjArmadura(${p.id},-1)">−1</button>
          <input type="number" class="stat-input" value="${p.armadura}" onchange="setArmadura(${p.id}, this.value)">
          <button onclick="adjArmadura(${p.id},+1)">+1</button>
        </div>
      </div>
      ${temCarapacaAntimagia(p) ? (() => {
        syncArmaduraAntiMagia(p);
        const antiMagiaPct = p.armaduraAntiMagiaMax ? Math.round((p.armaduraAntiMagia / p.armaduraAntiMagiaMax) * 100) : 0;
        return `
      <div class="stat-block">
        <div class="stat-row"><span class="stat-lbl"><i class="ti ti-sparkles" style="color:var(--accent2)"></i> Armadura Anti-Magia</span><span class="stat-val" style="color:var(--accent2)">${p.armaduraAntiMagia}/${p.armaduraAntiMagiaMax}</span></div>
        <div class="bar-track" style="margin:5px 0"><div class="bar-fill" style="width:${antiMagiaPct}%;background:var(--accent2)"></div></div>
        <div class="arm-ctrl arm-ctrl-3">
          <button onclick="adjArmaduraAntiMagia(${p.id},-1)">−1</button>
          <input type="number" class="stat-input" value="${p.armaduraAntiMagia}" onchange="setArmaduraAntiMagia(${p.id}, this.value)">
          <button onclick="adjArmaduraAntiMagia(${p.id},+1)">+1</button>
        </div>
        <div style="text-align:right;margin-top:4px"><button onclick="restaurarArmaduraAntiMagia(${p.id})" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:11px;display:inline-flex;align-items:center;gap:4px"><i class="ti ti-refresh"></i> Restaurar (fim de Jornada/Aventura/Campanha)</button></div>
      </div>`; })() : ''}
      <div class="stat-block">
        <div class="stat-row"><span class="stat-lbl"><i class="ti ti-helmet" style="color:var(--teal)"></i> Elmo</span><span class="stat-val" style="color:var(--teal)">${p.elmo}/${p.elmoMax}</span></div>
        <div class="bar-track" style="margin:5px 0"><div class="bar-fill bfill-elm" style="width:${elmPct}%"></div></div>
        <div class="arm-ctrl arm-ctrl-3">
          <button onclick="adjElmo(${p.id},-1)">−1</button>
          <input type="number" class="stat-input" value="${p.elmo}" onchange="setElmo(${p.id}, this.value)">
          <button onclick="adjElmo(${p.id},+1)">+1</button>
        </div>
      </div>
      <div class="stat-block">
        <div class="attr3">
          <div class="am am-agi" title="Maestria: +${maestriaDe(p,'agi')} na rolagem (arredondado para cima de AGI/5${p.race==='Troll'&&p.trollMaestriaEscolha==='agi'?' +1 Tatuagem Rúnica':''})"><div class="am-lbl">AGI</div><div class="am-val">${p.agi}</div><div class="am-mst">+${maestriaDe(p,'agi')}</div></div>
          <div class="am am-for" title="Maestria: +${maestriaDe(p,'forca')} na rolagem (arredondado para cima de FOR/5${p.race==='Troll'&&p.trollMaestriaEscolha==='forca'?' +1 Tatuagem Rúnica':''})"><div class="am-lbl">FOR</div><div class="am-val">${p.forca}</div><div class="am-mst">+${maestriaDe(p,'forca')}</div></div>
          <div class="am am-int" title="Maestria: +${maestriaDe(p,'intel')} na rolagem (arredondado para cima de INT/5${p.race==='Troll'&&p.trollMaestriaEscolha==='intel'?' +1 Tatuagem Rúnica':''})"><div class="am-lbl">INT</div><div class="am-val">${p.intel}</div><div class="am-mst">+${maestriaDe(p,'intel')}</div></div>
        </div>
        <div class="equip2 equip1">
          <div class="eqm eqm-passos"><div class="eqm-lbl">Passos</div><div class="eqm-val">${p.passos}</div></div>
        </div>
      </div>
      <div class="stat-block">
        <div class="stat-row"><span class="stat-lbl"><i class="ti ti-coin" style="color:var(--amber)"></i> Dinheiro</span><span class="stat-val" style="color:var(--amber)">${p.dinheiro || 0}</span></div>
        <div class="hp-ctrl hp-ctrl-5">
          <button onclick="adjDinheiro(${p.id},-10)">−10</button><button onclick="adjDinheiro(${p.id},-1)">−1</button>
          <input type="number" class="stat-input" value="${p.dinheiro || 0}" onchange="setDinheiro(${p.id}, this.value)">
          <button onclick="adjDinheiro(${p.id},+1)">+1</button><button onclick="adjDinheiro(${p.id},+10)">+10</button>
        </div>
      </div>
      ${(p.inventario || []).some(i => i.peso === 'exotica' || (Array.isArray(i.aprimoramentos) && i.aprimoramentos.length > 0 && !i.aprimoramentos.every(a => (a.dourado || a.name === 'Dourado')))) ? `
      <div class="stat-block">
        <div class="stat-row"><span class="stat-lbl"><i class="ti ti-diamond" style="color:var(--accent2)"></i> Cristais</span><span class="stat-val" style="color:var(--accent2)">${p.cristais || 0}</span></div>
        <div class="arm-ctrl arm-ctrl-3">
          <button onclick="adjCristais(${p.id},-1)">−1</button>
          <input type="number" class="stat-input" value="${p.cristais || 0}" onchange="setCristais(${p.id}, this.value)">
          <button onclick="adjCristais(${p.id},+1)">+1</button>
        </div>
      </div>` : ''}
    </div>

    <div class="skills-area">
      <div class="legend">
        <span class="leg-item"><span class="leg-dot" style="background:var(--green)"></span>Pronta</span>
        <span class="leg-item"><span class="leg-dot" style="background:var(--text3)"></span>Usada / em recarga</span>
        <span class="leg-item" style="color:var(--text3)">⏳ = turnos restantes &nbsp;·&nbsp; ● = usos gastos</span>
      </div>
      ${skillsHtml}
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="add-skill-btn" onclick="openModal(${p.id})"><i class="ti ti-plus"></i> Adicionar habilidade</button>
        ${p.cls ? `<button class="add-skill-btn" onclick="openBancoModal(${p.id})"><i class="ti ti-book"></i> Escolher da Subclasse</button>` : ''}
      </div>

      <div class="group-title group-title-toggle" style="margin-top:24px" onclick="toggleJogSkillGroup('passivas')">
        <span class="gt-dot" style="background:var(--accent2)"></span>Passivas — Talentos
        <span class="gt-collapse-info">${passivasCollapsed ? `<span class="gt-ready-badge" style="background:rgba(124,92,191,0.15);color:var(--accent2);border-color:rgba(124,92,191,0.3)">${passivasList.length} talento${passivasList.length !== 1 ? 's' : ''}</span>` : ''}</span>
        <i class="ti ${passivasCollapsed ? 'ti-chevron-down' : 'ti-chevron-up'} gt-chevron"></i>
      </div>
      ${passivasCollapsed ? '' : `<div class="passivas-grid">${passivasHtml || '<div style="font-size:12px;color:var(--text3);padding:6px 0">Nenhuma passiva cadastrada ainda.</div>'}</div>`}
      ${passivasCollapsed ? '' : `
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="add-skill-btn" onclick="openPassivaModal(${p.id})"><i class="ti ti-plus"></i> Adicionar passiva / talento</button>
        <button class="add-skill-btn" onclick="openTalentosModal(${p.id})"><i class="ti ti-award"></i> Escolher Talento Inferior${getTalentosInferioresPendentes(p) > 0 ? ` <span class="gt-ready-badge" style="background:rgba(124,92,191,0.15);color:var(--accent2);border-color:rgba(124,92,191,0.3)">${getTalentosInferioresPendentes(p)}</span>` : ''}</button>
        <button class="add-skill-btn" onclick="openTalentosSuperioresModal(${p.id})"><i class="ti ti-crown"></i> Escolher Talento Superior${getTalentosSuperioresPendentes(p) > 0 ? ` <span class="gt-ready-badge" style="background:rgba(124,92,191,0.15);color:var(--accent2);border-color:rgba(124,92,191,0.3)">${getTalentosSuperioresPendentes(p)}</span>` : ''}</button>
        ${temAcessoFeiticoLendario(p) ? `<button class="add-skill-btn" onclick="openFeiticosLendariosModal(${p.id})"><i class="ti ti-sparkles"></i> Escolher Feitiço Lendário${getFeiticosLendariosPendentes(p) > 0 ? ` <span class="gt-ready-badge" style="background:rgba(124,92,191,0.15);color:var(--accent2);border-color:rgba(124,92,191,0.3)">${getFeiticosLendariosPendentes(p)}</span>` : ''}</button>` : ''}
        ${temAcessoRitualMacabro(p) ? `<button class="add-skill-btn" onclick="openRituaisMacabrosModal(${p.id})"><i class="ti ti-eye"></i> Escolher Ritual Macabro${getRituaisMacabrosPendentes(p) > 0 ? ` <span class="gt-ready-badge" style="background:rgba(124,92,191,0.15);color:var(--accent2);border-color:rgba(124,92,191,0.3)">${getRituaisMacabrosPendentes(p)}</span>` : ''}</button>` : ''}
      </div>`}

      ${expressoesList.length ? `
      <div class="group-title group-title-toggle" style="margin-top:24px" onclick="toggleJogSkillGroup('expressoes')">
        <span class="gt-dot" style="background:var(--eter)"></span>Expressões Etéreas
        <span class="gt-collapse-info">${expressoesCollapsed ? `<span class="gt-ready-badge" style="background:rgba(79,195,219,0.15);color:var(--eter);border-color:rgba(79,195,219,0.3)">${expressoesList.length} ${expressoesList.length !== 1 ? 'expressões' : 'expressão'}</span>` : ''}</span>
        <i class="ti ${expressoesCollapsed ? 'ti-chevron-down' : 'ti-chevron-up'} gt-chevron"></i>
      </div>
      ${expressoesCollapsed ? '' : `<div class="expressoes-legend">Crítico (Acerto ou Erro) em Ação/Teste → role 1d6 e confira o índice abaixo.</div>`}
      ${expressoesCollapsed ? '' : `<div class="expressoes-grid">${expressoesHtml}</div>`}
      ` : ''}

      ${camposHarmonicosList.length ? `
      <div class="group-title group-title-toggle" style="margin-top:24px" onclick="toggleJogSkillGroup('campos')">
        <span class="gt-dot" style="background:var(--bardo)"></span>Campos Harmônicos
        <span class="gt-collapse-info">${camposHarmonicosCollapsed ? `<span class="gt-ready-badge" style="background:rgba(232,168,56,0.15);color:var(--bardo);border-color:rgba(232,168,56,0.3)">${camposHarmonicosList.length} campos</span>` : ''}</span>
        <i class="ti ${camposHarmonicosCollapsed ? 'ti-chevron-down' : 'ti-chevron-up'} gt-chevron"></i>
      </div>
      ${camposHarmonicosCollapsed ? '' : `<div class="skills-grid">${camposHarmonicosHtml}</div>`}
      ` : ''}

      ${divindadeItensList.length ? `
      <div class="group-title group-title-toggle" style="margin-top:24px" onclick="toggleJogSkillGroup('divindade')">
        <span class="gt-dot" style="background:var(--divino)"></span>${p.deus}
        <span class="gt-collapse-info">${divindadeCollapsed ? `<span class="gt-ready-badge" style="background:rgba(217,179,74,0.15);color:var(--divino);border-color:rgba(217,179,74,0.3)">${divindadeItensList.length} dádivas</span>` : ''}</span>
        <i class="ti ${divindadeCollapsed ? 'ti-chevron-down' : 'ti-chevron-up'} gt-chevron"></i>
      </div>
      ${divindadeCollapsed ? '' : `<div class="divindades-grid">${divindadeHtml}</div>`}
      ` : ''}

      ${renderTestes(p, false)}
      ${renderInventarioArea(p)}
    </div>
    </div>
    `;
}

// ═══════════════════════════════════════
// TABS DO JOGADOR
// ═══════════════════════════════════════
const JOG_NOTA_TAGS = ['Geral', 'Missão', 'Segredos', 'NPCs', 'Itens'];

function switchJogTab(tab) {
  jogActiveTab = tab;
  // Troca visibilidade das views
  const ficha     = document.getElementById('jog-view-ficha');
  const anotacoes = document.getElementById('jog-view-anotacoes');
  if (ficha)     ficha.style.display     = tab === 'ficha'      ? '' : 'none';
  if (anotacoes) anotacoes.style.display = tab === 'anotacoes'  ? '' : 'none';
  // Atualiza estilo dos botões de tab
  document.querySelectorAll('.jog-tab').forEach(el => el.classList.remove('active'));
  const btn = document.getElementById('tab-' + tab);
  if (btn) btn.classList.add('active');
  // Renderiza a aba de anotações quando ativada
  if (tab === 'anotacoes') renderJogNotas();
}

// Alterna entre as sub-páginas do Narrador: "Jogadores" (personagens dos
// jogadores, como já era) e "NPCs" (bonecos controlados só pelo Narrador).
// Mesmo padrão de switchJogTab, mas trocando os containers do lado esquerdo
// do nar-layout — o painel da direita (Iniciativa / Anotações) continua
// sempre visível, pois vale tanto pra jogadores quanto NPCs.
// Salva NPC_BANK na conta do Narrador (ts_users/{id}/npc_bank), independente
// de qual campanha estiver ativa.
function saveNpcBank() {
  if (!currentUser) return;
  try { localStorage.setItem('rpg_npc_bank_' + currentUser.id, JSON.stringify(NPC_BANK)); } catch (e) {}
  if (!firebaseConfigured || typeof firebase === 'undefined') return;
  firebase.database().ref('ts_users/' + currentUser.id + '/npc_bank')
    .set(JSON.parse(JSON.stringify(NPC_BANK)))
    .catch(err => console.error('Erro ao salvar Banco de NPCs:', err));
}

// Abre o modal do Banco de NPCs: busca o banco mais recente do Narrador no
// Firebase e só então faz o "swap" de PLAYERS -> NPC_BANK (ver comentário na
// declaração de NPC_BANK acima). Pausa a sincronização da campanha atual
// enquanto o banco estiver aberto.
function openNpcBankModal() {
  npcBankSearchQuery = '';
  const searchInput = document.getElementById('npc-bank-search');
  if (searchInput) searchInput.value = '';
  const abrir = () => {
    if (dataListenerRef && dataListenerHandler) dataListenerRef.off('value', dataListenerHandler);
    campaignPlayersBackup = PLAYERS;
    PLAYERS = NPC_BANK;
    bankModeActive = true;
    document.getElementById('modal-npc-bank-overlay').classList.add('open');
    renderAll();
  };
  if (!currentUser || !firebaseConfigured || typeof firebase === 'undefined') { abrir(); return; }
  // Já buscamos do Firebase nesta sessão — o NPC_BANK local já está em dia
  // (toda alteração passa por saveNpcBank), então não busca de novo. Isso
  // evita que uma exclusão/edição recente "volte" por causa de um fetch que
  // chegou antes do save anterior terminar de replicar no servidor.
  if (npcBankLoaded) { abrir(); return; }
  firebase.database().ref('ts_users/' + currentUser.id + '/npc_bank').once('value').then(snap => {
    let data = snap.val() || [];
    if (!Array.isArray(data)) data = Object.values(data);
    data.forEach(p => {
      if (!Array.isArray(p.skills)) p.skills = [];
      if (!Array.isArray(p.passivas)) p.passivas = [];
      if (!Array.isArray(p.inventario)) p.inventario = [];
    });
    NPC_BANK = data;
    npcBankLoaded = true;
    abrir();
  }).catch(err => {
    console.error('Erro ao carregar Banco de NPCs:', err);
    abrir();
  });
}

// Fecha o modal do Banco de NPCs: devolve PLAYERS pra campanha e retoma a
// sincronização em tempo real que tinha sido pausada.
function closeNpcBankModal() {
  NPC_BANK = PLAYERS;
  PLAYERS = campaignPlayersBackup || [];
  campaignPlayersBackup = null;
  bankModeActive = false;
  const overlay = document.getElementById('modal-npc-bank-overlay');
  if (overlay) overlay.classList.remove('open');
  if (dataListenerRef && dataListenerHandler) dataListenerRef.on('value', dataListenerHandler);
  renderAll();
}

// Escreve só o campo PLAYERS da campanha ativa, sem depender da variável
// global PLAYERS (que pode estar apontando pro banco no momento da chamada).
function saveCampaignPlayersNow(playersArr) {
  const localKey = 'rpg_dashboard_data_' + (activeCampaignId || 'local');
  try {
    const cur = JSON.parse(localStorage.getItem(localKey) || '{}');
    cur.PLAYERS = playersArr;
    localStorage.setItem(localKey, JSON.stringify(cur));
  } catch (e) {}
  if (!firebaseRef) return;
  firebaseRef.child('PLAYERS').set(JSON.parse(JSON.stringify(playersArr)))
    .catch(err => console.error('Erro ao chamar NPC para a campanha:', err));
}

// Mesma ideia de saveCampaignPlayersNow, mas para o campo INITIATIVE — usado
// quando um NPC chamado do Banco precisa entrar direto no combate em
// andamento, independente de PLAYERS estar ou não apontando pro banco.
function saveCampaignInitiativeNow(initArr) {
  const localKey = 'rpg_dashboard_data_' + (activeCampaignId || 'local');
  try {
    const cur = JSON.parse(localStorage.getItem(localKey) || '{}');
    cur.INITIATIVE = initArr;
    localStorage.setItem(localKey, JSON.stringify(cur));
  } catch (e) {}
  if (!firebaseRef) return;
  firebaseRef.child('INITIATIVE').set(JSON.parse(JSON.stringify(initArr)))
    .catch(err => console.error('Erro ao sincronizar Iniciativa:', err));
}

// Copia um NPC do banco pra dentro da campanha ativa (campaignPlayersBackup,
// que é sempre o PLAYERS real da campanha, esteja o banco aberto ou não).
function summonNpcToCampaign(id) {
  const template = NPC_BANK.find(x => x.id === id);
  if (!template) return;
  const destino = bankModeActive ? campaignPlayersBackup : PLAYERS;
  if (!destino) { alert('Abra uma campanha antes de chamar um NPC.'); return; }
  const clone = JSON.parse(JSON.stringify(template));
  clone.id = destino.length ? Math.max(...destino.map(x => x.id)) + 1 : 1;
  clone.isNPC = true;
  clone.ownerId = null;
  clone.ownerName = null;
  clone.bancoOrigemId = template.id;
  destino.push(clone);
  saveCampaignPlayersNow(destino);
  // Se já tiver um combate em andamento nesta campanha, o NPC chamado entra
  // direto na ordem de Iniciativa (já classificado Aliado/Inimigo), sem
  // precisar esperar a próxima ação do Narrador pra sincronizar.
  if (combatAtivo && !INITIATIVE.some(e => e.tipo === 'npc' && e.playerId === clone.id)) {
    INITIATIVE.push({ id: 'init_npc_' + clone.id, tipo: 'npc', playerId: clone.id, name: clone.name, roll: null });
    saveCampaignInitiativeNow(INITIATIVE);
  }
  if (!bankModeActive) { PLAYERS = destino; saveState(); renderAll(); }
  alert(`"${clone.name}" foi chamado para esta campanha! Veja na aba "NPCs".`);
}

function switchNarTab(tab) {
  narActiveTab = tab;
  const jogView = document.getElementById('nar-view-jogadores');
  const npcView = document.getElementById('nar-view-npcs');
  if (jogView) jogView.style.display = tab === 'jogadores' ? '' : 'none';
  if (npcView) npcView.style.display = tab === 'npcs' ? '' : 'none';
  document.querySelectorAll('.nar-tab').forEach(el => el.classList.remove('active'));
  const btn = document.getElementById('nar-tab-' + tab);
  if (btn) btn.classList.add('active');
  const btnNovoNpc = document.getElementById('nar-btn-novo-npc');
  if (btnNovoNpc) btnNovoNpc.style.display = tab === 'npcs' ? '' : 'none';
}

// Cada personagem tem seu próprio objeto de notas: { geral:'', missão:'', ... }
// Armazenado em p.jogNotas e sincronizado via Firebase junto com o restante.
function getJogNotas(p) {
  if (p.jogNotas && typeof p.jogNotas === 'object') return p.jogNotas;
  const init = {};
  JOG_NOTA_TAGS.forEach(t => { init[t.toLowerCase()] = ''; });
  return init;
}

// Tag ativa por personagem (estado local, não sincroniza)
let jogNotaActiveTag = {};  // { [pid]: 'geral' }

function renderJogNotas() {
  const container = document.getElementById('jog-notas-content');
  const psel      = document.getElementById('psel');
  if (!container || !psel) return;

  const myPlayers = getMyPlayers();
  if (!myPlayers || myPlayers.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3)">Nenhum personagem disponível.</div>';
    return;
  }

  const pid = parseInt(psel.value) || myPlayers[0].id;
  const p   = myPlayers.find(x => x.id === pid) || myPlayers[0];
  if (!p.jogNotas || typeof p.jogNotas !== 'object') {
    p.jogNotas = {};
    JOG_NOTA_TAGS.forEach(t => { p.jogNotas[t.toLowerCase()] = ''; });
  }

  if (!jogNotaActiveTag[p.id]) jogNotaActiveTag[p.id] = 'geral';
  const activeTag = jogNotaActiveTag[p.id];

  const tagsHtml = JOG_NOTA_TAGS.map(t =>
    `<button class="jog-nota-tag ${t.toLowerCase() === activeTag ? 'on' : ''}"
       onclick="switchJogNota(${p.id}, '${t.toLowerCase()}')">${t}</button>`
  ).join('');

  const wordCount = (p.jogNotas[activeTag] || '').trim().split(/\s+/).filter(Boolean).length;

  container.innerHTML = `
    <div class="jog-notas-wrap">
      <div class="jog-notas-header">
        <div class="jog-notas-title">
          <i class="ti ti-notebook" style="color:var(--accent2)"></i>
          Anotações de <strong>${p.name}</strong>
        </div>
        <div class="jog-nota-wordcount">${wordCount} palavra${wordCount !== 1 ? 's' : ''}</div>
      </div>
      <div class="jog-nota-tags">${tagsHtml}</div>
      <textarea
        class="jog-nota-area"
        id="jog-nota-textarea"
        placeholder="Escreva suas anotações aqui…"
        oninput="saveJogNota(${p.id}, '${activeTag}', this.value)"
      >${p.jogNotas[activeTag] || ''}</textarea>
    </div>`;
}

function switchJogNota(pid, tag) {
  jogNotaActiveTag[pid] = tag;
  renderJogNotas();
  // Foca o textarea e move cursor pro fim
  setTimeout(() => {
    const ta = document.getElementById('jog-nota-textarea');
    if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  }, 30);
}

function saveJogNota(pid, tag, value) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  if (!p.jogNotas || typeof p.jogNotas !== 'object') {
    p.jogNotas = {};
    JOG_NOTA_TAGS.forEach(t => { p.jogNotas[t.toLowerCase()] = ''; });
  }
  p.jogNotas[tag] = value;
  // Atualiza contador de palavras sem re-renderizar o textarea (evita perder foco/cursor)
  const wc = document.querySelector('.jog-nota-wordcount');
  if (wc) {
    const n = value.trim().split(/\s+/).filter(Boolean).length;
    wc.textContent = n + ' palavra' + (n !== 1 ? 's' : '');
  }
  saveState();
}
const INV_PESO_LABEL = { leve:'Leve', media:'Média', pesada:'Pesada', exotica:'Exótica', mega:'Mega Pesada', encantada:'Encantada' };
const INV_PESO_COLOR = { leve:'var(--blue)', media:'var(--green)', pesada:'var(--red)', exotica:'var(--green-dim)', mega:'#8b1f1f', encantada:'#3a5fc0' };
const INV_PESO_BG    = { leve:'var(--blue-bg)', media:'var(--green-bg)', pesada:'var(--red-bg)', exotica:'var(--green-bg)', mega:'rgba(139,31,31,0.12)', encantada:'rgba(20,32,74,0.55)' };
const INV_PESO_BD    = { leve:'var(--blue-bd)', media:'var(--green-bd)', pesada:'var(--red-bd)', exotica:'var(--green-bd)', mega:'rgba(139,31,31,0.4)', encantada:'rgba(58,95,192,0.5)' };
const INV_ALCANCE_LABEL = { curto: 'Curto Alcance', longo: 'Longo Alcance', ambos: 'Curto e Longo Alcance' };

// "Sem Arma": pseudo-arma sempre disponível na lista de Armas/Instrumentos,
// além das que o personagem tem cadastradas — representa lutar desarmado
// (armas guardadas): 1 de Dano fixo + Maestria de Força (mesma maestria de
// armas Pesadas). Em Acerto Crítico, a Maestria de Força entra em dobro no
// Dano (ver construirRolagemDanoArma) — não dobra dado, já que a base "1"
// não tem dado pra dobrar. Nunca é salva dentro de p.inventario (é recriada
// a cada chamada), então critPendente é lido/gravado direto em
// p.semArmaCritPendente via getter/setter, pra continuar funcionando com o
// mesmo mecanismo de rolarAcertoArma/rolarDanoArma usado por qualquer outra
// arma real.
function criarSemArmaItem(p) {
  return {
    id: 'sem_arma',
    name: 'Sem Arma',
    tipo: 'arma',
    peso: 'pesada',
    dano: '1',
    alcance: 'curto',
    get critPendente() { return !!p.semArmaCritPendente; },
    set critPendente(v) { p.semArmaCritPendente = v; },
  };
}
// Resolve uma Arma/Instrumento pelo id, incluindo o pseudo-id 'sem_arma' —
// usado por rolarDanoArma/rolarAcertoArma no lugar da busca direta em
// p.inventario, já que 'sem_arma' nunca está lá.
function resolverArmaOuInstrumento(p, itemId) {
  if (itemId === 'sem_arma') return criarSemArmaItem(p);
  return (p.inventario || []).find(i => i.id === itemId);
}

function renderInventarioArea(p, readOnly) {
  const inv = Array.isArray(p.inventario) ? p.inventario : [];
  const armas     = inv.filter(i => i.tipo === 'arma' || i.tipo === 'instrumento');
  // "Sem Arma" aparece sempre no fim da lista, mesmo com outras Armas/
  // Instrumentos cadastrados — representa o personagem guardando as armas e
  // lutando desarmado, uma opção sempre disponível, não só quando o
  // Inventário de Armas está vazio.
  const armasExibir = armas.concat([criarSemArmaItem(p)]);
  const protecoes = inv.filter(i => i.tipo === 'protecao');
  const itens     = inv.filter(i => i.tipo === 'item');

  function pesoTag(item) {
    if (!item.peso) return '';
    return `<span class="inv-peso-tag" style="color:${INV_PESO_COLOR[item.peso]};background:${INV_PESO_BG[item.peso]};border-color:${INV_PESO_BD[item.peso]}">${INV_PESO_LABEL[item.peso]}</span>`;
  }

  function alcanceTag(item) {
    if (!item.alcance) return '';
    if (item.alcance === 'ambos') {
      return `<span class="inv-peso-tag" style="color:var(--text3);background:var(--bg3);border-color:var(--border)">${INV_ALCANCE_LABEL.curto}</span><span class="inv-peso-tag" style="color:var(--teal);background:var(--teal-bg);border-color:var(--teal-bd)">${INV_ALCANCE_LABEL.longo}</span>`;
    }
    const isLongo = item.alcance === 'longo';
    return `<span class="inv-peso-tag" style="color:${isLongo?'var(--teal)':'var(--text3)'};background:${isLongo?'var(--teal-bg)':'var(--bg3)'};border-color:${isLongo?'var(--teal-bd)':'var(--border)'}">${INV_ALCANCE_LABEL[item.alcance]}</span>`;
  }

  // Tag puramente informativa (sem efeito de regra por enquanto) pra marcar
  // Armas/Instrumentos que se usam com as duas mãos.
  function duasMaosTag(item) {
    if (!item.duasMaos) return '';
    return `<span class="inv-peso-tag" style="color:var(--text2);background:var(--bg3);border-color:var(--border)">🤲 Duas Mãos</span>`;
  }

  function municaoRow(item) {
    // Usa cristais se: item exótico por peso, OU item com aprimoramento exótico (não-Dourado)
    const temAprimoExotico = Array.isArray(item.aprimoramentos) && item.aprimoramentos.length > 0
      && !item.aprimoramentos.every(a => (a.dourado || a.name === 'Dourado'));
    const usaCristal = item.peso === 'exotica' || temAprimoExotico;
    const temMunicaoPropria = (item.usos || []).some(u => u.custoRecarga);
    const semMunicaoForcado = (item.usos || []).some(u => u.semMunicao)
      || item.name === 'Grimório do Conhecimento' || item.name === 'Varinha';
    const isLongoAlcance = item.alcance === 'longo' && !temMunicaoPropria && !semMunicaoForcado;
    const precisaMunicao = isLongoAlcance || usaCristal;
    if (!precisaMunicao) return '';

    // Arma/instrumento exótico de longo alcance: mostra cristais E munição
    if (usaCristal && isLongoAlcance && item.peso === 'exotica') {
      return `<div class="inv-municao-row">
        <span class="inv-municao-lbl"><i class="ti ti-diamond" style="color:var(--accent2)"></i> Cristais <span style="font-size:10px;color:var(--text3)">(compartilhados)</span></span>
        <div class="inv-municao-ctrl">
          <button onclick="adjCristais(${p.id},-1)">−</button>
          <span class="inv-municao-val">${p.cristais || 0}</span>
          <button onclick="adjCristais(${p.id},+1)">+</button>
        </div>
      </div>
      <div class="inv-municao-row">
        <span class="inv-municao-lbl"><i class="ti ti-target-arrow" style="color:var(--teal)"></i> Munição</span>
        <div class="inv-municao-ctrl">
          <button onclick="adjInvMunicao(${p.id},'${item.id}',-1)">−</button>
          <span class="inv-municao-val">${item.municao || 0}</span>
          <button onclick="adjInvMunicao(${p.id},'${item.id}',+1)">+</button>
        </div>
      </div>`;
    }

    if (usaCristal) {
      // Cristais são do personagem, compartilhados entre todos os itens exóticos
      return `<div class="inv-municao-row">
        <span class="inv-municao-lbl"><i class="ti ti-diamond" style="color:var(--accent2)"></i> Cristais <span style="font-size:10px;color:var(--text3)">(compartilhados)</span></span>
        <div class="inv-municao-ctrl">
          <button onclick="adjCristais(${p.id},-1)">−</button>
          <span class="inv-municao-val">${p.cristais || 0}</span>
          <button onclick="adjCristais(${p.id},+1)">+</button>
        </div>
      </div>`;
    }
    return `<div class="inv-municao-row">
      <span class="inv-municao-lbl"><i class="ti ti-target-arrow" style="color:var(--teal)"></i> Munição</span>
      <div class="inv-municao-ctrl">
        <button onclick="adjInvMunicao(${p.id},'${item.id}',-1)">−</button>
        <span class="inv-municao-val">${item.municao || 0}</span>
        <button onclick="adjInvMunicao(${p.id},'${item.id}',+1)">+</button>
      </div>
    </div>`;
  }

  // Box de escolha de Feitiço — usado por itens com um "uso" marcado como
  // grimorioFeitico (ver Grimório do Conhecimento). O Feitiço escolhido é
  // guardado em item.feiticoEscolhidoId e é só informativo aqui: "lançá-lo"
  // consome o uso "Usar (1x/luta)" do próprio item, sem tocar em nenhuma
  // Habilidade do personagem.
  function grimorioFeiticoBox(item) {
    const escolhido = item.feiticoEscolhidoId ? getTodosFeiticosBanco().find(f => f.id === item.feiticoEscolhidoId) : null;
    return `<div class="inv-sub-section">
      <div class="inv-sub-label"><i class="ti ti-book-2" style="color:var(--accent2)"></i> Feitiço Escolhido</div>
      ${escolhido
        ? `<div class="inv-aprimo-item"><span class="inv-aprimo-name">${escHtml(escolhido.name)} <span style="font-size:10px;color:var(--text3);font-weight:400">(${escHtml(escolhido.subclasse)})</span></span><span class="inv-aprimo-desc">${escHtml(escolhido.desc)}</span></div>`
        : `<div style="font-size:11.5px;color:var(--text3);margin-top:4px">Nenhum Feitiço escolhido ainda.</div>`}
      <button onclick="abrirGrimorioModal(${p.id},'${item.id}')" style="margin-top:8px;background:var(--bg3);border:1px solid var(--border);color:var(--text2);border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer">${escolhido ? 'Trocar Feitiço' : 'Escolher Feitiço'}</button>
    </div>`;
  }

  function renderArmaCard(item) {
    const isInstrumento = item.tipo === 'instrumento';
    // Badge de Equipado/Guardado — mesmo estilo do badge de Proteção
    // (inv-equip-badge). "Sem Arma" é sempre a opção equipada quando
    // nenhuma Arma/Instrumento real está com equipado:true; seu badge só é
    // clicável quando NÃO é a opção ativa (clique guarda o resto — ver
    // equiparSemArma). Itens reais funcionam igual a Armadura/Elmo.
    const semArmaAtiva = !(p.inventario || []).some(i => (i.tipo === 'arma' || i.tipo === 'instrumento') && i.equipado);
    const equipBadge = item.id === 'sem_arma'
      ? (semArmaAtiva
          ? `<span class="inv-equip-badge inv-equip-on" title="Lutando desarmado — nenhuma Arma/Instrumento equipado"><i class="ti ti-check"></i> Equipado</span>`
          : `<span class="inv-equip-badge inv-equip-off" onclick="equiparSemArma(${p.id})" title="Guardado — clique para lutar desarmado">Guardado</span>`)
      : (item.equipado
          ? `<span class="inv-equip-badge inv-equip-on" onclick="toggleEquipArma(${p.id},'${item.id}')" title="Equipado — clique para guardar"><i class="ti ti-check"></i> Equipado</span>`
          : `<span class="inv-equip-badge inv-equip-off" onclick="toggleEquipArma(${p.id},'${item.id}')" title="Guardado — clique para equipar">Guardado</span>`);
    // Badge da "mão secundária" (Talento Inferior "Ambidestro") — só pra
    // Armas/Instrumentos de uma mão só (!duasMaos), fora "Sem Arma", e só
    // pra quem tem o Talento. Independente do slot principal (equipBadge).
    const offhandBadge = (item.id !== 'sem_arma' && !item.duasMaos && temAmbidestro(p))
      ? (item.equipadoSecundaria
          ? `<span class="inv-equip-badge inv-equip-on" onclick="toggleEquipArmaSecundaria(${p.id},'${item.id}')" title="Mão secundária (Ambidestro) — clique para guardar"><i class="ti ti-check"></i> 🤝 Mão Secundária</span>`
          : `<span class="inv-equip-badge inv-equip-off" onclick="toggleEquipArmaSecundaria(${p.id},'${item.id}')" title="Equipar na mão secundária (Ambidestro)">🤝 Mão Secundária</span>`)
      : '';
    const aprimoramentos = item.aprimoramentos && item.aprimoramentos.length
      ? `<div class="inv-sub-section"><div class="inv-sub-label"><i class="ti ti-sparkles"></i> Aprimoramentos</div>${item.aprimoramentos.map(a=>{
          const isDourado = a.dourado || a.name === 'Dourado';
          const isAprimoramentoExotico = a.catalogId && typeof APRIMORAMENTOS_ARMA !== 'undefined' && APRIMORAMENTOS_ARMA.some(x => x.id === a.catalogId);
          if (isAprimoramentoExotico) {
            const isEncantamento = a.catalogId === 'encantamento';
            const nomeExibido = isEncantamento && a.habilidadeNome ? `✨ ${a.habilidadeNome}` : a.name;
            const descExibida = isEncantamento && a.habilidadeDesc ? a.habilidadeDesc : a.desc;
            const subTag = isEncantamento && a.habilidadeSubclasse ? `<span class="sk-tag">${a.habilidadeSubclasse}</span>` : '';
            const semEscolha = isEncantamento && !a.habilidadeId;
            const podeUsar = (p.cristais || 0) > 0 && !semEscolha;
            return `<div class="skill-card sk-gray" style="margin:6px 0">
              <div class="sk-name">${nomeExibido}</div>
              <div class="sk-tags"><span class="sk-tag">💎 Consome 1 Cristal</span>${subTag}</div>
              ${descExibida ? `<div style="font-size:11px;color:var(--text2);margin:8px 0 6px;line-height:1.5">${descExibida}</div>` : ''}
              ${semEscolha ? `<div style="font-size:11px;color:var(--text3);margin-bottom:6px">⚠ Nenhum Feitiço escolhido ainda — edite a arma pra escolher.</div>` : ''}
              <div class="sk-bottom">
                <button class="sk-btn" onclick="usarAprimoramentoArma(${p.id})" ${!podeUsar ? 'disabled' : ''}>Usar</button>
              </div>
            </div>`;
          }
          const label = isDourado ? (a.dourado ? (a.name || 'Aprimoramento Dourado') : 'Dourado') : a.name;
          return `<div class="inv-aprimo-item"><span class="inv-aprimo-name"${isDourado?' style="color:#e8c53a"':''}>${isDourado?'✨ ':''}${label}</span>${a.desc?`<span class="inv-aprimo-desc">${a.desc}</span>`:''}</div>`;
        }).join('')}</div>` : '';
    const ativas = (item.ativas && item.ativas.length)
      ? `<div class="inv-sub-section"><div class="inv-sub-label"><i class="ti ti-bolt"></i> Liberar Vileza</div>${item.ativas.map((a, ai) => {
          const usosMax = a.usosMax || 2;
          const usosAtuais = a.usosAtuais != null ? a.usosAtuais : usosMax;
          const spent = usosMax - usosAtuais;
          const pronto = usosAtuais > 0;
          const dots = Array.from({length: usosMax}, (_, di) => `<div class="sdot ${di < spent ? 'spent' : ''}"></div>`).join('');
          return `<div class="skill-card sk-gray ${pronto ? 'ready' : 'exhausted'}" style="margin:6px 0">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div class="sk-name">${a.name}</div>
              <button onclick="event.stopPropagation();resetAtiva(${p.id},'${item.id}',${ai})" title="Restaurar usos" style="background:none;border:none;color:var(--text3);cursor:pointer;padding:0"><i class="ti ti-refresh" style="font-size:15px"></i></button>
            </div>
            <div class="sk-tags"><span class="sk-tag">${ESCOPO_USO_ARMA_LABEL[a.escopo || 'luta']}</span></div>
            ${a.desc ? `<div style="font-size:11px;color:var(--text2);margin:8px 0 6px;line-height:1.5">${a.desc}</div>` : ''}
            <div class="sk-bottom">
              <button class="sk-btn" onclick="usarAtiva(${p.id},'${item.id}',${ai})" ${!pronto?'disabled':''}>Usar</button>
              <div class="sk-dots">${dots}</div>
            </div>
          </div>`;
        }).join('')}</div>`
      : '';
    const icone = isInstrumento
      ? `<i class="ti ti-music" style="color:#e8a838"></i>`
      : `<i class="ti ti-sword" style="color:var(--red)"></i>`;

    // ── Bônus de maestria por peso da arma ──────────────────────────────────
    // Leve → INT; Média → AGI; Pesada → FOR; Exótica → piso(AGI/2); Mega Pesada → piso(FOR/2)
    function armaMaestriaBonus(peso) { return getArmaMaestriaBonus(p, peso); }
    function statsRow(peso) {
      const mb = armaMaestriaBonus(peso);
      const bonus = mb && mb.val > 0
        ? `<span style="font-size:11px;color:${mb.color};margin-left:2px" title="Bônus de Maestria de ${mb.attr}">+${mb.val} <span style="font-size:10px;opacity:.8">${mb.attr}</span></span>`
        : (mb && mb.val === 0 ? `<span style="font-size:10px;color:var(--text3);margin-left:2px" title="Maestria de ${mb.attr} ainda é 0">+0 <span style="opacity:.7">${mb.attr}</span></span>` : '');
      const afiacaoBonus = temAfiacaoAprimorada(item) ? `<span style="font-size:11px;color:#e8c53a;margin-left:2px" title="Aprimoramento Dourado: Afiação Aprimorada">+1d6 <span style="font-size:10px;opacity:.8">✨</span></span>` : '';
      const profundezasVal = (p.origemProfundezasBonus && p.origemProfundezasBonus[item.name]) || 0;
      const profundezasBonus = profundezasVal > 0
        ? `<span style="font-size:11px;color:#8ab8e8;margin-left:2px" title="Origem das Profundezas">+${profundezasVal} <span style="font-size:10px;opacity:.8">Profundezas</span></span>`
        : '';
      const danoPart = item.dano ? `<div class="inv-stat"><span class="inv-dano-label">Dano</span><span class="inv-dano-val">${item.dano}</span>${bonus}${afiacaoBonus}${profundezasBonus}</div>` : '';
      const precoPart = item.preco != null ? `<div class="inv-stat"><span class="inv-dano-label">💰 Preço</span><span class="inv-dano-val" style="color:var(--amber)">${item.preco}</span></div>` : '';
      const acertoPart = !item.dano ? `<div class="inv-stat"><span class="inv-dano-label">Acerto</span>${bonus}</div>` : '';
      const critBadge = item.critPendente
        ? `<div style="font-size:11px;color:#e8c53a;margin-top:2px" title="Próxima rolagem de Dano desta Arma sai com os dados dobrados">🎯 Crítico! Próximo Dano dobrado</div>`
        : '';
      return `<div class="inv-stats-row">${danoPart}${acertoPart}${precoPart}</div>${critBadge}`;
    }
    const encantamentoBox = item.encantamento
      ? `<div class="inv-sub-section"><div class="inv-sub-label"><i class="ti ti-sparkles" style="color:var(--accent2)"></i> Encantamento: ${item.encantamento.name} <span style="font-size:10px;color:var(--text3);font-weight:400">(${item.encantamento.estilo === 'arcano' ? 'Arcano' : 'Místico'})</span></div><div class="inv-aprimo-item"><span class="inv-aprimo-desc">${item.encantamento.passivaDesc}</span></div><div style="font-size:10px;color:var(--text3);margin-top:4px">O Feitiço/Ritual concedido aparece nas Habilidades.</div></div>`
      : '';
    const usosBox = construirUsosBoxHtml(item, p);
    const grimorioBox = (item.usos || []).some(u => u.grimorioFeitico) ? grimorioFeiticoBox(item) : '';
    const vidaBox = (item.vidaMax != null && item.vidaMax > 0)
      ? (() => {
          const vidaMax = item.vidaMax;
          const vidaAtual = item.vidaAtual != null ? item.vidaAtual : vidaMax;
          const quebrado = vidaAtual <= 0;
          return `<div class="inv-sub-section">
            <div class="inv-sub-label"><i class="ti ti-heart" style="color:${quebrado ? 'var(--red)' : 'var(--accent2)'}"></i> Vida do Item ${quebrado ? '<span style="color:var(--red);font-weight:600">(Quebrado)</span>' : ''}</div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
              <button onclick="ajustarVidaItem(${p.id},'${item.id}',-1)" style="background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;width:26px;height:26px;cursor:pointer">−</button>
              <span style="font-size:13px;font-weight:600;min-width:50px;text-align:center">${vidaAtual} / ${vidaMax}</span>
              <button onclick="ajustarVidaItem(${p.id},'${item.id}',1)" style="background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;width:26px;height:26px;cursor:pointer">+</button>
              <button onclick="ajustarVidaItem(${p.id},'${item.id}','max')" title="Restaurar" style="background:none;border:none;color:var(--text3);cursor:pointer;margin-left:4px"><i class="ti ti-refresh" style="font-size:15px"></i></button>
            </div>
          </div>`;
        })()
      : '';

    if (isInstrumento) {
      // Instrumentos: título + botão editar na primeira linha; tags na segunda
      return `<div class="inv-card">
        <div class="inv-card-header" style="flex-wrap:nowrap;align-items:center">
          <div class="inv-card-title">${icone} ${item.name}</div>
          ${(readOnly || item.id === 'sem_arma') ? '' : `<button onclick="editInvItem(${p.id},'${item.id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;padding:2px;flex-shrink:0"><i class="ti ti-edit" style="font-size:15px"></i></button>`}
        </div>
        <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:5px">
          <span class="inv-peso-tag" style="color:#e8a838;background:rgba(232,168,56,0.12);border-color:rgba(232,168,56,0.3)">🎵 Instrumento</span>
          ${equipBadge}
          ${offhandBadge}
          ${alcanceTag(item)}
          ${pesoTag(item)}
          ${duasMaosTag(item)}
        </div>
        ${statsRow(item.peso)}
        ${item.efeito ? `<div class="inv-desc">${item.efeito}</div>` : ''}
        ${municaoRow(item)}
        ${readOnly ? `<details class="inv-details-compact"><summary>Detalhes</summary>${grimorioBox}${aprimoramentos}${ativas}${encantamentoBox}${usosBox}${vidaBox}</details>` : `${grimorioBox}${aprimoramentos}${ativas}${encantamentoBox}${usosBox}${vidaBox}`}
      </div>`;
    }

    return `<div class="inv-card">
      <div class="inv-card-header" style="flex-wrap:nowrap;align-items:center">
        <div class="inv-card-title">${icone} ${item.name}</div>
        ${(readOnly || item.id === 'sem_arma') ? '' : `<button onclick="editInvItem(${p.id},'${item.id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;padding:2px;flex-shrink:0"><i class="ti ti-edit" style="font-size:15px"></i></button>`}
      </div>
      <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:5px">
        ${equipBadge}
        ${offhandBadge}
        ${alcanceTag(item)}
        ${pesoTag(item)}
        ${duasMaosTag(item)}
      </div>
      ${statsRow(item.peso)}
      ${item.efeito ? `<div class="inv-desc">${item.efeito}</div>` : ''}
      ${municaoRow(item)}
      ${readOnly ? `<details class="inv-details-compact"><summary>Detalhes</summary>${grimorioBox}${aprimoramentos}${ativas}${encantamentoBox}${usosBox}${vidaBox}</details>` : `${grimorioBox}${aprimoramentos}${ativas}${encantamentoBox}${usosBox}${vidaBox}`}
    </div>`;
  }

  function renderProtecaoCard(item) {
    const isElmo = item.subtipo === 'elmo';
    const icone = isElmo ? 'ti-helmet' : 'ti-shield';
    const cor   = isElmo ? 'var(--teal)' : 'var(--amber)';
    const valLabel = isElmo ? 'Elmo' : 'Armadura';
    const equipBadge = item.equipado
      ? `<span class="inv-equip-badge inv-equip-on" onclick="toggleEquipProt(${p.id},'${item.id}')" title="Equipado — clique para guardar"><i class="ti ti-check"></i> Equipado</span>`
      : `<span class="inv-equip-badge inv-equip-off" onclick="toggleEquipProt(${p.id},'${item.id}')" title="Guardado — clique para equipar">Guardado</span>`;
    return `<div class="inv-card">
      <div class="inv-card-header" style="flex-wrap:nowrap;align-items:center">
        <div class="inv-card-title"><i class="ti ${icone}" style="color:${cor}"></i> ${item.name}</div>
        ${readOnly ? '' : `<button onclick="editInvItem(${p.id},'${item.id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;padding:2px;flex-shrink:0"><i class="ti ti-edit" style="font-size:15px"></i></button>`}
      </div>
      <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:5px">
        ${equipBadge}
        ${pesoTag(item)}
      </div>
      ${item.valor != null ? `<div class="inv-dano"><span class="inv-dano-label">${valLabel}</span><span class="inv-dano-val">${item.valor}</span></div>` : ''}
      ${item.preco != null ? `<div class="inv-dano"><span class="inv-dano-label">💰 Preço</span><span class="inv-dano-val">${item.preco}</span></div>` : ''}
      ${item.efeito ? `<div class="inv-desc">${item.efeito}</div>` : ''}
      ${municaoRow(item)}
      ${(() => {
        const aprimoramentosProt = item.aprimoramentos && item.aprimoramentos.length ? `<div class="inv-sub-section"><div class="inv-sub-label"><i class="ti ti-sparkles"></i> Aprimoramentos</div>${item.aprimoramentos.map(a=>{
            const isDourado = a.dourado || a.name === 'Dourado';
            const label = isDourado ? (a.dourado ? (a.name || 'Aprimoramento Dourado') : 'Dourado') : a.name;
            return `<div class="inv-aprimo-item"><span class="inv-aprimo-name"${isDourado?' style="color:#e8c53a"':''}>${isDourado?'✨ ':''}${label}</span>${a.desc?`<span class="inv-aprimo-desc">${a.desc}</span>`:''}</div>`;
          }).join('')}</div>` : '';
        const encantamentoProt = item.encantamento ? `<div class="inv-sub-section"><div class="inv-sub-label"><i class="ti ti-sparkles" style="color:var(--accent2)"></i> Encantamento: ${item.encantamento.name} <span style="font-size:10px;color:var(--text3);font-weight:400">(${item.encantamento.estilo === 'arcano' ? 'Arcano' : 'Místico'})</span></div><div class="inv-aprimo-item"><span class="inv-aprimo-desc">${item.encantamento.passivaDesc}</span></div><div style="font-size:10px;color:var(--text3);margin-top:4px">O Feitiço/Ritual concedido aparece nas Habilidades.</div></div>` : '';
        const usosProt = construirUsosBoxHtml(item, p);
        return readOnly
          ? `<details class="inv-details-compact"><summary>Detalhes</summary>${aprimoramentosProt}${encantamentoProt}${usosProt}</details>`
          : `${aprimoramentosProt}${encantamentoProt}${usosProt}`;
      })()}
    </div>`;
  }

  function renderItemCard(item) {
    return `<div class="inv-card inv-card-item">
      <div class="inv-card-header">
        <div class="inv-card-title"><i class="ti ti-package" style="color:var(--text3)"></i> ${item.name}</div>
        <div style="display:flex;align-items:center;gap:6px">
          ${item.qtd != null && item.qtd !== '' ? `<span class="inv-qtd">×${item.qtd}</span>` : ''}
          ${readOnly ? '' : `<button onclick="editInvItem(${p.id},'${item.id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;padding:2px"><i class="ti ti-edit" style="font-size:15px"></i></button>`}
        </div>
      </div>
      ${item.efeito ? `<div class="inv-desc">${item.efeito}</div>` : ''}
    </div>`;
  }

  function invSection(key, label, icon, color, items, renderFn) {
    const estado = jogInvCollapsed[p.id] || (jogInvCollapsed[p.id] = { armas: true, protecoes: true, itens: true });
    const col = estado[key];
    const badge = col ? `<span class="gt-ready-badge" style="color:${color};background:transparent;border-color:${color}40">${items.length} item${items.length!==1?'s':''}</span>` : '';
    return `
      <div class="group-title group-title-toggle" onclick="toggleInvSection(${p.id},'${key}')">
        <span class="gt-dot" style="background:${color}"></span>${label}
        <span class="gt-collapse-info">${badge}</span>
        <i class="ti ${col?'ti-chevron-down':'ti-chevron-up'} gt-chevron"></i>
      </div>
      ${col ? '' : `<div class="inv-grid">${items.length ? items.map(renderFn).join('') : `<div class="inv-empty">Nenhum item cadastrado.</div>`}</div>`}`;
  }

  return `<div class="inv-area${readOnly ? ' inv-area-compact' : ''}">
    <div class="inv-header">
      <i class="ti ti-backpack" style="color:var(--accent2)"></i>
      <span>Inventário</span>
      ${readOnly ? '' : `<button class="btn btn-success inv-add-btn" onclick="openInvModal(${p.id})"><i class="ti ti-plus"></i> Adicionar</button>`}
    </div>
    ${invSection('armas',     '⚔️ Armas',    'ti-sword',   'var(--red)',    armasExibir, renderArmaCard)}
    ${invSection('protecoes', '🛡 Proteções', 'ti-shield',  'var(--amber)',  protecoes, renderProtecaoCard)}
    ${invSection('itens',     '📦 Itens',     'ti-package', 'var(--text3)', itens,     renderItemCard)}
  </div>`;
}

function toggleInvSection(pid, key) {
  const estado = jogInvCollapsed[pid] || (jogInvCollapsed[pid] = { armas: true, protecoes: true, itens: true });
  estado[key] = !estado[key];
  renderAll();
}

// Ajusta a munição (ou cristais, no caso de itens exóticos) de uma arma/instrumento
// diretamente pelo card, sem precisar abrir o modal de edição.
function adjInvMunicao(pid, itemId, d) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  const item = (p.inventario || []).find(x => x.id === itemId);
  if (!item) return;
  item.municao = Math.max(0, (item.municao || 0) + d);
  saveState();
  renderAll();
}

// Equipa/desequipa uma peça de proteção direto pelo card (sem abrir o modal).
// Só pode haver 1 armadura e 1 elmo equipados por vez por personagem.
function toggleEquipProt(pid, itemId) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  const item = (p.inventario || []).find(x => x.id === itemId);
  if (!item) return;
  const novoEstado = !item.equipado;
  if (novoEstado) {
    p.inventario.forEach(it => {
      if (it.tipo === 'protecao' && it.subtipo === item.subtipo && it.id !== item.id) it.equipado = false;
    });
  }
  item.equipado = novoEstado;
  recomputeProtMax(p);
  saveState();
  renderAll();
}

// Equipa/desequipa uma Arma/Instrumento direto pelo card (sem abrir o
// modal) — mesmo mecanismo do toggleEquipProt acima. Arma e Instrumento
// contam como o mesmo "slot de mão": só pode haver 1 equipado por vez entre
// os dois tipos: equipar um guarda automaticamente qualquer outro Arma/
// Instrumento. "Sem Arma" (ver criarSemArmaItem) não tem card próprio pra
// isso — ela é sempre a opção quando nada mais está equipado, então não
// precisa de estado salvo.
// Em Luta, trocar de Arma/Instrumento equipado exige ter usado a Habilidade
// Geral "Arsenal" antes (marca p.arsenalPendente, ligada em useSkill).
// Fora de Luta a troca continua livre. Retorna true se a troca pode
// prosseguir (e já consome a marca); false bloqueia com um aviso.
function _podeTrocarArmaEquipada(p) {
  if (!combatAtivo) return true;
  if (!p.arsenalPendente) {
    alert('Em Luta, é preciso usar a Habilidade "Arsenal" antes de trocar de Arma.');
    return false;
  }
  p.arsenalPendente = false;
  return true;
}

function toggleEquipArma(pid, itemId) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  const item = (p.inventario || []).find(x => x.id === itemId);
  if (!item) return;
  if (!_podeTrocarArmaEquipada(p)) return;
  const novoEstado = !item.equipado;
  if (novoEstado) {
    p.inventario.forEach(it => {
      if ((it.tipo === 'arma' || it.tipo === 'instrumento') && it.id !== item.id) it.equipado = false;
    });
    // Um item não pode estar na mão principal E na secundária ao mesmo tempo.
    item.equipadoSecundaria = false;
  }
  item.equipado = novoEstado;
  saveState();
  renderAll();
}

// Retorna a Arma/Instrumento equipado na "mão secundária" (Talento Inferior
// "Ambidestro"), se houver.
function getArmaSecundariaEquipada(p) {
  return (p.inventario || []).find(it => (it.tipo === 'arma' || it.tipo === 'instrumento') && it.equipadoSecundaria);
}

// Equipa/desequipa uma Arma/Instrumento de uma mão só na "mão secundária" —
// só disponível com o Talento Inferior "Ambidestro" (temAmbidestro) e só
// pra itens que não exigem as duas mãos (!item.duasMaos). Independente do
// slot principal (item.equipado): um item nunca fica nos dois slots ao
// mesmo tempo (ver toggleEquipArma). Só 1 item por vez na mão secundária —
// equipar outro guarda o anterior, mesmo padrão de toggleEquipArma/
// toggleEquipProt. Sujeito à mesma trava de troca em Luta (Arsenal).
function toggleEquipArmaSecundaria(pid, itemId) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  const item = (p.inventario || []).find(x => x.id === itemId);
  if (!item || item.duasMaos) return;
  if (!temAmbidestro(p)) return;
  if (!_podeTrocarArmaEquipada(p)) return;
  const novoEstado = !item.equipadoSecundaria;
  if (novoEstado) {
    p.inventario.forEach(it => {
      if ((it.tipo === 'arma' || it.tipo === 'instrumento') && it.id !== item.id) it.equipadoSecundaria = false;
    });
    item.equipado = false;
  }
  item.equipadoSecundaria = novoEstado;
  saveState();
  renderAll();
}

// Retorna a Arma/Instrumento equipado na mão principal, ou a pseudo-arma
// "Sem Arma" se nenhum estiver equipado — usado pelas Habilidades Gerais
// "Ataque com Arma"/"Ataque com 2 Armas" (ver rolarAcertoAtaqueGeral/
// useSkill), que sempre agem sobre o que está equipado no momento, sem
// precisar apontar pra um item específico.
function getArmaEquipadaPrincipal(p) {
  const eq = (p.inventario || []).find(it => (it.tipo === 'arma' || it.tipo === 'instrumento') && it.equipado);
  return eq || criarSemArmaItem(p);
}

// Rola o Acerto das Habilidades Gerais "Ataque com Arma"/"Ataque com 2
// Armas" — sempre sobre a Arma/Instrumento equipado na mão principal (ver
// getArmaEquipadaPrincipal), publicado com o nome da própria Habilidade em
// vez de "Rolagem de Acerto — <item>". "Ataque com 2 Armas" sempre força a
// Maestria pela metade (ver construirRolagemAcertoArma/opts.forcarAmbidestro)
// — se não houver uma 2ª Arma na mão secundária, avisa em vez de rolar
// (Talento Inferior "Ambidestro").
function rolarAcertoAtaqueGeral(pid, skid) {
  const p = PLAYERS.find(x => x.id === pid);
  const sk = p && p.skills.find(s => s.id === skid);
  if (!p || !sk) return;
  const usa2Armas = skid === 'sk_geral_ataque_com_2_armas';
  const item = getArmaEquipadaPrincipal(p);
  if (usa2Armas && !getArmaSecundariaEquipada(p)) {
    alert('Equipe uma 2ª Arma/Instrumento na mão secundária antes (badge "🤝 Mão Secundária" no Inventário).');
    return;
  }
  rolarAcertoArma(pid, item.id, { forcarAmbidestro: usa2Armas, labelPrefixo: sk.name });
}

// Rola o Dano das Habilidades Gerais "Ataque com Arma"/"Ataque com 2
// Armas" — mesma ideia de rolarAcertoAtaqueGeral, mas pro botão "Usar
// Efeito" (chamado por useSkill). "Ataque com 2 Armas" sempre soma o Dano
// da 2ª arma equipada, mesmo sem ter rolado o Acerto antes — os botões
// "Acerto" e "Usar Efeito" de uma Habilidade sempre foram independentes.
function rolarDanoAtaqueGeral(pid, skid) {
  const p = PLAYERS.find(x => x.id === pid);
  const sk = p && p.skills.find(s => s.id === skid);
  if (!p || !sk) return;
  const usa2Armas = skid === 'sk_geral_ataque_com_2_armas';
  const item = getArmaEquipadaPrincipal(p);
  if (usa2Armas && !getArmaSecundariaEquipada(p)) {
    alert('Equipe uma 2ª Arma/Instrumento na mão secundária antes (badge "🤝 Mão Secundária" no Inventário).');
    return;
  }
  if (!item.dano) return;
  rolarDanoArma(pid, item.id, { forcarAmbidestro: usa2Armas, labelPrefixo: sk.name });
}


// Equipa a pseudo-arma "Sem Arma": guarda todas as Armas/Instrumentos reais
// do personagem, representando lutar desarmado. Chamada pelo badge do card
// de "Sem Arma" (ver renderArmaCard) quando ele NÃO é a opção equipada no
// momento (ou seja, existe alguma Arma/Instrumento real ainda equipada).
function equiparSemArma(pid) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  if (!_podeTrocarArmaEquipada(p)) return;
  (p.inventario || []).forEach(it => {
    if (it.tipo === 'arma' || it.tipo === 'instrumento') it.equipado = false;
  });
  saveState();
  renderAll();
}

// ═══════════════════════════════════════
