// Dev helper, not a test: screenshots every example machine into a folder, for
// a look at the screen without opening a browser. `node tests/shot.mjs <dir>`.
import { EXAMPLES } from '../src/data/bench.js';
import { launchBrowser, openGame, startServer } from './harness.js';

const out = process.argv[2] || '.';
const { server, port } = await startServer();
const browser = await launchBrowser();
const game = await openGame(browser, port);
for (const [i, example] of EXAMPLES.entries()) {
  await game.clickText(example.name);
  await game.page.waitForTimeout(200);
  await game.shot(`${out}/example-${i + 1}.png`);
}
const errors = game.pageErrors();
if (errors.length) console.log(errors.join('\n'));
await browser.close();
server.close();
