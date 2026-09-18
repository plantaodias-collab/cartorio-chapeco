/*
 * Copia a carga historica para kanban/newCards, preservando overrides atuais.
 * Por padrao apenas simula. Para gravar, passe --apply depois de revisar o resumo.
 * Requer FIREBASE_ID_TOKEN e MIGRATION_OPERATOR (o e-mail da conta do token).
 */
const fs = require('fs');
const path = require('path');

const dbUrl = (process.env.FIREBASE_DB_URL || 'https://cartorio-chapeco-default-rtdb.firebaseio.com').replace(/\/$/, '');
const idToken = process.env.FIREBASE_ID_TOKEN;
const operator = String(process.env.MIGRATION_OPERATOR || '').trim();
const apply = process.argv.includes('--apply');
if (!idToken || !operator) {
  throw new Error('Defina FIREBASE_ID_TOKEN e MIGRATION_OPERATOR antes de executar.');
}

function tokenEmail(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return String(payload.email || '').trim();
  } catch {
    return '';
  }
}
if (!tokenEmail(idToken) || tokenEmail(idToken) !== operator) {
  throw new Error('MIGRATION_OPERATOR precisa corresponder ao e-mail do Firebase ID token.');
}

const sourcePath = process.env.MIGRATION_SOURCE || path.join(__dirname, '..', '..', 'kanban_data-private-backup.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const match = source.match(/^const INITIAL_DATA = (.*);\s*$/s);
if (!match) throw new Error('Formato inesperado no arquivo de origem.');
const sourceCards = JSON.parse(match[1]);

function keyFor(id) {
  return String(id).replace(/[.#$[\]/]/g, '_');
}

async function requestJson(pathname, method = 'GET', body) {
  const url = new URL(`${dbUrl}${pathname}`);
  url.searchParams.set('auth', idToken);
  const response = await fetch(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Firebase respondeu HTTP ${response.status}.`);
  return text ? JSON.parse(text) : null;
}

(async () => {
  const db = await requestJson('/kanban.json');
  const overrides = Object.values(db?.overrides || {}).filter(Boolean);
  const existingCards = Object.values(db?.newCards || {}).filter(Boolean);
  const overrideById = new Map(overrides.filter(c => c.id).map(c => [c.id, c]));
  const existingIds = new Set(existingCards.filter(c => c.id).map(c => c.id));
  const seenIds = new Set();
  const pending = [];

  for (const original of sourceCards) {
    if (!original?.id || seenIds.has(original.id)) {
      throw new Error('A origem contém cartão sem ID ou ID duplicado; migração cancelada.');
    }
    seenIds.add(original.id);
    if (existingIds.has(original.id)) continue;

    const card = { ...original, ...(overrideById.get(original.id) || {}) };
    if (typeof card.descricao !== 'string' || card.descricao.length > 1000
      || typeof card.situacao !== 'string' || typeof card.priority !== 'string'
      || typeof card.aba !== 'string') {
      throw new Error(`Cartão ${original.id} não satisfaz as regras de dados; migração cancelada.`);
    }
    card.updatedAt = new Date().toISOString();
    card.updatedBy = operator;
    pending.push(card);
  }

  const payload = Object.fromEntries(pending.map(card => [keyFor(card.id), card]));
  const summary = {
    mode: apply ? 'APPLY' : 'DRY-RUN',
    sourceCards: sourceCards.length,
    alreadyPresent: sourceCards.length - pending.length,
    toMigrate: pending.length
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!apply || !pending.length) return;

  // As regras validam cada cartão no nível /newCards/{id}; gravar em lote no
  // caminho pai não satisfaz essa autorização por filho no Realtime Database.
  let written = 0;
  for (const [key, card] of Object.entries(payload)) {
    await requestJson(`/kanban/newCards/${encodeURIComponent(key)}.json`, 'PUT', card);
    written++;
    if (written % 100 === 0 || written === Object.keys(payload).length) {
      console.log(`Gravados ${written}/${Object.keys(payload).length} cartões.`);
    }
  }
  const verify = await requestJson('/kanban/newCards.json');
  const verifiedIds = new Set(Object.values(verify || {}).filter(Boolean).map(c => c.id));
  const missing = sourceCards.filter(c => !verifiedIds.has(c.id)).length;
  if (missing) throw new Error(`Verificação incompleta: ${missing} cartões históricos ainda não aparecem em newCards.`);
  console.log(`Migração verificada: ${sourceCards.length} cartões históricos disponíveis em newCards.`);
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
