import './style/globals.css'
import * as THREE from 'three'
import Terrain from './scene/terrain'
import Chunk from './scene/chunk'

const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!
const WIDTH = 800
const HEIGHT = 600

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(67.5, WIDTH / HEIGHT, 0.1, 1000)
const renderer = new THREE.WebGLRenderer({ canvas })
renderer.setSize(WIDTH, HEIGHT)
renderer.setPixelRatio(window.devicePixelRatio)

const terrain = new Terrain()
const distance = Chunk.WIDTH * 10
terrain.generateChunks(-distance, -distance, distance, distance)
terrain.updateVisibleChunks(0, 0, distance)
scene.add(terrain.group)

camera.position.set(0, 90, 0)
camera.lookAt(0, 80, 50)

let dt = 0
let elapsedTime = 0
let lastFrame: number = new Date().getTime()

function animate() {
  const currentTime = new Date().getTime()
  dt = Math.min(currentTime - lastFrame, 15)
  elapsedTime += dt
  lastFrame = currentTime

  // update logic
  // TODO: use elapsedTime and dt to update player movement
  camera.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), dt * 0.0003)

  requestAnimationFrame(animate)
  renderer.render(scene, camera)
}

animate()
