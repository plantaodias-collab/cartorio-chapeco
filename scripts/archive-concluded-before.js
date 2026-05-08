const fs = require('fs');
const vm = require('vm');
const https = require('https');

const dbUrl = (process.env.FIREBASE_DB_URL || 'https://cartorio-chapeco-default-rtdb.firebaseio.com').replace(/\/$/, '');
const cutoff = process.env.CUTOFF_DATE || '2026-01-15';
const apply = process.argv.includes('--apply');
const list = process.argv.includes('--list');

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body == null ? null : JSON.stringify(body);
    const url = new URL(`${dbUrl}${path}`);
    const req = https.request(url, {
      method,
      headers: payload ? {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      } : {}
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) reject(new Error(`${res.statusCode}: ${data}`));
        else resolve(data ? JSON.parse(data) : null);
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function loadInitialData() {
  const code = fs.readFileSync('kanban_data.js', 'utf8');
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${code}; this.INITIAL_DATA = INITIAL_DATA;`, context);
  return context.INITIAL_DATA || [];
}

function toIsoDate(value) {
  const v = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return '';
}

function keyFor(id) {
  return String(id).replace(/[.#$[\]/]/g, '_');
}

function buildOverridePayload(card) {
  return {
    id: card.id,
    situacao: 'Arquivado',
    priority: card.priority || 'Normal',
    recebido: card.recebido || '',
    apresentado_por: card.apresentado_por || '',
    telefone: card.telefone || '',
    observacoes: card.observacoes || '',
    resp_entrega: card.resp_entrega || '',
    nome_retirou: card.nome_retirou || '',
    situacao_retorno: card.situacao_retorno || '',
    data_conclusao: card.data_conclusao || '',
    data_nd: card.data_nd || '',
    data_retorno: card.data_retorno || '',
    data_retirada: card.data_retirada || '',
    updatedAt: new Date().toISOString(),
    updatedBy: 'script:archive-concluded-before'
  };
}

(async () => {
  const db = await request('GET', '/kanban.json');
  const overrides = db && db.overrides ? Object.values(db.overrides).filter(Boolean) : [];
  const newCards = db && db.newCards ? Object.values(db.newCards).filter(Boolean) : [];
  const overrideById = new Map(overrides.map(o => [o.id, o]));

  const initial = loadInitialData().map(c => ({ ...c, ...(overrideById.get(c.id) || {}) }));
  const initialIds = new Set(initial.map(c => c.id));
  const all = [
    ...initial.map(c => ({ source: 'overrides', card: c })),
    ...newCards.filter(c => !initialIds.has(c.id)).map(c => ({ source: 'newCards', card: c }))
  ];

  const targets = all.filter(({ card }) =>
    card.situacao === 'Concluído' &&
    toIsoDate(card.data_conclusao) &&
    toIsoDate(card.data_conclusao) < cutoff
  );

  const patch = { overrides: {}, newCards: {} };
  for (const { source, card } of targets) {
    const key = keyFor(card.id);
    if (source === 'newCards') {
      patch.newCards[key] = {
        ...card,
        situacao: 'Arquivado',
        updatedAt: new Date().toISOString(),
        updatedBy: 'script:archive-concluded-before'
      };
    } else {
      patch.overrides[key] = buildOverridePayload(card);
    }
  }

  console.log(JSON.stringify({
    cutoff,
    apply,
    totalTargets: targets.length,
    initialDataTargets: targets.filter(t => t.source === 'overrides').length,
    newCardsTargets: targets.filter(t => t.source === 'newCards').length
  }, null, 2));
  if (list) {
    console.log(JSON.stringify(targets.map(({ source, card }) => ({
      source,
      id: card.id,
      data_conclusao: card.data_conclusao,
      key: keyFor(card.id)
    })), null, 2));
  }

  if (!apply || !targets.length) return;
  if (Object.keys(patch.overrides).length) {
    await request('PATCH', '/kanban/overrides.json', patch.overrides);
  }
  if (Object.keys(patch.newCards).length) {
    await request('PATCH', '/kanban/newCards.json', patch.newCards);
  }
  console.log('Atualizacao aplicada com sucesso.');
})();
