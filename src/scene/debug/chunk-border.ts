import * as THREE from 'three';

import { CHUNK_HEIGHT, CHUNK_WIDTH } from '@/constants/world';
import { Engine } from '@/lib/engine';

const boundsGeo = new THREE.BoxGeometry(
  CHUNK_WIDTH,
  CHUNK_HEIGHT,
  CHUNK_WIDTH,
  CHUNK_WIDTH / 2,
  CHUNK_HEIGHT / 2,
  CHUNK_WIDTH / 2
);
const bounds = new THREE.Mesh(
  boundsGeo,
  new THREE.MeshBasicMaterial({
    wireframe: true,
    color: 0xff0000,
    opacity: 0.5,
    transparent: true,
  })
);

const updateTaskKey = 'chunkBorder';

export default function createChunkBorder({
  engine: {
    tasks,
    references: { input, player, scene },
  },
}: {
  engine: Engine;
}) {
  input.addKeyListener('k', 'onKeyPress', () => {
    const enabled = tasks.toggleUpdateTaskEnabled(updateTaskKey);
    if (enabled) {
      scene.add(bounds);
    } else {
      scene.remove(bounds);
    }
  });

  function update() {
    const [x, z] = player.getChunkCoords();
    bounds.position.set(
      x + CHUNK_WIDTH / 2,
      CHUNK_HEIGHT / 2,
      z + CHUNK_WIDTH / 2
    );
  }

  tasks.addUpdateTask(updateTaskKey, update, { enabled: false });
}
