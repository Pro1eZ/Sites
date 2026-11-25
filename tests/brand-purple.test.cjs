const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { Script } = require('node:vm');
const { test } = require('node:test');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'https://trailrig.app';
const PURPLE = 'rgb(140, 82, 255)';
const PAGES = [
  ['index.html', '/', '.nav-links a.active'],
  ['contact.html', '/contact.html', '.legal a[href^="mailto:"]:not([style])'],
  ['faq.html', '/faq.html', '.faq details a'],
  ['privacy.html', '/privacy.html', '.legal a[href^="mailto:"]'],
  ['terms.html', '/terms.html', '.legal a[href^="mailto:"]'],
  ['status.html', '/status.html', '.nav-back'],
  ['changelog.html', '/changelog.html', '.nav-links a.active'],
  ['b/index.html', '/b/', '#wrap a'],
  ['404.html', '/missing/deep/path', '#wrap a'],
];
const BIKE = {
  publicID: 'brand-test', name: 'Trail bike', brand: 'Example', model: 'Trail',
  year: 2026, bikeType: 'MTB', bikeSubtype: 'Trail', showBikeSpecs: true,
  showPhotos: true, photoAlbumURL: 'https://example.com/photos',
  ownerName: 'Rider', ownerEmail: 'rider@example.com', ownerPhone: '+123456789',
  visibility: 'fullBuild', components: ['Frame|Frame — Example Trail'],
  showSerials: true, serials: ['Frame — Example Trail: TEST123'],
  showComponentPrices: true, componentPrices: ['Frame|Frame — €1,000'],
  showOdometer: true, odometerKm: 100, forkHours: 5, shockHours: 3,
  contact: 'Example notes', parts: [], updatedAt: 1795564800000,
  isForSale: false, stolen: false,
};
const STATUS = {
  kvAvailable: true, eventsKvAvailable: true, eventsBackupAvailable: true,
  bikeRegistryAvailable: true, bikeRegistryBackupAvailable: true,
  environment: 'test', checkedAt: 1795564800000,
  stores: [{ label: 'Partner store', enabled: true }],
};

function localPath(url) {
  assert.equal(url.origin, ORIGIN, 'stylesheet/script must stay same-origin');
  const file = path.resolve(ROOT, '.' + decodeURIComponent(url.pathname));
  assert.ok(file.startsWith(ROOT + path.sep), 'resource must stay within Sites');
  return file;
}

