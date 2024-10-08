// googleSheetService.js

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
      logo: row[14], // Column O: Logo (if present)
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

// Fetch Active Accounts Data for a single chain
export const fetchActiveAccountsData = async (blockScoutUrl, launchDate) => {
  const normalizedUrl = blockScoutUrl.replace(/\/+$/, "");
  const formattedLaunchDate = moment(new Date(launchDate)).format("YYYY-MM-DD");
  const currentDate = moment().format("YYYY-MM-DD");

  const activeAccountsApiUrl = encodeURIComponent(
    `${normalizedUrl}/api/v1/lines/activeAccounts?from=${formattedLaunchDate}&to=${currentDate}&resolution=DAY`
  );

  const isDevelopment =
    !process.env.NODE_ENV || process.env.NODE_ENV === "development";
  const proxyBaseUrl = isDevelopment
    ? "http://localhost:3000/api/proxy?url="
    : "/api/proxy?url=";

  try {
    const response = await axios.get(`${proxyBaseUrl}${activeAccountsApiUrl}`);

    // Check if the chart is available
    if (!response.data.chart || !Array.isArray(response.data.chart)) {
      console.warn(`No active accounts data available for ${normalizedUrl}`);
      return { activeAccounts: [] };
    }

    const activeAccounts = response.data.chart.map((item) => ({
      date: item.date,
      value: parseInt(item.value, 10),
    }));

    return { activeAccounts };
  } catch (error) {
    console.error(
      `Error fetching active accounts data for ${normalizedUrl}:`,
      error.message
    );
    throw error;
  }
};

// Fetch active accounts across all chains and structure the data
export const fetchAllActiveAccounts = async (sheetData) => {
  let totalActiveAccountsCombined = 0;
  const activeAccountsByChainDate = {};

  for (const chain of sheetData) {
    const { blockScoutUrl, launchDate, name } = chain;
    const chainName = name?.trim();

    // Skip if essential data is missing
    if (!chainName || !blockScoutUrl || !launchDate) {
      console.warn(
        `Skipping chain with missing data: ${JSON.stringify(chain)}`
      );
      continue;
    }

    activeAccountsByChainDate[chainName] = {}; // Initialize to empty object

    try {
      const { activeAccounts } = await fetchActiveAccountsData(
        blockScoutUrl,
        launchDate
      );

      activeAccounts.forEach(({ date, value }) => {
        // Aggregate by chain and date
        if (!activeAccountsByChainDate[chainName][date]) {
          activeAccountsByChainDate[chainName][date] = 0;
        }
        activeAccountsByChainDate[chainName][date] += value;

        totalActiveAccountsCombined += value;
      });
    } catch (error) {
      console.error(`Error fetching active accounts for ${chainName}:`, error);
    }
  }

  return {
    activeAccountsByChainDate,
    totalActiveAccountsCombined,
  };
};

// Updated function to calculate transactions across all chains
export const fetchAllTransactions = async (sheetData) => {
  let totalTransactionsCombined = 0;
  const transactionDataByWeek = {};
  const transactionsByChain = {};
  const transactionsByChainDate = {}; // New addition

  const processTransactionData = (transactions, chainName) => {
    transactions.forEach(({ date, value }) => {
      const week = moment(date).startOf("isoWeek").format("GGGG-[W]WW"); // Correct format
      const parsedValue = parseInt(value, 10);

      // Validate week key format
      const weekKeyPattern = /^\d{4}-W\d{2}$/;
      if (!weekKeyPattern.test(week)) {
        console.warn(
          `Invalid week key format: ${week} for chain: ${chainName}`
        );
        return; // Skip malformed week keys
      }

      // Log the week key for debugging
      console.log(
        `Processing Chain: ${chainName}, Date: ${date}, Week: ${week}, Value: ${parsedValue}`
      );

      // Aggregate by week
      if (!transactionDataByWeek[week]) {
        transactionDataByWeek[week] = 0;
      }
      transactionDataByWeek[week] += parsedValue;

      // Aggregate by chain and week
      if (!transactionsByChain[chainName]) {
        transactionsByChain[chainName] = {};
      }
      if (!transactionsByChain[chainName][week]) {
        transactionsByChain[chainName][week] = 0;
      }
      transactionsByChain[chainName][week] += parsedValue;

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

  for (const chain of sheetData) {
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
  }

  return {
    transactionDataByWeek,
    transactionsByChain,
    transactionsByChainDate, // Return the new data
    totalTransactionsCombined,
  };
};
