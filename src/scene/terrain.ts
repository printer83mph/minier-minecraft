import Chunk from './chunk'
import * as THREE from 'three'
import { DIRECTIONS } from '../lib/space'

function getChunkKey(xExact: number, zExact: number) {
  return `${xExact.toFixed(0)},${zExact.toFixed(0)}`
}

export type ChunkWorkerData = {
  type: 'blocks' | 'mesh'
  chunks: Chunk[]
}

export type ChunkWorkerOutput = {
  finishedJob: 'blocks' | 'mesh'
  chunks: Chunk[]
}

/**
 * This generator runs every frame, and if the chunkWorker is available and there are chunks in the
 * chunkQueue it will send a group of four to the worker.
 */
function* Chunkerator(terrain: Terrain) {
  while (true) {
    if (!terrain.isChunkWorkerActive && terrain.chunkQueue.length > 0) {
      terrain.isChunkWorkerActive = true
      const coords = terrain.chunkQueue.splice(0, 4)
      const chunks = coords.map(([x, z]) => new Chunk(x, z))
      const data: ChunkWorkerData = {
        type: 'blocks',
        chunks: JSON.parse(JSON.stringify(chunks)),
      }
      terrain.chunkWorker.postMessage(data)
      yield true
    } else {
      yield false
    }
  }
}

export default class Terrain extends THREE.Object3D {
  chunks = new Map<String, Chunk>()

  chunkWorker = new Worker(new URL('../workers/chunk-worker.ts', import.meta.url), {
    type: 'module',
  })
  isChunkWorkerActive = false

  chunkQueue: [number, number][] = []
  chunkerator?: Generator

  constructor() {
    super()
    this.initializeChunkerator()
  }

  initializeChunkerator() {
    this.chunkerator = Chunkerator(this)

    this.chunkWorker.onmessage = (event: MessageEvent<ChunkWorkerOutput>) => {
      const { finishedJob, chunks } = event.data

      chunks.forEach((chunk) => {
        chunk.__proto__ = Chunk.prototype
        console.log(chunk)
      })

      if (finishedJob === 'blocks') {
        // add chunks to our chunk map and link them
        chunks.forEach((chunk) => this.registerAndLinkChunk(chunk))
        // then generate their meshes
        const data: ChunkWorkerData = { type: 'mesh', chunks: JSON.parse(JSON.stringify(chunks)) }
        this.chunkWorker.postMessage(data)
      } else {
        // we finished mesh generation, just all the chunks to be clear for rendering
        chunks.forEach((chunk) => {
          chunk.isGenerated = true
          // TODO: remove chunks from group when too far away
          this.add(chunk)
        })
        this.isChunkWorkerActive = false
      }
    }
  }

  update() {
    this.chunkerator?.next()
  }

  getChunkAt(x: number, z: number) {
    return this.chunks.get(
      getChunkKey(
        Math.floor(x / Chunk.WIDTH) * Chunk.WIDTH,
        Math.floor(z / Chunk.WIDTH) * Chunk.WIDTH
      )
    )
  }

  registerAndLinkChunk(chunk: Chunk) {
    const { absoluteX: x, absoluteZ: z } = chunk

    // link the chunks baby
    this.chunks.get(getChunkKey(x - Chunk.WIDTH, z))?.linkChunk(chunk, DIRECTIONS.west)
    this.chunks.get(getChunkKey(x + Chunk.WIDTH, z))?.linkChunk(chunk, DIRECTIONS.east)
    this.chunks.get(getChunkKey(x, z - Chunk.WIDTH))?.linkChunk(chunk, DIRECTIONS.north)
    this.chunks.get(getChunkKey(x, z + Chunk.WIDTH))?.linkChunk(chunk, DIRECTIONS.south)

    this.chunks.set(getChunkKey(x, z), chunk)

    return chunk
  }

  // TODO: replace this when doing multithreading
  queueChunksInArea(xStart: number, zStart: number, xEnd: number, zEnd: number) {
    for (let x = Math.floor(xStart / Chunk.WIDTH) * Chunk.WIDTH; x <= xEnd; x += Chunk.WIDTH) {
      for (let z = Math.floor(zStart / Chunk.WIDTH) * Chunk.WIDTH; z <= zEnd; z += Chunk.WIDTH) {
        this.chunkQueue.push([x, z])
      }
    }
  }
}
