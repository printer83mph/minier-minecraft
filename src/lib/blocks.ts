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
