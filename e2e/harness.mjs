/**
 * Shared plumbing for the end-to-end suites.
 *
 * These run against a real Postgres and a real Chromium rather than mocks:
 * most of what has actually broken in this app — a redirect loop, a permission
 * that leaked through a total, a stale session — only shows up when a browser
 * and a database are both in the picture.
 *
 * See e2e/README.md for how to run them.
 */
import { chromium } from "playwright";
import { execSync } from "node:child_process";

export const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
export const OWNER = {
  email: process.env.SEED_OWNER_EMAIL ?? "stag15m4@gmail.com",
  password: process.env.SEED_OWNER_PASSWORD ?? "verify-this-locally",
};
export const ALFRED = {
  "X-Alfred-Token": process.env.ALFRED_TOKEN ?? "local-test-alfred-token",
};
export const LEGAL = {
  "X-Legal-Token": process.env.LEGAL_TOKEN ?? "local-test-legal-token",
};

const results = [];

export function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

export function report() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log("FAILURES:", failed.map((f) => f.name).join(", "));
    process.exitCode = 1;
  }
}

/** Case-insensitive substring. Beware: it matches helper copy too. */
export const has = (text, needle) =>
  text.toLowerCase().includes(needle.toLowerCase());

export const sql = (query) =>
  execSync(
    `psql -h ${process.env.E2E_PGHOST ?? "/tmp"} -p ${process.env.E2E_PGPORT ?? 5433} -U postgres -d gunderhouse -tA -f -`,
    { encoding: "utf8", input: query },
  ).trim();

export async function launch() {
  return chromium.launch({
    executablePath:
      process.env.E2E_CHROMIUM ??
      "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  });
}

/**
 * Click a submit control and wait for the server action to land. networkidle
 * alone races the POST, the 303 and the re-render, so wait for the POST first
 * and let the re-render settle after.
 */
export async function clickAndSettle(page, selector) {
  await Promise.all([
    page
      .waitForResponse((r) => r.request().method() === "POST", { timeout: 20000 })
      .catch(() => null),
    page.click(selector),
  ]);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(350);
}

export async function login(ctx, email = OWNER.email, password = OWNER.password) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  // Scoped to main: the header carries a sign-out form whose button would
  // otherwise match first.
  await clickAndSettle(page, 'main form button[type="submit"]');
  return page;
}

export async function createHome(page, name, type) {
  await page.goto(`${BASE}/homes/new`);
  await page.fill('input[name="name"]', name);
  if (type) await page.selectOption('select[name="type"]', type);
  await clickAndSettle(page, 'main form button[type="submit"]');
  return page.url().split("/homes/")[1];
}
