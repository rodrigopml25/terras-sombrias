// ═══════════════════════════════════════
// SISTEMA DE LOGIN
// ═══════════════════════════════════════
// currentUser = { id, name, role: 'player'|'narrator' }
let currentUser = null;

// Detecta qual página está aberta
let IS_JOGADOR  = false;
let IS_NARRADOR = false;

function loginInit() {
  try {
    const saved = sessionStorage.getItem('ts_session');
    if (saved) currentUser = JSON.parse(saved);
  } catch(e) { currentUser = null; }
}

function setCurrentUser(user) {
  currentUser = user;
  sessionStorage.setItem('ts_session', JSON.stringify(user));
}

function logout() {
  currentUser = null;
  sessionStorage.removeItem('ts_session');
  location.reload();
}

// ═══════════════════════════════════════
// DADOS INICIAIS
// ═══════════════════════════════════════
const DEFAULT_PLAYERS = [];

// Bruxos possuem o Atributo Secundário exclusivo "Humanidade": começa cheio
// (10/10) ao se tornar Bruxo e o máximo é fixo — não existe forma de aumentá-lo.
const HUMANIDADE_MAX = 10;

// Retorna a Humanidade atual de um personagem (fallback para o máximo em
// fichas antigas que ainda não tinham esse campo).
function getHumanidade(p) {
  return (typeof p.humanidade === 'number') ? p.humanidade : HUMANIDADE_MAX;
}

// ── Notas musicais — exclusivo de Bardo ──────────────────────────────────────
// Cada Bardo possui 7 notas (Dó, Ré, Mi, Fá, Sol, Lá, Si) não acumuláveis:
// cada nota é um slot independente (ativa/inativa). Não existe estoque —
// tocar a mesma nota novamente não acumula; ela simplesmente já está ativa.
const NOTAS_MUSICAIS = ['Dó', 'Ré', 'Mi', 'Fá', 'Sol', 'Lá', 'Si'];

// Retorna o array de notas ativas de um personagem (fallback seguro para fichas antigas).
// Formato: { 'Dó': true, 'Mi': false, ... }
function getNotasBardo(p) {
  if (p.notasBardo && typeof p.notasBardo === 'object') return p.notasBardo;
  // Inicializa todas inativas
  const init = {};
  NOTAS_MUSICAIS.forEach(n => { init[n] = false; });
  return init;
}

// Quantas notas estão ativas atualmente
function countNotasAtivas(p) {
  const notas = getNotasBardo(p);
  return NOTAS_MUSICAIS.filter(n => notas[n]).length;
}

// ═══════════════════════════════════════
// TESTES
// ═══════════════════════════════════════
// Cada teste: { id, name, attr }
// attr: 'agi' | 'forca' | 'intel' | 'neutro'
const TESTES_LISTA = [
  { id: 'acrobacia',   name: 'Acrobacia',   attr: 'agi'    },
  { id: 'desviar',     name: 'Desviar',     attr: 'agi'    },
  { id: 'furtividade', name: 'Furtividade', attr: 'agi'    },
  { id: 'percepcao',   name: 'Percepção',   attr: 'agi'    },
  { id: 'aparar',      name: 'Aparar',      attr: 'forca'  },
  { id: 'arremessar',  name: 'Arremessar',  attr: 'forca'  },
  { id: 'empurrar',    name: 'Empurrar',    attr: 'forca'  },
  { id: 'resistir',    name: 'Resistir',    attr: 'forca'  },
  { id: 'arcano',      name: 'Arcano',      attr: 'intel'  },
  { id: 'mistico',     name: 'Místico',     attr: 'intel'  },
  { id: 'geografia',   name: 'Geografia',   attr: 'intel'  },
  { id: 'historia',    name: 'História',    attr: 'intel'  },
  { id: 'emocao',      name: 'Emoção',      attr: 'neutro' },
];

// Retorna o objeto de testes de um personagem, com fallback seguro.
// Formato: { acrobacia: { mv: false, md: false, bonus: '' }, ... }
function getTestePersonagem(p) {
  if (!p.testes || typeof p.testes !== 'object') p.testes = {};
  TESTES_LISTA.forEach(t => {
    if (!p.testes[t.id] || typeof p.testes[t.id] !== 'object') {
      p.testes[t.id] = { mv: false, md: false, bonus: '' };
    }
  });
  return p.testes;
}

// ═══════════════════════════════════════
// PASSIVAS RACIAIS
// ═══════════════════════════════════════
// Cada raça pode ter passivas fixas que todo personagem daquela raça possui
// automaticamente — aparecem na aba Passivas/Talentos sem precisar serem
// cadastradas manualmente. Outras raças serão preenchidas depois.
const RACAS = {
  'Anão': [
    { id: 'anao_dourado', name: 'Dourado', desc: 'Por ter praticado anos de ferraria, você possui acesso a Aprimoramentos Dourados para suas Armas. Cada Aprimoramento Dourado custa 300 de Dinheiro.' },
    { id: 'anao_criacao', name: 'Criação de Anão', desc: 'Usar 1 vez por Personagem: Funda 2 armas que possuam Aprimoramento Dourado. Só você saberá como usá-la. A fusão custa 500 de Dinheiro.' },
  ],
  'Draenei': [
    { id: 'draenei_tecnologia', name: 'Tecnologia Draenei', desc: 'Tem acesso aos aprimoramentos de Armadura e Elmo do "Equipamento Exótico". Esses aprimoramentos custam 5 vezes mais apenas quando aplicados a Armaduras e Elmos Comuns, e só pode haver um aprimoramento por Armadura e Elmo comum.' },
  ],
};

// Habilidades raciais fixas — funcionam igual às habilidades gerais mas são
// exclusivas de cada raça. Formato idêntico ao GENERAL_SKILLS.
const RACAS_SKILLS = {
  'Draenei': [
    { id: 'sk_racial_draenei_adaptacao', name: 'Adaptação do Espaço', color: 'gray', cost: 0, tipo: 'sessao', usosMax: 3, desc: 'Possui +3 de Vantagem em um teste (sem ser de Emoção). Usar (3x por sessão): troque o Teste em que a Vantagem está. (não pode usar esta habilidade numa Luta). Precisa de 0 ações para ser usada.' },
  ],
};

// Retorna a lista de habilidades raciais de uma raça (ou [] se não houver).
function getRaceSkills(raceName) {
  return RACAS_SKILLS[raceName] || [];
}

// Garante que as habilidades raciais da raça estejam presentes em p.skills,
// sem duplicar e sem recolocar as que o jogador removeu (rastreado em p.racialSkillsRemovidas).
function ensureRaceSkills(p) {
  if (!Array.isArray(p.skills)) p.skills = [];
  if (!Array.isArray(p.racialSkillsRemovidas)) p.racialSkillsRemovidas = [];
  getRaceSkills(p.race).forEach(def => {
    const jaTem = p.skills.some(sk => sk.id === def.id);
    const foiRemovida = p.racialSkillsRemovidas.includes(def.id);
    if (!jaTem && !foiRemovida) {
      p.skills.push({
        id: def.id, name: def.name, desc: def.desc,
        color: def.color, cost: def.cost, tipo: def.tipo,
        usosMax: def.usosMax, usosAtuais: def.usosMax,
        cdRestante: 0, turnosRecarga: 1,
      });
    }
  });
}

// Origens exclusivas de cada raça. Cada entrada da lista representa uma origem
// possível; ao escolher uma, o personagem ganha a passiva correspondente.
// Formato: { id, name, desc (descrição da origem), passiva: { id, name, desc } }
const RACAS_ORIGENS = {
  'Anão': [
    {
      id: 'anao_origem_comum',
      name: 'Comum',
      desc: 'Criado nas comunidades anãs tradicionais, entre forjas, tavernas e guildas.',
      passiva: {
        id: 'anao_origem_comum_passiva',
        name: 'Origem Comum',
        desc: 'Ao subir de Nível, escolha uma Arma de sua categoria Leve, Média ou Pesada (e se tiver acesso a Mega Pesada também) diferente e ganhe-a gratuitamente; role 1d10 com Mega Vantagem e, caso obtenha 7 ou mais, poderá conceder a ela um Aprimoramento Dourado gratuitamente, à sua escolha.',
      },
    },
    {
      id: 'anao_origem_profundezas',
      name: 'Profundezas',
      desc: 'Criado nas cavernas subterrâneas, longe da luz do sol, entre mineradores e guardiões das minas.',
      passiva: {
        id: 'anao_origem_profundezas_passiva',
        name: 'Origem das Profundezas',
        desc: 'Por ter vivido sob a terra, você possui a capacidade de enxergar na escuridão natural. Escolha uma Arma e ela terá +1 de Dano; ao subir de Nível, repita a escolha. Mesmo que a Arma seja quebrada, o efeito é mantido em suas cópias.',
      },
    },
  ],
  'Draenei': [
    {
      id: 'draenei_origem_comum',
      name: 'Comum',
      desc: 'Os Draenei que fugiram da Legião Ardente conseguiram aprimorar sua tecnologia.',
      passiva: {
        id: 'draenei_origem_comum_passiva',
        name: 'Origem Comum',
        desc: 'Também possui acesso aos Aprimoramentos de Arma do "Equipamento Exótico". Esses aprimoramentos custam 5 vezes mais apenas quando aplicados a Armas comuns, e só pode haver um aprimoramento por Arma Comum.',
      },
    },
    {
      id: 'draenei_origem_demoniaco',
      name: 'Demoníaco',
      desc: 'Os Draenei que decidiram se aliar à Legião Ardente tomaram sangue de demônio, tornando suas peles vermelhas e concedendo-lhes Asas.',
      passiva: {
        id: 'draenei_origem_demoniaco_passiva',
        name: 'Origem Demoníaca',
        desc: 'Recebem +2 de Passos, não sofrem dano de queda e, ao subir de Nível, receberão +1 de Passos e 1d8 de Insanidade.',
      },
    },
    {
      id: 'draenei_origem_forjado',
      name: 'Forjado a Luz',
      desc: 'Os Draenei que negaram fugir de Argus e decidiram confrontar a Legião Ardente receberam um apoio da Luz.',
      skill: {
        id: 'sk_origem_draenei_forjado_luz',
        name: 'Forjado a Luz',
        color: 'gray',
        cost: 1,
        tipo: 'sessao',
        usosMax: 4,
        desc: 'Os Draenei que negaram a fugir de Argus e decidiram confrontar a Legião Ardente receberam um apoio da Luz, tendo uma Marca Sagrada da Luz. Escolha uma Benção da Luz e lance-a. (4x por sessão, 1 ação para ser lançado)',
      },
    },
  ],
};

// Retorna a lista de origens disponíveis para uma raça (ou [] se não houver).
function getRaceOrigens(raceName) {
  return RACAS_ORIGENS[raceName] || [];
}

