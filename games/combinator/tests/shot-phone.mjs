// Dev helper, not a test: screenshots the mobile layout on a phone-sized
// screen, each screen with each of its bottom tabs. `node tests/shot-phone.mjs <dir>`.
import { launchBrowser, openGame, startServer } from './harness.js';

const out = process.argv[2] || '.';
const { server, port } = await startServer();
const browser = await launchBrowser();
const game = await openGame(browser, port, { phone: true });
for (const tab of ['Readout', 'Inspect', 'Test run', 'Saved']) {
  await game.tapText(tab);
  await game.page.waitForTimeout(150);
  await game.shot(`${out}/phone-workbench-${tab.split(' ')[0].toLowerCase()}.png`);
}
await game.open('Playground');
for (const tab of ['Readout', 'Inspect', 'Round']) {
  await game.tapText(tab);
  await game.page.waitForTimeout(150);
  await game.shot(`${out}/phone-playground-${tab.toLowerCase()}.png`);
}
const errors = game.pageErrors();
if (errors.length) console.log(errors.join('\n'));
await browser.close();
server.close();
