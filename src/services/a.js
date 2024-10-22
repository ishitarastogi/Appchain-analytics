// src/services/googleSheetService.js

import axios from "axios";
import moment from "moment";

// Fetch Google Sheets Data
export const fetchGoogleSheetData = async () => {
  const GOOGLE_SHEET_URL = `https://sheets.googleapis.com/v4/spreadsheets/1z-wz6qNOb2Zs7d3xnPjhl004YhIuov-ecd60JzffaNM/values/Sheet1!A2:Z1000?key=${process.env.REACT_APP_GOOGLE_SHEETS_API_KEY}`;

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
      logoUrl: row[15], // Column O: Logo URL
      status: row[16], // Column P: Status
    }));
  } catch (error) {
    console.error("Error fetching Google Sheets data:", error);
    throw error;
  }
};

// Fetch Block Explorer Data for a single chain (transactions)
export const fetchBlockExplorerData = async (blockScoutUrl, launchDate) => {
  const normalizedUrl = blockScoutUrl.replace(/\/+$/, "");
  const formattedLaunchDate = moment(new Date(launchDate)).format("YYYY-MM-DD");
  const currentDate = moment().format("YYYY-MM-DD");

  const transactionsApiUrl = encodeURIComponent(
    `${normalizedUrl}/api/v1/lines/newTxns?from=${formattedLaunchDate}&to=${currentDate}`
  );

  const isDevelopment =
    !process.env.NODE_ENV || process.env.NODE_ENV === "development";
  const proxyBaseUrl = isDevelopment
    ? "http://localhost:3000/api/proxy?url="
    : "/api/proxy?url=";

  try {
    const transactionsResponse = await axios.get(
      `${proxyBaseUrl}${transactionsApiUrl}`
    );

    return {
      transactions: transactionsResponse.data.chart.map((item) => ({
        date: item.date,
        value: parseInt(item.value, 10),
      })),
    };
  } catch (error) {
    console.error(
      `Error fetching block explorer data for ${normalizedUrl}:`,
      error.message
    );
    throw error;
  }
};

// Fetch transactions across all chains in parallel
export const fetchAllTransaction = async (sheetData) => {
  let totalTransactionsCombined = 0;
  const transactionsByChainDate = {};

  const processTransactionData = (transactions, chainName) => {
    transactions.forEach(({ date, value }) => {
      const parsedValue = parseInt(value, 10);

      // Aggregate by chain and date
      if (!transactionsByChainDate[chainName]) {
        transactionsByChainDate[chainName] = {};
      }
      if (!transactionsByChainDate[chainName][date]) {
        transactionsByChainDate[chainName][date] = 0;
      }
      transactionsByChainDate[chainName][date] += parsedValue;

      totalTransactionsCombined += parsedValue;
    });
  };

  // Fetch all transactions in parallel using Promise.all
  await Promise.all(
    sheetData.map(async (chain) => {
      const { blockScoutUrl, launchDate, name } = chain;
      try {
        const { transactions } = await fetchBlockExplorerData(
          blockScoutUrl,
          launchDate
        );
        processTransactionData(transactions, name);
      } catch (error) {
        console.error(`Error fetching transactions for ${name}:`, error);
      }
    })
  );

  return {
    transactionsByChainDate, // Return the new data
    totalTransactionsCombined,
  };
};
