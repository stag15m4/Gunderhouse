/**
 * Property value, liens, equity, Rental Mode, and the Legal sync.
 */
import {
  ALFRED,
  BASE,
  LEGAL,
  check,
  clickAndSettle,
  createHome,
  has,
  launch,
  login,
  report,
  sql,
} from "./harness.mjs";

const browser = await launch();
const ctx = await browser.newContext();
const page = await login(ctx);

const houseId = await createHome(page, "Main House");
const rentalId = await createHome(page, "Oak Street Rental", "RENTAL");
const today = new Date().toISOString().slice(0, 10);
const fin = (id) => `${BASE}/homes/${id}/finance`;

// ---- an unvalued property says so rather than reporting zeros --------------
await page.goto(fin(houseId));
let text = await page.innerText("main");
check("the Value tab exists", has(await page.innerText("nav"), "Value"));
check("an unvalued property says so", has(text, "Nothing has been valued yet"));
check("and offers no equity figure", !has(text, "Loan to value\n80"));

// ---- valuation -------------------------------------------------------------
async function addValuation(homeId, { amount, on, source, notes }) {
  await page.goto(fin(homeId));
  await page.fill('form:has(select[name="source"]) input[name="amount"]', String(amount));
  await page.fill('input[name="valuedOn"]', on);
  if (source) await page.selectOption('select[name="source"]', source);
  if (notes) await page.fill('input[name="notes"]', notes);
  await clickAndSettle(page, 'form:has(select[name="source"]) button[type="submit"]');
}

await addValuation(houseId, {
  amount: 410000,
  on: `${new Date().getUTCFullYear()}-01-15`,
  source: "APPRAISAL",
  notes: "Refi appraisal",
});

text = await page.innerText("main");
check("the value shows", has(text, "$410,000.00"));
check("with its source", has(text, "Appraisal"));
check("and equity equals value with nothing owed", has(text, "$410,000.00"));
check(
  "stored in cents",
  sql(`select "amountCents" from "Valuation" where "homeId"='${houseId}'`) === "41000000",
);

// an older valuation must not displace the newer one
await addValuation(houseId, {
  amount: 350000,
  on: "2019-06-01",
  source: "PURCHASE_PRICE",
});
text = await page.innerText("main");
check("the most recent valuation drives the number", has(text, "$410,000.00"));
check("older ones are kept as history", has(text, "$350,000.00"));
check("and the one in use is marked", has(text, "In use"));

// ---- liens and the two kinds of availability -------------------------------
async function addLien(homeId, f) {
  await page.goto(fin(homeId));
  await page.click('details:has(input[name="currentBalance"]) summary');
  await page.fill('input[name="lender"]', f.lender);
  await page.selectOption('select[name="type"]', f.type);
  await page.fill('input[name="currentBalance"]', String(f.balance));
  if (f.limit) await page.fill('input[name="creditLimit"]', String(f.limit));
  if (f.rate) await page.fill('input[name="interestRate"]', String(f.rate));
  if (f.payment) await page.fill('input[name="monthlyPayment"]', String(f.payment));
  if (f.position) await page.fill('input[name="position"]', String(f.position));
  await clickAndSettle(page, 'form:has(input[name="currentBalance"]) button[type="submit"]');
}

await addLien(houseId, {
  lender: "Regions Bank",
  type: "FIRST_MORTGAGE",
  balance: 184000,
  rate: 6.25,
  payment: 1420,
  position: 1,
});

text = await page.innerText("main");
check("a lien is listed", has(text, "Regions Bank"));
check("owed reflects it", has(text, "$184,000.00"));
check("equity is value less debt", has(text, "$226,000.00"));
check("loan to value is shown", has(text, "44.88%"));
check(
  "borrowing headroom is the LTV ceiling less what's owed",
  has(text, "$144,000.00"),
  "410000 * 80% - 184000",
);
check("with nothing available today", has(text, "$0.00"));

// a HELOC is different money: the undrawn part is spendable now
await addLien(houseId, {
  lender: "Local Credit Union",
  type: "HELOC",
  balance: 20000,
  limit: 100000,
  payment: 180,
  position: 2,
});

text = await page.innerText("main");
check("undrawn credit is available today", has(text, "$80,000.00"));
check(
  "and the drawn part reduces headroom",
  has(text, "$124,000.00"),
  "328000 - 204000",
);
check("total owed includes the drawn balance", has(text, "$204,000.00"));

// the two must not be conflated
check(
  "available today and headroom are presented separately",
  has(text, "Available today") && has(text, "Could still borrow"),
);
check(
  "and the difference is explained",
  has(text, "nothing to apply for") && has(text, "originating a loan"),
);

