import { harness, sleep } from './rig.mjs';
const OUT = process.argv[2];
const { server, port } = await harness.startServer();
const browser = await harness.launchBrowser();
for (const page of ['tiles', 'paint', 'draw', 'biomes', 'states', 'distances', 'text']) {
  const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${port}/${page}.html`);
  await sleep(4000);
  await p.screenshot({ path: `${OUT}/95-dev-${page}.png` });
  console.log(page, errs);
  await p.close();
}
await browser.close(); server.close();
