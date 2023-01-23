import Chunk from './chunk'
import * as THREE from 'three'

export default class Terrain {
  chunks: Map<String, Chunk>
  group: THREE.Group

  constructor() {
    this.chunks = new Map()
    this.group = new THREE.Group()
  }

  getChunkKey(xExact: number, zExact: number) {
    return `${xExact.toFixed(0)},${zExact.toFixed(0)}`
  }

  getChunkAt(x: number, z: number) {
    return this.chunks.get(
      this.getChunkKey(
        Math.floor(x / Chunk.WIDTH) * Chunk.WIDTH,
        Math.floor(z / Chunk.WIDTH) * Chunk.WIDTH
      )
    )
  }

  createChunk(x: number, z: number) {
    const xFloor = Math.floor(x / Chunk.WIDTH)
    const zFloor = Math.floor(z / Chunk.WIDTH)
    const newChunk = new Chunk(xFloor, zFloor)

    // TODO: multithread
    newChunk.generateBlocks()
    newChunk.generateMesh()

    this.chunks.set(this.getChunkKey(xFloor, zFloor), newChunk)
    return newChunk
  }

  // TODO: replace this when doing multithreading
  generateChunks(xStart: number, zStart: number, xEnd: number, zEnd: number) {
    for (let x = Math.floor(xStart / Chunk.WIDTH) * Chunk.WIDTH; x <= xEnd; x += Chunk.WIDTH) {
      for (let z = Math.floor(zStart / Chunk.WIDTH) * Chunk.WIDTH; z <= zEnd; z += Chunk.WIDTH) {
        const key = this.getChunkKey(x, z)
        const existingChunk = this.chunks.get(key)

        if (existingChunk !== undefined) {
          continue
        }

        const newChunk = new Chunk(x, z)
        newChunk.generateBlocks()
        newChunk.generateMesh()

        this.chunks.set(key, newChunk)
      }
    }
  }

  updateVisibleChunks(xCenter: number, zCenter: number, radius: number) {
    this.group.clear()
    for (let x = xCenter - radius; x <= xCenter + radius; x += Chunk.WIDTH) {
      for (let z = xCenter - radius; z <= zCenter + radius; z += Chunk.WIDTH) {
        let chunk = this.getChunkAt(x, z)
        if (chunk && chunk.isGenerated) {
          this.group.add(chunk.mesh)
        }
      }
    }
  }
}
