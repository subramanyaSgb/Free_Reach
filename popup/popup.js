/* FreeReach — popup
 * Sends commands to the content script and shows live progress from chrome.storage.
 */

const $ = (id) => document.getElementById(id);

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function onRocketReach() {
  const tab = await activeTab();
  return tab && /:\/\/([^/]*\.)?rocketreach\.co\//i.test(tab.url || '');
}

async function send(type) {
  const tab = await activeTab();
  if (!tab) return null;
  try {
    return await chrome.tabs.sendMessage(tab.id, { type });
  } catch (e) {
    toast("Couldn’t reach the page. Reload the RocketReach tab and try again.", true);
    return null;
  }
}

function toast(msg, isError) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  t.style.background = isError ? '#fef2f2' : '#ecfdf5';
  t.style.borderColor = isError ? '#fecaca' : '#a7f3d0';
  t.style.color = isError ? '#991b1b' : '#065f46';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), 3500);
}

// ---- live status -----------------------------------------------------------
let _lastToastedError = null;

async function render() {
  const { rr_progress = {}, rr_total = 0, rr_files = 0, rr_running = false } =
    await chrome.storage.local.get(['rr_progress', 'rr_total', 'rr_files', 'rr_running']);

  $('stStatus').textContent = rr_progress.status || 'idle';
  if (rr_progress.status === 'error' && rr_progress.error && rr_progress.error !== _lastToastedError) {
    _lastToastedError = rr_progress.error;
    toast('Error: ' + rr_progress.error, true);
  }
  if (rr_progress.status !== 'error') _lastToastedError = null; // reset when error clears
  $('stPage').textContent = rr_progress.page ?? '–';
  $('stRevealed').textContent =
    rr_progress.totalCards != null
      ? `${rr_progress.revealed ?? 0} / ${rr_progress.totalCards}`
      : '–';
  $('stFiles').textContent = rr_files;
  $('stLeads').textContent = rr_total;

  $('btnStop').classList.toggle('hidden', !rr_running);
  ['btnReveal', 'btnExtract', 'btnAutomate'].forEach((id) => ($(id).disabled = rr_running));
}

chrome.storage.onChanged.addListener(render);
setInterval(render, 800); // safety poll in case an event is missed

// ---- exports (operate on the current unsaved page buffer) ------------------
async function bufferArray() {
  const { rr_buffer = [] } = await chrome.storage.local.get('rr_buffer');
  return rr_buffer;
}

async function downloadJSON() {
  const data = await bufferArray();
  if (!data.length) return toast('Nothing in the current-page buffer. (Automation auto-saves each page to a file.)', true);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const resp = await chrome.runtime.sendMessage({
    type: 'downloadBuffer',
    records: data,
    filename: `freereach-leads-${stamp}.json`,
  });
  if (resp && resp.ok) toast(`Downloaded ${data.length} leads (current page).`);
  else toast('Download failed: ' + ((resp && resp.error) || 'unknown'), true);
}

async function copyJSON() {
  const data = await bufferArray();
  if (!data.length) return toast('Nothing in the current-page buffer.', true);
  await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  toast(`Copied ${data.length} leads to clipboard.`);
}

async function clearLeads() {
  await chrome.storage.local.set({ rr_buffer: [], rr_total: 0, rr_files: 0, rr_progress: {}, rr_pages: 0 });
  toast('Reset counters and buffer. (Saved files on disk are not deleted.)');
  render();
}

// ---- wire up ---------------------------------------------------------------
$('btnReveal').addEventListener('click', () => send('reveal'));
$('btnExtract').addEventListener('click', () => send('extract'));
$('btnAutomate').addEventListener('click', () => { send('automate'); toast('Automation started — you can close this popup.'); });
$('btnStop').addEventListener('click', () => send('stop'));
$('btnDownload').addEventListener('click', downloadJSON);
$('btnCopy').addEventListener('click', copyJSON);
$('btnClear').addEventListener('click', clearLeads);

(async function start() {
  $('version').textContent = 'v' + chrome.runtime.getManifest().version;
  const ok = await onRocketReach();
  $('notOnSite').classList.toggle('hidden', ok);
  $('controls').classList.toggle('hidden', !ok);
  render();
})();
