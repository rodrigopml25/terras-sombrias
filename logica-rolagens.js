// DADOS — ROLAGEM COMPARTILHADA ENTRE A MESA
// ═══════════════════════════════════════
// Cada rolagem fica em campaigns/{id}/rolls/{pushId} — um nó separado do
// snapshotState() principal, para não disputar com o debounce de salvamento
// da ficha. Jogadores e Narrador veem as rolagens uns dos outros em tempo
// real. O Narrador pode marcar uma rolagem como "oculta": ela some para os
// jogadores (some substituída por um aviso de "rolagem oculta") até ele
// clicar em "Revelar".
let DICE_ROLLS = [];        // rolagens recentes carregadas, mais nova primeiro
let diceBaseRef = null;     // ref('campaigns/{id}/rolls') sem limite — usada para push()
let diceQueryRef = null;    // ref com limitToLast — usada para os listeners
let diceAddedHandler = null;
let diceChangedHandler = null;
let diceRemovedHandler = null;
let diceSelSides = 20;
let diceSelQty = 1;
let dicePanelOpen = false;
let diceUnread = 0;
const ROLL_ANIM_MS = 700;               // duração da animação de "rolando..."
let renderedEntryKeys = new Set();      // chaves já desenhadas — evita repetir a animação de entrada
let justRevealedKeys = new Set();       // chaves cujo resultado acabou de ser revelado — dispara o "pop" do total

function escHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Cor própria de cada tipo de dado — estilo "badge" colorido, como os
// conjuntos de dados de verdade (verde=d4, azul=d6, roxo=d8, rosa=d10,
// vermelho=d12, laranja=d20).
const DICE_COLORS = {
  2:   '#5b6b8c',
  4:   '#3fae4a',
  6:   '#2fb6d9',
  8:   '#8a3ffb',
  10:  '#e6299b',
  12:  '#d8342f',
  20:  '#e8622a',
  100: '#c99a2e'
};

// Pontos do polígono (silhueta parecida com o dado real) para cada tipo.
const DICE_POLY = {
  4:  '20,6 34,32 6,32',
  8:  '33.86,25.74 25.74,33.86 14.26,33.86 6.14,25.74 6.14,14.26 14.26,6.14 25.74,6.14 33.86,14.26',
  10: '20,4 34,15 27,36 13,36 6,15',
  12: '20,4 35.2,15.06 29.4,32.94 10.6,32.94 4.8,15.06',
  20: '36,20 28,33.86 12,33.86 4,20 12,6.14 28,6.14',
  100:'20,4 34,15 27,36 13,36 6,15'
};

// Ícone do dado no estilo "badge": forma preenchida com a cor do tipo e,
// opcionalmente, o número do resultado desenhado dentro da forma.
// Sem `number`, mostra a forma "vazia" (usado durante a animação de rolagem).
// Acerto Crítico / Erro Crítico: destaque visual (sem efeito mecânico) quando
// um d20 mostra 20 ou 1 natural, ou um d100 mostra 100 ou 1 natural — vale
// pra qualquer rolagem desses dados (Testes, Ataques, rolagens manuais). Em
// qualquer outro tipo de dado (d6, d8, mega-dados de dano etc.) não faz nada.
function diceCritClass(sides, value, critMin, fumbleMax, fumbleImune) {
  if (sides !== 20 && sides !== 100) return '';
  const cMin = critMin != null ? critMin : sides;
  const fMax = fumbleMax != null ? fumbleMax : 1;
  if (value >= cMin) return ' dice-badge-crit';
  if (!fumbleImune && value <= fMax) return ' dice-badge-fumble';
  return '';
}

// Varre uma rolagem inteira (simples ou fórmula com termos) procurando por
// algum d20 que caiu 20 ou 1 natural, pra mostrar a etiqueta de Crítico /
// Falha Crítica perto do total. Não tem efeito mecânico nenhum.
function rollCritInfo(r) {
  const fumbleImune = !!r.fumbleImune;
  let hasCrit = false, hasFumble = false;
  function walk(node) {
    if (!node) return;
    if (node.type === 'dice' && (node.sides === 20 || node.sides === 100)) {
      const cMin = r.critMin != null ? r.critMin : node.sides;
      const fMax = r.fumbleMax != null ? r.fumbleMax : 1;
      (node.results || []).forEach(v => { if (v >= cMin) hasCrit = true; if (!fumbleImune && v <= fMax) hasFumble = true; });
      if (node.countNode) walk(node.countNode);
    } else if (node.type === 'megaroll' && (node.sides === 20 || node.sides === 100)) {
      // Mega Vantagem/Desvantagem: só o dado MANTIDO conta pra Crítico/Falha
      // Crítica — o descartado não vale, mesmo que tenha caído 1 ou no máximo.
      const cMin = r.critMin != null ? r.critMin : node.sides;
      const fMax = r.fumbleMax != null ? r.fumbleMax : 1;
      if (node.kept >= cMin) hasCrit = true;
      if (!fumbleImune && node.kept <= fMax) hasFumble = true;
    } else if (node.type === 'sum') {
      node.terms.forEach(t => walk(t.node));
    }
  }
  if (r.tree) {
    walk(r.tree);
  } else if ((r.sides === 20 || r.sides === 100) && Array.isArray(r.results)) {
    const cMin = r.critMin != null ? r.critMin : r.sides;
    const fMax = r.fumbleMax != null ? r.fumbleMax : 1;
    r.results.forEach(v => { if (v >= cMin) hasCrit = true; if (!fumbleImune && v <= fMax) hasFumble = true; });
  }
  return { hasCrit, hasFumble };
}

function diceShapeSVG(sides, number) {
  const color = DICE_COLORS[sides] || DICE_COLORS[20];
  const label = (number != null) ? String(number) : '';
  const fontSize = label.length >= 3 ? 11 : (label.length === 2 ? 14 : 16);
  const textY = sides === 4 ? 27 : 24; // triângulo tem o centro visual mais baixo
  const textHtml = label
    ? `<text x="20" y="${textY}" text-anchor="middle" dominant-baseline="middle" font-family="Inter, sans-serif" font-size="${fontSize}" font-weight="800" fill="#fff">${label}</text>`
    : '';

  if (sides === 2) {
    return `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="${color}"/>${textHtml}</svg>`;
  }
  if (sides === 6) {
    return `<svg viewBox="0 0 40 40"><rect x="5" y="5" width="30" height="30" rx="8" fill="${color}"/>${textHtml}</svg>`;
  }
  const points = DICE_POLY[sides] || DICE_POLY[20];
  return `<svg viewBox="0 0 40 40"><polygon points="${points}" fill="${color}" stroke="${color}" stroke-width="4" stroke-linejoin="round"/>${textHtml}</svg>`;
}

// Classe de animação própria para cada tipo de dado (cada um "tomba" diferente).
function diceAnimClass(sides) {
  return 'dice-anim-d' + (({2:1,4:1,6:1,8:1,10:1,12:1,20:1,100:1})[sides] ? sides : '20');
}

// Cria o botão flutuante + painel de dados (uma vez só, funciona tanto na
// tela do Jogador quanto na do Narrador, pois ambas carregam este script).
function initDiceWidget() {
  if (document.getElementById('dice-fab')) return;
  if (!IS_JOGADOR && !IS_NARRADOR) return;

  const fab = document.createElement('button');
  fab.id = 'dice-fab';
  fab.className = 'dice-fab';
  fab.title = 'Dados da Mesa';
  fab.setAttribute('aria-label', 'Dados da Mesa');
  fab.innerHTML = '<span id="dice-fab-icon" class="dice-fab-icon">🎲</span><span id="dice-fab-badge" class="dice-fab-badge hidden">0</span>';
  fab.onclick = toggleDicePanel;
  document.body.appendChild(fab);

  const sidesOptions = [2, 4, 6, 8, 10, 12, 20, 100];
  const panel = document.createElement('div');
  panel.id = 'dice-panel';
  panel.className = 'dice-panel closed';
  panel.innerHTML = `
    <div class="dice-panel-header">
      🎲 Dados da Mesa
      <div class="dice-panel-actions">
        ${IS_NARRADOR ? `<button class="dice-panel-clear" onclick="limparChatDados()" title="Limpar histórico de rolagens para todos"><i class="ti ti-trash"></i></button>` : ''}
        <button class="dice-panel-close" onclick="toggleDicePanel()"><i class="ti ti-x"></i></button>
      </div>
    </div>
    <div class="dice-tabs">
      <button type="button" class="dice-tab-btn active" id="dice-tab-btn-feed" onclick="switchDiceTab('feed')">
        <i class="ti ti-history"></i> Histórico
        <span id="dice-tab-badge" class="dice-tab-badge hidden">0</span>
      </button>
      <button type="button" class="dice-tab-btn" id="dice-tab-btn-roll" onclick="switchDiceTab('roll')">
        <i class="ti ti-dice"></i> Rolar
      </button>
    </div>
    <div class="dice-feed" id="dice-feed"></div>
    <div class="dice-builder dice-tab-hidden" id="dice-builder">
      <div class="dice-builder-scroll">
        <div class="dice-sides-row" id="dice-sides-row">
          ${sidesOptions.map(s => `<button type="button" class="dice-side-btn ${s === diceSelSides ? 'active' : ''}" data-sides="${s}" onclick="selDiceSides(${s})">d${s}</button>`).join('')}
        </div>
        ${IS_NARRADOR ? `
        <label class="dice-hidden-row" title="A rolagem aparece só para você, com um botão para revelar depois">
          <input type="checkbox" id="dice-hidden-toggle"> Rolagem oculta (só o Narrador vê)
        </label>` : ''}
        <button class="dice-roll-btn" onclick="executarRolagemDados()">🎲 Rolar</button>
        <div class="dice-divider">ou combine numa fórmula</div>
        <div class="dice-formula-row">
          <input type="text" id="dice-formula-input" placeholder="ex: 2d6 + (3d4)d6 + 2" onkeydown="if(event.key==='Enter'){event.preventDefault();executarRolagemFormula();}">
          <button class="dice-formula-btn" onclick="executarRolagemFormula()">Rolar fórmula</button>
        </div>
        <div class="dice-formula-error hidden" id="dice-formula-error"></div>
      </div>
      <div class="dice-last-roll" id="dice-last-roll"></div>
    </div>
  `;
  document.body.appendChild(panel);

  renderDiceFeed();
  makeDicePanelDraggable(panel);
}

