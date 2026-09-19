// A bot that walks the campaign, so the world can be measured by playing it.
//
// It drives the real `core/rules.js` — `createRun`, `step`, `openChest`,
// `bankRun`, `turnCycle` — through the real `core/save.js` slot, so anything it
// reports is something a player could have done. What it is *not* is a good
// player: it is a consistent one, which is what a comparison needs. When a
// number here looks wrong, check the bot isn't simply playing badly before
// concluding the world is (`sim/README.md`).
//
// What it knows is what it has lit. `state.explored` is its map, `seenUnique`
// is what the game itself records having laid eyes on, and the two things the
// game does *not* record — which sanctums it has seen the wall of, and which
// signposts it has walked past — it keeps itself. Nothing reads a structure's
// coordinates out of `core/world.js` before a light has reached it, with one
// deliberate exception: a wisp is lit from the very first reveal of a run and
// shows on the map from then on (DESIGN.md §4.11), so the bot uses the ten of
// them as waypoints out into the dark exactly as the map invites a player to.

import { tileKey, visibleTiles } from '../src/core/light.js';
import {
  blocksSight,
  chests,
  landmarkNamed,
  landmarks,
  sanctumAt,
  sanctums,
  signpostAt,
  SIGNPOST_SECTORS,
  sites,
  wisps,
} from '../src/core/world.js';
import {
  abandonRun,
  activeShape,
  bankRun,
  buy,
  canBuy,
  createRun,
  equip,
  hallMeeting,
  isBlackout,
  itemOnTile,
  priceFor,
  spendable,
  step,
  turnCycle,
} from '../src/core/rules.js';
import { emptySave, loadSave, writeSave } from '../src/core/save.js';
import { LANDMARK_CHEST_NEAR, LANDMARK_CHEST_SPAN, LIGHT_ORDER, SIGNPOST_BANDS } from '../src/balance.js';
import { createNav, manhattan, routeTo, STEPS } from './nav.mjs';
import { reserveFor, wantsItem } from './styles.mjs';

// How often the bot works out again how far it is from home. Every step would
// be honest and far too slow; between searches it moves the number by one a
// step, which is exact whenever the walk home is a straight one and near enough
// when it is not.
const HOME_EVERY = 12;

// How often the bot looks up from the route it is walking and asks whether
// there is something better to be doing. Never would mean walking past a torch
// lying two tiles off the path; every step would mean paying for a search it
// almost always throws away.
const GOAL_EVERY = 8;

// How far from the character the bot bothers reading the ground. A light never
// reaches further than three tiles, and the wisps' own clearings — which
// `litTiles` unions in wherever they stand — are ground it has not walked to
// and cannot pick anything up off.
const LOOK = 4;

// Two sanity rails, not rules. An expedition that has taken this many turns
// without dying or getting home is stuck on something and is counted as such —
// and so is one whose turns have run far ahead of its steps, which is the shape
// every stuck walk actually has: a bump costs no step, so a bot pinned against
// something can burn a search a turn for ever while the step count stands
// still. Bounding the ratio is what keeps one bad campaign from costing a sweep
// an afternoon.
const MAX_TURNS = 4000;
const TURNS_PER_STEP = 3;
const TURN_ALLOWANCE = 200;

// How many bearings out of the hut the bot keeps a frontier for.
const SECTORS = 8;

function sectorOf(x, y) {
  const angle = Math.atan2(y, x);
  return ((Math.floor((angle / (Math.PI * 2)) * SECTORS) % SECTORS) + SECTORS) % SECTORS;
}

// Lights, best first. The ladder in balance.js is smallest first, so its index
// doubles as how much a light shows.
const BEST_LIGHT = [...LIGHT_ORDER].reverse();

function litScore(id) {
  return LIGHT_ORDER.indexOf(id);
}

// --- What the bot has seen -----------------------------------------------------

// What a campaign remembers between walks, as against what one walk knows.
// The game writes down the ground and the unique objects a light has reached
// (`explored`, `seenUnique`), and two things it does not: which sanctums the
// bot has seen the *wall* of — you cannot see the gem at the centre until you
// are inside — and which posts it has walked past and what they said. A player
// remembers all four, so the bot does too.
export function newMemory() {
  return {
    sanctums: new Map(),
    posts: new Map(),
    hints: new Map(),
    blocked: new Set(),
  };
}

