import './style/globals.css'

import * as THREE from 'three'
import Terrain from './scene/terrain'
import Chunk from './scene/chunk'
import InputListener from './lib/input'
import Player from './scene/player'

export async function setup() {
  await Chunk.setup()
}

export function start() {
  const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!
  const WIDTH = 800
  const HEIGHT = 600

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(67.5, WIDTH / HEIGHT, 0.1, 1000)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setSize(WIDTH, HEIGHT)
  renderer.setPixelRatio(window.devicePixelRatio)

  const terrain = new Terrain()
  const viewDistance = Chunk.WIDTH * 8
  terrain.queueChunksInArea(-viewDistance, -viewDistance, viewDistance, viewDistance)
  scene.add(terrain)

  const input = new InputListener(canvas)
  const player = new Player(input, camera)
  player.position.set(0, 80, 0)
  scene.add(player)

  const sun = new THREE.DirectionalLight(new THREE.Color(1, 1, 0.75), 0.8)
  sun.position.set(-0.4, 1, 0.25)
  sun.target = scene
  const ambient = new THREE.AmbientLight(new THREE.Color(0.75, 0.75, 1), 0.4)
  scene.add(sun)
  scene.add(ambient)

  // dt and elapsedTime in seconds
  let dt = 0
  let elapsedTime = 0
  let lastFrame: number = new Date().getTime()

  function animate() {
    const currentTime = new Date().getTime()
    dt = Math.min((currentTime - lastFrame) * 0.001, 0.015)
    elapsedTime += dt
    lastFrame = currentTime

    player.update(dt, terrain)
    terrain.update()

    requestAnimationFrame(animate)
    renderer.render(scene, camera)
  }

  animate()
}

await setup()
start()