// a credit limit below the drawn balance is nonsense
await page.goto(fin(houseId));
await page.click('details:has(input[name="currentBalance"]) summary');
await page.fill('input[name="lender"]', "Bad Limit Bank");
await page.selectOption('select[name="type"]', "HELOC");
await page.fill('input[name="currentBalance"]', "50000");
await page.fill('input[name="creditLimit"]', "10000");
await clickAndSettle(page, 'form:has(input[name="currentBalance"]) button[type="submit"]');
check(
  "a credit limit under the balance is refused",
  has(await page.innerText("main"), "can't be less than the balance drawn"),
);

// paying one off removes it from the equity maths
const helocId = sql(`select id from "Lien" where lender='Local Credit Union'`);
await page.goto(fin(houseId));
await clickAndSettle(
  page,
  `tr:has-text("Local Credit Union") form button`,
);
text = await page.innerText("main");
check("a paid-off lien is marked closed", has(text, "Closed"));
check("and stops counting against equity", has(text, "$226,000.00"));
check("and its undrawn credit goes with it", !has(text, "$80,000.00"));
check(
  "its balance is zeroed",
  sql(`select "currentBalanceCents" from "Lien" where id='${helocId}'`) === "0",
);

// ---- Rental Mode ------------------------------------------------------------
await page.goto(fin(houseId));
check(
  "a non-rental offers no rent maths",
  has(await page.innerText("main"), "Set this home"),
);

await addValuation(rentalId, { amount: 260000, on: today, source: "BROKER_OPINION" });
await addLien(rentalId, {
  lender: "Regions Bank",
  type: "FIRST_MORTGAGE",
  balance: 150000,
  payment: 1100,
  position: 1,
});

await page.goto(fin(rentalId));
text = await page.innerText("main");
check("a rental gets the rent section", has(text, "Break-even rent"));
check("debt service is picked up from the liens", has(text, "$1,100.00"));

// vacancy and management come off the top, so break-even is solved not summed
await page.fill('input[name="monthlyRent"]', "1500");
await page.fill('input[name="vacancyRate"]', "5");
await page.fill('input[name="managementFee"]', "10");
await clickAndSettle(page, 'form:has(input[name="vacancyRate"]) button[type="submit"]');

text = await page.innerText("main");
// fixed = 1100 debt + 0 carrying + 0 reserve + 0 upkeep; keep share = 85%
check(
  "break-even exceeds the fixed costs",
  has(text, "$1,294.12"),
  "1100 / 0.85, not 1100",
);
check("the rent being charged shows", has(text, "$1,500.00"));
check(
  "cash flow is rent after vacancy and fees, less fixed costs",
  has(text, "$175.00"),
  "1500 * 0.85 - 1100",
);
check("and the reasoning is spelled out", has(text, "solved, not added up"));
check(
  "terms are stored as basis points",
  sql(`select "vacancyRateBps" || '/' || "managementFeeBps" from "Home" where id='${rentalId}'`) ===
    "500/1000",
);

// rates that leave nothing are refused
await page.fill('input[name="vacancyRate"]', "60");
await page.fill('input[name="managementFee"]', "45");
await clickAndSettle(page, 'form:has(input[name="vacancyRate"]) button[type="submit"]');
check(
  "vacancy plus management at 100% is refused",
  has(await page.innerText("main"), "no rent left"),
);

// the replacement reserve and upkeep run rate feed in
await page.goto(`${BASE}/homes/${rentalId}/appliances/new`);
await page.fill('input[name="name"]', "Water heater");
await page.selectOption('select[name="category"]', "WATER_HEATER");
await page.fill('input[name="installedOn"]', `${new Date().getUTCFullYear() - 3}-01-01`);
await clickAndSettle(page, 'main form button[type="submit"]');

await page.goto(fin(rentalId));
text = await page.innerText("main");
check(
  "the replacement reserve is part of the cost stack",
  has(text, "$15.15"),
  "2000 over an 11-year midpoint",
);
check("labelled as what the systems accrue", has(text, "Replacement reserve"));

// ---- the Legal sync ---------------------------------------------------------
const api = await browser.newContext();

const props = await (
  await api.request.get(`${BASE}/api/legal/properties`, { headers: LEGAL })
).json();
check("legal can list properties", props.properties.length === 2);
const mainProp = props.properties.find((p) => p.name === "Main House");
check("with a current value", mainProp?.currentValueUsd === 410000);
check("and the equity already computed", mainProp?.grossEquityUsd === 226000);

const noTok = await api.request.get(`${BASE}/api/legal/properties`);
check("the legal token is enforced", noTok.status() === 401, String(noTok.status()));