function newBot(roll, memory) {
  return {
    roll,
    // Item id by tile, for everything it has lit and not yet picked up.
    items: new Map(),
    // Tiles it has read the ground of already, so it reads each one once.
    scanned: new Set(),
    // Tiles it has walked into and found solid, for the ones a blackout walk
    // never lit — everywhere else `state.explored` is the record.
    blocked: memory.blocked,
    // Tiles it has already bumped on this walk. Everything you bump gives up
    // what it has to give on the touch — a chest's lid, a post's bearing, a
    // landmark's gift — and gives it up once, so bumping the same thing twice
    // on one walk is the bot standing still. Cleared with the expedition, which
    // is also what stops it oscillating off a landmark to farm the gift.
    avoid: new Set(),
    // The sanctums it has seen the wall or gate of. The game itself only writes
    // down the gem at the centre, which you cannot see until you are inside.
    sanctums: memory.sanctums,
    // The signposts it has walked past, which the game does not write down
    // either, and the ones it has already read.
    posts: memory.posts,
    // Where a post said a landmark lies: a bearing out of eight and a band of
    // distance, turned into a point to walk at. Never the landmark's own
    // coordinates — that is not what a post tells you.
    hints: memory.hints,
    goal: null,
    path: [],
    goingHome: false,
    homeSteps: 0,
    sinceHome: 0,
    sinceGoal: 0,
    stalls: 0,
  };
}

// The middle of the band a post quotes, in tiles: under 15 is "nearby", under
// 40 and under 80 are the two walks, past 80 is "far".
function bandDistance(band) {
  const low = band === 0 ? 0 : SIGNPOST_BANDS[band - 1];
  const high = band < SIGNPOST_BANDS.length ? SIGNPOST_BANDS[band] : SIGNPOST_BANDS[SIGNPOST_BANDS.length - 1] * 1.5;
  return (low + high) / 2;
}

// Where a reading points, as a tile to walk at: the post's own spot, plus the
// middle of the band along the middle of the sector it named.
function hintPoint(post, reading) {
  const angle = (reading.bearing / SIGNPOST_SECTORS) * Math.PI * 2;
  const distance = bandDistance(reading.band);
  return {
    x: Math.round(post.x + Math.sin(angle) * distance),
    y: Math.round(post.y - Math.cos(angle) * distance),
  };
}

// What the light in hand shows, without the ten wisps `litTiles` unions in
// wherever they stand. The wisps' own clearings are ground the bot has not
// walked to and cannot pick anything up off, and composing them costs ten
// shadow casts a step.
function carriedLight(state) {
  const shape = activeShape(state);
  if (!shape) return [];
  return visibleTiles(shape, state.x, state.y, state.facing, (x, y) => blocksSight(x, y, state.seed, state.keys));
}

// Everything the light just showed, filed: what is lying about, which sanctum
// walls are out there, and which posts are worth walking into.
function observe(state, bot, lit = null) {
  for (const { x, y } of lit || carriedLight(state)) {
    if (Math.abs(x - state.x) > LOOK || Math.abs(y - state.y) > LOOK) continue;
    const key = tileKey(x, y);
    const id = itemOnTile(state, x, y);
    if (id) bot.items.set(key, id);
    else bot.items.delete(key);
    if (bot.scanned.has(key)) continue;
    bot.scanned.add(key);
    const wall = sanctumAt(x, y, state.seed);
    if (wall) bot.sanctums.set(wall.sanctum.index, wall.sanctum);
    const post = signpostAt(x, y, state.seed);
    if (post) bot.posts.set(post.post.id, post.post);
  }
}

// --- Goals ---------------------------------------------------------------------

const HUT = { x: 0, y: 0 };

// A point that many steps of walking out on this bearing. Measured in steps
// rather than on whatever ring the world is placed on, because what the bot is
// budgeting is its water and water is spent one step at a time.
function outward(distance, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const m = Math.abs(c) + Math.abs(s);
  return { x: Math.round((distance * c) / m), y: Math.round((distance * s) / m) };
}

// The ring a key chest stands on round its landmark (balance.js
// `LANDMARK_CHEST_NEAR`), as a circuit of tiles to walk. A landmark is what a
// walk finds and the chest is what it came for (DESIGN.md §4.10) — but a torch
// shows one tile, so having found the landmark the bot still has to go round
// it, which is exactly what a player does.
const CIRCUIT = 12;

