import { test, expect, type Locator } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { evidencePath } from '../evidence-path';
import { demoEvent } from '../../src/demo';
import { unbrokenLabelsEvent } from '../fixtures/maximum-event';

test('manual history recovery preserves a newer saved event and offers the cached copy', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 1050 });
  await page.addInitScript(() => {
    (window as any).restoredFromCache = false;
    addEventListener('pageshow', (event) => {
      (window as any).restoredFromCache = event.persisted;
    });
  });
  async function editNote(note: string) {
    await page.getByRole('button', { name: 'Open Kitchen radio', exact: true }).click();
    await page.getByRole('textbox', { name: 'Planning note', exact: true }).fill(note);
    await page.getByRole('button', { name: 'Save request', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(sessionStorage.getItem('repair-desk-v1')!).event.requests.find(
              (r: { id: string }) => r.id === 'r-radio'
            ).note
        )
      )
      .toBe(note);
  }
  await page.goto('/?history-document=first');
  await editNote('Earlier manual note');
  await page.goto('/?history-document=second');
  await editNote('Latest manual note');
  const latest = await page.evaluate(() => sessionStorage.getItem('repair-desk-v1'));
  await page.goBack({ waitUntil: 'commit' });
  await expect(page.getByText('Manual mode · WebMCP unavailable')).toBeVisible();
  const cached = await page.evaluate(() => (window as any).restoredFromCache);
  await testInfo.attach('actual-cache-restoration', {
    body: JSON.stringify({ cached }),
    contentType: 'application/json'
  });
  if (cached) {
    await expect(page.getByRole('alert')).toContainText('another page');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      320
    );
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download cached event copy', exact: true }).click();
    const file = evidencePath(`${testInfo.project.name}-cached-history-event.json`);
    await (await downloading).saveAs(file);
    const backup = JSON.parse(await readFile(file, 'utf8'));
    expect(backup.requests.find((r: { id: string }) => r.id === 'r-radio').note).toBe(
      'Earlier manual note'
    );
    await page.screenshot({
      path: evidencePath(`${testInfo.project.name}-cached-history-recovery.png`)
    });
    await Promise.all([
      page.waitForEvent('load'),
      page.getByRole('button', { name: 'Reload latest saved event', exact: true }).click()
    ]);
  }
  await page.getByRole('button', { name: 'Open Kitchen radio', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Planning note', exact: true })).toHaveValue(
    'Latest manual note'
  );
  expect(await page.evaluate(() => sessionStorage.getItem('repair-desk-v1'))).toBe(latest);
});

