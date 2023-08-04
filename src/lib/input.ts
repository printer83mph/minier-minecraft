export default class InputListener {
  private element: HTMLElement;

  private onKeyDownListeners: Map<string, Array<() => void>> = new Map();
  private onKeyUpListeners: Map<string, Array<() => void>> = new Map();

  private onMouseDownListeners: Map<number, Array<() => void>> = new Map();
  private onMouseUpListeners: Map<number, Array<() => void>> = new Map();
  private onMouseClickListeners: Map<number, Array<() => void>> = new Map();

  private keysDown = new Set<string>();
  private lockedIn = false;

  private async tryPointerLock() {
    try {
      await (
        this.element.requestPointerLock as unknown as () => Promise<void>
      )();
    } catch (_) {
      /* empty */
    }
  }

  constructor(element: HTMLElement, ...otherElements: HTMLElement[]) {
    this.element = element;

    element.addEventListener('click', (event: MouseEvent) => {
      if (this.lockedIn) {
        event.preventDefault();
        this.onMouseClickListeners
          .get(event.button)
          ?.forEach((callback) => callback());
        return;
      }
      if (event.button === 0) {
        event.preventDefault();
        void this.tryPointerLock();
      }
    });
    otherElements.forEach((element) => {
      element.addEventListener('click', (event) => {
        if (this.lockedIn) {
          event.preventDefault();
          return;
        }

        if (event.button === 0) {
          event.preventDefault();
          void this.tryPointerLock();
        }
      });
    });
    element.addEventListener('mousedown', (event) => {
      if (!this.lockedIn) {
        return;
      }
      event.preventDefault();
      this.onMouseDownListeners
        .get(event.button)
        ?.forEach((callback) => callback());
    });
    element.addEventListener('mouseup', (event) => {
      if (!this.lockedIn) {
        return;
      }
      event.preventDefault();
      this.onMouseUpListeners
        .get(event.button)
        ?.forEach((callback) => callback());
    });

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === element) {
        this.lockedIn = true;
      } else {
        const keysDownCopy = new Set(this.keysDown);

        this.keysDown.clear();
        this.lockedIn = false;

        // trigger keyUp for all keys that were down
        keysDownCopy.forEach((key) => {
          this.onKeyUpListeners.get(key)?.forEach((callback) => callback());
        });
      }
    });

    document.addEventListener('keydown', (event) => {
      // escape to release pointer
      if (event.key === 'Escape') {
        element.releasePointerCapture(0);
        return;
      }

      if (!this.lockedIn) {
        return;
      }
      event.preventDefault();

      const normalizedKey = event.key.toUpperCase();

      // trigger onKeyDown event
      if (!this.isKeyDown(normalizedKey)) {
        this.onKeyDownListeners
          .get(normalizedKey)
          ?.forEach((callback) => callback());
      }

      // add to keys down
      this.keysDown.add(normalizedKey);
    });

    document.addEventListener('keyup', (event) => {
      if (!this.lockedIn) {
        return;
      }
      event.preventDefault();

      const normalizedKey = event.key.toUpperCase();

      // trigger onKeyUp event
      if (this.isKeyDown(normalizedKey)) {
        this.onKeyUpListeners
          .get(normalizedKey)
          ?.forEach((callback) => callback());
      }

      // remove from keys down (even if not locked in)
      this.keysDown.delete(normalizedKey);
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

  addMouseButtonListener(
    button: number,
    type: 'onMouseDown' | 'onMouseUp' | 'onMouseClick',
    callback: () => void
  ) {
    const listenerMap = this[`${type}Listeners`];
    let callbacks = listenerMap.get(button);
    if (!callbacks) {
      callbacks = [];
      listenerMap.set(button, callbacks);
    }

    callbacks.push(callback);
  }

  addKeyListener(
    key: string,
    type: 'onKeyDown' | 'onKeyUp',
    callback: () => void
  ) {
    const normalizedKey = key.toUpperCase();

    const listenerMap = this[`${type}Listeners`];
    let callbacks = listenerMap.get(normalizedKey);
    if (!callbacks) {
      callbacks = [];
      listenerMap.set(normalizedKey, callbacks);
    }
    callbacks.push(callback);
  }
}
