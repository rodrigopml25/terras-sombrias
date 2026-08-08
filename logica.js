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
  { id: 'ambidestro', name: 'Ambidestro', desc: 'Você pode usar 1 arma na outra mão, desde que seja de apenas uma mão. Pode lançar uma habilidade usando as duas armas, assim terá +dano da segunda arma, porém, no lançamento, sua maestria é reduzida pela metade (arredonda para cima).' },
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
function construirRolagemDanoArma(p, item) {
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

  const tree = { type: 'sum', terms };
  const formula = `Dano — ${item.name}${critDobro ? ' (🎯 Crítico! dados dobrados)' : ''}`;
  return { tree, total, formula, danoTotal };
}

// Rola o Dano de uma Arma/Instrumento e publica no feed de dados, igual a
// um Teste — chamado pelo botão de dado ao lado do valor de Dano na Ficha
// (ver renderInventarioArea) tanto pelo Jogador quanto pelo Narrador.
function rolarDanoArma(pid, itemId) {
  if (!currentUser) return null;
  const p = PLAYERS.find(x => x.id === pid);
  const item = p && (p.inventario || []).find(i => i.id === itemId);
  if (!p || !item) return null;
  const r = construirRolagemDanoArma(p, item);
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
    formula: r.formula,
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
function construirRolagemAcertoArma(p, item) {
  const sides = 20;
  const mb = getArmaMaestriaBonus(p, item.peso);
  const mst = mb ? mb.val : 0;

  const d1 = 1 + Math.floor(Math.random() * sides);
  const dadoNode = { type: 'dice', sides, count: 1, results: [d1], sum: d1, countNode: null };
  const terms = [{ sign: '+', node: dadoNode }];
  let total = d1;

  if (mst) {
    terms.push({ sign: '+', node: { type: 'labeled_const', value: mst, label: 'Maestria ' + mb.attr } });
    total += mst;
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

  return { sides, total, tree, formula, critMin, fumbleMax, fumbleImune };
}

// Rola e publica no feed de dados a checagem de Acerto de uma Arma/
// Instrumento, exatamente como o Acerto de uma Habilidade — sem decidir
// sozinho se acertou ou não, só monta a rolagem completa (dado + maestria +
// bônus ativos) pra Narrador/Jogador julgarem o resultado.
function rolarAcertoArma(pid, itemId) {
  if (!currentUser) return null;
  const p = PLAYERS.find(x => x.id === pid);
  const item = p && (p.inventario || []).find(i => i.id === itemId);
  if (!p || !item) return null;
  const r = construirRolagemAcertoArma(p, item);
  if (!r) return null;

  // Acerto Crítico: marca a Arma pra dobrar os dados na PRÓXIMA rolagem de
  // Dano dela (ver construirRolagemDanoArma), e já entra com o aviso certo
  // no feed — precisa ser calculado ANTES de montar/publicar a entry, já
  // que pushRollEntry serializa o objeto na hora (mutar depois não teria efeito).
  const critInfo = rollCritInfo({ tree: r.tree, critMin: r.critMin, fumbleMax: r.fumbleMax, fumbleImune: r.fumbleImune });
  if (critInfo.hasCrit) item.critPendente = true;

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
    label: critInfo.hasCrit ? '🎯 Acerto Crítico! Próximo Dano desta Arma sai com os dados dobrados' : '🎯 Rolagem de Acerto',
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

  // Habilidade vinculada a um único Teste (ex: Acrobacia) — rola automaticamente.
  const testeVinculado = SKILL_TESTE_LINK[sk.id];
  if (testeVinculado) rolarTeste(pid, testeVinculado);
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

function renderInventarioArea(p, readOnly) {
  const inv = Array.isArray(p.inventario) ? p.inventario : [];
  const armas     = inv.filter(i => i.tipo === 'arma' || i.tipo === 'instrumento');
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
      const rolarDanoBtn = item.dano
        ? `<button class="teste-roll-btn" style="margin-left:6px" onclick="event.stopPropagation();rolarDanoArma(${p.id},'${item.id}')" title="Rolar Dano (${escHtml(item.dano)}${mb && mb.val ? ' +' + mb.val + ' ' + mb.attr : ''}${temAfiacaoAprimorada(item) ? ' +1d6 ✨' : ''}${profundezasVal > 0 ? ' +' + profundezasVal + ' Profundezas' : ''})"><i class="ti ti-dice"></i></button>`
        : '';
      const rolarAcertoBtn = `<button class="sk-btn" style="margin-left:6px;padding:4px 10px;font-size:11.5px" onclick="event.stopPropagation();rolarAcertoArma(${p.id},'${item.id}')" title="Rolar Acerto (1d20${mb && mb.val ? ' +' + mb.val + ' ' + mb.attr : ''})">🎯 Acerto</button>`;
      const danoPart = item.dano ? `<div class="inv-stat"><span class="inv-dano-label">Dano</span><span class="inv-dano-val">${item.dano}</span>${bonus}${afiacaoBonus}${profundezasBonus}${rolarDanoBtn}</div>` : '';
      const precoPart = item.preco != null ? `<div class="inv-stat"><span class="inv-dano-label">💰 Preço</span><span class="inv-dano-val" style="color:var(--amber)">${item.preco}</span></div>` : '';
      const acertoPart = `<div class="inv-stat"><span class="inv-dano-label">Acerto</span>${!item.dano ? bonus : ''}${rolarAcertoBtn}</div>`;
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
          ${readOnly ? '' : `<button onclick="editInvItem(${p.id},'${item.id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;padding:2px;flex-shrink:0"><i class="ti ti-edit" style="font-size:15px"></i></button>`}
        </div>
        <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:5px">
          <span class="inv-peso-tag" style="color:#e8a838;background:rgba(232,168,56,0.12);border-color:rgba(232,168,56,0.3)">🎵 Instrumento</span>
          ${alcanceTag(item)}
          ${pesoTag(item)}
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
        ${readOnly ? '' : `<button onclick="editInvItem(${p.id},'${item.id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;padding:2px;flex-shrink:0"><i class="ti ti-edit" style="font-size:15px"></i></button>`}
      </div>
      <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:5px">
        ${alcanceTag(item)}
        ${pesoTag(item)}
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
    ${invSection('armas',     '⚔️ Armas',    'ti-sword',   'var(--red)',    armas,     renderArmaCard)}
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

// ═══════════════════════════════════════
// BANCO DE ITENS (Catálogo) — Armaduras, Elmos, Armas e Instrumentos
// ═══════════════════════════════════════
// Mesmo espírito do catálogo de Talentos/Habilidades: uma lista fixa de
// itens pré-definidos que o jogador pode escolher no modal de Inventário
// (busca por nome) para autopreencher o formulário — que continua editável
// manualmente antes ou depois de escolher um item do catálogo.
// Cada entrada de 'protecao' já indica seu subtipo (armadura/elmo).
const CATALOGO_ITENS = {
  protecao: [
    { id: 'cat_tecido',           name: 'Tecido',           subtipo: 'armadura', peso: 'leve',  valor: 3,  preco: 20, passosPenalidade: 0, efeito: 'Concede +1d4 de Vantagem em testes de Furtividade.' },
    { id: 'cat_armadura_leve',    name: 'Armadura Leve',    subtipo: 'armadura', peso: 'leve',  valor: 6,  preco: 40, passosPenalidade: 3, efeito: 'Reduz 3 de Passos.' },
    { id: 'cat_armadura_media',   name: 'Armadura Média',   subtipo: 'armadura', peso: 'media', valor: 8,  preco: 60, passosPenalidade: 5, efeito: 'Reduz 5 de Passos. Concede -1d4 de Desvantagem em testes de Furtividade.' },
    { id: 'cat_armadura_pesada',  name: 'Armadura Pesada',  subtipo: 'armadura', peso: 'pesada', valor: 12, preco: 80, passosPenalidade: 7, efeito: 'Reduz 7 de Passos. Concede Mega Desvantagem em testes de Furtividade.' },
    { id: 'cat_armadura_encantada', name: 'Armadura Encantada', subtipo: 'armadura', peso: 'encantada', valor: 7, preco: 50, passosPenalidade: 4, efeito: 'Reduz 4 de Passos. Concede -1d2 de Desvantagem em testes de Furtividade. Possui 1 espaço de Encantamento (requer o Talento Inferior "Equipamento Encantado").' },
    { id: 'cat_armadura_exotica', name: 'Armadura Exótica', subtipo: 'armadura', peso: 'exotica', valor: 10, preco: 75, passosPenalidade: 6, efeito: 'Reduz 6 de Passos. Concede -1d6 de Desvantagem em testes de Furtividade. Pode receber até 2 Aprimoramentos de Armadura.',
      usos: [{ name: 'Barreira de Retaliação', desc: 'Gaste 1 Cristal: até o final da luta, quem te atacar corpo a corpo recebe 1d6 de dano que atravessa Armadura. Pode ser usada diversas vezes no mesmo turno.', escopo: 'luta', usosMax: 3, custoCristal: 1 }] },
    { id: 'cat_armadura_tecido_exotico', name: 'Tecido Exótico', subtipo: 'armadura', peso: 'exotica', valor: 5, preco: 50, passosPenalidade: 2, efeito: 'Reduz 2 de Passos. Concede +1d4 de Vantagem em testes de Furtividade.',
      usos: [{ name: 'Restauração do Tecido Exótico', desc: 'Gaste 1 Cristal: restaure a Armadura do Tecido Exótico por completo, ou rejeite um dano. 1 uso por turno.', escopo: 'luta', usosMax: 3, umPorTurno: true, custoCristal: 1 }] },
    { id: 'cat_armadura_mega', name: 'Armadura Mega Pesada', subtipo: 'armadura', peso: 'mega', valor: 16, preco: 100, passosPenalidade: 8, efeito: 'Reduz 8 de Passos. Não pode realizar testes de Furtividade.' },
    { id: 'cat_elmo_capuz',  name: 'Capuz',       subtipo: 'elmo', peso: 'leve',  valor: 2, preco: 20, efeito: 'Concede +1d2 de Vantagem em testes de Furtividade.' },
    { id: 'cat_elmo_chapeu', name: 'Chapéu',      subtipo: 'elmo', peso: 'leve',  valor: 5, preco: 40, efeito: '' },
    { id: 'cat_elmo_medio',  name: 'Elmo Médio',  subtipo: 'elmo', peso: 'media', valor: 6, preco: 60, efeito: 'Concede -1d2 de Desvantagem em testes de Furtividade.' },
    { id: 'cat_elmo_pesado', name: 'Elmo Pesado', subtipo: 'elmo', peso: 'pesada', valor: 8, preco: 80, efeito: 'Concede -1d6 de Desvantagem em testes de Furtividade.' },
    { id: 'cat_elmo_encantado', name: 'Elmo Encantado', subtipo: 'elmo', peso: 'encantada', valor: 6, preco: 60, efeito: 'Concede -1 de Desvantagem em testes de Furtividade. Possui 1 espaço de Encantamento (requer o Talento Inferior "Equipamento Encantado").' },
    { id: 'cat_elmo_chapeu_exotico', name: 'Chapéu Exótico', subtipo: 'elmo', peso: 'exotica', valor: 5, preco: 50, efeito: 'Concede +1d2 de Vantagem em testes de Furtividade. Pode receber até 2 Aprimoramentos de Elmo.',
      usos: [{ name: 'Restauração do Chapéu', desc: 'Gaste 1 Cristal: restaura a Armadura do Chapéu.', escopo: 'luta', usosMax: 3, umPorTurno: true, custoCristal: 1 }] },
    { id: 'cat_elmo_exotico', name: 'Elmo Exótico', subtipo: 'elmo', peso: 'exotica', valor: 7, preco: 75, efeito: 'Concede -1d4 de Desvantagem em testes de Furtividade. Pode receber até 2 Aprimoramentos de Elmo.',
      usos: [{ name: 'Barreira Craniana', desc: 'Gaste 1 Cristal: remova sua Cegueira, ou crie uma barreira na sua cabeça que a torna impossível de ser mirada por 1 turno.', escopo: 'luta', usosMax: 3, umPorTurno: true, custoCristal: 1 }] },
    { id: 'cat_elmo_mega', name: 'Elmo Mega Pesado', subtipo: 'elmo', peso: 'mega', valor: 10, preco: 100, efeito: 'Concede -1d10 de Desvantagem em testes de Furtividade.' },
  ],
  arma: [
    {
      id: 'cat_arma_amuleto', name: 'Amuleto', peso: 'leve', dano: '1d4', preco: 25, alcance: 'curto',
      efeito: 'Um pingente aparentemente comum, sem função ofensiva evidente.',
      usos: [{ name: 'Restauração do Amuleto', desc: 'Restaure 1d8 de Vida. Pode ser usado diversas vezes no mesmo turno. Ao usar a 5ª vez, o amuleto se quebra.', escopo: 'arma', usosMax: 5 }],
    },
    {
      id: 'cat_arma_adagas_magicas', name: 'Adagas Mágicas', peso: 'leve', dano: '1d4', preco: 25, alcance: 'curto',
      efeito: 'Munição (Runas): as adagas guardam até 2 Runas. Ao gastar uma Runa, recarregue pagando 10 de Dinheiro no final da luta.',
      usos: [{ name: 'Invisibilidade da Runa', desc: 'Gaste 1 Runa: as adagas ficam invisíveis até acertarem um alvo — o alvo não consegue Desviar nem Aparar. 1 uso por Ação.', escopo: 'arma', usosMax: 2, custo: 1, custoRecarga: 10 }],
    },
    {
      id: 'cat_arma_cajado', name: 'Cajado', peso: 'leve', dano: '1d4', preco: 25, alcance: 'ambos',
      efeito: 'Passiva: ataques corpo a corpo com o cajado têm +1 de Alcance. O cajado também dispara feixes mágicos, com +2 de Alcance.',
      usos: [{ name: 'Recarga Arcana', desc: 'Recarregue um turno de recarga de um Feitiço seu. Pode ser usado diversas vezes no mesmo turno. Ao usar a 10ª vez, o cajado se quebra.', escopo: 'arma', usosMax: 10, reduzRecargaFeitico: true }],
    },
    {
      id: 'cat_arma_grimorio_conhecimento', name: 'Grimório do Conhecimento', peso: 'leve', dano: '1d4', preco: 25, alcance: 'longo',
      efeito: 'Passiva: escolha um Feitiço — pode lançá-lo uma vez por luta. Escolha também um elemento: seus disparos passam a ser baseados nele.',
      usos: [{ name: 'Lançar Feitiço Escolhido', desc: 'Lance o Feitiço escolhido na Passiva. Não consome os usos/recarga do Feitiço original do personagem.', escopo: 'luta', usosMax: 1, grimorioFeitico: true, semMunicao: true }],
    },
    {
      id: 'cat_arma_orbe_tecnologico', name: 'Orbe Tecnológico', peso: 'leve', dano: '1d4', preco: 25, alcance: 'longo',
      efeito: 'Munição (Cápsulas de Energia): o orbe guarda até 2 Cápsulas. Recarregue pagando 10 de Dinheiro por Cápsula.',
      usos: [{ name: 'Disparo de Energia', desc: 'Sacrifique 1 Cápsula de Energia e libere um disparo de energia — o dano é um teste de Arcano ou Místico (não pode mirar na cabeça).', escopo: 'arma', usosMax: 2, custoRecarga: 10 }],
    },
    {
      id: 'cat_arma_varinha', name: 'Varinha', peso: 'leve', dano: '1d4', preco: 25, alcance: 'longo',
      efeito: 'Passiva: a varinha possui magia, permitindo lançar feixes mágicos a Longo Alcance.',
      usos: [{ name: 'Impulso Arcano', desc: 'Ao lançar um Feitiço, conceda +1 de Vantagem para ele. Pode ser usado diversas vezes no mesmo turno. Ao usar a 10ª vez, a varinha se quebra.', escopo: 'arma', usosMax: 10, semMunicao: true }],
    },
    {
      id: 'cat_arma_adagas', name: 'Adagas', peso: 'media', dano: '1d6', preco: 50, alcance: 'curto',
      efeito: 'Passiva: se você estiver Furtivo, seu teste de Arremesso possui +1d6 de Vantagem.',
      usos: [{ name: 'Bolsa de Adagas', desc: 'Ative 1 Bolsa de Adagas: ela serve para a Luta inteira, sem precisar gastar de novo a cada Arremesso. Recarregue pagando 5 de Dinheiro por Bolsa.', escopo: 'arma', usosMax: 2, custoRecarga: 5 }],
    },
    {
      id: 'cat_arma_arco', name: 'Arco', peso: 'media', dano: '1d6', preco: 50, alcance: 'longo',
      efeito: 'Passiva: possui +6 de Alcance.',
      usos: [{ name: 'Aljava', desc: 'Ative 1 Aljava: ela serve para a Luta inteira, sem precisar gastar de novo a cada disparo. Recarregue pagando 5 de Dinheiro por Aljava.', escopo: 'arma', usosMax: 2, custoRecarga: 5 }],
    },
    {
      id: 'cat_arma_espada_uma_mao', name: 'Espada de Uma Mão', peso: 'media', dano: '1d6', preco: 50, alcance: 'curto',
      efeito: 'Passiva: ao Desviar, pode fazer um Contra-Ataque. Funciona apenas uma vez por turno.',
      usos: [{ name: 'Contra-Ataque', desc: 'Ao Desviar, faça um Contra-Ataque.', escopo: 'turno', usosMax: 1 }],
    },
    {
      id: 'cat_arma_foice', name: 'Foice', peso: 'media', dano: '1d6', preco: 50, alcance: 'curto',
      efeito: 'Passiva: ataques corpo a corpo possuem +2 de Alcance.',
    },
    {
      id: 'cat_arma_katana', name: 'Katana', peso: 'media', dano: '1d6', preco: 50, alcance: 'curto',
      efeito: 'Passiva: causa +1d6 de dano quando o alvo já está sem Armadura.',
    },
    {
      id: 'cat_arma_revolver', name: 'Revólver', peso: 'media', dano: '1d6', preco: 50, alcance: 'longo',
      efeito: 'Passiva: ao acertar um alvo, retire 1d2 de Armadura dele.',
      usos: [{ name: 'Pente de Balas', desc: 'Ative 1 Pente de Balas: ele serve para a Luta inteira, sem precisar gastar de novo a cada disparo. Recarregue pagando 10 de Dinheiro por Pente.', escopo: 'arma', usosMax: 2, custoRecarga: 10 }],
    },
    {
      id: 'cat_arma_conjunto_glaives', name: 'Conjunto de Glaives', peso: 'pesada', dano: '1d10', preco: 75, alcance: 'curto',
      efeito: 'Passiva: as glaives são como bumerangues — ao arremessar uma delas, ela retorna para sua mão no final do turno.',
    },
    {
      id: 'cat_arma_escudo_pesado', name: 'Escudo Pesado', peso: 'pesada', dano: '', preco: 75, alcance: 'curto',
      efeito: 'Passiva: fora do seu turno, o dado de dano é convertido em +1d6 de Vantagem em Aparar. No seu turno, o dado de dano é 1d4.',
    },
    {
      id: 'cat_arma_espada_pesada', name: 'Espada Pesada', peso: 'pesada', dano: '1d10', preco: 75, alcance: 'curto',
      efeito: 'Passiva: ao atacar com uma mão, possui +2 de Vantagem; ao atacar com as duas mãos, causa +2 de dano.',
    },
    {
      id: 'cat_arma_espingarda', name: 'Espingarda', peso: 'pesada', dano: '1d10', preco: 75, alcance: 'longo',
      efeito: 'Passiva: possui +2 de Alcance e causa +2 de dano perfurante (atravessa a Armadura).',
      usos: [{ name: 'Pente de Cartuchos', desc: 'Ative 1 Pente de Cartuchos: ele serve para a Luta inteira, sem precisar gastar de novo a cada disparo. Recarregue pagando 10 de Dinheiro por Pente.', escopo: 'arma', usosMax: 2, custoRecarga: 10 }],
    },
    {
      id: 'cat_arma_machado_arremesso', name: 'Machado de Arremesso', peso: 'pesada', dano: '1d10', preco: 75, alcance: 'curto',
      efeito: 'Passiva: no Arremesso, causa +2 de dano e possui +2 de Vantagem no Arremesso.',
    },
    {
      id: 'cat_arma_marreta', name: 'Marreta', peso: 'pesada', dano: '1d10', preco: 75, alcance: 'curto',
      efeito: 'Passiva: causa o dobro de dano em objetos, e o alvo possui -1d4 de Desvantagem em Aparar contra a marreta.',
    },
    {
      id: 'cat_arma_alianca_encantada', name: 'Aliança Encantada', peso: 'encantada', dano: '', preco: 50, alcance: 'curto',
      efeito: 'Passiva: seus Feitiços causam +1d4 de dano/cura — porém não há como atacar com a aliança, e ela ocupa o lugar de uma arma.',
      usos: [{ name: 'Explosão Mágica', desc: 'A aliança libera muita magia: seus Feitiços também possuem +3 de dano/cura nesse turno. Um uso por turno. Ao usar a 5ª vez, a aliança se quebra.', escopo: 'arma', usosMax: 5, umPorTurno: true }],
    },
    {
      id: 'cat_arma_cajado_encantado', name: 'Cajado Encantado', peso: 'encantada', dano: '1d4+3', preco: 50, alcance: 'ambos',
      efeito: 'Passiva: seus ataques corpo a corpo com o cajado possuem +1 de Alcance; o cajado também dispara feixes mágicos, com +2 de Alcance.',
      usos: [{ name: 'Duplicata Arcana', desc: 'O cajado encanta sua próxima invocação/evocação surgida de um Feitiço: ela cria uma duplicata dela pelo mesmo tempo de duração. Um uso por turno. Ao usar a 5ª vez, o cajado se quebra.', escopo: 'arma', usosMax: 5, umPorTurno: true }],
    },
    {
      id: 'cat_arma_garras_encantadas', name: 'Garras Encantadas', peso: 'encantada', dano: '1d4+3', preco: 50, alcance: 'curto',
      efeito: '',
      usos: [{ name: 'Absorção de Poder', desc: 'A magia das garras absorve poder: no seu próximo Feitiço que conceder um bônus para arma, esse bônus fica até o final da luta (só pode ter 3 bônus ao mesmo tempo nas garras). Um uso por turno. Ao usar a 5ª vez, as garras se quebram.', escopo: 'arma', usosMax: 5, umPorTurno: true }],
    },
    {
      id: 'cat_arma_lanca_eletrica', name: 'Lança Elétrica', peso: 'exotica', dano: '1d8', preco: 60, alcance: 'curto',
      efeito: 'Ativa: o Cristal Elétrico libera cargas fortes que causam +1d4 de dano no ataque, porém possui -1d4 de Desvantagem no lançamento.',
      usos: [{ name: 'Carga Elétrica', desc: 'Gaste 1 Cristal Elétrico: libera uma imensa carga que causa +(1d2+1)d4 de dano no próximo ataque. Um uso por turno.', escopo: 'luta', usosMax: 3, umPorTurno: true, custoCristal: 1 }],
    },
    {
      id: 'cat_arma_orbe_cristalino', name: 'Orbe Cristalino', peso: 'exotica', dano: '1d8', preco: 60, alcance: 'longo',
      efeito: 'Passiva: possui +3 de Alcance.',
      usos: [{ name: 'Feixe Perfurante', desc: 'Gaste 2 Cristais Elétricos: libera um feixe que atravessa Armadura e rola 1d2+1 que multiplica seu dano — caso o alvo esteja sem Armadura, perfura-o e o feixe continua o caminho. 1 uso por Ação.', escopo: 'luta', usosMax: 2, custo: 1, custoCristal: 2, semMunicao: true }],
    },
    {
      id: 'cat_arma_lanca_granada', name: 'Lança-Granada', peso: 'mega', dano: '1d8+1d6', preco: 100, alcance: 'longo',
      efeito: 'Ativa: gaste uma Ação para alternar o modo dela. Modo "Lança-Granada": dispara granadas numa área 5x5 com o alvo no centro — elas explodem no início do seu turno seguinte e atravessam Armadura. Modo Focado: dispara balas num alvo até 5 casas.',
      usos: [{ name: 'Pente de Granadas', desc: 'Ative 1 Pente de Granadas: ele serve para a Luta inteira, sem precisar gastar de novo a cada disparo. Recarregue pagando 25 de Dinheiro por Pente.', escopo: 'arma', usosMax: 2, custoRecarga: 25 }],
      ativas: [{ name: 'Lança-Granada', desc: 'Sacrifique 1d10 de Vida: se estiver no modo "Lança-Granada", a bomba explode ao alcançar o alvo. Se estiver no modo Individual, o dano atravessa a Armadura. Pode ser usado 2x por luta, 0 Ações.', escopo: 'luta', usosMax: 2 }],
    },
    {
      id: 'cat_arma_motosserra', name: 'Motosserra', peso: 'mega', dano: '1d8+1d6', preco: 100, alcance: 'curto',
      efeito: 'Passiva: ao causar dano diretamente na Vida, causa +1d8 de dano.',
      ativas: [{ name: 'Motosserra', desc: 'Sacrifique 1d6 de Vida: sua motosserra acelera e converte o próximo 1d8 da passiva para 1d12. Pode ser usado 2x por luta, 0 Ações.', escopo: 'luta', usosMax: 2 }],
    },
    {
      id: 'cat_arma_quebra_queixo_3769', name: 'Quebra-Queixo 3769', peso: 'mega', dano: '1d8+1d6', preco: 100, alcance: 'curto',
      efeito: 'Exclusivo do Briguento! Primeiro uso por personagem: sacrifique 1d10 da Vida Máxima e coloque essa arma no lugar de um braço. Passiva: possui +5 de Armadura e Vantagem em Aparar — se sua Armadura chegar a 0, o braço quebra. Escolha um Golpe: o braço aprende ele.',
      ativas: [{ name: 'Quebra-Queixo 3769', desc: 'Sacrifique 1d4 de Vida: restaure 1d2 de Armadura do seu braço. Pode ser usado 2x por luta, 0 Ações.', escopo: 'luta', usosMax: 2 }],
    },
    {
      id: 'cat_arma_sniper', name: 'Sniper', peso: 'mega', dano: '1d8+1d6', preco: 100, alcance: 'longo',
      efeito: 'Tem alcance do tabuleiro inteiro, porém possui Mega Desvantagem se o alvo estiver até 5 casas de você. A partir de 15 casas, mirar na cabeça não apresenta -8 de Desvantagem.',
      usos: [{ name: 'Pente de Munição', desc: 'Ative 1 Pente de Munição: ele serve para a Luta inteira, sem precisar gastar de novo a cada disparo. Recarregue pagando 25 de Dinheiro por Pente.', escopo: 'arma', usosMax: 2, custoRecarga: 25 }],
      ativas: [{ name: 'Sniper', desc: 'Consuma 1d4 de Vida: para cada ponto, receba +10% de chance de Crítico no próximo tiro da sniper. Pode ser usado 2x por luta, 0 Ações.', escopo: 'luta', usosMax: 2 }],
    },
    {
      id: 'cat_arma_ancora', name: 'Âncora', peso: 'mega', dano: '1d8+1d6', preco: 100, alcance: 'curto',
      efeito: 'Passiva: possui +3 de Alcance para Arremessar, e a âncora volta para sua mão por meio das correntes.',
      ativas: [{ name: 'Âncora', desc: 'No próximo Arremesso, sacrifique 1 de Vida para cada casa que a âncora percorrerá: puxe o alvo para você garantidamente. Pode ser usado 2x por luta, 0 Ações.', escopo: 'luta', usosMax: 2 }],
    },
    {
      id: 'cat_arma_destruidor_vapor', name: 'Destruidor a Vapor', peso: 'mega', dano: '1d8+1d6', preco: 100, alcance: 'curto',
      efeito: 'Passiva: ao causar dano na Armadura, causa +1d4 de dano nela. Em objetos, o dano dessa arma é Crítico.',
      ativas: [{ name: 'Destruidor a Vapor', desc: 'Sacrifique 1d12 de Vida: converta todo o dano da sua arma para atacar diretamente a Armadura do alvo. Pode ser usado 2x por luta, 0 Ações.', escopo: 'luta', usosMax: 2 }],
    },
    {
      id: 'cat_arma_esmaga_mundo', name: 'Esmaga-Mundo', peso: 'mega', dano: '1d8+1d6', preco: 100, alcance: 'curto',
      efeito: 'Passiva: causa o dobro de dano em objetos; possui -1d8 de Desvantagem em Aparar contra o esmaga-mundo. 1º uso por turno: gaste uma Ação — o dano dobrado passa a valer contra alvos vivos também, que não podem Aparar contra o esmaga-mundo no próximo ataque. Demais usos no turno: gaste uma Ação — seu próximo ataque com o esmaga-mundo possui +1d6 de dano e Vantagem.',
      ativas: [{ name: 'Esmaga-Mundo', desc: 'Sacrifique 1d10 de Vida: não precisa gastar uma Ação a mais para dobrar o dano em alvos vivos. Pode ser usado 2x por luta, 0 Ações.', escopo: 'luta', usosMax: 2 }],
    },
  ],
  instrumento: [
    {
      id: 'cat_instrumento_violino_amuleto', name: 'Violino-Amuleto', peso: 'leve', dano: '1d4', preco: 25, alcance: 'curto',
      efeito: 'Instrumento musical (Nota: Qualquer Nota). Aparenta ser apenas um bijuteria decorativa em forma de violino.',
      usos: [
        { name: 'Restauração do Violino-Amuleto', desc: 'Restaure 1d4 de Vida e receba qualquer Nota Musical. Pode ser usado diversas vezes no mesmo turno. Ao usar a 5ª vez, o violino-amuleto se quebra.', escopo: 'arma', usosMax: 5 },
        { name: 'Tocar Instrumento', desc: 'Toque o instrumento e receba uma Nota Musical à sua escolha.', escopo: 'turno', usosMax: 1, concedeNotaEscolhida: true },
      ],
    },
    {
      id: 'cat_instrumento_harpa_grimorio', name: 'Harpa-Grimório', peso: 'leve', dano: '1d4', preco: 25, alcance: 'longo',
      efeito: 'Instrumento musical (Nota: Qualquer Nota). Passiva: escolha um Feitiço — pode lançá-lo uma vez por luta, concedendo qualquer Nota Musical ao fazê-lo.',
      usos: [
        { name: 'Lançar Feitiço Escolhido', desc: 'Lance o Feitiço escolhido na Passiva. Não consome os usos/recarga do Feitiço original do personagem.', escopo: 'luta', usosMax: 1, grimorioFeitico: true, semMunicao: true },
        { name: 'Tocar Instrumento', desc: 'Toque o instrumento e receba uma Nota Musical à sua escolha.', escopo: 'turno', usosMax: 1, concedeNotaEscolhida: true },
      ],
    },
    {
      id: 'cat_instrumento_microfone_adaga', name: 'Microfone-Adaga', peso: 'media', dano: '1d6', preco: 50, alcance: 'curto',
      efeito: 'Instrumento musical (Nota: Qualquer Nota). Passiva: se o alvo estiver te encarando de longe, seu teste de Arremesso possui +1d4 de Vantagem, e ao acertá-lo no arremesso, receba qualquer Nota Musical.',
      usos: [
        { name: 'Bolsa de Microfone-Adaga', desc: 'Ative 1 Bolsa de Microfone-Adaga: ela serve para a Luta inteira, sem precisar gastar de novo a cada Arremesso. Recarregue pagando 5 de Dinheiro por Bolsa.', escopo: 'arma', usosMax: 2, custoRecarga: 5 },
        { name: 'Tocar Instrumento', desc: 'Toque o instrumento e receba uma Nota Musical à sua escolha.', escopo: 'turno', usosMax: 1, concedeNotaEscolhida: true },
      ],
    },
    {
      id: 'cat_instrumento_sousafone_foice', name: 'Sousafone-Foice', peso: 'media', dano: '1d6', preco: 50, alcance: 'curto',
      efeito: 'Instrumento musical (Nota: Qualquer Nota). Passiva: seu sopro é tão potente que seus ataques corpo a corpo possuem +2 de Alcance.',
      usos: [{ name: 'Tocar Instrumento', desc: 'Toque o instrumento e receba uma Nota Musical à sua escolha.', escopo: 'turno', usosMax: 1, concedeNotaEscolhida: true }],
    },
    {
      id: 'cat_instrumento_baixo_glaive', name: 'Baixo-Glaive', peso: 'pesada', dano: '1d10', preco: 75, alcance: 'curto',
      efeito: 'Instrumento musical (Nota: Qualquer Nota). Passiva: receba qualquer Nota Musical ao arremessar esse instrumento. No final do turno, ele retorna para sua mão.',
      usos: [{ name: 'Tocar Instrumento', desc: 'Toque o instrumento e receba uma Nota Musical à sua escolha.', escopo: 'turno', usosMax: 1, concedeNotaEscolhida: true }],
    },
    {
      id: 'cat_instrumento_guitarra_machado', name: 'Guitarra-Machado', peso: 'pesada', dano: '1d10', preco: 75, alcance: 'curto',
      efeito: 'Instrumento musical (Nota: Qualquer Nota). Passiva: no Arremesso, causa +2 de dano e possui +2 de Vantagem no Arremesso.',
      usos: [{ name: 'Tocar Instrumento', desc: 'Toque o instrumento e receba uma Nota Musical à sua escolha.', escopo: 'turno', usosMax: 1, concedeNotaEscolhida: true }],
    },
    {
      id: 'cat_instrumento_clarinete_encantado', name: 'Clarinete Encantado', peso: 'encantada', dano: '1d4+3', preco: 50, alcance: 'longo', vidaMax: 15,
      efeito: 'Instrumento musical (Nota: Qualquer Nota). Passiva 1: ao usar um Feitiço e receber dano dele, pode transmiti-lo para a Vida do instrumento (ver Vida do Item). Passiva 2: o instrumento possui uma carga mágica, podendo lançar pequenos feixes mágicos até 5 casas que causam dano.',
      usos: [
        { name: 'Restauração do Clarinete', desc: 'Restaure 1d8 de Vida do instrumento musical. Diversos usos por turno. Se a Vida do instrumento chegar a 0, ele se quebra.', escopo: 'arma', usosMax: 5, semMunicao: true },
        { name: 'Tocar Instrumento', desc: 'Toque o instrumento e receba uma Nota Musical à sua escolha.', escopo: 'turno', usosMax: 1, concedeNotaEscolhida: true },
      ],
    },
    {
      id: 'cat_instrumento_teclado_constelacao', name: 'Teclado Constelação', peso: 'exotica', dano: '1d8', preco: 60, alcance: 'longo',
      efeito: 'Instrumento musical (Nota: Qualquer Nota). Passiva: produz mini-constelações que acertam a Longo Alcance e possuem +3 de Alcance.',
      usos: [
        { name: 'Campo Harmônico', desc: 'Gaste 2 Cristais Elétricos e lance um campo harmônico. 1 uso por Ação.', escopo: 'luta', usosMax: 2, custo: 1, custoCristal: 2, semMunicao: true },
        { name: 'Tocar Instrumento', desc: 'Toque o instrumento e receba uma Nota Musical à sua escolha.', escopo: 'turno', usosMax: 1, concedeNotaEscolhida: true },
      ],
    },
    {
      id: 'cat_instrumento_sino_acorrentado', name: 'Sino Acorrentado', peso: 'mega', dano: '1d8+1d6', preco: 100, alcance: 'curto',
      efeito: 'Instrumento musical (Nota: Qualquer Nota). Passiva: possui +3 de Alcance para Arremessar; recebe qualquer Nota Musical ao arremessar esse instrumento, e o sino volta para sua mão por meio das correntes.',
      usos: [{ name: 'Tocar Instrumento', desc: 'Toque o instrumento e receba uma Nota Musical à sua escolha.', escopo: 'turno', usosMax: 1, concedeNotaEscolhida: true }],
      ativas: [{ name: 'Sino Acorrentado', desc: 'Sacrifique 1d6 de Vida: o sino bate loucamente, concedendo 3 Notas Musicais quaisquer e ensurdecendo todos os outros no tabuleiro. Pode ser usado 2x por luta, 0 Ações.', escopo: 'luta', usosMax: 2 }],
    },
    {
      id: 'cat_instrumento_guitarra_sniper', name: 'Guitarra-Sniper', peso: 'mega', dano: '1d8+1d6', preco: 100, alcance: 'longo',
      efeito: 'Instrumento musical (Nota: Qualquer Nota). Tem alcance do tabuleiro inteiro, porém possui Mega Desvantagem se o alvo estiver até 5 casas de você. A partir de 15 casas, mirar na cabeça não apresenta -8 de Desvantagem.',
      usos: [
        { name: 'Pente de Munição', desc: 'Ative 1 Pente de Munição: ele serve para a Luta inteira, sem precisar gastar de novo a cada disparo. Recarregue pagando 25 de Dinheiro por Pente.', escopo: 'arma', usosMax: 2, custoRecarga: 25 },
        { name: 'Tocar Instrumento', desc: 'Toque o instrumento e receba uma Nota Musical à sua escolha.', escopo: 'turno', usosMax: 1, concedeNotaEscolhida: true },
      ],
      ativas: [{ name: 'Guitarra-Sniper', desc: 'Sacrifique 1d4 de Vida: para cada ponto, receba +10% de chance Crítica, qualquer Nota Musical, e seu próximo disparo causa Ensurdecimento a todos os outros por 1 turno. Pode ser usado 2x por luta, 0 Ações.', escopo: 'luta', usosMax: 2 }],
    },
  ],
};

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

  const catalogoSearch = document.getElementById('inv-catalogo-search');
  if (catalogoSearch) catalogoSearch.value = '';

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
  // penalidade de passos (armaduras)
  const inputPassosPenalidade = document.getElementById('inv-m-passos-penalidade');
  if (inputPassosPenalidade) inputPassosPenalidade.value = data.passosPenalidade != null ? data.passosPenalidade : '';
  // preço (dinheiro) — armas, instrumentos e proteções
  const inputPreco = document.getElementById('inv-m-preco');
  if (inputPreco) inputPreco.value = data.preco != null ? data.preco : '';
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
  _douradoPendente = null;
  // ativas
  invAtivas  = data.ativas ? JSON.parse(JSON.stringify(data.ativas)) : [];
  // usos ("Usar (Nx)" — só se aplica a Armas)
  invUsos = data.usos ? JSON.parse(JSON.stringify(data.usos)) : [];
  // Vida do Item (opcional — Armas/Instrumentos)
  const inputVidaMax = document.getElementById('inv-m-vida-max');
  if (inputVidaMax) inputVidaMax.value = data.vidaMax != null ? data.vidaMax : '';
  // encantamento (Armadura/Elmo/Arma/Instrumento Encantados — peso 'encantada')
  invEncantamentoEscolhido = (data.encantamento && data.encantamento.id) || null;
  // Detecta invAprimoTipo ao editar item existente
  const _peso = data.peso || 'leve';
  if (_peso === 'exotica') {
    invAprimoTipo = invAprimos.length ? 'exotico' : 'nenhum'; // exótica vai direto pro catálogo de Aprimoramento
  } else if (_peso === 'encantada') {
    invAprimoTipo = 'encantado';
  } else if (invAprimos.some(a => a.dourado || a.name === 'Dourado')) {
    invAprimoTipo = 'dourado';
  } else if (invAprimos.length) {
    invAprimoTipo = 'exotico';
  } else {
    invAprimoTipo = 'nenhum';
  }

  _updateInvModalSections(tipo);
}

let invAprimos = [];
// Aprimoramento Dourado escolhido nesta sessão de edição do item, ainda não
// cobrado — só é cobrado (e descontado do Dinheiro) ao clicar em "Salvar"
// (ver saveInvItem). Resetado sempre que o modal de item é aberto.
let _douradoPendente = null;
let invAtivas  = [];
// Lista de "Usos" (Usar Nx) da Arma em edição — ver ESCOPO_USO_ARMA_LABEL/resetUsosArmaPorEscopo.
let invUsos = [];
// 'nenhum' | 'dourado' | 'exotico' | 'encantado'  — estado do seletor de tipo de aprimoramento
let invAprimoTipo = 'nenhum';
// id de ENCANTAMENTOS_EQUIPAMENTO (Armadura) ou ENCANTAMENTOS_ELMO (Elmo)
// escolhido no modal (ou null) — só se aplica quando peso === 'encantada';
// vira item.encantamento ao salvar (ver saveInvItem/buscarEncantamentoPorId).
let invEncantamentoEscolhido = null;

function _updateInvModalSections(tipo) {
  const ehArmaOuInstrumento = (tipo === 'arma' || tipo === 'instrumento');
  // Comprar/Ganhar: só pra item NOVO de Arma/Instrumento/Proteção (tem Preço).
  // Editar item existente, ou tipo 'item' genérico (sem Preço), usa "Salvar" normal.
  const mostraComprarGanhar = !modalInvId && tipo !== 'item';
  const btnSalvar  = document.getElementById('inv-m-salvar');
  const btnComprar = document.getElementById('inv-m-comprar');
  const btnGanhar  = document.getElementById('inv-m-ganhar');
  if (btnSalvar)  btnSalvar.style.display  = mostraComprarGanhar ? 'none' : '';
  if (btnComprar) btnComprar.style.display = mostraComprarGanhar ? '' : 'none';
  if (btnGanhar)  btnGanhar.style.display  = mostraComprarGanhar ? '' : 'none';
  document.getElementById('inv-sec-arma').style.display         = tipo === 'arma'        ? '' : 'none';
  document.getElementById('inv-sec-instrumento').style.display  = tipo === 'instrumento' ? '' : 'none';
  document.getElementById('inv-sec-alcance').style.display      = ehArmaOuInstrumento     ? '' : 'none';
  document.getElementById('inv-sec-protecao').style.display     = tipo === 'protecao'    ? '' : 'none';
  const secProtecaoSub = document.getElementById('inv-sec-protecao-sub');
  if (secProtecaoSub) secProtecaoSub.style.display = tipo === 'protecao' ? '' : 'none';
  document.getElementById('inv-sec-item').style.display         = tipo === 'item'        ? '' : 'none';

  // Preço (dinheiro): disponível para armas, instrumentos e proteções (não para item genérico)
  const secPreco = document.getElementById('inv-sec-preco');
  if (secPreco) secPreco.style.display = tipo !== 'item' ? '' : 'none';

  // Catálogo: disponível para armas, instrumentos e proteções (não para item genérico)
  const secCatalogo = document.getElementById('inv-sec-catalogo');
  if (secCatalogo) secCatalogo.style.display = tipo !== 'item' ? '' : 'none';
  renderInvCatalogo();

  const peso = _invSelectedPeso();
  // Aprimoramentos (inclui Encantamento Arcano/Místico): disponíveis para armas, instrumentos e proteções
  document.getElementById('inv-sec-exotica').style.display = (ehArmaOuInstrumento || tipo === 'protecao') ? '' : 'none';
  document.getElementById('inv-sec-mega').style.display    = (ehArmaOuInstrumento && peso === 'mega') ? '' : 'none';

  // Usos ("Usar (Nx)"): disponível pra Armas, Instrumentos e Proteções (Armadura/Elmo), em qualquer peso
  const secUsos = document.getElementById('inv-sec-usos');
  if (secUsos) {
    const mostraUsos = ehArmaOuInstrumento || tipo === 'protecao';
    secUsos.style.display = mostraUsos ? '' : 'none';
    if (mostraUsos) _renderInvUsos();
  }

  // Munição (armas/instrumentos de longo alcance) ou Cristais (itens exóticos ou com aprimo exótico)
  const alcance = _invSelectedAlcance();
  const isExoticaLongoAlcance = ehArmaOuInstrumento && peso === 'exotica' && alcance === 'longo';
  // Proteção com aprimo exótico também mostra cristais (via hint, sem campo extra de munição)
  const temAprimoExoticoModal = invAprimos.length > 0 && !invAprimos.every(a => a.dourado || a.name === 'Dourado');
  const protComAprimoExotico = tipo === 'protecao' && peso !== 'exotica' && temAprimoExoticoModal;
  const precisaMunicao = (ehArmaOuInstrumento && (alcance === 'longo' || peso === 'exotica'))
                      || (tipo === 'protecao' && (peso === 'exotica' || protComAprimoExotico));
  document.getElementById('inv-sec-municao').style.display = precisaMunicao ? '' : 'none';
  const municaoLabel = document.getElementById('inv-municao-label');
  // Exótica ou com aprimo exótico: campo principal mostra Cristais (informativo, read-only)
  // Comum longo alcance: campo principal = Munição editável
  if (municaoLabel) municaoLabel.textContent = (peso === 'exotica' || protComAprimoExotico) ? 'Cristais (compartilhados)' : 'Munição';
  // Campo extra de munição — só aparece quando exótica + longo alcance
  const secMunicaoExtra = document.getElementById('inv-sec-municao-extra');
  if (secMunicaoExtra) secMunicaoExtra.style.display = isExoticaLongoAlcance ? '' : 'none';
  // Campo de cristais vira informativo quando exótica ou proteção com aprimo exótico (valor vem do personagem, não do item)
  const inputMunicao = document.getElementById('inv-m-municao');
  if (inputMunicao) {
    if (peso === 'exotica' || protComAprimoExotico) {
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
  const tipoAtual = _invSelectedTipo();
  const isArmaduraProtecao = tipoAtual === 'protecao' && _invSelectedSub() === 'armadura';

  if (isArmaduraProtecao) {
    // Armaduras usam o catálogo próprio de Aprimoramentos de Armadura (Mini
    // Escudo/Caixa de Som/Socorro/Ligeirinho) — o limite e o custo por peso
    // são reaplicados a cada render em _buildAprimoArmaduraListHtml, então
    // não mexemos em invAprimos aqui.
    if (peso !== 'encantada') invEncantamentoEscolhido = null;
    _updateInvModalSections(tipoAtual);
    return;
  }

  // Ao trocar o peso, limpa aprimoramentos incompatíveis
  if (peso === 'exotica') {
    // Exótica (Arma/Instrumento): vai direto pro catálogo de Aprimoramento
    // (ver APRIMORAMENTOS_ARMA) — mantém só escolhas desse catálogo (catalogId),
    // remove Dourado/texto livre legado.
    invAprimos = invAprimos.filter(a => a.catalogId);
    invAprimoTipo = invAprimos.length ? 'exotico' : 'nenhum';
  } else if (peso === 'encantada') {
    // Encantada: o slot passa a ser o de Encantamento (Arcano/Místico)
    invAprimoTipo = 'encantado';
    invAprimos = [];
  } else {
    // Arma comum: se havia Dourado, mantém; se havia exótico livre, mantém; se havia nada, mantém nada
    if (invAprimoTipo === 'nenhum' || invAprimoTipo === 'encantado') invAprimos = [];
    if (invAprimoTipo === 'encantado') invAprimoTipo = 'nenhum';
  }
  // Saindo de 'encantada': o Encantamento escolhido não se aplica mais
  if (peso !== 'encantada') invEncantamentoEscolhido = null;
  _updateInvModalSections(_invSelectedTipo());
}

function invSelectSub(sub) {
  const subAnterior = _invSelectedSub();
  document.querySelectorAll('.inv-subtipo-btn').forEach(b => b.classList.toggle('active', b.dataset.sub === sub));
  renderInvCatalogo();

  // Armadura x Elmo têm catálogos de Aprimoramento (e Encantamento) próprios
  // e não-intercambiáveis (ver APRIMORAMENTOS_ARMADURA/APRIMORAMENTOS_ELMO) —
  // ao trocar de subtipo de fato, as escolhas feitas pro subtipo anterior não se aplicam mais.
  if (sub !== subAnterior) {
    invAprimos = invAprimos.filter(a => !a.catalogId);
    invEncantamentoEscolhido = null;
  }
  _updateAprimoUI();
  _renderInvAprimos();
}
function invSelectEquip(equipado) {
  document.querySelectorAll('.inv-equip-btn').forEach(b => b.classList.toggle('active', (b.dataset.equip === '1') === equipado));
}
function invSelectAlcance(alcance) {
  document.querySelectorAll('.inv-alcance-btn').forEach(b => b.classList.toggle('active', b.dataset.alcance === alcance));
  _updateInvModalSections(_invSelectedTipo());
}

// Repinta a lista de resultados do catálogo (armas, instrumentos e proteções),
// filtrando pelo texto de busca e, no caso de proteção, pelo subtipo ativo
// (armadura/elmo). Escolher um item apenas preenche o formulário — o usuário
// ainda pode editar tudo manualmente antes de salvar.
function renderInvCatalogo() {
  const lista = document.getElementById('inv-catalogo-lista');
  if (!lista) return;
  const tipo = _invSelectedTipo();
  if (tipo === 'item') { lista.innerHTML = ''; return; }

  const banco = CATALOGO_ITENS[tipo] || [];
  const termo = (document.getElementById('inv-catalogo-search') || {}).value || '';
  const termoNorm = termo.trim().toLowerCase();
  const subAtivo = tipo === 'protecao' ? _invSelectedSub() : null;
  const pOwner = modalInvPid != null ? PLAYERS.find(x => x.id === modalInvPid) : null;
  const temEncantado = pOwner ? temAcessoEquipamentoEncantado(pOwner) : false;
  const temExotico   = pOwner ? temAcessoEquipamentoExotico(pOwner) : false;
  // "Multifunções" (Campeão): sabe usar TODAS as Armas e Instrumentos, de
  // qualquer categoria — inclusive Exótica e Encantada — sem precisar dos
  // Talentos Inferiores "Equipamento Exótico"/"Equipamento Encantado". Só
  // vale pro tipo 'arma'/'instrumento', nunca pra Armadura/Elmo.
  const temMultifuncoesAqui = pOwner && (tipo === 'arma' || tipo === 'instrumento') && temMultifuncoesArma(pOwner);
  const temEncantadoAqui = temEncantado || temMultifuncoesAqui;
  const temExoticoAqui = temExotico || temMultifuncoesAqui;
  // NPC: Narrador pode dar qualquer item pro NPC — Encantado, Exótico ou
  // qualquer categoria de peso (inclusive Mega) — sem depender de Talento
  // Inferior nem do atributo da subclasse, que só valem pra fichas de jogador.
  const isNPCOwner = !!(pOwner && pOwner.isNPC);

  const filtrados = banco.filter(item => {
    // Itens de peso 'encantada' só aparecem no catálogo pra quem tem o Talento Inferior "Equipamento Encantado" (ou Multifunções, se for Arma/Instrumento)
    if (!isNPCOwner && item.peso === 'encantada' && !temEncantadoAqui) return false;
    // Itens de peso 'exotica' só aparecem no catálogo pra quem tem o Talento Inferior "Equipamento Exótico" (ou Multifunções, se for Arma/Instrumento)
    if (!isNPCOwner && item.peso === 'exotica' && !temExoticoAqui) return false;
    // Armadura e Elmo: TODAS as categorias de peso (Leve/Média/Pesada/Mega) são
    // travadas pelo atributo da subclasse + Talento Inferior "Maestria de Peso
    // Aprimorada" (ver getPesoMaximoArmaduraPersonagem/temAcessoPesoArmaduraOuElmo).
    if (!isNPCOwner && (item.subtipo === 'armadura' || item.subtipo === 'elmo') && pOwner && !temAcessoPesoArmaduraOuElmo(pOwner, item.peso)) return false;
    if (!isNPCOwner && (item.subtipo === 'armadura' || item.subtipo === 'elmo') && !pOwner && ORDEM_PESO_ARMADURA.includes(item.peso) && item.peso !== 'leve') return false;
    // Arma e Instrumento: o acesso por peso é EXCLUSIVO por atributo (só 1
    // categoria), e o Talento Inferior "Maestria de Peso Aprimorada" libera
    // também a categoria seguinte — ver getPesosArmaPermitidosPersonagem/temAcessoPesoArma.
    if (!isNPCOwner && (tipo === 'arma' || tipo === 'instrumento') && pOwner && !temAcessoPesoArma(pOwner, item.peso)) return false;
    if (!isNPCOwner && (tipo === 'arma' || tipo === 'instrumento') && !pOwner && ORDEM_PESO_ARMADURA.includes(item.peso) && item.peso !== 'leve') return false;
    if (subAtivo && item.subtipo !== subAtivo) return false;
    if (!termoNorm) return true;
    return item.name.toLowerCase().includes(termoNorm);
  });

  if (!filtrados.length) {
    lista.innerHTML = `<div style="font-size:11px;color:var(--text3);padding:6px 2px">Nenhum item encontrado no catálogo.</div>`;
    return;
  }

  lista.innerHTML = filtrados.map(item => {
    const detalhe = tipo === 'protecao'
      ? `🛡 ${item.valor}   ·   💰 ${item.preco}   ·   ${INV_PESO_LABEL[item.peso] || item.peso}`
      : `💰 ${item.preco}   ·   ${INV_PESO_LABEL[item.peso] || item.peso}${item.dano ? `   ·   ⚔ ${item.dano}` : ''}`;
    return `<div class="inv-catalogo-item" onclick="selecionarCatalogoItem('${item.id}')" style="cursor:pointer;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg3)">
      <div style="font-size:12px;font-weight:600;color:var(--text)">${item.name}</div>
      <div style="font-size:10.5px;color:var(--text3);margin-top:2px">${detalhe}</div>
    </div>`;
  }).join('');
}

// Preenche o formulário do modal com os dados de um item do catálogo.
function selecionarCatalogoItem(itemId) {
  const tipo = _invSelectedTipo();
  const banco = CATALOGO_ITENS[tipo] || [];
  const item = banco.find(x => x.id === itemId);
  if (!item) return;

  document.getElementById('inv-m-name').value = item.name;
  document.getElementById('inv-m-efeito').value = item.efeito || '';

  const inputPreco = document.getElementById('inv-m-preco');
  if (inputPreco) inputPreco.value = item.preco != null ? item.preco : '';

  if (tipo === 'protecao') {
    invSelectSub(item.subtipo);
    invSelectPeso(item.peso);
    document.getElementById('inv-m-valor').value = item.valor != null ? item.valor : '';
    const inputPassosPenalidade = document.getElementById('inv-m-passos-penalidade');
    if (inputPassosPenalidade) inputPassosPenalidade.value = item.passosPenalidade != null ? item.passosPenalidade : '';
    invUsos = item.usos ? JSON.parse(JSON.stringify(item.usos)) : [];
    _renderInvUsos();
  } else if (tipo === 'instrumento') {
    invSelectPeso(item.peso);
    if (item.alcance) invSelectAlcance(item.alcance);
    const inputDanoInst = document.getElementById('inv-m-dano-inst');
    if (inputDanoInst) inputDanoInst.value = item.dano || '';
    const inputMunicaoInst = document.getElementById('inv-m-municao');
    if (inputMunicaoInst) inputMunicaoInst.value = item.municao != null ? item.municao : '';
    invUsos = item.usos ? JSON.parse(JSON.stringify(item.usos)) : [];
    _renderInvUsos();
    invAtivas = item.ativas ? JSON.parse(JSON.stringify(item.ativas)) : [];
    _renderInvAtivas();
    const inputVidaMaxInst = document.getElementById('inv-m-vida-max');
    if (inputVidaMaxInst) inputVidaMaxInst.value = item.vidaMax != null ? item.vidaMax : '';
  } else {
    invSelectPeso(item.peso);
    if (item.alcance) invSelectAlcance(item.alcance);
    document.getElementById('inv-m-dano').value = item.dano || '';
    const inputMunicaoArma = document.getElementById('inv-m-municao');
    if (inputMunicaoArma) inputMunicaoArma.value = item.municao != null ? item.municao : '';
    invUsos = item.usos ? JSON.parse(JSON.stringify(item.usos)) : [];
    _renderInvUsos();
    invAtivas = item.ativas ? JSON.parse(JSON.stringify(item.ativas)) : [];
    _renderInvAtivas();
    const inputVidaMaxArma = document.getElementById('inv-m-vida-max');
    if (inputVidaMaxArma) inputVidaMaxArma.value = item.vidaMax != null ? item.vidaMax : '';
  }
}

// Monta o HTML do catálogo de Aprimoramentos de Armadura (Mini Escudo, Caixa
// de Som, Socorro, Ligeirinho), no mesmo espaço do seletor Dourado/Exótico.
// Reaplica o limite/custo por peso a cada render (Exótica: até 2, custo
// normal; demais pesos: até 1, custando 5x) e poda seleções acima do limite
// se o peso tiver mudado para um com menos slots.
function _buildAprimoArmaduraListHtml(peso) {
  const limite = limiteAprimorosArmadura(peso);
  const custo  = custoAprimoramentoArmadura(peso);
  const isExotica = peso === 'exotica';

  // Armaduras Comuns (não-Exóticas) só recebem os Aprimoramentos de Armadura
  // Exóticos se algum aliado da campanha tiver a passiva racial "Tecnologia
  // Draenei" — ver algumAliadoTemTecnologiaDraenei.
  if (!isExotica && !algumAliadoTemTecnologiaDraenei()) {
    return `<div style="font-size:11px;color:var(--text3);padding:4px 2px">⚠ Armaduras Comuns só recebem Aprimoramentos de Armadura Exóticos se algum aliado tiver a passiva racial <strong>"Tecnologia Draenei"</strong> (Draenei).</div>`;
  }

  // Poda seleções em excesso (ex: veio de Exótica com 2 e o peso virou Leve)
  // e remove Aprimoramentos exclusivos de Armadura Exótica se o peso não for mais Exótica.
  const catalogoPorId = {};
  APRIMORAMENTOS_ARMADURA.forEach(a => { catalogoPorId[a.id] = a; });
  if (!isExotica) {
    invAprimos = invAprimos.filter(a => !a.catalogId || !(catalogoPorId[a.catalogId] && catalogoPorId[a.catalogId].exoticoApenas));
  }
  const jaEscolhidos = invAprimos.filter(a => a.catalogId);
  if (jaEscolhidos.length > limite) {
    const manterIds = jaEscolhidos.slice(0, limite).map(a => a.catalogId);
    invAprimos = invAprimos.filter(a => !a.catalogId || manterIds.includes(a.catalogId));
  }
  // Resincroniza o custo exibido/salvo conforme o peso atual
  invAprimos.forEach(a => { if (a.catalogId) a.custo = custo; });

  const idsAtivos = invAprimos.filter(a => a.catalogId).map(a => a.catalogId);
  const aviso = `<div style="font-size:11px;color:var(--text3);margin-bottom:8px">Essa armadura pode ter até <strong>${limite}</strong> Aprimoramento${limite > 1 ? 's' : ''} de Armadura (💰 ${custo} cada${isExotica ? '' : ' — 5x o custo normal, por não ser Exótica'}).</div>`;

  const cards = APRIMORAMENTOS_ARMADURA
    .filter(a => !a.exoticoApenas || isExotica)
    .map(a => {
      const ativo = idsAtivos.includes(a.id);
      return `<div class="skill-card sk-gray" style="margin:0;cursor:pointer" onclick="toggleAprimoArmadura('${a.id}')">
      <div class="sk-name">${a.name}${a.exoticoApenas ? ' <span style="font-size:10px;font-weight:400;color:var(--text3)">(exclusivo de Armadura Exótica)</span>' : ''}</div>
      <div class="sk-tags"><span class="sk-tag">💰 ${custo}</span></div>
      <div style="font-size:11px;color:var(--text2);margin-top:6px;line-height:1.5">${a.desc}</div>
      <button class="btn ${ativo ? '' : 'btn-primary'}" style="width:100%;justify-content:center;margin-top:8px" onclick="event.stopPropagation();toggleAprimoArmadura('${a.id}')">
        ${ativo ? '✓ Escolhido — clique para remover' : 'Escolher'}
      </button>
    </div>`;
  }).join('');

  return aviso + `<div style="display:flex;flex-direction:column;gap:8px">${cards}</div>`;
}

// Alterna a escolha de um Aprimoramento de Armadura no modal, respeitando o
// limite de slots do peso atual (ver limiteAprimorosArmadura).
function toggleAprimoArmadura(catalogId) {
  const peso = _invSelectedPeso();
  const limite = limiteAprimorosArmadura(peso);
  const cat0 = APRIMORAMENTOS_ARMADURA.find(a => a.id === catalogId);
  if (cat0 && cat0.exoticoApenas && peso !== 'exotica') {
    alert(`"${cat0.name}" é exclusivo de Armadura Exótica.`);
    return;
  }
  if (peso !== 'exotica' && !algumAliadoTemTecnologiaDraenei()) {
    alert('Armaduras Comuns só recebem Aprimoramentos de Armadura Exóticos se algum aliado tiver a passiva racial "Tecnologia Draenei" (Draenei).');
    return;
  }
  const idx = invAprimos.findIndex(a => a.catalogId === catalogId);
  if (idx !== -1) {
    invAprimos.splice(idx, 1);
  } else {
    const jaEscolhidos = invAprimos.filter(a => a.catalogId).length;
    if (jaEscolhidos >= limite) {
      alert(`Essa armadura só pode ter ${limite} Aprimoramento${limite > 1 ? 's' : ''} de Armadura.`);
      return;
    }
    const cat = APRIMORAMENTOS_ARMADURA.find(a => a.id === catalogId);
    if (!cat) return;
    invAprimos.push({ catalogId: cat.id, name: cat.name, desc: cat.desc, custo: custoAprimoramentoArmadura(peso) });
  }
  _renderInvAprimos();
}

// Monta o HTML do catálogo de Aprimoramentos de Elmo (Defesa, Fone, Lente,
// Sobrevivência, Máscara Arcana), no mesmo espaço do seletor Dourado/Exótico
// — mesmo esquema de _buildAprimoArmaduraListHtml (ver comentários lá).
function _buildAprimoElmoListHtml(peso) {
  const limite = limiteAprimorosElmo(peso);
  const custo  = custoAprimoramentoElmo(peso);
  const isExotica = peso === 'exotica';

  // Elmos Comuns (não-Exóticos) só recebem os Aprimoramentos de Elmo Exóticos
  // se algum aliado da campanha tiver a passiva racial "Tecnologia Draenei".
  if (!isExotica && !algumAliadoTemTecnologiaDraenei()) {
    return `<div style="font-size:11px;color:var(--text3);padding:4px 2px">⚠ Elmos Comuns só recebem Aprimoramentos de Elmo Exóticos se algum aliado tiver a passiva racial <strong>"Tecnologia Draenei"</strong> (Draenei).</div>`;
  }

  // Poda seleções em excesso (ex: veio de Exótico com 2 e o peso virou Leve)
  const jaEscolhidos = invAprimos.filter(a => a.catalogId);
  if (jaEscolhidos.length > limite) {
    const manterIds = jaEscolhidos.slice(0, limite).map(a => a.catalogId);
    invAprimos = invAprimos.filter(a => !a.catalogId || manterIds.includes(a.catalogId));
  }
  // Resincroniza o custo exibido/salvo conforme o peso atual
  invAprimos.forEach(a => { if (a.catalogId) a.custo = custo; });

  const idsAtivos = invAprimos.filter(a => a.catalogId).map(a => a.catalogId);
  const aviso = `<div style="font-size:11px;color:var(--text3);margin-bottom:8px">Esse elmo pode ter até <strong>${limite}</strong> Aprimoramento${limite > 1 ? 's' : ''} de Elmo (💰 ${custo} cada${isExotica ? '' : ' — 5x o custo normal, por não ser Exótico'}).</div>`;

  const cards = APRIMORAMENTOS_ELMO.map(a => {
    const ativo = idsAtivos.includes(a.id);
    return `<div class="skill-card sk-gray" style="margin:0;cursor:pointer" onclick="toggleAprimoElmo('${a.id}')">
      <div class="sk-name">${a.name}</div>
      <div class="sk-tags"><span class="sk-tag">💰 ${custo}</span></div>
      <div style="font-size:11px;color:var(--text2);margin-top:6px;line-height:1.5">${a.desc}</div>
      <button class="btn ${ativo ? '' : 'btn-primary'}" style="width:100%;justify-content:center;margin-top:8px" onclick="event.stopPropagation();toggleAprimoElmo('${a.id}')">
        ${ativo ? '✓ Escolhido — clique para remover' : 'Escolher'}
      </button>
    </div>`;
  }).join('');

  return aviso + `<div style="display:flex;flex-direction:column;gap:8px">${cards}</div>`;
}

// Alterna a escolha de um Aprimoramento de Elmo no modal, respeitando o
// limite de slots do peso atual (ver limiteAprimorosElmo).
function toggleAprimoElmo(catalogId) {
  const peso = _invSelectedPeso();
  const limite = limiteAprimorosElmo(peso);
  if (peso !== 'exotica' && !algumAliadoTemTecnologiaDraenei()) {
    alert('Elmos Comuns só recebem Aprimoramentos de Elmo Exóticos se algum aliado tiver a passiva racial "Tecnologia Draenei" (Draenei).');
    return;
  }
  const idx = invAprimos.findIndex(a => a.catalogId === catalogId);
  if (idx !== -1) {
    invAprimos.splice(idx, 1);
  } else {
    const jaEscolhidos = invAprimos.filter(a => a.catalogId).length;
    if (jaEscolhidos >= limite) {
      alert(`Esse elmo só pode ter ${limite} Aprimoramento${limite > 1 ? 's' : ''} de Elmo.`);
      return;
    }
    const cat = APRIMORAMENTOS_ELMO.find(a => a.id === catalogId);
    if (!cat) return;
    invAprimos.push({ catalogId: cat.id, name: cat.name, desc: cat.desc, custo: custoAprimoramentoElmo(peso) });
  }
  _renderInvAprimos();
}

// Monta o HTML do catálogo de Aprimoramentos de Arma/Instrumento (Combo,
// Encantamento, Fusão, Pente, Ritmo) — mesmo esquema de
// _buildAprimoArmaduraListHtml (ver comentários lá). Sempre 1 slot, seja
// Exótico (custo normal) ou Comum (custo 5x, travado por Origem Comum Draenei).
function _buildAprimoArmaListHtml(peso) {
  const limite = limiteAprimorosArma(peso);
  const custo  = custoAprimoramentoArma(peso);
  const isExotica = peso === 'exotica';

  // Armas/Instrumentos Comuns só recebem os Aprimoramentos Exóticos se algum
  // aliado da campanha tiver a passiva de Origem "draenei_origem_comum".
  if (!isExotica && !algumAliadoTemOrigemComumDraenei()) {
    return `<div style="font-size:11px;color:var(--text3);padding:4px 2px">⚠ Armas/Instrumentos Comuns só recebem Aprimoramentos Exóticos se algum aliado tiver a passiva de Origem <strong>"Comum"</strong> (Draenei).</div>`;
  }

  // Poda seleções em excesso (defensivo — o limite é sempre 1)
  const jaEscolhidos = invAprimos.filter(a => a.catalogId);
  if (jaEscolhidos.length > limite) {
    const manterIds = jaEscolhidos.slice(0, limite).map(a => a.catalogId);
    invAprimos = invAprimos.filter(a => !a.catalogId || manterIds.includes(a.catalogId));
  }
  // Resincroniza o custo exibido/salvo conforme o peso atual
  invAprimos.forEach(a => { if (a.catalogId) a.custo = custo; });

  const idsAtivos = invAprimos.filter(a => a.catalogId).map(a => a.catalogId);
  const aviso = `<div style="font-size:11px;color:var(--text3);margin-bottom:8px">Essa arma/instrumento pode ter até <strong>${limite}</strong> Aprimoramento (💰 ${custo}${isExotica ? '' : ' — 5x o custo normal, por não ser Exótico'}).</div>`;

  const cards = APRIMORAMENTOS_ARMA.map(a => {
    const ativo = idsAtivos.includes(a.id);
    const extra = (a.id === 'encantamento' && ativo) ? _buildEncantamentoHabilidadeEscolhaHtml() : '';
    return `<div class="skill-card sk-gray" style="margin:0;cursor:pointer" onclick="toggleAprimoArma('${a.id}')">
      <div class="sk-name">${a.name}</div>
      <div class="sk-tags"><span class="sk-tag">💰 ${custo}</span></div>
      <div style="font-size:11px;color:var(--text2);margin-top:6px;line-height:1.5">${a.desc}</div>
      <button class="btn ${ativo ? '' : 'btn-primary'}" style="width:100%;justify-content:center;margin-top:8px" onclick="event.stopPropagation();toggleAprimoArma('${a.id}')">
        ${ativo ? '✓ Escolhido — clique para remover' : 'Escolher'}
      </button>
      ${extra}
    </div>`;
  }).join('');

  return aviso + `<div style="display:flex;flex-direction:column;gap:8px">${cards}</div>`;
}

// Sub-tela do Aprimoramento de Encantamento: escolher 1 Feitiço (Habilidade
// azul) de qualquer classe pra "morar" na arma — ela ignora o custo de Ação
// e a recarga normais; o único requisito pra usar é 1 Cristal (ver
// usarAprimoramentoArma). A escolha fica junto com o próprio Aprimoramento
// em invAprimos, não em p.skills — ela não aparece nas Habilidades normais.
function _buildEncantamentoHabilidadeEscolhaHtml() {
  const idx = invAprimos.findIndex(a => a.catalogId === 'encantamento');
  if (idx === -1) return '';
  const entry = invAprimos[idx];

  if (entry.habilidadeId) {
    return `<div onclick="event.stopPropagation()" style="margin-top:10px;padding:10px;background:var(--bg3);border:1px solid var(--border);border-radius:8px">
      <div style="font-size:10px;color:var(--text3);margin-bottom:4px">Feitiço encantado nessa arma:</div>
      <div style="font-size:12px;font-weight:600;color:#8ab8e8">✨ ${entry.habilidadeNome} <span style="font-size:10px;font-weight:400;color:var(--text3)">(${entry.habilidadeSubclasse})</span></div>
      <div style="font-size:11px;color:var(--text2);margin-top:4px;line-height:1.5">${entry.habilidadeDesc}</div>
      <button class="btn" style="margin-top:8px;font-size:11px;padding:4px 10px" onclick="event.stopPropagation();abrirEncantamentoFeiticoModal()">Trocar Feitiço</button>
    </div>`;
  }

  return `<div onclick="event.stopPropagation()" style="margin-top:10px;padding:10px;background:var(--bg3);border:1px solid var(--border);border-radius:8px">
    <div style="font-size:11px;color:var(--text3);margin-bottom:6px">Escolha 1 Feitiço (Habilidade azul) de qualquer classe — o custo de Ação e a recarga dele não valem aqui; o único requisito pra usar é 1 Cristal.</div>
    <button class="btn" style="font-size:11px;padding:4px 10px" onclick="event.stopPropagation();abrirEncantamentoFeiticoModal()">Escolher Feitiço</button>
  </div>`;
}

// Modal de busca/escolha do Feitiço do Aprimoramento de Encantamento — mesma
// UI (busca + lista) do Grimório do Conhecimento (ver abrirGrimorioModal),
// reaproveitando o mesmo overlay. Diferente do Grimório, a escolha aqui não
// fica num item já salvo no inventário: fica em invAprimos (estado do modal
// de Adicionar/Editar Item), por isso usa escolherHabilidadeEncantamento
// (já existente) como callback em vez de mexer em p.inventario direto.
function abrirEncantamentoFeiticoModal() {
  const overlay = document.getElementById('modal-grimorio-overlay');
  if (!overlay) return;
  const feiticos = getTodasHabilidadesAzuisCatalogo();

  const opcoesHtml = feiticos.map(sk => {
    const busca = `${sk.name} ${sk.subclasseOrigem} ${sk.desc}`.toLowerCase().replace(/"/g, '');
    return `<button class="tm-opcao tm-opcao-blue" data-busca="${escHtml(busca)}" onclick="event.stopPropagation();escolherFeiticoEncantamentoModal('${sk.id}')" style="display:flex;flex-direction:column;align-items:flex-start;gap:2px">
      <span class="tm-opcao-nome">${escHtml(sk.name)} <span style="font-size:10.5px;color:var(--text3);font-weight:400">— ${escHtml(sk.subclasseOrigem)}</span></span>
      <span style="font-size:11px;color:var(--text2);font-weight:400;line-height:1.4;text-align:left">${escHtml(sk.desc)}</span>
    </button>`;
  }).join('');

  overlay.innerHTML = `
    <div class="modal" style="max-width:480px" onclick="event.stopPropagation()">
      <h3><i class="ti ti-book-2"></i> Aprimoramento de Encantamento</h3>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px;line-height:1.5">
        Escolha um Feitiço de qualquer classe pra encantar a arma/instrumento.
      </div>
      <input type="text" placeholder="Buscar Feitiço..." oninput="filtrarGrimorioFeiticos(this.value)" style="width:100%;margin-bottom:10px;padding:8px 10px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px">
      <div class="tm-opcoes" id="grimorio-opcoes-lista" style="max-height:340px;overflow-y:auto">${opcoesHtml}</div>
      <button class="tm-cancelar" onclick="fecharGrimorioModal()">Cancelar</button>
    </div>`;
  overlay.classList.add('open');
}

function escolherFeiticoEncantamentoModal(skillId) {
  fecharGrimorioModal();
  escolherHabilidadeEncantamento(skillId);
}

// Confirma a escolha do Feitiço pro Aprimoramento de Encantamento.
function escolherHabilidadeEncantamento(skillId) {
  const idx = invAprimos.findIndex(a => a.catalogId === 'encantamento');
  if (idx === -1) return;
  const sk = getTodasHabilidadesAzuisCatalogo().find(s => s.id === skillId);
  if (!sk) return;
  invAprimos[idx].habilidadeId = sk.id;
  invAprimos[idx].habilidadeNome = sk.name;
  invAprimos[idx].habilidadeDesc = sk.desc;
  invAprimos[idx].habilidadeSubclasse = sk.subclasseOrigem;
  _renderInvAprimos();
}

// Limpa a escolha atual pra permitir escolher outro Feitiço.
function trocarHabilidadeEncantamento() {
  const idx = invAprimos.findIndex(a => a.catalogId === 'encantamento');
  if (idx === -1) return;
  delete invAprimos[idx].habilidadeId;
  delete invAprimos[idx].habilidadeNome;
  delete invAprimos[idx].habilidadeDesc;
  delete invAprimos[idx].habilidadeSubclasse;
  _renderInvAprimos();
}

// Alterna a escolha de um Aprimoramento de Arma/Instrumento no modal,
// respeitando o limite de slots (sempre 1 — ver limiteAprimorosArma).
function toggleAprimoArma(catalogId) {
  const peso = _invSelectedPeso();
  const limite = limiteAprimorosArma(peso);
  if (peso !== 'exotica' && !algumAliadoTemOrigemComumDraenei()) {
    alert('Armas/Instrumentos Comuns só recebem Aprimoramentos Exóticos se algum aliado tiver a passiva de Origem "Comum" (Draenei).');
    return;
  }
  const idx = invAprimos.findIndex(a => a.catalogId === catalogId);
  if (idx !== -1) {
    invAprimos.splice(idx, 1);
  } else {
    const jaEscolhidos = invAprimos.filter(a => a.catalogId).length;
    if (jaEscolhidos >= limite) {
      alert(`Essa arma/instrumento só pode ter ${limite} Aprimoramento.`);
      return;
    }
    const cat = APRIMORAMENTOS_ARMA.find(a => a.id === catalogId);
    if (!cat) return;
    invAprimos.push({ catalogId: cat.id, name: cat.name, desc: cat.desc, custo: custoAprimoramentoArma(peso) });
  }
  _renderInvAprimos();
}

// Monta o HTML do catálogo de Aprimoramentos Dourados — slot único, travado
// pela passiva racial "Dourado" (Anão) — ver algumAliadoTemDourado.
function _buildAprimoDouradoListHtml() {
  if (!algumAliadoTemDourado()) {
    return `<div style="font-size:11px;color:var(--text3);padding:4px 2px">⚠ Aprimoramentos Dourados só ficam disponíveis se algum aliado tiver a passiva racial <strong>"Dourado"</strong> (Anão).</div>`;
  }

  const idsEscolhidos = invAprimos.map(a => a.catalogId);
  const aviso = invAprimos.length > 1
    ? `<div style="font-size:11px;color:var(--text3);margin-bottom:8px">Esta arma tem ${invAprimos.length} Aprimoramentos Dourados combinados (fusão). Escolher um novo abaixo substitui todos eles por 1 só.</div>`
    : `<div style="font-size:11px;color:var(--text3);margin-bottom:8px">Escolha 1 Aprimoramento Dourado (💰 300 cada).</div>`;

  const cards = APRIMORAMENTOS_DOURADO.map(a => {
    const ativo = idsEscolhidos.includes(a.id);
    return `<div class="skill-card sk-gray" style="margin:0;cursor:pointer" onclick="toggleAprimoDourado('${a.id}')">
      <div class="sk-name">&#10024; ${a.name}</div>
      <div class="sk-tags"><span class="sk-tag">💰 ${a.custoBase}</span></div>
      <div style="font-size:11px;color:var(--text2);margin-top:6px;line-height:1.5">${a.desc}</div>
      <button class="btn ${ativo ? '' : 'btn-primary'}" style="width:100%;justify-content:center;margin-top:8px" onclick="event.stopPropagation();toggleAprimoDourado('${a.id}')">
        ${ativo ? '✓ Escolhido — clique para remover' : 'Escolher'}
      </button>
    </div>`;
  }).join('');

  return aviso + `<div style="display:flex;flex-direction:column;gap:8px">${cards}</div>`;
}

// Alterna a escolha de um Aprimoramento Dourado no modal — slot único
// (escolher um novo substitui o anterior; clicar no já escolhido remove).
function toggleAprimoDourado(catalogId) {
  if (!algumAliadoTemDourado()) {
    alert('Aprimoramentos Dourados só ficam disponíveis se algum aliado tiver a passiva racial "Dourado" (Anão).');
    return;
  }
  // Arma fundida pela Criação de Anão pode ter mais de 1 Aprimoramento Dourado
  // combinado — esse seletor é de 1 escolha só, então avisa antes de substituir
  // e perder os outros.
  if (invAprimos.length > 1) {
    const ok = confirm(`Essa arma tem ${invAprimos.length} Aprimoramentos Dourados combinados (provavelmente de uma fusão). Escolher aqui substitui TODOS eles por só 1. Continuar mesmo assim?`);
    if (!ok) return;
  }
  const jaEscolhido = invAprimos[0] && invAprimos[0].catalogId === catalogId;
  if (jaEscolhido) {
    invAprimos = [];
    _douradoPendente = null;
  } else {
    const cat = APRIMORAMENTOS_DOURADO.find(a => a.id === catalogId);
    if (!cat) return;
    invAprimos = [{ catalogId: cat.id, name: cat.name, desc: cat.desc, custo: cat.custoBase, dourado: true }];
    _douradoPendente = { catalogId: cat.id, name: cat.name, custoBase: cat.custoBase };
  }
  _renderInvAprimos();
}

function _renderInvAprimos() {
  const el = document.getElementById('inv-aprimos-list');
  if (!el) return;
  const tipo = _invSelectedTipo();
  const peso = _invSelectedPeso();
  const sub  = tipo === 'protecao' ? _invSelectedSub() : null;
  const isArmaduraProtecao = tipo === 'protecao' && sub === 'armadura';
  const isElmoProtecao     = tipo === 'protecao' && sub === 'elmo';

  // Armadura/Elmo Encantados (peso 'encantada'): catálogo de Encantamentos
  // (Arcano/Místico) — cada um com seu próprio catálogo (ENCANTAMENTOS_EQUIPAMENTO
  // pra Armadura, ENCANTAMENTOS_ELMO pra Elmo) — checado antes do catálogo de
  // Aprimoramentos de Armadura, já que só Armadura e Elmo podem ser Encantados por ora.
  if ((isArmaduraProtecao || isElmoProtecao) && peso === 'encantada') {
    el.innerHTML = _buildEncantamentoListHtml(isElmoProtecao ? 'elmo' : 'armadura');
    return;
  }

  // Armadura (Leve/Média/Pesada/Exótica): catálogo próprio de Aprimoramentos
  // de Armadura, no lugar do seletor Dourado/Exótico (ver APRIMORAMENTOS_ARMADURA).
  if (isArmaduraProtecao) {
    el.innerHTML = _buildAprimoArmaduraListHtml(peso);
    return;
  }

  // Elmo (Leve/Média/Pesada/Exótico): catálogo próprio de Aprimoramentos de
  // Elmo, no lugar do seletor Dourado/Exótico (ver APRIMORAMENTOS_ELMO).
  if (isElmoProtecao) {
    el.innerHTML = _buildAprimoElmoListHtml(peso);
    return;
  }

  // Arma/Instrumento Encantados (peso 'encantada'): catálogo próprio de
  // Encantamentos (Arcano/Místico) — ver ENCANTAMENTOS_ARMA.
  if (peso === 'encantada') {
    el.innerHTML = _buildEncantamentoListHtml('arma');
    return;
  }

  const isExotica = peso === 'exotica';

  if (isExotica) {
    // Arma/Instrumento Exótico: vai direto pro catálogo de Aprimoramento de
    // Arma/Instrumento (ver APRIMORAMENTOS_ARMA), sem seletor Dourado/Nenhum
    // — igual Armadura/Elmo Exóticos (Elmo Exótico já tem seu próprio catálogo acima).
    el.innerHTML = _buildAprimoArmaListHtml(peso);
    return;
  }

  // Armas comuns: renderiza conforme invAprimoTipo
  if (invAprimoTipo === 'dourado') {
    // Aprimoramento Dourado (catálogo, ver APRIMORAMENTOS_DOURADO) — travado
    // pela passiva racial "Dourado" (Anão) — ver algumAliadoTemDourado.
    el.innerHTML = _buildAprimoDouradoListHtml();
  } else if (invAprimoTipo === 'exotico') {
    // Aprimoramento de Arma/Instrumento (catálogo, ver APRIMORAMENTOS_ARMA) —
    // pra armas/instrumentos Comuns, travado por Origem Comum Draenei e custando 5x.
    el.innerHTML = _buildAprimoArmaListHtml(peso);
  } else {
    el.innerHTML = '';
  }
}

// Monta o HTML do catálogo de Encantamentos pro mesmo slot dos Aprimoramentos
// Dourado/Exótico — filtra pelo estilo (Arcano/Místico) já comprometido pelo
// personagem em outro equipamento e pelos Encantamentos já usados em outro item.
function _buildEncantamentoListHtml(subtipoAlvo) {
  const p = PLAYERS.find(x => x.id === modalInvPid);
  if (!p) return '';

  if (!temAcessoEquipamentoEncantado(p) && !(subtipoAlvo === 'arma' && temMultifuncoesArma(p))) {
    return `<div style="font-size:11px;color:var(--text3);padding:4px 2px">⚠ Requer o Talento Inferior <strong>"Equipamento Encantado"</strong>.</div>`;
  }

  const catalogo = subtipoAlvo === 'elmo' ? ENCANTAMENTOS_ELMO
    : subtipoAlvo === 'arma' ? ENCANTAMENTOS_ARMA
    : ENCANTAMENTOS_EQUIPAMENTO;
  const estiloAtual = getEstiloEncantamentoAtual(p);
  const aviso = estiloAtual
    ? `Estilo comprometido: <strong>${estiloAtual === 'arcano' ? 'Arcano' : 'Místico'}</strong> — só um estilo de Encantamento por personagem.`
    : 'Escolha o Encantamento deste equipamento. O estilo escolhido (Arcano ou Místico) valerá para todos os seus equipamentos encantados.';

  const opcoes = getEncantamentosDisponiveis(p, modalInvId, catalogo);
  const cards = opcoes.map(e => {
    const ativo = invEncantamentoEscolhido === e.id;
    const c = e.concede;
    return `<div class="skill-card sk-gray" style="margin:0;cursor:pointer" onclick="selectEncantamento('${e.id}')">
      <div class="sk-name">${e.name} <span style="font-size:10px;font-weight:400;color:var(--text3)">(${e.estilo === 'arcano' ? 'Arcano' : 'Místico'})</span></div>
      <div class="sk-tags"><span class="sk-tag">💰 ${e.custo}</span><span class="sk-tag">${c.tipoConcedido === 'ritual' ? '🌀 Ritual: ' : '✨ Feitiço: '}${c.name}</span></div>
      <div style="font-size:11px;color:var(--text2);margin:8px 0 6px;line-height:1.5"><strong>Passiva:</strong> ${e.passivaDesc}</div>
      <div style="font-size:11px;color:var(--text2);line-height:1.5"><strong>${c.name}:</strong> ${c.desc}</div>
      <button class="btn ${ativo ? '' : 'btn-primary'}" style="width:100%;justify-content:center;margin-top:8px" onclick="event.stopPropagation();selectEncantamento('${e.id}')">
        ${ativo ? '✓ Escolhido — clique para remover' : 'Escolher'}
      </button>
    </div>`;
  }).join('');

  const foraDeOpcoes = invEncantamentoEscolhido && !opcoes.some(o => o.id === invEncantamentoEscolhido)
    ? `<div style="font-size:11px;color:var(--text3);padding:6px 2px">O Encantamento atual não está mais disponível para esse estilo — escolha outro.</div>`
    : '';

  return `<div style="font-size:11px;color:var(--text3);margin-bottom:8px">${aviso}</div>`
    + foraDeOpcoes
    + (cards || `<div style="font-size:11px;color:var(--text3);padding:6px 2px">Nenhum Encantamento disponível.</div>`);
}

// Alterna a escolha de Encantamento no modal (clicar no já escolhido remove).
function selectEncantamento(id) {
  invEncantamentoEscolhido = (invEncantamentoEscolhido === id) ? null : id;
  _renderInvAprimos();
}

// Repinta a lista de "Liberar Vileza" (Mega Pesada) em edição — mesmo
// esquema dos "Usos" (Usar Nx): nome, efeito livre, escopo de recarga
// (Arma/Sessão/Luta/Turno) e a quantidade de usos (Nx). Funciona com o
// mesmo contador/botão "Usar" no card do item — ver usarAtiva/resetAtiva.
function _renderInvAtivas() {
  const el = document.getElementById('inv-ativas-list');
  if (!el) return;
  const ESCOPO_LABEL = { arma: 'Usar (Nx) pela Arma', sessao: 'Usar (Nx) por Sessão', luta: 'Usar (Nx) por Luta', turno: 'Usar (Nx) por Turno' };
  el.innerHTML = invAtivas.map((a,i) => `
    <div class="inv-extra-item" style="flex-direction:column;align-items:stretch;gap:6px">
      <div style="display:flex;gap:6px;align-items:flex-start">
        <input class="inv-extra-input" style="flex:1" value="${a.name||''}" placeholder="Nome da vileza" oninput="invAtivas[${i}].name=this.value">
        <button onclick="invAtivas.splice(${i},1);_renderInvAtivas()" style="background:none;border:none;color:var(--red);cursor:pointer;padding:4px"><i class="ti ti-x"></i></button>
      </div>
      <input class="inv-extra-input" style="font-size:11px;color:var(--text2)" value="${a.desc||''}" placeholder="Efeito ao liberar" oninput="invAtivas[${i}].desc=this.value">
      <div style="display:flex;gap:6px">
        <select class="inv-extra-input" style="flex:1" onchange="invAtivas[${i}].escopo=this.value">
          ${Object.keys(ESCOPO_LABEL).map(esc => `<option value="${esc}" ${(a.escopo||'luta')===esc?'selected':''}>${ESCOPO_LABEL[esc]}</option>`).join('')}
        </select>
        <input type="number" min="1" class="inv-extra-input" style="width:64px" value="${a.usosMax||2}" oninput="invAtivas[${i}].usosMax=Math.max(1,parseInt(this.value)||1)">
      </div>
    </div>`).join('');
}

// Repinta a lista de "Usos" (Usar Nx) da Arma em edição — cada linha tem
// nome, efeito livre, escopo de recarga (Arma/Sessão/Luta/Turno) e a
// quantidade de usos (Nx). Fica guardado no próprio item (item.usos) ao
// salvar — ver saveInvItem e o contador interativo em renderArmaCard.
function _renderInvUsos() {
  const el = document.getElementById('inv-usos-list');
  if (!el) return;
  const ESCOPO_LABEL = { arma: 'Usar (Nx) pela Arma', sessao: 'Usar (Nx) por Sessão', luta: 'Usar (Nx) por Luta', turno: 'Usar (Nx) por Turno' };
  el.innerHTML = invUsos.map((u,i) => `
    <div class="inv-extra-item" style="flex-direction:column;align-items:stretch;gap:6px">
      <div style="display:flex;gap:6px;align-items:flex-start">
        <input class="inv-extra-input" style="flex:1" value="${u.name||''}" placeholder="Nome do Uso" oninput="invUsos[${i}].name=this.value">
        <button onclick="invUsos.splice(${i},1);_renderInvUsos()" style="background:none;border:none;color:var(--red);cursor:pointer;padding:4px"><i class="ti ti-x"></i></button>
      </div>
      <input class="inv-extra-input" style="font-size:11px;color:var(--text2)" value="${u.desc||''}" placeholder="Efeito" oninput="invUsos[${i}].desc=this.value">
      <div style="display:flex;gap:6px">
        <select class="inv-extra-input" style="flex:1" onchange="invUsos[${i}].escopo=this.value">
          ${Object.keys(ESCOPO_LABEL).map(esc => `<option value="${esc}" ${u.escopo===esc?'selected':''}>${ESCOPO_LABEL[esc]}</option>`).join('')}
        </select>
        <input type="number" min="1" class="inv-extra-input" style="width:64px" value="${u.usosMax||1}" oninput="invUsos[${i}].usosMax=Math.max(1,parseInt(this.value)||1)">
      </div>
    </div>`).join('');
}

function addInvAprimo() { invAprimos.push({name:'',desc:''}); _renderInvAprimos(); }
function addInvAtiva()  { invAtivas.push({name:'',desc:''});  _renderInvAtivas();  }
function addInvUso()    { invUsos.push({name:'',desc:'',escopo:'luta',usosMax:1}); _renderInvUsos(); }

function selectAprimoTipo(tipo) {
  invAprimoTipo = tipo;
  if (tipo === 'dourado') {
    invEncantamentoEscolhido = null;
    // Dourado agora é catálogo (ver APRIMORAMENTOS_DOURADO) — mantém a
    // escolha catalogada existente, se houver; descarta qualquer outra coisa.
    invAprimos = invAprimos.filter(a => a.catalogId && APRIMORAMENTOS_DOURADO.some(d => d.id === a.catalogId));
  } else if (tipo === 'exotico') {
    invEncantamentoEscolhido = null;
    // Aprimoramento de Arma/Instrumento (catálogo APRIMORAMENTOS_ARMA) —
    // mantém a escolha catalogada existente, se houver; descarta Dourado.
    invAprimos = invAprimos.filter(a => a.catalogId && APRIMORAMENTOS_ARMA.some(d => d.id === a.catalogId));
  } else if (tipo === 'encantado') {
    // Encantamento usa invEncantamentoEscolhido, não invAprimos
    invAprimos = [];
  } else {
    invAprimos = [];
    invEncantamentoEscolhido = null;
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

  const suportaAprimo = tipo === 'arma' || tipo === 'instrumento' || tipo === 'protecao';
  if (!suportaAprimo) { seletor.style.display = 'none'; hint.style.display = 'none'; return; }

  const isExotica = peso === 'exotica';
  const isEncantada = peso === 'encantada';
  const isArmaduraProtecao = tipo === 'protecao' && _invSelectedSub() === 'armadura';
  const isElmoProtecao     = tipo === 'protecao' && _invSelectedSub() === 'elmo';
  // Encantada: só existe 1 slot possível (o Encantamento) — sem seletor.
  // Exótica (Armadura/Elmo/Arma/Instrumento): cada categoria usa seu próprio
  // catálogo de Aprimoramentos — também sem este seletor, direto pro catálogo.
  // Armadura/Elmo usam catálogo próprio em QUALQUER peso (não só Exótica).
  seletor.style.display = (isExotica || isEncantada || isArmaduraProtecao || isElmoProtecao) ? 'none' : 'flex';
  // O hint de texto livre não é mais usado por nenhuma categoria (todas têm catálogo próprio agora)
  hint.style.display = 'none';

  // Highlight do botão ativo (armas/instrumentos comuns: Dourado/Aprimoramento/Nenhum)
  ['dourado','exotico','nenhum'].forEach(t => {
    const btn = document.getElementById('inv-aprimo-btn-' + t);
    if (btn) btn.style.fontWeight = (invAprimoTipo === t) ? '700' : '';
    if (btn) btn.style.borderColor = (invAprimoTipo === t) ? 'var(--accent2)' : '';
  });
}

function closeInvModal() {
  document.getElementById('modal-inv-overlay').classList.remove('open');
}

function saveInvItem(cobrarDinheiro) {
  const p = PLAYERS.find(x => x.id === modalInvPid);
  if (!p) return;
  if (!Array.isArray(p.inventario)) p.inventario = [];

  const name    = document.getElementById('inv-m-name').value.trim();
  if (!name) { document.getElementById('inv-m-name').focus(); return; }

  // Aprimoramento Dourado escolhido nesta edição: só cobra os 300 de Dinheiro
  // agora, ao salvar de verdade (ver toggleAprimoDourado) — bloqueia o
  // salvamento se não tiver saldo.
  if (_douradoPendente) {
    if ((p.dinheiro || 0) < _douradoPendente.custoBase) {
      alert(`Dinheiro insuficiente! "${_douradoPendente.name}" custa ${_douradoPendente.custoBase} de Dinheiro, e ${p.name} só tem ${p.dinheiro || 0}.`);
      return;
    }
    p.dinheiro = Math.max(0, (p.dinheiro || 0) - _douradoPendente.custoBase);
    _douradoPendente = null;
  }

  const tipo    = _invSelectedTipo();
  const peso    = _invSelectedPeso();
  // "Multifunções" (Campeão) só permite GANHAR Armas/Instrumentos Mega
  // Pesados/Exóticos/Encantados — não comprar. Se o acesso a essa categoria
  // vier só da passiva (sem o Talento Inferior/atributo correspondente),
  // bloqueia o botão "Comprar" (cobrarDinheiro === true); "Ganhar" continua liberado.
  if (!modalInvId && (tipo === 'arma' || tipo === 'instrumento') && cobrarDinheiro === true && temMultifuncoesArma(p)) {
    const semMultifuncoesMega = getPesosArmaPermitidosPersonagem(p, true).includes('mega');
    if (peso === 'mega' && !semMultifuncoesMega) {
      alert('Multifunções só permite GANHAR Armas/Instrumentos Mega Pesados, não comprar. Use o botão "Ganhar".');
      return;
    }
    if (peso === 'exotica' && !temAcessoEquipamentoExotico(p)) {
      alert('Multifunções só permite GANHAR Armas/Instrumentos Exóticos, não comprar. Use o botão "Ganhar".');
      return;
    }
    if (peso === 'encantada' && !temAcessoEquipamentoEncantado(p)) {
      alert('Multifunções só permite GANHAR Armas/Instrumentos Encantados, não comprar. Use o botão "Ganhar".');
      return;
    }
  }

  // "Comprar" (cobrarDinheiro === true) desconta o Preço do Dinheiro do
  // personagem; "Ganhar" (=== false) mantém o Dinheiro intacto. Só se aplica
  // a item NOVO de Arma/Instrumento/Proteção (ver toggle dos botões em
  // _updateInvModalSections) — editar um item existente, ou salvar um item
  // genérico (sem Preço), usa "Salvar" normal e nunca cobra. A arma/
  // armadura/elmo inicial ganha no wizard de criação de personagem não passa
  // por aqui e continua sem custo.
  if (!modalInvId && tipo !== 'item' && cobrarDinheiro === true) {
    const precoCobrancaRaw = (document.getElementById('inv-m-preco') || {}).value || '';
    const precoCobranca = precoCobrancaRaw.trim() !== '' ? Number(precoCobrancaRaw.trim()) : 0;
    if (precoCobranca > 0) {
      if ((p.dinheiro || 0) < precoCobranca) {
        alert(`Dinheiro insuficiente! Este item custa ${precoCobranca} de Dinheiro, e ${p.name} só tem ${p.dinheiro || 0}.`);
        return;
      }
      p.dinheiro = Math.max(0, (p.dinheiro || 0) - precoCobranca);
    }
  }
  const efeito  = document.getElementById('inv-m-efeito').value.trim();
  const dano    = document.getElementById('inv-m-dano').value.trim();
  const alcance = _invSelectedAlcance();
  const municaoRaw = document.getElementById('inv-m-municao').value.trim();
  const municao = municaoRaw !== '' ? Math.max(0, parseInt(municaoRaw)) : 0;
  const valor   = document.getElementById('inv-m-valor').value.trim();
  const passosPenalidadeRaw = (document.getElementById('inv-m-passos-penalidade') || {}).value || '';
  const passosPenalidade = passosPenalidadeRaw.trim() !== '' ? Math.max(0, Number(passosPenalidadeRaw.trim())) : 0;
  const precoRaw = (document.getElementById('inv-m-preco') || {}).value || '';
  const preco   = precoRaw.trim() !== '' ? Number(precoRaw.trim()) : null;
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
    base.aprimoramentos = invAprimos.filter(a => a.name || a.dourado);
    // Armas exóticas: cristais ficam em p.cristais (pool do personagem), não no item
    if (peso === 'mega')    base.ativas = invAtivas.filter(a => a.name).map(a => ({ ...a, escopo: a.escopo || 'luta', usosMax: a.usosMax || 2, usosAtuais: a.usosAtuais != null ? a.usosAtuais : (a.usosMax || 2) }));
    // Usos ("Usar Nx") — livres, disponíveis em qualquer peso de Arma
    base.usos = invUsos.filter(u => u.name).map(u => ({ ...u, usosAtuais: u.usosAtuais != null ? u.usosAtuais : u.usosMax }));
    // Vida do Item (opcional)
    const vidaMaxRaw = (document.getElementById('inv-m-vida-max') || {}).value || '';
    base.vidaMax = vidaMaxRaw !== '' ? Math.max(0, parseInt(vidaMaxRaw)) : null;
  } else if (tipo === 'instrumento') {
    const danoInst = (document.getElementById('inv-m-dano-inst') || {}).value || '';
    Object.assign(base, { peso, dano: danoInst.trim(), alcance });
    if (alcance === 'longo') {
      if (peso === 'exotica') {
        // Instrumento exótico de longo alcance: munição vem do campo extra
        const municaoExtraRaw = (document.getElementById('inv-m-municao-extra') || {}).value || '';
        base.municao = municaoExtraRaw !== '' ? Math.max(0, parseInt(municaoExtraRaw)) : 0;
      } else {
        base.municao = municao;
      }
    }
    // Aprimoramentos disponíveis para todos os instrumentos
    base.aprimoramentos = invAprimos.filter(a => a.name || a.dourado);
    // Instrumentos Mega Pesados: Liberar Vileza
    if (peso === 'mega')    base.ativas = invAtivas.filter(a => a.name).map(a => ({ ...a, escopo: a.escopo || 'luta', usosMax: a.usosMax || 2, usosAtuais: a.usosAtuais != null ? a.usosAtuais : (a.usosMax || 2) }));
    // Usos ("Usar Nx") — livres, disponíveis em qualquer peso de Instrumento
    base.usos = invUsos.filter(u => u.name).map(u => ({ ...u, usosAtuais: u.usosAtuais != null ? u.usosAtuais : u.usosMax }));
    // Vida do Item (opcional)
    const vidaMaxRawInst = (document.getElementById('inv-m-vida-max') || {}).value || '';
    base.vidaMax = vidaMaxRawInst !== '' ? Math.max(0, parseInt(vidaMaxRawInst)) : null;
    // Instrumentos exóticos: cristais ficam em p.cristais (pool do personagem), não no item
  } else if (tipo === 'protecao') {
    Object.assign(base, { peso, subtipo, valor: valor !== '' ? Number(valor) : null, passosPenalidade, equipado });
    // Aprimoramentos disponíveis para proteções (Draenei)
    base.aprimoramentos = invAprimos.filter(a => a.name || a.dourado);
    // Usos ("Usar Nx") — livres, disponíveis em qualquer peso de Armadura/Elmo
    base.usos = invUsos.filter(u => u.name).map(u => ({ ...u, usosAtuais: u.usosAtuais != null ? u.usosAtuais : u.usosMax }));
    // Proteções exóticas: atualiza o pool de cristais do personagem
    if (peso === 'exotica') {
      const p2 = PLAYERS.find(x => x.id === modalInvPid);
      if (p2) { p2.cristais = municao; }
    }
    // Proteção comum com aprimoramento exótico: também usa cristais compartilhados (não altera p.cristais aqui,
    // pois o pool já é do personagem — apenas garante que o item salva seus aprimoramentos)
  } else {
    if (qtd !== null) base.qtd = qtd;
  }

  // Preço (dinheiro): armas, instrumentos e proteções (armaduras/elmos)
  if (tipo !== 'item') base.preco = preco;

  // Encantamento (Armadura/Elmo/Arma Encantados — peso 'encantada')
  if (tipo !== 'item') {
    if (peso === 'encantada' && invEncantamentoEscolhido) {
      const catEnc = buscarEncantamentoPorId(invEncantamentoEscolhido);
      base.encantamento = catEnc
        ? { id: catEnc.id, name: catEnc.name, estilo: catEnc.estilo, passivaDesc: catEnc.passivaDesc, custo: catEnc.custo }
        : null;
      // O Estilo de Encantamento (Arcano/Místico) do personagem não é mais
      // escolhido numa tela separada — trava sozinho, pra sempre, no
      // primeiro Encantamento que o personagem ganha/compra. Os próximos
      // itens encantados já vêm filtrados pra esse mesmo estilo (ver
      // getEncantamentosDisponiveis).
      if (catEnc && !p.estiloEncantamentoId) {
        p.estiloEncantamentoId = catEnc.estilo;
      }
    } else {
      base.encantamento = null;
    }
  }

  // Usos de Arma ("Usar Nx") já existentes — guardado antes de sobrescrever,
  // pra preservar usosAtuais dos usos que continuam iguais (ver abaixo).
  const usosAntigos = (modalInvId && (p.inventario.find(x => x.id === modalInvId) || {}).usos) || [];
  // Liberar Vileza já existentes — mesma ideia, pra preservar usosAtuais.
  const ativasAntigas = (modalInvId && (p.inventario.find(x => x.id === modalInvId) || {}).ativas) || [];
  // Vida do Item já existente — guardado antes de sobrescrever, pra preservar
  // vidaAtual se a Vida Máxima continuar a mesma (ver abaixo).
  const itemAntigo = modalInvId ? p.inventario.find(x => x.id === modalInvId) : null;
  const vidaAtualAntiga = itemAntigo ? itemAntigo.vidaAtual : null;
  const vidaMaxAntiga = itemAntigo ? itemAntigo.vidaMax : null;

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

  // Sincroniza a Habilidade (Feitiço/Ritual) concedida pelo Encantamento —
  // remove a anterior deste item (se houver) e adiciona a nova.
  if (!Array.isArray(p.skills)) p.skills = [];
  p.skills = p.skills.filter(sk => sk.encantamentoItemId !== savedId);
  const itemSalvo = p.inventario.find(x => x.id === savedId);
  if (itemSalvo && itemSalvo.encantamento) {
    const catEnc = buscarEncantamentoPorId(itemSalvo.encantamento.id);
    if (catEnc) p.skills.push(construirSkillEncantamento(catEnc, savedId));
  }

  // Usos de Arma ("Usar Nx") — preserva usosAtuais dos usos que continuam
  // com o mesmo nome/escopo/quantidade; usos novos começam cheios.
  if (itemSalvo && itemSalvo.usos && itemSalvo.usos.length) {
    itemSalvo.usos = itemSalvo.usos.map(u => {
      const antigo = usosAntigos.find(a => a.name === u.name && a.escopo === u.escopo && a.usosMax === u.usosMax);
      return { ...u, usosAtuais: antigo ? antigo.usosAtuais : u.usosMax, ultimoTurnoUsado: antigo ? antigo.ultimoTurnoUsado : null };
    });
  }

  // Liberar Vileza — mesma preservação de usosAtuais que os Usos.
  if (itemSalvo && itemSalvo.ativas && itemSalvo.ativas.length) {
    itemSalvo.ativas = itemSalvo.ativas.map(a => {
      const antiga = ativasAntigas.find(x => x.name === a.name && x.escopo === a.escopo && x.usosMax === a.usosMax);
      return { ...a, usosAtuais: antiga ? antiga.usosAtuais : (a.usosMax || 2) };
    });
  }

  // Vida do Item — preserva vidaAtual se a Vida Máxima não mudou; se mudou
  // (ou é novo), começa cheia. Clampa pro novo máximo se ele diminuiu.
  if (itemSalvo && itemSalvo.vidaMax != null) {
    itemSalvo.vidaAtual = (vidaAtualAntiga != null && vidaMaxAntiga === itemSalvo.vidaMax)
      ? Math.min(vidaAtualAntiga, itemSalvo.vidaMax)
      : itemSalvo.vidaMax;
  }

  // Origem "Comum" (Draenei): toda vez que comprar uma Arma/Instrumento
  // Exótica nova, ou aplicar um Aprimoramento Exótico numa Arma/Instrumento
  // Comum que ainda não tinha, o personagem ganha +3 Cristais (pool compartilhado).
  if ((tipo === 'arma' || tipo === 'instrumento') && itemSalvo) {
    const eraNovoItem = !itemAntigo;
    const isExotica = itemSalvo.peso === 'exotica';
    const catalogIdAntigo = itemAntigo && (itemAntigo.aprimoramentos || []).find(a => a.catalogId && APRIMORAMENTOS_ARMA.some(x => x.id === a.catalogId));
    const catalogIdNovo = (itemSalvo.aprimoramentos || []).find(a => a.catalogId && APRIMORAMENTOS_ARMA.some(x => x.id === a.catalogId));
    const comprouExotica = eraNovoItem && isExotica;
    const aprimorouComum = !isExotica && !catalogIdAntigo && catalogIdNovo;
    if (comprouExotica || aprimorouComum) {
      adjCristais(p.id, 3);
    }
  }

  saveState();
  renderJogador();
  renderAll();
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
    // Remove também a Habilidade (Feitiço/Ritual) concedida por um eventual Encantamento deste item
    p.skills = (p.skills || []).filter(sk => sk.encantamentoItemId !== modalInvId);
  }
  saveState();
  renderJogador();
  renderAll();
  closeInvModal();
}

// ═══════════════════════════════════════
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
  if (npcTipoContainerNovo) npcTipoContainerNovo.style.display = wizardIsNPC ? '' : 'none';
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
  if (npcTipoContainerEdit) npcTipoContainerEdit.style.display = wizardIsNPC ? '' : 'none';
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
          aprimoramentos: [],
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
