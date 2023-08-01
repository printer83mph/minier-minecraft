const MOUSE_SENSITIVITY_BASE = 0.005;
export const MOUSE_SENSITIVITY =
  MOUSE_SENSITIVITY_BASE / window.devicePixelRatio;

export const MOVEMENT = {
  air: {
    acceleration: 45,
    damping: 0.03,
  },
} as const;
