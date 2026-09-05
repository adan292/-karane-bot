// Safe fallback handler mejorado:
// - Sólo envía el mensaje de mantenimiento si MAINTENANCE_MODE está activado.
// - Permite bypass para administradores listados en ADMIN_IDS (coma-separados).
// - Si existe un handler real en rutas habituales, lo carga e invoca dinámicamente.

import fs from 'fs';
import path from 'path';

export default async function main(sock, msg, messages) {
  try {
    if (!sock || !msg) return;

    const jid = msg?.key?.remoteJid || msg?.chat || '';
    const sender = msg?.key?.participant || msg?.sender || msg?.from || '';

    // Control de mantenimiento por variable de entorno
    const isMaintenance = (process.env.MAINTENANCE_MODE === '1' || String(process.env.MAINTENANCE_MODE || '').toLowerCase() === 'true');

    // Lista de administradores que pueden ignorar el modo mantenimiento (e.g. "1234567890@s.whatsapp.net,98765...")
    const adminEnv = process.env.ADMIN_IDS || '';
    const adminList = adminEnv.split(',').map(s => s.trim()).filter(Boolean);
    const senderIdShort = sender ? sender.split('@')[0] : '';
    const isAdmin = adminList.length > 0 && (adminList.includes(sender) || adminList.includes(senderIdShort));

    // Si estamos en modo mantenimiento y el remitente no es admin, responder y salir.
    if (isMaintenance && !isAdmin) {
      const text = 'Servicio temporalmente en mantenimiento. Intenta de nuevo más tarde.';
      if (typeof msg.reply === 'function') {
        try { await msg.reply(text); } catch (e) { /* ignore */ }
        return;
      }
      if (typeof sock.sendText === 'function' && jid) {
        try { await sock.sendText(jid, text); } catch (e) { /* ignore */ }
        return;
      }
      if (typeof sock.sendMessage === 'function' && jid) {
        try { await sock.sendMessage(jid, { text }); } catch (e) { /* ignore */ }
        return;
      }
      return;
    }

    // Intentar cargar un handler "real" dinámicamente desde rutas habituales.
    const candidates = [
      './_main.real.js',
      './main.handler.js',
      './handlers/main.js',
      './cmds/main/index.js',
      './cmds/main/main.js',
    ];

    for (const rel of candidates) {
      const full = path.join(process.cwd(), rel);
      if (fs.existsSync(full)) {
        try {
          // Import dinámico; Node ESM admite import() con ruta relativa/absoluta.
          const mod = await import(full);
          const fn = mod?.default || mod?.main || mod;
          if (typeof fn === 'function') {
            // Delegar al handler real
            await fn(sock, msg, messages);
            return;
          }
        } catch (err) {
          console.error('[MAIN loader] Error al cargar handler real desde', rel, err?.message || err);
          // seguir intentando con siguientes candidatos
        }
      }
    }

    // Si no hay handler real y no estamos en mantenimiento, no enviar mensajes automáticos
    // (esto evita que el bot responda siempre "en mantenimiento" si el fallback quedó activo).
    console.warn('[MAIN fallback] No se encontró handler real. Mensaje de mantenimiento inactivo. JID:', jid);
    return;
  } catch (err) {
    console.error('[MAIN fallback error]', err?.stack || err?.message || err);
  }
}