// When a walk is worth turning aside to a stall for: under this much burn left
// in the bag, and enough in the purse for it to be worth the walk.
const RESTOCK_LIGHT = 140;
const RESTOCK_PURSE = 60;

function circuit(centre, bot) {
  const radius = LANDMARK_CHEST_NEAR + Math.floor(LANDMARK_CHEST_SPAN / 2);
  const out = [];
  for (let i = 0; i < CIRCUIT; i++) {
    const angle = (i / CIRCUIT) * Math.PI * 2;
    const x = centre.x + Math.round(Math.cos(angle) * radius);
    const y = centre.y + Math.round(Math.sin(angle) * radius);
    if (!bot.avoid.has(tileKey(x, y))) out.push({ kind: 'circuit', x, y });
  }
  return out;
}

// The chain the campaign is on, as far as the bot can see it: the bag a death
// left, then the key for the next shut gate, then the gem behind it, then the
// hall. Returns the tiles worth walking at, best first — `chooseGoal` takes the
// first one it can actually route to.
function chainGoals(state, bot) {
  const out = [];
  const fresh = (goal) => !bot.avoid.has(tileKey(goal.x, goal.y));
  if (state.bag) out.push({ kind: 'bag', x: state.bag.x, y: state.bag.y });

  // A stall is a chain link like any other once the walk is long enough to
  // need one: coins are worth nothing but light, and a walk that goes dark at
  // ring 100 cannot reach the hall at 110 however much water it has left.
  if (lightLeft(state) < RESTOCK_LIGHT && spendable(state) >= RESTOCK_PURSE)
    for (const stall of sites(state.seed))
      if (stall.item === null && state.seenUnique.has(stall.id))
        out.push({ kind: 'stall', x: stall.x, y: stall.y });

  // The sanctums hand their gems out in order, so how many are held says which
  // one is next — and past the third that is the hall, which wants the third
  // key like every other gate and holds a conversation instead of a gem.
  const built = sanctums(state.seed);
  const next = built[Math.min(state.gems, built.length - 1)];

  if (next.key && !state.keys.has(next.key)) {
    const box = chests(state.seed).find((c) => c.key === next.key);
    if (box && !state.chests.has(box.id)) {
      // Bumped, not stood on: a chest is opened by walking into it (DESIGN.md
      // §4.8), so the route ends on its apron and the last step of it is the
      // lid.
      if (state.seenUnique.has(box.id)) out.push({ kind: 'key-chest', bump: true, x: box.x, y: box.y });
      // The key chests stand three to five tiles off a landmark's court, so
      // the landmark is the thing to walk at and the chest is what you find
      // when you get there (DESIGN.md §4.10).
      const near = box.at ? landmarkNamed(box.at, state.seed) : null;
      if (near && state.seenUnique.has(near.id)) {
        out.push({ kind: 'landmark', bump: true, x: near.x, y: near.y });
        out.push(...circuit(near, bot));
      }
      if (near && bot.hints.has(near.id)) out.push({ kind: 'hint', ...bot.hints.get(near.id) });
    }
  } else if (bot.sanctums.has(next.index)) {
    // The gem is picked up off the floor; the sorcerer is walked into.
    out.push({ kind: next.hall ? 'hall' : 'gem', bump: !!next.hall, x: next.centre.x, y: next.centre.y });
  }
  return out.filter(fresh);
}

