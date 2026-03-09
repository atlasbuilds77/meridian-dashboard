import { test, expect } from '@playwright/test';

// Use baseURL from config
test('Dashboard loads without horizontal overflow', async ({ page, baseURL }, testInfo) => {
  await page.goto(baseURL!);
  await page.waitForTimeout(3000); // Wait for hydration
  
  // Screenshot with project name
  await page.screenshot({ 
    path: `test-results/${testInfo.project.name.replace(/\s+/g, '-')}-dashboard.png`,
    fullPage: true 
  });
  
  // Check for horizontal overflow
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth - document.documentElement.clientWidth;
  });
  
  console.log(`[${testInfo.project.name}] Dashboard overflow: ${overflow}px`);
  expect(overflow).toBeLessThan(20);
});

test('Analytics page loads without horizontal overflow', async ({ page, baseURL }, testInfo) => {
  await page.goto(`${baseURL}/analytics`);
  await page.waitForTimeout(3000);
  
  await page.screenshot({ 
    path: `test-results/${testInfo.project.name.replace(/\s+/g, '-')}-analytics.png`,
    fullPage: true 
  });
  
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth - document.documentElement.clientWidth;
  });
  
  console.log(`[${testInfo.project.name}] Analytics overflow: ${overflow}px`);
  expect(overflow).toBeLessThan(20);
});
