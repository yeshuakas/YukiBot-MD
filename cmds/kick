import db from '#db';

export default {
  command: ['kick', 'ban', 'echar'],
  category: 'admin',
  description: 'Eliminar a un usuario del grupo.',
  run: async ({ msg, sock, usedPrefix, command }) => {
    const chatId = msg.chat;

    // 1. Verificar si el comando se ejecuta en un grupo
    if (!msg.isGroup) {
      return sock.reply(chatId, '「❌」Este comando solo se puede usar en grupos.', msg);
    }

    // 2. Obtener información de los participantes y administradores
    const groupMetadata = await sock.groupMetadata(chatId);
    const participants = groupMetadata.participants;
    
    const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const isBotAdmin = participants.some(p => p.id === botId && (p.admin === 'admin' || p.admin === 'superadmin'));
    const isAdmin = participants.some(p => p.id === msg.sender && (p.admin === 'admin' || p.admin === 'superadmin'));

    // 3. Verificar permisos de Administrador
    if (!isAdmin) {
      return sock.reply(chatId, '「❌」Este comando solo puede ser ejecutado por *Administradores*.', msg);
    }

    if (!isBotAdmin) {
      return sock.reply(chatId, '「⚠️」Necesito ser *Administrador* del grupo para poder eliminar miembros.', msg);
    }

    // 4. Identificar al objetivo (por respuesta a mensaje o por mención @)
    let targetJid = null;

    if (msg.quoted) {
      // Si respondió a un mensaje
      targetJid = msg.quoted.sender;
    } else if (msg.mentionedJid && msg.mentionedJid.length > 0) {
      // Si etiquetó a alguien con @
      targetJid = msg.mentionedJid[0];
    }

    // Si no se especificó a nadie
    if (!targetJid) {
      return sock.reply(chatId, `「✎」Etiqueta a un usuario o responde a su mensaje con el comando.\n\n*Ejemplo:* ${usedPrefix + command} @usuario`, msg);
    }

    // 5. Protecciones básicas
    if (targetJid === botId) {
      return sock.reply(chatId, '「❌」No puedo auto-eliminarme del grupo.', msg);
    }

    const isTargetAdmin = participants.some(p => p.id === targetJid && (p.admin === 'admin' || p.admin === 'superadmin'));
    if (isTargetAdmin) {
      return sock.reply(chatId, '「❌」No puedes eliminar a otro *Administrador* del grupo.', msg);
    }

    // 6. Ejecutar la expulsión del grupo
    try {
      await sock.groupParticipantsUpdate(chatId, [targetJid], 'remove');
      
      await sock.reply(
        chatId, 
        `「👢」@${targetJid.split('@')[0]} ha sido expulsado del grupo con éxito.`, 
        msg, 
        { mentions: [targetJid] }
      );
    } catch (error) {
      console.error(error);
      await sock.reply(chatId, '「❌」Ocurrió un error al intentar eliminar al usuario.', msg);
    }
  }
};