const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const JARS = [
  // Вартові слова
  { id: '2XrzwMqePn', student: 'Олександр Балук',                  grade: '8',  category: 'Вартові слова' },
  { id: 'W6XwXiXi3',  student: 'Марія Горбоконь',                  grade: '6',  category: 'Вартові слова' },
  { id: '922kecxCQw', student: 'Аріна Яременко',                   grade: '7',  category: 'Вартові слова' },
  { id: '8XPX4oyhHq', student: 'Міла Затолокіна',                  grade: '5',  category: 'Вартові слова' },
  { id: '5QTG83y6eG', student: 'Поліна Маршавіна',                 grade: '11', category: 'Вартові слова' },
  // Вартові життя
  { id: '4anJ7oFxgJ', student: 'Дарія Бондар та Мілана Колесник',  grade: '5',  category: 'Вартові життя' },
  { id: '9BfZTQ2n4q', student: 'Остап Боднарчук',                  grade: '8',  category: 'Вартові життя' },
  // Вартові духу
  { id: '7KSGo48SLf', student: 'Ольга Шрамко',                     grade: '5',  category: 'Вартові духу' },
  { id: 'AXA934Q9Kv', student: 'Ольга Кузьменко',                  grade: '7',  category: 'Вартові духу' },
  { id: '96hkTy4SJk', student: 'Міла Затолокіна',                  grade: '5',  category: 'Вартові духу' },
  { id: '2g5RzDYKxc', student: 'Єва Ковальова',                    grade: '7',  category: 'Вартові духу' },
  { id: 'ADjkdb6bEk', student: 'Глєб Федьков',                     grade: '9',  category: 'Вартові духу' },
  { id: 'cubfarQkJ',  student: 'Софія Гук',                        grade: '5',  category: 'Вартові духу' },
  { id: '7ZEmbjBYx4', student: 'Наталія Матвєєва',                 grade: '5',  category: 'Вартові духу' },
  { id: '7doAjBszk9', student: 'Яромир Гацько',                    grade: '7',  category: 'Вартові духу' },
  // Вартові логіки
  { id: '1bwGnTwRm',  student: 'Олександр Шейн',                   grade: '8',  category: 'Вартові логіки' },
  { id: '9CHe2a9Wz',  student: 'Євгенія Новік',                    grade: '7',  category: 'Вартові логіки' },
  { id: '3ZB3YtdSvB', student: 'Любомир Пушняк',                   grade: '5',  category: 'Вартові логіки' },
  { id: 'stHiibiKi',  student: 'Софія Волощук',                    grade: '7',  category: 'Вартові логіки' },
];

function parseAmount(text) {
  if (!text) return null;
  const num = parseInt(text.replace(/[\s ]/g, '').replace('₴', '').replace(',', ''));
  return isNaN(num) ? null : num;
}

async function scrapeJar(browser, jarId) {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'uk-UA',
  });
  const page = await context.newPage();

  try {
    await page.goto(`https://send.monobank.ua/jar/${jarId}`, {
      waitUntil: 'networkidle',
      timeout: 40000,
    });

    // Wait for amount element or h1 to appear (more robust than window.conf)
    await page.waitForSelector('h1, .stats-data-value, .jarTitle', {
      timeout: 20000,
    }).catch(() => null);

    await page.waitForTimeout(500);

    return await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const ownerSpan = document.querySelector('.jarOwnerInfo span');
      const amountEls = [...document.querySelectorAll('.stats-data-value')];
      return {
        jarName:   h1        ? h1.textContent.trim()        : null,
        ownerName: ownerSpan ? ownerSpan.textContent.trim() : null,
        amountText: amountEls[0] ? amountEls[0].textContent.trim() : null,
        goalText:   amountEls[1] ? amountEls[1].textContent.trim() : null,
        error: null,
      };
    });
  } catch (err) {
    return { jarName: null, ownerName: null, amountText: null, goalText: null, error: err.message };
  } finally {
    await context.close();
  }
}

async function main() {
  console.log('=== Стожари змін — scraper ===\n');

  const outputPath = path.join(__dirname, 'data', 'jars.json');

  let prevById = {};
  if (fs.existsSync(outputPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      for (const j of prev.jars || []) prevById[j.id] = j;
    } catch (_) {}
  }

  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const jar of JARS) {
    process.stdout.write(`${jar.student} (${jar.id})... `);
    const scraped = await scrapeJar(browser, jar.id);

    let amountNum = parseAmount(scraped.amountText);
    let goalNum   = parseAmount(scraped.goalText);

    // On error keep previous successful value
    if (scraped.error && prevById[jar.id]) {
      amountNum         = prevById[jar.id].amountNum  ?? amountNum;
      scraped.amountText = prevById[jar.id].amountText ?? scraped.amountText;
      goalNum           = prevById[jar.id].goalNum    ?? goalNum;
      scraped.goalText   = prevById[jar.id].goalText  ?? scraped.goalText;
    }

    console.log(scraped.error ? `ERROR: ${scraped.error}` : (scraped.amountText || 'no data'));

    results.push({
      ...jar,
      jarUrl: `https://send.monobank.ua/jar/${jar.id}`,
      jarName:    scraped.jarName,
      ownerName:  scraped.ownerName,
      amountText: scraped.amountText,
      amountNum,
      goalText:   scraped.goalText,
      goalNum,
      hasError:   !!scraped.error,
      updatedAt:  new Date().toISOString(),
    });
  }

  await browser.close();

  const output = { updatedAt: new Date().toISOString(), jars: results };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');

  const ok    = results.filter(r => r.amountNum !== null);
  const total = ok.reduce((s, r) => s + r.amountNum, 0);

  // Append history snapshot
  const historyPath = path.join(__dirname, 'data', 'history.json');
  let history = { snapshots: [] };
  if (fs.existsSync(historyPath)) {
    try { history = JSON.parse(fs.readFileSync(historyPath, 'utf8')); } catch (_) {}
  }
  history.snapshots.push({
    ts: new Date().toISOString(),
    total,
    byId: Object.fromEntries(results.map(r => [r.id, r.amountNum])),
  });
  if (history.snapshots.length > 336) history.snapshots = history.snapshots.slice(-336);
  fs.writeFileSync(historyPath, JSON.stringify(history), 'utf8');

  console.log(`\n✓ ${ok.length}/${results.length} банок зібрано`);
  console.log(`Загалом: ${total.toLocaleString('uk-UA')} ₴`);
}

main().catch(err => { console.error(err); process.exit(1); });
