/* pdoom.art — Pocket TTS (Kyutai via LaurentMazare xn WASM).
   Lazy-loads ~146 MB q8 weights from Hugging Face on first click. */

const VOICES = [
  { id: 'alba', label: 'Alba' },
  { id: 'marius', label: 'Marius' },
  { id: 'javert', label: 'Javert' },
  { id: 'fantine', label: 'Fantine' },
  { id: 'cosette', label: 'Cosette' },
  { id: 'eponine', label: 'Eponine' },
  { id: 'azelma', label: 'Azelma' },
];

const SPEAKER_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>`;
const STOP_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>`;

const state = {
  worker: null,
  ready: false,
  loading: false,
  speaking: false,
  sampleRate: 24000,
  voice: 'alba',
  audioCtx: null,
  nextStartTime: 0,
  sources: [],
  pendingText: null,
  pendingLabel: null,
  gestureAudioCtx: null,
};

function $(sel, root = document) { return root.querySelector(sel); }

function setStatus(msg) {
  const el = $('#tts-status');
  if (el) el.textContent = msg || '';
}

function setProgress(pct) {
  const bar = $('#tts-progress');
  const fill = $('#tts-progress-fill');
  if (!bar || !fill) return;
  if (pct == null || pct < 0) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  fill.style.width = `${Math.min(100, pct)}%`;
}

function syncButtons() {
  document.querySelectorAll('[data-tts-speak]').forEach((btn) => {
    const active = state.speaking && btn.classList.contains('is-speaking');
    btn.classList.toggle('is-speaking', !!active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    const label = btn.querySelector('.tts-btn-label');
    if (label) label.textContent = active ? 'Stop' : (btn.dataset.idleLabel || 'Listen');
    const icon = btn.querySelector('.tts-btn-icon');
    if (icon) icon.innerHTML = active ? STOP_SVG : SPEAKER_SVG;
  });
  const dockPlay = $('#tts-dock-play');
  if (dockPlay) {
    dockPlay.disabled = state.loading && !state.ready;
    dockPlay.textContent = state.speaking ? 'Stop' : 'Play';
  }
  const dock = $('#tts-dock');
  if (dock) dock.dataset.state = state.speaking ? 'speaking' : state.loading ? 'loading' : state.ready ? 'ready' : 'idle';
}

function stopPlayback() {
  for (const src of state.sources) {
    try { src.stop(); } catch { /* already stopped */ }
  }
  state.sources = [];
  if (state.audioCtx) {
    try { state.audioCtx.close(); } catch { /* ignore */ }
    state.audioCtx = null;
  }
  if (state.gestureAudioCtx) {
    try { state.gestureAudioCtx.close(); } catch { /* ignore */ }
    state.gestureAudioCtx = null;
  }
  state.speaking = false;
  document.querySelectorAll('[data-tts-speak].is-speaking').forEach((b) => b.classList.remove('is-speaking'));
  syncButtons();
}

function cancelSpeak() {
  if (state.worker) state.worker.postMessage({ type: 'cancel' });
  stopPlayback();
  state.pendingText = null;
  setStatus(state.ready ? 'Stopped.' : '');
  setProgress(null);
}

function ensureWorker() {
  if (state.worker) return state.worker;
  const worker = new Worker(new URL('./pocket-tts/worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const { type, ...data } = e.data;
    switch (type) {
      case 'status':
        setStatus(data.message);
        break;
      case 'progress':
        setStatus(`${data.label}: ${data.detail}`);
        setProgress(data.pct >= 0 ? data.pct : 5);
        break;
      case 'progress_done':
        setProgress(100);
        setTimeout(() => setProgress(null), 400);
        break;
      case 'loaded':
        state.ready = true;
        state.loading = false;
        state.sampleRate = data.sampleRate || 24000;
        setStatus(data.already ? 'Ready.' : 'Pocket TTS ready (~146 MB q8).');
        setProgress(null);
        syncButtons();
        if (state.pendingText) {
          const t = state.pendingText;
          const label = state.pendingLabel;
          state.pendingText = null;
          beginGenerate(t, label);
        }
        break;
      case 'gen_start':
        setStatus(`Speaking… (${data.numTokens} tokens)`);
        break;
      case 'chunk': {
        const chunk = new Float32Array(data.data);
        if (!state.audioCtx) break;
        state.nextStartTime = Math.max(state.nextStartTime, state.audioCtx.currentTime);
        const buf = state.audioCtx.createBuffer(1, chunk.length, state.sampleRate);
        buf.getChannelData(0).set(chunk);
        const src = state.audioCtx.createBufferSource();
        src.buffer = buf;
        src.connect(state.audioCtx.destination);
        src.start(state.nextStartTime);
        state.nextStartTime += chunk.length / state.sampleRate;
        state.sources.push(src);
        break;
      }
      case 'done':
        state.speaking = false;
        setStatus('Done.');
        syncButtons();
        break;
      case 'cancelled':
        state.speaking = false;
        setStatus('Stopped.');
        syncButtons();
        break;
      case 'error':
        state.loading = false;
        state.speaking = false;
        setStatus(`TTS error: ${data.message}`);
        setProgress(null);
        syncButtons();
        console.error('[pocket-tts]', data.message);
        break;
      default:
        break;
    }
  };
  worker.onerror = (err) => {
    state.loading = false;
    state.speaking = false;
    setStatus(`Worker error: ${err.message || err}`);
    syncButtons();
  };
  state.worker = worker;
  return worker;
}

async function ensureLoaded() {
  if (state.ready) return;
  if (state.loading) return;
  state.loading = true;
  syncButtons();
  setStatus('Loading Pocket TTS WASM + model (first time ~146 MB)…');
  ensureWorker().postMessage({
    type: 'load',
    quant: 'q8',
    voiceName: state.voice,
  });
}

function beginGenerate(text, label) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) {
    setStatus('Nothing to read.');
    return;
  }
  // Cap very long reads so a mis-click doesn’t burn minutes of CPU.
  const capped = clean.length > 1200 ? `${clean.slice(0, 1200).trim()}…` : clean;

  stopPlayback();
  state.speaking = true;
  if (label) {
    document.querySelectorAll(`[data-tts-speak="${label}"]`).forEach((b) => b.classList.add('is-speaking'));
  }
  syncButtons();

  state.audioCtx = state.gestureAudioCtx || new AudioContext({ sampleRate: state.sampleRate });
  state.gestureAudioCtx = null;
  if (state.audioCtx.state === 'suspended') state.audioCtx.resume().catch(() => {});
  state.nextStartTime = state.audioCtx.currentTime;

  ensureWorker().postMessage({
    type: 'generate',
    text: capped,
    voiceName: state.voice,
    temperature: 0.7,
  });
}

