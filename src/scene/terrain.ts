import * as THREE from 'three';

import Chunk from './chunk';
import Player from './player';

import { CHUNK_HEIGHT, CHUNK_WIDTH } from '@/constants/world';
import { Block, isSolid } from '@/lib/blocks';
import raycast from '@/lib/raycast';
import { DIRECTIONS } from '@/lib/space';

function getChunkKey(xExact: number, zExact: number) {
  return `${xExact.toFixed(0)},${zExact.toFixed(0)}`;
}

export default class Terrain extends THREE.Object3D {
  private chunks = new Map<string, Chunk>();

  private chunkBlockQueue: Chunk[] = [];
  private chunkMeshQueue: Chunk[] = [];

  public constructor() {
    super();
  }

  public update({
    chunksIn,
    chunksOut,
  }: {
    chunksIn: [number, number][];
    chunksOut: [number, number][];
  }) {
    this.updateChunkQueue(chunksIn, chunksOut);

    if (this.chunkBlockQueue.length > 0) {
      this.doQueuedBlocksGenerationStep();
    }

    if (this.chunkMeshQueue.length > 0) {
      this.doQueuedMeshGenerationStep();
    }
  }

  public updateChunkQueue(
    chunksIn: [number, number][],
    chunksOut: [number, number][]
  ) {
    chunksIn.forEach(([x, z]) => {
      const chunk = this.chunks.get(getChunkKey(x, z));
      if (!chunk) {
        this.queueChunkBlocks(x, z);
        return;
      }

      if (chunk.generationState.state === '0-waiting') {
        this.chunkBlockQueue.push(chunk);
        chunk.enqueueBlocks();
        return;
      }

      if (chunk.generationState.state === '2-meshWaiting') {
        // only queue if we have all neighbors' blocks, also check neighbors for queueing
        this.tryQueueChunkMeshWithNeighbors(chunk);
      }
    });

    chunksOut.forEach(([x, z]) => {
      const chunk = this.chunks.get(getChunkKey(x, z));
      if (!chunk) {
        return;
      }

      if (chunk.generationState.state !== '0-waiting') {
        this.deloadChunk(chunk);
      }
    });
  }

  // --------- --------- --------- UTILITY --------- --------- ---------

  public getChunkAt(x: number, z: number) {
    return this.chunks.get(
      getChunkKey(
        Math.floor(x / CHUNK_WIDTH) * CHUNK_WIDTH,
        Math.floor(z / CHUNK_WIDTH) * CHUNK_WIDTH
      )
    );
  }

  public queueChunks(
    xStart: number,
    zStart: number,
    xEnd: number,
    zEnd: number
  ) {
    for (
      let x = Math.floor(xStart / CHUNK_WIDTH) * CHUNK_WIDTH;
      x <= xEnd;
      x += CHUNK_WIDTH
    ) {
      for (
        let z = Math.floor(zStart / CHUNK_WIDTH) * CHUNK_WIDTH;
        z <= zEnd;
        z += CHUNK_WIDTH
      ) {
        this.queueChunkBlocks(x, z);
      }
    }
  }

  public queueChunksCircular(
    xCenter: number,
    zCenter: number,
    radiusChunks: number
  ) {
    const coords: Array<[number, number, number]> = [];
    const [xcExact, zcExact] = [
      Math.floor(xCenter / CHUNK_WIDTH) * CHUNK_WIDTH,
      Math.floor(zCenter / CHUNK_WIDTH) * CHUNK_WIDTH,
    ];
    for (let dx = -radiusChunks; dx <= radiusChunks; dx++) {
      const zLength = Math.ceil(
        Math.sqrt(radiusChunks * radiusChunks - dx * dx)
      );
      for (let dz = -zLength; dz <= zLength; dz++) {
        coords.push([
          xcExact + dx * CHUNK_WIDTH,
          zcExact + dz * CHUNK_WIDTH,
          dx * dx + dz * dz,
        ]);
      }
    }

    coords.sort(([, , a], [, , b]) => a - b);

    coords.forEach(([x, z]) => {
      this.queueChunkBlocks(x, z);
    });
  }

  public blockRaycast(
    start: [number, number, number],
    direction: [number, number, number],
    distance: number
  ) {
    return raycast(
      (x, y, z) => {
        const chunk = this.getChunkAt(x, z);
        if (
          !chunk ||
          chunk.generationState.state === '0-waiting' ||
          chunk.generationState.state === '1-blocksQueued' ||
          y >= CHUNK_HEIGHT ||
          y < 0
        ) {
          return false;
        }
        const block = chunk.getBlockAt(
          Math.floor(x - chunk.absoluteX),
          Math.floor(y),
          Math.floor(z - chunk.absoluteZ)
        );
        return isSolid(block) ? block : false;
      },
      start,
      direction,
      distance
    );
  }