// Retorna o objeto de origem de um personagem (ou null).
function getOrigemPersonagem(p) {
  const origens = getRaceOrigens(p.race);
  if (!origens.length || !p.origemId) return null;
  return origens.find(o => o.id === p.origemId) || null;
}

// Garante que a passiva de origem racial esteja em p.passivas.
// Remove passivas de origens anteriores que não correspondam mais à origem atual.
// Para origens com `skill` (em vez de `passiva`), injeta/remove a habilidade em p.skills.
function ensureOrigemPassiva(p) {
  if (!Array.isArray(p.passivas)) p.passivas = [];
  if (!Array.isArray(p.skills)) p.skills = [];
  const origens = getRaceOrigens(p.race);
  if (!origens.length) return;

  // Remove passivas e habilidades de origens que não sejam a selecionada
  origens.forEach(o => {
    if (o.id !== p.origemId) {
      p.passivas = p.passivas.filter(pas => pas.origemId !== o.id);
      if (o.skill) {
        p.skills = p.skills.filter(sk => sk.id !== o.skill.id);
      }
    }
  });

  if (!p.origemId) return;
  const origemAtual = origens.find(o => o.id === p.origemId);
  if (!origemAtual) return;

  if (origemAtual.skill) {
    // Origem com habilidade — injeta em p.skills
    const jaTem = p.skills.some(sk => sk.id === origemAtual.skill.id);
    if (!jaTem) {
      const def = origemAtual.skill;
      p.skills.push({
        id: def.id, name: def.name, desc: def.desc,
        color: def.color, cost: def.cost, tipo: def.tipo,
        usosMax: def.usosMax, usosAtuais: def.usosMax,
        cdRestante: 0, turnosRecarga: 1,
      });
    }
  } else if (origemAtual.passiva) {
    // Origem com passiva — injeta em p.passivas
    const jaTem = p.passivas.some(pas => pas.origemId === p.origemId);
    if (!jaTem) {
      p.passivas.push({
        id: 'pas_origem_' + p.origemId,
        origemId: p.origemId,
        racialId: origemAtual.passiva.id,
        name: origemAtual.passiva.name,
        desc: origemAtual.passiva.desc,
      });
    }
  }
}

// Retorna a lista de passivas raciais fixas de um personagem (vazio se a
// raça não tiver passivas cadastradas no catálogo acima).
function getRacePassivas(p) {
  return RACAS[p.race] || [];
}

// Garante que as passivas raciais da raça do personagem estejam presentes em
// p.passivas (como qualquer outra passiva — editável e excluível). Não
// duplica as que já existem e não recoloca uma que o jogador excluiu de
// propósito (rastreado em p.racialPassivasRemovidas).
function ensureRacePassivas(p) {
  if (!Array.isArray(p.passivas)) p.passivas = [];
  if (!Array.isArray(p.racialPassivasRemovidas)) p.racialPassivasRemovidas = [];
  getRacePassivas(p).forEach(rp => {
    const jaTem = p.passivas.some(pas => pas.racialId === rp.id);
    const foiRemovida = p.racialPassivasRemovidas.includes(rp.id);
    if (!jaTem && !foiRemovida) {
      p.passivas.push({ id: 'pas_racial_' + rp.id, racialId: rp.id, name: rp.name, desc: rp.desc });
    }
  });
  // Garante que a passiva de origem racial também esteja presente
  ensureOrigemPassiva(p);
  // Garante que as habilidades raciais estejam presentes
  ensureRaceSkills(p);
}

// ═══════════════════════════════════════
// CLASSES E SUBCLASSES
// ═══════════════════════════════════════
// attr: atributo principal da subclasse ('agi' | 'forca' | 'intel')
const CLASSES = [
  { name: 'Guerreiro', subs: [
    { name: 'Campeão',           attr: 'agi'   },
    { name: 'Combatente',        attr: 'forca' },
    { name: 'Soldado Elementar', attr: 'intel' },
  ]},
  { name: 'Ladino', subs: [
    { name: 'Mercenário',  attr: 'agi'   },
    { name: 'Briguento',   attr: 'forca' },
    { name: 'Ilusionista', attr: 'intel' },
  ]},
  { name: 'Mago', subs: [
    { name: 'Criador de Runa',    attr: 'agi'   },
    { name: 'Feiticeiro de Fogo', attr: 'forca' },
    { name: 'Conjurador',         attr: 'intel' },
  ]},
  { name: 'Bruxo', subs: [
    { name: 'Alquimista',            attr: 'agi'   },
    { name: 'Receptáculo Demoníaco', attr: 'forca' },
    { name: 'Amaldiçoado',           attr: 'intel' },
  ]},
  { name: 'Bardo', subs: [
    { name: 'Dançarino',      attr: 'agi'   },
    { name: 'Roqueiro',       attr: 'forca' },
    { name: 'Maestro Macabro',attr: 'intel' },
  ]},
  { name: 'Clérigo', subs: [
    { name: 'Exorcista', attr: 'agi'   },
    { name: 'Paladino',  attr: 'forca' },
    { name: 'Acólito',   attr: 'intel' },
  ]},
];

// Retorna o atributo principal (agi/forca/intel) dada uma subclasse pelo nome
function getSubAttr(subclasseName) {
  for (const cls of CLASSES) {
    const sub = cls.subs.find(s => s.name === subclasseName);
    if (sub) return sub.attr;
  }
  return null;
}

// Retorna a classe-base (Guerreiro, Ladino…) dado o nome de uma subclasse
function getBaseClass(subclasseName) {
  for (const cls of CLASSES) {
    if (cls.subs.some(s => s.name === subclasseName)) return cls.name;
  }
  return null;
}

// Habilidades gerais — todo personagem possui. cor segue o atributo:
// green = Agilidade, red = Força, blue = Intelecto, gray = Neutro.
// "0 recarga" no material original = uso livre (infinite); "1 recarga" = recarrega por turno (perturn).
const GENERAL_SKILLS = [
  { name: 'Arremesso',     color: 'red',  cost: 1, tipo: 'infinite', desc: 'Faça um teste de Arremesso para arremessar um objeto que você consiga carregar. Se acertar um Alvo que possa receber Dano e que não tenha sido atingido por uma arma, cause: Leve → 1d4; Médio → 1d6; Pesado → 1d8 e Mega Pesado → 1d10 de dano.' },
  { name: 'Acrobacia',     color: 'green', cost: 1, tipo: 'perturn', desc: 'Faça um teste de Acrobacia para fazer uma manobra. Caso queira se movimentar, consumirá a Ação de Movimento também e receberá um deslocamento extra para a maestria de Peso: Leve +6 casas; Médio +4 casas; Pesado +2 casas ou Mega Pesado +1 casa.' },
  { name: 'Arsenal',       color: 'gray', cost: 1, tipo: 'perturn', desc: 'Equipe uma Arma, troque de Arma OU pegue e equipe uma Arma do chão.' },
  { name: 'Beber Poção',   color: 'gray', cost: 1, tipo: 'infinite', desc: 'Consuma uma Poção. Se for de Cura: Cure apenas 1d20 de Vida OU Cure apenas 10 de Vida (Requer uma Poção).' },
  { name: 'Empurrar',      color: 'red',  cost: 1, tipo: 'perturn', desc: 'Faça um Teste de Empurrar para deslocar um Objeto ou alguém que você aguenta em 1d2 Casa(s); para cada Maestria de Peso superior que você tiver em relação ao Alvo, empurrará +2 casas.' },
  { name: 'Correr',        color: 'gray', cost: 1, tipo: 'perturn', desc: 'Ganha mais uma ação de movimento neste turno.' },
  { name: 'Engajar',       color: 'gray', cost: 1, tipo: 'perturn', desc: 'Neste turno pode se mover perto de inimigos sem ser atacado.' },
  { name: 'Recurso',       color: 'gray', cost: 1, tipo: 'perturn', desc: 'Pegue um objeto na sua mochila, para cada 1 dos Dados = 25 de Dinheiro: Pequeno - 1d2; Médio - 1d4; Grande - 1d6 OU Poção de cura - 2.' },
  { name: 'Teste Mental',  color: 'blue', cost: 1, tipo: 'perturn', desc: 'Faça um teste de uma área intelectual ou de Emoção, esse último é 1d100 − Insanidade.' },
  { name: 'Furtividade',   color: 'green', cost: 1, tipo: 'perturn', desc: 'Faça um teste de Furtividade; a dificuldade varia conforme o grau de luminosidade ao qual está exposto. Se estiver totalmente exposto à luz, não pode fazer o teste.' },
];

function makeGeneralSkill(def) {
  return {
    id: 'sk_geral_' + def.name.toLowerCase().replace(/\s+/g, '_'),
    name: def.name, desc: def.desc, color: def.color, cost: def.cost, tipo: def.tipo,
    usosMax: def.tipo === 'infinite' ? 99 : 1,
    usosAtuais: def.tipo === 'infinite' ? 99 : 1,
    cdRestante: 0, turnosRecarga: 1
  };
}

// Garante que um personagem tenha todas as habilidades gerais, sem duplicar
// e sem resetar o progresso (usos/cooldown) das que ele já possui.
function ensureGeneralSkills(p) {
  if (!Array.isArray(p.skills)) p.skills = [];
  GENERAL_SKILLS.forEach(def => {
    const jaTem = p.skills.some(sk => sk.id === 'sk_geral_' + def.name.toLowerCase().replace(/\s+/g, '_'));
    if (!jaTem) p.skills.push(makeGeneralSkill(def));
  });
}

const AVATARS = [
  {bg:'#0a1e18', color:'#2aaa82'},
  {bg:'#0f1a2e', color:'#4a8fd4'},
  {bg:'#1a1228', color:'#9a7cdf'},
  {bg:'#220f0f', color:'#c94040'},
];
const NOTETAGS = ['Geral','Missão','Inimigos','Locais'];

// ═══════════════════════════════════════
// ESTADO LOCAL
// ═══════════════════════════════════════
let PLAYERS = [];
let turnGlobal = 1;
let INITIATIVE = [];
let curI = 0;
let notes = {geral:'', missão:'', inimigos:'', locais:''};
let activeNote = 'geral';

let modalPid = null;
let modalSkid = null;
let modalColor = 'green';
let modalCharId = null;
let modalPassivaPid = null;
let modalPassivaId = null;
let narPassivasExpanded = {}; // { [playerId]: true/false } — estado local, não sincroniza
let narSkillsExpanded = {};  // { [playerId]: true/false } — mostra habilidades agrupadas
let jogTestesCollapsed = true;   // jogador: começa fechado
let narTestesCollapsed = {};     // narrador: { [playerId]: true/false } — começa fechado
let jogSkillsCollapsed = { green: true, red: true, blue: true, gray: true, passivas: true }; // começa fechado
let jogInvCollapsed = { armas: true, protecoes: true, instrumentos: true, itens: true }; // inventário começa fechado
let jogActiveTab = 'ficha'; // 'ficha' | 'anotacoes'
let modalInvPid = null;
let modalInvId = null;

