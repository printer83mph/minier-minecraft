import './style/globals.css';

import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

import createEngine from './lib/engine';
import Chunk from './scene/chunk';
import createChunkBorder from './scene/debug/chunk-border';

const rgbeLoader = new RGBELoader();
const textureLoader = new THREE.TextureLoader();

async function setup() {
  // --------- --------- --------- OTHER CLASSES --------- --------- ---------

  await Chunk.setup({ textureLoader });

  // --------- --------- --------- CANVAS/RENDERER --------- --------- ---------
  const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
  const WIDTH = 800;
  const HEIGHT = 600;

  const renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(WIDTH, HEIGHT);
  renderer.setPixelRatio(window.devicePixelRatio);

  // --------- --------- --------- TEXTURES --------- --------- ---------

  const envMapTexture = await rgbeLoader.loadAsync('/sky_eqr.hdr');
  envMapTexture.mapping = THREE.EquirectangularReflectionMapping;

  const scene = new THREE.Scene();
  scene.background = envMapTexture;
  scene.environment = envMapTexture;

  const skyColor = 0x8ea9ad;
  // renderer.setClearColor(skyColor);
  scene.fog = new THREE.FogExp2(skyColor, 0.01);

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.7;

  const engine = createEngine({ canvas, renderer, scene });
  createChunkBorder({ engine });

  return engine.start;
}

setup()
  .then((start) => start())
  .catch((err) => {
    console.error(err);
  });
