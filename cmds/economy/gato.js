import db from '#db';

export default {
  command: ['gato', 'ttt', 'tictactoe'],
  category: 'economy',
  description: 'Desafiar a un usuario a una partida de gato/tres en raya apostando Yenes.',
  run: async ({ msg, sock, args, usedPrefix }) => {
    const chatId = msg.chat;

    // Verificar si la economía está activada en el grupo
    const chatData = db.getChat(chatId);
    if (chatData.adminonly || !chatData.economy) {
      return msg.reply(`ꕥ Los comandos de *Economía* están desactivados en este grupo.\n\nUn *administrador* puede activarlos con el comando:\n» *${usedPrefix}economy on*`);
    }

    // Inicializar global de partidas
    if (!global.tictactoe) global.tictactoe = {};

    if (global.tictactoe[chatId]) {
      return msg.reply('⚠️ Ya hay una partida activa o pendiente en este grupo.');
    }

    const retado = msg.mentionedJid?.[0];
    if (!retado) {
      return msg.reply(`⚠️ Debes mencionar a un usuario.\n\n*Ejemplo:* \`${usedPrefix}gato @usuario 1000\``);
    }

    if (retado === msg.sender) {
      return msg.reply('❌ No puedes jugar contra ti mismo.');
    }

    // Obtener la moneda configurada en el bot
    const idBot = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const settings = db.getSettings(idBot);
    const monedas = settings.currency || 'Yenes';

    // EXTRAER LA APUESTA CORRECTAMENTE:
    // Filtramos los argumentos descartando las menciones (@...) y buscando el número escrito al final
    const cleanArgs = args.filter(a => !a.includes('@'));
    const rawMonto = cleanArgs.find(a => /^\d+$/.test(a.trim()));
    const montoArg = rawMonto ? parseInt(rawMonto) : NaN;
    const apuesta = (!isNaN(montoArg) && montoArg > 0) ? montoArg : 1000;

    // Obtener datos de los usuarios desde la DB
    const userRetador = db.getChatUser(chatId, msg.sender) || {};
    const userRetado = db.getChatUser(chatId, retado) || {};

    // Detección de saldo (coins + bank)
    const retadorCoins = Number(userRetador.coins || 0);
    const retadorBank = Number(userRetador.bank || 0);
    const totalRetador = retadorCoins + retadorBank;

    const retadoCoins = Number(userRetado.coins || 0);
    const retadoBank = Number(userRetado.bank || 0);
    const totalRetado = retadoCoins + retadoBank;

    if (totalRetador < apuesta) {
      return msg.reply(`❌ No tienes suficientes ${monedas}. Tienes en total: ¥${totalRetador.toLocaleString()}`);
    }

    if (totalRetado < apuesta) {
      return msg.reply(`❌ El usuario mencionado no tiene ¥${apuesta.toLocaleString()} ${monedas} en total.`);
    }

    // Crear la partida
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
          msg.reply('⏱️ El reto de gato expiró porque no respondieron a tiempo.');
        }
      }, 60000)
    };

    await sock.reply(
      chatId,
      `🥊 *¡DESAFÍO GATO!*\n\n` +
      `👤 @${msg.sender.split('@')[0]} retó a @${retado.split('@')[0]}\n` +
      `💰 *Apuesta:* ¥${apuesta.toLocaleString()} ${monedas}\n\n` +
      `👉 @${retado.split('@')[0]}, responde con *aceptar* o *rechazar* para jugar.`,
      msg,
      { mentions: [msg.sender, retado] }
    );
  }
};
