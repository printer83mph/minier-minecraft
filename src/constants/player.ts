import { Vector3 } from 'three';

const MOUSE_SENSITIVITY_BASE = 0.005;
export const MOUSE_SENSITIVITY =
  MOUSE_SENSITIVITY_BASE / window.devicePixelRatio;

export const MOVEMENT = {
  flying: {
    acceleration: 45,
    damping: new Vector3(0.03, 0.03, 0.03),
  },
  walking: {
    grounded: {
      acceleration: 54,
      damping: new Vector3(0.000015, 0.95, 0.000015),
    },
    midair: {
      acceleration: 10,
      damping: new Vector3(0.1, 0.95, 0.1),
    },
    jumpVelocity: 6.7,
  },
} as const;

export const GRAVITY = new Vector3(0, -19.6, 0);

export const PLAYER_COLLISION_POINTS_Y = [0, 1.8 / 2, 1.8];
export const PLAYER_COLLISION_POINTS_XZ = [-0.4, 0.4];

export const PLAYER_COLLISION_BUMP_BIAS = 0.00001;
