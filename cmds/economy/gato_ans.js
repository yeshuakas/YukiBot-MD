import db from '#db';

// Función para renderizar el tablero con emojis
function renderBoard(board) {
  const symbols = board.map(cell => {
    if (cell === 'X') return '❌';
    if (cell === 'O') return '⭕';
    // Números del 1 al 9 en emojis para indicar las casillas vacías
    const numEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
    return numEmojis[cell];
  });

  return (
    `${symbols[0]} | ${symbols[1]} | ${symbols[2]}\n` +
    `---+---+---\n` +
    `${symbols[3]} | ${symbols[4]} | ${symbols[5]}\n` +
    `---+---+---\n` +
    `${symbols[6]} | ${symbols[7]} | ${symbols[8]}`
  );
}

// Comprobar si hay ganador
function checkWinner(board) {
  const wins = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Filas
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columnas
    [0, 4, 8], [2, 4, 6]             // Diagonales
  ];
  for (const [a, b, c] of wins) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

export default {
  // Listener que escucha los mensajes sin necesidad de prefijo (#)
  before: async ({ msg, sock }) => {
    const chatId = msg.chat;
    if (!global.tictactoe || !global.tictactoe[chatId]) return;

    const game = global.tictactoe[chatId];
    const text = msg.body ? msg.body.trim().toLowerCase() : '';

    // -------------------------------------------------------------
    // FASE 1: ACEPTAR O RECHAZAR EL RETO
    // -------------------------------------------------------------
    if (game.estado === 'esperando') {
      if (msg.sender !== game.retado) return; // Solo el retado puede responder

      if (text === 'rechazar') {
        clearTimeout(game.timeout);
        delete global.tictactoe[chatId];
        return msg.reply('❌ El desafío fue rechazado.');
      }

      if (text === 'aceptar') {
        clearTimeout(game.timeout);

        // Volver a verificar que ambos sigan teniendo el dinero
        const userRetador = db.getChatUser(chatId, game.retador) || {};
        const userRetado = db.getChatUser(chatId, game.retado) || {};

        const totalRetador = (userRetador.coins || 0) + (userRetador.bank || 0);
        const totalRetado = (userRetador.coins || 0) + (userRetado.bank || 0);

        if (totalRetador < game.apuesta || totalRetado < game.apuesta) {
          delete global.tictactoe[chatId];
          return msg.reply('❌ La partida se canceló porque uno de los jugadores ya no tiene la cantidad de la apuesta.');
        }

        // Cambiar estado a jugando
        game.estado = 'jugando';
        game.simboloRetador = '❌';
        game.simboloRetado = '⭕';

        const idBot = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const settings = db.getSettings(idBot);
        const monedas = settings.currency || 'Yenes';

        await sock.reply(
          chatId,
          `🎮 *¡DESAFÍO ACEPTADO!*\n\n` +
          `💰 *Pozo en juego:* ¥${(game.apuesta * 2).toLocaleString()} ${monedas}\n` +
          `❌ @${game.retador.split('@')[0]}\n` +
          `⭕ @${game.retado.split('@')[0]}\n\n` +
          `Turno de: @${game.turno.split('@')[0]} (❌)\n\n` +
          `${renderBoard(game.tablero)}\n\n` +
          `👉 *Responde con un número del 1 al 9 para colocar tu ficha.*`,
          msg,
          { mentions: [game.retador, game.retado, game.turno] }
        );
        return;
      }
    }

    // -------------------------------------------------------------
    // FASE 2: TURNOS DE JUEGO (NÚMEROS DEL 1 AL 9)
    // -------------------------------------------------------------
    if (game.estado === 'jugando') {
      if (msg.sender !== game.turno) return; // No es el turno del jugador

      const pos = parseInt(text) - 1;
      if (isNaN(pos) || pos < 0 || pos > 8 || typeof game.tablero[pos] !== 'number') {
        return; // Mensaje no es un número válido de casilla
      }

      // Colocar símbolo
      const simboloActual = msg.sender === game.retador ? game.simboloRetador : game.simboloRetado;
      game.tablero[pos] = simboloActual;

      // Verificar si hay ganador
      const ganadorSimbolo = checkWinner(game.tablero);
      const idBot = sock.user.id.split(':')[0] + '@s.whatsapp.net';
      const settings = db.getSettings(idBot);
      const monedas = settings.currency || 'Yenes';

      if (ganadorSimbolo) {
        const ganadorJid = msg.sender;
        const perdedorJid = msg.sender === game.retador ? game.retado : game.retador;

        // Transferencia de dinero
        const userPerdedor = db.getChatUser(chatId, perdedorJid) || {};
        const userGanador = db.getChatUser(chatId, ganadorJid) || {};

        // Restar apuesta al perdedor (prioridad de coins, luego bank)
        if ((userPerdedor.coins || 0) >= game.apuesta) {
          db.setChatUser(chatId, perdedorJid, 'coins', userPerdedor.coins - game.apuesta);
        } else {
          const restante = game.apuesta - (userPerdedor.coins || 0);
          db.setChatUser(chatId, perdedorJid, 'coins', 0);
          db.setChatUser(chatId, perdedorJid, 'bank', Math.max(0, (userPerdedor.bank || 0) - restante));
        }

        // Sumar premio al ganador
        db.setChatUser(chatId, ganadorJid, 'coins', (userGanador.coins || 0) + game.apuesta);

        await sock.reply(
          chatId,
          `🏆 *¡TENEMOS GANADOR!*\n\n` +
          `🎉 @${ganadorJid.split('@')[0]} ha ganado la partida y se lleva *¥${game.apuesta.toLocaleString()} ${monedas}* de su oponente!\n\n` +
          `${renderBoard(game.tablero)}`,
          msg,
          { mentions: [ganadorJid] }
        );

        delete global.tictactoe[chatId];
        return;
      }

      // Verificar si hay empate
      const estaLleno = game.tablero.every(cell => typeof cell !== 'number');
      if (estaLleno) {
        await sock.reply(
          chatId,
          `🤝 *¡EMPATE!*\n\n` +
          `Nadie gana ni pierde Yenes.\n\n` +
          `${renderBoard(game.tablero)}`,
          msg
        );
        delete global.tictactoe[chatId];
        return;
      }

      // Cambiar de turno
      game.turno = game.turno === game.retador ? game.retado : game.retador;
      const siguienteSimbolo = game.turno === game.retador ? game.simboloRetador : game.simboloRetado;

      await sock.reply(
        chatId,
        ` Turno de: @${game.turno.split('@')[0]} (${siguienteSimbolo})\n\n` +
        `${renderBoard(game.tablero)}`,
        msg,
        { mentions: [game.turno] }
      );
    }
  }
};
