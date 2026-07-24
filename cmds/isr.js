import db from '#db';

export default {
  command: ['isr', 'dar', 'addyen'],
  category: 'owner',
  description: 'Añadir Yenes a la cuenta de un usuario (Solo Owner).',
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    const chatId = msg.chat;

    // 1. Identificar si el usuario es el Owner/Creador del bot
    const sender = msg.sender;
    const isOwner = msg.fromMe || (global.owner && global.owner.some(o => {
      const ownerJid = Array.isArray(o) ? o[0] : o;
      return sender.includes(ownerJid);
    }));

    if (!isOwner) {
      return sock.reply(chatId, '「❌」Este comando es exclusivo para el *Creador/Owner* del bot.', msg);
    }

    // 2. Identificar al objetivo (por respuesta a mensaje o mención)
    let targetJid = null;
    let amountArgIndex = 0;

    if (msg.quoted) {
      targetJid = msg.quoted.sender;
      amountArgIndex = 0; // Si responde a un mensaje, el primer argumento tras el comando es la cantidad
    } else if (msg.mentionedJid && msg.mentionedJid.length > 0) {
      targetJid = msg.mentionedJid[0];
      amountArgIndex = 1; // Si menciona a alguien (@juan 5000), el segundo argumento es la cantidad
    }

    if (!targetJid) {
      return sock.reply(chatId, `「✎」Uso del comando:\n\n1. Responde a un mensaje con: *${usedPrefix + command} <cantidad>*\n2. O etiqueta a alguien: *${usedPrefix + command} @usuario <cantidad>*`, msg);
    }

    // 3. Procesar y validar la cantidad de Yenes
    let rawAmount = args[amountArgIndex];

    if (!rawAmount) {
      return sock.reply(chatId, '「⚠️」Debes especificar la cantidad de Yenes a transferir.\n\n*Ejemplo:* `#isr @juan 5000`', msg);
    }

    // Permitir notación con 'k' o 'm' (ej: 10k = 10000)
    rawAmount = rawAmount.toLowerCase().replace(/,/g, '');
    let amount = 0;

    if (rawAmount.endsWith('k')) {
      amount = parseFloat(rawAmount.replace('k', '')) * 1000;
    } else if (rawAmount.endsWith('m')) {
      amount = parseFloat(rawAmount.replace('m', '')) * 1000000;
    } else {
      amount = parseFloat(rawAmount);
    }

    if (isNaN(amount) || amount <= 0) {
      return sock.reply(chatId, '「❌」Ingresa una cantidad numérica válida.', msg);
    }

    // 4. Actualizar el saldo en la base de datos
    const targetUser = db.getChatUser(chatId, targetJid);
    const actualCoins = targetUser.coins || 0;
    const newTotal = actualCoins + amount;

    db.setChatUser(chatId, targetJid, 'coins', newTotal);

    // 5. Confirmación en el grupo
    await sock.reply(
      chatId,
      `「💸」*¡INYECCIÓN DE CAPITAL!*\n\n> *Beneficiario:* @${targetJid.split('@')[0]}\n> *Monto añadido:* ¥${amount.toLocaleString()} Yenes\n> *Nuevo Saldo:* ¥${newTotal.toLocaleString()} Yenes`,
      msg,
      { mentions: [targetJid] }
    );
  }
};