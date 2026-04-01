const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ── Tiny static file server ───────────────────────────────────
function startServer(dir, port) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let filePath = path.join(dir, req.url === '/' ? 'index.html' : req.url);
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        const ext = path.extname(filePath).toLowerCase();
        const types = { '.html': 'text/html', '.css': 'text/css',
                        '.js': 'application/javascript', '.mp4': 'video/mp4',
                        '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
        res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(port, () => resolve(server));
  });
}

async function verify() {
  const PORT = 3131;
  const SHOTS_DIR = path.join(__dirname, 'screenshots');
  fs.mkdirSync(SHOTS_DIR, { recursive: true });

  const server = await startServer(__dirname, PORT);
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle0' });

  // ── 1. Full page ─────────────────────────────────────────────
  await page.screenshot({ path: `${SHOTS_DIR}/01-full-page.png`, fullPage: true });
  console.log('📸 01-full-page.png');

  // ── 2. Footer — scroll to bottom, crop to footer area ────────
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise(r => setTimeout(r, 400));

  const footerClip = await page.evaluate(() => {
    const f = document.querySelector('footer');
    const r = f.getBoundingClientRect();
    const scrollY = window.scrollY;
    return { x: r.width * 0.55, y: r.top + scrollY - 80, width: r.width * 0.45, height: r.height + 100 };
  });

  await page.screenshot({ path: `${SHOTS_DIR}/02-footer-default.png`, clip: footerClip });
  console.log('📸 02-footer-default.png');

  // ── 3. Footer CTA tab — force expanded via JS ─────────────────
  await page.evaluate(() => {
    const t = document.querySelector('.site-cta-tab');
    t.style.transition = 'none';
    t.style.transform = 'translateY(0)';
    document.querySelector('.footer-wrap').style.clipPath = 'inset(-220px 0 0 0)';
  });
  await new Promise(r => setTimeout(r, 150));
  const expandedClip = { ...footerClip, y: footerClip.y - 200, height: footerClip.height + 200 };
  await page.screenshot({ path: `${SHOTS_DIR}/03-footer-cta-hover.png`, clip: expandedClip });
  console.log('📸 03-footer-cta-hover.png');

  // ── 4. Reset resting ──────────────────────────────────────────
  await page.evaluate(() => {
    const t = document.querySelector('.site-cta-tab');
    t.style.transition = '';
    t.style.transform = '';
    document.querySelector('.footer-wrap').style.clipPath = '';
  });
  await new Promise(r => setTimeout(r, 150));
  await page.screenshot({ path: `${SHOTS_DIR}/04-footer-cta-resting.png`, clip: footerClip });
  console.log('📸 04-footer-cta-resting.png');

  // ── 4. Products section ───────────────────────────────────────
  const products = await page.$('#products');
  if (products) {
    await products.evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'start' }));
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: `${SHOTS_DIR}/05-products.png` });
    console.log('📸 05-products.png');

    // Peek card hover
    const peek = await page.$('.product-peek');
    if (peek) {
      await peek.hover();
      await new Promise(r => setTimeout(r, 500));
      await page.screenshot({ path: `${SHOTS_DIR}/06-products-peek-hover.png` });
      console.log('📸 06-products-peek-hover.png');
    }
  }

  await browser.close();
  server.close();
  console.log(`\nDone. Screenshots saved to: ${SHOTS_DIR}`);
}

verify().catch(err => { console.error(err); process.exit(1); });
