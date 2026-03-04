/* global HAMA_COLORS, HAMA_COLORS_LAB, findClosestColor, findClosestColorByAlgorithm, buildColorMap */

'use strict';

// ============================================================
//  STATE
// ============================================================
const state = {
  // wizard
  selectedImagePath: null,
  selectedImageDataUrl: null,
  platesX: 1,
  platesY: 1,
  enabledColorCodes: new Set(HAMA_COLORS.map(c => c.code)),
  selectedAlgorithm: 'cieLab',
  processingCancelled: false,

  // generated pattern
  pendingPattern: null,   // { platesX, platesY, colorCodes }

  // current view
  currentPattern: null,   // loaded/saved pattern
  showCodes: false,

  // completion tracking – 2D boolean array matching colorCodes dimensions
  completed: null,        // boolean[][]
};

const colorMap = buildColorMap();

// ============================================================
//  NAVIGATION
// ============================================================
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ============================================================
//  HOME
// ============================================================
document.getElementById('btn-new-pattern').addEventListener('click', () => {
  resetWizard();
  showView('view-new-pattern');
});

document.getElementById('btn-load-pattern').addEventListener('click', async () => {
  await loadPatternList();
  showView('view-load');
});

// ============================================================
//  WIZARD BACK BUTTON
// ============================================================
document.getElementById('btn-wizard-back').addEventListener('click', () => {
  const active = document.querySelector('.wizard-step.active');
  if (!active) { showView('view-home'); return; }
  const step = parseInt(active.id.replace('wizard-step-', ''), 10);
  if (step <= 1) {
    showView('view-home');
  } else {
    if (step === 3) state.processingCancelled = true;
    goToWizardStep(step - 1);
  }
});

// ============================================================
//  WIZARD – STEP 1
// ============================================================
function resetWizard() {
  state.selectedImagePath = null;
  state.selectedImageDataUrl = null;
  state.platesX = 1;
  state.platesY = 1;
  state.pendingPattern = null;
  state.selectedAlgorithm = 'cieLab';
  state.processingCancelled = false;

  const img = document.getElementById('image-preview');
  img.classList.add('hidden');
  img.src = '';
  document.getElementById('image-placeholder').classList.remove('hidden');

  // reset size inputs
  document.getElementById('plates-x').value = 1;
  document.getElementById('plates-y').value = 1;
  updateSizeBeadCount();

  // reset preview step UI
  document.getElementById('preview-bead-canvas').classList.add('hidden');
  document.getElementById('preview-loading').classList.add('hidden');
  document.getElementById('preview-progress-fill').style.width = '0%';
  document.getElementById('btn-step3-next').disabled = true;
  document.getElementById('algorithm-select').value = 'cieLab';
  document.getElementById('algorithm-description').textContent =
    ALGORITHM_DESCRIPTIONS.cieLab;

  // reset save step UI
  document.getElementById('pattern-name-input').value = '';

  goToWizardStep(1);
}

document.getElementById('image-drop-area').addEventListener('click', selectImage);
document.getElementById('btn-select-image').addEventListener('click', selectImage);

async function selectImage() {
  const filePath = await window.electronAPI.openFile();
  if (!filePath) return;
  const dataUrl = await window.electronAPI.readImage(filePath);
  state.selectedImagePath = filePath;
  state.selectedImageDataUrl = dataUrl;

  const img = document.getElementById('image-preview');
  img.src = dataUrl;
  img.classList.remove('hidden');
  document.getElementById('image-placeholder').classList.add('hidden');
}

// Size selection – numeric inputs (1–20)
function updateSizeBeadCount() {
  const w = state.platesX * 29;
  const h = state.platesY * 29;
  document.getElementById('size-bead-count').textContent =
    `${w} × ${h} = ${(w * h).toLocaleString()} beads`;
}

document.getElementById('plates-x').addEventListener('input', e => {
  const v = Math.min(20, Math.max(1, parseInt(e.target.value, 10) || 1));
  e.target.value = v;
  state.platesX = v;
  updateSizeBeadCount();
});

