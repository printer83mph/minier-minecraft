export const DIRECTIONS = {
  east: Symbol('East (-X)'),
  north: Symbol('North (+Z)'),
  west: Symbol('West (+X)'),
  south: Symbol('South (-Z)'),
  up: Symbol('Up (+Y)'),
  down: Symbol('Down (-Y)'),
} as const

export type Direction = (typeof DIRECTIONS)[keyof typeof DIRECTIONS]

const oppositeDirection = new Map([
  [DIRECTIONS.north, DIRECTIONS.south],
  [DIRECTIONS.south, DIRECTIONS.north],
  [DIRECTIONS.east, DIRECTIONS.west],
  [DIRECTIONS.west, DIRECTIONS.east],
  [DIRECTIONS.up, DIRECTIONS.down],
  [DIRECTIONS.down, DIRECTIONS.up],
])
export function getOppositeDirection(direction: Direction): Direction {
  return oppositeDirection.get(direction)!
}

export function getDirectionFromXZ(x: number, z: number) {
  if (x > 0) {
    return DIRECTIONS.west
  } else if (x < 0) {
    return DIRECTIONS.east
  } else if (z > 0) {
    return DIRECTIONS.north
  } else if (z < 0) {
    return DIRECTIONS.south
  }
  return undefined
}
