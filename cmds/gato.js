let handler = async ({ msg, sock, args, usedPrefix }) => {
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

  const rawMonto = args.find(a => /^\d+$/.test(a.replace(/[^0-9]/g, '')));
  const montoArg = rawMonto ? parseInt(rawMonto.replace(/[^0-9]/g, '')) : NaN;
  const apuesta = (!isNaN(montoArg) && montoArg > 0) ? montoArg : 1000;

  const userRetador = db.getChatUser(chatId, msg.sender);
  const userRetado = db.getChatUser(chatId, retado);

  const totalRetador = (userRetador?.coins || 0) + (userRetador?.bank || 0);
  const totalRetado = (userRetado?.coins || 0) + (userRetado?.bank || 0);

  if (totalRetador < apuesta) {
    return sock.reply(chatId, `❌ No tienes suficientes Yenes. Tienes en total: $${totalRetador.toLocaleString()}`, msg);
  }

  if (totalRetado < apuesta) {
    return sock.reply(chatId, `❌ El usuario mencionado no tiene $${apuesta.toLocaleString()} Yenes en total.`, msg);
  }

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
};

handler.help = ['gato @usuario'];
handler.tags = ['game'];
handler.command = /^(gato|ttt|tictactoe)$/i; // En Yuki-Bot muchos handlers usan Expresiones Regulares para el comando

export default handler;
