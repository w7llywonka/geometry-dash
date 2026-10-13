import { GameEngine } from './engine.js';
import { LEVELS, normalizeLevel } from './levels.js';
import { mountEditor } from './editor.js';
import { Store } from './store.js';
import { AudioManager } from './audio.js';

const $ = id => document.getElementById(id);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store = new Store();
const audio = new AudioManager();
audio.setSettings(store.data.settings);
let engine = null;
let activeLevel = null;
let lastUpdate = null;
let savedRun = false;
let currentScreen = 'home';
let returnScreen = 'levels';
let editor = null;
let modeFilter = 'all';
let toastTimer;

function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3500);
}
function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], {type:'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function progress(level) { return store.getProgress(level.id) || {}; }
function allLevels() { return [...LEVELS, ...store.data.customLevels]; }
function difficultyIcon(difficulty) { return ({Easy:'◉',Normal:'◉',Hard:'◆',Harder:'◆',Insane:'✦',Demon:'✹'})[difficulty] || '◇'; }
function stars(level) { return level.platformer ? 0 : ({Easy:2,Normal:3,Hard:5,Harder:7,Insane:9,Demon:10})[level.difficulty] || 2; }
function levelCard(level, index) {
  const p = progress(level);
  const best = Math.min(100, Math.floor(p.best || 0));
  return `<article class="level-card" style="--level-color:${escapeHTML(level.color)}">
    <div class="level-art"><span class="level-index">${String(index+1).padStart(2,'0')}</span><span class="difficulty-orb">${difficultyIcon(level.difficulty)}</span><span class="level-type badge">${level.platformer?'PLATFORMER':level.custom?'LOCAL LEVEL':'CLASSIC'}</span></div>
    <div class="level-card-top"><span class="difficulty ${level.difficulty.toLowerCase()}">${escapeHTML(level.difficulty)}</span><span class="level-stars">${level.custom?'LOCAL':`${stars(level)} ★`}</span></div>
    <h3 class="level-card-title">${escapeHTML(level.name)}</h3><p class="level-card-meta">${escapeHTML(level.subtitle || 'Your own creation')} · ${level.bpm} BPM</p>
    <div class="level-progress-label"><span>${p.completed?'COMPLETE':'NORMAL MODE'}</span><strong>${best}%</strong></div><div class="level-card-progress"><span style="width:${best}%"></span></div>
    <div class="level-card-footer"><span class="coin-row" aria-label="${p.coins||0} of 3 coins">${[0,1,2].map(i=>`<span class="${i<(p.coins||0)?'collected':''}">◆</span>`).join('')}</span><button class="btn btn-small btn-primary" data-play="${escapeHTML(level.id)}">${p.completed?'Replay':'Play'} <span aria-hidden="true">↗</span></button></div>
    ${level.custom?`<button class="level-edit-link" data-edit="${escapeHTML(level.id)}">Edit level</button>`:''}
  </article>`;
}
function renderHome() {
  const summary = store.getSummary();
  $('total-stars').textContent = summary.stars || 0;
  $('total-coins').textContent = summary.coins || 0;
  $('total-complete').textContent = `${summary.completed || 0}/${LEVELS.length}`;
  const featured = LEVELS.find(l => !progress(l).completed) || LEVELS[0];
  $('quick-play').dataset.play = featured.id;
  $('quick-play').setAttribute('aria-label', `Play ${featured.name}`);
  $('home-levels').innerHTML = LEVELS.slice(0,4).map((level,index) => `<button class="home-level-row" data-play="${level.id}" style="--level-color:${level.color}"><span class="home-level-number">0${index+1}</span><span class="home-difficulty">${difficultyIcon(level.difficulty)}</span><span class="home-level-name">${level.name}<small>${level.difficulty} · ${level.bpm} BPM</small></span><span class="home-level-best">${Math.floor(progress(level).best||0)}%</span><span aria-hidden="true">↗</span></button>`).join('');
}
function renderLevels() {
  const query = $('level-search').value.trim().toLowerCase();
  const difficulty = $('difficulty-filter').value;
  const levels = allLevels().filter(l => (!query || `${l.name} ${l.subtitle}`.toLowerCase().includes(query)) && (!difficulty || difficulty === 'all' || l.difficulty === difficulty) && (modeFilter === 'all' || (modeFilter === 'platformer' ? l.platformer : !l.platformer)));
  $('level-grid').innerHTML = levels.length ? levels.map((l,i)=>levelCard(l,i)).join('') : '<div class="empty-state panel"><h3>No levels found</h3><p>Try a different search, or create a new level.</p></div>';
}
const colors = ['#b8ff65','#9b7bff','#ffb35c','#ff638b','#5ddcff','#fff275','#f7f3ff','#ed71ff','#63ffce','#ff775d'];
function iconMarkup(index, primary, secondary) {
  const eyes = index%3 === 0 ? '<rect x="22" y="24" width="14" height="16"/><rect x="54" y="24" width="14" height="16"/>' : index%3 === 1 ? '<path d="M20 24h18v17H20zm34 0h18v17H54z"/><path d="M23 27h8v7h-8zm34 0h8v7h-8z" fill="white"/>' : '<path d="m20 22 18 8-5 12-13-8zm50 0-18 8 5 12 13-8z"/>';
  const mouth = index%4===0 ? '<path d="M22 54h46v14H22z"/>' : index%4===1 ? '<path d="M22 54h12v8h22v-8h12v17H22z"/>' : index%4===2 ? '<path d="m22 65 10-14 13 14 13-14 10 14z"/>' : '<path d="M25 55h40v9H25z"/>';
  return `<svg viewBox="0 0 90 90" aria-hidden="true"><rect x="7" y="7" width="76" height="76" rx="${index<6?7:19}" fill="${primary}" stroke="${secondary}" stroke-width="5"/><g fill="#141222">${eyes}${mouth}</g></svg>`;
}
function renderCosmetics() {
  const c = store.data.cosmetics;
  $('cosmetics-root').innerHTML = `<div class="cosmetics-layout"><div class="panel cosmetic-preview"><span class="eyebrow">YOUR PLAYER</span><div class="player-preview">${iconMarkup(c.icon,c.primary,c.secondary)}</div><h2>Make your mark.</h2><p>Your style travels through every portal.</p><button class="btn btn-primary" data-play="${LEVELS[0].id}">Take it for a spin ↗</button></div><div class="cosmetic-options"><section class="panel"><h3>Choose an icon <span class="badge">12 AVAILABLE</span></h3><div class="icon-grid">${Array.from({length:12},(_,i)=>`<button class="icon-choice ${i===c.icon?'selected':''}" data-icon="${i}" aria-label="Icon ${i+1}" aria-pressed="${i===c.icon}">${iconMarkup(i,c.primary,c.secondary)}</button>`).join('')}</div></section>${['primary','secondary'].map(key=>`<section class="panel"><h3>${key==='primary'?'Primary':'Secondary'} color</h3><div class="color-grid">${colors.map(color=>`<button class="color-choice ${c[key]===color?'selected':''}" style="--swatch:${color}" data-color="${color}" data-channel="${key}" aria-label="${key} ${color}" aria-pressed="${c[key]===color}"></button>`).join('')}</div></section>`).join('')}<section class="panel"><h3>Trail</h3><div class="trail-options">${['spark','line','none'].map(trail=>`<button class="btn ${c.trail===trail?'btn-primary':'btn-secondary'}" data-trail="${trail}">${trail[0].toUpperCase()+trail.slice(1)}</button>`).join('')}</div></section></div></div>`;
}
function renderStats() {
  const s = store.getSummary();
  const achievements = store.getAchievements();
  const stats = [['★','Stars',s.stars],['◆','Secret coins',s.coins],['✓','Levels complete',s.completed],['↻','Attempts',s.attempts],['↑','Jumps',s.jumps],['◷','Time played',`${Math.floor((s.playTime||0)/60)} min`]];
  $('stats-root').innerHTML = `<div class="stat-grid">${stats.map(([icon,title,value])=>`<div class="stat-card panel"><span class="stat-icon">${icon}</span><strong>${value||0}</strong><span>${title}</span></div>`).join('')}</div><div class="section-heading"><h2>Achievements</h2><span>${achievements.filter(a=>a.unlocked).length} / ${achievements.length} UNLOCKED</span></div><div class="achievement-grid">${achievements.map(a=>`<div class="achievement panel ${a.unlocked?'unlocked':''}"><span class="achievement-icon">${a.unlocked?'✦':'◇'}</span><div><h3>${escapeHTML(a.title)}</h3><p>${escapeHTML(a.description)}</p></div><span class="achievement-status">${a.unlocked?'✓':'LOCKED'}</span></div>`).join('')}</div><section class="panel save-panel"><div><h3>Your progress, on this device.</h3><p>Export a backup to move your saves and local levels between browsers. Clearing browser data removes local saves.</p></div><div class="save-actions"><button class="btn btn-secondary" id="save-export">Export save</button><button class="btn btn-secondary" id="save-import">Import save</button><button class="btn btn-secondary danger" id="save-reset">Reset progress</button></div></section>`;
}
function render() { renderHome(); renderLevels(); if(currentScreen==='icons') renderCosmetics(); if(currentScreen==='stats') renderStats(); }
function navigate(screen) {
  currentScreen = screen;
  $('page-label').textContent = ({home:'Overview',levels:'Play levels',editor:'Level editor',icons:'Icon garage',stats:'Your progress'})[screen];
  document.querySelectorAll('.screen').forEach(el => { el.hidden = el.id !== `${screen}-screen`; });
  document.querySelectorAll('[data-nav]').forEach(el => { const selected = el.dataset.nav===screen; el.classList.toggle('active',selected); if(selected) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current'); });
  render();
  if(screen==='editor' && !editor) editor = mountEditor($('editor-root'), {levels:allLevels(),builtinLevels:LEVELS,onSave:level => { level=normalizeLevel(level); level.custom=true; store.saveLevel(level); render(); toast('Level saved on this device.'); },onPlay:level => startGame({...normalizeLevel(level),custom:true}),onDelete:id => {store.deleteLevel(id);render();toast('Local level deleted.');},onExport:level => download(`${level.name.replace(/[^a-z0-9]/gi,'-')}.json`, JSON.stringify({version:1,level},null,2)),onImport:level=>toast(`Imported ${level.name}. Save to keep it.`)});
  window.scrollTo({top:0,behavior:'instant'});
}
function persistRun(result = lastUpdate) {
  if (!activeLevel || !result || savedRun) return;
  const oldAchievements = new Set(store.data.achievements);
  const isComplete = result.complete === true || result.status === 'complete';
  store.recordRun(activeLevel, {...result,completed:isComplete,progress:isComplete?100:result.bestProgress||result.progress||0,coins:result.coinIds||result.coins||0,practice:result.practice||false});
  store.recordStats({attempts:result.attempts||1,jumps:result.jumps||0,deaths:result.deaths||0,playTime:result.playTime||result.time||0});
  savedRun = true;
  const unlocked = store.getAchievements().filter(a=>a.unlocked&&!oldAchievements.has(a.id));
  if(unlocked.length) toast(`Achievement unlocked: ${unlocked.map(a=>a.title).join(' · ')}`);
  render();
}
function showGameDialog(complete=false, result=lastUpdate) {
  $('game-dialog').hidden = false;
  $('game-dialog-title').textContent = complete ? (result.practice?'Practice complete!':'Level complete!') : 'Take a breath.';
  $('game-dialog-body').innerHTML = complete ? `<p>${escapeHTML(activeLevel.name)}</p><div class="result-grid"><div><strong>${result.attempts}</strong><span>ATTEMPTS</span></div><div><strong>${result.coins||0}/3</strong><span>COINS</span></div><div><strong>${Math.round(result.time||0)}s</strong><span>TIME</span></div></div><p>${result.practice?'Practice progress saved. Complete normal mode to earn stars and coins.':store.storageError?'Progress is available this session. Export a save from Stats to keep it.':'Your progress has been saved on this device.'}</p>` : `<p>${escapeHTML(activeLevel.name)} · ${Math.floor(result?.progress||0)}%</p><p>Space / click / tap to jump. Hold for flight.<br>R restarts · C places a practice checkpoint.</p><button class="btn btn-secondary" id="game-settings">Game settings</button>`;
  $('game-resume').hidden = complete;
  $('game-retry').textContent = complete?'Play again':'Restart';
  (complete?$('game-retry'):$('game-resume')).focus();
}
function updateGame(state) {
  lastUpdate = state;
  $('progress-fill').style.width = `${state.progress}%`;
  $('game-progress').textContent = `${Math.floor(state.progress)}%`;
  $('game-attempt').textContent = `ATTEMPT ${state.attempts}`;
  $('game-mode').textContent = state.mode.toUpperCase();
  $('game-practice-label').hidden = !state.practice;
  $('game-practice').classList.toggle('active',state.practice);
  $('game-practice').textContent = state.practice?'Practice: on':'Practice';
  $('game-checkpoint').hidden = !state.practice;
  if(state.status==='paused' && $('game-dialog').hidden) showGameDialog();
  else if(state.status==='playing') $('game-dialog').hidden = true;
}
function startGame(level,practice=false) {
  if(engine) { persistRun(); engine.destroy(); }
  returnScreen = currentScreen;
  activeLevel = level; savedRun = false; lastUpdate = null;
  document.querySelector('.app-shell').inert = true;
  document.querySelectorAll('.screen').forEach(el=>el.hidden=true);
  $('game-screen').hidden = false;
  $('game-dialog').hidden = true;
  $('game-level-name').textContent = level.name;
  $('touch-left').hidden = !level.platformer; $('touch-right').hidden = !level.platformer;
  audio.unlock();
  engine = new GameEngine({canvas:$('game-canvas'),audio,onUpdate:updateGame,onFinish:result => {persistRun(result);showGameDialog(true,result);},onExit:leaveGame});
  engine.start(level,{practice,platformer:!!level.platformer,cosmetics:store.data.cosmetics,settings:{...store.data.settings,externalHud:true}});
  $('game-canvas').focus();
}
function leaveGame() {
  persistRun(); engine?.destroy(); engine=null; audio.stopMusic();
  $('game-screen').hidden=true; $('game-dialog').hidden=true;
  document.querySelector('.app-shell').inert = false;
  navigate(returnScreen);
}
function restartGame() { const practice=lastUpdate?.practice||false; const level=activeLevel; persistRun(); engine?.destroy();engine=null;startGame(level,practice); }

document.addEventListener('click', event => {
  const button = event.target.closest('button'); if(!button) return;
  if(button.dataset.nav) navigate(button.dataset.nav);
  if(button.dataset.play) { const level=allLevels().find(l=>l.id===button.dataset.play); if(level) startGame(level); }
  if(button.dataset.edit) {const level=store.data.customLevels.find(l=>l.id===button.dataset.edit);navigate('editor');editor.load(level);}
  if(button.dataset.mode) {modeFilter=button.dataset.mode;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b===button));renderLevels();}
  if(button.dataset.icon) {store.updateCosmetics({icon:Number(button.dataset.icon)});renderCosmetics();}
  if(button.dataset.color) {store.updateCosmetics({[button.dataset.channel]:button.dataset.color});renderCosmetics();}
  if(button.dataset.trail) {store.updateCosmetics({trail:button.dataset.trail});renderCosmetics();}
  if(button.id==='game-settings') openSettings();
  if(button.id==='save-export') download('geometry-dash-save.json',store.exportData());
  if(button.id==='save-import') {const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{try{const file=input.files[0];if(!file)return;if(file.size>5000000)throw new Error('Save file is too large.');const text=await file.text();if(!window.confirm('Replace this device’s progress and local levels with the selected save? Export a backup first.'))return;store.importData(text);audio.setSettings(store.data.settings);editor?.destroy();editor=null;render();toast('Save imported.');}catch(error){toast(`Could not import: ${error.message}`);}};input.click();}
  if(button.id==='save-reset' && window.confirm('Reset all progress, achievements, cosmetics, and local levels on this device? Export a backup first.')) {store.reset();editor?.destroy();editor=null;audio.setSettings(store.data.settings);render();toast('Local progress reset.');}
});
$('level-search').addEventListener('input',renderLevels);$('difficulty-filter').addEventListener('change',renderLevels);
$('game-back').onclick=leaveGame;$('game-menu').onclick=leaveGame;$('game-restart').onclick=restartGame;$('game-retry').onclick=restartGame;
$('game-pause').onclick=()=>lastUpdate?.status==='paused'?engine.resume():engine.pause();
$('game-resume').onclick=()=>engine.resume();
$('game-practice').onclick=()=>{const level=activeLevel;const practice=!lastUpdate?.practice;persistRun();engine.destroy();engine=null;startGame(level,practice);toast(practice?'Practice mode: checkpoints are enabled.':'Normal mode restarted from the beginning.');};
$('game-checkpoint').onclick=()=>{toast(engine.checkpoint()?'Checkpoint placed.':'Resume practice mode to place a checkpoint.');};
for(const [id,action] of [['touch-left','left'],['touch-right','right'],['touch-jump','held']]) {
  const element=$(id);
  element.addEventListener('pointerdown',event=>{event.preventDefault();element.setPointerCapture(event.pointerId);if(!engine)return;if(action==='held')engine.press();else engine.input[action]=true;});
  for(const type of ['pointerup','pointercancel','lostpointercapture']) element.addEventListener(type,()=>{if(!engine)return;if(action==='held')engine.release();else engine.input[action]=false;});
}
function openSettings() {
  if(lastUpdate?.status==='playing')engine?.pause();
  const s=store.data.settings;
  $('music-toggle').checked=s.music;$('sfx-toggle').checked=s.sfx;$('autocheckpoint-toggle').checked=s.autoCheckpoint;$('motion-toggle').checked=s.reducedMotion;$('volume-slider').value=s.volume;
  $('settings-dialog').showModal();
}
$('settings-open').onclick=openSettings;$('settings-close').onclick=()=>$('settings-dialog').close();
$('settings-dialog').addEventListener('change',()=>{store.updateSettings({music:$('music-toggle').checked,sfx:$('sfx-toggle').checked,autoCheckpoint:$('autocheckpoint-toggle').checked,reducedMotion:$('motion-toggle').checked,volume:Number($('volume-slider').value)});audio.setSettings(store.data.settings);if(engine)engine.settings={...engine.settings,...store.data.settings};document.body.classList.toggle('reduce-motion',store.data.settings.reducedMotion);});
$('help-open').onclick=()=>$('help-dialog').showModal();$('help-close').onclick=()=>$('help-dialog').close();
document.addEventListener('visibilitychange',()=>{if(document.hidden && lastUpdate?.status==='playing')engine?.pause();});
document.addEventListener('keydown',event=>{if(engine && lastUpdate?.status==='complete' && event.code==='KeyR'){event.preventDefault();event.stopPropagation();restartGame();}},true);
document.addEventListener('keydown',event=>{if(event.key!=='Tab'||$('game-dialog').hidden||document.querySelector('dialog[open]'))return;const buttons=[...$('game-dialog').querySelectorAll('button')].filter(b=>!b.hidden);const first=buttons[0],last=buttons.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}},true);
window.addEventListener('beforeunload',()=>persistRun());
document.body.classList.toggle('reduce-motion',store.data.settings.reducedMotion);
navigate('home');
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
