import Chunk from './chunk'
import * as THREE from 'three'
import { DIRECTIONS } from '../lib/space'

function getChunkKey(xExact: number, zExact: number) {
  return `${xExact.toFixed(0)},${zExact.toFixed(0)}`
}

export default class Terrain {
  chunks: Map<String, Chunk>
  group: THREE.Group

  constructor() {
    this.chunks = new Map()
    this.group = new THREE.Group()
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

    // TODO: multithread
    newChunk.generateBlocks()

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

  // TODO: replace this when doing multithreading
  generateChunks(xStart: number, zStart: number, xEnd: number, zEnd: number) {
    const generatedChunks = []

    for (let x = Math.floor(xStart / Chunk.WIDTH) * Chunk.WIDTH; x <= xEnd; x += Chunk.WIDTH) {
      for (let z = Math.floor(zStart / Chunk.WIDTH) * Chunk.WIDTH; z <= zEnd; z += Chunk.WIDTH) {
        const key = getChunkKey(x, z)
        const existingChunk = this.chunks.get(key)

        if (existingChunk !== undefined) {
          continue
        }

        generatedChunks.push(this.createChunk(x, z))
      }
    }

    generatedChunks.forEach((chunk) => {
      chunk.generateMesh()
    })
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