// Anything lying about, or standing about, that is worth going to get. Scored
// by what it is worth less how far off the route it is (`styles.mjs`).
function pickupGoals(state, bot, style, aim) {
  const out = [];
  // How many steps going by way of this tile actually adds to the walk the bot
  // is already on. Straight-line rather than searched, because it is asked of
  // every lit item every few steps and only ever decides whether a route is
  // worth costing properly.
  const detourTo = (x, y) =>
    manhattan(state.x, state.y, x, y) +
    manhattan(x, y, aim.x, aim.y) -
    manhattan(state.x, state.y, aim.x, aim.y);

  for (const [key, id] of bot.items) {
    if (bot.avoid.has(key)) continue;
    const [x, y] = key.split(',').map(Number);
    const value = wantsItem(style, id, detourTo(x, y));
    if (value > 0) out.push({ kind: 'item', id, x, y, score: value });
  }
  // A landmark pays out on every fresh touch — a full tank at the Bell, a
  // relit torch at the Lantern Tree — so it is a pickup that never runs out.
  for (const mark of landmarks(state.seed)) {
    if (!state.seenUnique.has(mark.id) || bot.avoid.has(tileKey(mark.x, mark.y))) continue;
    const detour = detourTo(mark.x, mark.y);
    if (detour > style.detour * 2) continue;
    out.push({ kind: 'landmark', bump: true, x: mark.x, y: mark.y, score: 35 - detour });
  }
  // And a post is worth walking into — a long way into, for a style that plots
  // its course off what one says, since the bearing it hands over is the only
  // thing in the game that names somewhere the walk has not already been.
  if (style.reads) {
    const reach = style.followsPosts ? style.detour * 4 : style.detour;
    for (const [id, post] of bot.posts) {
      if (state.posts.has(id) || bot.avoid.has(tileKey(post.x, post.y))) continue;
      const detour = detourTo(post.x, post.y);
      if (detour > reach) continue;
      out.push({
        kind: 'signpost',
        bump: true,
        x: post.x,
        y: post.y,
        score: (style.followsPosts ? 45 : 16) - detour * 0.5,
      });
    }
  }
  return out.filter((g) => g.score > 0).sort((a, b) => b.score - a.score).slice(0, 6);
}

// Where to push when there is nothing in particular to walk at. The wisps are
// the waypoints: ten of them, on rings of their own from 6 out to 116, lit and
// on the map from the first reveal of a run, so walking the next one out is
// exactly what the map invites. With none left to visit it picks a bearing and
// pushes past the furthest ground it has lit on it.
function exploreGoals(state, bot, style, budget) {
  const out = [];
  for (const wisp of wisps(state.seed)) {
    if (state.wisps.has(wisp.id) || bot.avoid.has(tileKey(wisp.x, wisp.y))) continue;
    const ring = manhattan(wisp.x, wisp.y);
    if (ring > budget) continue;
    // Furthest out that is still inside the budget: a walk that pushes the
    // frontier rather than one that tidies up behind it.
    out.push({
      kind: 'wisp',
      bump: true,
      x: wisp.x,
      y: wisp.y,
      score: ring - manhattan(state.x, state.y, wisp.x, wisp.y) * 0.5,
    });
  }
  out.sort((a, b) => b.score - a.score);

  const reach = Math.max(bot.sectors[bot.sector], manhattan(state.x, state.y));
  // Past the frontier by however far the style dares — but never so little
  // that the walk comes home with most of its tank unspent, which is what
  // creeping out in fixed increments into a bearing nobody has walked does.
  const depth = Math.min(budget, Math.max(reach + style.push, Math.floor(budget * 0.6)));
  // The push goes last and is never dropped for being unaffordable: it is cut
  // to the budget already, and it is what the walk falls back on when every
  // wisp left in the world is further out than this tank reaches.
  return [...out.slice(0, 3), { kind: 'push', ...outward(Math.max(depth, 6), bot.bearing) }];
}

// How far out the bot can still afford to walk: whatever is left after keeping
// back what it would take to get home from there.
function outwardBudget(state, style) {
  const water = Math.floor((state.water - style.homeReserve) / (2 + style.homeSlack));
  // And no further out than there is light to see by: past that the walk is
  // groping in the dark, which finds nothing and is what `chooseGoal` turns it
  // round for. The walk home needs no light, so only the way out is budgeted.
  return Math.max(0, Math.min(water, lightLeft(state)));
}

// --- Walking ---------------------------------------------------------------------

function plan(state, nav, bot, goal) {
  const opts = { keys: state.keys, known: state.explored, blocked: bot.blocked, maxNodes: 20000, weight: 1.3 };
  const found = routeTo(nav, state, goal, opts);
  if (!found || !found.path.length) return null;
  return found;
}