async function speak(text, label) {
  if (state.speaking && label) {
    const btn = document.querySelector(`[data-tts-speak="${label}"].is-speaking`);
    if (btn) {
      cancelSpeak();
      return;
    }
  }
  if (state.speaking) cancelSpeak();

  // Capture AudioContext during the user gesture so playback still works after
  // the async model download (autoplay policy).
  try {
    if (state.gestureAudioCtx) {
      try { await state.gestureAudioCtx.close(); } catch { /* ignore */ }
    }
    state.gestureAudioCtx = new AudioContext({ sampleRate: state.sampleRate });
    state.gestureAudioCtx.resume().catch(() => {});
  } catch { /* ignore */ }

  if (!state.ready) {
    state.pendingText = text;
    state.pendingLabel = label;
    await ensureLoaded();
    return;
  }
  beginGenerate(text, label);
}

function textFromSelector(sel) {
  const el = document.querySelector(sel);
  if (!el) return '';
  return el.innerText || el.textContent || '';
}

function heroText() {
  const title = textFromSelector('#hero-title');
  const lead = textFromSelector('.hero-lead');
  return `${title}. ${lead}`;
}

function primerText() {
  const cards = [...document.querySelectorAll('#explain .explain-card')];
  return cards.map((c) => {
    const h = c.querySelector('h3')?.innerText || '';
    const p = c.querySelector('p')?.innerText || '';
    return `${h}. ${p}`;
  }).join('\n\n');
}

function placardText() {
  const placard = document.querySelector('#featured-root .placard');
  if (!placard) return '';
  return placard.innerText || '';
}

function selectionText() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return '';
  return sel.toString();
}

function makeSpeakButton(id, idleLabel) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tts-btn';
  btn.dataset.ttsSpeak = id;
  btn.dataset.idleLabel = idleLabel;
  btn.setAttribute('aria-pressed', 'false');
  btn.innerHTML = `<span class="tts-btn-icon">${SPEAKER_SVG}</span><span class="tts-btn-label">${idleLabel}</span>`;
  return btn;
}

