// Paste this whole file into Extensions > Apps Script on a Google Sheet you create
// specifically for this. See ../README.md for the full deploy steps.

const SHEET_NAME = 'Responses';
const SECRET = 'REPLACE_WITH_A_CODEWORD'; // must match SHARED_SECRET in app.js

function doGet(e) {
  if (e.parameter.secret !== SECRET) {
    return respond_(e, { error: 'unauthorized' });
  }
  if (e.parameter.action === 'list') {
    const sheet = getSheet_();
    const values = sheet.getDataRange().getValues();
    const headers = values.shift();
    const data = values
      .filter(function (row) { return row[1]; }) // skip blank rows (col B = FullName)
      .map(function (row) {
        const obj = {};
        headers.forEach(function (h, i) { obj[h] = row[i]; });
        return obj;
      });
    return respond_(e, data);
  }
  return respond_(e, { error: 'unknown action' });
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  if (body.secret !== SECRET) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: 'unauthorized' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const sheet = getSheet_();
  sheet.appendRow([
    new Date(),
    body.fullName || '',
    body.email || '',
    body.regNumber || '',
    body.groupCode || '',
    (body.known || []).join(' | '),
  ]);
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['Timestamp', 'FullName', 'Email', 'RegNumber', 'GroupCode', 'Known']);
  }
  return sheet;
}

// GET responses are served as JSONP (wrapped in the requested callback) so the
// static GitHub Pages site can read them cross-origin without hitting CORS issues.
function respond_(e, obj) {
  const json = JSON.stringify(obj);
  if (e.parameter.callback) {
    return ContentService
      .createTextOutput(e.parameter.callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}
