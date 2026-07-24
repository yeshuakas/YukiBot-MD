import db from '#db';
global.math = global.math || {};
global.mathCooldown = global.mathCooldown || {}; // 👈 Usamos memoria RAM para evitar el error de SQL

const limits = { facil: 10, medio: 50, dificil: 90, imposible: 100, imposible2: 500 };
const rewardRanges = { 
  facil: [500, 1000], 
  medio: [1000, 2000], 
  dificil: [2000, 3500], 
  imposible: [3500, 5000], 
  imposible2: [15000, 30000] 
};

// ⏱️ Configuración de tiempos de espera (en milisegundos)
const COOLDOWNS = {
  imposible2: 20 * 60 * 1000, // 20 minutos
  default: 10 * 60 * 1000      // 10 minutos para el resto
};

const generateRandomNumber = (max) => Math.floor(Math.random() * max) + 1;
const getOperation = () => ['+', '-', '*'][Math.floor(Math.random() * 3)];

const generarProblema = (dificultad) => {
  if (dificultad === 'imposible2') {
    const num1 = generateRandomNumber(limits.imposible2);
    const num2 = generateRandomNumber(100);
    const num3 = generateRandomNumber(limits.imposible2);
    const op1 = getOperation();
    const op2 = getOperation();

    const resultado = eval(`(${num1} ${op1} ${num2}) ${op2} ${num3}`);
    const sym1 = op1 === '*' ? '×' : op1;
    const sym2 = op2 === '*' ? '×' : op2;

    return { problema: `(${num1} ${sym1} ${num2}) ${sym2} ${num3}`, resultado };
  }

  const maxLimit = limits[dificultad] || 30;
  const num1 = generateRandomNumber(maxLimit);
  const num2 = generateRandomNumber(maxLimit);
  const operador = ['+', '-', '*', '/'][Math.floor(Math.random() * 4)];
  
  let resultado = eval(`${num1} ${operador} ${num2}`);
  if (operador === '/') resultado = parseFloat(resultado.toFixed(2));

  const simbolo = operador === '*' ? '×' : operador === '/' ? '÷' : operador;
  return { problema: `${num1} ${simbolo} ${num2}`, resultado };
};

