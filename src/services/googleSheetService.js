// src/services/googleSheetService.js

import axios from "axios";
import moment from "moment";

// Fetch Google Sheets Data
export const fetchGoogleSheetData = async () => {
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

    const mappedData = rows.map((row) => ({
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
    }));

    console.log("Mapped Google Sheet data:", mappedData);

    return mappedData;
  } catch (error) {
    console.error("Error fetching Google Sheets data:", error);
    throw error;
  }
};

// src/services/googleSheetService.js

export const fetchBlockExplorerData = async (blockScoutUrl, launchDate) => {
  const normalizedUrl = blockScoutUrl.replace(/\/+$/, "");
  const formattedLaunchDate = moment(new Date(launchDate)).format("YYYY-MM-DD");
  const currentDate = moment().format("YYYY-MM-DD");

  const transactionsApiUrl = encodeURIComponent(
    `${normalizedUrl}/api/v1/lines/newTxns?from=${formattedLaunchDate}&to=${currentDate}`
  );

  const proxyBaseUrl = "/api/proxy?url=";

  console.log("\nFetching block explorer data:");
  console.log("BlockScout URL:", blockScoutUrl);
  console.log("Normalized URL:", normalizedUrl);
  console.log("Formatted Launch Date:", formattedLaunchDate);
  console.log("Current Date:", currentDate);
  console.log("Transactions API URL:", decodeURIComponent(transactionsApiUrl));

  try {
    const requestUrl = `${proxyBaseUrl}${transactionsApiUrl}`;
    console.log("Full request URL:", requestUrl);

    const transactionsResponse = await axios.get(requestUrl);
    console.log("Block explorer API response:", transactionsResponse.data);

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

export const fetchAllTransactions = async (sheetData) => {
  let totalTransactionsCombined = 0;
  const transactionDataByWeek = {};
  const transactionsByChain = {};

  const processTransactionData = (transactions, chainName) => {
    transactions.forEach(({ date, value }) => {
      const week = moment(date).startOf("isoWeek").format("YYYY-WW");
      if (!transactionDataByWeek[week]) {
        transactionDataByWeek[week] = 0;
      }
      transactionDataByWeek[week] += parseInt(value, 10);

      if (!transactionsByChain[chainName]) {
        transactionsByChain[chainName] = {};
      }
      if (!transactionsByChain[chainName][week]) {
        transactionsByChain[chainName][week] = 0;
      }
      transactionsByChain[chainName][week] += parseInt(value, 10);

      totalTransactionsCombined += parseInt(value, 10);
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
    totalTransactionsCombined,
  };
};
