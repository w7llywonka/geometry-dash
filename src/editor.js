import { createLevel, normalizeLevel, DIFFICULTIES, OBJECT_TYPES, PORTAL_VALUES, MODES, EFFECT_VALUES, TRIGGER_ACTIONS, EASING_VALUES } from './levels.js';
import { SFX_IDS } from './audio.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const TYPES = { spike: 'Spike', block: 'Block', slope: 'Slope', saw: 'Saw', coin: 'Coin', pad: 'Jump pad', orb: 'Jump orb', portal: 'Portal', checkpoint: 'Checkpoint', trigger: 'Trigger', startpos: 'Start position', decoration: 'Decoration', text: 'Text' };
const SYMBOLS = { spike: '▲', block: '■', slope: '◢', saw: '✹', coin: '◉', pad: '▰', orb: '◎', portal: '◌', checkpoint: '⚑', trigger: '◇', startpos: '▷', decoration: '✧', text: 'T' };
const EFFECTS = EFFECT_VALUES;
const COLORS = { coin: '#ffd570', spike: '#ff739b', block: '#9278da', slope: '#9278da', saw: '#ff739b', pad: '#ffe281', orb: '#ffe281', portal: '#75e5e2', checkpoint: '#8de4ad', trigger: '#e9b475', startpos: '#8ee5be', decoration: '#a68bdd', text: '#d8c3ff' };
const EFFECT_COLORS = { yellow: '#ffe281', pink: '#ff92ca', red: '#ff756c', blue: '#77bbff', green: '#71edac', black: '#aaa2c3', dash: '#81eacb', 'gravity-dash': '#ff9dca', spider: '#ed89c1', teleport: '#91c5ff', trigger: '#e9b475' };
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
  .ed-properties{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;border-top:1px solid var(--ed-border);padding-top:16px}.ed-properties .wide{grid-column:span 2}.ed-properties h3{grid-column:1/-1;margin:0;font-size:13px;color:#c5b7df}.ed-selection-tools{display:flex;gap:8px;flex-wrap:wrap;grid-column:1/-1}.ed-palette .ed-place-effect{width:auto;min-width:130px}.ed-palette label{display:flex;align-items:center;gap:7px}.ed-object-id{grid-column:1/-1;color:#8e80a2;font-size:11px;overflow-wrap:anywhere}
  @media(max-width:720px){.ed-properties{grid-template-columns:repeat(2,minmax(0,1fr))}.ed-inspector-heading{gap:8px;flex-wrap:wrap}}
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
      <div class="ed-selection-tools"><button data-action="duplicate">Duplicate</button><button data-action="rotate-left">↶ Rotate 15°</button><button data-action="rotate-right">↷ Rotate 15°</button><button data-action="flip-x">Flip X</button><button data-action="flip-y">Flip Y</button><button data-action="test-here" class="test" hidden>▷ Test here</button></div>
      <label>X<input data-object="x" type="number" min="0"></label><label>Y<input data-object="y" type="number" min="0" max="480"></label>
      <label>Width<input data-object="w" type="number" min="1" max="2000"></label><label>Height<input data-object="h" type="number" min="1" max="480"></label>
      <label class="ed-effect-label">Effect<select data-object="value"></select></label><button data-action="apply-object">Apply</button>
      <div class="ed-object-id"></div><div class="ed-properties"></div>
    </div>
    <div class="ed-actions"><button data-action="export">↓ Export JSON</button><button data-action="import">↑ Import JSON</button><button data-action="delete" class="danger">Delete local level</button><p class="ed-hint">Shift-click to select several objects. Drag empty space to select a region. Arrow keys move selection. Ctrl/⌘ D duplicates. Ctrl/⌘ Z undoes.</p></div>
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
  let selectedIds = new Set();
  let marquee = null;
  let propertyDefaults = {};
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
  function propertyField(object, name, labelText, type = 'number', fallback = '', choices = []) {
    const label = document.createElement('label');label.appendChild(document.createTextNode(labelText));
    let input;
    if (type === 'select') { input = document.createElement('select');for (const value of choices) input.appendChild(new Option(value, value)); }
    else { input = document.createElement('input');input.type = type === 'groups' ? 'text' : type; }
    input.dataset.property = name;input.dataset.kind = type;
    let value = object[name] ?? fallback;
    if (type === 'groups') { value = Array.isArray(value) ? value.join(', ') : '';input.placeholder = '1, 2, 3'; }
    if (name === 'direction' && typeof value === 'number') value = value === -1 ? 'left' : 'right';
    if (type === 'select' && value !== '' && !choices.map(String).includes(String(value))) input.appendChild(new Option(String(value), String(value)));
    if (type === 'checkbox') { input.checked = value;label.className = 'check'; }
    else { input.value = value; if (type === 'number') input.step = 'any'; }
    propertyDefaults[name] = type === 'checkbox' ? !!value : type === 'groups' ? (object[name] || []) : type === 'number' && value !== '' ? Number(value) : value;
    label.appendChild(input);query('.ed-properties').appendChild(label);return input;
  }
  function properties(object) {
    const panel = query('.ed-properties');panel.replaceChildren();propertyDefaults = {};
    const heading = document.createElement('h3');heading.textContent = selectedIds.size > 1 ? 'Selection properties · changes apply to every selected object' : 'Object properties';panel.appendChild(heading);
    const field = (name, text, type, fallback, choices) => propertyField(object, name, text, type, fallback, choices);
    field('groups', 'Group IDs', 'groups', []);field('z', 'Layer · −100 to 100', 'number', 0);
    field('rotation', 'Rotation · degrees', 'number', 0);field('opacity', 'Opacity · 0 to 1', 'number', 1);
    field('color', 'Object color', 'color', COLORS[object.type]);field('targetPlayer', 'Affected player', 'select', 'both', ['one', 'two', 'both']);
    field('active', 'Active · collisions / events', 'checkbox', true);field('visible', 'Visible in game', 'checkbox', true);
    if (selectedIds.size > 1) return;
    if (object.type === 'saw') field('radius', 'Collision radius', 'number', object.w / 2);
    if (object.type === 'text') { field('text', 'Text · up to 240 characters', 'text', 'Your message');field('fontSize', 'Font size', 'number', 24); }
    if (object.type === 'startpos') {
      field('mode', 'Start form', 'select', 'cube', [...MODES, 'jetpack']);field('mini', 'Mini form', 'checkbox', false);
      field('gravity', 'Start gravity', 'select', 1, ['1', '-1', 'normal', 'reverse']);field('speed', 'Start speed · px/s', 'number', level.speed);
      field('dual', 'Dual players', 'checkbox', false);field('direction', 'Start direction', 'select', 'right', ['right', 'left']);
    }
    if (['orb', 'pad', 'portal'].includes(object.type) && ['teleport', 'trigger', 'dash', 'gravity-dash'].includes(object.value)) {
      field('targetId', 'Target object ID', 'text', '');field('targetGroup', 'Target group · optional', 'number', '');
      if (object.value === 'teleport') { field('targetX', 'Destination X · optional', 'number', '');field('targetY', 'Destination Y · optional', 'number', '');field('preserveVelocity', 'Keep momentum after teleport', 'checkbox', false); }
      if (['dash', 'gravity-dash'].includes(object.value)) { field('angle', 'Dash angle · degrees', 'number', 0);field('dashDuration', 'Dash duration · seconds', 'number', 0.6); }
    }
    if (object.type === 'trigger' || (['orb', 'pad'].includes(object.type) && object.value === 'trigger')) {
      const subheading = document.createElement('h3');subheading.textContent = 'Trigger action';panel.appendChild(subheading);
      const action = object.action || (object.type === 'trigger' ? 'move' : 'spawn');
      field('action', 'Action', 'select', action, TRIGGER_ACTIONS);
      if (!query('[data-property="targetGroup"]')) { field('targetGroup', 'Target group · optional', 'number', '');field('targetId', 'Target object ID · optional', 'text', ''); }
      field('duration', 'Duration · seconds', 'number', 0);field('delay', 'Delay · seconds', 'number', 0);field('easing', 'Easing', 'select', 'linear', EASING_VALUES);
      if (action === 'move') { field('moveX', 'Move X · relative pixels', 'number', 0);field('moveY', 'Move Y · relative pixels', 'number', 0); }
      if (action === 'rotate') { field('centerGroup', 'Pivot group · optional', 'number', '');field('centerX', 'Pivot X · optional', 'number', '');field('centerY', 'Pivot Y · optional', 'number', ''); }
      if (['color', 'pulse'].includes(action)) field('colorTarget', 'Color destination', 'select', object.targetGroup ? 'group' : 'background', ['background', 'ground', 'group']);
      if (action === 'toggle') field('enabled', 'Enable target objects', 'checkbox', true);
      if (['spawn', 'pickup'].includes(action)) field('spawnGroup', 'Spawn group', 'number', '');
      if (action === 'pickup') {
        field('counterId', 'Counter ID', 'number', 1);field('count', 'Counter amount', 'number', 1);
        field('operation', 'Counter operation', 'select', 'add', ['add', 'set', 'multiply', 'divide']);field('targetCount', 'Spawn at counter threshold · optional', 'number', '');
      }
      if (action === 'follow') { field('followPlayer', 'Follow player', 'select', 'one', ['one', 'two']);field('followX', 'Follow horizontal motion', 'checkbox', true);field('followY', 'Follow vertical motion', 'checkbox', true); }
      if (action === 'gravity') field('gravityValue', 'Gravity effect', 'select', 'toggle', ['normal', 'reverse', 'toggle', '1', '-1']);
      if (action === 'camera') { field('zoom', 'Camera zoom', 'number', 1);field('cameraX', 'Camera X offset', 'number', 0);field('cameraY', 'Camera Y offset', 'number', 0);field('cameraRotation', 'Camera rotation · degrees', 'number', 0);field('staticX', 'Lock camera X · optional', 'number', '');field('staticY', 'Lock camera Y · optional', 'number', ''); }
      if (['sfx', 'stop-sfx'].includes(action)) { field('soundId', 'Local sound ID', 'select', 'jump', SFX_IDS);field('soundChannel', 'Sound channel · optional', 'text', '');if (action === 'sfx') field('volume', 'Sound volume · 0 to 1', 'number', 0.7); }
      field('spawnTriggered', 'Activate only when spawned', 'checkbox', false);field('touchTriggered', 'Activate on contact', 'checkbox', false);field('once', 'Activate once per attempt', 'checkbox', true);
    }
  }
  function readProperties() {
    const values = {};
    for (const input of root.querySelectorAll('[data-property]')) {
      const name = input.dataset.property;const kind = input.dataset.kind;
      if (kind === 'checkbox') values[name] = input.checked;
      else if (kind === 'groups') {
        const parts = input.value.trim() ? input.value.split(/[\s,]+/).filter(Boolean) : [];
        if (parts.some((part) => !/^\d+$/.test(part))) throw new Error('Group IDs must be whole numbers separated by commas.');
        values[name] = parts.map(Number);
      } else if (kind === 'number') values[name] = input.value === '' ? undefined : Number(input.value);
      else if (['gravity', 'gravityValue'].includes(name) && ['1', '-1'].includes(input.value)) values[name] = Number(input.value);
      else values[name] = input.value;
    }
    return values;
  }
  function selectObject(id, additive = false) {
    if (additive === null) { /* Refresh the existing selection without changing membership. */ }
    else if (!additive) selectedIds = new Set(id ? [id] : []);
    else if (selectedIds.has(id)) selectedIds.delete(id);
    else if (id) selectedIds.add(id);
    selected = selectedIds.has(id) ? id : [...selectedIds].at(-1) || null;
    const object = level.objects.find((entry) => entry.id === selected);
    inspector.hidden = !object;
    if (!object) { render(); return; }
    query('.ed-selected-label').textContent = selectedIds.size > 1 ? `${selectedIds.size} objects selected` : `${TYPES[object.type]} selected`;
    query('.ed-object-id').textContent = selectedIds.size > 1 ? 'Move X/Y relative to the first selection; apply properties to the entire selection.' : `Object ID: ${object.id}`;
    query('[data-action="test-here"]').hidden = selectedIds.size !== 1 || object.type !== 'startpos';
    for (const field of ['x', 'y', 'w', 'h']) query(`[data-object="${field}"]`).value = object[field];
    const valueSelect = query('[data-object="value"]');
    valueSelect.replaceChildren();
    const values = selectedIds.size > 1 ? [] : object.type === 'portal' ? PORTAL_VALUES : ['spike', 'slope'].includes(object.type) ? ['up', 'down'] : ['pad', 'orb'].includes(object.type) ? EFFECTS : object.type === 'decoration' ? ['square', 'circle', 'diamond', 'line'] : [];
    for (const value of values) valueSelect.appendChild(new Option(value, value));
    if (object.value?.startsWith('speed:') && !PORTAL_VALUES.includes(object.value)) valueSelect.appendChild(new Option(object.value, object.value));
    valueSelect.value = object.value || (['spike', 'slope'].includes(object.type) ? 'up' : object.type === 'decoration' ? 'diamond' : 'yellow');
    query('.ed-effect-label').hidden = !values.length;
    properties(object);
    render();
  }
  function setTool(value) {
    tool = value;
    root.querySelectorAll('[data-tool]').forEach((button) => button.classList.toggle('active', button.dataset.tool === value));
    canvas.style.cursor = value === 'erase' ? 'not-allowed' : value === 'select' ? 'default' : 'crosshair';
    query('.ed-cursor').textContent = value === 'select' ? 'Click an object to inspect or move it.' : value === 'erase' ? 'Click an object to erase it.' : `Click to place a ${TYPES[value].toLowerCase()}.`;
  }
  function remapLevelIds(input, newId) {
    const next = clone(input);const ids = new Map(next.objects.map((object, index) => [object.id, `${newId}-${index}`]));
    next.id = newId;
    next.objects = next.objects.map((object) => ({ ...object, id: ids.get(object.id), ...(object.targetId && ids.has(object.targetId) ? { targetId: ids.get(object.targetId) } : {}) }));
    return next;
  }
  function load(input, { remix = false } = {}) {
    let next = normalizeLevel(input);
    if (remix || !next.id.startsWith('local-') || builtinIds.has(next.id)) {
      next = remapLevelIds(next, createLevel().id);next.name = `${next.name} Remix`.slice(0, 60);
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
    if (object.type === 'saw') { const radius = object.radius || object.w / 2;return { x: object.x - radius, y: object.y - radius, w: radius * 2, h: radius * 2 }; }
    return ['coin', 'orb', 'saw', 'startpos'].includes(object.type) ? { x: object.x - object.w / 2, y: object.y - object.h / 2, w: object.w, h: object.h } : object;
  }
  function drawObject(object, ghost = false) {
    const origin = viewport.scrollLeft / zoom;
    const b = bounds(object);
    const x = (b.x - origin) * zoom;
    const y = b.y * zoom;
    const w = b.w * zoom;
    const h = b.h * zoom;
    const color = object.color || (['pad', 'orb'].includes(object.type) ? EFFECT_COLORS[object.value] || COLORS[object.type] : COLORS[object.type]);
    ctx.save();
    ctx.globalAlpha = (ghost ? 0.45 : 1) * Math.max(0.15, object.opacity ?? 1) * (object.visible === false || object.active === false ? 0.35 : 1);
    const rotation = object.rotation || 0;
    if (rotation) { ctx.translate(x + w / 2, y + h / 2);ctx.rotate(rotation * Math.PI / 180);ctx.translate(-x - w / 2, -y - h / 2); }
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    if (object.type === 'spike') {
      ctx.beginPath();
      if (object.value === 'down') { ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w / 2, y + h); }
      else { ctx.moveTo(x, y + h); ctx.lineTo(x + w / 2, y); ctx.lineTo(x + w, y + h); }
      ctx.closePath();ctx.fill();
    } else if (object.type === 'slope') {
      ctx.beginPath();ctx.moveTo(x, y + h);ctx.lineTo(x + w, y + h);ctx.lineTo(object.value === 'down' ? x : x + w, y);ctx.closePath();ctx.fillStyle = `${color}55`;ctx.fill();ctx.stroke();
    } else if (object.type === 'saw') {
      const radius = (object.radius || object.w / 2) * zoom;
      ctx.beginPath();for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2;const r = i % 2 ? radius * 0.72 : radius;const px = x + w / 2 + Math.cos(a) * r;const py = y + h / 2 + Math.sin(a) * r;i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }ctx.closePath();ctx.fillStyle = `${color}66`;ctx.fill();ctx.stroke();ctx.beginPath();ctx.arc(x + w / 2, y + h / 2, radius * 0.2, 0, Math.PI * 2);ctx.stroke();
    } else if (object.type === 'text') {
      ctx.font = `${(object.fontSize || 24) * zoom}px system-ui`;ctx.fillText(object.text || 'Your message', x, y + Math.min(h, 30 * zoom), w);
    } else if (object.type === 'trigger') {
      ctx.beginPath();ctx.moveTo(x + w / 2, y);ctx.lineTo(x + w, y + h / 2);ctx.lineTo(x + w / 2, y + h);ctx.lineTo(x, y + h / 2);ctx.closePath();ctx.fillStyle = `${color}35`;ctx.fill();ctx.stroke();ctx.font = '10px system-ui';ctx.fillStyle = color;ctx.fillText(`${object.action || 'move'}${object.targetGroup ? ` · G${object.targetGroup}` : ''}`, x + w + 4, y + h / 2);
    } else if (object.type === 'checkpoint' || object.type === 'startpos') {
      ctx.beginPath();ctx.moveTo(x + w / 2, y + h);ctx.lineTo(x + w / 2, y);ctx.lineTo(x + w, y + h / 4);ctx.lineTo(x + w / 2, y + h / 2);ctx.stroke();ctx.font = '10px system-ui';ctx.fillText(object.type === 'startpos' ? `START · ${object.mode || 'cube'}` : 'CHECKPOINT', x + w + 5, y + 12);
    } else if (object.type === 'decoration' && object.value !== 'square') {
      ctx.beginPath();if (object.value === 'circle') ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      else if (object.value === 'line') { ctx.moveTo(x, y + h / 2);ctx.lineTo(x + w, y + h / 2); }
      else { ctx.moveTo(x + w / 2, y);ctx.lineTo(x + w, y + h / 2);ctx.lineTo(x + w / 2, y + h);ctx.lineTo(x, y + h / 2);ctx.closePath(); }
      ctx.fillStyle = `${color}25`;ctx.fill();ctx.stroke();
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
    if (selectedIds.has(object.id) && !ghost) { ctx.strokeStyle = '#ffffff';ctx.setLineDash([4, 3]);ctx.strokeRect(x - 4, y - 4, w + 8, h + 8); }
    if (object.groups?.length) { ctx.font = '9px system-ui';ctx.fillStyle = '#baa4d7';ctx.fillText(`G${object.groups.join(',')}`, x, y - 5); }
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
    for (const object of [...level.objects].sort((a, b) => (a.z || 0) - (b.z || 0))) { const b = bounds(object);if (b.x + b.w >= origin - 100 && b.x <= end + 100) drawObject(object); }
    if (cursor && OBJECT_TYPES.includes(tool)) drawObject(makeObject(cursor), true);
    if (marquee) { const x = (Math.min(marquee.start.x, marquee.end.x) - origin) * zoom;const y = Math.min(marquee.start.y, marquee.end.y) * zoom;const w = Math.abs(marquee.start.x - marquee.end.x) * zoom;const h = Math.abs(marquee.start.y - marquee.end.y) * zoom;ctx.fillStyle = '#b88aff22';ctx.strokeStyle = '#b88aff';ctx.fillRect(x, y, w, h);ctx.strokeRect(x, y, w, h); }
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
    if (tool === 'slope') object = { ...object, w: 96, h: 48, value: 'up' };
    if (tool === 'saw') object = { ...object, radius: 24 };
    if (tool === 'checkpoint') object = { ...object, y: 400, w: 32, h: 80 };
    if (tool === 'trigger') object = { ...object, w: 32, h: 32, action: query('.ed-place-effect').value || 'move', duration: 0, delay: 0, easing: 'linear' };
    if (tool === 'startpos') object = { ...object, y: point.y > 408 ? 464 : round(point.y), w: 32, h: 32, mode: 'cube', speed: level.speed, mini: false, gravity: 1, dual: false };
    if (tool === 'decoration') object = { ...object, value: 'diamond' };
    if (tool === 'text') object = { ...object, w: 192, h: 40, text: 'Your message', fontSize: 24 };
    return object;
  }
  function objectAt(point) {
    return level.objects.map((object, index) => ({ object, index })).sort((a, b) => (b.object.z || 0) - (a.object.z || 0) || b.index - a.index).map(({ object }) => object).find((object) => { const b = bounds(object);const margin = object.type === 'pad' ? 12 : 6;return point.x >= b.x - margin && point.x <= b.x + b.w + margin && point.y >= b.y - margin && point.y <= b.y + b.h + margin; });
  }
  function removeSelected() {
    if (!selected) return;
    const count = selectedIds.size;history();level.objects = level.objects.filter((object) => !selectedIds.has(object.id));selectObject(null);changed();message(`${count} object${count === 1 ? '' : 's'} removed. Undo is available.`);
  }
  function mutateSelection(mutation, text) {
    if (!selectedIds.size) return;
    const next = clone(level);const objects = next.objects.filter((object) => selectedIds.has(object.id));mutation(objects, next);
    const normalized = normalizeLevel(next);history();level = normalized;selectObject(selected, null);changed();message(text, 'success');
  }
  function transformSelection(action) {
    mutateSelection((objects) => {
      const boxes = objects.map(bounds);const minX = Math.min(...boxes.map((box) => box.x));const maxX = Math.max(...boxes.map((box) => box.x + box.w));const minY = Math.min(...boxes.map((box) => box.y));const maxY = Math.max(...boxes.map((box) => box.y + box.h));
      const cx = (minX + maxX) / 2;const cy = (minY + maxY) / 2;
      for (const object of objects) {
        const b = bounds(object);const centered = ['coin', 'orb', 'saw', 'startpos'].includes(object.type);let x = b.x + b.w / 2;let y = b.y + b.h / 2;
        if (action.startsWith('rotate')) {
          const angle = (action === 'rotate-left' ? -15 : 15) * Math.PI / 180;const dx = x - cx;const dy = y - cy;x = cx + dx * Math.cos(angle) - dy * Math.sin(angle);y = cy + dx * Math.sin(angle) + dy * Math.cos(angle);object.rotation = (object.rotation || 0) + (action === 'rotate-left' ? -15 : 15);
        } else if (action === 'flip-x') { x = cx * 2 - x;object.rotation = -(object.rotation || 0);if (object.type === 'slope') object.value = object.value === 'down' ? 'up' : 'down'; }
        else { y = cy * 2 - y;object.rotation = 180 - (object.rotation || 0); }
        object.x = x - (centered ? 0 : b.w / 2);object.y = y - (centered ? 0 : b.h / 2);
      }
    }, 'Selection transformed. Undo is available.');
  }
  function applyInspector() {
    const lead = level.objects.find((object) => object.id === selected);if (!lead) return;
    const values = readProperties();const dx = Number(query('[data-object="x"]').value) - lead.x;const dy = Number(query('[data-object="y"]').value) - lead.y;
    mutateSelection((objects) => {
      for (const object of objects) {
        object.x += dx;object.y += dy;
        for (const field of ['w', 'h']) { const value = Number(query(`[data-object="${field}"]`).value);if (objects.length === 1 || value !== lead[field]) object[field] = value; }
        if (objects.length === 1 && !query('.ed-effect-label').hidden) object.value = query('[data-object="value"]').value;
        for (const [field, value] of Object.entries(values)) {
          if (objects.length > 1 && JSON.stringify(value) === JSON.stringify(propertyDefaults[field])) continue;
          if (value === undefined || value === '' && !['text', 'groups'].includes(field)) delete object[field];else object[field] = value;
        }
      }
    }, selectedIds.size > 1 ? 'Selection properties updated.' : 'Object updated.');
  }
  function updatePlacementEffects() {
    const select = query('.ed-place-effect');
    select.replaceChildren();
    const values = tool === 'portal' ? PORTAL_VALUES : tool === 'trigger' ? TRIGGER_ACTIONS : ['orb', 'pad'].includes(tool) ? EFFECTS : [];
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
      else if (action === 'apply-object') applyInspector();
      else if (action === 'duplicate') {
        const source = level.objects.filter((object) => selectedIds.has(object.id));if (level.objects.length + source.length > 5000) throw new Error('A level can contain at most 5,000 objects.');
        const ids = new Map(source.map((object, index) => [object.id, `${level.id}-copy-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 5)}`]));
        const copies = source.map((object) => ({ ...clone(object), id: ids.get(object.id), x: object.x + 48, ...(object.targetId && ids.has(object.targetId) ? { targetId: ids.get(object.targetId) } : {}) }));
        const next = normalizeLevel({ ...level, objects: [...level.objects, ...copies] });history();level = next;selectedIds = new Set(copies.map((object) => object.id));selectObject(copies.at(-1)?.id || null, null);changed();message(`${copies.length} objects duplicated.`, 'success');
      }
      else if (['rotate-left', 'rotate-right', 'flip-x', 'flip-y'].includes(action)) transformSelection(action);
      else if (action === 'import') query('.ed-file').click();
      else if (action === 'export') {
        const exported = normalizeLevel(level);
        if (options.onExport) await options.onExport(clone(exported));
        else { const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, level: exported }, null, 2)], { type: 'application/json' }));const link = document.createElement('a');link.href = url;link.download = `${exported.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'level'}.json`;link.click();setTimeout(() => URL.revokeObjectURL(url), 1000); }
        message('JSON export ready. It includes all objects and course settings.', 'success');
      }
      else if (action === 'save' || action === 'play' || action === 'test-here') {
        if (busy) return;if (action === 'test-here') applyInspector();const normalized = normalizeLevel(level);busy = true;button.disabled = true;
        try {
          if (action === 'save') {
            if (options.onSave) await options.onSave(clone(normalized));
            else { const existing = JSON.parse(localStorage.getItem('gd-workshop-levels') || '[]');const filtered = Array.isArray(existing) ? existing.filter((entry) => entry.id !== normalized.id) : [];localStorage.setItem('gd-workshop-levels', JSON.stringify([...filtered, normalized])); }
            level = normalized;savedJSON = JSON.stringify(level);knownLevels = knownLevels.filter((entry) => entry.id !== level.id);knownLevels.push(clone(level));populateLevels();changed();message('Level saved on this device. Test it whenever you’re ready.', 'success');
          } else { if (!options.onPlay) throw new Error('Test mode is unavailable in this view.');await options.onPlay(clone(normalized), { testMode: true, ...(action === 'test-here' ? { startPositionId: selected } : {}) });message('Test run launched. Your draft remains in the workshop.', 'success'); }
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
    } else if (event.target.matches('[data-property="action"],[data-object="value"]')) {
      try { const object = level.objects.find((entry) => entry.id === selected);if (object) properties({ ...object, ...readProperties(), ...(event.target.dataset.object === 'value' ? { value: event.target.value } : { action: event.target.value }) }); }
      catch (error) { message(error.message, 'error'); }
    } else if (event.target.matches('.ed-place-effect,.ed-snap')) render();
  });
  on(canvas, 'pointermove', (event) => {
    cursor = pointer(event);
    if (marquee) {
      marquee.end = cursor;const minX = Math.min(marquee.start.x, cursor.x);const maxX = Math.max(marquee.start.x, cursor.x);const minY = Math.min(marquee.start.y, cursor.y);const maxY = Math.max(marquee.start.y, cursor.y);
      selectedIds = new Set(marquee.base);for (const object of level.objects) { const b = bounds(object);if (b.x < maxX && b.x + b.w > minX && b.y < maxY && b.y + b.h > minY) selectedIds.add(object.id); }selected = [...selectedIds].at(-1) || null;
    }
    query('.ed-cursor').textContent = `X ${Math.round(cursor.x)} · Y ${Math.round(cursor.y)} · ${marquee ? `${selectedIds.size} selected` : tool === 'select' ? 'Select an object' : tool === 'erase' ? 'Erase an object' : `Place ${TYPES[tool].toLowerCase()}`}`;render();
  });
  on(canvas, 'pointerleave', () => { cursor = null;render(); });
  on(canvas, 'pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();canvas.focus({ preventScroll: true });const point = pointer(event);const hit = objectAt(point);
    if (tool === 'select') {
      if (hit) selectObject(hit.id, event.shiftKey);
      else { if (!event.shiftKey) selectObject(null);marquee = { start: point, end: point, base: new Set(event.shiftKey ? selectedIds : []) };canvas.setPointerCapture(event.pointerId);render(); }
      return;
    }
    if (tool === 'erase') { if (hit) { selectObject(hit.id);removeSelected(); }return; }
    const object = { ...makeObject(point), id: `${level.id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}` };
    if (level.objects.length >= 5000) { message('The 5,000 object limit has been reached.', 'error');return; }
    history();level.objects.push(object);level.objects.sort((a, b) => a.x - b.x);selectObject(object.id);changed();message(`${TYPES[tool]} placed. Select it to adjust its position or size.`);
  });
  on(canvas, 'pointerup', (event) => { if (!marquee) return;marquee = null;canvas.releasePointerCapture(event.pointerId);selectObject(selected, null);render(); });
  on(canvas, 'pointercancel', () => { marquee = null;render(); });
  on(viewport, 'scroll', render);
  on(root, 'keydown', (event) => {
    const typing = event.target.matches('input,select,textarea');
    if (typing) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault();query(`[data-action="${event.shiftKey ? 'redo' : 'undo'}"]`).click(); }
    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault();query('[data-action="redo"]').click(); }
    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') { event.preventDefault();if (selectedIds.size) query('[data-action="duplicate"]').click(); }
    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') { event.preventDefault();selectedIds = new Set(level.objects.map((object) => object.id));selectObject([...selectedIds].at(-1) || null, null); }
    else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) && selectedIds.size) {
      event.preventDefault();const amount = query('.ed-snap').checked ? 48 : event.shiftKey ? 10 : 1;
      try { mutateSelection((objects) => { for (const object of objects) { if (event.key === 'ArrowLeft') object.x -= amount;if (event.key === 'ArrowRight') object.x += amount;if (event.key === 'ArrowUp') object.y -= amount;if (event.key === 'ArrowDown') object.y += amount; } }, 'Selection moved.'); }
      catch (error) { message(error.message, 'error'); }
    }
    else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault();removeSelected(); }
  });
  on(query('.ed-file'), 'change', async (event) => {
    const file = event.target.files?.[0];event.target.value = '';if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('Choose a JSON file smaller than 2 MB.');
      const imported = remapLevelIds(normalizeLevel(JSON.parse(await file.text())), createLevel().id);
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
