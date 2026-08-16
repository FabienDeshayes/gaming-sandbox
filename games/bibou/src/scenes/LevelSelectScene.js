import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../config.js';
import { LEVELS } from '../data/levels.js';
import { createButton } from '../ui/button.js';

// Layout for the scrollable level list. Every level gets the same fixed-height
// row (its button plus a one-line description) — the list scrolls instead of
// shrinking to fit, so it reads the same whether there are 3 levels or 30.
const LIST_TOP = 270; // top of the scrollable viewport
const LIST_BOTTOM = 700; // bottom of the viewport — Back sits fixed below this
const ROW_HEIGHT = 92;
const BACK_Y = 780;

export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('LevelSelectScene');
  }

  create(data) {
    const unlimited = data.unlimited === true;
    const centerX = this.cameras.main.width / 2;

    this.add
      .text(centerX, 200, unlimited ? 'Test — Select Level' : 'Select Level', {
        fontFamily: 'sans-serif',
        fontSize: unlimited ? '38px' : '44px',
        color: unlimited ? COLORS.highlight : COLORS.text,
      })
      .setOrigin(0.5);

    // Rows stay direct children of the scene rather than nested in a
    // Container — TESTING.md's browser harness finds buttons by scanning the
    // scene's own children list (see ui/actionCard.js's own note on this), so
    // an interactive text has to stay there to remain tappable in tests.
    // "Scrolling" is therefore just moving each row's y directly, clipped by
    // a mask shared across every row instead of one Container's mask.
    const rows = LEVELS.map((level, i) => {
      const top = LIST_TOP + i * ROW_HEIGHT;
      const buttonY = top + 38;
      const descY = top + 72;
      const button = createButton(this, centerX, buttonY, `Level ${level.id}`, () =>
        this.scene.start('PuzzleScene', { level, unlimited })
      );
      const description = this.add
        .text(centerX, descY, level.description ?? '', {
          fontFamily: 'sans-serif',
          fontSize: '15px',
          color: COLORS.hint,
          align: 'center',
          wordWrap: { width: GAME_WIDTH - 80 },
        })
        .setOrigin(0.5);
      return { button, buttonY, description, descY };
    });

    const viewportHeight = LIST_BOTTOM - LIST_TOP;
    const contentHeight = LEVELS.length * ROW_HEIGHT;
    const maxScroll = Math.max(0, contentHeight - viewportHeight);

    const maskShape = this.make.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(0, LIST_TOP, GAME_WIDTH, viewportHeight);
    const mask = maskShape.createGeometryMask();
    rows.forEach(({ button, description }) => {
      button.setMask(mask);
      description.setMask(mask);
    });
    this.events.once('shutdown', () => {
      mask.destroy();
      maskShape.destroy();
    });

    let scroll = 0;
    const applyScroll = () => {
      rows.forEach(({ button, buttonY, description, descY }) => {
        button.setY(buttonY + scroll);
        description.setY(descY + scroll);
      });
    };

    // Scrolls so the given level's row is centered in the viewport. Exposed
    // on the scene (rather than kept as a closure) so it doubles as the test
    // harness's seam for reaching a level below the fold — see
    // tests/harness.js's scrollToLevel — without simulating a pixel-perfect
    // drag gesture.
    this.scrollToLevel = (id) => {
      const i = LEVELS.findIndex((l) => l.id === id);
      if (i === -1) return;
      const buttonY = LIST_TOP + i * ROW_HEIGHT + 38;
      scroll = Phaser.Math.Clamp((LIST_TOP + LIST_BOTTOM) / 2 - buttonY, -maxScroll, 0);
      applyScroll();
    };

    if (maxScroll > 0) {
      // Drag-to-scroll, scoped to the viewport so it doesn't eat drags meant
      // for the title or the Back button. A button's own click (button.js)
      // only fires if the pointer barely moved, so a drag that starts on top
      // of a row scrolls the list instead of also launching that level.
      let dragging = false;
      let dragStartY = 0;
      let scrollStart = 0;
      this.input.on('pointerdown', (pointer) => {
        if (pointer.y < LIST_TOP || pointer.y > LIST_BOTTOM) return;
        dragging = true;
        dragStartY = pointer.y;
        scrollStart = scroll;
      });
      this.input.on('pointermove', (pointer) => {
        if (!dragging || !pointer.isDown) return;
        scroll = Phaser.Math.Clamp(scrollStart + (pointer.y - dragStartY), -maxScroll, 0);
        applyScroll();
      });
      this.input.on('pointerup', () => {
        dragging = false;
      });

      // Mouse wheel / trackpad, for desktop.
      this.input.on('wheel', (pointer, over, dx, dy) => {
        scroll = Phaser.Math.Clamp(scroll - dy, -maxScroll, 0);
        applyScroll();
      });
    }

    createButton(this, centerX, BACK_Y, 'Back', () => this.scene.start('TitleScene'));
  }
}