// Deixa o painel de dados arrastável pelo cabeçalho (menos os botões de
// ação, que continuam clicáveis normalmente). A posição é salva no
// localStorage do próprio navegador — cada pessoa move pro lugar que
// preferir, sem afetar ninguém mais (não é sincronizado com a campanha).
const DICE_PANEL_POS_KEY = 'dice_panel_pos';

function makeDicePanelDraggable(panel) {
  const header = panel.querySelector('.dice-panel-header');
  if (!header) return;

  // Aplica uma posição salva, se existir.
  try {
    const saved = JSON.parse(localStorage.getItem(DICE_PANEL_POS_KEY) || 'null');
    if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
      aplicarPosicaoPainelDados(panel, saved.left, saved.top);
    }
  } catch (e) { /* posição salva inválida — ignora e usa o padrão */ }

  let arrastando = false;
  let offsetX = 0, offsetY = 0;

  function pontoDoEvento(e) {
    return e.touches ? e.touches[0] : e;
  }

  function iniciar(e) {
    if (e.target.closest('.dice-panel-actions')) return; // não arrasta clicando nos botões
    arrastando = true;
    const pt = pontoDoEvento(e);
    const rect = panel.getBoundingClientRect();
    offsetX = pt.clientX - rect.left;
    offsetY = pt.clientY - rect.top;
    header.classList.add('dragging');
    e.preventDefault();
  }

  function mover(e) {
    if (!arrastando) return;
    const pt = pontoDoEvento(e);
    aplicarPosicaoPainelDados(panel, pt.clientX - offsetX, pt.clientY - offsetY);
  }

  function soltar() {
    if (!arrastando) return;
    arrastando = false;
    header.classList.remove('dragging');
    const rect = panel.getBoundingClientRect();
    try {
      localStorage.setItem(DICE_PANEL_POS_KEY, JSON.stringify({ left: rect.left, top: rect.top }));
    } catch (e) { /* localStorage indisponível — só não salva a posição */ }
  }

  header.addEventListener('mousedown', iniciar);
  header.addEventListener('touchstart', iniciar, { passive: false });
  window.addEventListener('mousemove', mover);
  window.addEventListener('touchmove', mover, { passive: false });
  window.addEventListener('mouseup', soltar);
  window.addEventListener('touchend', soltar);
}

// Move o painel pra (left, top), sempre mantendo ele dentro da tela, e troca
// o posicionamento de right/bottom (padrão) pra left/top (arrastado).
function aplicarPosicaoPainelDados(panel, left, top) {
  const largura = panel.offsetWidth || 380;
  const altura = panel.offsetHeight || 400;
  const maxLeft = Math.max(0, window.innerWidth - largura);
  const maxTop = Math.max(0, window.innerHeight - altura);
  const leftClamp = Math.min(Math.max(0, left), maxLeft);
  const topClamp = Math.min(Math.max(0, top), maxTop);
  panel.style.left = leftClamp + 'px';
  panel.style.top = topClamp + 'px';
  panel.style.right = 'auto';
  panel.style.bottom = 'auto';
}

// Alterna entre a aba de Histórico (feed grande, fácil de ler) e a aba de
// Rolar (construtor de rolagens). Antes, os dois ficavam empilhados no
// mesmo painel pequeno e o histórico sobrava só um pedacinho de altura —
// agora cada aba usa o painel inteiro.
let dicePanelTab = 'feed';
function switchDiceTab(tab) {
  dicePanelTab = tab;
  const feed = document.getElementById('dice-feed');
  const builder = document.getElementById('dice-builder');
  const btnFeed = document.getElementById('dice-tab-btn-feed');
  const btnRoll = document.getElementById('dice-tab-btn-roll');
  if (!feed || !builder || !btnFeed || !btnRoll) return;
  feed.classList.toggle('dice-tab-hidden', tab !== 'feed');
  builder.classList.toggle('dice-tab-hidden', tab !== 'roll');
  btnFeed.classList.toggle('active', tab === 'feed');
  btnRoll.classList.toggle('active', tab === 'roll');
  if (tab === 'feed') { diceUnread = 0; updateDiceBadge(); }
}

function selDiceSides(s) {
  diceSelSides = s;
  document.querySelectorAll('#dice-sides-row .dice-side-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.sides) === s);
  });
}

function toggleDicePanel() {
  const panel = document.getElementById('dice-panel');
  if (!panel) return;
  dicePanelOpen = !dicePanelOpen;
  panel.classList.toggle('closed', !dicePanelOpen);
  if (dicePanelOpen) {
    diceUnread = 0;
    updateDiceBadge();
  }
}