for (const width of [320, 1440]) {
  test(`unbroken event text stays inside planning, review and editor surfaces at ${width}px`, async ({
    page
  }, testInfo) => {
    const event = unbrokenLabelsEvent();
    await page.setViewportSize({ width, height: 1050 });
    async function expectFits(state: string) {
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        state
      ).toBeLessThanOrEqual(width);
      for (const dialog of await page.getByRole('dialog').all()) {
        const size = await dialog.evaluate((element) => ({
          content: element.scrollWidth,
          width: element.clientWidth
        }));
        expect(size.content, `${state} dialog`).toBeLessThanOrEqual(size.width + 1);
      }
    }
    await page.goto('/');
    await page.getByRole('button', { name: 'Import event backup', exact: true }).click();
    await page.getByLabel('Event JSON').fill(JSON.stringify(event));
    await page.getByRole('button', { name: 'Validate & replace event', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expectFits('imported planning desk');
    await page.getByRole('button', { name: 'Repairers', exact: true }).click();
    await expectFits('roster including reserved-time label');
    await page
      .getByRole('button', { name: `Edit repairer ${event.volunteers[3].name}`, exact: true })
      .click();
    await expectFits('repairer and reserve editor');
    await page.keyboard.press('Escape');
    await page.getByRole('navigation').getByRole('button', { name: 'Repair requests' }).click();
    await expectFits('request queue');
    await page
      .getByRole('button', { name: `Open ${event.requests[0].title}`, exact: true })
      .click();
    await expectFits('current appointment detail');
    await page.locator('.appointment-summary').scrollIntoViewIfNeeded();
    await page.screenshot({
      path: evidencePath(`${testInfo.project.name}-unbroken-fields-${width}-detail.png`)
    });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Planning desk', exact: true }).click();
    await page.getByLabel('A repairer can’t make it').selectOption('v-sam');
    await page.getByRole('button', { name: 'Compare all three preferences', exact: true }).click();
    await expectFits('comparison and scenario assumptions');
    const description = page.locator('.scenario-description');
    const descriptionSize = await description.evaluate((element) => ({
      content: element.scrollWidth,
      width: element.clientWidth
    }));
    expect(descriptionSize.content).toBeLessThanOrEqual(descriptionSize.width + 1);
    const noAppointment = page
      .locator('.change-row b')
      .filter({ hasText: 'No appointment' })
      .first();
    const column = await noAppointment.evaluate((element) => {
      const style = getComputedStyle(element);
      const context = document.createElement('canvas').getContext('2d')!;
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      return { width: element.clientWidth, word: context.measureText('appointment').width };
    });
    expect(
      column.width,
      'The short destination must not collapse beside a long source label'
    ).toBeGreaterThanOrEqual(column.word);
    await description.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: evidencePath(`${testInfo.project.name}-unbroken-fields-${width}-comparison.png`)
    });
    await page.locator('.exclusion-row').first().click();
    await expectFits('capacity explanation');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Review & apply', exact: true }).click();
    await expectFits('approval');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Print current desk packet', exact: true }).click();
    await expectFits('packet preview');
    await page.keyboard.press('Escape');
    expect(
      await page.evaluate(() => JSON.parse(sessionStorage.getItem('repair-desk-v1')!).event)
    ).toEqual(event);
  });

  test(`unbroken repairer labels stay readable and editable at ${width}px`, async ({
    page
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1050 });
    await page.goto('/');
    const name = 'Volunteer'.repeat(9).slice(0, 80);
    await page.getByRole('button', { name: 'Repairers', exact: true }).click();
    await page.getByRole('button', { name: 'Edit repairer Ada', exact: true }).click();
    await page.getByRole('textbox', { name: 'Name or label', exact: true }).fill(name);
    await page.getByRole('button', { name: 'Save repairer', exact: true }).click();
    const card = page
      .locator('.repairer-card')
      .filter({ has: page.getByRole('heading', { name, exact: true }) });
    await expect(card).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width
    );
    const bounds = await card.evaluate((element) => ({
      card: element.getBoundingClientRect().toJSON(),
      name: element.querySelector('h2')!.getBoundingClientRect().toJSON(),
      avatar: element.querySelector('.avatar')!.getBoundingClientRect().toJSON(),
      edit: element.querySelector('button')!.getBoundingClientRect().toJSON()
    }));
    expect(bounds.name.left >= bounds.avatar.right || bounds.name.top >= bounds.avatar.bottom).toBe(
      true
    );
    expect(bounds.name.right <= bounds.edit.left || bounds.name.top >= bounds.edit.bottom).toBe(
      true
    );
    expect(bounds.name.left).toBeGreaterThanOrEqual(bounds.card.left);
    expect(bounds.name.right).toBeLessThanOrEqual(bounds.card.right);
    expect(bounds.edit.right).toBeLessThanOrEqual(bounds.card.right);
    expect(bounds.avatar.width).toBeCloseTo(bounds.avatar.height, 0);
    await card.screenshot({
      path: evidencePath(`${testInfo.project.name}-unbroken-${width}-roster.png`)
    });
    await page.getByRole('button', { name: `Edit repairer ${name}`, exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Name or label', exact: true })).toHaveValue(
      name
    );
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Planning desk', exact: true }).click();
    const label = page.locator('.volunteer-label strong').filter({ hasText: name });
    await expect(label).toHaveText(name);
    await label.scrollIntoViewIfNeeded();
    await expect(label).toBeInViewport({ ratio: 1 });
    const row = page.locator('.timeline-row').filter({ has: label });
    const timeline = await row.evaluate((element) => ({
      row: element.getBoundingClientRect().toJSON(),
      label: element.querySelector('.volunteer-label strong')!.getBoundingClientRect().toJSON(),
      track: element.querySelector('.track')!.getBoundingClientRect().toJSON()
    }));
    expect(timeline.label.right).toBeLessThanOrEqual(timeline.track.left);
    expect(timeline.label.top).toBeGreaterThanOrEqual(timeline.row.top);
    expect(timeline.label.bottom).toBeLessThanOrEqual(timeline.row.bottom);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width
    );
    await page.screenshot({
      path: evidencePath(`${testInfo.project.name}-unbroken-${width}-timeline.png`)
    });
    const saved = await page.evaluate(
      () => JSON.parse(sessionStorage.getItem('repair-desk-v1')!).event
    );
    expect(saved.volunteers[0].name).toBe(name);
    expect(saved.assignments).toEqual(demoEvent().assignments);
  });
}

