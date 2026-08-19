const GAME_WIDTH = 480;
const GAME_HEIGHT = 854;

class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    const centerX = this.cameras.main.width / 2;

    this.add
      .text(centerX, 220, 'Pitchou', {
        fontFamily: 'sans-serif',
        fontSize: '64px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.createButton(centerX, 460, 'Load');
    this.createButton(centerX, 540, 'Settings');
  }

  createButton(x, y, label) {
    const text = this.add
      .text(x, y, label, {
        fontFamily: 'sans-serif',
        fontSize: '32px',
        color: '#ffffff',
        backgroundColor: '#333333',
        padding: { x: 24, y: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    text.on('pointerover', () => text.setStyle({ backgroundColor: '#555555' }));
    text.on('pointerout', () => text.setStyle({ backgroundColor: '#333333' }));
    text.on('pointerdown', () => {});
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game',
  backgroundColor: '#111111',
  scene: [TitleScene],
});
