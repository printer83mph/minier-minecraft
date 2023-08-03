import { MathUtils } from 'three';

import { BLOCKS } from '../blocks';
import { getAverageDT } from '../engine';

import { HALF_GENERATION_TIME_TO_FRAME_RATIO } from '@/constants/engine';
import {
  CHUNK_HEIGHT,
  CHUNK_WIDTH,
  TERRAIN_HEIGHT_LARGE_NOISE,
  TERRAIN_HEIGHT_LARGE_NOISE_SCALE,
  TERRAIN_HEIGHT_NOISE,
  TERRAIN_HEIGHT_NOISE_SCALE,
} from '@/constants/world';
import type Chunk from '@/scene/chunk';

function getEndTime(startTimeMillis: number) {
  return (
    startTimeMillis +
    getAverageDT() * 1000 * HALF_GENERATION_TIME_TO_FRAME_RATIO
  );
}

export default function* blocksGenerator(
  chunk: Chunk
): Generator<undefined, void, number> {
  let endTime = getEndTime(yield);

  for (let chunkX = 0; chunkX < CHUNK_WIDTH; chunkX += 1) {
    for (let chunkZ = 0; chunkZ < CHUNK_WIDTH; chunkZ += 1) {
      // fill with air!
      for (let y = 0; y < CHUNK_HEIGHT; y += 1) {
        chunk.setBlockAt(chunkX, y, chunkZ, BLOCKS.air);
      }

      // global coordinates
      const x = chunk.absoluteX + chunkX;
      const z = chunk.absoluteZ + chunkZ;

      const heightNoise = TERRAIN_HEIGHT_NOISE(
        x * TERRAIN_HEIGHT_NOISE_SCALE,
        z * TERRAIN_HEIGHT_NOISE_SCALE
      );
      const largeHeightNoise = TERRAIN_HEIGHT_LARGE_NOISE(
        x * TERRAIN_HEIGHT_LARGE_NOISE_SCALE,
        z * TERRAIN_HEIGHT_LARGE_NOISE_SCALE
      );
      const height = Math.floor(
        MathUtils.mapLinear(heightNoise, -1, 1, -5, 5) +
          MathUtils.mapLinear(largeHeightNoise, -1, 1, 50, 100)
      );

      chunk.setBlockAt(chunkX, 0, chunkZ, BLOCKS.bedrock);
      for (let y = 1; y < height - 3; y += 1) {
        chunk.setBlockAt(chunkX, y, chunkZ, BLOCKS.stone);
      }
      for (let y = height - 3; y < height; y += 1) {
        chunk.setBlockAt(chunkX, y, chunkZ, BLOCKS.dirt);
      }
      chunk.setBlockAt(chunkX, height, chunkZ, BLOCKS.grass);

      if (new Date().getTime() >= endTime) {
        endTime = getEndTime(yield);
      }
    }
  }
}
