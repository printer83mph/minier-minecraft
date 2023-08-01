import * as THREE from 'three'
import { MathUtils, Vector3 } from 'three'

import InputListener from '@/lib/input'
import { sqrtTwo } from '@/lib/math'
import Chunk from './chunk'
import { RENDER_DISTANCE } from '@/constants/engine'
import { MOUSE_SENSITIVITY, MOVEMENT } from '@/constants/player'

/**  `[x, z, distance]` */
const CHUNK_PATTERN = (() => {
  const out: [number, number, number][] = []
  for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
    const zLength = Math.ceil(Math.sqrt(RENDER_DISTANCE * RENDER_DISTANCE - dx * dx))
    for (let dz = -zLength; dz <= zLength; dz++) {
      out.push([dx, dz, dx * dx + dz * dz])
    }
  }
  out.sort(([, , a], [, , b]) => a - b)
  return out
})()

export default class Player extends THREE.Object3D {
  camera: THREE.Camera
  input: InputListener

  velocity = new Vector3()
  pitch = 0
  yaw = 0

  lastChunk: [number, number] = [0, 0]

  static current: Player

  constructor(input: InputListener, camera: THREE.Camera) {
    super()
    Player.current = this

    this.input = input
    this.camera = camera

    this.add(camera)
    camera.position.set(0, 1.75, 0)

    input.addMouseMoveListener((dx, dy) => {
      this.yaw = (this.yaw - MOUSE_SENSITIVITY * dx) % (Math.PI * 2)
      this.pitch = MathUtils.clamp(this.pitch - MOUSE_SENSITIVITY * dy, -Math.PI / 2, Math.PI / 2)
    })
  }

  update(dt: number) {
    // TODO: collisions and such
    const { forward, right, up } = getMovementInput(this.input)
    updateMovement(this, { forward, right, up }, dt)

    // update camera rotation from rotation
    this.camera.setRotationFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'))

    const [lastX, lastZ] = this.lastChunk
    const [newX, newZ] = this.getChunkCoords()

    let chunksIn: [number, number][] = []
    let chunksOut: [number, number][] = []

    if (newX !== lastX || newZ !== lastZ) {
      const newChunks = new Map<string, [number, number]>()

      // TODO: we can optimize this
      CHUNK_PATTERN.forEach(([dx, dz]) => {
        const [x, z] = [newX + Chunk.WIDTH * dx, newZ + Chunk.WIDTH * dz]
        newChunks.set(`${x},${z}`, [x, z])
      })

      CHUNK_PATTERN.forEach(([dx, dz]) => {
        const [x, z] = [lastX + Chunk.WIDTH * dx, lastZ + Chunk.WIDTH * dz]
        if (!newChunks.has(`${x},${z}`)) {
          chunksOut.push([x, z])
        }
        newChunks.delete(`${x},${z}`)
      })

      chunksIn.push(...newChunks.values())

      this.lastChunk = [newX, newZ]
    }

    return { chunksIn, chunksOut }
  }

  getChunkCoords() {
    return [
      Math.floor(this.position.x / Chunk.WIDTH) * Chunk.WIDTH,
      Math.floor(this.position.z / Chunk.WIDTH) * Chunk.WIDTH,
    ]
  }

  isChunkInViewDistance([x, z]: [x: number, z: number]) {
    const [playerX, playerZ] = this.getChunkCoords()
    const [relativeX, relativeZ] = [x - playerX, z - playerZ]

    for (const [patternX, patternZ] of CHUNK_PATTERN) {
      const [absPatternX, absPatternZ] = [patternX * Chunk.WIDTH, patternZ * Chunk.WIDTH]

      if (absPatternX === relativeX && absPatternZ === relativeZ) {
        return true
      }
    }

    return false
  }
}

function getMovementInput(input: InputListener) {
  let [forward, right, up] = [
    (input.isKeyDown('W') ? 1 : 0) + (input.isKeyDown('S') ? -1 : 0),
    (input.isKeyDown('D') ? 1 : 0) + (input.isKeyDown('A') ? -1 : 0),
    (input.isKeyDown(' ') ? 1 : 0) + (input.isKeyDown('SHIFT') ? -1 : 0),
  ]

  if (Math.abs(forward) + Math.abs(right) > 1) {
    forward *= sqrtTwo / 2
    right *= sqrtTwo / 2
  }

  return { forward, right, up }
}

function updateMovement(
  player: Player,
  { forward, right, up }: ReturnType<typeof getMovementInput>,
  dt: number
) {
  const desiredForward = new Vector3().setFromCylindrical(
    new THREE.Cylindrical(forward, player.yaw + Math.PI, 0)
  )
  const desiredUp = new Vector3(0, up, 0)
  const desiredTotal = new Vector3()
    .setFromCylindrical(new THREE.Cylindrical(right, player.yaw + Math.PI / 2, 0))
    .add(desiredForward)
    .add(desiredUp)

  player.velocity.add(desiredTotal.multiplyScalar(MOVEMENT.air.acceleration * dt))

  // fancy damping
  // player.velocity.multiplyScalar(getDampCoefficient(player.velocity.length(), MOVEMENT.air.k, dt))
  player.velocity.multiplyScalar(Math.pow(MOVEMENT.air.damping, dt))

  player.position.add(new Vector3().copy(player.velocity).multiplyScalar(dt))
}