function updateDiceBadge() {
  const badge = document.getElementById('dice-fab-badge');
  const tabBadge = document.getElementById('dice-tab-badge');
  const showFab = diceUnread > 0 && !dicePanelOpen;
  const showTab = diceUnread > 0 && dicePanelOpen && dicePanelTab !== 'feed';
  if (badge) {
    if (showFab) {
      badge.textContent = diceUnread > 9 ? '9+' : String(diceUnread);
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
  if (tabBadge) {
    if (showTab) {
      tabBadge.textContent = diceUnread > 9 ? '9+' : String(diceUnread);
      tabBadge.classList.remove('hidden');
    } else {
      tabBadge.classList.add('hidden');
    }
  }
}

// Liga (ou religa) a sincronização das rolagens para a campanha ativa.
// Chamada ao entrar numa campanha e ao trocar de campanha.
function bindRollsSync(campaignId) {
  if (diceQueryRef && diceAddedHandler)   diceQueryRef.off('child_added', diceAddedHandler);
  if (diceQueryRef && diceChangedHandler) diceQueryRef.off('child_changed', diceChangedHandler);
  if (diceQueryRef && diceRemovedHandler) diceQueryRef.off('child_removed', diceRemovedHandler);
  diceQueryRef = null; diceAddedHandler = null; diceChangedHandler = null; diceRemovedHandler = null; diceBaseRef = null;
  DICE_ROLLS = [];
  renderedEntryKeys = new Set();
  justRevealedKeys = new Set();
  renderDiceFeed();

  if (!firebaseConfigured || !campaignId || campaignId === 'local') return;

  diceBaseRef = firebase.database().ref('campaigns/' + campaignId + '/rolls');
  diceQueryRef = diceBaseRef.limitToLast(40);

  diceAddedHandler = snap => {
    const val = snap.val();
    if (!val) return;
    val.key = snap.key;
    if (!DICE_ROLLS.some(r => r.key === val.key)) {
      DICE_ROLLS.unshift(val);
      DICE_ROLLS.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      if (DICE_ROLLS.length > 40) DICE_ROLLS.length = 40;
      renderDiceFeed();
      if (!dicePanelOpen) { diceUnread++; updateDiceBadge(); }
    }
  };
  diceChangedHandler = snap => {
    const val = snap.val();
    if (!val) return;
    val.key = snap.key;
    const idx = DICE_ROLLS.findIndex(r => r.key === val.key);
    const wasRolling = idx >= 0 && DICE_ROLLS[idx].rolling;
    if (idx >= 0) DICE_ROLLS[idx] = val;
    else { DICE_ROLLS.unshift(val); DICE_ROLLS.sort((a,b) => (b.ts||0) - (a.ts||0)); }
    if (wasRolling && !val.rolling) justRevealedKeys.add(val.key);
    renderDiceFeed();
  };
  diceRemovedHandler = snap => {
    const key = snap.key;
    DICE_ROLLS = DICE_ROLLS.filter(r => r.key !== key);
    renderedEntryKeys.delete(key);
    justRevealedKeys.delete(key);
    renderDiceFeed();
  };
  diceQueryRef.on('child_added', diceAddedHandler);
  diceQueryRef.on('child_changed', diceChangedHandler);
  diceQueryRef.on('child_removed', diceRemovedHandler);
}

// Narrador limpa o histórico de rolagens da mesa inteira (some para todo mundo).
function limparChatDados() {
  if (!IS_NARRADOR) return;
  if (!confirm('Limpar todo o histórico de rolagens desta mesa? Isso apaga o chat de dados para todos os jogadores.')) return;

  if (firebaseConfigured && activeCampaignId && activeCampaignId !== 'local') {
    firebase.database().ref('campaigns/' + activeCampaignId + '/rolls').remove();
  } else {
    DICE_ROLLS = [];
    renderedEntryKeys = new Set();
    justRevealedKeys = new Set();
    renderDiceFeed();
  }
}


function executarRolagemDados() {
  if (!currentUser) return;
  const qtyInput   = document.getElementById('dice-qty');
  const modInput   = document.getElementById('dice-mod');
  const labelInput = document.getElementById('dice-label');
  const hiddenCk   = document.getElementById('dice-hidden-toggle');

  const qty   = Math.max(1, Math.min(20, parseInt(qtyInput && qtyInput.value) || 1));
  const sides = diceSelSides;
  const mod   = (modInput && parseInt(modInput.value)) || 0;
  const label = labelInput ? labelInput.value.trim().slice(0, 60) : '';
  const hidden = !!(IS_NARRADOR && hiddenCk && hiddenCk.checked);

  const results = [];
  for (let i = 0; i < qty; i++) results.push(1 + Math.floor(Math.random() * sides));
  const total = results.reduce((a, b) => a + b, 0) + mod;

  // Se o Jogador tiver um personagem selecionado, anexa o nome dele à rolagem
  let charName = null;
  if (IS_JOGADOR) {
    const psel = document.getElementById('psel');
    if (psel && psel.value) {
      const p = PLAYERS.find(pp => String(pp.id) === String(psel.value));
      if (p) charName = p.name;
    }
  }

  const entry = {
    playerName: currentUser.name || (IS_NARRADOR ? 'Narrador' : 'Jogador'),
    charName: charName,
    isNarrator: !!IS_NARRADOR,
    qty, sides, mod, label,
    results, total,
    hidden,
    rolling: true,
    ts: Date.now()
  };

  if (labelInput) labelInput.value = '';

  spinDiceFab(true, sides);
  pushRollEntry(entry, key => {
    setTimeout(() => finishRollEntry(key), ROLL_ANIM_MS);
    setTimeout(() => spinDiceFab(false), ROLL_ANIM_MS);
  });
}

// ═══════════════════════════════════════
// FÓRMULAS AVANÇADAS — ex: "2d6 + (3d4)d6 + 2"
// ═══════════════════════════════════════
// Gramática:
//   expressao := termo (('+'|'-') termo)*
//   termo     := fator ('d' fator)?          — se tiver 'd', é uma rolagem de dados
//   fator     := NUMERO | '(' expressao ')'
// A quantidade de dados (lado esquerdo do 'd') pode ser um número fixo OU o
// resultado de outra rolagem entre parênteses — por isso "(3d4)d6" funciona:
// primeiro rola 3d4, e o total vira a quantidade de d6 a rolar.
const DICE_FORMULA_MAX_PER_TERM = 200;   // limite de dados por termo (evita travar o navegador)
const DICE_FORMULA_MAX_TOTAL    = 500;   // limite de dados somando a fórmula inteira
const DICE_FORMULA_MAX_SIDES    = 1000;

function parseFormula(str) {
  const s = String(str || '').replace(/\s+/g, '');
  if (!s) throw new Error('Digite uma fórmula, ex: 2d6 + (3d4)d6 + 2');

  let i = 0;
  let totalDiceRolled = 0;
  const peek = () => s[i];
  const eof = () => i >= s.length;

  function parseNumber() {
    const start = i;
    while (!eof() && /[0-9]/.test(s[i])) i++;
    if (start === i) throw new Error('Número esperado perto de "' + (s.slice(i, i + 8) || 'fim da fórmula') + '"');
    return parseInt(s.slice(start, i), 10);
  }

  function parseFactor() {
    if (peek() === '(') {
      i++;
      const inner = parseExpression();
      if (peek() !== ')') throw new Error('Parêntese não fechado');
      i++;
      return inner;
    }
    const n = parseNumber();
    return { value: n, node: { type: 'const', value: n } };
  }

  function parseTerm() {
    const left = parseFactor();
    if (!eof() && (peek() === 'd' || peek() === 'D')) {
      i++;
      const right = parseFactor();
      const count = left.value;
      const sides = right.value;
      if (!(count >= 1) || count > DICE_FORMULA_MAX_PER_TERM) {
        throw new Error('Quantidade de dados inválida (1 a ' + DICE_FORMULA_MAX_PER_TERM + ')');
      }
      if (!(sides >= 2) || sides > DICE_FORMULA_MAX_SIDES) {
        throw new Error('Número de lados inválido (2 a ' + DICE_FORMULA_MAX_SIDES + ')');
      }
      totalDiceRolled += count;
      if (totalDiceRolled > DICE_FORMULA_MAX_TOTAL) {
        throw new Error('Muitos dados nessa fórmula (máx. ' + DICE_FORMULA_MAX_TOTAL + ' no total)');
      }
      const results = [];
      for (let k = 0; k < count; k++) results.push(1 + Math.floor(Math.random() * sides));
      const sum = results.reduce((a, b) => a + b, 0);
      return {
        value: sum,
        node: {
          type: 'dice',
          sides, count, results, sum,
          countNode: left.node.type === 'const' ? null : left.node
        }
      };
    }
    return left;
  }

  function parseExpression() {
    const terms = [{ sign: '+', ...parseTerm() }];
    while (!eof() && (peek() === '+' || peek() === '-')) {
      const sign = s[i]; i++;
      terms.push({ sign, ...parseTerm() });
    }
    const value = terms.reduce((acc, t) => acc + (t.sign === '-' ? -t.value : t.value), 0);
    return { value, node: { type: 'sum', terms: terms.map(t => ({ sign: t.sign, node: t.node })) } };
  }

  const result = parseExpression();
  if (!eof()) throw new Error('Não entendi a partir de "' + s.slice(i) + '"');
  return result; // { value, node }
}

// Desenha (em HTML) a árvore de uma rolagem por fórmula, mostrando cada
// grupo de dados como badges com o número dentro, e rolagens aninhadas
// como "grupo → quantidade de dados do próximo grupo".
function renderDiceNode(node, ctx) {
  ctx = ctx || {};
  if (node.type === 'const') {
    return `<span class="dice-const-txt">${node.value}</span>`;
  }
  if (node.type === 'labeled_const') {
    return `<span class="dice-const-txt dice-const-labeled">${Math.abs(node.value)} <small class="dice-const-label">${escHtml(node.label)}</small></span>`;
  }
  if (node.type === 'megaroll') {
    // Mega Vantagem/Desvantagem: mostra os dois d20, destacando o mantido
    // (maior para MV, menor para MD) e esmaecendo o descartado.
    const vals = [node.d1, node.d2];
    let keptUsed = false;
    const badges = vals.map(v => {
      const isKept = !keptUsed && v === node.kept;
      if (isKept) keptUsed = true;
      return `<span class="dice-badge ${isKept ? 'dice-badge-kept' : 'dice-badge-dropped'}${diceCritClass(node.sides, v, ctx.critMin, ctx.fumbleMax, ctx.fumbleImune)}">${diceShapeSVG(node.sides, v)}</span>`;
    }).join('');
    const modeLabel = node.mode === 'mv' ? 'mega vantagem — mantém o maior' : 'mega desvantagem — mantém o menor';
    return `<span class="dice-term"><span class="dice-badges-inline">${badges}</span><span class="dice-mega-label" title="${modeLabel}">${node.mode === 'mv' ? 'MV' : 'MD'}</span></span>`;
  }
  if (node.type === 'dice') {
    const nestedHtml = node.countNode
      ? `<span class="dice-nested">${renderDiceNode(node.countNode, ctx)}<span class="dice-arrow">→</span></span>`
      : '';
    const badges = node.results.map(v => `<span class="dice-badge${diceCritClass(node.sides, v, ctx.critMin, ctx.fumbleMax, ctx.fumbleImune)}">${diceShapeSVG(node.sides, v)}</span>`).join('');
    const labelHtml = node.label ? `<span class="dice-mega-label" title="${escHtml(node.label)}">${escHtml(node.label)}</span>` : '';
    return `<span class="dice-term">${nestedHtml}<span class="dice-badges-inline">${badges}</span>${labelHtml}</span>`;
  }
  if (node.type === 'sum') {
    return node.terms.map((t, idx) => {
      const signHtml = (idx === 0)
        ? (t.sign === '-' ? '<span class="dice-sign">−</span>' : '')
        : `<span class="dice-sign">${t.sign === '-' ? '−' : '+'}</span>`;
      return signHtml + renderDiceNode(t.node, ctx);
    }).join('');
  }
  return '';
}

function executarRolagemFormula() {
  if (!currentUser) return;
  const input   = document.getElementById('dice-formula-input');
  const errBox  = document.getElementById('dice-formula-error');
  const hiddenCk = document.getElementById('dice-hidden-toggle');
  if (!input) return;

  const formula = input.value.trim();
  if (errBox) { errBox.textContent = ''; errBox.classList.add('hidden'); }
  if (!formula) return;

  let parsed;
  try {
    parsed = parseFormula(formula);
  } catch (e) {
    if (errBox) { errBox.textContent = e.message; errBox.classList.remove('hidden'); }
    return;
  }

  const hidden = !!(IS_NARRADOR && hiddenCk && hiddenCk.checked);

  let charName = null;
  if (IS_JOGADOR) {
    const psel = document.getElementById('psel');
    if (psel && psel.value) {
      const p = PLAYERS.find(pp => String(pp.id) === String(psel.value));
      if (p) charName = p.name;
    }
  }

  const entry = {
    playerName: currentUser.name || (IS_NARRADOR ? 'Narrador' : 'Jogador'),
    charName,
    isNarrator: !!IS_NARRADOR,
    formula,
    tree: parsed.node,
    total: parsed.value,
    hidden,
    rolling: true,
    ts: Date.now()
  };

  input.value = '';

  spinDiceFab(true);
  pushRollEntry(entry, key => {
    setTimeout(() => finishRollEntry(key), ROLL_ANIM_MS);
    setTimeout(() => spinDiceFab(false), ROLL_ANIM_MS);
  });
}

function spinDiceFab(on, sides) {
  const fab = document.getElementById('dice-fab');
  const icon = document.getElementById('dice-fab-icon');
  if (fab) fab.classList.toggle('rolling', !!on);
  if (icon) {
    if (on) {
      icon.innerHTML = diceShapeSVG(sides);
      icon.className = 'dice-fab-icon ' + diceAnimClass(sides);
    } else {
      icon.innerHTML = '🎲';
      icon.className = 'dice-fab-icon';
    }
  }
}

// Toda rolagem de um NPC (p.isNPC), feita pelo Narrador, começa oculta dos
// Jogadores por padrão — só o Narrador vê o resultado até clicar em
// "Revelar para os jogadores" (ver revelarRolagem). Rolagens de Jogadores
// continuam abertas normalmente. Usado em todo lugar que cria uma entry de
// rolagem vinculada a um personagem (Teste, Acerto, Dano de Arma etc.).
function hiddenPadrao(p) {
  return !!(IS_NARRADOR && p && p.isNPC);
}

function pushRollEntry(entry, afterKeyKnown) {
  if (firebaseConfigured && diceBaseRef) {
    const newRef = diceBaseRef.push();
    newRef.set(entry).then(() => {
      if (afterKeyKnown) afterKeyKnown(newRef.key);
    });
  } else {
    // Modo local (sem Firebase configurado): mantém a rolagem só nesta aba.
    entry.key = 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    DICE_ROLLS.unshift(entry);
    if (DICE_ROLLS.length > 40) DICE_ROLLS.length = 40;
    renderDiceFeed();
    if (afterKeyKnown) afterKeyKnown(entry.key);
  }
}

// Encerra a animação de "rolando..." e revela o resultado (para todos na mesa)
function finishRollEntry(key) {
  if (firebaseConfigured && activeCampaignId && activeCampaignId !== 'local') {
    firebase.database().ref('campaigns/' + activeCampaignId + '/rolls/' + key + '/rolling').set(false);
  } else {
    const r = DICE_ROLLS.find(x => x.key === key);
    if (r) { r.rolling = false; justRevealedKeys.add(key); renderDiceFeed(); }
  }
}

// ═══════════════════════════════════════
// ROLAGEM DE ACERTO DE HABILIDADE (Golpes/Feitiços)
// ═══════════════════════════════════════
// Toda Habilidade usada via useSkill() precisa, antes de qualquer efeito,
// de uma rolagem de 1d20 + maestria (do atributo ligado à cor da Habilidade)
// + um Bônus fixo opcional (sk.bonusAcerto — ex: +2 de uma Arma encantada).
// O app NÃO decide sozinho se acertou: só publica a rolagem no feed de
// dados, igual a um Teste, e quem olha o número (o Narrador, geralmente)
// decide se o efeito da Habilidade realmente se aplica.
//
// Exceções (não rolam Acerto):
//   - sk.acertoGarantido === true (a própria Habilidade já diz "o acerto é
//     garantido" — ex: Essência Sombria, Toque das Sombras).
//   - Habilidades vinculadas a um Teste específico via SKILL_TESTE_LINK
//     (ex: Acrobacia, Furtividade) — essas já rolam o próprio Teste, que
//     cumpre o mesmo papel.
//
// Convenção de cor -> atributo de maestria (mesma usada nas Subclasses:
// verde = Agilidade, vermelho = Força, azul = Intelecto). Habilidades
// cinzas (gerais/raciais, sem atributo de combate claro) rolam só 1d20 +
// Bônus, sem maestria.
const ATTR_DA_COR_HABILIDADE = { green: 'agi', red: 'forca', blue: 'intel' };

// Habilidades puramente utilitárias/de alternância — nunca "acertam" nada,
// então não fazem sentido no botão de Acerto (mesmos casos que useSkill já
// trata como fluxo especial, com return antecipado, antes de chegar na
// parte de custo/efeito).
const HABILIDADES_SEM_ACERTO = new Set([
  'sk_racial_dragao_metamorfose',
  'sk_geral_teste_mental',
  'sk_geral_arsenal',
  'sk_origem_draenei_forjado_luz',
  'sk_racial_draenei_adaptacao',
  'sk_banco_campeao_adaptacao',
  'sk_banco_campeao_conclamar',
  'sk_banco_campeao_dose_dupla',
  'sk_banco_campeao_folego_extra',
  'sk_banco_campeao_gambiarra_de_alto_nivel',
  'sk_banco_campeao_grito_de_guerra',
  'sk_banco_campeao_motivar',
  'sk_banco_campeao_honra',
  'sk_geral_beber_poção',
  'sk_geral_correr',
  'sk_geral_engajar',
  'sk_geral_recurso',
]);

// Decide se uma Habilidade mostra o botão "Acerto" (separado do "Usar
// Efeito"). Não mostra quando: já tem acerto garantido; está vinculada a um
// Teste próprio (SKILL_TESTE_LINK — o próprio Teste já cumpre esse papel);
// é uma Habilidade puramente utilitária/de alternância (lista acima); ou é
// a Habilidade Neutra de uma Forma Sombria (Pandaren) já ativa, cujo botão
// vira "Desativar" (sempre livre, não é uma ação que "acerta" nada).
function precisaAcertoHabilidade(p, sk) {
  if (!sk || sk.acertoGarantido) return false;
  if (SKILL_TESTE_LINK[sk.id]) return false;
  if (HABILIDADES_SEM_ACERTO.has(sk.id)) return false;
  if (p && p.race === 'Pandaren' && p.formaSombriaId
      && PANDAREN_FORMAS_SOMBRIAS[p.formaSombriaId]
      && sk.id === PANDAREN_FORMAS_SOMBRIAS[p.formaSombriaId].skillNeutra.id) return false;
  return true;
}

// Handler do botão "Acerto" do card de Habilidade — só rola e publica no
// feed (não consome custo, uso nem recarga; isso fica pro botão "Usar
// Efeito"/useSkill). Pode ser clicado quantas vezes quiser enquanto a
// Habilidade estiver pronta, útil pra rolar de novo se pedirem.
function rolarAcertoHabilidadeClick(pid, skid) {
  const p = PLAYERS.find(x => x.id === pid);
  const sk = p && p.skills.find(s => s.id === skid);
  if (!sk) return;
  if (!isReady(sk, p)) return;
  if (formaSombriaBloqueiaHabilidade(p, sk)) return;
  // "Encantamento Troll": os dados de lançamento (Acerto) são trocados por
  // um Teste de Arcano OU Místico completo — pergunta qual dos dois antes
  // de rolar (ver abrirAcertoEncantadoModal/rolarAcertoHabilidadeEncantada).
  if (skillEhEncantamentoTroll(p, sk)) {
    abrirAcertoEncantadoModal(pid, skid);
    return;
  }
  rolarAcertoHabilidade(pid, sk);
}

// Pergunta qual Teste (Arcano ou Místico) vai substituir a rolagem de
// Acerto de uma Habilidade encantada pelo Encantamento Troll — o texto da
// passiva deixa a escolha livre a cada uso ("Arcano OU Místico").
function abrirAcertoEncantadoModal(pid, skid) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  const sk = p && p.skills.find(s => s.id === skid);
  if (!overlay || !p || !sk) return;
  overlay.innerHTML = `
    <div class="modal" style="max-width:380px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-sparkles"></i> Encantamento Troll</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:12px;line-height:1.5">
        "${escHtml(sk.name)}" está encantada: o Acerto usa um Teste de Arcano ou Místico completo (com maestria, Mega Vantagem/Desvantagem e Bônus configurados) no lugar da rolagem normal. Qual dos dois?
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="tm-opcao tm-opcao-blue" onclick="fecharCriacaoAnaoModal();rolarAcertoHabilidadeEncantada(${p.id},'${sk.id}','arcano')">
          <span class="tm-opcao-nome">Teste de Arcano</span>
        </button>
        <button class="tm-opcao tm-opcao-blue" onclick="fecharCriacaoAnaoModal();rolarAcertoHabilidadeEncantada(${p.id},'${sk.id}','mistico')">
          <span class="tm-opcao-nome">Teste de Místico</span>
        </button>
      </div>
    </div>`;
  overlay.classList.add('open');
}

// Rola e publica no feed a checagem de Acerto de uma Habilidade encantada
// (Encantamento Troll), reaproveitando construirRolagemTeste de verdade —
// traz junto a maestria do Teste escolhido e qualquer Mega Vantagem/Mega
// Desvantagem/Bônus já configurado nesse Teste na ficha do personagem.
function rolarAcertoHabilidadeEncantada(pid, skid, testeId) {
  if (!currentUser) return null;
  const p = PLAYERS.find(x => x.id === pid);
  const sk = p && p.skills.find(s => s.id === skid);
  if (!p || !sk) return null;
  const r = construirRolagemTeste(p, testeId);
  if (!r) return null;

  const entry = {
    playerName: currentUser.name || (IS_NARRADOR ? 'Narrador' : 'Jogador'),
    charName: p.name,
    isNarrator: !!IS_NARRADOR,
    formula: `Rolagem de Acerto — ${sk.name} (🔮 via ${r.formula})`,
    tree: r.tree,
    total: r.total,
    sides: r.sides,
    critMin: r.critMin,
    fumbleMax: r.fumbleMax,
    fumbleImune: r.fumbleImune,
    hidden: hiddenPadrao(p),
    rolling: true,
    ts: Date.now(),
    label: '🎯 Rolagem de Acerto',
  };

  spinDiceFab(true, r.sides);
  pushRollEntry(entry, key => {
    setTimeout(() => finishRollEntry(key), ROLL_ANIM_MS);
    setTimeout(() => spinDiceFab(false), ROLL_ANIM_MS);
  });

  // Mesma correção de rolarTeste/rolarAcertoHabilidade: essa rolagem também
  // passa por construirRolagemTeste e pode consumir Motivar/Análise Rápida.
  saveState();
  renderAll();

  if (!dicePanelOpen) toggleDicePanel();
  else if (dicePanelTab !== 'feed') switchDiceTab('feed');

  return r.total;
}
function construirRolagemAcertoHabilidade(p, sk) {
  const sides = 20;
  const campoAttr = ATTR_DA_COR_HABILIDADE[sk.color] || null;
  const mst = campoAttr ? maestriaDe(p, campoAttr) : 0;

  // "Honra" (Campeão): Mega Vantagem no Acerto da próxima Habilidade do tipo
  // Técnica (verde) ou Golpe (vermelho) — 1 uso só, consumido aqui.
  const honraAplica = !!p.honraMegaVantagemPendente && (sk.color === 'green' || sk.color === 'red');
  if (honraAplica) p.honraMegaVantagemPendente = false;

  let d1, dadoNode;
  if (honraAplica) {
    const dA = 1 + Math.floor(Math.random() * sides);
    const dB = 1 + Math.floor(Math.random() * sides);
    d1 = Math.max(dA, dB);
    dadoNode = { type: 'megaroll', mode: 'mv', sides, d1: dA, d2: dB, kept: d1 };
  } else {
    d1 = 1 + Math.floor(Math.random() * sides);
    dadoNode = { type: 'dice', sides, count: 1, results: [d1], sum: d1, countNode: null };
  }
  const terms = [{ sign: '+', node: dadoNode }];
  let total = d1;

  if (mst) {
    terms.push({ sign: '+', node: { type: 'labeled_const', value: mst, label: 'maestria' } });
    total += mst;
  }

  const bonusAcerto = Number(sk.bonusAcerto) || 0;
  if (bonusAcerto) {
    terms.push({
      sign: bonusAcerto > 0 ? '+' : '-',
      node: { type: 'labeled_const', value: Math.abs(bonusAcerto), label: sk.bonusAcertoLabel || 'bônus' }
    });
    total += bonusAcerto;
  }

  // "Origem Mag'har" (Orc): +2 de Vantagem na rolagem de Acerto se esta
  // Habilidade foi marcada (ver getMagharHabBonus) e for do tipo Golpe
  // (color 'red'). O +1d4 de Dano/Cura da mesma marcação continua manual —
  // ainda não existe rolagem de Dano automática pra Habilidades.
  if (getMagharHabBonus(p, sk.id) && sk.color === 'red') {
    terms.push({ sign: '+', node: { type: 'labeled_const', value: 2, label: "Mag'har" } });
    total += 2;
  }

  // "Filosofia Pandarênica" (Pandaren, Origem Comum): +3 de Vantagem na
  // rolagem de Acerto pra toda Habilidade do tipo escolhido (ver
  // getFilosofiaPandarenicaBonus).
  if (getFilosofiaPandarenicaBonus(p, sk)) {
    terms.push({ sign: '+', node: { type: 'labeled_const', value: 3, label: 'Filosofia Pandarênica' } });
    total += 3;
  }

  // "Duelo" (Campeão): mesmo bônus/penalidade de +1d6/-1d6 do Teste normal
  // (ver construirRolagemTeste) — a rolagem de Acerto de Habilidade também
  // conta como "acerto" pro efeito da Habilidade.
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

  // "Motivar" (Campeão): mesmo bônus de +1d12 do Teste normal (ver
  // construirRolagemTeste) — o Acerto de Habilidade também conta como
  // "próxima Ação ou Teste" pro efeito de Motivar.
  if (p.motivarPendente) {
    const motRoll = 1 + Math.floor(Math.random() * 12);
    terms.push({ sign: '+', node: { type: 'dice', sides: 12, count: 1, results: [motRoll], sum: motRoll, countNode: null, label: 'Motivar' } });
    total += motRoll;
    p.motivarPendente = false;
  }

  const tree = { type: 'sum', terms };
  const formula = `Rolagem de Acerto — ${sk.name}${honraAplica ? ' (Mega Vantagem — Honra)' : ''}`;
  const { critMin, fumbleMax, fumbleImune } = getCritThresholds(p, null, sides);

  return { sides, total, tree, formula, critMin, fumbleMax, fumbleImune };
}

// Rola e publica no feed de dados a checagem de acerto de uma Habilidade,
// exatamente como um Teste — sem decidir sozinho se acertou ou não.
function rolarAcertoHabilidade(pid, sk) {
  if (!currentUser) return null;
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return null;
  const r = construirRolagemAcertoHabilidade(p, sk);
  if (!r) return null;

  const entry = {
    playerName: currentUser.name || (IS_NARRADOR ? 'Narrador' : 'Jogador'),
    charName: p.name,
    isNarrator: !!IS_NARRADOR,
    formula: r.formula,
    tree: r.tree,
    total: r.total,
    sides: r.sides,
    critMin: r.critMin,
    fumbleMax: r.fumbleMax,
    fumbleImune: r.fumbleImune,
    hidden: hiddenPadrao(p),
    rolling: true,
    ts: Date.now(),
    label: '🎯 Rolagem de Acerto',
  };

  spinDiceFab(true, r.sides);
  pushRollEntry(entry, key => {
    setTimeout(() => finishRollEntry(key), ROLL_ANIM_MS);
    setTimeout(() => spinDiceFab(false), ROLL_ANIM_MS);
  });

  // Marca de 1 uso consumida em construirRolagemAcertoHabilidade (Motivar) —
  // precisa salvar e re-renderizar, senão o badge fica errado pros outros e
  // a marca pode "voltar" num sync do Firebase (ver mesma correção em
  // rolarTeste).
  saveState();
  renderAll();

  if (!dicePanelOpen) toggleDicePanel();
  else if (dicePanelTab !== 'feed') switchDiceTab('feed');

  return r.total;
}

// ═══════════════════════════════════════
// ROLAGEM DE TESTES (Acrobacia, Furtividade, Aparar, Iniciativa, etc.)
// ═══════════════════════════════════════
// Monta a árvore de rolagem de um Teste, sem publicá-la no feed de dados.
// Rola 1d20 + maestria do atributo do teste. Se o teste tiver Mega Vantagem
// (t.mv) ou Mega Desvantagem (t.md) configurada, rola 2 dados e mantém o
// maior ou o menor resultado, respectivamente. Se houver um Bônus
// configurado (t.bonus), soma/subtrai também — o bônus pode ser um número
// fixo (ex: "+3") ou uma fórmula de dados (ex: "-1d4", "1d6").
// Exceção: o Teste de Emoção usa 1d100 no lugar do 1d20 e subtrai a
// Insanidade atual do personagem (1d100 − Insanidade).
// ─── Limiares de Crítico / Falha Crítica (ponto de extensão p/ passivas) ──
// Por padrão, Crítico só acontece no valor máximo do dado (20 no d20, 100 no
// d100) e Falha Crítica só no 1. Esta função é o ÚNICO lugar que decide os
// limiares de UM personagem para UM Teste específico — quando as
// passivas/talentos de "+X% de chance de Crítico" (cumulativo entre vários
// talentos) e "sem Falha Crítica em certos Testes" forem cadastradas, é AQUI
// que a lógica entra. O resto do sistema (renderização, badges, etiquetas
// "Crítico!"/"Falha Crítica!") já lê esses valores prontos — não precisa
// mexer em mais nada.
//
// Retorno:
//   critMin     → menor valor do dado que já conta como Crítico (padrão: sides)
//   fumbleMax   → maior valor do dado que já conta como Falha Crítica (padrão: 1)
//   fumbleImune → true se esse personagem/Teste nunca pode ter Falha Crítica
//
// Exemplo (ainda NÃO ativo) de como uma passiva cumulativa de "+5% de chance
// de Crítico" entraria — cada +5% amplia a faixa em 1 valor no d20 (20→19→18…)
// ou em 5 valores no d100 (100→95→90…), somando entre todos os talentos:
//   let bonusPassos = 0;
//   (p.passivas || []).forEach(pas => {
//     if (pas.tipo === 'critBonusPct') bonusPassos += Math.round(pas.valor / (sides === 100 ? 1 : 5) * (sides === 100 ? 5 : 1));
//   });
//   critMin = Math.max(fumbleMax + 1, sides - bonusPassos);
//
// Exemplo (ainda NÃO ativo) de talento que remove Falha Crítica só em certos
// Testes (ex: só em Furtividade, ou só em Testes de Força):
//   if ((p.passivas || []).some(pas => pas.tipo === 'semFalhaCritica' && (pas.testes || []).includes(testeId))) {
//     fumbleImune = true;
//   }
function getCritThresholds(p, testeId, sides) {
  let critMin = sides;
  let fumbleMax = 1;
  let fumbleImune = false;

  // "Entropia Constante" (Etéreo): passiva racial fixa — todo Etéreo tem
  // automaticamente, sem precisar escolher (ver RACAS['Etéreo']). Concede
  // +5% de chance tanto de Acerto Crítico quanto de Erro Crítico, em
  // qualquer Ação ou Teste. No d20 amplia a faixa em 1 pra cada lado (crita
  // com 19+, falha com 1-2); no d100 amplia 6 pra cima (crita com 94+) e 5
  // pra baixo (falha com 1-6).
  if (p.race === 'Etéreo') {
    if (sides === 20) { critMin -= 1; fumbleMax += 1; }
    else if (sides === 100) { critMin -= 6; fumbleMax += 5; }
  }

  // "Treinamento Militar" (Orc): o próximo Teste de Aparar (marcado por
  // p.treinamentoMilitarPendente) tem 50% de chance de Crítico — no d20,
  // isso significa Crítico com 10 ou mais, em vez de só no 20 natural.
  // O consumo do "próximo Aparar" (desligar a marca) acontece em
  // construirRolagemTeste, não aqui — esta função só decide o limiar.
  if (testeId === 'aparar' && sides === 20 && p.treinamentoMilitarPendente) {
    critMin = Math.min(critMin, 10);
  }

  // "Análise Rápida" (Campeão): o Teste de Percepção que ela aciona nunca
  // pode tirar Falha Crítica. A marca é consumida em construirRolagemTeste.
  if (testeId === 'percepcao' && p.analiseRapidaPendente) {
    fumbleImune = true;
  }

  return { critMin, fumbleMax, fumbleImune };
}

function construirRolagemTeste(p, testeId) {
  getTestePersonagem(p);
  const def = TESTES_LISTA.find(t => t.id === testeId);
  if (!def) return null;
  const t = p.testes[testeId];

  const isEmocao = testeId === 'emocao';
  const isDevocao = testeId === 'devocao';
  const sides = (isEmocao || isDevocao) ? 100 : 20;
  // Testes "Neutros" (Iniciativa, Emoção, Devoção) não recebem bônus de maestria.
  // "Comum" (Origem, Troll): se o Teste de Arcano OU Místico estiver trocado
  // (ver abrirOrigemComumTrocaModal), usa a maestria do Teste escolhido no
  // lugar da maestria de Intelecto — os "dados de lançamento" na prática são
  // o bônus de maestria somado ao d20, então é isso que muda de atributo.
  const origemComumTrocaAqui = (testeId === 'arcano' || testeId === 'mistico')
    && p.origemId === 'troll_origem_comum'
    && p.origemComumTrocaArea === testeId
    && !!p.origemComumTrocaTesteId;
  let mst;
  if (origemComumTrocaAqui) {
    const testeTrocado = TESTES_LISTA.find(t => t.id === p.origemComumTrocaTesteId);
    mst = testeTrocado && testeTrocado.attr !== 'neutro' ? maestriaDe(p, testeTrocado.attr) : 0;
  } else {
    mst = def.attr !== 'neutro' ? maestriaDe(p, def.attr) : 0;
  }

  // "Mente Equilibrada" (Pandaren): passiva racial — o Teste de Emoção é
  // sempre considerado em módulo (valor absoluto). A Mega Vantagem que ela dá
  // é só um valor PADRÃO pré-marcado (ver ensureRacePassivas), não mais uma
  // trava — o jogador pode ligar/desligar o MV/MD normalmente.
  const temMenteEquilibrada = isEmocao && p.race === 'Pandaren'
    && (p.passivas || []).some(pas => pas.racialId === 'pandaren_mente_equilibrada');

  // Mega Vantagem / Mega Desvantagem: rola 2 dados e mantém o melhor ou o
  // pior. Mag'har, Brutão, Maestria e Mente Equilibrada só pré-marcam um
  // valor PADRÃO no toggle normal (ver escolherBrutaoForca/Agilidade,
  // confirmarMagharMD, escolherMaestriaTeste, ensureRacePassivas), e o
  // jogador pode ligar/desligar livremente depois — aqui só lemos o estado
  // real do Teste. "Origem de Vento Bravo" é a ÚNICA que continua sendo um
  // bloqueio de verdade: nunca tem Mega Vantagem, em Teste nenhum, mesmo se
  // t.mv estiver marcado (proteção extra — o botão MV já fica desabilitado
  // pra esse personagem, ver renderTestes).
  const mvBloqueadaPorOrigem = p.origemId === 'humano_origem_vento_bravo';
  // "Grito de Guerra" (Campeão): Mega Vantagem em TODOS os Testes do Aliado
  // até o próximo turno, marcada em p.gritoDeGuerraAtivo (ver useSkill) — vale
  // como uma segunda fonte de Mega Vantagem, ao lado do toggle MV manual.
  const temMV = (t.mv || p.gritoDeGuerraAtivo) && !mvBloqueadaPorOrigem;
  const temMD = t.md;
  const isMega = !!(temMV || temMD);
  const d1 = 1 + Math.floor(Math.random() * sides);
  const d2 = isMega ? (1 + Math.floor(Math.random() * sides)) : null;
  const kept = !isMega ? d1 : (temMV ? Math.max(d1, d2) : Math.min(d1, d2));

  const dadoNode = isMega
    ? { type: 'megaroll', mode: temMV ? 'mv' : 'md', sides, d1, d2, kept }
    : { type: 'dice', sides, count: 1, results: [d1], sum: d1, countNode: null };

  const terms = [{ sign: '+', node: dadoNode }];
  let total = kept;

  if (mst) {
    terms.push({ sign: '+', node: { type: 'labeled_const', value: mst, label: 'maestria' } });
    total += mst;
  }

  // "Adaptação do Espaço" (Draenei): +3 fixo no Teste escolhido — é um termo
  // à parte, nunca mexe no Bônus manual configurado pelo jogador.
  if (p.adaptacaoTesteId === testeId && !['emocao', 'iniciativa', 'devocao'].includes(testeId)) {
    terms.push({ sign: '+', node: { type: 'labeled_const', value: 3, label: 'Adaptação' } });
    total += 3;
  }

  // "Decréptico" (Elfo): +1/+3 de Vantagem nos 2 Testes de Intelecto
  // escolhidos, e -2 de Desvantagem fixa em Resistir (não depende de escolha).
  if (p.decrepticoTeste1 === testeId) {
    terms.push({ sign: '+', node: { type: 'labeled_const', value: 1, label: 'Decréptico' } });
    total += 1;
  }
  if (p.decrepticoTeste2 === testeId) {
    terms.push({ sign: '+', node: { type: 'labeled_const', value: 3, label: 'Decréptico' } });
    total += 3;
  }
  if (testeId === 'resistir' && p.race === 'Elfo' && (p.passivas || []).some(pas => pas.racialId === 'elfo_decreptico')) {
    terms.push({ sign: '-', node: { type: 'labeled_const', value: 2, label: 'Decréptico' } });
    total -= 2;
  }

  // "Alta Montanha" (Origem, Tauren): +2 de Vantagem no Teste de Geografia,
  // ou +4 se o Teste for baseado em Natureza. O valor vem do popup de
  // rolarTesteClick/abrirAltaMontanhaGeografiaModal (p._altaMontanhaBonusTemp);
  // se o Teste for rolado por outro caminho sem passar pelo popup (ex: pelo
  // Narrador), assume o caso padrão (+2, "nos demais casos").
  if (testeId === 'geografia' && p.origemId === 'tauren_origem_alta_montanha') {
    const bonusAltaMontanha = p._altaMontanhaBonusTemp === 4 ? 4 : 2;
    terms.push({ sign: '+', node: { type: 'labeled_const', value: bonusAltaMontanha, label: 'Alta Montanha' } });
    total += bonusAltaMontanha;
  }

  // "Comum" (Origem, Troll): se NÃO houver troca configurada, o Teste de
  // Arcano e o de Místico recebem +1 de Vantagem fixo cada. Se houver troca
  // (ver mst lá em cima, que já usa a maestria do Teste trocado em vez da de
  // Intelecto), não recebe esse +1 em nenhum dos dois — é um ou outro.
  if ((testeId === 'arcano' || testeId === 'mistico') && p.origemId === 'troll_origem_comum' && !p.origemComumTrocaArea) {
    terms.push({ sign: '+', node: { type: 'labeled_const', value: 1, label: 'Comum' } });
    total += 1;
  }

  // "Normal" (Humano): passiva racial fixa (todo Humano tem, sem escolher)
  // — +2 de Vantagem em TODOS os Testes, exceto Iniciativa e Devoção. No
  // Teste de Emoção especificamente, o bônus vira +10 no lugar do +2.
  if (p.race === 'Humano' && !['iniciativa', 'devocao'].includes(testeId)) {
    const bonusNormal = isEmocao ? 10 : 2;
    terms.push({ sign: '+', node: { type: 'labeled_const', value: bonusNormal, label: 'Normal' } });
    total += bonusNormal;
  }

  // "Ambição Humana" (Humano): passiva racial fixa — na Beira da Morte
  // (HP 0), soma um dado extra de Vantagem: +1d8 em Resistir, +1d20 em
  // Emoção. É uma rolagem de verdade (aparece como um dado a mais no
  // breakdown), não um bônus fixo.
  if (p.race === 'Humano' && p.hp === 0 && (testeId === 'resistir' || isEmocao)) {
    const ambSides = testeId === 'resistir' ? 8 : 20;
    const ambRoll = 1 + Math.floor(Math.random() * ambSides);
    terms.push({ sign: '+', node: { type: 'dice', sides: ambSides, count: 1, results: [ambRoll], sum: ambRoll, countNode: null, label: 'Ambição Humana' } });
    total += ambRoll;
  }

  // "Origem de Vento Bravo" (Humano): +2 por escolha de Teste feita a cada
  // Nível (Agilidade/Força/Intelecto), acumulando até 2 escolhas no mesmo
  // Teste (+4 no máximo) — ver escolherVentoBravo/getVentoBravoBonus.
  const bonusVentoBravo = getVentoBravoBonus(p, testeId);
  if (bonusVentoBravo > 0) {
    terms.push({ sign: '+', node: { type: 'labeled_const', value: bonusVentoBravo, label: 'Vento Bravo' } });
    total += bonusVentoBravo;
  }

  // "Origem de Kalindor" (Humano): o Teste escolhido como alvo recebe um
  // 1d4 rolado de verdade — +1d4 se for o alvo de Vantagem, −1d4 se for o
  // de Desvantagem. Nunca vale pra Emoção/Iniciativa/Devoção (a escolha em
  // si já é bloqueada pra esses Testes, ver KALINDOR_TESTES_EXCLUIDOS).
  if (!KALINDOR_TESTES_EXCLUIDOS.includes(testeId)) {
    const papelKalindor = getKalindorPapel(p, testeId);
    if (papelKalindor) {
      const kalRoll = 1 + Math.floor(Math.random() * 4);
      const kalSign = papelKalindor === 'bonus' ? '+' : '-';
      terms.push({ sign: kalSign, node: { type: 'dice', sides: 4, count: 1, results: [kalRoll], sum: kalRoll, countNode: null, label: 'Kalindor' } });
      total += (kalSign === '+' ? kalRoll : -kalRoll);
    }
  }

  // "Análise Rápida" (Campeão): +1d4 de Vantagem rolado de verdade no Teste
  // de Percepção que a Habilidade aciona (marca deixada por useSkill) —
  // consumida aqui, então só vale para esta rolagem.
  if (testeId === 'percepcao' && p.analiseRapidaPendente) {
    const arRoll = 1 + Math.floor(Math.random() * 4);
    terms.push({ sign: '+', node: { type: 'dice', sides: 4, count: 1, results: [arRoll], sum: arRoll, countNode: null, label: 'Análise Rápida' } });
    total += arRoll;
    p.analiseRapidaPendente = false;
  }

  // "Motivar" (Campeão): +1d12 de Vantagem no próximo Teste do Aliado —
  // 1 uso só, consumido nesta rolagem (marca deixada por useSkill).
  if (p.motivarPendente) {
    const motRoll = 1 + Math.floor(Math.random() * 12);
    terms.push({ sign: '+', node: { type: 'dice', sides: 12, count: 1, results: [motRoll], sum: motRoll, countNode: null, label: 'Motivar' } });
    total += motRoll;
    p.motivarPendente = false;
  }

  // "Duelo" (Campeão): enquanto ativo, +1d6 de Vantagem se esta rolagem é
  // contra o Alvo do Duelo, ou -1d6 de Desvantagem se é contra outro Alvo —
  // o jogador escolhe qual dos dois pelo badge no cabeçalho (não é
  // consumido: continua valendo pra próxima rolagem até ele trocar de novo).
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

  // Teste de Emoção: subtrai a Insanidade atual do personagem (0-100)
  if (isEmocao && p.ins) {
    terms.push({ sign: '-', node: { type: 'labeled_const', value: p.ins, label: 'insanidade' } });
    total -= p.ins;
  }

  // Teste de Devoção (exclusivo de Clérigo): subtrai 20 para cada ponto de Pecado
  if (isDevocao && getPecado(p) > 0) {
    const penal = 20 * getPecado(p);
    terms.push({ sign: '-', node: { type: 'labeled_const', value: penal, label: `pecado x${getPecado(p)}` } });
    total -= penal;
  }

  // Bônus/penalidade configurado no teste (número fixo ou fórmula de dados)
  const bonusText = (t.bonus || '').trim();
  if (bonusText) {
    let sign = '+', rest = bonusText;
    if (rest[0] === '+' || rest[0] === '-') { sign = rest[0]; rest = rest.slice(1).trim(); }
    if (rest) {
      let bonusNode = null, bonusVal = 0;
      try {
        const parsed = parseFormula(rest);
        bonusVal = parsed.value;
        bonusNode = parsed.node;
      } catch (e) {
        const n = parseFloat(rest.replace(',', '.'));
        if (!isNaN(n)) { bonusVal = n; bonusNode = { type: 'const', value: n }; }
      }
      if (bonusNode) {
        terms.push({ sign, node: bonusNode });
        total += (sign === '-' ? -bonusVal : bonusVal);
      }
    }
  }

  // "Mente Equilibrada" (Pandaren): o resultado do Teste de Emoção é em
  // módulo — se o total (dado + maestria − insanidade + bônus) sair
  // negativo, vira positivo (valor absoluto).
  if (temMenteEquilibrada) {
    total = Math.abs(total);
  }

  const tree = { type: 'sum', terms, modulo: temMenteEquilibrada };
  const megaLabel = temMenteEquilibrada
    ? ' (Mega Vantagem, em módulo)'
    : (temMV ? ' (Mega Vantagem)' : (temMD ? ' (Mega Desvantagem)' : ''));
  const trocaLabel = origemComumTrocaAqui
    ? ` (usando maestria de ${(TESTES_LISTA.find(t => t.id === p.origemComumTrocaTesteId) || {}).name || ''})`
    : '';
  const formula = `Teste de ${def.name}${trocaLabel}${megaLabel}`;
  const { critMin, fumbleMax, fumbleImune } = getCritThresholds(p, testeId, sides);

  // "Treinamento Militar" (Orc): este Aparar é o marcado pela Habilidade —
  // some com a marca agora (é de 1 uso só) e sinaliza "Garantido" pro feed
  // de dados mostrar a etiqueta, independente do valor rolado.
  const treinamentoMilitarGarantido = testeId === 'aparar' && sides === 20 && !!p.treinamentoMilitarPendente;
  if (treinamentoMilitarGarantido) {
    p.treinamentoMilitarPendente = false;
  }

  return { def, sides, total, tree, formula, critMin, fumbleMax, fumbleImune, garantido: treinamentoMilitarGarantido };
}

// "Alta Montanha" (Origem, Tauren): Teste de Geografia tem +2 de Vantagem
// normalmente, mas +4 se o Teste for baseado em Natureza (trilhas, terreno,
// clima, fauna/flora do lugar). Como o app não sabe o contexto da pergunta
// do Narrador, pergunta ao jogador antes de rolar (só pra esse Teste, só
// pra quem tem essa Origem — os demais Testes rolam direto, sem popup).
function rolarTesteClick(pid, testeId) {
  const p = PLAYERS.find(x => x.id === pid);
  if (testeId === 'geografia' && p && p.origemId === 'tauren_origem_alta_montanha') {
    abrirAltaMontanhaGeografiaModal(pid);
    return;
  }
  rolarTeste(pid, testeId);
}

function abrirAltaMontanhaGeografiaModal(pid) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;
  overlay.innerHTML = `
    <div class="modal" style="max-width:380px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-mountain"></i> Alta Montanha</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:12px;line-height:1.5">
        Esse Teste de Geografia é baseado na Natureza do lugar (trilhas, terreno, clima, fauna e flora)?
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="tm-opcao tm-opcao-blue" onclick="fecharCriacaoAnaoModal();rolarTesteGeografiaComBonus(${p.id},4)">
          <span class="tm-opcao-nome">Sim, é sobre Natureza</span>
          <span class="tm-opcao-info">+4 de Vantagem</span>
        </button>
        <button class="tm-opcao tm-opcao-blue" onclick="fecharCriacaoAnaoModal();rolarTesteGeografiaComBonus(${p.id},2)">
          <span class="tm-opcao-nome">Não, é outro tipo</span>
          <span class="tm-opcao-info">+2 de Vantagem</span>
        </button>
      </div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="fecharCriacaoAnaoModal()">Cancelar</button>
    </div>`;
  overlay.classList.add('open');
}