function chooseGoal(state, nav, bot, style) {
  const budget = outwardBudget(state, style);

  // Walking in the dark shows nothing and finds nothing, so a walk that has
  // burned its last light has no reason to be out here — it turns for home and
  // sets out again with the fresh one the hut hands every expedition.
  if (bot.goingHome || isBlackout(state) || state.water <= reserveFor(style, bot.homeSteps)) {
    bot.goingHome = true;
    return { goal: { kind: 'home', ...HUT }, found: plan(state, nav, bot, HUT) };
  }

  // What the walk is *for*: the next link in the chain if the bot can see one,
  // and a push into the thinnest bearing if it cannot. Chosen first, and
  // everything else is measured against it — a bot that took the nearest
  // pickup every time it looked up would comb the doorstep for ever, which is
  // a thing players do and not a thing a campaign does.
  let primary = null;
  for (const goal of [...chainGoals(state, bot), ...exploreGoals(state, bot, style, budget)]) {
    const found = plan(state, nav, bot, goal);
    if (!found) continue;
    // Never set out for something the tank cannot carry you back from. A push
    // into the dark is the one exception: it is already cut to the budget, and
    // going as far as the water allows is what the push is.
    if (goal.kind !== 'push' && found.steps + reserveFor(style, manhattan(goal.x, goal.y)) > state.water) continue;
    primary = { goal, found };
    break;
  }
  if (!primary) {
    bot.goingHome = true;
    return { goal: { kind: 'home', ...HUT }, found: plan(state, nav, bot, HUT) };
  }

  // And what is worth stepping off it for: whatever is close enough to the
  // line the bot is already walking. `detour` is the whole of the judgement —
  // the steps the diversion actually adds, not how near the thing is.
  const aim = primary.goal;
  for (const grab of pickupGoals(state, bot, style, aim)) {
    const found = plan(state, nav, bot, grab);
    if (!found) continue;
    if (found.steps + reserveFor(style, manhattan(grab.x, grab.y)) > state.water) continue;
    return { goal: grab, found };
  }
  return primary;
}

// Which of the four steps lights the most ground nobody has lit — the one
// judgement the `normal` style makes that the other two don't.
//
// Counted over the light's own block rather than through `visibleTiles`: what
// a shape actually reaches depends on what it can see round, and working that
// out four times a step costs more than the whole rest of the walk. The block
// over-counts a step taken against a wall by the same amount in every
// direction, so which of the four wins is very nearly the same answer for a
// fraction of the price.
function unveilingStep(state, nav, bot) {
  const shape = activeShape(state);
  if (!shape) return null;
  const radius = shape.radius || shape.depth || 1;
  let best = null;
  for (const [name, dx, dy] of STEPS) {
    const nx = state.x + dx;
    const ny = state.y + dy;
    if (nav.needs(nx, ny) !== null || bot.blocked.has(tileKey(nx, ny))) continue;
    let fresh = 0;
    for (let y = ny - radius; y <= ny + radius; y++)
      for (let x = nx - radius; x <= nx + radius; x++) if (!state.explored.has(tileKey(x, y))) fresh += 1;
    if (!best || fresh > best.fresh) best = { name, fresh };
  }
  return best && best.fresh > 0 ? best.name : null;
}

// What all the lights in the bag are worth together, which is how many more
// steps this walk can still see by. The real leash on an expedition: water
// carries two hundred steps and a starting torch a hundred, so a walk runs out
// of light long before it runs out of water unless it finds more.
function lightLeft(state) {
  return state.inventory.reduce((sum, slot) => sum + slot.durability, 0);
}

// The best light for what the bot is doing. Width is worth having, but only
// against how much burn it costs: a wider light that goes out in ten steps
// shows less ground than a small one that lasts a hundred, so the two are
// traded off rather than ranked. On the way home width is worth nothing at
// all — what matters is not going dark before the door.
const WIDTH_WORTH = 15;

function equipBest(state, bot) {
  if (!state.inventory.length) return;
  const rank = (slot) => (bot.goingHome ? slot.durability : slot.durability + litScore(slot.id) * WIDTH_WORTH);
  let want = 0;
  state.inventory.forEach((slot, i) => {
    if (rank(slot) > rank(state.inventory[want])) want = i;
  });
  if (want !== state.activeIndex) equip(state, want);
}

// Everything the merchant is worth to a bot: light, and water to carry it.
// It never buys the compass — at 250 coins that is most of a campaign's income,
// and a needle is a tool for a player reading a screen rather than a thing this
// model of one knows how to spend on (`sim/README.md`).
// How many lights the bot will walk out of a stall with. Five was a purse
// emptied on a walk that still went dark at ring 100: the hall stands at 110
// and the walk to it is half as long again as that, so an expedition that means
// to reach it has to buy its way there.
const BAG_OF_LIGHTS = 8;

function shop(state) {
  let bought = 0;
  for (let i = 0; i < 12; i++) {
    const pick = BEST_LIGHT.find((id) => priceFor(state, id) !== null && canBuy(state, id));
    if (!pick || state.inventory.length >= BAG_OF_LIGHTS) break;
    buy(state, pick);
    bought += 1;
  }
  while (canBuy(state, 'water-drop') && spendable(state) >= priceFor(state, 'water-drop')) {
    if (!buy(state, 'water-drop')) break;
    bought += 1;
  }
  return bought;
}

