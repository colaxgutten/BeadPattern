/* global HAMA_COLORS, HAMA_COLORS_LAB, findClosestColor, buildColorMap */

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

  // generated pattern
  pendingPattern: null,   // { platesX, platesY, colorCodes }

  // current view
  currentPattern: null,   // loaded/saved pattern
  showCodes: false,
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
  // figure out current wizard step
  const active = document.querySelector('.wizard-step.active');
  if (active && active.id === 'wizard-step-1') {
    showView('view-home');
  } else {
    // navigate to step 1
    goToWizardStep(1);
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

  const img = document.getElementById('image-preview');
  img.classList.add('hidden');
  img.src = '';
  document.getElementById('image-placeholder').classList.remove('hidden');

  // reset size selection
  document.querySelectorAll('.size-option').forEach(el => el.classList.remove('selected'));
  const first = document.querySelector('.size-option[data-w="1"]');
  if (first) { first.classList.add('selected'); first.querySelector('input').checked = true; }

  // reset process step UI
  document.getElementById('processing-progress').classList.add('hidden');
  document.getElementById('process-result').classList.add('hidden');
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('pattern-name-input').value = '';
  document.getElementById('wizard-nav-step3').classList.remove('hidden');

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

// Size selection
document.getElementById('size-grid').addEventListener('click', e => {
  const option = e.target.closest('.size-option');
  if (!option) return;
  document.querySelectorAll('.size-option').forEach(el => el.classList.remove('selected'));
  option.classList.add('selected');
  option.querySelector('input').checked = true;
  state.platesX = parseInt(option.dataset.w, 10);
  state.platesY = parseInt(option.dataset.h, 10);
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
  buildProcessSummary();
  goToWizardStep(3);
});

// ============================================================
//  WIZARD – STEP 3 (Process)
// ============================================================
function buildProcessSummary() {
  const totalBeadsW = state.platesX * 29;
  const totalBeadsH = state.platesY * 29;
  const el = document.getElementById('process-summary');
  el.innerHTML = `
    <div class="summary-row"><span class="summary-label">Grid size:</span><span>${state.platesX} × ${state.platesY} plates</span></div>
    <div class="summary-row"><span class="summary-label">Total beads:</span><span>${totalBeadsW} × ${totalBeadsH} = ${totalBeadsW * totalBeadsH}</span></div>
    <div class="summary-row"><span class="summary-label">Colors enabled:</span><span>${state.enabledColorCodes.size}</span></div>
  `;
}

document.getElementById('btn-step3-prev').addEventListener('click', () => goToWizardStep(2));

document.getElementById('btn-process').addEventListener('click', async () => {
  document.getElementById('wizard-nav-step3').classList.add('hidden');
  document.getElementById('processing-progress').classList.remove('hidden');
  document.getElementById('process-result').classList.add('hidden');

  try {
    const pattern = await processImage();
    state.pendingPattern = pattern;
    document.getElementById('processing-progress').classList.add('hidden');
    document.getElementById('process-result').classList.remove('hidden');
  } catch (err) {
    document.getElementById('processing-progress').classList.add('hidden');
    document.getElementById('wizard-nav-step3').classList.remove('hidden');
    alert('Error processing image: ' + err.message);
  }
});

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
async function processImage() {
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
  const progressFill = document.getElementById('progress-fill');
  const progressLabel = document.getElementById('progress-label');

  // Process in chunks to allow UI updates
  const CHUNK = 500;
  for (let i = 0; i < total; i += CHUNK) {
    const end = Math.min(i + CHUNK, total);
    for (let p = i; p < end; p++) {
      const r = pixels[p * 4];
      const g = pixels[p * 4 + 1];
      const b = pixels[p * 4 + 2];
      const x = p % W;
      const y = Math.floor(p / W);
      const color = findClosestColor(r, g, b, state.enabledColorCodes);
      colorCodes[y][x] = color ? color.code : '11'; // fallback black
    }
    done = end;
    const pct = Math.round((done / total) * 100);
    progressFill.style.width = pct + '%';
    progressLabel.textContent = `Processing… ${pct}%`;
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
      const code = pattern.colorCodes[globalRow]?.[globalCol] ?? '11';
      const color = colorMap[code];
      const cx = col * beadPx + r;
      const cy = row * beadPx + r;

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

      // Color code label
      if (showLabels && beadPx >= 20) {
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
  const ZOOM_BEAD = 28; // px per bead in zoom view
  const SIZE = 29 * ZOOM_BEAD;

  const canvas = document.getElementById('plate-zoom-canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  renderPlateToCanvas(canvas, pattern, px, py, ZOOM_BEAD, state.showCodes);

  document.getElementById('modal-title').textContent =
    `Plate (${px + 1}, ${py + 1})`;

  // Store for re-render on toggle
  document._zoomState = { pattern, px, py, ZOOM_BEAD, SIZE };

  document.getElementById('plate-modal').classList.remove('hidden');
}

document.getElementById('modal-backdrop').addEventListener('click', closeModal);
document.getElementById('btn-modal-close').addEventListener('click', closeModal);
function closeModal() {
  document.getElementById('plate-modal').classList.add('hidden');
}

// ============================================================
//  PATTERN HEADER CONTROLS
// ============================================================
document.getElementById('btn-toggle-codes').addEventListener('click', () => {
  state.showCodes = !state.showCodes;
  document.getElementById('btn-toggle-codes').textContent =
    state.showCodes ? 'Hide Codes' : 'Show Codes';

  // Re-render zoomed plate if modal is open
  if (!document.getElementById('plate-modal').classList.contains('hidden') && document._zoomState) {
    const { pattern, px, py, ZOOM_BEAD } = document._zoomState;
    const canvas = document.getElementById('plate-zoom-canvas');
    renderPlateToCanvas(canvas, pattern, px, py, ZOOM_BEAD, state.showCodes);
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
