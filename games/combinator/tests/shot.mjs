// Dev helper, not a test: screenshots each starting machine on the Workbench
// and the Playground with its starting layout (before and after the Tank
// Sprinkler and the Steam Fan have worked), for a look at the screens
// without opening a browser. `node tests/shot.mjs <dir>`.
import { EXAMPLES } from '../src/data/world.js';
import { launchBrowser, openGame, startServer } from './harness.js';

const out = process.argv[2] || '.';
const { server, port } = await startServer();
const browser = await launchBrowser();
const game = await openGame(browser, port);
for (const [i] of EXAMPLES.entries()) {
  await game.clickAt(...(await game.machineRow(`k${i + 1}`)));
  await game.page.waitForTimeout(200);
  await game.shot(`${out}/workbench-${i + 1}.png`);
}
await game.open('Playground');
await game.page.waitForTimeout(200);
await game.shot(`${out}/playground.png`);
await game.clickAt(...(await game.tile(3, 3)));
await game.clickAt(...(await game.tile(4, 3)));
await game.page.waitForTimeout(800);
await game.shot(`${out}/playground-worked.png`);
const errors = game.pageErrors();
if (errors.length) console.log(errors.join('\n'));
await browser.close();
server.close();
