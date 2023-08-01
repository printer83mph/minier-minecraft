import * as THREE from 'three'

import { DIRECTIONS } from '../lib/space'
import Chunk from './chunk'
import Player from './player'

function getChunkKey(xExact: number, zExact: number) {
  return `${xExact.toFixed(0)},${zExact.toFixed(0)}`
}

export default class Terrain extends THREE.Object3D {
  chunks = new Map<String, Chunk>()
  chunkBlockQueue: Chunk[] = []
  chunkMeshQueue: Chunk[] = []

  constructor() {
    super()
  }

  update({ chunksIn, chunksOut }: { chunksIn: [number, number][]; chunksOut: [number, number][] }) {
    this.updateChunkQueue(chunksIn, chunksOut)

    if (this.chunkBlockQueue.length > 0) {
      generateQueuedChunkBlocks(this)
    }

    if (this.chunkMeshQueue.length > 0) {
      generateQueuedChunkMesh(this)
    }
  }

  updateChunkQueue(chunksIn: [number, number][], chunksOut: [number, number][]) {
    chunksIn.forEach(([x, z]) => {
      const chunk = this.chunks.get(getChunkKey(x, z))
      if (!chunk) {
        queueChunkBlocks(this, x, z)
        return
      }

      if (chunk.generationState.state === '0-waiting') {
        this.chunkBlockQueue.push(chunk)
        chunk.enqueueBlocks()
        return
      }

      if (chunk.generationState.state === '2-meshWaiting') {
        // only queue if we have all neighbors' blocks, also check neighbors for queueing
        tryQueueChunkMeshWithNeighbors(this, chunk)
        return
      }
    })

    chunksOut.forEach(([x, z]) => {
      const chunk = this.chunks.get(getChunkKey(x, z))
      if (!chunk) {
        return
      }

      if (chunk.generationState.state !== '0-waiting') {
        deloadChunk(this, chunk)
        return
      }
    })
  }

  // --------- --------- --------- UTILITY --------- --------- ---------

  getChunkAt(x: number, z: number) {
    return this.chunks.get(
      getChunkKey(
        Math.floor(x / Chunk.WIDTH) * Chunk.WIDTH,
        Math.floor(z / Chunk.WIDTH) * Chunk.WIDTH
      )
    )
  }

  queueChunks(xStart: number, zStart: number, xEnd: number, zEnd: number) {
    for (let x = Math.floor(xStart / Chunk.WIDTH) * Chunk.WIDTH; x <= xEnd; x += Chunk.WIDTH) {
      for (let z = Math.floor(zStart / Chunk.WIDTH) * Chunk.WIDTH; z <= zEnd; z += Chunk.WIDTH) {
        queueChunkBlocks(this, x, z)
      }
    }
  }

  queueChunksCircular(xCenter: number, zCenter: number, radiusChunks: number) {
    const coords = []
    let [xcExact, zcExact] = [
      Math.floor(xCenter / Chunk.WIDTH) * Chunk.WIDTH,
      Math.floor(zCenter / Chunk.WIDTH) * Chunk.WIDTH,
    ]
    for (let dx = -radiusChunks; dx <= radiusChunks; dx++) {
      const zLength = Math.ceil(Math.sqrt(radiusChunks * radiusChunks - dx * dx))
      for (let dz = -zLength; dz <= zLength; dz++) {
        coords.push([xcExact + dx * Chunk.WIDTH, zcExact + dz * Chunk.WIDTH, dx * dx + dz * dz])
      }
    }

    coords.sort(([, , a], [, , b]) => a - b)

    coords.forEach(([x, z]) => {
      queueChunkBlocks(this, x, z)
    })
  }
}

// --------- --------- --------- PRIVATE --------- --------- ---------

function generateQueuedChunkBlocks(terrain: Terrain) {
  // grab first chunk from queue
  const chunk = terrain.chunkBlockQueue[0]

  const { done } = chunk.doGenerationStep()
  if (done) {
    chunk.generationState = { state: '2-meshWaiting' }
    terrain.chunkBlockQueue.splice(0, 1)

    // try queueing self and neighbors
    tryQueueChunkMeshWithNeighbors(terrain, chunk)
  }
}

function generateQueuedChunkMesh(terrain: Terrain) {
  const chunk = terrain.chunkMeshQueue[0]
  const { done } = chunk.doGenerationStep()
  if (done) {
    chunk.generationState = { state: '4-done' }
    terrain.chunkMeshQueue.splice(0, 1)

    terrain.add(chunk)
  }
}

function createChunk(terrain: Terrain, xExact: number, zExact: number) {
  const newChunk = new Chunk(xExact, zExact)

  // link the chunks baby
  terrain.chunks
    .get(getChunkKey(xExact - Chunk.WIDTH, zExact))
    ?.linkChunk(newChunk, DIRECTIONS.east)
  terrain.chunks
    .get(getChunkKey(xExact + Chunk.WIDTH, zExact))
    ?.linkChunk(newChunk, DIRECTIONS.west)
  terrain.chunks
    .get(getChunkKey(xExact, zExact - Chunk.WIDTH))
    ?.linkChunk(newChunk, DIRECTIONS.south)
  terrain.chunks
    .get(getChunkKey(xExact, zExact + Chunk.WIDTH))
    ?.linkChunk(newChunk, DIRECTIONS.north)

  terrain.chunks.get(getChunkKey(xExact, zExact))
  terrain.chunks.set(getChunkKey(xExact, zExact), newChunk)

  return newChunk
}

function queueChunkBlocks(terrain: Terrain, xExact: number, zExact: number) {
  const newChunk = createChunk(terrain, xExact, zExact)
  newChunk.enqueueBlocks()
  terrain.chunkBlockQueue.push(newChunk)
}

/**
 * Generate the mesh data of a chunk and all its neighbors if possible
 */
function tryQueueChunkMeshWithNeighbors(terrain: Terrain, chunk: Chunk) {
  for (let possibleChunk of [chunk, ...chunk.neighbors.values()]) {
    if (
      possibleChunk.generationState.state === '2-meshWaiting' &&
      possibleChunk.allNeighborsHaveBlocks() &&
      Player.current.isChunkInViewDistance([possibleChunk.absoluteX, possibleChunk.absoluteZ])
    ) {
      possibleChunk.enqueueMesh()
      terrain.chunkMeshQueue.push(possibleChunk)
    }
  }
}

/**
 * Handle the deloading of a chunk, no matter its generation state
 */
function deloadChunk(terrain: Terrain, chunk: Chunk) {
  chunk.deload()

  const chunkBlockQueueIndex = terrain.chunkBlockQueue.indexOf(chunk)
  if (chunkBlockQueueIndex >= 0) {
    terrain.chunkBlockQueue.splice(chunkBlockQueueIndex, 1)
  }

  const chunkMeshQueueIndex = terrain.chunkMeshQueue.indexOf(chunk)
  if (chunkMeshQueueIndex >= 0) {
    terrain.chunkMeshQueue.splice(chunkMeshQueueIndex, 1)
  }

  terrain.remove(chunk)
}
