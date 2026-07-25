import db from '#db'

// Almacén en memoria para controlar el juego activo por chat
export const activeGames = new Map()

const PALABRAS = [
  'PROGRAMACION', 'DESARROLLADOR', 'TECNOLOGIA', 'MATEMATICAS',
  'INTELIGENCIA', 'ALGORITMO', 'ASTRONOMIA', 'AUTOMATIZACION',
  'ELECTRONICA', 'VIDEOJUEGO', 'DOPAMINA', 'ARQUITECTURA',
  'DINOSAURIO', 'EXTRAORDINARIO', 'ESPECTACULAR', 'MURCIELAGO'
]

export function shuffleWord(word) {
  const arr = word.split('')
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  const shuffled = arr.join('')
  return shuffled === word ? shuffleWord(word) : shuffled
}

export function iniciarJuegoPD(sock, chatId, currency = 'Yenes') {
  if (activeGames.has(chatId)) return false

  const palabraOriginal = PALABRAS[Math.floor(Math.random() * PALABRAS.length)]
  const palabraDesordenada = shuffleWord(palabraOriginal)
  const startTime = Date.now()

  // Cancelar automáticamente a los 3 minutos si nadie responde
  const timeoutId = setTimeout(async () => {
    if (activeGames.has(chatId)) {
      activeGames.delete(chatId)
      await sock.sendMessage(chatId, {
        text: `⏳ *¡TIEMPO AGOTADO!*\n\nNadie adivinó la palabra a tiempo.\nLa respuesta correcta era: *${palabraOriginal}*`
      })
    }
  }, 180000)

  activeGames.set(chatId, {
    word: palabraOriginal,
    startTime,
    timeoutId
  })

  const text = `🧩 | *PALABRA DESORDENADA*\n────────────────\n` +
               `Ordena la siguiente palabra para ganar:\n\n` +
               `👉 *${palabraDesordenada}*\n\n` +
               `⏱️ *Tienes 3 minutos para responder.*\n` +
               `💰 *Premio:* $40,000 - $2,000 ${currency} (¡Entre más rápido respondas, mayor es el premio!)`

  sock.sendMessage(chatId, { text })
  return true
}

export default {
  command: ['pd', 'palabradesordenada'],
  category: 'economy',
  description: 'Iniciar manualmente el juego de Palabra Desordenada.',
  run: async ({ msg, sock, isOwner, usedPrefix }) => {
    const chat = db.getChat(msg.chat)
    if (chat.adminonly || !chat.economy) {
      return msg.reply(`ꕥ Los minijuegos de economía están desactivados en este chat.`)
    }

    if (!isOwner) {
      return msg.reply(`ꕥ Solo los *owners* pueden iniciar este minijuego manualmente.`)
    }

    if (activeGames.has(msg.chat)) {
      return msg.reply(`⚠️ Ya hay un juego de *Palabra Desordenada* activo en este grupo.`)
    }

    const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net'
    const bot = db.getSettings(botId)
    const currency = bot.currency || 'Yenes'

    iniciarJuegoPD(sock, msg.chat, currency)
  }
}
