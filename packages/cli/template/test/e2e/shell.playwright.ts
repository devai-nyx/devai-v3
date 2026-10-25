import { expect, test } from '@playwright/test';

test('the web shell renders its root component', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('__PRODUCT__-root')).toBeAttached();
});
