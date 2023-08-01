import { createNoise2D } from 'simplex-noise'
import alea from 'alea'
import * as THREE from 'three'
import { Vector3, MathUtils } from 'three'

import { Direction, DIRECTIONS, getDirectionFromXZ, getOppositeDirection } from '../lib/space'
import { modPositive } from '../lib/math'

export const BLOCKS = {
  air: Symbol('Air'),
  grass: Symbol('Grass'),
  dirt: Symbol('Dirt'),
  stone: Symbol('Stone'),
  bedrock: Symbol('Bedrock'),
} as const

export type Block = (typeof BLOCKS)[keyof typeof BLOCKS]

export function isSolid(block: Block) {
  return block !== BLOCKS.air
}

const TERRAIN_HEIGHT_NOISE = createNoise2D(alea('terrain-height-base'))
const TERRAIN_HEIGHT_NOISE_SCALE = 0.02
const TERRAIN_HEIGHT_LARGE_NOISE = createNoise2D(alea('terrain-height-large'))
const TERRAIN_HEIGHT_LARGE_NOISE_SCALE = 0.004

const GENERATION_MAX_MS = 4

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

function* blocksGenerator(chunk: Chunk): Generator<undefined, void, number> {
  let startTime = yield

  for (let chunkX = 0; chunkX < Chunk.WIDTH; chunkX++) {
    for (let chunkZ = 0; chunkZ < Chunk.WIDTH; chunkZ++) {
      // fill with air!
      for (let y = 0; y < Chunk.HEIGHT; y++) {
        chunk.setBlockAt(chunkX, y, chunkZ, BLOCKS.air)
      }

      // global coordinates
      const x = chunk.absoluteX + chunkX
      const z = chunk.absoluteZ + chunkZ

      const heightNoise = TERRAIN_HEIGHT_NOISE(
        x * TERRAIN_HEIGHT_NOISE_SCALE,
        z * TERRAIN_HEIGHT_NOISE_SCALE
      )
      const largeHeightNoise = TERRAIN_HEIGHT_LARGE_NOISE(
        x * TERRAIN_HEIGHT_LARGE_NOISE_SCALE,
        z * TERRAIN_HEIGHT_LARGE_NOISE_SCALE
      )
      const height = Math.floor(
        MathUtils.mapLinear(heightNoise, -1, 1, -5, 5) +
          MathUtils.mapLinear(largeHeightNoise, -1, 1, 50, 100)
      )

      chunk.setBlockAt(chunkX, 0, chunkZ, BLOCKS.bedrock)
      for (let y = 1; y < height - 3; y++) {
        chunk.setBlockAt(chunkX, y, chunkZ, BLOCKS.stone)
      }
      for (let y = height - 3; y < height; y++) {
        chunk.setBlockAt(chunkX, y, chunkZ, BLOCKS.dirt)
      }
      chunk.setBlockAt(chunkX, height, chunkZ, BLOCKS.grass)

      if (new Date().getTime() >= startTime + GENERATION_MAX_MS) {
        startTime = yield
      }
    }
  }
}

const blockFaces: {
  direction: Direction
  positions: [Vector3, Vector3, Vector3, Vector3]
  normal: Vector3
  offset: Vector3
}[] = [
  {
    direction: DIRECTIONS.east,
    positions: [
      new Vector3(1, 0, 1),
      new Vector3(1, 0, 0),
      new Vector3(1, 1, 0),
      new Vector3(1, 1, 1),
    ],
    normal: new Vector3(1, 0, 0),
    offset: new Vector3(1, 0, 0),
  },
  {
    direction: DIRECTIONS.west,
    positions: [
      new Vector3(0, 0, 0),
      new Vector3(0, 0, 1),
      new Vector3(0, 1, 1),
      new Vector3(0, 1, 0),
    ],
    normal: new Vector3(-1, 0, 0),
    offset: new Vector3(-1, 0, 0),
  },
  {
    direction: DIRECTIONS.up,
    positions: [
      new Vector3(0, 1, 0),
      new Vector3(0, 1, 1),
      new Vector3(1, 1, 1),
      new Vector3(1, 1, 0),
    ],
    normal: new Vector3(0, 1, 0),
    offset: new Vector3(0, 1, 0),
  },
  {
    direction: DIRECTIONS.down,
    positions: [
      new Vector3(0, 0, 0),
      new Vector3(1, 0, 0),
      new Vector3(1, 0, 1),
      new Vector3(0, 0, 1),
    ],
    normal: new Vector3(0, -1, 0),
    offset: new Vector3(0, -1, 0),
  },
  {
    direction: DIRECTIONS.south,
    positions: [
      new Vector3(0, 0, 1),
      new Vector3(1, 0, 1),
      new Vector3(1, 1, 1),
      new Vector3(0, 1, 1),
    ],
    normal: new Vector3(0, 0, 1),
    offset: new Vector3(0, 0, 1),
  },
  {
    direction: DIRECTIONS.north,
    positions: [
      new Vector3(1, 0, 0),
      new Vector3(0, 0, 0),
      new Vector3(0, 1, 0),
      new Vector3(1, 1, 0),
    ],
    normal: new Vector3(0, 0, -1),
    offset: new Vector3(0, 0, -1),
  },
]

