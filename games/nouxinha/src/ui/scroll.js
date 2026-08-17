// A drag-scrollable, mask-clipped list region, shared by the item card's
// instance list and the inventory panel — both can hold more rows than fit in
// a fixed-height overlay.
//
// `content` is a container whose children are already laid out top-down from
// its own local (0, 0); `contentHeight` is their total height. This wires
// pointer-drag and wheel scrolling and clips the container to the rectangle
// (x, y, width, height).
//
// Rows aren't separately interactive — with Phaser's default `topOnly` input,
// a per-row hit zone layered under this one would fight it for the same
// pointer events. Instead a single zone spans the whole list, and a tap
// (movement under a few pixels between down and up) reports the row it landed
// on via `onTap(localY)`, where `localY` is the pointer's position in the
// content's own coordinate space — the caller divides by its row height to
// find the index.
//
// Returns a handle whose `destroy()` must be called when the owning overlay
// closes: it adds scene-level input listeners that would otherwise outlive it.
const TAP_MAX_MOVE = 8;

export function makeScrollable(scene, content, { x, y, width, height, contentHeight, onTap }) {
  content.setPosition(x, y);

  const maxScroll = Math.max(0, contentHeight - height);
  let scrollY = 0;
  const clamp = (v) => Math.max(-maxScroll, Math.min(0, v));
  const applyScroll = (v) => {
    scrollY = clamp(v);
    content.y = y + scrollY;
  };

  let ownMask = null;
  if (maxScroll > 0) {
    ownMask = scene.make.graphics({ x, y }, false);
    ownMask.fillRect(0, 0, width, height);
    content.setMask(new Phaser.Display.Masks.GeometryMask(scene, ownMask));
  }

  const zone = scene.add.zone(x, y, width, height).setOrigin(0).setInteractive();

  let tracking = false;
  let startPointerY = 0;
  let startScrollY = 0;
  let moved = 0;

  const onDown = (p) => {
    tracking = true;
    startPointerY = p.y;
    startScrollY = scrollY;
    moved = 0;
  };
  const onMove = (p) => {
    if (!tracking) return;
    const dy = p.y - startPointerY;
    moved = Math.max(moved, Math.abs(dy));
    applyScroll(startScrollY + dy);
  };
  const onUp = (p) => {
    if (!tracking) return;
    tracking = false;
    if (moved < TAP_MAX_MOVE && onTap) onTap(p.y - y - scrollY);
  };

  zone.on('pointerdown', onDown);
  scene.input.on('pointermove', onMove);
  scene.input.on('pointerup', onUp);
  scene.input.on('pointerupoutside', onUp);
  const onWheel = (_p, _over, _dx, dy) => applyScroll(scrollY - dy);
  scene.input.on('wheel', onWheel);

  return {
    zone,
    content,
    destroy: () => {
      scene.input.off('pointermove', onMove);
      scene.input.off('pointerup', onUp);
      scene.input.off('pointerupoutside', onUp);
      scene.input.off('wheel', onWheel);
      if (ownMask) ownMask.destroy();
    },
  };
}
