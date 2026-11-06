import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import zlib from 'node:zlib';
import { test, expect, todayN, APP } from './fixtures.mjs';

const VIEWS = ['today', 'learn', 'songs', 'method', 'practice', 'read', 'sing', 'analysis', 'explore', 'accompany', 'transcribe', 'progress'];

test('boots and visits every view without uncaught errors', async ({ app }) => {
  const page = await app.open();
  for (const v of VIEWS) {
    await page.evaluate(v => show(v), v);
    await expect(page.locator('#view-' + v)).toHaveClass(/active/);
  }
});

test.describe('i18n', () => {
  for (const [lang, wording] of [['en', 'compatible Bluetooth MIDI pianos and keyboards'], ['ro', 'piane și claviaturi compatibile']]) {
    test(`Bluetooth MIDI description is instrument-neutral (${lang})`, async ({ app }) => {
      const page = await app.open({ lang });
      await page.locator('#settingsBtn').click();
      const hint = page.locator('[data-i18n="set_ble_hint"]');
      await expect(hint).toBeVisible();
      await expect(hint).toContainText(wording);
      await expect(hint).not.toContainText(/Kawai|ES120/i);
    });
  }

  // `pr_start` used to be defined twice (Practice button and score prompt): the later one won, so the
  // Practice page's "Start drilling" button read "Press Space or ▶ to start".
  for (const [lang, label] of [['en', 'Start drilling'], ['ro', 'Începe exersarea']]) {
    test(`Practice start button keeps its own label (${lang})`, async ({ app }) => {
      const page = await app.open({ lang, hash: 'practice' });
      await expect(page.locator('#pr-start')).toHaveText(label);
    });
  }

  test('no string key is defined twice in a language', () => {
    // Object literals silently keep the last duplicate, so scan the source of the STRINGS literal (skipping string contents).
    const html = readFileSync(new URL('../' + APP, import.meta.url), 'utf8');
    const src = html.slice(html.indexOf('const STRINGS={'));
    const dupes = [];
    let depth = 0, i = src.indexOf('{'), lang = null, seen = null;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === "'" || c === '"' || c === '`') { for (i++; src[i] !== c; i++) if (src[i] === '\\') i++; continue; }
      if (c === '{' || c === '(' || c === '[') { depth++; continue; }
      if (c === '}' || c === ')' || c === ']') { if (--depth === 0) break; continue; }
      const m = /^[A-Za-z_][A-Za-z0-9_]*(?=\s*:)/.exec(src.slice(i, i + 64));
      if (m && /[{,\s]/.test(src[i - 1])) {
        if (depth === 1) { lang = m[0]; seen = new Set(); }
        else if (depth === 2) { if (seen.has(m[0])) dupes.push(lang + ':' + m[0]); seen.add(m[0]); }
        i += m[0].length - 1;
      } else if (/[A-Za-z0-9_$]/.test(c)) { while (/[A-Za-z0-9_$]/.test(src[i + 1])) i++; }
    }
    expect(lang).toBe('ro');
    expect(dupes).toEqual([]);
  });
});

test.describe('Today counters', () => {
  // Seeds an established learner: `seen` concepts reviewed, none due today, `newToday` new ones met today.
  const seed = (page, { seen, newToday, day = 0 }) => page.evaluate(({ seen, newToday, day }) => {
    const tn = todayN() + day;
    data.srs = {};
    ITEMS.slice(0, seen).forEach(it => { data.srs[it.id] = { box: 2, ease: 2.3, reps: 2, lapses: 0, due: todayN() + 2, last: tn }; });
    Object.assign(data, { lastActive: tn, todayDay: tn, todayCount: newToday, newToday, totalReviews: seen, totalCorrect: seen, placed: true });
    data.settings.goal = 12; data.settings.newPerDay = 5;
    refreshToday();
  }, { seen, newToday, day });

  test('quota used up: "New today" is 0, caught-up state shows, and the session adds nothing new', async ({ app }) => {
    const page = await app.open();
    await seed(page, { seen: 20, newToday: 5 });
    await expect(page.locator('#c-new')).toHaveText('0');
    await expect(page.locator('#c-due')).toHaveText('0');
    await expect(page.locator('#hero-title')).toHaveText('You’re all caught up');
    await expect(page.locator('#startBtn')).toHaveText('Practice anyway');
    await expect(page.locator('#nextup')).not.toContainText('Next up');
    expect(await page.evaluate(() => buildQueue().filter(q => isNew(q.it.id)).length)).toBe(0);
  });

  test('part of the quota used: "New today" shows what is left and matches the session', async ({ app }) => {
    const page = await app.open();
    await seed(page, { seen: 20, newToday: 2 });
    await expect(page.locator('#c-new')).toHaveText('3');
    await expect(page.locator('#startBtn')).toHaveText('Start session');
    expect(await page.evaluate(() => buildQueue().filter(q => isNew(q.it.id)).length)).toBe(3);
  });

  test('a new day restores the full quota', async ({ app }) => {
    const page = await app.open();
    await seed(page, { seen: 20, newToday: 5, day: -1 });
    await expect(page.locator('#c-new')).toHaveText('5');
  });
});

test.describe('Settings drawer and Help dialog', () => {
  test('closed overlays are out of the Tab order; opening focuses inside, closing restores focus', async ({ app }) => {
    const page = await app.open();
    for (const id of ['drawer', 'helpBox']) expect(await page.locator('#' + id).evaluate(el => el.inert)).toBe(true);

    await page.locator('#settingsBtn').click();
    await expect(page.locator('#drawerClose')).toBeFocused();
    expect(await page.locator('#drawer').evaluate(el => el.inert)).toBe(false);
    await expect(page.locator('#drawer')).toHaveAttribute('role', 'dialog');
    await expect(page.locator('#drawer')).toHaveAttribute('aria-modal', 'true');
    await expect(page.locator('#drawer')).toHaveAttribute('aria-labelledby', 'drawerTitle');
    for (const selector of ['#skipLink', 'header', 'main', '#dock', 'details.osmd-lic', 'footer']) {
      expect(await page.locator(selector).evaluate(el => el.inert), selector).toBe(true);
    }
    // Tab cycles inside the open drawer instead of escaping to the page behind it.
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.getElementById('drawer').contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(page.locator('#settingsBtn')).toBeFocused();
    expect(await page.locator('#drawer').evaluate(el => el.inert)).toBe(true);
    expect(await page.locator('main').evaluate(el => el.inert)).toBe(false);

    await page.locator('#helpBtn').click();
    await expect(page.locator('#helpClose')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => document.getElementById('helpBox').contains(document.activeElement))).toBe(true);
    await page.locator('#helpClose').click();
    await expect(page.locator('#helpBtn')).toBeFocused();
  });

  test('with overlays closed, Tab never lands inside them', async ({ app }) => {
    const page = await app.open();
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => ['drawer', 'helpBox'].some(id => document.getElementById(id).contains(document.activeElement)));
      expect(inside).toBe(false);
    }
  });
});

