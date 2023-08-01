import { HALF_GENERATION_TIME_TO_FRAME_RATIO } from '@/constants/engine'
import {
  TERRAIN_HEIGHT_NOISE,
  TERRAIN_HEIGHT_NOISE_SCALE,
  TERRAIN_HEIGHT_LARGE_NOISE,
  TERRAIN_HEIGHT_LARGE_NOISE_SCALE,
} from '@/constants/world'
import { getAverageDT } from '@/main'
import { MathUtils } from 'three'
import Chunk from '../../scene/chunk'
import { BLOCKS } from '../blocks'

function getEndTime(startTimeMillis: number) {
  return startTimeMillis + getAverageDT() * 1000 * HALF_GENERATION_TIME_TO_FRAME_RATIO
}

export default function* blocksGenerator(chunk: Chunk): Generator<undefined, void, number> {
  let endTime = getEndTime(yield)

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

      if (new Date().getTime() >= endTime) {
        endTime = getEndTime(yield)
      }
    }
  }
}
