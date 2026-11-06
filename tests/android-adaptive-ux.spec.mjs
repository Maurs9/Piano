import { test, expect } from './fixtures.mjs';

test.describe('Android UX, Adaptive and Navigation-Event verification', () => {

  test('Viewport meta contains interactive-widget=resizes-content for Android edge-to-edge IME', async ({ app }) => {
    const page = await app.open();
    const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewportMeta).toContain('viewport-fit=cover');
    expect(viewportMeta).toContain('interactive-widget=resizes-content');
  });

  test('Navigation-event: Android back gesture closes Settings drawer without navigating away', async ({ app }) => {
    const page = await app.open();
    await expect(page.locator('#view-today')).toHaveClass(/active/);

    // Open settings drawer
    await page.locator('#settingsBtn').click();
    await expect(page.locator('#drawer')).toHaveClass(/on/);

    // Simulate Android Back gesture (history.back())
    await page.goBack();

    // Drawer should be closed
    await expect(page.locator('#drawer')).not.toHaveClass(/on/);
    // User remains on Today view
    await expect(page.locator('#view-today')).toHaveClass(/active/);
  });

  test('Navigation-event: Android back gesture closes Help dialog without navigating away', async ({ app }) => {
    const page = await app.open();
    await expect(page.locator('#view-today')).toHaveClass(/active/);

    // Open Help dialog
    await page.locator('#helpBtn').click();
    await expect(page.locator('#helpBox')).toHaveClass(/on/);

    // Simulate Android Back gesture
    await page.goBack();

    // Help dialog should be closed
    await expect(page.locator('#helpBox')).not.toHaveClass(/on/);
    // User remains on Today view
    await expect(page.locator('#view-today')).toHaveClass(/active/);
  });

  test('Navigation-event: Android back gesture closes Mobile Menu on mobile viewports', async ({ app }) => {
    const page = app.page;
    await page.setViewportSize({ width: 390, height: 844 });
    await app.open();

    // Open mobile menu
    await page.locator('#menuBtn').click();
    await expect(page.locator('#mobileMenu')).toBeVisible();

    // Simulate Android Back gesture
    await page.goBack();

    // Menu should be closed
    await expect(page.locator('#mobileMenu')).toBeHidden();
    await expect(page.locator('#view-today')).toHaveClass(/active/);
  });

  test('Adaptive piano stand landscape mode: compact top bar and piano keys on small height', async ({ app }) => {
    const page = app.page;
    // Typical Android phone in landscape mode resting on a piano stand (e.g. 844 x 390)
    await page.setViewportSize({ width: 844, height: 390 });
    await app.open();

    // Check header bar height in landscape compact mode
    const barHeight = await page.locator('header .bar').evaluate(el => el.getBoundingClientRect().height);
    expect(barHeight).toBeLessThanOrEqual(48);

    // Open a view with piano dock (e.g. #practice)
    await page.locator('header nav.tabs button[data-view="practice"]').click();
    await expect(page.locator('#view-practice')).toHaveClass(/active/);

    // Keys height should be compact (76px)
    const keysHeight = await page.locator('.keys').evaluate(el => el.getBoundingClientRect().height);
    expect(keysHeight).toBeLessThanOrEqual(80);
  });

  test('Adaptive tablet landscape mode on piano stand: UI fits comfortably without horizontal overflow', async ({ app }) => {
    const page = app.page;
    // Android tablet in landscape mode (e.g. 1280 x 800)
    await page.setViewportSize({ width: 1280, height: 800 });
    await app.open();

    // Check no horizontal scrollbar on body
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasHorizontalOverflow).toBe(false);

    // Check piano dock is visible and keys are properly positioned
    await page.locator('header nav.tabs button[data-view="explore"]').click();
    await expect(page.locator('.dock')).toBeVisible();
    const whiteKeysCount = await page.locator('.key.white').count();
    expect(whiteKeysCount).toBeGreaterThan(15);
  });

  test('Back after picking a view from the mobile menu goes to the previous view in one step', async ({ app }) => {
    const page = app.page;
    await page.setViewportSize({ width: 390, height: 844 });
    await app.open();
    await page.locator('#menuBtn').click();
    await page.locator('#mobileMenu button[data-view="progress"]').click();
    await expect(page.locator('#view-progress')).toHaveClass(/active/);
    await page.goBack();
    await expect(page.locator('#view-today')).toHaveClass(/active/);
  });

  test('Dock stays hidden on views without a keyboard (no display override leaks from media queries)', async ({ app }) => {
    const page = await app.open();
    await page.setViewportSize({ width: 844, height: 390 });
    await page.evaluate(() => show('progress'));
    const display = await page.locator('#dock').evaluate(el => getComputedStyle(el).display);
    expect(display).toBe('none');
  });

});