test.describe('Navigation accessibility', () => {
  test('uses navigation semantics and moves focus to each destination', async ({ app }) => {
    const page = await app.open();
    expect(await page.locator('#nav').getAttribute('role')).toBeNull();

    await page.locator('#tools button[data-view="read"]').click();
    await expect(page.locator('#view-read h1')).toBeFocused();

    await page.evaluate(() => show('today'));
    await page.locator('#whyLink').click();
    await expect(page.locator('#view-method h1')).toBeFocused();

    await page.evaluate(() => show('learn'));
    await page.locator('#modeNav button[aria-current="page"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#view-learn h1')).toBeFocused();
  });

  test('mobile menu follows its opener, focuses an option, and closes with Escape', async ({ app }) => {
    const page = await app.open();
    await page.setViewportSize({ width: 375, height: 700 });
    await page.locator('#menuBtn').click();
    await expect(page.locator('#mobileMenu button[aria-current="page"]')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#mobileMenu button').nth(1)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#mobileMenu')).toBeHidden();
    await expect(page.locator('#menuBtn')).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.locator('#mobileMenu button[aria-current="page"]')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#mobileMenu')).toBeHidden();
    await expect(page.locator('#greet-title')).toBeFocused();
  });

  test('skip link focuses main without changing the route, and supporting text stays readable on phones', async ({ app }) => {
    const page = await app.open();
    await page.locator('#skipLink').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();
    await expect(page).toHaveURL(/etude\.html#today$/);

    for (const width of [320, 375]) {
      await page.setViewportSize({ width, height: 700 });
      for (const lang of ['en', 'ro']) {
        await page.evaluate(lang => setLang(lang), lang);
        const layout = await page.locator('#whyLink').evaluate(link => {
          const style = getComputedStyle(link), box = link.getBoundingClientRect();
          const probe = document.createElement('span');
          probe.style.color = 'var(--accent)';
          document.body.append(probe);
          const accent = getComputedStyle(probe).color;
          probe.remove();
          return { color: style.color, accent, whiteSpace: style.whiteSpace, width: box.width, height: box.height };
        });
        expect(layout.whiteSpace).toBe('nowrap');
        expect(layout.width).toBeGreaterThan(100);
        expect(layout.height).toBeLessThan(30);
        expect(layout.color).toBe(layout.accent);
      }
    }
  });
});

test.describe('Sight-singing without a microphone', () => {
  const denyMic = page => page.addInitScript(() => {
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
  });

  test('note-by-note: explains the problem and still accepts keyboard/MIDI notes', async ({ app, page }) => {
    await denyMic(page);
    await app.open({ hash: 'sing' });
    await page.locator('#si-mode button[data-v="note"]').click();
    await page.locator('#si-go').click();
    await expect(page.locator('#si-hint')).toContainText('Microphone unavailable');
    const before = await page.evaluate(() => sing.idx);
    await page.evaluate(() => { const m = ssCurNote().midi; handleNoteOn(m, 90, 'test'); handleNoteOff(m, 'test'); });
    expect(await page.evaluate(() => sing.idx)).toBe(before + 1);
  });

  test('free mode (microphone only): stops and shows an error instead of running silently', async ({ app, page }) => {
    await denyMic(page);
    await app.open({ hash: 'sing' });
    await page.locator('#si-mode button[data-v="free"]').click();
    await page.locator('#si-go').click();
    await expect(page.locator('#si-verdict')).toHaveText(/microphone/i);
    await expect(page.locator('#si-verdict')).toHaveClass(/\bbad\b/);
    expect(await page.evaluate(() => sing.active)).toBe(false);
  });

  test('a note flash from stopped playback does not erase the current-note marker of a new run', async ({ app, page }) => {
    await denyMic(page);
    await app.open({ hash: 'sing' });
    await page.locator('#si-mode button[data-v="note"]').click();
    // Listen → a note is flashing → Stop → start note-by-note on the same note within the flash window.
    await page.evaluate(() => { ssFlash(0); singStopAll(); singGo(); });
    await expect(page.locator('#si-staff .ss-n[data-i="0"]')).toHaveAttribute('data-s', 'now');
    await page.waitForTimeout(400);
    await expect(page.locator('#si-staff .ss-n[data-i="0"]')).toHaveAttribute('data-s', 'now');
  });

  test('a perfect result uses the styled success verdict', async ({ app }) => {
    const page = await app.open({ hash: 'sing' });
    await page.locator('#si-mode button[data-v="note"]').click();
    await page.locator('#si-go').click();
    await page.evaluate(() => { while (sing.active && ssCurNote()) { const m = ssCurNote().midi; handleNoteOn(m, 90, 'test'); handleNoteOff(m, 'test'); } });
    await expect(page.locator('#si-verdict')).toHaveClass(/\bgood\b/);
  });
});

test.describe('MusicXML import', () => {
  const xml = body => `<?xml version="1.0"?><score-partwise><part-list><score-part id="P1"><part-name>P</part-name></score-part></part-list><part id="P1">${body}</part></score-partwise>`;
  const parse = (page, src) => page.evaluate(src => {
    try { const r = scoreXmlNotes(new DOMParser().parseFromString(src, 'application/xml')); return { ok: true, notes: r.notes.length, tempos: r.tempos }; }
    catch (e) { return { ok: false, code: e.code }; }
  }, src);
  const note = (d = '4') => `<note><pitch><step>C</step><octave>4</octave></pitch><duration>${d}</duration></note>`;
  const attrs = (beats = '4', type = '4') => `<attributes><divisions>4</divisions><time><beats>${beats}</beats><beat-type>${type}</beat-type></time></attributes>`;

  test('a valid score parses', async ({ app }) => {
    const page = await app.open();
    expect(await parse(page, xml(`<measure number="1">${attrs()}${note()}${note()}${note()}${note()}</measure>`))).toMatchObject({ ok: true, notes: 4 });
  });

  test('a non-numeric duration is rejected instead of producing NaN timings', async ({ app }) => {
    const page = await app.open();
    expect(await parse(page, xml(`<measure number="1">${attrs()}${note('x')}${note()}</measure>`))).toEqual({ ok: false, code: 'xml' });
  });

  test('a negative time signature is rejected', async ({ app }) => {
    const page = await app.open();
    expect(await parse(page, xml(`<measure number="1">${attrs('-3')}${note()}</measure>`))).toEqual({ ok: false, code: 'xml' });
  });

  test('a tempo mark with a negative offset is clamped to the start', async ({ app }) => {
    const page = await app.open();
    const r = await parse(page, xml(`<measure number="1">${attrs()}<direction><offset>-99999</offset><sound tempo="90"/></direction>${note()}</measure>`));
    expect(r.ok).toBe(true);
    expect(r.tempos).toEqual([{ beat: 0, bpm: 90 }]);
  });
});

test.describe('MusicXML expression and engraving', () => {
  const q = (step, octave, extra = '') => `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>1</duration><voice>1</voice><type>quarter</type><staff>1</staff>${extra}</note>`;
  const whole = (step, chord = '') => `<note>${chord}<pitch><step>${step}</step><octave>3</octave></pitch><duration>4</duration><voice>2</voice><type>whole</type><staff>2</staff><notations><arpeggiate/></notations></note>`;
  const dyn = mark => `<direction placement="below"><direction-type><dynamics><${mark}/></dynamics></direction-type><staff>1</staff></direction>`;
  // One piano bar: p, a grace note before C5, a staccato D5, f on F5, the pedal pressed and never released, and a rolled C3–G3 in the left hand.
  const EXPRESSIVE = '<?xml version="1.0"?><score-partwise version="3.1"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1"><measure number="1">' +
    '<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves>' +
    '<clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>' +
    dyn('p') + '<direction placement="below"><direction-type><pedal type="start" line="yes"/></direction-type><staff>2</staff></direction>' +
    '<note><grace/><pitch><step>B</step><octave>4</octave></pitch><voice>1</voice><type>eighth</type><staff>1</staff></note>' +
    q('C', 5) + q('D', 5, '<notations><articulations><staccato/></articulations></notations>') + q('E', 5) + dyn('f') + q('F', 5) +
    '<backup><duration>4</duration></backup>' + whole('C') + whole('G', '<chord/>') + '</measure></part></score-partwise>';

  test('dynamics, articulation, grace notes, arpeggios and the pedal shape each note', async ({ app }) => {
    const page = await app.open();
    const notes = await page.evaluate(src => scoreXmlNotes(new DOMParser().parseFromString(src, 'application/xml')).notes
      .map(n => ({ midi: n.midi, vel: n.vel, soundRatio: n.soundRatio, graces: n.graces?.map(g => g.midi), roll: n.roll, pedalEnd: n.pedalEnd })), EXPRESSIVE);
    expect(notes.map(n => n.midi)).toEqual([48, 55, 72, 74, 76, 77]);
    const at = Object.fromEntries(notes.map(n => [n.midi, n]));
    expect(at[72].vel).toBeLessThan(at[77].vel);   // p, then f
    expect(at[48].vel).toBeLessThan(at[72].vel);   // the left-hand accompaniment sits under the melody
    expect([at[72].soundRatio, at[74].soundRatio]).toEqual([1, 0.45]);
    expect(at[72].graces).toEqual([71]);
    expect([at[48].roll, at[55].roll]).toEqual([0, 0.022]);
    expect(notes.every(n => n.pedalEnd === 4)).toBe(true);   // a pedal left down holds to the end of the part
  });

  test('playback sounds the grace note, the dynamics, the rolled chord and the pedal', async ({ app }) => {
    const page = await app.open({ hash: 'analysis' });
    const token = await page.evaluate(() => AN.loadToken);
    await page.locator('#an-file').setInputFiles({ name: 'expressive.musicxml', mimeType: 'application/xml', buffer: Buffer.from(EXPRESSIVE) });
    await page.waitForFunction(token => AN.loadToken > token && !AN.loading && AN.notes.length === 6, token);
    await page.evaluate(() => {
      const real = previewNote;
      window.played = [];
      previewNote = (m, when, dur, vel, opt) => { played.push({ m, when, dur, vel, hold: !!opt?.hold }); return real(m, when, dur, vel, opt); };
      scoreToggle();
    });
    await expect.poll(() => page.evaluate(() => [...new Set(played.map(p => p.m))].sort((a, b) => a - b))).toEqual([48, 55, 71, 72, 74, 76, 77]);
    const r = await page.evaluate(() => {
      scoreStop();
      const at = m => played.find(p => p.m === m);
      return { grace: at(71), c5: at(72), f5: at(77), c3: at(48), g3: at(55), bar: (scoreSeconds(4) - scoreSeconds(0)) / pracFactor() };
    });
    expect(r.grace.when).toBeLessThan(r.c5.when);
    expect(r.f5.vel).toBeGreaterThan(r.c5.vel);
    expect(r.g3.when - r.c3.when).toBeCloseTo(0.022, 3);
    expect(r.c5.hold).toBe(true);
    expect(r.c5.dur).toBeCloseTo(r.bar, 3);   // the pedal sustains the first quarter to the end of the bar
  });

  test('an imported score shows its own title and composer, text pedal marks and readable tempo glyphs; generated scores keep fixed bars', async ({ app }) => {
    const page = await app.open({ hash: 'analysis' });
    const pedal = type => `<direction placement="below"><direction-type><pedal type="${type}" line="yes"/></direction-type></direction>`;
    const xml = '<?xml version="1.0"?><score-partwise version="3.1"><identification><creator type="composer">Test Composer</creator></identification>' +
      '<credit page="1"><credit-type>title</credit-type><credit-words font-size="22">Nocturne Test</credit-words></credit>' +
      '<part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1"><measure number="1">' +
      '<attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>' +
      '<direction placement="above"><direction-type><words>Lento (\uECA5 = 60)</words></direction-type><sound tempo="60"/></direction>' +
      pedal('start') + q('C', 5) + q('D', 5) + pedal('change') + q('E', 5) + q('F', 5) + pedal('stop') + '</measure></part></score-partwise>';
    const token = await page.evaluate(() => AN.loadToken);
    await page.locator('#an-file').setInputFiles({ name: 'nocturne-file.musicxml', mimeType: 'application/xml', buffer: Buffer.from(xml) });
    await page.waitForFunction(token => AN.loadToken > token && !AN.loading && !!document.querySelector('#an-roll svg'), token);
    const r = await page.evaluate(() => {
      const doc = new DOMParser().parseFromString(SCORE.xml, 'application/xml');
      return {
        title: AN.source.title, fixed: SCORE.fixedWidth, svg: [...document.querySelectorAll('#an-roll svg text')].map(t => t.textContent).join('|'),
        pedals: [...doc.querySelectorAll('pedal')].map(p => [p.getAttribute('type'), p.getAttribute('line'), p.getAttribute('sign')].join(' ')),
        words: doc.querySelector('words').textContent,
      };
    });
    expect(r.title).toBe('Nocturne Test');
    expect(r.fixed).toBe(false);
    expect(r.svg).toContain('Nocturne Test');
    expect(r.svg).toContain('Test Composer');
    expect(r.svg).not.toContain('Piano');   // a lone piano part needs no instrument label
    expect(r.pedals).toEqual(['start no yes', 'stop no yes', 'start no yes', 'stop no yes']);   // "change" = release + press
    expect(r.words).toBe('Lento (\u2669 = 60)');
    expect(await page.evaluate(async () => { await anLoadExample(PIECES[0].id); return SCORE.fixedWidth; })).toBe(true);
  });
});

test.describe('Score Study engraving and symbol explanations', () => {
  // A piano bar with an editorial footnote, a chord symbol on the lower staff, dolce, mp < mf, a pedal, stacked chord fingerings and a cross-staff slur.
  const RICH = '<?xml version="1.0"?><score-partwise version="3.1"><work><work-title>Rich Test</work-title></work>' +
    '<credit page="1"><credit-words default-y="80" font-size="8">Versão revista para piano solo, arr. de J. Silva</credit-words></credit>' +
    '<part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">' +
    '<measure number="1"><attributes><divisions>2</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes><direction placement="above"><direction-type><words>dolce</words></direction-type><staff>1</staff></direction><direction placement="below"><direction-type><dynamics><mp/></dynamics></direction-type><staff>1</staff></direction><direction placement="below"><direction-type><wedge type="crescendo"/></direction-type><staff>1</staff></direction><direction placement="below"><direction-type><pedal type="start" line="yes"/></direction-type><staff>2</staff></direction><harmony><root><root-step>C</root-step></root><kind>major</kind><staff>2</staff></harmony><note><pitch><step>C</step><octave>5</octave></pitch><duration>2</duration><voice>1</voice><type>quarter</type><stem>up</stem><staff>1</staff><notations><technical><fingering>1</fingering></technical><slur type="start" number="1"/></notations></note><note><chord/><pitch><step>G</step><octave>5</octave></pitch><duration>2</duration><voice>1</voice><type>quarter</type><stem>up</stem><staff>1</staff><notations><technical><fingering>4,5</fingering></technical></notations></note><note><pitch><step>E</step><octave>5</octave></pitch><duration>2</duration><voice>1</voice><type>quarter</type><stem>up</stem><staff>1</staff><notations><technical><fingering>1</fingering></technical></notations></note><note><chord/><pitch><step>G</step><octave>5</octave></pitch><duration>2</duration><voice>1</voice><type>quarter</type><stem>up</stem><staff>1</staff><notations><technical><fingering>3</fingering></technical></notations></note><note><chord/><pitch><step>C</step><octave>6</octave></pitch><duration>2</duration><voice>1</voice><type>quarter</type><stem>up</stem><staff>1</staff><notations><technical><fingering>5</fingering></technical></notations></note><direction placement="below"><direction-type><wedge type="stop"/></direction-type><staff>1</staff></direction><direction placement="below"><direction-type><dynamics><mf/></dynamics></direction-type><staff>1</staff></direction><note><pitch><step>D</step><octave>5</octave></pitch><duration>4</duration><voice>1</voice><type>half</type><staff>1</staff><notations><articulations><staccato/></articulations></notations></note><backup><duration>8</duration></backup><note><pitch><step>C</step><octave>3</octave></pitch><duration>4</duration><voice>5</voice><type>half</type><staff>2</staff></note><direction placement="below"><direction-type><pedal type="stop" line="yes"/></direction-type><staff>2</staff></direction><note><pitch><step>G</step><octave>3</octave></pitch><duration>4</duration><voice>5</voice><type>half</type><staff>2</staff><notations><slur type="stop" number="1"/></notations></note></measure>' +
    '</part></score-partwise>';
  const load = async (page, src = RICH) => {
    const token = await page.evaluate(() => AN.loadToken);
    await page.locator('#an-file').setInputFiles({ name: 'rich.musicxml', mimeType: 'application/xml', buffer: Buffer.from(src) });
    await page.waitForFunction(token => AN.loadToken > token && !AN.loading && !!document.querySelector('#an-roll svg') && SCORE.syms?.length > 0, token);
  };

  test('editorial "Versão…" notes are dropped and chord symbols move to the upper staff', async ({ app }) => {
    const page = await app.open({ hash: 'analysis' });
    const words = '<direction placement="below"><direction-type><words default-y="-110">Versão de concerto, revisão do editor</words></direction-type><staff>2</staff></direction>';
    await load(page, RICH.replace('<harmony>', words + '<harmony>'));
    const r = await page.evaluate(() => {
      const doc = new DOMParser().parseFromString(SCORE.xml, 'application/xml');
      return {
        credits: [...doc.querySelectorAll('credit-words')].map(c => c.textContent),
        words: [...doc.querySelectorAll('words')].map(w => w.textContent),
        harmonyStaves: [...doc.querySelectorAll('harmony > staff')].map(s => s.textContent),
        pedals: doc.querySelectorAll('pedal').length,
        svg: [...document.querySelectorAll('#an-roll svg text')].map(t => t.textContent).join('|'),
        links: AN.source.links.map(l => l.kind),
      };
    });
    expect(r.credits.join('|')).not.toMatch(/Versão/);
    expect(r.words).toEqual(['dolce']);
    expect(r.harmonyStaves.every(s => s === '1')).toBe(true);
    expect(r.pedals).toBe(2);
    expect(r.svg).not.toMatch(/Versão|revisão/);
    expect(r.links).toEqual(['slur']);   // the slur from the treble chord to the bass note crosses staves
    await expect(page.locator('#an-roll svg path.sc-xline[data-kind="slur"]')).toHaveCount(1);
  });

  test('stacked chord fingerings such as "4,5" over "1" never collide with each other or the notes', async ({ app }) => {
    const page = await app.open({ hash: 'analysis' });
    await load(page);
    const r = await page.evaluate(() => {
      const ink = el => { const b = el.getBoundingClientRect(); return { l: b.left + b.width * .08, r: b.right - b.width * .08, t: b.top + b.height * .18, b: b.bottom - b.height * .2 }; };
      const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
      const fing = () => SCORE.syms.filter(s => s.kind === 'finger').map(s => ({ v: s.val, el: s.el, box: ink(s.el) }));
      const heads = [...document.querySelectorAll('#an-roll svg .vf-notehead')].map(h => h.getBoundingClientRect()).map(b => ({ l: b.left, r: b.right, t: b.top, b: b.bottom }));
      const clashes = () => { const f = fing(), out = [];
        f.forEach((a, i) => f.slice(i + 1).forEach(b => { if (hit(a.box, b.box)) out.push(a.v + '/' + b.v); }));
        f.forEach(a => heads.forEach(h => { if (hit(a.box, h)) out.push(a.v + '/head'); }));
        return out; };
      const engraved = clashes();
      // Force the collision a crowded score produces: "4,5" printed right on top of the "1" of the same chord.
      const [one, sub] = ['1', '4,5'].map(v => fing().find(f => f.v === v));
      const text = sub.el.querySelector('text');
      text.setAttribute('y', +text.getAttribute('y') + (one.box.t - sub.box.t) / text.ownerSVGElement.getScreenCTM().d);
      const forced = clashes();
      scoreFixFingerings($('an-roll'), SCORE.engine);
      const after = fing(), a1 = after.find(f => f.el === one.el), a45 = after.find(f => f.el === sub.el);
      return { values: after.map(f => f.v).sort(), engraved, forced, fixed: clashes(), stacked: a45.box.b <= a1.box.t };
    });
    expect(r.values).toEqual(['1', '1', '3', '4,5', '5']);
    expect(r.engraved).toEqual([]);
    expect(r.forced).toContain('1/4,5');
    expect(r.fixed).toEqual([]);
    expect(r.stacked).toBe(true);   // the upper-staff, stem-up chord pushes the extra label upwards
  });

  for (const [lang, expected] of [
    ['en', { mp: 'moderately soft', mf: 'moderately loud', text: 'sweetly', cresc: 'volume grows gradually', ped: 'press the sustain', pedup: 'release the sustain', thumb: 'thumb', sub: 'finger change' }],
    ['ro', { mp: 'moderat de încet', mf: 'moderat de tare', text: 'dulce', cresc: 'volumul crește treptat', ped: 'apasă pedala', pedup: 'ridică pedala', thumb: 'degetul mare', sub: 'schimbare de deget' }],
  ]) {
    test(`hovering dynamics, dolce, the hairpin, the pedal marks and fingerings explains them (${lang})`, async ({ app }) => {
      const page = await app.open({ hash: 'analysis', lang });
      await load(page);
      const tip = page.locator('#an-roll .sc-tip');
      const hover = async (kind, val, phrase) => {
        const pt = await page.evaluate(([kind, val]) => {
          const s = SCORE.syms.find(x => x.kind === kind && (val == null || x.val === val));
          const b = s.el.getBoundingClientRect();
          return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
        }, [kind, val]);
        await page.mouse.move(pt.x, pt.y);
        await expect(page.locator('#an-hover')).toContainText(phrase);
        await expect(tip).toBeVisible();
        await expect(tip).toContainText(phrase);
      };
      await hover('dyn', 'mp', expected.mp);
      await hover('dyn', 'mf', expected.mf);
      await hover('text', null, expected.text);
      await hover('cresc', null, expected.cresc);
      await hover('ped', null, expected.ped);
      await hover('pedup', null, expected.pedup);
      await hover('finger', '1', expected.thumb);
      await hover('finger', '4,5', expected.sub);
      await page.evaluate(() => SCORE.syms.find(s => s.kind === 'dyn' && s.val === 'mp').el.focus());
      await expect(page.locator('#an-hover')).toContainText(expected.mp);
      await expect(tip).toBeVisible();
      await page.mouse.move(1, 1);
      await expect(tip).toBeHidden();
    });
  }
});

test('the volume slider is audible even if a backup restored the hidden "muted" flag', async ({ app }) => {
  const page = await app.open({ saved: { v: 3, lang: 'en', muted: true, data: {} } });
  await page.evaluate(() => ensureAudio());
  await page.locator('#volume').evaluate(el => { el.value = '50'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(await page.evaluate(() => muted)).toBe(false);
  await expect.poll(() => page.evaluate(() => master.gain.value)).toBeGreaterThan(0.4);
});

test('an interrupted audio context is resumed before playback', async ({ app }) => {
  const page = await app.open();
  const resumeCalls = await page.evaluate(async () => {
    const previousContext = actx, previousPrepare = preparePiano;
    let calls = 0;
    actx = { state: 'interrupted', resume: () => { calls++; return Promise.resolve(); } };
    preparePiano = () => {};
    try {
      ensureAudio();
      await Promise.resolve();
      return calls;
    } finally {
      actx = previousContext;
      preparePiano = previousPrepare;
    }
  });
  expect(resumeCalls).toBe(1);
});

test('Explore "Show" does not clear another view\'s keyboard targets after navigating away', async ({ app }) => {
  const page = await app.open({ hash: 'explore' });
  await page.locator('#refShow').click();
  await page.evaluate(() => { show('learn'); kbClearAll(); kbState(60, 'target', true); });
  await page.waitForTimeout(2900);
  expect(await page.evaluate(() => keyEl.get(foldToView(60)).dataset.s)).toBe('target');
});

test('320px phone: no view scrolls sideways and the Explore staff fits its panel', async ({ app, page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await app.open();
  for (const v of VIEWS) {
    await page.evaluate(v => show(v), v);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), v).toBeLessThanOrEqual(320);
  }
  await page.evaluate(() => { show('explore'); $('refShow').click(); });
  const fit = await page.locator('#view-explore svg.ss-svg').first().evaluate(svg => svg.getBoundingClientRect().right <= svg.parentElement.getBoundingClientRect().right + 1);
  expect(fit).toBe(true);
});

// ---- .mxl archives built on the fly ----
// files: { name, data, store?, flags?, size? }. `size` replaces the declared unpacked size: a number, or { zip64: n } to declare it in a
// ZIP64 extra field. `links` lists indexes into files that get one more central-directory record pointing at the same stored data.
function zip(files, links = []) {
  const parts = [];
  let offset = 0;
  const recs = files.map(f => {
    const data = Buffer.from(f.data), name = Buffer.from(f.name), method = f.store ? 0 : 8;
    const body = f.store ? data : zlib.deflateRawSync(data, { level: 9 });
    const size = f.size ?? data.length, crc = zlib.crc32(data), head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(f.flags || 0, 6); head.writeUInt16LE(method, 8);
    head.writeUInt16LE(0x21, 12); head.writeUInt32LE(crc, 14); head.writeUInt32LE(body.length, 18);
    head.writeUInt32LE(typeof size === 'number' ? size : 0xffffffff, 22); head.writeUInt16LE(name.length, 26);
    parts.push(head, name, body);
    const rec = { f, name, method, crc, size, packed: body.length, offset };
    offset += head.length + name.length + body.length;
    return rec;
  });
  const central = r => {
    const extra = Buffer.alloc(typeof r.size === 'number' ? 0 : 12), c = Buffer.alloc(46);
    if (extra.length) { extra.writeUInt16LE(1, 0); extra.writeUInt16LE(8, 2); extra.writeBigUInt64LE(BigInt(r.size.zip64), 4); }
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(r.f.flags || 0, 8); c.writeUInt16LE(r.method, 10);
    c.writeUInt16LE(0x21, 14); c.writeUInt32LE(r.crc, 16); c.writeUInt32LE(r.packed, 20); c.writeUInt32LE(extra.length ? 0xffffffff : r.size, 24);
    c.writeUInt16LE(r.name.length, 28); c.writeUInt16LE(extra.length, 30); c.writeUInt32LE(r.offset, 42);
    return Buffer.concat([c, r.name, extra]);
  };
  const dir = Buffer.concat([...recs, ...links.map(i => recs[i])].map(central)), end = Buffer.alloc(22), count = recs.length + links.length;
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(count, 8); end.writeUInt16LE(count, 10); end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, dir, end]);
}
const CONTAINER = '<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">' +
  '<rootfiles><rootfile full-path="score.xml" media-type="application/vnd.recordare.musicxml+xml"/></rootfiles></container>';
