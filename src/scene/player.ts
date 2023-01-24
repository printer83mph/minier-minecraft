import * as THREE from 'three'
import { MathUtils, Vector3 } from 'three'
import InputListener from '../lib/input'
import { sqrtTwo } from '../lib/math'
import Terrain from './terrain'

const MOUSE_SENSITIVITY = 0.005
const sensitivity = MOUSE_SENSITIVITY / window.devicePixelRatio

const MOVEMENT = {
  air: {
    acceleration: 45,
    damping: 0.03,
  },
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
  }
}