let firebaseRef = null;
let firebaseOnline = false;
let firebaseConfigured = false;
let saveDebounceTimer = null;
let lastWrittenJSON = null;
let pendingSave = false;
let pendingSaveSafetyTimer = null;

// ═══════════════════════════════════════
// CAMPANHAS
// ═══════════════════════════════════════
let activeCampaignId = null;     // id da campanha atualmente carregada
let activeCampaignMeta = null;   // { name, code, ownerId }
let dataListenerRef = null;      // ref do listener .on('value') atual (p/ poder desligar ao trocar campanha)
let dataListenerHandler = null;

function snapshotState() {
  return { PLAYERS, turnGlobal, INITIATIVE, curI, notes };
}

function applyData(data) {
  PLAYERS = data.PLAYERS || [];
  PLAYERS.forEach(p => {
    if (!Array.isArray(p.skills)) p.skills = [];
    if (!Array.isArray(p.passivas)) p.passivas = [];
    if (!Array.isArray(p.inventario)) p.inventario = [];
    ensureGeneralSkills(p);
    ensureRacePassivas(p);
    if (typeof p.armaduraMax !== 'number') p.armaduraMax = typeof p.armadura === 'number' ? p.armadura : 10;
    if (typeof p.armadura !== 'number') p.armadura = p.armaduraMax;
    if (p.armadura > p.armaduraMax) p.armadura = p.armaduraMax;
    if (typeof p.elmoMax !== 'number') p.elmoMax = typeof p.elmo === 'number' ? p.elmo : 0;
    if (typeof p.elmo !== 'number') p.elmo = p.elmoMax;
    if (p.elmo > p.elmoMax) p.elmo = p.elmoMax;
    if (typeof p.passos !== 'number') p.passos = 6;
    if (typeof p.dinheiro !== 'number') p.dinheiro = 100;
    if (typeof p.cristais !== 'number') p.cristais = 0;
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
    recomputeProtMax(p);
    // Migração: testes — fichas antigas que ainda não têm o campo
    getTestePersonagem(p);
  });
  turnGlobal = data.turnGlobal || 1;
  INITIATIVE = data.INITIATIVE || [];
  curI = data.curI || 0;
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

  const metaRef = firebase.database().ref('campaigns/' + campaignId + '/meta');
  const dataRef = firebase.database().ref('campaigns/' + campaignId + '/data');
  firebaseRef = dataRef;

  metaRef.once('value').then(snap => {
    activeCampaignMeta = snap.val() || { name: 'Campanha' };
    renderCampaignBadge();
  });

  dataRef.once('value').then(snapshot => {
    const data = snapshot.val();
    if (data) {
      applyData(data);
    } else {
      PLAYERS = JSON.parse(JSON.stringify(DEFAULT_PLAYERS));
      turnGlobal = 1; INITIATIVE = []; curI = 0;
      notes = {geral:'', missão:'', inimigos:'', locais:''};
      lastWrittenJSON = JSON.stringify(snapshotState());
      dataRef.set(snapshotState());
    }
    firebaseOnline = true;
    setSyncStatus('on');
    renderAll();

    dataListenerHandler = snapshot2 => {
      if (pendingSave) return;
      const incoming = snapshot2.val();
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
  activeCampaignId = null;
  activeCampaignMeta = null;
  PLAYERS = []; INITIATIVE = []; curI = 0;
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
  const localKey = 'rpg_dashboard_data_' + (activeCampaignId || 'local');
  localStorage.setItem(localKey, JSON.stringify(snapshotState()));
  if (!firebaseRef) return;

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
function tipoLabel(sk) {
  if (sk.tipo==='infinite') return '∞ livre';
  if (sk.tipo==='perturn')  return '1/turno';
  if (sk.tipo==='luta')     return sk.usosMax + 'x/luta';
  if (sk.tipo==='sessao')   return sk.usosMax + 'x/sessão';
  if (sk.tipo==='turno_N')  return sk.turnosRecarga + '⏳ turnos';
  return '';
}
function isReady(sk) {
  if (sk.tipo==='infinite') return true;
  if (sk.tipo==='perturn')  return sk.usosAtuais > 0;
  if (sk.tipo==='luta' || sk.tipo==='sessao') return sk.usosAtuais > 0;
  if (sk.tipo==='turno_N')  return sk.cdRestante === 0 && sk.usosAtuais > 0;
  return false;
}

// ═══════════════════════════════════════
// AÇÕES GLOBAIS
// ═══════════════════════════════════════
function useSkill(pid, skid) {
  const p = PLAYERS.find(x => x.id === pid);
  const sk = p && p.skills.find(s => s.id === skid);
  if (!sk || !isReady(sk) || sk.tipo === 'infinite') return;
  sk.usosAtuais = Math.max(0, sk.usosAtuais - 1);
  if (sk.tipo === 'turno_N' && sk.usosAtuais === 0) sk.cdRestante = sk.turnosRecarga;
  saveState();
  renderAll();
}

function nextTurnGlobal() {
  turnGlobal++;
  PLAYERS.forEach(p => p.skills.forEach(sk => {
    if (sk.tipo === 'perturn') { sk.usosAtuais = sk.usosMax; }
    if (sk.tipo === 'turno_N' && sk.cdRestante > 0) {
      sk.cdRestante--;
      if (sk.cdRestante === 0) sk.usosAtuais = sk.usosMax;
    }
  }));
  saveState();
  renderAll();
}

function resetLuta() {
  if (!confirm('Resetar todos os usos por luta e reiniciar os turnos?')) return;
  turnGlobal = 1;
  PLAYERS.forEach(p => {
    p.skills.forEach(sk => {
      if (['perturn','luta','turno_N'].includes(sk.tipo)) {
        sk.usosAtuais = sk.usosMax;
        sk.cdRestante = 0;
      }
    });
    // Notas do Bardo: resetar no início de cada luta
    if (p.classeBase === 'Bardo' && p.notasBardo) {
      NOTAS_MUSICAIS.forEach(n => { p.notasBardo[n] = false; });
    }
  });
  saveState();
  renderAll();
}

function resetSessao() {
  if (!confirm('Resetar todos os usos por sessão?')) return;
  PLAYERS.forEach(p => {
    p.skills.forEach(sk => { sk.usosAtuais = sk.usosMax; sk.cdRestante = 0; });
    // Notas do Bardo: resetar também no reset de sessão
    if (p.classeBase === 'Bardo' && p.notasBardo) {
      NOTAS_MUSICAIS.forEach(n => { p.notasBardo[n] = false; });
    }
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
  if (!p) return; p.ins = Math.max(0, Math.min(100, p.ins + d));
  saveState(); renderAll();
}

function setIns(id, val) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return;
  const v = parseInt(val);
  if (isNaN(v)) { renderAll(); return; }
  p.ins = Math.max(0, Math.min(100, v));
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

function adjArmadura(id, d) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return; p.armadura = Math.max(0, Math.min(p.armaduraMax || 0, (p.armadura || 0) + d));
  saveState(); renderAll();
}

function setArmadura(id, val) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return;
  const v = parseInt(val);
  if (isNaN(v)) { renderAll(); return; }
  p.armadura = Math.max(0, Math.min(p.armaduraMax || 0, v));
  saveState(); renderAll();
}

function adjElmo(id, d) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return; p.elmo = Math.max(0, Math.min(p.elmoMax || 0, (p.elmo || 0) + d));
  saveState(); renderAll();
}

function setElmo(id, val) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return;
  const v = parseInt(val);
  if (isNaN(v)) { renderAll(); return; }
  p.elmo = Math.max(0, Math.min(p.elmoMax || 0, v));
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
}

function addXP(id) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return;
  if (p.xp >= 10 && p.level < 5) { p.xp = 0; p.level++; }
  else if (p.xp < 10) p.xp++;
  saveState(); renderAll();
}

function removeXP(id) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return;
  if (p.xp > 0) { p.xp--; }
  else if (p.level > 1) { p.level--; p.xp = 9; }
  saveState(); renderAll();
}

