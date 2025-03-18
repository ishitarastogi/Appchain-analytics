// src/services/googleSheetService.js

import axios from "axios";
import moment from "moment";

// Fetch Google Sheets Data
export const fetchGoogleSheetData = async () => {
  const GOOGLE_SHEET_URL = "https://sheets.googleapis.com/v4/spreadsheets/1hNm4OdwVPSsDryrxdxseKIxKRETQ8uMiBg4oWIgWHFg/values/Sheet1?key=AIzaSyBi8VdGKrbHsnQzoRHm2-5vaAi4HnvognE";

  try {
    const response = await axios.get(GOOGLE_SHEET_URL);
    const rows = response.data.values;

    return rows.map((row) => ({
      name: row[0], // Column A: Name
      blockScoutUrl: row[1], // Column B: Blockscout URL
      projectId: row[2], // Column C: ID
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
      change: row[17], // Column Q: Change
    }));
  } catch (error) {
    console.error("Error fetching Google Sheets data:", error);
    throw error;
  }
};

// Fetch TPS Data for a single chain using l2beat API
export const fetchLatestTpsData = async (projectId) => {
  const inputParam = encodeURIComponent(
    JSON.stringify({
      0: {
        json: {
          range: "max",
          filter: {
            type: "projects",
            projectIds: [projectId],
          },
        },
      },
    })
  );

  const baseUrl = `https://l2beat.com/api/trpc/activity.chart?batch=1&input=${inputParam}`;

  // Proxy server logic
  const isDevelopment =
    !process.env.NODE_ENV || process.env.NODE_ENV === "development";
  const proxyBaseUrl = isDevelopment
    ? "http://localhost:3000/api/proxy?url="
    : "/api/proxy?url=";

  try {
    const fullUrl = `${proxyBaseUrl}${encodeURIComponent(baseUrl)}`;
    const response = await axios.get(fullUrl);
    console.log(`Proxy response for ${projectId}:`, response.data);

    // Check if response contains the expected structure
    if (
      !response.data ||
      !response.data[0] ||
      !response.data[0].result ||
      !response.data[0].result.data ||
      !response.data[0].result.data.json ||
      !response.data[0].result.data.json.data
    ) {
      throw new Error(
        `Invalid response structure from the proxy for ${projectId}`
      );
    }

    // Access the correct data array
    const data = response.data[0].result.data.json.data;
    console.log("data", data);

    // Process the TPS data
    // Data is an array of arrays: [[timestamp, tpsValue, ...], ...]
    const tpsData = data.map((item) => {
      const timestamp = item[0]; // Unix timestamp in seconds
      const tpsValue = item[1] / 86400; // TPS value
      console.log(tpsValue);
      const date = moment.unix(timestamp).format("YYYY-MM-DD");
      return {
        date,
        value: tpsValue,
      };
    });

    return tpsData;
  } catch (error) {
    console.error(`Error fetching TPS data for ${projectId}:`, error.message);
    return []; // Return empty array on error
  }
};

