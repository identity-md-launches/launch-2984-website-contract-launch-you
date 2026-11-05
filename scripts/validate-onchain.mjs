// Runs a bounded foreground preview and browser; writes only disposable evidence.
import axe from "axe-core";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { DEPLOYMENT } from "../src/deployment.ts";
import { decodeFunctionData, encodeFunctionResult, parseAbi } from "viem";

const modulePath = process.env.IMD_PLAYWRIGHT;
const { chromium } = await import(
  modulePath ? pathToFileURL(modulePath).href : "playwright"
);
const root = resolve("dist"),
  output = resolve("test/scratch/onchain");
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

const abi = JSON.parse(
  await readFile("docs/abi/WheelhouseRounds.json", "utf8"),
);
const game = "0x0000000000000000000000000000000000001111"; // Test fixture only.
const player = "0x0000000000000000000000000000000000002222"; // Test fixture only.
const tx = `0x${"12".repeat(32)}`;
const block = `0x${"34".repeat(32)}`;
const checks = [];
const check = (name) => {
  checks.push(name);
  console.log(`PASS ${name}`);
};
const c = DEPLOYMENT.contracts.SqueekCore;
const g = DEPLOYMENT.coreConfiguration.genesisTimestamp;
const current = BigInt(Math.floor((Date.now() / 1000 - g) / 600) + 1);
const state = {
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
  core: { settledThroughRound: String(current - 1n), paused: false },
  events: [],
};
let handoffChain = 11155111;
let points = 0n,
  exists = false,
  willRun = true,
  settled = false,
  noCode = false,
  coreAddress = c.address;
