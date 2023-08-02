export default class InputListener {
  element: HTMLElement;

  onKeyDownListeners: Map<string, Event> = new Map();
  onKeyUpListeners: Map<string, Event> = new Map();
  onKeyPressListeners: Map<string, Event> = new Map();

  onMouseDownListeners: Map<number, Event> = new Map();
  onMouseUpListeners: Map<number, Event> = new Map();
  onMouseClickListeners: Map<number, Event> = new Map();

  keysDown = new Set<string>();
  lockedIn = false;

  constructor(element: HTMLElement) {
    this.element = element;

    const onClick = async (evt: MouseEvent) => {
      if (this.lockedIn) {
        const syntheticEvent = this.onMouseClickListeners.get(evt.button);
        if (syntheticEvent) {
          this.element.dispatchEvent(syntheticEvent);
        }
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
      const syntheticEvent = this.onMouseDownListeners.get(evt.button);
      if (syntheticEvent) {
        this.element.dispatchEvent(syntheticEvent);
      }
    });
    element.addEventListener('mouseup', (evt) => {
      if (!this.lockedIn) {
        return;
      }
      const syntheticEvent = this.onMouseUpListeners.get(evt.button);
      if (syntheticEvent) {
        this.element.dispatchEvent(syntheticEvent);
      }
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
          const syntheticEvent = this.onKeyUpListeners.get(key);
          if (syntheticEvent) {
            document.dispatchEvent(syntheticEvent);
          }
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
      const syntheticEvent = this.onKeyDownListeners.get(event.key);
      if (syntheticEvent) {
        document.dispatchEvent(syntheticEvent);
      }
    });

    document.addEventListener('keyup', (event) => {
      this.keysDown.delete(event.key.toUpperCase());

      if (!this.lockedIn) {
        return;
      }

      // trigger onKeyUp event
      const syntheticEvent = this.onKeyUpListeners.get(event.key);
      if (syntheticEvent) {
        document.dispatchEvent(syntheticEvent);
      }
    });

    document.addEventListener('keypress', (event) => {
      if (!this.lockedIn) {
        return;
      }

      // trigger onKeyPress event
      const syntheticEvent = this.onKeyPressListeners.get(event.key);
      if (syntheticEvent) {
        document.dispatchEvent(syntheticEvent);
      }
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
    let syntheticEvent = listenerMap.get(button);
    if (!syntheticEvent) {
      syntheticEvent = new Event(`custom-${type}`);
      listenerMap.set(button, syntheticEvent);
    }
    this.element.addEventListener(`custom-${type}`, callback);
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

    let syntheticEvent = listenerMap.get(key);
    if (!syntheticEvent) {
      syntheticEvent = new Event(`custom-${type}`);
      listenerMap.set(key, syntheticEvent);
    }
    document.addEventListener(`custom-${type}`, callback);
  }
}