function mountDock() {
  if ($('#tts-dock')) return;
  const dock = document.createElement('aside');
  dock.id = 'tts-dock';
  dock.className = 'tts-dock';
  dock.setAttribute('aria-label', 'Read aloud');
  dock.innerHTML = `
    <div class="tts-dock-inner wrap">
      <div class="tts-dock-brand" title="Kyutai Pocket TTS · WASM">
        <span class="tts-dock-glyph" aria-hidden="true">${SPEAKER_SVG}</span>
        <span class="tts-dock-title">Read aloud</span>
        <span class="tts-dock-engine">Pocket TTS</span>
      </div>
      <label class="tts-voice-label" for="tts-voice">Voice</label>
      <select id="tts-voice" class="tts-voice" aria-label="Voice">
        ${VOICES.map((v) => `<option value="${v.id}"${v.id === 'alba' ? ' selected' : ''}>${v.label}</option>`).join('')}
      </select>
      <button type="button" class="btn btn-ghost btn-sm" id="tts-dock-play">Play</button>
      <button type="button" class="btn btn-ghost btn-sm" id="tts-dock-sel">Selection</button>
      <div class="tts-dock-status-wrap">
        <p id="tts-status" class="tts-status" role="status" aria-live="polite"></p>
        <div id="tts-progress" class="tts-progress" hidden>
          <div id="tts-progress-fill" class="tts-progress-fill"></div>
        </div>
      </div>
    </div>
    <p class="tts-dock-credit wrap">
      In-browser <a href="https://github.com/kyutai-labs/pocket-tts" target="_blank" rel="noopener noreferrer">Kyutai Pocket TTS</a>
      via <a href="https://laurentmazare.github.io/pocket-tts/" target="_blank" rel="noopener noreferrer">xn WASM</a>
      · model ~146&nbsp;MB on first listen (CC-BY-4.0)
    </p>`;
  document.body.appendChild(dock);

  $('#tts-voice').addEventListener('change', (e) => {
    state.voice = e.target.value;
  });

  $('#tts-dock-play').addEventListener('click', () => {
    if (state.speaking) {
      cancelSpeak();
      return;
    }
    // Default dock play = hero
    speak(heroText(), 'hero');
  });

  $('#tts-dock-sel').addEventListener('click', () => {
    const t = selectionText();
    if (!t) {
      setStatus('Select some text on the page first.');
      return;
    }
    speak(t, 'selection');
  });
}

function wireSectionButtons() {
  const heroCta = document.querySelector('.hero-cta');
  if (heroCta && !heroCta.querySelector('[data-tts-speak="hero"]')) {
    const b = makeSpeakButton('hero', 'Listen');
    b.title = 'Read the hero aloud with Pocket TTS';
    b.addEventListener('click', () => speak(heroText(), 'hero'));
    heroCta.appendChild(b);
  }

  const explainHead = document.querySelector('#explain .section-head');
  if (explainHead && !explainHead.querySelector('[data-tts-speak="primer"]')) {
    const row = document.createElement('div');
    row.className = 'tts-section-actions';
    const b = makeSpeakButton('primer', 'Listen to primer');
    b.addEventListener('click', () => speak(primerText(), 'primer'));
    row.appendChild(b);
    explainHead.appendChild(row);
  }
}

export function wirePlacardListen(root) {
  const placard = root?.querySelector?.('.placard') || document.querySelector('#featured-root .placard');
  if (!placard || placard.querySelector('[data-tts-speak="placard"]')) return;
  const b = makeSpeakButton('placard', 'Listen');
  b.classList.add('tts-btn-placard');
  b.addEventListener('click', () => speak(placardText(), 'placard'));
  const meta = placard.querySelector('.placard-meta');
  if (meta) meta.prepend(b);
  else placard.appendChild(b);
}

function wireSelectionHint() {
  let tip = $('#tts-sel-tip');
  if (!tip) {
    tip = document.createElement('button');
    tip.type = 'button';
    tip.id = 'tts-sel-tip';
    tip.className = 'tts-sel-tip';
    tip.hidden = true;
    tip.innerHTML = `<span class="tts-btn-icon">${SPEAKER_SVG}</span> Read selection`;
    document.body.appendChild(tip);
    tip.addEventListener('click', () => {
      const t = selectionText();
      if (t) speak(t, 'selection');
      tip.hidden = true;
    });
  }

  const update = () => {
    const t = selectionText().trim();
    if (!t || t.length < 2) {
      tip.hidden = true;
      return;
    }
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      tip.hidden = true;
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      tip.hidden = true;
      return;
    }
    tip.hidden = false;
    const top = Math.min(window.innerHeight - 48, Math.max(8, rect.bottom + 8));
    const left = Math.min(window.innerWidth - 160, Math.max(8, rect.left + rect.width / 2 - 70));
    tip.style.top = `${top}px`;
    tip.style.left = `${left}px`;
  };

  document.addEventListener('selectionchange', () => {
    // Debounce layout thrash
    clearTimeout(wireSelectionHint._t);
    wireSelectionHint._t = setTimeout(update, 120);
  });
  window.addEventListener('scroll', () => { tip.hidden = true; }, { passive: true });
}

export function initTTS() {
  mountDock();
  wireSectionButtons();
  wireSelectionHint();
  // Featured may load async; main.js will call wirePlacardListen after render.
  wirePlacardListen();
  document.body.classList.add('has-tts-dock');
}
