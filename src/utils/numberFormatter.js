// src/utils/numberFormatter.js

export const abbreviateNumber = (number) => {
  if (number >= 1.0e9) {
    return (number / 1.0e9).toFixed(1) + "B";
  }
  if (number >= 1.0e6) {
    return (number / 1.0e6).toFixed(1) + "M";
  }
  if (number >= 1.0e3) {
    return (number / 1.0e3).toFixed(1) + "K";
  }
  return number.toString();
};
