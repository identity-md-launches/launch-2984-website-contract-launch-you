// Runs a bounded foreground preview and browser; writes only disposable evidence.
import axe from "axe-core";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { DEPLOYMENT } from "../src/deployment.ts";
import { resolveRound, total } from "../src/game.ts";

const modulePath = process.env.IMD_PLAYWRIGHT;
const { chromium } = await import(
  modulePath ? pathToFileURL(modulePath).href : "playwright"
);
const root = resolve("dist"),
  output = resolve("test/scratch/ui");
await mkdir(output, { recursive: true });
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".png": "image/png",
};
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://preview").pathname,
    );
    if (!pathname.startsWith("/preview/")) {
      res.writeHead(404).end();
      return;
    }
    const file = resolve(
      root,
      pathname.slice("/preview/".length) || "index.html",
    );
    if (!file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    const data = await readFile(file);
    res
      .writeHead(200, {
        "content-type": mime[extname(file)] ?? "application/octet-stream",
      })
      .end(data);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
const browser = await chromium.launch({ headless: true });
const findings = [];
const check = (name, detail = "") => {
  findings.push({ name, passed: true, detail });
  process.stdout.write(`PASS ${name}${detail ? ": " + detail : ""}\n`);
};
const errors = [];
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    acceptDownloads: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (new URL(r.url()).origin === new URL(url).origin && r.status() >= 400)
      errors.push(`${r.status()} ${new URL(r.url()).pathname}`);
  });
  await page.goto(url);
  await page.getByRole("button", { name: "Lock Run", exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.addScriptTag({ content: axe.source });
  let accessibility = await page.evaluate(() =>
    window.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"],
      },
    }),
  );
  assert.deepEqual(
    accessibility.violations.map((v) => ({ id: v.id, nodes: v.nodes.length })),
    [],
  );
  check(
    "Automated accessibility scan",
    `${accessibility.passes.length} axe rules passed on the ready game; 0 violations`,
  );
  for (const width of [320, 390, 768, 820, 1080, 1440]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    const noOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    );
    if (!noOverflow) {
      console.log(
        await page.locator(".stage-caption").evaluate((el) =>
          [el, ...el.querySelectorAll("*")]
            .map((e) => ({
              tag: e.tagName,
              cls: e.className,
              w: e.getBoundingClientRect().width,
              right: e.getBoundingClientRect().right,
              display: getComputedStyle(e).display,
              gap: getComputedStyle(e).gap,
              flex: getComputedStyle(e).flexShrink,
            }))
            .filter((x) => !String(x.cls).includes("sr-only")),
        ),
      );
      await page.screenshot({
        path: `${output}/overflow-${width}.png`,
        fullPage: true,
      });
    }
    assert.equal(noOverflow, true, `overflow at ${width}`);
    if (width === 390) {
      const r = await page
        .getByRole("button", { name: "Lock Run", exact: true })
        .boundingBox();
      assert.ok(r.y + r.height <= 844, "Primary action must be visible at 390");
    }
    await page.screenshot({
      path: `${output}/ready-${width}.png`,
      fullPage: true,
    });
  }
  check(
    "Responsive reflow and first-screen action",
    "320, 390, 768, 820, 1080 and 1440; primary action visible at 390×844",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.textContent),
    "Skip to game",
  );
  await page.keyboard.press("Enter");
  const run = page.locator('input[name="prediction"][value="run"]');
  await run.focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.locator('input[value="rest"]').isChecked(), true);
  await page.screenshot({ path: `${output}/keyboard-radio.png` });
  check(
    "Keyboard controls",
    "Skip link works; arrow key selects the native radio; focus screenshot captured",
  );
  await page.evaluate(() =>
    localStorage.setItem(
      "wheelhouse:v1",
      JSON.stringify({
        version: 1,
        seed: 7,
        picks: [],
        history: [],
        sound: false,
      }),
    ),
  );
  await page.reload();
  // Normal motion exercises the pause path; remaining rounds use immediate reveals.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  let expected = { seed: 7, results: [] };
  for (let i = 0; i < 5; i++) {
    const outcome = resolveRound(expected, "run").results.at(-1).outcome;
    expected = resolveRound(expected, outcome);
    await page.locator(`input[name="prediction"][value="${outcome}"]`).check();
    await page
      .getByRole("button", {
        name: `Lock ${outcome === "run" ? "Run" : "Rest"}`,
        exact: true,
      })
      .click();
    if (i === 0) {
      await page
        .getByRole("button", { name: "Pause reveal", exact: true })
        .click();
      await page.getByRole("heading", { name: "Reveal paused." }).waitFor();
      check(
        "Reveal pause control",
        "The animated reveal can be paused and immediately revealed",
      );
    }
    await page.getByRole("button", { name: "Reveal now", exact: true }).click();
    if (i < 4) {
      await page
        .getByRole("button", { name: `Play round ${i + 2}`, exact: true })
        .click();
    }
  }
  await page.getByRole("heading", { name: "You beat Pip!" }).waitFor();
  assert.equal(total(expected.results), 750);
  assert.ok(
    (await page.locator(".match-finished").innerText()).includes("750"),
  );
  assert.equal(await page.locator(".round-progress .won").count(), 5);
  await page.waitForFunction(() =>
    document.activeElement?.textContent?.includes("Play again"),
  );
  await page.addScriptTag({ content: axe.source });
  accessibility = await page.evaluate(() =>
    window.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"],
      },
    }),
  );
  assert.deepEqual(
    accessibility.violations.map((v) => ({ id: v.id, nodes: v.nodes.length })),
    [],
  );
  check(
    "Finished match accessibility scan",
    `${accessibility.passes.length} axe rules passed; focus moves to Play again`,
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  assert.ok(await page.locator(".skip-link").evaluate(el => el.getBoundingClientRect().bottom <= 0), "Skip link is hidden when unfocused");
  await page.screenshot({
    path: `${output}/finished-390.png`,
    fullPage: true,
    animations: "disabled",
  });
  check(
    "Full five-round match",
    "5 correct predictions score 750; score, streak, result and progress update",
  );
  let downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Save scorecard", exact: true })
    .click();
  let download = await downloadEvent;
  await download.saveAs(`${output}/scorecard.svg`);
  const scorecard = await readFile(`${output}/scorecard.svg`, "utf8");
  assert.ok(scorecard.includes("You 750"));
  assert.ok(scorecard.includes("simulated rounds"));
  check(
    "Scorecard export",
    "Downloaded valid SVG with correct score and simulation disclosure",
  );
  await page.getByRole("button", { name: "Roundbook", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  assert.equal(await page.locator("tbody tr").count(), 1);
  downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export roundbook", exact: true })
    .click();
  download = await downloadEvent;
  await download.saveAs(`${output}/roundbook.json`);
  assert.equal(
    JSON.parse(await readFile(`${output}/roundbook.json`, "utf8")).matches
      .length,
    1,
  );
  await page.keyboard.press("Escape");
  assert.equal(
    await page.evaluate(() => document.activeElement.textContent),
    "Roundbook",
  );
  check(
    "Roundbook and dialog keyboard behavior",
    "Completed match listed and exported; Escape closes and returns focus",
  );
  await page.reload();
  await page.getByRole("heading", { name: "You beat Pip!" }).waitFor();
  await page.getByRole("button", { name: "Roundbook", exact: true }).click();
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page
    .getByRole("button", { name: "Clear history", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep history", exact: true }).click();
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page
    .getByRole("button", { name: "Clear history", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete history", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Your story starts on the wheel." })
    .waitFor();
  await page.keyboard.press("Escape");
  check(
    "Persistence and deliberate deletion",
    "Reload restores completed score; deleting history requires confirmation; cancellation keeps records",
  );
  await page.getByRole("button", { name: "Play again", exact: true }).click();
  await page.getByRole("button", { name: "Lock Run", exact: true }).click();
  await page.getByRole("button", { name: "Reveal now", exact: true }).click();
  await page
    .getByRole("button", { name: "Start a new match", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep playing", exact: true }).click();
  assert.equal(
    await page.locator(".round-progress .won,.round-progress .lost").count(),
    1,
  );
  await page
    .getByRole("button", { name: "Start a new match", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start new match", exact: true })
    .click();
  assert.equal(
    await page.locator(".round-progress .won,.round-progress .lost").count(),
    0,
  );
  check(
    "New-match confirmation",
    "Keep playing preserves the round; explicit reset starts at round one",
  );
  await page.getByRole("button", { name: "How to play", exact: true }).click();
  await page.screenshot({ path: `${output}/rules-390.png` });
  await page.addScriptTag({ content: axe.source });
  accessibility = await page.evaluate(() =>
    window.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"],
      },
    }),
  );
  assert.deepEqual(
    accessibility.violations.map((v) => ({ id: v.id, nodes: v.nodes.length })),
    [],
  );
  check(
    "Rules dialog accessibility scan",
    `${accessibility.passes.length} axe rules passed; 0 violations`,
  );
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() =>
        document.querySelector("dialog").contains(document.activeElement),
      ),
      true,
    );
  }
  await page.keyboard.press("Escape");
  check(
    "Native modal focus containment",
    "Tab stays inside dialog, Escape closes it",
  );
  await page.getByRole("button", { name: "Live rounds", exact: true }).click();
  await page
    .getByRole("heading", { name: "The wheel can wait." })
    .waitFor({ timeout: 20000 });
  await page.screenshot({
    path: `${output}/live-actual-390.png`,
    fullPage: true,
  });
  const actual = await page.locator(".live-message").innerText();
  check(
    "Actual public live feed",
    "Observed response: " + actual.replace(/\s+/g, " "),
  );
  await context.close();
  // Available and unavailable feed fixtures are explicit tests, never production fallback data.
  const liveContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const livePage = await liveContext.newPage();
  const c = DEPLOYMENT.contracts.SqueekCore;
  const g = DEPLOYMENT.coreConfiguration.genesisTimestamp;
  const current = Math.floor((Date.now() / 1000 - g) / 600) + 1;
  let state = {
    schemaVersion: 1,
    status: "available",
    installationId: "test-installation",
    chain: { chainId: "11155111", safeThroughBlock: "12000000" },
    identities: {
      core: c.address,
      proxyImplementation: c.implementation,
      proxyAdmin: c.proxyAdmin,
    },
    implementation: {
      codeVersion: "3",
      runtimeHash: c.implementationRuntimeHash,
      storageLayoutDigest: c.storageLayoutDigest,
    },
    configuration: {
      streamId: DEPLOYMENT.coreConfiguration.streamId,
      genesisTimestamp: String(g),
      roundDuration: "600",
      maxWorkPerRound: "10000",
    },
    core: { settledThroughRound: String(current - 1), paused: false },
    events: [],
  };
  let responseMode = "valid";
  await livePage.route("https://api.squeekchain.com/v1/**", async (route) => {
    if (responseMode === "rate-limit") {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: '{"error":"rate_limited"}',
      });
      return;
    }
    if (responseMode === "unavailable") {
      await route.fulfill({
        contentType: "application/json",
        body: '{"schemaVersion":1,"status":"unavailable","reason":"indexer_unavailable"}',
      });
      return;
    }
    const body = route.request().url().includes("settlements")
      ? {
          schemaVersion: 3,
          status: "available",
          installationId: "test-installation",
          chain: {
            chainId: "11155111",
            deploymentBlock: String(DEPLOYMENT.deploymentBlock),
          },
          recentSettlements: [
            {
              previousSettledThroughRound: String(current),
              settledThroughRound: String(current + 1),
              activeRoundCount: "0",
              workAdded: "0",
              confirmationStatus: "safe",
              ethereumBlockNumber: "12000000",
            },
          ],
        }
      : state;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await livePage.goto(url);
  await livePage
    .getByRole("button", { name: "Live rounds", exact: true })
    .click();
  await livePage
    .getByRole("heading", { name: "Will the next round run?" })
    .waitFor();
  await livePage.locator('input[name="live-prediction"][value="rest"]').check();
  await livePage
    .getByRole("button", { name: "Lock Rest locally", exact: true })
    .click();
  await livePage
    .getByRole("heading", { name: "You’re in for the next round." })
    .waitFor();
  assert.equal(await livePage.locator(".prediction-row").count(), 1);
  state.core.settledThroughRound = String(current + 1);
  await livePage
    .getByRole("button", { name: "Refresh results", exact: true })
    .click();
  await livePage.getByText("+100 pts", { exact: true }).waitFor();
  check(
    "Local live pick and certified settlement (fixture)",
    "Matched deployment permits next-round pick; certified zero-work batch gives +100 for Rest",
  );
  responseMode = "unavailable";
  await livePage
    .getByRole("button", { name: "Refresh results", exact: true })
    .click();
  await livePage.getByText(/has not made this round available/).waitFor();
  responseMode = "rate-limit";
  await livePage
    .getByRole("button", { name: "Check again", exact: true })
    .click();
  await livePage.getByText(/live feed is busy/).waitFor();
  check(
    "Live unavailable and rate-limit recovery (fixtures)",
    "Explicit recovery messages; no fabricated outcome",
  );
  await liveContext.close();
  const restricted = await browser.newContext({
    viewport: { width: 320, height: 844 },
    reducedMotion: "reduce",
  });
  await restricted.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException("blocked", "SecurityError");
    };
  });
  const restrictedPage = await restricted.newPage();
  await restrictedPage.goto(url);
  await restrictedPage
    .getByRole("button", { name: "Lock Run", exact: true })
    .click();
  await restrictedPage
    .getByRole("button", { name: "Play round 2", exact: true })
    .waitFor();
  await restrictedPage
    .getByText("Storage unavailable. Progress lasts for this visit.")
    .waitFor();
  const animations = await restrictedPage.evaluate(
    () =>
      document.getAnimations().filter((a) => a.playState === "running").length,
  );
  assert.equal(animations, 0);
  check(
    "Storage denied and reduced motion",
    "Game remains playable at 320; visit-only storage note; no running animations",
  );
  await restricted.close();
  assert.deepEqual(errors, []);
  check(
    "Static subpath resources and console",
    "No page errors or missing local resources on /preview/",
  );
  await writeFile(
    `${output}/results.json`,
    JSON.stringify({ checks: findings, errors }, null, 2),
  );
} catch (e) {
  await writeFile(
    `${output}/results.json`,
    JSON.stringify({ checks: findings, error: String(e), errors }, null, 2),
  );
  throw e;
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
