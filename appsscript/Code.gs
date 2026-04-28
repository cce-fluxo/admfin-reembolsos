function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const { action, cardId, data } = payload;
    
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheets()[0]; // Default to first sheet
    
    if (action === 'insert') {
      insertRow(sheet, cardId, data);
    } else if (action === 'remove') {
      removeRowByCardId(sheet, cardId);
    } else if (action === 'update') {
      updateRow(sheet, cardId, data);
    } else {
      throw new Error('Invalid action: ' + action);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function insertRow(sheet, cardId, data) {
  const rowIndex = findRowIndex(sheet, cardId);
  if (rowIndex !== -1) {
    return updateRow(sheet, cardId, data);
  }

  // Columns: Card ID, Competência, Vencimento, Pagamento, Valor, Categoria, Descrição, Cliente/Fornecedor, CNPJ/CPF, Centro de Custo, Observações
  sheet.appendRow([
    cardId,
    data.competencia,
    data.vencimento,
    data.pagamento,
    data.valor,
    data.categoria,
    data.descricao,
    data.clienteFornecedor,
    data.cnpjCpf,
    data.centroCusto,
    data.observacoes
  ]);
}

function updateRow(sheet, cardId, data) {
  const rowIndex = findRowIndex(sheet, cardId);
  
  if (rowIndex !== -1) {
    const row = rowIndex + 1;
    // Update the specific row
    sheet.getRange(row, 2, 1, 10).setValues([[
      data.competencia,
      data.vencimento,
      data.pagamento,
      data.valor,
      data.categoria,
      data.descricao,
      data.clienteFornecedor,
      data.cnpjCpf,
      data.centroCusto,
      data.observacoes
    ]]);
  }
}

function findRowIndex(sheet, cardId) {
  const values = sheet.getDataRange().getValues();
  const cardIdStr = String(cardId);
  for (let i = 1; i < values.length; i++) { // Skip header
    if (String(values[i][0]) === cardIdStr) {
      return i;
    }
  }
  return -1;
}

function removeRowByCardId(sheet, cardId) {
  const data = sheet.getDataRange().getValues();
  const cardIdStr = String(cardId);
  // Iterate backwards to safely delete multiple matches if they exist
  for (let i = data.length - 1; i >= 1; i--) { // i >= 1 to skip header
    if (String(data[i][0]) === cardIdStr) {
      sheet.deleteRow(i + 1);
    }
  }
}

