/**
 * Layout da planilha:
 *   A  Competência
 *   B  Vencimento
 *   C  Pagamento
 *   D  Valor
 *   E  Categoria
 *   F  Descrição
 *   G  Cliente/Fornecedor
 *   H  CNPJ/CPF
 *   I  Centro de Custo
 *   J  Observações
 *   K  Card ID (interno — ocultar esta coluna na planilha)
 *
 * Payload aceito:
 *   { action, cardId, data }          <- formato atual do backend
 *   { action, data: { cardId, ... } } <- formato alternativo
 */

const DATA_COLS = 10;
const ID_COL    = 11; // coluna K

/* ─── Entry point ─────────────────────────────────────────────────── */

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const payload = JSON.parse(e.postData.contents);
    const { action, data } = payload;
    const cardId = String(payload.cardId ?? data?.cardId ?? '');

    if (!cardId) throw new Error('cardId é obrigatório');

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

    switch (action) {
      case 'insert':
      case 'update':
        upsertRow(sheet, cardId, data);
        break;
      case 'remove':
        removeRow(sheet, cardId);
        break;
      default:
        throw new Error('Ação inválida: ' + action);
    }

    return ok();
  } catch (err) {
    return fail(err.message);
  } finally {
    lock.releaseLock();
  }
}

/* ─── Operações ───────────────────────────────────────────────────── */

function upsertRow(sheet, cardId, data) {
  const found  = findRow(sheet, cardId);
  const newRow = dataToRow(data);

  if (found) {
    if (found.legacy) {
      // Migra linha antiga (ID estava na col A) para o novo layout
      sheet.getRange(found.rowNum, 1, 1, ID_COL).setValues([[...newRow, cardId]]);
    } else {
      sheet.getRange(found.rowNum, 1, 1, DATA_COLS).setValues([newRow]);
    }
  } else {
    sheet.appendRow([...newRow, cardId]);
  }
}

function removeRow(sheet, cardId) {
  const found = findRow(sheet, cardId);
  if (found) sheet.deleteRow(found.rowNum);
}

/* ─── Busca ───────────────────────────────────────────────────────── */

// Retorna { rowNum (1-based), legacy } ou null
function findRow(sheet, cardId) {
  const values = sheet.getDataRange().getValues();
  const id     = String(cardId);

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][ID_COL - 1]) === id) return { rowNum: i + 1, legacy: false };
    if (String(values[i][0])          === id) return { rowNum: i + 1, legacy: true  };
  }
  return null;
}

/* ─── Conversão ───────────────────────────────────────────────────── */

function dataToRow(data) {
  return [
    data.competencia       ?? '',
    data.vencimento        ?? '',
    data.pagamento         ?? '',
    data.valor             ?? '',
    data.categoria         ?? '',
    data.descricao         ?? '',
    data.clienteFornecedor ?? '',
    data.cnpjCpf           ?? '',
    data.centroCusto       ?? '',
    data.observacoes       ?? '',
  ];
}

/* ─── Resposta ────────────────────────────────────────────────────── */

function ok()          { return json({ ok: true }); }
function fail(message) { return json({ ok: false, error: message }); }
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ─── Utilitário: migrar todas as linhas antigas de uma vez ────────
 * Execute manualmente UMA VEZ no Apps Script Editor se a planilha
 * já tiver linhas com o cardId na coluna A.
 * Não precisa de parâmetros — lê os IDs diretamente da coluna A.
 */
function migrateAll() {
  const sheet  = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const values = sheet.getDataRange().getValues();
  let migrated = 0;

  for (let i = 1; i < values.length; i++) {
    const row    = values[i];
    const cardId = String(row[0]);

    // Pula linhas que já estão no novo formato (col K preenchida) ou vazias
    if (!cardId || row[ID_COL - 1]) continue;

    const rowNum = i + 1;
    // Move dados para colunas A-J e ID para coluna K
    const dataRow = row.slice(1, DATA_COLS + 1); // colunas B-K antigas viram A-J
    sheet.getRange(rowNum, 1, 1, ID_COL).setValues([[...dataRow, cardId]]);
    migrated++;
  }

  Logger.log('Migradas ' + migrated + ' linhas.');
}
