// Safe fallback handler: restores a minimal main handler so the bot doesn't crash after accidental overwrite.
// This implementation is intentionally small: it acknowledges messages and logs that the real handler
// was accidentally replaced. Replace with the full implementation from your backup when available.

export default async function main(sock, msg, messages) {
  try {
    // If called without a message, nothing to do.
    if (!sock || !msg) return;

    const jid = msg?.key?.remoteJid || (msg?.chat || '');
    const text = 'Handler principal temporalmente en mantenimiento. Por favor, espera mientras se restaura el módulo completo.';

    // Prefer msg.reply if available (many command wrappers provide it)
    if (typeof msg.reply === 'function') {
      try { await msg.reply(text); } catch (e) { /* ignore errors */ }
      return;
    }

    // Fallback to sock.sendMessage / sendText
    if (typeof sock.sendText === 'function' && jid) {
      try { await sock.sendText(jid, text); } catch (e) { /* ignore errors */ }
      return;
    }

    if (typeof sock.sendMessage === 'function' && jid) {
      try { await sock.sendMessage(jid, { text }); } catch (e) { /* ignore errors */ }
      return;
    }

    console.log('[MAIN fallback] Received message but no reply/send available. JID:', jid);
  } catch (err) {
    console.error('[MAIN fallback error]', err?.stack || err?.message || err);
  }
}
