import * as THREE from 'three';
import { MathUtils, Vector3 } from 'three';

import { RENDER_DISTANCE } from '@/constants/engine';
import {
  GRAVITY,
  MOUSE_SENSITIVITY,
  MOVEMENT,
  PLAYER_COLLISION_POINTS_X,
  PLAYER_COLLISION_POINTS_Y,
} from '@/constants/player';
import { CHUNK_WIDTH } from '@/constants/world';
import { BLOCKS } from '@/lib/blocks';
import type Engine from '@/lib/engine';
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

  private engine: Engine;

  public movement: 'walking' | 'flying' = 'walking';
  private grounded = false;

  private velocity = new Vector3();
  private pitch = 0;
  private yaw = 0;

  private lastChunk: [number, number] = [0, 0];

  public constructor(engine: Engine) {
    super();
    Player.current = this;

    this.engine = engine;
    const { camera, input } = engine;

    this.add(camera);
    camera.position.set(0, 1.62, 0);

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

    input.addMouseButtonListener(0, 'onMouseDown', () => {
      this.breakBlock();
    });
  }

  public update(dt: number) {
    this.updateVelocity(dt);
    this.applyVelocityWithCollision(dt);

    // update camera rotation from rotation
    this.engine.camera.setRotationFromEuler(
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

  public getChunkCoords() {
    return [
      Math.floor(this.position.x / CHUNK_WIDTH) * CHUNK_WIDTH,
      Math.floor(this.position.z / CHUNK_WIDTH) * CHUNK_WIDTH,
    ];
  }

  public isChunkInViewDistance([x, z]: [x: number, z: number]) {
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

  // --------- --------- --------- PRIVATE MOVEMENT --------- --------- ---------

  private getMovementInput() {
    const { input } = this.engine;

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

  private updateVelocity(dt: number) {
    const { forward, right, up, jump } = this.getMovementInput();

    const desiredForward = new Vector3().setFromCylindrical(
      new THREE.Cylindrical(forward, this.yaw + Math.PI, 0)
    );
    const desiredUp = new Vector3(0, up, 0);

    const velocityToAdd = new Vector3();
    const damping = new Vector3();

    switch (this.movement) {
      case 'flying': {
        velocityToAdd
          .setFromCylindrical(
            new THREE.Cylindrical(right, this.yaw + Math.PI / 2, 0)
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
            new THREE.Cylindrical(right, this.yaw + Math.PI / 2, 0)
          )
          .add(desiredForward);
        velocityToAdd.multiplyScalar(
          MOVEMENT.walking[this.grounded ? 'grounded' : 'midair'].acceleration *
            dt
        );
        velocityToAdd.add(new Vector3().copy(GRAVITY).multiplyScalar(dt));

        if (this.grounded && jump) {
          velocityToAdd.setY(MOVEMENT.walking.jumpVelocity);
        }

        damping.copy(
          MOVEMENT.walking[this.grounded ? 'grounded' : 'midair'].damping
        );
        break;
      }
    }

    this.velocity.add(velocityToAdd);

    // fancy damping
    // this.velocity.multiplyScalar(getDampCoefficient(this.velocity.length(), MOVEMENT.air.k, dt))
    damping.fromArray(damping.toArray().map((value) => Math.pow(value, dt)));
    this.velocity.multiply(damping);
  }

  private applyVelocityWithCollision(dt: number) {
    this.grounded = false;
    const maxMovementVector = new Vector3()
      .copy(this.velocity)
      .multiplyScalar(dt);

    if (!this.engine.terrain) {
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
              this.position.x + offsetX,
              this.position.y + offsetY,
              this.position.z + offsetZ,
            ];
            const { hit, hitNormal, hitPos } = this.engine.terrain.blockRaycast(
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
          });
        });
      });

      // if we did hit something:
      if (minRaycast) {
        // move as far as we can
        const stepMovement = new Vector3(...minRaycast.distance);
        maxMovementVector.sub(stepMovement);
        this.position.add(stepMovement);

        // bump out a bit from block using normal to not get stuck
        this.position.add(
          new Vector3(...minRaycast.normal).multiplyScalar(0.00001)
        );

        // clamp max movement to collision plane
        const planeClampFactor = new Vector3(
          ...minRaycast.normal.map((value) => 1 - Math.abs(value))
        );
        maxMovementVector.multiply(planeClampFactor);
        this.velocity.multiply(planeClampFactor);

        // set grounded if we are grounded
        if (minRaycast.normal[1] > 0.0001) {
          this.grounded = true;
        }
      } else {
        this.position.add(maxMovementVector);
        break;
      }
    }
  }

  // --------- --------- --------- PRIVATE WORLD INTERACTION --------- --------- ---------

  private breakBlock() {
    const { terrain, camera } = this.engine;

    const forwardVector = new Vector3(0, 0, -1).applyEuler(camera.rotation);
    const { hit, hitPos, hitNormal } = terrain.blockRaycast(
      camera.getWorldPosition(new Vector3()).toArray(),
      forwardVector.toArray(),
      4.5
    );

    if (!hit) {
      return;
    }

    terrain.setBlock(
      new Vector3()
        .fromArray(hitPos)
        .sub(new Vector3().fromArray(hitNormal).multiplyScalar(0.5))
        .floor()
        .toArray(),
      BLOCKS.air
    );
  }
}