const wrongSurface = await api.request.get(`${BASE}/api/legal/properties`, {
  headers: ALFRED,
});
check(
  "an alfred token doesn't open the legal surface",
  wrongSurface.status() === 401,
  String(wrongSurface.status()),
);

// push two instruments in
const put1 = await api.request.put(`${BASE}/api/legal/liens`, {
  headers: LEGAL,
  data: {
    propertyId: houseId,
    liens: [
      {
        externalId: "matter-001",
        type: "SECOND_MORTGAGE",
        lender: "Sunbelt Lending",
        balanceUsd: 42000,
        monthlyPaymentUsd: 410,
        position: 2,
        balanceAsOf: today,
      },
      {
        externalId: "matter-002",
        type: "JUDGMENT",
        lender: "Contractor dispute",
        balanceUsd: 8000,
      },
    ],
  },
});
const synced = await put1.json();
check("legal can push liens", put1.status() === 200, String(put1.status()));
check("both landed", synced.synced === 2, String(synced.synced));
check(
  "and the equity comes back with the response",
  synced.equity.totalOwedUsd === 234000,
  String(synced.equity.totalOwedUsd),
);
check(
  "which is what the app now shows",
  (await (async () => {
    await page.goto(fin(houseId));
    return page.innerText("main");
  })()).includes("$176,000.00"),
  "410000 - 234000",
);

text = await page.innerText("main");
check("synced liens are badged as Legal's", has(text, "From Legal"));
check(
  "and carry no edit control here",
  (await page.locator('tr:has-text("Sunbelt Lending") form button').count()) === 0,
);
check(
  "they are marked as owned by Legal in the database",
  sql(`select source from "Lien" where "externalId"='matter-001'`) === "LEGAL",
);

// re-sending is idempotent and reconciles removals
const put2 = await api.request.put(`${BASE}/api/legal/liens`, {
  headers: LEGAL,
  data: {
    propertyId: houseId,
    liens: [
      {
        externalId: "matter-001",
        type: "SECOND_MORTGAGE",
        lender: "Sunbelt Lending",
        balanceUsd: 39500,
        monthlyPaymentUsd: 410,
      },
    ],
  },
});
const synced2 = await put2.json();
check("a repeat sync updates rather than duplicates", synced2.synced === 1);
check("and releases what's no longer sent", synced2.released === 1, String(synced2.released));
check(
  "leaving one legal lien",
  sql(`select count(*) from "Lien" where source='LEGAL'`) === "1",
);
check(
  "with the new balance",
  sql(`select "currentBalanceCents" from "Lien" where "externalId"='matter-001'`) === "3950000",
);

// the hand-entered mortgage is untouched throughout
check(
  "manual liens survive every sync",
  sql(`select count(*) from "Lien" where source='MANUAL' and lender='Regions Bank' and "homeId"='${houseId}'`) === "1",
);

// an empty array releases everything Legal owns, and nothing else
const put3 = await api.request.put(`${BASE}/api/legal/liens`, {
  headers: LEGAL,
  data: { propertyId: houseId, liens: [] },
});
check("an empty set releases the rest", (await put3.json()).released === 1);
check(
  "and still leaves the manual ones alone",
  sql(`select count(*) from "Lien" where "homeId"='${houseId}' and source='MANUAL'`) === "2",
);

// bad payloads are rejected with a reason
const missingId = await api.request.put(`${BASE}/api/legal/liens`, {
  headers: LEGAL,
  data: {
    propertyId: houseId,
    liens: [{ type: "JUDGMENT", lender: "X", balanceUsd: 1 }],
  },
});
check("a lien with no externalId is refused", missingId.status() === 400);
check(
  "and the reason says why it matters",
  has((await missingId.json()).error, "matched on the next sync"),
);

const badType = await api.request.put(`${BASE}/api/legal/liens`, {
  headers: LEGAL,
  data: {
    propertyId: houseId,
    liens: [{ externalId: "x", type: "MORTGAGE", lender: "X", balanceUsd: 1 }],
  },
});
check("an unknown lien type is refused", badType.status() === 400);
check("and the valid ones are listed", has((await badType.json()).error, "FIRST_MORTGAGE"));

const dupe = await api.request.put(`${BASE}/api/legal/liens`, {
  headers: LEGAL,
  data: {
    propertyId: houseId,
    liens: [
      { externalId: "d", type: "JUDGMENT", lender: "A", balanceUsd: 1 },
      { externalId: "d", type: "JUDGMENT", lender: "B", balanceUsd: 2 },
    ],
  },
});
check("a duplicated externalId is refused", dupe.status() === 400);

