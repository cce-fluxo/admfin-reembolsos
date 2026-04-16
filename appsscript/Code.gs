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

function removeRowByCardId(sheet, cardId) {
  const data = sheet.getDataRange().getValues();
  // Iterate backwards to safely delete multiple matches if they exist
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i][0].toString() === cardId.toString()) {
      sheet.deleteRow(i + 1);
    }
  }
}
