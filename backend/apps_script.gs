function converterNumero(valor, fallback) {
  if (valor === undefined || valor === null || valor === "") return fallback;
  var numero = Number(valor);
  return Number.isNaN(numero) ? fallback : numero;
}

function processarRegistro(dados) {
  var SPREADSHEET_ID = "1ItfOyHZhqiZVQcaYIq4S3Dz4PLdeu_LRwNSXFLyw5sE";
  var JORNADA_MINUTOS = 540;

  if (!dados.entrada || !dados.almocoSai || !dados.almocoVolta || !dados.saida) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "erro", mensagem: "Dados incompletos." }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var aba = SpreadsheetApp.openById(SPREADSHEET_ID).getSheets()[0];

  var entrada = new Date("1970-01-01T" + dados.entrada + ":00");
  var almocoSai = new Date("1970-01-01T" + dados.almocoSai + ":00");
  var almocoVolta = new Date("1970-01-01T" + dados.almocoVolta + ":00");
  var saida = new Date("1970-01-01T" + dados.saida + ":00");

  var manha = almocoSai - entrada;
  var tarde = saida - almocoVolta;
  var totalCalculado = (manha + tarde) / 60000;

  var total = converterNumero(dados.totalMinutos, totalCalculado);
  var saldo = converterNumero(dados.saldo, total - JORNADA_MINUTOS);

  aba.appendRow([
    dados.data || "",
    dados.entrada,
    dados.almocoSai,
    dados.almocoVolta,
    dados.saida,
    total,
    saldo,
    dados.geo || "",
    new Date()
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    var dados = (e && e.parameter) ? e.parameter : {};
    return processarRegistro(dados);
  } catch (erro) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "erro", mensagem: erro.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var corpo = (e && e.postData && e.postData.contents) ? e.postData.contents : "";
    var dados = {};

    if (corpo) {
      try {
        dados = JSON.parse(corpo);
      } catch (_) {
        dados = (e && e.parameter) ? e.parameter : {};
      }
    } else {
      dados = (e && e.parameter) ? e.parameter : {};
    }

    return processarRegistro(dados);
  } catch (erro) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "erro", mensagem: erro.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
