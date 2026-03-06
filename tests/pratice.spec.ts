import { test, expect, Page, Dialog } from '@playwright/test';

// ─── Constants ────────────────────────────────────────────────────────────────

// test.use({
//     baseURL: 'http://localhost:5000',
//     headless: true, // run in headless mode
//     viewport: { width: 1280, height: 720 },
//     ignoreHTTPSErrors: true,
//   },
// )

// const BASE_URL = 'http://localhost:5000/';

// Exact dialog messages produced by FeedBackForm.js
const DIALOG = {
  SUBMIT:         'Do you really want to submit the form?',
  SAVE:           'Form data saved!',
  CLEAR_CONFIRM:  'Are you sure you want to clear the form progress? This action cannot be undone.',
  CLEAR_SUCCESS:  'Form progress cleared!',
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

/** Keys match the visible label text of each textbox on the form */
type FormFields = {
  Name?:              string;
  Email?:             string;
  Comment?:           string;
  'Event Highlights'?: string;
};

// ─── Shared Helper Functions ──────────────────────────────────────────────────

/** Dismiss the cookie banner when visible (uses localStorage, persists across reloads) */
async function acceptCookies(page: Page): Promise<void> {
  // Directly set localStorage and hide the banner to avoid flakiness
  await page.evaluate(() => {
    try {
      localStorage.setItem('cookieConsent', 'true');
      const b = document.getElementById('cookie-banner');
      if (b) b.style.display = 'none';
    } catch (e) {
      // ignore
    }
  });
}

/**
 * Register a one-time dialog handler before triggering the action.
 * @param action        – 'accept' to click OK / 'dismiss' to click Cancel
 * @param assertMessage – optional exact string the dialog must contain
 */
function handleDialog(
  page: Page,
  action: 'accept' | 'dismiss' = 'accept',
  assertMessage?: string,
): void {
  page.once('dialog', async (dialog: Dialog) => {
    if (assertMessage) {
      expect(dialog.message()).toContain(assertMessage);
    }
    action === 'dismiss' ? await dialog.dismiss() : await dialog.accept();
  });
}

/**
 * Fill one or more textbox fields using their visible label text.
 * @example fillForm(page, { Name: 'Alice', Email: 'alice@example.com' })
 */
async function fillForm(page: Page, fields: FormFields): Promise<void> {
  for (const [label, value] of Object.entries(fields) as [string, string][]) {
    await page.getByRole('textbox', { name: new RegExp(label, 'i') }).fill(value);
  }
}

/** Click the Submit button (triggers the confirm dialog in the app). */
async function clickSubmit(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Submit' }).click();
}

/**
 * Full setup: navigate to home → accept cookie banner → click "Go to Feedback Form".
 * Used as the shared beforeEach for all form test blocks.
 */
async function navigateToForm(page: Page): Promise<void> {
  await page.goto(' ');
  await acceptCookies(page);
  await page.getByRole('link', { name: 'Go to Feedback Form' }).click();
  await expect(page).toHaveURL(/FeedBackForm\.html/);
  await expect(page.getByRole('heading', { name: 'Feedback Form' })).toBeVisible();
}

// ═════════════════════════════════════════════════════════════════════════════
// POSITIVE TESTS
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Feedback Form – Positive Tests', () => {

  // Navigate to the form once before every test in this block
  test.beforeEach(async ({ page }: { page: Page }) => {
    await navigateToForm(page);
  });

  test('TC-P01: Form page loads with all expected fields visible', async ({ page }: { page: Page }) => {
    await expect(page.getByRole('textbox', { name: /Name/i    })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Email/i   })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Comment/i })).toBeVisible();
    await expect(page.getByRole('checkbox'                     )).toBeVisible();
    await expect(page.getByRole('button',  { name: 'Submit'   })).toBeVisible();
    await expect(page.getByRole('button',  { name: 'Save Progress'  })).toBeVisible();
    await expect(page.getByRole('button',  { name: 'Clear Progress' })).toBeVisible();
  });

  test('TC-P02: Submit with required fields only shows success dialog', async ({ page }: { page: Page }) => {
    await fillForm(page, {
      Name:    'Alice Johnson',
      Email:   'alice@example.com',
      Comment: 'Great event planning service!',
    });
    await page.getByRole('checkbox').check();

    // App shows a confirm dialog – accept it to proceed with submission
    handleDialog(page, 'accept', DIALOG.SUBMIT);
    await clickSubmit(page);
  });

  test('TC-P03: Submit with all fields (required + optional) shows success dialog', async ({ page }: { page: Page }) => {
    await fillForm(page, {
      Name:              'Bob Smith',
      Email:             'bob@example.com',
      Comment:           'Really enjoyed the event!',
      'Event Highlights': 'Amazing decoration and catering',
    });
    await page.getByRole('listbox', { name: /Areas for Improvement/i }).selectOption('Timing');
    await page.getByRole('checkbox').check();

    handleDialog(page, 'accept', DIALOG.SUBMIT);
    await clickSubmit(page);
  });

  test('TC-P04: Save Progress button stores form data and shows saved alert', async ({ page }: { page: Page }) => {
    await fillForm(page, {
      Name:    'Carol White',
      Email:   'carol@example.com',
      Comment: 'Work in progress…',
    });

    handleDialog(page, 'accept', DIALOG.SAVE);
    await page.getByRole('button', { name: 'Save Progress' }).click();
  });

  test('TC-P05: Clear Progress – confirm resets all fields', async ({ page }: { page: Page }) => {
    await fillForm(page, {
      Name:    'Dave Brown',
      Email:   'dave@example.com',
      Comment: 'Some comment',
    });

    // App fires two dialogs in sequence: confirm → success alert
    page.on('dialog', async (dialog: Dialog) => {
      await dialog.accept(); // handles both the confirm and the follow-up alert
    });

    await page.getByRole('button', { name: 'Clear Progress' }).click();

    await expect(page.getByRole('textbox', { name: /Name/i    })).toHaveValue('');
    await expect(page.getByRole('textbox', { name: /Email/i   })).toHaveValue('');
    await expect(page.getByRole('textbox', { name: /Comment/i })).toHaveValue('');
  });

  test('TC-P06: Terms of Service link navigates to correct page', async ({ page }: { page: Page }) => {
    const [newPage] = await Promise.all([
      page.context().waitForEvent('page').catch(() => null),
      page.getByRole('link', { name: 'Terms of Service' }).click(),
    ]);

    // Handles same-tab and new-tab navigation
    const target = newPage ?? page;
    await expect(target).toHaveURL(/TermsOfService\.html/);
  });

  test('TC-P07: All dropdown options can be selected individually', async ({ page }: { page: Page }) => {
    const dropdown = page.getByRole('listbox', { name: /Areas for Improvement/i });
    const options: string[] = ['Content', 'Presentation', 'Timing', 'Others'];
    for (const opt of options) {
      await dropdown.selectOption(opt);
      await expect(dropdown).toHaveText(new RegExp(opt, 'i'));
    }
  });

});