  public setBlock(
    [x, y, z]: [number, number, number],
    block: Block,
    { regenerateMesh }: { regenerateMesh?: boolean } = { regenerateMesh: true }
  ) {
    if (y >= CHUNK_HEIGHT || y < 0) {
      console.error('Attempted to set a block out of bounds!');
    }

    const chunk = this.getChunkAt(x, z);
    if (!chunk) return;

    const [chunkX, chunkZ] = [x - chunk.absoluteX, z - chunk.absoluteZ];
    chunk.setBlockAt(chunkX, y, chunkZ, block);
    if (regenerateMesh) {
      chunk.forceMeshRegeneration();

      // regenerate neighbors if needed
      if (chunkX === 0) {
        chunk.neighbors.get(DIRECTIONS.west)?.forceMeshRegeneration();
      }
      if (chunkX === CHUNK_WIDTH - 1) {
        chunk.neighbors.get(DIRECTIONS.east)?.forceMeshRegeneration();
      }
      if (chunkZ === 0) {
        chunk.neighbors.get(DIRECTIONS.north)?.forceMeshRegeneration();
      }
      if (chunkZ === CHUNK_WIDTH - 1) {
        chunk.neighbors.get(DIRECTIONS.south)?.forceMeshRegeneration();
      }
    }
  }

  // --------- --------- --------- PRIVATE --------- --------- ---------

  private doQueuedBlocksGenerationStep() {
    // grab first chunk from queue
    const chunk = this.chunkBlockQueue[0];

    const { done } = chunk.doGenerationStep();
    if (done) {
      chunk.generationState = { state: '2-meshWaiting' };
      this.chunkBlockQueue.splice(0, 1);

      // try queueing self and neighbors
      this.tryQueueChunkMeshWithNeighbors(chunk);
    }
  }

  private doQueuedMeshGenerationStep() {
    const chunk = this.chunkMeshQueue[0];
    const { done } = chunk.doGenerationStep();
    if (done) {
      chunk.generationState = { state: '4-done' };
      this.chunkMeshQueue.splice(0, 1);

      this.add(chunk);
    }
  }

  private createChunk(xExact: number, zExact: number) {
    const newChunk = new Chunk(xExact, zExact);

    // link the chunks baby
    this.chunks
      .get(getChunkKey(xExact - CHUNK_WIDTH, zExact))
      ?.linkChunk(newChunk, DIRECTIONS.east);
    this.chunks
      .get(getChunkKey(xExact + CHUNK_WIDTH, zExact))
      ?.linkChunk(newChunk, DIRECTIONS.west);
    this.chunks
      .get(getChunkKey(xExact, zExact - CHUNK_WIDTH))
      ?.linkChunk(newChunk, DIRECTIONS.south);
    this.chunks
      .get(getChunkKey(xExact, zExact + CHUNK_WIDTH))
      ?.linkChunk(newChunk, DIRECTIONS.north);

    this.chunks.get(getChunkKey(xExact, zExact));
    this.chunks.set(getChunkKey(xExact, zExact), newChunk);

    return newChunk;
  }

  private queueChunkBlocks(xExact: number, zExact: number) {
    const newChunk = this.createChunk(xExact, zExact);
    newChunk.enqueueBlocks();
    this.chunkBlockQueue.push(newChunk);
  }

  /**
   * Generate the mesh data of a chunk and all its neighbors if possible
   */
  private tryQueueChunkMeshWithNeighbors(chunk: Chunk) {
    for (const possibleChunk of [chunk, ...chunk.neighbors.values()]) {
      if (
        possibleChunk.generationState.state === '2-meshWaiting' &&
        possibleChunk.allNeighborsHaveBlocks() &&
        Player.current?.isChunkInViewDistance([
          possibleChunk.absoluteX,
          possibleChunk.absoluteZ,
        ])
      ) {
        possibleChunk.enqueueMesh();
        this.chunkMeshQueue.push(possibleChunk);
      }
    }
  }

  /**
   * Handle the deloading of a chunk, no matter its generation state
   */
  private deloadChunk(chunk: Chunk) {
    chunk.deload();

    const chunkBlockQueueIndex = this.chunkBlockQueue.indexOf(chunk);
    if (chunkBlockQueueIndex >= 0) {
      this.chunkBlockQueue.splice(chunkBlockQueueIndex, 1);
    }

    const chunkMeshQueueIndex = this.chunkMeshQueue.indexOf(chunk);
    if (chunkMeshQueueIndex >= 0) {
      this.chunkMeshQueue.splice(chunkMeshQueueIndex, 1);
    }

    this.remove(chunk);
  }
}