// --- One expedition ---------------------------------------------------------------

function playExpedition(state, nav, style, bot, tally) {
  observe(state, bot);
  bot.homeSteps = manhattan(state.x, state.y);
  bot.straight = bot.homeSteps;
  // How far out the campaign has already lit, bearing by bearing. A push goes
  // into the thinnest of the eight, so a campaign sweeps outward instead of
  // re-walking whichever way it happened to roll.
  bot.reach = 0;
  bot.sectors = new Array(SECTORS).fill(0);
  for (const key of state.explored) {
    const [x, y] = key.split(',').map(Number);
    const out = manhattan(x, y);
    if (out > bot.reach) bot.reach = out;
    const s = sectorOf(x, y);
    if (out > bot.sectors[s]) bot.sectors[s] = out;
  }
  let thinnest = 0;
  for (let i = 1; i < SECTORS; i++) if (bot.sectors[i] < bot.sectors[thinnest]) thinnest = i;
  bot.sector = thinnest;
  bot.bearing = ((thinnest + 0.5) / SECTORS) * Math.PI * 2 + (bot.roll() - 0.5) * (Math.PI / SECTORS);

  let turns = 0;
  let walked = 0;
  let last = tileKey(state.x, state.y);
  while (turns++ < MAX_TURNS) {
    if (turns > walked * TURNS_PER_STEP + TURN_ALLOWANCE) return 'stranded';
    if (state.water <= 0) return 'died';
    equipBest(state, bot);

    if (!bot.path.length || bot.stalls > 0 || bot.sinceGoal >= GOAL_EVERY) {
      const chosen = chooseGoal(state, nav, bot, style);
      if (!chosen.found) return 'stranded';
      bot.goal = chosen.goal;
      bot.path = chosen.found.path;
      bot.stalls = 0;
      bot.sinceGoal = 0;
      // What the walk is spending itself on, which is the first thing to look
      // at when a campaign stalls: a bot that never picks `key-chest` has not
      // found the chest, and one that never picks `push` is not exploring.
      tally.goals[bot.goal.kind] = (tally.goals[bot.goal.kind] || 0) + 1;
    }
    bot.sinceGoal += 1;

    let dir = bot.path[0];
    // With nowhere in particular to be, the `normal` style spends its step on
    // whichever direction lights the most new ground.
    if (style.unveils && bot.goal.kind === 'push' && !isBlackout(state)) {
      const better = unveilingStep(state, nav, bot);
      if (better && better !== dir) {
        dir = better;
        bot.path = [];
      }
    }

    const res = step(state, dir);
    if (res.moved) {
      bot.path.shift();
      walked += 1;
      tally.steps += 1;
      bot.sinceHome += 1;
      // What turning back would cost, which is the number every decision about
      // when to turn back rests on. Searched for properly every so often;
      // between searches it moves by however much the straight-line walk moved,
      // and never reads as shorter than that straight line.
      const straight = manhattan(state.x, state.y);
      if (bot.sinceHome % HOME_EVERY === 0) {
        const back = routeTo(nav, state, HUT, {
          keys: state.keys,
          known: state.explored,
          blocked: bot.blocked,
          maxNodes: 20000,
        });
        bot.homeSteps = back ? back.steps : straight;
      } else {
        bot.homeSteps = Math.max(straight, bot.homeSteps + (straight - bot.straight));
      }
      bot.straight = straight;
      const here = tileKey(state.x, state.y);
      bot.items.delete(here);
      // Standing somewhere is the end of any reason to walk there, which is
      // what retires a circuit tile once it has been looked at.
      bot.avoid.add(here);
      if (res.picked) tally.picked[res.picked] = (tally.picked[res.picked] || 0) + 1;
      if (res.respawned) {
        bot.items.clear();
        bot.scanned.clear();
      }
      observe(state, bot, res.lit);
      if (res.atMerchant) tally.bought += shop(state);
      if (res.atBase) return 'home';
      if (res.died) return 'died';
      bot.stalls = 0;
    } else {
      // A bump: a chest, a landmark, a post, a stone, a wisp, the sorcerer — or
      // simply a wall the optimistic route walked at. Either way the plan is
      // spent, and a wall is worth writing down.
      const [bx, by] = STEPS.find(([name]) => name === dir).slice(1);
      bot.avoid.add(tileKey(state.x + bx, state.y + by));
      if (res.reason === 'sorcerer') return 'hall';
      if (res.reason === 'chest') tally.chests += 1;
      if (res.reason === 'landmark' && res.fresh) tally.landmarks += 1;
      if (res.reason === 'signpost') {
        tally.posts += 1;
        const post = bot.posts.get(res.post);
        if (post && res.readings) for (const reading of res.readings) bot.hints.set(reading.target, hintPoint(post, reading));
      }
      if (res.reason === 'stone') tally.stones += 1;
      if (res.reason === 'wisp') tally.wisps += 1;
      if (res.reason === 'blocked' || res.reason === 'edge' || res.reason === 'locked')
        bot.blocked.add(tileKey(state.x + bx, state.y + by));
      bot.path = [];
      const here = tileKey(state.x, state.y);
      bot.stalls = here === last ? bot.stalls + 1 : 1;
      last = here;
      if (bot.stalls > 24) return 'stranded';
    }
  }
  return 'stranded';
}

