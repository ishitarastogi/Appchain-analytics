// googleSheetActiveAccountsService.js

import axios from "axios";
import moment from "moment";

// Fetch Google Sheets Data specifically for Gelato chains (active accounts)
export const fetchGelatoActiveAccountsSheetData = async () => {
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
    console.error(
      "Error fetching Google Sheets Gelato active accounts data:",
      error
    );
    throw error;
  }
};

// Fetch Active Accounts Data for a single Gelato chain
export const fetchActiveAccountsData = async (
  blockScoutUrl,
  fromDate,
  toDate
) => {
  const normalizedUrl = blockScoutUrl.replace(/\/+$/, "");

  const activeAccountsApiUrl = encodeURIComponent(
    `${normalizedUrl}/api/v1/lines/activeAccounts?from=${fromDate}&to=${toDate}&resolution=DAY`
  );

  const isDevelopment =
    !process.env.NODE_ENV || process.env.NODE_ENV === "development";
  const proxyBaseUrl = isDevelopment
    ? "http://localhost:3000/api/proxy?url="
    : "/api/proxy?url=";

  try {
    const activeAccountsResponse = await axios.get(
      `${proxyBaseUrl}${activeAccountsApiUrl}`
    );

    return {
      activeAccounts: activeAccountsResponse.data.chart.map((item) => ({
        date: item.date,
        value: parseInt(item.value, 10),
      })),
    };
  } catch (error) {
    console.error(
      `Error fetching active accounts data for ${normalizedUrl}:`,
      error.message
    );
    throw error;
  }
};

// Updated function to calculate active accounts across all Gelato chains
export const fetchAllActiveAccounts = async (timeRange) => {
  const gelatoChains = await fetchGelatoActiveAccountsSheetData();
  let totalActiveAccountsCombined = 0;
  const activeAccountsDataByDate = {};
  const activeAccountsByChain = {};

  // Determine the date range based on the time range requested
  const endDate = moment().format("YYYY-MM-DD");
  let startDate;
  switch (timeRange) {
    case "daily":
      startDate = endDate;
      break;
    case "all":
      startDate = "2000-01-01"; // Use a very old date to fetch all
      break;
    case "4months":
      startDate = moment().subtract(4, "months").format("YYYY-MM-DD");
      break;
    case "6months":
      startDate = moment().subtract(6, "months").format("YYYY-MM-DD");
      break;
    default:
      throw new Error("Invalid time range specified");
  }

  const processActiveAccountsData = (activeAccounts, chainName) => {
    activeAccounts.forEach(({ date, value }) => {
      const parsedValue = parseInt(value, 10);

      if (!activeAccountsDataByDate[date]) {
        activeAccountsDataByDate[date] = 0;
      }
      activeAccountsDataByDate[date] += parsedValue;

      if (!activeAccountsByChain[chainName]) {
        activeAccountsByChain[chainName] = {};
      }
      if (!activeAccountsByChain[chainName][date]) {
        activeAccountsByChain[chainName][date] = 0;
      }
      activeAccountsByChain[chainName][date] += parsedValue;

      totalActiveAccountsCombined += parsedValue;
    });
  };

  for (const chain of gelatoChains) {
    const { blockScoutUrl, name } = chain;
    try {
      const { activeAccounts } = await fetchActiveAccountsData(
        blockScoutUrl,
        startDate,
        endDate
      );
      processActiveAccountsData(activeAccounts, name);
    } catch (error) {
      console.error(`Error fetching active accounts for ${name}:`, error);
    }
  }

  return {
    activeAccountsDataByDate,
    activeAccountsByChain,
    totalActiveAccountsCombined,
  };
};
