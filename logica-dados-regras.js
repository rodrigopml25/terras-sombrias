// ═══════════════════════════════════════
// SISTEMA DE LOGIN
// ═══════════════════════════════════════
const POINT_BUY_PER_LEVEL = 5;

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
const ACOES_POR_TURNO_PADRAO = 2;

// Bruxos possuem o Atributo Secundário exclusivo "Humanidade": começa cheio
// (10/10) ao se tornar Bruxo e o máximo é fixo — não existe forma de aumentá-lo.
const HUMANIDADE_MAX = 10;

// Insanidade máxima: 100 pro geral, mas o Maestro Macabro ("Maestro
// Demoníaco") tem o máximo reduzido para 80 por conta do vínculo com
// demônios/criaturas bizarras.
const INSANIDADE_MAX_PADRAO = 100;
const INSANIDADE_MAX_MAESTRO_MACABRO = 80;
function getInsanidadeMax(p) {
  return (p && p.cls === 'Maestro Macabro') ? INSANIDADE_MAX_MAESTRO_MACABRO : INSANIDADE_MAX_PADRAO;
}

// Retorna a Humanidade atual de um personagem (fallback para o máximo em
// fichas antigas que ainda não tinham esse campo).
function getHumanidade(p) {
  return (typeof p.humanidade === 'number') ? p.humanidade : HUMANIDADE_MAX;
}

// ═══════════════════════════════════════
// EFEITOS SECUNDÁRIOS — Bruxo e Paladino
// ═══════════════════════════════════════
// Algumas Habilidades do banco têm um Efeito Secundário que só fica
// disponível se o personagem tiver a passiva correspondente da própria
// subclasse (concedida automaticamente a quem É daquela subclasse, mas pode
// ter sido removida manualmente da ficha — nesse caso, o Efeito Secundário
// some da Habilidade até a passiva ser restaurada). No Bruxo, esses efeitos
// custam Humanidade para ativar: Êxtase (Alquimista), Sacrilégio
// (Receptáculo Demoníaco) e Assombrar (Amaldiçoado). No Paladino, a
// Fidelidade (ligada à passiva Poder de um Fiel) funciona igual, mas não
// envolve Humanidade — por isso não define `custoHumanidade`.
const EFEITOS_SECUNDARIOS_ESPECIAIS = {
  extase:     { nome: 'Êxtase',     passivaId: 'alquimista_sistema_nervoso_elevado',        icone: '🩸' },
  sacrilegio: { nome: 'Sacrilégio', passivaId: 'receptaculo_demoniaco_selo_demoniaco',       icone: '🩸' },
  assombrar:  { nome: 'Assombrar',  passivaId: 'amaldicoado_maldicao',                       icone: '🩸' },
  fidelidade: { nome: 'Fidelidade', passivaId: 'paladino_poder_de_um_fiel',                  icone: '⚔️' },
};

// Alguns Efeitos Secundários (em especial alguns Êxtases) liberam um efeito
// extra fixo e compartilhado entre várias Habilidades — em vez de repetir o
// texto em cada uma, cada entrada do banco só marca `libera: 'adrenalina'` e
// a descrição correta é buscada aqui.
const EFEITOS_LIBERADOS = {
  adrenalina: { nome: 'Adrenalina', desc: 'Faça um ataque com sua Arma tendo Mega Vantagem, causando 1d4 de Dano, ou cure 1d4 da sua Vida.' },
};

// Verifica se o personagem ainda possui, na ficha, uma passiva de subclasse
// específica (por subclasseId) — pode ter sido excluída manualmente.
function temPassivaSubclasse(p, subclasseId) {
  return (p.passivas || []).some(pas => pas.subclasseId === subclasseId);
}

// Verifica se o personagem pode ativar um tipo de Efeito Secundário
// ('extase' | 'sacrilegio' | 'assombrar' | 'fidelidade'), checando a passiva vinculada.
function podeUsarEfeitoSecundario(p, tipoEfeito) {
  const info = EFEITOS_SECUNDARIOS_ESPECIAIS[tipoEfeito];
  return !!info && temPassivaSubclasse(p, info.passivaId);
}

// Expande/recolhe a caixa de Efeito Secundário dentro do card de habilidade.
function toggleEfeitoSecundario(boxId) {
  const el = document.getElementById(boxId);
  if (el) el.classList.toggle('collapsed');
}

// Versão em texto puro (sem HTML) do Efeito Secundário de uma Habilidade,
// para uso em tooltips nativos (title="..."), como no chip do Narrador.
function getEfeitoSecundarioTextoPlano(p, item) {
  const ef = item.efeitoSecundario;
  if (!ef || !podeUsarEfeitoSecundario(p, ef.tipo)) return '';
  const info = EFEITOS_SECUNDARIOS_ESPECIAIS[ef.tipo];
  const custoTxt = ef.custoHumanidade ? ` (${ef.custoHumanidade} de Humanidade)` : '';
  let txt = `\n\n${info.nome}${custoTxt}: ${ef.desc}`;
  const liberado = ef.libera && EFEITOS_LIBERADOS[ef.libera];
  if (liberado) txt += `\nLibera: ${liberado.nome} — ${liberado.desc}`;
  return txt;
}

// Monta o HTML do bloco de Efeito Secundário de uma Habilidade (card real ou
// do catálogo), OU string vazia se a Habilidade não tiver um, ou se o
// personagem não tiver a passiva necessária para usá-lo. Se o Efeito
// Secundário liberar um Efeito Liberado (ex: Adrenalina), esse vem aninhado
// dentro do mesmo bloco. Aparece minimizado por padrão — clique no
// cabeçalho pra expandir e ver a descrição completa.
function renderEfeitoSecundarioHtml(p, item) {
  const ef = item.efeitoSecundario;
  if (!ef || !podeUsarEfeitoSecundario(p, ef.tipo)) return '';
  const info = EFEITOS_SECUNDARIOS_ESPECIAIS[ef.tipo];
  const custoTxt = ef.custoHumanidade ? ` <span class="efeito-secundario-custo">(${ef.custoHumanidade} de Humanidade)</span>` : '';
  const liberado = ef.libera && EFEITOS_LIBERADOS[ef.libera];
  const liberadoHtml = liberado ? `
      <div class="efeito-liberado-box">
        <div class="efeito-secundario-titulo">⚡ Libera: ${liberado.nome}</div>
        <div class="efeito-secundario-desc">${liberado.desc}</div>
      </div>` : '';
  const boxId = 'ef-' + p.id + '-' + item.id;
  return `
    <div class="efeito-secundario-box collapsed" id="${boxId}">
      <div class="efeito-secundario-header" onclick="event.stopPropagation(); toggleEfeitoSecundario('${boxId}')">
        <span class="efeito-secundario-titulo">${info.icone || '✨'} ${info.nome}${custoTxt}</span>
        <i class="ti ti-chevron-down efeito-secundario-chevron"></i>
      </div>
      <div class="efeito-secundario-body">
        <div class="efeito-secundario-desc">${ef.desc}</div>
        ${liberadoHtml}
      </div>
    </div>`;
}

// Clérigos possuem o Atributo Secundário exclusivo "Pecado": começa em 0 e
// sobe conforme as decisões do personagem durante o jogo (o detalhe de como
// se ganha Pecado virá junto das Bênçãos/Intervenções/Milagres). É usado na
// fórmula do Teste de Devoção: 1d100 − (20 × Pecado).
function getPecado(p) {
  return (typeof p.pecado === 'number') ? p.pecado : 0;
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
  { id: 'iniciativa',  name: 'Iniciativa',  attr: 'neutro' },
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
  { id: 'devocao',     name: 'Devoção',     attr: 'neutro' }, // exclusivo de Clérigo
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
  'Dragão': [
    { id: 'dragao_dualidade_draconica', name: 'Dualidade Dracônica', desc: 'Escolha uma outra Raça para ser sua forma humanoide. Não receberá as Passivas e Habilidades dela! Enquanto estiver em forma de Dragão não poderá Aparar e terá Mega Desvantagem em Desviar no chão.' },
    { id: 'dragao_espectro_draconico', name: 'Espectro Dracônico', minLevel: 3, desc: 'Ao chegar no nível 3, você consegue utilizar suas Habilidades do seu Grimório na forma de Dragão. Nessa forma, suas Garras Dracônicas se tornam suas Armas. Se for um Bardo, elas têm uma Tatuagem Arcana que libera "Qualquer Nota" no Ataque.' },
  ],
  'Elfo': [
    { id: 'elfo_decreptico', name: 'Decréptico', desc: 'Por ter muitos anos de vida escolha 2 Testes de Intelecto para conceder, consequentemente, +1 de Vantagem e +3 de vantagem. Possui -2 de Desvantagem em Resistir.' },
    { id: 'elfo_aprendizagem_elfica', name: 'Aprendizagem Élfica', desc: 'Ao subir de Nível aprenda uma Habilidade de outra Classe (escolha no Banco de Habilidades, aba com o ícone da Classe de origem — cota própria, cumulativa por Nível).' },
  ],
  'Etéreo': [
    { id: 'etereo_lampejo_eterno', name: 'Lampejo Eterno', desc: 'Por ter seu corpo tomado por Éter seu movimento é sempre por meio de um teletransporte, ou seja, sempre está Engajado e seu deslocamento não possui obstáculos. (não atravessa paredes grossas)' },
    { id: 'etereo_entropia_constante', name: 'Entropia Constante', desc: 'Durante uma Luta/Cena de perigo, seu etér vibrará, assim, ao obter um Erro Crítico ou um Acerto Crítico em uma Ação ou Teste, libere uma Expressão Etérea rolando 1d6 sendo 2 dos resultados ligados à sua origem. Possui +5% tanto para acertos críticos quanto para erros críticos em ações e testes.' },
  ],
  'Humano': [
    { id: 'humano_normal', name: 'Normal', desc: 'Tem +2 de Vantagem em TODOS os testes. E no Teste de Emoção, ao invés do +2 é +10 de Vantagem.' },
    { id: 'humano_ambicao_humana', name: 'Ambição Humana', desc: 'Possui a ambição humana, assim na beira da Morte possuirá +1d8 de Vantagem em Teste de Resistir e +1d20 de Vantagem no Teste de Emoção.' },
  ],
  'Pandaren': [
    { id: 'pandaren_mente_equilibrada', name: 'Mente Equilibrada', desc: 'Seu teste de emoção é sempre em módulo, e por padrão tem mega vantagem (pode ser desligada manualmente). Porém, não possui vantagens em teste de emoção.' },
    { id: 'pandaren_bebedor_nato', name: 'Bebedor Nato', desc: 'Pelos costumes de Pandaren, você possui resistência contra bebidas alcoólicas e venenos. Assim, nos testes de resistência contra esses efeitos, precisa obter apenas resultados acima de 1.' },
  ],
  'Tauren': [
    { id: 'tauren_brutao', name: 'Brutão', desc: 'Escolha um Teste de Força e tenha Mega Vantagem nele por padrão. E escolha um Teste de Agilidade e tenha Mega Desvantagem nele por padrão.' },
    { id: 'tauren_bem_com_a_vida', name: 'De bem com a Vida', desc: 'Ao subir de Nível, recebe +4 de Pontos de Vida (aplicado automaticamente). Ao subir de Nível, não poderá gastar Pontos de Atributo em Vida.' },
  ],
  'Troll': [
    { id: 'troll_tatuagem_runica', name: 'Tatuagem Rúnica', desc: 'Seu corpo possui um desenho rúnico que concede +1 de Maestria em Agilidade, Força OU Intelecto (à sua escolha), mas concede apenas 5 Pontos de Vida na criação do personagem.' },
    { id: 'troll_encantamento_troll', name: 'Encantamento Troll', desc: 'Escolha uma Habilidade da sua Classe e encante-a: troque os dados de lançamento por um Teste de Arcano OU Teste de Místico. Ao subir de Nível, poderá encantar outra Habilidade de sua Classe.' },
  ],
};

// Habilidades raciais fixas — funcionam igual às habilidades gerais mas são
// exclusivas de cada raça. Formato idêntico ao GENERAL_SKILLS.
const RACAS_SKILLS = {
  'Draenei': [
    { id: 'sk_racial_draenei_adaptacao', name: 'Adaptação do Espaço', color: 'gray', cost: 0, tipo: 'sessao', usosMax: 3, desc: 'Possui +3 de Vantagem em um teste (sem ser de Emoção). Usar (3x por sessão): troque o Teste em que a Vantagem está. (não pode usar esta habilidade numa Luta). Precisa de 0 ações para ser usada.' },
  ],
  'Dragão': [
    { id: 'sk_racial_dragao_metamorfose', name: 'Metamorfose', color: 'gray', cost: 1, tipo: 'perturn', usosMax: 1, turnosRecarga: 1, desc: 'Liberta sua forma de Dragão. Enquanto estiver nela, receba 7+nível em Armadura corporal, 5+nível em Armadura de cabeça, suas Armaduras não podem baixar de 5 e ganhe Habilidades Dracônicas. Em forma de Dragão não pode usar Habilidades de Classe.' },
    { id: 'sk_racial_dragao_iniciar_voo', name: 'Iniciar Voo', color: 'gray', cost: 1, tipo: 'perturn', usosMax: 1, turnosRecarga: 1, desc: 'Levanta Voo, deslocando-se 5 casas para cima! Enquanto estiver voando, possui +10 de Passos e poderá Desviar. Subir uma Casa consome 2 Passos.' },
    { id: 'sk_racial_dragao_impacto_pouso', name: 'Impacto de Pouso', color: 'red', cost: 1, tipo: 'perturn', usosMax: 1, turnosRecarga: 1, desc: 'Precisa estar voando. Pouse causando 1d12 de Dano para TODOS em raio de 3 Casas e Empurre-os 2 Casas para trás.' },
  ],
  'Orc': [
    { id: 'sk_racial_orc_furia', name: 'Fúria de Orc', color: 'gray', cost: 0, tipo: 'sessao', usosMax: 5, desc: 'Sua próxima Habilidade não pode ser Aparada. Caso seja um golpe, possuirá +1d6 de Dano também.' },
    { id: 'sk_racial_orc_treinamento_militar', name: 'Treinamento Militar', color: 'gray', cost: 1, tipo: 'sessao', usosMax: 3, desc: 'Quando for Aparar, gaste uma Ação do seu próximo Turno; assim seu Aparar é Garantido, e ainda assim faça o teste de Aparar com 50% de chance crítica. Se tirar crítico, receba uma ação no próximo turno ou um contra-ataque.' },
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
  'Dragão': [
    {
      id: 'dragao_revoada_amarela',
      name: 'Amarela',
      desc: 'Nascido da Revoada Amarela, mestre das chamas e do calor abrasador.',
      skill: {
        id: 'sk_origem_dragao_sopro_fogo',
        name: 'Sopro de Fogo',
        color: 'green',
        cost: 1,
        tipo: 'perturn',
        usosMax: 1,
        turnosRecarga: 3,
        desc: 'Cuspa um Feixe de Fogo reto de (5x3 ou 3x5) Casas. Assim, causa 1d8 de Dano em TODOS que receberem o feixe.',
      },
    },
    {
      id: 'dragao_revoada_azul',
      name: 'Azul',
      desc: 'Nascido da Revoada Azul, canal do poder arcano mais puro.',
      skill: {
        id: 'sk_origem_dragao_sopro_arcano',
        name: 'Sopro Arcano',
        color: 'blue',
        cost: 1,
        tipo: 'perturn',
        usosMax: 1,
        turnosRecarga: 3,
        desc: 'Cuspa um feixe Arcano que pode percorrer 10 casas, causando 1d8 de Dano em TODOS que receberem o feixe. Caso o percurso termine onde começou, recarregue esse Feitiço.',
      },
    },
    {
      id: 'dragao_revoada_negra',
      name: 'Negra',
      desc: 'Nascido da Revoada Negra, portador de energia radioativa e corrosiva.',
      skill: {
        id: 'sk_origem_dragao_sopro_radioativo',
        name: 'Sopro Radioativo',
        color: 'blue',
        cost: 1,
        tipo: 'perturn',
        usosMax: 1,
        turnosRecarga: 3,
        desc: 'Cuspa um Feixe de Energia da Terra em um Alvo até 6 casas, causando 1d8 de Dano, depois exploda-o em (3x3) Casas — TODOS que foram explodidos recebem 1d4 de Dano na Armadura.',
      },
    },
    {
      id: 'dragao_revoada_verde',
      name: 'Verde',
      desc: 'Nascido da Revoada Verde, guardião dos sonhos e da natureza.',
      skill: {
        id: 'sk_origem_dragao_sopro_sonhos',
        name: 'Sopro dos Sonhos',
        color: 'blue',
        cost: 1,
        tipo: 'perturn',
        usosMax: 1,
        turnosRecarga: 3,
        desc: 'Cuspa um Feixe reto mágico de energia da Natureza de 8 Casas, causando 1d6 de Dano em TODOS que receberem o feixe e remove as Vantagens de Intelecto até o início do seu próximo Turno.',
      },
    },
    {
      id: 'dragao_revoada_vermelha',
      name: 'Vermelha',
      desc: 'Nascido da Revoada Vermelha, senhor do magma e da destruição ígnea.',
      skill: {
        id: 'sk_origem_dragao_sopro_magma',
        name: 'Sopro de Magma',
        color: 'blue',
        cost: 1,
        tipo: 'perturn',
        usosMax: 1,
        turnosRecarga: 3,
        desc: 'Dispare um Feixe de Magma que ocupa 4 Casas diferentes à sua escolha, até 8 casas, que ignora Armadura. Ao passar sobre o Magma, o alvo recebe 1d4 de Dano direto na Vida. O Magma esfria ao final da Luta.',
      },
    },
  ],
  'Elfo': [
    {
      id: 'elfo_origem_sangrento',
      name: 'Elfo Sangrento',
      desc: 'Natural de Lua Prata, a capital dos Elfos Sangrentos, marcado por uma cultura de poder e refinamento arcano.',
      passiva: {
        id: 'elfo_origem_sangrento_passiva',
        name: 'Origem Sangrenta',
        desc: 'Por viver em Lua Prata, uma capital de Elfos Sangrentos, começa o jogo com +200 de Dinheiro e uma Habilidade de outra Classe, porém não poderá pegar mais nenhuma Habilidade dessa mesma Classe.',
      },
    },
    {
      id: 'elfo_origem_noturno',
      name: 'Elfo Noturno',
      desc: 'Descendente das antigas tribos noturnas, adaptado às sombras e aos segredos da escuridão.',
      passiva: {
        id: 'elfo_origem_noturno_passiva',
        name: 'Origem Noturna',
        desc: 'Por pertencer a uma raça noturna, consegue enxergar no escuro natural. Escolha um Caminho de uma outra Classe e role 1d10 para receber uma Habilidade aleatória daquele Caminho, porém não poderá pegar mais nenhuma Habilidade daquele Caminho dessa Classe.',
      },
    },
  ],
  'Etéreo': [
    {
      id: 'etereo_origem_natural',
      name: 'Natural',
      desc: 'Você caiu em um buraco negro, tendo seu corpo tomado pelo éter de forma natural. Libera as Expressões Etéreas Levitação em Massa (5) e Transmutação (6).',
      passiva: {
        id: 'etereo_origem_natural_passiva',
        name: 'Origem Natural',
        desc: 'Você caiu em um buraco negro, assim você possui Levitação em Massa e Transmutação como Expressões do Étéreo. Consegue enxergar no escuro natural e possui Mega Vantagem no teste de História.',
      },
    },
    {
      id: 'etereo_origem_mistica',
      name: 'Mística',
      desc: 'Você caiu em um buraco negro místico, tendo seu éter impregnado de energia arcana. Libera as Expressões Etéreas Éter Macabro (5) e Metamorfose Cósmica (6).',
      passiva: {
        id: 'etereo_origem_mistica_passiva',
        name: 'Origem Mística',
        desc: 'Você caiu em um buraco negro místico, assim você possui Éter Macabro e Metamorfose Cósmica como Expressões do Etéreo. Seu teste de Emoção possui +2d20 de Vantagem e possui Mega Vantagem no teste Místico.',
      },
    },
  ],
  'Humano': [
    {
      id: 'humano_origem_vento_bravo',
      name: 'Vento Bravo',
      desc: 'Natural de Vento Bravo, a capital econômica dos Humanos, criado entre mercados, guildas comerciais e negociações.',
      passiva: {
        id: 'humano_origem_vento_bravo_passiva',
        name: 'Origem de Vento Bravo',
        desc: 'Por ter vivido em Vento Bravo, capital econômica dos Humanos, concede +2 de Vantagem para Teste de cada tipo (Agilidade, Força e Intelecto). Só funciona 2 vezes por teste. Repete isso ao subir de Nível. Seus Testes nunca possuem Mega Vantagem (não pode conceder ao teste de Emoção).',
      },
    },
    {
      id: 'humano_origem_kalindor',
      name: 'Kalindor',
      desc: 'Natural de Kalindor, a capital marítima dos Humanos, onde cresceu entre portos, navios e rotas comerciais pelo mar.',
      passiva: {
        id: 'humano_origem_kalindor_passiva',
        name: 'Origem de Kalindor',
        desc: 'Por ter vivido em Kalindor, capital marítima dos Humanos, sabe pilotar um Navio. Conceda +1d4 de Vantagem a algum Teste de sua escolha e -1d4 de Desvantagem para outro Teste, só funciona uma vez por Teste. Repete isso ao subir de Nível (não pode conceder ao teste de Emoção).',
      },
    },
  ],
  'Orc': [
    {
      id: 'orc_origem_comum',
      name: 'Comum',
      desc: 'Seus antepassados consumiram Sangue de Demônio, o que deixou sua pele esverdeada — um Orc como tantos outros das hordas comuns.',
      passiva: {
        id: 'orc_origem_comum_passiva',
        name: 'Origem Comum',
        desc: 'Seus antepassados consumiram Sangue de Demônio, assim, sua pele é esverdeada. Ao lançar uma Habilidade que utiliza arma e causar o dano total da arma, receberá +1 ação naquele turno; porém, atacará o alvo mais próximo. Se for um golpe, poderá escolher o alvo.',
      },
    },
    {
      id: 'orc_origem_maghar',
      name: "Mag'har",
      desc: "Descendente dos Orcs puros que nunca provaram o Sangue de Demônio, mantendo laços profundos com a natureza e os espíritos animais.",
      passiva: {
        id: 'orc_origem_maghar_passiva',
        name: "Origem Mag'har",
        desc: "Por ser um Orc puro possui a capacidade de falar com animais. Conceda para uma Habilidade +1d4 de Dano/Cura e, se for um golpe, concede +2 de Vantagem também. Repete isso ao subir de Nível. Só funciona uma vez por Habilidade. Porém, o teste de Arcano ou Místico (escolha) recebe Mega Desvantagem por padrão.",
      },
    },
  ],
  'Pandaren': [
    {
      id: 'pandaren_origem_comum',
      name: 'Comum',
      desc: 'Seguidor da filosofia tradicional pandarênica, buscando o equilíbrio entre corpo e mente através da disciplina.',
      passiva: {
        id: 'pandaren_origem_comum_passiva',
        name: 'Filosofia Pandarênica',
        minLevel: 3,
        desc: 'Por escolher o caminho da filosofia pandarênica, ao chegar ao Nível 3, escolha um tipo de Habilidade (Feitiço, Golpe ou Técnica) e elas possuirão +3 de Vantagem.',
      },
    },
    {
      id: 'pandaren_origem_lunfan',
      name: "Lun'fan",
      desc: "Seguidor do caminho proibido de Lun'fan, que abraça as Sombras e canaliza o Chi de forma instável.",
      passiva: {
        id: 'pandaren_origem_lunfan_passiva',
        name: "Caminho Lun'fan",
        minLevel: 3,
        desc: "Por escolher o caminho Lun'fan, que utiliza as Sombras e o Chi, ao chegar no Nível 3, escolha e receba uma Forma Sombria: Bombado, Feiticeiro ou Lutador.",
      },
    },
  ],
  'Tauren': [
    {
      id: 'tauren_origem_alta_montanha',
      name: 'Alta Montanha',
      desc: 'Nativo dos picos e vales gelados de Alta Montanha, conhece cada trilha e acidente natural da região.',
      passiva: {
        id: 'tauren_origem_alta_montanha_passiva',
        name: 'Alta Montanha',
        desc: 'Por ter vivido em Alta Montanha, você possui uma noção muito boa sobre a natureza dos lugares. Quando for fazer um Teste de Geografia baseado em Natureza possuirá +4 de Vantagem. Nos demais casos, terá +2 de Vantagem.',
      },
    },
    {
      id: 'tauren_origem_mulgore',
      name: 'Mulgore',
      desc: 'Nativo das planícies de Mulgore, cresceu entre guerreiros que carregam armas do tamanho de árvores.',
      passiva: {
        id: 'tauren_origem_mulgore_passiva',
        name: 'Mulgore',
        desc: 'Por ter vivido em Mulgore, possui a capacidade de utilizar Armas Pesadas, independente do caminho da sua Classe.',
      },
    },
  ],
  'Troll': [
    {
      id: 'troll_origem_comum',
      name: 'Comum',
      desc: 'Foi moldado pela cultura tradicional dos Trolls, mantendo laços com o Arcano e o Místico.',
      passiva: {
        id: 'troll_origem_comum_passiva',
        name: 'Comum',
        desc: 'Você pode trocar os dados de um Teste de Arcano OU Místico por outro Teste (exceto Emoção). Se não realizar a troca, receberá +1 de Vantagem em Testes de Arcano e Místico.',
      },
    },
    {
      id: 'troll_origem_colosso',
      name: 'Colosso',
      desc: 'Fruto de uma linhagem de Trolls gigantes, troca a sutileza da cultura tradicional por força e porte descomunais.',
      passiva: {
        id: 'troll_origem_colosso_passiva',
        name: 'Colosso',
        desc: 'Sua raça é de seres gigantes, assim, possui capacidade de Arremessar e Empurrar Objetos/Armas Pesadas e poderá equipar Armaduras, Elmos e Armas Pesadas independente do caminho da sua Classe. Porém, seus Encantamentos de Troll se tornam amaldiçoados, causando apenas 1d6 de Dano na sua Vida OU 1d6 de Insanidade (escolha toda vez que for usá-los).',
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
    // Algumas passivas de origem só existem a partir de um certo nível
    // (ex: origens do Pandaren, liberadas apenas no Nível 3). Abaixo disso,
    // a passiva nem aparece — e se o personagem descer de nível depois de
    // já tê-la, ela é removida de novo automaticamente.
    const minLevel = origemAtual.passiva.minLevel;
    // NPCs não têm Nível — têm acesso a todas as passivas da raça, mesmo as
    // que só seriam liberadas em Níveis superiores ao 1.
    const atendeNivel = p.isNPC || !minLevel || (p.level || 1) >= minLevel;
    const jaTem = p.passivas.some(pas => pas.origemId === p.origemId);
    if (atendeNivel && !jaTem) {
      p.passivas.push({
        id: 'pas_origem_' + p.origemId,
        origemId: p.origemId,
        racialId: origemAtual.passiva.id,
        name: origemAtual.passiva.name,
        desc: origemAtual.passiva.desc,
      });
    } else if (!atendeNivel && jaTem) {
      p.passivas = p.passivas.filter(pas => pas.origemId !== p.origemId);
    }
  }
}

// Retorna a lista de passivas raciais fixas de um personagem (vazio se a
// raça não tiver passivas cadastradas no catálogo acima).
function getRacePassivas(p) {
  return RACAS[p.race] || [];
}

// ═══════════════════════════════════════
// FORMAS SOMBRIAS — Caminho Lun'fan (Pandaren)
// ═══════════════════════════════════════
// Ao chegar no Nível 3 escolhendo o caminho Lun'fan, o jogador escolhe UMA das
// 3 Formas Sombrias abaixo. Cada Forma libera 2 Habilidades fixas: uma
// Habilidade Neutra (cinza) com o mesmo nome da Forma, e uma Habilidade
// colorida exclusiva daquela Forma. A escolha é definitiva até ser trocada
// manualmente (não há como "desescolher" pela ficha — reflete a narrativa).
const PANDAREN_FORMAS_SOMBRIAS = {
  bombado: {
    id: 'bombado',
    name: 'Bombado',
    tagline: 'Forma sombria baseada em Força',
    // Enquanto transformado, só pode usar Habilidades dessa cor (Golpes).
    corPermitida: 'red',
    // Vida Atual e Máxima concedidas ao assumir a Forma — só valem enquanto
    // ela estiver ativa (ver ativação/desativação em useSkill).
    bonusVida: 20,
    skillNeutra: {
      id: 'sk_forma_bombado', name: 'Bombado', color: 'gray', cost: 0, tipo: 'luta', usosMax: 1,
      desc: 'Transforme-se em uma criatura sombria baseada em Força. Ao assumir essa forma, receba +20 Pontos de Vida e a Habilidade Fruto Proibido. Nessa forma, só poderá usar Golpes. (Pode desfazê-la quando quiser)',
    },
    skillColorida: {
      id: 'sk_forma_bombado_fruto_proibido', name: 'Fruto Proibido', color: 'red', cost: 1, tipo: 'sessao', usosMax: 2,
      desc: 'Restaura TODA sua Vida ou Armadura. Se outra pessoa comer...',
    },
  },
  lutador: {
    id: 'lutador',
    name: 'Lutador',
    tagline: 'Forma sombria baseada em Agilidade',
    // Enquanto transformado, só pode usar Habilidades dessa cor (Técnicas).
    corPermitida: 'green',
    bonusVida: 15,
    skillNeutra: {
      id: 'sk_forma_lutador', name: 'Lutador', color: 'gray', cost: 0, tipo: 'luta', usosMax: 1,
      desc: 'Transforme-se em uma criatura sombria baseada em Agilidade. Ao assumir essa forma, receba +15 Pontos de Vida e a Habilidade Portal Negro. Nessa forma, só poderá usar Técnicas. (Pode desfazê-la quando quiser)',
    },
    skillColorida: {
      id: 'sk_forma_lutador_portal_negro', name: 'Portal Negro', color: 'green', cost: 1, tipo: 'sessao', usosMax: 3,
      desc: 'Crie 2 Portais Negros — a distância é o Tabuleiro inteiro; ao passar em um, aparecerá no outro. Pode fechá-los quando quiser e só pode ter 2 ativados por vez. Se alguém passar sem você...',
    },
  },
  feiticeiro: {
    id: 'feiticeiro',
    name: 'Feitiçeiro',
    tagline: 'Forma sombria baseada em Intelecto',
    // Enquanto transformado, só pode usar Habilidades dessa cor (Feitiços).
    corPermitida: 'blue',
    bonusVida: 10,
    skillNeutra: {
      id: 'sk_forma_feiticeiro', name: 'Feitiçeiro', color: 'gray', cost: 0, tipo: 'luta', usosMax: 1,
      desc: 'Transforme-se em uma criatura sombria baseada em Intelecto. Ao assumir essa forma, receba +10 Pontos de Vida e a Habilidade Runa Sombria. Nessa forma, só poderá usar Feitiços. (Pode desfazê-la quando quiser)',
    },
    skillColorida: {
      id: 'sk_forma_feiticeiro_runa_sombria', name: 'Runa Sombria', color: 'blue', cost: 1, tipo: 'sessao', usosMax: 6,
      desc: 'Crie uma Runa Sombria que, ao ser quebrada, causa 1d8 de Dano em um Alvo (independente da distância) e rouba Vida. Se já estiver criada, conceda +1d8 de Dano e +1 de Vantagem a ela. Se alguém quebrar sem ser você...',
    },
  },
};

// Rótulo (plural) da categoria de Habilidade liberada por cada cor —
// usado nas mensagens de bloqueio da Forma Sombria.
const FORMA_SOMBRIA_COR_LABEL = { red: 'Golpes', green: 'Técnicas', blue: 'Feitiços' };

// Retorna true se o personagem precisa escolher sua Forma Sombria agora
// (Pandaren, caminho Lun'fan, Nível 3+ e ainda sem escolha feita).
function precisaEscolherFormaSombria(p) {
  return p.race === 'Pandaren' && p.origemId === 'pandaren_origem_lunfan'
    && (p.isNPC || (p.level || 1) >= 3) && !p.formaSombriaId;
}

// Define a Forma Sombria escolhida pelo jogador e injeta suas 2 Habilidades.
function escolherFormaSombria(pid, formaId) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p || !PANDAREN_FORMAS_SOMBRIAS[formaId]) return;
  p.formaSombriaId = formaId;
  ensureFormaSombria(p);
  saveState(); renderAll();
  const overlay = document.getElementById('modal-forma-overlay');
  if (overlay) overlay.classList.remove('open');
}

// Garante que as 2 Habilidades da Forma Sombria escolhida estejam em p.skills,
// removendo as de qualquer outra Forma não selecionada. Se o personagem
// deixar de atender os requisitos (nível baixou, mudou de origem/raça), as
// Habilidades da Forma são removidas — mas a escolha (p.formaSombriaId) é
// mantida, reativando as mesmas Habilidades automaticamente se voltar a
// atender os requisitos.
function ensureFormaSombria(p) {
  if (!Array.isArray(p.skills)) p.skills = [];
  Object.values(PANDAREN_FORMAS_SOMBRIAS).forEach(f => {
    if (f.id !== p.formaSombriaId) {
      p.skills = p.skills.filter(sk => sk.id !== f.skillNeutra.id && sk.id !== f.skillColorida.id);
    }
  });
  const atende = p.race === 'Pandaren' && p.origemId === 'pandaren_origem_lunfan'
    && (p.isNPC || (p.level || 1) >= 3) && p.formaSombriaId;
  const forma = atende ? PANDAREN_FORMAS_SOMBRIAS[p.formaSombriaId] : null;
  if (!forma) {
    if (p.formaSombriaId) {
      const f = PANDAREN_FORMAS_SOMBRIAS[p.formaSombriaId];
      if (f) p.skills = p.skills.filter(sk => sk.id !== f.skillNeutra.id && sk.id !== f.skillColorida.id);
      // Se a Forma ficou ativa mas o personagem deixou de atender os
      // requisitos (ex: nível caiu), o bônus de Vida dela não pode ficar
      // preso pra sempre — mesma correção da desativação normal: só corta a
      // Vida Atual se estiver acima do novo Máximo.
      if (f && p.formaSombriaAtiva) {
        const bonusVidaForma = f.bonusVida || 0;
        p.hpMax = Math.max(1, (p.hpMax || 0) - bonusVidaForma);
        p.hp = Math.max(0, Math.min(p.hp || 0, p.hpMax));
      }
    }
    p.formaSombriaAtiva = false;
    return;
  }
  [forma.skillNeutra, forma.skillColorida].forEach(def => {
    const jaTem = p.skills.some(sk => sk.id === def.id);
    if (!jaTem) {
      p.skills.push({
        id: def.id, name: def.name, desc: def.desc,
        color: def.color, cost: def.cost, tipo: def.tipo,
        usosMax: def.usosMax, usosAtuais: def.usosMax,
        cdRestante: 0, turnosRecarga: 1,
      });
    }
  });
}

// true se a Habilidade `sk` for a Habilidade colorida exclusiva de alguma
// Forma Sombria (ex: "Fruto Proibido") e a Forma correspondente NÃO estiver
// ativa agora. Ela continua existindo em p.skills (preservando os usos já
// gastos), só fica escondida da lista enquanto o personagem não estiver
// transformado — reaparece do jeito que estava ao se transformar de novo.
function habilidadeFormaSombriaEscondida(p, sk) {
  if (p.race !== 'Pandaren') return false;
  return Object.values(PANDAREN_FORMAS_SOMBRIAS).some(f =>
    f.skillColorida.id === sk.id && !(p.formaSombriaId === f.id && p.formaSombriaAtiva)
  );
}

// true se a Habilidade `sk` estiver bloqueada agora por causa de uma Forma
// Sombria ativa (ex: transformado em Bombado só pode usar Golpes). A
// própria Habilidade da Forma (neutra ou colorida) e as Habilidades
// "Neutras" (cinza) nunca são bloqueadas.
function formaSombriaBloqueiaHabilidade(p, sk) {
  if (!(p.race === 'Pandaren' && p.formaSombriaAtiva && p.formaSombriaId)) return false;
  const forma = PANDAREN_FORMAS_SOMBRIAS[p.formaSombriaId];
  if (!forma) return false;
  if (sk.id === forma.skillNeutra.id || sk.id === forma.skillColorida.id) return false;
  if (sk.color === 'gray') return false;
  // Habilidades Gerais (Arremesso, Acrobacia, Empurrar, Teste Mental,
  // Furtividade, etc.) são Testes universais que todo personagem possui —
  // não são "Habilidades de Classe" e por isso nunca são bloqueadas por
  // uma Forma Sombria, mesmo tendo uma cor associada ao atributo.
  if (sk.id.startsWith('sk_geral_')) return false;
  return sk.color !== forma.corPermitida;
}

// "Fúria" (Combatente): bloqueia o uso de qualquer Habilidade que não seja
// vermelha (Golpe), neutra (cinza) ou uma das 3 exceções nomeadas no texto
// (Acrobacia, Furtividade, Teste Mental) — mesmo padrão de
// formaSombriaBloqueiaHabilidade, um pouco acima.
function furiaBloqueiaHabilidade(p, sk) {
  if (!p.furiaAtiva) return false;
  if (sk.color === 'red' || sk.color === 'gray') return false;
  if (sk.id === 'sk_geral_acrobacia' || sk.id === 'sk_geral_furtividade' || sk.id === 'sk_geral_teste_mental') return false;
  return true;
}

// Garante que as passivas raciais da raça do personagem estejam presentes em
// p.passivas (como qualquer outra passiva — editável e excluível). Não
// duplica as que já existem e não recoloca uma que o jogador excluiu de
// propósito (rastreado em p.racialPassivasRemovidas).
function ensureRacePassivas(p) {
  if (!Array.isArray(p.passivas)) p.passivas = [];
  if (!Array.isArray(p.racialPassivasRemovidas)) p.racialPassivasRemovidas = [];
  getRacePassivas(p).forEach(rp => {
    // Algumas passivas raciais só existem a partir de um certo nível
    // (ex: Espectro Dracônico, só a partir do Nível 3). Abaixo disso, a
    // passiva nem aparece — e se o personagem descer de nível depois de já
    // tê-la, ela é removida de novo automaticamente.
    const atendeNivel = p.isNPC || !rp.minLevel || (p.level || 1) >= rp.minLevel;
    const jaTem = p.passivas.some(pas => pas.racialId === rp.id);
    const foiRemovida = p.racialPassivasRemovidas.includes(rp.id);
    if (atendeNivel && !jaTem && !foiRemovida) {
      p.passivas.push({ id: 'pas_racial_' + rp.id, racialId: rp.id, name: rp.name, desc: rp.desc });
      // "Mente Equilibrada" (Pandaren): ao ganhar a passiva, pré-marca a
      // Mega Vantagem no Teste de Emoção como padrão — não é mais uma trava,
      // o jogador pode desligar normalmente pelo botão MV quando não valer.
      if (rp.id === 'pandaren_mente_equilibrada') {
        getTestePersonagem(p);
        if (p.testes.emocao) { p.testes.emocao.mv = true; p.testes.emocao.md = false; }
      }
    } else if (!atendeNivel && jaTem) {
      p.passivas = p.passivas.filter(pas => pas.racialId !== rp.id);
    }
  });
  // Garante que a passiva de origem racial também esteja presente
  ensureOrigemPassiva(p);
  // Garante que as habilidades raciais estejam presentes
  ensureRaceSkills(p);
  // Garante as Habilidades da Forma Sombria do caminho Lun'fan (Pandaren)
  ensureFormaSombria(p);
  // Garante a arma racial das Garras Dracônicas para Dragões
  ensureRaceWeapons(p);
  // Fora da forma de Dragão, remove de novo o que é exclusivo da Metamorfose
  syncFormaDragaoLock(p);
  // Garante as passivas fixas da subclasse (ex: Multifunções do Campeão)
  ensureSubclassePassivas(p);
  // Garante as passivas fixas da classe-base (ex: Instrumento Musical do Bardo)
  ensureClassePassivas(p);
  // Garante as armas exclusivas de subclasse (ex: Quebra Queixo do Briguento)
  ensureSubclasseWeapons(p);
  // Garante as habilidades exclusivas de subclasse (ex: Roda Punk do Roqueiro)
  ensureSubclasseSkills(p);
  // Garante as habilidades fixas de classe-base (ex: Teste de Devoção do Clérigo)
  ensureClasseSkills(p);
}

// Armas raciais fixas — injetadas automaticamente no inventário de personagens
// de certas raças, sem duplicar e respeitando remoções manuais.
const RACAS_WEAPONS = {
  'Dragão': [
    {
      id: 'racial_dragao_garras_draconicas',
      name: 'Garras Dracônicas',
      tipo: 'arma',
      peso: 'pesada',
      dano: '1d10',
      alcance: 'curto',
      efeito: 'Na forma Dracônica, utilize as Garras como Arma. Ataques possuem área de (2x3) Casas à frente. Não pode ser Aparada. No Nível 3, escolha uma Maestria para as Garras (padrão: Força).',
      aprimoramentos: [],
    },
  ],
};

// Injeta as armas raciais no inventário do personagem, sem duplicar e sem
// recolocar armas que o jogador removeu (rastreado em p.racialWeaponsRemovidas).
function ensureRaceWeapons(p) {
  if (!Array.isArray(p.inventario)) p.inventario = [];
  if (!Array.isArray(p.racialWeaponsRemovidas)) p.racialWeaponsRemovidas = [];
  const defs = RACAS_WEAPONS[p.race] || [];
  defs.forEach(def => {
    const jaTem = p.inventario.some(it => it.racialId === def.id);
    const foiRemovida = p.racialWeaponsRemovidas.includes(def.id);
    if (!jaTem && !foiRemovida) {
      p.inventario.push({ ...def, racialId: def.id, id: 'inv_racial_' + def.id });
    }
  });

  // Garras Dracônicas — a partir do Nível 3, se o Dragão for Bardo, ganham
  // uma Tatuagem Arcana que libera "Qualquer Nota" no Ataque (mesmo
  // mecanismo de escolha de nota do "Tocar Instrumento").
  if (p.race === 'Dragão') {
    const garras = p.inventario.find(it => it.racialId === 'racial_dragao_garras_draconicas');
    if (garras) {
      const temTatuagemArcana = (p.level || 1) >= 3 && p.classeBase === 'Bardo';
      if (!Array.isArray(garras.usos)) garras.usos = [];
      const jaTemUso = garras.usos.some(u => u.idInterno === 'garras_tatuagem_arcana');
      if (temTatuagemArcana && !jaTemUso) {
        garras.usos.push({ idInterno: 'garras_tatuagem_arcana', name: 'Tatuagem Arcana', desc: 'Ataque com as Garras Dracônicas e receba uma Nota Musical à sua escolha.', escopo: 'turno', usosMax: 1, concedeNotaEscolhida: true });
      } else if (!temTatuagemArcana && jaTemUso) {
        garras.usos = garras.usos.filter(u => u.idInterno !== 'garras_tatuagem_arcana');
      }
    }
  }
}

// Armas exclusivas de subclasse — mesmo padrão de RACAS_WEAPONS, mas
// injetadas conforme a subclasse (p.cls) em vez da raça.
const SUBCLASSES_WEAPONS = {
  'Briguento': [
    {
      id: 'subclasse_briguento_quebra_queixo',
      name: 'Quebra Queixo',
      tipo: 'arma',
      peso: 'pesada',
      dano: '1d10',
      alcance: 'curto',
      efeito: 'Escolha um golpe que não usa Arma. Pode lançá-lo uma vez por Luta. Possui -1d4 de Desvantagem em Aparar.',
      aprimoramentos: [],
    },
  ],
};

// Injeta as armas fixas da subclasse do personagem no inventário, sem
// duplicar e sem recolocar armas removidas manualmente (rastreado em
// p.subclasseWeaponsRemovidas). Ao trocar de subclasse, remove as armas da
// subclasse anterior que não pertençam mais à subclasse atual.
function ensureSubclasseWeapons(p) {
  if (!Array.isArray(p.inventario)) p.inventario = [];
  if (!Array.isArray(p.subclasseWeaponsRemovidas)) p.subclasseWeaponsRemovidas = [];

  // Remove armas de subclasses que não sejam a atual
  Object.entries(SUBCLASSES_WEAPONS).forEach(([subName, lista]) => {
    if (subName !== p.cls) {
      const ids = lista.map(w => w.id);
      p.inventario = p.inventario.filter(it => !it.subclasseId || !ids.includes(it.subclasseId));
    }
  });

  const defs = SUBCLASSES_WEAPONS[p.cls] || [];
  defs.forEach(def => {
    const jaTem = p.inventario.some(it => it.subclasseId === def.id);
    const foiRemovida = p.subclasseWeaponsRemovidas.includes(def.id);
    if (!jaTem && !foiRemovida) {
      p.inventario.push({ ...def, subclasseId: def.id, id: 'inv_subclasse_' + def.id });
    }
  });
}

// Habilidades exclusivas de subclasse — mesmo padrão de RACAS_SKILLS, mas
// injetadas conforme a subclasse (p.cls) em vez da raça.
const SUBCLASSES_SKILLS = {
  'Roqueiro': [
    { id: 'sk_subclasse_roqueiro_roda_punk', name: 'Roda Punk', color: 'red', cost: 1, tipo: 'sessao', usosMax: 3, desc: 'Entre em estado bruto e receba, nesse turno, +1 Golpe para cada Oponente na Luta, além de Movimento ilimitado. Porém, não pode repetir Golpes no mesmo Alvo. Para cada Golpe falho, o oponente contra-ataca causando 1d4 de Dano na Vida.' },
  ],
};

// Injeta as habilidades fixas da subclasse do personagem em p.skills, sem
// duplicar e sem recolocar as removidas manualmente (rastreado em
// p.subclasseSkillsRemovidas). Ao trocar de subclasse, remove as habilidades
// da subclasse anterior que não pertençam mais à subclasse atual.
function ensureSubclasseSkills(p) {
  if (!Array.isArray(p.skills)) p.skills = [];
  if (!Array.isArray(p.subclasseSkillsRemovidas)) p.subclasseSkillsRemovidas = [];

  // Remove habilidades de subclasses que não sejam a atual
  Object.entries(SUBCLASSES_SKILLS).forEach(([subName, lista]) => {
    if (subName !== p.cls) {
      const ids = lista.map(def => def.id);
      p.skills = p.skills.filter(sk => !ids.includes(sk.id));
    }
  });

  const defs = SUBCLASSES_SKILLS[p.cls] || [];
  defs.forEach(def => {
    const jaTem = p.skills.some(sk => sk.id === def.id);
    const foiRemovida = p.subclasseSkillsRemovidas.includes(def.id);
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

// Habilidades gerais de classe-base — mesmo padrão de SUBCLASSES_SKILLS, mas
// injetadas conforme a classe-base (p.classeBase) em vez da subclasse, para
// habilidades que valem pra qualquer subclasse daquela classe.
const CLASSES_SKILLS = {
  'Clérigo': [
    { id: 'sk_classe_clerigo_teste_devocao', name: 'Teste de Devoção', color: 'gray', cost: 1, tipo: 'turno_N', usosMax: 1, turnosRecarga: 1, desc: 'Faça uma oração para sua divindade: role 1d100 − (20 × Pecado). Dependendo do valor obtido, recebe: 1 → Nada; 2~65 → 1 Bênção; 66~90 → 1 Intervenção OU 2 Bênçãos; 91~99 → 1 Milagre OU 2 Intervenções; 100 → 1 Milagre Supremo ou um Milagre.' },
  ],
};

// Injeta as habilidades fixas da classe-base do personagem em p.skills, sem
// duplicar e sem recolocar as removidas manualmente (rastreado em
// p.classeSkillsRemovidas). Ao trocar de classe-base, remove as habilidades
// da classe-base anterior que não pertençam mais à atual.
function ensureClasseSkills(p) {
  if (!Array.isArray(p.skills)) p.skills = [];
  if (!Array.isArray(p.classeSkillsRemovidas)) p.classeSkillsRemovidas = [];

  Object.entries(CLASSES_SKILLS).forEach(([clsName, lista]) => {
    if (clsName !== p.classeBase) {
      const ids = lista.map(def => def.id);
      p.skills = p.skills.filter(sk => !ids.includes(sk.id));
    }
  });

  const defs = CLASSES_SKILLS[p.classeBase] || [];
  defs.forEach(def => {
    const jaTem = p.skills.some(sk => sk.id === def.id);
    const foiRemovida = p.classeSkillsRemovidas.includes(def.id);
    if (!jaTem && !foiRemovida) {
      p.skills.push({
        id: def.id, name: def.name, desc: def.desc,
        color: def.color, cost: def.cost, tipo: def.tipo,
        usosMax: def.usosMax, usosAtuais: def.usosMax,
        cdRestante: 0, turnosRecarga: def.turnosRecarga || 1,
      });
    }
  });
}

// ═══════════════════════════════════════
// BANCO DE TALENTOS INFERIORES
// ═══════════════════════════════════════
// Catálogo fixo de Talentos Inferiores. Todo personagem recebe o direito de
// escolher 1 Talento Inferior ao chegar no Nível 2 (ver getLimiteTalentosInferiores).
// Os talentos escolhidos são salvos em p.passivas (mesmo array das Passivas
// normais), marcados com o campo `talentoInferiorId` — assim reaproveitam a
// mesma UI de exibição/edição/exclusão das Passivas, tanto no Jogador quanto
// no Narrador, sem precisar de uma seção nova inteira.
const TALENTOS_INFERIORES = [
  { id: 'ambidestro', name: 'Ambidestro', desc: 'Você pode segurar uma 2ª Arma/Instrumento de uma mão só na mão secundária. Ao atacar com uma Arma (ou usar uma Habilidade que use Armas), pode escolher somar o Dano da 2ª arma ao ataque — porém, ao fazer isso, a Maestria do Acerto é reduzida pela metade (arredonda para cima).' },
  { id: 'aperfeicoamento_especifico', name: 'Aperfeiçoamento Específico', desc: 'Conceda a um teste +3 de vantagem. Se for um teste de emoção, será +14 de vantagem.' },
  { id: 'aprofundamento_na_area', name: 'Aprofundamento na Área', desc: 'Conceda a um teste de Agilidade, Força ou Intelecto Mega Vantagem. Se ela já tiver, ao invés disso, conceda: não tem mais erro crítico e tem +15% de chance crítica (-3 para acertar crítico).' },
  { id: 'armamentista_mistico', name: 'Armamentista Místico', desc: 'O Vazio encantou algumas armas/instrumentos musicais, assim, poderá comprá-los e utilizá-los conforme sua maestria de peso. Caso tenha acesso a elas sem ter esse talento, o Corromper Arma é crítico.' },
  { id: 'catalizador_de_lancamento', name: 'Catalizador de Lançamento', desc: 'Escolha 2 habilidades que não possuem "0 de recarga" de seu Grimório e reduza 1 Ação de lançamento delas, ou use numa habilidade só e reduza 2 Ações de lançamento dela. As condições são as mesmas.' },
  { id: 'catalizador_de_recarga', name: 'Catalizador de Recarga', desc: 'Escolha 2 habilidades que recarregam por turno e que possuam pelo menos 1 Ação de lançamento do seu Grimório e reduza um turno de recarga delas, ou use numa habilidade só e reduza 2 turnos de recarga dela. As condições são as mesmas.' },
  { id: 'equipamento_encantado', name: 'Equipamento Encantado', desc: 'Você possui acesso a armadura encantada, elmo encantado e armas encantadas. Podem ser encantadas com encantamentos arcanos ou místicos, no qual concede uma passiva e um feitiço/ritual místico.' },
  { id: 'equipamento_exotico', name: 'Equipamento Exótico', desc: 'Possui o direito de comprar armaduras exóticas, elmos exóticos, armas exóticas e aprimoramentos exóticos.' },
  { id: 'interesse_interdisciplinar', name: 'Interesse Interdisciplinar', desc: 'Aprenda mais 2 habilidades de sua Classe que não sejam do seu caminho.' },
  { id: 'maestria_de_peso_aprimorada', name: 'Maestria de Peso Aprimorada', desc: 'Melhore sua maestria de peso em 1 grau. Se você já for maestria Pesada, ou tiver acesso a essa, terá uma maestria Mega Pesada, permitindo acesso e compra de armadura, elmos e armas Mega Pesadas.' },
  { id: 'progressao', name: 'Progressão', desc: 'Receba +6 pontos de vida. Ao subir de Nível, receba +3 pontos de vida.' },
];

// Talentos Inferiores já escolhidos pelo personagem (vivem em p.passivas,
// identificados por `talentoInferiorId`).
function getTalentosInferioresEscolhidos(p) {
  return (p.passivas || []).filter(pas => pas.talentoInferiorId);
}

// Verifica se o personagem possui um Talento Superior específico (por id).
function temTalentoSuperior(p, talentoSuperiorId) {
  return getTalentosSuperioresEscolhidos(p).some(pas => pas.talentoSuperiorId === talentoSuperiorId);
}

// Quantos Talentos Inferiores o personagem tem direito de escolher. Regra
// base: recebe 1 ao chegar no Nível 2 (não escala com Níveis futuros). O
// Talento Superior "Base Sólida" concede +2 Talentos Inferiores adicionais
// (podendo repetir um que já possui — ver adicionarTalentoInferior).
function getLimiteTalentosInferiores(p) {
  if (p.isNPC) return Infinity;
  let limite = (p.level || 1) >= 2 ? 1 : 0;
  if (temTalentoSuperior(p, 'base_solida')) limite += 2;
  return limite;
}

// Quantas escolhas de Talento Inferior ainda faltam ser feitas — usado para
// exibir o aviso na ficha, mesmo padrão de getHabilidadesPendentes.
function getTalentosInferioresPendentes(p) {
  if (p.isNPC) return 0;
  return Math.max(0, getLimiteTalentosInferiores(p) - getTalentosInferioresEscolhidos(p).length);
}

// Adiciona um Talento Inferior do catálogo à ficha do personagem, respeitando
// o limite do Nível atual. Não duplica.
function adicionarTalentoInferior(pid, talentoId) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  const item = TALENTOS_INFERIORES.find(t => t.id === talentoId);
  if (!item) return;
  if (!Array.isArray(p.passivas)) p.passivas = [];

  // "Base Sólida" permite repetir um Talento Inferior já possuído; sem ela,
  // cada Talento Inferior só pode ser escolhido uma vez.
  const podeRepetir = temTalentoSuperior(p, 'base_solida');
  const qtdDoMesmo = p.passivas.filter(pas => pas.talentoInferiorId === item.id).length;
  if (qtdDoMesmo > 0 && !podeRepetir) return;

  const limite = getLimiteTalentosInferiores(p);
  const escolhidos = getTalentosInferioresEscolhidos(p).length;
  if (escolhidos >= limite) {
    alert(limite === 0
      ? 'Talentos Inferiores só ficam disponíveis a partir do Nível 2.'
      : `Limite de Talentos Inferiores atingido (máx. ${limite}). Suba de Nível (ou tenha "Base Sólida") para desbloquear mais.`);
    return;
  }

  const instanceId = qtdDoMesmo > 0 ? `pas_talento_${item.id}_${qtdDoMesmo + 1}` : 'pas_talento_' + item.id;
  p.passivas.push({ id: instanceId, talentoInferiorId: item.id, name: item.name, desc: item.desc });
  saveState();
  renderAll();
  if (typeof renderTalentosModal === 'function') renderTalentosModal(pid);
}

// ═══════════════════════════════════════
// BANCO DE TALENTOS SUPERIORES
// ═══════════════════════════════════════
// Mesmo padrão dos Talentos Inferiores, mas liberado no Nível 4. Também
// salvos em p.passivas, marcados com `talentoSuperiorId`.
const TALENTOS_SUPERIORES = [
  { id: 'auge_do_poder', name: 'Auge do Poder', desc: 'Escolha uma Técnica, um Golpe e um Feitiço do seu Grimório. Conceda para cada um deles: Mega Vantagem (se já tiver, conceda +1d6 de Vantagem); +20% de chance crítica (-4 para acertar crítico); e reduza 2 turnos de recarga deles (não podem ter Ação como 0).' },
  { id: 'base_solida', name: 'Base Sólida', desc: 'Escolha 2 Talentos Inferiores — pode repetir um que você já possui.' },
  { id: 'catalizador_de_recarga_supremo', name: 'Catalizador de Recarga Supremo', desc: 'Troque a recarga de "sessão" para "luta" de uma habilidade do Grimório.' },
  { id: 'complemento', name: 'Complemento', desc: 'Dobre os "usos (Nx)" de uma habilidade do seu Grimório.' },
  { id: 'hibrido', name: 'Híbrido', desc: 'Aprenda uma nova área de combate: escolha um caminho de Classe da sua Classe e receba as Passivas dele, 2 Habilidades desse caminho, direito de uso do peso dela, Mega Vantagem a um teste da área dela e +1 de maestria da área do caminho.' },
  { id: 'proeminencia_sensorial', name: 'Proeminência Sensorial', desc: 'Seu reflexo se aprimora: você sempre está engajado (não recebe ataque ao passar próximo de um adversário); sua iniciativa é 2d20; pode fazer teste de Percepção ao invés de Arcano e Místico; seu teste de Percepção possui Mega Vantagem (caso já tenha, recebe +1d6 de Vantagem); pode ver no escuro natural e mágico; pode ver coisas invisíveis e não é mais surpreendido.' },
  { id: 'sangue_aprimorado', name: 'Sangue Aprimorado', desc: 'Receba +10 pontos de vida. Para cada 1 de dano que você receber na Vida, ganhe 1 ponto de Sangue, que pode ser gasto concedendo +1 de dano ou +1 de Vantagem em qualquer teste/ação (máximo de 5 pontos de Sangue por vez).' },
  { id: 'superacao_de_limite', name: 'Superação de Limite', desc: 'Não pode mais ser movido sem sua vontade; pode empurrar e arremessar objetos Mega Pesados; seu teste de Resistência possui Mega Vantagem (caso já tenha, recebe +1d6 de Vantagem); pode usar um teste de Resistência ao invés de um teste de Emoção; todo dano recebido é reduzido pela metade (arredonda para cima) e possui 6 de Armadura que não pode ser reduzida.' },
  { id: 'transcendencia_mental', name: 'Transcendência Mental', desc: 'Seus feitiços têm +3 de alcance e dano/cura; conceda Mega Vantagem ao teste de Arcano ou Místico (caso já possua, recebe +1d6 de Vantagem). Além disso, possui um escudo psíquico com Vida = (maestria de Intelecto)², que se regenera ao fim da luta, e aprende um feitiço Lendário.' },
  { id: 'vinculo_mistico', name: 'Vínculo Místico', desc: 'Sua insanidade máxima é dobrada; possui Mega Vantagem no teste de Emoção e nos dados de Sanidade (caso já tenha Mega Vantagem no teste de Emoção, recebe +40% de Vantagem); seu teste de Emoção é 2d100 - insanidade; sequelas emocionais não possuem mais efeitos sobre você; e tem direito a um ritual Místico.' },
];

// Talentos Superiores já escolhidos pelo personagem (vivem em p.passivas,
// identificados por `talentoSuperiorId`).
function getTalentosSuperioresEscolhidos(p) {
  return (p.passivas || []).filter(pas => pas.talentoSuperiorId);
}

// Quantos Talentos Superiores o personagem tem direito de escolher. Regra
// atual: recebe 1 ao chegar no Nível 4 (não escala com Níveis futuros).
function getLimiteTalentosSuperiores(p) {
  if (p.isNPC) return Infinity;
  return (p.level || 1) >= 4 ? 1 : 0;
}

// Quantas escolhas de Talento Superior ainda faltam ser feitas.
function getTalentosSuperioresPendentes(p) {
  if (p.isNPC) return 0;
  return Math.max(0, getLimiteTalentosSuperiores(p) - getTalentosSuperioresEscolhidos(p).length);
}

// Adiciona um Talento Superior do catálogo à ficha do personagem, respeitando
// o limite do Nível atual. Não duplica.
function adicionarTalentoSuperior(pid, talentoId) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  const item = TALENTOS_SUPERIORES.find(t => t.id === talentoId);
  if (!item) return;
  if (!Array.isArray(p.passivas)) p.passivas = [];
  const jaTem = p.passivas.some(pas => pas.talentoSuperiorId === item.id);
  if (jaTem) return;

  const limite = getLimiteTalentosSuperiores(p);
  const escolhidos = getTalentosSuperioresEscolhidos(p).length;
  if (escolhidos >= limite) {
    alert(limite === 0
      ? 'Talentos Superiores só ficam disponíveis a partir do Nível 4.'
      : `Limite de Talentos Superiores atingido (máx. ${limite}). Suba de Nível para desbloquear mais.`);
    return;
  }

  p.passivas.push({ id: 'pas_talento_sup_' + item.id, talentoSuperiorId: item.id, name: item.name, desc: item.desc });
  saveState();
  renderAll();
  if (typeof renderTalentosSuperioresModal === 'function') renderTalentosSuperioresModal(pid);
}

// ═══════════════════════════════════════
// BANCO DE FEITIÇOS LENDÁRIOS
// ═══════════════════════════════════════
// Catálogo fixo de Feitiços Lendários. Diferente das Habilidades normais de
// Intelecto, os Feitiços Lendários usam maestria de Intelecto/2 (arredonda
// para cima) em vez da maestria cheia — ver getMaestriaLendaria. Duas fontes
// concedem o direito de escolher 1 Feitiço Lendário cada (podem se somar):
// - Conjurador, Passiva "Transcendência Intelectual": no Nível 5, em vez de
//   mais uma Habilidade de outra Classe, aprende um Feitiço Lendário.
// - Talento Superior "Transcendência Mental": concede 1 Feitiço Lendário.
// São salvos em p.skills (mesmo array das Habilidades normais), marcados com
// `lendario: true`, cor azul (Feitiço/Intelecto) — reaproveitam a mesma UI
// de exibição/uso/edição das Habilidades.
const FEITICOS_LENDARIOS = [
  { id: 'som_primordial', name: 'Som Primordial', desc: 'O alvo escutará o som do Big Bang. Neste turno, escutará um som grave e profundo, causando 1d8 de dano direto na Vida. No turno dele, o som se torna agudo e próximo, causando 1d20 de dano direto na Vida e Surdez. O som agudo continuará, causando dano também no turno do alvo. Ele poderá confrontar com um teste de Resistência contra o seu teste de Arcano ou Místico.', cost: 1, tipo: 'sessao', usosMax: 1 },
  { id: 'nova_congelante', name: 'Nova Congelante', desc: 'Congele 5x5 casas, com você no centro, afetando todos os outros. Para sair, é necessário fazer um teste de Resistência contra o seu teste de Arcano ou Místico, o que custa o turno inteiro. Ao atacar alguém congelado, será acerto crítico e removerá o congelamento.', cost: 1, tipo: 'sessao', usosMax: 2 },
  { id: 'maldicao_pos_vida', name: 'Maldição Pós-Vida', desc: 'Evoque uma alma perdida de um bruxo amaldiçoado que fica grudada com você, dividindo o turno com você. Ela não pode ser tocada e nem toca fisicamente, possui todos os feitiços de Bruxo, tem 50 pontos de Vida, 2 Ações próprias, os Assombrar estão ativados e seus dados de lançamento são o seu teste de Arcano ou Místico. Só pode evocar 1 por vez.', cost: 1, tipo: 'sessao', usosMax: 2 },
  { id: 'ilusao_perfeita', name: 'Ilusão Perfeita', desc: 'Vire o Narrador até o início do seu próximo turno e altere a cena como quiser. Ao acabar o efeito, a cena retornará como era, porém você pode fazer 4 Ações enquanto estiver na ilusão. Os outros podem fazer um teste de Percepção contra o seu teste de Arcano ou Místico para sair da ilusão.', cost: 2, tipo: 'sessao', usosMax: 1 },
  { id: 'expansao_de_dominio', name: 'Expansão de Domínio', desc: 'Seu aspecto mágico se manifesta em todo o tabuleiro, tornando-se seu domínio — os outros não poderão lançar feitiços. Podem fazer um teste de Arcano ou Místico contra o seu para superar o seu domínio; caso falhem, recebem 1d10 de dano na Vida. Podem tentar até conseguir.', cost: 1, tipo: 'sessao', usosMax: 1 },
  { id: 'demonstracao_ungida', name: 'Demonstração Ungida', desc: 'Alguma divindade lança um feixe sagrado num alvo: se for inimigo, causa 1d20 de dano; se for aliado, cura 1d20. Se no dado de dano/cura sair valor acima de 10, poderá lançar novamente com 1d12 — e se no 1d12 ocorrer o mesmo, repete (pode ser infinito).', cost: 1, tipo: 'sessao', usosMax: 1 },
];

// Maestria usada pelos Feitiços Lendários: metade da maestria de Intelecto,
// arredondada para cima (regra própria, diferente da maestria cheia usada
// pelos demais Feitiços).
function getMaestriaLendaria(p) {
  return Math.ceil(maestriaDe(p, 'intel') / 2);
}

// O personagem tem alguma fonte que concede direito a Feitiço Lendário
// (Conjurador ou Talento Superior "Transcendência Mental")? Usado só pra
// decidir se mostra o botão de escolha na ficha.
function temAcessoFeiticoLendario(p) {
  const ehConjurador = p.cls === 'Conjurador';
  const temTranscendenciaMental = getTalentosSuperioresEscolhidos(p).some(pas => pas.talentoSuperiorId === 'transcendencia_mental');
  return ehConjurador || temTranscendenciaMental;
}

// Quantos Feitiços Lendários o personagem tem direito de escolher — as
// fontes se somam se o personagem tiver as duas.
function getLimiteFeiticosLendarios(p) {
  let limite = 0;
  if (p.cls === 'Conjurador' && (p.level || 1) >= 5) limite += 1;
  if (getTalentosSuperioresEscolhidos(p).some(pas => pas.talentoSuperiorId === 'transcendencia_mental')) limite += 1;
  return limite;
}

function getFeiticosLendariosEscolhidos(p) {
  return (p.skills || []).filter(sk => sk.lendario);
}

function getFeiticosLendariosPendentes(p) {
  return Math.max(0, getLimiteFeiticosLendarios(p) - getFeiticosLendariosEscolhidos(p).length);
}

// Constrói o objeto de Habilidade (skill) para um Feitiço Lendário escolhido
// do catálogo, pronto para entrar em p.skills.
function construirSkillLendaria(item) {
  return {
    id: 'sk_lendario_' + item.id,
    lendario: true,
    name: item.name,
    desc: item.desc,
    color: 'blue',
    cost: item.cost,
    tipo: item.tipo,
    usosMax: item.usosMax,
    usosAtuais: item.usosMax,
    cdRestante: 0,
    turnosRecarga: item.turnosRecarga || 0,
  };
}

// Adiciona um Feitiço Lendário do catálogo à ficha do personagem, respeitando
// o limite de fontes que ele possui. Não duplica.
function adicionarFeiticoLendario(pid, itemId) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  const item = FEITICOS_LENDARIOS.find(f => f.id === itemId);
  if (!item) return;
  if (!Array.isArray(p.skills)) p.skills = [];
  const jaTem = p.skills.some(sk => sk.lendario && sk.id === 'sk_lendario_' + item.id);
  if (jaTem) return;

  const limite = getLimiteFeiticosLendarios(p);
  const escolhidos = getFeiticosLendariosEscolhidos(p).length;
  if (escolhidos >= limite) {
    alert(limite === 0
      ? 'Você ainda não tem direito a um Feitiço Lendário (precisa ser Conjurador no Nível 5 ou ter o Talento Superior "Transcendência Mental").'
      : `Limite de Feitiços Lendários atingido (máx. ${limite}).`);
    return;
  }

  p.skills.push(construirSkillLendaria(item));
  saveState();
  renderAll();
  if (typeof renderFeiticosLendariosModal === 'function') renderFeiticosLendariosModal(pid);
}

// Monta o HTML do bloco "Corromper" de um Ritual Macabro — diferente do
// Efeito Secundário (que depende de uma passiva de subclasse e custa
// Humanidade), o Corromper é intrínseco ao próprio Ritual e custa Sanidade
// (um dado, ex: "1d10"). Sempre visível, sem checagem de passiva. Reaproveita
// as mesmas classes CSS do Efeito Secundário (caixa colapsável).
function renderCorromperHtml(uniqueKey, item) {
  const cor = item.corromper;
  if (!cor) return '';
  const boxId = 'corromper-' + uniqueKey;
  return `
    <div class="efeito-secundario-box collapsed" id="${boxId}">
      <div class="efeito-secundario-header" onclick="event.stopPropagation(); toggleEfeitoSecundario('${boxId}')">
        <span class="efeito-secundario-titulo">🌀 Corromper <span class="efeito-secundario-custo">(${cor.dado} de Sanidade)</span></span>
        <i class="ti ti-chevron-down efeito-secundario-chevron"></i>
      </div>
      <div class="efeito-secundario-body">
        <div class="efeito-secundario-desc">${cor.desc}</div>
      </div>
    </div>`;
}

// Versão em texto puro do Corromper, pra tooltips nativos (chip do Narrador).
function getCorromperTextoPlano(item) {
  const cor = item.corromper;
  if (!cor) return '';
  return `\n\nCorromper (${cor.dado} de Sanidade): ${cor.desc}`;
}

// ═══════════════════════════════════════
// BANCO DE RITUAIS MACABROS
// ═══════════════════════════════════════
// Catálogo fixo de Rituais Macabros, concedidos pelo Talento Superior
// "Vínculo Místico" ("...tem direito a um ritual místico"). Não possuem
// nenhuma maestria vinculada (cor 'gray' / Neutras, sem bônus de atributo).
// Cada um tem uma versão "Corromper": um efeito extra, mais poderoso, pago
// com dano direto na Sanidade (aumenta a Insanidade) em vez de Ação extra ou
// Humanidade. São salvos em p.skills, marcados com `ritualMacabro: true`.
const RITUAIS_MACABROS = [
  { id: 'perfeicao_armamentista', name: 'Perfeição Armamentista', desc: 'Sua arma cria um olho até o final do turno que irá nas fraquezas do alvo: o alvo não pode desviar e o dano da sua arma tem Mega Vantagem.', corromper: { dado: '1d10', desc: 'O Vazio aprimora sua criação: +1 Ação e +1 dado de dano base até o final do seu turno.' }, cost: 0, tipo: 'turno_N', turnosRecarga: 2, usosMax: 1 },
  { id: 'bola_de_cristal_corrompida', name: 'Bola de Cristal Corrompida', desc: 'Você prevê a próxima ação do alvo. Se a ação mudar por causa da luta, você saberá.', corromper: { dado: '1d20', desc: 'O Vazio introduz um pensamento na mente do alvo, permitindo que você altere a próxima ação dele como desejar.' }, cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1 },
  { id: 'aura_de_caos', name: 'Aura de Caos', desc: 'Receba asas do Caos até o final do próximo turno. Gasta 1 de Passos para levantar ou descer voando. Ao voar, recebe +12 de Passos e +1d8 de Vantagem em ataques de longo alcance.', corromper: { dado: '1d20', desc: 'O Vazio te concede mais poder: as asas se mantêm até o final da luta/cena.' }, cost: 0, tipo: 'turno_N', turnosRecarga: 5, usosMax: 1 },
  { id: 'remoldando_a_realidade', name: 'Remoldando a Realidade', desc: 'Cancele um resultado de qualquer dado. Se quiser, pode relançar. (Pode usar fora do turno.)', corromper: { dado: '1d10', desc: 'O Vazio altera a ação/teste/cena que exigiu o dado do jeito que você desejar.' }, cost: 0, tipo: 'sessao', usosMax: 3 },
  { id: 'remicao_profana', name: 'Remição Profana', desc: 'Consuma 1d4 de Sanidade e receba 1 Ação neste turno; receba 1 Ação de Movimento neste turno; cure 1d8 da sua Vida ou restaure 1d4 da sua Armadura. Além disso, neste turno, uma Habilidade sua não gasta uma Ação.', corromper: { dado: '3d4', desc: 'O Vazio te oferece todas as outras opções de uma vez.' }, cost: 0, tipo: 'sessao', usosMax: 5 },
  { id: 'poema_caotico', name: 'Poema Caótico', desc: 'Escolha um alvo e as vozes te contarão uma informação útil sobre ele.', corromper: { dado: '3d10', desc: 'O Vazio te oferece 3 informações sobre o alvo, escolha 1 e ela será adicionada sobre o alvo.' }, cost: 1, tipo: 'turno_N', turnosRecarga: 3, concedeNota: 'qualquer', usosMax: 1 },
];

// O personagem tem acesso aos Rituais Macabros (Talento Superior "Vínculo
// Místico")? Usado só pra decidir se mostra o botão de escolha na ficha.
function temAcessoRitualMacabro(p) {
  return getTalentosSuperioresEscolhidos(p).some(pas => pas.talentoSuperiorId === 'vinculo_mistico');
}

// Quantos Rituais Macabros o personagem tem direito de escolher — "Vínculo
// Místico" concede o direito a 1.
function getLimiteRituaisMacabros(p) {
  return temAcessoRitualMacabro(p) ? 1 : 0;
}

function getRituaisMacabrosEscolhidos(p) {
  return (p.skills || []).filter(sk => sk.ritualMacabro);
}

function getRituaisMacabrosPendentes(p) {
  return Math.max(0, getLimiteRituaisMacabros(p) - getRituaisMacabrosEscolhidos(p).length);
}

// Constrói o objeto de Habilidade (skill) para um Ritual Macabro escolhido
// do catálogo, pronto para entrar em p.skills.
function construirSkillRitualMacabro(item) {
  return {
    id: 'sk_ritual_' + item.id,
    ritualMacabro: true,
    name: item.name,
    desc: item.desc,
    color: 'gray',
    cost: item.cost,
    tipo: item.tipo,
    usosMax: item.usosMax,
    usosAtuais: item.usosMax,
    cdRestante: 0,
    turnosRecarga: item.turnosRecarga || 0,
    corromper: item.corromper,
    concedeNota: item.concedeNota || null,
  };
}

// Adiciona um Ritual Macabro do catálogo à ficha do personagem, respeitando
// o limite (1, dado por "Vínculo Místico"). Não duplica.
function adicionarRitualMacabro(pid, itemId) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  const item = RITUAIS_MACABROS.find(r => r.id === itemId);
  if (!item) return;
  if (!Array.isArray(p.skills)) p.skills = [];
  const jaTem = p.skills.some(sk => sk.ritualMacabro && sk.id === 'sk_ritual_' + item.id);
  if (jaTem) return;

  const limite = getLimiteRituaisMacabros(p);
  const escolhidos = getRituaisMacabrosEscolhidos(p).length;
  if (escolhidos >= limite) {
    alert(limite === 0
      ? 'Você ainda não tem direito a um Ritual Macabro (precisa do Talento Superior "Vínculo Místico").'
      : `Limite de Rituais Macabros atingido (máx. ${limite}).`);
    return;
  }

  p.skills.push(construirSkillRitualMacabro(item));
  saveState();
  renderAll();
  if (typeof renderRituaisMacabrosModal === 'function') renderRituaisMacabrosModal(pid);
}

// ═══════════════════════════════════════
// ENCANTAMENTOS DE EQUIPAMENTO (Armadura/Elmo/Arma/Instrumento Encantados)
// ═══════════════════════════════════════
// Requerem o Talento Inferior "Equipamento Encantado" e são aplicados
// diretamente a um item de Inventário com peso 'encantada' (mesmo espírito
// dos itens Exóticos: uma categoria de peso a mais, tratada dentro do
// próprio modal de Inventário — ver _updateInvModalSections/saveInvItem).
// Cada item encantado tem espaço para 1 Encantamento: uma Passiva (guardada
// em item.encantamento) + um Feitiço (estilo 'arcano') ou Ritual Místico
// (estilo 'mistico'). O Feitiço/Ritual concedido é empurrado pra p.skills
// (mesmo padrão dos Feitiços Lendários/Rituais Macabros), marcado com
// `encantamentoItemId` apontando pro item de inventário que o concedeu —
// assim ele é substituído/removido junto quando o Encantamento muda ou o
// item é excluído (ver saveInvItem/deleteInvItem).
// Regra importante: um mesmo personagem só pode ter um ESTILO de
// Encantamento (Arcano OU Místico) em todos os seus equipamentos ao mesmo
// tempo — ver getEstiloEncantamentoAtual/getEncantamentosDisponiveis.
const ENCANTAMENTOS_EQUIPAMENTO = [
  {
    id: 'cartomante_arcano', name: 'Cartomante Arcano', estilo: 'arcano', custo: 75,
    passivaDesc: 'Nos seus braceletes existe uma escrita arcana que se manifesta como carta. Assim, no início do seu turno, lance 1d6 — cada número representa uma carta diferente. Ao ter seis cartas diferentes, poderá gastá-las: seu próximo Feitiço lançado possuirá crítico garantido.',
    concede: {
      tipoConcedido: 'feitico', name: 'Embaralhamento Arcano',
      desc: 'Troque uma carta repetida por uma carta que você ainda não possui.',
      cost: 1, tipo: 'turno_N', turnosRecarga: 0, usosMax: 1,
    },
  },
  {
    id: 'arcano_unificado', name: 'Arcano Unificado', estilo: 'arcano', custo: 75,
    passivaDesc: 'As escritas arcanas da sua armadura encantada emanam um vínculo mágico poderoso entre você e o ambiente: toda vez que lançar um Feitiço, restaura apenas 3 de Vida.',
    concede: {
      tipoConcedido: 'feitico', name: 'Cisão Arcana',
      desc: 'As escritas arcanas concentram tanto poder que você recebe 1d10 de dano na Vida, mas seu próximo Feitiço será lançado 2 vezes (não acumula). Pode ser usada 2 vezes por sessão e não consome Ação.',
      cost: 0, tipo: 'sessao', usosMax: 2,
    },
  },
  {
    id: 'receptaculo_caotico', name: 'Receptáculo Caótico', estilo: 'mistico', custo: 75,
    passivaDesc: 'Sua armadura encantada possui escritas místicas vazias: toda vez que você corromper um Ritual Místico ou Arma, pode sacrificar 1 de Armadura para não receber a Insanidade. Porém, quando sua armadura encantada quebrar, você receberá a insanidade acumulada como dano.',
    concede: {
      tipoConcedido: 'ritual', name: 'Loucura Acumulada',
      desc: 'Esvazie uma escrita mística: receba o quanto quiser da insanidade acumulada como dano e restaure 1 de Armadura da armadura encantada. Pode ser usada 4 vezes por armadura e não consome Ação.',
      corromper: { dado: '1d8', desc: 'Não recebe o dano — mas, se corromper, essa escrita não pode ser mandada para uma escrita mística vazia.' },
      cost: 0, tipo: 'sessao', usosMax: 4, resetSessao: false,
    },
  },
  {
    id: 'cartomante_mistico', name: 'Cartomante Místico', estilo: 'mistico', custo: 75,
    passivaDesc: 'Nos seus braceletes existe uma escrita mística que se manifesta como carta. Assim, no início do seu turno, lance 1d6 — cada número representa uma carta diferente. Ao ter seis cartas diferentes, poderá gastá-las: você possuirá um turno extra.',
    concede: {
      tipoConcedido: 'ritual', name: 'Baralho Maldito',
      desc: 'Troque uma carta por uma que você ainda não possui, ou gaste uma carta para ativar um efeito conforme o valor: 1 — causa 1d8 de dano (garantido) em um alvo até 6 casas; 2 — restaure 1d8 de Vida; 3 — receba uma Ação de Movimento; 4 — recarregue um turno de recarga de um Feitiço; 5 — seu próximo teste não consome Ação; 6 — seu próximo Feitiço não consome Ação.',
      corromper: { dado: '1d4', desc: 'Receba uma carta à sua escolha e ative o efeito dela.' },
      cost: 1, tipo: 'turno_N', turnosRecarga: 0, usosMax: 1,
    },
  },
];

// Encantamentos exclusivos de Elmo Encantado — mesmo esquema da Armadura
// (Passiva + Feitiço Arcano ou Ritual Místico concedido), mas com catálogo
// próprio (ver ENCANTAMENTOS_EQUIPAMENTO acima). Respeitam o mesmo Estilo de
// Encantamento (Arcano/Místico) já escolhido pelo personagem — ver
// getEstiloEncantamentoAtual/getEncantamentosDisponiveis.
const ENCANTAMENTOS_ELMO = [
  {
    id: 'cabeca_fria', name: 'Cabeça Fria', estilo: 'arcano', custo: 75,
    passivaDesc: 'Escritos gélidos e arcanos são adicionados ao seu elmo encantado: ao receber um ataque corpo a corpo, o atacante perde 1 de Passo pelo resto da luta/cena.',
    concede: {
      tipoConcedido: 'feitico', name: 'Sopro Gélido',
      desc: 'Remova todos os Passos de um alvo a até 6 casas por 1 turno — para cada Passo removido, você recebe +1 de Vantagem no seu próximo Feitiço nesse turno. Se o alvo ficar sem Passos, ele congela até o início do seu próximo turno; o próximo dano que ele receber é cheio (integral), mas remove o congelamento.',
      cost: 1, tipo: 'turno_N', turnosRecarga: 4, usosMax: 1,
    },
  },
  {
    id: 'fortalecimento_arcano', name: 'Fortalecimento Arcano', estilo: 'arcano', custo: 75,
    passivaDesc: 'Seu elmo encantado possui escritos arcanos que concedem sua maestria de Intelecto/2 como Armadura de Elmo adicional, que não reduz a Armadura do próprio Elmo Encantado.',
    concede: {
      tipoConcedido: 'feitico', name: 'Olho Violeta',
      desc: 'Seu elmo encantado cria um símbolo pelas escritas arcanas: você passa a ver coisas invisíveis e enxerga o arcano do lugar e das pessoas sem precisar de teste. Dura até o final da luta/cena.',
      cost: 1, tipo: 'sessao', usosMax: 1,
    },
  },
  {
    id: 'alquimia_sombria', name: 'Alquimia Sombria', estilo: 'mistico', custo: 75,
    passivaDesc: 'Seu elmo encantado possui escritos à base de uma alquimia sombria: ao entrar em estado de Beira da Morte, restaure imediatamente 1d20 de Vida e se adapte à situação. Funciona uma vez por luta/cena.',
    concede: {
      tipoConcedido: 'ritual', name: 'Observador Adaptativo',
      desc: 'Evoque um olho dos deuses antigos em sua testa: seu próximo Feitiço mirado na cabeça recebe +1d6 de Vantagem, dano/cura, e uma adaptação contra a defesa do alvo.',
      corromper: { dado: '1d6', desc: 'O bônus do 1d6 passa a ser máximo.' },
      cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1,
    },
  },
  {
    id: 'percepcao_mistica', name: 'Percepção Mística', estilo: 'mistico', custo: 75,
    passivaDesc: 'Seu elmo encantado possui escritas amaldiçoadas: você enxerga no escuro natural e mágico, e pode fazer teste Místico no lugar de Percepção.',
    concede: {
      tipoConcedido: 'ritual', name: 'Face Distorcida',
      desc: 'Seu rosto se transforma por um momento em algo assustador: por dois turnos você não pode ser mirado na cabeça, não pode ficar cego, e pode gastar uma Ação para gritar — um som distorcido que causa Medo nos inimigos.',
      corromper: { dado: '1d6', desc: 'A transformação se mantém pelo resto da luta/cena.' },
      cost: 1, tipo: 'sessao', usosMax: 1,
    },
  },
];

// Encantamentos exclusivos de Arma/Instrumento Encantados — mesmo esquema da
// Armadura/Elmo (Passiva + Feitiço Arcano ou Ritual Místico concedido), com
// catálogo próprio. Respeitam o mesmo Estilo de Encantamento (Arcano/Místico)
// já escolhido pelo personagem — ver getEstiloEncantamentoAtual.
const ENCANTAMENTOS_ARMA = [
  {
    id: 'armamento_arcano', name: 'Armamento Arcano', estilo: 'arcano', custo: 75,
    passivaDesc: 'Sua arma encantada possui escritos matemáticos que produzem uma "arma perfeita": ao usar o "Usar" da sua arma encantada, receba por um turno +3 de Vantagem em ações com ela.',
    concede: {
      tipoConcedido: 'feitico', name: 'Armas Perfeitas',
      desc: 'Sua arma encantada se torna 2 lâminas arcanas que causam 1d4+3+maestria de Intelecto/2 de dano até o final da luta/cena; todos os testes com ela utilizam a maestria de Intelecto/2; pode Aparar Feitiço; atravessa Armadura, Escudo, Imunidade e Adaptações; e não pode ser quebrada.',
      cost: 0, tipo: 'sessao', usosMax: 1,
    },
  },
  {
    id: 'escritos_interativos', name: 'Escritos Interativos', estilo: 'arcano', custo: 75,
    passivaDesc: 'Sua arma encantada possui escritos arcanos que interagem com sua magia: toda vez que lançar um Feitiço que invoca algo, pode substituir essa invocação por um círculo arcano.',
    concede: {
      tipoConcedido: 'feitico', name: 'Feitiço Encantado',
      desc: 'Em até 8 casas, evoque um círculo arcano que ocupa 1x1 casas — toda vez que você usar outro Feitiço (sem ser esse), o círculo explode em uma casa ao redor dele e causa 1d4+3 de dano na Vida. Cada círculo pode se mover até 5 Passos no seu turno (só explode 1 por vez).',
      cost: 0, tipo: 'sessao', usosMax: 4,
    },
  },
  {
    id: 'arma_dos_deuses_antigos', name: 'Arma dos Deuses Antigos', estilo: 'mistico', custo: 75,
    passivaDesc: 'O encantamento carrega um escrito antigo com a alma de Orr Kalyth, o Obelisco, uma antiga arma dos deuses antigos: quando você usar o "Usar" da sua arma encantada, conceda +1 de todas as maestrias para Orr Kalyth e +1 de Armadura corporal e do Elmo, que não podem ser reduzidos, para Orr Kalyth (os bônus só chegam a 5). Sua arma encantada não quebra quando os usos chegarem a zero.',
    concede: {
      tipoConcedido: 'ritual', name: 'Invocação do Obelisco',
      desc: 'Com um círculo de invocação, traga Orr Kalyth! Ele fica até o final da luta/cena no seu lugar. Possui Imunidade contra Feitiço, Golpe ou Técnica (escolha); Ataque 1d4+3; Vida 15×Nível; 5 Passos. No início dos turnos, sacrifique 1d6 de Sanidade — Orr Kalyth recebe +1d4 de Ataque, +2 Passos, +2 em testes, restaura 15 de Vida e mantém o controle sobre ele. Se não quiser, faça teste de Emoção para manter o controle (fica cada vez mais difícil).',
      corromper: { dado: '2d10', desc: 'No início de cada turno, pode trocar a Imunidade de Orr Kalyth.' },
      cost: 0, tipo: 'sessao', usosMax: 1,
    },
  },
  {
    id: 'metamorfose_sombria', name: 'Metamorfose Sombria', estilo: 'mistico', custo: 75,
    passivaDesc: 'O encantamento possui sangue dos deuses antigos: quando você ficar em estado de Beira da Morte, o Aprimoramento Bizarro é lançado (querendo ou não) e ativa a corrupção — o resultado também te cura. Se já estiver com o Aprimoramento Bizarro ativo, a corrupção é relançada e dobra o 1d10 (vira 2d10). Funciona uma vez por luta/cena.',
    concede: {
      tipoConcedido: 'ritual', name: 'Aprimoramento Bizarro',
      desc: 'Até o final da luta/cena, pegue emprestado o poder dos deuses antigos: um dos seus braços vira um tentáculo — usando ele, os Feitiços possuem Alcance igual ao tabuleiro, até mesmo os de corpo a corpo. Ao lançar um Feitiço com ele, sacrifique 1d10 de Sanidade e o resultado será +dano/cura e Vantagem.',
      corromper: { dado: '3d6', desc: 'Não precisa sacrificar a Sanidade para ter o 1d10.' },
      cost: 0, tipo: 'sessao', usosMax: 1,
    },
  },
];

// Busca um Encantamento pelo id em qualquer catálogo (Armadura, Elmo ou
// Arma/Instrumento) — usado onde não se sabe de antemão de qual catálogo o
// id escolhido veio (ex: saveInvItem, sincronização da Habilidade concedida).
function buscarEncantamentoPorId(id) {
  return ENCANTAMENTOS_EQUIPAMENTO.find(e => e.id === id)
    || ENCANTAMENTOS_ELMO.find(e => e.id === id)
    || ENCANTAMENTOS_ARMA.find(e => e.id === id)
    || null;
}

// "Multifunções" (passiva fixa do Campeão): sabe usar TODAS as Armas e
// Instrumentos, de qualquer categoria de peso — inclusive Mega Pesada,
// Exótica e Encantada — sem depender de Talento Inferior. NÃO vale pra
// Armadura/Elmo (a passiva é só sobre Armas, ver descrição).
function temMultifuncoesArma(p) {
  if (p.isNPC) return false; // NPC já libera tudo por outro caminho
  return getSubclassePassivas(p).some(pas => pas.id === 'campeao_multifuncoes');
}

// O personagem tem o Talento Inferior "Equipamento Encantado"? Sem ele, não
// pode aplicar (nem manter) Encantamentos em seus equipamentos.
function temAcessoEquipamentoEncantado(p) {
  if (p.isNPC) return true; // NPC: Narrador libera Equipamento Encantado sem precisar do Talento
  return getTalentosInferioresEscolhidos(p).some(pas => pas.talentoInferiorId === 'equipamento_encantado');
}

// O personagem tem o Talento Inferior "Equipamento Exótico"? Sem ele, não
// tem acesso à compra de armaduras/elmos/armas exóticas no catálogo.
function temAcessoEquipamentoExotico(p) {
  if (p.isNPC) return true; // NPC: Narrador libera Equipamento Exótico sem precisar do Talento
  return getTalentosInferioresEscolhidos(p).some(pas => pas.talentoInferiorId === 'equipamento_exotico');
}

// O personagem tem o Talento Inferior "Ambidestro"? Sem ele, não pode
// equipar uma 2ª Arma/Instrumento de uma mão só na "mão secundária" (ver
// toggleEquipArmaSecundaria/getArmaSecundariaEquipada em logica-estado-render.js).
function temAmbidestro(p) {
  if (p.isNPC) return true; // NPC: Narrador libera sem precisar do Talento
  return getTalentosInferioresEscolhidos(p).some(pas => pas.talentoInferiorId === 'ambidestro');
}

// "Guerreiro Perfeito" (passiva fixa do Combatente): pode segurar uma Arma
// Pesada de corpo a corpo (duasMaos, alcance curto/ambos — não serve pra
// alcance longo) em CADA mão, mesmo sendo Armas de duas mãos. Reaproveita
// toda a infra da "mão secundária" (equipadoSecundaria/toggleEquipArma
// Secundária/getArmaSecundariaEquipada) e da Habilidade Geral "Ataque com 2
// Armas" — só muda QUAIS Armas são elegíveis pro slot secundário (ver
// itemElegivelMaoSecundaria em logica-estado-render.js).
function temGuerreiroPerfeito(p) {
  if (p.isNPC) return false; // NPC já libera tudo por outro caminho
  return getSubclassePassivas(p).some(pas => pas.id === 'combatente_guerreiro_perfeito');
}

// Alguma fonte (Talento Inferior "Ambidestro" ou passiva "Guerreiro
// Perfeito") dá acesso à "mão secundária"/"Ataque com 2 Armas"? Ver
// itemElegivelMaoSecundaria pra saber QUAIS Armas cada uma libera.
function temSegundaArmaHabilitada(p) {
  if (p.isNPC) return true;
  return temAmbidestro(p) || temGuerreiroPerfeito(p);
}

// Retorna true se o personagem precisa escolher o Estilo de Encantamento
// agora (tem o Talento Inferior "Equipamento Encantado" mas ainda não
// escolheu Arcano ou Místico) — ver renderEscolhaEstiloEncantamentoModal.
function precisaEscolherEstiloEncantamento(p) {
  return (temAcessoEquipamentoEncantado(p) || temMultifuncoesArma(p)) && !p.estiloEncantamentoId;
}

// Define o Estilo de Encantamento do personagem (Arcano ou Místico) — escolha
// permanente feita assim que o Talento Inferior "Equipamento Encantado" é
// adquirido. Vale para TODOS os equipamentos encantados do personagem.
function escolherEstiloEncantamento(pid, estilo) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p || (estilo !== 'arcano' && estilo !== 'mistico')) return;
  p.estiloEncantamentoId = estilo;
  saveState();
  renderAll();
  const overlay = document.getElementById('modal-encantamento-estilo-overlay');
  if (overlay) overlay.classList.remove('open');
}

// Estilo de Encantamento (arcano/mistico) do personagem — escolhido uma vez
// (ver escolherEstiloEncantamento) e válido para todos os seus equipamentos.
function getEstiloEncantamentoAtual(p) {
  return p.estiloEncantamentoId || null;
}

// Encantamentos do catálogo (Armadura ou Elmo, conforme `catalogo`) ainda
// disponíveis pro item em edição: mesmo Encantamento pode ser repetido em
// mais de um equipamento — a única restrição é o Estilo de Encantamento
// (Arcano/Místico) já escolhido pelo personagem, que vale pra tudo.
function getEncantamentosDisponiveis(p, itemId, catalogo) {
  const estiloAtual = getEstiloEncantamentoAtual(p);
  return (catalogo || ENCANTAMENTOS_EQUIPAMENTO).filter(e => !estiloAtual || e.estilo === estiloAtual);
}

// Constrói a Habilidade (skill) do Feitiço/Ritual concedido por um
// Encantamento, pronta para entrar em p.skills — reaproveita a mesma UI de
// uso/recarga/corromper das Habilidades normais (cor azul pra Feitiço,
// cinza pra Ritual, mesmo esquema dos Feitiços Lendários/Rituais Macabros).
function construirSkillEncantamento(encantamentoItem, itemInventarioId) {
  const c = encantamentoItem.concede;
  return {
    id: 'sk_encant_' + itemInventarioId,
    encantamentoItemId: itemInventarioId,
    encantamentoCatalogId: encantamentoItem.id,
    name: c.name,
    desc: c.desc,
    color: c.tipoConcedido === 'ritual' ? 'gray' : 'blue',
    cost: c.cost,
    tipo: c.tipo,
    usosMax: c.usosMax,
    usosAtuais: c.usosMax,
    cdRestante: 0,
    turnosRecarga: c.turnosRecarga || 0,
    corromper: c.corromper || null,
    // false = usos "por armadura" (não recarrega em Reset de Sessão, só se
    // ajusta manualmente ou quando a armadura é trocada/recriada) — ver
    // resetSessao() e o comentário no catálogo ENCANTAMENTOS_EQUIPAMENTO.
    resetSessao: c.resetSessao !== false,
  };
}

// ═══════════════════════════════════════
// USOS DE ARMA ("Usar (Nx)") — contador de uso livre em qualquer Arma
// ═══════════════════════════════════════
// Diferente dos Encantamentos/Aprimoramentos (catálogos fixos), aqui o
// jogador escreve livremente nome + efeito de cada "Usar (Nx)" da arma (ver
// seção "Usos" no modal de Inventário — _renderInvUsos/addInvUso). Fica
// GUARDADO NO PRÓPRIO ITEM (item.usos), não vira Habilidade — o contador
// aparece direto no card da arma no Inventário (ver usarArmaUso/resetArmaUso
// e o bloco `usosBox` em renderArmaCard). Escopo de recarga (4 opções):
//  - 'arma'   : usos "pela Arma" — nunca recarrega sozinho (só reset manual).
//  - 'sessao' : usos por Sessão — recarrega no Reset de Sessão.
//  - 'luta'   : usos por Luta/Cena — recarrega no Reset de Luta (nova luta).
//  - 'turno'  : usos por Turno — recarrega automaticamente a cada turno.
// Ver resetUsosArmaPorEscopo, chamada em resetSessao/resetLuta/nextTurnGlobal.
const ESCOPO_USO_ARMA_LABEL = { arma: 'Por Arma', sessao: 'Por Sessão', luta: 'Por Luta', turno: 'Por Turno' };

// Monta o HTML da caixa de "Usos" (Usar Nx) de um item de inventário —
// compartilhado entre os cards de Arma/Instrumento e Armadura/Elmo (ver
// renderInventarioArea), já que qualquer um desses tipos pode ter Usos.
// Aprimoramento Dourado "Carregamento Aprimorado": armas com Munição/Usos que
// recarregam pagando Dinheiro (custoRecarga) deixam de precisar de recarga —
// o limite de usosMax vira infinito, sem custo. Vale pra qualquer arma com
// esse tipo de recarga (Bolsa de Adagas, Pentes, Aljavas, etc).
function temCarregamentoAprimorado(item) {
  return Array.isArray(item.aprimoramentos) && item.aprimoramentos.some(a => a.catalogId === 'carregamento_aprimorado' || a.name === 'Carregamento Aprimorado');
}

// Aprimoramento Dourado "Encantamento Aprimorado": armas com "Usar (Nx)"
// restauram TODOS os usos ao final da sessão, mesmo os de escopo "Por Arma"
// (que normalmente só recarregam manualmente) — ver resetSessao.
function temEncantamentoAprimorado(item) {
  return Array.isArray(item.aprimoramentos) && item.aprimoramentos.some(a => a.catalogId === 'encantamento_aprimorado' || a.name === 'Encantamento Aprimorado');
}

// Aprimoramento Dourado "Afiação Aprimorada": +1d6 de dano na arma — exibido
// junto ao Dano no card (ver statsRow, dentro de renderArmaCard).
function temAfiacaoAprimorada(item) {
  return Array.isArray(item.aprimoramentos) && item.aprimoramentos.some(a => a.catalogId === 'afiacao_aprimorada' || a.name === 'Afiação Aprimorada');
}

function construirUsosBoxHtml(item, p) {
  if (!item.usos || !item.usos.length) return '';
  return `<div class="inv-sub-section"><div class="inv-sub-label"><i class="ti ti-target-arrow" style="color:var(--accent2)"></i> Usos</div>${item.usos.map((u, ui) => {
    const infinito = !!(u.custoRecarga && temCarregamentoAprimorado(item));
    const usosMax = u.usosMax || 1;
    const usosAtuais = u.usosAtuais != null ? u.usosAtuais : usosMax;
    const spent = usosMax - usosAtuais;
    const usadoNesteTurno = u.umPorTurno && u.ultimoTurnoUsado === turnGlobal;
    const pronto = infinito ? !usadoNesteTurno : (usosAtuais > 0 && !usadoNesteTurno);
    const dots = infinito ? '' : Array.from({length: usosMax}, (_, di) => `<div class="sdot ${(u.custoRecarga ? di < usosAtuais : di < spent) ? 'spent' : ''}"></div>`).join('');
    return `<div class="skill-card sk-gray ${pronto ? 'ready' : 'exhausted'}" style="margin:6px 0">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div class="sk-name">${u.name}</div>
        <div style="display:flex;gap:6px;align-items:center">
          ${u.custoRecarga && !infinito ? `<button onclick="event.stopPropagation();comprarUsoArma(${p.id},'${item.id}',${ui})" title="Comprar +1 (${u.custoRecarga} de Dinheiro)" style="background:none;border:none;color:var(--amber);cursor:pointer;padding:0"><i class="ti ti-coin" style="font-size:15px"></i></button>` : ''}
          ${!infinito ? `<button onclick="event.stopPropagation();resetArmaUso(${p.id},'${item.id}',${ui})" title="Restaurar usos" style="background:none;border:none;color:var(--text3);cursor:pointer;padding:0"><i class="ti ti-refresh" style="font-size:15px"></i></button>` : ''}
        </div>
      </div>
      <div class="sk-tags"><span class="sk-tag">${ESCOPO_USO_ARMA_LABEL[u.escopo] || u.escopo}</span>${u.custo ? `<span class="sk-tag">${u.custo===1?'1 ação':u.custo+' ações'}</span>` : ''}${u.custoCristal ? `<span class="sk-tag">💎${u.custoCristal===1?'1 Cristal':u.custoCristal+' Cristais'}</span>` : ''}${infinito ? `<span class="sk-tag" style="color:#e8c53a">✨ Carregamento Aprimorado (∞)</span>` : (u.custoRecarga ? `<span class="sk-tag">💰${u.custoRecarga}/uso</span>` : '')}${u.umPorTurno ? `<span class="sk-tag">1x/turno</span>` : ''}${u.concedeNotaEscolhida ? `<span class="sk-tag" style="background:var(--bardo-dim);color:#f0dba0">🎵 escolha uma nota</span>` : ''}</div>
      ${u.desc ? `<div style="font-size:11px;color:var(--text2);margin:8px 0 6px;line-height:1.5">${u.desc}</div>` : ''}
      ${usadoNesteTurno ? `<div style="font-size:10px;color:var(--text3);margin-bottom:6px">Já usado neste turno.</div>` : ''}
      <div class="sk-bottom">
        <button class="sk-btn" onclick="usarArmaUso(${p.id},'${item.id}',${ui})" ${!pronto?'disabled':''}>Usar</button>
        <div class="sk-dots">${infinito ? '<span style="font-size:13px;color:#e8c53a">∞</span>' : dots}</div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

// Reseta pra usosMax todos os Usos ("Usar Nx") E Liberar Vileza do
// personagem cujo escopo esteja na lista `escopos` — usado pelos resets
// globais (sessão/luta/turno). Escopo 'arma' nunca é passado aqui (não
// reseta sozinho, só manualmente).
function resetUsosArmaPorEscopo(p, escopos) {
  (p.inventario || []).forEach(item => {
    if ((item.tipo === 'arma' || item.tipo === 'instrumento' || item.tipo === 'protecao')) {
      if (Array.isArray(item.usos)) {
        item.usos.forEach(u => { if (escopos.includes(u.escopo)) u.usosAtuais = u.usosMax; });
      }
      if (Array.isArray(item.ativas)) {
        item.ativas.forEach(a => { if (escopos.includes(a.escopo || 'luta')) a.usosAtuais = a.usosMax; });
      }
    }
  });
}

// Consome 1 uso de um "Usar (Nx)" da arma (clique no card). Não faz nada se
// já estiver esgotado — use resetArmaUso para restaurar manualmente.
function usarArmaUso(pid, itemId, usoIdx) {
  const p = PLAYERS.find(x => x.id === pid);
  const item = p && (p.inventario || []).find(i => i.id === itemId);
  const uso = item && item.usos && item.usos[usoIdx];
  if (!uso) return;
  // Aprimoramento Dourado "Carregamento Aprimorado": Munição/Usos com custoRecarga
  // (Bolsa de Adagas, Pentes, Aljavas etc.) deixam de ter limite — nunca esgota.
  const infinito = !!(uso.custoRecarga && item && temCarregamentoAprimorado(item));
  if (!infinito && uso.usosAtuais <= 0) return;
  // "Um uso por turno": mesmo com usos sobrando no total, não deixa usar de
  // novo se já foi usado no turno global atual.
  if (uso.umPorTurno && uso.ultimoTurnoUsado === turnGlobal) return;
  // "Recarga Arcana" (Cajado): não reduz a recarga de um Feitiço fixo — abre
  // um seletor para escolher qual Feitiço em recarga perde 1 turno. O uso do
  // Cajado e a redução em si só são aplicados ao confirmar a escolha (ver
  // escolherFeiticoRecarga), então nada é consumido aqui.
  if (uso.reduzRecargaFeitico) {
    abrirRecargaArcanaModal(pid, itemId, usoIdx);
    return;
  }
  // "Tocar Instrumento": abre o seletor de Nota Musical — a concessão da
  // nota e o consumo deste uso só acontecem ao escolher (ver
  // escolherNotaInstrumento), então nada é consumido aqui.
  if (uso.concedeNotaEscolhida) {
    abrirNotaInstrumentoModal(pid, itemId, usoIdx);
    return;
  }
  // Custo em Ações (ex: "1 uso por Ação"): mesma checagem/desconto do custo
  // de Ação das Habilidades (ver useSkill) — sem saldo suficiente, bloqueia.
  const custo = uso.custo || 0;
  if (custo > 0) {
    const atuais = p.acoesAtuais ?? p.acoesMax ?? ACOES_POR_TURNO_PADRAO;
    if (atuais < custo) {
      alert(`Ações insuficientes! "${uso.name}" custa ${custo} ${custo === 1 ? 'ação' : 'ações'}, e ${p.name} só tem ${atuais} neste turno.`);
      return;
    }
  }
  // Custo em Cristais (ex: "Gaste 1 Cristal Elétrico"): consome do pool
  // compartilhado do personagem (p.cristais, ver adjCristais) — sem saldo
  // suficiente, bloqueia.
  const custoCristal = uso.custoCristal || 0;
  if (custoCristal > 0) {
    const cristaisAtuais = p.cristais || 0;
    if (cristaisAtuais < custoCristal) {
      alert(`Cristais insuficientes! "${uso.name}" custa ${custoCristal} ${custoCristal === 1 ? 'Cristal' : 'Cristais'}, e ${p.name} só tem ${cristaisAtuais}.`);
      return;
    }
  }
  uso.usosAtuais = infinito ? uso.usosAtuais : uso.usosAtuais - 1;
  if (uso.umPorTurno) uso.ultimoTurnoUsado = turnGlobal;
  if (custo > 0) {
    p.acoesAtuais = Math.max(0, (p.acoesAtuais ?? p.acoesMax ?? ACOES_POR_TURNO_PADRAO) - custo);
  }
  if (custoCristal > 0) {
    p.cristais = Math.max(0, (p.cristais || 0) - custoCristal);
  }
  saveState();
  renderAll();
}

// ─── Modal de escolha de Feitiço — "Recarga Arcana" do Cajado ──────────────
// A Recarga Arcana não tem um Feitiço fixo pra recarregar: o jogador escolhe,
// entre os Feitiços (Habilidades azuis) que estejam em recarga (cdRestante >
// 0), qual perde 1 turno de recarga — mesmo efeito de 1 turno passar (ver
// nextTurnGlobal). Se o Feitiço escolhido zerar a recarga, seus usos voltam
// ao máximo.
function abrirRecargaArcanaModal(pid, itemId, usoIdx) {
  const overlay = document.getElementById('modal-recarga-arcana-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;
  const feiticos = (p.skills || []).filter(sk => sk.color === 'blue' && sk.tipo === 'turno_N' && sk.cdRestante > 0);
  if (!feiticos.length) { alert(`${p.name} não tem nenhum Feitiço em recarga no momento.`); return; }

  const opcoesHtml = feiticos.map(sk => `<button class="tm-opcao tm-opcao-blue" onclick="escolherFeiticoRecarga(${p.id},'${itemId}',${usoIdx},'${sk.id}')">
    <span class="tm-opcao-nome">${escHtml(sk.name)}</span>
    <span class="tm-opcao-info">⏳ ${sk.cdRestante} turno${sk.cdRestante > 1 ? 's' : ''}</span>
  </button>`).join('');

  overlay.innerHTML = `
    <div class="modal" style="max-width:420px">
      <h3><i class="ti ti-wand"></i> Recarga Arcana — ${escHtml(p.name)}</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:14px;line-height:1.5">
        Escolha um Feitiço em recarga: ele perde 1 turno de recarga.
      </div>
      <div class="tm-opcoes">${opcoesHtml}</div>
      <button class="tm-cancelar" onclick="fecharRecargaArcanaModal()">Cancelar</button>
    </div>`;
  overlay.classList.add('open');
}

function fecharRecargaArcanaModal() {
  const overlay = document.getElementById('modal-recarga-arcana-overlay');
  if (overlay) { overlay.classList.remove('open'); overlay.innerHTML = ''; }
}

function escolherFeiticoRecarga(pid, itemId, usoIdx, skillId) {
  fecharRecargaArcanaModal();
  const p = PLAYERS.find(x => x.id === pid);
  const item = p && (p.inventario || []).find(i => i.id === itemId);
  const uso = item && item.usos && item.usos[usoIdx];
  const sk = p && p.skills.find(s => s.id === skillId);
  if (!uso || uso.usosAtuais <= 0 || !sk || sk.cdRestante <= 0) return;
  sk.cdRestante--;
  if (sk.cdRestante === 0) sk.usosAtuais = sk.usosMax;
  uso.usosAtuais -= 1;
  if (uso.umPorTurno) uso.ultimoTurnoUsado = turnGlobal;
  saveState();
  renderAll();
}

// Lista achatada de todos os Feitiços (Habilidades azuis) do banco de
// subclasses do jogo — usada pelo Grimório do Conhecimento pra deixar o
// jogador escolher qualquer Feitiço, independente da própria subclasse.
function getTodosFeiticosBanco() {
  const lista = [];
  Object.entries(BANCO_HABILIDADES_SUBCLASSE).forEach(([subclasse, skills]) => {
    skills.forEach(sk => { if (sk.color === 'blue') lista.push({ ...sk, subclasse }); });
  });
  return lista;
}

// ─── Modal de escolha de Feitiço — "Grimório do Conhecimento" ──────────────
// Escolha única (não é por uso): o Feitiço fica guardado em
// item.feiticoEscolhidoId até o jogador trocar. "Lançar" esse Feitiço (ver
// uso grimorioFeitico) só consome o próprio contador do Grimório (1x/luta) —
// não mexe em nenhuma Habilidade do personagem.
function abrirGrimorioModal(pid, itemId) {
  const overlay = document.getElementById('modal-grimorio-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;
  const feiticos = getTodosFeiticosBanco();

  const opcoesHtml = feiticos.map(sk => {
    const busca = `${sk.name} ${sk.subclasse} ${sk.desc}`.toLowerCase().replace(/"/g, '');
    return `<button class="tm-opcao tm-opcao-blue" data-busca="${escHtml(busca)}" onclick="escolherFeiticoGrimorio(${p.id},'${itemId}','${sk.id}')" style="display:flex;flex-direction:column;align-items:flex-start;gap:2px">
      <span class="tm-opcao-nome">${escHtml(sk.name)} <span style="font-size:10.5px;color:var(--text3);font-weight:400">— ${escHtml(sk.subclasse)}</span></span>
      <span style="font-size:11px;color:var(--text2);font-weight:400;line-height:1.4;text-align:left">${escHtml(sk.desc)}</span>
    </button>`;
  }).join('');

  overlay.innerHTML = `
    <div class="modal" style="max-width:480px">
      <h3><i class="ti ti-book-2"></i> Grimório do Conhecimento — ${escHtml(p.name)}</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px;line-height:1.5">
        Escolha um Feitiço de qualquer classe. Você poderá lançá-lo 1 vez por luta.
      </div>
      <input type="text" placeholder="Buscar Feitiço..." oninput="filtrarGrimorioFeiticos(this.value)" style="width:100%;margin-bottom:10px;padding:8px 10px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px">
      <div class="tm-opcoes" id="grimorio-opcoes-lista" style="max-height:340px;overflow-y:auto">${opcoesHtml}</div>
      <button class="tm-cancelar" onclick="fecharGrimorioModal()">Cancelar</button>
    </div>`;
  overlay.classList.add('open');
}

function filtrarGrimorioFeiticos(texto) {
  const t = texto.trim().toLowerCase();
  document.querySelectorAll('#grimorio-opcoes-lista .tm-opcao').forEach(btn => {
    btn.style.display = (!t || (btn.dataset.busca || '').includes(t)) ? '' : 'none';
  });
}

function fecharGrimorioModal() {
  const overlay = document.getElementById('modal-grimorio-overlay');
  if (overlay) { overlay.classList.remove('open'); overlay.innerHTML = ''; }
}

// ─── "Criação de Anão" (passiva racial) ────────────────────────────────────
// Funde 2 armas/instrumentos com Aprimoramento Dourado numa arma nova (que
// carrega os 2 Aprimoramentos Dourados combinados), pagando 500 de Dinheiro.
// Só pode ser usada 1 vez por personagem (p.criacaoAnaoUsada).
function temAprimoDourado(item) {
  return Array.isArray(item.aprimoramentos) && item.aprimoramentos.some(a => a.dourado || a.name === 'Dourado');
}

function abrirCriacaoAnaoModal(pid) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;
  if (p.criacaoAnaoUsada) { alert('Criação de Anão já foi usada por este personagem.'); return; }
  const elegiveis = (p.inventario || []).filter(i => (i.tipo === 'arma' || i.tipo === 'instrumento') && temAprimoDourado(i));
  if (elegiveis.length < 2) { alert('Você precisa de pelo menos 2 armas/instrumentos com Aprimoramento Dourado pra fundir.'); return; }

  const opcoesHtml = elegiveis.map(i => {
    const dourado = i.aprimoramentos.find(a => a.dourado || a.name === 'Dourado');
    return `<label class="tm-opcao" style="display:flex;align-items:center;gap:10px;cursor:pointer">
      <input type="checkbox" class="criacao-anao-check" value="${i.id}" style="width:16px;height:16px;flex-shrink:0">
      <span style="flex:1">
        <span class="tm-opcao-nome">${escHtml(i.name)}</span>
        <span style="display:block;font-size:11px;color:#e8c53a;margin-top:2px">✨ ${escHtml((dourado && dourado.name) || 'Dourado')}</span>
      </span>
    </label>`;
  }).join('');

  overlay.innerHTML = `
    <div class="modal" style="max-width:420px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-hammer"></i> Criação de Anão</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px;line-height:1.5">
        Escolha 2 armas/instrumentos com Aprimoramento Dourado pra fundir numa arma nova. Custa 500 de Dinheiro e só pode ser feita 1 vez.
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:300px;overflow-y:auto">${opcoesHtml}</div>
      <button class="btn btn-primary" style="width:100%;margin-top:14px" onclick="confirmarCriacaoAnao(${p.id})">Confirmar Fusão (500 Dinheiro)</button>
      <button class="tm-cancelar" style="margin-top:8px" onclick="fecharCriacaoAnaoModal()">Cancelar</button>
    </div>`;
  overlay.classList.add('open');
}

function fecharCriacaoAnaoModal() {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  if (overlay) { overlay.classList.remove('open'); overlay.innerHTML = ''; }
}

// ─── "Origem Comum" (passiva de origem racial, Anão) ───────────────────────
// Ao subir de Nível, o jogador escolhe uma arma/instrumento que já possui e
// rola 1d10 com Mega Vantagem na mesa (o app não simula rolagem de dados —
// isso é feito manualmente, como o resto do combate). Se tirar 7+, essa arma
// ganha um Aprimoramento Dourado à escolha do jogador, de graça (sem custo em
// Dinheiro). Não há limite de vezes rastreado aqui — repete a cada Nível.
// ─── "Origem Comum" (passiva de origem racial, Anão) ───────────────────────
// Ao subir de Nível, rola 1d10 com Mega Vantagem de verdade (publica no feed
// de dados, igual a um Teste). Se tirar 7 ou mais, libera a escolha de uma
// arma/instrumento pra ganhar um Aprimoramento Dourado de graça (sem custo em
// Dinheiro). Disparado automaticamente ao subir de Nível (ver onLevelUp) e
// também pode ser rolado manualmente pelo botão na passiva.
function rolarOrigemComum(pid) {
  if (!currentUser) return;
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  p.origemComumPendente = false;
  saveState();
  renderAll();

  const sides = 10;
  const d1 = 1 + Math.floor(Math.random() * sides);
  const d2 = 1 + Math.floor(Math.random() * sides);
  const kept = Math.max(d1, d2);

  const entry = {
    playerName: currentUser.name || (IS_NARRADOR ? 'Narrador' : 'Jogador'),
    charName: p.name,
    isNarrator: !!IS_NARRADOR,
    formula: 'Origem Comum (1d10 Mega Vantagem)',
    tree: { type: 'sum', terms: [{ sign: '+', node: { type: 'megaroll', mode: 'mv', sides, d1, d2, kept } }] },
    total: kept,
    hidden: hiddenPadrao(p),
    rolling: true,
    ts: Date.now()
  };

  spinDiceFab(true, sides);
  pushRollEntry(entry, key => {
    setTimeout(() => finishRollEntry(key), ROLL_ANIM_MS);
    setTimeout(() => spinDiceFab(false), ROLL_ANIM_MS);
  });
  if (!dicePanelOpen) toggleDicePanel();
  else if (dicePanelTab !== 'feed') switchDiceTab('feed');

  setTimeout(() => {
    if (kept >= 7) {
      alert(`Origem Comum: ${p.name} tirou ${kept} — 7 ou mais! Escolha a arma/instrumento que ganha o Aprimoramento Dourado gratuito.`);
      abrirOrigemComumAnaoDouradoModal(pid);
    } else {
      alert(`Origem Comum: ${p.name} tirou ${kept} — abaixo de 7, nenhum Aprimoramento Dourado dessa vez.`);
    }
  }, ROLL_ANIM_MS + 150);
}

// Draenei (Origem Demoníaca): rola 1d8 de Insanidade de verdade ao subir de
// Nível, publica no feed de dados e aplica o resultado em p.ins.
function rolarInsanidadeOrigemDemoniaca(pid) {
  if (!currentUser) return;
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;

  const sides = 8;
  const d1 = 1 + Math.floor(Math.random() * sides);

  const entry = {
    playerName: currentUser.name || (IS_NARRADOR ? 'Narrador' : 'Jogador'),
    charName: p.name,
    isNarrator: !!IS_NARRADOR,
    formula: 'Origem Demoníaca — Insanidade ao subir de Nível',
    tree: { type: 'dice', sides, count: 1, results: [d1], sum: d1, countNode: null },
    total: d1,
    hidden: hiddenPadrao(p),
    rolling: true,
    ts: Date.now()
  };

  spinDiceFab(true, sides);
  pushRollEntry(entry, key => {
    setTimeout(() => finishRollEntry(key), ROLL_ANIM_MS);
    setTimeout(() => spinDiceFab(false), ROLL_ANIM_MS);
  });
  if (!dicePanelOpen) toggleDicePanel();
  else if (dicePanelTab !== 'feed') switchDiceTab('feed');

  p.ins = Math.max(0, Math.min(getInsanidadeMax(p), (p.ins || 0) + d1));
  saveState();
  renderAll();
}

// Draenei (Forjado a Luz): mostra as 3 Bênçãos da Luz (mesmo catálogo do
// Clérigo, DEUSES_CLERIGO['Luz'].bencaos) pra escolher qual lançar.
function abrirForjadoLuzModal(pid) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;
  const bencaos = (DEUSES_CLERIGO['Luz'] && DEUSES_CLERIGO['Luz'].bencaos) || [];

  const opcoesHtml = bencaos.map(b => `<button class="tm-opcao tm-opcao-blue" onclick="fecharCriacaoAnaoModal()" style="display:flex;flex-direction:column;align-items:flex-start;gap:2px">
    <span class="tm-opcao-nome">✨ ${escHtml(b.name)}</span>
    <span style="font-size:11px;color:var(--text2);font-weight:400;line-height:1.4;text-align:left">${escHtml(b.desc)}</span>
  </button>`).join('');

  overlay.innerHTML = `
    <div class="modal" style="max-width:440px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-sun"></i> Forjado a Luz — ${escHtml(p.name)}</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px;line-height:1.5">
        Escolha qual Bênção da Luz você lança.
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:340px;overflow-y:auto">${opcoesHtml}</div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="fecharCriacaoAnaoModal()">Fechar</button>
    </div>`;
  overlay.classList.add('open');
}

// "Adaptação do Espaço" (Draenei): possui +3 de Vantagem fixo em 1 Teste
// (nunca Emoção). Usar troca qual Teste recebe o bônus — limpa o "+3" do
// Teste anterior (p.adaptacaoTesteId) e aplica no novo escolhido.
// Abre o próximo seletor racial pendente do personagem (só 1 de cada vez,
// pra não competir pelo mesmo overlay — ver comentário na criação do
// personagem). Ordem: Adaptação do Espaço → Decréptico → Origem Sangrenta.
// Chamada tanto na criação do personagem quanto ao fechar/concluir cada um
// desses seletores, encadeando pro próximo.
function abrirProximoSeletorRacial(pid) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  if (p.race === 'Draenei' && (p.skills || []).some(sk => sk.id === 'sk_racial_draenei_adaptacao') && !p.adaptacaoTesteId) {
    abrirAdaptacaoEspacoModal(pid);
    return;
  }
  if (p.race === 'Elfo' && (p.passivas || []).some(pas => pas.racialId === 'elfo_decreptico') && !(p.decrepticoTeste1 && p.decrepticoTeste2)) {
    abrirDecrepticoModal(pid);
    return;
  }
  if (p.race === 'Tauren' && (p.passivas || []).some(pas => pas.racialId === 'tauren_brutao') && !(p.brutaoTesteForca && p.brutaoTesteAgilidade)) {
    abrirBrutaoModal(pid);
    return;
  }
  // "Maestria" de subclasse (Mediana/Pesada/Leve): igual às outras passivas
  // de escolha, abre assim que o personagem é criado (a subclasse já vem
  // junto da classe escolhida na criação, ver getSubclassePassivas).
  for (const tipo of Object.keys(MAESTRIA_SUBCLASSE_IDS)) {
    if (temMaestriaTipo(p, tipo) && !p[MAESTRIA_CAMPO[tipo]]) {
      abrirMaestriaModal(pid, tipo);
      return;
    }
  }
  if (p.origemId === 'troll_origem_comum' && !p.origemComumTrocaConfigurada) {
    abrirOrigemComumModal(pid);
    return;
  }
  if (trollEncantamentoTemPendencia(p)) {
    abrirEncantamentoTrollModal(pid);
    return;
  }
  if (p.origemId === 'elfo_origem_sangrento' && !p.origemSangrentaUsado) {
    abrirOrigemSangrentaModal(pid);
    return;
  }
  if (p.origemId === 'elfo_origem_noturno' && !p.origemNoturnaUsada) {
    abrirOrigemNoturnaModal(pid);
    return;
  }
  // "Origem de Vento Bravo" (Humano): diferente das outras, não tem "usado"
  // — reabre sempre que sobrar algum slot vazio (Nível 1 recém-criado, ou
  // Nível novo depois de subir), até o jogador preencher os 3 tipos.
  if (ventoBravoTemPendencia(p)) {
    abrirVentoBravoModal(pid);
    return;
  }
  // "Origem de Kalindor" (Humano): mesma lógica de pendência da Vento Bravo.
  if (kalindorTemPendencia(p)) {
    abrirKalindorModal(pid);
    return;
  }
  if (p.origemId === 'orc_origem_maghar' && !p.magharTesteMD) {
    abrirMagharModal(pid);
    return;
  }
  if (magharHabTemPendencia(p)) {
    abrirMagharHabModal(pid);
    return;
  }
  // "Filosofia Pandarênica" (Pandaren, Origem Comum): cobre o caso de
  // personagem criado direto a partir do Nível 3 (a checagem de onLevelUp
  // só dispara em subidas de Nível durante o jogo, não na criação).
  if (p.origemId === 'pandaren_origem_comum' && (p.isNPC || (p.level || 1) >= 3) && !p.filosofiaPandarenicaCor) {
    abrirFilosofiaPandarenicaModal(pid);
    return;
  }
}

function abrirAdaptacaoEspacoModal(pid) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;
  getTestePersonagem(p);

  const opcoesHtml = TESTES_LISTA.filter(t => !['emocao', 'iniciativa', 'devocao'].includes(t.id)).map(t => {
    const atual = p.adaptacaoTesteId === t.id;
    return `<button class="tm-opcao tm-opcao-blue" onclick="escolherAdaptacaoEspaco(${p.id},'${t.id}')">
      <span class="tm-opcao-nome">${escHtml(t.name)}</span>
      ${atual ? `<span class="tm-opcao-info">atual</span>` : ''}
    </button>`;
  }).join('');

  overlay.innerHTML = `
    <div class="modal" style="max-width:380px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-target-arrow"></i> Adaptação do Espaço</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px;line-height:1.5">
        Escolha em qual Teste ficam os +3 de Vantagem.
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:320px;overflow-y:auto">${opcoesHtml}</div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="fecharCriacaoAnaoModal()">Cancelar</button>
    </div>`;
  overlay.classList.add('open');
}

function escolherAdaptacaoEspaco(pid, testeId) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p || ['emocao', 'iniciativa', 'devocao'].includes(testeId)) return;
  // Não mexe em p.testes[...].bonus — os +3 são aplicados como um termo à
  // parte na rolagem (ver construirRolagemTeste), então qualquer Bônus
  // manual que o jogador já tenha configurado (ex: -1d2) se mantém intacto.
  p.adaptacaoTesteId = testeId;

  fecharCriacaoAnaoModal();
  saveState();
  renderAll();
  abrirProximoSeletorRacial(pid);
}

// "Treinamento Militar" (Orc): quando o Aparar Garantido sai Crítico (10+),
// o jogador escolhe a recompensa — +1 Ação no próximo turno (automatizado
// aqui) ou um Contra-Ataque (resolvido na mesa com o Narrador, igual aos
// outros Contra-Ataques do sistema).
function abrirTreinamentoMilitarEscolhaModal(pid) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;

  overlay.innerHTML = `
    <div class="modal" style="max-width:380px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-shield-check"></i> Treinamento Militar — Crítico!</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px;line-height:1.5">
        Seu Aparar saiu Crítico. Escolha a recompensa de ${escHtml(p.name)}:
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="tm-opcao tm-opcao-blue" onclick="escolherTreinamentoMilitarRecompensa(${p.id},'acao')">
          <span class="tm-opcao-nome">➕ 1 Ação a mais no próximo turno</span>
        </button>
        <button class="tm-opcao tm-opcao-blue" onclick="escolherTreinamentoMilitarRecompensa(${p.id},'contra')">
          <span class="tm-opcao-nome">⚔️ Contra-Ataque</span>
        </button>
      </div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="fecharCriacaoAnaoModal()">Fechar</button>
    </div>`;
  overlay.classList.add('open');
}

function escolherTreinamentoMilitarRecompensa(pid, escolha) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  if (escolha === 'acao') {
    // Concedida de verdade no próximo Reset de Turno (ver aplicarResetDeTurno),
    // que é quando as Ações do personagem são recarregadas.
    p.treinamentoMilitarAcaoExtra = true;
  }
  // "Contra-Ataque": sem efeito automático — resolvido na mesa, igual aos
  // demais Contra-Ataques do sistema (ex: Espada de Uma Mão, P.A.R.R.Y).
  fecharCriacaoAnaoModal();
  saveState();
  renderAll();
}

// "Conclamar" (Campeão), em Luta: escolha entre chamar a atenção de um
// Alvo (narrativo, resolvido na mesa) ou reduzir em 2 turnos a recarga de
// Grito de Guerra ou Motivar. As duas reduções de recarga só ficam
// clicáveis se o personagem tiver a Habilidade correspondente E ela
// estiver de fato em recarga no momento (senão não há o que reduzir).
function abrirConclamarModal(pid) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;

  const grito = p.skills.find(s => s.id === 'sk_banco_campeao_grito_de_guerra');
  const motivar = p.skills.find(s => s.id === 'sk_banco_campeao_motivar');

  const opcaoRecarga = (sk, label) => {
    if (!sk) return '';
    const emRecarga = sk.tipo === 'turno_N' && sk.cdRestante > 0;
    const info = !emRecarga ? 'já pronta' : `faltam ${sk.cdRestante} ${sk.cdRestante === 1 ? 'turno' : 'turnos'}`;
    return `<button class="tm-opcao tm-opcao-blue" ${!emRecarga ? 'disabled' : ''} onclick="escolherConclamar(${p.id},'${sk.id}')">
      <span class="tm-opcao-nome">⏱️ Reduzir 2 turnos — ${escHtml(label)}</span>
      <span class="tm-opcao-info">${info}</span>
    </button>`;
  };

  overlay.innerHTML = `
    <div class="modal" style="max-width:380px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-speakerphone"></i> Conclamar — em Luta</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px;line-height:1.5">
        Escolha o efeito de ${escHtml(p.name)}:
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="tm-opcao tm-opcao-blue" onclick="escolherConclamar(${p.id},null)">
          <span class="tm-opcao-nome">🎯 Chamar a atenção de um Alvo</span>
          <span class="tm-opcao-info">narrativo</span>
        </button>
        ${opcaoRecarga(grito, 'Grito de Guerra')}
        ${opcaoRecarga(motivar, 'Motivar')}
      </div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="fecharCriacaoAnaoModal()">Fechar</button>
    </div>`;
  overlay.classList.add('open');
}

function escolherConclamar(pid, skidAlvo) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  if (skidAlvo) {
    const sk = p.skills.find(s => s.id === skidAlvo);
    if (sk && sk.tipo === 'turno_N' && sk.cdRestante > 0) {
      sk.cdRestante = Math.max(0, sk.cdRestante - 2);
      if (sk.cdRestante === 0) sk.usosAtuais = sk.usosMax;
    }
  }
  // "Chamar a atenção de um Alvo": sem efeito automático — narrativo,
  // resolvido na mesa (igual ao Contra-Ataque do Treinamento Militar).
  fecharCriacaoAnaoModal();
  saveState();
  renderAll();
}

// "Gambiarra de Alto Nível" (Campeão): lista as Armas do inventário que têm
// "usos" (item.usos) pra escolher qual recarregar. Dentro de item.usos, cada
// entrada com custoRecarga é uma "Munição" no sentido da Habilidade (mesmo
// padrão da Aljava do Arco, do Pente de Balas do Revólver etc. — normalmente
// custam Dinheiro pra recarregar); as entradas sem custoRecarga são "Usos"
// genéricos da Arma (ex: Explosão Mágica da Aliança Encantada). Uma Arma só
// aparece se tiver pelo menos um dos dois tipos.
function abrirGambiarraModal(pid) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;

  const armas = (p.inventario || []).filter(i => i.tipo === 'arma' && Array.isArray(i.usos) && i.usos.length > 0);
  const linhasHtml = armas.map(item => {
    const temMunicao = item.usos.some(u => u.custoRecarga);
    const temUsosGerais = item.usos.some(u => !u.custoRecarga);
    if (!temMunicao && !temUsosGerais) return '';
    return `<div style="display:flex;flex-direction:column;gap:6px;padding:10px;border:1px solid var(--border);border-radius:10px">
      <span style="font-size:13px;font-weight:600">${escHtml(item.name)}</span>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${temUsosGerais ? `<button class="tm-opcao tm-opcao-blue" style="flex:1;min-width:130px" onclick="event.stopPropagation();escolherGambiarra(${p.id},'${item.id}','usos')">🔄 Recarregar Usos</button>` : ''}
        ${temMunicao ? `<button class="tm-opcao tm-opcao-blue" style="flex:1;min-width:130px" onclick="event.stopPropagation();escolherGambiarra(${p.id},'${item.id}','municao')">🎯 Recarregar Munição</button>` : ''}
      </div>
    </div>`;
  }).filter(Boolean).join('');

  if (!linhasHtml) {
    alert(`${p.name} não tem nenhuma Arma com "usos" ou Munição pra recarregar.`);
    return;
  }

  overlay.innerHTML = `
    <div class="modal" style="max-width:420px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-tool"></i> Gambiarra de Alto Nível</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px;line-height:1.5">
        Escolha a Arma de ${escHtml(p.name)} e o que recarregar.
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;max-height:340px;overflow-y:auto">${linhasHtml}</div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="fecharCriacaoAnaoModal()">Cancelar</button>
    </div>`;
  overlay.classList.add('open');
}

// Aplica a recarga escolhida no modal acima — de graça (a Gambiarra não
// cobra o custoRecarga em Dinheiro normal desses "usos"): "usos" recarrega
// as entradas de item.usos SEM custoRecarga; "municao" recarrega as
// entradas COM custoRecarga (Aljava, Pente de Balas/Cartuchos/Munição/
// Granadas, Bolsa de Adagas — o "container de munição" da Arma).
function escolherGambiarra(pid, itemId, tipo) {
  const p = PLAYERS.find(x => x.id === pid);
  const item = p && (p.inventario || []).find(i => i.id === itemId);
  if (!item || !Array.isArray(item.usos)) return;

  item.usos.forEach(u => {
    const eMunicao = !!u.custoRecarga;
    if ((tipo === 'municao' && eMunicao) || (tipo === 'usos' && !eMunicao)) {
      u.usosAtuais = u.usosMax;
    }
  });

  fecharCriacaoAnaoModal();
  saveState();
  renderAll();
}

// "Honra" (Campeão): "Pelo que você luta?" — escolha entre restaurar 2d20 de
// Vida, dar Mega Vantagem no Acerto da próxima Técnica ou Golpe (ver
// p.honraMegaVantagemPendente, consumido em construirRolagemAcertoHabilidade),
// ou remover todos os efeitos Negativos. Esse último não tem estrutura de
// dados no app (efeitos Negativos são só narrativos/anotados na mesa), então
// fica registrado como aviso pro Narrador — igual ao resto do sistema trata
// restrições e efeitos amplos desse tipo (ex: Fúria).
function abrirHonraModal(pid) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;

  overlay.innerHTML = `
    <div class="modal" style="max-width:400px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-shield-check"></i> Honra</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:12px;line-height:1.5">
        "Pelo que você luta?" Escolha o efeito para ${escHtml(p.name)}.
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="tm-opcao tm-opcao-blue" onclick="escolherHonra(${p.id},'vida')">
          <span class="tm-opcao-nome">❤️ Restaurar 2d20 de Vida</span>
        </button>
        <button class="tm-opcao tm-opcao-blue" onclick="escolherHonra(${p.id},'mv')">
          <span class="tm-opcao-nome">⚔️ Mega Vantagem na próxima Técnica ou Golpe</span>
        </button>
        <button class="tm-opcao tm-opcao-blue" onclick="escolherHonra(${p.id},'limpar')">
          <span class="tm-opcao-nome">✨ Remover todos os efeitos Negativos</span>
        </button>
      </div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="fecharCriacaoAnaoModal()">Cancelar</button>
    </div>`;
  overlay.classList.add('open');
}

function escolherHonra(pid, opcao) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  fecharCriacaoAnaoModal();

  if (opcao === 'vida') {
    const d1 = 1 + Math.floor(Math.random() * 20);
    const d2 = 1 + Math.floor(Math.random() * 20);
    const cura = d1 + d2;
    p.hp = Math.min(p.hpMax, (p.hp || 0) + cura);
    const entry = {
      playerName: currentUser.name || (IS_NARRADOR ? 'Narrador' : 'Jogador'),
      charName: p.name,
      isNarrator: !!IS_NARRADOR,
      formula: 'Honra — Restaurar Vida',
      tree: { type: 'sum', terms: [{ sign: '+', node: { type: 'dice', sides: 20, count: 2, results: [d1, d2], sum: cura, countNode: null } }] },
      total: cura,
      sides: 20,
      hidden: hiddenPadrao(p),
      rolling: true,
      ts: Date.now(),
      label: '❤️ Honra — Cura',
    };
    pushRollEntry(entry, key => setTimeout(() => finishRollEntry(key), ROLL_ANIM_MS));
    if (!dicePanelOpen) toggleDicePanel();
    else if (dicePanelTab !== 'feed') switchDiceTab('feed');
  } else if (opcao === 'mv') {
    p.honraMegaVantagemPendente = true;
  } else if (opcao === 'limpar') {
    alert(`${p.name} remove TODOS os efeitos Negativos que possui (efeito narrativo — não há uma lista automática no app; ajustem juntos na mesa).`);
  }

  saveState();
  renderAll();
}

// "Recurso" (Habilidade Geral): pergunta qual tipo de item pegar. Pequeno,
// Médio e Grande têm o custo em Dinheiro decidido por dado (1 do dado = 25 de
// Dinheiro: Pequeno 1d2, Médio 1d4, Grande 1d6) e abrem a tela normal de
// criação de Item pro jogador nomear/descrever; Poção de Cura tem custo fixo
// (50 de Dinheiro) e vai direto pro Inventário, sem tela de criação.
const RECURSO_TAMANHOS = {
  pequeno: { label: 'Pequeno', sides: 2 },
  medio:   { label: 'Médio',   sides: 4 },
  grande:  { label: 'Grande',  sides: 6 },
};

function abrirRecursoModal(pid) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;

  overlay.innerHTML = `
    <div class="modal" style="max-width:400px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-backpack"></i> Recurso</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:12px;line-height:1.5">
        ${escHtml(p.name)} pega um objeto na mochila. Escolha o tipo (o custo em Dinheiro é decidido por dado).
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="tm-opcao tm-opcao-blue" onclick="escolherRecurso(${p.id},'pequeno')">
          <span class="tm-opcao-nome">📦 Pequeno — 1d2 × 25 de Dinheiro</span>
        </button>
        <button class="tm-opcao tm-opcao-blue" onclick="escolherRecurso(${p.id},'medio')">
          <span class="tm-opcao-nome">📦 Médio — 1d4 × 25 de Dinheiro</span>
        </button>
        <button class="tm-opcao tm-opcao-blue" onclick="escolherRecurso(${p.id},'grande')">
          <span class="tm-opcao-nome">📦 Grande — 1d6 × 25 de Dinheiro</span>
        </button>
        <button class="tm-opcao tm-opcao-blue" onclick="escolherRecurso(${p.id},'pocao')">
          <span class="tm-opcao-nome">🧪 Poção de Cura — 50 de Dinheiro</span>
        </button>
      </div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="fecharCriacaoAnaoModal()">Cancelar</button>
    </div>`;
  overlay.classList.add('open');
}

function escolherRecurso(pid, tamanho) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  fecharCriacaoAnaoModal();

  if (tamanho === 'pocao') {
    const custo = 50;
    if ((p.dinheiro || 0) < custo) {
      alert(`Dinheiro insuficiente! Uma Poção de Cura custa ${custo} de Dinheiro, e ${p.name} só tem ${p.dinheiro || 0}.`);
      return;
    }
    p.dinheiro = Math.max(0, (p.dinheiro || 0) - custo);

    // Empilha na Poção de Cura já existente (mesma checagem de nome usada
    // em "Beber Poção"), ou cria uma nova unidade se ainda não tiver.
    if (!Array.isArray(p.inventario)) p.inventario = [];
    const existente = p.inventario.find(it => normalizarNomeItem(it.name).includes('pocao de cura'));
    if (existente) {
      existente.qtd = (existente.qtd != null ? existente.qtd : 1) + 1;
    } else {
      p.inventario.push({ id: 'inv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), name: 'Poção de Cura', tipo: 'item', efeito: '', qtd: 1 });
    }
    saveState();
    renderAll();
    return;
  }

  const info = RECURSO_TAMANHOS[tamanho];
  if (!info) return;
  const d = 1 + Math.floor(Math.random() * info.sides);
  const custo = d * 25;

  const entry = {
    playerName: currentUser.name || (IS_NARRADOR ? 'Narrador' : 'Jogador'),
    charName: p.name,
    isNarrator: !!IS_NARRADOR,
    formula: `Recurso — ${info.label} (× 25 de Dinheiro)`,
    tree: { type: 'sum', terms: [{ sign: '+', node: { type: 'dice', sides: info.sides, count: 1, results: [d], sum: d, countNode: null } }] },
    total: d,
    sides: info.sides,
    hidden: hiddenPadrao(p),
    rolling: true,
    ts: Date.now(),
    label: `📦 Recurso — ${info.label}`,
  };
  pushRollEntry(entry, key => setTimeout(() => finishRollEntry(key), ROLL_ANIM_MS));
  if (!dicePanelOpen) toggleDicePanel();
  else if (dicePanelTab !== 'feed') switchDiceTab('feed');

  if ((p.dinheiro || 0) < custo) {
    alert(`Dinheiro insuficiente! O item ${info.label} saiu por ${custo} de Dinheiro (1d${info.sides} × 25), e ${p.name} só tem ${p.dinheiro || 0}. Nenhum item foi adicionado.`);
    return;
  }
  p.dinheiro = Math.max(0, (p.dinheiro || 0) - custo);
  saveState();
  renderAll();

  // Abre a tela normal de criação de Item pro jogador nomear/descrever o
  // que pegou — mesma tela usada pro botão "Adicionar Item" do Inventário.
  openInvModal(pid, { tipo: 'item', qtd: 1 });
}

// "Beber Poção" (Habilidade Geral): quando o Inventário tem uma "Poção de
// Cura" (ver useSkill), pergunta qual dos dois efeitos de Cura usar — 1d20
// ou 10 de Vida fixo — e consome 1 unidade do item ao escolher.
function abrirBeberPocaoModal(pid, itemId) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;

  overlay.innerHTML = `
    <div class="modal" style="max-width:400px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-flask"></i> Beber Poção</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:12px;line-height:1.5">
        ${escHtml(p.name)} bebe uma Poção de Cura. Escolha o efeito.
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="tm-opcao tm-opcao-blue" onclick="escolherBeberPocao(${p.id},'${itemId}','dado')">
          <span class="tm-opcao-nome">🎲 Curar 1d20 de Vida</span>
        </button>
        <button class="tm-opcao tm-opcao-blue" onclick="escolherBeberPocao(${p.id},'${itemId}','fixo')">
          <span class="tm-opcao-nome">❤️ Curar 10 de Vida</span>
        </button>
      </div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="fecharCriacaoAnaoModal()">Cancelar</button>
    </div>`;
  overlay.classList.add('open');
}

function escolherBeberPocao(pid, itemId, opcao) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  fecharCriacaoAnaoModal();

  // Consome 1 unidade da Poção usada: reduz a quantidade se o item tiver
  // stack (qtd), ou remove o item inteiro se for uma unidade avulsa.
  const item = (p.inventario || []).find(it => it.id === itemId);
  if (item) {
    if (item.qtd != null) {
      item.qtd = Math.max(0, item.qtd - 1);
      if (item.qtd === 0) p.inventario = p.inventario.filter(it => it.id !== itemId);
    } else {
      p.inventario = (p.inventario || []).filter(it => it.id !== itemId);
    }
  }

  let cura, tree, sides = null, rolling = false, doneCb;
  if (opcao === 'dado') {
    const d1 = 1 + Math.floor(Math.random() * 20);
    cura = d1;
    tree = { type: 'sum', terms: [{ sign: '+', node: { type: 'dice', sides: 20, count: 1, results: [d1], sum: cura, countNode: null } }] };
    sides = 20;
    rolling = true;
    doneCb = key => setTimeout(() => finishRollEntry(key), ROLL_ANIM_MS);
  } else {
    cura = 10;
    tree = { type: 'sum', terms: [{ sign: '+', node: { type: 'const', value: cura } }] };
    doneCb = key => finishRollEntry(key);
  }

  p.hp = Math.min(p.hpMax, (p.hp || 0) + cura);

  const entry = {
    playerName: currentUser.name || (IS_NARRADOR ? 'Narrador' : 'Jogador'),
    charName: p.name,
    isNarrator: !!IS_NARRADOR,
    formula: 'Beber Poção — Cura',
    tree,
    total: cura,
    sides,
    hidden: hiddenPadrao(p),
    rolling,
    ts: Date.now(),
    label: '🧪 Beber Poção — Cura',
  };
  pushRollEntry(entry, doneCb);
  if (!dicePanelOpen) toggleDicePanel();
  else if (dicePanelTab !== 'feed') switchDiceTab('feed');

  saveState();
  renderAll();
}

// "Arremesso" (Habilidade Geral): pergunta O QUE foi arremessado. Objetos
// (Leve/Médio/Pesado/Mega Pesado) causam um dado fixo de Dano, publicado
// direto no feed — não passam pelo Aparo/Maestria de Arma, são só um objeto
// qualquer. "Sua Arma equipada" reaproveita rolarDanoArma normal (Dano dela
// + Maestria + bônus, igual a um ataque), e guarda a Arma em seguida (foi
// jogada longe — não está mais na mão).
const ARREMESSO_OBJETOS = {
  leve:   { label: 'Leve',        sides: 4  },
  medio:  { label: 'Médio',       sides: 6  },
  pesado: { label: 'Pesado',      sides: 8  },
  mega:   { label: 'Mega Pesado', sides: 10 },
};

function abrirArremessoModal(pid) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;
  const armaEquipada = getArmaEquipadaPrincipal(p);
  const temArmaReal = armaEquipada && armaEquipada.id !== 'sem_arma' && armaEquipada.dano;

  overlay.innerHTML = `
    <div class="modal" style="max-width:400px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-target-arrow"></i> Arremesso</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:12px;line-height:1.5">
        O que ${escHtml(p.name)} está arremessando?
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="tm-opcao tm-opcao-blue" onclick="escolherArremesso(${p.id},'leve')">
          <span class="tm-opcao-nome">📦 Objeto Leve — 1d4 de Dano</span>
        </button>
        <button class="tm-opcao tm-opcao-blue" onclick="escolherArremesso(${p.id},'medio')">
          <span class="tm-opcao-nome">📦 Objeto Médio — 1d6 de Dano</span>
        </button>
        <button class="tm-opcao tm-opcao-blue" onclick="escolherArremesso(${p.id},'pesado')">
          <span class="tm-opcao-nome">📦 Objeto Pesado — 1d8 de Dano</span>
        </button>
        <button class="tm-opcao tm-opcao-blue" onclick="escolherArremesso(${p.id},'mega')">
          <span class="tm-opcao-nome">📦 Objeto Mega Pesado — 1d10 de Dano</span>
        </button>
        ${temArmaReal ? `<button class="tm-opcao tm-opcao-blue" onclick="escolherArremesso(${p.id},'arma')">
          <span class="tm-opcao-nome">⚔ ${escHtml(armaEquipada.name)} (equipada) — ${escHtml(armaEquipada.dano)} + Maestria</span>
        </button>` : ''}
      </div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="fecharCriacaoAnaoModal()">Cancelar</button>
    </div>`;
  overlay.classList.add('open');
}

function escolherArremesso(pid, tipo) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  fecharCriacaoAnaoModal();

  if (tipo === 'arma') {
    const item = getArmaEquipadaPrincipal(p);
    if (!item || item.id === 'sem_arma' || !item.dano) return;
    rolarDanoArma(pid, item.id, { labelPrefixo: 'Arremesso' });
    // A Arma foi jogada longe — guarda ela em seguida. Se houver uma 2ª
    // arma na mão secundária, ela assume a mão principal na hora.
    item.equipado = false;
    promoverArmaSecundariaAoArremessar(p);
    saveState();
    renderAll();
    return;
  }

  const info = ARREMESSO_OBJETOS[tipo];
  if (!info) return;
  const d = 1 + Math.floor(Math.random() * info.sides);

  const entry = {
    playerName: currentUser.name || (IS_NARRADOR ? 'Narrador' : 'Jogador'),
    charName: p.name,
    isNarrator: !!IS_NARRADOR,
    formula: `Arremesso — Objeto ${info.label}`,
    tree: { type: 'sum', terms: [{ sign: '+', node: { type: 'dice', sides: info.sides, count: 1, results: [d], sum: d, countNode: null } }] },
    total: d,
    sides: info.sides,
    hidden: hiddenPadrao(p),
    rolling: true,
    ts: Date.now(),
    label: `🎯 Arremesso — Objeto ${info.label}`,
  };
  spinDiceFab(true, info.sides);
  pushRollEntry(entry, key => {
    setTimeout(() => finishRollEntry(key), ROLL_ANIM_MS);
    setTimeout(() => spinDiceFab(false), ROLL_ANIM_MS);
  });
}

// "Aparo Agressivo" (Subclasse Combatente): o Acerto (ver
// rolarAcertoAparoAgressivo) já rola o Teste de Aparar (Força — mesma
// Maestria/MV/MD/Bônus configurados na aba Testes) antes de chegar aqui.
// Como o app não sabe o resultado do ataque do Alvo (não é um personagem
// rastreado), "Usar Efeito" só pergunta se ele falhou contra esse Aparo:
// sempre causa 4 de Dano fixo (avançou no Alvo); se o ataque tiver falhado
// contra o Aparo, soma +1d4 de Dano extra — igual ao texto da Habilidade.
function abrirAparoAgressivoModal(pid) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;

  const overlay = document.getElementById('modal-criacao-anao-overlay');
  if (!overlay) return;
  overlay.innerHTML = `
    <div class="modal" style="max-width:400px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-shield-check"></i> Aparo Agressivo</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:12px;line-height:1.5">
        O ataque recebido por ${escHtml(p.name)} falhou contra esse Aparo?
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="tm-opcao tm-opcao-blue" onclick="escolherAparoAgressivo(${p.id},true)">
          <span class="tm-opcao-nome">✅ Sim, falhou — 4 + 1d4 de Dano</span>
        </button>
        <button class="tm-opcao tm-opcao-blue" onclick="escolherAparoAgressivo(${p.id},false)">
          <span class="tm-opcao-nome">❌ Não, acertou — 4 de Dano</span>
        </button>
      </div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="fecharCriacaoAnaoModal()">Cancelar</button>
    </div>`;
  overlay.classList.add('open');
}

function escolherAparoAgressivo(pid, atacanteFalhou) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  fecharCriacaoAnaoModal();

  const base = 4;
  const terms = [{ sign: '+', node: { type: 'const', value: base } }];
  let d = 0, sides = null;
  if (atacanteFalhou) {
    sides = 4;
    d = 1 + Math.floor(Math.random() * sides);
    terms.push({ sign: '+', node: { type: 'dice', sides, count: 1, results: [d], sum: d, countNode: null } });
  }
  const total = base + d;

  const entry = {
    playerName: currentUser.name || (IS_NARRADOR ? 'Narrador' : 'Jogador'),
    charName: p.name,
    isNarrator: !!IS_NARRADOR,
    formula: atacanteFalhou ? 'Aparo Agressivo — Dano (4 + 1d4)' : 'Aparo Agressivo — Dano (4)',
    tree: { type: 'sum', terms },
    total,
    sides: sides || undefined,
    hidden: hiddenPadrao(p),
    rolling: !!atacanteFalhou,
    ts: Date.now(),
    label: `🛡️ Aparo Agressivo — ${total} de Dano${atacanteFalhou ? ' (ataque falhou contra o Aparo)' : ''}`,
  };
  if (atacanteFalhou) spinDiceFab(true, sides);
  pushRollEntry(entry, key => {
    if (atacanteFalhou) {
      setTimeout(() => finishRollEntry(key), ROLL_ANIM_MS);
      setTimeout(() => spinDiceFab(false), ROLL_ANIM_MS);
    }
  });
}

// "Arremesso Imprudente" (Subclasse Combatente): antes de rolar o Acerto
// (Teste de Arremessar), pergunta QUAL arma será arremessada — a que está
// equipada na mão principal (dá +1d6 de Vantagem no Teste) ou uma do
// Inventário (dá +3 de Dano no "Usar Efeito" em vez da Vantagem). A escolha
// fica guardada em sk._arremessoImprudenteItemId/BonusDano até o "Usar
// Efeito" (ver rolarDanoArremessoImprudente), que rola o Dano da arma
// escolhida + Maestria de Força + esse bônus.
function abrirArremessoImprudenteModal(pid, skid) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;

  const armaEquipada = getArmaEquipadaPrincipal(p);
  const temArmaEquipada = armaEquipada && armaEquipada.id !== 'sem_arma' && armaEquipada.dano;
  const armasInventario = (p.inventario || []).filter(it =>
    it.tipo === 'arma' && it.dano && (!temArmaEquipada || it.id !== armaEquipada.id));

  const opcoesHtml = [
    temArmaEquipada ? `<button class="tm-opcao tm-opcao-blue" onclick="escolherArmaArremessoImprudente(${p.id},'${skid}','${armaEquipada.id}','equipada')">
      <span class="tm-opcao-nome">🖐 ${escHtml(armaEquipada.name)} (equipada)</span>
      <span class="tm-opcao-info">+1d6 de Vantagem no Arremesso</span>
    </button>` : '',
    ...armasInventario.map(item => `<button class="tm-opcao tm-opcao-blue" onclick="escolherArmaArremessoImprudente(${p.id},'${skid}','${item.id}','inventario')">
      <span class="tm-opcao-nome">🎒 ${escHtml(item.name)}</span>
      <span class="tm-opcao-info">+3 de Dano</span>
    </button>`),
  ].filter(Boolean).join('');

  if (!opcoesHtml) {
    alert('Nenhuma Arma disponível pra arremessar (equipe uma Arma ou tenha alguma no Inventário).');
    return;
  }

  overlay.innerHTML = `
    <div class="modal" style="max-width:400px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-target-arrow"></i> Arremesso Imprudente</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:12px;line-height:1.5">
        Qual Arma ${escHtml(p.name)} vai arremessar?
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">${opcoesHtml}</div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="fecharCriacaoAnaoModal()">Cancelar</button>
    </div>`;
  overlay.classList.add('open');
}

function escolherArmaArremessoImprudente(pid, skid, itemId, tipo) {
  const p = PLAYERS.find(x => x.id === pid);
  const sk = p && p.skills.find(s => s.id === skid);
  fecharCriacaoAnaoModal();
  if (!p || !sk) return;

  sk._arremessoImprudenteItemId = itemId;
  sk._arremessoImprudenteBonusDano = tipo === 'inventario' ? 3 : 0;
  // Guardado pra, no "Usar Efeito" (rolarDanoArremessoImprudente), desequipar
  // a arma jogada — mesmo comportamento da Habilidade Geral "Arremesso"
  // (escolherArremesso) quando a arma arremessada é a equipada.
  sk._arremessoImprudenteEraEquipada = tipo === 'equipada';

  // Marca temporária lida só pelo Teste de Arremessar desta rolagem (ver
  // construirRolagemTeste) — nunca persiste no personagem.
  if (tipo === 'equipada') p._arremessoImprudenteVantagemTemp = true;
  rolarTeste(pid, 'arremessar');
  delete p._arremessoImprudenteVantagemTemp;

  sk.aguardandoResultado = true;
  saveState();
  renderAll();
}

// "Arremesso Imprudente" (Subclasse Combatente): o "Usar Efeito" — chamado
// depois do Acerto (Teste de Arremessar) já ter sido rolado e a Arma já
// escolhida (ver escolherArmaArremessoImprudente) — rola o Dano da Arma
// escolhida + Maestria de FORÇA (sempre, independente do peso da Arma —
// diferente de um ataque normal) + o bônus de +3 de Dano, se a Arma
// arremessada veio do Inventário em vez da mão equipada.
function rolarDanoArremessoImprudente(pid, sk) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  const item = sk._arremessoImprudenteItemId && resolverArmaOuInstrumento(p, sk._arremessoImprudenteItemId);
  if (!item || !item.dano) {
    delete sk._arremessoImprudenteItemId;
    delete sk._arremessoImprudenteBonusDano;
    delete sk._arremessoImprudenteEraEquipada;
    return;
  }

  let parsed;
  try { parsed = parseFormula(item.dano); } catch (e) { parsed = null; }
  const baseNode = parsed ? parsed.node : null;
  const terms = baseNode ? (baseNode.type === 'sum' ? baseNode.terms.slice() : [{ sign: '+', node: baseNode }]) : [];
  let total = parsed ? parsed.value : 0;

  const mstForca = maestriaDe(p, 'forca');
  if (mstForca) {
    terms.push({ sign: '+', node: { type: 'labeled_const', value: mstForca, label: 'Maestria FOR' } });
    total += mstForca;
  }

  const bonusInventario = sk._arremessoImprudenteBonusDano || 0;
  if (bonusInventario) {
    terms.push({ sign: '+', node: { type: 'labeled_const', value: bonusInventario, label: 'Arremesso Imprudente' } });
    total += bonusInventario;
  }

  const entry = {
    playerName: currentUser.name || (IS_NARRADOR ? 'Narrador' : 'Jogador'),
    charName: p.name,
    isNarrator: !!IS_NARRADOR,
    formula: `Arremesso Imprudente — ${item.name}`,
    tree: { type: 'sum', terms },
    total,
    hidden: hiddenPadrao(p),
    rolling: true,
    ts: Date.now(),
  };

  spinDiceFab(true, 6);
  pushRollEntry(entry, key => {
    setTimeout(() => finishRollEntry(key), ROLL_ANIM_MS);
    setTimeout(() => spinDiceFab(false), ROLL_ANIM_MS);
  });

  // A Arma foi jogada longe — guarda ela em seguida, igual à Habilidade
  // Geral "Arremesso" (ver escolherArremesso). Se houver uma 2ª arma na mão
  // secundária, ela assume a mão principal na hora (promoverArmaSecundariaAoArremessar).
  if (sk._arremessoImprudenteEraEquipada) {
    item.equipado = false;
    promoverArmaSecundariaAoArremessar(p);
  }

  delete sk._arremessoImprudenteItemId;
  delete sk._arremessoImprudenteBonusDano;
  delete sk._arremessoImprudenteEraEquipada;
  saveState();
  renderAll();
}

// "Ataque Giratório" (Subclasse Combatente): causa 5 de Dano fixo + Dano da
// Arma equipada na mão PRINCIPAL (fórmula bruta dela, igual a um ataque
// normal — mesmo "Sem Arma", que tem Dano base "1") + Maestria de FORÇA
// (sempre, igual ao Arremesso Imprudente) + os mesmos bônus de item da Arma
// principal, se ela tiver (Afiação Aprimorada, Profundezas — ver
// getBonusesDanoArma). Com uma 2ª Arma na mão secundária (Ambidestro/
// Guerreiro Perfeito), soma mais +5 fixo + o Dano da fórmula bruta dela
// (sem os bônus de item da 2ª arma, mesmo padrão já usado no "Ataque com 2
// Armas" — ver construirRolagemDanoArma/forcarAmbidestro).
// Independente de ter 1 ou 2 Armas, sempre rola o Teste de Resistência do
// próprio personagem em seguida — como o app não decide sozinho se um Teste
// "passou" (sem sistema de CD), abre um modal perguntando o resultado (ver
// abrirAtaqueGiratorioResistenciaModal); se falhar, aplica Mega Desvantagem
// real em Desviar e Aparar até o próximo turno (limpa em aplicarResetDeTurno/
// resetLuta, ver marca p.ataqueGiratorioDesequilibrado).
function rolarDanoAtaqueGiratorio(pid, sk) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;

  const terms = [{ sign: '+', node: { type: 'const', value: 5 } }];
  let total = 5;

  const itemPrincipal = getArmaEquipadaPrincipal(p);
  if (itemPrincipal && (itemPrincipal.dano || '').trim()) {
    try {
      const parsedPrinc = parseFormula(itemPrincipal.dano);
      const princNode = parsedPrinc.node;
      const princTerms = princNode.type === 'sum' ? princNode.terms.slice() : [{ sign: '+', node: princNode }];
      princTerms.forEach(t => {
        if (t.node.type === 'dice') t.node.label = `⚔ ${itemPrincipal.name}`;
        else if (t.node.type === 'const') t.node = { type: 'labeled_const', value: t.node.value, label: `⚔ ${itemPrincipal.name}` };
        else if (t.node.type === 'labeled_const') t.node.label = `⚔ ${itemPrincipal.name} — ${t.node.label}`;
        terms.push(t);
      });
      total += parsedPrinc.value;
    } catch (e) { /* fórmula inválida na Arma principal — ignora */ }
  }

  const mstForca = maestriaDe(p, 'forca');
  if (mstForca) {
    terms.push({ sign: '+', node: { type: 'labeled_const', value: mstForca, label: 'Maestria FOR' } });
    total += mstForca;
  }

  if (itemPrincipal && itemPrincipal.id !== 'sem_arma') {
    const bonusesItem = getBonusesDanoArma(p, itemPrincipal);
    terms.push(...bonusesItem.terms);
    total += bonusesItem.total;
  }

  const armaSec = getArmaSecundariaEquipada(p);
  const com2Armas = !!(armaSec && (armaSec.dano || '').trim());
  if (com2Armas) {
    terms.push({ sign: '+', node: { type: 'labeled_const', value: 5, label: '2 Armas' } });
    total += 5;
    try {
      const parsedSec = parseFormula(armaSec.dano);
      const secNode = parsedSec.node;
      const secTerms = secNode.type === 'sum' ? secNode.terms.slice() : [{ sign: '+', node: secNode }];
      secTerms.forEach(t => {
        if (t.node.type === 'dice') t.node.label = `🌀 ${armaSec.name}`;
        else if (t.node.type === 'const') t.node = { type: 'labeled_const', value: t.node.value, label: `🌀 ${armaSec.name}` };
        else if (t.node.type === 'labeled_const') t.node.label = `🌀 ${armaSec.name} — ${t.node.label}`;
        terms.push(t);
      });
      total += parsedSec.value;
    } catch (e) { /* fórmula inválida na 2ª arma — ignora o bônus */ }
  }

  const entry = {
    playerName: currentUser.name || (IS_NARRADOR ? 'Narrador' : 'Jogador'),
    charName: p.name,
    isNarrator: !!IS_NARRADOR,
    formula: `Ataque Giratório — ${itemPrincipal ? itemPrincipal.name : 'Sem Arma'}${com2Armas ? ` + ${armaSec.name}` : ''}`,
    tree: { type: 'sum', terms },
    total,
    hidden: hiddenPadrao(p),
    rolling: true,
    ts: Date.now(),
  };

  spinDiceFab(true, 6);
  pushRollEntry(entry, key => {
    setTimeout(() => finishRollEntry(key), ROLL_ANIM_MS);
    setTimeout(() => spinDiceFab(false), ROLL_ANIM_MS);
  });

  // Independente de ter 1 ou 2 Armas, o giro deixa o personagem instável:
  // rola o Teste de Resistência dele mesmo em seguida.
  rolarTeste(pid, 'resistir');
  setTimeout(() => abrirAtaqueGiratorioResistenciaModal(pid), ROLL_ANIM_MS + 250);
}

function abrirAtaqueGiratorioResistenciaModal(pid) {
  const p = PLAYERS.find(x => x.id === pid);
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  if (!overlay || !p) return;
  overlay.innerHTML = `
    <div class="modal" style="max-width:400px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-alert-triangle"></i> Ataque Giratório</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:12px;line-height:1.5">
        O Teste de Resistência de ${escHtml(p.name)} falhou?
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="tm-opcao tm-opcao-blue" onclick="escolherAtaqueGiratorioResistencia(${p.id},true)" style="display:flex;flex-direction:column;align-items:flex-start;gap:2px">
          <span class="tm-opcao-nome">❌ Sim, falhou</span>
          <span style="font-size:11px;color:var(--text2);font-weight:400;line-height:1.4;text-align:left">Mega Desvantagem em Desviar/Aparar até o próximo turno</span>
        </button>
        <button class="tm-opcao tm-opcao-blue" onclick="escolherAtaqueGiratorioResistencia(${p.id},false)">
          <span class="tm-opcao-nome">✅ Não, resistiu</span>
        </button>
      </div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="fecharCriacaoAnaoModal()">Fechar</button>
    </div>`;
  overlay.classList.add('open');
}

function escolherAtaqueGiratorioResistencia(pid, falhou) {
  const p = PLAYERS.find(x => x.id === pid);
  fecharCriacaoAnaoModal();
  if (!p) return;
  if (falhou) {
    getTestePersonagem(p);
    p.testes.desviar.md = true;
    p.testes.aparar.md = true;
    p.ataqueGiratorioDesequilibrado = true;
  }
  saveState();
  renderAll();
}

// "Força Colossal" (Subclasse Combatente): não tem Acerto (ver
// HABILIDADES_SEM_ACERTO) — "Usar Efeito" rola de cara 1d10 de Dano na
// própria Vida (publicado no feed, aplicado com adjHP) e, ao terminar a
// animação, abre a escolha entre os 4 efeitos do texto (ver
// abrirForcaColossalModal/escolherForcaColossal). O Dano é sempre aplicado,
// mesmo que o jogador feche o modal sem escolher nada.
function rolarForcaColossal(pid, sk) {
  if (!currentUser) return;
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;

  const sides = 10;
  const d1 = 1 + Math.floor(Math.random() * sides);

  const entry = {
    playerName: currentUser.name || (IS_NARRADOR ? 'Narrador' : 'Jogador'),
    charName: p.name,
    isNarrator: !!IS_NARRADOR,
    formula: 'Força Colossal (Dano na própria Vida)',
    tree: { type: 'sum', terms: [{ sign: '+', node: { type: 'dice', sides, count: 1, results: [d1], sum: d1, countNode: null } }] },
    total: d1,
    hidden: hiddenPadrao(p),
    rolling: true,
    ts: Date.now(),
  };

  spinDiceFab(true, sides);
  pushRollEntry(entry, key => {
    setTimeout(() => finishRollEntry(key), ROLL_ANIM_MS);
    setTimeout(() => spinDiceFab(false), ROLL_ANIM_MS);
  });
  if (!dicePanelOpen) toggleDicePanel();
  else if (dicePanelTab !== 'feed') switchDiceTab('feed');

  adjHP(pid, -d1);
  setTimeout(() => abrirForcaColossalModal(pid), ROLL_ANIM_MS + 250);
}

function abrirForcaColossalModal(pid) {
  const p = PLAYERS.find(x => x.id === pid);
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  if (!overlay || !p) return;
  overlay.innerHTML = `
    <div class="modal" style="max-width:420px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-bolt"></i> Força Colossal</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:12px;line-height:1.5">
        Escolha um efeito para ${escHtml(p.name)}:
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="tm-opcao tm-opcao-blue" onclick="escolherForcaColossal(${p.id},'forca')" style="display:flex;flex-direction:column;align-items:flex-start;gap:2px">
          <span class="tm-opcao-nome">💪 Vantagem em Força</span>
          <span style="font-size:11px;color:var(--text2);font-weight:400;line-height:1.4;text-align:left">+1d10 de Vantagem no próximo Teste de Força</span>
        </button>
        <button class="tm-opcao tm-opcao-blue" onclick="escolherForcaColossal(${p.id},'golpe_dano')" style="display:flex;flex-direction:column;align-items:flex-start;gap:2px">
          <span class="tm-opcao-nome">🩸 Dano no próximo Golpe</span>
          <span style="font-size:11px;color:var(--text2);font-weight:400;line-height:1.4;text-align:left">+1d8 de Dano no próximo Golpe</span>
        </button>
        <button class="tm-opcao tm-opcao-blue" onclick="escolherForcaColossal(${p.id},'armadura')" style="display:flex;flex-direction:column;align-items:flex-start;gap:2px">
          <span class="tm-opcao-nome">🛡 Armadura temporária</span>
          <span style="font-size:11px;color:var(--text2);font-weight:400;line-height:1.4;text-align:left">+5 de Armadura até o final da luta</span>
        </button>
        <button class="tm-opcao tm-opcao-blue" onclick="escolherForcaColossal(${p.id},'mega_vantagem_golpe')" style="display:flex;flex-direction:column;align-items:flex-start;gap:2px">
          <span class="tm-opcao-nome">⚡ Mega Vantagem no Golpe</span>
          <span style="font-size:11px;color:var(--text2);font-weight:400;line-height:1.4;text-align:left">Seu próximo Golpe, neste turno, tem Mega Vantagem no Acerto</span>
        </button>
      </div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="fecharCriacaoAnaoModal()">Fechar sem escolher</button>
    </div>`;
  overlay.classList.add('open');
}

function escolherForcaColossal(pid, opcao) {
  const p = PLAYERS.find(x => x.id === pid);
  fecharCriacaoAnaoModal();
  if (!p) return;
  if (opcao === 'forca') {
    p.forcaColossalTesteForcaPendente = true;
  } else if (opcao === 'golpe_dano') {
    p.forcaColossalDanoGolpePendente = true;
  } else if (opcao === 'armadura') {
    p.armaduraMax = (p.armaduraMax || 0) + 5;
    p.armadura = (p.armadura || 0) + 5;
    p.forcaColossalArmaduraBonus = (p.forcaColossalArmaduraBonus || 0) + 5;
  } else if (opcao === 'mega_vantagem_golpe') {
    p.forcaColossalMegaVantagemGolpePendente = true;
  }
  saveState();
  renderAll();
}

// "Investida Bruta" (Subclasse Combatente): mantém o Acerto normal (não
// entra em HABILIDADES_SEM_ACERTO) — "Usar Efeito" só rola de cara o 1d4 de
// quantas Casas o Alvo é empurrado, publicado no feed de dados. O restante
// do texto (Alvo precisa estar entre 4 e 8 Casas, -1d8 de Desvantagem no
// Teste de Resistência dele ao empurrão, perder uma Ação se tirar 8) não é
// automatizado — o app não rastreia distância/posição nem tem um Alvo
// específico selecionável entre personagens, então fica por conta da mesa.
function rolarInvestidaBruta(pid, sk) {
  if (!currentUser) return;
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;

  const sides = 4;
  const d1 = 1 + Math.floor(Math.random() * sides);

  const entry = {
    playerName: currentUser.name || (IS_NARRADOR ? 'Narrador' : 'Jogador'),
    charName: p.name,
    isNarrator: !!IS_NARRADOR,
    formula: 'Investida Bruta (Casas de Empurrão)',
    tree: { type: 'sum', terms: [{ sign: '+', node: { type: 'dice', sides, count: 1, results: [d1], sum: d1, countNode: null } }] },
    total: d1,
    hidden: hiddenPadrao(p),
    rolling: true,
    ts: Date.now(),
  };

  spinDiceFab(true, sides);
  pushRollEntry(entry, key => {
    setTimeout(() => finishRollEntry(key), ROLL_ANIM_MS);
    setTimeout(() => spinDiceFab(false), ROLL_ANIM_MS);
  });
}

// "Troca de Mestre" (Subclasse Combatente): mantém o Acerto normal (não
// entra em HABILIDADES_SEM_ACERTO) — "Usar Efeito" rola de cara o 1º ataque
// (7 de Dano fixo + Dano da Arma atualmente equipada + Maestria de Força +
// bônus de item dela, mesmo padrão de rolarDanoAtaqueGiratorio, mas sem
// "2 Armas") e, ao terminar a animação, abre a escolha de outra Arma do
// Inventário pra trocar (ver abrirTrocaDeMestreModal). Se possível (existir
// outra Arma com fórmula de Dano), o 2º ataque sai automaticamente ao
// escolher, causando só o Dano dela (igual a "Ataque com Arma" normal — ver
// escolherTrocaDeMestreArma/rolarDanoArma).
function rolarDanoTrocaDeMestre(pid, sk) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;

  const terms = [{ sign: '+', node: { type: 'const', value: 7 } }];
  let total = 7;

  const itemPrincipal = getArmaEquipadaPrincipal(p);
  if (itemPrincipal && (itemPrincipal.dano || '').trim()) {
    try {
      const parsedPrinc = parseFormula(itemPrincipal.dano);
      const princNode = parsedPrinc.node;
      const princTerms = princNode.type === 'sum' ? princNode.terms.slice() : [{ sign: '+', node: princNode }];
      princTerms.forEach(t => {
        if (t.node.type === 'dice') t.node.label = `⚔ ${itemPrincipal.name}`;
        else if (t.node.type === 'const') t.node = { type: 'labeled_const', value: t.node.value, label: `⚔ ${itemPrincipal.name}` };
        else if (t.node.type === 'labeled_const') t.node.label = `⚔ ${itemPrincipal.name} — ${t.node.label}`;
        terms.push(t);
      });
      total += parsedPrinc.value;
    } catch (e) { /* fórmula inválida na Arma principal — ignora */ }
  }

  const mstForca = maestriaDe(p, 'forca');
  if (mstForca) {
    terms.push({ sign: '+', node: { type: 'labeled_const', value: mstForca, label: 'Maestria FOR' } });
    total += mstForca;
  }

  if (itemPrincipal && itemPrincipal.id !== 'sem_arma') {
    const bonusesItem = getBonusesDanoArma(p, itemPrincipal);
    terms.push(...bonusesItem.terms);
    total += bonusesItem.total;
  }

  const entry = {
    playerName: currentUser.name || (IS_NARRADOR ? 'Narrador' : 'Jogador'),
    charName: p.name,
    isNarrator: !!IS_NARRADOR,
    formula: `Troca de Mestre — ${itemPrincipal ? itemPrincipal.name : 'Sem Arma'} (1º ataque)`,
    tree: { type: 'sum', terms },
    total,
    hidden: hiddenPadrao(p),
    rolling: true,
    ts: Date.now(),
  };

  spinDiceFab(true, 6);
  pushRollEntry(entry, key => {
    setTimeout(() => finishRollEntry(key), ROLL_ANIM_MS);
    setTimeout(() => spinDiceFab(false), ROLL_ANIM_MS);
  });

  setTimeout(() => abrirTrocaDeMestreModal(pid, itemPrincipal ? itemPrincipal.id : null, sk), ROLL_ANIM_MS + 250);
}

function abrirTrocaDeMestreModal(pid, itemUsadoId, sk) {
  const p = PLAYERS.find(x => x.id === pid);
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  if (!overlay || !p) return;

  const outras = (p.inventario || []).filter(it =>
    (it.tipo === 'arma' || it.tipo === 'instrumento') && it.id !== itemUsadoId);

  if (outras.length === 0) {
    overlay.innerHTML = `
      <div class="modal" style="max-width:400px" onclick="event.stopPropagation()">
        <h3><i class="ti ti-sword"></i> Troca de Mestre</h3>
        <div style="font-size:12.5px;color:var(--text2);margin-bottom:12px;line-height:1.5">
          Não há outra Arma/Instrumento no Inventário de ${escHtml(p.name)} para trocar — não é possível fazer o 2º ataque.
        </div>
        <button class="tm-cancelar" onclick="fecharCriacaoAnaoModal()">Fechar</button>
      </div>`;
    overlay.classList.add('open');
    return;
  }

  const opcoesHtml = outras.map(item => {
    const icone = item.tipo === 'instrumento' ? 'ti-music' : 'ti-sword';
    return `<button class="tm-opcao ${item.tipo === 'instrumento' ? 'tm-opcao-blue' : 'tm-opcao-red'}" onclick="escolherTrocaDeMestreArma(${p.id},'${item.id}')">
      <span class="tm-opcao-nome"><i class="ti ${icone}"></i> ${escHtml(item.name)}</span>
    </button>`;
  }).join('');

  overlay.innerHTML = `
    <div class="modal" style="max-width:420px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-sword"></i> Troca de Mestre</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:14px;line-height:1.5">
        Troque para qual Arma/Instrumento? O 2º ataque (só o Dano dela) sai na hora, se ela tiver fórmula de Dano.
      </div>
      <div class="tm-opcoes">${opcoesHtml}</div>
      <button class="tm-cancelar" onclick="fecharCriacaoAnaoModal()">Fechar sem trocar</button>
    </div>`;
  overlay.classList.add('open');
}

function escolherTrocaDeMestreArma(pid, novoItemId) {
  const p = PLAYERS.find(x => x.id === pid);
  fecharCriacaoAnaoModal();
  if (!p) return;
  const novoItem = (p.inventario || []).find(it => it.id === novoItemId);
  if (!novoItem) return;

  p.inventario.forEach(it => {
    if ((it.tipo === 'arma' || it.tipo === 'instrumento') && it.id !== novoItem.id) it.equipado = false;
  });
  novoItem.equipadoSecundaria = false;
  novoItem.equipado = true;
  saveState();
  renderAll();

  if ((novoItem.dano || '').trim()) {
    rolarDanoArma(pid, novoItem.id, { labelPrefixo: 'Troca de Mestre (2º ataque)' });
  }
}

// "Duelo" (Campeão): alterna se a PRÓXIMA rolagem (Acerto ou Teste) conta
// como "contra o Alvo do Duelo" (+1d6 de Vantagem) ou "contra outro Alvo"
// (-1d6 de Desvantagem) — clicável quantas vezes forem necessárias, o
// estado só é consultado (não consumido) na hora de rolar, então continua
// valendo pras rolagens seguintes até o jogador trocar de novo.
function toggleDueloAlvo(pid) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p || !p.dueloAtivo) return;
  p.dueloContraAlvo = !p.dueloContraAlvo;
  saveState();
  renderAll();
}

// Encerra o status de "Duelo" por completo (ex: o Alvo perdeu ou desistiu
// da Luta) — some o badge e para de afetar rolagens futuras.
function desativarDuelo(pid) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  p.dueloAtivo = false;
  saveState();
  renderAll();
}

// Encerra o status de "Fúria" por completo (ex: não acertou 2 Golpes no
// mesmo turno, ou foi curado — condições do texto que o jogador decide na
// mesa, sem detecção automática) — desfaz o +1 Ação/turno e some o badge.
// A Vida não é alterada aqui: se estava travada em 1 pela Fúria, continua
// em 1 até algo (dano ou cura) mudar de verdade.
// "Fúria" (Combatente): reverte o +1 Ação/turno e desliga o status — usado
// tanto pelo botão ✕ manual (desativarFuria) quanto pelo fim automático da
// Luta (resetLuta) e por ser curado (ver adjHP). Não mexe na Vida.
function encerrarFuria(p) {
  if (!p || !p.furiaAtiva) return;
  p.furiaAtiva = false;
  p.acoesMax = Math.max(0, (p.acoesMax || ACOES_POR_TURNO_PADRAO) - 1);
  p.acoesAtuais = Math.max(0, Math.min(p.acoesMax, (p.acoesAtuais ?? p.acoesMax) - 1));
}

function desativarFuria(pid) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p || !p.furiaAtiva) return;
  encerrarFuria(p);
  saveState();
  renderAll();
}

// "Decréptico" (Elfo): escolhe 2 Testes de Intelecto — um recebe +1 de
// Vantagem, o outro +3 (termos à parte na rolagem, iguais à Adaptação do
// Espaço). A -2 de Desvantagem em Resistir é fixa e automática (ver
// construirRolagemTeste), não depende de escolha nenhuma.
// "Origem Sangrenta" (Elfo Sangrento): escolhe 1 Habilidade de outra Classe
// (de graça, sem contar na cota da Aprendizagem Élfica) e trava essa Classe
// pra sempre — nunca mais pode escolher Habilidade dela (nem pela cota
// normal de outra Classe). Passo 1: escolhe a Classe; Passo 2: escolhe a
// Habilidade específica dentro dela.
function abrirOrigemSangrentaModal(pid) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;
  if (p.origemSangrentaUsado) { alert('Origem Sangrenta já foi usada por este personagem.'); return; }

  const classesElegiveis = CLASSES.filter(c => c.name !== p.classeBase);
  const opcoesHtml = classesElegiveis.map(c => `<button class="tm-opcao tm-opcao-blue" onclick="abrirOrigemSangrentaSkillModal(${p.id},'${c.name}')">
    <span class="tm-opcao-nome">${escHtml(c.name)}</span>
  </button>`).join('');

  overlay.innerHTML = `
    <div class="modal" style="max-width:400px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-droplet"></i> Origem Sangrenta</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px;line-height:1.5">
        Escolha de qual Classe você aprende 1 Habilidade de graça. Depois disso, você nunca mais poderá escolher Habilidades dessa Classe.
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:320px;overflow-y:auto">${opcoesHtml}</div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="fecharCriacaoAnaoModal()">Cancelar</button>
    </div>`;
  overlay.classList.add('open');
}

function abrirOrigemSangrentaSkillModal(pid, className) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  const classeObj = CLASSES.find(c => c.name === className);
  if (!overlay || !p || !classeObj) return;

  origemSangrentaPid = pid;
  origemSangrentaClasseAtiva = className;
  origemSangrentaTabAtiva = classeObj.subs[0] ? classeObj.subs[0].name : null;

  overlay.innerHTML = `
    <div class="modal" style="max-width:460px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-droplet"></i> Origem Sangrenta — ${escHtml(className)}</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px;line-height:1.5">
        Escolha a Habilidade. Ao confirmar, ${escHtml(className)} fica travada pra sempre.
      </div>
      <div class="banco-tabs" id="os-tabs"></div>
      <div id="os-lista" style="max-height:360px;overflow-y:auto"></div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="abrirOrigemSangrentaModal(${p.id})">Voltar</button>
    </div>`;
  overlay.classList.add('open');
  renderOrigemSangrentaSkillModal();
}

// Troca a aba (subclasse) ativa dentro do modal de Origem Sangrenta, sem
// fechar/reabrir — mesmo padrão de abas do Banco de Habilidades.
function trocarAbaOrigemSangrenta(subNome) {
  origemSangrentaTabAtiva = subNome;
  renderOrigemSangrentaSkillModal();
}

// Repinta as abas (uma por subclasse de ${className}) e a lista de
// Habilidades da aba ativa. Antes essas Habilidades ficavam todas
// empilhadas numa lista corrida só (uma seção por subclasse, sem separação
// visual de verdade); agora cada subclasse é uma aba própria, igual ao
// Banco de Habilidades normal.
function renderOrigemSangrentaSkillModal() {
  const p = PLAYERS.find(x => x.id === origemSangrentaPid);
  const classeObj = CLASSES.find(c => c.name === origemSangrentaClasseAtiva);
  const tabsEl = document.getElementById('os-tabs');
  const lista = document.getElementById('os-lista');
  if (!p || !classeObj || !tabsEl || !lista) return;

  if (!origemSangrentaTabAtiva || !classeObj.subs.some(s => s.name === origemSangrentaTabAtiva)) {
    origemSangrentaTabAtiva = classeObj.subs[0] ? classeObj.subs[0].name : null;
  }

  tabsEl.innerHTML = classeObj.subs.map(sub => {
    const ativa = sub.name === origemSangrentaTabAtiva;
    return `<button type="button" class="banco-tab ${ativa ? 'active' : ''}" onclick="trocarAbaOrigemSangrenta('${sub.name}')">${sub.name}</button>`;
  }).join('');

  const itensSub = BANCO_HABILIDADES_SUBCLASSE[origemSangrentaTabAtiva] || [];
  lista.innerHTML = itensSub.length
    ? `<div style="display:flex;flex-direction:column;gap:6px">${itensSub.map(item => `<button class="tm-opcao tm-opcao-blue" onclick="event.stopPropagation();confirmarOrigemSangrenta(${p.id},'${origemSangrentaClasseAtiva}','${origemSangrentaTabAtiva}','${item.id}')" style="display:flex;flex-direction:column;align-items:flex-start;gap:2px">
        <span class="tm-opcao-nome">${escHtml(item.name)}</span>
        <span style="font-size:11px;color:var(--text2);font-weight:400;line-height:1.4;text-align:left">${escHtml(item.desc)}</span>
      </button>`).join('')}</div>`
    : `<div style="font-size:12px;color:var(--text3);padding:10px 0">Nenhuma Habilidade cadastrada ainda para ${escHtml(origemSangrentaTabAtiva || '')}.</div>`;
}

function confirmarOrigemSangrenta(pid, className, subclasseOrigem, bancoId) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p || p.origemSangrentaUsado) return;
  const item = (BANCO_HABILIDADES_SUBCLASSE[subclasseOrigem] || []).find(i => i.id === bancoId);
  if (!item) return;

  if (!Array.isArray(p.skills)) p.skills = [];
  const sk = construirSkillDoBanco(item);
  sk.origemSangrenta = true; // não conta na cota da Aprendizagem Élfica nem no Banco normal
  p.skills.push(sk);

  p.origemSangrentaClasseBloqueada = className;
  p.origemSangrentaUsado = true;

  fecharCriacaoAnaoModal();
  saveState();
  renderAll();
  abrirProximoSeletorRacial(pid);
}

// ─── "Origem Noturna" (Elfo Noturno): escolhe um Caminho (subclasse) de
// outra Classe e rola 1d10 na hora — o resultado decide, pelo índice (1ª a
// 10ª Habilidade cadastrada daquele Caminho), qual Habilidade aleatória o
// personagem recebe de graça. Diferente da Origem Sangrenta (que trava a
// Classe inteira e deixa o jogador escolher a Habilidade específica), aqui
// só o Caminho escolhido fica travado pra sempre — as outras Subclasses da
// mesma Classe continuam livres — e a Habilidade em si é sorteada, não
// escolhida. Passo 1: escolhe a Classe; Passo 2: escolhe o Caminho, o que já
// dispara a rolagem e a concessão automaticamente (sem passo 3 manual).
function abrirOrigemNoturnaModal(pid) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;
  if (p.origemNoturnaUsada) { alert('Origem Noturna já foi usada por este personagem.'); return; }

  const classesElegiveis = CLASSES.filter(c => c.name !== p.classeBase);
  const opcoesHtml = classesElegiveis.map(c => `<button class="tm-opcao tm-opcao-blue" onclick="abrirOrigemNoturnaSubModal(${p.id},'${c.name}')">
    <span class="tm-opcao-nome">${escHtml(c.name)}</span>
  </button>`).join('');

  overlay.innerHTML = `
    <div class="modal" style="max-width:400px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-moon"></i> Origem Noturna</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px;line-height:1.5">
        Escolha de qual Classe você vai sortear uma Habilidade aleatória de um Caminho. Depois disso, esse Caminho fica travado pra sempre.
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:320px;overflow-y:auto">${opcoesHtml}</div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="fecharCriacaoAnaoModal()">Cancelar</button>
    </div>`;
  overlay.classList.add('open');
}

function abrirOrigemNoturnaSubModal(pid, className) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  const classeObj = CLASSES.find(c => c.name === className);
  if (!overlay || !p || !classeObj) return;

  const opcoesHtml = classeObj.subs.map(sub => `<button class="tm-opcao tm-opcao-blue" onclick="event.stopPropagation();confirmarOrigemNoturna(${p.id},'${className}','${sub.name}')">
    <span class="tm-opcao-nome">${escHtml(sub.name)}</span>
  </button>`).join('');

  overlay.innerHTML = `
    <div class="modal" style="max-width:400px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-moon"></i> Origem Noturna — ${escHtml(className)}</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px;line-height:1.5">
        Escolha o Caminho. Ao confirmar, um 1d10 decide na hora qual Habilidade aleatória daquele Caminho você recebe — e ele fica travado pra sempre.
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">${opcoesHtml}</div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="abrirOrigemNoturnaModal(${p.id})">Voltar</button>
    </div>`;
  overlay.classList.add('open');
}

function confirmarOrigemNoturna(pid, className, subNome) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p || p.origemNoturnaUsada) return;
  const itensSub = BANCO_HABILIDADES_SUBCLASSE[subNome] || [];
  if (!itensSub.length) { alert('Esse Caminho ainda não tem Habilidades cadastradas.'); return; }

  fecharCriacaoAnaoModal();

  const sides = 10;
  const d1 = 1 + Math.floor(Math.random() * sides);

  const entry = {
    playerName: currentUser.name || (IS_NARRADOR ? 'Narrador' : 'Jogador'),
    charName: p.name,
    isNarrator: !!IS_NARRADOR,
    formula: `Origem Noturna — ${subNome} (1d10)`,
    tree: { type: 'sum', terms: [{ sign: '+', node: { type: 'dice', sides, count: 1, results: [d1], sum: d1, countNode: null } }] },
    total: d1,
    hidden: hiddenPadrao(p),
    rolling: true,
    ts: Date.now()
  };

  spinDiceFab(true, sides);
  pushRollEntry(entry, key => {
    setTimeout(() => finishRollEntry(key), ROLL_ANIM_MS);
    setTimeout(() => spinDiceFab(false), ROLL_ANIM_MS);
  });
  if (!dicePanelOpen) toggleDicePanel();
  else if (dicePanelTab !== 'feed') switchDiceTab('feed');

  setTimeout(() => {
    // O 1d10 corresponde à posição da Habilidade cadastrada nesse Caminho
    // (1ª, 2ª... 10ª). Cada Caminho tem exatamente 10 Habilidades — mesmo
    // total usado como limite do Banco de Habilidades normal (ver
    // getBancoLimites) — então o valor sempre cai numa posição válida; o
    // clamp abaixo é só uma proteção extra caso algum Caminho ainda não
    // tenha as 10 cadastradas.
    const idx = Math.min(d1, itensSub.length) - 1;
    const item = itensSub[idx];

    if (!Array.isArray(p.skills)) p.skills = [];
    const sk = construirSkillDoBanco(item);
    sk.origemNoturna = true; // não conta na cota da Aprendizagem Élfica nem no Banco normal
    p.skills.push(sk);

    p.origemNoturnaSubBloqueada = subNome;
    p.origemNoturnaUsada = true;

    saveState();
    renderAll();
    alert(`Origem Noturna: tirou ${d1} no 1d10 — ${p.name} recebeu "${item.name}" (${subNome}). Esse Caminho fica travado pra sempre.`);
    abrirProximoSeletorRacial(pid);
  }, ROLL_ANIM_MS + 150);
}

function abrirDecrepticoModal(pid) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;
  const testesIntel = TESTES_LISTA.filter(t => t.attr === 'intel');

  const opcoesHtml = testesIntel.map(t => {
    const is1 = p.decrepticoTeste1 === t.id;
    const is3 = p.decrepticoTeste2 === t.id;
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg3)">
      <span style="flex:1;font-size:13px;color:var(--text)">${escHtml(t.name)}</span>
      <button class="btn" style="font-size:11px;padding:4px 10px;${is1 ? 'background:var(--accent);color:#fff' : ''}" onclick="event.stopPropagation();escolherDecreptico(${p.id},'${t.id}','um')">+1</button>
      <button class="btn" style="font-size:11px;padding:4px 10px;${is3 ? 'background:var(--accent);color:#fff' : ''}" onclick="event.stopPropagation();escolherDecreptico(${p.id},'${t.id}','tres')">+3</button>
    </div>`;
  }).join('');

  overlay.innerHTML = `
    <div class="modal" style="max-width:400px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-brain"></i> Decréptico</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px;line-height:1.5">
        Escolha 2 Testes de Intelecto: um recebe +1 de Vantagem, o outro +3.
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">${opcoesHtml}</div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="fecharCriacaoAnaoModal();abrirProximoSeletorRacial(${p.id})">Fechar</button>
    </div>`;
  overlay.classList.add('open');
}

function escolherDecreptico(pid, testeId, papel) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  if (papel === 'um') {
    if (p.decrepticoTeste2 === testeId) p.decrepticoTeste2 = null;
    p.decrepticoTeste1 = testeId;
  } else {
    if (p.decrepticoTeste1 === testeId) p.decrepticoTeste1 = null;
    p.decrepticoTeste2 = testeId;
  }
  saveState();
  renderAll();
  abrirDecrepticoModal(pid);
}

// "Brutão" (Tauren): escolhe 1 Teste de Força e 1 Teste de Agilidade. A
// escolha apenas PRÉ-MARCA a Mega Vantagem (Força) e a Mega Desvantagem
// (Agilidade) por padrão — os botões MV/MD continuam destravados, o jogador
// pode desligar manualmente quando a situação não se aplicar.
function abrirBrutaoModal(pid) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;
  const testesForca = TESTES_LISTA.filter(t => t.attr === 'forca');
  const testesAgi = TESTES_LISTA.filter(t => t.attr === 'agi');

  const opcoesForca = testesForca.map(t => {
    const atual = p.brutaoTesteForca === t.id;
    return `<button class="tm-opcao tm-opcao-blue" onclick="escolherBrutaoForca(${p.id},'${t.id}')">
      <span class="tm-opcao-nome">${escHtml(t.name)}</span>
      ${atual ? `<span class="tm-opcao-info">Mega Vantagem</span>` : ''}
    </button>`;
  }).join('');

  const opcoesAgi = testesAgi.map(t => {
    const atual = p.brutaoTesteAgilidade === t.id;
    return `<button class="tm-opcao tm-opcao-blue" onclick="escolherBrutaoAgilidade(${p.id},'${t.id}')">
      <span class="tm-opcao-nome">${escHtml(t.name)}</span>
      ${atual ? `<span class="tm-opcao-info">Mega Desvantagem</span>` : ''}
    </button>`;
  }).join('');

  overlay.innerHTML = `
    <div class="modal" style="max-width:400px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-bone"></i> Brutão — ${escHtml(p.name)}</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px;line-height:1.5">
        Escolha um Teste de Força para receber Mega Vantagem por padrão, e um Teste de Agilidade para receber Mega Desvantagem por padrão (os botões continuam liberados pra desligar manualmente quando não se aplicar).
      </div>
      <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Força · Mega Vantagem</div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">${opcoesForca}</div>
      <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Agilidade · Mega Desvantagem</div>
      <div style="display:flex;flex-direction:column;gap:6px">${opcoesAgi}</div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="fecharCriacaoAnaoModal();abrirProximoSeletorRacial(${p.id})">Fechar</button>
    </div>`;
  overlay.classList.add('open');
}

function escolherBrutaoForca(pid, testeId) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  getTestePersonagem(p);
  const anterior = p.brutaoTesteForca;
  if (anterior && anterior !== testeId && p.testes[anterior]) p.testes[anterior].mv = false;
  p.brutaoTesteForca = testeId;
  if (p.testes[testeId]) { p.testes[testeId].mv = true; p.testes[testeId].md = false; }
  saveState();
  renderAll();
  abrirBrutaoModal(pid);
}

function escolherBrutaoAgilidade(pid, testeId) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  getTestePersonagem(p);
  const anterior = p.brutaoTesteAgilidade;
  if (anterior && anterior !== testeId && p.testes[anterior]) p.testes[anterior].md = false;
  p.brutaoTesteAgilidade = testeId;
  if (p.testes[testeId]) { p.testes[testeId].md = true; p.testes[testeId].mv = false; }
  saveState();
  renderAll();
  abrirBrutaoModal(pid);
}


// ─── "Origem de Vento Bravo" (Humano): a cada Nível, escolhe 1 Teste de
// Agilidade + 1 de Força + 1 de Intelecto pra receber +2 de Vantagem cada.
// Diferente da Decréptico (escolha única, feita uma vez), essa cresce junto
// com o personagem — sobe de Nível, ganha 3 escolhas novas — por isso o
// modal fica sempre acessível (sem "trava" de uso único) e mostra uma
// seção por Nível já alcançado. Um mesmo Teste pode acumular no máximo 2
// escolhas (+4 no total), mesmo vindas de Níveis diferentes.
const VENTO_BRAVO_TIPOS = [
  { tipo: 'agi',    label: 'Agilidade' },
  { tipo: 'forca',  label: 'Força' },
  { tipo: 'intel',  label: 'Intelecto' },
];

// Verdadeiro se ainda sobrar algum slot vazio (Nível 1 até o Nível atual,
// um por tipo) — usado tanto pra reabrir o modal automaticamente quanto,
// futuramente, por qualquer outro ponto que precise checar pendência.
function ventoBravoTemPendencia(p) {
  if (p.origemId !== 'humano_origem_vento_bravo') return false;
  const nivel = Math.max(1, Math.min(5, p.level || 1));
  const escolhas = p.ventoBravoEscolhas || [];
  for (let n = 1; n <= nivel; n++) {
    for (const vt of VENTO_BRAVO_TIPOS) {
      if (!escolhas.some(e => e.nivel === n && e.tipo === vt.tipo)) return true;
    }
  }
  return false;
}

// +2 por escolha que aponta pro Teste, capado em 2 escolhas (+4 no máximo).
function getVentoBravoBonus(p, testeId) {
  if (p.origemId !== 'humano_origem_vento_bravo') return 0;
  const count = (p.ventoBravoEscolhas || []).filter(e => e.testeId === testeId).length;
  return Math.min(count, 2) * 2;
}

function abrirVentoBravoModal(pid) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  if (!Array.isArray(p.ventoBravoEscolhas)) p.ventoBravoEscolhas = [];
  renderVentoBravoModal(pid);
  document.getElementById('modal-criacao-anao-overlay').classList.add('open');
}

function renderVentoBravoModal(pid) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;
  const nivel = Math.max(1, Math.min(5, p.level || 1));
  if (!Array.isArray(p.ventoBravoEscolhas)) p.ventoBravoEscolhas = [];

  let niveisHtml = '';
  for (let n = 1; n <= nivel; n++) {
    const slotsHtml = VENTO_BRAVO_TIPOS.map(vt => {
      const entry = p.ventoBravoEscolhas.find(e => e.nivel === n && e.tipo === vt.tipo);
      const teste = entry ? TESTES_LISTA.find(t => t.id === entry.testeId) : null;
      return `<button class="tm-opcao tm-opcao-blue" style="width:100%;text-align:left" onclick="event.stopPropagation();abrirVentoBravoEscolhaModal(${p.id},${n},'${vt.tipo}')">
        <span class="tm-opcao-nome">${vt.label}</span>
        <span class="tm-opcao-info">${teste ? `✓ ${escHtml(teste.name)} (+2)` : 'Escolher…'}</span>
      </button>`;
    }).join('');
    niveisHtml += `<div style="margin-bottom:10px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Nível ${n}</div>
      <div style="display:flex;flex-direction:column;gap:6px">${slotsHtml}</div>
    </div>`;
  }

  overlay.innerHTML = `
    <div class="modal" style="max-width:420px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-wind"></i> Origem de Vento Bravo</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px;line-height:1.5">
        A cada Nível, escolha 1 Teste de Agilidade + 1 de Força + 1 de Intelecto pra receber +2 de Vantagem. Um mesmo Teste pode acumular até 2 escolhas (+4 no máximo). Seus Testes nunca têm Mega Vantagem.
      </div>
      <div style="max-height:400px;overflow-y:auto">${niveisHtml}</div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="fecharCriacaoAnaoModal()">Fechar</button>
    </div>`;
}

function abrirVentoBravoEscolhaModal(pid, nivel, tipo) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;
  if (!Array.isArray(p.ventoBravoEscolhas)) p.ventoBravoEscolhas = [];

  const testesTipo = TESTES_LISTA.filter(t => t.attr === tipo);
  const atual = p.ventoBravoEscolhas.find(e => e.nivel === nivel && e.tipo === tipo);
  const tipoLabel = (VENTO_BRAVO_TIPOS.find(vt => vt.tipo === tipo) || {}).label || tipo;

  const opcoesHtml = testesTipo.map(t => {
    const contagem = p.ventoBravoEscolhas.filter(e => e.testeId === t.id).length;
    const jaNesseSlot = !!(atual && atual.testeId === t.id);
    const bloqueado = !jaNesseSlot && contagem >= 2;
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg3)">
      <span style="flex:1;font-size:13px;color:var(--text)">${escHtml(t.name)}${contagem > 0 ? ` <span style="opacity:.6;font-size:11px">(${contagem}/2)</span>` : ''}</span>
      <button class="btn" style="font-size:11px;padding:4px 10px;${jaNesseSlot ? 'background:var(--accent);color:#fff' : ''}" ${bloqueado ? 'disabled' : ''} onclick="event.stopPropagation();escolherVentoBravo(${p.id},${nivel},'${tipo}','${t.id}')">${jaNesseSlot ? '✓ Escolhido' : (bloqueado ? '🔒 Limite (2/2)' : 'Escolher')}</button>
    </div>`;
  }).join('');

  overlay.innerHTML = `
    <div class="modal" style="max-width:400px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-wind"></i> Vento Bravo — Nível ${nivel} · ${tipoLabel}</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px;line-height:1.5">
        Escolha o Teste de ${tipoLabel} que recebe +2 de Vantagem neste Nível.
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">${opcoesHtml}</div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="event.stopPropagation();abrirVentoBravoModal(${p.id})">Voltar</button>
    </div>`;
}

function escolherVentoBravo(pid, nivel, tipo, testeId) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  if (!Array.isArray(p.ventoBravoEscolhas)) p.ventoBravoEscolhas = [];

  const atual = p.ventoBravoEscolhas.find(e => e.nivel === nivel && e.tipo === tipo);
  if (!(atual && atual.testeId === testeId)) {
    const contagem = p.ventoBravoEscolhas.filter(e => e.testeId === testeId).length;
    if (contagem >= 2) { alert('Esse Teste já atingiu o limite de 2 escolhas (+4 no máximo).'); return; }
  }
  if (atual) atual.testeId = testeId;
  else p.ventoBravoEscolhas.push({ nivel, tipo, testeId });

  saveState();
  renderAll();
  abrirVentoBravoEscolhaModal(pid, nivel, tipo);
}

// ─── "Encantamento Troll" (Troll): a cada Nível, escolhe 1 Habilidade da
// sua Classe (vinda do Banco de Habilidades — ver p.skills com bancoId) e a
// "encanta": os dados de lançamento dela são trocados por um Teste de Arcano
// OU Místico. O app ainda não tem o sistema de lançamento de Habilidades
// implementado (ver comentário do pedido), então isso aqui só guarda a
// escolha e mostra uma badge "🔮 Encantada" no card da Habilidade — não
// altera nenhum cálculo de rolagem ainda.
// Verdadeiro se ainda sobrar algum slot vazio (Nível 1 até o Nível atual).
function trollEncantamentoTemPendencia(p) {
  if (!(p.passivas || []).some(pas => pas.racialId === 'troll_encantamento_troll')) return false;
  // NPC não tem Nível — considera liberados todos os 5 slots (nível máximo
  // relevante do sistema), em vez de travar pelo Nível atual.
  const nivel = p.isNPC ? 5 : Math.max(1, Math.min(5, p.level || 1));
  const escolhas = p.encantamentoTrollEscolhas || [];
  for (let n = 1; n <= nivel; n++) {
    if (!escolhas.some(e => e.nivel === n)) return true;
  }
  return false;
}

// Habilidades "da Classe" pra escolher: só as que vieram do Banco de
// Habilidades (têm bancoId) — exclui Habilidades Gerais (sk_geral_...),
// Raciais (sk_racial_...) e outras fontes que não são "da sua Classe".
function getHabilidadesClasseParaEncantar(p) {
  return (p.skills || []).filter(sk => !!sk.bancoId);
}

// "Colosso" (Origem, Troll): os Encantamentos de Troll (ver
// encantamentoTrollEscolhas acima) ficam amaldiçoados — toda vez que a
// Habilidade encantada for usada, escolhe entre 1d6 de Dano na Vida OU 1d6
// de Insanidade. Só se aplica a quem tem essa Origem específica (não afeta
// quem tem "Comum" ou nenhuma Origem).
function skillEhEncantamentoTroll(p, sk) {
  return (p.encantamentoTrollEscolhas || []).some(e => e.skillId === sk.id);
}
function skillEhEncantamentoTrollAmaldicoado(p, sk) {
  if (p.origemId !== 'troll_origem_colosso') return false;
  return skillEhEncantamentoTroll(p, sk);
}

function abrirEncantamentoAmaldicoadoModal(pid, skillId, skillName) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  if (!overlay) return;
  overlay.innerHTML = `
    <div class="modal" style="max-width:380px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-alert-triangle"></i> Encantamento Amaldiçoado</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:12px;line-height:1.5">
        "${escHtml(skillName)}" está encantada e amaldiçoada (Colosso) — escolha o que recebe 1d6:
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="tm-opcao tm-opcao-blue" onclick="event.stopPropagation();resolverEncantamentoAmaldicoado(${pid},'dano','${skillId}')">
          <span class="tm-opcao-nome">🩸 1d6 de Dano na Vida</span>
        </button>
        <button class="tm-opcao tm-opcao-blue" onclick="event.stopPropagation();resolverEncantamentoAmaldicoado(${pid},'insanidade','${skillId}')">
          <span class="tm-opcao-nome">🌀 1d6 de Insanidade</span>
        </button>
      </div>
    </div>`;
  overlay.classList.add('open');
}

function resolverEncantamentoAmaldicoado(pid, tipo, skillId) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  const sk = p.skills.find(s => s.id === skillId);
  fecharCriacaoAnaoModal();

  const sides = 6;
  const d1 = 1 + Math.floor(Math.random() * sides);

  const entry = {
    playerName: currentUser.name || (IS_NARRADOR ? 'Narrador' : 'Jogador'),
    charName: p.name,
    isNarrator: !!IS_NARRADOR,
    formula: `Encantamento Amaldiçoado — ${tipo === 'dano' ? 'Dano' : 'Insanidade'} (1d6)${sk ? ' · ' + sk.name : ''}`,
    tree: { type: 'sum', terms: [{ sign: '+', node: { type: 'dice', sides, count: 1, results: [d1], sum: d1, countNode: null } }] },
    total: d1,
    hidden: hiddenPadrao(p),
    rolling: true,
    ts: Date.now()
  };

  spinDiceFab(true, sides);
  pushRollEntry(entry, key => {
    setTimeout(() => finishRollEntry(key), ROLL_ANIM_MS);
    setTimeout(() => spinDiceFab(false), ROLL_ANIM_MS);
  });
  if (!dicePanelOpen) toggleDicePanel();
  else if (dicePanelTab !== 'feed') switchDiceTab('feed');

  setTimeout(() => {
    if (tipo === 'dano') adjHP(p.id, -d1);
    else adjIns(p.id, d1);
  }, ROLL_ANIM_MS + 150);
}

function abrirEncantamentoTrollModal(pid) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  if (!Array.isArray(p.encantamentoTrollEscolhas)) p.encantamentoTrollEscolhas = [];
  renderEncantamentoTrollModal(pid);
  document.getElementById('modal-criacao-anao-overlay').classList.add('open');
}

function renderEncantamentoTrollModal(pid) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;
  const nivel = p.isNPC ? 5 : Math.max(1, Math.min(5, p.level || 1));
  if (!Array.isArray(p.encantamentoTrollEscolhas)) p.encantamentoTrollEscolhas = [];

  let niveisHtml = '';
  for (let n = 1; n <= nivel; n++) {
    const entry = p.encantamentoTrollEscolhas.find(e => e.nivel === n);
    const sk = entry ? (p.skills || []).find(s => s.id === entry.skillId) : null;
    niveisHtml += `<button class="tm-opcao tm-opcao-blue" style="width:100%;text-align:left;margin-bottom:6px" onclick="event.stopPropagation();abrirEncantamentoTrollEscolhaModal(${p.id},${n})">
      <span class="tm-opcao-nome">Nível ${n}</span>
      <span class="tm-opcao-info">${sk ? `✓ ${escHtml(sk.name)}` : 'Escolher…'}</span>
    </button>`;
  }

  overlay.innerHTML = `
    <div class="modal" style="max-width:420px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-sparkles"></i> Encantamento Troll</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px;line-height:1.5">
        A cada Nível, escolha 1 Habilidade da sua Classe pra encantar: os dados de lançamento dela são trocados por um Teste de Arcano OU Místico.
      </div>
      <div style="max-height:360px;overflow-y:auto">${niveisHtml}</div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="fecharCriacaoAnaoModal()">Fechar</button>
    </div>`;
}

function abrirEncantamentoTrollEscolhaModal(pid, nivel) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;
  if (!Array.isArray(p.encantamentoTrollEscolhas)) p.encantamentoTrollEscolhas = [];

  const habilidades = getHabilidadesClasseParaEncantar(p);
  const atual = p.encantamentoTrollEscolhas.find(e => e.nivel === nivel);

  const opcoesHtml = habilidades.length ? habilidades.map(sk => {
    const jaEncantadaNoutroNivel = p.encantamentoTrollEscolhas.some(e => e.nivel !== nivel && e.skillId === sk.id);
    const selecionada = !!(atual && atual.skillId === sk.id);
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg3)">
      <span style="flex:1;font-size:13px;color:var(--text)">${escHtml(sk.name)}</span>
      <button class="btn" style="font-size:11px;padding:4px 10px;${selecionada ? 'background:var(--accent);color:#fff' : ''}" ${jaEncantadaNoutroNivel ? 'disabled' : ''} onclick="event.stopPropagation();escolherEncantamentoTroll(${p.id},${nivel},'${sk.id}')">${selecionada ? '✓ Escolhida' : (jaEncantadaNoutroNivel ? '🔒 Já encantada' : 'Escolher')}</button>
    </div>`;
  }).join('') : `<div style="font-size:12.5px;color:var(--text3)">Nenhuma Habilidade da Classe disponível ainda — adicione Habilidades no Banco primeiro.</div>`;

  overlay.innerHTML = `
    <div class="modal" style="max-width:400px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-sparkles"></i> Encantamento Troll — Nível ${nivel}</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px;line-height:1.5">
        Escolha a Habilidade da Classe que fica encantada (Arcano OU Místico) neste Nível.
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">${opcoesHtml}</div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="event.stopPropagation();abrirEncantamentoTrollModal(${p.id})">Voltar</button>
    </div>`;
}

function escolherEncantamentoTroll(pid, nivel, skillId) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  if (!Array.isArray(p.encantamentoTrollEscolhas)) p.encantamentoTrollEscolhas = [];

  const jaEncantadaNoutroNivel = p.encantamentoTrollEscolhas.some(e => e.nivel !== nivel && e.skillId === skillId);
  if (jaEncantadaNoutroNivel) { alert('Essa Habilidade já está encantada em outro Nível.'); return; }

  const atual = p.encantamentoTrollEscolhas.find(e => e.nivel === nivel);
  if (atual) atual.skillId = skillId;
  else p.encantamentoTrollEscolhas.push({ nivel, skillId });

  saveState();
  renderAll();
  abrirEncantamentoTrollEscolhaModal(pid, nivel);
}

// ─── "Comum" (Origem, Troll): troca os dados (maestria) de um único Teste
// entre Arcano OU Místico por outro Teste (nunca Emoção, Iniciativa ou
// Devoção). Se não trocar nada, Arcano e Místico recebem +1 de Vantagem
// fixo cada — ver mst/terms em construirRolagemTeste. Diferente das outras
// origens, tem um padrão seguro (o +1) então não força popup na criação,
// só fica disponível pelo botão "Configurar Troca" no card da passiva.
const ORIGEM_COMUM_TESTES_EXCLUIDOS = ['emocao', 'iniciativa', 'devocao'];

function abrirOrigemComumModal(pid) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;

  const areaAtual = p.origemComumTrocaArea || null;
  const opcoesArea = ['arcano', 'mistico'].map(area => {
    const def = TESTES_LISTA.find(t => t.id === area);
    const testeTrocado = areaAtual === area ? TESTES_LISTA.find(t => t.id === p.origemComumTrocaTesteId) : null;
    return `<button class="tm-opcao tm-opcao-blue" onclick="event.stopPropagation();abrirOrigemComumEscolhaModal(${p.id},'${area}')">
      <span class="tm-opcao-nome">${escHtml(def.name)}</span>
      ${testeTrocado ? `<span class="tm-opcao-info">→ ${escHtml(testeTrocado.name)}</span>` : ''}
    </button>`;
  }).join('');

  overlay.innerHTML = `
    <div class="modal" style="max-width:400px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-flask"></i> Comum</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px;line-height:1.5">
        Escolha trocar os dados de Arcano OU Místico por outro Teste — ou não trocar nada e receber +1 de Vantagem fixo nos dois.
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px">${opcoesArea}</div>
      <button class="tm-opcao tm-opcao-blue" style="${!areaAtual ? 'background:var(--accent);color:#fff' : ''}" onclick="event.stopPropagation();limparOrigemComumTroca(${p.id})">
        <span class="tm-opcao-nome">Não trocar nada</span>
        <span class="tm-opcao-info">+1 Vantagem em Arcano e Místico</span>
      </button>
      <button class="tm-cancelar" style="margin-top:10px" onclick="fecharCriacaoAnaoModal()">Fechar</button>
    </div>`;
  overlay.classList.add('open');
}

function abrirOrigemComumEscolhaModal(pid, area) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;
  const areaDef = TESTES_LISTA.find(t => t.id === area);
  const testesDisponiveis = TESTES_LISTA.filter(t => !ORIGEM_COMUM_TESTES_EXCLUIDOS.includes(t.id) && t.id !== area);

  const opcoesHtml = testesDisponiveis.map(t => {
    const atual = p.origemComumTrocaArea === area && p.origemComumTrocaTesteId === t.id;
    return `<button class="tm-opcao tm-opcao-blue" onclick="escolherOrigemComumTroca(${p.id},'${area}','${t.id}')">
      <span class="tm-opcao-nome">${escHtml(t.name)}</span>
      ${atual ? `<span class="tm-opcao-info">atual</span>` : ''}
    </button>`;
  }).join('');

  overlay.innerHTML = `
    <div class="modal" style="max-width:400px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-flask"></i> Comum — trocar ${escHtml(areaDef.name)}</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px;line-height:1.5">
        Escolha por qual Teste os dados de ${escHtml(areaDef.name)} passam a rolar (maestria do Teste escolhido no lugar da de Intelecto).
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:320px;overflow-y:auto">${opcoesHtml}</div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="event.stopPropagation();abrirOrigemComumModal(${p.id})">Voltar</button>
    </div>`;
}

function escolherOrigemComumTroca(pid, area, testeId) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  p.origemComumTrocaArea = area;
  p.origemComumTrocaTesteId = testeId;
  p.origemComumTrocaConfigurada = true;
  saveState();
  renderAll();
  fecharCriacaoAnaoModal();
  abrirProximoSeletorRacial(pid);
}

function limparOrigemComumTroca(pid) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  p.origemComumTrocaArea = null;
  p.origemComumTrocaTesteId = null;
  p.origemComumTrocaConfigurada = true;
  saveState();
  renderAll();
  fecharCriacaoAnaoModal();
  abrirProximoSeletorRacial(pid);
}

// ─── "Origem de Kalindor" (Humano): a cada Nível, escolhe 1 Teste pra
// receber +1d4 de Vantagem e outro Teste (diferente) pra receber −1d4 de
// Desvantagem. Não vale para Emoção, Iniciativa nem Devoção. Diferente da
// Vento Bravo (que permite até 2 escolhas no mesmo Teste), aqui um Teste só
// pode ser afetado 1 vez no total — seja como alvo do bônus ou da penalidade,
// nunca os dois. É dado rolado (1d4), não bônus fixo.
const KALINDOR_PAPEIS = [
  { papel: 'bonus',      label: 'Vantagem (+1d4)' },
  { papel: 'penalidade', label: 'Desvantagem (−1d4)' },
];
const KALINDOR_TESTES_EXCLUIDOS = ['emocao', 'iniciativa', 'devocao'];

// Verdadeiro se ainda sobrar algum slot vazio (Nível 1 até o Nível atual,
// um Vantagem + um Desvantagem por Nível).
function kalindorTemPendencia(p) {
  if (p.origemId !== 'humano_origem_kalindor') return false;
  const nivel = Math.max(1, Math.min(5, p.level || 1));
  const escolhas = p.kalindorEscolhas || [];
  for (let n = 1; n <= nivel; n++) {
    for (const kp of KALINDOR_PAPEIS) {
      if (!escolhas.some(e => e.nivel === n && e.papel === kp.papel)) return true;
    }
  }
  return false;
}

// Retorna 'bonus', 'penalidade' ou null — cada Teste só pode ter 1 papel no total.
function getKalindorPapel(p, testeId) {
  if (p.origemId !== 'humano_origem_kalindor') return null;
  const entry = (p.kalindorEscolhas || []).find(e => e.testeId === testeId);
  return entry ? entry.papel : null;
}

function abrirKalindorModal(pid) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  if (!Array.isArray(p.kalindorEscolhas)) p.kalindorEscolhas = [];
  renderKalindorModal(pid);
  document.getElementById('modal-criacao-anao-overlay').classList.add('open');
}

function renderKalindorModal(pid) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;
  const nivel = Math.max(1, Math.min(5, p.level || 1));
  if (!Array.isArray(p.kalindorEscolhas)) p.kalindorEscolhas = [];

  let niveisHtml = '';
  for (let n = 1; n <= nivel; n++) {
    const slotsHtml = KALINDOR_PAPEIS.map(kp => {
      const entry = p.kalindorEscolhas.find(e => e.nivel === n && e.papel === kp.papel);
      const teste = entry ? TESTES_LISTA.find(t => t.id === entry.testeId) : null;
      return `<button class="tm-opcao tm-opcao-blue" style="width:100%;text-align:left" onclick="event.stopPropagation();abrirKalindorEscolhaModal(${p.id},${n},'${kp.papel}')">
        <span class="tm-opcao-nome">${kp.label}</span>
        <span class="tm-opcao-info">${teste ? `✓ ${escHtml(teste.name)}` : 'Escolher…'}</span>
      </button>`;
    }).join('');
    niveisHtml += `<div style="margin-bottom:10px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Nível ${n}</div>
      <div style="display:flex;flex-direction:column;gap:6px">${slotsHtml}</div>
    </div>`;
  }

  overlay.innerHTML = `
    <div class="modal" style="max-width:420px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-anchor"></i> Origem de Kalindor</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px;line-height:1.5">
        A cada Nível, escolha 1 Teste pra receber +1d4 de Vantagem e outro (diferente) pra receber −1d4 de Desvantagem. Um Teste só pode ser afetado 1 vez no total — nunca vale pra Emoção, Iniciativa ou Devoção.
      </div>
      <div style="max-height:400px;overflow-y:auto">${niveisHtml}</div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="fecharCriacaoAnaoModal()">Fechar</button>
    </div>`;
}

function abrirKalindorEscolhaModal(pid, nivel, papel) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;
  if (!Array.isArray(p.kalindorEscolhas)) p.kalindorEscolhas = [];

  const testesElegiveis = TESTES_LISTA.filter(t => !KALINDOR_TESTES_EXCLUIDOS.includes(t.id));
  const atual = p.kalindorEscolhas.find(e => e.nivel === nivel && e.papel === papel);
  const papelLabel = (KALINDOR_PAPEIS.find(kp => kp.papel === papel) || {}).label || papel;

  const opcoesHtml = testesElegiveis.map(t => {
    const usadoEm = p.kalindorEscolhas.find(e => e.testeId === t.id);
    const jaNesseSlot = !!(atual && atual.testeId === t.id);
    const bloqueado = !jaNesseSlot && !!usadoEm;
    const usadoLabel = usadoEm && !jaNesseSlot
      ? ` <span style="opacity:.6;font-size:11px">(já é ${usadoEm.papel === 'bonus' ? 'Vantagem' : 'Desvantagem'})</span>`
      : '';
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg3)">
      <span style="flex:1;font-size:13px;color:var(--text)">${escHtml(t.name)}${usadoLabel}</span>
      <button class="btn" style="font-size:11px;padding:4px 10px;${jaNesseSlot ? 'background:var(--accent);color:#fff' : ''}" ${bloqueado ? 'disabled' : ''} onclick="event.stopPropagation();escolherKalindor(${p.id},${nivel},'${papel}','${t.id}')">${jaNesseSlot ? '✓ Escolhido' : (bloqueado ? '🔒 Já usado' : 'Escolher')}</button>
    </div>`;
  }).join('');

  overlay.innerHTML = `
    <div class="modal" style="max-width:400px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-anchor"></i> Kalindor — Nível ${nivel} · ${papelLabel}</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px;line-height:1.5">
        Escolha o Teste que recebe ${papel === 'bonus' ? '+1d4 de Vantagem' : '−1d4 de Desvantagem'} neste Nível.
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">${opcoesHtml}</div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="event.stopPropagation();abrirKalindorModal(${p.id})">Voltar</button>
    </div>`;
}

function escolherKalindor(pid, nivel, papel, testeId) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  if (!Array.isArray(p.kalindorEscolhas)) p.kalindorEscolhas = [];

  const atual = p.kalindorEscolhas.find(e => e.nivel === nivel && e.papel === papel);
  if (!(atual && atual.testeId === testeId)) {
    const jaUsado = p.kalindorEscolhas.some(e => e.testeId === testeId);
    if (jaUsado) { alert('Esse Teste já foi escolhido em outro slot — só pode ser afetado 1 vez no total.'); return; }
  }
  if (atual) atual.testeId = testeId;
  else p.kalindorEscolhas.push({ nivel, papel, testeId });

  saveState();
  renderAll();
  abrirKalindorEscolhaModal(pid, nivel, papel);
}

// ─── "Origem Mag'har" (Orc): escolha única (feita uma vez, não repete por
// Nível) de qual Teste — Arcano ou Místico — fica marcado pela Origem. A
// escolha em si é permanente, mas a Mega Desvantagem que ela concede é só
// um valor PADRÃO pré-marcado no toggle normal do Teste — o botão MD
// continua destravado, o jogador pode desligar quando não se aplicar.
function abrirMagharModal(pid) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;
  if (p.magharTesteMD) { alert('Origem Mag\'har já foi definida para este personagem.'); return; }

  overlay.innerHTML = `
    <div class="modal" style="max-width:400px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-paw"></i> Origem Mag'har</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px;line-height:1.5">
        Escolha qual Teste recebe a marca da Origem Mag'har (Mega Desvantagem por padrão — pode ser desligada manualmente depois).
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="tm-opcao tm-opcao-blue" onclick="event.stopPropagation();confirmarMagharMD(${p.id},'arcano')">
          <span class="tm-opcao-nome">Arcano</span>
        </button>
        <button class="tm-opcao tm-opcao-blue" onclick="event.stopPropagation();confirmarMagharMD(${p.id},'mistico')">
          <span class="tm-opcao-nome">Místico</span>
        </button>
      </div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="fecharCriacaoAnaoModal()">Cancelar</button>
    </div>`;
  overlay.classList.add('open');
}

function confirmarMagharMD(pid, testeId) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p || p.magharTesteMD) return;
  getTestePersonagem(p);
  p.magharTesteMD = testeId;
  // Só PRÉ-MARCA a Mega Desvantagem por padrão — o botão MD continua
  // destravado, pode ser desligado manualmente quando não se aplicar.
  if (p.testes[testeId]) { p.testes[testeId].md = true; p.testes[testeId].mv = false; }
  fecharCriacaoAnaoModal();
  saveState();
  renderAll();
  abrirProximoSeletorRacial(pid);
}

// ─── "Origem Mag'har" (Orc), parte 2: a cada Nível, escolhe 1 Habilidade
// própria pra marcar com +1d4 de Dano/Cura (e +2 de Vantagem também, se for
// do tipo Golpe). Uma Habilidade só pode ser escolhida 1 vez no total.
// O +2 de Vantagem já entra sozinho na rolagem de Acerto (ver
// construirRolagemAcertoHabilidade). O +1d4 de Dano/Cura continua manual —
// ainda não existe rolagem de Dano automática pra Habilidades.
function getMagharHabBonus(p, skillId) {
  if (p.origemId !== 'orc_origem_maghar') return null;
  const entry = (p.magharHabilidadeEscolhas || []).find(e => e.skillId === skillId);
  return entry ? true : null;
}

// Verdadeiro se ainda sobrar algum Nível (1 até o atual) sem Habilidade escolhida.
function magharHabTemPendencia(p) {
  if (p.origemId !== 'orc_origem_maghar') return false;
  if (!(p.skills || []).length) return false; // nada pra escolher ainda
  const nivel = Math.max(1, Math.min(5, p.level || 1));
  const escolhas = p.magharHabilidadeEscolhas || [];
  for (let n = 1; n <= nivel; n++) {
    if (!escolhas.some(e => e.nivel === n)) return true;
  }
  return false;
}

// ─── "Filosofia Pandarênica" (Pandaren, Origem Comum): ao chegar no Nível 3,
// escolhe (uma vez, pra sempre) um tipo de Habilidade — Feitiço (blue),
// Golpe (red) ou Técnica (green) — e todas as Habilidades desse tipo
// recebem +3 de Vantagem. O bônus já entra sozinho na rolagem de Acerto
// (ver construirRolagemAcertoHabilidade); o badge na Habilidade continua
// como lembrete visual.
function abrirFilosofiaPandarenicaModal(pid) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;
  if (p.filosofiaPandarenicaCor) { alert('Filosofia Pandarênica já foi definida para este personagem.'); return; }

  overlay.innerHTML = `
    <div class="modal" style="max-width:400px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-sparkles"></i> Filosofia Pandarênica</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px;line-height:1.5">
        Escolha um tipo de Habilidade. Todas as Habilidades desse tipo passam a ter +3 de Vantagem, pra sempre.
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="tm-opcao tm-opcao-blue" onclick="event.stopPropagation();confirmarFilosofiaPandarenica(${p.id},'blue')">
          <span class="tm-opcao-nome">Feitiço</span>
        </button>
        <button class="tm-opcao tm-opcao-red" onclick="event.stopPropagation();confirmarFilosofiaPandarenica(${p.id},'red')">
          <span class="tm-opcao-nome">Golpe</span>
        </button>
        <button class="tm-opcao tm-opcao-green" onclick="event.stopPropagation();confirmarFilosofiaPandarenica(${p.id},'green')">
          <span class="tm-opcao-nome">Técnica</span>
        </button>
      </div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="fecharCriacaoAnaoModal()">Cancelar</button>
    </div>`;
  overlay.classList.add('open');
}

function confirmarFilosofiaPandarenica(pid, cor) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p || p.filosofiaPandarenicaCor) return;
  p.filosofiaPandarenicaCor = cor;
  fecharCriacaoAnaoModal();
  saveState();
  renderAll();
}

// Retorna true se a Habilidade `sk` recebe o +3 de Vantagem da Filosofia
// Pandarênica (mesma cor escolhida pelo personagem).
function getFilosofiaPandarenicaBonus(p, sk) {
  return !!(p.filosofiaPandarenicaCor && p.filosofiaPandarenicaCor === sk.color);
}

function abrirMagharHabModal(pid) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  if (!Array.isArray(p.magharHabilidadeEscolhas)) p.magharHabilidadeEscolhas = [];
  renderMagharHabModal(pid);
  document.getElementById('modal-criacao-anao-overlay').classList.add('open');
}

function renderMagharHabModal(pid) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;
  const nivel = Math.max(1, Math.min(5, p.level || 1));
  if (!Array.isArray(p.magharHabilidadeEscolhas)) p.magharHabilidadeEscolhas = [];

  let niveisHtml = '';
  for (let n = 1; n <= nivel; n++) {
    const entry = p.magharHabilidadeEscolhas.find(e => e.nivel === n);
    const sk = entry ? (p.skills || []).find(s => s.id === entry.skillId) : null;
    niveisHtml += `<button class="tm-opcao tm-opcao-blue" style="width:100%;text-align:left;margin-bottom:6px" onclick="event.stopPropagation();abrirMagharHabEscolhaModal(${p.id},${n})">
      <span class="tm-opcao-nome">Nível ${n}</span>
      <span class="tm-opcao-info">${sk ? `✓ ${escHtml(sk.name)}` : 'Escolher…'}</span>
    </button>`;
  }

  overlay.innerHTML = `
    <div class="modal" style="max-width:420px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-paw"></i> Origem Mag'har — Habilidades</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px;line-height:1.5">
        A cada Nível, escolha 1 Habilidade pra marcar com +1d4 de Dano/Cura (e +2 de Vantagem também, se for Golpe). Uma Habilidade só pode ser escolhida 1 vez no total.
        <br><em style="color:var(--text3)">O bônus ainda é aplicado manualmente na hora de usar — isso aqui só marca qual Habilidade tem direito a ele.</em>
      </div>
      <div style="max-height:400px;overflow-y:auto">${niveisHtml}</div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="fecharCriacaoAnaoModal()">Fechar</button>
    </div>`;
}

function abrirMagharHabEscolhaModal(pid, nivel) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;
  if (!Array.isArray(p.magharHabilidadeEscolhas)) p.magharHabilidadeEscolhas = [];

  const atual = p.magharHabilidadeEscolhas.find(e => e.nivel === nivel);
  const skills = p.skills || [];

  const opcoesHtml = skills.length ? skills.map(sk => {
    const usadoEm = p.magharHabilidadeEscolhas.find(e => e.skillId === sk.id);
    const jaNesseSlot = !!(atual && atual.skillId === sk.id);
    const bloqueado = !jaNesseSlot && !!usadoEm;
    const golpeTag = sk.color === 'red' ? ' <span style="opacity:.6;font-size:11px">(Golpe — também +2 Vantagem)</span>' : '';
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg3)">
      <span style="flex:1;font-size:13px;color:var(--text)">${escHtml(sk.name)}${golpeTag}</span>
      <button class="btn" style="font-size:11px;padding:4px 10px;${jaNesseSlot ? 'background:var(--accent);color:#fff' : ''}" ${bloqueado ? 'disabled' : ''} onclick="event.stopPropagation();escolherMagharHab(${p.id},${nivel},'${sk.id}')">${jaNesseSlot ? '✓ Escolhido' : (bloqueado ? '🔒 Já usada' : 'Escolher')}</button>
    </div>`;
  }).join('') : `<div style="font-size:12px;color:var(--text3);padding:10px 0">Este personagem ainda não tem Habilidades cadastradas.</div>`;

  overlay.innerHTML = `
    <div class="modal" style="max-width:400px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-paw"></i> Mag'har — Nível ${nivel}</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px;line-height:1.5">
        Escolha a Habilidade que recebe +1d4 de Dano/Cura neste Nível.
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">${opcoesHtml}</div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="event.stopPropagation();abrirMagharHabModal(${p.id})">Voltar</button>
    </div>`;
}

function escolherMagharHab(pid, nivel, skillId) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  if (!Array.isArray(p.magharHabilidadeEscolhas)) p.magharHabilidadeEscolhas = [];

  const atual = p.magharHabilidadeEscolhas.find(e => e.nivel === nivel);
  if (!(atual && atual.skillId === skillId)) {
    const jaUsado = p.magharHabilidadeEscolhas.some(e => e.skillId === skillId);
    if (jaUsado) { alert('Essa Habilidade já foi escolhida em outro Nível — só pode ser usada 1 vez no total.'); return; }
  }
  if (atual) atual.skillId = skillId;
  else p.magharHabilidadeEscolhas.push({ nivel, skillId });

  saveState();
  renderAll();
  abrirMagharHabEscolhaModal(pid, nivel);
}

function abrirOrigemComumAnaoDouradoModal(pid) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;
  const elegiveis = (p.inventario || []).filter(i => (i.tipo === 'arma' || i.tipo === 'instrumento') && !temAprimoDourado(i));
  if (!elegiveis.length) { alert('Esse personagem não tem nenhuma arma/instrumento elegível (todas já têm um Aprimoramento Dourado).'); return; }

  const opcoesHtml = elegiveis.map(i => `<button class="tm-opcao tm-opcao-blue" onclick="abrirOrigemComumDouradoModal(${p.id},'${i.id}')">
    <span class="tm-opcao-nome">${escHtml(i.name)}</span>
  </button>`).join('');

  overlay.innerHTML = `
    <div class="modal" style="max-width:400px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-dice"></i> Origem Comum</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px;line-height:1.5">
        Escolha a arma/instrumento que recebe o Aprimoramento Dourado gratuito.
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:300px;overflow-y:auto">${opcoesHtml}</div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="fecharCriacaoAnaoModal()">Cancelar</button>
    </div>`;
  overlay.classList.add('open');
}

function abrirOrigemComumDouradoModal(pid, itemId) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  const item = p && (p.inventario || []).find(i => i.id === itemId);
  if (!overlay || !item) return;

  const opcoesHtml = APRIMORAMENTOS_DOURADO.map(a => `<button class="tm-opcao tm-opcao-blue" onclick="event.stopPropagation();concederDouradoOrigemComum(${p.id},'${itemId}','${a.id}')" style="display:flex;flex-direction:column;align-items:flex-start;gap:2px">
    <span class="tm-opcao-nome">✨ ${escHtml(a.name)}</span>
    <span style="font-size:11px;color:var(--text2);font-weight:400;line-height:1.4;text-align:left">${escHtml(a.desc)}</span>
  </button>`).join('');

  overlay.innerHTML = `
    <div class="modal" style="max-width:420px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-sparkles"></i> Aprimoramento Dourado Gratuito</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px;line-height:1.5">
        Escolha o Aprimoramento Dourado pra ${escHtml(item.name)} (sem custo em Dinheiro).
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:300px;overflow-y:auto">${opcoesHtml}</div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="fecharCriacaoAnaoModal()">Cancelar</button>
    </div>`;
  overlay.classList.add('open');
}

function concederDouradoOrigemComum(pid, itemId, catalogId) {
  const p = PLAYERS.find(x => x.id === pid);
  const item = p && (p.inventario || []).find(i => i.id === itemId);
  const cat = APRIMORAMENTOS_DOURADO.find(a => a.id === catalogId);
  if (!item || !cat) return;
  if (!Array.isArray(item.aprimoramentos)) item.aprimoramentos = [];
  // Regra: cada arma só pode ter 1 Aprimoramento Dourado — a única exceção é
  // uma arma fundida pela Criação de Anão (item.fusaoAnao), que acumula os
  // Dourados combinados das 2 armas originais.
  if (!item.fusaoAnao && temAprimoDourado(item)) {
    const ok = confirm(`"${item.name}" já tem um Aprimoramento Dourado. Escolher um novo substitui o atual. Continuar?`);
    if (!ok) return;
    item.aprimoramentos = item.aprimoramentos.filter(a => !(a.dourado || a.name === 'Dourado'));
  }
  item.aprimoramentos.push({ catalogId: cat.id, name: cat.name, desc: cat.desc, custo: 0, dourado: true });
  fecharCriacaoAnaoModal();
  saveState();
  renderAll();
}

// ─── "Origem das Profundezas" (passiva de origem racial, Anão) ────────────
// Ao subir de Nível, escolhe uma arma/instrumento (por NOME — vale pra
// qualquer cópia que o personagem possua desse mesmo nome) e concede +1 de
// Dano acumulado (p.origemProfundezasBonus[nome]). Pode repetir a mesma arma
// em Níveis diferentes, empilhando o bônus.
function abrirOrigemProfundezasModal(pid) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;
  const nomes = [...new Set((p.inventario || []).filter(i => i.tipo === 'arma' || i.tipo === 'instrumento').map(i => i.name))];
  if (!nomes.length) { alert('Esse personagem não tem nenhuma arma/instrumento.'); return; }

  const opcoesHtml = nomes.map(nome => {
    const atual = (p.origemProfundezasBonus && p.origemProfundezasBonus[nome]) || 0;
    return `<button class="tm-opcao tm-opcao-blue" onclick="escolherOrigemProfundezas(${p.id},'${escHtml(nome).replace(/'/g, "\\'")}')">
      <span class="tm-opcao-nome">${escHtml(nome)}</span>
      ${atual > 0 ? `<span class="tm-opcao-info">já tem +${atual}</span>` : ''}
    </button>`;
  }).join('');

  overlay.innerHTML = `
    <div class="modal" style="max-width:400px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-sword"></i> Origem das Profundezas</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px;line-height:1.5">
        Escolha a arma/instrumento que ganha +1 de Dano (vale pra todas as cópias com esse nome — pode repetir a mesma arma em Níveis diferentes).
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:300px;overflow-y:auto">${opcoesHtml}</div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="fecharCriacaoAnaoModal()">Cancelar</button>
    </div>`;
  overlay.classList.add('open');
}

function escolherOrigemProfundezas(pid, nome) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  if (!p.origemProfundezasBonus || typeof p.origemProfundezasBonus !== 'object') p.origemProfundezasBonus = {};
  p.origemProfundezasBonus[nome] = (p.origemProfundezasBonus[nome] || 0) + 1;
  p.origemProfundezasPendente = false;
  fecharCriacaoAnaoModal();
  saveState();
  renderAll();
  abrirProximoSeletorRacial(pid);
}

function confirmarCriacaoAnao(pid) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  if (p.criacaoAnaoUsada) { fecharCriacaoAnaoModal(); return; }
  const checks = Array.from(document.querySelectorAll('.criacao-anao-check:checked'));
  if (checks.length !== 2) { alert('Escolha exatamente 2 armas/instrumentos.'); return; }
  if ((p.dinheiro || 0) < 500) { alert(`Dinheiro insuficiente! A fusão custa 500 de Dinheiro, e ${p.name} só tem ${p.dinheiro || 0}.`); return; }

  const ids = checks.map(c => c.value);
  const itens = ids.map(id => (p.inventario || []).find(i => i.id === id)).filter(Boolean);
  if (itens.length !== 2) { fecharCriacaoAnaoModal(); return; }

  const dourados = itens.map(i => i.aprimoramentos.find(a => a.dourado || a.name === 'Dourado')).filter(Boolean);
  // Herda os "Usos" (Usar) das 2 armas originais, clonados com as cargas
  // cheias (usosAtuais = usosMax) — a arma fundida acumula os dois.
  const usosHerdados = itens.flatMap(i => Array.isArray(i.usos)
    ? JSON.parse(JSON.stringify(i.usos)).map(u => ({ ...u, usosAtuais: u.usosMax || 1 }))
    : []);
  // Peso da arma fundida = o maior peso entre as 2 armas originais.
  const ORDEM_PESO = { leve: 1, encantada: 2, media: 3, exotica: 4, pesada: 5, mega: 6 };
  const pesoFundido = (ORDEM_PESO[itens[0].peso] || 0) >= (ORDEM_PESO[itens[1].peso] || 0) ? itens[0].peso : itens[1].peso;
  p.inventario = (p.inventario || []).filter(i => !ids.includes(i.id));
  p.dinheiro = Math.max(0, (p.dinheiro || 0) - 500);

  const novoId = 'inv_fusao_anao_' + Date.now();
  p.inventario.push({
    id: novoId, tipo: 'arma', name: `Fusão de ${itens[0].name} + ${itens[1].name}`,
    peso: pesoFundido, dano: itens[0].dano || itens[1].dano || '1d6', alcance: itens[0].alcance || 'curto',
    preco: 0, equipado: false,
    efeito: 'Arma fundida pela Criação de Anão. Só o dono sabe como usá-la — ajuste os detalhes abaixo.',
    aprimoramentos: dourados,
    usos: usosHerdados,
    fusaoAnao: true, // única exceção que pode ter mais de 1 Aprimoramento Dourado
  });
  p.criacaoAnaoUsada = true;
  fecharCriacaoAnaoModal();
  saveState();
  renderAll();
  alert(`Fusão concluída! A nova arma carrega os 2 Aprimoramentos Dourados combinados. Para ajustar nome/dano, edite pelo lápis — mas evite mexer na seção de Aprimoramentos lá, já que ela foi feita pra 1 escolha só e substituiria os 2 Dourados fundidos por apenas 1.`);
}

function escolherFeiticoGrimorio(pid, itemId, skillId) {
  fecharGrimorioModal();
  const p = PLAYERS.find(x => x.id === pid);
  const item = p && (p.inventario || []).find(i => i.id === itemId);
  if (!item) return;
  item.feiticoEscolhidoId = skillId;
  saveState();
  renderAll();
}

// ─── Modal de escolha de Nota — "Tocar Instrumento" (todo Instrumento Musical) ──
// Toda arma do tipo Instrumento tem 1 "Usar" que concede uma Nota Musical à
// escolha do jogador (ver uso marcado com concedeNotaEscolhida). Diferente
// das Habilidades com concedeNota:'qualquer' (que só mostram uma tag e
// dependem do jogador ir marcar a nota manualmente), aqui a escolha e a
// concessão acontecem juntas, no ato de usar.
function abrirNotaInstrumentoModal(pid, itemId, usoIdx) {
  const overlay = document.getElementById('modal-nota-instrumento-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p) return;
  const opcoesHtml = NOTAS_MUSICAIS.map(n =>
    `<button class="nota-btn" onclick="escolherNotaInstrumento(${p.id},'${itemId}',${usoIdx},'${n}')">${n}</button>`
  ).join('');
  overlay.innerHTML = `
    <div class="modal" style="max-width:360px">
      <h3><i class="ti ti-music"></i> Tocar Instrumento — ${escHtml(p.name)}</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:14px;line-height:1.5">
        Escolha qual Nota Musical você recebe.
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">${opcoesHtml}</div>
      <button class="tm-cancelar" style="margin-top:14px" onclick="fecharNotaInstrumentoModal()">Cancelar</button>
    </div>`;
  overlay.classList.add('open');
}

function fecharNotaInstrumentoModal() {
  const overlay = document.getElementById('modal-nota-instrumento-overlay');
  if (overlay) { overlay.classList.remove('open'); overlay.innerHTML = ''; }
}

function escolherNotaInstrumento(pid, itemId, usoIdx, nota) {
  fecharNotaInstrumentoModal();
  const p = PLAYERS.find(x => x.id === pid);
  const item = p && (p.inventario || []).find(i => i.id === itemId);
  const uso = item && item.usos && item.usos[usoIdx];
  if (!uso || uso.usosAtuais <= 0 || !NOTAS_MUSICAIS.includes(nota)) return;
  if (!p.notasBardo || typeof p.notasBardo !== 'object') {
    p.notasBardo = {};
    NOTAS_MUSICAIS.forEach(n => { p.notasBardo[n] = false; });
  }
  p.notasBardo[nota] = true;
  uso.usosAtuais -= 1;
  if (uso.umPorTurno) uso.ultimoTurnoUsado = turnGlobal;
  saveState();
  renderAll();
}

// Compra de volta 1 uso ("Runa") de um "Usar (Nx)" da arma, pagando o custo
// em Dinheiro definido em u.custoRecarga (ex: Adagas Mágicas — 10 Dinheiro
// por Runa). Diferente de resetArmaUso (reset manual grátis, geralmente de
// uso do Narrador): esta é a recarga "oficial" via economia da campanha, um
// uso de cada vez, e nunca passa do usosMax (a capacidade de Runas da arma).
function comprarUsoArma(pid, itemId, usoIdx) {
  const p = PLAYERS.find(x => x.id === pid);
  const item = p && (p.inventario || []).find(i => i.id === itemId);
  const uso = item && item.usos && item.usos[usoIdx];
  if (!uso || !uso.custoRecarga) return;
  if (uso.usosAtuais >= uso.usosMax) { alert(`"${uso.name}" já está no máximo (${uso.usosMax}).`); return; }
  if ((p.dinheiro || 0) < uso.custoRecarga) { alert(`Dinheiro insuficiente! Recarregar "${uso.name}" custa ${uso.custoRecarga} de Dinheiro, e ${p.name} só tem ${p.dinheiro || 0}.`); return; }
  adjDinheiro(pid, -uso.custoRecarga);
  uso.usosAtuais += 1;
  saveState();
  renderAll();
}

// Restaura manualmente os usos de um "Usar (Nx)" da arma pro máximo.
function resetArmaUso(pid, itemId, usoIdx) {
  const p = PLAYERS.find(x => x.id === pid);
  const item = p && (p.inventario || []).find(i => i.id === itemId);
  const uso = item && item.usos && item.usos[usoIdx];
  if (!uso) return;
  uso.usosAtuais = uso.usosMax;
  if (uso.umPorTurno) uso.ultimoTurnoUsado = null;
  saveState();
  renderAll();
}

// Consome 1 uso de uma "Liberar Vileza" (clique no card) — mesmo mecanismo
// dos "Usos". Não faz nada se já estiver esgotada — use resetAtiva pra restaurar.
function usarAtiva(pid, itemId, ativaIdx) {
  const p = PLAYERS.find(x => x.id === pid);
  const item = p && (p.inventario || []).find(i => i.id === itemId);
  const ativa = item && item.ativas && item.ativas[ativaIdx];
  if (!ativa || (ativa.usosAtuais != null && ativa.usosAtuais <= 0)) return;
  ativa.usosAtuais = (ativa.usosAtuais != null ? ativa.usosAtuais : (ativa.usosMax || 1)) - 1;
  saveState();
  renderAll();
}

// "Usa" um Aprimoramento Exótico de Arma/Instrumento (ver APRIMORAMENTOS_ARMA)
// — diferente dos Usos/Ativas normais, ele não tem contador próprio: cada
// uso consome 1 Cristal do pool compartilhado do personagem (ver adjCristais).
function usarAprimoramentoArma(pid) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  if ((p.cristais || 0) <= 0) { alert('Sem Cristais suficientes.'); return; }
  adjCristais(pid, -1);
}

// Restaura manualmente os usos de uma "Liberar Vileza" pro máximo.
function resetAtiva(pid, itemId, ativaIdx) {
  const p = PLAYERS.find(x => x.id === pid);
  const item = p && (p.inventario || []).find(i => i.id === itemId);
  const ativa = item && item.ativas && item.ativas[ativaIdx];
  if (!ativa) return;
  ativa.usosAtuais = ativa.usosMax || 1;
  saveState();
  renderAll();
}

// ═══════════════════════════════════════
// VIDA DO ITEM — atributo de vida opcional em Armas/Instrumentos frágeis
// ═══════════════════════════════════════
// Alguns itens (ex: Clarinete Encantado) têm um "atributo de vida" próprio,
// separado da Vida do personagem: recebe dano, pode ser curado, e o item se
// considera quebrado ao chegar a 0. Guardado em item.vidaMax/item.vidaAtual
// — ver campo "Vida do Item" no modal de Inventário e o contador em
// renderArmaCard (`vidaBox`).
// delta pode ser um número (+1/-1, clampado entre 0 e vidaMax) ou a string
// 'max' (restaura tudo de uma vez).
function ajustarVidaItem(pid, itemId, delta) {
  const p = PLAYERS.find(x => x.id === pid);
  const item = p && (p.inventario || []).find(i => i.id === itemId);
  if (!item || item.vidaMax == null) return;
  if (delta === 'max') {
    item.vidaAtual = item.vidaMax;
  } else {
    const atual = item.vidaAtual != null ? item.vidaAtual : item.vidaMax;
    item.vidaAtual = Math.max(0, Math.min(item.vidaMax, atual + delta));
  }
  saveState();
  renderAll();
}

// ═══════════════════════════════════════
// APRIMORAMENTOS DE ARMADURA (Leve/Média/Pesada/Exótica — subtipo 'armadura')
// ═══════════════════════════════════════
// Catálogo próprio de Aprimoramentos de Armadura, no mesmo espaço/UI dos
// Aprimoramentos Dourado/Exótico das armas (ver _renderInvAprimos), mas com
// regras específicas de slot e custo:
//  - Armadura Exótica (peso 'exotica'): até 2 Aprimoramentos, custo normal (50 cada).
//  - Armaduras "normais" (Leve/Média/Pesada): até 1 Aprimoramento, custando 5x
//    o valor normal (250) por não serem Exóticas.
// Elmo tem seu próprio catálogo equivalente — ver APRIMORAMENTOS_ELMO, mais abaixo.
const APRIMORAMENTOS_ARMADURA = [
  {
    id: 'mini_escudo', name: 'Mini Escudo', custoBase: 50,
    desc: 'Adicione em seu bracelete um mini escudo que fica escondido. Assim, ao receber um ataque, pode realizar um Aparar com maestria de Agilidade/2, ao invés de maestria de Força.',
  },
  {
    id: 'caixa_de_som', name: 'Caixa de Som', custoBase: 50,
    desc: 'Coloque uma caixa de som no seu peitoral. Assim, ao ser atacado, recebe qualquer Nota (Bardo). Funciona uma vez por turno.',
  },
  {
    id: 'socorro', name: 'Aprimoramento de Socorro', custoBase: 50,
    desc: 'Ao receber um ataque crítico, pode gastar um Cristal Elétrico para reduzir o dano pela metade (arredondando pra cima).',
  },
  {
    id: 'ligeirinho', name: 'Ligeirinho', custoBase: 50,
    desc: 'Suas botas recebem energia mágica: você possui +maestria de Agilidade/2 em Passos, +Vantagem em Acrobacia e é imune a efeitos de Lentidão.',
  },
  {
    id: 'carapaca_antimagia', name: 'Carapaça Antimagia', custoBase: 50,
    desc: 'Sua armadura ganha um atributo secundário chamado "Armadura Anti-Magia", com valor igual à sua maestria de Agilidade/2. Funciona como uma armadura, mas exclusiva contra Feitiços, e se restaura no final da Jornada/Aventura/Campanha. Sua Armadura normal e a Armadura Anti-Magia reduzem dano de Feitiços — a Armadura normal recebe o dano primeiro.',
  },
];

// Quantos Aprimoramentos de Armadura o item pode ter, conforme o peso.
function limiteAprimorosArmadura(peso) {
  return peso === 'exotica' ? 2 : 1;
}

// Custo (em Dinheiro) de 1 Aprimoramento de Armadura, conforme o peso —
// armaduras não-Exóticas custam 5x o valor normal.
function custoAprimoramentoArmadura(peso) {
  const base = 50;
  return peso === 'exotica' ? base : base * 5;
}

// Algum aliado (qualquer personagem da campanha) tem a passiva racial
// "Tecnologia Draenei"? Armaduras/Elmos Comuns (não-Exóticos) só têm acesso
// aos Aprimoramentos de Armadura/Elmo Exóticos se isso for verdade — ver a
// descrição da passiva em RACAS.Draenei.
function algumAliadoTemTecnologiaDraenei() {
  return PLAYERS.some(p => getRacePassivas(p).some(pas => pas.id === 'draenei_tecnologia'));
}

// Algum aliado (qualquer personagem da campanha) tem a passiva de Origem
// "draenei_origem_comum"? Armas/Instrumentos Comuns (não-Exóticos) só têm
// acesso aos Aprimoramentos de Arma/Instrumento Exóticos se isso for
// verdade — passiva diferente da "Tecnologia Draenei" (que é só pra
// Armadura/Elmo) — ver a descrição em RACAS.Draenei.
function algumAliadoTemOrigemComumDraenei() {
  // "Comum" é uma Origem escolhida (RACAS_ORIGENS), guardada em p.origemId —
  // não uma passiva automática de RACAS, então não dá pra usar getRacePassivas aqui.
  return PLAYERS.some(p => p.origemId === 'draenei_origem_comum');
}

// ═══════════════════════════════════════
// APRIMORAMENTOS DE ELMO (Leve/Média/Pesada/Exótico — subtipo 'elmo')
// ═══════════════════════════════════════
// Mesmo esquema dos Aprimoramentos de Armadura (ver acima), catálogo próprio:
//  - Elmo Exótico (peso 'exotica'): até 2 Aprimoramentos, custo normal (50 cada).
//  - Elmos "normais" (Leve/Média/Pesada): até 1 Aprimoramento, custando 5x
//    (250), e só aparecem se algum aliado tiver "Tecnologia Draenei" (mesma
//    trava da Armadura — ver algumAliadoTemTecnologiaDraenei).
//  - Elmo Exótico só aparece no catálogo pra quem tem o Talento Inferior
//    "Equipamento Exótico" (gating já genérico em renderInvCatalogo, por peso).
const APRIMORAMENTOS_ELMO = [
  {
    id: 'defesa', name: 'Aprimoramento de Defesa', custoBase: 50,
    desc: 'Seu elmo possui um mecanismo de defesa: ao falhar em um teste de Desviar ou Aparar, pode gastar 1 Cristal Elétrico para causar 1d6 de dano na cabeça do atacante.',
  },
  {
    id: 'fone', name: 'Aprimoramento de Fone', custoBase: 50,
    desc: 'Seu elmo possui uma pequena caixa de som que toca uma música: gaste 1 Cristal Elétrico para receber qualquer Nota Musical, remover um Tormento Emocional, ou passar automaticamente em um teste de Emoção.',
  },
  {
    id: 'lente', name: 'Aprimoramento de Lente', custoBase: 50,
    desc: 'Seu elmo possui uma lente: +1 de Alcance para ações de longo alcance. Pode gastar 1 Cristal Elétrico para deixar a lente "inteligente", concedendo Mega Vantagem ao mirar na cabeça na sua próxima ação.',
  },
  {
    id: 'sobrevivencia', name: 'Aprimoramento de Sobrevivência', custoBase: 50,
    desc: 'Seu elmo ganha uma máscara de oxigênio: quando quiser, sacrifique 1 Cristal Elétrico para que ela reaja com o meio externo e produza oxigênio puro só para você. Dura uma cena/lua.',
  },
  {
    id: 'mascara_arcana', name: 'Aprimoramento Máscara Arcana', custoBase: 50,
    desc: 'Seu elmo ou chapéu exótico recebe uma máscara arcana: você enxerga no escuro natural e mágico.',
  },
];

// Quantos Aprimoramentos de Elmo o item pode ter, conforme o peso.
function limiteAprimorosElmo(peso) {
  return peso === 'exotica' ? 2 : 1;
}

// Custo (em Dinheiro) de 1 Aprimoramento de Elmo, conforme o peso — elmos
// não-Exóticos custam 5x o valor normal.
function custoAprimoramentoElmo(peso) {
  const base = 50;
  return peso === 'exotica' ? base : base * 5;
}

// ═══════════════════════════════════════
// APRIMORAMENTOS DE ARMA/INSTRUMENTO (Exótico + Comum, via Origem Comum Draenei)
// ═══════════════════════════════════════
// Catálogo próprio de Aprimoramentos de Arma/Instrumento, no mesmo espaço/UI
// do antigo seletor Dourado/Exótico (ver _renderInvAprimos):
//  - Arma/Instrumento Exótico (peso 'exotica'): 1 Aprimoramento, custo normal (50).
//  - Arma/Instrumento Comum (Leve/Média/Pesada/Mega): 1 Aprimoramento, custando
//    5x o valor normal (250), e só disponível se algum aliado tiver a passiva
//    de Origem "draenei_origem_comum" (diferente da "Tecnologia Draenei", que
//    é a trava de Armadura/Elmo — ver algumAliadoTemOrigemComumDraenei).
// "Dourado" (passiva racial do Anão) é uma opção à parte, com catálogo
// próprio — ver APRIMORAMENTOS_DOURADO, mais abaixo.
const APRIMORAMENTOS_ARMA = [
  {
    id: 'combo', name: 'Aprimoramento de Combo', custoBase: 50,
    desc: 'Após usar um Cristal Elétrico da sua arma/instrumento musical, faça um teste de Percepção (10) — no sucesso, pode trocar de arma gratuitamente, Engajar gratuitamente, Correr gratuitamente ou fazer uma Acrobacia gratuitamente.',
  },
  {
    id: 'encantamento', name: 'Aprimoramento de Encantamento', custoBase: 50,
    desc: 'Concede um Feitiço à sua arma ou instrumento musical, que consome 1 Cristal Elétrico para ser lançado. Caso tenha acesso a Feitiços Lendários, deverá sacrificar a arma ou instrumento para lançá-los. No lançamento e no cálculo de dano/cura, o Feitiço usa metade da sua maestria de Agilidade.',
  },
  {
    id: 'fusao', name: 'Aprimoramento de Fusão', custoBase: 50,
    desc: 'Sacrifique uma arma/instrumento musical Exótico e conceda os Cristais Elétricos dele para uma arma/instrumento Comum — só você saberá como usá-la (não pode ter Aprimoramento Dourado).',
  },
  {
    id: 'pente', name: 'Aprimoramento de Pente', custoBase: 50,
    desc: 'Possui +1 de Munição.',
  },
  {
    id: 'ritmo', name: 'Aprimoramento de Ritmo', custoBase: 50,
    desc: 'Ao gastar 1 Cristal Elétrico da sua arma/instrumento musical, receba uma Ação a mais neste turno.',
  },
];

// Quantos Aprimoramentos de Arma/Instrumento o item pode ter — sempre 1,
// seja Exótico ou Comum.
function limiteAprimorosArma(peso) {
  return 1;
}

// Custo (em Dinheiro) de 1 Aprimoramento de Arma/Instrumento, conforme o
// peso — armas/instrumentos comuns custam 5x o valor normal.
function custoAprimoramentoArma(peso) {
  const base = 50;
  return peso === 'exotica' ? base : base * 5;
}

// ═══════════════════════════════════════
// APRIMORAMENTOS DOURADOS (Talento do Anão — "Dourado")
// ═══════════════════════════════════════
// Catálogo próprio, no mesmo espaço/UI do Aprimoramento de Arma/Instrumento
// (ver invAprimoTipo === 'dourado' em _renderInvAprimos). Slot único (1 por
// arma/instrumento) e mutuamente exclusivo com o Aprimoramento Exótico — uma
// arma tem um OU outro, nunca os dois, e nenhum dos dois se aplica a Armas/
// Instrumentos Exóticos (peso 'exotica' vai direto pro próprio catálogo,
// sem seletor — ver _renderInvAprimos). Só aparece se algum aliado da
// campanha tiver a passiva racial "Dourado" (Anão) — ver algumAliadoTemDourado.
const APRIMORAMENTOS_DOURADO = [
  {
    id: 'carregamento_aprimorado', name: 'Carregamento Aprimorado', custoBase: 300,
    desc: 'Doure sua arma que possui Munição: ela não precisa mais ser recarregada, e não pode mais ser quebrada.',
  },
  {
    id: 'encantamento_aprimorado', name: 'Encantamento Aprimorado', custoBase: 300,
    desc: 'Doure sua arma que possui "Usar (Nx)": no final da sessão, recarregue os usos dela, e ela não pode mais ser quebrada.',
  },
  {
    id: 'mira_aprimorada', name: 'Mira Aprimorada', custoBase: 300,
    desc: 'Doure sua arma de Longo Alcance: ela possui +6 de Alcance, e não pode mais ser quebrada.',
  },
  {
    id: 'afiacao_aprimorada', name: 'Afiação Aprimorada', custoBase: 300,
    desc: 'Doure sua arma: ela possui +1d6 de dano, e não pode mais ser quebrada.',
  },
  {
    id: 'arremesso_aprimorado', name: 'Arremesso Aprimorado', custoBase: 300,
    desc: 'Doure sua arma de Corpo a Corpo: ela ganha uma corrente que, ao ser arremessada, retorna à sua mão; +2 de Alcance em Arremesso; e não pode mais ser quebrada.',
  },
];

// Algum aliado (qualquer personagem da campanha) tem a passiva racial
// "Dourado" (Anão)? Sem isso, nenhuma arma/instrumento tem acesso ao
// catálogo de Aprimoramentos Dourados.
function algumAliadoTemDourado() {
  return PLAYERS.some(p => getRacePassivas(p).some(pas => pas.id === 'anao_dourado'));
}


// BANCO DE HABILIDADES DE SUBCLASSE
// ═══════════════════════════════════════
// Diferente de SUBCLASSES_SKILLS (habilidades fixas, injetadas automaticamente),
// este é um catálogo de até 10 Habilidades específicas por subclasse das quais
// o JOGADOR escolhe quais adicionar à própria ficha (via botão "Escolher da
// Subclasse", que abre um catálogo de seleção).
//
// Cada entrada tem um campo "indice" — um número interno reservado para uma
// mecânica futura. Ele NUNCA é exibido na interface (nem pro jogador, nem pro
// narrador): não aparece nos cards de habilidade, no modal de edição, nem em
// tooltips. Ele só viaja junto no objeto salvo (sk.indice) para uso posterior.
//
// Ainda vazio para todas as subclasses — preencher conforme as descrições das
// 10 habilidades de cada uma forem chegando.
const BANCO_HABILIDADES_SUBCLASSE = {
  'Campeão': [
    { indice: 1, id: 'campeao_adaptacao', name: 'Adaptação', color: 'green', cost: 0, tipo: 'luta', usosMax: 1, desc: 'Receba o próximo ataque do oponente como Crítico. Contudo, Habilidades do oponente do mesmo tipo contra você terão Mega Desvantagem pelo resto da Luta.' },
    { indice: 2, id: 'campeao_analise_rapida', name: 'Análise Rápida', color: 'green', cost: 1, tipo: 'turno_N', turnosRecarga: 5, usosMax: 1, desc: 'Faça um Teste de Percepção sobre a situação atual: seu teste tem +1d4 de Vantagem e não pode tirar Erro Crítico.' },
    { indice: 3, id: 'campeao_conclamar', name: 'Conclamar', color: 'green', cost: 2, tipo: 'turno_N', turnosRecarga: 2, usosMax: 1, desc: 'Use o seu Berrante para chamar a atenção de todos ao seu redor. Se estiver em uma Luta, escolha: chamar a atenção de um Alvo, ou reduzir em 2 turnos a recarga de Grito de Guerra ou Motivar.' },
    { indice: 4, id: 'campeao_dose_dupla', name: 'Dose Dupla', color: 'green', cost: 0, tipo: 'turno_N', turnosRecarga: 4, usosMax: 1, desc: 'Sua próxima Ação neste turno é feita em conjunto com um Aliado, custando uma Ação do próximo turno dele.' },
    { indice: 5, id: 'campeao_duelo', name: 'Duelo', color: 'green', cost: 1, tipo: 'luta', usosMax: 1, desc: 'Escolha um Alvo: você terá +1d6 de Vantagem contra ele e -1d6 de Desvantagem contra outros Alvos. As condições só acabam quando alguém perder ou desistir da luta.' },
    { indice: 6, id: 'campeao_folego_extra', name: 'Fôlego Extra', color: 'green', cost: 0, tipo: 'luta', usosMax: 1, desc: 'Receba 1 Ação a mais.' },
    { indice: 7, id: 'campeao_gambiarra_de_alto_nivel', name: 'Gambiarra de Alto Nível', color: 'green', cost: 1, tipo: 'sessao', usosMax: 1, desc: 'Recarregue os "usos" de uma Arma ou as munições de uma Arma.' },
    { indice: 8, id: 'campeao_grito_de_guerra', name: 'Grito de Guerra', color: 'green', cost: 1, tipo: 'turno_N', turnosRecarga: 5, usosMax: 1, desc: 'Dê um grito que concede Mega Vantagem para seus Aliados até o próximo turno; eles não podem Desviar.' },
    { indice: 9, id: 'campeao_honra', name: 'Honra', color: 'green', cost: 1, tipo: 'sessao', usosMax: 1, desc: '"Pelo que você luta?" Ao responder essa pergunta, escolha: restaurar 2d20 de Vida; sua próxima Técnica ou Golpe tem Mega Vantagem; ou retire TODOS os efeitos Negativos que você possui.' },
    { indice: 10, id: 'campeao_motivar', name: 'Motivar', color: 'green', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Faça um discurso para seus Aliados e conceda +1d12 de Vantagem na próxima Ação ou Teste deles.' },
  ],
  'Combatente': [
    { indice: 1, id: 'combatente_aparo_agressivo', name: 'Aparo Agressivo', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 2, usosMax: 1, desc: 'Prepara um Aparo: ao receber um ataque entre 1 e 2 Casas, avance no Alvo causando 4 de Dano. Caso o atacante tenha falhado contra o seu Aparo, cause +1d4 de Dano.' },
    { indice: 2, id: 'combatente_arremesso_imprudente', name: 'Arremesso Imprudente', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 2, usosMax: 1, desc: 'Lance uma Arma no Alvo, que esteja a pelo menos 3 Casas de distância de você, causando o dano dela. Se for a Arma que você está usando, +1d6 de Vantagem; se for uma do seu Inventário, causa +3 de Dano.' },
    { indice: 3, id: 'combatente_ataque_giratorio', name: 'Ataque Giratório', color: 'red', cost: 2, tipo: 'turno_N', turnosRecarga: 1, usosMax: 1, desc: 'Gire seu corpo: todos que estiverem a 1 Casa de você recebem 5 de Dano. Se estiver com 2 Armas equipadas, causa +5 de Dano + dano da 2ª Arma, porém faça um Teste de Resistência — se falhar, recebe Mega Desvantagem em Desviar e Aparar até o próximo turno.' },
    { indice: 4, id: 'combatente_esmagar', name: 'ESMAGAR!!!', color: 'red', cost: 2, tipo: 'turno_N', turnosRecarga: 5, usosMax: 1, desc: 'Dê um PISÃO que acerta (3x3 Casas — você no centro) no chão, causando 3 de Dano em todos. Os atingidos precisam passar em um Teste de Resistência; caso falhem, não poderão se mover até o seu próximo turno.' },
    { indice: 5, id: 'combatente_forca_colossal', name: 'Força Colossal', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Seus músculos se expandem até sangrar, causando 1d10 de Dano na sua Vida. Escolha um: +1d10 de Vantagem no seu próximo Teste de Força; +1d8 de Dano no seu próximo Golpe; +5 de Armadura temporária até o final da luta; ou seu próximo Golpe, neste turno, tem Mega Vantagem.' },
    { indice: 6, id: 'combatente_furia', name: 'Fúria', color: 'red', cost: 0, tipo: 'sessao', usosMax: 1, desc: 'Receba: Imune a efeitos negativos; +1 Ação por turno; só pode lançar Golpes; seus Golpes que recarregam por turnos passam a ter recarga de 1 turno; não pode Desviar nem Aparar; sua Vida não abaixa de 1; e não pode parar de atacar. O efeito de Fúria acaba quando você não acertar 2 Golpes no mesmo turno, ou ao ser curado.' },
    { indice: 7, id: 'combatente_investida_bruta', name: 'Investida Bruta', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Avance loucamente num Alvo que esteja entre 4 e 8 Casas de distância de você, empurrando-o 1d4 Casas. Ele tem -1d8 de Desvantagem no Teste de Resistência ao empurrão; se tirar 8, perde uma Ação no próximo turno dele.' },
    { indice: 8, id: 'combatente_parry', name: 'P.A.R.R.Y', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Prepare um Aparo com sua Arma secundária, que permitirá defender contra Feitiços; se falhar no Aparo, recebe metade do dano. Se tiver sucesso no Aparo, poderá fazer um contra-ataque, caso o Alvo esteja próximo (1~2 Casas).' },
    { indice: 9, id: 'combatente_troca_de_mestre', name: 'Troca de Mestre', color: 'red', cost: 2, tipo: 'sessao', usosMax: 2, desc: 'Dê um ataque que causa 7 de Dano com uma Arma e depois a troque por outra Arma do seu Inventário. Esta, se for possível, faz mais um ataque causando apenas o dano da Arma.' },
    { indice: 10, id: 'combatente_trovoada', name: 'Trovoada', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 5, usosMax: 1, desc: 'Bata em sua Arma secundária e chame a atenção de todos os inimigos da luta. Até o próximo turno, você tem Mega Vantagem em Aparar.' },
  ],
  'Soldado Elementar': [
    { indice: 1, id: 'soldado_elementar_aura_de_fenix', name: 'Aura de Fênix', color: 'blue', cost: 0, tipo: 'sessao', usosMax: 1, desc: 'Receba Asas de Fogo até o final da Luta/Cena e desloque-se 5 Casas para cima. Enquanto estiver voando, receba: +10 de Passos e +1d6 de Vantagem em ataques de longo alcance. (Subir uma Casa consome 2 de Passos.)' },
    { indice: 2, id: 'soldado_elementar_auxilio_elementar', name: 'Auxílio Elementar', color: 'blue', cost: 0, tipo: 'turno_N', turnosRecarga: 4, usosMax: 1, desc: 'Escolha um auxílio, que dura até o início do próximo turno: Ar — não recebe dano de queda; Fogo — os 2 próximos ataques têm +1d6 de Dano; Gelo — você não pode ser empurrado; ou Terra — sua Armadura não é reduzida.' },
    { indice: 3, id: 'soldado_elementar_carapaca_rochosa', name: 'Carapaça Rochosa', color: 'blue', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Restaura apenas 1d6 de Armadura. Se ela já estiver completa, restaura 2d6 de sua Vida.' },
    { indice: 4, id: 'soldado_elementar_corrente_de_vento', name: 'Corrente de Vento', color: 'blue', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Uma corrente de vento traz sua Arma até sua mão. Ela pode percorrer até 12 Casas; caso acerte alguém, causa o dano normal e para, ou causa 1/4 do dano normal (arredonda pra cima) e continua o percurso. (O percurso precisa terminar na sua mão.)' },
    { indice: 5, id: 'soldado_elementar_elementar', name: 'Elementar...', color: 'blue', cost: 0, tipo: 'sessao', usosMax: 2, desc: 'Coloque o Encantamento do Ar, o Flamejante, o Gélido e o Rochoso na sua Arma. A duração deles é a mesma.' },
    { indice: 6, id: 'soldado_elementar_encantamento_do_ar', name: 'Encantamento do Ar', color: 'blue', cost: 1, tipo: 'turno_N', turnosRecarga: 2, usosMax: 1, desc: 'Conceda para sua Arma, até o final do próximo turno, a capacidade de fazer ataques a longa distância (6 Casas). Se já for uma Arma de longo alcance, tem o dobro de distância (12 Casas).' },
    { indice: 7, id: 'soldado_elementar_encantamento_flamejante', name: 'Encantamento Flamejante', color: 'blue', cost: 1, tipo: 'turno_N', turnosRecarga: 2, usosMax: 1, desc: 'Conceda para sua Arma, até o final do próximo turno, Chamas: ao atacar, conceda +1d6 de Dano que atravessa Armadura.' },
    { indice: 8, id: 'soldado_elementar_encantamento_gelido', name: 'Encantamento Gélido', color: 'blue', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Congele sua Arma: no próximo ataque, o Alvo terá -1d8 de Desvantagem para Aparar, e remova a Ação de Movimento dele até o início do seu próximo turno.' },
    { indice: 9, id: 'soldado_elementar_encantamento_rochoso', name: 'Encantamento Rochoso', color: 'blue', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Petrifique sua Arma: ao Aparar com ela, quebre a pedra e cause (1d4)d6 de Dano no atacante. Caso queira (mesmo falhando no Aparo), pode causar (1d2)d6 de Dano. Depois do dano, o encantamento acaba.' },
    { indice: 10, id: 'soldado_elementar_troca_elementar', name: 'Troca Elementar', color: 'blue', cost: 1, tipo: 'turno_N', turnosRecarga: 1, usosMax: 1, desc: 'Concentre-se num Encantamento Elementar: reduza em 1 turno a recarga dele e em 1 Ação o custo de lançamento dele.' },
  ],
  'Mercenário': [
    { indice: 1, id: 'mercenario_aposta', name: 'Aposta', color: 'green', cost: 0, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: '"Qual será o valor do seu próximo Dado?" Escolha entre: Erro Crítico, Erro, Acerto ou Acerto Crítico. Se você acertar, recebe +1d12 de Vantagem na próxima Ação ou Teste. Se errar, recebe -1d8 de Desvantagem na próxima Ação ou Teste.' },
    { indice: 2, id: 'mercenario_ataque_corrosivo', name: 'Ataque Corrosivo', color: 'green', cost: 1, tipo: 'turno_N', turnosRecarga: 4, usosMax: 1, desc: 'Conceda à sua Arma um ácido até o final deste turno: +2d2 de Dano direto na Armadura. Se o resultado dos 2 dados somar 4, o ácido também atinge o Alvo, causando +1d4 de Dano na Vida; se esse resultado também for 4, lance mais +1d4 de Dano direto na Vida. (Pode se repetir infinitamente.)' },
    { indice: 3, id: 'mercenario_contrabando', name: 'Contrabando', color: 'green', cost: 1, tipo: 'sessao', usosMax: 2, desc: 'Troque essa Técnica por outra de algum Aliado (mantendo a recarga dela). Ele deve relançar Contrabando para recuperar sua Técnica de volta. (Quando ele usa, isso não consome a carga do Contrabando.)' },
    { indice: 4, id: 'mercenario_intuicao_mercenaria', name: 'Intuição Mercenária', color: 'green', cost: 1, tipo: 'sessao', usosMax: 1, desc: 'Seu próximo Teste de Percepção é Crítico. Se estiver Furtivo ou Invisível, seus dados bônus também serão Críticos. (Pode ser usado durante um Teste de Percepção; se for fora do seu turno, consome a Ação do próximo turno.)' },
    { indice: 5, id: 'mercenario_investigacao_rapida', name: 'Investigação Rápida', color: 'green', cost: 1, tipo: 'turno_N', turnosRecarga: 5, usosMax: 1, desc: 'Faça um Teste de Percepção sobre alguém. Se você estiver Furtivo ou Invisível, tem +1d6 de Vantagem.' },
    { indice: 6, id: 'mercenario_lancamento_planejado', name: 'Lançamento Planejado', color: 'green', cost: 1, tipo: 'turno_N', turnosRecarga: 2, usosMax: 1, desc: 'Dispare ou arremesse uma Arma leve num Alvo entre 3 e 12 Casas de você. Se houver outro Alvo até 3 Casas próximo dele, caso queira, pode acertá-lo também (pode se repetir infinitamente). O dano é distribuído entre todos os Alvos como você quiser.' },
    { indice: 7, id: 'mercenario_sangue_de_vibora', name: 'Sangue de Víbora', color: 'green', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Conceda à sua Arma um veneno até o final deste turno: +2d4 de Dano que atravessa Armadura. Se algum dos dados tirar 4, o veneno se estende até o próximo ataque. (Pode acontecer infinitamente.)' },
    { indice: 8, id: 'mercenario_sorrateiro', name: 'Sorrateiro', color: 'green', cost: 0, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Se estiver nas sombras, recebe Furtividade sem precisar de Teste. Ao fazer uma Ação, faça um Teste de Furtividade para mantê-la, que fica mais difícil a cada Ação (+1d4 de dificuldade). Se já estiver Furtivo ou Invisível, recebe Mega Vantagem no seu próximo Teste de Furtividade.' },
    { indice: 9, id: 'mercenario_sorte', name: 'Sorte', color: 'green', cost: 0, tipo: 'sessao', usosMax: 10, desc: 'Receba +1 de Vantagem em um Dano seu qualquer. (Pode ser usada fora do turno e junto com outra Habilidade.)' },
    { indice: 10, id: 'mercenario_trapaca', name: 'Trapaça', color: 'green', cost: 0, tipo: 'sessao', usosMax: 3, desc: 'Reduza em 1 Ação o custo de uma Habilidade neste turno, ou receba Mega Vantagem na sua próxima Ação neste turno. Role 1d10: se tirar 2 ou menos, a Trapaça falha (mas ainda é gasta).' },
  ],
  'Briguento': [
    { indice: 1, id: 'briguento_adrenalina_de_bar', name: 'Adrenalina de Bar', color: 'red', cost: 1, tipo: 'sessao', usosMax: 4, desc: 'Ao receber Dano não Crítico, cuspa sangue e ignore o dano. (Pode usar fora do seu turno, mas consome 1 Ação do seu próximo turno.)' },
    { indice: 2, id: 'briguento_briga', name: 'BRIGA!!!', color: 'red', cost: 0, tipo: 'luta', usosMax: 1, desc: 'Independente da Iniciativa, você age primeiro. Pode se mover até 12 Casas e desferir um soco no Alvo, causando 5 de Dano (não pode se mover mais neste turno). Se acertar o soco, todos os Aliados recebem +1 Golpe em seus próximos turnos. Você deve pular o seu próximo turno.' },
    { indice: 3, id: 'briguento_esmaga_ferro', name: 'Esmaga Ferro', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 2, usosMax: 1, desc: 'Dê um soco que causa apenas 3 de Dano na Armadura do Alvo. Pode gastar +1 Ação para causar mais um soco no Alvo que atravessa Armadura, tendo +3 de Dano.' },
    { indice: 4, id: 'briguento_intolerancia_zero', name: 'Intolerância Zero', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 2, usosMax: 1, desc: 'Arremesse uma Arma num Alvo entre 4 e 8 Casas, causando +4 de Dano. Pode gastar +1 Ação para receber +1d10 de Vantagem, +4 de Dano, e recarregar esta Habilidade.' },
    { indice: 5, id: 'briguento_moscou_tomou', name: 'Moscou? Tomou!', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 4, usosMax: 1, desc: 'Jogue algo aleatório (pó, álcool, caco de vidro, etc.) no rosto de um Alvo a 1 Casa: ele não poderá Aparar, terá Mega Desvantagem em Desviar até o início do turno dele, e gastará uma Ação para limpar o rosto. Se você lançar este Golpe enquanto está Furtivo, não gastará Ação de lançamento.' },
    { indice: 6, id: 'briguento_muralha', name: 'Muralha', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Escolha um Aliado que esteja até 3 Casas de você: quando ele receber um ataque, entre na frente e receba o dano em seu lugar. Pode gastar +1 Ação para contra-atacar com uma Habilidade de custo 1 Ação (não consome a Ação do seu próximo turno).' },
    { indice: 7, id: 'briguento_ooo_se_eu_quisesse', name: 'Oooo Se Eu Quisesse', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Arremesse um objeto ou Arma pesada num Alvo, retirando o Movimento dele até o início do seu próximo turno.' },
    { indice: 8, id: 'briguento_punho_colossal', name: 'Punho Colossal', color: 'red', cost: 2, tipo: 'infinite', usosMax: 1, desc: 'Dê um soco no rosto do Alvo causando 8 de Dano; se for Crítico, ele perde uma Ação no próximo turno dele. Se estiver Furtivo ou Invisível, perde a Furtividade, porém tem +20% de chance de Crítico.' },
    { indice: 9, id: 'briguento_resgate_de_vaca', name: 'Resgate de Vaca', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Faça um Teste de Empurrar com Mega Vantagem para levantar objetos ou pessoas pesadas (que andam com você até o início do turno delas). Caso já esteja Furtivo ou Invisível, não perde a Furtividade.' },
    { indice: 10, id: 'briguento_roda_punk', name: 'Roda Punk', color: 'red', cost: 1, tipo: 'sessao', usosMax: 3, desc: 'Entre em estado bruto e receba, neste turno, +1 Golpe para cada oponente na luta, além de Movimento ilimitado. Porém, não pode repetir Golpes no mesmo Alvo. Para cada Golpe falho, o oponente contra-ataca causando 1d4 de Dano na Vida.' },
  ],
  'Ilusionista': [
    { indice: 1, id: 'ilusionista_aura_conectada', name: 'Aura Conectada', color: 'blue', cost: 0, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Você pode ouvir e ver tudo que uma Cópia Mágica sua está fazendo, além de conseguir falar no lugar dela. Troque de lugar com ela (pode usar essa opção fora do turno, mas consome uma Ação do próximo turno), ou sacrifique a Cópia Mágica, fazendo-a explodir numa área de 3x3 Casas, causando 1d8 de Dano em todos.' },
    { indice: 2, id: 'ilusionista_disfarce_perfeito', name: 'Disfarce Perfeito', color: 'blue', cost: 1, tipo: 'turno_N', turnosRecarga: 5, usosMax: 1, desc: 'Transforme-se em uma cópia perfeita de uma pessoa que você já viu. Os outros só poderão identificá-lo se realizarem um Teste da sua área Intelectual, um Teste de Percepção (caso você falhe na interpretação), ou se presenciarem sua transformação. A ilusão dura até você lançar outra Habilidade ou decidir cancelá-la.' },
    { indice: 3, id: 'ilusionista_distracao_colossal', name: 'Distração Colossal', color: 'blue', cost: 2, tipo: 'sessao', usosMax: 1, desc: 'Faça uma ilusão que ocupe até 5x5x5 Casas. Sacrifique todas as suas Ações falsas e todas as Cópias Mágicas: para cada 4 sacrifícios, conceda +1 Ação e +1 Ação de Movimento para um Aliado.' },
    { indice: 4, id: 'ilusionista_espetaculo_ilusorio', name: 'Espetáculo Ilusório', color: 'blue', cost: 0, tipo: 'sessao', usosMax: 3, desc: 'Invoque uma Cópia Mágica e, se quiser, personalize o visual dela. Neste turno, suas Ações falsas concedem os benefícios para todas as suas Ações.' },
    { indice: 5, id: 'ilusionista_espetaculo_realista', name: 'Espetáculo Realista', color: 'blue', cost: 2, tipo: 'sessao', usosMax: 1, desc: 'Invoque uma Cópia Mágica a até 12 Casas. Neste turno, conceda uma Arma mágica de longo alcance ou corpo a corpo, que causa 1d6 de Dano + Maestria de Intelecto, para suas Cópias Mágicas, transformando todas as Ações falsas delas em Ações verdadeiras. Os benefícios ainda são liberados para suas Cópias Mágicas.' },
    { indice: 6, id: 'ilusionista_experiencia_imersiva', name: 'Experiência Imersiva', color: 'blue', cost: 0, tipo: 'turno_N', turnosRecarga: 4, usosMax: 1, desc: 'Receba uma Ação falsa neste turno. Toda vez que realizar uma Ação falsa neste turno, ela causará 1d4 de Dano na Vida do Alvo engajado.' },
    { indice: 7, id: 'ilusionista_invisibilidade', name: 'Invisibilidade', color: 'blue', cost: 1, tipo: 'luta', usosMax: 1, desc: 'Torne-se Invisível: você possui Mega Vantagem nas Ações e no Dano/Cura, e não precisa fazer Teste de Furtividade, a menos que algo mágico te perceba! A invisibilidade acaba quando você toca em alguém. Você pode sacrificar uma Cópia Mágica para manter a invisibilidade, porém é teletransportado para o lugar em que ela estava.' },
    { indice: 8, id: 'ilusionista_invocacao_amplificada', name: 'Invocação Amplificada', color: 'blue', cost: 1, tipo: 'turno_N', turnosRecarga: 1, usosMax: 1, desc: 'Invoque uma Cópia Mágica de um Aliado. Se usar este feitiço numa Cópia Mágica, transforme-a num feixe mágico que vai até um Alvo a até 10 Casas, causando 1d6 de Dano — se a Cópia Mágica gastou a Ação falsa, o dano será 2d6.' },
    { indice: 9, id: 'ilusionista_moldando_a_realidade', name: 'Moldando a Realidade', color: 'blue', cost: 0, tipo: 'sessao', usosMax: 3, desc: 'Cancele o resultado de qualquer dado, tendo que relançá-lo. (Pode ser usada fora do turno.)' },
    { indice: 10, id: 'ilusionista_sombra_da_arma', name: 'Sombra da Arma', color: 'blue', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Escolha uma Arma sua que esteja entre 3 e 12 Casas de distância de você: ela se teletransporta para sua mão, ou troque de lugar com ela. Neste último caso, pode ser usado fora do seu turno, porém consome uma Ação do seu próximo turno.' },
  ],
  'Criador de Runa': [
    { indice: 1, id: 'criador_runa_armadilha_runica', name: 'Armadilha Rúnica', color: 'green', cost: 0, tipo: 'turno_N', turnosRecarga: 4, usosMax: 1, desc: 'Desenhe uma runa translúcida no chão (1x1 Casa) que, quando alguém passa sobre ela ou na frente dela, recebe Silenciamento por 1 turno, perde o Movimento por 1 turno, ou perde a próxima Ação do próximo turno dele. Aumente +1x1 Casas e +1d4 de dificuldade em perceber a runa gastando uma Ação a mais. (Pode atingir mais Alvos se for maior que 1x1 Casas.)' },
    { indice: 2, id: 'criador_runa_encantamento_runico', name: 'Encantamento Rúnico', color: 'green', cost: 1, tipo: 'sessao', usosMax: 3, desc: 'Escreva uma runa temporária em uma Arma: +1d4 de Dano; ao atacar, +2 de Vantagem; ao arremessar ou disparar, +2 de Alcance; ou +1d2 de Dano, +1 de Vantagem ao atacar, e ao arremessar ou disparar, +1 de Alcance. (Só pode conceder uma runa por vez na mesma Arma, e duram até o final da luta.)' },
    { indice: 3, id: 'criador_runa_extensao_de_sobrevivencia', name: 'Extensão de Sobrevivência', color: 'green', cost: 1, tipo: 'sessao', usosMax: 2, desc: 'As runas de sua Armadura se ativam: receba +3 de Armadura até o final da luta; desvie automaticamente do próximo ataque que receber; ou, até o final da luta, ao Desviar, pode se locomover +3 Casas. (Pode ser ativado fora do seu turno, porém gasta uma Ação do próximo turno.)' },
    { indice: 4, id: 'criador_runa_flash_bang', name: 'Flash Bang', color: 'green', cost: 1, tipo: 'turno_N', turnosRecarga: 5, usosMax: 1, desc: 'Quebre uma runa brilhante. Todos que estiverem olhando para você ou para a runa se cegam até o início do turno deles: não podem Desviar, nem Aparar, e possuem Mega Desvantagem para acertar Ações. (A única forma de não ficar cego é com um Teste de Reflexo.)' },
    { indice: 5, id: 'criador_runa_nuvem_enlouquecedora', name: 'Nuvem Enlouquecedora', color: 'green', cost: 1, tipo: 'turno_N', turnosRecarga: 4, usosMax: 1, desc: 'Quebre uma runa etérea, criando uma fumaça de 5x5 Casas: todos que estiverem dentro ficam Furtivos, não podem fazer Teste de Percepção, e têm Mega Desvantagem em Aparar e Desviar. Você e mais um Alvo, se quiser, enxergam dentro da fumaça e não recebem os efeitos negativos dela. Dura até o final do seu próximo turno.' },
    { indice: 6, id: 'criador_runa_pintura_cristalizada', name: 'Pintura Cristalizada', color: 'green', cost: 0, tipo: 'turno_N', turnosRecarga: 1, usosMax: 1, desc: 'Desenhe pequenas runas em suas mãos ou nas de um Alvo, causando apenas 1d4 de Dano na Vida e concedendo +3 de Vantagem no próximo ataque ou arremesso, ou +3 de Vantagem no próximo Aparo. Gaste mais uma Ação para não receber dano.' },
    { indice: 7, id: 'criador_runa_runa_de_singularidade', name: 'Runa de Singularidade', color: 'green', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Desenhe uma runa translúcida no chão (3x3 Casas), ativada quando você quiser (mesmo fora do seu turno, sem consumir Ação): escolha 2 Alvos até 6 Casas de distância para serem puxados até a runa. Se o Alvo percebeu a runa, pode fazer um Teste de Resistência para não ser puxado.' },
    { indice: 8, id: 'criador_runa_runa_espectral', name: 'Runa Espectral', color: 'green', cost: 1, tipo: 'luta', usosMax: 2, desc: 'Arremesse uma runa espectral: ela tem 1 de Vida (não toma dano de queda), possui 10 de Passos, e você enxerga por ela. Quando quiser, ela explode e lança um Flash Bang ou uma Nuvem Enlouquecedora. (Pode ativar fora do turno e não consome Ação do próximo turno.)' },
    { indice: 9, id: 'criador_runa_selamento', name: 'Selamento', color: 'green', cost: 1, tipo: 'luta', usosMax: 1, desc: 'Cancele o lançamento de um feitiço e guarde-o dentro de uma runa até o final do próximo turno. Gaste mais uma Ação para quebrar a runa e relançar o feitiço num Alvo, com os mesmos valores de lançamento e Dano/Cura. (Pode lançar Selamento fora do turno, porém gasta as Ações do seu próximo turno.)' },
    { indice: 10, id: 'criador_runa_visao_alem_da_materia', name: 'Visão Além da Matéria', color: 'green', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Até o início do seu próximo turno, consegue enxergar um fluxo de magia específico (escolha) e é possível ver pessoas invisíveis: o Alvo precisa fazer um Teste de Furtividade contra o seu Teste de Percepção, no qual você tem +1d6 de Vantagem.' },
  ],
  'Feiticeiro de Fogo': [
    { indice: 1, id: 'feiticeiro_fogo_bola_de_fogo', name: 'Bola de Fogo', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 2, usosMax: 1, desc: 'Lance uma bola de fogo (3x3 Casas) num Alvo a até 8 Casas, causando 5 de Dano; a todos próximos, causa apenas 3 de Dano que atravessa Armadura.' },
    { indice: 2, id: 'feiticeiro_fogo_criando_espaco', name: 'Criando Espaço', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Encante sua mão e dê um soco no chão: todos que estiverem até 3 Casas de distância de você são empurrados 1+1d4 Casas e recebem 2 de Dano. Mesmo resistindo ao empurrão, recebem o dano.' },
    { indice: 3, id: 'feiticeiro_fogo_erupcao_dominante', name: 'Erupção Dominante', color: 'red', cost: 1, tipo: 'sessao', usosMax: 4, desc: 'Crie uma bola de magma e lance-a num Alvo, causando 3 de Dano. Ao acertar, crie no chão uma poça de magma (3x3 Casas, com o Alvo no centro) que dura até o final da luta. Quando o Alvo entrar em contato e ficar até o final do turno, recebe apenas 1d6 de Dano direto na Vida.' },
    { indice: 4, id: 'feiticeiro_fogo_fuga_exagerada', name: 'Fuga Exagerada', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Lance um raio rapidamente aos seus pés, empurrando-se 5 Casas na direção que você quiser. Ao Desviar ou Aparar, pode lançar o raio sem consumir Ação.' },
    { indice: 5, id: 'feiticeiro_fogo_ignimpacto', name: 'Ignimpacto', color: 'red', cost: 1, tipo: 'infinite', usosMax: 1, desc: 'Lance uma bola de fogo num Alvo a até 8 Casas, causando 6 de Dano. Gaste a Ação de Movimento para ter +6 de Dano, e/ou gaste mais uma Ação para ter +1d6 de Vantagem.' },
    { indice: 6, id: 'feiticeiro_fogo_inferno', name: 'Inferno', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Escolha um Alvo e esquente a Armadura dele: causa 1d6 de Dano na Vida e ele perde uma Ação no próximo turno dele. OU esquente a Arma dele: causa 1d4 de Dano direto na Vida, e ele não pode lançar Habilidades da Arma ou com ela até o próximo turno dele.' },
    { indice: 7, id: 'feiticeiro_fogo_obliteracao_ignea', name: 'Obliteração Ígnea', color: 'red', cost: 2, tipo: 'sessao', usosMax: 1, desc: 'Crie uma imensa bola de fogo (3x3 Casas) que percorre 12 Casas; ao passar sobre alguém, causa 10 de Dano. Para fazer curva, precisa fazer um Teste de Acrobacia — cada curva aumenta +1d4 de dificuldade no teste. No final do percurso, explode em 5x5 Casas, causando apenas 10 de Dano que atravessa Armadura.' },
    { indice: 8, id: 'feiticeiro_fogo_poder_castigador', name: 'Poder Castigador', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 2, usosMax: 1, desc: 'Encante o seu braço: seus Golpes possuem +20% de chance de Crítico, +2 de Alcance, e +1d4 de Vantagem. Porém, recebe 1d4 de Dano na Vida a cada Golpe usado. Pode cancelar este encantamento quando quiser.' },
    { indice: 9, id: 'feiticeiro_fogo_supressao_magica', name: 'Supressão Mágica', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 5, usosMax: 1, desc: 'Encante sua mão e dê um soco no chão que retira algum efeito negativo (à sua escolha) de todos os seus Aliados, ou remove todas as evocações. O alcance é de 3x3 Casas, com você no centro.' },
    { indice: 10, id: 'feiticeiro_fogo_vinganca_quente', name: 'Vingança Quente', color: 'red', cost: 0, tipo: 'luta', usosMax: 2, desc: 'Ao receber um ataque de longo alcance, devolva ao atacante um Golpe de custo 1 Ação. Só pode ser usado fora do seu turno, e consome a Ação do seu próximo turno.' },
  ],
  'Conjurador': [
    { indice: 1, id: 'conjurador_barreira_magica', name: 'Barreira Mágica', color: 'blue', cost: 1, tipo: 'turno_N', turnosRecarga: 4, usosMax: 1, desc: 'Crie uma barreira em torno de você que ocupa 3x3 Casas, com você no centro, e que te acompanha; possui o dobro da sua Vida. Aliados podem entrar e sair. Ao andar, pode empurrar inimigos com a barreira (seu Teste é da sua área Intelectual); se atingir o Alvo contra uma parede, causa 1d10 de Dano, e a barreira recebe o dobro de Dano de Golpes. Só pode ter uma barreira por vez.' },
    { indice: 2, id: 'conjurador_ceu_conjurado', name: 'Céu Conjurado', color: 'blue', cost: 1, tipo: 'turno_N', turnosRecarga: 4, usosMax: 1, desc: 'Conjure uma essência mágica do céu: escolha, a até 6 Casas, uma área de 3x3 Casas onde, ao passar por ela, o Alvo fica Cego por 1 turno e perde 1 de Passos por 1 turno. Se houver 3 Céus Conjurados no mesmo lugar, também causa 2d8 de Dano na Vida de quem passar pela área, e remove 1 de Passo pelo resto da luta. (Só pode ter 3 Céus Conjurados ao mesmo tempo.)' },
    { indice: 3, id: 'conjurador_coluna_conjurada', name: 'Coluna Conjurada', color: 'blue', cost: 1, tipo: 'turno_N', turnosRecarga: 2, usosMax: 1, desc: 'A até 6 Casas, conjure do chão uma coluna de 3 Casas para alguma direção. Conjurada como ataque, causa 1d8 de Dano e depois quebra; conjurada como defesa, recebe o ataque no seu lugar (consumindo 1 Ação do seu próximo turno); ou, se conjurá-la e mantê-la ativa, concede +1 de Vantagem e Dano/Cura em seus Feitiços. (Cada coluna tem a sua Maestria de Intelecto como Vida.)' },
    { indice: 4, id: 'conjurador_compactacao_magica', name: 'Compactação Mágica', color: 'blue', cost: 1, tipo: 'sessao', usosMax: 3, desc: 'Conjure um orbe (ocupa 1x1 Casa) a até 6 Casas: ele absorve 3 outras conjurações (que não sejam orbes), e os efeitos se somam! O orbe tem o dobro da sua Maestria de Intelecto como Vida; porém, é imune enquanto tiver 3 conjurações não-orbe nele, e consegue se mover 3 Passos no seu turno.' },
    { indice: 5, id: 'conjurador_desconjuracao_intensa', name: 'Desconjuração Intensa', color: 'blue', cost: 1, tipo: 'turno_N', turnosRecarga: 2, usosMax: 1, desc: 'Sacrifique uma conjuração: com essa magia, crie um feixe que causa 1d10 de Dano em um Alvo a até 6 Casas. Se a conjuração surgiu neste turno, o feixe terá Mega Vantagem e pode curar Aliados.' },
    { indice: 6, id: 'conjurador_fenda_conjuradora', name: 'Fenda Conjuradora', color: 'blue', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Conjure a magia presente no ambiente e a concentre em uma Casa a até 3 Casas: ela emana magia devastadora — ao passarem por cima, recebem 1d4 de Dano. Quando você passar, não recebe dano, mas absorve a magia, recarregando este feitiço e concedendo +1d4 de Dano para todas as outras Fendas Conjuradoras pelo resto da luta (acumula infinitamente). (Pode ter 3 fendas ao mesmo tempo.)' },
    { indice: 7, id: 'conjurador_lampejo', name: 'Lampejo', color: 'blue', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Teletransporte-se até 8 Casas para frente (se houver algo no caminho, pare nele). Pode usar este feitiço em uma conjuração ou em um Aliado.' },
    { indice: 8, id: 'conjurador_leitura_surreal', name: 'Leitura Surreal', color: 'blue', cost: 1, tipo: 'sessao', usosMax: 2, desc: 'Escolha um Alvo humanoide: você pode ler a mente dele até o final do próximo turno seu. Todas as Ações dele contra você têm Mega Desvantagem. Ele pode fazer um Teste da sua área Intelectual para perceber que está sendo lido.' },
    { indice: 9, id: 'conjurador_misseis_magicos', name: 'Mísseis Mágicos', color: 'blue', cost: 1, tipo: 'turno_N', turnosRecarga: 1, usosMax: 1, desc: 'Lance 2 projéteis que causam 1d6 de Dano em um ou 2 Alvos entre 3 e 6 Casas de você. Se for em 2 Alvos diferentes, cause +3 de Dano em cada projétil; e para cada conjuração, cause +2 de Dano em cada projétil.' },
    { indice: 10, id: 'conjurador_restricao_de_dominio', name: 'Restrição de Domínio', color: 'blue', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Conjure uma área mágica de 5x5 Casas em torno de você, com você no centro, que te acompanha: nela, sua magia prevalece — todos os outros têm -1d6 de Desvantagem ao tentarem lançar Habilidades mágicas. Quem conseguir lançar alguma Habilidade mágica, sem ser você, recebe 1d8 de Dano na Vida. Dura até o início do seu próximo turno; nesse momento, pode estender gastando +1 Ação. (Pode estender e acumular infinitamente.)' },
  ],
  'Alquimista': [
    { indice: 1, id: 'alquimista_adaptacao_quimica', name: 'Adaptação Química', color: 'green', cost: 1, tipo: 'sessao', usosMax: 3, desc: 'Tome uma poção que te ajuda com: poder enxergar no escuro natural e mágico até o final da luta; retirar todos os efeitos negativos; curar 1d12 de Vida; ou receber Mega Vantagem no seu próximo Teste.',
      efeitoSecundario: { tipo: 'extase', custoHumanidade: 3, libera: 'adrenalina', desc: 'Perca 3 de Humanidade: poderá lançar Adrenalina neste turno, e a poção se adapta à situação, fazendo algo específico a mais (combine com o narrador qual é a ideia dessa adaptação — só é possível ter uma adaptação por vez).' } },
    { indice: 2, id: 'alquimista_amostra_rapida', name: 'Amostra Rápida', color: 'green', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Tome uma poção que concede +1d4 de Vantagem em tudo neste turno, ou +1 Ação de Movimento neste turno.',
      efeitoSecundario: { tipo: 'extase', custoHumanidade: 2, libera: 'adrenalina', desc: 'Perca 2 de Humanidade: poderá lançar Adrenalina neste turno, e a poção concede as 2 opções ao mesmo tempo.' } },
    { indice: 3, id: 'alquimista_ar_contaminado', name: 'Ar Contaminado', color: 'green', cost: 1, tipo: 'turno_N', turnosRecarga: 5, usosMax: 1, desc: 'Lance uma poção com um gás tóxico: ao quebrar, libera o gás, ocupando 5x5 Casas, causando 1d10 de Dano por turno e Cegueira. A cada turno, reduz 2 do 1d10 de Dano, desaparecendo ao chegar a 0.',
      efeitoSecundario: { tipo: 'extase', custoHumanidade: 2, libera: 'adrenalina', desc: 'Perca 2 de Humanidade: poderá lançar Adrenalina neste turno, e você não recebe dano do gás nem fica cego por ele.' } },
    { indice: 4, id: 'alquimista_efeitos_colaterais', name: 'Efeitos Colaterais', color: 'green', cost: 1, tipo: 'turno_N', turnosRecarga: 4, usosMax: 1, desc: 'Crie uma poção e a arremesse: ao acertar algum lugar, cria uma fumaça de 3x3 Casas que remove a Invisibilidade, concede Invisibilidade até o início do próximo turno, causa 1d6 de Dano, ou cura 1d6 de Vida.',
      efeitoSecundario: { tipo: 'extase', custoHumanidade: 2, libera: 'adrenalina', desc: 'Perca 2 de Humanidade: poderá lançar Adrenalina neste turno, e a fumaça também remove metade dos Passos até o início do próximo turno, ou concede o dobro de Passos até o início do próximo turno.' } },
    { indice: 5, id: 'alquimista_fusao_pecadora', name: 'Fusão Pecadora', color: 'green', cost: 2, tipo: 'turno_N', turnosRecarga: 5, usosMax: 1, desc: 'Escolha uma Técnica que envolva poção (mesmo em recarga) e um Êxtase de outra Técnica que envolva poção, e lance-a. Ao invés de gastar os pontos de Humanidade, perca 2 de Passos por cada ponto (recupera no final deste turno; não pode ter se deslocado).',
      efeitoSecundario: { tipo: 'extase', custoHumanidade: 2, libera: 'adrenalina', desc: 'Perca 2 de Humanidade: poderá lançar Adrenalina neste turno, e pode escolher outro Êxtase, que não vai custar Passos (combine com o narrador qual é a ideia da junção).' } },
    { indice: 6, id: 'alquimista_mistureba', name: 'Mistureba', color: 'green', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Prepare uma poção e recarregue-a; porém, jogue também 1d2 para ver a qualidade dela. Se tirar 1, a poção não faz o efeito base — pode apenas ativar o Êxtase dela (a Técnica só volta ao normal depois do uso do Êxtase ou de um Descanso Longo). Se tirar 2, a poção funciona normalmente.',
      efeitoSecundario: { tipo: 'extase', custoHumanidade: 1, libera: 'adrenalina', desc: 'Perca 1 de Humanidade: poderá lançar Adrenalina neste turno, e essa poção recarregada não consome Humanidade.' } },
    { indice: 7, id: 'alquimista_nao_e_uma_boa_ideia', name: 'Não É Uma Boa Ideia', color: 'green', cost: 1, tipo: 'turno_N', turnosRecarga: 1, usosMax: 1, desc: 'Tome uma poção suspeita: surgem 3 orbes, só para você, em lugares aleatórios da cena. Ao passar sobre uma, receba aleatoriamente: Adrenalina neste turno; 1d6 de Dano na Vida; 1d8 de Cura; Cegueira até o final do turno; +1 Ação neste turno; +1 Ação de Movimento; ou não poder se mover neste turno.',
      efeitoSecundario: { tipo: 'extase', custoHumanidade: 3, libera: 'adrenalina', desc: 'Perca 3 de Humanidade: poderá lançar Adrenalina neste turno, e escolher os 3 efeitos (em vez de sortear).' } },
    { indice: 8, id: 'alquimista_overdose', name: 'Overdose', color: 'green', cost: 0, tipo: 'sessao', usosMax: 1, desc: 'Libere seu sistema nervoso para absorver tudo: até o início do seu próximo turno, suas Técnicas têm o Êxtase ativado. Ao fazer uma Técnica, faça um Teste de Resistência para não entrar em coma, ou gaste 1 de Humanidade para se manter lúcido (se falhar no teste, pode gastar 2 de Humanidade).' },
    { indice: 9, id: 'alquimista_pocao_misteriosa', name: 'Poção Misteriosa', color: 'green', cost: 1, tipo: 'turno_N', turnosRecarga: 2, usosMax: 1, desc: 'Crie e tome uma poção, e receba a partir do resultado de 1d4: 1 — seu próximo Êxtase é grátis (não precisa ser desta Técnica); 2 — sua próxima Ação tem +4 de Dano/Cura (não precisa ser na Adrenalina); 3 — receba uma Adrenalina neste turno; ou 4 — receba +1 Ação de Movimento neste turno.',
      efeitoSecundario: { tipo: 'extase', custoHumanidade: 1, libera: 'adrenalina', desc: 'Perca 1 de Humanidade: poderá lançar Adrenalina neste turno, e ao invés de rolar o 1d4, escolha uma opção. Gaste +1 de Humanidade para ter +1 opção (até conseguir as 4 opções).' } },
    { indice: 10, id: 'alquimista_socorro_frenetico', name: 'Socorro Frenético', color: 'green', cost: 2, tipo: 'sessao', usosMax: 2, desc: 'Com um kit médico e uma poção, cure 1d10 de Vida do Alvo, corpo a corpo. Caso ele esteja à beira da morte, em vez de curá-lo, levante-o instantaneamente com metade da Vida, e ele receberá suas Ações normais.',
      efeitoSecundario: { tipo: 'extase', custoHumanidade: 1, libera: 'adrenalina', desc: 'Perca 1 de Humanidade: poderá lançar Adrenalina neste turno, e o Alvo também terá Adrenalina em seu próximo turno.' } },
  ],
  'Receptáculo Demoníaco': [
    { indice: 1, id: 'receptaculo_demoniaco_combustao', name: 'COMBUSTÃO!!!', color: 'red', cost: 1, tipo: 'sessao', usosMax: 1, desc: 'Crie uma arena vil a partir de 2 rastros de chamas vis altas, cada uma percorrendo até 20 Casas: saem da mesma Casa e, no final, devem se encontrar em uma mesma Casa. Você precisa estar dentro da arena! (Pode desativar quando quiser.) As chamas causam 2d6 de Dano e empurram 2 Casas para dentro da arena.',
      efeitoSecundario: { tipo: 'sacrilegio', custoHumanidade: 3, desc: 'Perca 3 de Humanidade: este Golpe custa 1 Ação a menos, e em você as chamas curam.' } },
    { indice: 2, id: 'receptaculo_demoniaco_corrente_vil', name: 'Corrente Vil', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Lance uma corrente vil no Alvo, a até 6 Casas, que dura até o início do seu próximo turno: o Alvo só consegue se afastar até 6 Casas de você, e você pode gastar uma Ação de Movimento por meio de Acrobacia para chegar até ele.',
      efeitoSecundario: { tipo: 'sacrilegio', custoHumanidade: 2, desc: 'Perca 2 de Humanidade: este Golpe custa 1 Ação a menos, e a corrente vil queima, causando apenas 1d10 de Dano na Vida, além de roubar Vida.' } },
    { indice: 3, id: 'receptaculo_demoniaco_garras_invasoras', name: 'Garras Invasoras', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 2, usosMax: 1, desc: 'Dê um ataque com sua Arma num Alvo, atravessando a Armadura dele, ou dê um soco no Alvo que atravessa a Armadura, causando 5 de Dano.',
      efeitoSecundario: { tipo: 'sacrilegio', custoHumanidade: 2, desc: 'Perca 2 de Humanidade: este Golpe custa 1 Ação a menos, e relance este Golpe, sem consumir Ação, com a outra opção.' } },
    { indice: 4, id: 'receptaculo_demoniaco_manobra_explosiva', name: 'Manobra Explosiva', color: 'red', cost: 2, tipo: 'turno_N', turnosRecarga: 2, usosMax: 1, desc: 'Faça um Teste de Acrobacia: se tiver sucesso, avance 5 Casas; se for Erro, avance 3 Casas. Ao se encontrar com alguém no percurso, cause 3 de Dano com sua Arma — ele terá -1 de Desvantagem para cada Casa que você avançou até ele neste Golpe.',
      efeitoSecundario: { tipo: 'sacrilegio', custoHumanidade: 2, desc: 'Perca 2 de Humanidade: este Golpe custa 1 Ação a menos, possui +3 Casas de alcance, e pode acertar outro Alvo.' } },
    { indice: 5, id: 'receptaculo_demoniaco_metamorfose_rapida', name: 'Metamorfose Rápida', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 5, usosMax: 1, desc: 'Ao receber algum Dano na sua Vida, invoque uma pele demoníaca que reduz o dano pela metade (arredondando para cima) até o início do seu próximo turno. (Pode ser usada fora do seu turno, mas consome uma Ação do seu próximo turno.)',
      efeitoSecundario: { tipo: 'sacrilegio', custoHumanidade: 2, desc: 'Perca 2 de Humanidade: este Golpe custa 1 Ação a menos, e até o início do seu próximo turno, ao receber Dano na Vida, você cura apenas 1d6 de Vida.' } },
    { indice: 6, id: 'receptaculo_demoniaco_raio_ocular', name: 'Raio Ocular', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 1, usosMax: 1, desc: 'Seus olhos liberam uma energia vil num Alvo, a até 5 Casas, causando apenas 4 de Dano que atravessa Armadura.',
      efeitoSecundario: { tipo: 'sacrilegio', custoHumanidade: 1, desc: 'Perca 1 de Humanidade: este Golpe custa 1 Ação a menos, e cause +4 de Dano.' } },
    { indice: 7, id: 'receptaculo_demoniaco_ruptura_do_selo', name: 'Ruptura do Selo', color: 'red', cost: 0, tipo: 'sessao', usosMax: 1, desc: 'Liberte o demônio dentro de você até o início do próximo turno e controle-o: seus Golpes têm Sacrilégio ativado. Ao fazer um Golpe, faça um Teste de Emoção para não perder o controle do seu corpo, ou gaste 1 de Humanidade para manter o controle (se falhar no teste, pode gastar 2 de Humanidade).' },
    { indice: 8, id: 'receptaculo_demoniaco_sacrificio_indigno', name: 'Sacrifício Indigno', color: 'red', cost: 2, tipo: 'turno_N', turnosRecarga: 5, usosMax: 1, desc: 'Escolha um Golpe (mesmo em recarga) e um Sacrilégio de outro Golpe, e lance-o. Ao invés de gastar os pontos de Humanidade, receba 1d6 de Dano na Vida para cada ponto.',
      efeitoSecundario: { tipo: 'sacrilegio', custoHumanidade: 2, desc: 'Perca 2 de Humanidade: este Golpe custa 1 Ação a menos, e você pode escolher outro Sacrilégio, que não causa dano (combine com o narrador qual é a ideia da junção).' } },
    { indice: 9, id: 'receptaculo_demoniaco_vida_cruel', name: 'Vida Cruel', color: 'red', cost: 2, tipo: 'sessao', usosMax: 2, desc: 'Cause o quanto você quiser de Dano em você mesmo (o máximo é a sua Vida atual) e cause esse mesmo Dano num Alvo a até 8 Casas.',
      efeitoSecundario: { tipo: 'sacrilegio', custoHumanidade: 3, desc: 'Perca 3 de Humanidade: este Golpe custa 1 Ação a menos, e você não recebe o dano.' } },
    { indice: 10, id: 'receptaculo_demoniaco_vileza_explosiva', name: 'Vileza Explosiva', color: 'red', cost: 2, tipo: 'turno_N', turnosRecarga: 1, usosMax: 1, desc: 'Lance uma bola vil (3x3 Casas) num Alvo a até 6 Casas, causando 4 de Dano a todos na área.',
      efeitoSecundario: { tipo: 'sacrilegio', custoHumanidade: 1, desc: 'Perca 1 de Humanidade: este Golpe custa 1 Ação a menos, e lance outra bola vil em outro Alvo.' } },
  ],
  'Amaldiçoado': [
    { indice: 1, id: 'amaldicoado_alimentando_a_maldicao', name: 'Alimentando a Maldição', color: 'blue', cost: 1, tipo: 'turno_N', turnosRecarga: 2, usosMax: 1, desc: 'Escolha um Alvo que esteja até 4 Casas de você e roube 1d4 de Vida; tirando 4, pode trocar os pontos de Vida por uma redução de 1 de Humanidade no próximo Assombrar (escolha de qual feitiço). O Alvo pode resistir; caso falhe, perde uma Ação do próximo turno dele.',
      efeitoSecundario: { tipo: 'assombrar', custoHumanidade: 1, desc: 'Perca 1 de Humanidade e recarregue este feitiço, e roube +1d4 de Vida do Alvo.' } },
    { indice: 2, id: 'amaldicoado_arma_imaculada', name: 'Arma Imaculada', color: 'blue', cost: 0, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Sacrifique apenas 1d4, 1d6 ou 1d8 de Vida e conceda, até o início do próximo turno: metade do resultado (arredonda pra cima) em Vantagem com Ações da Arma; um Assombrar de algum feitiço para a Arma; ou o resultado em +Dano/Cura para a Arma.',
      efeitoSecundario: { tipo: 'assombrar', custoHumanidade: 3, desc: 'Perca 3 de Humanidade e recarregue este feitiço, e o dado de sacrifício é Crítico; não causa dano, ou você pode usar outro dado de sacrifício diferente.' } },
    { indice: 3, id: 'amaldicoado_assombramento', name: 'Assombramento', color: 'blue', cost: 1, tipo: 'luta', usosMax: 1, desc: 'Faça um Teste de Furtividade e toque no Alvo: se tiver sucesso, transfira o preço do próximo Assombrar (do feitiço de sua escolha); se falhar, transfira apenas metade (arredondando para baixo). Se o Alvo não for Bruxo, cause 1d6 de Dano na Vida para cada ponto de Humanidade.',
      efeitoSecundario: { tipo: 'assombrar', custoHumanidade: 2, desc: 'Perca 2 de Humanidade e recarregue este feitiço, e não precisa fazer o Teste de Furtividade.' } },
    { indice: 4, id: 'amaldicoado_corrente_sombria', name: 'Corrente Sombria', color: 'blue', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Invoque sombras que se comportam como algemas: escolha um Alvo, a até 5 Casas, e acorrente as mãos dele, que precisa gastar uma Ação para quebrá-las. Enquanto acorrentado, só poderá se mover e Desviar.',
      efeitoSecundario: { tipo: 'assombrar', custoHumanidade: 2, desc: 'Perca 2 de Humanidade e recarregue este feitiço, e ao quebrar as algemas, cause 1d8 de Dano na Vida; se já estiver algemado pelas sombras, cause diretamente 1d8 de Dano na Vida.' } },
    { indice: 5, id: 'amaldicoado_necroterio', name: 'Necrotério', color: 'blue', cost: 1, tipo: 'sessao', usosMax: 1, desc: 'Levante um cadáver que você ou seus Aliados mataram e faça 3 perguntas para ele, que responderá apenas com verdades. (Funciona uma vez por cadáver.)',
      efeitoSecundario: { tipo: 'assombrar', custoHumanidade: 1, desc: 'Perca 1 de Humanidade e recarregue este feitiço, e levante-o como seu servo, com 30 de Vida e 1d8 de ataque (os dados são os mesmos que os seus). No final da sessão, ele morre.' } },
    { indice: 6, id: 'amaldicoado_podridao_armamentista', name: 'Podridão Armamentista', color: 'blue', cost: 2, tipo: 'turno_N', turnosRecarga: 2, usosMax: 1, desc: 'Sua Arma cria um olho até o final do turno, que mira em algum lugar específico do Alvo: ele não poderá Desviar contra sua Arma.',
      efeitoSecundario: { tipo: 'assombrar', custoHumanidade: 1, desc: 'Perca 1 de Humanidade e recarregue este feitiço, e sua Arma cria dentes: receba +1 Ação neste turno, dedicada à Arma.' } },
    { indice: 7, id: 'amaldicoado_receptaculo_rompido', name: 'Receptáculo Rompido', color: 'blue', cost: 0, tipo: 'sessao', usosMax: 1, desc: 'Liberte totalmente a energia amaldiçoada até o início do próximo turno e controle-a: seus feitiços têm Assombrar ativado. Ao usar um feitiço, faça um Teste de Reflexo para não perder o controle, ou gaste 1 de Humanidade para manter o controle (se falhar no teste, pode gastar 2 de Humanidade).' },
    { indice: 8, id: 'amaldicoado_ritual_macabro', name: 'Ritual Macabro', color: 'blue', cost: 2, tipo: 'turno_N', turnosRecarga: 5, usosMax: 1, desc: 'Escolha um feitiço (mesmo em recarga) e um Assombrar de outro feitiço, e lance-o. Ao invés de gastar Humanidade, receba 1d6 de Insanidade para cada ponto.',
      efeitoSecundario: { tipo: 'assombrar', custoHumanidade: 2, desc: 'Perca 2 de Humanidade e recarregue este feitiço, e você pode escolher outro Assombrar, que não causa Insanidade e nem custa Humanidade.' } },
    { indice: 9, id: 'amaldicoado_ruptura_mental', name: 'Ruptura Mental', color: 'blue', cost: 1, tipo: 'turno_N', turnosRecarga: 5, usosMax: 1, desc: 'Coloque suas mãos na cabeça do Alvo, e sombras penetrarão a mente dele: faça uma pergunta sobre algo de seu interesse. Ele pode resistir por meio de um Teste de Emoção, ou até o início do próximo turno ele não poderá lançar Golpes, Técnicas ou Feitiços (escolha).',
      efeitoSecundario: { tipo: 'assombrar', custoHumanidade: 2, desc: 'Perca 2 de Humanidade e recarregue este feitiço, e lance a outra opção também.' } },
    { indice: 10, id: 'amaldicoado_toque_corruptivel', name: 'Toque Corruptível', color: 'blue', cost: 1, tipo: 'turno_N', turnosRecarga: 4, usosMax: 1, desc: 'Toque em um Alvo vivo e receba 1d4 de memórias de seu interesse. Se quiser, troque cada memória (quantas quiser) por 1d8 de Dano nele (funciona só uma vez por Alvo). Mas se já lançou este feitiço neste Alvo, causa 1d8 de Dano.',
      efeitoSecundario: { tipo: 'assombrar', custoHumanidade: 2, desc: 'Perca 2 de Humanidade e recarregue este feitiço, e tenha o valor máximo do 1d4, continuando com as memórias. Se já lançou este feitiço no Alvo, cause +1d6 de Dano na Vida.' } },
  ],
  'Dançarino': [
    { indice: 1, id: 'dancarino_afinando_instrumento', name: 'Afinando Instrumento', color: 'green', cost: 0, tipo: 'turno_N', turnosRecarga: 2, usosMax: 1, concedeNota: 'Si', desc: 'Escolha um Instrumento Musical: sua próxima Ação neste turno com ele consumirá uma Ação a menos; produzirá 2 Notas Musicais na próxima Ação com ele; ou possuirá +1d6 de Vantagem na próxima Ação com ele. (Sequência de qualquer Nota: tem todas as opções.)' },
    { indice: 2, id: 'dancarino_alarme_musical', name: 'Alarme Musical', color: 'green', cost: 1, tipo: 'turno_N', turnosRecarga: 5, usosMax: 1, concedeNota: 'Sol', desc: 'Faça uma armadilha furtiva: lance um Teste de Furtividade — para não caírem na armadilha, precisam fazer um Teste de Percepção. A armadilha é feita de linhas de instrumentos musicais: ao passar por cima, ficam presos até o início do seu próximo turno. Ao produzir o som, você recebe uma Nota Musical de sua escolha.' },
    { indice: 3, id: 'dancarino_breakdance', name: 'Breakdance', color: 'green', cost: 1, tipo: 'turno_N', turnosRecarga: 2, usosMax: 1, concedeNota: 'Fá', desc: 'Dê uma rasteira com estilo em uma Casa ao seu redor, causando 1d6 de Dano e derrubando quem for atingido — ele perde a próxima Ação de Movimento. (Sequência de Mi: faça um Teste de Acrobacia; se tiver sucesso, mova-se 4 Casas e repita esta Técnica.)' },
    { indice: 4, id: 'dancarino_dance_pra_mim', name: 'Dance pra Mim', color: 'green', cost: 0, tipo: 'sessao', usosMax: 3, desc: 'Durante uma manobra, como uma Acrobacia ou Desviar, receba +1d8 de Vantagem e se mova 2 Casas. (Pode ser usado fora do seu turno.)' },
    { indice: 5, id: 'dancarino_ela_e_ela', name: 'Ela e Ela', color: 'green', cost: 1, tipo: 'sessao', usosMax: 2, concedeNota: 'qualquer', desc: 'Você canta uma mentira de uma pessoa para outra. Escolha 2 Alvos, que devem se enfrentar até o seu próximo turno. Se os 2 forem do mesmo lado, devem realizar um Teste de Percepção para evitar o confronto.' },
    { indice: 6, id: 'dancarino_eu_si_divirto', name: 'Eu Si Divirto', color: 'green', cost: 2, tipo: 'turno_N', turnosRecarga: 4, usosMax: 1, concedeNota: 'Mi', desc: 'Escolha 2 Aliados e dance uma música junto com eles: cada um deverá fazer um Teste de Acrobacia — para cada um que tiver acerto, você recebe uma Nota Musical. Se todos acertarem, lance um Campo Harmônico aleatório.' },
    { indice: 7, id: 'dancarino_o_que_pode_fazer_um_nego', name: 'O Que Pode Fazer Um Nego', color: 'green', cost: 0, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, concedeNota: 'Ré', desc: 'Troque a mão pelos pés: troque uma Ação por uma Ação de Movimento, ou troque a Ação de Movimento por uma Ação. (Sequência de qualquer Nota: ganhe uma Ação de Movimento.)' },
    { indice: 8, id: 'dancarino_pista_de_danca', name: 'Pista de Dança', color: 'green', cost: 1, tipo: 'sessao', usosMax: 1, desc: 'Inicie uma música contagiante até o final do seu próximo turno: seus Campos Harmônicos não custam Ações, e todos realizam um Teste de Acrobacia contra o seu, gastando uma Ação para isso. Caso alguém falhe, receba uma Nota Musical de sua escolha, e ele terá que gastar mais uma Ação para fazer o Teste de Acrobacia novamente (só para de testar ao vencer você). Se você lançar um Campo Harmônico, a música se estende por mais um turno.' },
    { indice: 9, id: 'dancarino_preparar_outfit', name: 'Preparar Outfit', color: 'green', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, concedeNota: 'Dó', desc: 'Gaste alguns tecidos e imite a roupa de alguém (não é a Armadura): poderão fazer um Teste de Reflexo para notar que é uma cópia. Ou restaure 1d6 de Armadura de um Alvo.' },
    { indice: 10, id: 'dancarino_ritmo_devagar', name: 'Ritmo Devagar', color: 'green', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, concedeNota: 'Lá', desc: 'Dance parado: gaste os seus Passos e receba-os como +Vantagem ou +Dano/Cura na sua próxima Ação.' },
  ],
  'Roqueiro': [
    { indice: 1, id: 'roqueiro_efeito_sonoro_caseiro', name: 'Efeito Sonoro Caseiro', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, concedeNota: 'Sol', desc: 'Realize um ataque corpo a corpo com seu Instrumento Musical, causando 4 de Dano; se o Alvo estiver sem Armadura, ficará Surdo até o final do seu próximo turno. (Sequência de Fá: o Alvo também fica Cego até o final deste turno.)' },
    { indice: 2, id: 'roqueiro_encarnando_o_rock', name: 'Encarnando o Rock', color: 'red', cost: 2, tipo: 'turno_N', turnosRecarga: 5, usosMax: 1, concedeNota: 'Mi', desc: 'Toque com seu Instrumento Musical uma música marcante, fazendo todos num raio de 5 Casas começarem a balançar suas cabeças — terão que fazer um Teste de Resistência; caso falhem, começarão a dançar de forma louca e terão que fazer um Teste de Acrobacia; caso falhem também, lançarão Roda Punk.' },
    { indice: 3, id: 'roqueiro_extase_metalico', name: 'Êxtase Metálico', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, concedeNota: 'Si', desc: 'Faça um Teste de Acrobacia, no qual você pode avançar até 6 Casas; se tiver alguém no caminho, será empurrado 2 Casas para trás. (O percurso não para.)' },
    { indice: 4, id: 'roqueiro_gritaria', name: 'GRITARIA!!!', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 4, usosMax: 1, concedeNota: 'qualquer', desc: 'Dê um grito tão alto que todos os outros num raio de 4 Casas devem fazer um Teste de Resistência para não ficarem Surdos até o final do seu próximo turno. Os afetados só escutam o som que você produz.' },
    { indice: 5, id: 'roqueiro_manobra_radical', name: 'Manobra Radical', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, concedeNota: 'Fá', desc: 'Produza um som com seu Instrumento Musical que libera uma onda sonora de 3x3 Casas, com você no centro, causando 5 de Dano em todos. (Sequência de Sol: faça um Teste de Acrobacia; você pula até 4 Casas, não recebe dano e causa +1d4 de Dano.)' },
    { indice: 6, id: 'roqueiro_multi_ritmos', name: 'Multi-Ritmos', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 4, usosMax: 1, concedeNota: 'Dó', desc: 'Com seu Instrumento Musical, faça sons aleatórios e fora de ritmo: até o início do seu próximo turno, escolha um: os dados são invertidos; as vantagens são invertidas; os danos são invertidos; ou todos relançam a Iniciativa.' },
    { indice: 7, id: 'roqueiro_preparacao_para_o_refrao', name: 'Preparação Para o Refrão', color: 'red', cost: 1, tipo: 'sessao', usosMax: 3, desc: 'Receba 3 Notas Musicais de sua escolha. (Sequência de qualquer Nota: gaste todas as Notas Musicais e cause 1d4 de Dano em todos os inimigos na luta — se estiverem Surdos, o dano atravessa a Armadura e o dado se torna 1d6.)' },
    { indice: 8, id: 'roqueiro_qualidade_e_sincronia', name: 'Qualidade e Sincronia', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 2, usosMax: 1, concedeNota: 'Ré', desc: 'Escolha um Aliado: vocês dois entram em sincronia, e seu próximo Golpe é fundido com outro Golpe dele. Os 2 lançam, com os dados em Mega Vantagem, e a recarga vai para os dois da melhor forma possível (combine com o narrador qual é a ideia). Não pode usar 2 vezes seguidas com o mesmo Aliado.' },
    { indice: 9, id: 'roqueiro_solo_instrumental', name: 'Solo Instrumental', color: 'red', cost: 2, tipo: 'sessao', usosMax: 4, desc: 'Inicie um solo com seu Instrumento Musical até o final do seu próximo turno: todos os seus Aliados possuem mais uma Ação, e seus Campos Harmônicos não custam Ações. Quando eles lançarem um Golpe, você recebe uma Nota Musical. Se lançar um Campo Harmônico, o solo se estende por mais um turno (o máximo é estender 4 vezes).' },
    { indice: 10, id: 'roqueiro_sutileza_e_o_carai', name: 'Sutileza É o Carai', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 1, usosMax: 1, concedeNota: 'Lá', desc: 'Toque com seu Instrumento Musical uma parte de uma música que chama a atenção de todos a até 30 metros. Se houver alguém a até 3 Casas de você, ficará Surdo até o início do seu próximo turno.' },
  ],
  'Maestro Macabro': [
    { indice: 1, id: 'maestro_macabro_acordes_tenebrosos', name: 'Acordes Tenebrosos', color: 'blue', cost: 1, tipo: 'turno_N', turnosRecarga: 4, usosMax: 1, concedeNota: 'Dó', desc: 'Com seu Instrumento Musical, toque uma música triste que atinge uma época ruim dos ouvintes: eles precisam fazer um Teste de Emoção; caso falhem, choram e ficam com Mega Desvantagem na próxima Ação, e as vozes te contam sobre essa época.' },
    { indice: 2, id: 'maestro_macabro_cantor_demoniaco', name: 'Cantor Demoníaco', color: 'blue', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, concedeNota: 'Fá', desc: 'Pegue emprestada a voz de um demônio, capaz de ser escutada no mesmo volume independentemente da distância (no máximo 10 Casas de raio). Para cada palavra dita, você recebe 1 de Dano na Vida. (Desativa quando quiser.) Para perceberem que não é um demônio falando, precisam fazer um Teste da própria área Intelectual.' },
    { indice: 3, id: 'maestro_macabro_compor_partitura_improvisada', name: 'Compor Partitura Improvisada', color: 'blue', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, concedeNota: 'qualquer', desc: 'Seu próximo Campo Harmônico custa apenas 4 Notas Musicais e apenas 1 Ação, porém é aleatório. Se quiser escolher, receba 1d8 de Dano na Vida.' },
    { indice: 4, id: 'maestro_macabro_hino_infernal', name: 'Hino Infernal', color: 'blue', cost: 2, tipo: 'turno_N', turnosRecarga: 5, usosMax: 1, concedeNota: 'Ré', desc: 'Surgem espíritos de demônios que tocam uma orquestra conforme o seu desejo: cause 1d20 de Dano num Alvo a até 6 Casas e receba 1d20 de Dano; ou lance um Campo Harmônico aleatoriamente e receba 1d12 de Dano; ou receba 3 Notas Musicais e receba 1d6 de Dano. (Sequência de Lá: você recebe metade do dano deste feitiço, arredondando para cima.)' },
    { indice: 5, id: 'maestro_macabro_maestro_macabro', name: 'Maestro Macabro', color: 'blue', cost: 1, tipo: 'turno_N', turnosRecarga: 1, usosMax: 1, concedeNota: 'Si', desc: 'Escolha um Alvo e ordene se ele vai Acertar ou Errar a próxima Ação dele. Caso sua ordem seja correspondida, receba uma Nota Musical de sua escolha; caso não, cause 1d4 de Dano na Vida dele.' },
    { indice: 6, id: 'maestro_macabro_o_cantar_da_alma', name: 'O Cantar da Alma', color: 'blue', cost: 0, tipo: 'sessao', usosMax: 4, desc: 'Lance um Campo Harmônico: para cada Nota Musical faltante, receba 1d4 de Dano na Vida. Se já lançou algum Campo Harmônico neste turno, ao invés de 1d4, agora é 1d2. (Não pode lançar o mesmo Campo Harmônico no mesmo turno.)' },
    { indice: 7, id: 'maestro_macabro_orquestra_macabra', name: 'Orquestra Macabra', color: 'blue', cost: 2, tipo: 'sessao', usosMax: 1, desc: 'Inicie uma orquestra até o final do seu próximo turno: seus Campos Harmônicos não custam Ações, e quando alguém realizar uma Ação, ordene se ele vai Acertar ou Errar. Caso sua ordem seja correspondida, receba uma Nota Musical de sua escolha; caso não, cause 1d8 de Dano na Vida dele. Se você lançar um Campo Harmônico, a orquestra se estende por mais um turno (no máximo 4 vezes).' },
    { indice: 8, id: 'maestro_macabro_poema_decifrador', name: 'Poema Decifrador', color: 'blue', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, concedeNota: 'Lá', desc: 'Escolha um Alvo: as vozes criarão um poema com alguma informação útil dele — no poema haverá 3 informações, uma delas verdadeira. Se quiser saber qual é a correta, receba 1d8 de Dano na Vida.' },
    { indice: 9, id: 'maestro_macabro_som_sedutor', name: 'Som Sedutor', color: 'blue', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, concedeNota: 'Mi', desc: 'Escolha um Alvo a até 10 metros ou 10 Casas: ele escuta um som exclusivo. Para perceber que foi um som falso, precisa fazer um Teste da própria área Intelectual, ou, se estiver próximo dele (até 6 Casas), ir ver o lugar do som falso. (Sequência de Ré: ele não consegue perceber sem verificar o lugar do som.)' },
    { indice: 10, id: 'maestro_macabro_transmissao_de_aura', name: 'Transmissão de Aura', color: 'blue', cost: 0, tipo: 'turno_N', turnosRecarga: 4, usosMax: 1, concedeNota: 'Sol', desc: 'Escolha um Alvo a até 6 Casas e se vincule com ele: cause nele, por meio de seus Feitiços, todo o dano que você receberia neste turno. (Sequência de Si: receba 2d6 de Dano na Vida. Sequência de Dó: este feitiço tem Roubar Vida.)' },
  ],
  'Exorcista': [
    { indice: 1, id: 'exorcista_castigo_divino', name: 'Castigo Divino', color: 'green', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Com uma oração à sua divindade, cause 1d6 de Dano num Alvo a até 6 Casas; remova uma Ação de Movimento do Alvo a até 6 Casas; ou remova uma Ação do Alvo a até 6 Casas. Se acertar o Castigo Divino, ganhe +2d6 de Vantagem no próximo Teste de Devoção.' },
    { indice: 2, id: 'exorcista_convocacao_sagrada_auxilio', name: 'Convocação Sagrada: Auxílio', color: 'green', cost: 2, tipo: 'sessao', usosMax: 1, desc: 'Por meio de um ritual, você convoca sua divindade: todos os seus Aliados recebem Purificação.' },
    { indice: 3, id: 'exorcista_convocacao_sagrada_crueldade', name: 'Convocação Sagrada: Crueldade', color: 'green', cost: 2, tipo: 'sessao', usosMax: 1, desc: 'Por meio de um ritual, você convoca sua divindade: todos os seus inimigos recebem Castigo Divino. (Escolha uma opção para cada Alvo acertado; pode repetir.)' },
    { indice: 4, id: 'exorcista_convocando_espiritos', name: 'Convocando Espíritos', color: 'green', cost: 1, tipo: 'sessao', usosMax: 2, desc: 'Com um ritual, sua divindade permite conversar com um antigo devoto dela, de seu interesse. No final da conversa, você recebe: uma Intervenção; Mega Vantagem no próximo Teste de Devoção; ou apenas 2d10 de Cura.' },
    { indice: 5, id: 'exorcista_guia_espiritual', name: 'Guia Espiritual', color: 'green', cost: 1, tipo: 'turno_N', turnosRecarga: 4, usosMax: 1, desc: 'Com um item sagrado, sua divindade alcança seus Aliados a até 5 Casas de você, concedendo apenas 1d6 de Cura; +1d6 de Vantagem no próximo Teste; ou +2 de Passos na próxima Ação de Movimento deles. Para você, sua próxima Bênção é lançada 2 vezes.' },
    { indice: 6, id: 'exorcista_intuicao_sagrada', name: 'Intuição Sagrada', color: 'green', cost: 1, tipo: 'turno_N', turnosRecarga: 2, usosMax: 1, desc: 'Por meio de uma oração, sua divindade te concede uma análise sobre o lugar/alguém, revelando se tem algum aspecto místico. (Funciona uma vez por Alvo.) Se tiver, sua divindade concede +1d10 de Vantagem no seu próximo Teste de Devoção.' },
    { indice: 7, id: 'exorcista_maos_sagradas', name: 'Mãos Sagradas', color: 'green', cost: 0, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Utilizando um item sagrado, sua divindade concede às suas mãos: +2 de Vantagem em Aparar, e +2 de Dano, até o início do seu próximo turno. Se fizer algum Teste de Devoção, o efeito dura mais um turno e concede +2 novamente. (Pode ser feito infinitamente.)' },
    { indice: 8, id: 'exorcista_mente_acoitada', name: 'Mente Açoitada', color: 'green', cost: 1, tipo: 'turno_N', turnosRecarga: 2, usosMax: 1, desc: 'Com uma oração e um toque, sua divindade adentra a mente de um Alvo, causando 1d6 de Dano na Vida (o Alvo pode resistir). Se for em você mesmo, ao invés do dano, você possui +1d10 de Vantagem no seu próximo Teste de Devoção.' },
    { indice: 9, id: 'exorcista_oracao_do_exorcista', name: 'Oração do Exorcista', color: 'green', cost: 2, tipo: 'turno_N', turnosRecarga: 5, usosMax: 1, desc: 'Faça uma oração para sua divindade: ao tocar num Alvo, tente remover o invasor daquele corpo/mente, por meio de um Teste de Devoção. Só pode ser usado uma vez por Alvo, e ele precisa desejar, por meio de sua alma, que o invasor saia.' },
    { indice: 10, id: 'exorcista_purificacao', name: 'Purificação', color: 'green', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Com uma oração à sua divindade, remova um efeito negativo de sua escolha de um Alvo a até 6 Casas. Escolha uma Bênção e lance-a neste turno.' },
  ],
  'Paladino': [
    { indice: 1, id: 'paladino_aparo_milagroso', name: 'Aparo Milagroso', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Após você ou um Aliado, que esteja até 3 Casas, terem falhado num Aparar/Desviar, sua divindade permite que você entre na frente e apare novamente. Se for fora do seu turno, consome uma Ação do seu próximo turno.',
      efeitoSecundario: { tipo: 'fidelidade', desc: 'Faça um Teste de Devoção e troque o resultado para aprimorar: Bênção — +3 de Vantagem; Intervenção — o atacante refaz o lançamento; Milagre — não consome Ação; Milagre Supremo — ganha o Aparar e não perde Ação.' } },
    { indice: 2, id: 'paladino_arma_sagrada', name: 'Arma Sagrada', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 2, usosMax: 1, desc: 'Escolha um Alvo a até 8 Casas e arremesse um martelo sagrado que causa 1d10 de Dano. O martelo se desintegra ao final do Golpe.',
      efeitoSecundario: { tipo: 'fidelidade', desc: 'Faça um Teste de Devoção e troque o resultado para aprimorar: Bênção — +3 de Vantagem; Intervenção — +3 de Dano; Milagre — o dano é total; Milagre Supremo — substitua o martelo por uma Arma qualquer e ative o efeito dela.' } },
    { indice: 3, id: 'paladino_avanco_corajoso', name: 'Avanço Corajoso', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Escolha um Alvo a até 8 Casas e avance nele com tudo: ele não poderá Desviar, e você causa 5 de Dano com sua Arma nele.',
      efeitoSecundario: { tipo: 'fidelidade', desc: 'Faça um Teste de Devoção e troque o resultado para aprimorar: Bênção — +3 de Vantagem; Intervenção — +2 de Alcance; Milagre — o dano atravessa Armadura; Milagre Supremo — 50% de chance de Crítico neste Golpe.' } },
    { indice: 4, id: 'paladino_contra_ataque_sagrado', name: 'Contra-Ataque Sagrado', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 5, usosMax: 1, desc: 'Sua fé e raiva se manifestam, fazendo surgirem 2 martelos sagrados que flutuam ao seu redor. Ao receber um ataque vindo de até 8 Casas, você pode escolher um dos martelos para contra-atacar, causando 1d10 de Dano. Após o contra-ataque, o martelo sagrado se desintegra.',
      efeitoSecundario: { tipo: 'fidelidade', desc: 'Faça um Teste de Devoção e troque o resultado para aprimorar: Bênção — +3 de Dano; Intervenção — possui mais um martelo sagrado; Milagre — o dano é total; Milagre Supremo — substitua o martelo por uma Arma qualquer e ative o efeito dela.' } },
    { indice: 5, id: 'paladino_discurso_da_alma', name: 'Discurso da Alma', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 4, usosMax: 1, desc: 'Sua fé é liberada por meio da sua voz, ecoando na alma de seus Aliados. Faça um discurso que concede +1 Ação no próximo turno deles. Se algum Aliado estiver à beira da morte, o Teste de Emoção será automaticamente considerado um sucesso.' },
    { indice: 6, id: 'paladino_transcendencia_espiritual', name: 'Transcendência Espiritual', color: 'red', cost: 0, tipo: 'sessao', usosMax: 1, desc: 'Sua divindade te concede uma forma sagrada até o final do seu próximo turno: você faz 1d2+1 Testes de Devoção e troca os resultados por um efeito — Bênção: +2 de Dano/Cura; Intervenção: +2 de Passos; Milagre: +1 Ação; Milagre Supremo: +5 de Dano/Cura, +5 de Passos e +2 Ações. Ao fazer um Teste de Devoção, a forma sagrada dura mais um turno.' },
    { indice: 7, id: 'paladino_fe_envolvente', name: 'Fé Envolvente', color: 'red', cost: 1, tipo: 'luta', usosMax: 1, desc: 'Sua fé te envolve com um escudo que possui a sua Vida (mesma quantidade). Você só voltará a receber dano após quebrá-lo.',
      efeitoSecundario: { tipo: 'fidelidade', desc: 'Faça um Teste de Devoção e troque o resultado para aprimorar: Bênção — +5 de Vida; Intervenção — +10 de Vida; Milagre — +15 de Vida; Milagre Supremo — escolha entre Feitiço, Golpe ou Técnica, e o escudo será imune a esse tipo de dano.' } },
    { indice: 8, id: 'paladino_fiel_exemplar', name: 'Fiel Exemplar', color: 'red', cost: 0, tipo: 'sessao', usosMax: 2, desc: 'Sua fé é colocada à prova: até o início do próximo turno, toda vez que usar Fidelidade, lance também um Teste de Devoção e restaure apenas 1d6 de Vida. Caso consiga algum Milagre ou Milagre Supremo, ganhe uma Ação neste turno.' },
    { indice: 9, id: 'paladino_oracao_dos_paladinos', name: 'Oração dos Paladinos', color: 'red', cost: 2, tipo: 'turno_N', turnosRecarga: 5, usosMax: 1, desc: 'Faça uma oração para sua divindade, e sua fé manifesta a presença dela na Cena/Luta: nenhuma mentira pode ser proliferada diante de você, e você sente a intenção no coração de todos ao seu redor.' },
    { indice: 10, id: 'paladino_proposito_divino', name: 'Propósito Divino', color: 'red', cost: 1, tipo: 'turno_N', turnosRecarga: 5, usosMax: 1, desc: 'Sua divindade te auxilia em momentos de tormento, apresentando suas memórias mais preciosas: remova um efeito negativo, e caso tenha falhado num Teste de Emoção ou Teste de Resistência, poderá fazer um Teste de Devoção para substituir o resultado.',
      efeitoSecundario: { tipo: 'fidelidade', desc: 'Faça um Teste de Devoção e troque o resultado para aprimorar: Bênção — +30 de Vantagem; Intervenção — funciona 2 vezes; Milagre — se estiver à beira da morte, se levanta; Milagre Supremo — sai do estado à beira da morte e receba um Milagre da sua divindade.' } },
  ],
  'Acólito': [
    { indice: 1, id: 'acolito_confrontar_angustia', name: 'Confrontar Angústia', color: 'blue', cost: 1, tipo: 'luta', usosMax: 1, desc: 'Você e sua divindade se unem para adentrar a mente de uma pessoa e confrontam os sentimentos que a afligem. O Alvo realizará um Teste de Emoção em módulo, e o resultado desse confronto será refletido na Vida de um monstro que deve ser vencido. Ao derrotá-lo, escolha um dos efeitos: receber uma Intervenção, obter 2 Bênçãos, ou curar 3d10 de Vida do Alvo.' },
    { indice: 2, id: 'acolito_escudo_divino', name: 'Escudo Divino', color: 'blue', cost: 1, tipo: 'sessao', usosMax: 2, desc: 'Com seu poder sagrado, crie um escudo num Alvo que esteja a 1 Casa de distância: ele ignora o próximo dano que receber.' },
    { indice: 3, id: 'acolito_feixes_da_alma', name: 'Feixes da Alma', color: 'blue', cost: 1, tipo: 'turno_N', turnosRecarga: 3, usosMax: 1, desc: 'Seu poder sagrado se concentra em 2 feixes: escolha 2 Alvos diferentes a até 8 Casas e cause 1d6 de Dano — se for Aliado, cura apenas 1d4 de Vida. Caso acerte os 2, receba um Teste de Devoção gratuito neste turno.' },
    { indice: 4, id: 'acolito_grito_da_alma', name: 'Grito da Alma', color: 'blue', cost: 1, tipo: 'turno_N', turnosRecarga: 4, usosMax: 1, desc: 'Seu poder sagrado é liberado em 3x3 Casas, com você no centro, empurrando todos os outros para 1d2+1 Casas para trás e causando 1d6 de Dano. Os atingidos podem resistir, porém ainda recebem o dano. Ao receber um ataque, pode usar este feitiço, porém consumirá uma Ação do próximo turno.' },
    { indice: 5, id: 'acolito_o_caminhar_do_divino', name: 'O Caminhar do Divino', color: 'blue', cost: 1, tipo: 'turno_N', turnosRecarga: 2, usosMax: 1, desc: 'Com seu poder sagrado, seu corpo se desloca 3 Casas de forma engajada: se tiver algum inimigo no percurso, ele recebe 1d2 de Dano na Vida e você para nele; já se for um Aliado, ele recebe 1d2 de Cura e você para nele. Se não tiver ninguém, faça um Teste de Devoção gratuitamente.' },
    { indice: 6, id: 'acolito_oracao_do_acolito', name: 'Oração do Acólito', color: 'blue', cost: 2, tipo: 'turno_N', turnosRecarga: 5, usosMax: 1, desc: 'Faça uma oração para sua divindade, e seu poder sagrado se manifesta de forma intensa: todos que estiverem na Cena/Luta recebem um deslumbre de sua divindade, não podendo se atacar por um turno, e te escutam perfeitamente. (Não funciona com outros Clérigos.)' },
    { indice: 7, id: 'acolito_penitencia_sagrada', name: 'Penitência Sagrada', color: 'blue', cost: 0, tipo: 'sessao', usosMax: 5, desc: 'Renuncie: uma Ação; uma Ação de Movimento; 1d8 da sua Vida; ou 1d4 da sua Armadura. Assim, receba neste turno um Teste de Devoção sem consumir Ação.' },
    { indice: 8, id: 'acolito_raio_da_alma', name: 'Raio da Alma', color: 'blue', cost: 1, tipo: 'turno_N', turnosRecarga: 2, usosMax: 1, desc: 'Seu poder sagrado se manifesta por meio de um raio sagrado: escolha um Alvo a até 8 Casas e cause 1d6 de Dano. Se você já fez um Teste de Devoção neste turno, cause +1d4 de Dano.' },
    { indice: 9, id: 'acolito_sensacao_de_anjo', name: 'Sensação de Anjo', color: 'blue', cost: 0, tipo: 'luta', usosMax: 1, desc: 'Seu poder sagrado se manifesta de forma intensa: sua divindade concede, até o final do seu próximo turno, asas divinas que te atribuem +3 de Passos, +3 de Vantagem em Desviar, e +3 de Dano em Feitiços. Pode estender por +1 turno se fizer um Teste de Devoção. (Pode fazer infinitamente.)' },
    { indice: 10, id: 'acolito_sentenca_instantanea', name: 'Sentença Instantânea', color: 'blue', cost: 1, tipo: 'turno_N', turnosRecarga: 2, usosMax: 1, desc: 'Com a essência da sua divindade, castigue um pecador! Escolha um Alvo a até 8 Casas e cause 1d8 de Dano. Se o Alvo acabou de cometer um pecado à sua frente, o dano será total, ou causa +1d8 de Dano.' },
  ],
};

// Retorna TODAS as Habilidades azuis (Feitiços) de TODAS as subclasses do
// jogo, não importa a classe do personagem — usado pelo Aprimoramento de
// Encantamento (ver APRIMORAMENTOS_ARMA), que deixa a arma "aprender" 1
// Feitiço de qualquer classe. Cada item vem com "subclasseOrigem" anexado.
function getTodasHabilidadesAzuisCatalogo() {
  const vistos = new Set();
  const lista = [];
  Object.entries(BANCO_HABILIDADES_SUBCLASSE).forEach(([subNome, skills]) => {
    skills.forEach(sk => {
      if (sk.color === 'blue' && !vistos.has(sk.id)) {
        vistos.add(sk.id);
        lista.push({ ...sk, subclasseOrigem: subNome });
      }
    });
  });
  return lista;
}

// Retorna o catálogo de Habilidades disponível para o personagem: TODAS as
// Habilidades de TODAS as subclasses da mesma Classe-base (ex: um Campeão
// também tem acesso às do Combatente e do Soldado Elementar, por serem todas
// subclasses de Guerreiro) — não só as da própria subclasse. Cada item vem
// com "subclasseOrigem" anexado, usado só para exibir de qual subclasse ele
// vem no catálogo (não é salvo na ficha).
function getBancoHabilidades(p) {
  const clsBase = p.classeBase || getBaseClass(p.cls);
  const cls = CLASSES.find(c => c.name === clsBase);
  const itens = [];
  if (cls) {
    cls.subs.forEach(sub => {
      (BANCO_HABILIDADES_SUBCLASSE[sub.name] || []).forEach(item => {
        itens.push({ ...item, subclasseOrigem: sub.name, classeOrigem: cls.name });
      });
    });
  } else if (BANCO_HABILIDADES_SUBCLASSE[p.cls]) {
    (BANCO_HABILIDADES_SUBCLASSE[p.cls] || []).forEach(item => {
      itens.push({ ...item, subclasseOrigem: p.cls });
    });
  }
  // Duas fontes concedem acesso a Habilidades de fora da própria Classe-base
  // (cota separada — ver getLimiteOutraClasse):
  // - Elfo (Aprendizagem Élfica): TODAS as outras Classes/Subclasses.
  // - Conjurador (Transcendência Intelectual): só Subclasses baseadas em
  //   Intelecto (attr: 'intel') de outras Classes.
  if (p.race === 'Elfo' || p.cls === 'Conjurador') {
    // "Origem Sangrenta" (Elfo Sangrento): precisa escolher a Habilidade de
    // outra Classe (e travar essa Classe) ANTES de poder usar a cota normal
    // de outra Classe da Aprendizagem Élfica — enquanto isso não acontece,
    // a lista de outra Classe fica vazia (força a ordem: 1º Habilidades da
    // própria Classe/Subclasse, 2º Origem Sangrenta, 3º outra Classe livre).
    const aguardandoOrigemSangrenta = p.origemId === 'elfo_origem_sangrento' && !p.origemSangrentaUsado;
    if (aguardandoOrigemSangrenta) return itens;
    // "Origem Noturna" (Elfo Noturno): mesma lógica — precisa escolher o
    // Caminho e receber a Habilidade sorteada ANTES de poder usar a cota
    // normal de outra Classe da Aprendizagem Élfica.
    const aguardandoOrigemNoturna = p.origemId === 'elfo_origem_noturno' && !p.origemNoturnaUsada;
    if (aguardandoOrigemNoturna) return itens;

    const jaAdicionado = new Set(itens.map(it => it.subclasseOrigem + '::' + it.id));
    CLASSES.forEach(outraCls => {
      if (cls && outraCls.name === cls.name) return;
      // "Origem Sangrenta" (Elfo Sangrento): a Classe bloqueada nunca mais
      // pode ser escolhida, nem pela cota normal de outra Classe.
      if (p.origemSangrentaClasseBloqueada === outraCls.name) return;
      outraCls.subs.forEach(sub => {
        // "Origem Noturna" (Elfo Noturno): só o Caminho sorteado fica
        // travado pra sempre — as outras Subclasses da mesma Classe
        // continuam liberadas normalmente.
        if (p.origemNoturnaSubBloqueada === sub.name) return;
        const valeParaElfo = p.race === 'Elfo';
        const valeParaConjurador = p.cls === 'Conjurador' && sub.attr === 'intel';
        if (!valeParaElfo && !valeParaConjurador) return;
        (BANCO_HABILIDADES_SUBCLASSE[sub.name] || []).forEach(item => {
          const chave = sub.name + '::' + item.id;
          if (jaAdicionado.has(chave)) return;
          jaAdicionado.add(chave);
          itens.push({ ...item, subclasseOrigem: sub.name, classeOrigem: outraCls.name });
        });
      });
    });
  }
  return itens;
}

// ─── Limites de escolha do Banco de Habilidades por Nível ──────────────────
// Nível 1: 2 escolhas, ambas obrigatoriamente da própria subclasse.
// Níveis 2 a 5: a cada Nível ganho, +1 escolha da própria subclasse e +1
// escolha "livre" (de qualquer subclasse da mesma Classe-base — inclusive a
// própria). Resultado acumulado: Nv1=2, Nv2=4, Nv3=6, Nv4=8, Nv5=10 — o
// máximo de 10 corresponde ao total de Habilidades cadastradas por subclasse
// em BANCO_HABILIDADES_SUBCLASSE.
function getBancoLimites(p) {
  const nivel = Math.max(1, Math.min(5, p.level || 1));
  // NPCs: Narrador pode escolher quantas Habilidades quiser, sem teto.
  if (p.isNPC) return { nivel, maxOutras: Infinity, maxTotal: Infinity };
  const maxOutras = Math.max(0, nivel - 1); // escolhas "livres" (outra subclasse)
  const maxTotal = nivel * 2;               // total acumulado de escolhas do banco
  return { nivel, maxOutras, maxTotal };
}

// Conta quantas Habilidades do banco o personagem já escolheu, separando
// entre as da própria subclasse e as de outras subclasses da mesma Classe.
// Habilidades marcadas como `bancoOutraClasse` (Aprendizagem Élfica /
// Transcendência Intelectual) NÃO entram nessa contagem — elas têm cota
// própria e separada (ver getLimiteOutraClasse/contarOutraClasseEscolhas).
function contarBancoEscolhas(p) {
  const catalogo = getBancoHabilidades(p);
  let propria = 0, outras = 0;
  (p.skills || []).forEach(sk => {
    if (!sk.bancoId || sk.bancoOutraClasse || sk.origemSangrenta || sk.origemNoturna) return;
    const item = catalogo.find(it => it.id === sk.bancoId);
    const origem = item ? item.subclasseOrigem : null;
    if (origem === p.cls) propria++;
    else outras++;
  });
  return { propria, outras, total: propria + outras };
}

// ─── Habilidade de outra Classe (Elfo / Conjurador) ────────────────────────
// Duas fontes independentes concedem +1 Habilidade de QUALQUER Classe a cada
// Nível, fora do Banco normal da própria Classe-base — as cotas se somam se
// o personagem tiver as duas:
// - Elfo ("Aprendizagem Élfica"): cumulativo até o Nível 5 (1,2,3,4,5).
// - Conjurador ("Transcendência Intelectual"): cumulativo até o Nível 4
//   (1,2,3,4) — no Nível 5, ao invés de mais uma Habilidade normal, aprende
//   um Feitiço Lendário — ver getLimiteFeiticosLendarios/openFeiticosLendariosModal.
function temFonteOutraClasse(p) {
  return p.race === 'Elfo' || p.cls === 'Conjurador';
}
function getLimiteOutraClasse(p) {
  let limite = 0;
  // NPCs: sem teto de cota de "outra Classe" também.
  if (p.isNPC) return Infinity;
  // "Origem Sangrenta": precisa resolver a escolha própria antes de poder
  // usar a cota normal de outra Classe (ver getBancoHabilidades).
  if (p.origemId === 'elfo_origem_sangrento' && !p.origemSangrentaUsado) return 0;
  // Elfo "Aprendizagem Élfica": o texto diz "Ao subir de Nível" — só conta a
  // partir do Nível 2 (0 no Nível 1, +1 por Nível seguinte, até o Nível 5).
  // Um personagem CRIADO já num Nível acima do 1 recebe a cota equivalente
  // de uma vez (ex: criado no Nível 3 → 2 escolhas de outra Classe).
  if (p.race === 'Elfo') limite += Math.max(0, Math.min(5, p.level || 1) - 1);
  // Conjurador "Transcendência Intelectual": o texto já concede a primeira
  // escolha de imediato ("Aprenda um feitiço de outra Classe... Ao subir de
  // Nível, repita esse efeito") — continua valendo desde o Nível 1.
  if (p.cls === 'Conjurador') limite += Math.max(1, Math.min(4, p.level || 1));
  return limite;
}
function contarOutraClasseEscolhas(p) {
  return (p.skills || []).filter(sk => sk.bancoId && sk.bancoOutraClasse).length;
}
// Nome(s) da(s) passiva(s) que concede(m) a cota — usado só pra exibir na UI.
function labelFontesOutraClasse(p) {
  const nomes = [];
  if (p.race === 'Elfo') nomes.push('Aprendizagem Élfica');
  if (p.cls === 'Conjurador') nomes.push('Transcendência Intelectual');
  return nomes.join(' + ') || 'Habilidade de outra Classe';
}

// Quantas escolhas do Banco de Habilidades o personagem ainda pode fazer no
// Nível atual (0 se já escolheu tudo que tinha direito, ou se a Classe não
// tem Banco cadastrado). Usado para avisar o jogador — mesmo padrão do aviso
// de pontos de atributo pendentes (p.pontosPendentes). Inclui também a cota
// de outra Classe (Elfo/Conjurador), se aplicável.
function getHabilidadesPendentes(p) {
  if (p.isNPC) return 0;
  let pendentes = 0;
  if (getBancoHabilidades(p).length) {
    const { maxTotal } = getBancoLimites(p);
    const { total } = contarBancoEscolhas(p);
    pendentes += Math.max(0, maxTotal - total);
  }
  if (temFonteOutraClasse(p)) {
    pendentes += Math.max(0, getLimiteOutraClasse(p) - contarOutraClasseEscolhas(p));
  }
  return pendentes;
}


// subclasse (identificada por bancoId). Não duplica: se já foi adicionada,
// não faz nada. Respeita o limite de escolhas do Nível atual do personagem
// (ver getBancoLimites): Habilidades de outra subclasse só podem ser
// escolhidas dentro da cota "livre" liberada a partir do Nível 2. O campo
// "indice" viaja junto, mas nunca é mostrado na UI.
// Monta o objeto de Habilidade (ficha) a partir de uma entrada do catálogo
// do Banco de Habilidades. Extraído para ser reaproveitado tanto por
// adicionarHabilidadeDoBanco (personagem já existente) quanto pelo passo de
// Habilidades do wizard de criação (personagem ainda não existe).
function construirSkillDoBanco(item) {
  return {
    id: 'sk_banco_' + item.id,
    bancoId: item.id,
    indice: item.indice,
    name: item.name, desc: item.desc,
    color: item.color, cost: item.cost, tipo: item.tipo,
    usosMax: item.tipo === 'infinite' ? 99 : item.usosMax,
    usosAtuais: item.tipo === 'infinite' ? 99 : item.usosMax,
    cdRestante: 0, turnosRecarga: item.turnosRecarga || 2,
    efeitoSecundario: item.efeitoSecundario || null,
    concedeNota: item.concedeNota || null,
  };
}

function adicionarHabilidadeDoBanco(pid, bancoId) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  const item = getBancoHabilidades(p).find(h => h.id === bancoId);
  if (!item) return;
  if (!Array.isArray(p.skills)) p.skills = [];
  const jaTem = p.skills.some(sk => sk.bancoId === item.id);
  if (jaTem) return;

  const clsBaseAtual = p.classeBase || getBaseClass(p.cls);
  const ehOutraClasse = temFonteOutraClasse(p) && item.classeOrigem && item.classeOrigem !== clsBaseAtual;

  if (ehOutraClasse) {
    // Aprendizagem Élfica / Transcendência Intelectual: Habilidade de uma
    // Classe totalmente diferente da sua — usa a cota própria (Elfo/
    // Conjurador), e não a do Banco normal.
    const limiteOutra = getLimiteOutraClasse(p);
    const usadoOutra = contarOutraClasseEscolhas(p);
    if (usadoOutra >= limiteOutra) {
      alert(`Limite de ${labelFontesOutraClasse(p)} atingido para o Nível ${p.level || 1} (máx. ${limiteOutra}). Suba de Nível para escolher mais uma Habilidade de outra Classe.`);
      return;
    }
    const nova = construirSkillDoBanco(item);
    nova.bancoOutraClasse = true;
    p.skills.push(nova);
  } else {
    const { nivel, maxOutras, maxTotal } = getBancoLimites(p);
    const { outras, total } = contarBancoEscolhas(p);
    const ehPropria = item.subclasseOrigem === p.cls;

    if (total >= maxTotal) {
      alert(`Limite de Habilidades do Banco atingido para o Nível ${nivel} (máx. ${maxTotal}). Suba de Nível para desbloquear mais escolhas.`);
      return;
    }
    if (!ehPropria && outras >= maxOutras) {
      alert(`No Nível ${nivel}, você só pode escolher ${maxOutras} Habilidade${maxOutras === 1 ? '' : 's'} de outra subclasse. Suba de Nível para desbloquear mais.`);
      return;
    }

    p.skills.push(construirSkillDoBanco(item));
  }

  saveState();
  renderAll();
  if (typeof renderBancoModal === 'function') renderBancoModal(pid);
}

// ═══════════════════════════════════════
// PASSO 5 DO WIZARD DE CRIAÇÃO — Escolha de Habilidades
// ═══════════════════════════════════════
// Monta um "personagem provisório" só com os campos necessários para
// reaproveitar getBancoHabilidades/getBancoLimites/contarBancoEscolhas
// durante a criação, antes de o personagem existir de fato em PLAYERS.
// true se o personagem sendo criado/editado no wizard agora é um NPC — usado
// pra liberar Nível livre, pontos de atributo sem teto, Habilidades/Talentos
// ilimitados e qualquer categoria de peso de Armadura/Arma (ver pedido do
// Narrador: NPCs não têm Nível e podem ter quantos pontos/Habilidades/
// Talentos ele quiser, além de qualquer tipo de Armadura).
function isWizardTargetNPC() {
  if (modalCharId) {
    const p = PLAYERS.find(x => x.id === modalCharId);
    return !!(p && p.isNPC);
  }
  return wizardIsNPC;
}

// Alterna a classificação Aliado/Inimigo do NPC sendo criado/editado no wizard.
function selectNpcTipo(tipo) {
  wizardNpcTipo = tipo;
  document.querySelectorAll('.npc-tipo-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tipo === tipo)
  );
}

function getWizardPseudoPlayer() {
  const cls = getSelectedSubclasse() || '';
  const classeBase = getBaseClass(cls) || cls;
  const race = getRacaSelecionada();
  // origemId precisa estar aqui pra getBancoHabilidades saber travar a
  // Aprendizagem Élfica (Habilidade de outra Classe) enquanto a Origem
  // Sangrenta ainda não foi resolvida — sem isso, o wizard deixava escolher
  // Habilidades de outra Classe livremente na criação, mesmo pra quem tem
  // Origem Sangrenta (bug: dava pra pegar depois mais Habilidades da mesma
  // Classe que ficaria travada).
  const origemId = document.getElementById('c-origem')?.value || null;
  const pseudo = { cls, classeBase, level: creationLevel, race, origemId, origemSangrentaUsado: false, origemNoturnaUsada: false, isNPC: wizardIsNPC };
  const catalogo = getBancoHabilidades(pseudo);
  pseudo.skills = wizardSkillsEscolhidas.map(id => {
    const item = catalogo.find(it => it.id === id);
    const bancoOutraClasse = !!(item && item.classeOrigem && item.classeOrigem !== classeBase);
    return { bancoId: id, bancoOutraClasse };
  });
  return pseudo;
}

// Repinta o passo 5 (catálogo do Banco de Habilidades) dentro do wizard de
// criação. Chamado ao entrar no passo e sempre que uma escolha muda.
function renderWizardBancoStep() {
  const pseudo = getWizardPseudoPlayer();

  // Se a Classe/Subclasse mudou desde a última montagem, descarta escolhas
  // antigas (podem não fazer mais sentido para a nova Classe).
  if (wizardSkillsClasseSnapshot !== null && wizardSkillsClasseSnapshot !== pseudo.cls) {
    wizardSkillsEscolhidas = [];
    wizardBancoClasseAtiva = null;
    wizardBancoTabAtiva = null;
  }
  wizardSkillsClasseSnapshot = pseudo.cls;

  const todosItens = getBancoHabilidades(pseudo);
  const COLOR_LABEL = { green: 'Técnica', red: 'Golpe', blue: 'Feitiço', gray: 'Neutra' };
  const clsBase = pseudo.classeBase || '';

  const classeTabsEl = document.getElementById('c-skills-classe-tabs');
  const tabsEl = document.getElementById('c-skills-tabs');
  const lista = document.getElementById('c-skills-lista');
  const progressoEl = document.getElementById('c-skills-progresso');
  if (!tabsEl || !lista) return;

  if (!pseudo.cls || !todosItens.length) {
    if (classeTabsEl) classeTabsEl.innerHTML = '';
    tabsEl.innerHTML = '';
    lista.innerHTML = `<div style="font-size:12px;color:var(--text3);padding:10px 0">${pseudo.cls ? `Nenhuma Habilidade cadastrada ainda para ${clsBase || 'esta classe'}.` : 'Escolha uma Classe no passo anterior para ver as Habilidades disponíveis.'}</div>`;
    if (progressoEl) progressoEl.innerHTML = '';
    return;
  }

  const { nivel, maxOutras, maxTotal } = getBancoLimites(pseudo);
  const { propria, outras, total } = contarBancoEscolhas(pseudo);
  const temOutraClasse = temFonteOutraClasse(pseudo);
  const limiteOutra = getLimiteOutraClasse(pseudo);
  const usadoOutra = contarOutraClasseEscolhas(pseudo);
  if (progressoEl) {
    progressoEl.innerHTML = pseudo.isNPC
      ? `Escolhidas: <strong style="color:var(--text)">${total}</strong> — <span style="color:var(--green)">NPC: sem limite</span>`
      : `Nível ${nivel} · Escolhidas: <strong style="color:var(--text)">${total}/${maxTotal}</strong>`
      + ` (própria subclasse: ${propria} · outras subclasses: ${outras}/${maxOutras})`
      + (total >= maxTotal ? ' <span style="color:var(--accent2)">— limite atingido</span>' : '')
      + (temOutraClasse ? `<br>✨ ${labelFontesOutraClasse(pseudo)} (Habilidade de outra Classe): <strong style="color:var(--text)">${usadoOutra}/${limiteOutra}</strong>` : '');
  }

  // 1º nível — Classes presentes (a própria primeiro, depois as liberadas
  // por Aprendizagem Élfica/Transcendência Intelectual).
  const classesPresentes = [];
  todosItens.forEach(item => {
    if (!classesPresentes.includes(item.classeOrigem)) classesPresentes.push(item.classeOrigem);
  });
  if (!wizardBancoClasseAtiva || !classesPresentes.includes(wizardBancoClasseAtiva)) {
    wizardBancoClasseAtiva = classesPresentes.includes(clsBase) ? clsBase : classesPresentes[0];
  }

  if (classeTabsEl) {
    classeTabsEl.innerHTML = classesPresentes.map(cn => {
      const ativa = cn === wizardBancoClasseAtiva;
      const propria = cn === clsBase;
      return `<button type="button" class="banco-tab ${ativa ? 'active' : ''}" onclick="trocarClasseWizardBanco('${cn}')">${propria ? '★ ' : ''}${cn}</button>`;
    }).join('');
  }

  // 2º nível — Subclasses (Caminhos) dentro da Classe ativa.
  const subsPresentes = [];
  todosItens.forEach(item => {
    if (item.classeOrigem === wizardBancoClasseAtiva && !subsPresentes.includes(item.subclasseOrigem)) subsPresentes.push(item.subclasseOrigem);
  });
  if (!wizardBancoTabAtiva || !subsPresentes.includes(wizardBancoTabAtiva)) {
    wizardBancoTabAtiva = subsPresentes.includes(pseudo.cls) ? pseudo.cls : subsPresentes[0];
  }

  tabsEl.innerHTML = subsPresentes.map(sub => {
    const ativa = sub === wizardBancoTabAtiva;
    const propriaSub = sub === pseudo.cls;
    return `<button type="button" class="banco-tab ${ativa ? 'active' : ''}" onclick="trocarAbaWizardBanco('${sub}')">${propriaSub ? '★ ' : ''}${sub}</button>`;
  }).join('');

  const itens = todosItens.filter(item => item.subclasseOrigem === wizardBancoTabAtiva);
  const abaEhPropria = wizardBancoTabAtiva === pseudo.cls;
  const abaEhOutraClasse = temOutraClasse && itens.length > 0 && itens[0].classeOrigem !== clsBase;

  lista.innerHTML = itens.map(item => {
    const jaTem = wizardSkillsEscolhidas.includes(item.id);
    let bloqueadaPorLimite, labelBtn = 'Escolher';
    if (abaEhOutraClasse) {
      bloqueadaPorLimite = !jaTem && usadoOutra >= limiteOutra;
      if (jaTem) labelBtn = '✓ Escolhida — clique para remover';
      else if (bloqueadaPorLimite) labelBtn = `🔒 Cota de ${labelFontesOutraClasse(pseudo)} esgotada (${usadoOutra}/${limiteOutra})`;
    } else {
      bloqueadaPorLimite = !jaTem && (total >= maxTotal || (!abaEhPropria && outras >= maxOutras));
      if (jaTem) labelBtn = '✓ Escolhida — clique para remover';
      else if (bloqueadaPorLimite) labelBtn = total >= maxTotal ? `🔒 Limite do Nível ${nivel} atingido` : `🔒 Cota livre esgotada (${outras}/${maxOutras})`;
    }
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
      <button class="btn ${jaTem ? '' : (bloqueadaPorLimite ? '' : 'btn-primary')}" style="width:100%;justify-content:center" ${(bloqueadaPorLimite && !jaTem) ? 'disabled' : ''} onclick="toggleWizardSkill('${item.id}')">
        ${labelBtn}
      </button>
    </div>`;
  }).join('');
}

// Troca a Classe ativa (1º nível de aba) no passo de Habilidades do wizard.
function trocarClasseWizardBanco(className) {
  wizardBancoClasseAtiva = className;
  wizardBancoTabAtiva = null;
  renderWizardBancoStep();
}

function trocarAbaWizardBanco(subNome) {
  wizardBancoTabAtiva = subNome;
  renderWizardBancoStep();
}

// ═══════════════════════════════════════
// PASSO 5 DO WIZARD DE CRIAÇÃO — Escolha de Talento Inferior
// ═══════════════════════════════════════
// Um personagem criado já no Nível 2 ou superior tem direito ao Talento
// Inferior desde a criação — mesma regra de getLimiteTalentosInferiores,
// só que usando o creationLevel escolhido no passo 4 em vez de p.level.
// Limite de Talentos Inferiores no wizard: 1 a partir do Nível 2, +2 se o
// Talento Superior "Base Sólida" já tiver sido escolhido neste mesmo wizard
// (mesmo padrão de getLimiteWizardFeiticosLendarios / getLimiteWizardRituaisMacabros).
function getLimiteWizardTalentosInferiores() {
  if (wizardIsNPC) return Infinity;
  let limite = creationLevel >= 2 ? 1 : 0;
  if (wizardTalentosSuperioresEscolhidos.includes('base_solida')) limite += 2;
  return limite;
}

function renderWizardTalentosStep() {
  const secao = document.getElementById('c-talentos-section');
  const aviso = document.getElementById('c-talentos-aviso');
  const lista = document.getElementById('c-talentos-lista');
  const progressoEl = document.getElementById('c-talentos-progresso');
  if (!secao || !lista) return;

  const limite = getLimiteWizardTalentosInferiores();
  const podeRepetir = wizardTalentosSuperioresEscolhidos.includes('base_solida');

  if (wizardTalentosEscolhidos.length > limite) {
    wizardTalentosEscolhidos = wizardTalentosEscolhidos.slice(0, limite);
  }

  if (limite === 0) {
    if (aviso) aviso.style.display = '';
    lista.innerHTML = '';
    if (progressoEl) progressoEl.innerHTML = '';
    wizardTalentosEscolhidos = [];
    return;
  }
  if (aviso) aviso.style.display = 'none';

  if (progressoEl) {
    progressoEl.innerHTML = wizardIsNPC
      ? `Escolhidos: <strong style="color:var(--text)">${wizardTalentosEscolhidos.length}</strong> — <span style="color:var(--green)">NPC: sem limite</span>`
      : `Escolhidos: <strong style="color:var(--text)">${wizardTalentosEscolhidos.length}/${limite}</strong>`
      + (wizardTalentosEscolhidos.length >= limite ? ' <span style="color:var(--accent2)">— limite atingido</span>' : '')
      + (podeRepetir ? ' <span style="color:var(--accent2)">· Base Sólida: pode repetir um já escolhido</span>' : '');
  }

  lista.innerHTML = TALENTOS_INFERIORES.map(item => {
    const qtd = wizardTalentosEscolhidos.filter(id => id === item.id).length;
    const jaTem = qtd > 0;
    const limiteAtingido = wizardTalentosEscolhidos.length >= limite;
    let labelBtn = 'Escolher';
    if (jaTem && !podeRepetir) labelBtn = '✓ Escolhido — clique para remover';
    else if (limiteAtingido) labelBtn = `🔒 Limite atingido (${wizardTalentosEscolhidos.length}/${limite})`;
    else if (jaTem && podeRepetir) labelBtn = `➕ Escolhido ${qtd}x — clique para repetir`;
    const desabilitado = (jaTem && !podeRepetir) ? false : limiteAtingido;
    const removerBtn = (jaTem && podeRepetir)
      ? `<button class="btn" style="width:100%;justify-content:center;margin-top:6px" onclick="removerUmaCopiaWizardTalento('${item.id}')">− Remover uma cópia</button>`
      : '';
    return `
    <div class="skill-card sk-gray" style="margin:0">
      <div class="sk-name">${item.name}</div>
      <div style="font-size:11px;color:var(--text2);margin-bottom:12px;line-height:1.5;white-space:pre-wrap;max-height:110px;overflow-y:auto;padding-right:4px;">${item.desc}</div>
      <button class="btn ${(jaTem && !podeRepetir) ? '' : (desabilitado ? '' : 'btn-primary')}" style="width:100%;justify-content:center" ${desabilitado ? 'disabled' : ''} onclick="toggleWizardTalento('${item.id}')">
        ${labelBtn}
      </button>
      ${removerBtn}
    </div>`;
  }).join('');
}

// Alterna a escolha de um Talento Inferior durante a criação. Sem "Base
// Sólida": clique adiciona/remove (toggle), limite de 1. Com "Base Sólida":
// clique sempre adiciona (permite repetir), respeitando o limite total;
// remoção de uma cópia repetida é feita pelo botão "− Remover uma cópia".
function toggleWizardTalento(talentoId) {
  const podeRepetir = wizardTalentosSuperioresEscolhidos.includes('base_solida');
  const idx = wizardTalentosEscolhidos.indexOf(talentoId);

  if (idx !== -1 && !podeRepetir) {
    wizardTalentosEscolhidos.splice(idx, 1);
    renderWizardTalentosStep();
    return;
  }

  const limite = getLimiteWizardTalentosInferiores();
  if (limite === 0) return;
  if (wizardTalentosEscolhidos.length >= limite) {
    alert(`Limite de Talento Inferior atingido (máx. ${limite}).`);
    return;
  }
  wizardTalentosEscolhidos.push(talentoId);
  renderWizardTalentosStep();
}

// Remove uma única cópia de um Talento Inferior repetido (usado só quando
// "Base Sólida" permite repetição — o toggle normal não serve pra isso
// porque, nesse caso, clicar no card sempre adiciona outra cópia).
function removerUmaCopiaWizardTalento(talentoId) {
  const idx = wizardTalentosEscolhidos.indexOf(talentoId);
  if (idx === -1) return;
  wizardTalentosEscolhidos.splice(idx, 1);
  renderWizardTalentosStep();
}

// ═══════════════════════════════════════
// PASSO 5 DO WIZARD DE CRIAÇÃO — Escolha de Talento Superior
// ═══════════════════════════════════════
// Um personagem criado já no Nível 4 ou superior tem direito ao Talento
// Superior desde a criação — mesma regra de getLimiteTalentosSuperiores, só
// que usando o creationLevel escolhido no passo 4 em vez de p.level.
function getLimiteWizardTalentosSuperiores() {
  if (wizardIsNPC) return Infinity;
  return creationLevel >= 4 ? 1 : 0;
}

function renderWizardTalentosSuperioresStep() {
  const secao = document.getElementById('c-talentos-superiores-section');
  const aviso = document.getElementById('c-talentos-superiores-aviso');
  const lista = document.getElementById('c-talentos-superiores-lista');
  const progressoEl = document.getElementById('c-talentos-superiores-progresso');
  if (!secao || !lista) return;

  const limite = getLimiteWizardTalentosSuperiores();

  if (limite === 0) {
    if (aviso) aviso.style.display = '';
    lista.innerHTML = '';
    if (progressoEl) progressoEl.innerHTML = '';
    wizardTalentosSuperioresEscolhidos = [];
    return;
  }
  if (aviso) aviso.style.display = 'none';

  if (progressoEl) {
    progressoEl.innerHTML = wizardIsNPC
      ? `Escolhidos: <strong style="color:var(--text)">${wizardTalentosSuperioresEscolhidos.length}</strong> — <span style="color:var(--green)">NPC: sem limite</span>`
      : `Escolhidos: <strong style="color:var(--text)">${wizardTalentosSuperioresEscolhidos.length}/${limite}</strong>`
      + (wizardTalentosSuperioresEscolhidos.length >= limite ? ' <span style="color:var(--accent2)">— limite atingido</span>' : '');
  }

  lista.innerHTML = TALENTOS_SUPERIORES.map(item => {
    const jaTem = wizardTalentosSuperioresEscolhidos.includes(item.id);
    const bloqueado = !jaTem && wizardTalentosSuperioresEscolhidos.length >= limite;
    let labelBtn = 'Escolher';
    if (jaTem) labelBtn = '✓ Escolhido — clique para remover';
    else if (bloqueado) labelBtn = `🔒 Limite atingido (${wizardTalentosSuperioresEscolhidos.length}/${limite})`;
    return `
    <div class="skill-card sk-gray" style="margin:0">
      <div class="sk-name">${item.name}</div>
      <div style="font-size:11px;color:var(--text2);margin-bottom:12px;line-height:1.5;white-space:pre-wrap;max-height:110px;overflow-y:auto;padding-right:4px;">${item.desc}</div>
      <button class="btn ${jaTem ? '' : (bloqueado ? '' : 'btn-primary')}" style="width:100%;justify-content:center" ${(bloqueado && !jaTem) ? 'disabled' : ''} onclick="toggleWizardTalentoSuperior('${item.id}')">
        ${labelBtn}
      </button>
    </div>`;
  }).join('');
}

// Alterna a escolha de um Talento Superior durante a criação (adiciona se
// ainda não tinha, remove se já tinha). Limite de 1, só a partir do Nível 4.
function toggleWizardTalentoSuperior(talentoId) {
  const idx = wizardTalentosSuperioresEscolhidos.indexOf(talentoId);
  if (idx !== -1) {
    wizardTalentosSuperioresEscolhidos.splice(idx, 1);
    renderWizardTalentosSuperioresStep();
    if (typeof renderWizardTalentosStep === 'function') renderWizardTalentosStep();
    if (typeof renderWizardFeiticosLendariosStep === 'function') renderWizardFeiticosLendariosStep();
    if (typeof renderWizardRituaisMacabrosStep === 'function') renderWizardRituaisMacabrosStep();
    return;
  }
  const limite = getLimiteWizardTalentosSuperiores();
  if (limite === 0) return;
  if (wizardTalentosSuperioresEscolhidos.length >= limite) {
    alert(`Limite de Talento Superior atingido (máx. ${limite}).`);
    return;
  }
  wizardTalentosSuperioresEscolhidos.push(talentoId);
  renderWizardTalentosSuperioresStep();
  if (typeof renderWizardTalentosStep === 'function') renderWizardTalentosStep();
  if (typeof renderWizardFeiticosLendariosStep === 'function') renderWizardFeiticosLendariosStep();
  if (typeof renderWizardRituaisMacabrosStep === 'function') renderWizardRituaisMacabrosStep();
}

// ═══════════════════════════════════════
// PASSO 5 DO WIZARD DE CRIAÇÃO — Escolha de Feitiço Lendário
// ═══════════════════════════════════════
// Um personagem criado já como Conjurador no Nível 5+ ou que já escolheu o
// Talento Superior "Transcendência Mental" neste mesmo wizard tem direito a
// escolher 1 Feitiço Lendário por fonte (as fontes se somam) desde a criação.
function getLimiteWizardFeiticosLendarios() {
  const pseudo = getWizardPseudoPlayer();
  let limite = 0;
  if (pseudo.cls === 'Conjurador' && creationLevel >= 5) limite += 1;
  if (wizardTalentosSuperioresEscolhidos.includes('transcendencia_mental')) limite += 1;
  return limite;
}

function renderWizardFeiticosLendariosStep() {
  const secao = document.getElementById('c-feiticos-lendarios-section');
  const aviso = document.getElementById('c-feiticos-lendarios-aviso');
  const lista = document.getElementById('c-feiticos-lendarios-lista');
  const progressoEl = document.getElementById('c-feiticos-lendarios-progresso');
  if (!secao || !lista) return;

  const limite = getLimiteWizardFeiticosLendarios();

  if (wizardFeiticosLendariosEscolhidos.length > limite) {
    wizardFeiticosLendariosEscolhidos = wizardFeiticosLendariosEscolhidos.slice(0, limite);
  }

  if (limite === 0) {
    if (aviso) aviso.style.display = '';
    lista.innerHTML = '';
    if (progressoEl) progressoEl.innerHTML = '';
    wizardFeiticosLendariosEscolhidos = [];
    return;
  }
  if (aviso) aviso.style.display = 'none';

  const intel = parseInt(document.getElementById('c-int')?.value) || 5;
  const mstLendaria = Math.ceil(maestria(intel) / 2);

  if (progressoEl) {
    progressoEl.innerHTML = `Escolhidos: <strong style="color:var(--text)">${wizardFeiticosLendariosEscolhidos.length}/${limite}</strong>`
      + (wizardFeiticosLendariosEscolhidos.length >= limite ? ' <span style="color:var(--accent2)">— limite atingido</span>' : '')
      + ` · Maestria Lendária: <strong style="color:var(--text)">+${mstLendaria}</strong> (Intelecto/2)`;
  }

  lista.innerHTML = FEITICOS_LENDARIOS.map(item => {
    const jaTem = wizardFeiticosLendariosEscolhidos.includes(item.id);
    const bloqueado = !jaTem && wizardFeiticosLendariosEscolhidos.length >= limite;
    let labelBtn = 'Escolher';
    if (jaTem) labelBtn = '✓ Escolhido — clique para remover';
    else if (bloqueado) labelBtn = `🔒 Limite atingido (${wizardFeiticosLendariosEscolhidos.length}/${limite})`;
    return `
    <div class="skill-card sk-blue" style="margin:0">
      <div class="sk-name">${item.name}</div>
      <div class="sk-tags"><span class="sk-tag">${item.cost === 0 ? '0 ações' : item.cost === 1 ? '1 ação' : '2 ações'}</span><span class="sk-tag">${item.usosMax}x/sessão</span><span class="sk-tag sk-tag-mst">🌟 +${mstLendaria} maestria (lendária)</span></div>
      <div style="font-size:11px;color:var(--text2);margin:8px 0 12px;line-height:1.5;white-space:pre-wrap;max-height:110px;overflow-y:auto;padding-right:4px;">${item.desc}</div>
      <button class="btn ${jaTem ? '' : (bloqueado ? '' : 'btn-primary')}" style="width:100%;justify-content:center" ${(bloqueado && !jaTem) ? 'disabled' : ''} onclick="toggleWizardFeiticoLendario('${item.id}')">
        ${labelBtn}
      </button>
    </div>`;
  }).join('');
}

// Alterna a escolha de um Feitiço Lendário durante a criação (adiciona se
// ainda não tinha, remove se já tinha). Limite dado por getLimiteWizardFeiticosLendarios.
function toggleWizardFeiticoLendario(itemId) {
  const idx = wizardFeiticosLendariosEscolhidos.indexOf(itemId);
  if (idx !== -1) {
    wizardFeiticosLendariosEscolhidos.splice(idx, 1);
    renderWizardFeiticosLendariosStep();
    return;
  }
  const limite = getLimiteWizardFeiticosLendarios();
  if (limite === 0) return;
  if (wizardFeiticosLendariosEscolhidos.length >= limite) {
    alert(`Limite de Feitiços Lendários atingido (máx. ${limite}).`);
    return;
  }
  wizardFeiticosLendariosEscolhidos.push(itemId);
  renderWizardFeiticosLendariosStep();
}

// ═══════════════════════════════════════
// PASSO 5 DO WIZARD DE CRIAÇÃO — Escolha de Ritual Macabro
// ═══════════════════════════════════════
// Um personagem que já escolheu o Talento Superior "Vínculo Místico" neste
// mesmo wizard tem direito a escolher 1 Ritual Macabro desde a criação.
function getLimiteWizardRituaisMacabros() {
  return wizardTalentosSuperioresEscolhidos.includes('vinculo_mistico') ? 1 : 0;
}

function renderWizardRituaisMacabrosStep() {
  const secao = document.getElementById('c-rituais-macabros-section');
  const aviso = document.getElementById('c-rituais-macabros-aviso');
  const lista = document.getElementById('c-rituais-macabros-lista');
  const progressoEl = document.getElementById('c-rituais-macabros-progresso');
  if (!secao || !lista) return;

  const limite = getLimiteWizardRituaisMacabros();

  if (wizardRituaisMacabrosEscolhidos.length > limite) {
    wizardRituaisMacabrosEscolhidos = wizardRituaisMacabrosEscolhidos.slice(0, limite);
  }

  if (limite === 0) {
    if (aviso) aviso.style.display = '';
    lista.innerHTML = '';
    if (progressoEl) progressoEl.innerHTML = '';
    wizardRituaisMacabrosEscolhidos = [];
    return;
  }
  if (aviso) aviso.style.display = 'none';

  if (progressoEl) {
    progressoEl.innerHTML = `Escolhidos: <strong style="color:var(--text)">${wizardRituaisMacabrosEscolhidos.length}/${limite}</strong>`
      + (wizardRituaisMacabrosEscolhidos.length >= limite ? ' <span style="color:var(--accent2)">— limite atingido</span>' : '');
  }

  lista.innerHTML = RITUAIS_MACABROS.map(item => {
    const jaTem = wizardRituaisMacabrosEscolhidos.includes(item.id);
    const bloqueado = !jaTem && wizardRituaisMacabrosEscolhidos.length >= limite;
    let labelBtn = 'Escolher';
    if (jaTem) labelBtn = '✓ Escolhido — clique para remover';
    else if (bloqueado) labelBtn = `🔒 Limite atingido (${wizardRituaisMacabrosEscolhidos.length}/${limite})`;
    return `
    <div class="skill-card sk-gray" style="margin:0">
      <div class="sk-name">${item.name}</div>
      <div class="sk-tags"><span class="sk-tag">${item.cost === 0 ? '0 ações' : item.cost === 1 ? '1 ação' : '2 ações'}</span><span class="sk-tag">${tipoLabel(item)}</span>${item.concedeNota ? `<span class="sk-tag" style="background:var(--bardo-dim);color:#f0dba0">🎵 ${item.concedeNota === 'qualquer' ? 'escolha uma nota' : item.concedeNota}</span>` : ''}</div>
      <div style="font-size:11px;color:var(--text2);margin:8px 0 12px;line-height:1.5;white-space:pre-wrap;max-height:110px;overflow-y:auto;padding-right:4px;">${item.desc}</div>
      ${renderCorromperHtml('wizard-' + item.id, item)}
      <button class="btn ${jaTem ? '' : (bloqueado ? '' : 'btn-primary')}" style="width:100%;justify-content:center;margin-top:10px" ${(bloqueado && !jaTem) ? 'disabled' : ''} onclick="toggleWizardRitualMacabro('${item.id}')">
        ${labelBtn}
      </button>
    </div>`;
  }).join('');
}

// Alterna a escolha de um Ritual Macabro durante a criação (adiciona se
// ainda não tinha, remove se já tinha). Limite dado por getLimiteWizardRituaisMacabros.
function toggleWizardRitualMacabro(itemId) {
  const idx = wizardRituaisMacabrosEscolhidos.indexOf(itemId);
  if (idx !== -1) {
    wizardRituaisMacabrosEscolhidos.splice(idx, 1);
    renderWizardRituaisMacabrosStep();
    return;
  }
  const limite = getLimiteWizardRituaisMacabros();
  if (limite === 0) return;
  if (wizardRituaisMacabrosEscolhidos.length >= limite) {
    alert(`Limite de Rituais Macabros atingido (máx. ${limite}).`);
    return;
  }
  wizardRituaisMacabrosEscolhidos.push(itemId);
  renderWizardRituaisMacabrosStep();
}

// Repinta a escolha de Armadura inicial (passo 5 do wizard de criação).
// As opções disponíveis vêm do CATALOGO_ITENS.protecao (subtipo armadura),
// filtradas pelas categorias de peso liberadas pelo atributo principal da
// subclasse escolhida (ver getPesosArmaduraPermitidos). Escolha única —
// selecionar outra troca a anterior; clicar na já escolhida remove.
function renderWizardArmaduraStep() {
  const lista = document.getElementById('c-armadura-lista');
  const aviso = document.getElementById('c-armadura-aviso');
  if (!lista) return;

  const cls = getSelectedSubclasse();
  if (!cls) {
    lista.innerHTML = '';
    if (aviso) { aviso.style.display = ''; aviso.textContent = 'Escolha uma Classe no passo anterior para liberar as opções de Armadura.'; }
    return;
  }

  const pesosPermitidos = wizardIsNPC ? ORDEM_PESO_ARMADURA.slice() : getPesosArmaduraPermitidos(cls);
  const opcoes = CATALOGO_ITENS.protecao.filter(item => item.subtipo === 'armadura' && pesosPermitidos.includes(item.peso));

  // Descarta uma escolha antiga que não seja mais válida (ex.: trocou de subclasse/atributo).
  if (wizardArmaduraEscolhidaId && !opcoes.some(o => o.id === wizardArmaduraEscolhidaId)) {
    wizardArmaduraEscolhidaId = null;
  }

  if (aviso) {
    aviso.style.display = '';
    aviso.textContent = wizardIsNPC
      ? 'NPC: todas as categorias de peso de Armadura estão liberadas.'
      : `Categorias liberadas por ${cls}: ${pesosPermitidos.map(p => INV_PESO_LABEL[p] || p).join(', ')}.`;
  }

  if (!opcoes.length) {
    lista.innerHTML = `<div style="font-size:11px;color:var(--text3);padding:6px 2px">Nenhuma armadura disponível no catálogo para essas categorias ainda.</div>`;
    return;
  }

  lista.innerHTML = opcoes.map(item => {
    const jaEscolhida = wizardArmaduraEscolhidaId === item.id;
    return `
    <div class="skill-card sk-gray" style="margin:0">
      <div class="sk-name">${item.name}</div>
      <div class="sk-tags"><span class="sk-tag">${INV_PESO_LABEL[item.peso] || item.peso}</span><span class="sk-tag">🛡 ${item.valor}</span><span class="sk-tag">💰 ${item.preco}</span>${item.passosPenalidade ? `<span class="sk-tag">👣 -${item.passosPenalidade}</span>` : ''}</div>
      ${item.efeito ? `<div style="font-size:11px;color:var(--text2);margin:8px 0 12px;line-height:1.5">${item.efeito}</div>` : ''}
      <button class="btn ${jaEscolhida ? '' : 'btn-primary'}" style="width:100%;justify-content:center;margin-top:6px" onclick="toggleWizardArmadura('${item.id}')">
        ${jaEscolhida ? '✓ Escolhida — clique para remover' : 'Escolher'}
      </button>
    </div>`;
  }).join('');
}

// Alterna a escolha de Armadura inicial durante a criação — escolha única
// (selecionar uma nova substitui a anterior; clicar na já escolhida remove).
function toggleWizardArmadura(itemId) {
  wizardArmaduraEscolhidaId = (wizardArmaduraEscolhidaId === itemId) ? null : itemId;
  renderWizardArmaduraStep();
}

// Repinta a escolha de Elmo inicial (passo 8 do wizard de criação) — mesma
// lógica da Armadura (ver renderWizardArmaduraStep): opções filtradas pelas
// categorias de peso liberadas pelo atributo principal da subclasse.
function renderWizardElmoStep() {
  const lista = document.getElementById('c-elmo-lista');
  const aviso = document.getElementById('c-elmo-aviso');
  if (!lista) return;

  const cls = getSelectedSubclasse();
  if (!cls) {
    lista.innerHTML = '';
    if (aviso) { aviso.style.display = ''; aviso.textContent = 'Escolha uma Classe no passo anterior para liberar as opções de Elmo.'; }
    return;
  }

  const pesosPermitidos = wizardIsNPC ? ORDEM_PESO_ARMADURA.slice() : getPesosArmaduraPermitidos(cls);
  const opcoes = CATALOGO_ITENS.protecao.filter(item => item.subtipo === 'elmo' && pesosPermitidos.includes(item.peso));

  // Descarta uma escolha antiga que não seja mais válida (ex.: trocou de subclasse/atributo).
  if (wizardElmoEscolhidaId && !opcoes.some(o => o.id === wizardElmoEscolhidaId)) {
    wizardElmoEscolhidaId = null;
  }

  if (aviso) {
    aviso.style.display = '';
    aviso.textContent = wizardIsNPC
      ? 'NPC: todas as categorias de peso de Elmo estão liberadas.'
      : `Categorias liberadas por ${cls}: ${pesosPermitidos.map(p => INV_PESO_LABEL[p] || p).join(', ')}.`;
  }

  if (!opcoes.length) {
    lista.innerHTML = `<div style="font-size:11px;color:var(--text3);padding:6px 2px">Nenhum elmo disponível no catálogo para essas categorias ainda.</div>`;
    return;
  }

  lista.innerHTML = opcoes.map(item => {
    const jaEscolhido = wizardElmoEscolhidaId === item.id;
    return `
    <div class="skill-card sk-gray" style="margin:0">
      <div class="sk-name">${item.name}</div>
      <div class="sk-tags"><span class="sk-tag">${INV_PESO_LABEL[item.peso] || item.peso}</span><span class="sk-tag">🛡 ${item.valor}</span><span class="sk-tag">💰 ${item.preco}</span></div>
      ${item.efeito ? `<div style="font-size:11px;color:var(--text2);margin:8px 0 12px;line-height:1.5">${item.efeito}</div>` : ''}
      <button class="btn ${jaEscolhido ? '' : 'btn-primary'}" style="width:100%;justify-content:center;margin-top:6px" onclick="toggleWizardElmo('${item.id}')">
        ${jaEscolhido ? '✓ Escolhido — clique para remover' : 'Escolher'}
      </button>
    </div>`;
  }).join('');
}

// Alterna a escolha de Elmo inicial durante a criação — escolha única
// (selecionar um novo substitui o anterior; clicar no já escolhido remove).
function toggleWizardElmo(itemId) {
  wizardElmoEscolhidaId = (wizardElmoEscolhidaId === itemId) ? null : itemId;
  renderWizardElmoStep();
}

// Repinta a escolha de Arma/Instrumento inicial (passo 9 do wizard de
// criação). Diferente da Armadura/Elmo (cumulativo), aqui o acesso por
// atributo é EXCLUSIVO — ver getPesosArmaPermitidos — e as opções vêm dos
// catálogos de Arma E Instrumento combinados (o jogador escolhe entre os dois).
function renderWizardArmaStep() {
  const lista = document.getElementById('c-arma-lista');
  const aviso = document.getElementById('c-arma-aviso');
  if (!lista) return;

  const cls = getSelectedSubclasse();
  if (!cls) {
    lista.innerHTML = '';
    if (aviso) { aviso.style.display = ''; aviso.textContent = 'Escolha uma Classe no passo anterior para liberar as opções de Arma.'; }
    return;
  }

  const pesosPermitidos = wizardIsNPC ? ORDEM_PESO_ARMADURA.slice() : getPesosArmaPermitidos(cls);
  const opcoesArma = CATALOGO_ITENS.arma.filter(item => pesosPermitidos.includes(item.peso)).map(item => ({ ...item, _tipo: 'arma' }));
  const opcoesInstrumento = CATALOGO_ITENS.instrumento.filter(item => pesosPermitidos.includes(item.peso)).map(item => ({ ...item, _tipo: 'instrumento' }));
  const opcoes = [...opcoesArma, ...opcoesInstrumento];

  // Descarta uma escolha antiga que não seja mais válida (ex.: trocou de subclasse/atributo).
  if (wizardArmaEscolhidaId && !opcoes.some(o => o.id === wizardArmaEscolhidaId && o._tipo === wizardArmaEscolhidaTipo)) {
    wizardArmaEscolhidaId = null;
    wizardArmaEscolhidaTipo = null;
  }

  if (aviso) {
    aviso.style.display = '';
    aviso.textContent = wizardIsNPC
      ? 'NPC: todas as categorias de peso de Arma/Instrumento estão liberadas.'
      : `Categoria liberada por ${cls}: ${pesosPermitidos.map(p => INV_PESO_LABEL[p] || p).join(', ')}.`;
  }

  if (!opcoes.length) {
    lista.innerHTML = `<div style="font-size:11px;color:var(--text3);padding:6px 2px">Nenhuma arma ou instrumento disponível no catálogo para essa categoria ainda.</div>`;
    return;
  }

  lista.innerHTML = opcoes.map(item => {
    const jaEscolhido = wizardArmaEscolhidaId === item.id && wizardArmaEscolhidaTipo === item._tipo;
    return `
    <div class="skill-card sk-gray" style="margin:0">
      <div class="sk-name">${item.name} <span style="font-size:10px;font-weight:400;color:var(--text3)">(${item._tipo === 'instrumento' ? 'Instrumento' : 'Arma'})</span></div>
      <div class="sk-tags"><span class="sk-tag">${INV_PESO_LABEL[item.peso] || item.peso}</span>${item.dano ? `<span class="sk-tag">🗡 ${item.dano}</span>` : ''}<span class="sk-tag">💰 ${item.preco}</span></div>
      ${item.efeito ? `<div style="font-size:11px;color:var(--text2);margin:8px 0 12px;line-height:1.5">${item.efeito}</div>` : ''}
      <button class="btn ${jaEscolhido ? '' : 'btn-primary'}" style="width:100%;justify-content:center;margin-top:6px" onclick="toggleWizardArma('${item._tipo}','${item.id}')">
        ${jaEscolhido ? '✓ Escolhido — clique para remover' : 'Escolher'}
      </button>
    </div>`;
  }).join('');
}

// Alterna a escolha de Arma/Instrumento inicial durante a criação — escolha
// única (selecionar uma nova substitui a anterior; clicar na já escolhida remove).
function toggleWizardArma(tipo, itemId) {
  if (wizardArmaEscolhidaId === itemId && wizardArmaEscolhidaTipo === tipo) {
    wizardArmaEscolhidaId = null;
    wizardArmaEscolhidaTipo = null;
  } else {
    wizardArmaEscolhidaId = itemId;
    wizardArmaEscolhidaTipo = tipo;
  }
  renderWizardArmaStep();
}

// Alterna a escolha de uma Habilidade do banco durante a criação (adiciona
// se ainda não tinha, remove se já tinha). Respeita os mesmos limites de
// Nível usados no jogo já formado (getBancoLimites/contarBancoEscolhas).
function toggleWizardSkill(bancoId) {
  const idx = wizardSkillsEscolhidas.indexOf(bancoId);
  if (idx !== -1) {
    wizardSkillsEscolhidas.splice(idx, 1);
    renderWizardBancoStep();
    return;
  }

  const pseudo = getWizardPseudoPlayer();
  const item = getBancoHabilidades(pseudo).find(h => h.id === bancoId);
  if (!item) return;

  const ehOutraClasse = temFonteOutraClasse(pseudo) && item.classeOrigem && item.classeOrigem !== pseudo.classeBase;
  if (ehOutraClasse) {
    const limiteOutra = getLimiteOutraClasse(pseudo);
    const usadoOutra = contarOutraClasseEscolhas(pseudo);
    if (usadoOutra >= limiteOutra) {
      alert(`Limite de ${labelFontesOutraClasse(pseudo)} atingido para o Nível ${pseudo.level} (máx. ${limiteOutra}).`);
      return;
    }
    wizardSkillsEscolhidas.push(bancoId);
    renderWizardBancoStep();
    return;
  }

  const { nivel, maxOutras, maxTotal } = getBancoLimites(pseudo);
  const { outras, total } = contarBancoEscolhas(pseudo);
  const ehPropria = item.subclasseOrigem === pseudo.cls;

  if (total >= maxTotal) {
    alert(`Limite de Habilidades do Banco atingido para o Nível ${nivel} (máx. ${maxTotal}).`);
    return;
  }
  if (!ehPropria && outras >= maxOutras) {
    alert(`No Nível ${nivel}, você só pode escolher ${maxOutras} Habilidade${maxOutras === 1 ? '' : 's'} de outra subclasse.`);
    return;
  }

  wizardSkillsEscolhidas.push(bancoId);
  renderWizardBancoStep();
}

// ═══════════════════════════════════════
// FORMA DE DRAGÃO — Metamorfose
// ═══════════════════════════════════════
// Habilidades raciais do Dragão que só existem enquanto ele estiver na
// forma Dracônica (após usar a Metamorfose). A própria "Metamorfose" NÃO
// entra nessa lista, pois é a habilidade usada para entrar/sair da forma.
const DRAGAO_FORMA_SKILL_IDS = ['sk_racial_dragao_iniciar_voo', 'sk_racial_dragao_impacto_pouso'];

// Habilidades de Classe: escolhidas do banco de subclasse (bancoId), fixas
// de Subclasse/Classe-base (SUBCLASSES_SKILLS/CLASSES_SKILLS), ou vinculadas
// a uma arma/instrumento (Encantamento, Feitiço Lendário, Ritual Macabro).
// Todas ficam indisponíveis na Forma de Dragão.
function isHabilidadeDeClasse(p, sk) {
  if (sk.bancoId || sk.lendario || sk.ritualMacabro || sk.encantamentoItemId) return true;
  if ((SUBCLASSES_SKILLS[p.cls] || []).some(d => d.id === sk.id)) return true;
  if ((CLASSES_SKILLS[p.classeBase] || []).some(d => d.id === sk.id)) return true;
  return false;
}

// Valores da Armadura/Elmo Dracônicos, escalando com o Nível atual.
function valorArmaduraDraconica(p) { return 7 + (p.level || 1); }
function valorElmoDraconico(p) { return 5 + (p.level || 1); }

// Fora da forma de Dragão, remove do personagem: Iniciar Voo, Impacto de
// Pouso, o Sopro da sua Revoada (cor correspondente à origem escolhida) e a
// arma Garras Dracônicas. Enquanto p.formaDragao estiver ativo, não faz nada
// — quem reinjeta essas habilidades/arma é o ensureRacePassivas() normal,
// chamado logo após a Metamorfose ser ativada.
function syncFormaDragaoLock(p) {
  if (p.race !== 'Dragão') return;
  if (typeof p.formaDragao !== 'boolean') p.formaDragao = false;
  if (p.formaDragao) return;

  if (Array.isArray(p.skills)) {
    const origemAtual = getOrigemPersonagem(p);
    const soproId = (origemAtual && origemAtual.skill) ? origemAtual.skill.id : null;
    p.skills = p.skills.filter(sk => !DRAGAO_FORMA_SKILL_IDS.includes(sk.id) && sk.id !== soproId);
  }
  if (Array.isArray(p.inventario)) {
    p.inventario = p.inventario.filter(it => it.racialId !== 'racial_dragao_garras_draconicas');
  }
}

// Ativa ou desativa a forma de Dragão.
// Ao ATIVAR: guarda as Habilidades de Classe e todas as Armas/Instrumentos em
// p.formaDragaoBackup, remove tudo isso do personagem, concede a Armadura e o
// Elmo Dracônicos (valor = 7/5 + Nível), e reinjeta o Sopro da Revoada,
// Iniciar Voo, Impacto de Pouso e as Garras Dracônicas (via
// ensureRacePassivas, que é idempotente).
// Ao DESATIVAR: remove a Armadura/Elmo Dracônicos e devolve as Habilidades de
// Classe e Armas/Instrumentos guardadas; syncFormaDragaoLock (chamado dentro
// de ensureRacePassivas) remove o Sopro/Iniciar Voo/Impacto/Garras de novo.
function setFormaDragao(p, active) {
  const estava = !!p.formaDragao;
  const vaiFicar = !!active;
  if (estava === vaiFicar) { p.formaDragao = vaiFicar; ensureRacePassivas(p); return; }

  if (!Array.isArray(p.skills)) p.skills = [];
  if (!Array.isArray(p.inventario)) p.inventario = [];

  if (vaiFicar) {
    // Entrando na Forma de Dragão: guarda e remove Habilidades de Classe e
    // Armas/Instrumentos, e concede a Armadura/Elmo Dracônicos.
    // Exceção — "Espectro Dracônico" (passiva liberada no Nível 3): a partir
    // daí, as Habilidades de Classe continuam disponíveis na Forma de
    // Dragão, então não são removidas (só as Armas/Instrumentos, que viram
    // as Garras Dracônicas normalmente).
    const temEspectroDraconico = p.isNPC || (p.race === 'Dragão' && (p.level || 1) >= 3);
    const skillsClasse = temEspectroDraconico ? [] : p.skills.filter(sk => isHabilidadeDeClasse(p, sk));
    const armasInstrumentos = p.inventario.filter(it => it.tipo === 'arma' || it.tipo === 'instrumento');
    const protecaoEquipadaIds = p.inventario
      .filter(it => it.tipo === 'protecao' && it.equipado && (it.subtipo === 'armadura' || it.subtipo === 'elmo'))
      .map(it => it.id);
    p.formaDragaoBackup = {
      skills: JSON.parse(JSON.stringify(skillsClasse)),
      inventario: JSON.parse(JSON.stringify(armasInstrumentos)),
      protecaoEquipadaIds,
    };
    if (!temEspectroDraconico) {
      p.skills = p.skills.filter(sk => !isHabilidadeDeClasse(p, sk));
    }
    p.inventario = p.inventario.filter(it => !(it.tipo === 'arma' || it.tipo === 'instrumento'));

    // Desequipa qualquer Armadura/Elmo normal antes de equipar os Dracônicos
    // (só 1 equipado por subtipo, mesma regra do resto do app).
    p.inventario.forEach(it => {
      if (it.tipo === 'protecao' && (it.subtipo === 'armadura' || it.subtipo === 'elmo')) it.equipado = false;
    });

    p.inventario.push({
      id: 'inv_dragao_armadura_' + p.id, tipo: 'protecao', subtipo: 'armadura', peso: 'encantada',
      name: 'Armadura Dracônica', valor: valorArmaduraDraconica(p), preco: 0, equipado: true,
      efeito: 'Armadura natural da Forma de Dragão (7 + Nível de Armadura). Enquanto equipada, sua Armadura nunca pode ser reduzida para menos de 5.',
      dragaoForma: true,
    });
    p.inventario.push({
      id: 'inv_dragao_elmo_' + p.id, tipo: 'protecao', subtipo: 'elmo', peso: 'encantada',
      name: 'Elmo Dracônico', valor: valorElmoDraconico(p), preco: 0, equipado: true,
      efeito: 'Elmo natural da Forma de Dragão (5 + Nível de Armadura). Enquanto equipado, seu Elmo nunca pode ser reduzido para menos de 5.',
      dragaoForma: true,
    });
    if ((p.armadura || 0) < 5) p.armadura = 5;
    if ((p.elmo || 0) < 5) p.elmo = 5;

    // Passos ficam congelados no valor de antes de se transformar (a Forma
    // de Dragão não recalcula Passos pela Armadura/Elmo Dracônicos — ver
    // recomputeProtMax, que pula o recálculo enquanto p.formaDragao=true).
    p.formaDragaoBackup.passosAntes = p.passos;

    // Mega Desvantagem em Desviar, sempre que estiver na Forma de Dragão —
    // guarda o estado anterior do Teste de Desviar (mv/md) pra restaurar ao
    // voltar à forma normal.
    getTestePersonagem(p);
    p.formaDragaoBackup.desviarMvMd = { mv: p.testes.desviar.mv, md: p.testes.desviar.md };
    p.testes.desviar.mv = false;
    p.testes.desviar.md = true;
  } else {
    // Saindo da Forma de Dragão: remove Armadura/Elmo Dracônicos e devolve
    // as Habilidades de Classe e Armas/Instrumentos guardadas.
    p.inventario = p.inventario.filter(it => !it.dragaoForma);
    const backup = p.formaDragaoBackup || { skills: [], inventario: [], protecaoEquipadaIds: [] };
    (backup.skills || []).forEach(sk => { if (!p.skills.some(s => s.id === sk.id)) p.skills.push(sk); });
    (backup.inventario || []).forEach(it => { if (!p.inventario.some(i => i.id === it.id)) p.inventario.push(it); });
    (backup.protecaoEquipadaIds || []).forEach(id => {
      const it = p.inventario.find(i => i.id === id);
      if (it) it.equipado = true;
    });
    // Restaura o Teste de Desviar (mv/md) de antes da transformação.
    getTestePersonagem(p);
    const desviarAntes = backup.desviarMvMd || { mv: false, md: false };
    p.testes.desviar.mv = desviarAntes.mv;
    p.testes.desviar.md = desviarAntes.md;
    p.formaDragaoBackup = null;
  }

  p.formaDragao = vaiFicar;
  ensureRacePassivas(p);
  recomputeProtMax(p);
}

// ═══════════════════════════════════════
// EXPRESSÕES ETÉREAS — exclusivo do Etéreo
// ═══════════════════════════════════════
// Ligadas à passiva "Entropia Constante": ao tirar um Acerto Crítico ou Erro
// Crítico numa Ação ou Teste, o Etéreo rola 1d6 para saber qual Expressão
// Etérea se manifesta. Os índices 1–4 são padrão para qualquer Etéreo.
// Os índices 5 e 6 variam conforme a Origem escolhida:
//   - Natural  → Levitação em Massa (5) + Transmutação (6)
//   - Mística  → Éter Macabro (5) + Metamorfose Cósmica (6)
const ETEREO_EXPRESSOES_PADRAO = [
  {
    id: 'expressao_aprisionamento_eter',
    indice: 1,
    name: 'Aprisionamento do Éter',
    desc: 'O Éter do seu corpo manifesta no Espaço da Cena/Luta. Se foi Erro Crítico, correntes de Éter aprisionam você ou um Aliado por um turno. Se foi um Acerto Crítico, as correntes do Éter aprisionam um Alvo por um turno. (Não pode se mover e nem Desviar)',
  },
  {
    id: 'expressao_catalisador_etereo',
    indice: 2,
    name: 'Catalisador Etéreo',
    desc: 'O Éter do seu corpo altera a sua velocidade. Se foi Erro Crítico, você perde uma Ação no próximo turno. Se foi um Acerto Crítico, recebe uma Ação a mais no próximo turno.',
  },
  {
    id: 'expressao_lampejo_forcado',
    indice: 3,
    name: 'Lampejo Forçado',
    desc: 'O Éter do seu corpo abre um portal nos seus pés. Se foi Erro Crítico, troca de lugar com um Aliado para sofrer as consequências no seu lugar! Se foi um Acerto Crítico, você se teletransporta até o mesmo número de Passos que você tiver.',
  },
  {
    id: 'expressao_radiacao_cosmica',
    indice: 4,
    name: 'Radiação Cósmica',
    desc: 'O Éter do seu corpo vibra tanto que libera uma radiação cósmica, causando 1d8 de Dano na Vida. Se foi Erro Crítico, o alvo será um Aliado até 8 casas. Se foi Acerto Crítico, o alvo será quem você quiser até 8 casas.',
  },
];

// Expressões de origem — cada Origem do Etéreo contribui com 2 expressões (índices 5 e 6).
const ETEREO_EXPRESSOES_ORIGEM = {
  'etereo_origem_natural': [
    {
      id: 'expressao_levitacao_em_massa',
      indice: 5,
      name: 'Levitação em Massa',
      origemName: 'Natural',
      desc: 'O éter do seu corpo se manifesta e levita objetos leves por um turno. Em caso de Erro Crítico, também levita todas as armas leves e pessoas com armaduras leves. Em caso de Acerto Crítico, você escolhe quais objetos ou pessoas leves serão levitados. Ao retornar, causa 1d6 de Dano direto na Vida e retira a ação de movimento por um turno.',
    },
    {
      id: 'expressao_transmutacao',
      indice: 6,
      name: 'Transmutação',
      origemName: 'Natural',
      desc: 'O Éter do seu corpo transforma sua arma em outra arma por um turno. Se foi Erro Crítico, é uma arma aleatória de um peso aleatório. Se foi um Acerto Crítico, é uma arma de sua escolha.',
    },
  ],
  'etereo_origem_mistica': [
    {
      id: 'expressao_eter_macabro',
      indice: 5,
      name: 'Éter Macabro',
      origemName: 'Mística',
      desc: 'O éter do seu corpo juntamente com a energia mística dele se manifestam. Se foi Erro Crítico, TODOS os seus aliados ficam cegos por 1 turno. Se foi Acerto Crítico, escolha até 3 alvos para ficarem cegos por 1 turno.',
    },
    {
      id: 'expressao_metamorfose_cosmica',
      indice: 6,
      name: 'Metamorfose Cósmica',
      origemName: 'Mística',
      desc: 'A energia mística do seu corpo faz uma conexão direta com alguns deuses antigos, alterando seu éter. Em caso de Erro Crítico, você perde o controle e se transforma em um monstro por 1 turno, com acesso a todas as Expressões Etéreas em forma de Erro Crítico. Em caso de Acerto Crítico, você se transforma nesse monstro com controle, tendo acesso a todas as Expressões Etéreas em forma de Acerto Crítico por 1 turno.',
    },
  ],
};

// Retorna a lista completa de Expressões Etéreas de um personagem ([] se não for Etéreo).
// Sempre inclui as 4 padrão (índices 1–4) + 2 de origem (índices 5–6), se a origem estiver definida.
function getExpressoesEtereas(p) {
  if (p.race !== 'Etéreo') return [];
  const extras = (p.origemId && ETEREO_EXPRESSOES_ORIGEM[p.origemId]) || [];
  return [...ETEREO_EXPRESSOES_PADRAO, ...extras];
}

// "Entropia Constante" (Etéreo): ao tirar Acerto Crítico ou Erro Crítico
// numa Ação ou Teste, rola 1d6 na hora pra saber qual Expressão Etérea se
// manifesta (índice do dado = índice da Expressão em getExpressoesEtereas).
// Disparado automaticamente pelo rolarTeste logo após o resultado do Teste
// (ver ali). Publica a rolagem no chat de dados, igual a qualquer outra, e
// revela o resultado com um alerta explicando qual Expressão saiu — os
// efeitos de cada Expressão são narrativos/manuais, o app só sorteia qual é.
function rolarExpressaoEterea(pid, tipo) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p || p.race !== 'Etéreo') return;
  const expressoes = getExpressoesEtereas(p);
  if (!expressoes.length) return;

  const sides = 6;
  const d1 = 1 + Math.floor(Math.random() * sides);
  const tipoLabelTxt = tipo === 'crit' ? 'Acerto Crítico' : 'Erro Crítico';

  const entry = {
    playerName: currentUser.name || (IS_NARRADOR ? 'Narrador' : 'Jogador'),
    charName: p.name,
    isNarrator: !!IS_NARRADOR,
    formula: `Expressão Etérea — ${tipoLabelTxt} (1d6)`,
    tree: { type: 'sum', terms: [{ sign: '+', node: { type: 'dice', sides, count: 1, results: [d1], sum: d1, countNode: null } }] },
    total: d1,
    hidden: hiddenPadrao(p),
    rolling: true,
    ts: Date.now()
  };

  spinDiceFab(true, sides);
  pushRollEntry(entry, key => {
    setTimeout(() => finishRollEntry(key), ROLL_ANIM_MS);
    setTimeout(() => spinDiceFab(false), ROLL_ANIM_MS);
  });
  if (!dicePanelOpen) toggleDicePanel();
  else if (dicePanelTab !== 'feed') switchDiceTab('feed');

  setTimeout(() => {
    const exp = expressoes.find(e => e.indice === d1);
    if (!exp) return;
    alert(`Expressão Etérea (${tipoLabelTxt}): ${p.name} tirou ${d1} no 1d6 — "${exp.name}"${exp.origemName ? ` (${exp.origemName})` : ''}.\n\n${exp.desc}`);
  }, ROLL_ANIM_MS + 150);
}

// ═══════════════════════════════════════
// CAMPOS HARMÔNICOS — exclusivo do Bardo
// ═══════════════════════════════════════
// 4 Habilidades fixas de todo Bardo. Funcionam como qualquer outra
// habilidade de 2 Ações (mesmo sistema de useSkill/isReady), mas em vez de
// ter usos/recarga por turno-luta-sessão, o "combustível" são as 7 Notas
// Musicais: só ficam prontas com as 7 notas ativas, e usá-las gasta todas
// as notas de uma vez (tipo: 'notas', tratado à parte em isReady/useSkill).
// color: 'bardo' não existe nos grupos padrão (green/red/blue/gray) — por
// isso elas não aparecem misturadas nas Habilidades normais, e sim na
// própria seção "Campos Harmônicos".
const BARDO_CAMPOS_HARMONICOS = [
  {
    id: 'sk_campo_do_maior',
    name: 'Dó Maior',
    color: 'bardo', cost: 2, tipo: 'notas',
    desc: 'Gaste todas as Notas Musicais e o próximo Turno, independente da Iniciativa, será um Turno dividido entre todos os Aliados! Uma Ação de Movimento e 2 Ações por Aliado — você não participa.',
  },
  {
    id: 'sk_campo_re_maior',
    name: 'Ré Maior',
    color: 'bardo', cost: 2, tipo: 'notas',
    desc: 'Gaste todas as Notas Musicais e seus Aliados recebem +1 Ação no próximo turno, além de removerem algum tormento emocional.',
  },
  {
    id: 'sk_campo_mi_menor',
    name: 'Mi Menor',
    color: 'bardo', cost: 2, tipo: 'notas',
    desc: 'Gaste todas as Notas Musicais e um Alvo terá Mega Desvantagem em tudo até o final do seu próximo turno.',
  },
  {
    id: 'sk_campo_la_menor',
    name: 'Lá Menor',
    color: 'bardo', cost: 2, tipo: 'notas',
    desc: 'Gaste todas as Notas Musicais e seus Aliados podem doar pontos de Vida, Armadura e Vantagens entre eles até o final deste Turno. Esse último dura até o próximo uso da Vantagem.',
  },
];

function makeCampoHarmonicoSkill(def) {
  return {
    id: def.id, name: def.name, desc: def.desc, color: def.color, cost: def.cost, tipo: def.tipo,
    usosMax: 1, usosAtuais: 1, cdRestante: 0, turnosRecarga: 1,
  };
}

// Garante que todo Bardo tenha os 4 Campos Harmônicos em p.skills, sem
// duplicar. Segue o mesmo padrão (idempotente, sem remoção) de ensureGeneralSkills.
function ensureCamposHarmonicos(p) {
  if (!Array.isArray(p.skills)) p.skills = [];
  if (p.classeBase !== 'Bardo') return;
  BARDO_CAMPOS_HARMONICOS.forEach(def => {
    const jaTem = p.skills.some(sk => sk.id === def.id);
    if (!jaTem) p.skills.push(makeCampoHarmonicoSkill(def));
  });
}

// Retorna os Campos Harmônicos já anexados ao personagem (a partir de p.skills,
// já que agora são habilidades reais e não apenas texto de referência).
function getCamposHarmonicos(p) {
  return (p.skills || []).filter(sk => sk.tipo === 'notas');
}

// ═══════════════════════════════════════
// DIVINDADES — exclusivo do Clérigo
// ═══════════════════════════════════════
// Cada Clérigo escolhe (na criação do personagem) uma entre 5 divindades.
// Cada divindade concede um "kit" fixo de dádivas: 3 Bênçãos, 2 Intervenções,
// 1 Milagre e 1 Milagre Supremo. São só referência (igual às Expressões
// Etéreas do Etéreo) — sem custo de Ação nem tempo de recarga; o narrador
// decide quando concedê-las, tipicamente a partir do resultado do Teste de
// Devoção.
const DEUSES_CLERIGO = {
  'Argus, O Primeiro Ascendente Vil': {
    bencaos: [
      { id: 'argus_diabrete_vil', name: 'Diabrete Vil', desc: 'Argus evoca um Diabrete Vil neste combate: ele concede +1 de Dano para você em suas Ações. Possui apenas 5 de Vida, 8 de Passos, causa apenas 1d4 de Dano e tem uma única Ação (divide o turno com você).' },
      { id: 'argus_raio_vil_cosmico', name: 'Raio Vil Cósmico', desc: 'Seus olhos brilham e lançam um raio com poder vil cósmico em um Alvo a até 5 Casas, causando apenas 1d2 de Dano na Armadura. Tem +1 de Dano para cada demônio de Argus.' },
      { id: 'argus_vileza_protetora', name: 'Vileza Protetora', desc: 'Argus concede uma vileza cósmica por 1 Turno, que repele outros aspectos mágicos e remove algum efeito negativo.' },
    ],
    intervencoes: [
      { id: 'argus_arremesso_cosmico', name: 'Arremesso Cósmico', desc: 'Invoque a foice de Argus rapidamente e arremesse-a num Alvo a até 10 Casas; o dano é um sacrifício de um demônio de Argus, convertido para apenas 1d6 (pode sacrificar quantos demônios de Argus quiser para aumentar o dano).' },
      { id: 'argus_meteoro_vil', name: 'Meteoro Vil', desc: 'Argus lança um meteoro vil num Alvo, causando apenas 1d10 de Dano (+1 de Dano para cada demônio de Argus). Depois, o meteoro se transforma num Infernal Vil que dura até o final da Luta: concede +2 de Dano para você em suas Ações, possui 15 de Vida, 4 de Passos, causa apenas 1d6 de Dano e tem uma única Ação (divide o turno com você).' },
    ],
    milagres: [
      { id: 'argus_portal_vil', name: 'Portal Vil', desc: 'Argus cria um portal vil no tabuleiro, intangível para mortais — ninguém pode entrar — que dura 3 Turnos seus. No início do turno, invoca 2 Diabretes Vis ou 1 Infernal.' },
    ],
    milagresSupremos: [
      { id: 'argus_escolhido_de_argus', name: 'Escolhido de Argus', desc: 'Só pode ser usado uma vez por Personagem. Argus concede a sua Foice para você nesta Luta/Cena. Depois, receba uma Foice Constelação exclusiva sua.' },
    ],
  },
  // As 5 divindades do Clérigo estão completas: Argus, Eluna, Luz, Rita e Sombras.
  'Eluna, Deusa Noturna da Lua': {
    bencaos: [
      { id: 'eluna_clarao_da_noite', name: 'Clarão da Noite', desc: 'Eluna concede o brilho da lua para sua Arma por 1 Turno: ela te guiará contra seus adversários, dando +2 de Vantagem, e se você estiver Cego, a Arma te guiará e você não sofrerá as consequências. Se for Noite, a Vantagem se torna +4.' },
      { id: 'eluna_feixe_lunar', name: 'Feixe Lunar', desc: 'Eluna concentra um feixe da lua num Alvo: se for Aliado, cura apenas 1d6; se for Inimigo, causa apenas 1d6 de Dano. Se for Noite, o feixe ganha +1d6 de Cura/Dano.' },
      { id: 'eluna_reflexao_do_anoitecer', name: 'Reflexão do Anoitecer', desc: 'Por meio de algum reflexo, Eluna revela algo para te ajudar em relação ao momento. Se for Noite, você poderá perguntar diretamente a ela.' },
    ],
    intervencoes: [
      { id: 'eluna_conexao_com_a_natureza', name: 'Conexão com a Natureza', desc: 'Eluna te conecta à natureza do lugar, permitindo se comunicar com animais e plantas por uma Cena/Luta. Se for Noite, você pode até adentrar as memórias de um animal/planta.' },
      { id: 'eluna_ancestralidade', name: 'Ancestralidade', desc: 'Eluna te concede uma breve memória de um Elfo Noturno: neste turno, você poderá usar uma Habilidade que não é da sua Classe. Se for Noite, a Habilidade possuirá Mega Vantagem.' },
    ],
    milagres: [
      { id: 'eluna_lua_cheia', name: 'Lua Cheia', desc: 'Eluna invoca uma Lua Cheia no lugar até o final da Cena/Luta, retirando toda a escuridão natural e mágica. No início do seu turno, lance 2 Feixes Lunares em qualquer Alvo. Se já for Noite, lance 1d6 Feixes Lunares.' },
    ],
    milagresSupremos: [
      { id: 'eluna_conhecimento_divino', name: 'Conhecimento Divino', desc: 'Só pode ser usado 1 vez por Personagem. Eluna concede todo o conhecimento dos Elfos Noturnos possível: você tem acesso a todas as Habilidades de Classe até o final da Cena/Luta. Depois, aprenda 2 Habilidades de outra Classe.' },
    ],
  },
  'Luz': {
    bencaos: [
      { id: 'luz_breve_iluminacao', name: 'Breve Iluminação', desc: 'A Luz te concede uma energia benevolente neste turno: ao tocar em um Alvo, remova um efeito negativo que esteja o atormentando.' },
      { id: 'luz_essencia_da_luz', name: 'Essência da Luz', desc: 'Escolha 1 Alvo e cure apenas 1d4 de sua Vida.' },
      { id: 'luz_sacramento', name: 'Sacramento', desc: 'A Luz te concede uma visão por um turno que transcende a matéria: você poderá ver se alguém está mentindo e se está invisível.' },
    ],
    intervencoes: [
      { id: 'luz_purificacao_divina', name: 'Purificação Divina', desc: 'Nesta luta, a Luz aprimora sua Essência da Luz: ela concede +1 de Cura, e lance uma Essência da Luz em algum Alvo.' },
      { id: 'luz_toque_da_luz', name: 'Toque da Luz', desc: 'Escolha quantos Alvos quiser, e a Luz lança Essência da Luz em todos eles.' },
    ],
    milagres: [
      { id: 'luz_verdade_divina', name: 'Verdade Divina', desc: 'A Luz invoca uma entidade da luz chamada Yrel, que dura 3 turnos seus: toda mentira e invisibilidade se torna perceptível para você. No início do seu turno, ela remove um efeito negativo de sua escolha e lança 4 Essências da Luz em quaisquer Alvos que você quiser.' },
    ],
    milagresSupremos: [
      { id: 'luz_ressurreicao', name: 'Ressurreição', desc: 'Só pode ser usada 1 vez por Personagem. A Luz te concede o poder sobre a vida: ressuscite um Alvo com toda a sua Vida recuperada.' },
    ],
  },
  'Rita, Deusa da Barganha': {
    bencaos: [
      { id: 'rita_barganha_do_acerto', name: 'Barganha do Acerto', desc: 'Rita te propõe: recebe +1d2, +1d4 ou +1d6 de Vantagem na sua próxima Habilidade, porém, receberá o mesmo dado como Desvantagem em Dano/Cura da sua próxima Habilidade.' },
      { id: 'rita_barganha_da_intensidade', name: 'Barganha da Intensidade', desc: 'Rita te propõe: sua próxima Habilidade possui +1d2, +1d4 ou +1d6 de Dano/Cura, porém, receberá o mesmo dado como Desvantagem no lançamento da sua próxima Habilidade.' },
      { id: 'rita_verdadeiro_carater', name: 'Verdadeiro Caráter', desc: 'Escolha um Alvo e Rita te dirá como realmente é a condição monetária daquele sujeito. Em luta, Rita te dirá se o Alvo tem algum equipamento ou item escondido.' },
    ],
    intervencoes: [
      { id: 'rita_fonte_de_riqueza', name: 'Fonte de Riqueza', desc: 'Rita abençoou alguma negociação sua passada: seu próximo Recurso custará metade (arredonda pra cima), porém, custará 2 Ações para lançá-lo.' },
      { id: 'rita_investimento', name: 'Investimento', desc: 'Conceda uma Ação sua para Rita, e ela irá guardá-la: a cada 3 Ações guardadas, ela produz mais uma Ação guardada a mais, ou receba todas as Ações guardadas.' },
    ],
    milagres: [
      { id: 'rita_nova_regra', name: 'Nova Regra', desc: 'Rita distorce as leis da física do momento: você propõe uma regra que deverá ocorrer até o final da Cena/Luta, e Rita apresentará a consequência da regra. Após a decisão entre você e ela, a regra é aplicada e anunciada a todos.' },
    ],
    milagresSupremos: [
      { id: 'rita_contrato_sagrado', name: 'Contrato Sagrado', desc: 'Só pode ser usado 1 vez por Personagem. Rita leva todos que você desejar para seu santuário em sua presença, e iniciarão uma barganha sagrada, onde todos devem cumprir! Se não, conhecerão a ira de Rita!!!' },
    ],
  },
  'Sombras': {
    bencaos: [
      { id: 'sombras_abraco_das_sombras', name: 'Abraço das Sombras', desc: 'As Sombras te cobrem e te deixam Invisível por um turno. Se já estiver Invisível ou Furtivo, lance 2 Essências Sombrias em um ou dois Alvos.' },
      { id: 'sombras_essencia_sombria', name: 'Essência Sombria', desc: 'Escolha um Alvo e cause apenas 1d4 de Dano na vida dele. O acerto é garantido!', acertoGarantido: true },
      { id: 'sombras_observador_macabro', name: 'Observador Macabro', desc: 'As Sombras invocam um olho sombrio intangível que persegue um Alvo: você terá +2 de Vantagem sobre ele. No seu turno, poderá sacrificar o olho e lançar Essência Sombria no Alvo.' },
    ],
    intervencoes: [
      { id: 'sombras_conhecimento_proibido', name: 'Conhecimento Proibido', desc: 'As Sombras te contam quem é o mais insano da Cena/Luta. Caso queira, amaldiçoe-o: para cada 10 de Insanidade que ele tiver, você recebe +1 de Dano de Essência Sombria (acumula infinitamente).' },
      { id: 'sombras_encantamento_sombrio', name: 'Encantamento Sombrio', desc: 'As Sombras encantam uma Habilidade sua nesta luta: ao causar Dano com ela, lance também uma Essência Sombria num Alvo de sua escolha (pode acumular infinitamente).' },
    ],
    milagres: [
      { id: 'sombras_visao_divina', name: 'Visão Divina', desc: 'As Sombras invocam uma entidade do caos chamada Xa Vatar, que dura 3 turnos seus. Ela observa todos os Alvos que você desejar: você terá +6 de Vantagem sobre eles. No início do seu turno, lance 1d4 de Essência Sombria e distribua o dano entre todos os Alvos selecionados.' },
    ],
    milagresSupremos: [
      { id: 'sombras_toque_das_sombras', name: 'Toque das Sombras', desc: 'Só pode ser usado 1 vez por Personagem. As Sombras te concedem o poder supremo dos deuses antigos: escolha um Alvo e cause apenas 10d20 de Dano na vida dele. O acerto é garantido!', acertoGarantido: true },
    ],
  },
};

// Lista de nomes de divindades disponíveis para escolha na criação do personagem.
const DEUSES_LISTA = Object.keys(DEUSES_CLERIGO);

// Retorna o kit completo da divindade escolhida pelo personagem (ou null).
function getDivindade(p) {
  return DEUSES_CLERIGO[p.deus] || null;
}

// Retorna a lista "achatada" de Bênçãos/Intervenções/Milagres/Milagre Supremo
// do personagem, cada item com uma tag indicando o tipo (usado na exibição).
function getDivindadeItens(p) {
  const d = getDivindade(p);
  if (!d) return [];
  const marcar = (lista, tier, sigla) => (lista || []).map(item => ({ ...item, tier, sigla }));
  return [
    ...marcar(d.bencaos,          'Bênção',          'BÊN'),
    ...marcar(d.intervencoes,     'Intervenção',     'INT'),
    ...marcar(d.milagres,         'Milagre',         'MIL'),
    ...marcar(d.milagresSupremos, 'Milagre Supremo',  'M.S'),
  ];
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

// Categorias de peso de Armadura liberadas conforme o atributo principal da
// subclasse: Intelecto → só Leve; Agilidade → Leve e Média; Força → Leve,
// Média e Pesada. Usado na escolha de armadura inicial (passo 5 do wizard).
const PESO_ARMADURA_POR_ATRIBUTO = {
  intel: ['leve'],
  agi:   ['leve', 'media'],
  forca: ['leve', 'media', 'pesada'],
};
function getPesosArmaduraPermitidos(subclasseName) {
  const attr = getSubAttr(subclasseName);
  return PESO_ARMADURA_POR_ATRIBUTO[attr] || ['leve'];
}

// Categoria de peso de Arma/Instrumento liberada conforme o atributo
// principal da subclasse: Intelecto → só Leve; Agilidade → só Média;
// Força → só Pesada. Diferente da Armadura (que é cumulativo), aqui o
// acesso é EXCLUSIVO — só a categoria correspondente ao atributo, sem as
// mais leves. Usado na escolha de arma inicial (passo 9 do wizard).
const PESO_ARMA_POR_ATRIBUTO = {
  intel: ['leve'],
  agi:   ['media'],
  forca: ['pesada'],
};
function getPesosArmaPermitidos(subclasseName) {
  const attr = getSubAttr(subclasseName);
  return PESO_ARMA_POR_ATRIBUTO[attr] || ['leve'];
}

const ORDEM_PESO_ARMADURA = ['leve', 'media', 'pesada', 'mega'];

// Peso máximo de Armadura/Elmo que o personagem pode comprar/vestir,
// considerando o atributo primário da subclasse (getPesosArmaduraPermitidos)
// e, se tiver, o Talento Inferior "Maestria de Peso Aprimorada" — sobe 1
// grau: quem só tinha Leve passa a ter Média, quem tinha Média passa a ter
// Pesada, e quem tinha Pesada passa a ter Mega Pesada. É o único jeito de
// chegar em Mega. Vale igualmente pra Armadura e Elmo (mesma lógica de
// categorias de peso). Arma/Instrumento têm regra própria — ver
// getPesosArmaPermitidosPersonagem, mais abaixo.
function getPesoMaximoArmaduraPersonagem(p) {
  const base = getPesosArmaduraPermitidos(p.cls);
  let maxIdx = base.reduce((max, peso) => Math.max(max, ORDEM_PESO_ARMADURA.indexOf(peso)), 0);
  const temMaestriaAprimorada = getTalentosInferioresEscolhidos(p).some(pas => pas.talentoInferiorId === 'maestria_de_peso_aprimorada');
  if (temMaestriaAprimorada) maxIdx = Math.min(maxIdx + 1, ORDEM_PESO_ARMADURA.length - 1);
  // "Colosso" (Origem, Troll): garante acesso a Armadura/Elmo Pesado,
  // independente do caminho da Classe — mesma ideia da "Mulgore" pra Armas,
  // só que aqui é um teto (não uma lista), então só sobe o índice se for menor.
  const temColosso = p.origemId === 'troll_origem_colosso';
  if (temColosso) maxIdx = Math.max(maxIdx, ORDEM_PESO_ARMADURA.indexOf('pesada'));
  return ORDEM_PESO_ARMADURA[maxIdx];
}

// O personagem pode comprar/vestir Armadura ou Elmo Mega Pesado no catálogo?
// Só quem já tinha Pesada como teto (atributo Força) e melhorou com
// "Maestria de Peso Aprimorada" chega em Mega.
function temAcessoArmaduraMegaPesada(p) {
  return getPesoMaximoArmaduraPersonagem(p) === 'mega';
}

// Categorias de peso de Arma/Instrumento liberadas pro personagem: o acesso
// base é EXCLUSIVO por atributo (ver getPesosArmaPermitidos — só 1
// categoria). Com o Talento Inferior "Maestria de Peso Aprimorada", o
// personagem passa a ter acesso à categoria seguinte TAMBÉM (sem perder a
// original): Leve -> Leve+Média; Média -> Média+Pesada; Pesada -> Pesada+Mega.
function getPesosArmaPermitidosPersonagem(p, ignorarMultifuncoes) {
  // "Multifunções" (passiva fixa do Campeão): sabe usar TODAS as Armas,
  // independente do atributo da subclasse — ignora a regra exclusiva normal,
  // e já inclui Mega Pesada de cara (sem depender da Maestria de Peso
  // Aprimorada — essa só serve pra outras classes chegarem em Mega). Porém,
  // só pode GANHAR essas categorias extras, não comprar — ver saveInvItem,
  // que usa `ignorarMultifuncoes=true` pra saber o que o personagem teria
  // "de direito próprio" (sem contar a passiva) na hora de validar a compra.
  const temMultifuncoes = !ignorarMultifuncoes && getSubclassePassivas(p).some(pas => pas.id === 'campeao_multifuncoes');
  const temMaestriaAprimorada = getTalentosInferioresEscolhidos(p).some(pas => pas.talentoInferiorId === 'maestria_de_peso_aprimorada');
  if (temMultifuncoes) {
    return ['leve', 'media', 'pesada', 'mega'];
  }
  const base = getPesosArmaPermitidos(p.cls); // ex: ['media']
  let resultado;
  if (!temMaestriaAprimorada) {
    resultado = base;
  } else {
    const idx = ORDEM_PESO_ARMADURA.indexOf(base[0]);
    resultado = (idx === -1 || idx >= ORDEM_PESO_ARMADURA.length - 1) ? base : [base[0], ORDEM_PESO_ARMADURA[idx + 1]];
  }
  // "Mulgore" (Origem, Tauren): garante acesso a Armas Pesadas, independente
  // do caminho da Classe — soma 'pesada' ao conjunto já calculado (sem
  // remover nenhuma categoria que o personagem já tivesse por outro meio).
  const temMulgore = p.origemId === 'tauren_origem_mulgore';
  if (temMulgore && !resultado.includes('pesada')) {
    resultado = [...resultado, 'pesada'];
  }
  // "Colosso" (Origem, Troll): mesma ideia da Mulgore — soma 'pesada' ao
  // conjunto já calculado, independente do caminho da Classe.
  const temColosso = p.origemId === 'troll_origem_colosso';
  if (temColosso && !resultado.includes('pesada')) {
    resultado = [...resultado, 'pesada'];
  }
  return resultado;
}

// O personagem pode comprar/vestir uma Arma/Instrumento de peso `peso`
// (leve/media/pesada/mega), considerando getPesosArmaPermitidosPersonagem?
// Não se aplica a Exótica/Encantada, que têm suas próprias travas por
// Talento — ver temAcessoEquipamentoExotico/temAcessoEquipamentoEncantado.
function temAcessoPesoArma(p, peso) {
  if (p.isNPC) return true; // NPC: qualquer categoria de peso, sem depender do atributo da subclasse
  if (!ORDEM_PESO_ARMADURA.includes(peso)) return true;
  return getPesosArmaPermitidosPersonagem(p).includes(peso);
}

// O personagem pode comprar/vestir uma peça de peso `peso` (leve/media/pesada/
// mega), considerando o teto calculado em getPesoMaximoArmaduraPersonagem
// (atributo da subclasse + "Maestria de Peso Aprimorada")? Não se aplica a
// Exótica/Encantada, que têm suas próprias travas por Talento — ver
// temAcessoEquipamentoExotico/temAcessoEquipamentoEncantado.
function temAcessoPesoArmaduraOuElmo(p, peso) {
  if (p.isNPC) return true; // NPC: qualquer categoria de peso, sem depender do atributo da subclasse
  const idx = ORDEM_PESO_ARMADURA.indexOf(peso);
  if (idx === -1) return true;
  const maxIdx = ORDEM_PESO_ARMADURA.indexOf(getPesoMaximoArmaduraPersonagem(p));
  return idx <= maxIdx;
}

// Retorna a classe-base (Guerreiro, Ladino…) dado o nome de uma subclasse
function getBaseClass(subclasseName) {
  for (const cls of CLASSES) {
    if (cls.subs.some(s => s.name === subclasseName)) return cls.name;
  }
  return null;
}

// ═══════════════════════════════════════
// PASSIVAS DE SUBCLASSE
// ═══════════════════════════════════════
// Cada subclasse pode ter passivas fixas que todo personagem daquela
// subclasse possui automaticamente — aparecem na aba Passivas/Talentos sem
// precisar serem cadastradas manualmente. Segue o mesmo padrão de RACAS.
const SUBCLASSES_PASSIVAS = {
  'Campeão': [
    { id: 'campeao_multifuncoes', name: 'Multifunções', desc: 'Sabe usar TODAS as Armas e Instrumentos, de qualquer categoria de peso — incluindo Mega Pesada, Exótica e Encantada — sem precisar de Talento Inferior pra isso.' },
    { id: 'campeao_maestria_mediana', name: 'Maestria Mediana', desc: 'Sabe usar Armadura Média e Armas Médias. Escolha um Teste de Agilidade e receberá Mega Vantagem.' },
  ],
  'Combatente': [
    { id: 'combatente_guerreiro_perfeito', name: 'Guerreiro Perfeito', desc: 'Pode usar uma arma pesada de corpo a corpo em cada mão (mesmo que ambas sejam de duas mãos). Pode lançar uma Habilidade usando as duas Armas juntas, assim terá +Dano da segunda Arma, porém, sua Maestria no lançamento será reduzida pela metade.' },
    { id: 'combatente_maestria_pesada', name: 'Maestria Pesada', desc: 'Sabe usar Armadura Pesada e Armas Pesadas. Escolha um Teste de Força e receberá Mega Vantagem.' },
  ],
  'Soldado Elementar': [
    { id: 'soldado_elementar_anti_magia', name: 'Anti-Magia', desc: 'Escolha um Elemento (Ar, Fogo, Gelo ou Rocha): ele irá fazer seus Aparos, assim, poderá Aparar contra Feitiços e utilizar a maestria de Intelecto ao invés de Força para Aparar.' },
    { id: 'soldado_elementar_maestria_leve', name: 'Maestria Leve', desc: 'Sabe usar Armadura Leve e Armas Leves. Escolha um Teste de Intelecto e receberá Mega Vantagem.' },
  ],
  'Mercenário': [
    { id: 'mercenario_falsificador', name: 'Falsificador', desc: 'Você tem 50 de Dinheiro Falso. Ao gastá-lo em algo (exemplo: Recursos, comprar itens, etc), lance 1d100: se tirar 40 ou mais, não perceberão que são Falsas. Após um Descanso, restaura até 50 de Dinheiro Falso.' },
    { id: 'mercenario_maestria_mediana', name: 'Maestria Mediana', desc: 'Sabe usar Armadura Média e Armas Médias. Escolha um Teste de Agilidade e receberá Mega Vantagem.' },
  ],
  'Briguento': [
    { id: 'briguento_durao', name: 'Durão', desc: 'Você tem acesso exclusivo à Arma: Quebra Queixo. Não pode usar outras Armas e nega todas as desvantagens e mega desvantagens sobre Furtividade.' },
    { id: 'briguento_maestria_pesada', name: 'Maestria Pesada', desc: 'Sabe usar Armadura Pesada e Armas Pesadas. Escolha um Teste de Força e receberá Mega Vantagem.' },
  ],
  'Ilusionista': [
    { id: 'ilusionista_enganacao_ilusoria', name: 'Enganação Ilusória', desc: 'Você possui uma Ação falsa por turno. Utilize sua magia para enganar alguém: ganhe +Nível/2 (arredonda pra cima) como Vantagem e Dano/Cura na sua próxima Ação verdadeira no turno. Tome cuidado: o adversário pode fazer um Teste de Arcano ou Místico para descobrir a Ação falsa, e assim você não ganha os benefícios.' },
    { id: 'ilusionista_copias_magicas', name: 'Cópias Mágicas', desc: 'Ao iniciar uma Luta/Cena, invoque uma ilusão que é sua cópia. Ela divide o turno com você, possuindo apenas uma Ação falsa, 10 de Passos, suas Maestrias e 3×Nível como Vida.' },
    { id: 'ilusionista_maestria_leve', name: 'Maestria Leve', desc: 'Sabe usar Armadura Leve e Armas Leves. Escolha um Teste de Intelecto e receberá Mega Vantagem.' },
  ],
  'Criador de Runa': [
    { id: 'criador_runa_pra_que_magia', name: 'Pra Que Magia!?', desc: 'Pode comprar um pergaminho de uso único que contém um feitiço de sua escolha por 20 de Dinheiro. Os Dados de Lançamento e de Dano/Cura são iguais aos de uma Técnica. (Pode comprar até 3 pergaminhos por sessão)' },
    { id: 'criador_runa_maestria_mediana', name: 'Maestria Mediana', desc: 'Sabe usar Armadura Média e Armas Médias. Escolha um Teste de Agilidade e receberá Mega Vantagem.' },
  ],
  'Feiticeiro de Fogo': [
    { id: 'feiticeiro_fogo_poder_proibido', name: 'Poder Proibido', desc: 'As chamas são uma magia extremamente perigosa, pois se manifestam por meio de suas emoções e capacidades físicas. Assim, seu Teste de Emoção tem +1d20 de Vantagem, e seu Teste de Arcano ou Místico utiliza a Maestria de Força ao invés de Intelecto. Quando você estiver em um momento em que perde o controle racional, sua magia será liberta.' },
    { id: 'feiticeiro_fogo_maestria_pesada', name: 'Maestria Pesada', desc: 'Sabe usar Armadura Pesada e Armas Pesadas. Escolha um Teste de Força e receberá Mega Vantagem.' },
  ],
  'Conjurador': [
    { id: 'conjurador_transcendencia_intelectual', name: 'Transcendência Intelectual', desc: 'Aprenda um feitiço de outra Classe, desde que baseado em Intelecto (escolha no Banco de Habilidades, aba com o ícone da Classe de origem). Ao subir de Nível, repita esse efeito. No Nível 5, ao invés de um feitiço, aprenda um Feitiço Lendário (botão "Escolher Feitiço Lendário" na ficha).' },
    { id: 'conjurador_maestria_leve', name: 'Maestria Leve', desc: 'Sabe usar Armadura Leve e Armas Leves. Escolha um Teste de Intelecto e receberá Mega Vantagem.' },
  ],
  'Alquimista': [
    { id: 'alquimista_sistema_nervoso_elevado', name: 'Sistema Nervoso Elevado', desc: 'Possui 10 de Humanidade, podendo gastá-la para ativar os Êxtases de suas Técnicas. Quando chegar a 0, seu corpo cederá aos efeitos colaterais das poções.' },
    { id: 'alquimista_maestria_mediana', name: 'Maestria Mediana', desc: 'Sabe usar Armadura Média e Armas Médias. Escolha um Teste de Agilidade e receberá Mega Vantagem.' },
  ],
  'Receptáculo Demoníaco': [
    { id: 'receptaculo_demoniaco_selo_demoniaco', name: 'Selo Demoníaco', desc: 'Possui 10 de Humanidade, podendo gastá-la para ativar os Sacrilégios de seus Golpes. Quando chegar a 0, o demônio assumirá o controle.' },
    { id: 'receptaculo_demoniaco_maestria_pesada', name: 'Maestria Pesada', desc: 'Sabe usar Armadura Pesada e Armas Pesadas. Escolha um Teste de Força e receberá Mega Vantagem.' },
  ],
  'Amaldiçoado': [
    { id: 'amaldicoado_maldicao', name: 'Maldição', desc: 'Possui 10 de Humanidade, podendo gastá-la para ativar os Assombrar de seus Feitiços. Quando chegar a 0, a maldição será liberta...' },
    { id: 'amaldicoado_maestria_leve', name: 'Maestria Leve', desc: 'Sabe usar Armadura Leve e Armas Leves. Escolha um Teste de Intelecto e receberá Mega Vantagem.' },
  ],
  'Dançarino': [
    { id: 'dancarino_dancarino_ecletico', name: 'Dançarino Eclético', desc: 'Possui 4 Campos Harmônicos, que precisam de 7 Notas Musicais para serem lançados. Aprenda uma Técnica que não envolva Arma de outra Classe. Ao subir de Nível, repita esse último efeito, porém, não pode repetir Classes.' },
    { id: 'dancarino_maestria_mediana', name: 'Maestria Mediana', desc: 'Sabe usar Armadura Média e Armas Médias. Escolha um Teste de Agilidade e receberá Mega Vantagem.' },
  ],
  'Roqueiro': [
    { id: 'roqueiro_rock_and_roll', name: 'AQUI É DO Rock and Roll', desc: 'Possui 4 Campos Harmônicos, que precisam de 7 Notas Musicais para serem lançados. Você possui Roda Punk no seu Grimório.' },
    { id: 'roqueiro_maestria_pesada', name: 'Maestria Pesada', desc: 'Sabe usar Armadura Pesada e Armas Pesadas. Escolha um Teste de Força e receberá Mega Vantagem.' },
  ],
  'Maestro Macabro': [
    { id: 'maestro_macabro_maestro_demoniaco', name: 'Maestro Demoníaco', desc: 'Possui 4 Campos Harmônicos, que precisam de 7 Notas Musicais para serem lançados. Consegue escutar demônios e outras criaturas bizarras dentro das pessoas; por esse vínculo, sua Insanidade máxima é reduzida para 80, porém possui +20 pontos de Vida base.' },
    { id: 'maestro_macabro_maestria_leve', name: 'Maestria Leve', desc: 'Sabe usar Armadura Leve e Armas Leves. Escolha um Teste de Intelecto e receberá Mega Vantagem.' },
  ],
  'Exorcista': [
    { id: 'exorcista_abencoado', name: 'Abençoado', desc: 'Toda vez que receber uma Intervenção, Milagre ou Milagre Supremo, receberá também uma Bênção.' },
    { id: 'exorcista_maestria_mediana', name: 'Maestria Mediana', desc: 'Sabe usar Armadura Média e Armas Médias. Escolha um Teste de Agilidade e receberá Mega Vantagem.' },
  ],
  'Paladino': [
    { id: 'paladino_poder_de_um_fiel', name: 'Poder de um Fiel', desc: 'Alguns Golpes de Paladino possuem Fidelidade. Uma vez por sessão, em um Golpe com Fidelidade, poderá transformar o resultado em um Milagre Supremo.' },
    { id: 'paladino_maestria_pesada', name: 'Maestria Pesada', desc: 'Sabe usar Armadura Pesada e Armas Pesadas. Escolha um Teste de Força e receberá Mega Vantagem.' },
  ],
  'Acólito': [
    { id: 'acolito_dom_da_sabedoria', name: 'Dom da Sabedoria', desc: 'Seu Teste de Devoção tem Mega Vantagem.' },
    { id: 'acolito_maestria_leve', name: 'Maestria Leve', desc: 'Sabe usar Armadura Leve e Armas Leves. Escolha um Teste de Intelecto e receberá Mega Vantagem.' },
  ],
};

// Retorna a lista de passivas fixas de subclasse de um personagem (vazio se
// a subclasse não tiver passivas cadastradas no catálogo acima).
function getSubclassePassivas(p) {
  return SUBCLASSES_PASSIVAS[p.cls] || [];
}

// Garante que as passivas fixas da subclasse do personagem estejam presentes
// em p.passivas (como qualquer outra passiva — editável e excluível). Não
// duplica as que já existem e não recoloca uma que o jogador excluiu de
// propósito (rastreado em p.subclassePassivasRemovidas). Ao trocar de
// subclasse, remove as passivas da subclasse anterior que não pertençam mais
// à subclasse atual.
function ensureSubclassePassivas(p) {
  if (!Array.isArray(p.passivas)) p.passivas = [];
  if (!Array.isArray(p.subclassePassivasRemovidas)) p.subclassePassivasRemovidas = [];

  // Remove qualquer passiva de subclasse que não esteja mais no catálogo
  // atual da subclasse do personagem — seja por troca de subclasse, seja
  // porque a passiva foi removida/substituída no catálogo (mesmo permanecendo
  // na mesma subclasse).
  const idsAtuais = getSubclassePassivas(p).map(sp => sp.id);
  p.passivas = p.passivas.filter(pas => !pas.subclasseId || idsAtuais.includes(pas.subclasseId));

  getSubclassePassivas(p).forEach(sp => {
    const atendeNivel = !sp.minLevel || (p.level || 1) >= sp.minLevel;
    const jaTem = p.passivas.some(pas => pas.subclasseId === sp.id);
    const foiRemovida = p.subclassePassivasRemovidas.includes(sp.id);
    if (atendeNivel && !jaTem && !foiRemovida) {
      p.passivas.push({ id: 'pas_subclasse_' + sp.id, subclasseId: sp.id, name: sp.name, desc: sp.desc });
    } else if (!atendeNivel && jaTem) {
      p.passivas = p.passivas.filter(pas => pas.subclasseId !== sp.id);
    }
  });
}

// ═══════════════════════════════════════
// MAESTRIAS DE SUBCLASSE (Mediana/Pesada/Leve)
// ═══════════════════════════════════════
// Toda subclasse concede uma das 3 passivas de Maestria (Mediana → Agilidade,
// Pesada → Força, Leve → Intelecto). Ao escolher a subclasse, o jogador
// escolhe 1 Teste daquele atributo pra receber Mega Vantagem fixa — não é
// toggle manual, trava o botão MV desse Teste (mesmo padrão do Brutão do
// Tauren, ver renderTestes/construirRolagemTeste). Como cada personagem só
// tem 1 subclasse por vez, no máximo 1 dessas 3 passivas estará ativa — mas
// os 3 campos ficam separados pra não perder a escolha ao trocar e voltar.
const MAESTRIA_SUBCLASSE_IDS = {
  mediana: ['campeao_maestria_mediana', 'mercenario_maestria_mediana', 'criador_runa_maestria_mediana', 'alquimista_maestria_mediana', 'dancarino_maestria_mediana', 'exorcista_maestria_mediana'],
  pesada:  ['combatente_maestria_pesada', 'briguento_maestria_pesada', 'feiticeiro_fogo_maestria_pesada', 'receptaculo_demoniaco_maestria_pesada', 'roqueiro_maestria_pesada', 'paladino_maestria_pesada'],
  leve:    ['soldado_elementar_maestria_leve', 'ilusionista_maestria_leve', 'conjurador_maestria_leve', 'amaldicoado_maestria_leve', 'maestro_macabro_maestria_leve', 'acolito_maestria_leve'],
};
const MAESTRIA_ATTR  = { mediana: 'agi', pesada: 'forca', leve: 'intel' };
const MAESTRIA_ATTR_LABEL = { agi: 'Agilidade', forca: 'Força', intel: 'Intelecto' };
const MAESTRIA_LABEL = { mediana: 'Maestria Mediana', pesada: 'Maestria Pesada', leve: 'Maestria Leve' };
const MAESTRIA_ICONE = { mediana: 'ti-feather', pesada: 'ti-shield', leve: 'ti-book' };
const MAESTRIA_CAMPO = { mediana: 'maestriaMedianaTesteId', pesada: 'maestriaPesadaTesteId', leve: 'maestriaLeveTesteId' };

// Retorna true se o personagem tem a passiva de Maestria daquele tipo
// (mediana/pesada/leve) — vem da subclasse atual, ver MAESTRIA_SUBCLASSE_IDS.
function temMaestriaTipo(p, tipo) {
  const ids = MAESTRIA_SUBCLASSE_IDS[tipo] || [];
  return (p.passivas || []).some(pas => ids.includes(pas.subclasseId));
}

// Dado o subclasseId de uma passiva (ex: 'campeao_maestria_mediana'),
// retorna qual tipo de Maestria é ('mediana'/'pesada'/'leve') ou null.
function maestriaTipoDoSubclasseId(subclasseId) {
  if (!subclasseId) return null;
  for (const tipo of Object.keys(MAESTRIA_SUBCLASSE_IDS)) {
    if (MAESTRIA_SUBCLASSE_IDS[tipo].includes(subclasseId)) return tipo;
  }
  return null;
}

// Se o Teste `tid` for o escolhido por alguma Maestria ativa do personagem,
// retorna o tipo ('mediana'/'pesada'/'leve'); senão retorna null. Usado pra
// forçar a Mega Vantagem fixa em renderTestes/construirRolagemTeste.
function maestriaForcadaAqui(p, tid) {
  for (const tipo of Object.keys(MAESTRIA_SUBCLASSE_IDS)) {
    if (temMaestriaTipo(p, tipo) && p[MAESTRIA_CAMPO[tipo]] === tid) return tipo;
  }
  return null;
}

// Modal de escolha do Teste que recebe a Mega Vantagem fixa da Maestria
// (Mediana/Pesada/Leve) — mesmo padrão visual do abrirBrutaoModal.
function abrirMaestriaModal(pid, tipo) {
  const overlay = document.getElementById('modal-criacao-anao-overlay');
  const p = PLAYERS.find(x => x.id === pid);
  if (!overlay || !p || !MAESTRIA_ATTR[tipo]) return;
  const attr = MAESTRIA_ATTR[tipo];
  const campo = MAESTRIA_CAMPO[tipo];
  const testes = TESTES_LISTA.filter(t => t.attr === attr);

  const opcoes = testes.map(t => {
    const atual = p[campo] === t.id;
    return `<button class="tm-opcao tm-opcao-blue" onclick="escolherMaestriaTeste(${p.id},'${tipo}','${t.id}')">
      <span class="tm-opcao-nome">${escHtml(t.name)}</span>
      ${atual ? `<span class="tm-opcao-info">Mega Vantagem</span>` : ''}
    </button>`;
  }).join('');

  overlay.innerHTML = `
    <div class="modal" style="max-width:400px" onclick="event.stopPropagation()">
      <h3><i class="ti ${MAESTRIA_ICONE[tipo]}"></i> ${MAESTRIA_LABEL[tipo]} — ${escHtml(p.name)}</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px;line-height:1.5">
        Escolha um Teste de ${MAESTRIA_ATTR_LABEL[attr]} para receber Mega Vantagem por padrão (o botão MV continua liberado — pode ser desligado manualmente quando não se aplicar).
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">${opcoes}</div>
      <button class="tm-cancelar" style="margin-top:10px" onclick="fecharCriacaoAnaoModal();abrirProximoSeletorRacial(${p.id})">Fechar</button>
    </div>`;
  overlay.classList.add('open');
}

function escolherMaestriaTeste(pid, tipo, testeId) {
  const p = PLAYERS.find(x => x.id === pid);
  if (!p) return;
  getTestePersonagem(p);
  const campo = MAESTRIA_CAMPO[tipo];
  const anterior = p[campo];
  // A Maestria só PRÉ-MARCA a Mega Vantagem no Teste escolhido — não é fixa,
  // o jogador pode desligar normalmente pelos botões MV/MD (há situações em
  // que ela não se aplica). Ao trocar de Teste, desliga a MV do anterior.
  if (anterior && anterior !== testeId && p.testes[anterior]) {
    p.testes[anterior].mv = false;
  }
  p[campo] = testeId;
  if (p.testes[testeId]) {
    p.testes[testeId].mv = true;
    p.testes[testeId].md = false;
  }
  saveState();
  renderAll();
  abrirMaestriaModal(pid, tipo);
}

// ═══════════════════════════════════════
// PASSIVAS DE CLASSE-BASE
// ═══════════════════════════════════════
// Diferente das passivas de subclasse (Campeão, Briguento…), estas são da
// Classe toda (Guerreiro, Bardo…) — valem para qualquer subclasse dela.
// Mesmo padrão de armazenamento das demais (id próprio + flag de origem).
const CLASSES_PASSIVAS = {
  'Bardo': [
    { id: 'bardo_instrumento_musical', name: 'Instrumento Musical', desc: 'Possui a capacidade de utilizar Instrumentos Musicais — eles funcionam como Armas também, podendo receber os mesmos efeitos e aprimoramentos. Porém, para utilizar Habilidades de Bardo, é necessário estar equipado com um Instrumento Musical.' },
  ],
};

// Retorna a lista de passivas fixas de classe-base de um personagem (vazio
// se a classe-base não tiver passivas cadastradas no catálogo acima).
function getClassePassivas(p) {
  return CLASSES_PASSIVAS[p.classeBase] || [];
}

// Garante que as passivas fixas da classe-base do personagem estejam
// presentes em p.passivas. Mesma lógica de ensureSubclassePassivas: não
// duplica, não recoloca uma removida de propósito (p.classePassivasRemovidas)
// e remove as de uma classe-base anterior ao trocar de classe.
function ensureClassePassivas(p) {
  if (!Array.isArray(p.passivas)) p.passivas = [];
  if (!Array.isArray(p.classePassivasRemovidas)) p.classePassivasRemovidas = [];

  Object.entries(CLASSES_PASSIVAS).forEach(([clsName, lista]) => {
    if (clsName !== p.classeBase) {
      const ids = lista.map(cp => cp.id);
      p.passivas = p.passivas.filter(pas => !pas.classeId || !ids.includes(pas.classeId));
    }
  });

  getClassePassivas(p).forEach(cp => {
    const atendeNivel = !cp.minLevel || (p.level || 1) >= cp.minLevel;
    const jaTem = p.passivas.some(pas => pas.classeId === cp.id);
    const foiRemovida = p.classePassivasRemovidas.includes(cp.id);
    if (atendeNivel && !jaTem && !foiRemovida) {
      p.passivas.push({ id: 'pas_classe_' + cp.id, classeId: cp.id, name: cp.name, desc: cp.desc });
    } else if (!atendeNivel && jaTem) {
      p.passivas = p.passivas.filter(pas => pas.classeId !== cp.id);
    }
  });
}

// Habilidades gerais — todo personagem possui. cor segue o atributo:
// green = Agilidade, red = Força, blue = Intelecto, gray = Neutro.
// "0 recarga" no material original = uso livre (infinite); "1 recarga" = recarrega por turno (perturn).
const GENERAL_SKILLS = [
  { name: 'Arremesso',     color: 'red',  cost: 1, tipo: 'infinite', desc: 'Faça um teste de Arremesso para arremessar um objeto que você consiga carregar. Se acertar um Alvo que possa receber Dano e que não tenha sido atingido por uma arma, cause: Leve → 1d4; Médio → 1d6; Pesado → 1d8 e Mega Pesado → 1d10 de dano.' },
  { name: 'Acrobacia',     color: 'green', cost: 1, tipo: 'perturn', desc: 'Faça um teste de Acrobacia para fazer uma manobra. Caso queira se movimentar, consumirá a Ação de Movimento também e receberá um deslocamento extra para a maestria de Peso: Leve +6 casas; Médio +4 casas; Pesado +2 casas ou Mega Pesado +1 casa.' },
  { name: 'Arsenal',       color: 'gray', cost: 1, tipo: 'perturn', desc: 'Equipe uma Arma, troque de Arma OU pegue e equipe uma Arma do chão.' },
  { name: 'Ataque com Arma', color: 'gray', cost: 1, tipo: 'infinite', desc: 'Use sua Arma/Instrumento equipado (mão principal) para atacar. O Acerto usa 1d20 + Maestria da Arma equipada.' },
  { name: 'Beber Poção',   color: 'gray', cost: 1, tipo: 'infinite', desc: 'Consuma uma Poção. Se for de Cura: Cure apenas 1d20 de Vida OU Cure apenas 10 de Vida (Requer uma Poção).' },
  { name: 'Empurrar',      color: 'red',  cost: 1, tipo: 'perturn', desc: 'Faça um Teste de Empurrar para deslocar um Objeto ou alguém que você aguenta em 1d2 Casa(s); para cada Maestria de Peso superior que você tiver em relação ao Alvo, empurrará +2 casas.' },
  { name: 'Correr',        color: 'gray', cost: 1, tipo: 'perturn', desc: 'Ganha mais uma ação de movimento neste turno.' },
  { name: 'Engajar',       color: 'gray', cost: 1, tipo: 'perturn', desc: 'Neste turno pode se mover perto de inimigos sem ser atacado.' },
  { name: 'Recurso',       color: 'gray', cost: 1, tipo: 'perturn', desc: 'Pegue um objeto na sua mochila, para cada 1 dos Dados = 25 de Dinheiro: Pequeno - 1d2; Médio - 1d4; Grande - 1d6 OU Poção de cura - 2.' },
  { name: 'Teste Mental',  color: 'blue', cost: 1, tipo: 'perturn', desc: 'Faça um teste de uma área intelectual ou de Emoção, esse último é 1d100 − Insanidade.' },
  { name: 'Furtividade',   color: 'green', cost: 1, tipo: 'perturn', desc: 'Faça um teste de Furtividade; a dificuldade varia conforme o grau de luminosidade ao qual está exposto. Se estiver totalmente exposto à luz, não pode fazer o teste.' },
];

// "Ataque com 2 Armas": não entra em GENERAL_SKILLS (que é incondicional
// pra todos) porque só existe pra quem tem o Talento Inferior "Ambidestro"
// (ver ensureGeneralSkills, que adiciona/remove conforme o talento).
const AMBIDESTRO_SKILL_DEF = { name: 'Ataque com 2 Armas', color: 'gray', cost: 1, tipo: 'infinite', desc: 'Ataque usando a Arma da mão principal e a da mão secundária ao mesmo tempo — soma o Dano das duas, mas o Acerto usa a Maestria pela metade (arredonda para cima). Requer uma 2ª Arma/Instrumento equipado na mão secundária.' };

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
    const id = 'sk_geral_' + def.name.toLowerCase().replace(/\s+/g, '_');
    const existente = p.skills.find(sk => sk.id === id);
    if (!existente) p.skills.push(makeGeneralSkill(def));
    // Corrige a cor salva de fichas antigas se o catálogo mudou (ex: "Ataque
    // com Arma" nasceu vermelha e virou cinza) — nome/desc/custo/tipo não
    // são tocados aqui pra não sobrescrever nada que o Narrador tenha
    // ajustado manualmente na ficha.
    else if (existente.color !== def.color) existente.color = def.color;
  });
  // "Ataque com 2 Armas": só existe pra quem tem o Talento Inferior
  // "Ambidestro" ou a passiva "Guerreiro Perfeito" (Combatente) — some se o
  // jogador perder ambas (mesmo padrão de ensureClassePassivas ao trocar de
  // classe).
  const ambidestroSkillId = 'sk_geral_' + AMBIDESTRO_SKILL_DEF.name.toLowerCase().replace(/\s+/g, '_');
  const temSkill = p.skills.some(sk => sk.id === ambidestroSkillId);
  if (temSegundaArmaHabilitada(p)) {
    if (!temSkill) p.skills.push(makeGeneralSkill(AMBIDESTRO_SKILL_DEF));
  } else if (temSkill) {
    p.skills = p.skills.filter(sk => sk.id !== ambidestroSkillId);
  }
}

const AVATARS = [
  {bg:'#0a1e18', color:'#2aaa82'},
  {bg:'#0f1a2e', color:'#4a8fd4'},
  {bg:'#1a1228', color:'#9a7cdf'},
  {bg:'#220f0f', color:'#c94040'},
];
const NOTETAGS = ['Geral','Missão','Inimigos','Locais'];

// ═══════════════════════════════════════