// Fetch TPS data across all chains and structure the data
export const fetchAllTpsData = async (sheetData) => {
  const tpsDataByChainDate = {};

  // Create an array of promises to fetch data in parallel
  const fetchPromises = sheetData
    .filter((chain) => chain.projectId) // Ensure projectId is present
    .map(async (chain) => {
      const { name, projectId } = chain;
      try {
        const tpsData = await fetchLatestTpsData(projectId);
        // Aggregate data by date
        const chainTpsByDate = {};
        tpsData.forEach(({ date, value }) => {
          chainTpsByDate[date] = value;
        });
        tpsDataByChainDate[name] = chainTpsByDate;
      } catch (error) {
        console.error(`Error fetching TPS data for ${name}:`, error);
      }
    });

  await Promise.all(fetchPromises);

  return {
    tpsDataByChainDate,
  };
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

    // Check if response contains the expected structure
    if (
      !transactionsResponse.data ||
      !transactionsResponse.data.chart ||
      !Array.isArray(transactionsResponse.data.chart)
    ) {
      throw new Error(
        `Invalid response structure from the block explorer for ${normalizedUrl}`
      );
    }

    return {
      transactions: transactionsResponse.data.chart.map((item) => ({
        date: item.date,
        value: parseInt(item.value, 10),
        is_approximate: item.is_approximate || false, // Include is_approximate flag
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

// Updated fetchEthernityTransactions Function
export const fetchEthernityTransactions = async (blockScoutUrl) => {
  const isDevelopment =
    !process.env.NODE_ENV || process.env.NODE_ENV === "development";
  const proxyBaseUrl = isDevelopment
    ? "http://localhost:3000/api/proxy?url="
    : "/api/proxy?url=";

  try {
    const encodedApiUrl = encodeURIComponent(blockScoutUrl);
    const response = await axios.get(`${proxyBaseUrl}${encodedApiUrl}`);

    // Process the response
    if (!response.data || !Array.isArray(response.data)) {
      console.warn(`No transaction data available for ${blockScoutUrl}`);
      return { transactions: [] };
    }

    const transactions = response.data.map((item, index) => ({
      date: moment(item[0]).format("YYYY-MM-DD"), // Format date to "YYYY-MM-DD"
      value: parseInt(item[1], 10),
      is_approximate: index === 0, // Mark the first date as approximate
    }));

    return { transactions };
  } catch (error) {
    console.error(`Error fetching Ethernity transactions:`, error.message);
    throw error;
  }
};

// Fetch all transactions across all chains and structure the data
export const fetchAllTransaction = async (sheetData) => {
  let totalTransactionsCombined = 0;
  const transactionsByChainDate = {};
  const approximateDataByChainDate = {}; // New data structure to track approximate data

  const processTransactionData = (transactions, chainName) => {
    transactions.forEach(({ date, value, is_approximate }) => {
      const parsedValue = parseInt(value, 10);

      // Initialize chain data if not present
      if (!transactionsByChainDate[chainName]) {
        transactionsByChainDate[chainName] = {};
      }

      // Store transaction data with is_approximate flag
      transactionsByChainDate[chainName][date] = {
        value: parsedValue,
        is_approximate: is_approximate || false,
      };

      totalTransactionsCombined += parsedValue;

      // Track approximate data separately
      if (is_approximate) {
        if (!approximateDataByChainDate[chainName]) {
          approximateDataByChainDate[chainName] = {};
        }
        approximateDataByChainDate[chainName][date] = true;
      }
    });
  };

  // Fetch all transactions in parallel using Promise.all
  await Promise.all(
    sheetData.map(async (chain) => {
      const { blockScoutUrl, launchDate, name, change } = chain;
      try {
        let transactions = [];
        if (change === "Positive" && name === "Ethernity") {
          // Use the special API endpoint for Ethernity
          const result = await fetchEthernityTransactions(blockScoutUrl);
          transactions = result.transactions;
        } else {
          const result = await fetchBlockExplorerData(
            blockScoutUrl,
            launchDate
          );
          transactions = result.transactions;
        }
        processTransactionData(transactions, name);
      } catch (error) {
        console.error(`Error fetching transactions for ${name}:`, error);
      }
    })
  );

  return {
    transactionsByChainDate,
    approximateDataByChainDate,
    totalTransactionsCombined,
  };
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

// Fetch all transactions across all chains and structure the data
export const fetchAllTransactions = async (sheetData) => {
  let totalTransactionsCombined = 0;
  const transactionDataByWeek = {};
  const transactionsByChain = {};

  // Create an array of promises to fetch data in parallel
  const fetchPromises = sheetData.map(async (chain) => {
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
  });

  const processTransactionData = (transactions, chainName) => {
    transactions.forEach(({ date, value }) => {
      const week = moment(date).startOf("isoWeek").format("GGGG-[W]WW");
      const parsedValue = parseFloat(value); // Changed to parseFloat for decimal precision

      // Validate week key format
      const weekKeyPattern = /^\d{4}-W\d{2}$/;
      if (!weekKeyPattern.test(week)) {
        console.warn(
          `Invalid week key format: ${week} for chain: ${chainName}`
        );
        return; // Skip malformed week keys
      }

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

      totalTransactionsCombined += parsedValue;
    });
  };

  // Await all fetch promises
  await Promise.all(fetchPromises);

  return {
    transactionDataByWeek,
    transactionsByChain,
    totalTransactionsCombined,
  };
};

// Fetch TVL Data for a single chain using l2beat API
// Corrected fetchTvlData function
export const fetchTvlData = async (projectId) => {
  const inputParam = encodeURIComponent(
    JSON.stringify({
      0: {
        json: {
          filter: {
            type: "projects",
            projectIds: [projectId],
          },
          range: "max",
          excludeAssociatedTokens: false,
        },
      },
    })
  );

  const baseUrl = `https://l2beat.com/api/trpc/tvl.chart?batch=1&input=${inputParam}`;

  // Proxy server logic
  const isDevelopment =
    !process.env.NODE_ENV || process.env.NODE_ENV === "development";
  const proxyBaseUrl = isDevelopment
    ? "http://localhost:3000/api/proxy?url="
    : "/api/proxy?url=";

  try {
    const fullUrl = `${proxyBaseUrl}${encodeURIComponent(baseUrl)}`;
    const response = await axios.get(fullUrl);
    console.log(`Proxy response for ${projectId}:`, response.data);

    // Check if response contains the expected structure
    if (
      !response.data ||
      !response.data[0] ||
      !response.data[0].result ||
      !response.data[0].result.data ||
      !response.data[0].result.data.json
    ) {
      throw new Error(
        `Invalid response structure from the proxy for ${projectId}`
      );
    }

    const data = response.data[0].result.data.json;

    // Process the TVL data
    // Data is an array of arrays: [[timestamp, native, canonical, external, ...], ...]
    const tvlData = data.map((entry) => {
      const timestamp = entry[0]; // First element is the timestamp
      const nativeTvl = entry[1]; // Already in USD
      const canonical = entry[2]; // Already in USD
      const external = entry[3]; // Already in USD
      const totalTvl = nativeTvl + canonical + external;
      const date = moment.unix(timestamp).format("YYYY-MM-DD");
      return {
        date,
        nativeTvl,
        canonical,
        external,
        totalTvl,
      };
    });

    return tvlData;
  } catch (error) {
    console.error(`Error fetching TVL data for ${projectId}:`, error.message);
    return []; // Return empty array on error
  }
};

// Fetch TVL data across all chains and structure the data
export const fetchAllTvlData = async (sheetData) => {
  const tvlDataByChainDate = {};

  // Create an array of promises to fetch data in parallel
  const fetchPromises = sheetData
    .filter((chain) => chain.projectId) // Ensure projectId is present
    .map(async (chain) => {
      const { name, projectId } = chain;
      try {
        const tvlData = await fetchTvlData(projectId);
        // Aggregate data by date
        const chainTvlByDate = {};
        tvlData.forEach(
          ({ date, nativeTvl, canonical, external, totalTvl }) => {
            chainTvlByDate[date] = {
              nativeTvl,
              canonical,
              external,
              totalTvl,
            };
          }
        );
        tvlDataByChainDate[name] = chainTvlByDate;
      } catch (error) {
        console.error(`Error fetching TVL data for ${name}:`, error);
      }
    });

  await Promise.all(fetchPromises);

  return {
    tvlDataByChainDate,
  };
};
