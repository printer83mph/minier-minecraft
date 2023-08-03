export default class InputListener {
  element: HTMLElement;

  onKeyDownListeners: Map<string, Array<() => void>> = new Map();
  onKeyUpListeners: Map<string, Array<() => void>> = new Map();
  onKeyPressListeners: Map<string, Array<() => void>> = new Map();

  onMouseDownListeners: Map<number, Array<() => void>> = new Map();
  onMouseUpListeners: Map<number, Array<() => void>> = new Map();
  onMouseClickListeners: Map<number, Array<() => void>> = new Map();

  keysDown = new Set<string>();
  lockedIn = false;

  constructor(element: HTMLElement) {
    this.element = element;

    const onClick = async (evt: MouseEvent) => {
      if (this.lockedIn) {
        this.onMouseClickListeners
          .get(evt.button)
          ?.forEach((callback) => callback());
        return;
      }
      try {
        await (element.requestPointerLock as unknown as () => Promise<void>)();
      } catch (_) {
        /* empty */
      }
    };

    element.addEventListener('click', (evt) => {
      void onClick(evt);
    });

    element.addEventListener('mousedown', (evt) => {
      if (!this.lockedIn) {
        return;
      }
      this.onMouseDownListeners
        .get(evt.button)
        ?.forEach((callback) => callback());
    });
    element.addEventListener('mouseup', (evt) => {
      if (!this.lockedIn) {
        return;
      }
      this.onMouseUpListeners
        .get(evt.button)
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
      this.keysDown.add(event.key.toUpperCase());

      // trigger onKeyDown event
      this.onKeyDownListeners.get(event.key)?.forEach((callback) => callback());
    });

    document.addEventListener('keyup', (event) => {
      this.keysDown.delete(event.key.toUpperCase());

      if (!this.lockedIn) {
        return;
      }

      // trigger onKeyUp event
      this.onKeyUpListeners.get(event.key)?.forEach((callback) => callback());
    });

    document.addEventListener('keypress', (event) => {
      if (!this.lockedIn) {
        return;
      }

      // trigger onKeyPress event
      this.onKeyPressListeners
        .get(event.key)
        ?.forEach((callback) => callback());
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
    type: 'onKeyDown' | 'onKeyUp' | 'onKeyPress',
    callback: () => void,
    { caseSensitive }: { caseSensitive?: boolean } = {}
  ) {
    if (!caseSensitive) {
      this.addKeyListener(key.toUpperCase(), type, callback, {
        caseSensitive: true,
      });
      this.addKeyListener(key.toLowerCase(), type, callback, {
        caseSensitive: true,
      });
      return;
    }

    const listenerMap = this[`${type}Listeners`];
    let callbacks = listenerMap.get(key);
    if (!callbacks) {
      callbacks = [];
      listenerMap.set(key, callbacks);
    }
    callbacks.push(callback);
  }
}
