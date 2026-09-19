// Three ways of playing the same game.
//
// A style is not a different bot — every one of them walks the chain of
// chests, gates and gems in the same order, because that is the only order the
// game has. What differs is the three judgements a player actually makes out
// there: **when to turn back**, **what is worth a detour**, and **how far to
// push into ground nobody has lit**.
//
// These stand in for players the way `sim/policies.mjs` does in Pitchou: when a
// style does badly, check it isn't simply playing badly before concluding the
// world is at fault.

// What a light is worth picking up over what a coin is worth, whatever the
// style. Lights are first for everyone because blackout is the thing that
// actually ends an expedition's usefulness — a bot with water and no light is
// walking through a world it cannot see.
const LIGHTS = ['torch-beacon', 'torch-lamp', 'torch-medium', 'torch-small'];
const WATERS = ['spring-vial', 'water-flask', 'water-drop'];

function worth(id, wants) {
  if (id === 'bag') return 100;
  if (LIGHTS.includes(id)) return 40;
  if (WATERS.includes(id)) return 30;
  if (id === 'coin') return wants.coins ? 10 : 0;
  // A gem, a key, a tool lying in the dark: always.
  return 50;
}

export const STYLES = {
  // Turns for home while there is still a walk's worth of slack in the tank,
  // combs the ground it is on rather than pushing past it, and treats anything
  // within a dozen steps as worth the detour. Dies least; gets least done per
  // expedition.
  conservative: {
    id: 'conservative',
    label: 'conservative',
    // Water it insists on having left over and above the walk home, as a
    // fraction of that walk plus a flat reserve. The fraction is what covers
    // the walk home being longer than the walk out looked — rock it has to go
    // round, a gate it cannot open.
    homeSlack: 0.45,
    homeReserve: 25,
    // How many steps out of its way a pickup may be.
    detour: 12,
    // How much further than the furthest tile it has lit on this bearing it is
    // willing to push.
    push: 20,
    wants: { coins: true },
    // Does it read the posts it walks past, and go out of its way for one?
    reads: true,
    // Does it plot a course off what a post told it?
    followsPosts: false,
    // Does it weigh how much new ground a step would light?
    unveils: false,
  },

  // The middle: pushes on, picks up everything, and when it has nowhere in
  // particular to be it takes the step that lights the most ground it has not
  // seen. Turns for home with enough in hand for the walk to be a little
  // longer than it looks, and no more.
  normal: {
    id: 'normal',
    label: 'normal',
    homeSlack: 0.2,
    homeReserve: 12,
    detour: 18,
    push: 35,
    wants: { coins: true },
    reads: true,
    followsPosts: true,
    unveils: true,
  },

  // Reads every post it can and walks the bearing it was given, straight at
  // whatever is out there. Stops for almost nothing and turns for home on the
  // last drop it can afford, which is where the deaths come from.
  eager: {
    id: 'eager',
    label: 'eager',
    homeSlack: 0.05,
    homeReserve: 4,
    detour: 4,
    push: 60,
    wants: { coins: false },
    reads: true,
    followsPosts: true,
    unveils: false,
  },
};

export const STYLE_IDS = Object.keys(STYLES);

// The water a style wants left when it is `home` steps from the hut. Below
// this it stops whatever it was doing and walks back.
export function reserveFor(style, home) {
  return Math.ceil(home * (1 + style.homeSlack) + style.homeReserve);
}

// Whether a pickup `detour` steps off the route is worth taking, for a style
// that rates the item this highly.
export function wantsItem(style, id, detour) {
  const value = worth(id, style.wants);
  if (!value) return 0;
  if (detour > style.detour && value < 50) return 0;
  return value - detour;
}
