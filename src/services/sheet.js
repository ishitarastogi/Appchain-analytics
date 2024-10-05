// googleSheetService.js

import axios from "axios";
import moment from "moment";

// Fetch Google Sheets Data
export const fetchGoogleSheetData = async () => {
  const GOOGLE_SHEET_URL = `https://sheets.googleapis.com/v4/spreadsheets/1z-wz6qNOb2Zs7d3xnPjhl004YhIuov-ecd60JzffaNM/values/Sheet1!A2:O1000?key=${process.env.REACT_APP_GOOGLE_SHEETS_API_KEY}`;

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

// Helper function to build the input parameter for the API
const buildInputParam = (projectIds, range) => {
  const input = {
    0: {
      json: {
        range: range,
        filter: {
          type: "projects",
          projectIds: projectIds,
        },
      },
    },
  };
  return encodeURIComponent(JSON.stringify(input));
};

// Fetch TPS Data using Project IDs and Time Range
export const fetchTPSData = async (projectIds, range = "max") => {
  /**
   * API Endpoint:
   * https://l2beat.com/api/trpc/activity.chart?batch=1&input=<encoded_input>
   *
   * - projectIds: Array of project IDs fetched from Google Sheets
   * - range: Time range for TPS data (e.g., "max", "daily", "6months", "4months")
   */

  const baseUrl = "https://l2beat.com/api/trpc/activity.chart";
  const batch = 1;
  const inputParam = buildInputParam(projectIds, range);

  const apiUrl = `${baseUrl}?batch=${batch}&input=${inputParam}`;

  // Determine the proxy base URL based on the environment
  const isDevelopment =
    !process.env.NODE_ENV || process.env.NODE_ENV === "development";
  const proxyBaseUrl = isDevelopment
    ? "http://localhost:3001/api/proxy?url="
    : "/api/proxy?url="; // Ensure your proxy server is correctly set up in production

  const encodedApiUrl = encodeURIComponent(apiUrl);

  try {
    const response = await axios.get(`${proxyBaseUrl}${encodedApiUrl}`);
    // Adjust based on the actual structure of the API response
    return response.data;
  } catch (error) {
    console.error(
      `Error fetching TPS data for project IDs ${projectIds}:`,
      error
    );
    throw error;
  }
};

// Utility function to chunk an array into smaller arrays
const chunkArray = (array, size) => {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
};

// Fetch TPS Data for All Projects Based on Selected Time Range with Batching
export const fetchAllTPSData = async (sheetData, range = "max") => {
  /**
   * This function fetches TPS data for all projects based on the selected time range.
   * It sends multiple API requests in batches if necessary.
   * Adjust the batch size as per API's capability to handle multiple projectIds.
   */

  // Extract all valid project IDs
  const validProjects = sheetData.filter(
    (chain) => chain.id && chain.id.trim() !== ""
  );
  const projectIds = validProjects.map((chain) => chain.id.trim());

  const batchSize = 10; // Adjust based on API's max projectIds per request
  const batches = chunkArray(projectIds, batchSize);

  try {
    const batchPromises = batches.map((batchIds) =>
      fetchTPSData(batchIds, range)
    );
    const batchResults = await Promise.all(batchPromises);
    // Combine all batch results into a single array or desired structure
    const combinedResults = batchResults.flat(); // Adjust if response structure differs
    return combinedResults;
  } catch (error) {
    console.error("Error fetching all TPS data:", error);
    throw error;
  }
};

// Fetch Current Day TPS for a Specific Project
export const fetchCurrentDayTPS = async (projectId) => {
  const range = "daily"; // Assuming "daily" fetches current day TPS
  try {
    const data = await fetchTPSData([projectId], range);
    // Process and return the necessary TPS information based on API response
    return data;
  } catch (error) {
    console.error(
      `Error fetching current day TPS for project ID ${projectId}:`,
      error
    );
    throw error;
  }
};

// Fetch TPS Growth Over Different Time Ranges for a Specific Project
export const fetchTPSGrowth = async (
  projectId,
  ranges = ["max", "6months", "4months"]
) => {
  try {
    const promises = ranges.map((range) => fetchTPSData([projectId], range));
    const results = await Promise.all(promises);
    // Combine or process the results as needed based on API response
    return results;
  } catch (error) {
    console.error(
      `Error fetching TPS growth for project ID ${projectId}:`,
      error
    );
    throw error;
  }
};

// Fetch Block Explorer Data for a single chain (transactions)
export const fetchBlockExplorerData = async (blockScoutUrl, launchDate) => {
  const normalizedUrl = blockScoutUrl.replace(/\/+$/, "");
  const formattedLaunchDate = moment(new Date(launchDate)).format("YYYY-MM-DD");
  const currentDate = moment().format("YYYY-MM-DD");

  const transactionsApiUrl = `${normalizedUrl}/api/v1/lines/newTxns?from=${formattedLaunchDate}&to=${currentDate}`;

  // Determine the proxy base URL based on the environment
  const isDevelopment =
    !process.env.NODE_ENV || process.env.NODE_ENV === "development";
  const proxyBaseUrl = isDevelopment
    ? "http://localhost:3001/api/proxy?url="
    : "/api/proxy?url="; // Ensure your proxy server is correctly set up in production

  const encodedUrl = encodeURIComponent(transactionsApiUrl);

  try {
    const transactionsResponse = await axios.get(
      `${proxyBaseUrl}${encodedUrl}`
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

// Updated function to calculate transactions across all chains
export const fetchAllTransactions = async (sheetData) => {
  let totalTransactionsCombined = 0;
  const transactionDataByWeek = {};
  const transactionsByChain = {};
  const transactionsByChainDate = {}; // New addition

  const processTransactionData = (transactions, chainName) => {
    transactions.forEach(({ date, value }) => {
      const week = moment(date).startOf("isoWeek").format("YYYY-[W]WW");
      const parsedValue = parseInt(value, 10);

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

// Fetch Active Accounts Data for all chains
export const fetchAllActiveAccounts = async (sheetData) => {
  let totalActiveAccountsCombined = 0;
  const activeAccountsByChain = {};
  const activeAccountsByChainDate = {}; // To store active accounts per chain per date

  const processActiveAccountsData = (activeAccounts, chainName) => {
    activeAccounts.forEach(({ date, value }) => {
      const parsedValue = parseInt(value, 10);

      // Aggregate by chain and date
      if (!activeAccountsByChainDate[chainName]) {
        activeAccountsByChainDate[chainName] = {};
      }
      if (!activeAccountsByChainDate[chainName][date]) {
        activeAccountsByChainDate[chainName][date] = 0;
      }
      activeAccountsByChainDate[chainName][date] += parsedValue;

      totalActiveAccountsCombined += parsedValue;
    });
  };

  for (const chain of sheetData) {
    const { blockScoutUrl, launchDate, name } = chain;
    try {
      const activeAccounts = await fetchActiveAccountsData(
        blockScoutUrl,
        launchDate
      );
      processActiveAccountsData(activeAccounts, name);
    } catch (error) {
      console.error(`Error fetching active accounts for ${name}:`, error);
    }
  }

  return {
    activeAccountsByChain,
    activeAccountsByChainDate,
    totalActiveAccountsCombined,
  };
};

// Helper function to fetch active accounts data for a single chain
export const fetchActiveAccountsData = async (blockScoutUrl, launchDate) => {
  const normalizedUrl = blockScoutUrl.replace(/\/+$/, "");
  const formattedLaunchDate = moment(new Date(launchDate)).format("YYYY-MM-DD");
  const currentDate = moment().format("YYYY-MM-DD");

  const activeAccountsApiUrl = `${normalizedUrl}/api/v1/lines/activeAccounts?from=${formattedLaunchDate}&to=${currentDate}`;

  // Determine the proxy base URL based on the environment
  const isDevelopment =
    !process.env.NODE_ENV || process.env.NODE_ENV === "development";
  const proxyBaseUrl = isDevelopment
    ? "http://localhost:3001/api/proxy?url="
    : "/api/proxy?url="; // Ensure your proxy server is correctly set up in production

  const encodedUrl = encodeURIComponent(activeAccountsApiUrl);

  try {
    const response = await axios.get(`${proxyBaseUrl}${encodedUrl}`);
    return response.data.chart.map((item) => ({
      date: item.date,
      value: item.value,
    }));
  } catch (error) {
    console.error(
      `Error fetching active accounts data from ${normalizedUrl}:`,
      error.message
    );
    throw error;
  }
};