document.getElementById('plates-y').addEventListener('input', e => {
  const v = Math.min(20, Math.max(1, parseInt(e.target.value, 10) || 1));
  e.target.value = v;
  state.platesY = v;
  updateSizeBeadCount();
});

document.getElementById('btn-step1-next').addEventListener('click', () => {
  if (!state.selectedImageDataUrl) {
    alert('Please select an image first.');
    return;
  }
  buildColorGrid();
  goToWizardStep(2);
});

// ============================================================
//  WIZARD – STEP 2 (Colors)
// ============================================================
function buildColorGrid() {
  const grid = document.getElementById('color-grid');
  grid.innerHTML = '';
  for (const c of HAMA_COLORS) {
    const label = document.createElement('label');
    label.className = 'color-item' + (state.enabledColorCodes.has(c.code) ? ' selected' : '');
    label.dataset.code = c.code;
    label.innerHTML = `
      <input type="checkbox" value="${c.code}" ${state.enabledColorCodes.has(c.code) ? 'checked' : ''}/>
      <span class="color-swatch" style="background:${c.hex};"></span>
      <span class="color-info">
        <span class="color-name">${c.name}</span>
        <span class="color-code">#${c.code}</span>
      </span>`;
    label.addEventListener('change', () => {
      const cb = label.querySelector('input');
      if (cb.checked) { state.enabledColorCodes.add(c.code); label.classList.add('selected'); }
      else { state.enabledColorCodes.delete(c.code); label.classList.remove('selected'); }
      updateColorCount();
    });
    grid.appendChild(label);
  }
  updateColorCount();
}

function updateColorCount() {
  document.getElementById('color-count-label').textContent =
    `${state.enabledColorCodes.size} color${state.enabledColorCodes.size !== 1 ? 's' : ''} selected`;
}

document.getElementById('btn-select-all-colors').addEventListener('click', () => {
  state.enabledColorCodes = new Set(HAMA_COLORS.map(c => c.code));
  document.querySelectorAll('.color-item').forEach(el => {
    el.classList.add('selected');
    el.querySelector('input').checked = true;
  });
  updateColorCount();
});

document.getElementById('btn-deselect-all-colors').addEventListener('click', () => {
  state.enabledColorCodes.clear();
  document.querySelectorAll('.color-item').forEach(el => {
    el.classList.remove('selected');
    el.querySelector('input').checked = false;
  });
  updateColorCount();
});

document.getElementById('btn-step2-prev').addEventListener('click', () => goToWizardStep(1));
document.getElementById('btn-step2-next').addEventListener('click', () => {
  if (state.enabledColorCodes.size === 0) {
    alert('Please select at least one color.');
    return;
  }
  goToWizardStep(3);
  generatePreview();
});

// ============================================================
//  WIZARD – STEP 3 (Preview & Algorithm)
// ============================================================
const ALGORITHM_DESCRIPTIONS = {
  cieLab: 'Euclidean distance in CIE Lab color space. Good balance of accuracy and speed.',
  ciede2000: 'Advanced perceptual color difference formula. Most accurate but slower.',
  rgb: 'Simple Euclidean distance in RGB color space. Fast but less perceptually accurate.',
  weightedRgb: 'RGB distance weighted by human color perception. Good compromise.',
};

document.getElementById('algorithm-select').addEventListener('change', (e) => {
  state.selectedAlgorithm = e.target.value;
  document.getElementById('algorithm-description').textContent =
    ALGORITHM_DESCRIPTIONS[state.selectedAlgorithm] || '';
  state.processingCancelled = true;
  generatePreview();
});

document.getElementById('btn-step3-prev').addEventListener('click', () => {
  state.processingCancelled = true;
  goToWizardStep(2);
});

document.getElementById('btn-step3-next').addEventListener('click', () => {
  if (!state.pendingPattern) return;
  buildProcessSummary();
  goToWizardStep(4);
});

