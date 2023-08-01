const MOUSE_SENSITIVITY_BASE = 0.005;
export const MOUSE_SENSITIVITY =
  MOUSE_SENSITIVITY_BASE / window.devicePixelRatio;

export const MOVEMENT = {
  air: {
    acceleration: 45,
    damping: 0.03,
  },
} as const;

export const PLAYER_COLLISION_POINTS_Y = [0, 1.7 / 2, 1.7];
export const PLAYER_COLLISION_POINTS_X = [-0.3, 0.3];