function rolarTesteGeografiaComBonus(pid, bonus) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  // Bônus temporário só pra essa rolagem — construirRolagemTeste lê e a
  // gente limpa logo em seguida (não precisa persistir no personagem).
  p._altaMontanhaBonusTemp = bonus;
  rolarTeste(pid, 'geografia');
  delete p._altaMontanhaBonusTemp;
}

// Rola um Teste e publica o resultado no feed de dados. Retorna o total
// obtido (usado, por exemplo, pela Iniciativa para ordenar o combate).
function rolarTeste(pid, testeId) {
  if (!currentUser) return null;
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return null;
  const r = construirRolagemTeste(p, testeId);
  if (!r) return null;

  const entry = {
    playerName: currentUser.name || (IS_NARRADOR ? 'Narrador' : 'Jogador'),
    charName: p.name,
    isNarrator: !!IS_NARRADOR,
    formula: r.formula,
    tree: r.tree,
    total: r.total,
    sides: r.sides,
    critMin: r.critMin,
    fumbleMax: r.fumbleMax,
    fumbleImune: r.fumbleImune,
    hidden: hiddenPadrao(p),
    rolling: true,
    ts: Date.now(),
    ...(r.garantido ? { garantido: true, label: '⚔️ Treinamento Militar — Aparar Garantido (50% de Crítico)' } : {})
  };

  spinDiceFab(true, r.sides);
  pushRollEntry(entry, key => {
    setTimeout(() => finishRollEntry(key), ROLL_ANIM_MS);
    setTimeout(() => spinDiceFab(false), ROLL_ANIM_MS);
  });

  // "Entropia Constante" (Etéreo): Acerto Crítico ou Erro Crítico nesse
  // Teste dispara a rolagem da Expressão Etérea (1d6) sozinho, logo depois
  // do resultado do Teste aparecer.
  if (p.race === 'Etéreo') {
    const critInfo = rollCritInfo(entry);
    if (critInfo.hasCrit || critInfo.hasFumble) {
      setTimeout(() => rolarExpressaoEterea(pid, critInfo.hasCrit ? 'crit' : 'fumble'), ROLL_ANIM_MS + 250);
    }
  }

  // "Treinamento Militar" (Orc): a marca de "próximo Aparar" acabou de ser
  // consumida (ver construirRolagemTeste) — persiste isso pra todos na mesa
  // e some com o badge "pronto" da Habilidade. Se o Aparar saiu Crítico
  // (10+ no d20, pelo limiar especial), abre a escolha de recompensa.
  // Qualquer marca de 1 uso consumida em construirRolagemTeste (Motivar,
  // Análise Rápida, Treinamento Militar) só existe de fato pros outros na
  // mesa — e continua consumida depois de um F5 — se for salva e
  // re-renderizada agora. Sem isso, o badge ficava "grudado" pra quem ainda
  // não tinha rolado, e a marca podia voltar (efeito "voltou pra todo mundo")
  // se um sync do Firebase sobrescrevesse o estado local não salvo.
  saveState();
  renderAll();
  if (r.garantido) {
    const critInfo = rollCritInfo(entry);
    if (critInfo.hasCrit) {
      setTimeout(() => abrirTreinamentoMilitarEscolhaModal(pid), ROLL_ANIM_MS + 250);
    }
  }

  // Abre o painel de dados na aba Histórico para o resultado aparecer na hora.
  if (!dicePanelOpen) toggleDicePanel();
  else if (dicePanelTab !== 'feed') switchDiceTab('feed');

  return r.total;
}