// A score of n quarter notes (n a multiple of 4), optionally padded with a comment.
const score = (n, pad = '') => '<?xml version="1.0" encoding="UTF-8"?>' + (pad && '<!--' + pad + '-->') +
  '<score-partwise version="3.1"><movement-title>Archive</movement-title><part-list><score-part id="P1"><part-name>P</part-name></score-part></part-list><part id="P1">' +
  Array.from({ length: n / 4 }, (_, i) => `<measure number="${i + 1}">` +
    (i ? '' : '<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>') +
    '<note><pitch><step>C</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type></note>'.repeat(4) + '</measure>').join('') +
  '</part></score-partwise>';
const mxl = (xml, { links, ...entry } = {}) => zip([{ name: 'META-INF/container.xml', data: CONTAINER }, { name: 'score.xml', data: xml, ...entry }], links);
const MXL_CAP = 32 * 2 ** 20;   // AN_MAX_XML_CHARS

test('a small .mxl that unpacks to an oversized XML is refused with a clear message', async ({ app }) => {
  const page = await app.open({ hash: 'analysis' });
  const r = await page.evaluate(async b64 => {
    const real = opensheetmusicdisplay.MXLHelper.MXLtoXMLstring;
    opensheetmusicdisplay.MXLHelper.MXLtoXMLstring = async () => 'x'.repeat(AN_MAX_XML_CHARS + 1);   // stands in for a zip bomb that got past the checks
    try { await anReadXml(new File([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], 'bomb.mxl'), 'bomb'); return 'accepted'; }
    catch (e) { return anErrorKey(e, 'mxl'); }
    finally { opensheetmusicdisplay.MXLHelper.MXLtoXMLstring = real; }
  }, mxl(score(4)).toString('base64'));
  expect(r).toBe('an_err_mxlbig');
  expect(await page.evaluate(() => t('an_err_mxlbig'))).toMatch(/32 MB/);
});

