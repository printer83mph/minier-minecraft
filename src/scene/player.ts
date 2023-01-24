import * as THREE from 'three'
import { MathUtils, Vector3 } from 'three'
import InputListener from '../lib/input'
import Terrain from './terrain'

const MOUSE_SENSITIVITY = 0.01
const sensitivity = MOUSE_SENSITIVITY / window.devicePixelRatio

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

    camera.position.set(0, 1.75, 0)

    input.addMouseMoveListener((dx, dy) => {
      this.yaw = (this.yaw - sensitivity * dx) % (Math.PI * 2)
      this.pitch = MathUtils.clamp(this.pitch - sensitivity * dy, -Math.PI / 2, Math.PI / 2)
    })
  }

  update(dt: number, terrain: Terrain) {
    this.camera.setRotationFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'))
    this.position.add(this.velocity)
  }
}
