import { Vector3 } from 'three';

export function modPositive(a: number, b: number) {
  return ((a % b) + b) % b;
}

export const sqrtTwo = Math.sqrt(2);

export function getDampCoefficient(magnitude: number, k: number, dt: number) {
  return 1 / (1 - k * dt * magnitude);
}

export function moveTowardsVector3(
  source: Vector3,
  target: Vector3,
  maxDelta: number,
  setA = false
) {
  let result: Vector3;
  const difference = new Vector3().subVectors(target, source);

  const distanceSq = difference.lengthSq();
  if (maxDelta > distanceSq || distanceSq === 0) {
    result = difference.copy(target);
  } else {
    difference.normalize().multiplyScalar(maxDelta);
    result = difference.add(source);
  }

  if (setA) {
    source.copy(result);
    return source;
  }

  return result;
}
