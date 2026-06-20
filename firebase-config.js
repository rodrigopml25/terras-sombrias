// ═══════════════════════════════════════════════════════════
// CONFIGURAÇÃO DO FIREBASE — Terras Sombras
// ═══════════════════════════════════════════════════════════
// Este arquivo é o ÚNICO que você precisa editar para ativar a
// sincronização entre o computador do Narrador e o do Jogador.
//
// COMO OBTER ESSES VALORES (gratuito, ~5 minutos):
// 1. Acesse https://console.firebase.google.com/
// 2. Clique em "Adicionar projeto" e siga os passos (pode desativar
//    o Google Analytics, não é necessário).
// 3. No menu lateral, vá em "Compilação" (Build) > "Realtime Database".
// 4. Clique em "Criar banco de dados". Escolha qualquer região.
// 5. Quando perguntar sobre regras de segurança, escolha
//    "Iniciar no modo de teste" (test mode).
// 6. Volte para a tela inicial do projeto (ícone de engrenagem >
//    "Configurações do projeto" > aba "Geral").
// 7. Em "Seus aplicativos", clique no ícone "</>" (Web) para
//    registrar um app. Dê um nome qualquer (ex: "terras-sombras").
// 8. O Firebase vai te mostrar um objeto "firebaseConfig" parecido
//    com o exemplo abaixo. Copie os valores para dentro do objeto
//    FIREBASE_CONFIG abaixo, substituindo os placeholders.
// 9. Salve este arquivo e abra jogador.html / narrador.html
//    normalmente. Repita o passo de copiar este MESMO arquivo
//    (com os mesmos valores) para o computador do Narrador e do
//    Jogador — os dois precisam ter o mesmo firebase-config.js.
//
// IMPORTANTE SOBRE SEGURANÇA:
// O "modo de teste" do Firebase libera leitura/escrita para
// qualquer pessoa que tenha a URL do seu banco por 30 dias, depois
// bloqueia tudo. Para este projeto (uma ficha de RPG sem dados
// sensíveis) isso é tranquilo, mas se quiser que funcione para
// sempre sem expirar, vá em Realtime Database > aba "Regras" e
// substitua o conteúdo por:
//   {
//     "rules": {
//       ".read": true,
//       ".write": true
//     }
//   }
// e clique em "Publicar". Isso mantém o banco aberto indefinidamente
// (sem senha) — suficiente para uso entre amigos numa mesma campanha.
// ═══════════════════════════════════════════════════════════

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCIeC9vwhFMX2V44Y_Zb4igD6RlkANOmxI",
    authDomain: "terras-sombrias.firebaseapp.com",
    databaseURL: "https://terras-sombrias-default-rtdb.firebaseio.com",
    projectId: "terras-sombrias",
    storageBucket: "terras-sombrias.firebasestorage.app",
    messagingSenderId: "32314412947",
    appId: "1:32314412947:web:758ee7ab153dd002482266",
    measurementId: "G-H7LNQ3SDQ5"
};

// Não precisa editar nada abaixo desta linha.
window.FIREBASE_CONFIG = FIREBASE_CONFIG;
