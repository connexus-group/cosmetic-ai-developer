/** Categorical chart slots (validated data-viz palette, light mode). Max 3 series in scatter/bubble/radar. */
export const SERIES = ['#2f6fa8', '#8a2f4c', '#b9802a'] as const;
/** Primary accent (wine): the one highlighted mark in a chart. */
export const ACCENT = '#7d354b';
/** Secondary accent (dusty rose): estimates and secondary highlights. */
export const CHAMPAGNE = '#c79ca4';
export const MUTED = '#d6d0c8';
export const GRID = '#ede8e2';
export const AXIS = '#6f685f';
/** Status colours — always shipped with a text label. */
export const STATUS = { good: '#4f7d5c', warn: '#b7791f', bad: '#a8423f' } as const;
