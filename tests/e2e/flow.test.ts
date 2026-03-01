import { test, expect, Page } from "@playwright/test";
import crypto from "crypto";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";

function randomEmail() {
  return `test-${crypto.randomBytes(8).toString("hex")}@e2e.example.com`;
}

const STRONG_PASSWORD = "E2eT3st@Secure!";

async function register(page: Page, email: string, password = STRONG_PASSWORD) {
  await page.goto(`${BASE_URL}/register`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10000 });
}

async function login(page: Page, email: string, password = STRONG_PASSWORD) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10000 });
}

test.describe("Authentication flow", () => {
  test("registers a new user and lands on dashboard", async ({ page }) => {
    const email = randomEmail();
    await register(page, email);
    await expect(page).toHaveURL(`${BASE_URL}/dashboard`);
    await expect(page.locator("h2")).toContainText("ダッシュボード");
  });

  test("login redirects to dashboard", async ({ page }) => {
    const email = randomEmail();
    await register(page, email);
    await page.request.post(`${BASE_URL}/api/auth/logout`);
    await login(page, email);
    await expect(page).toHaveURL(`${BASE_URL}/dashboard`);
  });

  test("rejects wrong password", async ({ page }) => {
    const email = randomEmail();
    await register(page, email);
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');
    await expect(page.locator(".error-text")).toBeVisible();
  });
});

test.describe("Session flow", () => {
  test("creates a session and sees live page", async ({ page }) => {
    const email = randomEmail();
    await register(page, email);

    await page.click('a[href="/session/new"]');
    await expect(page).toHaveURL(`${BASE_URL}/session/new`);
    await page.click('button[data-variant="primary"]');
    await expect(page.url()).toMatch(/\/session\/.+\/live/);
    await expect(page.locator("h2")).toContainText("計測中");
  });

  test("ends session and sees summary", async ({ page }) => {
    const email = randomEmail();
    await register(page, email);

    await page.goto(`${BASE_URL}/session/new`);
    await page.click('button[data-variant="primary"]');
    await page.waitForURL(/\/session\/.+\/live/);

    await page.click('button[data-variant="danger"]');
    await expect(page.url()).toMatch(/\/session\/.+\/summary/);
    await expect(page.locator("h2")).toContainText("セッションレポート");
  });
});

test.describe("Settings flow", () => {
  test("navigates to settings page", async ({ page }) => {
    const email = randomEmail();
    await register(page, email);
    await page.click('a[href="/settings"]');
    await expect(page).toHaveURL(`${BASE_URL}/settings`);
    await expect(page.locator("h2")).toContainText("設定");
  });
});

test.describe("Export flow", () => {
  test("creates export and shows download link", async ({ page }) => {
    const email = randomEmail();
    await register(page, email);
    await page.goto(`${BASE_URL}/export`);
    await page.click('button[data-variant="primary"]');
    await expect(page.locator("a[download]").first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Account deletion flow", () => {
  test("delete account page is accessible", async ({ page }) => {
    const email = randomEmail();
    await register(page, email);
    await page.goto(`${BASE_URL}/account`);
    await expect(page.locator("h2")).toContainText("アカウント");
    await expect(page.locator("text=削除フォームを表示")).toBeVisible();
  });

  test("deletes account and redirects to login", async ({ page }) => {
    const email = randomEmail();
    await register(page, email);
    await page.goto(`${BASE_URL}/account`);
    await page.click("text=削除フォームを表示");
    await page.fill('input[id="delete-pw"]', STRONG_PASSWORD);
    await page.fill('input[id="delete-confirm"]', "DELETE_MY_ACCOUNT");
    await page.click('button[data-variant="danger"]');
    await expect(page).toHaveURL(`${BASE_URL}/login`, { timeout: 10000 });
  });
});

test.describe("Feedback flow", () => {
  test("submits feedback successfully", async ({ page }) => {
    const email = randomEmail();
    await register(page, email);
    await page.goto(`${BASE_URL}/feedback`);
    await page.fill("textarea", "This is a test feedback message");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=送信しました")).toBeVisible({ timeout: 5000 });
  });
});