export default {
  command: ['math', 'mates'],
  category: 'economy',
  description: 'Iniciar un juego de matemáticas.',
  before: async ({ msg, sock, usedPrefix }) => {
    const chatId = msg.chat;
    const juego = global.math[chatId];
    if (!juego?.juegoActivo) return;

    const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const chat = db.getChat(chatId);
    if (chat.primaryBot && chat.primaryBot !== botId) return;

    const texto = msg.text?.trim().toLowerCase() || '';

    // 🛑 1. DETECTOR Y BLOQUEO DE TRAMPAS (IA / ChatGPT)
    const comandosIA = ['#chatgpt', '#ia', '#gpt', '#gemini', '#bot'];
    const intentoTrampa = comandosIA.some(cmd => texto.startsWith(cmd) || (usedPrefix && texto.startsWith(usedPrefix)));

    if (intentoTrampa && (texto.includes('chatgpt') || texto.includes('gpt') || texto.includes('ia'))) {
      const user = db.getChatUser(chatId, msg.sender);
      const nuevasWarns = (user.warns || 0) + 1;

      db.setChatUser(chatId, msg.sender, 'warns', nuevasWarns);

      await sock.reply(
        chatId, 
        `🚨 *¡SISTEMA ANTI-TRAMPAS!* 🚨\n\n@${msg.sender.split('@')[0]} Intentaste usar IA durante un juego activo.\n> *Advertencia agregada:* (${nuevasWarns}/3)\n\n*¡Resuelve las matemáticas por tu cuenta!*`, 
        msg, 
        { mentions: [msg.sender] }
      );
      return true;
    }

    // 2. COMPROBACIÓN DE RESPUESTA DE MATEMÁTICAS
    const respuestaUsuario = parseFloat(texto);
    if (isNaN(respuestaUsuario)) return;

    const user = db.getChatUser(chatId, msg.sender);
    const respuestaCorrecta = parseFloat(juego.respuesta);

    if (respuestaUsuario === respuestaCorrecta) {
      const [min, max] = rewardRanges[juego.dificultad] || [500, 1000];
      const coinsAleatorio = Math.floor(Math.random() * (max - min + 1)) + min;
      
      db.setChatUser(chatId, msg.sender, 'coins', (user.coins || 0) + coinsAleatorio);
      clearTimeout(juego.tiempoLimite);
      delete global.math[chatId];
      
      await sock.reply(chatId, `「⚡」¡@${msg.sender.split('@')[0]} fue el más rápido y acertó!\n> *Ganaste ›* Yenes $${coinsAleatorio.toLocaleString()}`, msg, { mentions: [msg.sender] });
    } else {
      await sock.reply(chatId, `「❌」Respuesta incorrecta. ¡El juego sigue activo para todo el grupo!`, msg);
    }
    return true;
  },
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    const chatId = msg.chat;
    const chat = db.getChat(chatId);
    if (chat.adminonly || !chat.economy) {
      return msg.reply(`ꕥ Los comandos de *Economía* están desactivados en este grupo.\n\nUn *administrador* puede activarlos con el comando:\n» *${usedPrefix}economy on*`);
    }
    if (global.math[chatId]?.juegoActivo) {
      return sock.reply(chatId, 'ꕥ Ya hay un desafío de matemáticas activo en este grupo. ¡Respondan rápido!', msg);
    }
    
    const dificultad = args[0]?.toLowerCase();
    if (!limits[dificultad]) {
      return sock.reply(chatId, '「✎」Especifica una dificultad válida: *facil, medio, dificil, imposible, imposible2*', msg);
    }

    // ⏳ VERIFICACIÓN DEL TIEMPO DE ESPERA (COOLDOWN EN MEMORIA)
    const userKey = `${chatId}_${msg.sender}`;
    global.mathCooldown[userKey] = global.mathCooldown[userKey] || {};

    const now = Date.now();
    const cooldownTiempo = COOLDOWNS[dificultad] || COOLDOWNS.default;
    const ultimoUso = global.mathCooldown[userKey][dificultad] || 0;

    if (now - ultimoUso < cooldownTiempo) {
      const tiempoRestanteMs = cooldownTiempo - (now - ultimoUso);
      const minutos = Math.floor(tiempoRestanteMs / 60000);
      const segundos = Math.floor((tiempoRestanteMs % 60000) / 1000);

      return sock.reply(
        chatId, 
        `⏳ *¡Debes esperar para usar esta dificultad de nuevo!*\n\n> *Dificultad:* ${dificultad}\n> *Tiempo restante:* ${minutos}m ${segundos}s`, 
        msg
      );
    }

    // ✍️ Guardar el timestamp actual en la memoria global
    global.mathCooldown[userKey][dificultad] = now;

    const { problema, resultado } = generarProblema(dificultad);
    const problemMessage = await sock.reply(chatId, `「✩」*¡DESAFÍO GRUPAL DE MATEMÁTICAS!*\nTienen 1 minuto. El primero en responder correctamente gana:\n\n> ✩ *${problema}*\n\n_✐ Responde con el número correcto antes que los demás._`, msg);
    
    global.math[chatId] = { 
      juegoActivo: true, 
      problema, 
      respuesta: resultado.toString(), 
      dificultad, 
      timeout: Date.now() + 60000, 
      problemMessageId: problemMessage.key?.id, 
      tiempoLimite: setTimeout(() => {
        if (global.math[chatId]?.juegoActivo) {
          delete global.math[chatId];
          sock.reply(chatId, `「✿」Tiempo agotado. Nadie logró responder a tiempo. La respuesta era *${resultado}*.`, msg);
        }
      }, 60000)
    };
  }
};
