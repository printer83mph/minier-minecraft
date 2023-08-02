export default class InputListener {
  element: HTMLElement;

  keysDown = new Set<string>();

  lockedIn = false;

  constructor(element: HTMLElement) {
    this.element = element;

    element.addEventListener('click', () => {
      element.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === element) {
        this.lockedIn = true;
      } else {
        this.keysDown.clear();
        this.lockedIn = false;
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        element.releasePointerCapture(0);
        return;
      }
      if (!this.lockedIn) {
        return;
      }
      this.keysDown.add(event.key.toUpperCase());
    });
    document.addEventListener('keyup', (event) => {
      this.keysDown.delete(event.key.toUpperCase());
    });
  }

  isKeyDown(key: string) {
    return this.keysDown.has(key);
  }

  addMouseMoveListener(listener: (dx: number, dy: number) => void) {
    this.element.addEventListener('mousemove', (event) => {
      if (!this.lockedIn) {
        return;
      }
      listener(event.movementX, event.movementY);
    });
  }

  addKeyListener(
    key: string,
    {
      onKeyDown,
      onKeyPress,
    }: {
      onKeyDown?: () => void;
      onKeyPress?: () => void;
    }
  ) {
    if (onKeyDown)
      document.addEventListener('keydown', (event) => {
        if (!this.lockedIn) {
          return;
        }
        if (event.key === key) {
          onKeyDown();
        }
      });

    if (onKeyPress)
      document.addEventListener('keypress', (event) => {
        if (!this.lockedIn) {
          return;
        }
        if (event.key === key) {
          onKeyPress();
        }
      });
  }
}
