// The whole suite: every `*.test.js` file, run in one pass against one server
// and one browser.
//
// Each of those files registers into the same runner and can also be run on its
// own (`node tests/terrain.test.js`), which is the quick way to work — the pure
// suites take about a second and never start a browser at all.
//
// Pure first, so a broken rule fails in a second rather than after three
// minutes of driving a canvas that was never going to agree with it.

import { run } from './harness.js';

import './light.test.js';
import './rules.test.js';
import './terrain.test.js';
import './scatter.test.js';
import './campaign.test.js';
import './landmarks.test.js';
import './save.test.js';
import './sprites.test.js';

import './ui-shell.test.js';
import './ui-explore.test.js';
import './ui-items.test.js';
import './ui-campaign.test.js';
import './ui-landmarks.test.js';

run();
