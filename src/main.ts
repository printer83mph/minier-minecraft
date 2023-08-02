import './style/globals.css';

import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

import { RENDER_DISTANCE, updateAverageDT } from './constants/engine';
import { CHUNK_WIDTH } from './constants/world';
import InputListener from './lib/input';
import Chunk from './scene/chunk';
import Player from './scene/player';
import Terrain from './scene/terrain';

let renderer: THREE.WebGLRenderer;

let terrain: Terrain;
let player: Player;
let camera: THREE.PerspectiveCamera;
let scene: THREE.Scene;

const rgbeLoader = new RGBELoader();
const textureLoader = new THREE.TextureLoader();

async function setup() {
  // --------- --------- --------- CANVAS/RENDERER --------- --------- ---------
  const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
  const WIDTH = 800;
  const HEIGHT = 600;

  renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(WIDTH, HEIGHT);
  renderer.setPixelRatio(window.devicePixelRatio);

  // --------- --------- --------- OTHER CLASSES --------- --------- ---------

  await Chunk.setup({ textureLoader });
  console.log('chunk setup');

  // --------- --------- --------- TEXTURES --------- --------- ---------

  // const environmentMap = new THREE.CubeTextureLoader().loadAsync([
  //   '/cubemap/px.png',
  //   '/cubemap/nx.png',
  //   '/cubemap/py.png',
  //   '/cubemap/ny.png',
  //   '/cubemap/pz.png',
  //   '/cubemap/nz.png',
  // ]);

  const envMapTexture = await rgbeLoader.loadAsync('/sky_eqr.hdr');
  envMapTexture.mapping = THREE.EquirectangularReflectionMapping;
  // const envMap = pmremGenerator.fromEquirectangular(envMapTexture);

  scene = new THREE.Scene();
  scene.background = envMapTexture;
  scene.environment = envMapTexture;

  camera = new THREE.PerspectiveCamera(
    67.5,
    WIDTH / HEIGHT,
    0.3,
    (RENDER_DISTANCE + 1) * CHUNK_WIDTH
  );

  const skyColor = 0x8ea9ad;
  // renderer.setClearColor(skyColor);
  scene.fog = new THREE.FogExp2(skyColor, 0.01);

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.75;

  terrain = new Terrain();
  terrain.queueChunksCircular(0, 0, RENDER_DISTANCE + 1);
  scene.add(terrain);

  const input = new InputListener(canvas);
  player = new Player(input, camera);
  player.position.set(0, 80, 0);

  scene.add(player);
}

function start() {
  // dt and elapsedTime in seconds
  let dt = 0;
  // let elapsedTime = 0
  let lastFrame: number = new Date().getTime();

  function animate() {
    const currentTime = new Date().getTime();
    // 'minimum frame rate' of 30fps
    dt = Math.min((currentTime - lastFrame) * 0.001, 0.033);
    updateAverageDT(dt);
    // elapsedTime += dt
    lastFrame = currentTime;

    const { chunksIn, chunksOut } = player.update(dt);

    terrain.update({ chunksIn, chunksOut });

    requestAnimationFrame(animate);

    renderer.render(scene, camera);
  }

  animate();
}

setup()
  .then(() => start())
  .catch((err) => {
    console.error(err);
  });
