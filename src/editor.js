import { createLevel, normalizeLevel, DIFFICULTIES, OBJECT_TYPES, PORTAL_VALUES } from './levels.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const TYPES = { spike: 'Spike', block: 'Block', coin: 'Coin', pad: 'Jump pad', orb: 'Jump orb', portal: 'Portal' };
const SYMBOLS = { spike: '▲', block: '■', coin: '◉', pad: '▰', orb: '◎', portal: '◌' };
const EFFECTS = ['yellow', 'pink', 'red', 'blue', 'green', 'black'];
const COLORS = { coin: '#ffd570', spike: '#ff739b', block: '#9278da', pad: '#ffe281', orb: '#ffe281', portal: '#75e5e2' };
const EFFECT_COLORS = { yellow: '#ffe281', pink: '#ff92ca', red: '#ff756c', blue: '#77bbff', green: '#71edac', black: '#aaa2c3' };
let styleInstalled = false;

function installStyle() {
  if (styleInstalled) return;
  styleInstalled = true;
  const style = document.createElement('style');
  style.textContent = `
  .gd-editor{--ed-border:rgba(193,169,255,.15);color:#ede7ff;font:14px/1.4 system-ui,sans-serif;display:grid;gap:18px}
  .gd-editor *{box-sizing:border-box}.gd-editor [hidden]{display:none!important}.gd-editor button,.gd-editor input,.gd-editor select{font:inherit}
  .gd-editor button{cursor:pointer;background:#201b36;border:1px solid var(--ed-border);color:#e5ddfb;padding:10px 14px;border-radius:9px;transition:background .15s,border-color .15s}
  .gd-editor button:hover{background:#302344;border-color:#ac8add}.gd-editor button:disabled{cursor:default;opacity:.4}
  .gd-editor button:focus-visible,.gd-editor input:focus-visible,.gd-editor select:focus-visible,.gd-editor canvas:focus-visible{outline:2px solid #bd9bff;outline-offset:3px}
  .gd-editor button.primary{background:#b28af8;color:#1c1034;border-color:#b28af8;font-weight:700}.gd-editor button.test{background:#2d3b3c;color:#a5f7cf}
  .gd-editor button.active{background:#392653;border-color:#cba3ff;color:white}.gd-editor button.danger{color:#ff92b0}
  .gd-editor input,.gd-editor select{background:#141120;border:1px solid var(--ed-border);color:#ede7ff;padding:9px 10px;border-radius:8px;min-width:0;width:100%}
  .gd-editor input[type=color]{height:40px;padding:5px}.gd-editor input[type=checkbox]{width:auto;accent-color:#b88aff}
  .gd-editor label{display:grid;gap:6px;color:#a99fbe;font-size:12px}.gd-editor label.check{display:flex;align-items:center;gap:8px;font-size:13px;color:#c8bedb}
  .ed-top,.ed-actions,.ed-tools,.ed-palette,.ed-bottom{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.ed-top{justify-content:space-between}.ed-top h2{margin:0;font-size:23px;letter-spacing:-.6px}
  .ed-local{color:#a497bb;font-size:12px;display:flex;gap:8px;align-items:center}.ed-local:before{content:'';width:6px;height:6px;background:#80dfb3;border-radius:50%}.ed-dirty{color:#e8c27a;font-size:12px}
  .ed-panel{background:rgba(22,18,35,.8);border:1px solid var(--ed-border);border-radius:14px;padding:18px}.ed-fields{display:grid;grid-template-columns:2fr 1fr 1fr .6fr;gap:14px}.ed-fields .ed-title{grid-column:span 2}
  .ed-workspace{padding:0;overflow:hidden}.ed-tools{padding:14px 16px;border-bottom:1px solid var(--ed-border)}.ed-tools .spacer{flex:1}.ed-tools button{padding:7px 10px}.ed-tools select{width:auto;padding:7px 9px}.ed-palette{padding:12px 16px;border-bottom:1px solid var(--ed-border)}.ed-palette button{display:flex;align-items:center;gap:8px;padding:9px 12px}.ed-palette .symbol{color:#cba8ff;font-size:20px;line-height:1}
  .ed-viewport{overflow-x:auto;overscroll-behavior-x:contain;scrollbar-color:#58436f #171321;background:#0c0b14;max-width:100%;touch-action:pan-x}.ed-track{position:relative;min-width:100%}.ed-canvas{display:block;position:sticky;left:0;outline:none;touch-action:none}
  .ed-bottom{justify-content:space-between;padding:12px 16px;color:#988daf;font-size:12px;min-height:46px}.ed-bottom strong{color:#b8a7d6;font-weight:500}.ed-status{min-height:20px;font-size:13px;color:#aeb7c7}.ed-status.error{color:#ff94ad}.ed-status.success{color:#99e5bf}
  .ed-inspector{display:grid;gap:12px;grid-template-columns:repeat(4,minmax(0,1fr)) 1.4fr auto;align-items:end}.ed-inspector[hidden]{display:none}.ed-inspector-heading{grid-column:1/-1;display:flex;justify-content:space-between;color:#c5b7df;font-size:13px}.ed-hint{color:#9689ac;font-size:12px;margin:0}.ed-file{display:none}.ed-select-level{max-width:240px}.ed-tools .zoom{min-width:50px;text-align:center;color:#b5a4cf;font-size:12px}
  @media(max-width:720px){.ed-fields{grid-template-columns:repeat(2,minmax(0,1fr))}.ed-inspector{grid-template-columns:repeat(2,minmax(0,1fr))}.ed-tools .spacer{display:none}.ed-palette button{padding:8px;font-size:12px}.ed-top h2{font-size:21px}.ed-actions button{padding:9px 11px}.ed-panel{padding:14px}.ed-workspace{padding:0}.ed-select-level{max-width:180px}}
  `;
  document.head.appendChild(style);
}

