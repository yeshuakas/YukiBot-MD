import db from '#db'
import { activeGames } from './pd.js' // Importa el Map donde se guardó el juego activo

export async function before({ msg, sock }) {
  // 1. Verificar si hay un juego activo en este chat y si el mensaje tiene texto
  if (!msg.chat || !activeGames.has(msg.chat) || !msg.text) return false

  const game = activeGames.get(msg.chat)
  const intentoUsuario = msg.text.trim().toUpperCase()

  // 2. Si la respuesta coincide con la palabra guardada
  if (intentoUsuario === game.word) {
    // Cancelar el temporizador de 3 minutos
    clearTimeout(game.timeoutId)
    activeGames.delete(msg.chat)

    // Calcular el premio según el tiempo transcurrido (máx $40,000, mín $2,000)
    const elapsedSeconds = Math.floor((Date.now() - game.startTime) / 1000)
    const bonus = Math.max(0, 38000 - (elapsedSeconds * 200)) 
    const premio = 2000 + bonus

    // Obtener la moneda configurada en el bot
// Obtener la moneda configurada en el bot de forma segura
    const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net'
    const bot = db.getSettings(botId)
    const currency = bot?.currency || 'Yenes'

    // Sumar el premio a la economía del usuario
    const user = db.getUser(msg.sender)
    user.economy = (user.economy || 0) + premio
    db.setUser(msg.sender, 'economy', user.economy)

    // Enviar mensaje de victoria
    const pushName = msg.pushName || 'Usuario'
    await sock.sendMessage(msg.chat, {
      text: `🎉 ¡Felicidades @${msg.sender.split('@')[0]}!\n\n` +
            `Adivinaste la palabra correcta: *${game.word}*\n` +
            `⏱️ Te tomó: *${elapsedSeconds} segundos*\n` +
            `💰 Ganaste: *+$${premio.toLocaleString()} ${currency}*`,
      mentions: [msg.sender]
    }, { quoted: msg })

    return true // Detiene el procesamiento para que no busque otros comandos
  }

  return false
}
