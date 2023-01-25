import Chunk from '../scene/chunk'
import type { ChunkWorkerData, ChunkWorkerOutput } from '../scene/terrain'

onmessage = function (evt: MessageEvent<ChunkWorkerData>) {
  const {
    data: { type, chunks },
  } = evt

  chunks.forEach((chunk) => {
    chunk.__proto__ = Chunk.prototype
  })

  if (type === 'blocks') {
    chunks.forEach((chunk) => {
      chunk.generateBlocks()
      chunk.__proto__ = Object.prototype
    })
    const out: ChunkWorkerOutput = { finishedJob: 'blocks', chunks }
    postMessage(out)
  } else {
    chunks.forEach((chunk) => {
      chunk.generateMesh()
      chunk.__proto__ = Object.prototype
    })
    const out: ChunkWorkerOutput = { finishedJob: 'mesh', chunks }
    postMessage(out)
  }
}
