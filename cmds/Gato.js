import db from '#db';

global.tictactoe = global.tictactoe || {};

// Función auxiliar para renderizar el tablero en texto
const renderBoard = (board) => {
  const symbols = { 0: '1️⃣', 1: '2️⃣', 2: '3️⃣', 3: '4️⃣', 4: '5️⃣', 5: '6️⃣', 6: '7️⃣', 7: '8️⃣', 8: '9️⃣', X: '❌', O: '⭕' };
  return (
    `${symbols[board[0]]} | ${symbols[board[1]]} | ${symbols[board[2]]}\n` +
    `---+---+---\n` +
    `${symbols[board[3]]} | ${symbols[board[4]]} | ${symbols[board[5]]}\n` +
    `---+---+---\n` +
    `${symbols[board[6]]} | ${symbols[board[7]]} | ${symbols[board[8]]}`
  );
};

// Combinaciones ganadoras posibles
const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Filas
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columnas
  [0, 4, 8], [2, 4, 6]             // Diagonales
];

const checkWinner = (board) => {
  for (const [a, b, c] of WINNING_COMBOS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]; // Retorna 'X' o 'O'
    }
  }
  if (board.every(cell => typeof cell !== 'number')) return 'tie'; // Empate
  return null;
};

export default {
  command: ['ttt', 'tresenraya', 'gato'],
  category: 'juegos',
  description: 'Reta a otro usuario a Tres en Raya apostando Yenes (usa cartera y banco).',

  before: async ({ msg, sock }) => {
    const chatId = msg.chat;
    const juego = global.tictactoe[chatId];
    if (!juego) return;

    const texto = msg.text?.trim().toLowerCase();

    // 1. FASE DE ACEPTACIÓN
    if (juego.estado === 'esperando') {
      if (msg.sender !== juego.retado) return;

      if (['rechazar', 'no', 'cancelar'].includes(texto)) {
        clearTimeout(juego.timeout);
        delete global.tictactoe[chatId];
        return sock.reply(chatId, `❌ @${msg.sender.split('@')[0]} rechazó el reto de Tres en Raya.`, msg, { mentions: [msg.sender] });
      }

      if (['aceptar', 'si', 'sí'].includes(texto)) {
        clearTimeout(juego.timeout);
        juego.estado = 'jugando';

        // 60 segundos de inactividad máxima por turno
        juego.resetTimeout = () => {
          clearTimeout(juego.timeout);
          juego.timeout = setTimeout(() => {
            if (global.tictactoe[chatId]) {
              delete global.tictactoe[chatId];
              sock.reply(chatId, '⏱️ *Tiempo agotado.* El juego se canceló por inactividad.', msg);
            }
          }, 60000);
        };
        juego.resetTimeout();

        await sock.reply(
          chatId,
          `🎮 *¡EMPIEZA EL TRES EN RAYA!*\n\n` +
          `❌ **X:** @${juego.retador.split('@')[0]}\n` +
          `⭕ **O:** @${juego.retado.split('@')[0]}\n` +
          `💰 **Apuesta:** $${juego.apuesta.toLocaleString()} Yenes\n\n` +
          `👉 *Turno de:* @${juego.turno.split('@')[0]} (Escribe del 1 al 9)\n\n` +
          `${renderBoard(juego.tablero)}`,
          msg,
          { mentions: [juego.retador, juego.retado, juego.turno] }
        );
        return true;
      }
    }

    // 2. FASE DE JUEGO (TURNOS)
    if (juego.estado === 'jugando') {
      if (msg.sender !== juego.turno) return;

      const posicion = parseInt(texto) - 1;
      if (isNaN(posicion) || posicion < 0 || posicion > 8) return;

      if (typeof juego.tablero[posicion] !== 'number') {
        return sock.reply(chatId, '⚠️ Esa casilla ya está ocupada. Elige otra.', msg);
      }

      // Colocar la marca (X u O)
      const ficha = juego.turno === juego.retador ? 'X' : 'O';
      juego.tablero[posicion] = ficha;

      // Comprobar si hay ganador o empate
      const resultado = checkWinner(juego.tablero);

      if (resultado) {
        clearTimeout(juego.timeout);

        if (resultado === 'tie') {
          delete global.tictactoe[chatId];
          return sock.reply(
            chatId,
            `🤝 *¡EMPATE METICULOSO!*\n\nNadie gana ni pierde Yenes.\n\n${renderBoard(juego.tablero)}`,
            msg
          );
        }

        // Definir Ganador y Perdedor
        const ganador = juego.turno;
        const perdedor = ganador === juego.retador ? juego.retado : juego.retador;

        const userGanador = db.getChatUser(chatId, ganador);
        const userPerdedor = db.getChatUser(chatId, perdedor);

        // 🏦 TRANSACCIÓN ECONÓMICA (Cartera + Banco)
        let montoRestante = juego.apuesta;
        let perdedorCoins = userPerdedor.coins || 0;
        let perdedorBank = userPerdedor.bank || 0;

        // 1. Cobrar al perdedor (primero cartera, luego banco)
        if (perdedorCoins >= montoRestante) {
          perdedorCoins -= montoRestante;
        } else {
          montoRestante -= perdedorCoins;
          perdedorCoins = 0;
          perdedorBank = Math.max(0, perdedorBank - montoRestante);
        }

        // 2. Pagar al ganador (se acredita a su banco)
        const ganadorBank = (userGanador.bank || 0) + juego.apuesta;

        // Guardar cambios en la BD
        db.setChatUser(chatId, perdedor, 'coins', perdedorCoins);
        db.setChatUser(chatId, perdedor, 'bank', perdedorBank);
        db.setChatUser(chatId, ganador, 'bank', ganadorBank);

        delete global.tictactoe[chatId];

        return sock.reply(
          chatId,
          `🏆 *¡TENEMOS UN GANADOR!*\n\n` +
          `🥇 @${ganador.split('@')[0]} le ha ganado a @${perdedor.split('@')[0]}\n` +
          `💰 *Premio:* $${juego.apuesta.toLocaleString()} Yenes (depositados en su Banco 🏦).\n\n` +
          `${renderBoard(juego.tablero)}`,
          msg,
          { mentions: [ganador, perdedor] }
        );
      }

      // Alternar turno
      juego.turno = juego.turno === juego.retador ? juego.retado : juego.retador;
      juego.resetTimeout();

      const siguienteFicha = juego.turno === juego.retador ? '❌' : '⭕';
      await sock.reply(
        chatId,
        `👉 Turno de ${siguienteFicha} @${juego.turno.split('@')[0]}\n\n${renderBoard(juego.tablero)}`,
        msg,
        { mentions: [juego.turno] }
      );
      return true;
    }
  },

  run: async ({ msg, sock, args, usedPrefix }) => {
    const chatId = msg.chat;

    if (global.tictactoe[chatId]) {
      return sock.reply(chatId, '⚠️ Ya hay una partida activa o pendiente en este grupo.', msg);
    }

    const retado = msg.mentionedJid?.[0];
    if (!retado) {
      return sock.reply(chatId, `⚠️ Debes mencionar a un usuario.\n\n*Ejemplo:* \`${usedPrefix}gato @usuario 1000\``, msg);
    }

    if (retado === msg.sender) {
      return sock.reply(chatId, '❌ No puedes jugar contra ti mismo.', msg);
    }

    // Apuesta (Por defecto 1000 si no se escribe monto)
    const montoArg = parseInt(args.find(a => !a.includes('@')));
    const apuesta = (!isNaN(montoArg) && montoArg > 0) ? montoArg : 1000;

    // Verificar fondos considerando Cartera + Banco
    const userRetador = db.getChatUser(chatId, msg.sender);
    const userRetado = db.getChatUser(chatId, retado);

    const totalRetador = (userRetador.coins || 0) + (userRetador.bank || 0);
    const totalRetado = (userRetado.coins || 0) + (userRetado.bank || 0);

    if (totalRetador < apuesta) {
      return sock.reply(chatId, `❌ No tienes suficientes Yenes (en Cartera + Banco). Tienes en total: $${totalRetador.toLocaleString()}`, msg);
    }

    if (totalRetado < apuesta) {
      return sock.reply(chatId, `❌ El usuario mencionado no tiene $${apuesta.toLocaleString()} Yenes en total.`, msg);
    }

    // Inicializar estado del juego
    global.tictactoe[chatId] = {
      estado: 'esperando',
      retador: msg.sender,
      retado,
      turno: msg.sender,
      apuesta,
      tablero: [0, 1, 2, 3, 4, 5, 6, 7, 8],
      timeout: setTimeout(() => {
        if (global.tictactoe[chatId]?.estado === 'esperando') {
          delete global.tictactoe[chatId];
          sock.reply(chatId, '⏱️ El reto expiró porque no respondieron a tiempo.', msg);
        }
      }, 60000)
    };

    await sock.reply(
      chatId,
      `🥊 *¡DESAFÍO GATO!*\n\n` +
      `👤 @${msg.sender.split('@')[0]} retó a @${retado.split('@')[0]}\n` +
      `💰 *Apuesta:* $${apuesta.toLocaleString()} Yenes\n\n` +
      `👉 @${retado.split('@')[0]}, responde con *aceptar* o *rechazar* para jugar.`,
      msg,
      { mentions: [msg.sender, retado] }
    );
  }
};
