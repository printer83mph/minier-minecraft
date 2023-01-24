import './style/globals.css'
import * as THREE from 'three'
import Terrain from './scene/terrain'
import Chunk from './scene/chunk'

const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!
const WIDTH = 800
const HEIGHT = 600

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(67.5, WIDTH / HEIGHT, 0.1, 1000)
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setSize(WIDTH, HEIGHT)
renderer.setPixelRatio(window.devicePixelRatio)

const terrain = new Terrain()
const distance = Chunk.WIDTH * 8
terrain.generateChunks(-distance, -distance, distance, distance)
terrain.updateVisibleChunks(0, 0, distance)
scene.add(terrain.group)

const sun = new THREE.DirectionalLight(new THREE.Color(1, 1, 0.75), 0.8)
sun.position.set(-0.4, 1, 0.25)
sun.target = scene
const ambient = new THREE.AmbientLight(new THREE.Color(0.75, 0.75, 1), 0.4)
scene.add(sun)
scene.add(ambient)

camera.position.set(0, 90, 0)
camera.lookAt(0, 70, 50)

let dt = 0
let elapsedTime = 0
let lastFrame: number = new Date().getTime()

function animate() {
  const currentTime = new Date().getTime()
  dt = Math.min(currentTime - lastFrame, 15)
  elapsedTime += dt
  lastFrame = currentTime

  // update logic
  // TODO: use elapsedTime and dt to do player movement
  camera.position.add(
    new THREE.Vector3(Math.sin(camera.rotation.y), 0, Math.cos(camera.rotation.z)).multiplyScalar(
      -12
    )
  )
  camera.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), dt * 0.0002)
  camera.position.sub(
    new THREE.Vector3(Math.sin(camera.rotation.y), 0, Math.cos(camera.rotation.z)).multiplyScalar(
      -12
    )
  )

  requestAnimationFrame(animate)
  renderer.render(scene, camera)
}

animate()
