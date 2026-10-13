"""Functional smoke checks using installed Playwright/Chromium; no files are downloaded.
Start the app, then run: python3 tests/browser_smoke.py
GAME_TEST_URL can point at a different local port. Browser profiles are isolated.
"""
import json
import os
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

base = os.environ.get('GAME_TEST_URL', 'http://127.0.0.1:3000')
checks = []
errors = []
def check_animation_bounds(page):
    # Seek to the runner's rightmost position instead of missing this once-per-loop bug.
    assert page.evaluate("""() => {
      const animation=document.querySelector('.menu-runner').getAnimations()[0];
      if(animation){animation.pause();animation.currentTime=animation.effect.getTiming().duration-1;}
      return document.documentElement.scrollWidth<=innerWidth;
    }""")

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width':1440,'height':1000}, accept_downloads=False)
    context.route('**/*', lambda route: route.continue_() if urlparse(route.request.url).hostname in {'localhost','127.0.0.1'} else route.abort())
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(base, wait_until='networkidle')
    expect(page.locator('#home-screen')).to_be_visible()
    expect(page.locator('.main-menu-buttons .menu-button')).to_have_count(3)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    check_animation_bounds(page)
    checks.append('round main menu loads without external assets')

    page.locator('[data-nav="levels"]').first.click()
    expect(page.locator('#campaign-view')).to_be_visible()
    expect(page.locator('.campaign-title')).to_have_text('First Light')
    expect(page.locator('.campaign-progress')).to_have_count(2)
    page.locator('#campaign-next').click()
    expect(page.locator('.campaign-title')).to_have_text('Pulse Route')
    page.keyboard.press('ArrowLeft')
    expect(page.locator('.campaign-title')).to_have_text('First Light')
    page.locator('[data-view="catalog"]').focus()
    page.keyboard.press('Enter')
    expect(page.locator('#game-screen')).not_to_be_visible()
    expect(page.locator('#level-grid .level-card')).to_have_count(17)
    page.locator('[data-mode="platformer"]').click()
    expect(page.locator('#level-grid .level-card')).to_have_count(3)
    page.locator('[data-mode="classic"]').click()
    expect(page.locator('#level-grid .level-card')).to_have_count(14)
    page.locator('[data-mode="all"]').click()
    page.locator('#level-search').fill('Night Circuit')
    expect(page.locator('#level-grid .level-card')).to_have_count(1)
    page.locator('#level-search').fill('')
    checks.append('campaign paging, both progress bars, and campaign/lab catalog filters')

    page.locator('[data-nav="icons"]').first.click()
    page.locator('[data-icon="5"]').click()
    page.locator('[data-color="#ff638b"][data-channel="primary"]').click()
    page.reload(wait_until='networkidle')
    page.locator('[data-nav="icons"]').first.click()
    expect(page.locator('[data-icon="5"]')).to_have_attribute('aria-pressed','true')
    expect(page.locator('[data-color="#ff638b"][data-channel="primary"]')).to_have_attribute('aria-pressed','true')
    page.locator('[data-icon="12"]').click()
    expect(page.locator('#shop-screen')).to_be_visible()
    expect(page.locator('.shop-item')).to_have_count(20)
    page.locator('[data-buy="icon-12"]').click()
    expect(page.locator('[data-buy="icon-12"]')).not_to_be_disabled()
    checks.append('cosmetics persist and locked icons lead to the local shop')

    page.locator('[data-nav="editor"]').first.click()
    expect(page.locator('.ed-palette [data-tool]')).to_have_count(13)
    page.locator('.gd-editor [name="name"]').fill('Browser Test')
    page.locator('.gd-editor [name="length"]').fill('1000')
    page.locator('.gd-editor [name="speed"]').fill('650')
    page.locator('.gd-editor [name="speed"]').blur()
    page.locator('.gd-editor [data-tool="coin"]').click()
    page.locator('.ed-canvas').click(position={'x':252,'y':348})
    expect(page.locator('.ed-count')).to_contain_text('1 object')
    page.locator('.gd-editor [data-action="undo"]').click()
    expect(page.locator('.ed-count')).to_contain_text('0 objects')
    page.locator('.gd-editor [data-action="redo"]').click()
    expect(page.locator('.ed-count')).to_contain_text('1 object')
    page.locator('.gd-editor [data-action="save"]').click()
    expect(page.locator('.ed-status')).to_contain_text('saved')
    before = page.evaluate("JSON.parse(localStorage.getItem('geometry-dash-offline-profile-v1'))")
    local_id = next(level['id'] for level in before['customLevels'] if level['name']=='Browser Test')
    page.locator('.gd-editor [data-action="play"]').click()
    expect(page.locator('#game-screen')).to_be_visible()
    expect(page.locator('#game-dialog-title')).to_have_text('Test complete!',timeout=10000)
    expect(page.locator('#game-progress')).to_have_text('100%')
    page.locator('#game-menu').click()
    expect(page.locator('#editor-screen')).to_be_visible()
    expect(page.locator('.gd-editor [name="name"]')).to_have_value('Browser Test')
    after = page.evaluate("JSON.parse(localStorage.getItem('geometry-dash-offline-profile-v1'))")
    assert local_id not in after['progress']
    assert after['stats'] == before['stats']
    assert after['economy'] == before['economy']
    checks.append('editor save, undo/redo, genuine completion and test-mode reward exclusion')

    page.locator('[data-nav="levels"]').first.click()
    page.locator('[data-view="catalog"]').click()
    expect(page.locator('#level-grid .level-card')).to_have_count(18)
    page.locator('#level-grid [data-play="first-light"]').click()
    expect(page.locator('#game-attempt')).to_have_text('ATTEMPT 2',timeout=8000)
    page.locator('#game-pause').click()
    expect(page.locator('#game-dialog')).to_be_visible()
    paused = page.locator('#game-progress').inner_text()
    page.wait_for_timeout(300)
    assert page.locator('#game-progress').inner_text()==paused
    page.locator('#game-settings').click()
    expect(page.locator('#settings-dialog')).to_be_visible()
    page.keyboard.press('Escape')
    expect(page.locator('#settings-dialog')).not_to_be_visible()
    expect(page.locator('#game-screen')).to_be_visible()
    page.locator('#game-resume').click()
    page.locator('#game-practice').click()
    expect(page.locator('#game-practice-label')).to_be_visible()
    page.keyboard.press('c')
    page.keyboard.press('x')
    page.locator('#game-back').click()
    profile = page.evaluate("JSON.parse(localStorage.getItem('geometry-dash-offline-profile-v1'))")
    assert not profile['progress']['first-light']['completed']
    assert profile['stats']['totalAttempts']>=3
    checks.append('hazard retry, pause, modal keyboard safety, practice and partial progress')

    # A synthetic first-clear fixture exercises the real shop UI in an isolated profile.
    page.evaluate("""async () => {
      const {Store}=await import('./src/store.js');
      const {LEVELS}=await import('./src/levels.js');
      const profile=new Store();
      profile.recordRun(LEVELS[0],{completed:true,progress:100,coins:['fixture-coin'],attempts:1,time:15});
    }""")
    page.reload(wait_until='networkidle')
    page.locator('[data-nav="shop"]').first.click()
    page.locator('[data-buy="icon-12"]').click()
    expect(page.locator('[data-buy="icon-12"]')).to_be_disabled()
    purchased = page.evaluate("JSON.parse(localStorage.getItem('geometry-dash-offline-profile-v1'))")
    assert 12 in purchased['inventory']['icons']
    assert purchased['economy']['orbs']==0
    page.locator('[data-nav="icons"]').first.click()
    page.locator('[data-icon="12"]').click()
    page.reload(wait_until='networkidle')
    page.locator('[data-nav="icons"]').first.click()
    expect(page.locator('[data-icon="12"]')).to_have_attribute('aria-pressed','true')
    checks.append('earned-currency purchase, balance deduction and equipped unlock persistence')

    page.locator('#settings-open').click()
    page.locator('#music-toggle').uncheck()
    page.locator('#volume-slider').evaluate("el => el.value='0.25'")
    page.locator('#volume-slider').dispatch_event('change')
    page.locator('#settings-close').click()
    page.reload(wait_until='networkidle')
    page.locator('#settings-open').click()
    expect(page.locator('#music-toggle')).not_to_be_checked()
    expect(page.locator('#volume-slider')).to_have_value('0.25')
    page.locator('#settings-close').click()
    checks.append('audio settings persist')

    # Capture the export in memory instead of downloading a physical file.
    page.evaluate("""() => {
      const originalURL=URL.createObjectURL.bind(URL), blobs=new Map();
      const originalClick=HTMLAnchorElement.prototype.click;
      URL.createObjectURL=blob=>{const url=originalURL(blob);blobs.set(url,blob);return url;};
      HTMLAnchorElement.prototype.click=function(){
        if(this.download&&blobs.has(this.href)){
          const filename=this.download;
          blobs.get(this.href).text().then(text=>window.__saveExport={filename,text});return;
        }
        originalClick.call(this);
      };
    }""")
    page.locator('[data-nav="stats"]').first.click()
    page.locator('#save-export').click()
    page.wait_for_function('!!window.__saveExport')
    exported = page.evaluate('window.__saveExport')
    assert exported['filename']=='geometry-dash-save.json'
    assert json.loads(exported['text'])['version']==2
    with page.expect_file_chooser() as chooser:
        page.locator('#save-import').click()
    page.once('dialog',lambda dialog:dialog.accept())
    chooser.value.set_files({'name':'save.json','mimeType':'application/json','buffer':exported['text'].encode()})
    expect(page.locator('#toast')).to_have_text('Save imported.')
    imported = page.evaluate("JSON.parse(localStorage.getItem('geometry-dash-offline-profile-v1'))")
    assert imported['economy']==json.loads(exported['text'])['economy']
    assert imported['customLevels'][0]['id']==local_id
    checks.append('save export captured in memory and file-import interface restores v2 profile')

    page.evaluate('navigator.serviceWorker.ready')
    page.wait_for_function('!!navigator.serviceWorker.controller')
    context.set_offline(True)
    page.reload(wait_until='networkidle')
    expect(page.locator('#home-screen')).to_be_visible()
    page.locator('[data-nav="levels"]').first.click()
    page.locator('[data-view="catalog"]').click()
    expect(page.locator('#level-grid .level-card')).to_have_count(18)
    page.locator('#level-grid [data-play="first-light"]').click()
    expect(page.locator('#game-screen')).to_be_visible()
    page.locator('#game-back').click()
    context.set_offline(False)
    checks.append('offline reload includes expanded runtime, icons and playable game')

    for width,height in [(390,844),(844,390),(320,740),(568,320)]:
        mobile=browser.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True,accept_downloads=False)
        mobile.route('**/*',lambda route:route.continue_() if urlparse(route.request.url).hostname in {'localhost','127.0.0.1'} else route.abort())
        mp=mobile.new_page()
        mp.on('pageerror',lambda error:errors.append(str(error)))
        mp.goto(base,wait_until='networkidle')
        assert mp.evaluate('document.documentElement.scrollWidth <= innerWidth')
        check_animation_bounds(mp)
        mp.locator('[data-nav="levels"]').first.click()
        mp.locator('[data-view="catalog"]').click()
        mp.locator('#level-grid [data-play="little-summit"]').click()
        expect(mp.locator('#touch-right')).to_be_visible()
        canvas=mp.locator('#game-canvas').bounding_box()
        assert abs(canvas['width']/canvas['height']-1.6)<0.001
        rect=mp.locator('#touch-right').bounding_box()
        x,y=rect['x']+rect['width']/2,rect['y']+rect['height']/2
        cdp=mobile.new_cdp_session(mp)
        cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':1}]})
        mp.wait_for_timeout(500)
        cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        assert int(mp.locator('#game-progress').inner_text().rstrip('%'))>3
        mp.locator('#game-pause').click()
        mp.locator('#game-dialog').evaluate('el=>el.scrollTop=0')
        expect(mp.locator('#game-dialog-title')).to_be_in_viewport()
        mp.locator('#game-resume').scroll_into_view_if_needed()
        expect(mp.locator('#game-resume')).to_be_in_viewport()
        mp.locator('#game-menu').click()
        mobile.close()
    checks.append('320px, portrait and short-landscape touch gameplay, animation bounds and scrollable pause actions')
    assert not errors,errors
    browser.close()
print(json.dumps({'passed':checks,'browser_errors':errors,'file_downloads':0},indent=2))
