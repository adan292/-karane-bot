// auth/restore.js
const link = require('./link');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

(async () => {
  try {
    let code = process.argv[2];
    let phone = process.argv[3];

    if (!code) code = await ask('Código de vinculación (8 dígitos): ');
    if (!phone) phone = await ask('Tu número de teléfono (solo dígitos): ');

    code = (code || '').trim();
    phone = (phone || '').replace(/\D/g, '');

    if (!code || code.length < 8) {
      console.error('Código inválido.');
      process.exit(1);
    }
    if (!phone || phone.length < 8) {
      console.error('Número inválido.');
      process.exit(1);
    }

    const snap = link.getSnapshot(code);
    if (!snap) {
      console.error('Código inválido o expirado.');
      process.exit(1);
    }

    if (snap.phone && snap.phone !== phone) {
      console.error('El número proporcionado no coincide con el número asociado al snapshot.');
      process.exit(1);
    }

    const authDir = __dirname; // auth/
    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

    const files = snap.files || {};
    const written = [];
    for (const [name, b64] of Object.entries(files)) {
      try {
        const dest = path.join(authDir, name);
        fs.writeFileSync(dest, Buffer.from(b64, 'base64'));
        written.push(name);
      } catch (e) {
        console.error('Error al escribir archivo', name, e.message || e);
      }
    }

    // Remove snapshot after successful restore to avoid reuse
    try {
      const snapshotPath = path.join(__dirname, '..', 'data', 'linkcodes', code + '.json');
      if (fs.existsSync(snapshotPath)) fs.unlinkSync(snapshotPath);
    } catch (e) {
      // non-fatal
    }

    if (written.length === 0) {
      console.error('No se restauraron archivos. Asegúrate de que el snapshot contiene datos.');
      process.exit(1);
    }

    console.log('Auth restaurado correctamente. Archivos escritos:');
    for (const f of written) console.log(' -', f);
    console.log('\nInicia el bot en esta máquina (p. ej. node ../index.js) para que use la sesión restaurada.');
    process.exit(0);
  } catch (e) {
    console.error('Error inesperado:', e);
    process.exit(1);
  }
})();
