// The right-hand panel. The top half says, in sentences, what the machine (or
// the round) does, what is wrong with it and what else is worth knowing; the
// bottom half is an inspector for whatever is under the pointer. On a phone the
// two halves are two tabs over the same area, so each can be shown on its own.

import { COLORS, FONT, FONT_MD, FONT_SM, TEXT_RESOLUTION } from '../config.js';

const PAD = 14;
const LINE_FONT = 15;

export class Readout {
  // layout: { x, y, w, h, inspectH } stacks the two halves, framed; { x, y,
  // w, h, stacked: false } puts both on the same unframed area (the mobile
  // panel draws the frame). titles: the three section headings.
  constructor(scene, layout, onHoverLine, titles = ['What this machine does', 'Problems', 'Notes']) {
    this.scene = scene;
    this.onHoverLine = onHoverLine;
    this.titles = titles;
    const { x, y, w, h, inspectH, stacked = true } = layout;
    this.x = x;
    this.w = w;
    this.top = y;
    this.bottom = stacked ? y + h - inspectH - 12 : y + h;
    this.inspectTop = stacked ? y + h - inspectH : y;
    this.inspectBottom = y + h;
    this.summaryShown = true;
    this.inspectShown = true;

    if (stacked) {
      const g = scene.add.graphics().setDepth(0);
      g.fillStyle(COLORS.panelHex, 1);
      g.lineStyle(2, COLORS.panelEdgeHex, 1);
      g.fillRoundedRect(x, y, w, this.bottom - y, 10);
      g.strokeRoundedRect(x, y, w, this.bottom - y, 10);
      g.fillRoundedRect(x, this.inspectTop, w, inspectH, 10);
      g.strokeRoundedRect(x, this.inspectTop, w, inspectH, 10);
    }

    this.texts = [];
    this.inspectTexts = [];
    // Each half as something a tab can show or hide.
    this.summary = { setShown: (on) => this.show('summaryShown', this.texts, on) };
    this.inspector = { setShown: (on) => this.show('inspectShown', this.inspectTexts, on) };
  }

  show(flag, list, on) {
    this[flag] = on;
    for (const t of list) t.setVisible(on);
  }

  add(list, x, y, s, style = {}) {
    const t = this.scene.add
      .text(x, y, s, {
        fontFamily: FONT,
        fontSize: `${LINE_FONT}px`,
        color: COLORS.text,
        wordWrap: { width: this.w - PAD * 2 - (style.indent ?? 0) },
        lineSpacing: 2,
        resolution: TEXT_RESOLUTION,
        ...style,
      })
      .setDepth(2)
      .setVisible(list === this.texts ? this.summaryShown : this.inspectShown);
    list.push(t);
    return t;
  }

  render(desc) {
    for (const t of this.texts) t.destroy();
    this.texts = [];
    let y = this.top + PAD;
    const sections = [
      { title: this.titles[0], color: COLORS.good, lines: desc.result },
      { title: this.titles[1], color: COLORS.bad, lines: desc.problems },
      { title: this.titles[2], color: COLORS.muted, lines: desc.notes },
    ];
    let hidden = 0;
    for (const section of sections) {
      if (section.lines.length === 0) continue;
      if (y + 40 > this.bottom) {
        hidden += section.lines.length;
        continue;
      }
      this.add(this.texts, this.x + PAD, y, section.title.toUpperCase(), {
        fontSize: `${FONT_SM}px`,
        fontStyle: 'bold',
        color: section.color,
      });
      y += 24;
      for (const line of section.lines) {
        const bullet = this.add(this.texts, this.x + PAD, y, '•', { color: section.color });
        const t = this.add(this.texts, this.x + PAD + 14, y, line.text, { indent: 14 });
        if (y + t.height > this.bottom - 24) {
          bullet.destroy();
          t.destroy();
          this.texts.length -= 2;
          hidden += 1;
          continue;
        }
        t.setInteractive();
        t.on('pointerover', () => this.onHoverLine(line.ids));
        t.on('pointerout', () => this.onHoverLine([]));
        y += t.height + 8;
      }
      y += 8;
    }
    if (hidden > 0) {
      this.add(this.texts, this.x + PAD, this.bottom - 26, `+${hidden} more`, { color: COLORS.muted });
    }
  }

  // info: { title, color, subtitle, lines: [{ text, color }] }
  inspect(info) {
    for (const t of this.inspectTexts) t.destroy();
    this.inspectTexts = [];
    let y = this.inspectTop + PAD;
    this.add(this.inspectTexts, this.x + PAD, y, info.title, {
      fontSize: `${FONT_MD}px`,
      fontStyle: 'bold',
      color: info.color ?? COLORS.text,
    });
    y += 28;
    if (info.subtitle) {
      const t = this.add(this.inspectTexts, this.x + PAD, y, info.subtitle, { fontSize: `${FONT_SM}px`, color: COLORS.muted });
      y += t.height + 6;
    }
    for (const line of info.lines) {
      const t = this.add(this.inspectTexts, this.x + PAD, y, line.text, { color: line.color ?? COLORS.text });
      if (y + t.height > this.inspectBottom - 8) {
        t.destroy();
        break;
      }
      y += t.height + 5;
    }
  }
}
