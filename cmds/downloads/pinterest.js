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
          .slice(0, 6) // Enviamos hasta 6 imágenes en el álbum
          .filter(r => r.image)
          .map(r => ({
            type: r.type === 'video' ? 'video' : 'image',
            data: { url: r.image },
            caption: `ㅤ۟∩ ׅ ★ ׅ 🅟𝖨𝖭 🅢earch ׄᰙ \n\n${r.title ? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Título* › ${r.title}\n` : ''}𖣣ֶㅤ֯⌗ ☆  ⬭ *Búsqueda* › ${text}`
          }))

        if (!medias.length) {
          return msg.reply(`《✧》 No se pudieron obtener descargas válidas para *${text}*.`)
        }

        // Si tu bot soporta sendAlbumMessage usa la primera línea; de lo contrario envía la primera imagen
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

// Scraper de búsqueda alternativo usando la API interna de Pinterest
async function getPinterestSearch(query) {
  try {
    const url = `https://www.pinterest.com/resource/BaseSearchResource/get/?data=${encodeURIComponent(
      JSON.stringify({
        options: {
          isPrefetch: false,
          query: query,
          scope: "pins",
          no_fetch_context_on_resource: false
        },
        context: {}
      })
    )}`

    const res = await fetchJson(url)
    const results = res?.resource_response?.data?.results || []

    return results
      .filter(v => v.images && v.images.originals)
      .map(v => ({
        type: 'image',
        title: v.grid_title || v.title || v.description || 'Pinterest Image',
        image: v.images.originals.url,
        url: `https://www.pinterest.com/pin/${v.id}/`
      }))
  } catch {
    // Fallback secundario si Pinterest bloquea la solicitud directa
    try {
      const fallbackUrl = `https://api.lolhuman.xyz/api/pinterest?apikey=GataDios&query=${encodeURIComponent(query)}`
      const res = await fetchJson(fallbackUrl)
      if (res.result) {
        const list = Array.isArray(res.result) ? res.result : [res.result]
        return list.map(img => ({ type: 'image', title: query, image: img }))
      }
    } catch {
      return []
    }
    return []
  }
}

// Descargar enlace de Pinterest directo
async function getPinterestDownload(url) {
  try {
    const endpoint = `https://api.vreden.web.id/api/pinterest?url=${encodeURIComponent(url)}`
    const res = await fetchJson(endpoint)

    if (res.result) {
      const data = res.result
      const mediaUrl = data.url || data.image || data.video
      const isVideo = !!data.video || /\.mp4/i.test(mediaUrl)

      return {
        type: isVideo ? 'video' : 'image',
        title: data.title || 'Pinterest Pin',
        url: mediaUrl
      }
    }
  } catch {
    return null
  }
}

async function fetchJson(url, timeout = 15000) {
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
