/* eslint-disable @typescript-eslint/no-unsafe-call */
import fastRaycast from 'fast-voxel-raycast';

export default function raycast<TReturn = unknown>(
  getVoxel: (x: number, y: number, z: number) => TReturn,
  start: [number, number, number],
  direction: [number, number, number],
  distance: number
) {
  const hitPos: [number, number, number] = [0, 0, 0];
  const hitNormal: [number, number, number] = [0, 0, 0];
  const hit = fastRaycast(
    getVoxel,
    start,
    direction,
    distance,
    hitPos,
    hitNormal
  ) as TReturn | 0;

  if (hit) {
    return { hit, hitPos, hitNormal };
  }

  return { hit: false as const };
}
