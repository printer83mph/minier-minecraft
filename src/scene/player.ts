import * as THREE from 'three'
import { MathUtils, Vector3 } from 'three'

import InputListener from '../lib/input'
import { sqrtTwo } from '../lib/math'
import Chunk from './chunk'
import Terrain from './terrain'

const MOUSE_SENSITIVITY = 0.005
const sensitivity = MOUSE_SENSITIVITY / window.devicePixelRatio

const MOVEMENT = {
  air: {
    acceleration: 45,
    damping: 0.03,
  },
} as const

// TODO: separate block generation, mesh generation, and draw distance
export const RENDER_DISTANCE = 12

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

  constructor(input: InputListener, camera: THREE.Camera) {
    super()
    this.input = input
    this.camera = camera

    this.add(camera)
    camera.position.set(0, 1.75, 0)

    input.addMouseMoveListener((dx, dy) => {
      this.yaw = (this.yaw - sensitivity * dx) % (Math.PI * 2)
      this.pitch = MathUtils.clamp(this.pitch - sensitivity * dy, -Math.PI / 2, Math.PI / 2)
    })
  }

  update(dt: number, terrain: Terrain) {
    // TODO: collisions and such

    let [forward, right, up] = [
      (this.input.isKeyDown('W') ? 1 : 0) + (this.input.isKeyDown('S') ? -1 : 0),
      (this.input.isKeyDown('D') ? 1 : 0) + (this.input.isKeyDown('A') ? -1 : 0),
      (this.input.isKeyDown(' ') ? 1 : 0) + (this.input.isKeyDown('SHIFT') ? -1 : 0),
    ]

    if (Math.abs(forward) + Math.abs(right) > 1) {
      forward *= sqrtTwo / 2
      right *= sqrtTwo / 2
    }

    const desiredForward = new Vector3().setFromCylindrical(
      new THREE.Cylindrical(forward, this.yaw + Math.PI, 0)
    )
    const desiredUp = new Vector3(0, up, 0)
    const desiredTotal = new Vector3()
      .setFromCylindrical(new THREE.Cylindrical(right, this.yaw + Math.PI / 2, 0))
      .add(desiredForward)
      .add(desiredUp)
    this.velocity.add(desiredTotal.multiplyScalar(MOVEMENT.air.acceleration * dt))

    // fancy damping
    // this.velocity.multiplyScalar(getDampCoefficient(this.velocity.length(), MOVEMENT.air.k, dt))
    this.velocity.multiplyScalar(Math.pow(MOVEMENT.air.damping, dt))

    this.position.add(new Vector3().copy(this.velocity).multiplyScalar(dt))
    this.camera.setRotationFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'))

    const [lastX, lastZ] = this.lastChunk
    const [newX, newZ]: [number, number] = [
      Math.floor(this.position.x / Chunk.WIDTH) * Chunk.WIDTH,
      Math.floor(this.position.z / Chunk.WIDTH) * Chunk.WIDTH,
    ]

    let chunksIn: [number, number][] = []
    let chunksOut: [number, number][] = []

    if (newX !== lastX || newZ !== lastZ) {
      const newChunks = new Map<string, [number, number]>()

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
}
