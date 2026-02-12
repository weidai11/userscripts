/**
 * Color utilities for Power Reader
 * Replaces jQuery color-utils plugin from old implementation
 */

/**
 * Parse a hex color string to RGB array
 */
export function hexToRgb(hex: string): [number, number, number] {
  // Remove # if present
  hex = hex.replace(/^#/, '');
  
  // Handle shorthand (#FFF)
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  
  const num = parseInt(hex, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Convert RGB array to hex string
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Interpolate between two colors based on weights
 * Replaces AverageColors from old implementation
 * 
 * @param color1 - First color (hex string)
 * @param color2 - Second color (hex string)
 * @param weight1 - Weight for first color
 * @param weight2 - Weight for second color
 * @returns Interpolated color as hex string
 */
export function interpolateColors(
  color1: string,
  color2: string,
  weight1: number,
  weight2: number
): string {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  const total = weight1 + weight2;
  
  if (total === 0) return color1;
  
  const r = Math.round((weight1 * c1[0] + weight2 * c2[0]) / total);
  const g = Math.round((weight1 * c1[1] + weight2 * c2[1]) / total);
  const b = Math.round((weight1 * c1[2] + weight2 * c2[2]) / total);
  
  return rgbToHex(r, g, b);
}

/**
 * Get pink background color based on normalized score (0-1)
 * White (#FFFFFF) to Pink (#FFDDDD)
 */
export function getScoreColor(normalized: number): string {
  return interpolateColors('#FFFFFF', '#FFDDDD', 1 - normalized, normalized);
}

/**
 * Get purple background color based on normalized score (0-1)
 * Grey (#F0F0F0) to Purple (#E0D0FF)
 */
export function getPostScoreColor(normalized: number): string {
  return interpolateColors('#F0F0F0', '#E0D0FF', 1 - normalized, normalized);
}

/**
 * Get yellow background color based on recency order
 * White (#FFFFFE) to Yellow (#FFFFE0)
 */
export function getRecencyColor(order: number, maxOrder: number): string {
  if (order <= 0 || order > maxOrder) return '';
  return interpolateColors('#FFFFFE', '#FFFFE0', order, maxOrder - order);
}
