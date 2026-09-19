"use strict";

const crypto = require("node:crypto");
const zlib = require("node:zlib");
const { promisify } = require("node:util");
const { logger } = require("firebase-functions");
const { defineInt, defineString } = require("firebase-functions/params");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { GoogleAuth } = require("google-auth-library");

const gzip = promisify(zlib.gzip);
const backupBucket = defineString("BACKUP_BUCKET");
const retentionDays = defineInt("BACKUP_RETENTION_DAYS", { default: 30 });
const databaseUrl = defineString("BACKUP_DATABASE_URL", {
  default: "https://cartorio-chapeco-default-rtdb.firebaseio.com",
});
const PREFIX = "cartorio-kanban/";
const auth = new GoogleAuth({
  scopes: [
    "https://www.googleapis.com/auth/firebase.database",
    "https://www.googleapis.com/auth/devstorage.read_write",
  ],
});

function countEntries(value) {
  return value && typeof value === "object" ? Object.keys(value).length : 0;
}

function storageObjectUrl(bucket, objectName) {
  return `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}`;
}

async function authenticatedRequest(options) {
  const client = await auth.getClient();
  return client.request(options);
}

async function listBackupFiles(bucket) {
  const files = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ prefix: PREFIX });
    if (pageToken) query.set("pageToken", pageToken);
    const response = await authenticatedRequest({
      url: `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o?${query}`,
      responseType: "json",
    });
    files.push(...(response.data.items || []));
    pageToken = response.data.nextPageToken || "";
  } while (pageToken);
  return files;
}

async function removeExpiredBackups(bucket, keepDays) {
  const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
  const files = await listBackupFiles(bucket);
  const expired = files.filter((file) => {
    const createdAt = Date.parse(file.timeCreated || "");
    return Number.isFinite(createdAt) && createdAt < cutoff;
  });

  await Promise.all(expired.map((file) => authenticatedRequest({
    url: storageObjectUrl(bucket, file.name),
    method: "DELETE",
  })));
  return expired.length;
}

exports.backupKanban = onSchedule(
  {
    // 12:00 e 18:00, inclusive em fins de semana e feriados. O banco nao e
    // modificado; a funcao apenas le /kanban e grava um arquivo privado.
    schedule: "0 12,18 * * *",
    timeZone: "America/Sao_Paulo",
    region: "southamerica-east1",
    // Conta dedicada: nao reutilizar a conta padrao ampla das funcoes.
    serviceAccount: "kanban-backup@cartorio-chapeco.iam.gserviceaccount.com",
    retryCount: 3,
    maxRetrySeconds: 3600,
  },
  async () => {
    const bucketName = backupBucket.value();
    const keepDays = retentionDays.value();
    if (!bucketName) throw new Error("BACKUP_BUCKET nao foi configurado.");
    if (!Number.isInteger(keepDays) || keepDays < 1 || keepDays > 365) {
      throw new Error("BACKUP_RETENTION_DAYS deve estar entre 1 e 365.");
    }

    // A conta de servico da funcao le a raiz operacional sem usar a sessao de
    // um usuario e representa uma fotografia unica no instante do backup.
    const snapshot = await authenticatedRequest({
      url: `${databaseUrl.value().replace(/\/$/, "")}/kanban.json`,
      responseType: "json",
    });
    const payload = {
      schemaVersion: 1,
      source: "cartorio-chapeco/kanban",
      createdAt: new Date().toISOString(),
      data: snapshot.data || {},
    };
    const raw = Buffer.from(JSON.stringify(payload));
    const sha256 = crypto.createHash("sha256").update(raw).digest("hex");
    const compressed = await gzip(raw, { level: 9 });
    const stamp = payload.createdAt.replace(/[:.]/g, "-");
    const destination = `${PREFIX}${payload.createdAt.slice(0, 10)}/kanban-${stamp}.json.gz`;
    await authenticatedRequest({
      url: `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucketName)}/o?uploadType=media&name=${encodeURIComponent(destination)}`,
      method: "POST",
      headers: {
        "Content-Type": "application/gzip",
        "Content-Length": String(compressed.length),
      },
      data: compressed,
    });
    await authenticatedRequest({
      url: storageObjectUrl(bucketName, destination),
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      data: {
        cacheControl: "no-store",
        metadata: {
          schemaVersion: String(payload.schemaVersion),
          sha256,
          newCards: String(countEntries(payload.data.newCards)),
          overrides: String(countEntries(payload.data.overrides)),
          audit: String(countEntries(payload.data.audit)),
        },
      },
    });

    const removed = await removeExpiredBackups(bucketName, keepDays);
    logger.info("Backup do Kanban concluido", {
      destination,
      bytes: compressed.length,
      sha256,
      removedExpiredBackups: removed,
    });
  },
);
