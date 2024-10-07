// utils/colorGenerator.js

/**
 * Generates a consistent color based on a given string.
 * @param {string} str - The input string (e.g., chain name).
 * @returns {string} - A hexadecimal color code.
 */
export const getColorFromString = (str) => {
  const colorPalette = [
    "#FF6384",
    "#36A2EB",
    "#FFCE56",
    "#4BC0C0",
    "#9966FF",
    "#FF9F40",
    "#C9CBCF",
    "#E7E9ED",
    "#36A2EB",
    "#FF6384",
    "#FFCE56",
    "#4BC0C0",
    "#EC6731",
    "#FFA500",
    "#B28AFE",
    "#46BDC6",
    "#4185F4",
    "#B28AFE",
    "#FF3B57",
    "#4BC0C0",
  ];

  // Simple hash function to convert string to number
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Map hash to color palette
  const index = Math.abs(hash) % colorPalette.length;
  return colorPalette[index];
};
