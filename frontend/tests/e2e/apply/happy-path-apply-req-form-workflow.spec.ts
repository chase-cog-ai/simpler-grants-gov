import path from "path";
import { expect, test } from "@playwright/test";
import dotenv from "dotenv";

// Only run this test in Chrome in CI
test.describe("happy path apply workflow - Organization User (SF424B and SF-LLL)", () => {
  dotenv.config({ path: path.resolve(__dirname, "../../../.env.local") });

  const OPPORTUNITY_ID = "f7a1c2b3-4d5e-6789-8abc-1234567890ab"; // TEST-BR-8037-OU-ON01
  const BASE_URL = "http://localhost:3000";
  const OPPORTUNITY_URL = `${BASE_URL}/opportunity/${OPPORTUNITY_ID}`;

  test("happy path apply workflow - Organization User (SF424B and SF-LLL)", async ({
    page,
  }, testInfo) => {
    test.skip(
      process.env.CI === "true" && testInfo.project.name !== "Chrome",
      "This test runs only in Chrome on CI",
    );
    test.setTimeout(300000);

    // Step 1: Navigate to home page
    await page.goto(BASE_URL);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // If a local test JWT is available, use it to log in directly
    const quickLoginJwt =
      process.env.TEST_JWT || process.env.E2E_USER_AUTH_TOKEN;
    if (quickLoginJwt) {
      await page.request.post(`${BASE_URL}/api/user/local-quick-login`, {
        data: { jwt: quickLoginJwt },
      });
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
      const sessionResponse = await page.request.get(
        `${BASE_URL}/api/auth/session`,
      );
      if (!sessionResponse.ok()) {
        throw new Error("Unable to establish user session after quick login.");
      }
    }

    // Step 2: Use the test user dropdown to log in
    const testUserSelect = page.locator(
      'select[id*="test-user"], select[aria-label*="test-user"], combobox[aria-label*="test"]',
    );
    if ((await testUserSelect.count()) > 0) {
      await testUserSelect
        .first()
        .waitFor({ state: "visible", timeout: 10000 });
      const options = await testUserSelect.first().locator("option").all();
      const optionValues: string[] = [];
      for (const option of options) {
        const value = await option.getAttribute("value");
        if (value && value.trim().length > 0) {
          optionValues.push(value);
        }
      }
      if (optionValues.length > 0) {
        await testUserSelect.first().selectOption(optionValues[0]);
        await page.waitForTimeout(2000);
        await page.waitForLoadState("domcontentloaded");
      }
    }

    // Step 3: Navigate to opportunity page
    await page.goto(OPPORTUNITY_URL);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    // Step 4: Click "Start new application" button
    const startAppButton = page.getByRole("button", {
      name: /start.*application/i,
    });
    await startAppButton.waitFor({ state: "visible", timeout: 15000 });
    await startAppButton.click();
    await page.waitForTimeout(2000);

    // Step 5: Wait for the Start Application modal to appear
    const loginModal = page.locator("#application-login-modal.is-visible");
    const modal = page.locator("#start-application.is-visible");
    await modal.waitFor({ state: "visible", timeout: 15000 });
    if (await loginModal.isVisible()) {
      throw new Error("Login modal appeared; user is not authenticated.");
    }
    // Debug: capture modal HTML and screenshot before expect (only if visible)
    if (await modal.isVisible()) {
      await modal.screenshot({ path: "modal-before-select.png" });
    }
    const modalHtml = await modal
      .innerHTML()
      .catch(() => "Could not get modal HTML");
    const selectCount = await modal.locator("select").count();
    if (selectCount === 0) {
      console.error("Modal HTML when <select> not found:", modalHtml);
      throw new Error(
        "No <select> found in modal. See modal-before-select.png for details.",
      );
    }
    await expect(modal.locator("select")).toBeVisible({ timeout: 15000 });
    const orgSelect = modal.locator(
      'select[name*="applicant"], select:nth-of-type(1)',
    );
    if ((await orgSelect.count()) > 0) {
      await orgSelect.first().waitFor({ state: "visible", timeout: 5000 });
      const options = await orgSelect
        .first()
        .locator("option")
        .allTextContents();
      const sallysOption = options.find(
        (opt) => opt.includes("Sally") || opt.includes("Soup"),
      );
      if (sallysOption) {
        await orgSelect.first().selectOption({ label: sallysOption });
      }
    }

    const nameInput = modal.locator(
      'input[name*="name"], input[placeholder*="application"], input[type="text"]:nth-of-type(1)',
    );
    if ((await nameInput.count()) > 0) {
      await nameInput.first().waitFor({ state: "visible", timeout: 5000 });
      const uniqueAppName = `TEST-APPLY-ORG-IND-APP${Date.now()}`;
      await nameInput.first().fill(uniqueAppName);
      const appNameInput = modal
        .getByLabel(/name of this application/i)
        .first();
      if (await appNameInput.count()) {
        await appNameInput.fill("TEST-APPLY-ORG-IND-APP001");
      }
    }

    // Step 7: Click Create Application button
    const createButton = modal.locator('button:has-text("Create")');
    if ((await createButton.count()) === 0) {
      const anyCreateBtn = page
        .getByRole("button")
        .filter({ hasText: /Create|Submit|Start|Next/ });
      await anyCreateBtn.first().click();
    } else {
      await createButton.first().click();
    }

    // Step 8: Wait for application page
    await page.waitForURL(/\/applications\/[a-f0-9-]+/, { timeout: 30000 });
    await page.waitForLoadState("domcontentloaded");

    // Step 9: Verify application page loaded
    await expect(page).toHaveURL(/\/applications\/[a-f0-9-]+/);
    const mainContent = page.locator("main");
    await expect(mainContent).toBeVisible();
    await page.waitForLoadState("networkidle");

    // Step 10: Open first required form
    const formLink = page
      .locator(".simpler-application-forms-table tbody a")
      .first();
    await expect(formLink).toBeVisible({ timeout: 15000 });
    await formLink.scrollIntoViewIfNeeded();
    await formLink.click({ timeout: 15000 });
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    await page.waitForURL(/\/applications\/[a-f0-9-]+\/form\/[a-f0-9-]+/);

    // Step 11: Fill SF-424B form fields
    let titleFieldFilled = false;
    const titleInputs = page.locator(
      'input[name*="title" i], input[placeholder*="title" i]',
    );
    if ((await titleInputs.count()) > 0) {
      const titleField = titleInputs.first();
      await titleField.waitFor({ state: "visible", timeout: 3000 });
      await titleField.fill("TESTER");
      titleFieldFilled = true;
    }
    if (!titleFieldFilled) {
      const titleLabelInput = page.getByLabel(/title/i).first();
      if (await titleLabelInput.count()) {
        await titleLabelInput.waitFor({ state: "visible", timeout: 3000 });
        await titleLabelInput.fill("TESTER");
        titleFieldFilled = true;
      }
    }
    if (!titleFieldFilled) {
      throw new Error("Could not fill SF-424B Title field");
    }

    const orgInputs = page.locator(
      'input[name*="applicant" i], input[name*="organization" i]',
    );
    if ((await orgInputs.count()) > 0) {
      const orgField = orgInputs.first();
      await orgField.fill("Sally's Soup Emporium");
    }

    // Step 12: Save the form
    const saveButton = page.getByRole("button", { name: /save/i }).first();
    if (await saveButton.isVisible()) {
      await saveButton.click();
      await page.waitForTimeout(2000);
      await expect(page.getByText(/form was saved/i)).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText(/no errors were detected/i)).toBeVisible({
        timeout: 10000,
      });
    }

    // Return to application landing page
    await page.goBack();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    await expect(page.getByText(/no issues detected/i)).toBeVisible({
      timeout: 10000,
    });

    // Step 13: Set SF-LLL to "No"
    const sfLllRow = page.locator("tr", {
      hasText: /Disclosure of Lobbying Activities \(SF-LLL\)/i,
    });
    await expect(sfLllRow).toBeVisible({ timeout: 10000 });
    const submitColNoLabel = sfLllRow.locator(
      'td[data-label*="Submit"] label.usa-radio__label',
      { hasText: /^No$/i },
    );
    if ((await submitColNoLabel.count()) > 0) {
      await submitColNoLabel.first().click();
    } else {
      const fallbackLabel = sfLllRow.locator("label.usa-radio__label", {
        hasText: /^No$/i,
      });
      await fallbackLabel.first().click();
    }

    // Step 14: Submit the application
    const submitAppButton = page.getByRole("button", {
      name: /submit application/i,
    });
    await submitAppButton.click();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    // Step 15: Verify success
    await expect(
      page.getByText(/your application has been submitted/i),
    ).toBeVisible();

    const appIdMessages = await page.locator("div.usa-summary-box__text").all();
    let appIdMessage: string | null = null;
    for (const el of appIdMessages) {
      const text = await el.textContent();
      if (
        /Application ID #: [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(
          text || "",
        )
      ) {
        appIdMessage = text || null;
        break;
      }
    }
    if (!appIdMessage) {
      throw new Error("Could not find Application ID element");
    }

    expect(appIdMessage).toMatch(
      /Application ID #: [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
  });
});
