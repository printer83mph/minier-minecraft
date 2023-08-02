import * as THREE from 'three';
import { MathUtils, Vector3 } from 'three';

import Terrain from './terrain';

import { RENDER_DISTANCE } from '@/constants/engine';
import {
  GRAVITY,
  MOUSE_SENSITIVITY,
  MOVEMENT,
  PLAYER_COLLISION_POINTS_X,
  PLAYER_COLLISION_POINTS_Y,
} from '@/constants/player';
import { CHUNK_WIDTH } from '@/constants/world';
import InputListener from '@/lib/input';
import { sqrtTwo } from '@/lib/math';

/**  `[x, z, square distance]` */
const CHUNK_PATTERN = (() => {
  const out: [number, number, number][] = [];
  for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
    const zLength = Math.ceil(
      Math.sqrt(RENDER_DISTANCE * RENDER_DISTANCE - dx * dx)
    );
    for (let dz = -zLength; dz <= zLength; dz++) {
      out.push([dx, dz, dx * dx + dz * dz]);
    }
  }
  out.sort(([, , a], [, , b]) => a - b);
  return out;
})();

export default class Player extends THREE.Object3D {
  static current?: Player;

  camera: THREE.Camera;
  input: InputListener;

  movement: 'walking' | 'flying' = 'walking';
  grounded = false;

  velocity = new Vector3();
  pitch = 0;
  yaw = 0;

  lastChunk: [number, number] = [0, 0];

  constructor(input: InputListener, camera: THREE.Camera) {
    super();
    Player.current = this;

    this.input = input;
    this.camera = camera;

    this.add(camera);
    camera.position.set(0, 1.75, 0);

    input.addMouseMoveListener((dx, dy) => {
      this.yaw = (this.yaw - MOUSE_SENSITIVITY * dx) % (Math.PI * 2);
      this.pitch = MathUtils.clamp(
        this.pitch - MOUSE_SENSITIVITY * dy,
        -Math.PI / 2,
        Math.PI / 2
      );
    });

    input.addKeyListener('f', 'onKeyPress', () => {
      this.movement = this.movement === 'flying' ? 'walking' : 'flying';
    });
  }

  update(dt: number) {
    updateVelocity(this, getMovementInput(this.input), dt);
    applyVelocityWithCollision(this, dt);

    // update camera rotation from rotation
    this.camera.setRotationFromEuler(
      new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ')
    );

    const [lastX, lastZ] = this.lastChunk;
    const [newX, newZ] = this.getChunkCoords();

    const chunksIn: [number, number][] = [];
    const chunksOut: [number, number][] = [];

    if (newX !== lastX || newZ !== lastZ) {
      const newChunks = new Map<string, [number, number]>();

      // TODO: we can optimize this
      CHUNK_PATTERN.forEach(([dx, dz]) => {
        const [x, z] = [newX + CHUNK_WIDTH * dx, newZ + CHUNK_WIDTH * dz];
        newChunks.set(`${x},${z}`, [x, z]);
      });

      CHUNK_PATTERN.forEach(([dx, dz]) => {
        const [x, z] = [lastX + CHUNK_WIDTH * dx, lastZ + CHUNK_WIDTH * dz];
        if (!newChunks.has(`${x},${z}`)) {
          chunksOut.push([x, z]);
        }
        newChunks.delete(`${x},${z}`);
      });

      chunksIn.push(...newChunks.values());

      this.lastChunk = [newX, newZ];
    }

    return { chunksIn, chunksOut };
  }

  getChunkCoords() {
    return [
      Math.floor(this.position.x / CHUNK_WIDTH) * CHUNK_WIDTH,
      Math.floor(this.position.z / CHUNK_WIDTH) * CHUNK_WIDTH,
    ];
  }

  isChunkInViewDistance([x, z]: [x: number, z: number]) {
    const [playerX, playerZ] = this.getChunkCoords();
    const [relativeX, relativeZ] = [x - playerX, z - playerZ];

    for (const [patternX, patternZ] of CHUNK_PATTERN) {
      const [absPatternX, absPatternZ] = [
        patternX * CHUNK_WIDTH,
        patternZ * CHUNK_WIDTH,
      ];

      if (absPatternX === relativeX && absPatternZ === relativeZ) {
        return true;
      }
    }

    return false;
  }
}

function getMovementInput(input: InputListener) {
  let [forward, right] = [
    (input.isKeyDown('W') ? 1 : 0) + (input.isKeyDown('S') ? -1 : 0),
    (input.isKeyDown('D') ? 1 : 0) + (input.isKeyDown('A') ? -1 : 0),
  ];

  if (Math.abs(forward) + Math.abs(right) > 1) {
    forward *= sqrtTwo / 2;
    right *= sqrtTwo / 2;
  }

  const up =
    (input.isKeyDown(' ') ? 1 : 0) + (input.isKeyDown('SHIFT') ? -1 : 0);

  const jump = input.isKeyDown(' ');

  return { forward, right, up, jump };
}