// ─── Modal de escolha de Teste — habilidade "Teste Mental" ─────────────────
// A habilidade "Teste Mental" não é vinculada a um único Teste: pode ser
// usada com qualquer Teste de Intelecto (Arcano, Místico, Geografia,
// História) ou com o Teste de Emoção. Ao usar a habilidade, pergunta qual
// Teste rolar, já aplicando maestria, Mega Vantagem/Desvantagem e Bônus.
const TESTE_MENTAL_OPCOES = ['arcano', 'mistico', 'geografia', 'historia', 'emocao'];

function abrirTesteMentalModal(pid) {
  const overlay = document.getElementById('modal-teste-mental-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;
  getTestePersonagem(p);

  const opcoesHtml = TESTE_MENTAL_OPCOES.map(tid => {
    const def = TESTES_LISTA.find(t => t.id === tid);
    const isEmocao = tid === 'emocao';
    const t = p.testes[tid];
    const megaTag = (t.mv && p.origemId !== 'humano_origem_vento_bravo') ? '<span class="tm-opcao-mega mv">MV</span>' : (t.md ? '<span class="tm-opcao-mega md">MD</span>' : '');
    const infoTxt = isEmocao
      ? `1d100 − ${p.ins || 0} insanidade`
      : `1d20 +${maestriaDe(p, def.attr)} maestria`;
    return `<button class="tm-opcao ${isEmocao ? 'tm-opcao-gray' : 'tm-opcao-blue'}" onclick="escolherTesteMental(${p.id},'${tid}')">
      <span class="tm-opcao-nome">${def.name}${megaTag}</span>
      <span class="tm-opcao-info">${infoTxt}</span>
    </button>`;
  }).join('');

  overlay.innerHTML = `
    <div class="modal" style="max-width:420px">
      <h3><i class="ti ti-brain"></i> Teste Mental — ${escHtml(p.name)}</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:14px;line-height:1.5">
        Escolha qual Teste rolar: uma área Intelectual ou o Teste de Emoção.
      </div>
      <div class="tm-opcoes">${opcoesHtml}</div>
      <button class="tm-cancelar" onclick="fecharTesteMentalModal()">Cancelar</button>
    </div>`;
  overlay.classList.add('open');
}

function fecharTesteMentalModal() {
  const overlay = document.getElementById('modal-teste-mental-overlay');
  if (overlay) { overlay.classList.remove('open'); overlay.innerHTML = ''; }
}

function escolherTesteMental(pid, testeId) {
  fecharTesteMentalModal();
  rolarTeste(pid, testeId);
}

// ─── Modal de escolha de Arma — habilidade "Arsenal" ───────────────────────
// Ao usar Arsenal, mostra direto todas as Armas/Instrumentos do Inventário
// (+ a pseudo-opção "Sem Arma", pra guardar tudo e lutar desarmado) com um
// botão por item — clicar já chama toggleEquipArma/equiparSemArma, que
// tratam a checagem de Luta/marca pendente (_podeTrocarArmaEquipada).
function abrirArsenalModal(pid) {
  const overlay = document.getElementById('modal-arsenal-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;

  const armas = (p.inventario || []).filter(it => it.tipo === 'arma' || it.tipo === 'instrumento');
  const opcoesHtml = armas.map(item => {
    const jaEquipada = !!item.equipado;
    const icone = item.tipo === 'instrumento' ? 'ti-music' : 'ti-sword';
    return `<button class="tm-opcao ${item.tipo === 'instrumento' ? 'tm-opcao-blue' : 'tm-opcao-red'}" ${jaEquipada ? 'disabled style="opacity:0.5;cursor:default"' : ''} onclick="escolherArsenalArma(${p.id},'${item.id}')">
      <span class="tm-opcao-nome"><i class="ti ${icone}"></i> ${escHtml(item.name)}</span>
      <span class="tm-opcao-info">${jaEquipada ? 'Equipada' : 'Equipar'}</span>
    </button>`;
  }).join('');

  const semArmaEquipada = !armas.some(it => it.equipado);
  const semArmaHtml = `<button class="tm-opcao tm-opcao-gray" ${semArmaEquipada ? 'disabled style="opacity:0.5;cursor:default"' : ''} onclick="escolherArsenalSemArma(${p.id})">
      <span class="tm-opcao-nome"><i class="ti ti-hand-stop"></i> Sem Arma (lutar desarmado)</span>
      <span class="tm-opcao-info">${semArmaEquipada ? 'Equipada' : 'Equipar'}</span>
    </button>`;

  overlay.innerHTML = `
    <div class="modal" style="max-width:420px">
      <h3><i class="ti ti-backpack"></i> Arsenal — ${escHtml(p.name)}</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:14px;line-height:1.5">
        Escolha a Arma ou Instrumento para equipar.
      </div>
      <div class="tm-opcoes">${opcoesHtml}${semArmaHtml}</div>
      <button class="tm-cancelar" onclick="fecharArsenalModal()">Cancelar</button>
    </div>`;
  overlay.classList.add('open');
}

function fecharArsenalModal() {
  const overlay = document.getElementById('modal-arsenal-overlay');
  if (overlay) { overlay.classList.remove('open'); overlay.innerHTML = ''; }
}

function escolherArsenalArma(pid, itemId) {
  fecharArsenalModal();
  toggleEquipArma(pid, itemId);
}

function escolherArsenalSemArma(pid) {
  fecharArsenalModal();
  equiparSemArma(pid);
}

// Narrador revela para os jogadores uma rolagem que estava marcada como oculta
function revelarRolagem(key) {
  if (!IS_NARRADOR) return;
  if (firebaseConfigured && activeCampaignId && activeCampaignId !== 'local') {
    firebase.database().ref('campaigns/' + activeCampaignId + '/rolls/' + key + '/hidden').set(false);
  } else {
    const r = DICE_ROLLS.find(x => x.key === key);
    if (r) { r.hidden = false; renderDiceFeed(); }
  }
}

// Narrador exclui uma rolagem individual do histórico (ex: alguém errou a
// rolagem ou clicou sem querer). Some do chat de dados para todo mundo,
// diferente de limparChatDados() que apaga a mesa inteira.
function excluirRolagem(key) {
  if (!IS_NARRADOR) return;
  if (!confirm('Excluir esta rolagem do histórico?')) return;
  if (firebaseConfigured && activeCampaignId && activeCampaignId !== 'local') {
    firebase.database().ref('campaigns/' + activeCampaignId + '/rolls/' + key).remove();
  } else {
    DICE_ROLLS = DICE_ROLLS.filter(r => r.key !== key);
    renderedEntryKeys.delete(key);
    justRevealedKeys.delete(key);
    renderDiceFeed();
  }
}

function formatDiceTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function renderRollEntry(r, isNew) {
  const isFormula = !!r.tree;
  const notation = isFormula
    ? r.formula
    : `${r.qty}d${r.sides}${r.mod ? (r.mod > 0 ? '+' + r.mod : r.mod) : ''}`;
  const timeStr = formatDiceTime(r.ts);
  const who = r.isNarrator ? 'Narrador' : (r.playerName || 'Jogador');
  const charTag = r.charName ? ` <span class="dice-char">(${escHtml(r.charName)})</span>` : '';
  const newCls = isNew ? ' dice-entry-new' : '';
  const isLockedFromMe = r.hidden && !IS_NARRADOR;

  // Rolagem oculta e eu não sou o Narrador: mostro só o aviso, sem o resultado
  // (durante a animação, mostro que "algo" está sendo rolado, sem detalhes).
  if (isLockedFromMe) {
    const msg = r.rolling ? 'Rolando algo oculto…' : 'Fez uma rolagem oculta';
    const spinnerHtml = r.rolling ? '<span class="dice-spin-wrap dice-anim-generic"><svg viewBox="0 0 40 40"><rect x="6" y="6" width="28" height="28" rx="6" fill="currentColor" fill-opacity=".15" stroke="currentColor" stroke-width="2"/><text x="20" y="26" text-anchor="middle" font-size="16" fill="currentColor">?</text></svg></span>' : '';
    return `<div class="dice-entry dice-entry-hidden${newCls}">
      <div class="dice-entry-top">
        <span class="dice-who dice-who-nar"><i class="ti ti-lock"></i> Narrador</span>
        <span class="dice-time">${timeStr}</span>
      </div>
      <div class="dice-hidden-msg">${spinnerHtml} ${msg}</div>
    </div>`;
  }

  const labelHtml = r.label ? `<div class="dice-entry-label">${escHtml(r.label)}</div>` : '';

  // Ainda rolando: mostra o dado girando, sem revelar o resultado ainda.
  // (para fórmulas, r.sides é undefined — cai no ícone/animação genéricos)
  if (r.rolling) {
    const delBtnRolling = IS_NARRADOR ? `<button class="dice-del-btn" onclick="excluirRolagem('${r.key}')" title="Excluir rolagem"><i class="ti ti-trash"></i></button>` : '';
    return `<div class="dice-entry dice-entry-rolling ${r.isNarrator ? 'dice-entry-nar' : ''}${newCls}">
      <div class="dice-entry-top">
        <span class="dice-who ${r.isNarrator ? 'dice-who-nar' : ''}">${escHtml(who)}${charTag}</span>
        <span class="dice-time">${timeStr}</span>
        ${delBtnRolling}
      </div>
      ${labelHtml}
      <div class="dice-entry-mid">
        <span class="dice-notation">${escHtml(notation)}</span>
        <span class="dice-spin-wrap ${diceAnimClass(r.sides)}">${diceShapeSVG(r.sides)}</span>
        <span class="dice-rolling-text">rolando…</span>
      </div>
    </div>`;
  }

  const hiddenBadge = r.hidden ? `<span class="dice-badge-oculta">oculta p/ jogadores</span>` : '';
  const revealBtn = (r.hidden && IS_NARRADOR)
    ? `<button class="dice-reveal-btn" onclick="revelarRolagem('${r.key}')"><i class="ti ti-eye"></i> Revelar para os jogadores</button>`
    : '';
  const delBtn = IS_NARRADOR
    ? `<button class="dice-del-btn" onclick="excluirRolagem('${r.key}')" title="Excluir rolagem"><i class="ti ti-trash"></i></button>`
    : '';
  const justRevealed = justRevealedKeys.has(r.key);
  if (justRevealed) justRevealedKeys.delete(r.key);
  const popCls = justRevealed ? ' dice-total-pop' : '';

  const badgesHtml = isFormula
    ? `<div class="dice-formula-tree">${renderDiceNode(r.tree, { critMin: r.critMin, fumbleMax: r.fumbleMax, fumbleImune: r.fumbleImune })}</div>`
    : (() => {
        const badges = r.results.map(v => `<span class="dice-badge${diceCritClass(r.sides, v, r.critMin, r.fumbleMax, r.fumbleImune)}">${diceShapeSVG(r.sides, v)}</span>`).join('');
        const modHtml = r.mod ? `<span class="dice-mod-txt">${r.mod > 0 ? '+' + r.mod : r.mod}</span>` : '';
        return `<div class="dice-badges-row">${badges}${modHtml}</div>`;
      })();

  const critInfo = rollCritInfo(r);
  const critTagHtml = critInfo.hasCrit
    ? `<span class="dice-crit-tag">🎯 Crítico!</span>`
    : (critInfo.hasFumble ? `<span class="dice-fumble-tag">💀 Falha Crítica!</span>` : '');

  return `<div class="dice-entry ${r.isNarrator ? 'dice-entry-nar' : ''}${newCls}">
    <div class="dice-entry-top">
      <span class="dice-who ${r.isNarrator ? 'dice-who-nar' : ''}">${escHtml(who)}${charTag}</span>
      <span class="dice-time">${timeStr}</span>
      ${delBtn}
    </div>
    ${labelHtml}
    <div class="dice-entry-mid">
      <span class="dice-notation">${escHtml(notation)}</span>
      ${hiddenBadge}
    </div>
    ${badgesHtml}
    <div class="dice-entry-total${popCls}">${r.total}${critTagHtml}</div>
    ${revealBtn}
  </div>`;
}

function renderDiceFeed() {
  const feed = document.getElementById('dice-feed');
  if (feed) {
    if (!DICE_ROLLS.length) {
      feed.innerHTML = '<div class="dice-empty">Nenhuma rolagem ainda. Boa sorte!</div>';
    } else {
      feed.innerHTML = DICE_ROLLS.map(r => {
        const isNew = !renderedEntryKeys.has(r.key);
        renderedEntryKeys.add(r.key);
        return renderRollEntry(r, isNew);
      }).join('');
    }
  }
  renderLastRoll();
}

// Acha a rolagem mais recente feita pelo usuário logado (não a mais recente
// da mesa toda) — é o que aparece no resumo no fim da aba "Rolar".
function findLastOwnRoll() {
  if (!currentUser) return null;
  const myName = currentUser.name;
  return DICE_ROLLS.find(r => r.playerName === myName && !!r.isNarrator === !!IS_NARRADOR) || null;
}

// Resumo compacto do seu último lançamento, mostrado embaixo do construtor
// de rolagens — assim não é preciso trocar pra aba Histórico só pra ver o
// resultado que você acabou de rolar.
function renderLastRoll() {
  const box = document.getElementById('dice-last-roll');
  if (!box) return;
  const r = findLastOwnRoll();
  if (!r) { box.innerHTML = ''; return; }

  const isFormula = !!r.tree;
  const notation = isFormula
    ? r.formula
    : `${r.qty}d${r.sides}${r.mod ? (r.mod > 0 ? '+' + r.mod : r.mod) : ''}`;
  const timeStr = formatDiceTime(r.ts);

  if (r.rolling) {
    box.innerHTML = `
      <div class="dice-last-roll-label">Seu último lançamento</div>
      <div class="dice-last-roll-card dice-last-roll-rolling">
        <span class="dice-notation">${escHtml(notation)}</span>
        <span class="dice-spin-wrap ${diceAnimClass(r.sides)}">${diceShapeSVG(r.sides)}</span>
        <span class="dice-rolling-text">rolando…</span>
      </div>`;
    return;
  }

  if (r.hidden && !IS_NARRADOR) {
    box.innerHTML = `
      <div class="dice-last-roll-label">Seu último lançamento <span class="dice-time">${timeStr}</span></div>
      <div class="dice-last-roll-card">
        <span class="dice-hidden-msg"><i class="ti ti-lock"></i> Rolagem oculta — o Narrador ainda não revelou</span>
      </div>`;
    return;
  }

  const labelHtml = r.label ? `<div class="dice-entry-label">${escHtml(r.label)}</div>` : '';
  const badgesHtml = isFormula
    ? `<div class="dice-formula-tree">${renderDiceNode(r.tree, { critMin: r.critMin, fumbleMax: r.fumbleMax, fumbleImune: r.fumbleImune })}</div>`
    : (() => {
        const badges = r.results.map(v => `<span class="dice-badge${diceCritClass(r.sides, v, r.critMin, r.fumbleMax, r.fumbleImune)}">${diceShapeSVG(r.sides, v)}</span>`).join('');
        const modHtml = r.mod ? `<span class="dice-mod-txt">${r.mod > 0 ? '+' + r.mod : r.mod}</span>` : '';
        return `<div class="dice-badges-row">${badges}${modHtml}</div>`;
      })();
  const hiddenBadge = r.hidden ? `<span class="dice-badge-oculta">oculta p/ jogadores</span>` : '';

  const critInfoLast = rollCritInfo(r);
  const critTagHtmlLast = critInfoLast.hasCrit
    ? `<span class="dice-crit-tag">🎯 Crítico!</span>`
    : (critInfoLast.hasFumble ? `<span class="dice-fumble-tag">💀 Falha Crítica!</span>` : '');

  box.innerHTML = `
    <div class="dice-last-roll-label">Seu último lançamento <span class="dice-time">${timeStr}</span></div>
    <div class="dice-last-roll-card">
      <div class="dice-entry-mid">
        <span class="dice-notation">${escHtml(notation)}</span>
        ${hiddenBadge}
      </div>
      ${labelHtml}
      ${badgesHtml}
      <div class="dice-entry-total">${r.total}${critTagHtmlLast}</div>
    </div>`;
}
