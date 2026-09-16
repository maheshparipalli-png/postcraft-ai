import { test, expect, type Page } from "@playwright/test";

const BASE_URL = 'https://postcraft-ai.vercel.app'; // or your Vercel deployment URL

async function runVerification(page: Page, url: string) {
  await page.goto(BASE_URL);
  await page.fill("#url-input", url);
 await page.click("[data-testid='verify-source']");
await page.waitForSelector(".status-message");
return await page.textContent(".status-message");

}

test.describe('Source Verification Workflow', () => {
  test('Direct article URL with usable metadata', async ({ page }) => {
    const status = await runVerification(page, 'https://www.forbes.com/sites/example-article');
    expect(status).toContain('Publisher verified');
  });

  test('Google News redirect URL', async ({ page }) => {
    const status = await runVerification(page, 'https://news.google.com/articles/CBMiQGh0...');
    expect(status).toContain('Publisher verified');
  });

  test('Publisher page with missing summary', async ({ page }) => {
    const status = await runVerification(page, 'https://example.com/headline-only');
    expect(status).toContain('Metadata verified');
    expect(status).toContain('Summary not available');
  });

  test('Publisher page blocked or unavailable', async ({ page }) => {
    const status = await runVerification(page, 'https://www.wsj.com/articles/example-paywalled');
    expect(status).toContain('Discovery evidence only');
  });

  test('Invalid URL', async ({ page }) => {
    const status = await runVerification(page, 'https://notarealurl.example');
    expect(status).toContain('Unable to verify');
  });

  test('Insufficient evidence', async ({ page }) => {
    const status = await runVerification(page, 'https://example.com/blank-page');
    expect(status).toContain('Unable to verify');
  });
});



