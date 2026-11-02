import config from '../../pyLevel/playwright.config';

// Evidence-only overrides; the original tests and application are unchanged.
export default {
  ...config,
  testDir: 'C:/programming/pyLevel/pyLevel/tests/e2e',
  outputDir: 'C:/programming/pyLevel/outputs/informe_playwright_2026_10_27/test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'C:/programming/pyLevel/outputs/informe_playwright_2026_10_27/html-report', open: 'never' }],
    ['json', { outputFile: 'C:/programming/pyLevel/outputs/informe_playwright_2026_10_27/results.json' }],
  ],
  use: { ...config.use, screenshot: 'on', trace: 'on' },
  webServer: { ...config.webServer, cwd: 'C:/programming/pyLevel/pyLevel' },
};
