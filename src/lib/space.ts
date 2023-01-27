export const DIRECTIONS = {
  west: Symbol('West (-X)'),
  south: Symbol('South (+Z)'),
  east: Symbol('East (+X)'),
  north: Symbol('North (-Z)'),
  up: Symbol('Up (+Y)'),
  down: Symbol('Down (-Y)'),
} as const

export type Direction = (typeof DIRECTIONS)[keyof typeof DIRECTIONS]

const oppositeDirection = new Map([
  [DIRECTIONS.south, DIRECTIONS.north],
  [DIRECTIONS.north, DIRECTIONS.south],
  [DIRECTIONS.west, DIRECTIONS.east],
  [DIRECTIONS.east, DIRECTIONS.west],
  [DIRECTIONS.up, DIRECTIONS.down],
  [DIRECTIONS.down, DIRECTIONS.up],
])
export function getOppositeDirection(direction: Direction): Direction {
  return oppositeDirection.get(direction)!
}

export function getDirectionFromXZ(x: number, z: number) {
  if (x > 0) {
    return DIRECTIONS.east
  } else if (x < 0) {
    return DIRECTIONS.west
  } else if (z > 0) {
    return DIRECTIONS.south
  } else if (z < 0) {
    return DIRECTIONS.north
  }
  return undefined
}