test.describe('.mxl archives are checked before they are unpacked', () => {
  // Counts what reaches JSZip (through OSMD) and the preflight's counted inflate.
  const spyUnpack = page => page.evaluate(() => {
    const helper = opensheetmusicdisplay.MXLHelper, unzip = helper.MXLtoXMLstring, count = anInflatedSize;
    window.__unpack = { jszip: 0, counted: 0 };
    helper.MXLtoXMLstring = function (...a) { window.__unpack.jszip++; return unzip.apply(this, a); };
    anInflatedSize = function (...a) { window.__unpack.counted++; return count.apply(this, a); };
  });
  // Opens the archive through the file picker and reports how the import ended.
  const openMxl = async (page, bytes) => {
    const before = await page.evaluate(() => { window.__unpack.jszip = window.__unpack.counted = 0; return AN.loadToken; });
    await page.locator('#an-file').setInputFiles({ name: 'test.mxl', mimeType: 'application/vnd.recordare.musicxml', buffer: bytes });
    await page.waitForFunction(b => AN.loadToken > b && !AN.loading, before, { timeout: 30_000 });
    return page.evaluate(() => ({ error: AN.error ? AN.error.k : null, notes: AN.notes.length, msg: $('an-msg').textContent, isError: $('an-msg').classList.contains('is-error'), ...window.__unpack }));
  };

  test('ordinary archives still import: deflated, stored, and one large enough to be counted first', async ({ app }) => {
    const page = await app.open({ hash: 'analysis' });
    await spyUnpack(page);
    expect(await openMxl(page, mxl(score(4)))).toMatchObject({ error: null, notes: 4, isError: false, jszip: 1, counted: 0 });
    expect(await openMxl(page, mxl(score(8), { store: true }))).toMatchObject({ error: null, notes: 8, isError: false, jszip: 1, counted: 0 });
    // ~45 KB packed: past the size where deflate could reach 32 MB, so it is inflated once as a counted stream before JSZip unpacks it
    expect(await openMxl(page, mxl(score(12, randomBytes(45_000).toString('base64'))))).toMatchObject({ error: null, notes: 12, isError: false, jszip: 1, counted: 1 });
  });

  test('a declared unpacked size over 32 MB is refused without inflating anything', async ({ app }) => {
    const page = await app.open({ hash: 'analysis' });
    await spyUnpack(page);
    const refused = { error: 'an_err_mxlbig', msg: await page.evaluate(() => t('an_err_mxlbig')), isError: true, jszip: 0, counted: 0 };
    expect(await openMxl(page, mxl(score(4, 'a'.repeat(MXL_CAP))))).toMatchObject(refused);
    expect(await openMxl(page, mxl(score(4), { size: { zip64: 40 * 2 ** 20 } }))).toMatchObject(refused);
  });

  test('an entry that unpacks to far more than its header claims is stopped while counting', async ({ app }) => {
    const page = await app.open({ hash: 'analysis' });
    await spyUnpack(page);
    const bomb = Buffer.concat([Buffer.alloc(40 * 2 ** 20), randomBytes(40_000)]);   // ~80 KB packed, 40 MB unpacked; the header says 1000 bytes
    expect(await openMxl(page, mxl(bomb, { size: 1000 }))).toMatchObject({ error: 'an_err_mxl', isError: true, jszip: 0, counted: 1 });
  });

  test('directory records whose declared total exceeds the budget are refused without inflating', async ({ app }) => {
    const page = await app.open({ hash: 'analysis' });
    await spyUnpack(page);
    const big = Buffer.concat([Buffer.alloc(30 * 2 ** 20), randomBytes(40_000)]);   // honestly declared, just under the per-entry cap
    expect(await openMxl(page, mxl(big, { links: [1, 1, 1, 1] }))).toMatchObject({ error: 'an_err_mxlbig', isError: true, jszip: 0, counted: 0 });
  });

  test('many entries with small declared sizes cannot collectively hide a large expansion', async ({ app }) => {
    const page = await app.open({ hash: 'analysis' });
    // Each compressed record is small enough to look safe in isolation, but seven copies expand past the aggregate budget.
    const entry = Buffer.concat([Buffer.alloc(20 * 2 ** 20), randomBytes(1024)]);
    const archive = mxl(entry, { links: [1, 1, 1, 1, 1, 1] });
    const result = await page.evaluate(async b64 => {
      try {
        await anMxlPreflight(Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer);
        return 'accepted';
      } catch (e) {
        return anErrorKey(e, 'mxl');
      }
    }, archive.toString('base64'));
    expect(result).toBe('an_err_mxlbig');
  });

  test('an archive that needs a streamed size check is refused when the browser cannot provide one', async ({ app }) => {
    const page = await app.open({ hash: 'analysis' });
    const archive = mxl(score(4, randomBytes(45_000).toString('base64')));
    const result = await page.evaluate(async b64 => {
      const original = anInflatedSize;
      anInflatedSize = async () => null;
      try {
        await anMxlPreflight(Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer);
        return 'accepted';
      } catch (e) {
        return anErrorKey(e, 'mxl');
      } finally {
        anInflatedSize = original;
      }
    }, archive.toString('base64'));
    expect(result).toBe('an_err_mxlbig');
  });

  test('malformed or encrypted archives are refused before JSZip sees them', async ({ app }) => {
    const page = await app.open({ hash: 'analysis' });
    await spyUnpack(page);
    const msg = await page.evaluate(() => t('an_err_mxl')), good = mxl(score(4));
    for (const bytes of [Buffer.alloc(1024), good.subarray(0, good.length - 10), good.subarray(100), mxl(score(4), { flags: 1 })])
      expect(await openMxl(page, bytes)).toMatchObject({ error: 'an_err_mxl', msg, isError: true, jszip: 0, counted: 0 });
  });
});