// ═══════════════════════════════════════
// RENDER NARRADOR
// ═══════════════════════════════════════
function renderNarrador() {
  const container = document.getElementById('nar-players');
  if (!container) return;

  container.innerHTML = PLAYERS.map((p, i) => {
    const av = AVATARS[i % AVATARS.length];
    const hpPct = Math.round(p.hp / p.hpMax * 100);
    const insPct = Math.round(p.ins);
    const armPct = p.armaduraMax > 0 ? Math.round(p.armadura / p.armaduraMax * 100) : 0;
    const elmPct = p.elmoMax > 0 ? Math.round(p.elmo / p.elmoMax * 100) : 0;
    const isBruxo = p.classeBase === 'Bruxo';
    const isBardo = p.classeBase === 'Bardo';
    const humanPct = Math.round(getHumanidade(p) / HUMANIDADE_MAX * 100);
    const bm = p.hp === 0;

    // ── Habilidades agrupadas por atributo ──
    const gruposNar = { green:[], red:[], blue:[], gray:[] };
    p.skills.forEach(sk => gruposNar[sk.color] && gruposNar[sk.color].push(sk));
    const narGrupoInfo = {
      green: { label: 'Agilidade', icon: '🏃', attr: p.agi },
      red:   { label: 'Força',     icon: '⚔️',  attr: p.forca },
      blue:  { label: 'Intelecto', icon: '✨',  attr: p.intel },
      gray:  { label: 'Neutras',   icon: '⚙️',  attr: null },
    };

    const skillsExpanded = !!narSkillsExpanded[p.id];
    const passivasExpanded = !!narPassivasExpanded[p.id];

    let gruposHtml = '';
    ['green','red','blue','gray'].forEach(cor => {
      if (!gruposNar[cor].length) return;
      const info = narGrupoInfo[cor];
      const mst = info.attr != null ? maestria(info.attr) : null;
      const chips = gruposNar[cor].map(sk => {
        const ready = isReady(sk);
        let extra = '';
        if (sk.tipo === 'turno_N' && sk.cdRestante > 0) extra = `<span class="chip-cd">⏳${sk.cdRestante}</span>`;
        else if ((sk.tipo==='luta'||sk.tipo==='sessao') && sk.usosAtuais < sk.usosMax) extra = `<span class="chip-cd">${sk.usosAtuais}/${sk.usosMax}</span>`;
        const descTooltip = sk.desc ? `Efeito: ${sk.desc}\n\n` : '';
        const statusTooltip = ready ? 'Pronta para uso' : `Indisponível (${tipoLabel(sk)})`;
        return `<div class="skill-chip sc-${cor} ${ready?'':'used'}" onclick="useSkill(${p.id},'${sk.id}')" title="${sk.name}\n${descTooltip}${statusTooltip}">
          <span class="chip-dot"></span><span class="chip-name">${sk.name}</span><span class="chip-badge">${tipoLabel(sk)}</span>${extra}
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
          return `<div class="nar-passiva-item"><div class="nar-passiva-name">${pas.name}${tag}</div><div class="nar-passiva-desc">${pas.desc || '<em>Nenhum efeito descrito.</em>'}</div></div>`;
        }).join('')
      : '<div style="font-size:12px;color:var(--text3);padding:4px 0">Nenhuma passiva cadastrada.</div>';

    const origemSubLabel = origemObj ? ` · <span style="color:var(--accent2);font-size:11px">⛏ ${origemObj.name}</span>` : '';
    return `<div class="prow ${bm ? 'beira-morte' : ''}">
      <div class="prow-header">
        <div class="av" style="background:${av.bg};color:${av.color}">${p.name.slice(0,2).toUpperCase()}</div>
        <div><div class="prow-name">${p.name}</div><div class="prow-sub">${p.race}${origemSubLabel} · ${p.classeBase || p.cls} · ${p.classeBase ? p.cls + ' · ' : ''}Nv ${p.level}${p.ownerName ? ' · <span style="color:var(--accent);font-size:11px">👤 ' + p.ownerName + '</span>' : ''}</div></div>
        <div class="mini-stats">
          <span class="mstat mstat-hp">❤ ${p.hp}/${p.hpMax}</span><span class="mstat mstat-ins">🧠 ${p.ins}</span>${isBruxo ? `<span class="mstat mstat-human">🩸 ${getHumanidade(p)}/${HUMANIDADE_MAX}</span>` : ''}${isBardo ? `<span class="mstat mstat-bardo">🎵 ${countNotasAtivas(p)}/7</span>` : ''}<span class="mstat mstat-arm">🛡 ${p.armadura || 0}/${p.armaduraMax || 0}</span><span class="mstat mstat-elm">⛑ ${p.elmo || 0}/${p.elmoMax || 0}</span><span class="mstat mstat-passos">👣 ${p.passos || 0}</span><span class="mstat mstat-money">💰 ${p.dinheiro || 0}</span>
          ${(p.inventario || []).some(i => i.peso === 'exotica' || (Array.isArray(i.aprimoramentos) && i.aprimoramentos.length > 0 && !i.aprimoramentos.every(a => a.name === 'Dourado'))) ? `<span class="mstat" style="color:var(--accent2)">💎 ${p.cristais || 0}</span>` : ''}
          ${bm ? '<span class="mstat mstat-bm">⚠ Beira Morte</span>' : ''}
        </div>
        <button class="prow-edit-btn ${skillsExpanded ? 'prow-passiva-on' : ''}" onclick="toggleNarSkills(${p.id})" title="Ver habilidades agrupadas por atributo"><i class="ti ti-sword"></i></button>
        <button class="prow-edit-btn ${passivasExpanded ? 'prow-passiva-on' : ''}" onclick="toggleNarPassivas(${p.id})" title="Ver passivas / talentos"><i class="ti ti-sparkles"></i></button>
        <button class="prow-edit-btn ${narTestesCollapsed[p.id] === false ? 'prow-passiva-on' : ''}" onclick="toggleNarTestes(${p.id})" title="Ver testes"><i class="ti ti-hexagon-letter-d"></i></button>
        <button class="prow-edit-btn" onclick="editCharacter(${p.id})" title="Editar ficha do personagem"><i class="ti ti-edit"></i></button>
      </div>
      <div class="bars">
        <div class="bar-wrap vida"><div class="bar-lbl">Vida</div><div class="bar-track"><div class="bar-fill ${vidaClass(p.hp,p.hpMax)}" style="width:${hpPct}%"></div></div></div>
        <div class="bar-wrap ins"><div class="bar-lbl">Insanidade</div><div class="bar-track"><div class="bar-fill bfill-ins" style="width:${insPct}%"></div></div></div>
        ${isBruxo ? `<div class="bar-wrap human"><div class="bar-lbl">Humanidade</div><div class="bar-track"><div class="bar-fill bfill-human" style="width:${humanPct}%"></div></div></div>` : ''}
        <div class="bar-wrap arm"><div class="bar-lbl">Armadura</div><div class="bar-track"><div class="bar-fill bfill-arm" style="width:${armPct}%"></div></div></div>
        <div class="bar-wrap elm"><div class="bar-lbl">Elmo</div><div class="bar-track"><div class="bar-fill bfill-elm" style="width:${elmPct}%"></div></div></div>
      </div>
      <div class="nar-ctrl-row">
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
        <div class="nar-ctrl-group">
          <span class="nar-ctrl-lbl">🛡 Armadura</span>
          <div class="nar-ctrl-btns">
            <button onclick="adjArmadura(${p.id},-1)">−1</button>
            <input type="number" class="nar-ctrl-input" value="${p.armadura || 0}" onchange="setArmadura(${p.id}, this.value)">
            <button onclick="adjArmadura(${p.id},+1)">+1</button>
          </div>
        </div>
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
        ${(p.inventario || []).some(i => i.peso === 'exotica' || (Array.isArray(i.aprimoramentos) && i.aprimoramentos.length > 0 && !i.aprimoramentos.every(a => a.name === 'Dourado'))) ? `
        <div class="nar-ctrl-group">
          <span class="nar-ctrl-lbl">💎 Cristais</span>
          <div class="nar-ctrl-btns">
            <button onclick="adjCristais(${p.id},-1)">−1</button>
            <input type="number" class="nar-ctrl-input" value="${p.cristais || 0}" onchange="setCristais(${p.id}, this.value)">
            <button onclick="adjCristais(${p.id},+1)">+1</button>
          </div>
        </div>` : ''}
      </div>
      ${skillsExpanded ? `<div class="nar-skills-box">${gruposHtml}</div>` : ''}
      ${passivasExpanded ? `<div class="nar-passivas-box">
        <div class="nar-passivas-title"><i class="ti ti-sparkles"></i> Passivas / Talentos</div>
        ${passivasHtml}
      </div>` : ''}
      ${renderTestes(p, true)}
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════
// RENDER JOGADOR
// ═══════════════════════════════════════
function getMyPlayers() {
  if (!currentUser || currentUser.role === 'narrator') return PLAYERS;
  return PLAYERS.filter(p => p.ownerId === currentUser.id || p.ownerId == null);
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
  renderNarrador();
}

// ─── Ações dos Testes ────────────────────────────────────────────────────────
function setTesteMV(pid, testeId, val) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
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
    { label: 'Neutros',    cor: 'gray',   attr: 'neutro', ids: ['emocao']                                        },
  ];

  const corMap = { green: 'var(--green)', red: 'var(--red)', blue: 'var(--blue)', gray: 'var(--gray)' };
  const bgMap  = { green: 'var(--green-bg)', red: 'var(--red-bg)', blue: 'var(--blue-bg)', gray: 'var(--gray-bg)' };
  const bdMap  = { green: 'var(--green-bd)', red: 'var(--red-bd)', blue: 'var(--blue-bd)', gray: 'var(--gray-bd)' };

  const colunas = grupos.map(g => {
    const attrVal = g.attr !== 'neutro' ? (p[g.attr] || 0) : null;
    const mst = attrVal != null ? maestria(attrVal) : null;
    const mstLabel = mst != null ? ` <span class="nar-skill-mst">+${mst} maestria</span>` : '';

    const rows = g.ids.map(tid => {
      const def  = TESTES_LISTA.find(t => t.id === tid);
      const t    = p.testes[tid];
      const hasMV = t.mv, hasMD = t.md, hasBonus = t.bonus && t.bonus.trim();

      if (readonly) {
        // Narrador: chip estilizado igual às habilidades
        const badges = [];
        if (hasMV)    badges.push(`<span class="chip-badge" style="background:rgba(109,179,63,0.15);color:var(--green);border:1px solid var(--green-bd)">MV</span>`);
        if (hasMD)    badges.push(`<span class="chip-badge" style="background:var(--red-bg);color:#f08080;border:1px solid var(--red-bd)">MD</span>`);
        if (hasBonus) badges.push(`<span class="chip-badge" style="background:var(--accent-bg);color:var(--accent2);border:1px solid var(--accent-bd)">${t.bonus}</span>`);
        const hasConfig = badges.length > 0;
        return `<div class="skill-chip sc-${g.cor}">
          <span class="chip-dot"></span>
          <span class="chip-name">${def.name}</span>
          ${badges.join('')}
        </div>`;
      }

      // Jogador: editável
      return `<div class="teste-row">
        <span class="teste-nome">${def.name}</span>
        <div class="teste-ctrl">
          <button class="teste-mv-btn ${hasMV ? 'ativo' : ''}" onclick="setTesteMV(${p.id},'${tid}',${!hasMV})" title="Mega Vantagem">MV</button>
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

  const pid = parseInt(psel.value) || myPlayers[0].id;
  const p = myPlayers.find(x => x.id === pid) || myPlayers[0];
  const i = PLAYERS.indexOf(p);
  const av = AVATARS[i % AVATARS.length];
  const hpPct = Math.round(p.hp / p.hpMax * 100);
  const insPct = p.ins;
  const armPct = p.armaduraMax > 0 ? Math.round(p.armadura / p.armaduraMax * 100) : 0;
  const elmPct = p.elmoMax > 0 ? Math.round(p.elmo / p.elmoMax * 100) : 0;
  const xpPct = Math.round(p.xp / 10 * 100);
  const bm = p.hp === 0;
  const temSeq = p.ins >= 25;
  const isBruxo = p.classeBase === 'Bruxo';
  const isBardo = p.classeBase === 'Bardo';
  const humanPct = Math.round(getHumanidade(p) / HUMANIDADE_MAX * 100);

  const grupos = { green:[], red:[], blue:[], gray:[] };
  p.skills.forEach(sk => grupos[sk.color] && grupos[sk.color].push(sk));
  const nomesGrupo = { green: 'Técnicas — Agilidade', red: 'Golpes — Força', blue: 'Feitiços — Intelecto', gray: 'Neutras' };
  const dotColor = {green:'#6db33f', red:'#c94040', blue:'#4a8fd4', gray:'#7a7e95'};
  const attrGrupo = { green: p.agi, red: p.forca, blue: p.intel, gray: null };

  let skillsHtml = '';
  ['green','red','blue','gray'].forEach(cor => {
    if (!grupos[cor].length) return;
    const collapsed = !!jogSkillsCollapsed[cor];
    const mst = attrGrupo[cor] != null ? maestria(attrGrupo[cor]) : null;
    const mstTag = mst != null ? `<span class="sk-tag sk-tag-mst">+${mst} maestria</span>` : '';
    const readyCount = grupos[cor].filter(sk => isReady(sk)).length;
    const totalCount = grupos[cor].length;
    const cards = collapsed ? '' : grupos[cor].map(sk => {
      const ready = isReady(sk);
      const state = sk.tipo==='infinite' ? 'ready' : ready ? 'ready' : sk.cdRestante>0 ? 'cooldown' : 'exhausted';
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
          ${mstTag}
        </div>
        <div style="font-size: 11px; color: var(--text2); margin-bottom: 12px; line-height: 1.5; white-space: pre-wrap; max-height: 110px; overflow-y: auto; padding-right: 4px;">
            ${sk.desc || '<em>Nenhum efeito descrito.</em>'}
        </div>
        <div class="sk-bottom">
          <button class="sk-btn" onclick="event.stopPropagation();useSkill(${p.id},'${sk.id}')" ${(!ready||sk.tipo==='infinite')?'disabled':''}>
            ${sk.tipo==='infinite' ? 'Livre' : 'Usar'}
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
    let tag = '';
    if (pas.origemId) tag = ` <span style="font-size:10px;color:var(--accent2);font-weight:400">(origem · ${origemObjJog ? origemObjJog.name : ''})</span>`;
    else if (pas.racialId) tag = ` <span style="font-size:10px;color:var(--text3);font-weight:400">(racial · ${p.race})</span>`;
    return `
    <div class="passiva-card">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div class="passiva-name"><i class="ti ti-sparkles"></i> ${pas.name}${tag}</div>
        <button onclick="editPassiva(${p.id}, '${pas.id}')" title="Editar" style="background:none; border:none; color:var(--text3); cursor:pointer; padding:0; margin-left:8px;">
          <i class="ti ti-edit" style="font-size:16px;"></i>
        </button>
      </div>
      <div class="passiva-desc">${pas.desc || '<em>Nenhum efeito descrito.</em>'}</div>
    </div>`;
  }).join('');

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
        <div class="stat-row" style="margin-top:10px"><span class="stat-lbl"><i class="ti ti-brain" style="color:var(--rose)"></i> Insanidade</span><span class="stat-val" style="color:var(--rose)">${p.ins}/100</span></div>
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
      <div class="stat-block">
        <div class="stat-row"><span class="stat-lbl"><i class="ti ti-shield" style="color:var(--amber)"></i> Armadura</span><span class="stat-val" style="color:var(--amber)">${p.armadura}/${p.armaduraMax}</span></div>
        <div class="bar-track" style="margin:5px 0"><div class="bar-fill bfill-arm" style="width:${armPct}%"></div></div>
        <div class="arm-ctrl arm-ctrl-3">
          <button onclick="adjArmadura(${p.id},-1)">−1</button>
          <input type="number" class="stat-input" value="${p.armadura}" onchange="setArmadura(${p.id}, this.value)">
          <button onclick="adjArmadura(${p.id},+1)">+1</button>
        </div>
      </div>
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
          <div class="am am-agi" title="Maestria: +${maestria(p.agi)} na rolagem (arredondado para cima de AGI/5)"><div class="am-lbl">AGI</div><div class="am-val">${p.agi}</div><div class="am-mst">+${maestria(p.agi)}</div></div>
          <div class="am am-for" title="Maestria: +${maestria(p.forca)} na rolagem (arredondado para cima de FOR/5)"><div class="am-lbl">FOR</div><div class="am-val">${p.forca}</div><div class="am-mst">+${maestria(p.forca)}</div></div>
          <div class="am am-int" title="Maestria: +${maestria(p.intel)} na rolagem (arredondado para cima de INT/5)"><div class="am-lbl">INT</div><div class="am-val">${p.intel}</div><div class="am-mst">+${maestria(p.intel)}</div></div>
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
      ${(p.inventario || []).some(i => i.peso === 'exotica') ? `
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
      <button class="add-skill-btn" onclick="openModal(${p.id})"><i class="ti ti-plus"></i> Adicionar habilidade</button>

      <div class="group-title group-title-toggle" style="margin-top:24px" onclick="toggleJogSkillGroup('passivas')">
        <span class="gt-dot" style="background:var(--accent2)"></span>Passivas — Talentos
        <span class="gt-collapse-info">${passivasCollapsed ? `<span class="gt-ready-badge" style="background:rgba(124,92,191,0.15);color:var(--accent2);border-color:rgba(124,92,191,0.3)">${passivasList.length} talento${passivasList.length !== 1 ? 's' : ''}</span>` : ''}</span>
        <i class="ti ${passivasCollapsed ? 'ti-chevron-down' : 'ti-chevron-up'} gt-chevron"></i>
      </div>
      ${passivasCollapsed ? '' : `<div class="passivas-grid">${passivasHtml || '<div style="font-size:12px;color:var(--text3);padding:6px 0">Nenhuma passiva cadastrada ainda.</div>'}</div>`}
      ${passivasCollapsed ? '' : `<button class="add-skill-btn" onclick="openPassivaModal(${p.id})"><i class="ti ti-plus"></i> Adicionar passiva / talento</button>`}

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
const INV_PESO_LABEL = { leve:'Leve', media:'Média', pesada:'Pesada', exotica:'Exótica', mega:'Mega Pesada' };
const INV_PESO_COLOR = { leve:'var(--green)', media:'var(--amber)', pesada:'var(--red)', exotica:'var(--accent2)', mega:'#c44aff' };
const INV_PESO_BG    = { leve:'var(--green-bg)', media:'var(--amber-bg)', pesada:'var(--red-bg)', exotica:'var(--accent-bg)', mega:'rgba(196,74,255,0.1)' };
const INV_PESO_BD    = { leve:'var(--green-bd)', media:'var(--amber-bd)', pesada:'var(--red-bd)', exotica:'var(--accent-bd)', mega:'rgba(196,74,255,0.3)' };
const INV_ALCANCE_LABEL = { curto: 'Curto Alcance', longo: 'Longo Alcance' };

function renderInventarioArea(p) {
  const inv = Array.isArray(p.inventario) ? p.inventario : [];
  const armas        = inv.filter(i => i.tipo === 'arma');
  const protecoes    = inv.filter(i => i.tipo === 'protecao');
  const instrumentos = inv.filter(i => i.tipo === 'instrumento');
  const itens        = inv.filter(i => i.tipo === 'item');

  function pesoTag(item) {
    if (!item.peso) return '';
    return `<span class="inv-peso-tag" style="color:${INV_PESO_COLOR[item.peso]};background:${INV_PESO_BG[item.peso]};border-color:${INV_PESO_BD[item.peso]}">${INV_PESO_LABEL[item.peso]}</span>`;
  }

  function alcanceTag(item) {
    if (!item.alcance) return '';
    const isLongo = item.alcance === 'longo';
    return `<span class="inv-peso-tag" style="color:${isLongo?'var(--teal)':'var(--text3)'};background:${isLongo?'var(--teal-bg)':'var(--bg3)'};border-color:${isLongo?'var(--teal-bd)':'var(--border)'}">${INV_ALCANCE_LABEL[item.alcance]}</span>`;
  }

  function municaoRow(item) {
    // Usa cristais se: arma exótica, OU arma comum com aprimoramento exótico (não-Dourado)
    const temAprimoExotico = Array.isArray(item.aprimoramentos) && item.aprimoramentos.length > 0
      && !item.aprimoramentos.every(a => a.name === 'Dourado');
    const usaCristal = item.peso === 'exotica' || temAprimoExotico;
    const isLongoAlcance = item.alcance === 'longo';
    const precisaMunicao = isLongoAlcance || usaCristal;
    if (!precisaMunicao) return '';

    // Arma exótica de longo alcance: mostra cristais E munição
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

  function renderArmaCard(item) {
    const aprimoramentos = item.aprimoramentos && item.aprimoramentos.length
      ? `<div class="inv-sub-section"><div class="inv-sub-label"><i class="ti ti-sparkles"></i> Aprimoramentos</div>${item.aprimoramentos.map(a=>`<div class="inv-aprimo-item"><span class="inv-aprimo-name">${a.name}</span>${a.desc?`<span class="inv-aprimo-desc">${a.desc}</span>`:''}</div>`).join('')}</div>` : '';
    const ativas = item.ativas && item.ativas.length
      ? `<div class="inv-sub-section"><div class="inv-sub-label"><i class="ti ti-bolt"></i> Liberar Vileza</div>${item.ativas.map(a=>`<div class="inv-aprimo-item"><span class="inv-aprimo-name">${a.name}</span>${a.desc?`<span class="inv-aprimo-desc">${a.desc}</span>`:''}</div>`).join('')}</div>` : '';
    return `<div class="inv-card">
      <div class="inv-card-header">
        <div class="inv-card-title"><i class="ti ti-sword" style="color:var(--red)"></i> ${item.name}</div>
        <div style="display:flex;align-items:center;gap:6px">
          ${alcanceTag(item)}
          ${pesoTag(item)}
          <button onclick="editInvItem(${p.id},'${item.id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;padding:2px"><i class="ti ti-edit" style="font-size:15px"></i></button>
        </div>
      </div>
      ${item.dano ? `<div class="inv-dano"><span class="inv-dano-label">Dano</span><span class="inv-dano-val">${item.dano}</span></div>` : ''}
      ${item.efeito ? `<div class="inv-desc">${item.efeito}</div>` : ''}
      ${municaoRow(item)}
      ${aprimoramentos}${ativas}
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
      <div class="inv-card-header">
        <div class="inv-card-title"><i class="ti ${icone}" style="color:${cor}"></i> ${item.name}</div>
        <div style="display:flex;align-items:center;gap:6px">
          ${equipBadge}
          ${pesoTag(item)}
          <button onclick="editInvItem(${p.id},'${item.id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;padding:2px"><i class="ti ti-edit" style="font-size:15px"></i></button>
        </div>
      </div>
      ${item.valor != null ? `<div class="inv-dano"><span class="inv-dano-label">${valLabel}</span><span class="inv-dano-val">${item.valor}</span></div>` : ''}
      ${item.efeito ? `<div class="inv-desc">${item.efeito}</div>` : ''}
      ${item.peso === 'exotica' ? `<div class="inv-municao-row">
        <span class="inv-municao-lbl"><i class="ti ti-diamond" style="color:var(--accent2)"></i> Cristais <span style="font-size:10px;color:var(--text3)">(compartilhados)</span></span>
        <div class="inv-municao-ctrl">
          <button onclick="adjCristais(${p.id},-1)">−</button>
          <span class="inv-municao-val">${p.cristais || 0}</span>
          <button onclick="adjCristais(${p.id},+1)">+</button>
        </div>
      </div>` : ''}
    </div>`;
  }

  function renderInstrumentoCard(item) {
    const aprimoramentos = item.aprimoramentos && item.aprimoramentos.length
      ? `<div class="inv-sub-section"><div class="inv-sub-label"><i class="ti ti-sparkles"></i> Aprimoramentos</div>${item.aprimoramentos.map(a=>`<div class="inv-aprimo-item"><span class="inv-aprimo-name">${a.name}</span>${a.desc?`<span class="inv-aprimo-desc">${a.desc}</span>`:''}</div>`).join('')}</div>` : '';
    return `<div class="inv-card">
      <div class="inv-card-header">
        <div class="inv-card-title"><i class="ti ti-music" style="color:#e8a838"></i> ${item.name}</div>
        <div style="display:flex;align-items:center;gap:6px">
          ${pesoTag(item)}
          <button onclick="editInvItem(${p.id},'${item.id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;padding:2px"><i class="ti ti-edit" style="font-size:15px"></i></button>
        </div>
      </div>
      ${item.dano ? `<div class="inv-dano"><span class="inv-dano-label">Dano</span><span class="inv-dano-val">${item.dano}</span></div>` : ''}
      ${item.efeito ? `<div class="inv-desc">${item.efeito}</div>` : ''}
      ${aprimoramentos}
    </div>`;
  }

  function renderItemCard(item) {
    return `<div class="inv-card inv-card-item">
      <div class="inv-card-header">
        <div class="inv-card-title"><i class="ti ti-package" style="color:var(--text3)"></i> ${item.name}</div>
        <div style="display:flex;align-items:center;gap:6px">
          ${item.qtd != null && item.qtd !== '' ? `<span class="inv-qtd">×${item.qtd}</span>` : ''}
          <button onclick="editInvItem(${p.id},'${item.id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;padding:2px"><i class="ti ti-edit" style="font-size:15px"></i></button>
        </div>
      </div>
      ${item.efeito ? `<div class="inv-desc">${item.efeito}</div>` : ''}
    </div>`;
  }

  function invSection(key, label, icon, color, items, renderFn) {
    const col = jogInvCollapsed[key];
    const badge = col ? `<span class="gt-ready-badge" style="color:${color};background:transparent;border-color:${color}40">${items.length} item${items.length!==1?'s':''}</span>` : '';
    return `
      <div class="group-title group-title-toggle" onclick="toggleInvSection('${key}')">
        <span class="gt-dot" style="background:${color}"></span>${label}
        <span class="gt-collapse-info">${badge}</span>
        <i class="ti ${col?'ti-chevron-down':'ti-chevron-up'} gt-chevron"></i>
      </div>
      ${col ? '' : `<div class="inv-grid">${items.length ? items.map(renderFn).join('') : `<div class="inv-empty">Nenhum item cadastrado.</div>`}</div>`}`;
  }

  return `<div class="inv-area">
    <div class="inv-header">
      <i class="ti ti-backpack" style="color:var(--accent2)"></i>
      <span>Inventário</span>
      <button class="btn btn-success inv-add-btn" onclick="openInvModal(${p.id})"><i class="ti ti-plus"></i> Adicionar</button>
    </div>
    ${invSection('armas',        '⚔️ Armas',               'ti-sword',   'var(--red)',    armas,        renderArmaCard)}
    ${invSection('protecoes',    '🛡 Proteções',            'ti-shield',  'var(--amber)',  protecoes,    renderProtecaoCard)}
    ${invSection('instrumentos', '🎵 Instrumentos Musicais','ti-music',   '#e8a838',       instrumentos, renderInstrumentoCard)}
    ${invSection('itens',        '📦 Itens',                'ti-package', 'var(--text3)', itens,        renderItemCard)}
  </div>`;
}

function toggleInvSection(key) {
  jogInvCollapsed[key] = !jogInvCollapsed[key];
  renderJogador();
}

// Ajusta a munição (ou cristais, no caso de armas exóticas) de uma arma
// diretamente pelo card, sem precisar abrir o modal de edição.
function adjInvMunicao(pid, itemId, d) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  const item = (p.inventario || []).find(x => x.id === itemId);
  if (!item) return;
  item.municao = Math.max(0, (item.municao || 0) + d);
  saveState();
  renderJogador();
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
  renderJogador();
}

// ─── Modal Inventário ───
function openInvModal(pid, defaults = {}) {
  modalInvPid = pid;
  modalInvId  = null;
  _buildInvModal(defaults);
  document.getElementById('modal-inv-overlay').classList.add('open');
  setTimeout(() => document.getElementById('inv-m-name').focus(), 50);
}

function editInvItem(pid, itemId) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  const item = (p.inventario || []).find(x => x.id === itemId);
  if (!item) return;
  modalInvPid = pid;
  modalInvId  = itemId;
  _buildInvModal(item);
  document.getElementById('modal-inv-overlay').classList.add('open');
  setTimeout(() => document.getElementById('inv-m-name').focus(), 50);
}

function _buildInvModal(data) {
  const tipo = data.tipo || 'arma';
  document.getElementById('inv-modal-title').textContent = modalInvId ? 'Editar Item' : 'Novo Item';
  document.getElementById('inv-m-del').style.display = modalInvId ? 'inline-flex' : 'none';

  // tipo
  document.querySelectorAll('.inv-tipo-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tipo === tipo);
  });

  document.getElementById('inv-m-name').value   = data.name   || '';
  document.getElementById('inv-m-efeito').value = data.efeito || '';

  // peso
  const pesoVal = data.peso || 'leve';
  document.querySelectorAll('.inv-peso-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.peso === pesoVal);
  });

  // dano
  document.getElementById('inv-m-dano').value  = data.dano  || '';
  const inputDanoInst = document.getElementById('inv-m-dano-inst');
  if (inputDanoInst) inputDanoInst.value = (tipo === 'instrumento' ? (data.dano || '') : '');
  // alcance (arma)
  const alcanceVal = data.alcance || 'curto';
  document.querySelectorAll('.inv-alcance-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.alcance === alcanceVal);
  });
  // munição / cristais (arma de longo alcance ou exótica; proteção exótica usa p.cristais)
  let municaoVal = data.municao != null ? data.municao : '';
  if (tipo === 'protecao' && (data.peso || 'leve') === 'exotica' && modalInvPid) {
    const pOwner = PLAYERS.find(x => x.id === modalInvPid);
    if (pOwner) municaoVal = pOwner.cristais || 0;
  }
  document.getElementById('inv-m-municao').value = municaoVal;
  // Campo extra de munição para arma exótica de longo alcance
  const inputMunicaoExtra = document.getElementById('inv-m-municao-extra');
  if (inputMunicaoExtra) {
    inputMunicaoExtra.value = (data.peso === 'exotica' && data.alcance === 'longo' && data.municao != null) ? data.municao : '';
  }
  // valor protecao
  document.getElementById('inv-m-valor').value = data.valor != null ? data.valor : '';
  // subtipo protecao
  const subtipo = data.subtipo || 'armadura';
  document.querySelectorAll('.inv-subtipo-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.sub === subtipo);
  });
  // equipado (proteção) — novo item já entra equipado por padrão
  const equipadoVal = typeof data.equipado === 'boolean' ? data.equipado : true;
  document.querySelectorAll('.inv-equip-btn').forEach(b => {
    b.classList.toggle('active', (b.dataset.equip === '1') === equipadoVal);
  });
  // qtd
  document.getElementById('inv-m-qtd').value = data.qtd != null ? data.qtd : '';

  // aprimoramentos — detecta tipo pelo conteúdo salvo
  invAprimos = data.aprimoramentos ? JSON.parse(JSON.stringify(data.aprimoramentos)) : [];
  // ativas
  invAtivas  = data.ativas ? JSON.parse(JSON.stringify(data.ativas)) : [];
  // Detecta invAprimoTipo ao editar item existente
  const _peso = data.peso || 'leve';
  if (_peso === 'exotica') {
    invAprimoTipo = 'nenhum'; // exótica não usa o seletor
  } else if (invAprimos.some(a => a.name === 'Dourado')) {
    invAprimoTipo = 'dourado';
  } else if (invAprimos.length) {
    invAprimoTipo = 'exotico';
  } else {
    invAprimoTipo = 'nenhum';
  }

  _updateInvModalSections(tipo);
}

let invAprimos = [];
let invAtivas  = [];
// 'nenhum' | 'dourado' | 'exotico'  — estado do seletor de tipo de aprimoramento
let invAprimoTipo = 'nenhum';

function _updateInvModalSections(tipo) {
  document.getElementById('inv-sec-arma').style.display         = tipo === 'arma'        ? '' : 'none';
  document.getElementById('inv-sec-instrumento').style.display  = tipo === 'instrumento' ? '' : 'none';
  document.getElementById('inv-sec-protecao').style.display     = tipo === 'protecao'    ? '' : 'none';
  document.getElementById('inv-sec-item').style.display         = tipo === 'item'        ? '' : 'none';

  const peso = _invSelectedPeso();
  // Aprimoramentos: disponíveis para armas e instrumentos
  document.getElementById('inv-sec-exotica').style.display = (tipo === 'arma' || tipo === 'instrumento') ? '' : 'none';
  document.getElementById('inv-sec-mega').style.display    = (tipo === 'arma' && peso === 'mega') ? '' : 'none';

  // Munição (armas de longo alcance) ou Cristais (armas/proteções exóticas)
  const alcance = _invSelectedAlcance();
  const isExoticaLongoAlcance = tipo === 'arma' && peso === 'exotica' && alcance === 'longo';
  const precisaMunicao = (tipo === 'arma' && (alcance === 'longo' || peso === 'exotica'))
                      || (tipo === 'protecao' && peso === 'exotica');
  document.getElementById('inv-sec-municao').style.display = precisaMunicao ? '' : 'none';
  const municaoLabel = document.getElementById('inv-municao-label');
  // Exótica: campo principal mostra Cristais (informativo, read-only)
  // Comum longo alcance: campo principal = Munição editável
  if (municaoLabel) municaoLabel.textContent = (peso === 'exotica') ? 'Cristais (compartilhados)' : 'Munição';
  // Campo extra de munição — só aparece quando exótica + longo alcance
  const secMunicaoExtra = document.getElementById('inv-sec-municao-extra');
  if (secMunicaoExtra) secMunicaoExtra.style.display = isExoticaLongoAlcance ? '' : 'none';
  // Campo de cristais vira informativo quando exótica (valor vem do personagem, não do item)
  const inputMunicao = document.getElementById('inv-m-municao');
  if (inputMunicao) {
    if (peso === 'exotica') {
      const pOwner = modalInvPid != null ? PLAYERS.find(x => x.id === modalInvPid) : null;
      inputMunicao.value = pOwner ? (pOwner.cristais || 0) : 0;
      inputMunicao.readOnly = true;
      inputMunicao.style.opacity = '0.6';
      inputMunicao.title = 'Cristais são compartilhados entre todos os itens exóticos e gerenciados na ficha';
    } else {
      inputMunicao.readOnly = false;
      inputMunicao.style.opacity = '';
      inputMunicao.title = '';
    }
  }

  _renderInvAprimos();
  _renderInvAtivas();
  _updateAprimoUI();
}

function _invSelectedTipo() {
  const b = document.querySelector('.inv-tipo-btn.active');
  return b ? b.dataset.tipo : 'arma';
}
function _invSelectedPeso() {
  const b = document.querySelector('.inv-peso-btn.active');
  return b ? b.dataset.peso : 'leve';
}
function _invSelectedSub() {
  const b = document.querySelector('.inv-subtipo-btn.active');
  return b ? b.dataset.sub : 'armadura';
}
function _invSelectedEquip() {
  const b = document.querySelector('.inv-equip-btn.active');
  return b ? b.dataset.equip === '1' : true;
}
function _invSelectedAlcance() {
  const b = document.querySelector('.inv-alcance-btn.active');
  return b ? b.dataset.alcance : 'curto';
}

function invSelectTipo(tipo) {
  document.querySelectorAll('.inv-tipo-btn').forEach(b => b.classList.toggle('active', b.dataset.tipo === tipo));
  _updateInvModalSections(tipo);
}
function invSelectPeso(peso) {
  document.querySelectorAll('.inv-peso-btn').forEach(b => b.classList.toggle('active', b.dataset.peso === peso));
  // Ao trocar o peso, limpa aprimoramentos incompatíveis
  if (peso === 'exotica') {
    // Exótica: remove Dourado se existir, mantém livres
    invAprimos = invAprimos.filter(a => a.name !== 'Dourado');
    invAprimoTipo = 'nenhum';
  } else {
    // Arma comum: se havia Dourado, mantém; se havia exótico livre, mantém; se havia nada, mantém nada
    if (invAprimoTipo === 'nenhum') invAprimos = [];
  }
  _updateInvModalSections(_invSelectedTipo());
}
function invSelectSub(sub) {
  document.querySelectorAll('.inv-subtipo-btn').forEach(b => b.classList.toggle('active', b.dataset.sub === sub));
}
function invSelectEquip(equipado) {
  document.querySelectorAll('.inv-equip-btn').forEach(b => b.classList.toggle('active', (b.dataset.equip === '1') === equipado));
}
function invSelectAlcance(alcance) {
  document.querySelectorAll('.inv-alcance-btn').forEach(b => b.classList.toggle('active', b.dataset.alcance === alcance));
  _updateInvModalSections(_invSelectedTipo());
}

function _renderInvAprimos() {
  const el = document.getElementById('inv-aprimos-list');
  if (!el) return;
  const peso = _invSelectedPeso();
  const isExotica = peso === 'exotica';

  if (isExotica) {
    // Armas exóticas: campos livres, sem Dourado
    el.innerHTML = invAprimos.map((a,i) => `
      <div class="inv-extra-item">
        <div style="flex:1">
          <input class="inv-extra-input" value="${a.name||''}" placeholder="Nome" oninput="invAprimos[${i}].name=this.value">
          <input class="inv-extra-input" style="margin-top:4px;font-size:11px;color:var(--text2)" value="${a.desc||''}" placeholder="Efeito (opcional)" oninput="invAprimos[${i}].desc=this.value">
        </div>
        <button onclick="invAprimos.splice(${i},1);_renderInvAprimos()" style="background:none;border:none;color:var(--red);cursor:pointer;padding:4px"><i class="ti ti-x"></i></button>
      </div>`).join('');
    return;
  }

  // Armas comuns: renderiza conforme invAprimoTipo
  if (invAprimoTipo === 'dourado') {
    // Dourado: exibe o bloco fixo (não editável pelo nome, desc pode ter obs)
    el.innerHTML = `<div class="inv-extra-item" style="background:rgba(255,200,0,0.07);border:1px solid rgba(255,200,0,0.25);border-radius:6px;padding:6px 8px;">
      <div style="flex:1">
        <div style="font-size:12px;font-weight:600;color:#e8c53a;margin-bottom:2px">&#10024; Aprimoramento Dourado</div>
        <div style="font-size:11px;color:var(--text3)">Custo: 300 de Dinheiro. Disponível para personagens com a passiva <strong>Dourado</strong> (Anão) ou por regra da campanha.</div>
      </div>
    </div>`;
  } else if (invAprimoTipo === 'exotico') {
    // Exótico: campos livres
    el.innerHTML = invAprimos.map((a,i) => `
      <div class="inv-extra-item">
        <div style="flex:1">
          <input class="inv-extra-input" value="${a.name||''}" placeholder="Nome do aprimoramento" oninput="invAprimos[${i}].name=this.value">
          <input class="inv-extra-input" style="margin-top:4px;font-size:11px;color:var(--text2)" value="${a.desc||''}" placeholder="Efeito (opcional)" oninput="invAprimos[${i}].desc=this.value">
        </div>
        <button onclick="invAprimos.splice(${i},1);_renderInvAprimos()" style="background:none;border:none;color:var(--red);cursor:pointer;padding:4px"><i class="ti ti-x"></i></button>
      </div>`).join('') +
      `<button class="btn" style="padding:3px 9px;font-size:11px;margin-top:6px" onclick="addInvAprimo()"><i class="ti ti-plus"></i> Adicionar</button>`;
  } else {
    el.innerHTML = '';
  }
}

function _renderInvAtivas() {
  const el = document.getElementById('inv-ativas-list');
  if (!el) return;
  el.innerHTML = invAtivas.map((a,i) => `
    <div class="inv-extra-item">
      <div style="flex:1">
        <input class="inv-extra-input" value="${a.name||''}" placeholder="Nome da vileza" oninput="invAtivas[${i}].name=this.value">
        <input class="inv-extra-input" style="margin-top:4px;font-size:11px;color:var(--text2)" value="${a.desc||''}" placeholder="Efeito ao liberar" oninput="invAtivas[${i}].desc=this.value">
      </div>
      <button onclick="invAtivas.splice(${i},1);_renderInvAtivas()" style="background:none;border:none;color:var(--red);cursor:pointer;padding:4px"><i class="ti ti-x"></i></button>
    </div>`).join('');
}

function selectAprimoTipo(tipo) {
  invAprimoTipo = tipo;
  if (tipo === 'dourado') {
    // Dourado é um slot único fixo — representa o aprimoramento especial
    invAprimos = [{ name: 'Dourado', desc: '' }];
  } else if (tipo === 'exotico') {
    // Remove qualquer Dourado existente e inicia lista vazia para preenchimento livre
    invAprimos = invAprimos.filter(a => a.name !== 'Dourado');
    if (!invAprimos.length) invAprimos.push({name:'',desc:''});
  } else {
    invAprimos = [];
  }
  _updateAprimoUI();
  _renderInvAprimos();
}

function _updateAprimoUI() {
  const tipo  = _invSelectedTipo();
  const peso  = _invSelectedPeso();
  const seletor = document.getElementById('inv-aprimo-tipo-selector');
  const hint    = document.getElementById('inv-aprimo-exotica-hint');
  if (!seletor || !hint) return;

  const suportaAprimo = tipo === 'arma' || tipo === 'instrumento';
  if (!suportaAprimo) { seletor.style.display = 'none'; hint.style.display = 'none'; return; }

  const isExotica = peso === 'exotica';
  seletor.style.display = isExotica ? 'none' : 'flex';
  hint.style.display    = isExotica ? ''     : 'none';

  // Highlight do botão ativo (armas/instrumentos comuns)
  ['dourado','exotico','nenhum'].forEach(t => {
    const btn = document.getElementById('inv-aprimo-btn-' + t);
    if (btn) btn.style.fontWeight = (invAprimoTipo === t) ? '700' : '';
    if (btn) btn.style.borderColor = (invAprimoTipo === t) ? 'var(--accent2)' : '';
  });
}

function addInvAprimo() { invAprimos.push({name:'',desc:''}); _renderInvAprimos(); }
function addInvAtiva()  { invAtivas.push({name:'',desc:''});  _renderInvAtivas();  }

function closeInvModal() {
  document.getElementById('modal-inv-overlay').classList.remove('open');
}

function saveInvItem() {
  const p = PLAYERS.find(x => x.id === modalInvPid);
  if (!p) return;
  if (!Array.isArray(p.inventario)) p.inventario = [];

  const tipo    = _invSelectedTipo();
  const name    = document.getElementById('inv-m-name').value.trim();
  if (!name) { document.getElementById('inv-m-name').focus(); return; }

  const efeito  = document.getElementById('inv-m-efeito').value.trim();
  const peso    = _invSelectedPeso();
  const dano    = document.getElementById('inv-m-dano').value.trim();
  const alcance = _invSelectedAlcance();
  const municaoRaw = document.getElementById('inv-m-municao').value.trim();
  const municao = municaoRaw !== '' ? Math.max(0, parseInt(municaoRaw)) : 0;
  const valor   = document.getElementById('inv-m-valor').value.trim();
  const subtipo = _invSelectedSub();
  const equipado = _invSelectedEquip();
  const qtdRaw  = document.getElementById('inv-m-qtd').value.trim();
  const qtd     = qtdRaw !== '' ? parseInt(qtdRaw) : null;

  const base = { name, efeito, tipo };
  if (tipo === 'arma') {
    Object.assign(base, { peso, dano, alcance });
    if (alcance === 'longo') {
      if (peso === 'exotica') {
        // Exótica longo alcance: munição vem do campo extra
        const municaoExtraRaw = (document.getElementById('inv-m-municao-extra') || {}).value || '';
        base.municao = municaoExtraRaw !== '' ? Math.max(0, parseInt(municaoExtraRaw)) : 0;
      } else {
        base.municao = municao;
      }
    }
    // Aprimoramentos disponíveis para todas as armas
    base.aprimoramentos = invAprimos.filter(a => a.name);
    // Armas exóticas: cristais ficam em p.cristais (pool do personagem), não no item
    if (peso === 'mega')    base.ativas = invAtivas.filter(a => a.name);
  } else if (tipo === 'instrumento') {
    const danoInst = (document.getElementById('inv-m-dano-inst') || {}).value || '';
    Object.assign(base, { peso, dano: danoInst.trim() });
    base.aprimoramentos = invAprimos.filter(a => a.name);
  } else if (tipo === 'protecao') {
    Object.assign(base, { peso, subtipo, valor: valor !== '' ? Number(valor) : null, equipado });
    // Proteções exóticas: atualiza o pool de cristais do personagem
    if (peso === 'exotica') {
      const p2 = PLAYERS.find(x => x.id === modalInvPid);
      if (p2) { p2.cristais = municao; }
    }
  } else {
    if (qtd !== null) base.qtd = qtd;
  }

  let savedId;
  if (modalInvId) {
    const idx = p.inventario.findIndex(x => x.id === modalInvId);
    if (idx !== -1) p.inventario[idx] = { ...p.inventario[idx], ...base };
    savedId = modalInvId;
  } else {
    base.id = 'inv_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
    p.inventario.push(base);
    savedId = base.id;
  }

  // Só pode haver 1 armadura e 1 elmo equipados por vez por personagem
  if (tipo === 'protecao' && equipado) {
    p.inventario.forEach(it => {
      if (it.tipo === 'protecao' && it.subtipo === subtipo && it.id !== savedId) it.equipado = false;
    });
  }

  if (tipo === 'protecao') recomputeProtMax(p);

  saveState();
  renderJogador();
  closeInvModal();
}

function deleteInvItem() {
  if (!modalInvId || !modalInvPid) return;
  if (!confirm('Excluir este item do inventário?')) return;
  const p = PLAYERS.find(x => x.id === modalInvPid);
  if (p) {
    const removido = (p.inventario || []).find(x => x.id === modalInvId);
    p.inventario = p.inventario.filter(x => x.id !== modalInvId);
    if (removido && removido.tipo === 'protecao') recomputeProtMax(p);
  }
  saveState();
  renderJogador();
  closeInvModal();
}

// ═══════════════════════════════════════
// INICIATIVA & NOTAS (Narrador)
// ═══════════════════════════════════════
function rollInit() {
  INITIATIVE = PLAYERS.map(p => ({name:p.name, roll:Math.floor(Math.random()*20)+1, type:'ally'}))
    .concat([{name:'Inimigo A', roll:Math.floor(Math.random()*20)+1, type:'enemy'},{name:'Inimigo B', roll:Math.floor(Math.random()*20)+1, type:'enemy'}])
    .sort((a,b) => b.roll - a.roll);
  curI = 0; saveState(); renderInit();
}
function renderInit() {
  const el = document.getElementById('init-list');
  if (!el || !INITIATIVE.length) return;
  el.innerHTML = INITIATIVE.map((it,i) => `
    <div class="iitem ${i===curI?'cur':''}">
      <span class="inum">${it.roll}</span><span class="iname">${it.name}</span><span class="itype ${it.type==='enemy'?'it-en':'it-al'}">${it.type==='enemy'?'Inimigo':'Aliado'}</span>
    </div>`).join('');
}
function nextI() { curI = (curI+1) % Math.max(INITIATIVE.length,1); saveState(); renderInit(); }
function prevI() { curI = (curI-1+Math.max(INITIATIVE.length,1)) % Math.max(INITIATIVE.length,1); saveState(); renderInit(); }

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
  renderNarrador();
}

function toggleNarSkills(pid) {
  narSkillsExpanded[pid] = !narSkillsExpanded[pid];
  renderNarrador();
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
}

function selectSubclasse(subName) {
  document.querySelectorAll('.sub-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.sub === subName)
  );
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
  const container = document.getElementById('c-origem-container');
  if (!container) return;
  const origens = getRaceOrigens(raceName);
  if (!origens.length) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'block';
  container.innerHTML = `
    <label class="form-label" style="margin-bottom:6px;display:block">Origem</label>
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
    const race = document.getElementById('c-race').value;
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

// ─── Modal Personagem ──────────────────────────────────────────────────────────
function openCharModal() {
  modalCharId = null;
  document.getElementById('modal-char-overlay').classList.add('open');
  const titleEl = document.getElementById('modal-char-title');
  if (titleEl) titleEl.textContent = 'Novo Personagem';
  const saveBtn = document.getElementById('c-btn-save');
  if (saveBtn) saveBtn.textContent = 'Criar Personagem';
  document.getElementById('c-name').value = '';
  setRaceSelectValue('');
  updateOrigemSelector('', null);
  buildClassSelector();
  document.getElementById('c-hp').value = '10';
  document.getElementById('c-ins').value = '0';
  document.getElementById('c-agi').value = '5';
  document.getElementById('c-for').value = '5';
  document.getElementById('c-int').value = '5';
  document.getElementById('c-passos').value = '6';
  document.getElementById('c-dinheiro').value = '100';
  setTimeout(() => document.getElementById('c-name').focus(), 50);
}

// Define o valor do <select> de Raça. Se a ficha tiver uma raça antiga (texto
// livre) que não está na lista fixa atual, cria uma opção extra temporária
// pra não perder/sobrescrever esse dado ao reabrir o modal de edição.
function setRaceSelectValue(raca) {
  const sel = document.getElementById('c-race');
  if (!sel) return;
  const existeOpcao = Array.from(sel.options).some(o => o.value === raca);
  // remove qualquer opção "legada" adicionada anteriormente
  Array.from(sel.querySelectorAll('option[data-legacy]')).forEach(o => o.remove());
  if (raca && !existeOpcao) {
    const opt = document.createElement('option');
    opt.value = raca;
    opt.textContent = raca + ' (raça antiga)';
    opt.dataset.legacy = '1';
    sel.appendChild(opt);
  }
  sel.value = raca || '';
}

function editCharacter(id) {
  const p = PLAYERS.find(x => x.id === id);
  if (!p) return;
  modalCharId = id;
  document.getElementById('modal-char-overlay').classList.add('open');
  const titleEl = document.getElementById('modal-char-title');
  if (titleEl) titleEl.textContent = 'Editar Personagem';
  const saveBtn = document.getElementById('c-btn-save');
  if (saveBtn) saveBtn.textContent = 'Salvar';
  document.getElementById('c-name').value = p.name;
  setRaceSelectValue(p.race);
  updateOrigemSelector(p.race, p.origemId || null);
  // Restaura classe/subclasse: cls guarda a subclasse, classeBase guarda a classe-pai.
  // Para fichas antigas (texto livre), tenta derivar a base pelo nome da subclasse.
  const clsBase = p.classeBase || getBaseClass(p.cls) || null;
  setClasseSubclasse(clsBase, p.cls);
  document.getElementById('c-hp').value = p.hpMax;
  document.getElementById('c-ins').value = p.ins;
  document.getElementById('c-agi').value = p.agi;
  document.getElementById('c-for').value = p.forca;
  document.getElementById('c-int').value = p.intel;
  document.getElementById('c-passos').value = p.passos;
  document.getElementById('c-dinheiro').value = (typeof p.dinheiro === 'number') ? p.dinheiro : 100;
}

function deleteCharacter(id) {
  if (!confirm('Tem certeza que deseja excluir este personagem? Esta ação não pode ser desfeita.')) return;
  PLAYERS = PLAYERS.filter(x => x.id !== id);
  saveState();
  const psel = document.getElementById('psel');
  if (psel && PLAYERS.length > 0) psel.value = PLAYERS[0].id;
  renderAll();
}

function closeCharModal() {
  const overlay = document.getElementById('modal-char-overlay');
  if(overlay) overlay.classList.remove('open');
}

function saveCharacter() {
  const name   = document.getElementById('c-name').value.trim() || 'Desconhecido';
  const race   = document.getElementById('c-race').value.trim() || 'Sem Raça';
  const cls    = getSelectedSubclasse() || 'Aventureiro';
  const classeBase = getBaseClass(cls) || cls;
  const hpMax  = parseInt(document.getElementById('c-hp').value)  || 30;
  const ins    = parseInt(document.getElementById('c-ins').value) || 0;
  const agi    = parseInt(document.getElementById('c-agi').value) || 10;
  const forca  = parseInt(document.getElementById('c-for').value) || 10;
  const intel  = parseInt(document.getElementById('c-int').value) || 10;
  const passos = parseInt(document.getElementById('c-passos').value) || 0;
  const dinheiroEl = document.getElementById('c-dinheiro');
  const dinheiro = dinheiroEl && dinheiroEl.value.trim() !== '' ? Math.max(0, parseInt(dinheiroEl.value)) : 100;

  // Origem racial (ex: Anão Comum / Anão Profundezas)
  const origemEl = document.getElementById('c-origem');
  const origemId = origemEl ? (origemEl.value || null) : null;

  if (modalCharId) {
    const p = PLAYERS.find(x => x.id === modalCharId);
    if (p) {
      const eraBruxo = p.classeBase === 'Bruxo';
      const eraBardo = p.classeBase === 'Bardo';
      p.name = name; p.race = race; p.cls = cls; p.classeBase = classeBase; p.hpMax = hpMax;
      if (p.hp > hpMax) p.hp = hpMax;
      p.ins = ins; p.agi = agi; p.forca = forca; p.intel = intel;
      p.passos = passos; p.dinheiro = dinheiro;
      p.origemId = origemId;
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
    }
  } else {
    const newId = PLAYERS.length > 0 ? Math.max(...PLAYERS.map(p => p.id)) + 1 : 1;
    const novo = {
      id: newId, name, race, cls, classeBase, level: 1, xp: 0,
      hp: hpMax, hpMax, agi, forca, intel,
      armadura: 0, armaduraMax: 0,
      elmo: 0, elmoMax: 0,
      passos, ins, dinheiro, origemId, skills: [], passivas: [], inventario: [],
      jogNotas: Object.fromEntries(JOG_NOTA_TAGS.map(t => [t.toLowerCase(), ''])),
      ownerId: currentUser ? currentUser.id : null,
      ownerName: currentUser ? currentUser.name : null
    };
    if (classeBase === 'Bruxo') novo.humanidade = HUMANIDADE_MAX;
    if (classeBase === 'Bardo') {
      novo.notasBardo = {};
      NOTAS_MUSICAIS.forEach(n => { novo.notasBardo[n] = false; });
    }
    ensureGeneralSkills(novo);
    ensureRacePassivas(novo);
    PLAYERS.push(novo);
    modalCharId = newId;
  }

  saveState();
  renderAll();
  const psel = document.getElementById('psel');
  if(psel) psel.value = modalCharId;
  renderJogador();
  closeCharModal();
}

// ═══════════════════════════════════════
// LISTENERS
// ═══════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('modal-overlay');
  if(overlay) overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  const charOverlay = document.getElementById('modal-char-overlay');
  if(charOverlay) charOverlay.addEventListener('click', e => { if (e.target === charOverlay) closeCharModal(); });
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeCharModal(); }
});

// ═══════════════════════════════════════
// RENDER GERAL
// ═══════════════════════════════════════
function renderAll() {
  const tn = document.getElementById('turn-num');
  if (tn) tn.textContent = turnGlobal;
  renderNarrador();
  renderNoteTags();
  renderInit();
  if (IS_JOGADOR) {
    renderPsel();
    renderJogador();
    if (jogActiveTab === 'anotacoes') renderJogNotas();
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
});
