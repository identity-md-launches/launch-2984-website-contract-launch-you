import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { chromium } = await import(
  process.env.IMD_PLAYWRIGHT
    ? pathToFileURL(process.env.IMD_PLAYWRIGHT).href
    : "playwright"
);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.goto(pathToFileURL(resolve("design/share.svg")).href);
  await page.screenshot({ path: "public/share.png", type: "png" });
} finally {
  await browser.close();
}
