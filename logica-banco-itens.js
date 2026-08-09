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
  // equipado (arma/instrumento) — mesma ideia, bloco/classe própria
  document.querySelectorAll('.inv-equip-arma-btn').forEach(b => {
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
  const secStatusArma = document.getElementById('inv-sec-status-arma');
  if (secStatusArma) secStatusArma.style.display = ehArmaOuInstrumento ? '' : 'none';

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
// Mesma ideia de _invSelectedEquip, mas pro bloco de Status de Arma/
// Instrumento (classe própria — inv-equip-arma-btn — pra não colidir com o
// bloco de Proteção, que compartilha a tela mas fica escondido conforme o
// tipo selecionado).
function _invSelectedEquipArma() {
  const b = document.querySelector('.inv-equip-arma-btn.active');
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
function invSelectEquipArma(equipado) {
  document.querySelectorAll('.inv-equip-arma-btn').forEach(b => b.classList.toggle('active', (b.dataset.equip === '1') === equipado));
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
  const equipadoArma = _invSelectedEquipArma();
  const qtdRaw  = document.getElementById('inv-m-qtd').value.trim();
  const qtd     = qtdRaw !== '' ? parseInt(qtdRaw) : null;

  const base = { name, efeito, tipo };
  if (tipo === 'arma') {
    Object.assign(base, { peso, dano, alcance, equipado: equipadoArma });
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
    Object.assign(base, { peso, dano: danoInst.trim(), alcance, equipado: equipadoArma });
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

  // Só pode haver 1 Arma ou Instrumento equipado por vez por personagem
  // (mesmo "slot de mão" — ver toggleEquipArma)
  if ((tipo === 'arma' || tipo === 'instrumento') && equipadoArma) {
    p.inventario.forEach(it => {
      if ((it.tipo === 'arma' || it.tipo === 'instrumento') && it.id !== savedId) it.equipado = false;
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
