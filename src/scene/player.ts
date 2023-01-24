import * as THREE from 'three'
import { MathUtils, Vector3 } from 'three'
import InputListener from '../lib/input'
import { sqrtTwo } from '../lib/math'
import Terrain from './terrain'

const MOUSE_SENSITIVITY = 0.01
const sensitivity = MOUSE_SENSITIVITY / window.devicePixelRatio

const MOVEMENT = {
  acceleration: 1,
  k: -120,
} as const

export default class Player extends THREE.Object3D {
  camera: THREE.Camera
  input: InputListener

  velocity = new Vector3()
  pitch = 0
  yaw = 0

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
      (this.input.isKeyDown('w') ? 1 : 0) + (this.input.isKeyDown('s') ? -1 : 0),
      (this.input.isKeyDown('d') ? 1 : 0) + (this.input.isKeyDown('a') ? -1 : 0),
      (this.input.isKeyDown(' ') ? 1 : 0) + (this.input.isKeyDown('Shift') ? -1 : 0),
    ]

    if (Math.abs(forward) + Math.abs(right) > 1) {
      forward *= sqrtTwo / 2
      right *= sqrtTwo / 2
    }

    const forwardAcceleration = new Vector3().setFromCylindrical(
      new THREE.Cylindrical(forward, this.yaw + Math.PI, 0)
    )
    const upAcceleration = new Vector3(0, up, 0)
    const totalAcceleration = new Vector3()
      .setFromCylindrical(new THREE.Cylindrical(right, this.yaw + Math.PI / 2, 0))
      .add(forwardAcceleration)
      .add(upAcceleration)
    this.velocity.add(totalAcceleration.multiplyScalar(MOVEMENT.acceleration * dt))

    // add damp
    const dampFactor = 1 - MOVEMENT.k * dt * this.velocity.length()
    this.velocity.divideScalar(dampFactor)

    this.position.add(this.velocity)
    this.camera.setRotationFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'))
  }
}