const blockUVOffsets: Map<Block, Map<Direction, [x: number, z: number]>> = new Map([
  [
    BLOCKS.bedrock,
    new Map([
      [DIRECTIONS.west, [1, 14]],
      [DIRECTIONS.south, [1, 14]],
      [DIRECTIONS.east, [1, 14]],
      [DIRECTIONS.north, [1, 14]],
      [DIRECTIONS.up, [1, 14]],
      [DIRECTIONS.down, [1, 14]],
    ]),
  ],
  [
    BLOCKS.stone,
    new Map([
      [DIRECTIONS.west, [1, 15]],
      [DIRECTIONS.south, [1, 15]],
      [DIRECTIONS.east, [1, 15]],
      [DIRECTIONS.north, [1, 15]],
      [DIRECTIONS.up, [1, 15]],
      [DIRECTIONS.down, [1, 15]],
    ]),
  ],
  [
    BLOCKS.dirt,
    new Map([
      [DIRECTIONS.west, [2, 15]],
      [DIRECTIONS.south, [2, 15]],
      [DIRECTIONS.east, [2, 15]],
      [DIRECTIONS.north, [2, 15]],
      [DIRECTIONS.up, [2, 15]],
      [DIRECTIONS.down, [2, 15]],
    ]),
  ],
  [
    BLOCKS.grass,
    new Map([
      [DIRECTIONS.west, [3, 15]],
      [DIRECTIONS.south, [3, 15]],
      [DIRECTIONS.east, [3, 15]],
      [DIRECTIONS.north, [3, 15]],
      [DIRECTIONS.up, [8, 13]],
      [DIRECTIONS.down, [2, 15]],
    ]),
  ],
])

const uvBlockSize = 1 / 16

function* meshGenerator(chunk: Chunk): Generator<undefined, void, number> {
  let startTime = yield

  if (!chunk.hasAllNeighbors()) {
    console.error('Cannot generate mesh without neighbor chunks being generated')
    return
  }

  const triangleIndices: number[] = []
  const vertexPositions: number[] = []
  const vertexNormals: number[] = []
  const vertexUVs: number[] = []

  for (let localX = 0; localX < Chunk.WIDTH; localX++) {
    for (let localZ = 0; localZ < Chunk.WIDTH; localZ++) {
      for (let localY = 0; localY < Chunk.HEIGHT; localY++) {
        let localPos = new Vector3(localX, localY, localZ)
        const currentBlock = chunk.getBlockAt(localX, localY, localZ)
        if (!isSolid(currentBlock)) {
          continue
        }

        blockFaces.forEach(({ direction, positions, normal, offset }) => {
          let offsetPos = new Vector3().addVectors(localPos, offset)
          let offsetBlock: Block

          if (offsetPos.y < 0 || offsetPos.y >= Chunk.HEIGHT) {
            // out of bounds in y direction
            offsetBlock = BLOCKS.air
          } else if (
            offsetPos.x < 0 ||
            offsetPos.x >= Chunk.WIDTH ||
            offsetPos.z < 0 ||
            offsetPos.z >= Chunk.WIDTH
          ) {
            // out of bounds in x or z direction
            const neighbor = chunk.neighbors.get(getDirectionFromXZ(offset.x, offset.z)!)!
            offsetBlock = neighbor.getBlockAt(
              modPositive(offsetPos.x, Chunk.WIDTH),
              offsetPos.y,
              modPositive(offsetPos.z, Chunk.WIDTH)
            )
          } else {
            // inside chunk
            offsetBlock = chunk.getBlockAt(offsetPos.x, offsetPos.y, offsetPos.z)
          }

          if (isSolid(offsetBlock)) {
            return
          }

          const [u, v] = blockUVOffsets.get(currentBlock)?.get(direction)!

          const idx0 = vertexPositions.length / 3
          // theoretically add 4 vertices per face
          positions.forEach((position, posIdx) => {
            vertexPositions.push(localX + position.x, localY + position.y, localZ + position.z)
            vertexNormals.push(normal.x, normal.y, normal.z)

            const [vOffset, uOffset] = [posIdx >= 2 ? 1 : 0, posIdx >= 1 && posIdx <= 2 ? 1 : 0]
            vertexUVs.push((u + uOffset) * uvBlockSize, (v + vOffset) * uvBlockSize)
          })

          // add two triangles
          triangleIndices.push(idx0, idx0 + 1, idx0 + 2)
          triangleIndices.push(idx0, idx0 + 2, idx0 + 3)
        })

        if (new Date().getTime() >= startTime + GENERATION_MAX_MS) {
          startTime = yield
        }
      }
    }
  }

  const geometry = (chunk.geometry = new THREE.BufferGeometry())

  geometry.setIndex(triangleIndices)
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertexPositions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(vertexNormals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(vertexUVs, 2))
}
