// src/services/googleSheetService.js

import axios from "axios";
import moment from "moment";

// Cache Key Constants
const CACHE_KEY_SHEET_DATA = "googleSheetData_Gelato";
const CACHE_KEY_TRANSACTIONS_PREFIX = "transactionsData_Gelato_";
const CACHE_TIMESTAMP_KEY_PREFIX = "transactionsDataTimestamp_Gelato_";

// Fetch Google Sheets Data
export const fetchGoogleSheetData = async () => {
  const cachedData = localStorage.getItem(CACHE_KEY_SHEET_DATA);
  if (cachedData) {
    console.log("Using cached Google Sheets data.");
    return JSON.parse(cachedData);
  }

  const apiKey = process.env.REACT_APP_GOOGLE_SHEETS_API_KEY;
  const GOOGLE_SHEET_URL = `https://sheets.googleapis.com/v4/spreadsheets/1z-wz6qNOb2Zs7d3xnPjhl004YhIuov-ecd60JzffaNM/values/Sheet1!A2:Z1000?key=${apiKey}`;

  console.log("Google Sheets API Key:", apiKey);
  console.log("Fetching Google Sheet data from URL:", GOOGLE_SHEET_URL);

  try {
    const response = await axios.get(GOOGLE_SHEET_URL);
    console.log("Google Sheets API response:", response.data);

    const rows = response.data.values;

    if (!rows) {
      console.error("No data returned from Google Sheets API.");
      throw new Error("No data returned from Google Sheets API.");
    }

    const mappedData = rows
      .map((row) => ({
        name: row[0],
        blockScoutUrl: row[1],
        id: row[2],
        website: row[3],
        raas: row[4],
        year: row[5],
        quarter: row[6],
        month: row[7],
        launchDate: row[8],
        vertical: row[9],
        framework: row[10],
        da: row[11],
        l2OrL3: row[12],
        settlementWhenL3: row[13],
        logo: row[14],
      }))
      .filter((chain) => chain.raas.toLowerCase() === "gelato"); // Dynamic Filtering

    console.log("Mapped and Filtered Google Sheet data:", mappedData);

    // Cache the sheet data
    localStorage.setItem(CACHE_KEY_SHEET_DATA, JSON.stringify(mappedData));

    return mappedData;
  } catch (error) {
    console.error("Error fetching Google Sheets data:", error);
    throw error;
  }
};

// Fetch Block Explorer Data with Dynamic Date Ranges
export const fetchBlockExplorerData = async (
  blockScoutUrl,
  launchDate,
  timeRange = "Daily"
) => {
  const normalizedUrl = blockScoutUrl.replace(/\/+$/, "");
  const formattedLaunchDate = moment(new Date(launchDate)).format("YYYY-MM-DD");
  const currentDate = moment().format("YYYY-MM-DD");

  let fromDate = formattedLaunchDate;
  let toDate = currentDate;

  // Adjust date ranges based on timeRange
  switch (timeRange) {
    case "Daily":
      fromDate = currentDate;
      break;
    case "Monthly":
      fromDate = moment(currentDate).subtract(1, "months").format("YYYY-MM-DD");
      break;
    case "SixMonths":
      fromDate = moment(currentDate).subtract(6, "months").format("YYYY-MM-DD");
      break;
    case "FourMonths":
      fromDate = moment(currentDate).subtract(4, "months").format("YYYY-MM-DD");
      break;
    case "All":
      fromDate = formattedLaunchDate;
      break;
    default:
      fromDate = formattedLaunchDate;
      break;
  }

  const transactionsApiUrl = `${normalizedUrl}/api/v1/lines/newTxns?from=${fromDate}&to=${toDate}`;

  const proxyBaseUrl = "/api/proxy?url=";

  console.log("\nFetching block explorer data:");
  console.log("BlockScout URL:", blockScoutUrl);
  console.log("Normalized URL:", normalizedUrl);
  console.log("Formatted Launch Date:", formattedLaunchDate);
  console.log("From Date:", fromDate);
  console.log("To Date:", toDate);
  console.log("Transactions API URL:", transactionsApiUrl);

  try {
    const requestUrl = `${proxyBaseUrl}${encodeURIComponent(
      transactionsApiUrl
    )}`;
    console.log("Full request URL:", requestUrl);

    const transactionsResponse = await axios.get(requestUrl);
    console.log("Block explorer API response:", transactionsResponse.data);

    if (!transactionsResponse.data || !transactionsResponse.data.chart) {
      console.error("Invalid response structure:", transactionsResponse.data);
      return { transactions: [] };
    }

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

// Fetch All Transactions with Time Range and Implement Caching
export const fetchAllTransactions = async (sheetData, timeRange) => {
  // Define cache keys based on timeRange
  const CACHE_KEY_TRANSACTIONS = `${CACHE_KEY_TRANSACTIONS_PREFIX}${timeRange}`;
  const CACHE_TIMESTAMP_KEY = `${CACHE_TIMESTAMP_KEY_PREFIX}${timeRange}`;

  // Check if cached data exists and is not older than 6 hours
  const cachedTransactions = localStorage.getItem(CACHE_KEY_TRANSACTIONS);
  const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
  const sixHoursAgo = moment().subtract(6, "hours");

  if (
    cachedTransactions &&
    cachedTimestamp &&
    moment(cachedTimestamp).isAfter(sixHoursAgo)
  ) {
    console.log("Using cached transactions data for time range:", timeRange);
    return JSON.parse(cachedTransactions);
  }

  let totalTransactionsCombined = 0;
  const transactionDataByWeek = {};
  const transactionsByChain = {};

  const processTransactionData = (transactions, chainName) => {
    transactions.forEach(({ date, value }) => {
      const week = moment(date).startOf("isoWeek").format("YYYY-WW");
      if (!transactionDataByWeek[week]) {
        transactionDataByWeek[week] = 0;
      }
      transactionDataByWeek[week] += value;

      if (!transactionsByChain[chainName]) {
        transactionsByChain[chainName] = {};
      }
      if (!transactionsByChain[chainName][week]) {
        transactionsByChain[chainName][week] = 0;
      }
      transactionsByChain[chainName][week] += value;

      totalTransactionsCombined += value;
    });
  };

  for (const chain of sheetData) {
    const { blockScoutUrl, launchDate, name } = chain;
    try {
      const { transactions } = await fetchBlockExplorerData(
        blockScoutUrl,
        launchDate,
        timeRange
      );
      processTransactionData(transactions, name);
    } catch (error) {
      console.error(`Error fetching transactions for ${name}:`, error);
    }
  }

  const transactionsData = {
    transactionDataByWeek,
    transactionsByChain,
    totalTransactionsCombined,
  };

  // Cache the transactions data with current timestamp
  localStorage.setItem(
    CACHE_KEY_TRANSACTIONS,
    JSON.stringify(transactionsData)
  );
  localStorage.setItem(CACHE_TIMESTAMP_KEY, moment().toISOString());

  return transactionsData;
};
