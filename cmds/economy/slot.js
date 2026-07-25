import { delay } from 'baileys';
import db from '#db';

export default {
  command: ['slot'],
  category: 'economy',
  description: 'Apostar coins en la maquina tragaperras.',
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    const chat = db.getChat(msg.chat);
    if (chat.adminonly || !chat.economy) {
      return msg.reply(`ꕥ Los comandos de *Economía* están desactivados en este grupo.\n\nUn *administrador* puede activarlos con el comando:\n» *${usedPrefix}economy on*`);
    }

    const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const bot = db.getSettings(botId);
    const currency = bot.currency || 'Yenes';    

    db.setCreate('chat_users', [msg.chat, msg.sender], 'lastslot', 0);
    const user = db.getChatUser(msg.chat, msg.sender);    

    if (!args[0] || isNaN(args[0]) || parseInt(args[0]) <= 0) {
      return msg.reply(`❀ Por favor, ingresa la cantidad que deseas apostar.\nEjemplo: *${usedPrefix + command} 500*`);
    }    

    const apuesta = parseInt(args[0]);

    // Cooldown de 30 segundos
    if (Date.now() - user.lastslot < 30000) {
      const restante = user.lastslot + 30000 - Date.now();
      return msg.reply(`ꕥ Debes esperar *${formatTime(restante)}* para usar *${usedPrefix + command}* nuevamente.`);
    }    

    if (apuesta < 100) {
      return msg.reply(`ꕥ El mínimo para apostar es de 100 *${currency}*.`);
    }

    if (user.coins < apuesta) {
      return msg.reply(`ꕥ Tus *${currency}* no son suficientes para apostar esa cantidad.`);
    }    

    // Emojis del casino con sus premios (línea central)
    const emojis = ['🎰', '💎', '7️⃣', '🍒', '🍋', '🔔'];

    const getRandomColumn = () => [
      emojis[Math.floor(Math.random() * emojis.length)],
      emojis[Math.floor(Math.random() * emojis.length)],
      emojis[Math.floor(Math.random() * emojis.length)]
    ];

    const initialText = `🎰 | *CASINO SLOTS*\n────────────────\n[ ❓ | ❓ | ❓ ]\n[ ❓ | ❓ | ❓ ] ◄\n[ ❓ | ❓ | ❓ ]\n────────────────\nGirando la máquina...`;
    
    let { key } = await sock.sendMessage(msg.chat, { text: initialText }, { quoted: msg });

    // Animación de giro (4 pasadas de 300ms)
    for (let i = 0; i < 4; i++) {
      const col1 = getRandomColumn();
      const col2 = getRandomColumn();
      const col3 = getRandomColumn();

      const animText = `🎰 | *CASINO SLOTS*\n────────────────\n[ ${col1[0]} | ${col2[0]} | ${col3[0]} ]\n[ ${col1[1]} | ${col2[1]} | ${col3[1]} ] ◄\n[ ${col1[2]} | ${col2[2]} | ${col3[2]} ]\n────────────────\nGirando la máquina...`;
      
      await sock.sendMessage(msg.chat, { text: animText, edit: key }, { quoted: msg });
      await delay(300);
    }

    // Resultado final
    const c1 = getRandomColumn();
    const c2 = getRandomColumn();
    const c3 = getRandomColumn();

    // Evaluamos la fila del centro (la de la flecha ◄)
    const mid1 = c1[1];
    const mid2 = c2[1];
    const mid3 = c3[1];

    let multiplicador = 0;
    let resultadoText = '';

    // Lógica de Ganancia / Pérdida en la línea central
    if (mid1 === mid2 && mid2 === mid3) {
      // 3 iguales Jackpot
      if (mid1 === '7️⃣' || mid1 === '💎') {
        multiplicador = 5; // x5 Jackpot especial
        resultadoText = `🎉 ¡JACKPOT SUPREMO! Tres ${mid1} alineados.`;
      } else {
        multiplicador = 3; // x3 para el resto de frutas
        resultadoText = `✨ ¡GRAN VICTORIA! Tres ${mid1} en línea.`;
      }
    } else if (mid1 === mid2 || mid1 === mid3 || mid2 === mid3) {
      // 2 iguales
      multiplicador = 1.5; // Recupera su apuesta + 50% de ganancia
      resultadoText = `⚡ ¡Buena combinación! Conectaste 2 iguales.`;
    } else {
      // 0 iguales (Perdió)
      multiplicador = 0;
      resultadoText = `💀 Mala suerte, no hubo coincidencia en la línea central.`;
    }

    let newCoins = user.coins;
    let ganancia = 0;

    if (multiplicador > 0) {
      ganancia = Math.floor(apuesta * multiplicador);
      newCoins += (ganancia - apuesta); // Sumar solo el beneficio neto
      resultadoText += `\n Ganaste: *+¥${ganancia.toLocaleString()} ${currency}*`;
    } else {
      newCoins -= apuesta;
      resultadoText += `\n Perdiste: *-¥${apuesta.toLocaleString()} ${currency}*`;
    }

    // Actualizar Base de Datos
    db.setChatUser(msg.chat, msg.sender, 'lastslot', Date.now());
    db.setChatUser(msg.chat, msg.sender, 'coins', newCoins);

    const finalText = `🎰 | *CASINO SLOTS*\n────────────────\n  [ ${c1[0]} | ${c2[0]} | ${c3[0]} ]\n► [ ${c1[1]} | ${c2[1]} | ${c3[1]} ] ◄\n  [ ${c1[2]} | ${c2[2]} | ${c3[2]} ]\n────────────────\n${resultadoText}`;

    await sock.sendMessage(msg.chat, { text: finalText, edit: key }, { quoted: msg });
  }
};

function formatTime(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const parts = [];
  if (minutes > 0) parts.push(`${minutes} min`);
  parts.push(`${seconds} seg`);
  return parts.join(' ');
}
