import { createNoise2D } from 'simplex-noise'
import alea from 'alea'
import * as THREE from 'three'
import { Direction, DIRECTIONS, getDirectionFromXZ, getOppositeDirection } from '../lib/space'
import { modPositive } from '../lib/math'
const { Vector3, MathUtils } = THREE

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
    material = new THREE.MeshLambertMaterial({ vertexColors: false, map: texture })
  }

  absoluteX: number
  absoluteZ: number

  neighbors = new Map<Direction, Chunk>()

  blocks = new Array<Block>(Chunk.WIDTH * Chunk.HEIGHT)
  generator: ReturnType<typeof generateBlocks>
  blockGenerationState: 'waiting' | 'queued' | 'done' = 'waiting'
  meshGenerationState: 'waiting' | 'queued' | 'done' | 'deloaded' = 'waiting'

  // TODO: texture UV mapping

  constructor(absoluteX: number, absoluteZ: number) {
    super(undefined, material)

    this.absoluteX = absoluteX
    this.absoluteZ = absoluteZ

    this.position.set(absoluteX, 0, absoluteZ)

    this.generator = generateBlocks(this)
    this.generator.next()
  }

  deload() {
    this.geometry.dispose()
  }

  reload() {
    this.generator = generateMesh(this)
  }

  linkChunk(chunk: Chunk, direction: Direction) {
    this.neighbors.set(direction, chunk)
    chunk.neighbors.set(getOppositeDirection(direction), this)
  }

  hasAllNeighbors() {
    return (
      this.neighbors.has(DIRECTIONS.east) &&
      this.neighbors.has(DIRECTIONS.north) &&
      this.neighbors.has(DIRECTIONS.west) &&
      this.neighbors.has(DIRECTIONS.south)
    )
  }

  allNeighborsHaveBlocks() {
    if (!this.hasAllNeighbors()) {
      return false
    }
    for (let neighbor of this.neighbors.values()) {
      if (neighbor.blockGenerationState !== 'done') {
        return false
      }
    }
    return true
  }

  setBlockAt(x: number, y: number, z: number, block: Block) {
    this.blocks[x + y * Chunk.WIDTH + z * Chunk.WIDTH * Chunk.HEIGHT] = block
  }

  getBlockAt(x: number, y: number, z: number): Block {
    return this.blocks[x + y * Chunk.WIDTH + z * Chunk.WIDTH * Chunk.HEIGHT]
  }

  stepBlockGeneration() {
    const startTime = new Date().getTime()
    const result = this.generator.next(startTime)
    if (result.done) {
      this.generator = generateMesh(this)
      this.generator.next()
    }
    return result.done
  }

  stepMeshGeneration() {
    const startTime = new Date().getTime()
    const result = this.generator.next(startTime)
    return result.done
  }
}

function* generateBlocks(chunk: Chunk): Generator<undefined, void, number> {
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
      const height =
        MathUtils.mapLinear(heightNoise, -1, 1, -5, 5) +
        MathUtils.mapLinear(largeHeightNoise, -1, 1, 50, 100)

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
  positions: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3]
  normal: THREE.Vector3
  offset: THREE.Vector3
}[] = [
  {
    // +X (west)
    positions: [
      new Vector3(1, 0, 0),
      new Vector3(1, 1, 0),
      new Vector3(1, 1, 1),
      new Vector3(1, 0, 1),
    ],
    normal: new Vector3(1, 0, 0),
    offset: new Vector3(1, 0, 0),
  },
  {
    // -X (east)
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
    // +Y (up)
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
    // -Y (down)
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
    // +Z (north)
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
    // -Z (south)
    positions: [
      new Vector3(0, 0, 0),
      new Vector3(0, 1, 0),
      new Vector3(1, 1, 0),
      new Vector3(1, 0, 0),
    ],
    normal: new Vector3(0, 0, -1),
    offset: new Vector3(0, 0, -1),
  },
]

function* generateMesh(chunk: Chunk): Generator<undefined, void, number> {
  let startTime = yield

  if (!chunk.hasAllNeighbors()) {
    console.error('Cannot generate mesh without neighbor chunks being generated')
    return
  }

  const triangleIndices: number[] = []
  const vertexPositions: number[] = []
  const vertexNormals: number[] = []
  const vertexColors: number[] = []

  for (let localX = 0; localX < Chunk.WIDTH; localX++) {
    for (let localZ = 0; localZ < Chunk.WIDTH; localZ++) {
      for (let localY = 0; localY < Chunk.HEIGHT; localY++) {
        let localPos = new Vector3(localX, localY, localZ)
        const currentBlock = chunk.getBlockAt(localX, localY, localZ)
        if (!isSolid(currentBlock)) {
          continue
        }

        blockFaces.forEach(({ positions, normal, offset }) => {
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

          const idx0 = vertexPositions.length / 3
          // theoretically add 4 vertices per face
          positions.forEach((position) => {
            vertexPositions.push(localX + position.x, localY + position.y, localZ + position.z)
            vertexNormals.push(normal.x, normal.y, normal.z)
            vertexColors.push((normal.x + 2) / 3, (normal.y + 2) / 3, (normal.z + 2) / 3)
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
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3))
}
