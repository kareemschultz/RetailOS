import { expect, test } from "@playwright/test";

const GOOGLE_BUTTON_NAME = /google/i;
const LOGIN_URL_PATTERN = /\/login$/;

test.describe("public RetailOS smoke", () => {
  test("login page renders the production auth surface", async ({ page }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: "Sign in to RetailOS" })
    ).toBeVisible();
    await expect(
      page.getByText(
        "The unified platform for sales, inventory, and accounting"
      )
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: GOOGLE_BUTTON_NAME })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create an account" })
    ).toBeVisible();
  });

  test("unauthenticated app routes redirect to login", async ({ page }) => {
    await page.goto("/pos");

    await expect(page).toHaveURL(LOGIN_URL_PATTERN);
    await expect(
      page.getByRole("heading", { name: "Sign in to RetailOS" })
    ).toBeVisible();
  });

  test("mobile login has no page-level horizontal overflow", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "mobile viewport smoke only");

    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Sign in to RetailOS" })
    ).toBeVisible();

    const overflow = await page.evaluate<{
      body: number;
      document: number;
      viewport: number;
    }>(`(() => ({
      body: document.body.scrollWidth,
      document: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }))()`);

    expect(Math.max(overflow.body, overflow.document)).toBeLessThanOrEqual(
      overflow.viewport + 1
    );
  });
});
