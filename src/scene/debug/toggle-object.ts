import * as THREE from 'three';

import Engine from '@/lib/engine';

export default class ToggleObject extends THREE.Object3D {
  private enabled = true;

  public constructor(
    engine: Engine,
    key: string,
    { enabled = true }: { enabled?: boolean } = {}
  ) {
    super();
    this.enabled = enabled;

    const setEnabled = (enabled: boolean) => {
      this.enabled = enabled;
      if (enabled) {
        engine.scene.add(this);
      } else {
        engine.scene.remove(this);
      }
    };

    engine.input.addKeyListener(key, 'onKeyDown', () => {
      setEnabled(!this.enabled);
    });

    setEnabled(enabled);
  }
}
