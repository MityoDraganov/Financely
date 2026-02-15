export const PAGE_SIZE_PRESETS = {
  A4: {
    mm: { width: 210, height: 297 },
    inches: { width: 8.27, height: 11.69 },
    points: { width: 595, height: 842 },
    px96: { width: 794, height: 1123 },
  },
  Letter: {
    mm: { width: 216, height: 279 },
    inches: { width: 8.5, height: 11 },
    points: { width: 612, height: 792 },
    px96: { width: 816, height: 1056 },
  },
  Legal: {
    mm: { width: 216, height: 356 },
    inches: { width: 8.5, height: 14 },
    points: { width: 612, height: 1008 },
    px96: { width: 816, height: 1344 },
  },
} as const;

export const PAGE_SIZES_PX = {
  A4: { w: PAGE_SIZE_PRESETS.A4.px96.width, h: PAGE_SIZE_PRESETS.A4.px96.height },
  Letter: { w: PAGE_SIZE_PRESETS.Letter.px96.width, h: PAGE_SIZE_PRESETS.Letter.px96.height },
  Legal: { w: PAGE_SIZE_PRESETS.Legal.px96.width, h: PAGE_SIZE_PRESETS.Legal.px96.height },
} as const;

export type StandardPageSize = keyof typeof PAGE_SIZES_PX;