for (const segmenterAvailable of [true, false]) {
  test(`Unicode repairer names keep usable initials and saved identity (segmenter ${segmenterAvailable})`, async ({
    page
  }, testInfo) => {
    if (!segmenterAvailable) {
      // Feature-absence simulation, not a claim about an old browser engine.
      await page.addInitScript(() =>
        Object.defineProperty(Intl, 'Segmenter', { value: undefined })
      );
    }
    await page.goto('/');
    const before = demoEvent();
    let previous = 'Ada';
    for (const [label, name, grapheme, fallback] of [
      ['accent', 'E\u0301lodie', 'E\u0301', 'É'],
      ['emoji', '👩🏽‍🔧 Robin', '👩🏽‍🔧', '👩'],
      ['cjk', '李 Morgan', '李', '李']
    ]) {
      await page.getByRole('button', { name: 'Repairers', exact: true }).click();
      await page.getByRole('button', { name: `Edit repairer ${previous}`, exact: true }).click();
      await page.getByRole('textbox', { name: 'Name or label', exact: true }).fill(name);
      await page.getByRole('button', { name: 'Save repairer', exact: true }).click();
      const card = page
        .locator('.repairer-card')
        .filter({ has: page.getByRole('heading', { name, exact: true }) });
      const initial = segmenterAvailable ? grapheme : fallback;
      await expect(card.locator('.avatar')).toHaveText(initial);
      await expect(card.locator('.avatar')).toHaveAttribute('aria-hidden', 'true');
      await card.screenshot({
        path: evidencePath(`${testInfo.project.name}-unicode-${segmenterAvailable}-${label}.png`)
      });
      await page.reload();
      await page.getByRole('button', { name: 'Planning desk', exact: true }).click();
      const row = page
        .locator('.volunteer-label')
        .filter({ has: page.getByText(name, { exact: true }) });
      await expect(row.locator('.avatar')).toHaveText(initial);
      await expect(row.locator('.avatar')).toHaveAttribute('aria-hidden', 'true');
      const after = await page.evaluate(
        () => JSON.parse(sessionStorage.getItem('repair-desk-v1')!).event
      );
      expect(after.volunteers).toEqual(
        before.volunteers.map((v: { id: string }) => (v.id === 'v-ada' ? { ...v, name } : v))
      );
      expect(after.assignments).toEqual(before.assignments);
      previous = name;
    }
  });
}

async function expectSelectedLabelsFit(selects: Locator) {
  const selectedLabels = await selects.evaluateAll((elements) => {
    const context = document.createElement('canvas').getContext('2d')!;
    return elements.map((element) => {
      const select = element as HTMLSelectElement;
      const style = getComputedStyle(select);
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      return {
        text: select.selectedOptions[0].textContent ?? '',
        textWidth: context.measureText(select.selectedOptions[0].textContent ?? '').width,
        // Leave room for the native arrow, in addition to the CSS padding.
        available:
          select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 24
      };
    });
  });
  for (const label of selectedLabels) {
    expect(label.available, `Selected value must fit: ${label.text}`).toBeGreaterThanOrEqual(
      label.textWidth
    );
  }
}

test('short windows keep every navigation action reachable by pointer and keyboard', async ({
  page
}, testInfo) => {
  // This is a short CSS viewport regression, not a simulated native zoom claim.
  // The same 360x228 layout was reproduced with actual browser zoom separately.
  await page.setViewportSize({ width: 360, height: 228 });
  await page.goto('/');
  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  const activity = navigation.getByRole('button', { name: 'Activity', exact: true });
  await activity.click({ timeout: 3000 });
  await expect(activity).toHaveAttribute('aria-current', 'page');
  await expect(activity).toBeInViewport({ ratio: 1 });
  expect(await page.locator('.sidebar').evaluate((element) => element.scrollTop)).toBeGreaterThan(
    0
  );

  await page.evaluate(() => window.scrollTo(0, 100));
  const pageOffset = await page.evaluate(() => scrollY);
  expect(pageOffset).toBeGreaterThan(0);
  const buttons = navigation.getByRole('button');
  await buttons.first().focus();
  for (let index = 0; index < 5; index++) {
    await expect(buttons.nth(index)).toBeFocused();
    await expect(buttons.nth(index)).toBeInViewport({ ratio: 1 });
    if (index < 4) await page.keyboard.press('Tab');
  }
  expect(await page.evaluate(() => scrollY)).toBe(pageOffset);
  await page.keyboard.press('Enter');
  await expect(activity).toHaveAttribute('aria-current', 'page');
  await page.screenshot({ path: evidencePath(`${testInfo.project.name}-short-navigation.png`) });
});

test('unreadable saved data can be downloaded privately before an explicit replacement', async ({
  page
}, testInfo) => {
  const unreadable = '{"schemaVersion":1,"name":"Unfinished synthetic event';
  await page.goto('/');
  await page.evaluate((value) => sessionStorage.setItem('repair-desk-v1', value), unreadable);
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('has not been overwritten');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download unreadable saved copy', exact: true }).click();
  const path = evidencePath(`${testInfo.project.name}-unreadable-copy.txt`);
  await (await downloading).saveAs(path);
  expect(await readFile(path, 'utf8')).toBe(unreadable);
  expect(await page.evaluate(() => sessionStorage.getItem('repair-desk-v1'))).toBe(unreadable);
  await page.getByRole('button', { name: 'Replace unreadable save…', exact: true }).click();
  await page.getByRole('button', { name: 'Keep it for now', exact: true }).click();
  expect(await page.evaluate(() => sessionStorage.getItem('repair-desk-v1'))).toBe(unreadable);
  await page.getByRole('button', { name: 'Replace unreadable save…', exact: true }).click();
  await page.getByLabel('I understand this replaces the unreadable saved data.').check();
  await page.getByRole('button', { name: 'Replace unreadable saved data', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Preview a new plan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review the difference' })).toBeVisible();
});

test.beforeEach(async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name === 'native-chrome');
  await testInfo.attach('actual-browser-version', {
    body: browser.version(),
    contentType: 'text/plain'
  });
});