async function generatePreview() {
  document.getElementById('preview-original').src = state.selectedImageDataUrl;

  document.getElementById('preview-loading').classList.remove('hidden');
  document.getElementById('preview-bead-canvas').classList.add('hidden');
  document.getElementById('btn-step3-next').disabled = true;
  document.getElementById('preview-progress-fill').style.width = '0%';

  state.processingCancelled = false;

  try {
    const result = await processImage(
      state.selectedAlgorithm,
      document.getElementById('preview-progress-fill'),
      document.getElementById('preview-progress-label')
    );

    if (state.processingCancelled || !result) return;

    state.pendingPattern = result;

    renderFullPreview(
      document.getElementById('preview-bead-canvas'),
      result.colorCodes, state.platesX, state.platesY
    );

    document.getElementById('preview-loading').classList.add('hidden');
    document.getElementById('preview-bead-canvas').classList.remove('hidden');
    document.getElementById('btn-step3-next').disabled = false;
  } catch (err) {
    if (state.processingCancelled) return;
    document.getElementById('preview-loading').classList.add('hidden');
    alert('Error processing image: ' + err.message);
  }
}

function renderFullPreview(canvas, colorCodes, platesX, platesY) {
  const W = platesX * 29;
  const H = platesY * 29;
  const maxDim = 400;
  const beadPx = Math.max(1, Math.floor(maxDim / Math.max(W, H)));

  canvas.width = W * beadPx;
  canvas.height = H * beadPx;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1e1e2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const code = colorCodes[y][x];
      const color = colorMap[code];
      ctx.fillStyle = color ? color.hex : '#1a1a1a';
      if (beadPx >= 4) {
        const cx = x * beadPx + beadPx / 2;
        const cy = y * beadPx + beadPx / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, beadPx * 0.44, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(x * beadPx, y * beadPx, beadPx, beadPx);
      }
    }
  }
}

// ============================================================
//  WIZARD – STEP 4 (Save)
// ============================================================
function buildProcessSummary() {
  const totalBeadsW = state.platesX * 29;
  const totalBeadsH = state.platesY * 29;
  const el = document.getElementById('process-summary');
  el.innerHTML = `
    <div class="summary-row"><span class="summary-label">Grid size:</span><span>${state.platesX} × ${state.platesY} plates</span></div>
    <div class="summary-row"><span class="summary-label">Total beads:</span><span>${totalBeadsW} × ${totalBeadsH} = ${totalBeadsW * totalBeadsH}</span></div>
    <div class="summary-row"><span class="summary-label">Colors enabled:</span><span>${state.enabledColorCodes.size}</span></div>
    <div class="summary-row"><span class="summary-label">Algorithm:</span><span>${document.getElementById('algorithm-select').selectedOptions[0].text}</span></div>
  `;
}

document.getElementById('btn-step4-prev').addEventListener('click', () => goToWizardStep(3));

document.getElementById('btn-save-pattern').addEventListener('click', async () => {
  const name = document.getElementById('pattern-name-input').value.trim();
  if (!name) { alert('Please enter a pattern name.'); return; }
  if (!state.pendingPattern) return;

  const data = { ...state.pendingPattern, name, date: new Date().toISOString() };
  await window.electronAPI.savePattern(name, data);
  state.currentPattern = data;
  openPatternView(data);
});

document.getElementById('btn-view-result').addEventListener('click', () => {
  if (!state.pendingPattern) return;
  const data = { ...state.pendingPattern, name: document.getElementById('pattern-name-input').value.trim() || 'Unsaved' };
  state.currentPattern = data;
  openPatternView(data);
});

