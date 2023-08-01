import alea from 'alea'
import { createNoise2D } from 'simplex-noise'

export const CHUNK_WIDTH = 16
export const CHUNK_HEIGHT = 256

export const TERRAIN_HEIGHT_NOISE = createNoise2D(alea('terrain-height-base'))
export const TERRAIN_HEIGHT_NOISE_SCALE = 0.02
export const TERRAIN_HEIGHT_LARGE_NOISE = createNoise2D(alea('terrain-height-large'))
export const TERRAIN_HEIGHT_LARGE_NOISE_SCALE = 0.004
