const fs = require('fs');
const https = require('https');

const apiKey = process.env.FIREBASE_API_KEY;
const usersPath = process.env.CHAT_INTERNO_USERS || 'C:/ChatInterno/data/usuarios.json';

if (!apiKey) {
  console.error('Defina FIREBASE_API_KEY com a apiKey do app Web do Firebase.');
  process.exit(1);
}

function requestJson(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname: 'identitytoolkit.googleapis.com',
      path: `${path}?key=${encodeURIComponent(apiKey)}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        const parsed = data ? JSON.parse(data) : {};
        if (res.statusCode >= 400) reject(parsed);
        else resolve(parsed);
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function safeUsers(raw) {
  const users = Array.isArray(raw) ? raw : Object.values(raw || {});
  return users
    .filter(u => u && u.ativo !== 0 && u.email && u.senha)
    .map(u => ({
      email: String(u.email).trim(),
      password: String(u.senha),
      displayName: String(u.nome || u.email).trim()
    }));
}

(async () => {
  const raw = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
  const users = safeUsers(raw);
  let created = 0, skipped = 0, failed = 0;

  for (const user of users) {
    try {
      const createdUser = await requestJson('/v1/accounts:signUp', {
        email: user.email,
        password: user.password,
        displayName: user.displayName,
        returnSecureToken: true
      });
      created++;
      if (createdUser.idToken && user.displayName) {
        await requestJson('/v1/accounts:update', {
          idToken: createdUser.idToken,
          displayName: user.displayName,
          returnSecureToken: false
        }).catch(() => {});
      }
      console.log(`criado: ${user.email}`);
    } catch (err) {
      const code = err && err.error && err.error.message;
      if (code === 'EMAIL_EXISTS') {
        skipped++;
        console.log(`ja existia: ${user.email}`);
      } else {
        failed++;
        console.error(`falhou: ${user.email} (${code || 'erro desconhecido'})`);
      }
    }
  }

  console.log(JSON.stringify({ total: users.length, created, skipped, failed }, null, 2));
  if (failed) process.exit(1);
})();