// ============================================================
//  IMAGE PROCESSING
// ============================================================
async function processImage(algorithm, progressFillEl, progressLabelEl) {
  algorithm = algorithm || 'cieLab';
  const W = state.platesX * 29;
  const H = state.platesY * 29;

  // Load image into an offscreen canvas
  const img = await loadImageElement(state.selectedImageDataUrl);
  const offscreen = document.createElement('canvas');
  offscreen.width = W;
  offscreen.height = H;
  const ctx = offscreen.getContext('2d');

  // Draw image scaled to fit, cropped to fill
  const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const sw = img.naturalWidth * scale;
  const sh = img.naturalHeight * scale;
  const sx = (W - sw) / 2;
  const sy = (H - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh);

  const imageData = ctx.getImageData(0, 0, W, H);
  const pixels = imageData.data;

  const colorCodes = new Array(H);
  for (let y = 0; y < H; y++) colorCodes[y] = new Array(W);

  const total = W * H;
  let done = 0;

  // Process in chunks to allow UI updates
  const CHUNK = 500;
  for (let i = 0; i < total; i += CHUNK) {
    if (state.processingCancelled) return null;
    const end = Math.min(i + CHUNK, total);
    for (let p = i; p < end; p++) {
      const r = pixels[p * 4];
      const g = pixels[p * 4 + 1];
      const b = pixels[p * 4 + 2];
      const x = p % W;
      const y = Math.floor(p / W);
      const color = findClosestColorByAlgorithm(r, g, b, state.enabledColorCodes, algorithm);
      colorCodes[y][x] = color ? color.code : '18'; // fallback black
    }
    done = end;
    const pct = Math.round((done / total) * 100);
    if (progressFillEl) progressFillEl.style.width = pct + '%';
    if (progressLabelEl) progressLabelEl.textContent = `Processing… ${pct}%`;
    // yield to browser
    await new Promise(r => setTimeout(r, 0));
  }

  return { platesX: state.platesX, platesY: state.platesY, colorCodes };
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ============================================================
//  WIZARD STEP NAVIGATION
// ============================================================
function goToWizardStep(n) {
  document.querySelectorAll('.wizard-step').forEach(el => el.classList.remove('active'));
  document.getElementById(`wizard-step-${n}`).classList.add('active');

  document.querySelectorAll('.step[data-step]').forEach(el => {
    const s = parseInt(el.dataset.step, 10);
    el.classList.remove('active', 'done');
    if (s === n) el.classList.add('active');
    else if (s < n) el.classList.add('done');
  });
}

// ============================================================
//  PATTERN VIEW
// ============================================================
function openPatternView(pattern) {
  state.currentPattern = pattern;
  state.showCodes = false;
  document.getElementById('btn-toggle-codes').textContent = 'Show Codes';
  document.getElementById('pattern-view-title').textContent = pattern.name || 'Pattern';

  // Initialise completion tracking
  const H = pattern.platesY * 29;
  const W = pattern.platesX * 29;
  if (pattern.completed) {
    // Restore persisted completion data
    state.completed = pattern.completed;
  } else {
    state.completed = Array.from({ length: H }, () => new Array(W).fill(false));
  }

  renderPlateOverview(pattern);
  showView('view-pattern');
}

function renderPlateOverview(pattern) {
  const container = document.getElementById('plate-overview');
  container.innerHTML = '';

  const THUMB_BEAD = 6; // pixels per bead in thumbnail
  const plateSize = 29 * THUMB_BEAD;

  for (let py = 0; py < pattern.platesY; py++) {
    for (let px = 0; px < pattern.platesX; px++) {
      const thumb = document.createElement('div');
      thumb.className = 'plate-thumb';

      const canvas = document.createElement('canvas');
      canvas.width = plateSize;
      canvas.height = plateSize;
      renderPlateToCanvas(canvas, pattern, px, py, THUMB_BEAD, false);

      const label = document.createElement('div');
      label.className = 'plate-label';
      label.textContent = `Plate (${px + 1}, ${py + 1})`;

      thumb.appendChild(canvas);
      thumb.appendChild(label);

      // Completion progress for this plate
      const pInfo = getPlateProgress(px, py);
      if (pInfo.done === pInfo.total) {
        thumb.classList.add('completed');
        const badge = document.createElement('div');
        badge.className = 'plate-complete-badge';
        badge.textContent = '✓ Complete';
        thumb.appendChild(badge);
      } else if (pInfo.done > 0) {
        const prog = document.createElement('div');
        prog.className = 'plate-thumb-progress';
        prog.textContent = `${Math.round((pInfo.done / pInfo.total) * 100)}%`;
        thumb.appendChild(prog);
      }

      thumb.addEventListener('click', () => openPlateModal(pattern, px, py));
      container.appendChild(thumb);
    }
  }
}

function renderPlateToCanvas(canvas, pattern, px, py, beadPx, showLabels) {
  const ctx = canvas.getContext('2d');
  const PLATE = 29;
  const r = beadPx / 2;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1e1e2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < PLATE; row++) {
    for (let col = 0; col < PLATE; col++) {
      const globalRow = py * PLATE + row;
      const globalCol = px * PLATE + col;
      const code = pattern.colorCodes[globalRow]?.[globalCol] ?? '18';
      const color = colorMap[code];
      const cx = col * beadPx + r;
      const cy = row * beadPx + r;
      const isComplete = state.completed && state.completed[globalRow] && state.completed[globalRow][globalCol];

      // Bead circle
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.88, 0, Math.PI * 2);
      ctx.fillStyle = color ? color.hex : '#1a1a1a';
      ctx.fill();

      // Subtle inner highlight
      if (beadPx >= 14) {
        const grad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, 0, cx, cy, r * 0.88);
        grad.addColorStop(0, 'rgba(255,255,255,0.22)');
        grad.addColorStop(1, 'rgba(0,0,0,0.18)');
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.88, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Completed overlay – dim the bead and draw a small check
      if (isComplete) {
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.88, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fill();
        if (beadPx >= 14) {
          ctx.fillStyle = '#10b981';
          ctx.font = `bold ${Math.max(8, Math.round(beadPx * 0.45))}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('✓', cx, cy);
        }
      }

      // Color code label
      if (showLabels && beadPx >= 20 && !isComplete) {
        ctx.fillStyle = getLabelColor(color ? color.hex : '#1a1a1a');
        ctx.font = `bold ${Math.max(8, Math.round(beadPx * 0.28))}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`#${code}`, cx, cy);
      }
    }
  }

  // Grid lines between beads (faint)
  if (beadPx >= 14) {
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= PLATE; i++) {
      ctx.beginPath(); ctx.moveTo(i * beadPx, 0); ctx.lineTo(i * beadPx, canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * beadPx); ctx.lineTo(canvas.width, i * beadPx); ctx.stroke();
    }
  }
}