const noArray = await api.request.put(`${BASE}/api/legal/liens`, {
  headers: LEGAL,
  data: { propertyId: houseId },
});
check("omitting liens entirely is refused", noArray.status() === 400);
check(
  "rather than being read as 'release everything'",
  sql(`select count(*) from "Lien" where "homeId"='${houseId}'`) === "2",
);

const unknownProp = await api.request.put(`${BASE}/api/legal/liens`, {
  headers: LEGAL,
  data: { propertyId: "nope", liens: [] },
});
check("an unknown property is a 404", unknownProp.status() === 404);

// ---- Alfred's read ----------------------------------------------------------
const prop = await (
  await api.request.get(`${BASE}/api/alfred/property`, { headers: ALFRED })
).json();
const rental = prop.properties.find((p) => p.homeName === "Oak Street Rental");
const main = prop.properties.find((p) => p.homeName === "Main House");
check("alfred sees property value", main?.value.currentUsd === 410000);
check("and equity", main?.grossEquityUsd === 226000, String(main?.grossEquityUsd));
check("a rental reports its break-even", rental?.rental?.breakEvenRentUsd !== null);
check("a non-rental reports no rent maths", main?.rental === null);
check(
  "the basis warns against adding the two availabilities",
  has(prop.basis, "must not be added together"),
);
check(
  "the index advertises the endpoint",
  has(
    JSON.stringify(
      await (await api.request.get(`${BASE}/api/alfred`, { headers: ALFRED })).json(),
    ),
    "/api/alfred/property",
  ),
);
const alfredNoTok = await api.request.get(`${BASE}/api/alfred/property`);
check("and enforces its token", alfredNoTok.status() === 401);

// ---- permissions: this is financial data ------------------------------------
await page.goto(`${BASE}/household`);
await page.fill('form:has(select[name="homeRole"]) input[name="name"]', "Ava");
await page.fill('form:has(select[name="homeRole"]) input[name="email"]', "ava@example.com");
await page.selectOption('select[name="homeId"]', houseId);
await page.selectOption('select[name="homeRole"]', "ADMIN");
await clickAndSettle(page, 'form:has(select[name="homeRole"]) button[type="submit"]');

const inviteToken = sql(
  `select token from "Invitation" where email='ava@example.com' order by "createdAt" desc limit 1`,
);
const avaCtx = await browser.newContext();
const avaInvite = await avaCtx.newPage();
await avaInvite.goto(`${BASE}/invite/${inviteToken}`);
await avaInvite.fill('input[name="password"]', "member-password-123");
await avaInvite.fill('input[name="confirmPassword"]', "member-password-123");
await clickAndSettle(avaInvite, 'main form button[type="submit"]');
const avaPage = await login(avaCtx, "ava@example.com", "member-password-123");

// ADMIN on the home, but no budget access — the mortgage is not hers to see
await avaPage.goto(`${BASE}/homes/${houseId}`);
check(
  "home admin alone doesn't reveal the Value tab",
  !has(await avaPage.innerText("nav"), "Value"),
);
await avaPage.goto(fin(houseId));
check(
  "and the finance page bounces her",
  !avaPage.url().includes("/finance"),
  avaPage.url(),
);

await page.goto(`${BASE}/household`);
const avaRow = page.locator('tr:has-text("ava@example.com")');
await avaRow.locator('select[name="budgetRole"]').selectOption("VIEWER");
await avaRow.locator('form:has(select[name="budgetRole"]) button').click();
await page.waitForLoadState("networkidle").catch(() => {});

await avaPage.goto(fin(houseId));
check(
  "granting budget access opens it",
  avaPage.url().includes("/finance"),
  avaPage.url(),
);
const avaText = await avaPage.innerText("main");
// By now the Legal sync has released everything it owned, so the only open
// lien is the hand-entered first mortgage: 410,000 - 184,000.
check("she can read the equity", has(avaText, "$226,000.00"));
check("but gets no add-lien form", !has(avaText, "Add a loan or lien"));
check("nor a way to record a value", !has(avaText, "Record value"));
check("nor the lending assumption", !has(avaText, "Lending assumption"));

// home ADMIN is not enough to write financial records, even posting directly
const beforeLiens = sql(`select count(*) from "Lien" where "homeId"='${houseId}'`);
const smuggle = await avaCtx.request.post(`${BASE}/homes/${houseId}/finance`, {
  form: { lender: "Sneaky Bank", type: "JUDGMENT", currentBalance: "999" },
});
check(
  "and cannot write one by posting at the page",
  sql(`select count(*) from "Lien" where "homeId"='${houseId}'`) === beforeLiens,
  `status ${smuggle.status()}`,
);

await browser.close();
report();
