/* FreeReach — content script
 * Runs on rocketreach.co. Does the real work on the page:
 *   1. Reveal  — click every "Get Contact Info" button, wait for masked data to resolve
 *   2. Extract — parse each contact card into a structured record
 *   3. Automate — reveal + extract this page, then go to the next page and repeat
 *
 * All selectors live in CONFIG so they're easy to tweak if RocketReach changes its markup.
 */
(() => {
  if (window.__freeReachLoaded) return;
  window.__freeReachLoaded = true;

  const CONFIG = {
    cardSelector: '[data-profile-card-id]',
    nameSelector: '#profile-name',
    titleSelector: 'p.font-medium-420',
    companyLinkSelector: 'a[href*="-profile_"]',
    companyFallbackSelector: 'p.text-sm.font-heavy-552',
    locationSelector: '.medium-420',
    contactRowsSelector: '[data-onboarding-id="main-contact-info-teaser"] > div',
    getInfoButtonSelector: 'button[data-px-single-lookup="true"]',
    socialButtonSelector: 'button[data-testid="social-button"]',

    revealTimeoutMs: 12000,   // max wait for one reveal to resolve
    clickDelayMs: 600,        // pause between Get Contact Info clicks (gentle on the API)
    pageLoadTimeoutMs: 30000, // max wait for result cards to render after navigation
    pageGapMs: 1200,          // pause before navigating to the next page
    pageSizeDefault: 50,
    maxPagesGuard: 1000,      // runaway-loop backstop (not a credit limit)
  };

  const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

  // ---- tiny helpers ----------------------------------------------------------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const text = (el) => (el ? el.textContent.trim().replace(/\s+/g, ' ') : '');
  const cards = () => [...document.querySelectorAll(CONFIG.cardSelector)];

  async function waitFor(fn, timeout, interval = 250) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try { if (fn()) return true; } catch (_) {}
      await sleep(interval);
    }
    return false;
  }

  // ---- storage (promise wrappers) -------------------------------------------
  const get = (keys) => chrome.storage.local.get(keys);
  const set = (obj) => chrome.storage.local.set(obj);

  async function isStopped() {
    return (await get('rr_stop')).rr_stop === true;
  }
  async function setProgress(patch) {
    const cur = (await get('rr_progress')).rr_progress || {};
    await set({ rr_progress: { ...cur, ...patch, updatedAt: Date.now() } });
  }

  // Buffer one lead for the CURRENT page only (kept tiny — never accumulates across pages).
  async function bufferLead(rec) {
    const { rr_buffer = [], rr_total = 0 } = await get(['rr_buffer', 'rr_total']);
    if (rr_buffer.some((r) => r.id === rec.id)) return rr_total; // already buffered this page
    rr_buffer.push(rec);
    const total = rr_total + 1;
    await set({ rr_buffer, rr_total: total });
    return total;
  }

  // Save the current page's buffer to its own file (via the background worker), then clear it.
  async function flushPage(pageNum) {
    const { rr_buffer = [], rr_files = 0 } = await get(['rr_buffer', 'rr_files']);
    if (!rr_buffer.length) return true;
    let resp;
    try {
      resp = await chrome.runtime.sendMessage({ type: 'savePage', records: rr_buffer, pageNum });
    } catch (e) {
      resp = { ok: false, error: String((e && e.message) || e) };
    }
    if (resp && resp.ok) {
      await set({ rr_buffer: [], rr_files: rr_files + 1 });
      console.info(`[FreeReach] saved page ${pageNum}: ${rr_buffer.length} leads -> file #${rr_files + 1}`);
      await setProgress({ files: rr_files + 1 });
      return true;
    }
    console.error('[FreeReach] page save failed:', resp && resp.error);
    await setProgress({ status: 'save-error', error: (resp && resp.error) || 'download failed' });
    return false;
  }

  // ---- parsing one card ------------------------------------------------------
  function parseCard(card) {
    const name = text(card.querySelector(CONFIG.nameSelector));
    const title = text(card.querySelector(CONFIG.titleSelector));

    const companyLink = card.querySelector(CONFIG.companyLinkSelector);
    let company = companyLink ? text(companyLink) : '';
    if (!company) company = text(card.querySelector(CONFIG.companyFallbackSelector));
    const companyUrl = companyLink
      ? new URL(companyLink.getAttribute('href'), location.origin).href
      : '';

    // location = first ".medium-420" block that looks like "City, Region, Country"
    let locationStr = '';
    card.querySelectorAll(CONFIG.locationSelector).forEach((el) => {
      const t = text(el);
      if (!locationStr && /,/.test(t) && t.length < 80) locationStr = t;
    });

    const cardText = card.innerText || card.textContent || '';

    // emails: every mailto: link in the (expanded) card; regex over text as a fallback
    const emails = new Set();
    card.querySelectorAll('a[href^="mailto:"]').forEach((a) => {
      const e = decodeURIComponent(a.getAttribute('href').replace(/^mailto:/i, '')).trim();
      if (e && EMAIL_RE.test(e)) emails.add(e);
      EMAIL_RE.lastIndex = 0;
    });
    (cardText.match(EMAIL_RE) || []).forEach((e) => emails.add(e));
    EMAIL_RE.lastIndex = 0;

    // phones: every tel: link; prefer the human-formatted visible text over the raw href
    const phones = new Set();
    card.querySelectorAll('a[href^="tel:"]').forEach((a) => {
      let v = (text(a) || a.getAttribute('href').replace(/^tel:/i, '')).trim();
      if (v && !/x/i.test(v) && (v.match(/\d/g) || []).length >= 7) phones.add(v);
    });

    // work history, education and skills — each sits in an <li> marked by an icon,
    // with the actual lines inside a nested <ol>. (Only present after "View More".)
    const linesAfterIcon = (iconSel) => {
      for (const icon of card.querySelectorAll(iconSel)) {
        const li = icon.closest('li');
        const ol = li && li.querySelector('ol');
        if (ol) return [...ol.querySelectorAll('li')].map(text).filter(Boolean);
      }
      return [];
    };
    const positions = linesAfterIcon('i.fa-briefcase');
    const education = linesAfterIcon('i.fa-graduation-cap');
    const skills = linesAfterIcon('i.fa-book').map((s) => s.replace(/^skills\s*-\s*/i, '').replace(/\.$/, ''));

    // social networks present on the card (LinkedIn / Meta / etc.)
    const socials = new Set();
    card.querySelectorAll(CONFIG.socialButtonSelector).forEach((b) => {
      const t = (b.getAttribute('title') || '').trim();
      if (t) socials.add(t);
    });
    const socialLinks = [
      ...card.querySelectorAll('a[href*="linkedin.com"],a[href*="facebook.com"],a[href*="twitter.com"],a[href*="x.com"]'),
    ].map((a) => a.href);

    return {
      id: card.getAttribute('data-profile-card-id'),
      name, title, company, companyUrl, location: locationStr,
      emails: [...emails], phones: [...phones],
      positions, education, skills,
      socials: [...socials], socialLinks,
      revealed: emails.size > 0 || phones.size > 0,
      sourceUrl: location_href_noHash(),
      collectedAt: new Date().toISOString(),
    };
  }

  function location_href_noHash() {
    return location.origin + location.pathname + location.search;
  }

  // ---- revealing -------------------------------------------------------------
  function visibleGetInfoButton(card) {
    const btns = [...card.querySelectorAll(CONFIG.getInfoButtonSelector)];
    return btns.find((b) => b.offsetParent !== null) || btns[0] || null;
  }

  async function revealCard(card) {
    const btn = visibleGetInfoButton(card);
    if (!btn) return false; // already revealed (button removed) — nothing to do
    btn.scrollIntoView({ block: 'center' });
    btn.click();

    await waitFor(() => {
      const t = card.innerText || '';
      const hasEmail = EMAIL_RE.test(t);
      EMAIL_RE.lastIndex = 0; // reset stateful global regex
      const stillMasked = /\dX{2,}/.test(t);
      const btnGone = !visibleGetInfoButton(card);
      return hasEmail || (btnGone && !stillMasked);
    }, CONFIG.revealTimeoutMs);

    return true;
  }

  // Click "View More" to expand the card in place — reveals ALL emails/phones,
  // plus work history, education and skills. (Inline; no navigation, no extra credit.)
  function viewMoreButton(card) {
    return [...card.querySelectorAll('button')].find(
      (b) => /view more/i.test((b.textContent || '').trim()) && b.offsetParent !== null
    ) || null;
  }

  async function expandCard(card) {
    const btn = viewMoreButton(card);
    if (!btn) return false;
    btn.scrollIntoView({ block: 'center' });
    btn.click();
    // expanded when a "View Less" toggle appears
    await waitFor(
      () => [...card.querySelectorAll('button')].some((b) => /view less/i.test((b.textContent || '').trim())),
      6000
    );
    return true;
  }

  // ---- one page --------------------------------------------------------------
  // Returns the number of cards found on the page (0 => no more results).
  async function processPage({ reveal = true, extract = true }) {
    await waitFor(() => cards().length > 0, CONFIG.pageLoadTimeoutMs);
    const list = cards();
    if (list.length === 0) {
      await setProgress({ status: 'empty', totalCards: 0 });
      return 0;
    }
    await setProgress({ status: reveal ? 'revealing' : 'extracting', totalCards: list.length, revealed: 0 });

    if (reveal) {
      // Reveal one contact, store it immediately, then move to the next.
      for (let i = 0; i < list.length; i++) {
        if (await isStopped()) { await setProgress({ status: 'stopped' }); return list.length; }

        const id = list[i].getAttribute('data-profile-card-id');
        await revealCard(list[i]);
        // expand "View More" to surface ALL emails/phones + work history/education/skills
        const expandTarget = document.querySelector(`[data-profile-card-id="${id}"]`) || list[i];
        await expandCard(expandTarget);

        if (extract) {
          // Re-query the live card by id — Svelte may have re-rendered the node during reveal/expand.
          const live = document.querySelector(`[data-profile-card-id="${id}"]`) || list[i];
          let total;
          try {
            const rec = parseCard(live);
            if (rec && rec.id) total = await bufferLead(rec);
          } catch (e) {
            console.warn('[FreeReach] parseCard failed for card', id, e);
          }
          await setProgress({ revealed: i + 1, extracted: i + 1, ...(total != null ? { totalLeads: total } : {}) });
          console.info(`[FreeReach] contact ${i + 1}/${list.length} buffered (total leads: ${total})`);
        } else {
          await setProgress({ revealed: i + 1 });
        }
        await sleep(CONFIG.clickDelayMs);
      }
      return list.length;
    }

    if (extract) {
      // Extract-only (no reveal): parse the whole page in one pass.
      let total;
      for (const c of cards()) {
        try {
          const rec = parseCard(c);
          if (rec && rec.id) total = await bufferLead(rec);
        } catch (e) { console.warn('[FreeReach] parseCard failed for a card:', e); }
      }
      console.info(`[FreeReach] extracted page (total leads: ${total})`);
      await setProgress({ status: 'extracted', totalLeads: total });
    }
    return list.length;
  }

  // ---- pagination ------------------------------------------------------------
  function nextPageUrl() {
    const url = new URL(location.href);
    const p = url.searchParams;
    const pageSize = parseInt(p.get('pageSize') || CONFIG.pageSizeDefault, 10);
    const start = parseInt(p.get('start') || '1', 10);
    p.set('start', String(start + pageSize));
    p.set('pageSize', String(pageSize));
    return url.toString();
  }

  function currentPageNumber() {
    const p = new URL(location.href).searchParams;
    const pageSize = parseInt(p.get('pageSize') || CONFIG.pageSizeDefault, 10);
    const start = parseInt(p.get('start') || '1', 10);
    return Math.floor((start - 1) / pageSize) + 1;
  }

  function isResultsPage() {
    return /\/person/i.test(location.pathname) || cards().length > 0;
  }

  // ---- automation driver -----------------------------------------------------
  async function startAutomation() {
    // fresh run: reset counters, page buffer and saved-file count
    await set({ rr_running: true, rr_stop: false, rr_pages: 0, rr_buffer: [], rr_total: 0, rr_files: 0 });
    await setProgress({ status: 'starting', page: currentPageNumber(), files: 0 });
    automateStep();
  }

  async function stopAutomation(status) {
    await set({ rr_running: false, rr_stop: true });
    await setProgress({ status });
  }

  // Runs once per page load while automation is active.
  async function automateStep() {
    try {
      const count = await processPage({ reveal: true, extract: true });

      // Save THIS page to its own file before doing anything else (even if stopping).
      await setProgress({ status: 'saving' });
      const saved = await flushPage(currentPageNumber());
      if (!saved) { await stopAutomation('save-error'); return; } // don't move on if the file didn't save

      if (await isStopped()) return;
      if (count === 0) { await stopAutomation('done'); return; }

      const pages = ((await get('rr_pages')).rr_pages || 0) + 1;
      await set({ rr_pages: pages });
      if (pages >= CONFIG.maxPagesGuard) { await stopAutomation('guard'); return; }

      const next = nextPageUrl();
      console.info(`[FreeReach] page ${pages} done -> going to: ${next}`);
      await setProgress({ status: 'next-page', page: currentPageNumber() + 1 });
      await sleep(CONFIG.pageGapMs);
      if (await isStopped()) return;
      location.href = next; // full reload -> content script resumes via init()
    } catch (e) {
      console.error('[FreeReach] automation error:', e);
      await setProgress({ status: 'error', error: String((e && e.message) || e) });
      await set({ rr_running: false, rr_stop: true });
    }
  }

  // ---- message handling (from popup) ----------------------------------------
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
      try {
        switch (msg.type) {
          case 'reveal':   await set({ rr_stop: false }); await processPage({ reveal: true, extract: false }); break;
          case 'extract':  await processPage({ reveal: false, extract: true }); break;
          case 'automate': await startAutomation(); break;
          case 'stop':     await stopAutomation('stopped'); break;
          case 'ping':     break;
        }
        sendResponse({ ok: true });
      } catch (e) {
        await setProgress({ status: 'error', error: String(e && e.message || e) });
        sendResponse({ ok: false, error: String(e && e.message || e) });
      }
    })();
    return true; // keep the channel open for the async response
  });

  // ---- resume automation after a page navigation -----------------------------
  (async function init() {
    const st = await get(['rr_running', 'rr_stop']);
    if (st.rr_running && !st.rr_stop && isResultsPage()) {
      await sleep(1500); // let the SPA hydrate and start fetching results
      automateStep();
    }
  })();
})();