/**
 * Functional local editor. Callbacks receive normalized levels; onDelete receives the level ID.
 * onSave/onPlay may return a Promise. JSON export/import also works without callbacks.
 * Built-in levels are copied into fresh local drafts, so editing never changes the curated courses.
 */
export function mountEditor(container, options = {}) {
  installStyle();
  const root = document.createElement('section');
  root.className = 'gd-editor';
  root.innerHTML = `
    <div class="ed-top"><div><h2>Level workshop</h2><div class="ed-local">Saved on this device <span class="ed-dirty"></span></div></div>
      <div class="ed-actions"><button data-action="new">＋ New</button><button data-action="save" class="primary">Save level</button><button data-action="play" class="test">▷ Test run</button></div>
    </div>
    <div class="ed-panel ed-fields">
      <label class="ed-title">Level name<input name="name" maxlength="60" placeholder="Untitled Signal"></label>
      <label>Difficulty<select name="difficulty"></select></label><label>Accent<input name="color" type="color"></label>
      <label class="ed-title">Description<input name="subtitle" maxlength="140" placeholder="Give your level a little character."></label>
      <label>Music tempo · BPM<input name="bpm" type="number" min="60" max="220"></label><label>Speed · px/s<input name="speed" type="number" min="100" max="650"></label>
      <label>Course length · px<input name="length" type="number" min="1000" max="40000" step="48"></label>
      <label class="check"><input name="platformer" type="checkbox"> Platformer movement</label>
      <label class="ed-title">Open a local level or remix a course<select class="ed-select-level"><option value="">Choose a level…</option></select></label>
    </div>
    <div class="ed-panel ed-workspace">
      <div class="ed-tools"><button data-tool="select">↖ Select</button><button data-tool="erase">⌫ Erase</button><button data-action="undo" title="Ctrl/⌘ Z">↶ Undo</button><button data-action="redo" title="Ctrl/⌘ Shift Z">↷ Redo</button>
        <label class="check"><input class="ed-snap" type="checkbox" checked> Snap · 48px</label><span class="spacer"></span><button data-action="zoom-out" aria-label="Zoom out">−</button><span class="zoom">75%</span><button data-action="zoom-in" aria-label="Zoom in">＋</button></div>
      <div class="ed-palette"></div>
      <div class="ed-viewport" aria-label="Scrollable level canvas"><div class="ed-track"><canvas class="ed-canvas" tabindex="0" aria-label="Level editor. Choose a tool, then click to place or select objects."></canvas></div></div>
      <div class="ed-bottom"><span class="ed-cursor">Choose an object, then click to place it.</span><strong class="ed-count"></strong></div>
    </div>
    <div class="ed-panel ed-inspector" hidden>
      <div class="ed-inspector-heading"><span class="ed-selected-label">Selected object</span><button data-action="remove" class="danger">Remove</button></div>
      <label>X<input data-object="x" type="number" min="0"></label><label>Y<input data-object="y" type="number" min="0" max="480"></label>
      <label>Width<input data-object="w" type="number" min="1" max="2000"></label><label>Height<input data-object="h" type="number" min="1" max="480"></label>
      <label class="ed-effect-label">Effect<select data-object="value"></select></label><button data-action="apply-object">Apply</button>
    </div>
    <div class="ed-actions"><button data-action="export">↓ Export JSON</button><button data-action="import">↑ Import JSON</button><button data-action="delete" class="danger">Delete local level</button><p class="ed-hint">Space / click to jump in test mode. Ctrl/⌘ Z to undo. Delete removes the selected object.</p></div>
    <div class="ed-status" role="status" aria-live="polite"></div><input class="ed-file" type="file" accept="application/json,.json">
  `;
  container.appendChild(root);
  const query = (selector) => root.querySelector(selector);
  const canvas = query('canvas');
  const ctx = canvas.getContext('2d');
  const viewport = query('.ed-viewport');
  const track = query('.ed-track');
  const status = query('.ed-status');
  const inspector = query('.ed-inspector');
  let level = createLevel();
  let savedJSON = '';
  let tool = 'spike';
  let selected = null;
  let zoom = 0.75;
  let cursor = null;
  let undoStack = [];
  let redoStack = [];
  let destroyed = false;
  let busy = false;
  let knownLevels = [...(options.levels || [])];
  const builtinIds = new Set((options.builtinLevels || []).map((entry) => entry.id));
  const cleanups = [];
  const on = (node, event, listener) => { node.addEventListener(event, listener); cleanups.push(() => node.removeEventListener(event, listener)); };

  function message(text, kind = '') { status.textContent = text; status.className = `ed-status ${kind}`; }
  function history() {
    undoStack.push(clone(level));
    if (undoStack.length > 100) undoStack.shift();
    redoStack = [];
  }
  function changed() {
    query('.ed-dirty').textContent = JSON.stringify(level) === savedJSON ? '· Saved' : '· Unsaved draft';
    query('[data-action="undo"]').disabled = undoStack.length === 0;
    query('[data-action="redo"]').disabled = redoStack.length === 0;
    query('[data-action="delete"]').disabled = !knownLevels.some((entry) => entry.id === level.id && entry.id.startsWith('local-'));
    query('.ed-count').textContent = `${level.objects.length} object${level.objects.length === 1 ? '' : 's'} · ${level.length.toLocaleString()}px`;
    track.style.width = `${level.length * zoom}px`;
    render();
  }
  function fillFields() {
    for (const field of ['name', 'subtitle', 'difficulty', 'color', 'bpm', 'speed', 'length']) query(`[name="${field}"]`).value = level[field];
    query('[name="platformer"]').checked = level.platformer;
  }
  function populateLevels() {
    const select = query('.ed-select-level');
    select.replaceChildren(new Option('Choose a level…', ''));
    for (const entry of knownLevels) select.appendChild(new Option(`${entry.id.startsWith('local-') ? 'Local · ' : 'Remix · '}${entry.name}`, entry.id));
  }
  function selectObject(id) {
    selected = id;
    const object = level.objects.find((entry) => entry.id === id);
    inspector.hidden = !object;
    if (!object) { render(); return; }
    query('.ed-selected-label').textContent = `${TYPES[object.type]} selected`;
    for (const field of ['x', 'y', 'w', 'h']) query(`[data-object="${field}"]`).value = object[field];
    const valueSelect = query('[data-object="value"]');
    valueSelect.replaceChildren();
    const values = object.type === 'portal' ? PORTAL_VALUES : object.type === 'spike' ? ['up', 'down'] : ['pad', 'orb'].includes(object.type) ? EFFECTS : [];
    for (const value of values) valueSelect.appendChild(new Option(value, value));
    if (object.value?.startsWith('speed:') && !PORTAL_VALUES.includes(object.value)) valueSelect.appendChild(new Option(object.value, object.value));
    valueSelect.value = object.value || (object.type === 'spike' ? 'up' : 'yellow');
    query('.ed-effect-label').hidden = !values.length;
    render();
  }
  function setTool(value) {
    tool = value;
    root.querySelectorAll('[data-tool]').forEach((button) => button.classList.toggle('active', button.dataset.tool === value));
    canvas.style.cursor = value === 'erase' ? 'not-allowed' : value === 'select' ? 'default' : 'crosshair';
    query('.ed-cursor').textContent = value === 'select' ? 'Click an object to inspect or move it.' : value === 'erase' ? 'Click an object to erase it.' : `Click to place a ${TYPES[value].toLowerCase()}.`;
  }
  function load(input, { remix = false } = {}) {
    let next = normalizeLevel(input);
    if (remix || !next.id.startsWith('local-') || builtinIds.has(next.id)) {
      next = { ...next, id: createLevel().id, name: `${next.name} Remix`.slice(0, 60) };
      next.objects = next.objects.map((object, index) => ({ ...object, id: `${next.id}-${index}` }));
      savedJSON = '';
    } else savedJSON = JSON.stringify(next);
    level = next;
    undoStack = [];
    redoStack = [];
    viewport.scrollLeft = 0;
    selectObject(null);
    fillFields();
    changed();
    message(remix ? 'A new local remix is ready. The original course stays in the library.' : 'Level loaded.');
  }
  function canvasSize() {
    const width = Math.max(300, Math.round(viewport.clientWidth));
    const height = Math.round(540 * zoom);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { width, height };
  }
  function bounds(object) {
    return ['coin', 'orb'].includes(object.type) ? { x: object.x - object.w / 2, y: object.y - object.h / 2, w: object.w, h: object.h } : object;
  }
  function drawObject(object, ghost = false) {
    const origin = viewport.scrollLeft / zoom;
    const b = bounds(object);
    const x = (b.x - origin) * zoom;
    const y = b.y * zoom;
    const w = b.w * zoom;
    const h = b.h * zoom;
    const color = ['pad', 'orb'].includes(object.type) ? EFFECT_COLORS[object.value] || COLORS[object.type] : COLORS[object.type];
    ctx.save();
    ctx.globalAlpha = ghost ? 0.45 : 1;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    if (object.type === 'spike') {
      ctx.beginPath();
      if (object.value === 'down') { ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w / 2, y + h); }
      else { ctx.moveTo(x, y + h); ctx.lineTo(x + w / 2, y); ctx.lineTo(x + w, y + h); }
      ctx.closePath();ctx.fill();
    } else if (object.type === 'coin' || object.type === 'orb') {
      ctx.beginPath();ctx.arc(x + w / 2, y + h / 2, w / 2, 0, Math.PI * 2);
      ctx.fillStyle = `${color}28`;ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.arc(x + w / 2, y + h / 2, w / 4, 0, Math.PI * 2);ctx.fillStyle = color;ctx.fill();
    } else if (object.type === 'portal') {
      ctx.fillStyle = `${color}14`;ctx.fillRect(x, y, w, h);ctx.strokeRect(x, y, w, h);
      ctx.font = '10px system-ui';ctx.fillStyle = color;ctx.fillText(object.value, x + w + 5, y + 12);
    } else {
      ctx.fillStyle = object.type === 'block' ? '#413059' : color;ctx.fillRect(x, y, w, h);ctx.strokeRect(x + 1, y + 1, Math.max(w - 2, 1), Math.max(h - 2, 1));
      if (object.type === 'block' && w > 12 && h > 12) { ctx.strokeStyle = '#8063a2';ctx.strokeRect(x + 6, y + 6, w - 12, h - 12); }
    }
    if (object.id === selected && !ghost) { ctx.strokeStyle = '#ffffff';ctx.setLineDash([4, 3]);ctx.strokeRect(x - 4, y - 4, w + 8, h + 8); }
    ctx.restore();
  }
  function render() {
    if (destroyed || !ctx) return;
    const { width, height } = canvasSize();
    const origin = viewport.scrollLeft / zoom;
    const end = origin + width / zoom;
    ctx.clearRect(0, 0, width, height);
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#171225');gradient.addColorStop(1, '#0d0d17');
    ctx.fillStyle = gradient;ctx.fillRect(0, 0, width, height);
    ctx.lineWidth = 1;ctx.strokeStyle = '#272135';
    for (let x = Math.floor(origin / 48) * 48; x <= end; x += 48) { ctx.beginPath();ctx.moveTo((x - origin) * zoom, 0);ctx.lineTo((x - origin) * zoom, height);ctx.stroke(); }
    for (let y = 0; y <= 540; y += 48) { ctx.beginPath();ctx.moveTo(0, y * zoom);ctx.lineTo(width, y * zoom);ctx.stroke(); }
    ctx.fillStyle = '#171626';ctx.fillRect(0, 480 * zoom, width, height - 480 * zoom);
    ctx.strokeStyle = level.color;ctx.globalAlpha = 0.5;ctx.beginPath();ctx.moveTo(0, 480 * zoom);ctx.lineTo(width, 480 * zoom);ctx.stroke();ctx.globalAlpha = 1;
    ctx.strokeStyle = '#4c405f';ctx.setLineDash([5, 5]);ctx.beginPath();ctx.moveTo(0, 80 * zoom);ctx.lineTo(width, 80 * zoom);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle = '#746582';ctx.font = '10px system-ui';
    for (let x = Math.ceil(origin / 480) * 480; x <= end; x += 480) ctx.fillText(`${x}px`, (x - origin) * zoom + 5, 17);
    if (origin < 130) { ctx.strokeStyle = '#8ee5be';ctx.strokeRect((80 - origin) * zoom, 448 * zoom, 32 * zoom, 32 * zoom);ctx.fillStyle = '#8ee5be';ctx.fillText('START', (68 - origin) * zoom, 433 * zoom); }
    if (end > level.length - 20) { const x = (level.length - origin) * zoom;ctx.strokeStyle = '#f3d177';ctx.beginPath();ctx.moveTo(x, 80 * zoom);ctx.lineTo(x, 480 * zoom);ctx.stroke();ctx.fillStyle = '#f3d177';ctx.fillText('FINISH', x - 48, 68 * zoom); }
    for (const object of level.objects) { const b = bounds(object);if (b.x + b.w >= origin - 100 && b.x <= end + 100) drawObject(object); }
    if (cursor && OBJECT_TYPES.includes(tool)) drawObject(makeObject(cursor), true);
  }
  function pointer(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: Math.min(level.length, Math.max(0, (event.clientX - rect.left + viewport.scrollLeft) / zoom)), y: Math.max(0, Math.min(479, (event.clientY - rect.top) / zoom)) };
  }
  function makeObject(point) {
    const snap = query('.ed-snap').checked;
    const round = (number) => snap ? Math.round(number / 48) * 48 : Math.round(number);
    let object = { type: tool, x: Math.min(level.length - 40, round(point.x)), y: Math.min(432, round(point.y)), w: 48, h: 48 };
    if (tool === 'spike') object = { ...object, w: 32, h: 32, y: point.y > 408 ? 448 : point.y < 128 ? 80 : Math.min(448, round(point.y)), ...(point.y < 128 ? { value: 'down' } : {}) };
    if (tool === 'coin') object = { ...object, w: 24, h: 24, y: Math.min(456, round(point.y)) };
    if (tool === 'orb') object = { ...object, w: 32, h: 32, y: Math.min(448, round(point.y)), value: query('.ed-place-effect').value || 'yellow' };
    if (tool === 'pad') object = { ...object, y: 474, w: 40, h: 6, value: query('.ed-place-effect').value || 'yellow' };
    if (tool === 'portal') object = { ...object, y: 120, w: 32, h: 320, value: query('.ed-place-effect').value || 'cube' };
    return object;
  }
  function objectAt(point) {
    return [...level.objects].reverse().find((object) => { const b = bounds(object);const margin = object.type === 'pad' ? 12 : 6;return point.x >= b.x - margin && point.x <= b.x + b.w + margin && point.y >= b.y - margin && point.y <= b.y + b.h + margin; });
  }
  function removeSelected() {
    if (!selected) return;
    history();level.objects = level.objects.filter((object) => object.id !== selected);selectObject(null);changed();message('Object removed. Undo is available.');
  }
  function updatePlacementEffects() {
    const select = query('.ed-place-effect');
    select.replaceChildren();
    const values = tool === 'portal' ? PORTAL_VALUES : ['orb', 'pad'].includes(tool) ? EFFECTS : [];
    select.hidden = !values.length;
    for (const value of values) select.appendChild(new Option(value, value));
  }
  for (const difficulty of DIFFICULTIES) query('[name="difficulty"]').appendChild(new Option(difficulty, difficulty));
  for (const type of OBJECT_TYPES) {
    const button = document.createElement('button');button.dataset.tool = type;
    const symbol = document.createElement('span');symbol.className = 'symbol';symbol.textContent = SYMBOLS[type];
    button.append(symbol, document.createTextNode(TYPES[type]));query('.ed-palette').appendChild(button);
  }
  const placementEffects = document.createElement('select');placementEffects.className = 'ed-place-effect';placementEffects.setAttribute('aria-label', 'Object effect');query('.ed-palette').appendChild(placementEffects);
  on(root, 'click', async (event) => {
    const button = event.target.closest('button');
    if (!button || !root.contains(button) || button.disabled) return;
    if (button.dataset.tool) { setTool(button.dataset.tool);updatePlacementEffects();render();return; }
    const action = button.dataset.action;
    try {
      if (action === 'new') { level = createLevel();savedJSON = '';undoStack = [];redoStack = [];selectObject(null);fillFields();changed();message('New unsaved local draft.'); }
      else if (action === 'undo' && undoStack.length) { redoStack.push(clone(level));level = undoStack.pop();selectObject(null);fillFields();changed();message('Change undone.'); }
      else if (action === 'redo' && redoStack.length) { undoStack.push(clone(level));level = redoStack.pop();selectObject(null);fillFields();changed();message('Change restored.'); }
      else if (action === 'zoom-in' || action === 'zoom-out') {
        const worldLeft = viewport.scrollLeft / zoom;zoom = Math.max(0.4, Math.min(1.25, Math.round((zoom + (action === 'zoom-in' ? 0.15 : -0.15)) * 100) / 100));
        query('.zoom').textContent = `${Math.round(zoom * 100)}%`;track.style.width = `${level.length * zoom}px`;viewport.scrollLeft = worldLeft * zoom;render();
      }
      else if (action === 'remove') removeSelected();
      else if (action === 'apply-object') {
        const index = level.objects.findIndex((object) => object.id === selected);if (index < 0) return;
        const next = clone(level);for (const field of ['x', 'y', 'w', 'h']) next.objects[index][field] = query(`[data-object="${field}"]`).value;
        if (!query('.ed-effect-label').hidden) next.objects[index].value = query('[data-object="value"]').value;
        const normalized = normalizeLevel(next);history();level = normalized;selectObject(selected);changed();message('Object updated.', 'success');
      }
      else if (action === 'import') query('.ed-file').click();
      else if (action === 'export') {
        const exported = normalizeLevel(level);
        if (options.onExport) await options.onExport(clone(exported));
        else { const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, level: exported }, null, 2)], { type: 'application/json' }));const link = document.createElement('a');link.href = url;link.download = `${exported.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'level'}.json`;link.click();setTimeout(() => URL.revokeObjectURL(url), 1000); }
        message('JSON export ready. It includes all objects and course settings.', 'success');
      }
      else if (action === 'save' || action === 'play') {
        if (busy) return;const normalized = normalizeLevel(level);busy = true;button.disabled = true;
        try {
          if (action === 'save') {
            if (options.onSave) await options.onSave(clone(normalized));
            else { const existing = JSON.parse(localStorage.getItem('gd-workshop-levels') || '[]');const filtered = Array.isArray(existing) ? existing.filter((entry) => entry.id !== normalized.id) : [];localStorage.setItem('gd-workshop-levels', JSON.stringify([...filtered, normalized])); }
            level = normalized;savedJSON = JSON.stringify(level);knownLevels = knownLevels.filter((entry) => entry.id !== level.id);knownLevels.push(clone(level));populateLevels();changed();message('Level saved on this device. Test it whenever you’re ready.', 'success');
          } else { if (!options.onPlay) throw new Error('Test mode is unavailable in this view.');await options.onPlay(clone(normalized));message('Test run launched. Your draft remains in the workshop.', 'success'); }
        } finally { busy = false;if (!destroyed) button.disabled = false; }
      }
      else if (action === 'delete') {
        const id = level.id;if (!id.startsWith('local-')) throw new Error('Only local levels can be deleted.');
        if (options.onDelete) await options.onDelete(id);
        else { const existing = JSON.parse(localStorage.getItem('gd-workshop-levels') || '[]');localStorage.setItem('gd-workshop-levels', JSON.stringify(existing.filter((entry) => entry.id !== id))); }
        knownLevels = knownLevels.filter((entry) => entry.id !== id);populateLevels();level = createLevel();savedJSON = '';undoStack = [];redoStack = [];selectObject(null);fillFields();changed();message('Local level deleted. A fresh draft is ready.');
      }
    } catch (error) { message(error.message || 'This action could not be completed.', 'error'); }
  });
  on(root, 'change', (event) => {
    if (event.target.matches('[name]')) {
      const field = event.target.name;const next = clone(level);next[field] = field === 'platformer' ? event.target.checked : event.target.value;
      try { const normalized = normalizeLevel(next);history();level = normalized;fillFields();changed();message('Draft settings updated.'); }
      catch (error) { fillFields();message(error.message, 'error'); }
    } else if (event.target.matches('.ed-select-level')) {
      const chosen = knownLevels.find((entry) => entry.id === event.target.value);
      if (chosen) load(chosen, { remix: !chosen.id.startsWith('local-') });
    } else if (event.target.matches('.ed-place-effect,.ed-snap')) render();
  });
  on(canvas, 'pointermove', (event) => { cursor = pointer(event);query('.ed-cursor').textContent = `X ${Math.round(cursor.x)} · Y ${Math.round(cursor.y)} · ${tool === 'select' ? 'Select an object' : tool === 'erase' ? 'Erase an object' : `Place ${TYPES[tool].toLowerCase()}`}`;render(); });
  on(canvas, 'pointerleave', () => { cursor = null;render(); });
  on(canvas, 'pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();canvas.focus({ preventScroll: true });const point = pointer(event);const hit = objectAt(point);
    if (tool === 'select') { selectObject(hit?.id || null);return; }
    if (tool === 'erase') { if (hit) { selectObject(hit.id);removeSelected(); }return; }
    const object = { ...makeObject(point), id: `${level.id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}` };
    if (level.objects.length >= 5000) { message('The 5,000 object limit has been reached.', 'error');return; }
    history();level.objects.push(object);level.objects.sort((a, b) => a.x - b.x);selectObject(object.id);changed();message(`${TYPES[tool]} placed. Select it to adjust its position or size.`);
  });
  on(viewport, 'scroll', render);
  on(root, 'keydown', (event) => {
    const typing = event.target.matches('input,select,textarea');
    if (typing) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault();query(`[data-action="${event.shiftKey ? 'redo' : 'undo'}"]`).click(); }
    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault();query('[data-action="redo"]').click(); }
    else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault();removeSelected(); }
  });
  on(query('.ed-file'), 'change', async (event) => {
    const file = event.target.files?.[0];event.target.value = '';if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('Choose a JSON file smaller than 2 MB.');
      const imported = normalizeLevel(JSON.parse(await file.text()));
      imported.id = createLevel().id;imported.objects = imported.objects.map((object, index) => ({ ...object, id: `${imported.id}-${index}` }));
      if (options.onImport) await options.onImport(clone(imported));
      load(imported);savedJSON = '';changed();message('JSON imported as an unsaved local draft. Save it to add it to your library.', 'success');
    } catch (error) { message(error instanceof SyntaxError ? 'This file is not valid JSON. Choose an exported level file.' : error.message, 'error'); }
  });
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(render) : null;
  observer?.observe(viewport);
  if (!observer) on(window, 'resize', render);
  if (!options.onSave) {
    try { const local = JSON.parse(localStorage.getItem('gd-workshop-levels') || '[]');if (Array.isArray(local)) knownLevels.push(...local.map(normalizeLevel)); }
    catch { message('Local workshop data could not be loaded. Import a backup to restore a level.', 'error'); }
  }
  fillFields();populateLevels();setTool('spike');updatePlacementEffects();changed();
  return {
    load: (input) => load(input),
    getLevel: () => normalizeLevel(clone(level)),
    destroy() { destroyed = true;observer?.disconnect();cleanups.forEach((cleanup) => cleanup());root.remove(); },
  };
}