// Load REAL linked CSS at its markup position, preserving cascade order. No palette
// resolver/shim: jsdom computes variables, alpha colors, gradients, and focus itself.
// External resources are never fetched; only API responses are mocked below.
async function page(file, pathname, options = {}) {
  const dom = new JSDOM(readFileSync(path.join(ROOT, file), 'utf8'), {
    url: ORIGIN + pathname, runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const { window } = dom;
  try {
    for (const link of window.document.querySelectorAll('link[rel="stylesheet"]')) {
      if (options.blockStylesheet) continue; // Simulate only a failed stylesheet request.
      const style = window.document.createElement('style');
      style.textContent = readFileSync(localPath(new URL(link.href)), 'utf8');
      link.after(style);
    }
    window.fetch = async () => {
      if (options.networkError) throw new TypeError('Network unavailable');
      const notFound = options.notFound || (file === '404.html' && !pathname.startsWith('/b/'));
      return {
        ok: !notFound, status: notFound ? 404 : 200,
        json: async () => options.bike || STATUS,
      };
    };
    for (const script of window.document.querySelectorAll('script')) {
      if (script.type === 'application/ld+json') continue;
      if (script.src) {
        if (new URL(script.src).origin === ORIGIN) {
          window.eval(readFileSync(localPath(new URL(script.src)), 'utf8'));
        }
      } else {
        window.eval(script.textContent);
      }
    }
    // Let actual async render/load chains finish (without replacing their logic).
    await new Promise(resolve => setImmediate(resolve));
    return dom;
  } catch (error) {
    window.close();
    throw error;
  }
}

function computed(dom, selector) {
  const element = dom.window.document.querySelector(selector);
  assert.ok(element, 'expected real page element: ' + selector);
  return dom.window.getComputedStyle(element);
}

for (const [file, pathname, linkSelector] of PAGES) {
  test(file + ': computed shared root colors and RGB tint use canonical purple', async t => {
    const dom = await page(file, pathname);
    t.after(() => dom.window.close());
    const root = dom.window.getComputedStyle(dom.window.document.documentElement);
    for (const token of ['--brand-purple', '--purple', '--purple2']) {
      assert.equal(root.getPropertyValue(token).trim().toUpperCase(), '#8C52FF', token);
    }
    // Exercise the RGB token in the CSS engine, not a copied RGB converter.
    const probe = dom.window.document.createElement('span');
    probe.style.backgroundColor = 'rgba(var(--brand-purple-rgb), 0.2)';
    dom.window.document.body.append(probe);
    assert.equal(dom.window.getComputedStyle(probe).backgroundColor, 'rgba(140, 82, 255, 0.2)');
  });

  test(file + ': brand link/solid CTA renders canonical purple', async t => {
    const dom = await page(file, pathname);
    t.after(() => dom.window.close());
    const style = computed(dom, linkSelector);
    assert.equal(file === 'b/index.html' ? style.backgroundColor : style.color, PURPLE);
    if (file === 'contact.html') {
      assert.equal(computed(dom, '.legal a[style]').backgroundColor, PURPLE);
    }
    if (file === 'changelog.html') {
      assert.equal(computed(dom, '.badge-new').backgroundColor, PURPLE);
    }
    if (file === 'index.html') {
      assert.equal(computed(dom, '.tag.purple').color, PURPLE);
      assert.equal(computed(dom, '.tag.purple').borderTopColor, PURPLE);
      assert.equal(computed(dom, '.price-tag').backgroundImage,
        'linear-gradient(135deg, rgb(140, 82, 255), rgb(140, 82, 255))');
      assert.equal(computed(dom, '.hero h1 span').backgroundImage,
        'linear-gradient(135deg, rgb(140, 82, 255), rgb(140, 82, 255))');
    }
  });

  test(file + ': theme metadata is canonical purple', async t => {
    const dom = await page(file, pathname);
    t.after(() => dom.window.close());
    assert.equal(dom.window.document.querySelector('meta[name="theme-color"]')?.content.toUpperCase(), '#8C52FF');
  });

  test(file + ': brand link/CTA fallback stays purple if shared stylesheet fails to load', async t => {
    const dom = await page(file, pathname, { blockStylesheet: true });
    t.after(() => dom.window.close());
    const style = computed(dom, linkSelector);
    assert.equal(file === 'b/index.html' ? style.backgroundColor : style.color, PURPLE);
    if (file === 'contact.html') assert.equal(computed(dom, '.legal a[style]').backgroundColor, PURPLE);
  });

  test(file + ': shared stylesheet resolves from its real public path and CSP permits it', async t => {
    const dom = await page(file, pathname);
    t.after(() => dom.window.close());
    const links = [...dom.window.document.querySelectorAll('link[rel="stylesheet"]')];
    assert.equal(links.length, 1, 'one shared brand stylesheet per page');
    assert.equal(new URL(links[0].href).pathname, '/brand.css');
    assert.ok(readFileSync(localPath(new URL(links[0].href)), 'utf8').length > 0);
    const csp = dom.window.document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content;
    if (csp) {
      const styleDirective = csp.split(';').map(s => s.trim()).find(s => s.startsWith('style-src '));
      assert.ok(styleDirective.split(/\s+/).includes("'self'"), 'CSP must allow local CSS');
    }
  });

  test(file + ': keyboard focus outline computes canonical purple', async t => {
    const dom = await page(file, pathname);
    t.after(() => dom.window.close());
    const link = dom.window.document.querySelector('a[href]');
    link.focus();
    assert.ok(link.matches(':focus-visible'));
    assert.equal(dom.window.getComputedStyle(link).outlineColor, PURPLE);
  });
}

test('homepage: real Pro borders and gradient alpha tints retain canonical RGB', async t => {
  const dom = await page('index.html', '/');
  t.after(() => dom.window.close());
  assert.equal(computed(dom, '.feature-card.pro').borderTopColor, 'rgba(140, 82, 255, 0.3)');
  assert.equal(computed(dom, '.pro-section').borderTopColor, 'rgba(140, 82, 255, 0.2)');
  assert.equal(computed(dom, '.pro-section').backgroundImage,
    'linear-gradient(135deg, rgba(140, 82, 255, 0.08), rgba(140, 82, 255, 0.05))');
});

test('FAQ: actual tip background and border retain canonical tint RGB', async t => {
  const dom = await page('faq.html', '/faq.html');
  t.after(() => dom.window.close());
  assert.equal(computed(dom, '.faq .tip').backgroundColor, 'rgba(140, 82, 255, 0.08)');
  assert.equal(computed(dom, '.faq .tip').borderLeftColor, PURPLE);
});

for (const file of ['b/index.html', '404.html']) {
  test(file + ': bare /b/ landing generates a canonical solid brand CTA', async t => {
    const dom = await page(file, '/b/');
    t.after(() => dom.window.close());
    assert.equal(computed(dom, '#wrap a[href="/"]').backgroundColor, PURPLE);
  });

  test(file + ': real bike success renderer produces purple photo CTA, owner link and tints', async t => {
    const dom = await page(file, '/b/brand-test', { bike: BIKE });
    t.after(() => dom.window.close());
    assert.equal(computed(dom, '.photobtn').backgroundColor, PURPLE);
    assert.equal(computed(dom, 'a[href="mailto:rider@example.com"]').color, PURPLE);
    assert.equal(computed(dom, 'h2').color, PURPLE);
    assert.equal(computed(dom, '.wrap-card').borderTopColor, 'rgba(140, 82, 255, 0.2)');
    assert.equal(computed(dom, '.site-header').borderBottomColor, 'rgba(140, 82, 255, 0.15)');
    assert.equal(computed(dom, '.badge-reg').color, 'rgb(48, 209, 88)');
    // Also parse inline handlers generated by real rendering.
    for (const element of dom.window.document.querySelectorAll('[onclick], [onerror]')) {
      for (const name of ['onclick', 'onerror']) {
        if (element.hasAttribute(name)) new Function('event', element.getAttribute(name));
      }
    }
  });

  for (const [branch, options] of [['not found', { notFound: true }], ['network error', { networkError: true }]]) {
    test(file + ': generated ' + branch + ' return CTA uses canonical purple', async t => {
      const dom = await page(file, '/b/brand-test', options);
      t.after(() => dom.window.close());
      assert.equal(computed(dom, '#wrap a[href="/"]').color, PURPLE);
      assert.equal(dom.window.document.querySelector('#wrap h1').textContent, 'Bike not found');
    });
  }

  for (const [mode, bike, photo, link, border] of [
    ['sale', { ...BIKE, isForSale: true }, 'rgb(212, 160, 23)', 'rgb(232, 184, 48)', 'rgba(212, 160, 23, 0.55)'],
    ['stolen', { ...BIKE, stolen: true, isForSale: true }, 'rgb(255, 69, 58)', 'rgb(255, 154, 146)', 'rgba(255, 69, 58, 0.55)'],
  ]) {
    test(file + ': ' + mode + ' semantic CTA/link/border colors are not rebranded', async t => {
      const dom = await page(file, '/b/brand-test', { bike });
      t.after(() => dom.window.close());
      assert.equal(computed(dom, '.photobtn').backgroundColor, photo);
      assert.equal(computed(dom, 'a[href="mailto:rider@example.com"]').color, link);
      assert.equal(computed(dom, '.wrap-card').borderTopColor, border);
    });
  }
}

for (const [branch, options, selector] of [
  ['success', {}, '#updated-at a'],
  ['network error', { networkError: true }, '.error-box a'],
]) {
  test('status: actual ' + branch + ' renderer uses purple refresh/retry link', async t => {
    const dom = await page('status.html', '/status.html', options);
    t.after(() => dom.window.close());
    assert.equal(computed(dom, selector).color, PURPLE);
    if (branch === 'success') {
      assert.equal(computed(dom, '.badge-green').color, 'rgb(48, 209, 88)');
      assert.equal(computed(dom, '.badge-green').backgroundColor, 'rgba(48, 209, 88, 0.15)');
    }
  });
}

for (const [file] of PAGES) {
  test(file + ': actual inline scripts and handlers parse without syntax errors', () => {
    const dom = new JSDOM(readFileSync(path.join(ROOT, file), 'utf8'));
    try {
      for (const script of dom.window.document.querySelectorAll('script:not([src])')) {
        if (script.type === 'application/ld+json') JSON.parse(script.textContent);
        else new Script(script.textContent, { filename: file });
      }
      for (const element of dom.window.document.querySelectorAll('*')) {
        for (const attribute of element.attributes) {
          if (attribute.name.startsWith('on')) new Function('event', attribute.value);
        }
      }
    } finally {
      dom.window.close();
    }
  });
}
