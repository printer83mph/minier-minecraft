import * as THREE from 'three';

import { CHUNK_HEIGHT, CHUNK_WIDTH } from '@/constants/world';
import Engine from '@/lib/engine';

const boundsGeo = new THREE.BoxGeometry(
  CHUNK_WIDTH,
  CHUNK_HEIGHT,
  CHUNK_WIDTH,
  CHUNK_WIDTH / 2,
  CHUNK_HEIGHT / 2,
  CHUNK_WIDTH / 2
);

export default class ChunkBorder extends THREE.Mesh {
  private engine: Engine;

  public constructor(engine: Engine) {
    super(
      boundsGeo,
      new THREE.MeshBasicMaterial({
        wireframe: true,
        color: 0xff0000,
        opacity: 0.5,
        transparent: true,
      })
    );

    this.engine = engine;
  }

  public onBeforeRender = () => {
    const [x, z] = this.engine.player.getChunkCoords();
    this.position.set(
      x + CHUNK_WIDTH / 2,
      CHUNK_HEIGHT / 2,
      z + CHUNK_WIDTH / 2
    );
  };
}
