const SHEET_NAME = "Dyno Suggestions";

function doOptions() {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doGet(e) {
  try {
    const data = (e && e.parameter) ? e.parameter : {};
    return saveSuggestion_(data);
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message || "Unknown error" });
  }
}

function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    const data = JSON.parse(raw);
    return saveSuggestion_(data);
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message || "Unknown error" });
  }
}

function saveSuggestion_(data) {
  const teamName = (data.teamName || "").toString().trim();
  const suggestion = (data.suggestion || "").toString().trim();
  const submittedAt = (data.submittedAt || new Date().toISOString()).toString();

  if (!teamName || !suggestion) {
    return jsonResponse({ ok: false, error: "Missing teamName or suggestion" });
  }

  const sheet = getOrCreateSheet_();
  sheet.appendRow([new Date(), submittedAt, teamName, suggestion]);

  return jsonResponse({ ok: true });
}

function getOrCreateSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("No active spreadsheet. Create this script from Extensions > Apps Script in your Google Sheet.");
  }
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(["ServerTimestamp", "ClientTimestamp", "TeamName", "Suggestion"]);
  }

  return sheet;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