test('ending an ear-training session cancels its pending automatic prompt', async ({ app }) => {
  const page = await app.open();
  const calls = await page.evaluate(async () => {
    const original = playInterval;
    let played = 0;
    playInterval = () => { played++; };
    try {
      const q = { it: ITEMS.find(it => it.cat === 'interval'), mode: 'ear', key: 0 };
      SES.active = true;
      SES.answered = false;
      SES.q = q;
      presentEar(q);
      endSession(false);
      await new Promise(resolve => setTimeout(resolve, 320));
      return played;
    } finally {
      playInterval = original;
    }
  });
  expect(calls).toBe(0);
});

test('a folded keyboard key remains pressed until every folded note is released', async ({ app }) => {
  const page = await app.open({ hash: 'explore' });
  const state = await page.evaluate(() => {
    releaseLiveInput();
    const firstByKey = new Map();
    let pair;
    for (let midi = 0; midi <= 127 && !pair; midi++) {
      const key = foldToView(midi);
      if (!keyEl.has(key)) continue;
      if (firstByKey.has(key)) pair = [firstByKey.get(key), midi, key];
      else firstByKey.set(key, midi);
    }
    if (!pair) throw new Error('Expected two MIDI notes to fold onto one visible key');

    const [first, second, key] = pair;
    handleNoteOn(first, 90, 'test:first');
    handleNoteOn(second, 90, 'test:second');
    const el = keyEl.get(key);
    const bothHeld = el.classList.contains('pressed');
    handleNoteOff(first, 'test:first');
    const oneHeld = el.classList.contains('pressed');
    handleNoteOff(second, 'test:second');
    const noneHeld = el.classList.contains('pressed');
    releaseLiveInput();
    return { bothHeld, oneHeld, noneHeld };
  });
  expect(state).toEqual({ bothHeld: true, oneHeld: true, noneHeld: false });
});

test('a modifier key releases active computer-keyboard notes', async ({ app }) => {
  const page = await app.open();
  const state = await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    const before = { held: held.size, typing: typingDown.size };
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Meta', metaKey: true, bubbles: true }));
    const after = { held: held.size, typing: typingDown.size };
    releaseLiveInput();
    return { before, after };
  });
  expect(state).toEqual({ before: { held: 1, typing: 1 }, after: { held: 0, typing: 0 } });
});

test('a malformed backup is rejected before it can replace local progress', async ({ app }) => {
  const page = await app.open();
  const dialogs = [];
  page.on('dialog', dialog => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    dialog.dismiss();
  });
  await page.locator('#importFile').setInputFiles({
    name: 'malformed-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ v: 3, data: [] })),
  });
  await expect.poll(() => dialogs.length).toBe(1);
  expect(dialogs).toEqual([{ type: 'alert', message: 'That file doesn’t look like an Étude backup.' }]);
});

