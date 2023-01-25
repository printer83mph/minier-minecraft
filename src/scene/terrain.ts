import Chunk from './chunk'
import * as THREE from 'three'
import { DIRECTIONS } from '../lib/space'

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
    this.updateChunkQueue(chunksIn)

    if (this.chunkBlockQueue.length > 0) {
      this.generateQueuedChunkBlocks()
    }

    if (this.chunkMeshQueue.length > 0) {
      this.generateQueuedChunkMesh()
    }
  }

  updateChunkQueue(chunks: [number, number][]) {
    chunks.forEach(([x, z]) => {
      const chunk = this.chunks.get(getChunkKey(x, z))
      if (!chunk) {
        this.queueChunk(x, z)
        return
      }
      // TODO: re-generate  chunks that were de-loaded
      // if (chunk.meshGenerationState === 'deloaded')
    })
  }

  generateQueuedChunkBlocks() {
    const chunk = this.chunkBlockQueue[0]
    const complete = chunk.stepBlockGeneration()
    if (complete) {
      chunk.blockGenerationState = 'done'
      this.chunkBlockQueue.splice(0, 1)

      for (let possibleChunk of [chunk, ...chunk.neighbors.values()]) {
        if (
          possibleChunk.blockGenerationState === 'done' &&
          possibleChunk.meshGenerationState === 'waiting' &&
          possibleChunk.allNeighborsHaveBlocks()
        ) {
          possibleChunk.meshGenerationState = 'queued'
          this.chunkMeshQueue.push(possibleChunk)
        }
      }
    }
  }

  generateQueuedChunkMesh() {
    const chunk = this.chunkMeshQueue[0]
    const complete = chunk.stepMeshGeneration()
    if (complete) {
      chunk.meshGenerationState = 'done'
      this.chunkMeshQueue.splice(0, 1)
      this.add(chunk)
    }
  }

  getChunkAt(x: number, z: number) {
    return this.chunks.get(
      getChunkKey(
        Math.floor(x / Chunk.WIDTH) * Chunk.WIDTH,
        Math.floor(z / Chunk.WIDTH) * Chunk.WIDTH
      )
    )
  }

  createChunk(xExact: number, zExact: number) {
    const newChunk = new Chunk(xExact, zExact)

    // link the chunks baby
    this.chunks.get(getChunkKey(xExact - Chunk.WIDTH, zExact))?.linkChunk(newChunk, DIRECTIONS.west)
    this.chunks.get(getChunkKey(xExact + Chunk.WIDTH, zExact))?.linkChunk(newChunk, DIRECTIONS.east)
    this.chunks
      .get(getChunkKey(xExact, zExact - Chunk.WIDTH))
      ?.linkChunk(newChunk, DIRECTIONS.north)
    this.chunks
      .get(getChunkKey(xExact, zExact + Chunk.WIDTH))
      ?.linkChunk(newChunk, DIRECTIONS.south)

    this.chunks.get(getChunkKey(xExact, zExact))
    this.chunks.set(getChunkKey(xExact, zExact), newChunk)

    return newChunk
  }

  queueChunk(xExact: number, zExact: number) {
    const newChunk = this.createChunk(xExact, zExact)
    this.chunkBlockQueue.push(newChunk)
    newChunk.blockGenerationState = 'queued'
  }

  queueChunks(xStart: number, zStart: number, xEnd: number, zEnd: number) {
    for (let x = Math.floor(xStart / Chunk.WIDTH) * Chunk.WIDTH; x <= xEnd; x += Chunk.WIDTH) {
      for (let z = Math.floor(zStart / Chunk.WIDTH) * Chunk.WIDTH; z <= zEnd; z += Chunk.WIDTH) {
        this.queueChunk(x, z)
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

    console.log(coords)
    coords.forEach(([x, z]) => {
      this.queueChunk(x, z)
    })
  }
}
