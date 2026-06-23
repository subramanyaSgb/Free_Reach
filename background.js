/* FreeReach — background service worker
 * Saves each page of leads to its own JSON file. Content scripts can't call
 * chrome.downloads, and MV3 service workers can't make blob URLs, so we hand the
 * data over as a data: URL (one page ≈ 66 KB, well within data-URL limits).
 */

function doDownload(filename, records, sendResponse) {
  const json = JSON.stringify(records, null, 2);
  const url = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
  chrome.downloads.download(
    { url, filename, saveAs: false, conflictAction: 'uniquify' },
    (downloadId) => {
      const err = chrome.runtime.lastError;
      sendResponse({ ok: !err && downloadId != null, id: downloadId, error: err && err.message });
    }
  );
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'savePage') {
    if (!Array.isArray(msg.records)) {
      sendResponse({ ok: false, error: 'records missing or not an array' });
      return false;
    }
    const num = String(msg.pageNum || 0).padStart(4, '0');
    doDownload(`freereach-leads/page-${num}.json`, msg.records, sendResponse);
    return true;
  }
  if (msg && msg.type === 'downloadBuffer') {
    if (!Array.isArray(msg.records)) {
      sendResponse({ ok: false, error: 'records missing or not an array' });
      return false;
    }
    doDownload(msg.filename || 'freereach-leads.json', msg.records, sendResponse);
    return true;
  }
  return false; // unknown message type — close channel cleanly
});
