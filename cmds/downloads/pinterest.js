import fetch from 'node-fetch'

export default {
  command: ['pinterest', 'pin'],
  category: 'downloads',
  description: 'Buscar y descarga imágenes y videos de Pinterest.',
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    const text = args.join(' ')
    const isPinterestUrl = /^https?:\/\//.test(text)

    if (!text) {
      return msg.reply('《✧》 Por favor, ingresa un término de búsqueda o un enlace de Pinterest.')
    }

    try {
      if (isPinterestUrl) {
        const data = await getPinterestDownload(text)

        if (!data) return msg.reply('ꕥ No se pudo obtener el contenido.')

        const caption = `ㅤ۟∩ ׅ ★ ׅ 🅟𝖨𝖭 🅓ownload ׄᰙ \n\n${data.title ? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Título* › ${data.title}\n` : ''}${data.description ? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Descripción* › ${data.description}\n` : ''}${data.author ? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Autor* › ${data.author}\n` : ''}${data.username ? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Usuario* › ${data.username}\n` : ''}𖣣ֶㅤ֯⌗ ☆  ⬭ *Enlace* › ${text}`

        if (data.type === 'video') {
          await sock.sendMessage(
            msg.chat,
            {
              video: { url: data.url },
              caption,
              mimetype: 'video/mp4',
              fileName: data.filename || 'pin.mp4'
            },
            { quoted: msg }
          )
        } else if (data.type === 'image') {
          await sock.sendMessage(
            msg.chat,
            {
              image: { url: data.url },
              caption
            },
            { quoted: msg }
          )
        } else {
          throw new Error('Contenido no soportado.')
        }
      } else {
        const results = await getPinterestSearch(text)

        if (!results || results.length === 0) {
          return msg.reply(`《✧》 No se encontraron resultados para *${text}*.`)
        }

        const medias = results
          .slice(0, 6) // Máximo 6 imágenes
          .filter(r => r.image)
          .map(r => ({
            type: 'image',
            data: { url: r.image },
            caption: `ㅤ۟∩ ׅ ★ ׅ 🅟𝖨𝖭 🅢earch ׄᰙ \n\n${r.title ? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Título* › ${r.title}\n` : ''}𖣣ֶㅤ֯⌗ ☆  ⬭ *Búsqueda* › ${text}`
          }))

        if (!medias.length) {
          return msg.reply(`《✧》 No se pudieron obtener descargas válidas para *${text}*.`)
        }

        if (sock.sendAlbumMessage) {
          await sock.sendAlbumMessage(msg.chat, medias, { quoted: msg })
        } else {
          for (const media of medias) {
            await sock.sendMessage(msg.chat, { image: { url: media.data.url }, caption: media.caption }, { quoted: msg })
          }
        }
      }
    } catch (e) {
      await msg.reply(`> An unexpected error occurred while executing command *${usedPrefix + command}*. Please try again or contact support if the issue persists.\n> [Error: *${e.message}*]`)
    }
  }
}

// Sistema de búsqueda con 3 servicios en cascada
async function getPinterestSearch(query) {
  // Opción 1: API Deliriodev
  try {
    const res = await fetchJson(`https://api.delirius.site/search/pinterest?q=${encodeURIComponent(query)}`)
    if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
      return res.data.map(item => ({
        title: item.title || item.description || query,
        image: item.image || item.url
      }))
    }
  } catch (e) {
    // Continuar al siguiente si falla
  }

  // Opción 2: API BK9
  try {
    const res = await fetchJson(`https://bk9.fun/search/pinterest?q=${encodeURIComponent(query)}`)
    if (res?.status && Array.isArray(res.BK9) && res.BK9.length > 0) {
      return res.BK9.map(item => ({
        title: item.grid_title || item.title || query,
        image: item.images_url || item.image
      }))
    }
  } catch (e) {
    // Continuar al siguiente si falla
  }

  // Opción 3: API Siputzx
  try {
    const res = await fetchJson(`https://api.siputzx.my.id/api/s/pinterest?query=${encodeURIComponent(query)}`)
    if (res?.status && Array.isArray(res.data) && res.data.length > 0) {
      return res.data.map(item => ({
        title: item.title || query,
        image: item.images || item.image_url || item.url
      }))
    }
  } catch (e) {
    // Fin de las opciones
  }

  return []
}

// Descargar enlace de Pinterest
async function getPinterestDownload(url) {
  try {
    const res = await fetchJson(`https://api.delirius.site/download/pinterest?url=${encodeURIComponent(url)}`)
    if (res?.status && res?.data) {
      const isVideo = !!res.data.video
      return {
        type: isVideo ? 'video' : 'image',
        title: res.data.title || 'Pinterest Pin',
        url: res.data.video || res.data.image
      }
    }
  } catch {
    try {
      const res = await fetchJson(`https://bk9.fun/download/pinterest?url=${encodeURIComponent(url)}`)
      if (res?.status && res?.BK9) {
        const mediaUrl = res.BK9.url || res.BK9.image
        const isVideo = /\.mp4/i.test(mediaUrl)
        return {
          type: isVideo ? 'video' : 'image',
          title: 'Pinterest Pin',
          url: mediaUrl
        }
      }
    } catch {
      return null
    }
  }
  return null
}

async function fetchJson(url, timeout = 12000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}
