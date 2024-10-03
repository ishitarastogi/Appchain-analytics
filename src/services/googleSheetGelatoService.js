// googleSheetGelatoService.js

import axios from "axios";

// Fetch Google Sheets Data specifically for Gelato chains
export const fetchGelatoSheetData = async () => {
  const GOOGLE_SHEET_URL = `https://sheets.googleapis.com/v4/spreadsheets/1z-wz6qNOb2Zs7d3xnPjhl004YhIuov-ecd60JzffaNM/values/Sheet1!A2:Z1000?key=${process.env.REACT_APP_GOOGLE_SHEETS_API_KEY}`;

  try {
    const response = await axios.get(GOOGLE_SHEET_URL);
    const rows = response.data.values;

    return rows
      .map((row) => ({
        name: row[0],
        blockScoutUrl: row[1],
        raas: row[4],
        launchDate: row[8],
      }))
      .filter((chain) => chain.raas.toLowerCase() === "gelato");
  } catch (error) {
    console.error("Error fetching Google Sheets Gelato data:", error);
    throw error;
  }
};
