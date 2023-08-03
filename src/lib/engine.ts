import * as THREE from 'three';

import InputListener from './input';

import { RENDER_DISTANCE } from '@/constants/engine';
import { CHUNK_WIDTH } from '@/constants/world';
import Player from '@/scene/player';
import Terrain from '@/scene/terrain';

// delta time tracking...
const dtTracker = { averageDT: 16 };

/**
 * @returns Sort of averaged delta time in seconds
 */
export function getAverageDT() {
  return dtTracker.averageDT;
}

/**
 * @param dt Latest delta time in seconds
 */
function updateAverageDT(dt: number) {
  dtTracker.averageDT = (dtTracker.averageDT + dt) / 2;
}

export default function createEngine({
  canvas,
  renderer,
  scene,
}: {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
}) {
  const terrain = new Terrain();
  terrain.queueChunksCircular(0, 0, RENDER_DISTANCE + 1);
  scene.add(terrain);

  const size = renderer.getSize(new THREE.Vector2());
  const camera = new THREE.PerspectiveCamera(
    67.5,
    size.x / size.y,
    0.1,
    (RENDER_DISTANCE + 1) * CHUNK_WIDTH
  );

  const input = new InputListener(canvas);
  const player = new Player(input, camera);
  player.position.set(0, 80, 0);
  scene.add(player);

  const updateTasks: {
    [key: string]: { update: (dt: number) => void; enabled?: boolean };
  } = {
    main: {
      update: (dt) => {
        const { chunksIn, chunksOut } = player.update(dt);
        terrain.update({ chunksIn, chunksOut });
      },
    },
  };

  function start() {
    // dt and elapsedTime in seconds
    let dt = 0;
    // let elapsedTime = 0
    let lastFrame = new Date().getTime();

    function animate() {
      const currentTime = new Date().getTime();
      // 'minimum frame rate' of 30fps
      dt = Math.min((currentTime - lastFrame) * 0.001, 0.033);
      updateAverageDT(dt);
      // elapsedTime += dt
      lastFrame = currentTime;

      Object.values(updateTasks).forEach(({ update, enabled = true }) => {
        if (!enabled) return;
        update(dt);
      });

      requestAnimationFrame(animate);

      renderer.render(scene, camera);
    }

    animate();
  }

  function withUpdateTask(
    key: string,
    then: (task: (typeof updateTasks)[keyof typeof updateTasks]) => void
  ) {
    if (key === 'main') {
      console.error('Attempted to get update task with key "main"!');
      return;
    }
    if (!updateTasks[key]) {
      console.error(`Update task with key ${key} not found`);
      return undefined;
    }
    then(updateTasks[key]);
  }

  function addUpdateTask(
    key: string,
    update: (dt: number) => void,
    { enabled = true }: { enabled?: boolean } = {}
  ) {
    if (key === 'main') {
      console.error('Attempted to add update task with key "main"!');
      return;
    }
    updateTasks[key] = { update, enabled };
  }

  function setUpdateTaskEnabled(key: string, enabled: boolean) {
    withUpdateTask(key, (task) => {
      task.enabled = enabled;
    });
  }

  function toggleUpdateTaskEnabled(key: string) {
    let enabled: boolean;
    withUpdateTask(key, (task) => {
      task.enabled = !task.enabled;
      enabled = task.enabled;
    });
    return enabled!;
  }

  return {
    start,
    tasks: {
      addUpdateTask,
      setUpdateTaskEnabled,
      toggleUpdateTaskEnabled,
    },
    references: {
      scene,
      terrain,
      player,
      input,
    },
  };
}

export type Engine = ReturnType<typeof createEngine>;
