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

const texture = new THREE.TextureLoader().load('block_atlas.png')

const TERRAIN_HEIGHT_NOISE = createNoise2D(alea('terrain-height-base'))
const TERRAIN_HEIGHT_NOISE_SCALE = 0.02

export default class Chunk {
  absoluteX: number
  absoluteZ: number

  neighbors: Map<Direction, Chunk>

  blocks: Array<Block>
  mesh: THREE.Mesh
  isGenerated: boolean

  static WIDTH = 16 as const
  static HEIGHT = 255 as const

  // TODO: texture UV mapping
  static material = new THREE.MeshLambertMaterial({ vertexColors: false, map: texture })

  constructor(absoluteX: number, absoluteZ: number) {
    this.absoluteX = absoluteX
    this.absoluteZ = absoluteZ

    this.neighbors = new Map()

    this.blocks = new Array(Chunk.WIDTH * Chunk.HEIGHT * Chunk.WIDTH)
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), Chunk.material)
    this.mesh.position.set(absoluteX, 0, absoluteZ)
    this.isGenerated = false
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

  setBlockAt(x: number, y: number, z: number, block: Block) {
    this.blocks[x + y * Chunk.WIDTH + z * Chunk.WIDTH * Chunk.HEIGHT] = block
  }

  getBlockAt(x: number, y: number, z: number): Block {
    return this.blocks[x + y * Chunk.WIDTH + z * Chunk.WIDTH * Chunk.HEIGHT]
  }

  generateBlocks() {
    for (let chunkX = 0; chunkX < Chunk.WIDTH; chunkX++) {
      for (let chunkZ = 0; chunkZ < Chunk.WIDTH; chunkZ++) {
        // fill with air!
        for (let y = 0; y < Chunk.HEIGHT; y++) {
          this.setBlockAt(chunkX, y, chunkZ, BLOCKS.air)
        }

        // global coordinates
        const x = this.absoluteX + chunkX
        const z = this.absoluteZ + chunkZ

        const heightNoise = TERRAIN_HEIGHT_NOISE(
          x * TERRAIN_HEIGHT_NOISE_SCALE,
          z * TERRAIN_HEIGHT_NOISE_SCALE
        )
        const height = MathUtils.mapLinear(heightNoise, -1, 1, 50, 75)

        this.setBlockAt(chunkX, 0, chunkZ, BLOCKS.bedrock)
        for (let y = 1; y < height - 3; y++) {
          this.setBlockAt(chunkX, y, chunkZ, BLOCKS.stone)
        }
        for (let y = height - 3; y < height; y++) {
          this.setBlockAt(chunkX, y, chunkZ, BLOCKS.dirt)
        }
        this.setBlockAt(chunkX, height, chunkZ, BLOCKS.grass)
      }
    }
    this.isGenerated = true
  }

  static blockFaces: {
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

  generateMesh() {
    if (!this.hasAllNeighbors()) {
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
          const currentBlock = this.getBlockAt(localX, localY, localZ)
          if (!isSolid(currentBlock)) {
            continue
          }

          Chunk.blockFaces.forEach(({ positions, normal, offset }) => {
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
              const neighbor = this.neighbors.get(getDirectionFromXZ(offset.x, offset.z)!)!
              offsetBlock = neighbor.getBlockAt(
                modPositive(offsetPos.x, Chunk.WIDTH),
                offsetPos.y,
                modPositive(offsetPos.z, Chunk.WIDTH)
              )
            } else {
              // inside chunk
              offsetBlock = this.getBlockAt(offsetPos.x, offsetPos.y, offsetPos.z)
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
        }
      }
    }

    const geometry = this.mesh.geometry

    geometry.setIndex(triangleIndices)
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertexPositions, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(vertexNormals, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3))
  }
}
