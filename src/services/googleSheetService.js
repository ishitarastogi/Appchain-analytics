// /src/services/googleSheetService.js
import axios from "axios";

// Fetch Google Sheets Data
export const fetchGoogleSheetData = async () => {
  const GOOGLE_SHEET_URL =
    "https://sheets.googleapis.com/v4/spreadsheets/1z-wz6qNOb2Zs7d3xnPjhl004YhIuov-ecd60JzffaNM/values/Sheet1!A2:Z1000?key=AIzaSyAG8hFaegrHjZ5Wn8D7XmCAh8ydDnuH4WI";

  try {
    const response = await axios.get(GOOGLE_SHEET_URL);
    const rows = response.data.values;

    return rows.map((row) => ({
      name: row[0], // Column A: Name
      blockScoutUrl: row[1], // Column B: Blockscout URL
      id: row[2], // Column C: ID
      website: row[3], // Column D: Website
      raas: row[4], // Column E: RaaS
      year: row[5], // Column F: Year
      quarter: row[6], // Column G: Quarter
      month: row[7], // Column H: Month
      launchDate: row[8], // Column I: Launch date
      vertical: row[9], // Column J: Vertical
      framework: row[10], // Column K: Framework
      da: row[11], // Column L: Data Availability (DA)
      l2OrL3: row[12], // Column M: L2/L3
      settlementWhenL3: row[13], // Column N: Settlement when L3
    }));
  } catch (error) {
    console.error("Error fetching Google Sheets data:", error);
    throw error;
  }
};

// Fetch Block Explorer Data for a single chain (transactions and active accounts)
// /src/services/googleSheetService.js
// /src/services/googleSheetService.js

export const fetchBlockExplorerData = async (blockScoutUrl, launchDate) => {
  const currentDate = new Date().toISOString().split("T")[0];
  const transactionsApiUrl = `${blockScoutUrl.replace(
    /\/$/,
    ""
  )}/api/v1/lines/newTxns?from=${launchDate}&to=${currentDate}`;
  const activeAccountsApiUrl = `${blockScoutUrl.replace(
    /\/$/,
    ""
  )}/api/v1/lines/activeAccounts?from=${launchDate}&to=${currentDate}`;

  try {
    // Call the Vercel proxy for the transactions API
    const transactionsResponse = await axios.get(
      `/api/blockExplorer?url=${encodeURIComponent(transactionsApiUrl)}`
    );

    // Call the Vercel proxy for the active accounts API
    const activeAccountsResponse = await axios.get(
      `/api/blockExplorer?url=${encodeURIComponent(activeAccountsApiUrl)}`
    );

    return {
      transactions: transactionsResponse.data.chart.map((item) => ({
        date: item.date,
        value: item.value,
      })),
      activeAccounts: activeAccountsResponse.data.chart.map((item) => ({
        date: item.date,
        value: item.value,
      })),
    };
  } catch (error) {
    console.error("Error fetching block explorer data:", error.message);
    throw error;
  }
};
