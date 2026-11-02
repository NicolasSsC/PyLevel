const { chromium } = require('../../pyLevel/node_modules/@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: {width: 1100, height: 880}, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(path.join(__dirname,'html-report/index.html')).href);
  await page.getByText('Passed', { exact: false }).first().waitFor({timeout: 15000});
  await page.waitForTimeout(500);
  fs.mkdirSync(path.join(__dirname,'evidence'),{recursive:true});
  await page.screenshot({path:path.join(__dirname,'evidence','01_reporte_playwright.png'),fullPage:true});
  fs.writeFileSync(path.join(__dirname,'report-visible.txt'),await page.locator('body').innerText());
  console.log(JSON.stringify({browser:browser.version(),reportScreenshot:'evidence/01_reporte_playwright.png'}));
  await browser.close();
})().catch(error => {console.error(error);process.exit(1)});