// --- One campaign -------------------------------------------------------------------

export function playCampaign({ seed, style, roll, maxExpeditions = 60, stepBudget = 40000 }) {
  writeSave({ ...emptySave(), started: true, seed });

  const tally = {
    seed,
    style: style.id,
    steps: 0,
    expeditions: 0,
    deaths: 0,
    stranded: 0,
    cycles: 0,
    finishedWorlds: 0,
    completed: false,
    gemsSeen: 0,
    chests: 0,
    landmarks: 0,
    posts: 0,
    stones: 0,
    wisps: 0,
    bought: 0,
    picked: {},
    goals: {},
    explored: 0,
    furthest: 0,
    coins: 0,
    // Where the campaign got to in the chain, for when it did not get to the
    // end of it: the keys it holds and which sanctums it has laid eyes on.
    // A campaign that never saw the hall's wall and one that saw it and could
    // not open it are stuck on different things.
    keys: [],
    sanctumsSeen: 0,
    // Campaign steps at the moment each of the three gems was first banked, and
    // at the first walk into a hall — the numbers the two roses are compared on.
    toGem: [null, null, null],
    toHall: null,
    perExpedition: [],
  };

  let memory = newMemory();
  const navs = new Map();
  const navFor = (worldSeed) => {
    if (!navs.has(worldSeed)) navs.set(worldSeed, createNav(worldSeed));
    return navs.get(worldSeed);
  };

  let state = createRun(undefined, loadSave(), undefined);
  for (let e = 0; e < maxExpeditions && tally.steps < stepBudget; e++) {
    const bot = newBot(roll, memory);
    const before = tally.steps;
    const outcome = playExpedition(state, navFor(state.seed), style, bot, tally);
    tally.expeditions += 1;
    tally.furthest = Math.max(tally.furthest, state.furthest);
    tally.perExpedition.push({ outcome, steps: tally.steps - before, furthest: state.furthest, gems: state.gems });

    if (outcome === 'hall') {
      const meeting = hallMeeting(state);
      if (tally.toHall === null) tally.toHall = tally.steps;
      if (meeting.last) {
        tally.completed = true;
        tally.finishedWorlds += 1;
        tally.explored = state.explored.size;
        break;
      }
      if (meeting.finishes) tally.finishedWorlds += 1;
      tally.cycles += 1;
      // He unmakes the ground, so everything the campaign knew about where
      // things stood goes with it (DESIGN.md §4.9).
      memory = newMemory();
      state = turnCycle(state);
      continue;
    }

    if (outcome === 'home') {
      const save = bankRun(state);
      tally.gemsSeen = Math.max(tally.gemsSeen, save.gems);
      tally.coins = save.coins;
      for (let g = 0; g < save.gems; g++) if (tally.toGem[g] === null) tally.toGem[g] = tally.steps;
    } else {
      if (outcome === 'died') tally.deaths += 1;
      else tally.stranded += 1;
      abandonRun(state);
    }
    tally.explored = state.explored.size;
    state = createRun(undefined, loadSave(), undefined);
  }
  tally.explored = Math.max(tally.explored, state.explored.size);
  tally.keys = [...state.keys];
  tally.sanctumsSeen = memory.sanctums.size;
  return tally;
}
