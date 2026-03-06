import{test, expect} from '@playwright/test';

test('Navigate and Check the Title of Docs Tab', async ({ page }) => {
    await page.goto('https://playwright.dev/');
await page.getByRole('link', { name: 'Docs' }).click();
const heading = await page.getByRole('heading', { name: 'Installation' });

await expect(heading).toHaveText('Installation');
})

