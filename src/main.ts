import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

import Engine from './lib/engine';
import Chunk from './scene/chunk';
import ChunkBorder from './scene/debug/chunk-border';
import ToggleObject from './scene/debug/toggle-object';

import './style/globals.css';

const rgbeLoader = new RGBELoader();
const textureLoader = new THREE.TextureLoader();

let engine: Engine;

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

  // TODO: maybe organize textures or something
  const envMapTexture = await rgbeLoader.loadAsync('/sky_eqr.hdr');
  envMapTexture.mapping = THREE.EquirectangularReflectionMapping;

  engine = new Engine({ canvas, renderer });
  engine.scene.background = envMapTexture;
  engine.scene.environment = envMapTexture;

  // chunk border debug
  const chunkBorderToggle = new ToggleObject(engine, 'k', { enabled: false });
  const chunkBorder = new ChunkBorder(engine);
  chunkBorderToggle.add(chunkBorder);
}

void setup().then(() => engine.start());