const calls = [];
const contractReads = [];
const multicallAbi = parseAbi([
  "function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[])",
]);
function readCall(data) {
  const call = decodeFunctionData({ abi, data });
  contractReads.push(call);
  if (call.functionName === "scores")
    return encodeFunctionResult({
      abi,
      functionName: "scores",
      result: points,
    });
  if (call.functionName === "core")
    return encodeFunctionResult({
      abi,
      functionName: "core",
      result: coreAddress,
    });
  if (call.functionName === "predictions")
    return encodeFunctionResult({
      abi,
      functionName: "predictions",
      result: [exists, willRun, settled, settled],
    });
  if (call.functionName === "predict" || call.functionName === "settle")
    return "0x";
  throw new Error("Unhandled eth_call " + call.functionName);
}
const errors = [];
let lastPage;
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (new URL(r.url()).origin === new URL(url).origin && r.status() >= 400)
      errors.push(`${r.status()} ${r.url()}`);
  });
  await page.route("https://api.squeekchain.com/v1/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ...state,
        identities: { ...state.identities, core: game },
      }),
    }),
  );
  await page.goto(url);
  assert.equal(
    await page.getByRole("button", { name: "Play", exact: true }).count(),
    0,
  );
  await page.getByRole("button", { name: "Lock Run", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() =>
    document.activeElement.textContent.includes("Pause reveal"),
  );
  check("Lock moves keyboard focus directly to Pause reveal");
  await page.getByRole("button", { name: "Live rounds", exact: true }).click();
  await page
    .getByText("Onchain play opens once the contract is deployed.", {
      exact: true,
    })
    .waitFor();
  await page
    .getByRole("heading", { name: "Live rounds are paused.", exact: true })
    .waitFor();
  assert.equal(await page.locator(".status-dot").count(), 0);
  assert.equal(await page.locator("details").evaluate((el) => el.open), true);
  assert.equal(await page.locator(".how-strip").count(), 0);
  await page.getByText(/live feed names a different contract/).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Predict Run onchain", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Settle round", exact: true })
      .isDisabled(),
    true,
  );
  const connect = page.getByRole("button", { name: "Connect", exact: true });
  assert.equal(await connect.isEnabled(), true);
  const r = await connect.boundingBox();
  assert.ok(r.y + r.height <= 844);
  await page.addScriptTag({ content: axe.source });
  const a = await page.evaluate(() =>
    window.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"],
      },
    }),
  );
  assert.deepEqual(
    a.violations.map((v) => ({ id: v.id, nodes: v.nodes.length })),
    [],
  );
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
      true,
    );
    await page.screenshot({
      path: `${output}/undeployed-${width}.png`,
      fullPage: true,
    });
  }
  check(
    "Undeployed + identity mismatch: disabled actions, enabled Connect, no green dots/practice strip, expanded explanation, axe clean and responsive",
  );
  await page
    .getByRole("button", { name: "Practice match", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Resume reveal", exact: true })
    .waitFor();
  assert.equal(
    await page.locator(".round-progress .won,.round-progress .lost").count(),
    0,
  );
  await page
    .getByRole("button", { name: "Resume reveal", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Play round 2", exact: true })
    .waitFor();
  check(
    "Switching to Live pauses the reveal until Practice explicitly resumes",
  );
  await page.getByRole("button", { name: "Live rounds", exact: true }).click();
  await connect.click();
  await page.getByRole("dialog", { name: "Connect a wallet" }).waitFor();
  await page
    .getByRole("button", { name: "Coinbase Wallet", exact: true })
    .waitFor();
  await page.keyboard.press("Escape");
  await context.close();

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
  });
  const mp = await mobile.newPage();
  await mp.route("https://api.squeekchain.com/v1/**", (route) => route.abort());
  await mp.goto(url);
  await mp.getByRole("button", { name: "Live rounds", exact: true }).click();
  await mp.getByRole("button", { name: "Connect", exact: true }).click();
  for (const name of ["MetaMask", "Coinbase Wallet", "Rabby", "Phantom"]) {
    const row = mp.getByRole("link", { name: `Open in ${name}`, exact: true });
    assert.ok(
      (await row.getAttribute("href")).includes(encodeURIComponent(url)) ||
        (await row.getAttribute("href")).includes(
          url.replace(/^https?:\/\//, ""),
        ),
    );
    assert.ok(
      await row
        .locator("img")
        .evaluate((img) => img.complete && img.naturalWidth > 0),
    );
  }
  await mp
    .getByRole("button", { name: "Coinbase Smart Wallet", exact: true })
    .waitFor();
  await mp.screenshot({ path: `${output}/wallet-mobile-390.png` });
  await mobile.close();
  check(
    "Phone wallet sheet offers four app links with local marks and Coinbase Smart Wallet",
  );

  const live = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await live.addInitScript(
    ({ player, tx }) => {
      const events = new Map();
      let chainId = "0x1",
        added = false;
      window.fixtureRequests = [];
      window.fixtureRejectConnect = true;
      const emit = (name, value) =>
        (events.get(name) || []).forEach((f) => f(value));
      const provider = {
        on: (name, fn) => events.set(name, [...(events.get(name) || []), fn]),
        removeListener: (name, fn) =>
          events.set(
            name,
            (events.get(name) || []).filter((f) => f !== fn),
          ),
        request: async ({ method, params }) => {
          window.fixtureRequests.push({ method, params });
          if (method === "eth_chainId") return chainId;
          if (method === "net_version") return String(parseInt(chainId, 16));
          if (method === "eth_requestAccounts") {
            if (window.fixtureRejectConnect)
              throw { code: 4001, message: "User rejected request" };
            return [player];
          }
          if (method === "eth_accounts")
            return window.fixtureRejectConnect ? [] : [player];
          if (method === "wallet_switchEthereumChain") {
            if (!added) throw { code: 4902, message: "Unknown chain" };
            chainId = params[0].chainId;
            emit("chainChanged", chainId);
            return null;
          }
          if (method === "wallet_addEthereumChain") {
            added = true;
            chainId = params[0].chainId;
            emit("chainChanged", chainId);
            return null;
          }
          if (method === "eth_sendTransaction") {
            if (window.fixtureRejectTx)
              throw { code: 4001, message: "User rejected request" };
            window.fixtureLastTransaction = params[0];
            if (window.fixtureHoldTx)
              await new Promise((resolve) => {
                window.fixtureReleaseTx = resolve;
              });
            return tx;
          }
          if (
            method === "wallet_requestPermissions" ||
            method === "wallet_getPermissions"
          )
            return [{ parentCapability: "eth_accounts" }];
          if (method === "wallet_revokePermissions") return null;
          throw new Error("Unhandled fixture wallet method " + method);
        },
      };
      window.ethereum = provider;
      const info = {
        uuid: "b1eb6478-6278-4ec5-aac0-086d799f0f26",
        name: "Test wheel wallet",
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><circle cx="14" cy="14" r="14"/></svg>',
        rdns: "test.wheel.wallet",
      };
      const announce = () =>
        window.dispatchEvent(
          new CustomEvent("eip6963:announceProvider", {
            detail: { info, provider },
          }),
        );
      window.addEventListener("eip6963:requestProvider", announce);
      announce();
    },
    { player, tx },
  );
  const lp = await live.newPage();
  lastPage = lp;
  lp.on("pageerror", (e) => errors.push(e.message));
  await lp.route("**/*", async (route) => {
    const req = route.request();
    if (req.url().includes("/v1/core"))
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(state),
      });
    if (req.url().endsWith("/imd-deployment.json"))
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          network: { chainId: handoffChain },
          contracts: { WheelhouseRounds: { address: game } },
        }),
      });
    if (req.method() !== "POST") return route.continue();
    let raw;
    try {
      raw = req.postDataJSON();
    } catch {
      return route.continue();
    }
    if (!raw?.jsonrpc && !Array.isArray(raw)) return route.continue();
    const handle = async (rpc) => {
      const { method, params = [] } = rpc;
      calls.push({ method, params });
      let result;
      if (method === "eth_chainId") result = "0xaa36a7";
      else if (method === "eth_blockNumber") result = "0xb71b00";
      else if (method === "eth_getCode") result = noCode ? "0x" : "0x60006000";
      else if (method === "eth_call") {
        if (params[0].data.startsWith("0x82ad56cb")) {
          const call = decodeFunctionData({
            abi: multicallAbi,
            data: params[0].data,
          });
          result = encodeFunctionResult({
            abi: multicallAbi,
            functionName: "aggregate3",
            result: call.args[0].map((x) => ({
              success: true,
              returnData: readCall(x.callData),
            })),
          });
        } else result = readCall(params[0].data);
      } else if (method === "eth_getTransactionReceipt") {
        const last = await lp.evaluate(() => window.fixtureLastTransaction);
        if (last) {
          const call = decodeFunctionData({ abi, data: last.data });
          exists = true;
          if (call.functionName === "predict") willRun = call.args[1];
          if (call.functionName === "settle") {
            points = 100n;
            settled = true;
          }
        }
        result = {
          transactionHash: tx,
          transactionIndex: "0x0",
          blockHash: block,
          blockNumber: "0xb71b00",
          from: player,
          to: game,
          cumulativeGasUsed: "0x5208",
          gasUsed: "0x5208",
          effectiveGasPrice: "0x1",
          logs: [],
          logsBloom: `0x${"00".repeat(256)}`,
          status: "0x1",
          type: "0x2",
        };
      } else throw new Error("Unhandled fixture RPC " + method);
      return { jsonrpc: "2.0", id: rpc.id, result };
    };
    try {
      const result = Array.isArray(raw)
        ? await Promise.all(raw.map(handle))
        : await handle(raw);
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(result),
      });
    } catch (e) {
      errors.push(e.message);
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: raw.id,
          error: { code: -32603, message: e.message },
        }),
      });
    }
  });
  await lp.goto(url);
  await lp.getByRole("button", { name: "Live rounds", exact: true }).click();
  await lp.getByRole("button", { name: "Connect", exact: true }).click();
  await lp
    .getByRole("button", { name: "Test wheel wallet", exact: true })
    .click();
  await lp
    .getByText("Request declined in your wallet. You can try again.", {
      exact: true,
    })
    .waitFor();
  assert.equal(
    await lp
      .getByRole("button", { name: "Browser wallet", exact: true })
      .count(),
    0,
  );
  await lp.evaluate(() => {
    window.fixtureRejectConnect = false;
  });
  await lp
    .getByRole("button", { name: "Test wheel wallet", exact: true })
    .click();
  await lp
    .getByRole("button", { name: "Switch to Sepolia", exact: true })
    .waitFor();
  assert.equal(
    await lp
      .getByRole("button", { name: "Predict Run onchain", exact: true })
      .isDisabled(),
    true,
  );
  await lp
    .getByRole("button", { name: "Switch to Sepolia", exact: true })
    .click();
  await lp.getByText("Your onchain score: 0 points", { exact: true }).waitFor();
  const methods = await lp.evaluate(() =>
    window.fixtureRequests.map((x) => x.method),
  );
  assert.ok(methods.includes("wallet_switchEthereumChain"));
  assert.ok(methods.includes("wallet_addEthereumChain"));
  check(
    "Named EIP-6963 discovery, rejected connection retry, wrong-chain guard and add/switch Sepolia fallback",
  );
  await lp.evaluate(() => {
    window.fixtureRejectTx = true;
  });
  await lp
    .getByRole("button", { name: "Predict Run onchain", exact: true })
    .click();
  await lp
    .getByText("Request declined in your wallet. You can try again.", {
      exact: true,
    })
    .waitFor();
  await lp.evaluate(() => {
    window.fixtureRejectTx = false;
    window.fixtureHoldTx = true;
  });
  await lp.locator('input[name="onchain-prediction"][value="rest"]').check();
  await lp
    .getByRole("button", { name: "Predict Rest onchain", exact: true })
    .click();
  await lp
    .getByText(
      "Confirm the transaction in your wallet. Sepolia testnet gas is required.",
      { exact: true },
    )
    .waitFor();
  assert.equal(
    await lp
      .getByRole("button", { name: "Transaction in progress…", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    await lp
      .getByRole("button", { name: "Settle round", exact: true })
      .isDisabled(),
    true,
  );
  await lp.waitForFunction(() => Boolean(window.fixtureReleaseTx));
  await lp.evaluate(() => {
    window.fixtureHoldTx = false;
    window.fixtureReleaseTx();
  });
  await lp
    .getByText(`Prediction for round ${current + 1n} confirmed on Sepolia.`, {
      exact: true,
    })
    .waitFor();
  let sent = await lp.evaluate(() => window.fixtureLastTransaction);
  let decoded = decodeFunctionData({ abi, data: sent.data });
  assert.equal(sent.to.toLowerCase(), game);
  assert.equal(sent.from.toLowerCase(), player);
  assert.equal(decoded.functionName, "predict");
  assert.deepEqual(decoded.args, [current + 1n, false]);
  check(
    "Predict simulates Run/Rest and encodes predict(round, false) to the handoff address; rejected signature is recoverable; receipt confirms",
  );
  await lp.getByRole("button", { name: "Settle round", exact: true }).click();
  await lp
    .getByText(`Settlement for round ${current + 1n} confirmed on Sepolia.`, {
      exact: true,
    })
    .waitFor();
  await lp
    .getByText("Your onchain score: 100 points", { exact: true })
    .waitFor();
  sent = await lp.evaluate(() => window.fixtureLastTransaction);
  decoded = decodeFunctionData({ abi, data: sent.data });
  assert.equal(decoded.functionName, "settle");
  assert.deepEqual(decoded.args, [player, current + 1n]);
  assert.ok(
    contractReads.some(
      (c) => c.functionName === "scores" && c.args[0].toLowerCase() === player,
    ),
  );
  await lp.screenshot({
    path: `${output}/confirmed-fixture-390.png`,
    fullPage: true,
  });
  check(
    "Settle encodes settle(player, round); confirmed receipt refreshes scores(player) from RPC, separate from local scores",
  );
  await lp.locator("#settle-round").fill("18446744073709551616");
  assert.equal(
    await lp
      .getByRole("button", { name: "Settle round", exact: true })
      .isDisabled(),
    true,
  );
  check("Settlement input rejects uint64 overflow");
  await lp.addScriptTag({ content: axe.source });
  const la = await lp.evaluate(() =>
    window.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"],
      },
    }),
  );
  assert.deepEqual(
    la.violations.map((v) => ({ id: v.id, nodes: v.nodes.length })),
    [],
  );
  check("Connected Live state passes axe scan");
  noCode = true;
  await lp
    .getByRole("button", { name: "Refresh contract", exact: true })
    .click();
  await lp.getByText(/No game contract was found/).waitFor();
  assert.equal(
    await lp
      .getByRole("button", { name: "Settle round", exact: true })
      .isDisabled(),
    true,
  );
  check("Handoff address with no bytecode blocks transactions");
  noCode = false;
  coreAddress = "0x0000000000000000000000000000000000000000";
  await lp
    .getByRole("button", { name: "Refresh contract", exact: true })
    .click();
  await lp.getByText(/game owner still needs to configure/).waitFor();
  assert.equal(
    await lp
      .getByRole("button", { name: "Settle round", exact: true })
      .isDisabled(),
    true,
  );
  coreAddress = game;
  await lp
    .getByRole("button", { name: "Refresh contract", exact: true })
    .click();
  await lp.getByText(/game uses a different Squeekchain core/).waitFor();
  assert.equal(
    await lp
      .getByRole("button", { name: "Settle round", exact: true })
      .isDisabled(),
    true,
  );
  check(
    "Unconfigured or mismatched game core blocks transactions without changing the pin",
  );
  handoffChain = 1;
  await lp
    .getByRole("button", { name: "Refresh contract", exact: true })
    .click();
  await lp.getByText(/game deployment handoff must name Sepolia/).waitFor();
  assert.equal(
    await lp
      .getByRole("button", { name: "Settle round", exact: true })
      .isDisabled(),
    true,
  );
  check(
    "Invalid refreshed handoff blocks transactions despite a previously cached address",
  );
  await lp.getByRole("button", { name: /0x0000…2222/ }).click();
  await lp.getByRole("button", { name: "Disconnect", exact: true }).click();
  await lp.getByRole("button", { name: "Connect", exact: true }).waitFor();
  check("Connected control exposes the full address and Disconnect");

  await live.close();
  assert.deepEqual(errors, []);
  check("No page errors or missing local runtime resources");
  await writeFile(
    `${output}/results.json`,
    JSON.stringify(
      { checks, errors, rpcMethods: [...new Set(calls.map((c) => c.method))] },
      null,
      2,
    ),
  );
} catch (e) {
  if (lastPage) {
    console.log("FAILED STATE", await lastPage.locator("body").innerText());
    console.log(
      "FIXTURE METHODS",
      await lastPage.evaluate(() => [
        ...new Set(window.fixtureRequests.map((x) => x.method)),
      ]),
    );
    await lastPage.screenshot({ path: `${output}/failed.png`, fullPage: true });
  }
  await writeFile(
    `${output}/results.json`,
    JSON.stringify({ checks, error: String(e), errors }, null, 2),
  );
  throw e;
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
