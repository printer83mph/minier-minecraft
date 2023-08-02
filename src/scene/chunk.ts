import * as THREE from 'three';

import { CHUNK_HEIGHT, CHUNK_WIDTH } from '@/constants/world';
import { Block } from '@/lib/blocks';
import blocksGenerator from '@/lib/chunk/blocks-generator';
import meshGenerator from '@/lib/chunk/mesh-generator';
import { Direction, DIRECTIONS, getOppositeDirection } from '@/lib/space';

let texture: THREE.Texture;
let material: THREE.Material;

export default class Chunk extends THREE.Mesh {
  static async setup({
    textureLoader,
  }: {
    textureLoader: THREE.TextureLoader;
  }) {
    texture = await textureLoader.loadAsync('block_atlas.png');
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestMipmapLinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;

    material = new THREE.MeshPhysicalMaterial({
      map: texture,
      transparent: true,
      roughness: 0.8,
    });
  }

  absoluteX: number;
  absoluteZ: number;

  neighbors = new Map<Direction, Chunk>();

  blocks = new Array<Block>(CHUNK_WIDTH * CHUNK_WIDTH * CHUNK_HEIGHT);

  generationState:
    | { state: '0-waiting'; generator?: undefined }
    | { state: '1-blocksQueued'; generator: ReturnType<typeof blocksGenerator> }
    | { state: '2-meshWaiting'; generator?: undefined }
    | { state: '3-meshQueued'; generator: ReturnType<typeof meshGenerator> }
    | { state: '4-done'; generator?: undefined } = { state: '0-waiting' };

  constructor(absoluteX: number, absoluteZ: number) {
    super(undefined, material);

    this.absoluteX = absoluteX;
    this.absoluteZ = absoluteZ;

    this.position.set(absoluteX, 0, absoluteZ);

    this.castShadow = true;
    this.receiveShadow = true;
  }

  // --------- --------- --------- NEIGHBORS --------- --------- ---------

  linkChunk(chunk: Chunk, direction: Direction) {
    this.neighbors.set(direction, chunk);
    chunk.neighbors.set(getOppositeDirection(direction), this);
  }

  hasAllNeighbors() {
    return (
      this.neighbors.has(DIRECTIONS.west) &&
      this.neighbors.has(DIRECTIONS.south) &&
      this.neighbors.has(DIRECTIONS.east) &&
      this.neighbors.has(DIRECTIONS.north)
    );
  }

  allNeighborsHaveBlocks() {
    if (!this.hasAllNeighbors()) {
      return false;
    }
    for (const neighbor of this.neighbors.values()) {
      if (
        neighbor.generationState.state === '0-waiting' ||
        neighbor.generationState.state === '1-blocksQueued'
      ) {
        return false;
      }
    }
    return true;
  }

  // --------- --------- --------- UTILITY --------- --------- ---------

  /**
   * Using local coordinate system, only integers
   */
  setBlockAt(x: number, y: number, z: number, block: Block) {
    this.blocks[x + y * CHUNK_WIDTH + z * CHUNK_WIDTH * CHUNK_HEIGHT] = block;
  }

  /**
   * Using local coordinate system, only integers
   */
  getBlockAt(x: number, y: number, z: number): Block {
    return this.blocks[x + y * CHUNK_WIDTH + z * CHUNK_WIDTH * CHUNK_HEIGHT];
  }

  // --------- --------- --------- GENERATION --------- --------- ---------

  doGenerationStep() {
    const startTime = new Date().getTime();
    const result = this.generationState.generator?.next(startTime);

    return { state: this.generationState.state, done: result?.done };
  }

  enqueueBlocks() {
    this.generationState = {
      state: '1-blocksQueued',
      generator: blocksGenerator(this),
    };
    this.generationState.generator.next();
  }

  enqueueMesh() {
    this.generationState = {
      state: '3-meshQueued',
      generator: meshGenerator(this),
    };
    this.generationState.generator.next();
  }

  forceMeshRegeneration() {
    const generator = meshGenerator(this);
    generator.next();
    let done = false;
    while (!done) {
      done = generator.next(Date.now()).done ?? false;
    }
    this.generationState = { state: '4-done' };
  }

  // --------- --------- --------- DELOAD/RELOAD --------- --------- ---------

  deload() {
    if (this.generationState.state === '1-blocksQueued') {
      this.blocks = new Array<Block>(CHUNK_WIDTH * CHUNK_WIDTH * CHUNK_HEIGHT);
      this.generationState = { state: '0-waiting' };
      return;
    }
    if (this.generationState.state === '2-meshWaiting') {
      return;
    }
    if (this.generationState.state === '3-meshQueued') {
      this.geometry.dispose();
      this.generationState = { state: '2-meshWaiting' };
      return;
    }
    // if (this.generationState.state === '4-done')
    this.geometry.dispose();
    this.generationState = { state: '2-meshWaiting' };
  }

  enqueueReload() {
    this.enqueueMesh();
  }
}