test('a structurally valid backup still reaches explicit replacement confirmation', async ({ app }) => {
  const page = await app.open();
  const dialogs = [];
  page.on('dialog', dialog => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    dialog.dismiss();
  });
  await page.locator('#importFile').setInputFiles({
    name: 'valid-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ v: 3, data: { srs: {}, settings: {} } })),
  });
  await expect.poll(() => dialogs.length).toBe(1);
  expect(dialogs).toEqual([{ type: 'confirm', message: 'Replace your current progress with this backup?' }]);
});

test('persisted settings are normalized to supported audio and session limits', async ({ app }) => {
  const page = await app.open({
    saved: {
      v: 3,
      lang: 'en',
      masterVol: -4,
      muted: 'yes',
      reverb: 9,
      bpm: 999,
      data: { settings: { goal: 999999, newPerDay: -2, allowInv: 'yes', metronome: 1, drone: {}, earKeys: 'yes' } },
    },
  });
  expect(await page.evaluate(() => ({
    masterVol,
    muted,
    reverbWet,
    bpm: metro.bpm,
    settings: data.settings,
  }))).toEqual({
    masterVol: 0,
    muted: false,
    reverbWet: 0.5,
    bpm: 180,
    settings: { goal: 12, newPerDay: 5, allowInv: false, metronome: false, drone: false, earKeys: false },
  });
});

test('valid persisted settings are preserved', async ({ app }) => {
  const page = await app.open({
    saved: {
      v: 3,
      lang: 'en',
      masterVol: 0.37,
      muted: true,
      reverb: 0.3,
      bpm: 120,
      data: { settings: { goal: 24, newPerDay: 12, allowInv: true, metronome: true, drone: true, earKeys: true } },
    },
  });
  expect(await page.evaluate(() => ({
    masterVol,
    muted,
    reverbWet,
    bpm: metro.bpm,
    settings: data.settings,
  }))).toEqual({
    masterVol: 0.37,
    muted: true,
    reverbWet: 0.3,
    bpm: 120,
    settings: { goal: 24, newPerDay: 12, allowInv: true, metronome: true, drone: true, earKeys: true },
  });
});

test('display-only reading keyboards remain hidden from assistive technology', async ({ app }) => {
  const page = await app.open({ hash: 'read' });
  await page.evaluate(() => {
    const level = Object.values(RD_LV).find(level => level.ty === 'k2s');
    rdOpen(level);
    rdStart('practice');
  });
  await expect(page.locator('#rdx-kb')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#rdx-kb button')).toHaveCount(0);
});

test('play drills expose named keyboard buttons that support Enter', async ({ app }) => {
  const page = await app.open({ hash: 'read' });
  await page.evaluate(() => {
    const level = Object.values(RD_LV).find(level => level.ty === 'play');
    rdOpen(level);
    rdStart('practice');
  });
  const key = page.locator('#rdx-kb.inter button').first();
  await expect(key).toHaveAttribute('aria-label', /\S/);
  await key.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => RD.answered)).toBe(true);
});

test('Settings controls receive localized programmatic labels', async ({ app }) => {
  const page = await app.open();
  await page.locator('#settingsBtn').click();
  for (const id of ['deviceSelect', 'toneSel', 'set-goal', 'set-new', 'set-wake', 'set-synth', 'set-drone', 'set-metronome', 'set-inv']) {
    const control = page.locator('#' + id);
    await expect(control).toHaveAttribute('aria-labelledby', id + '-label');
    expect(await control.evaluate(el => document.getElementById(el.getAttribute('aria-labelledby'))?.textContent.trim())).toBeTruthy();
  }
  await expect(page.locator('#set-new')).toHaveAttribute('aria-describedby', 'set-new-help');
  const englishInputLabel = await page.locator('#deviceSelect').evaluate(el => document.getElementById(el.getAttribute('aria-labelledby')).textContent.trim());
  await page.locator('#set-lang button[data-v="ro"]').click();
  const romanianInputLabel = await page.locator('#deviceSelect').evaluate(el => document.getElementById(el.getAttribute('aria-labelledby')).textContent.trim());
  expect(romanianInputLabel).not.toBe(englishInputLabel);
});

test('leaving the window lets go of keys held on the computer keyboard or screen, and nothing else', async ({ app, page }) => {
  await app.open({ hash: 'accompany' });
  await page.evaluate(() => accompStart());
  const box = await page.locator('#keys .key.white[data-midi="67"]').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 10);
  await page.mouse.down();                                                                          // G4 on the screen
  await page.keyboard.down('a');                                                                    // C4 from the computer keyboard
  await page.evaluate(() => { midiIn(0x90, 64, 100, 'midi'); midiIn(0xB0, 64, 127, 'midi'); });    // E4 and the sustain pedal on a MIDI keyboard
  const state = () => page.evaluate(() => ({ accomp: accomp.on, held: heldMidis().sort((a, b) => a - b), pointer: pointerKey.size, typing: typingDown.size, pedal: pedalDown }));
  expect(await state()).toEqual({ accomp: true, held: [60, 64, 67], pointer: 1, typing: 1, pedal: true });

  // No key-up or pointer-up reaches an unfocused window: those keys are let go; the accompaniment, the MIDI key and the pedal stay.
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  expect(await state()).toEqual({ accomp: true, held: [64], pointer: 0, typing: 0, pedal: true });

  // A hidden tab still stops everything.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    delete document.hidden;
  });
  expect(await state()).toEqual({ accomp: false, held: [], pointer: 0, typing: 0, pedal: false });
  await page.mouse.up();
  await page.keyboard.up('a');
  expect(await state()).toEqual({ accomp: false, held: [], pointer: 0, typing: 0, pedal: false });
});

test.describe('daily goal and streak', () => {
  const y = todayN() - 1;
  const seeded = { streak: 3, bestStreak: 3, lastActive: y, todayDay: y, todayCount: 7, newToday: 2, totalReviews: 40, totalCorrect: 30, history: { [y]: 7 } };
  const saved = { v: 3, lang: 'en', data: { ...seeded, placed: true } };
  const counters = page => page.evaluate(() => {
    const pick = d => ({ streak: d.streak, bestStreak: d.bestStreak, lastActive: d.lastActive, todayDay: d.todayDay, todayCount: d.todayCount, newToday: d.newToday, totalReviews: d.totalReviews, totalCorrect: d.totalCorrect, history: d.history });
    return { mem: pick(data), stored: pick(JSON.parse(localStorage.getItem('ptt-v3')).data), cards: Object.values(data.srs).map(c => c.reps) };
  });

  test('a targeted drill changes neither the review schedule nor the daily goal or streak', async ({ app, page }) => {
    await app.open({ saved, hash: 'practice' });
    await page.locator('#pr-start').click();
    await page.evaluate(() => { for (let i = 0; i < 3; i++) { resolve(SES.q, i !== 1); nextQuestion(); } endSession(true); });
    expect(await counters(page)).toEqual({ mem: seeded, stored: seeded, cards: [] });
    expect(await page.evaluate(() => data.lastDrill)).toMatchObject({ c: 2, n: 3, day: todayN() });
    await expect(page.locator('#pr-last')).toContainText('2 / 3 correct');
  });

  test('regular reviews and placement answers still count toward the daily goal and streak', async ({ app, page }) => {
    await app.open({ saved });
    const T = todayN();
    await page.evaluate(() => { startSession(null); resolve(SES.q, true); endSession(false); });
    const reviewed = { streak: 4, bestStreak: 4, lastActive: T, todayDay: T, todayCount: 1, newToday: 1, totalReviews: 41, totalCorrect: 31, history: { [y]: 7, [T]: 1 } };
    expect(await counters(page)).toEqual({ mem: reviewed, stored: reviewed, cards: [1] });
    await page.evaluate(() => { startPlacement(); resolve(SES.q, true); endSession(false); });
    const placed = { ...reviewed, todayCount: 2, totalReviews: 42, totalCorrect: 32, history: { [y]: 7, [T]: 2 } };
    expect(await counters(page)).toMatchObject({ mem: placed, stored: placed });
  });
});

