// TODO: separate block generation, mesh generation, and draw distance
export const RENDER_DISTANCE = 12;

export const GENERATION_TIME_TO_FRAME_RATIO = 0.7;
export const HALF_GENERATION_TIME_TO_FRAME_RATIO =
  GENERATION_TIME_TO_FRAME_RATIO / 2;

// delta time tracking...
const dtTracker = { averageDT: 16 };

/**
 * @returns Sort of averaged delta time in seconds
 */
export function getAverageDT() {
  return dtTracker.averageDT;
}

/**
 * @param dt Latest delta time in seconds
 */
export function updateAverageDT(dt: number) {
  dtTracker.averageDT = (dtTracker.averageDT + dt) / 2;
}
