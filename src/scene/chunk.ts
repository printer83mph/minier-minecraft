import * as THREE from 'three'

import { Block } from '@/lib/blocks'
import blocksGenerator from '@/lib/chunk/blocks-generator'
import meshGenerator from '@/lib/chunk/mesh-generator'
import { Direction, DIRECTIONS, getOppositeDirection } from '@/lib/space'

let texture: THREE.Texture
let material: THREE.Material

export default class Chunk extends THREE.Mesh {
  static WIDTH = 16 as const
  static HEIGHT = 255 as const

  static async setup() {
    texture = await new THREE.TextureLoader().loadAsync('block_atlas.png')
    texture.magFilter = THREE.NearestFilter
    texture.minFilter = THREE.NearestMipmapLinearFilter
    material = new THREE.MeshPhysicalMaterial({ map: texture })
  }

  absoluteX: number
  absoluteZ: number

  neighbors = new Map<Direction, Chunk>()

  blocks = new Array<Block>(Chunk.WIDTH * Chunk.WIDTH * Chunk.HEIGHT)
  generationState:
    | { state: '0-waiting'; generator?: undefined }
    | { state: '1-blocksQueued'; generator: ReturnType<typeof blocksGenerator> }
    | { state: '2-meshWaiting'; generator?: undefined }
    | { state: '3-meshQueued'; generator: ReturnType<typeof meshGenerator> }
    | { state: '4-done'; generator?: undefined } = { state: '0-waiting' }

  constructor(absoluteX: number, absoluteZ: number) {
    super(undefined, material)

    this.absoluteX = absoluteX
    this.absoluteZ = absoluteZ

    this.position.set(absoluteX, 0, absoluteZ)
  }

  // --------- --------- --------- NEIGHBORS --------- --------- ---------

  linkChunk(chunk: Chunk, direction: Direction) {
    this.neighbors.set(direction, chunk)
    chunk.neighbors.set(getOppositeDirection(direction), this)
  }

  hasAllNeighbors() {
    return (
      this.neighbors.has(DIRECTIONS.west) &&
      this.neighbors.has(DIRECTIONS.south) &&
      this.neighbors.has(DIRECTIONS.east) &&
      this.neighbors.has(DIRECTIONS.north)
    )
  }

  allNeighborsHaveBlocks() {
    if (!this.hasAllNeighbors()) {
      return false
    }
    for (let neighbor of this.neighbors.values()) {
      if (
        neighbor.generationState.state === '0-waiting' ||
        neighbor.generationState.state === '1-blocksQueued'
      ) {
        return false
      }
    }
    return true
  }

  // --------- --------- --------- UTILITY --------- --------- ---------

  setBlockAt(x: number, y: number, z: number, block: Block) {
    this.blocks[x + y * Chunk.WIDTH + z * Chunk.WIDTH * Chunk.HEIGHT] = block
  }

  getBlockAt(x: number, y: number, z: number): Block {
    return this.blocks[x + y * Chunk.WIDTH + z * Chunk.WIDTH * Chunk.HEIGHT]
  }

  // --------- --------- --------- GENERATION --------- --------- ---------

  doGenerationStep() {
    const startTime = new Date().getTime()
    const result = this.generationState.generator?.next(startTime)

    return { state: this.generationState.state, done: result?.done }
  }

  enqueueBlocks() {
    this.generationState = { state: '1-blocksQueued', generator: blocksGenerator(this) }
    this.generationState.generator.next()
  }

  enqueueMesh() {
    this.generationState = { state: '3-meshQueued', generator: meshGenerator(this) }
    this.generationState.generator.next()
  }

  // --------- --------- --------- DELOAD/RELOAD --------- --------- ---------

  deload() {
    if (this.generationState.state === '1-blocksQueued') {
      this.blocks = new Array(Chunk.WIDTH * Chunk.WIDTH * Chunk.HEIGHT)
      this.generationState = { state: '0-waiting' }
      return
    }
    if (this.generationState.state === '2-meshWaiting') {
      return
    }
    if (this.generationState.state === '3-meshQueued') {
      this.geometry.dispose()
      this.generationState = { state: '2-meshWaiting' }
      return
    }
    // if (this.generationState.state === '4-done')
    this.geometry.dispose()
    this.generationState = { state: '2-meshWaiting' }
  }

  enqueueReload() {
    this.enqueueMesh()
  }
}
