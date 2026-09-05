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

const API_URL = process.env.BUNNY_GIRL_BOT_URL || ''
const API_KEY = process.env.BUNNY_GIRL_BOT_KEY || ''

export default {
  command: ['pinterest', 'pin'],
  category: 'downloads',
  description: 'Buscar y descargar imágenes de Pinterest usando Bunny_girl_bot API.',
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

      if (!API_URL) {
        return msg.reply(
          `La API de Bunny_girl_bot no está configurada. Define la variable de entorno BUNNY_GIRL_BOT_URL con el endpoint de la API.`
        )
      }

      // Construir URL: soporta placeholder {query} o añade ?q= si no existe.
      const url = API_URL.includes('{query}')
        ? API_URL.replace(/{query}/g, encodeURIComponent(query))
        : `${API_URL}${API_URL.includes('?') ? '&' : '?'}q=${encodeURIComponent(query)}`

      const headers = { 'Accept': 'application/json' }
      if (API_KEY) headers['Authorization'] = `Bearer ${API_KEY}`

      const res = await fetch(url, { headers })
      if (!res.ok) {
        return msg.reply(
          `Error al consultar la API (status ${res.status}). Intenta más tarde.`
        )
      }

      // Intentar parsear JSON; si la API devuelve texto/imagen directa, manejamos también.
      let data
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        data = await res.json()
      } else {
        // Respuesta no-JSON: puede ser URL en texto plano
        const textBody = await res.text()
        data = { _raw: textBody }
      }

      // Buscar URL de imagen en varios campos comunes; añade más rutas si tu API usa otros nombres.
      const imageUrl =
        // respuestas simples
        (typeof data === 'string' && data) ||
        data.url ||
        data.image ||
        data.image_url ||
        data.img ||
        // arrays
        (Array.isArray(data.images) && data.images[0]) ||
        (Array.isArray(data.result) && (data.result[0]?.url || data.result[0]?.image)) ||
        // raw text
        data._raw ||
        null

      if (!imageUrl) {
        return msg.reply(
          `No encontré imágenes para "${query}".`
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
