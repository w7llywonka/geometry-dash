"""Functional browser checks. Requires Python Playwright and system Chromium.
Run against `npm start`: python3 tests/browser_smoke.py
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

base = os.environ.get('GAME_TEST_URL', 'http://127.0.0.1:3000')
out = Path('test-results')
out.mkdir(exist_ok=True)
checks = []

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, device_scale_factor=1)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(base, wait_until='networkidle')
    expect(page.locator('#home-screen')).to_be_visible()
    checks.append('dashboard loads')
    page.screenshot(path=str(out / 'home.png'), full_page=True)

    page.locator('[data-nav="levels"]').first.click()
    expect(page.locator('#level-grid .level-card')).to_have_count(14)
    page.locator('[data-mode="platformer"]').click()
    expect(page.locator('#level-grid .level-card')).to_have_count(2)
    page.locator('[data-mode="classic"]').click()
    expect(page.locator('#level-grid .level-card')).to_have_count(12)
    page.locator('[data-mode="all"]').click()
    page.locator('#level-search').fill('Night Circuit')
    expect(page.locator('#level-grid .level-card')).to_have_count(1)
    page.locator('#level-search').fill('')
    checks.append('catalog filters original 14 courses')

    page.locator('[data-nav="icons"]').first.click()
    page.locator('[data-icon="5"]').click()
    page.locator('[data-color="#ff638b"][data-channel="primary"]').click()
    page.reload(wait_until='networkidle')
    page.locator('[data-nav="icons"]').first.click()
    expect(page.locator('[data-icon="5"]')).to_have_attribute('aria-pressed', 'true')
    expect(page.locator('[data-color="#ff638b"][data-channel="primary"]')).to_have_attribute('aria-pressed', 'true')
    checks.append('cosmetic preferences survive reload')

    page.locator('[data-nav="editor"]').first.click()
    page.locator('.gd-editor [name="name"]').fill('Browser Test')
    page.locator('.gd-editor [name="length"]').fill('1000')
    page.locator('.gd-editor [name="speed"]').fill('650')
    page.locator('.gd-editor [name="speed"]').blur()
    page.locator('.gd-editor [data-tool="coin"]').click()
    canvas = page.locator('.ed-canvas')
    canvas.click(position={'x':252,'y':348})
    expect(page.locator('.ed-count')).to_contain_text('1 object')
    page.locator('.gd-editor [data-action="undo"]').click()
    expect(page.locator('.ed-count')).to_contain_text('0 objects')
    page.locator('.gd-editor [data-action="redo"]').click()
    expect(page.locator('.ed-count')).to_contain_text('1 object')
    page.locator('.gd-editor [data-action="save"]').click()
    expect(page.locator('.ed-status')).to_contain_text('saved')
    page.screenshot(path=str(out / 'editor.png'), full_page=True)
    page.locator('.gd-editor [data-action="play"]').click()
    expect(page.locator('#game-screen')).to_be_visible()
    expect(page.locator('#game-dialog-title')).to_have_text('Level complete!', timeout=10000)
    expect(page.locator('#game-progress')).to_have_text('100%')
    page.screenshot(path=str(out / 'complete.png'))
    page.locator('#game-menu').click()
    expect(page.locator('#editor-screen')).to_be_visible()
    expect(page.locator('.gd-editor [name="name"]')).to_have_value('Browser Test')
    checks.append('editor placement, undo/redo, save, test completion and draft return')

    page.locator('[data-nav="levels"]').first.click()
    expect(page.locator('#level-grid .level-card')).to_have_count(15)
    page.locator('#level-grid [data-play="first-light"]').click()
    expect(page.locator('#game-screen')).to_be_visible()
    expect(page.locator('#game-attempt')).to_have_text('ATTEMPT 2', timeout=8000)
    page.locator('#game-pause').click()
    expect(page.locator('#game-dialog')).to_be_visible()
    paused = page.locator('#game-progress').inner_text()
    page.wait_for_timeout(400)
    assert page.locator('#game-progress').inner_text() == paused
    page.locator('#game-resume').click()
    expect(page.locator('#game-dialog')).to_be_hidden()
    page.locator('#game-practice').click()
    expect(page.locator('#game-practice-label')).to_be_visible()
    page.keyboard.press('c')
    page.keyboard.press('x')
    page.screenshot(path=str(out / 'gameplay.png'))
    page.locator('#game-back').click()
    profile = page.evaluate("JSON.parse(localStorage.getItem('geometry-dash-offline-profile-v1'))")
    assert not profile['progress']['first-light']['completed']
    assert profile['stats']['totalAttempts'] >= 4
    checks.append('hazard death/retry, pause freezes simulation, practice checkpoints and partial save')

    page.locator('#settings-open').click()
    page.locator('#music-toggle').uncheck()
    page.locator('#volume-slider').evaluate("el => el.value = '0.25'")
    page.locator('#volume-slider').dispatch_event('change')
    page.locator('#settings-close').click()
    page.reload(wait_until='networkidle')
    page.locator('#settings-open').click()
    expect(page.locator('#music-toggle')).not_to_be_checked()
    expect(page.locator('#volume-slider')).to_have_value('0.25')
    page.locator('#settings-close').click()
    checks.append('audio settings persist')

    page.locator('[data-nav="stats"]').first.click()
    with page.expect_download() as transfer:
        page.locator('#save-export').click()
    save_file = out / 'browser-save.json'
    transfer.value.save_as(str(save_file))
    before = page.evaluate("JSON.parse(localStorage.getItem('geometry-dash-offline-profile-v1')).stats")
    with page.expect_file_chooser() as chooser:
        page.locator('#save-import').click()
    page.once('dialog', lambda dialog: dialog.accept())
    chooser.value.set_files(str(save_file))
    expect(page.locator('#toast')).to_have_text('Save imported.')
    after = page.evaluate("JSON.parse(localStorage.getItem('geometry-dash-offline-profile-v1')).stats")
    assert after == before
    checks.append('save backup downloads and imports through interface')

    page.evaluate('navigator.serviceWorker.ready')
    page.wait_for_function('!!navigator.serviceWorker.controller')
    context.set_offline(True)
    page.reload(wait_until='networkidle')
    expect(page.locator('#home-screen')).to_be_visible()
    page.locator('[data-nav="levels"]').first.click()
    expect(page.locator('#level-grid .level-card')).to_have_count(15)
    context.set_offline(False)
    checks.append('cached application reloads with network disabled')
    assert not errors, errors

    mobile = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    mp = mobile.new_page()
    mp.on('pageerror', lambda error: errors.append(str(error)))
    mp.goto(base, wait_until='networkidle')
    assert mp.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Mobile page overflows horizontally'
    mp.screenshot(path=str(out / 'mobile.png'), full_page=True)
    mp.locator('[data-nav="levels"]').first.click()
    mp.locator('[data-play="little-summit"]').click()
    expect(mp.locator('#touch-right')).to_be_visible()
    expect(mp.locator('#touch-left')).to_be_visible()
    rect = mp.locator('#touch-right').bounding_box()
    mp.mouse.move(rect['x'] + rect['width']/2, rect['y'] + rect['height']/2)
    mp.mouse.down()
    mp.wait_for_timeout(600)
    mp.mouse.up()
    assert int(mp.locator('#game-progress').inner_text().rstrip('%')) > 3
    mp.locator('#game-back').click()
    checks.append('mobile layout and platformer touch movement')
    assert not errors, errors
    browser.close()

print(json.dumps({'passed': checks, 'browser_errors': errors, 'screenshots': str(out.resolve())}, indent=2))