test('unsupported browser can plan without fake native claims', async ({ page }, testInfo) => {
  await page.goto('/');
  expect(await page.evaluate(() => typeof document.modelContext)).toBe('undefined');
  await expect(page.getByText('Manual mode · WebMCP unavailable')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  expect(await page.locator('main').evaluate((main) => main.contains(document.activeElement))).toBe(
    true
  );
  await page.setViewportSize({ width: 320, height: 820 });
  await page.evaluate(() => document.fonts.ready);
  await expectSelectedLabelsFit(page.locator('.scenario-card select'));
  await page.locator('.scenario-card').screenshot({
    path: evidencePath(`${testInfo.project.name}-narrow-scenario.png`),
    animations: 'disabled'
  });
  await page.setViewportSize({ width: 1440, height: 1050 });
  // Exercise the real native select by keyboard, not only selectOption().
  // Its appearance stays native after the WebKit text-clipping repair.
  const allowance = page.getByLabel('Allow more time per item');
  await allowance.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Tab');
  await expect(allowance).toHaveValue('1');
  await allowance.focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Tab');
  await expect(allowance).toHaveValue('0');
  await page.getByRole('button', { name: 'Preview a new plan' }).click();
  await expect(page.getByRole('heading', { name: 'Review the difference' })).toBeVisible();
  await page.getByRole('button', { name: 'Compare all three preferences' }).click();
  const comparison = page.getByRole('region', { name: 'Compare the trade-offs' });
  await expect(comparison).toBeVisible();
  await comparison.getByRole('button', { name: 'Inspect Fit more appointments' }).click();
  await expect(page.getByLabel('Planning preference')).toHaveValue('most-appointments');
  await expect(page.getByRole('heading', { name: 'Review the difference' })).toBeFocused();
  await page.getByRole('button', { name: 'Agent tools', exact: true }).click();
  await page.getByRole('button', { name: 'Run scripted rehearsal' }).click();
  await expect(page.getByRole('heading', { name: 'Review the difference' })).toBeInViewport();
  await page.getByRole('button', { name: 'Agent tools', exact: true }).click();
  await expect(
    page.getByText('Direct-handler rehearsal — NOT native WebMCP or an AI agent', { exact: true })
  ).toHaveCount(3);
});

test('manual validation gives readable corrections and preserves drafts until recovery', async ({
  page
}, testInfo) => {
  await page.goto('/');
  const savedBefore = await page.evaluate(() => sessionStorage.getItem('repair-desk-v1'));
  await page.getByRole('button', { name: 'Add request', exact: true }).click();
  await page.getByRole('textbox', { name: 'Item', exact: true }).fill('Umbrella');
  await page.getByRole('textbox', { name: 'Visitor label', exact: true }).fill('Guest U');
  await page.getByRole('combobox', { name: 'Arrives at', exact: true }).selectOption('8');
  await page.getByRole('combobox', { name: 'Must leave by', exact: true }).selectOption('7');
  await page.getByRole('button', { name: 'Save request', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Arrival, departure and estimated duration must leave a usable appointment window.'
  );
  await page.setViewportSize({ width: 320, height: 820 });
  await page.evaluate(() => document.fonts.ready);
  await expectSelectedLabelsFit(page.locator('.request-form select'));
  await page.getByRole('alert').scrollIntoViewIfNeeded();
  await page.screenshot({
    path: evidencePath(`${testInfo.project.name}-readable-request-error.png`),
    animations: 'disabled'
  });
  await expect(page.getByRole('textbox', { name: 'Item', exact: true })).toHaveValue('Umbrella');
  expect(await page.evaluate(() => sessionStorage.getItem('repair-desk-v1'))).toBe(savedBefore);
  await page.getByRole('combobox', { name: 'Must leave by', exact: true }).selectOption('12');
  await page.getByRole('button', { name: 'Save request', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Repair requests', exact: false }).click();
  await expect(page.getByRole('button', { name: 'Open Umbrella', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Repairers', exact: true }).click();
  await page.getByRole('button', { name: 'Add repairer', exact: true }).click();
  await page.getByRole('textbox', { name: 'Name or label', exact: true }).fill('Morgan');
  await page.getByRole('combobox', { name: 'Available from', exact: true }).selectOption('5');
  await page.getByRole('combobox', { name: 'Available until', exact: true }).selectOption('4');
  await page.getByRole('button', { name: 'Save repairer', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'A volunteer must have a usable availability window.'
  );
  await page.getByRole('combobox', { name: 'Available until', exact: true }).selectOption('12');
  await page.getByRole('button', { name: 'Save repairer', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const beforeImport = await page.evaluate(() => sessionStorage.getItem('repair-desk-v1'));
  const duplicate = demoEvent();
  duplicate.requests.push({ ...duplicate.requests[0] });
  await page.getByRole('button', { name: 'Import event backup', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Event JSON', exact: true })
    .fill(JSON.stringify(duplicate));
  await page.getByRole('button', { name: 'Validate & replace event', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Duplicate requests IDs.');
  expect(await page.evaluate(() => sessionStorage.getItem('repair-desk-v1'))).toBe(beforeImport);
  await page
    .getByRole('textbox', { name: 'Event JSON', exact: true })
    .fill(JSON.stringify(demoEvent()));
  await page.getByRole('button', { name: 'Validate & replace event', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

for (const clockCase of [
  {
    start: '09:15',
    startMinutes: 555,
    end: '12:15',
    arrival: 0,
    placedStart: '09:15',
    placedEnd: '10:00'
  },
  {
    start: '21:00',
    startMinutes: 1260,
    end: '24:00',
    arrival: 9,
    placedStart: '23:15',
    placedEnd: '24:00'
  }
]) {
  test(`manual-only organizer creates, applies, backs up and restores a custom-clock event (${clockCase.start})`, async ({
    page
  }, testInfo) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Start a blank event', exact: true }).click();
    await page
      .getByRole('textbox', { name: 'New event name', exact: true })
      .fill(`Manual workshop ${clockCase.start}`);
    await page.getByLabel('Session start', { exact: false }).fill(clockCase.start);
    await page.getByRole('button', { name: 'Create blank event', exact: true }).click();
    await page.getByRole('button', { name: 'Add repairer', exact: true }).click();
    await page.getByRole('textbox', { name: 'Name or label', exact: true }).fill('Morgan');
    await page.getByRole('button', { name: 'Save repairer', exact: true }).click();
    await page.getByRole('button', { name: 'Repair requests', exact: false }).click();
    await page.getByRole('button', { name: 'Add request', exact: true }).click();
    await page.getByRole('textbox', { name: 'Item', exact: true }).fill('Wooden shelf');
    await page.getByRole('textbox', { name: 'Visitor label', exact: true }).fill('Guest A');
    await page.getByRole('combobox', { name: 'Skill needed', exact: true }).selectOption('general');
    await page
      .getByRole('combobox', { name: 'Arrives at', exact: true })
      .selectOption(String(clockCase.arrival));
    await page.getByRole('button', { name: 'Save request', exact: true }).click();
    await page.getByRole('button', { name: 'Planning desk', exact: true }).click();
    await page.getByLabel('Allow more time per item').selectOption('1');
    await page.getByRole('button', { name: 'Preview a new plan', exact: true }).click();
    // Complete the review with keyboard input. The invoking button disappears
    // on success, so focus must move to the resulting current plan.
    await page.getByRole('button', { name: 'Review & apply', exact: true }).press('Enter');
    await page.keyboard.press('Tab');
    await expect(
      page.getByLabel('I have reviewed the changes and scenario assumptions.')
    ).toBeFocused();
    await page.keyboard.press('Space');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('button', { name: 'Apply reviewed plan', exact: true })
    ).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('heading', { name: 'At the workbench', exact: true })
    ).toBeFocused();
    await expect(
      page.getByRole('heading', { name: 'At the workbench', exact: true })
    ).toBeInViewport();
    const headingBox = await page
      .getByRole('heading', { name: 'At the workbench', exact: true })
      .boundingBox();
    expect(headingBox!.y).toBeGreaterThanOrEqual(8);
    expect(headingBox!.y + headingBox!.height).toBeLessThanOrEqual(page.viewportSize()!.height - 8);
    const contextBox = await page.locator('.schedule-panel .eyebrow').boundingBox();
    expect(contextBox!.y).toBeGreaterThanOrEqual(8);
    await page.screenshot({
      path: evidencePath(
        `${testInfo.project.name}-clock-${clockCase.start.replace(':', '')}-approval-focus.png`
      )
    });
    await page.keyboard.press('Tab');
    expect(
      await page
        .locator('.schedule-panel')
        .evaluate((panel) => panel.contains(document.activeElement))
    ).toBe(true);
    await expect(
      page.getByRole('button', {
        name: `Wooden shelf, Morgan, ${clockCase.placedStart} to ${clockCase.placedEnd}`,
        exact: true
      })
    ).toBeVisible();
    await expect(page.getByLabel('Allow more time per item')).toHaveValue('0');
    await page.getByRole('button', { name: 'Preview a new plan', exact: true }).click();
    await expect(
      page.getByRole('button', {
        name: `Wooden shelf, Morgan, ${clockCase.placedStart} to ${clockCase.placedEnd}`,
        exact: true
      })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Review & apply', exact: true }).click();
    await page.getByLabel('I have reviewed the changes and scenario assumptions.').check();
    await page.getByRole('button', { name: 'Apply reviewed plan', exact: true }).click();
    await expect(
      page.getByRole('button', {
        name: `Wooden shelf, Morgan, ${clockCase.placedStart} to ${clockCase.placedEnd}`,
        exact: true
      })
    ).toBeVisible();
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download event backup', exact: true }).click();
    const download = await downloadEvent;
    const file = evidencePath(
      `${testInfo.project.name}-manual-${clockCase.start.replace(':', '')}-backup.json`
    );
    await download.saveAs(file);
    const backup = JSON.parse(await readFile(file, 'utf8'));
    expect(backup.startMinutes).toBe(clockCase.startMinutes);
    expect(backup.assignments[0].start).toBe(clockCase.arrival);
    expect(backup.assignments).toHaveLength(1);
    expect(backup.assignments[0].duration).toBe(3);
    await page.getByRole('button', { name: 'Reset example event', exact: true }).click();
    await page.getByRole('button', { name: 'Reset example', exact: true }).click();
    await page.getByRole('button', { name: 'Import event backup', exact: true }).click();
    await page.getByLabel('Choose event backup file').setInputFiles(file);
    await page.getByRole('button', { name: 'Validate & replace event', exact: true }).click();
    await expect(page.locator('.breadcrumb')).toContainText(`${clockCase.start}–${clockCase.end}`);
    await expect(
      page.getByRole('button', {
        name: `Wooden shelf, Morgan, ${clockCase.placedStart} to ${clockCase.placedEnd}`,
        exact: true
      })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Print current desk packet', exact: true }).click();
    await expect(
      page.getByRole('dialog').getByRole('heading', { name: 'Morgan', exact: true })
    ).toBeVisible();
    await expect(page.locator('.packet-preview')).toContainText(
      `${clockCase.placedStart}–${clockCase.placedEnd}`
    );
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('button', { name: 'Print current desk packet', exact: true })
    ).toBeFocused();
  });
}

test('manual-only spreadsheet intake reports row errors, preserves text and returns focus', async ({
  page
}, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Paste intake', exact: true }).click();
  const header = 'id\titem\tvisitor\tskill\tminutes\tarrives\tleaves\tparts_ready\tnote';
  const rows =
    '\n\tSmall stool\tVisitor A\tgeneral\t30\t10:00\t13:00\tyes\t=1+1\n\tJacket seam\tVisitor B\ttextiles\t15\t10:30\t12:30\tno\t';
  const input = page.getByRole('textbox', {
    name: 'Intake rows (CSV or tab-separated)',
    exact: true
  });
  await input.fill(header + rows.replace('\tno\t', '\t\t'));
  await page.getByRole('button', { name: 'Validate rows', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Row 3 · parts_ready');
  await expect(page.getByRole('button', { name: 'Add reviewed requests' })).toBeDisabled();
  await input.fill(header + rows);
  await page.getByRole('button', { name: 'Validate rows', exact: true }).click();
  await expect(page.getByRole('heading', { name: '2 new requests to review' })).toBeFocused();
  await expect(page.getByRole('cell', { name: '=1+1', exact: true })).toBeVisible();
  await page.getByLabel('I checked the rows, visitor labels and parts status.').check();
  await page.getByRole('button', { name: 'Add reviewed requests' }).click();
  await expect(page.getByRole('button', { name: 'Paste intake', exact: true })).toBeFocused();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download event backup' }).click();
  const file = evidencePath(`${testInfo.project.name}-intake-backup.json`);
  await (await downloading).saveAs(file);
  const backup = JSON.parse(await readFile(file, 'utf8'));
  expect(backup.requests).toHaveLength(14);
  expect(backup.assignments).toHaveLength(9);
  expect(backup.requests.find((request: { id: string }) => request.id === 'r-intake-1').note).toBe(
    '=1+1'
  );
  expect(
    backup.requests.find((request: { id: string }) => request.id === 'r-intake-2').partsReady
  ).toBe(false);
});

test('slow backup reads cannot replace newer choices, edits or reopened dialogs', async ({
  page
}) => {
  await page.goto('/');
  // Delay selected real File.text() results. This simulates slow local
  // storage without replacing the app's import handler or native browser UI.
  await page.evaluate(() => {
    const original = File.prototype.text;
    const target = window as typeof window & { releaseBackupRead: (name: string) => Promise<void> };
    const releases = new Map<string, () => Promise<void>>();
    target.releaseBackupRead = (name) => {
      const release = releases.get(name);
      if (!release) throw new Error('The delayed read was not started.');
      releases.delete(name);
      return release();
    };
    File.prototype.text = function () {
      const file = this;
      if (!file.name.startsWith('slow-')) return original.call(file);
      return new Promise<string>((resolve) => {
        releases.set(file.name, async () => {
          resolve(await original.call(file));
          await new Promise<void>((done) =>
            requestAnimationFrame(() => requestAnimationFrame(() => done()))
          );
        });
      });
    };
  });
  await page.getByRole('button', { name: 'Import event backup', exact: true }).click();
  const input = page.getByLabel('Choose event backup file');
  const editor = page.getByRole('dialog', { name: 'Import an event backup' }).getByRole('textbox');
  const first = { ...demoEvent(), name: 'First valid selection' };
  const second = { ...demoEvent(), name: 'Second valid selection' };
  await editor.fill(JSON.stringify(first));
  await input.setInputFiles({
    name: 'slow-first.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(first))
  });
  await expect(page.getByRole('button', { name: 'Validate & replace event' })).toBeDisabled();
  await expect(page.getByRole('status')).toContainText('Reading the selected backup');
  await input.setInputFiles({
    name: 'second.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(second))
  });
  await expect(editor).toHaveValue(JSON.stringify(second));
  await page.evaluate(() =>
    (
      window as typeof window & { releaseBackupRead: (name: string) => Promise<void> }
    ).releaseBackupRead('slow-first.json')
  );
  await expect(editor).toHaveValue(JSON.stringify(second));
  await page.getByRole('button', { name: 'Validate & replace event', exact: true }).click();
  await expect(page.locator('.sidebar')).toContainText('Second valid selection');

  await page.getByRole('button', { name: 'Import event backup', exact: true }).click();
  await input.setInputFiles({
    name: 'slow-edit.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(first))
  });
  const typed = { ...demoEvent(), name: 'Typed replacement' };
  await editor.fill(JSON.stringify(typed));
  await page.evaluate(() =>
    (
      window as typeof window & { releaseBackupRead: (name: string) => Promise<void> }
    ).releaseBackupRead('slow-edit.json')
  );
  await expect(editor).toHaveValue(JSON.stringify(typed));
  await page.getByRole('button', { name: 'Validate & replace event', exact: true }).click();
  await expect(page.locator('.sidebar')).toContainText('Typed replacement');

  await page.getByRole('button', { name: 'Import event backup', exact: true }).click();
  await input.setInputFiles({
    name: 'slow-closed.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(first))
  });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Import event backup', exact: true }).click();
  await expect(editor).toHaveValue('');
  await editor.fill(JSON.stringify(second));
  await page.evaluate(() =>
    (
      window as typeof window & { releaseBackupRead: (name: string) => Promise<void> }
    ).releaseBackupRead('slow-closed.json')
  );
  await expect(editor).toHaveValue(JSON.stringify(second));
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.sidebar')).toContainText('Typed replacement');
});

test('failed backup reads clear stale drafts and allow explicit recovery', async ({ page }) => {
  await page.goto('/');
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.evaluate(() => {
    const original = File.prototype.text;
    const target = window as typeof window & { rejectLateRead: () => Promise<void> };
    let failedOnce = false;
    File.prototype.text = function () {
      if (this.name === 'unreadable.json' && !failedOnce) {
        failedOnce = true;
        return Promise.reject(new DOMException('Synthetic unreadable file', 'NotReadableError'));
      }
      if (this.name === 'late-error.json')
        return new Promise<string>((_resolve, reject) => {
          target.rejectLateRead = async () => {
            reject(new DOMException('Synthetic late read failure', 'NotReadableError'));
            await new Promise<void>((done) =>
              requestAnimationFrame(() => requestAnimationFrame(() => done()))
            );
          };
        });
      return original.call(this);
    };
  });
  await page.getByRole('button', { name: 'Import event backup', exact: true }).click();
  const input = page.getByLabel('Choose event backup file');
  const editor = page.getByRole('dialog', { name: 'Import an event backup' }).getByRole('textbox');
  const text = JSON.stringify({ ...demoEvent(), name: 'Recovered file draft' });
  const file = { name: 'unreadable.json', mimeType: 'application/json', buffer: Buffer.from(text) };
  await editor.fill(text);
  await input.setInputFiles(file);
  await expect(page.getByRole('alert')).toContainText('could not be read');
  await expect(input).toHaveValue('');
  await expect(editor).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Validate & replace event' })).toBeDisabled();
  await input.setInputFiles(file);
  await expect(editor).toHaveValue(text);
  await expect(page.getByRole('alert')).toHaveCount(0);

  await input.setInputFiles({ ...file, name: 'late-error.json' });
  await input.setInputFiles({ ...file, name: 'newer-valid.json' });
  await expect(editor).toHaveValue(text);
  await page.evaluate(() =>
    (window as typeof window & { rejectLateRead: () => Promise<void> }).rejectLateRead()
  );
  await expect(editor).toHaveValue(text);
  await expect(page.getByRole('alert')).toHaveCount(0);

  await input.setInputFiles({
    name: 'too-large.json',
    mimeType: 'application/json',
    buffer: Buffer.alloc(100001, ' ')
  });
  await expect(page.getByRole('alert')).toContainText('100 KB');
  await expect(editor).toHaveValue('');
  await input.setInputFiles({
    name: 'empty.json',
    mimeType: 'application/json',
    buffer: Buffer.alloc(0)
  });
  await expect(page.getByRole('alert')).toContainText('empty');
  await expect(page.getByRole('button', { name: 'Validate & replace event' })).toBeDisabled();
  await editor.fill(text);
  await page.getByRole('button', { name: 'Validate & replace event', exact: true }).click();
  await expect(page.locator('.sidebar')).toContainText('Recovered file draft');
  expect(pageErrors).toEqual([]);
});

for (const width of [320, 1440]) {
  test(`user text spacing preserves planning labels and controls (${width}px)`, async ({
    page
  }, testInfo) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    // Apply only the four user overrides in WCAG 1.4.12, not app layout changes.
    await page.addStyleTag({
      content: `
      * { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
      p { margin-bottom: 2em !important; }
    `
    });
    const expectNoPageOverflow = async () => {
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        )
      ).toBeLessThanOrEqual(1);
    };
    await expectNoPageOverflow();
    const timelineLabels = await page
      .locator('.appointment strong, .reserved-slot strong')
      .evaluateAll((elements) =>
        elements.map((element) => ({
          text: element.textContent,
          excessHeight: element.scrollHeight - element.clientHeight,
          bottom: element.parentElement!.getBoundingClientRect().bottom,
          trackBottom: element.parentElement!.parentElement!.getBoundingClientRect().bottom
        }))
      );
    for (const label of timelineLabels) {
      expect(label.excessHeight, label.text ?? '').toBeLessThanOrEqual(1);
      expect(label.bottom, label.text ?? '').toBeLessThanOrEqual(label.trackBottom);
    }
    if (width === 1440) {
      // Compare local boxes: the whole stamp is rotated, so axis-aligned page
      // bounding boxes can overlap even when its own text rows do not.
      const stampRows = await page.locator('.session-stamp').evaluate((stamp) => {
        const clock = stamp.querySelector<HTMLElement>('small')!;
        const caption = stamp.querySelector<HTMLElement>('.stamp-caption')!;
        return { clockBottom: clock.offsetTop + clock.offsetHeight, captionTop: caption.offsetTop };
      });
      expect(stampRows.clockBottom).toBeLessThanOrEqual(stampRows.captionTop - 1);
    }
    const waiting = page
      .locator('.queue-controls')
      .getByRole('button', { name: 'Waiting for parts', exact: true });
    await waiting.click();
    await expect(waiting).toHaveAttribute('aria-pressed', 'true');
    await page
      .locator('.queue-controls')
      .getByRole('button', { name: 'All requests', exact: true })
      .click();
    await page.getByLabel('A repairer can’t make it').selectOption('v-sam');
    await page.getByRole('button', { name: 'Compare all three preferences', exact: true }).click();
    await expectNoPageOverflow();
    if (width === 320) {
      const labels = await page.locator('.comparison-cards dt').evaluateAll((elements) =>
        elements.map((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          const text = range.getBoundingClientRect(),
            cell = element.getBoundingClientRect();
          return { label: element.textContent, textRight: text.right, cellRight: cell.right };
        })
      );
      for (const label of labels)
        expect(label.textRight, label.label ?? '').toBeLessThanOrEqual(label.cellRight + 1);
    }
    await page.getByRole('button', { name: 'Current', exact: true }).click();
    await page.getByRole('button', { name: 'Proposed', exact: true }).click();
    await expect(
      page.getByLabel('Proposed appointment timeline').locator('.absence-label')
    ).toHaveText('Not available in this scenario');
    await page.getByRole('button', { name: 'Review & apply', exact: true }).click();
    await page.getByLabel('I have reviewed the changes and scenario assumptions.').check();
    await page.getByRole('button', { name: 'Apply reviewed plan', exact: true }).click();
    await expect(page.locator('#workbench-heading')).toBeFocused();
    await expect(
      page.getByLabel('Current appointment timeline').locator('.absence-label')
    ).toHaveText('Not available for this session');
    await expectNoPageOverflow();
    await page.screenshot({
      path: evidencePath(`${testInfo.project.name}-text-spacing-${width}.png`)
    });
  });
}
