import config from '../../../pyLevel/playwright.config';

// Separate observational run; original application and suite stay unchanged.
export default {
  ...config,
  testDir: 'C:/programming/pyLevel/outputs/informe_playwright_2026_10_27/mobile-check',
  testMatch: 'mobile.spec.ts',
  outputDir: 'C:/programming/pyLevel/outputs/informe_playwright_2026_10_27/mobile-check/test-results',
  reporter: [
    ['list'],
    ['json', { outputFile: 'C:/programming/pyLevel/outputs/informe_playwright_2026_10_27/mobile-check/results.json' }],
  ],
  use: { ...config.use, screenshot: 'on', trace: 'on' },
  webServer: { ...config.webServer, cwd: 'C:/programming/pyLevel/pyLevel' },
};
