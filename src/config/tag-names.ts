/** Shared by application and Vite config, keep independent of injected build globals */
export const TAG_NAMES_PROD = {
  card: 'easy-floorplan-3d-view',
  editor: 'easy-floorplan-3d-editor',
} as const;

export const TAG_NAMES_DEV = {
  card: `${TAG_NAMES_PROD.card}-dev`,
  editor: `${TAG_NAMES_PROD.editor}-dev`,
} as const;
