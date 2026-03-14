const { chromium } = require('playwright');

const TARGET_URL = 'http://localhost:5173';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Taking dashboard-1080p.png...');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(TARGET_URL);
  await page.waitForTimeout(2000); // Wait for animations/data to load
  await page.screenshot({ path: 'C:\\Users\\yannb\\finance\\output\\dashboard-1080p.png' });
  
  console.log('Taking mobile-overview.png...');
  await page.setViewportSize({ width: 390, height: 844 }); // standard mobile
  await page.reload();
  await page.waitForTimeout(2000); // Wait for mobile layout/data
  await page.screenshot({ path: 'C:\\Users\\yannb\\finance\\output\\mobile-overview.png' });

  await browser.close();
  console.log('Done!');
})();
