// Pure language + night logic for Cipher Station (no Phaser).
// Loaded as a plain script in the browser (window.Cipher) and via require() in node.
(function (root) {
  // The alien lexicon. `meaning` is for the design doc / tests only and is never shown in game.
  const GLYPHS = {
    one: { meaning: 'one (repeat to count)' },
    zero: { meaning: 'zero' },
    plus: { meaning: 'plus / and' },
    eq: { meaning: 'equals' },
    not: { meaning: 'not (negates the whole statement after it)' },
    yes: { meaning: 'true / correct' },
    unk: { meaning: 'unknown (the blank to fill; alone it means "what?")' },
    send: { meaning: 'send me ...' },
    chan: { meaning: 'this channel\'s number' },
  };

  // Expression: term (plus term)*; a term is a run of `one`, a single `zero`, `chan`, or `unk`.
  function evalExpr(tokens, env) {
    if (!tokens.length) return null;
    let total = 0;
    let i = 0;
    while (i < tokens.length) {
      const t = tokens[i];
      if (t === 'one') {
        while (i < tokens.length && tokens[i] === 'one') { total += 1; i++; }
      } else if (t === 'zero') { i++; }
      else if (t === 'chan') { total += env.chan; i++; }
      else if (t === 'unk' && env.unk != null) { total += env.unk; i++; }
      else return null;
      if (i < tokens.length) {
        if (tokens[i] !== 'plus' || i === tokens.length - 1) return null;
        i++;
      }
    }
    return total;
  }

  // Statement: `yes` | `not` statement | expr `eq` expr. Returns true/false, or null if not a statement.
  function evalStatement(tokens, env) {
    if (tokens.length === 1 && tokens[0] === 'yes') return true;
    if (tokens[0] === 'not') {
      const inner = evalStatement(tokens.slice(1), env);
      return inner == null ? null : !inner;
    }
    const k = tokens.indexOf('eq');
    if (k < 0 || tokens.indexOf('eq', k + 1) >= 0) return null;
    const a = evalExpr(tokens.slice(0, k), env), b = evalExpr(tokens.slice(k + 1), env);
    if (a == null || b == null) return null;
    return a === b;
  }

  // Is `reply` a correct answer to `prompt`?
  function answers(prompt, reply, env) {
    const v = evalExpr(reply, { chan: env.chan });
    if (v == null) return false;
    if (prompt[0] === 'send') return v === evalExpr(prompt.slice(1), env);
    return evalStatement(prompt, { chan: env.chan, unk: v }) === true;
  }

  // Shorthand for writing lines: 1 one, 0 zero, + plus, = eq, ! not, Y yes, ? unk, ^ send, C chan.
  const CODE = { '1': 'one', '0': 'zero', '+': 'plus', '=': 'eq', '!': 'not', Y: 'yes', '?': 'unk', '^': 'send', C: 'chan' };
  const S = (str) => str.trim().split(/\s+/).map((w) => CODE[w]);

  // Each night: channel, reply budget, what is already in the log, and the prompts to answer in order.
  const NIGHTS = [
    {
      chan: 1,
      replies: 3,
      intro: [S('1 = 1'), S('Y'), S('1 1 = 1 1'), S('Y'), S('1 1 = 1 1 1'), S('! Y'), S('1 + 1 = 1 1'), S('Y')],
      prompts: [S('1 1 + 1 = ?')],
      outro: [],
    },
    {
      chan: 2,
      replies: 4,
      intro: [S('1 + 0 = 1'), S('Y'), S('0 = 1'), S('! Y'), S('! 0 = 1'), S('Y')],
      prompts: [S('^ 1 1 1'), S('? + 1 1 = 1 1')],
      outro: [],
    },
    {
      chan: 3,
      replies: 4,
      intro: [S('C = 1 1 1'), S('Y'), S('! C = 1 1'), S('Y')],
      prompts: [S('C + ? = 1 1 1 1 1'), S('^ C + 1')],
      // After the last answer the station retunes you: the channel itself is now four.
      outro: [S('C = 1 1 1 1'), S('Y')],
      newChan: 4,
    },
  ];

  function startNight(index) {
    const n = NIGHTS[index];
    const log = n.intro.map((t) => ({ who: 'rx', tokens: t }));
    log.push({ who: 'rx', tokens: n.prompts[0], prompt: true });
    return { night: index, chan: n.chan, repliesLeft: n.replies, promptIndex: 0, log, status: 'open' };
  }

  // Send a reply. Returns the new state and the list of incoming lines it caused.
  function transmit(state, reply) {
    const night = NIGHTS[state.night];
    const st = { ...state, log: state.log.slice() };
    st.log.push({ who: 'tx', tokens: reply.slice() });
    st.repliesLeft -= 1;
    const incoming = [];
    const env = { chan: st.chan };
    const prompt = night.prompts[st.promptIndex];
    const asValue = evalExpr(reply, env);
    if (asValue != null) {
      if (answers(prompt, reply, env)) {
        incoming.push(['yes']);
        st.promptIndex += 1;
        if (st.promptIndex < night.prompts.length) {
          incoming.push(night.prompts[st.promptIndex]);
        } else {
          if (night.newChan) st.chan = night.newChan;
          incoming.push(...night.outro);
          st.status = 'won';
        }
      } else incoming.push(['not', 'yes']);
    } else {
      const truth = evalStatement(reply, env);
      incoming.push(truth == null ? ['unk'] : truth ? ['yes'] : ['not', 'yes']);
    }
    const promptLine = st.status !== 'won' && incoming.length > 1 ? incoming.length - 1 : -1;
    incoming.forEach((t, i) => st.log.push({ who: 'rx', tokens: t, prompt: i === promptLine }));
    if (st.status !== 'won' && st.repliesLeft <= 0) st.status = 'lost';
    return { state: st, incoming };
  }

  // Glyphs the player has seen so far (only these appear on the keyboard).
  function seenGlyphs(logs) {
    const seen = new Set();
    for (const l of logs) for (const t of l.tokens) seen.add(t);
    return Object.keys(GLYPHS).filter((g) => seen.has(g));
  }

  const api = { GLYPHS, NIGHTS, evalExpr, evalStatement, answers, startNight, transmit, seenGlyphs };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Cipher = api;
})(this);