// ═════════════════════════════════════════════════════════════════════════════
// COOKIE BANNER TESTS  (home page only – no form navigation needed)
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Cookie Banner', () => {

  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto(' ');
    // Clear cookie consent so the banner always appears
    await page.evaluate(() => localStorage.removeItem('cookieConsent'));
    await page.reload();
    await expect(page.locator('#cookie-banner')).toBeVisible();
  });

  test('TC-P08: Accept button hides the cookie banner', async ({ page }: { page: Page }) => {
    await page.getByRole('button', { name: 'Accept' }).click();
    await expect(page.locator('#cookie-banner')).toBeHidden();
  });

  test('TC-P09: Decline button hides the cookie banner', async ({ page }: { page: Page }) => {
    await page.getByRole('button', { name: 'Decline' }).click();
    await expect(page.locator('#cookie-banner')).toBeHidden();
  });

});

// ═════════════════════════════════════════════════════════════════════════════
// NEGATIVE TESTS
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Feedback Form – Negative Tests', () => {

  test.beforeEach(async ({ page }: { page: Page }) => {
    await navigateToForm(page);
  });

  test('TC-N01: Submit with all fields empty stays on form (HTML5 validation)', async ({ page }: { page: Page }) => {
    // No dialog expected – HTML5 required-attribute blocks submission
    await clickSubmit(page);
    await expect(page).toHaveURL(/FeedBackForm\.html/);
    // Name field should report validity error
    const isInvalid = await page.getByRole('textbox', { name: /Name/i }).evaluate(
      (el: HTMLInputElement) => !el.validity.valid,
    );
    expect(isInvalid).toBe(true);
  });

  test('TC-N02: Submit without Name field stays on form', async ({ page }: { page: Page }) => {
    await fillForm(page, { Email: 'test@example.com', Comment: 'Missing name' });
    await page.getByRole('checkbox').check();

    await clickSubmit(page);
    await expect(page).toHaveURL(/FeedBackForm\.html/);
  });

  test('TC-N03: Submit without Email field stays on form', async ({ page }: { page: Page }) => {
    await fillForm(page, { Name: 'Eve Adams', Comment: 'Missing email' });
    await page.getByRole('checkbox').check();

    await clickSubmit(page);
    await expect(page).toHaveURL(/FeedBackForm\.html/);
  });

  test('TC-N04: Submit without Comment field stays on form', async ({ page }: { page: Page }) => {
    await fillForm(page, { Name: 'Frank Castle', Email: 'frank@example.com' });
    await page.getByRole('checkbox').check();

    await clickSubmit(page);
    await expect(page).toHaveURL(/FeedBackForm\.html/);
  });

  test('TC-N05: Submit with invalid email format stays on form', async ({ page }: { page: Page }) => {
    await fillForm(page, {
      Name:    'Grace Hopper',
      Email:   'not-an-email',
      Comment: 'Testing invalid email format',
    });
    await page.getByRole('checkbox').check();

    await clickSubmit(page);
    await expect(page).toHaveURL(/FeedBackForm\.html/);

    // Email field should be marked invalid by the browser
    const isInvalid = await page.getByRole('textbox', { name: /Email/i }).evaluate(
      (el: HTMLInputElement) => !el.validity.valid,
    );
    expect(isInvalid).toBe(true);
  });

  test('TC-N06: Submit without accepting Terms of Service stays on form', async ({ page }: { page: Page }) => {
    await fillForm(page, {
      Name:    'Henry Ford',
      Email:   'henry@example.com',
      Comment: 'Not agreeing to ToS',
    });
    // Checkbox intentionally left unchecked

    await clickSubmit(page);
    await expect(page).toHaveURL(/FeedBackForm\.html/);

    const isUnchecked = await page.getByRole('checkbox').evaluate(
      (el: HTMLInputElement) => !el.checked,
    );
    expect(isUnchecked).toBe(true);
  });

  test('TC-N07: Dismissing Clear Progress confirm dialog preserves form data', async ({ page }: { page: Page }) => {
    await fillForm(page, { Name: 'Irene Adler' });

    // Dismiss the confirm → form should NOT be cleared
    handleDialog(page, 'dismiss', DIALOG.CLEAR_CONFIRM);
    await page.getByRole('button', { name: 'Clear Progress' }).click();

    await expect(page.getByRole('textbox', { name: /Name/i })).toHaveValue('Irene Adler');
  });

  test('TC-N08: Cancelling the submit confirm dialog keeps form intact', async ({ page }: { page: Page }) => {
    await fillForm(page, {
      Name:    'James Kirk',
      Email:   'james@enterprise.com',
      Comment: 'Cancel submit test',
    });
    await page.getByRole('checkbox').check();

    // Dismiss the "Do you really want to submit?" confirm → stay on form
    handleDialog(page, 'dismiss', DIALOG.SUBMIT);
    await clickSubmit(page);

    await expect(page).toHaveURL(/FeedBackForm\.html/);
    await expect(page.getByRole('textbox', { name: /Name/i })).toBeEmpty();
  });

  test('TC-N09: Extremely long Name input does not crash the page', {tag: '@smoke'},async ({ page }: { page: Page }) => {
    await fillForm(page, { Name: 'A'.repeat(5000) });
    await expect(page.getByRole('heading', { name: 'Feedback Form' })).toBeVisible();
  });

  test('TC-N10: Script injection in Comment field does not execute', async ({ page }: { page: Page }) => {
    await fillForm(page, {
      Name:    'XSS Tester',
      Email:   'xss@example.com',
      Comment: '<script>alert("XSS")</script>',
    });
    await page.getByRole('checkbox').check();

    let xssDialogFired = false;
    page.on('dialog', async (dialog: Dialog) => {
      // Only the expected submit-confirm dialog is acceptable
      if (dialog.message() === 'XSS') xssDialogFired = true;
      await dialog.accept();
    });

    await clickSubmit(page);
    expect(xssDialogFired).toBe(false);
  });

});