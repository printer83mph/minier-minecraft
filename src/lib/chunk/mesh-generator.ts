import { HALF_GENERATION_TIME_TO_FRAME_RATIO } from '@/constants/engine'
import { BLOCK_FACE_DATA, BLOCK_UV_OFFSETS, BLOCK_UV_SIZE } from '@/constants/rendering'
import { modPositive } from '@/lib/math'
import { getDirectionFromXZ } from '@/lib/space'
import { getAverageDT } from '@/main'
import Chunk from '@/scene/chunk'
import * as THREE from 'three'
import { Vector3 } from 'three'
import { Block, BLOCKS, isSolid } from '../blocks'

function getEndTime(startTimeMillis: number) {
  return startTimeMillis + getAverageDT() * 1000 * HALF_GENERATION_TIME_TO_FRAME_RATIO
}

export default function* meshGenerator(chunk: Chunk): Generator<undefined, void, number> {
  let endTime = getEndTime(yield)

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

        BLOCK_FACE_DATA.forEach(({ direction, positions, normal, offset }) => {
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

          const [u, v] = BLOCK_UV_OFFSETS.get(currentBlock)?.get(direction)!

          const idx0 = vertexPositions.length / 3
          // theoretically add 4 vertices per face
          positions.forEach((position, posIdx) => {
            vertexPositions.push(localX + position.x, localY + position.y, localZ + position.z)
            vertexNormals.push(normal.x, normal.y, normal.z)

            const [vOffset, uOffset] = [posIdx >= 2 ? 1 : 0, posIdx >= 1 && posIdx <= 2 ? 1 : 0]
            vertexUVs.push((u + uOffset) * BLOCK_UV_SIZE, (v + vOffset) * BLOCK_UV_SIZE)
          })

          // add two triangles
          triangleIndices.push(idx0, idx0 + 1, idx0 + 2)
          triangleIndices.push(idx0, idx0 + 2, idx0 + 3)
        })

        if (new Date().getTime() >= endTime) {
          endTime = getEndTime(yield)
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
