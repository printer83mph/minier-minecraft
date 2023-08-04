import * as THREE from 'three';

import InputListener from './input';

import { RENDER_DISTANCE } from '@/constants/engine';
import { CHUNK_WIDTH } from '@/constants/world';
import Player from '@/scene/player';
import Terrain from '@/scene/terrain';
import {
  SCENE_FOG,
  TONEMAPPING,
  TONEMAPPING_EXPOSURE,
} from '@/constants/rendering';

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

export default class Engine {
  private updateList: Array<(dt: number, engine: Engine) => void> = [];

  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;

  terrain: Terrain;
  input: InputListener;
  player: Player;

  constructor({
    canvas,
    renderer,
  }: {
    canvas: HTMLCanvasElement;
    renderer: THREE.WebGLRenderer;
  }) {
    this.renderer = renderer;

    renderer.toneMapping = TONEMAPPING;
    renderer.toneMappingExposure = TONEMAPPING_EXPOSURE;

    this.scene = new THREE.Scene();
    this.scene.fog = SCENE_FOG;

    this.terrain = new Terrain();
    this.terrain.queueChunksCircular(0, 0, RENDER_DISTANCE + 1);
    this.scene.add(this.terrain);

    const size = renderer.getSize(new THREE.Vector2());
    this.camera = new THREE.PerspectiveCamera(
      67.5,
      size.x / size.y,
      0.1,
      (RENDER_DISTANCE + 1) * CHUNK_WIDTH
    );

    this.input = new InputListener(canvas);
    this.player = new Player(this.input, this.camera);
    this.player.position.set(0, 80, 0);
    this.scene.add(this.player);
  }

  start() {
    // dt and elapsedTime in seconds
    let dt = 0;
    // let elapsedTime = 0
    let lastFrame = new Date().getTime();

    const animate = () => {
      const currentTime = new Date().getTime();
      // 'minimum frame rate' of 30fps
      dt = Math.min((currentTime - lastFrame) * 0.001, 0.033);
      updateAverageDT(dt);
      // elapsedTime += dt
      lastFrame = currentTime;

      const { chunksIn, chunksOut } = this.player.update(dt);
      this.terrain.update({ chunksIn, chunksOut });

      // run features
      this.updateList.forEach((update) => {
        update(dt, this);
      });

      requestAnimationFrame(animate);

      this.renderer.render(this.scene, this.camera);
    };

    animate();
  }

  addUpdateFunction(update: (dt: number, engine: Engine) => void) {
    this.updateList.push(update);
  }
}