test.describe('several open tabs', () => {
  const T = todayN();
  const saved = { v: 3, lang: 'en', data: { streak: 2, bestStreak: 2, lastActive: T, todayDay: T, todayCount: 4, newToday: 0, totalReviews: 10, totalCorrect: 8, placed: true, history: { [T]: 4 } } };
  // A second tab shares the storage (and its `storage` events) and loads whatever the first tab saved.
  const openTab = async page => {
    const tab = await page.context().newPage(), errors = [];
    tab.on('pageerror', e => errors.push(e.message));
    await tab.goto(APP);
    await tab.waitForFunction(() => typeof window.show === 'function' && document.querySelector('#keys .key'));
    return { tab, errors };
  };
  const answer = page => page.evaluate(() => { if (SES.answered) { SES.idx++; nextQuestion(); } resolve(SES.q, true); });
  const record = page => page.evaluate(() => {
    const pick = d => ({ reviews: d.totalReviews, today: d.todayCount, cards: Object.keys(d.srs || {}).sort() }), s = JSON.parse(localStorage.getItem('ptt-v3'));
    return { mem: pick(data), stored: pick(s.data), gen: s.gen };
  });

  test('reviews saved in two tabs add up instead of overwriting each other, and a running session carries on', async ({ app, page }) => {
    await app.open({ saved });
    await page.evaluate(() => startSession(null));
    await answer(page);
    const { tab, errors } = await openTab(page);
    const queue = await page.evaluate(() => SES.queue.map(q => q.it.id));
    const other = await tab.evaluate(ids => { const id = ITEMS.find(it => !ids.includes(it.id)).id; reviewItem(id, true); return id; }, queue);
    await expect.poll(() => page.evaluate(id => !!data.srs[id], other)).toBe(true);
    await answer(page);
    const want = { reviews: 13, today: 7, cards: [...new Set([...queue.slice(0, 2), other])].sort() };
    await expect.poll(async () => { const a = await record(page), b = await record(tab); return [a.mem, a.stored, b.mem]; }).toEqual([want, want, want]);
    expect(await page.evaluate(() => SES.active)).toBe(true);
    await expect(page.locator('#syncNote')).toBeHidden();
    await expect(tab.locator('#syncNote')).toBeHidden();
    expect(errors).toEqual([]);
    await tab.close();
  });

  test('two saves that start from the same record retain both reviews', async ({ app, page }) => {
    await app.open({ saved });
    const { tab, errors } = await openTab(page);
    const [first, second] = await page.evaluate(() => ITEMS.slice(0, 2).map(it => it.id));

    await tab.evaluate(() => {
      window.__raceSyncPull = syncPull;
      syncPull = () => null;
    });
    await page.evaluate(id => reviewItem(id, true), first);
    expect(await tab.evaluate(() => data.totalReviews)).toBe(10);   // the held tab has not taken the other save in
    await tab.evaluate(id => {
      // Model the narrow race where this tab read the old record immediately before the other tab wrote.
      reviewItem(id, true);
      syncPull = window.__raceSyncPull;
      delete window.__raceSyncPull;
    }, second);

    const want = { reviews: 12, today: 6, cards: [first, second].sort() };
    await expect.poll(() => record(page)).toMatchObject({ mem: want, stored: want });
    await tab.evaluate(() => syncPull());
    await expect.poll(async () => { const a = await record(page), b = await record(tab); return [a.mem, a.stored, b.mem]; }).toEqual([want, want, want]);
    expect(errors).toEqual([]);
    await tab.close();
  });

  test('two simultaneous reviews of the same new card advance it twice but consume one new-card slot', async ({ app, page }) => {
    await app.open({ saved });
    const { tab, errors } = await openTab(page);
    const id = await page.evaluate(() => ITEMS[0].id);

    await tab.evaluate(() => {
      window.__raceSyncPull = syncPull;
      syncPull = () => null;
    });
    await page.evaluate(id => reviewItem(id, true), id);
    expect(await tab.evaluate(() => data.totalReviews)).toBe(10);   // the held tab has not taken the other save in
    await tab.evaluate(id => {
      reviewItem(id, true);
      syncPull = window.__raceSyncPull;
      delete window.__raceSyncPull;
    }, id);

    const want = { reviews: 12, correct: 10, today: 6, fresh: 1, card: { box: 2, ease: 2.4, reps: 2, lapses: 0, due: T + 2, last: T } };
    const state = p => p.evaluate(id => {
      const s = JSON.parse(localStorage.getItem('ptt-v3')).data;
      const pick = d => ({ reviews: d.totalReviews, correct: d.totalCorrect, today: d.todayCount, fresh: d.newToday, card: { ...d.srs[id], ease: Number(d.srs[id].ease.toFixed(2)) } });
      return { mem: pick(data), stored: pick(s) };
    }, id);
    await expect.poll(() => state(page)).toEqual({ mem: want, stored: want });
    await tab.evaluate(() => syncPull());
    await expect.poll(() => state(tab)).toEqual({ mem: want, stored: want });
    expect(errors).toEqual([]);
    await tab.close();
  });

  const hold = p => p.evaluate(() => { window.__raceSyncPull = syncPull; syncPull = () => null; });
  const release = p => p.evaluate(() => { syncPull = window.__raceSyncPull; delete window.__raceSyncPull; });
  const tally = (p, ids) => p.evaluate(ids => {
    const pick = d => ({ reviews: d.totalReviews, today: d.todayCount, fresh: d.newToday, reps: ids.map(id => d.srs[id] && d.srs[id].reps) });
    return { mem: pick(data), stored: pick(JSON.parse(localStorage.getItem('ptt-v3')).data) };
  }, ids);

  test('a review of a card first saved by another tab survives when both tabs then save at once', async ({ app, page }) => {
    await app.open({ saved });
    const { tab, errors } = await openTab(page);
    const id = await page.evaluate(() => ITEMS[0].id);

    await tab.evaluate(id => reviewItem(id, true), id);   // this tab takes the card in from the other tab's save
    await expect.poll(() => page.evaluate(id => !!data.srs[id], id)).toBe(true);
    await hold(tab);
    await page.evaluate(id => reviewItem(id, true), id);
    expect(await tab.evaluate(() => data.totalReviews)).toBe(11);   // the held tab has not taken the other save in
    await tab.evaluate(id => { reviewItem(id, true); syncPull = window.__raceSyncPull; delete window.__raceSyncPull; }, id);

    const want = { reviews: 13, today: 7, fresh: 1, reps: [3] };
    await expect.poll(async () => { const a = await tally(page, [id]), b = await tally(tab, [id]); return [a.mem, a.stored, b.mem]; }).toEqual([want, want, want]);
    expect(errors).toEqual([]);
    await tab.close();
  });

  test('a save that two tabs merge at the same time is counted once', async ({ app, page }) => {
    await app.open({ saved });
    const b = await openTab(page), c = await openTab(page);
    const ids = await page.evaluate(() => ITEMS.slice(0, 2).map(it => it.id));

    await hold(b.tab);                                     // B misses A's save, which C takes in
    await page.evaluate(id => reviewItem(id, true), ids[0]);
    await expect.poll(() => c.tab.evaluate(id => !!data.srs[id], ids[0])).toBe(true);
    await hold(page);
    await hold(c.tab);
    await b.tab.evaluate(id => reviewItem(id, true), ids[1]);
    await release(b.tab);
    // A and C both read B's save; A's merged save lands first, and B takes it in before C's lands.
    await c.tab.evaluate(() => window.__raceSyncPull());
    await release(page);
    await page.evaluate(() => saveAll());
    await expect.poll(() => b.tab.evaluate(id => !!data.srs[id], ids[0])).toBe(true);
    await c.tab.evaluate(() => syncWrite());
    await release(c.tab);

    const want = { reviews: 12, today: 6, fresh: 2, reps: [1, 1] };
    await expect.poll(async () => {
      const [x, y, z] = await Promise.all([page, b.tab, c.tab].map(p => tally(p, ids)));
      return [x.mem, x.stored, y.mem, z.mem];
    }).toEqual([want, want, want, want]);
    expect([...b.errors, ...c.errors]).toEqual([]);
    await b.tab.close();
    await c.tab.close();
  });

  test('a reset in another tab is adopted with a notice, the session goes on, and an older record cannot overwrite it', async ({ app, page }) => {
    await app.open({ saved });
    await page.evaluate(() => startSession(null));
    await answer(page);
    const { tab, errors } = await openTab(page);
    const gen = await tab.evaluate(() => { window.confirm = () => true; $('resetBtn').click(); return SYNC.gen; });
    expect(gen).not.toBe('');
    await expect(page.locator('#syncNote')).toBeVisible();
    expect(await page.evaluate(() => ({ reviews: data.totalReviews, gen: SYNC.gen, session: SES.active }))).toEqual({ reviews: 0, gen, session: true });

    await answer(page);   // the session saves into the adopted record
    expect(await record(page)).toMatchObject({ mem: { reviews: 1, today: 1 }, stored: { reviews: 1, today: 1 }, gen });

    // A tab still holding the record from before the reset saves it: this tab puts the newer one back.
    await tab.evaluate(() => localStorage.setItem('ptt-v3', JSON.stringify({ v: 3, gen: '', lang: 'en', data: { totalReviews: 99 } })));
    await expect.poll(async () => { const r = await record(page); return { gen: r.gen, reviews: r.stored.reviews }; }).toEqual({ gen, reviews: 1 });

    await page.locator('#syncNoteBtn').click();
    await expect(page.locator('#syncNote')).toBeHidden();
    expect(errors).toEqual([]);
    await tab.close();
  });

  test('a theme change in another tab applies at once; a language change waits until this tab\'s session ends', async ({ app, page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await app.open({ saved });
    await page.evaluate(() => startSession(null));
    const { tab, errors } = await openTab(page);
    await tab.evaluate(() => { theme = 'dark'; applyTheme(); saveAll(); });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await tab.evaluate(() => setLang('ro'));
    await expect.poll(() => page.evaluate(() => SYNC.pend.lang && SYNC.pend.lang.v)).toBe('ro');
    expect(await page.evaluate(() => lang)).toBe('en');   // no re-render in the middle of the session
    await answer(page);                                   // this tab saves meanwhile and keeps the other tab's choice
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ptt-v3')).lang)).toBe('ro');

    await page.evaluate(() => endSession(false));
    await expect.poll(() => page.evaluate(() => lang), { timeout: 5000 }).toBe('ro');
    await expect(page.locator('#pr-start')).toHaveText('Începe exersarea');
    expect(errors).toEqual([]);
    await tab.close();
  });
});

test('the computer-keyboard piano follows physical key positions, whatever the layout prints on them', async ({ app }) => {
  const page = await app.open({ hash: 'explore' });
  const r = await page.evaluate(() => {
    const send = (type, key, code, target = document) => target.dispatchEvent(new KeyboardEvent(type, { key, code, bubbles: true }));
    const out = {};
    send('keydown', 'z', 'KeyY'); out.qwertzZ = heldMidis();       // German Z sits where QWERTY has Y: A♭4, not an octave change
    send('keyup', 'z', 'KeyY'); out.released = heldMidis();
    send('keydown', 'y', 'KeyZ'); send('keyup', 'y', 'KeyZ');      // German Y sits where QWERTY has Z: octave down
    out.octave = typeOctave;
    send('keydown', 'q', 'KeyA'); out.azertyQ = heldMidis();       // French Q sits where QWERTY has A: C, an octave lower now
    send('keyup', 'q', 'KeyA');
    send('keydown', 'a', 'KeyQ'); out.azertyA = heldMidis();       // French A sits where QWERTY has Q: not a piano key
    send('keyup', 'a', 'KeyQ');
    const input = document.createElement('input');
    document.body.appendChild(input); input.focus();
    send('keydown', 'a', 'KeyA', input); out.typingInField = heldMidis();
    send('keyup', 'a', 'KeyA', input); input.remove();
    send('keydown', 'x', 'KeyX'); send('keyup', 'x', 'KeyX'); out.restored = typeOctave;
    releaseLiveInput();
    return out;
  });
  expect(r).toEqual({ qwertzZ: [68], released: [], octave: 48, azertyQ: [48], azertyA: [], typingInField: [], restored: 60 });
});

test('shortcut hints name the octave keys as the layout prints them', async ({ app, page }) => {
  await page.addInitScript(() => {
    const qwertz = new Map([['KeyA', 'a'], ['KeyK', 'k'], ['KeyY', 'z'], ['KeyZ', 'y'], ['KeyX', 'x']]);
    Object.defineProperty(navigator, 'keyboard', { configurable: true, value: { getLayoutMap: () => Promise.resolve(qwertz) } });
  });
  await app.open({ hash: 'analysis' });
  const pop = page.locator('#an-keys-pop');
  await expect(pop.locator('kbd[data-codes="KeyZ KeyX"]')).toHaveText('Y / X');
  await expect(page.locator('#helpBox kbd[data-codes="KeyZ KeyX"]')).toHaveText('Y / X');
  await expect(pop.locator('dd[data-i18n="ks_play"]')).toHaveText('Play notes');
});

test('unused leftovers stay removed', () => {
  const html = readFileSync(new URL('../' + APP, import.meta.url), 'utf8');
  for (const name of ['catSing', 'RO_CAT1', 'previewGeneration', 'hasRh']) expect(html, name).not.toMatch(new RegExp('\\b' + name + '\\b'));
  const demoBeat = html.slice(html.indexOf('function demoBeat('));
  expect(demoBeat.slice(0, demoBeat.indexOf('\n'))).not.toMatch(/\bacc\b/);
});

test('the fixed keyboard dock never covers the end of the page, whatever its measured height', async ({ app, page }) => {
  await app.open({ hash: 'explore' });
  // Scrolled to the very end, the footer must end at or above the dock's top edge, and --dock-h must match the dock.
  const fits = () => page.evaluate(async () => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const dock = $('dock').getBoundingClientRect(), foot = document.querySelector('footer').getBoundingClientRect();
    return { kb: document.body.classList.contains('kb'), synced: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dock-h')) === Math.round(dock.height), clear: foot.bottom <= dock.top + 1 };
  });
  const ok = { kb: true, synced: true, clear: true };
  for (const [width, height] of [[320, 640], [1024, 640]]) {
    await page.setViewportSize({ width, height });
    for (const v of ['explore', 'learn']) {
      await page.evaluate(v => show(v), v);
      await expect.poll(fits, `${v} at ${width}px`).toEqual(ok);
      // A padding-only change (as a safe-area inset makes) grows the dock without resizing its content box.
      await page.evaluate(() => { $('dock').style.paddingBottom = '120px'; });
      await expect.poll(fits, `${v} at ${width}px with a taller dock`).toEqual(ok);
      // In-page scrolling stops above the dock too.
      const probe = await page.evaluate(async v => {
        const p = document.createElement('div'); p.style.height = '40px'; p.textContent = 'probe';
        $('view-' + v).appendChild(p); window.scrollTo(0, 0); p.scrollIntoView({ block: 'nearest' });
        await new Promise(r => requestAnimationFrame(r));
        const below = p.getBoundingClientRect().bottom <= $('dock').getBoundingClientRect().top + 1;
        p.remove(); return below;
      }, v);
      expect(probe, `${v} at ${width}px: scrolled-to content clears the dock`).toBe(true);
      await page.evaluate(() => { $('dock').style.paddingBottom = ''; });
    }
  }
});

test.describe('sound locked by the browser', () => {
  const midiNote = (page, m) => page.evaluate(m => { midiIn(0x90, m, 90, 'midi'); midiIn(0x80, m, 0, 'midi'); }, m);

  test('a MIDI note while audio stays locked shows a notice whose button retries; it goes only once sound runs', async ({ app, page }) => {
    await app.open();
    await page.evaluate(async () => { ensureAudio(); await actx.suspend(); actx.resume = () => new Promise(() => {}); });   // the browser refuses to resume
    await midiNote(page, 60);
    await expect(page.locator('#audioLock')).toBeVisible();
    await expect(page.locator('#audioLock')).toContainText('Sound is off');
    await page.locator('#audioLockBtn').click();
    await page.waitForTimeout(400);
    await expect(page.locator('#audioLock')).toBeVisible();   // still locked: the notice does not claim otherwise
    expect(await page.evaluate(() => actx.state)).toBe('suspended');
    await page.evaluate(() => { delete actx.resume; });     // now the gesture is honoured
    await page.locator('#audioLockBtn').click();
    await expect(page.locator('#audioLock')).toBeHidden();
    expect(await page.evaluate(() => actx.state)).toBe('running');
  });

  test('no notice while sound runs, or when the built-in sound is switched off', async ({ app, page }) => {
    await app.open();
    await page.evaluate(async () => { ensureAudio(); await actx.resume(); });
    await midiNote(page, 60);
    await page.waitForTimeout(500);
    await expect(page.locator('#audioLock')).toBeHidden();
    await page.evaluate(async () => { localSynth = false; await actx.suspend(); actx.resume = () => new Promise(() => {}); });
    await midiNote(page, 62);
    await page.waitForTimeout(500);
    await expect(page.locator('#audioLock')).toBeHidden();
  });
});

test.describe('reduced motion', () => {
  for (const reduce of [true, false]) {
    test(`Explore previews, the dock and the sing-along pulse ${reduce ? 'hold still' : 'animate'} with ${reduce ? 'reduced' : 'normal'} motion`, async ({ app, page }) => {
      await page.emulateMedia({ reducedMotion: reduce ? 'reduce' : 'no-preference' });
      await page.addInitScript(() => { if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError')); });
      await app.open({ hash: 'explore' });
      const r = await page.evaluate(() => {
        playChordMidis([60, 64, 67], true);                  // an arpeggio lights its notes one by one
        const preview = [...explorePreview];
        dockSet(false); dockSet(true);                       // the keys rise out of the rail
        return { preview, rising: $('dock').classList.contains('is-opening') };
      });
      expect(r).toEqual(reduce ? { preview: [60, 64, 67], rising: false } : { preview: [60], rising: true });

      await page.evaluate(() => show('sing'));
      await page.locator('#si-mode button[data-v="note"]').click();
      const pulse = await page.evaluate(() => { const g = document.querySelector('#si-staff .ss-n[data-i="1"]'); ssFlash(1); return g.getAttribute('data-s'); });
      expect(pulse).toBe(reduce ? null : 'now');
      // The essential marker of the note to play next still shows.
      await page.evaluate(() => { singStopAll(); singGo(); });
      await expect(page.locator('#si-staff .ss-n[data-i="0"]')).toHaveAttribute('data-s', 'now');
      await page.evaluate(() => singStopAll());
    });
  }
});
