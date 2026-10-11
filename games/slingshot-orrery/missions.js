// Hand-made missions. Bodies orbit on square rings (radius r, cells counted clockwise from the
// ring's top-left corner; dir 1 = clockwise, -1 = counter-clockwise). Checked with logic.solve().
(function (root) {
  const ember = (phase) => ({ id: 'ember', kind: 'planet', name: 'Ember', r: 3, phase, dir: 1 });
  const tethys = (phase) => ({ id: 'tethys', kind: 'planet', name: 'Tethys', r: 6, phase, dir: -1 });
  const pip = (phase) => ({ id: 'pip', kind: 'moon', name: 'Pip', around: 'tethys', r: 2, phase, dir: 1 });

  root.MISSIONS = [
    {
      name: 'First Burn',
      brief: 'Reach the beacon. Each burn nudges your velocity one square and costs 1 fuel.',
      bodies: [],
      start: { x: 0, y: 12, vx: 1, vy: 0 },
      target: { x: 12, y: 8 },
      fuel: 2,
      turns: 16,
    },
    {
      name: 'Sun Dive',
      brief: 'One fuel is not enough on your own. Ending a turn beside the Sun bends you toward it.',
      bodies: [],
      start: { x: 0, y: 12, vx: 1, vy: 0 },
      target: { x: 13, y: 3 },
      fuel: 1,
      turns: 16,
    },
    {
      name: 'Ember Assist',
      brief: 'Ember moves one square per turn. Meet it at the right moment and let it swing you.',
      bodies: [ember(0)],
      start: { x: 3, y: 16, vx: 0, vy: -1 },
      target: { x: 12, y: 6 },
      fuel: 1,
      turns: 16,
    },
    {
      name: 'Moon Brake',
      brief: 'Moons push you away instead of pulling. Use Pip to bend where planets cannot.',
      bodies: [tethys(0), pip(0)],
      start: { x: 0, y: 3, vx: 1, vy: 0 },
      target: { x: 11, y: 10 },
      fuel: 1,
      turns: 16,
    },
    {
      name: 'Grand Tour',
      brief: 'Everything is moving. Plan the whole route before you commit.',
      bodies: [ember(0), tethys(0), pip(0)],
      start: { x: 0, y: 7, vx: 1, vy: 0 },
      target: { x: 14, y: 6 },
      fuel: 1,
      turns: 16,
    },
  ];
})(typeof window !== 'undefined' ? window : this);
