import fetch from 'node-fetch'

/**
 * Comando .pin / .pinterest — reimplementado para usar Bunny_girl_bot API.
 *
 * USO:
 * - Establece las variables de entorno:
 *     BUNNY_GIRL_BOT_URL  -> endpoint de la API (puede contener "{query}" como placeholder)
 *     BUNNY_GIRL_BOT_KEY  -> (opcional) token/API key si la API requiere auth (se enviará como Bearer)
 *
 * Ejemplos de BUNNY_GIRL_BOT_URL válidos:
 * - https://api.example.com/search?q={query}
 * - https://api.example.com/search    (se añadirá ?q=...)
 */

// Soportar varios nombres de variable de entorno por compatibilidad
const API_URL =
  process.env.BUNNY_GIRL_BOT_URL ||
  process.env.BUNNY_GIRL_URL ||
  process.env.BUNNY_GIRL_API_URL ||
  process.env.PINTEREST_API_URL ||
  ''
const API_KEY =
  process.env.BUNNY_GIRL_BOT_KEY ||
  process.env.BUNNY_GIRL_KEY ||
  process.env.BUNNY_GIRL_API_KEY ||
  process.env.PINTEREST_API_KEY ||
  ''

export default {
  command: ['pinterest', 'pin'],
  category: 'downloads',
  description: 'Buscar y descargar imágenes de Pinterest usando Bunny_girl_bot API o un fallback público.',
  run: async ({ msg, usedPrefix, command }) => {
    try {
      const text = (msg?.body || '').trim()
      const parts = text.split(/\s+/)
      const query = parts.slice(1).join(' ').trim()

      if (!query) {
        return msg.reply(
          `Usa: ${usedPrefix}${command} <término de búsqueda>\n` +
          `Ej: ${usedPrefix}${command} sunset`
        )
      }

      // Si no hay API configurada, intentaremos un fallback que raspa la página pública de Pinterest
      const useFallback = !API_URL

      if (!API_URL) {
        // no devolvemos error inmediato: avisamos en consola y seguimos con fallback
        console.warn('Bunny_girl_bot API no configurada. Intentando fallback con la página pública de Pinterest.')
      }

      // Construir URL: soporta placeholder {query} o añade ?q= si no existe.
      let url
      if (!useFallback) {
        url = API_URL.includes('{query}')
          ? API_URL.replace(/{query}/g, encodeURIComponent(query))
          : `${API_URL}${API_URL.includes('?') ? '&' : '?'}q=${encodeURIComponent(query)}`
      } else {
        // Fallback: usar r.jina.ai para recuperar la HTML pública de Pinterest (raw proxy)
        // Este servicio devuelve el HTML de la página solicitada; no es oficial de Pinterest.
        url = `https://r.jina.ai/http://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`
      }

      const headers = { 'Accept': 'application/json' }
      if (API_KEY && !useFallback) headers['Authorization'] = `Bearer ${API_KEY}`

      const res = await fetch(url, { headers })
      if (!res.ok) {
        return msg.reply(
          `Error al consultar la API (status ${res.status}). Intenta más tarde.`
        )
      }

      // Intentar parsear JSON; si la API devuelve texto/HTML, manejamos también.
      let data
      const contentType = (res.headers.get('content-type') || '').toLowerCase()
      if (contentType.includes('application/json')) {
        data = await res.json()
      } else {
        // Respuesta no-JSON: puede ser HTML (fallback) o texto plano
        const textBody = await res.text()
        if (!useFallback) {
          data = { _raw: textBody }
        } else {
          // En el fallback, parseamos HTML para extraer la primera imagen de Pinterest
          const html = textBody
          // Buscar og:image
          let match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
          let imageUrl = match ? match[1] : null

          // Si no hay og:image, buscar imágenes de CDN de Pinterest (i.pinimg.com)
          if (!imageUrl) {
            match = html.match(/https?:\/\/i.pinimg.com\/[^"'\s>]+/i)
            if (match) imageUrl = match[0]
          }

          // Como último recurso, buscar cualquier <img src="...">
          if (!imageUrl) {
            match = html.match(/<img[^>]+src=["']([^"']+)["']/i)
            if (match) imageUrl = match[1]
          }

          data = { image: imageUrl }
        }
      }

      // Buscar URL de imagen en varios campos comunes; añade más rutas si tu API usa otros nombres.
      const imageUrl =
        // respuestas simples
        (typeof data === 'string' && data) ||
        data?.url ||
        data?.image ||
        data?.image_url ||
        data?.img ||
        // arrays
        (Array.isArray(data?.images) && data.images[0]) ||
        (Array.isArray(data?.result) && (data.result[0]?.url || data.result[0]?.image)) ||
        // raw text
        data?._raw ||
        null

      if (!imageUrl) {
        // Si no encontramos imagen y no usamos fallback, dar mensaje con instrucciones
        if (!useFallback) {
          return msg.reply(
            `No encontré imágenes para "${query}". Revisa que la variable de entorno BUNNY_GIRL_BOT_URL esté bien definida (acepta placeholders {query}).\n` +
            `Variables alternativas soportadas: BUNNY_GIRL_BOT_URL, BUNNY_GIRL_URL, BUNNY_GIRL_API_URL, PINTEREST_API_URL.\n` +
            `Si tu API requiere clave, define BUNNY_GIRL_BOT_KEY o BUNNY_GIRL_KEY.`
          )
        }

        // Si usamos fallback y no hay imagen, informar al usuario
        return msg.reply(
          `No pude extraer una imagen de Pinterest para "${query}" usando el método alternativo. ` +
          `Puedes configurar una API dedicada (BUNNY_GIRL_BOT_URL) para mejores resultados.`
        )
      }

      // Intentar enviar como media; si falla, enviar enlace como fallback.
      try {
        await msg.reply({ image: { url: imageUrl }, caption: `Resultado para: ${query}` })
      } catch (err) {
        await msg.reply(`Resultado para "${query}":\n${imageUrl}`)
      }
    } catch (err) {
      console.error('pinterest command error:', err)
      return msg.reply(
        `Ocurrió un error al buscar imágenes. Puedes usar otros comandos como ${usedPrefix}imagen o ${usedPrefix}play.`
      )
    }
  }
}
