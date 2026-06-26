export const CIRCUIT_STEP_EVENTS = {
  ACTIVATED: "circuit-step.activated",
  HOVERED: "circuit-step.hovered",
} as const;

export const OPERATION_EVENTS = {
  GRABBED: "operation.grabbed",
  SNAPPED: "operation.snapped",
  DISCARDED: "operation.discarded",
  MOUSE_LEFT: "operation.mouse-left",
} as const;

export const FRAME_DIVIDER_EVENTS = {
  DRAG_STARTED: "frame-divider.drag-started",
} as const;
