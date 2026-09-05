const link = require('./auth/link');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

(async () => {
  try {
    let phone = process.argv[2];
    if (!phone) phone = await ask('Número de teléfono (solo dígitos, p.ej. 5491123456789): ');
    phone = (phone || '').replace(/\D/g, '');
    if (!phone || phone.length < 8) {
      console.error('Número inválido. Debe tener al menos 8 dígitos.');
      process.exit(1);
    }

    const code = link.generateCode();
    const snap = link.saveAuthSnapshot(code);
    if (!snap) {
      console.error('No fue posible crear el snapshot de auth. ¿Existe la carpeta ./auth con la sesión?');
      process.exit(1);
    }

    // attach phone to snapshot file
    const filePath = path.join(__dirname, 'data', 'linkcodes', code + '.json');
    try {
      const obj = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      obj.phone = phone;
      fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
    } catch (e) {
      // ignore
    }

    console.log('\nCódigo de vinculación generado: %s', code);
    console.log('Comparte este código con el dispositivo que quieres vincular (caduca en 5 minutos).');
    console.log('\nEn el dispositivo destino ejecuta (desde la carpeta del repo):');
    console.log(`  node auth/restore.js ${code} ${phone}\n`);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
})();
