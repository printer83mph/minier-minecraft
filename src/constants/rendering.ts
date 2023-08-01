import { Vector3 } from 'three'

import { Block, BLOCKS } from '@/lib/blocks'
import { Direction, DIRECTIONS } from '@/lib/space'

export const BLOCK_FACE_DATA: {
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

export const BLOCK_UV_OFFSETS: Map<Block, Map<Direction, [x: number, z: number]>> = new Map([
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

export const BLOCK_UV_SIZE = 1 / 16