// Determine whether label text should be light or dark
function getLabelColor(hexBg) {
  const n = parseInt(hexBg.replace('#', ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 128 ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.85)';
}

// ============================================================
//  PLATE ZOOM MODAL
// ============================================================
function openPlateModal(pattern, px, py) {
  const ZOOM_BEAD = 28; // initial px per bead in zoom view
  const SIZE = 29 * ZOOM_BEAD;

  const canvas = document.getElementById('plate-zoom-canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  renderPlateToCanvas(canvas, pattern, px, py, ZOOM_BEAD, state.showCodes);

  document.getElementById('modal-title').textContent =
    `Plate (${px + 1}, ${py + 1})`;

  // Store for re-render on toggle / zoom
  document._zoomState = { pattern, px, py, beadPx: ZOOM_BEAD };

  buildZoomHeaders();
  updateZoomHeaders(ZOOM_BEAD);
  updatePlateProgress(px, py);
  document.getElementById('plate-modal').classList.remove('hidden');
}

function reRenderZoom() {
  const z = document._zoomState;
  if (!z) return;
  const SIZE = 29 * z.beadPx;
  const canvas = document.getElementById('plate-zoom-canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  renderPlateToCanvas(canvas, z.pattern, z.px, z.py, z.beadPx, state.showCodes);
  updateZoomHeaders(z.beadPx);
  updatePlateProgress(z.px, z.py);
}

// Scroll-to-zoom on the zoom canvas
let _zoomRafPending = false;
document.getElementById('plate-zoom-canvas').addEventListener('wheel', e => {
  e.preventDefault();
  const z = document._zoomState;
  if (!z) return;
  const delta = e.deltaY < 0 ? 2 : -2;
  z.beadPx = Math.min(60, Math.max(10, z.beadPx + delta));
  if (!_zoomRafPending) {
    _zoomRafPending = true;
    requestAnimationFrame(() => { _zoomRafPending = false; reRenderZoom(); });
  }
}, { passive: false });

// Click on a bead to toggle completion
document.getElementById('plate-zoom-canvas').addEventListener('click', e => {
  const z = document._zoomState;
  if (!z || !state.completed) return;
  const canvas = document.getElementById('plate-zoom-canvas');
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;
  const col = Math.floor(mx / z.beadPx);
  const row = Math.floor(my / z.beadPx);
  if (col < 0 || col >= 29 || row < 0 || row >= 29) return;
  const globalRow = z.py * 29 + row;
  const globalCol = z.px * 29 + col;
  if (state.completed[globalRow]) {
    state.completed[globalRow][globalCol] = !state.completed[globalRow][globalCol];
  }
  reRenderZoom();
  persistCompletion();
});

document.getElementById('modal-backdrop').addEventListener('click', closeModal);
document.getElementById('btn-modal-close').addEventListener('click', closeModal);
function closeModal() {
  document.getElementById('plate-modal').classList.add('hidden');
  // Re-render overview to reflect updated completion
  if (state.currentPattern) renderPlateOverview(state.currentPattern);
}

// ============================================================
//  COMPLETION HELPERS
// ============================================================
function getPlateProgress(px, py) {
  let done = 0;
  const total = 29 * 29;
  if (!state.completed) return { done: 0, total };
  for (let r = 0; r < 29; r++) {
    const gr = py * 29 + r;
    for (let c = 0; c < 29; c++) {
      if (state.completed[gr] && state.completed[gr][px * 29 + c]) done++;
    }
  }
  return { done, total };
}

function updatePlateProgress(px, py) {
  const { done, total } = getPlateProgress(px, py);
  const pct = Math.round((done / total) * 100);
  document.getElementById('plate-progress').textContent =
    done === total ? '✓ Complete' : `${done} / ${total} (${pct}%)`;
}

let _persistTimer = null;
function persistCompletion() {
  if (state.currentPattern && state.currentPattern.name) {
    state.currentPattern.completed = state.completed;
    clearTimeout(_persistTimer);
    _persistTimer = setTimeout(() => {
      window.electronAPI.savePattern(state.currentPattern.name, state.currentPattern);
    }, 500);
  }
}

// Build row and column header buttons for the zoom modal
function buildZoomHeaders() {
  const colHeaders = document.getElementById('zoom-col-headers');
  const rowHeaders = document.getElementById('zoom-row-headers');
  colHeaders.innerHTML = '';
  rowHeaders.innerHTML = '';

  for (let i = 1; i <= 29; i++) {
    const colBtn = document.createElement('button');
    colBtn.className = 'zoom-header-btn zoom-col-btn';
    colBtn.textContent = i;
    colBtn.dataset.col = i;
    colBtn.addEventListener('click', () => toggleZoomColumn(i - 1));
    colHeaders.appendChild(colBtn);

    const rowBtn = document.createElement('button');
    rowBtn.className = 'zoom-header-btn zoom-row-btn';
    rowBtn.textContent = i;
    rowBtn.dataset.row = i;
    rowBtn.addEventListener('click', () => toggleZoomRow(i - 1));
    rowHeaders.appendChild(rowBtn);
  }
}

// Update header button sizes and completion highlight
function updateZoomHeaders(beadPx) {
  const z = document._zoomState;
  document.querySelectorAll('.zoom-col-btn').forEach((btn, i) => {
    btn.style.width = beadPx + 'px';
    if (z && state.completed) {
      const globalCol = z.px * 29 + i;
      let allDone = true;
      for (let r = 0; r < 29; r++) {
        const gr = z.py * 29 + r;
        if (!state.completed[gr] || !state.completed[gr][globalCol]) { allDone = false; break; }
      }
      btn.classList.toggle('complete', allDone);
    }
  });
  document.querySelectorAll('.zoom-row-btn').forEach((btn, i) => {
    btn.style.height = beadPx + 'px';
    if (z && state.completed) {
      const globalRow = z.py * 29 + i;
      let allDone = true;
      for (let c = 0; c < 29; c++) {
        const gc = z.px * 29 + c;
        if (!state.completed[globalRow] || !state.completed[globalRow][gc]) { allDone = false; break; }
      }
      btn.classList.toggle('complete', allDone);
    }
  });
}

// Toggle all beads in a plate row as complete/incomplete
function toggleZoomRow(row) {
  const z = document._zoomState;
  if (!z || !state.completed) return;
  const globalRow = z.py * 29 + row;
  let allDone = true;
  for (let c = 0; c < 29; c++) {
    if (!state.completed[globalRow][z.px * 29 + c]) { allDone = false; break; }
  }
  for (let c = 0; c < 29; c++) {
    state.completed[globalRow][z.px * 29 + c] = !allDone;
  }
  reRenderZoom();
  persistCompletion();
}

// Toggle all beads in a plate column as complete/incomplete
function toggleZoomColumn(col) {
  const z = document._zoomState;
  if (!z || !state.completed) return;
  const globalCol = z.px * 29 + col;
  let allDone = true;
  for (let r = 0; r < 29; r++) {
    if (!state.completed[z.py * 29 + r][globalCol]) { allDone = false; break; }
  }
  for (let r = 0; r < 29; r++) {
    state.completed[z.py * 29 + r][globalCol] = !allDone;
  }
  reRenderZoom();
  persistCompletion();
}

// Mark entire plate as complete/incomplete
document.getElementById('btn-mark-plate').addEventListener('click', () => {
  const z = document._zoomState;
  if (!z || !state.completed) return;
  const { done, total } = getPlateProgress(z.px, z.py);
  const newVal = done < total; // complete if not fully done, uncomplete if fully done
  for (let r = 0; r < 29; r++) {
    for (let c = 0; c < 29; c++) {
      state.completed[z.py * 29 + r][z.px * 29 + c] = newVal;
    }
  }
  reRenderZoom();
  persistCompletion();
});

// ============================================================
//  PATTERN HEADER CONTROLS
// ============================================================
document.getElementById('btn-toggle-codes').addEventListener('click', () => {
  state.showCodes = !state.showCodes;
  document.getElementById('btn-toggle-codes').textContent =
    state.showCodes ? 'Hide Codes' : 'Show Codes';

  // Re-render zoomed plate if modal is open
  if (!document.getElementById('plate-modal').classList.contains('hidden') && document._zoomState) {
    reRenderZoom();
  }

  // Re-render thumbnails
  if (state.currentPattern) renderPlateOverview(state.currentPattern);
});

document.getElementById('btn-delete-pattern').addEventListener('click', async () => {
  if (!state.currentPattern || !state.currentPattern.name) {
    showView('view-home'); return;
  }
  if (!confirm(`Delete pattern "${state.currentPattern.name}"?`)) return;
  await window.electronAPI.deletePattern(state.currentPattern.name);
  state.currentPattern = null;
  showView('view-home');
});

document.getElementById('btn-pattern-back').addEventListener('click', () => {
  showView('view-home');
});

// ============================================================
//  LOAD PATTERN VIEW
// ============================================================
document.getElementById('btn-load-back').addEventListener('click', () => {
  showView('view-home');
});

async function loadPatternList() {
  const list = await window.electronAPI.listPatterns();
  const container = document.getElementById('pattern-list');
  const empty = document.getElementById('no-patterns');
  container.innerHTML = '';

  if (!list || list.length === 0) {
    empty.classList.remove('hidden');
    container.classList.add('hidden');
    return;
  }
  empty.classList.add('hidden');
  container.classList.remove('hidden');

  list.sort((a, b) => new Date(b.date) - new Date(a.date));
  for (const item of list) {
    const card = document.createElement('div');
    card.className = 'pattern-card';
    const d = new Date(item.date);
    card.innerHTML = `
      <div class="pattern-card-name">${escapeHtml(item.name)}</div>
      <div class="pattern-card-meta">${d.toLocaleDateString()} ${d.toLocaleTimeString()}</div>`;
    card.addEventListener('click', async () => {
      const data = await window.electronAPI.loadPattern(item.name);
      openPatternView(data);
    });
    container.appendChild(card);
  }
}

document.getElementById('btn-no-patterns-new').addEventListener('click', () => {
  resetWizard();
  showView('view-new-pattern');
});

// ============================================================
//  UTILITIES
// ============================================================
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================
//  INIT
// ============================================================
buildColorGrid();