function updateVelocity(
  player: Player,
  { forward, right, up, jump }: ReturnType<typeof getMovementInput>,
  dt: number
) {
  const desiredForward = new Vector3().setFromCylindrical(
    new THREE.Cylindrical(forward, player.yaw + Math.PI, 0)
  );
  const desiredUp = new Vector3(0, up, 0);

  const velocityToAdd = new Vector3();
  const damping = new Vector3();

  switch (player.movement) {
    case 'flying': {
      velocityToAdd
        .setFromCylindrical(
          new THREE.Cylindrical(right, player.yaw + Math.PI / 2, 0)
        )
        .add(desiredForward)
        .add(desiredUp);
      velocityToAdd.multiplyScalar(MOVEMENT.flying.acceleration * dt);

      damping.copy(MOVEMENT.flying.damping);
      break;
    }
    case 'walking': {
      velocityToAdd
        .setFromCylindrical(
          new THREE.Cylindrical(right, player.yaw + Math.PI / 2, 0)
        )
        .add(desiredForward);
      velocityToAdd.multiplyScalar(
        MOVEMENT.walking[player.grounded ? 'grounded' : 'midair'].acceleration *
          dt
      );
      velocityToAdd.add(new Vector3().copy(GRAVITY).multiplyScalar(dt));

      if (player.grounded && jump) {
        velocityToAdd.setY(MOVEMENT.walking.jumpVelocity);
      }

      damping.copy(
        MOVEMENT.walking[player.grounded ? 'grounded' : 'midair'].damping
      );
      break;
    }
  }

  player.velocity.add(velocityToAdd);

  // fancy damping
  // player.velocity.multiplyScalar(getDampCoefficient(player.velocity.length(), MOVEMENT.air.k, dt))
  damping.fromArray(damping.toArray().map((value) => Math.pow(value, dt)));
  player.velocity.multiply(damping);
}

function applyVelocityWithCollision(player: Player, dt: number) {
  player.grounded = false;
  const maxMovementVector = new Vector3()
    .copy(player.velocity)
    .multiplyScalar(dt);

  if (!Terrain.current) {
    return;
  }

  while (maxMovementVector.lengthSq() > 0.00001) {
    const maxMovementLength = maxMovementVector.length();
    const movementDirection = new Vector3()
      .copy(maxMovementVector)
      .divideScalar(maxMovementLength);

    let minRaycast:
      | {
          sqDistance: number;
          distance: [number, number, number];
          normal: [number, number, number];
        }
      | undefined;

    PLAYER_COLLISION_POINTS_X.forEach((offsetX) => {
      PLAYER_COLLISION_POINTS_X.forEach((offsetZ) => {
        PLAYER_COLLISION_POINTS_Y.forEach((offsetY) => {
          const startingPoint = [
            player.position.x + offsetX,
            player.position.y + offsetY,
            player.position.z + offsetZ,
          ];
          const { hit, hitNormal, hitPos } = Terrain.current!.blockRaycast(
            startingPoint as [number, number, number],
            movementDirection.toArray(),
            maxMovementLength
          );

          // if we didn't hit we don't care
          if (!hit) {
            return;
          }

          const distance = hitPos.map(
            (coord, idx) => coord - startingPoint[idx]
          ) as [number, number, number];
          const [distX, distY, distZ] = distance;
          const sqDistance = Math.sqrt(
            distX * distX + distY * distY + distZ * distZ
          );

          // if our hit is longer than another we don't care
          if (minRaycast && sqDistance > minRaycast.sqDistance) {
            return;
          }

          // otherwise keep this minRaycast
          minRaycast = { sqDistance, distance, normal: hitNormal };

          /*
           * TODO: go as far as possible before hit (maybe with some negative bias)
           * then remove all velocity on the hit axis and keep going until
           * movement is all used up
           */
        });
      });
    });

    // if we did hit something:
    if (minRaycast) {
      // move as far as we can
      const stepMovement = new Vector3(...minRaycast.distance);
      maxMovementVector.sub(stepMovement);
      player.position.add(stepMovement);

      // bump out a bit from block using normal to not get stuck
      player.position.add(
        new Vector3(...minRaycast.normal).multiplyScalar(0.00001)
      );

      // clamp max movement to collision plane
      const planeClampFactor = new Vector3(
        ...minRaycast.normal.map((value) => 1 - Math.abs(value))
      );
      maxMovementVector.multiply(planeClampFactor);
      player.velocity.multiply(planeClampFactor);

      // set grounded if we are grounded
      if (minRaycast.normal[1] > 0.0001) {
        player.grounded = true;
      }
    } else {
      player.position.add(maxMovementVector);
      break;
    }
  }

  // after while loop
}
