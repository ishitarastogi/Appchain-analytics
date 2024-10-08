// // src/utils/numberFormatter.js

// export const abbreviateNumber = (number) => {
//   if (number >= 1.0e9) {
//     return (number / 1.0e9).toFixed(1) + "B";
//   }
//   if (number >= 1.0e6) {
//     return (number / 1.0e6).toFixed(1) + "M";
//   }
//   if (number >= 1.0e3) {
//     return (number / 1.0e3).toFixed(1) + "K";
//   }
//   return number.toString();
// };

// src/utils/numberFormatter.js

export const abbreviateNumber = (num) => {
  if (num >= 1e9) {
    return (num / 1e9).toFixed(2) + "B";
  } else if (num >= 1e6) {
    return (num / 1e6).toFixed(2) + "M";
  } else if (num >= 1e3) {
    return (num / 1e3).toFixed(2) + "K";
  } else {
    return num.toString();
  }
};

export const formatNumber = (num, digits) => {
  const lookup = [
    { value: 1e9, symbol: "B" },
    { value: 1e6, symbol: "M" },
    { value: 1e3, symbol: "K" },
  ];
  for (let i = 0; i < lookup.length; i++) {
    if (num >= lookup[i].value) {
      return (num / lookup[i].value).toFixed(digits) + lookup[i].symbol;
    }
  }
  return num.toString();
};
