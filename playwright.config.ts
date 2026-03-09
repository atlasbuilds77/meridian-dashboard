import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 4,
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL || 'https://meridian.zerogtrading.com',
    trace: 'off',
    screenshot: 'on',
  },
  outputDir: 'test-results',
  projects: [
    {
      name: 'Mobile Chrome',
      use: { 
        browserName: 'chromium',
        viewport: { width: 390, height: 844 }, // iPhone 14 size
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'Mobile Android',
      use: { 
        browserName: 'chromium',
        viewport: { width: 412, height: 915 }, // Pixel 7 size
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'Tablet',
      use: { 
        browserName: 'chromium',
        viewport: { width: 820, height: 1180 }, // iPad size
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
