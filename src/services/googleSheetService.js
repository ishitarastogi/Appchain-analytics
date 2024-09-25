import axios from "axios";
import moment from "moment";

// Fetch Google Sheets Data
export const fetchGoogleSheetData = async () => {
  const GOOGLE_SHEET_URL = `https://sheets.googleapis.com/v4/spreadsheets/1z-wz6qNOb2Zs7d3xnPjhl004YhIuov-ecd60JzffaNM/values/Sheet1!A2:Z1000?key=${process.env.REACT_APP_GOOGLE_SHEETS_API_KEY}`;

  try {
    const response = await axios.get(GOOGLE_SHEET_URL);
    const rows = response.data.values;

    console.log("Fetched Google Sheets Data:", rows); // <-- Check Google Sheets data

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
export const fetchBlockExplorerData = async (blockScoutUrl, launchDate) => {
  // Remove any trailing slashes
  const normalizedUrl = blockScoutUrl.replace(/\/+$/, "");

  // Parse and format the launchDate
  const formattedLaunchDate = moment(new Date(launchDate)).format("YYYY-MM-DD");
  const currentDate = moment().format("YYYY-MM-DD");

  // Encode the external API URLs
  const transactionsApiUrl = encodeURIComponent(
    `${normalizedUrl}/api/v1/lines/newTxns?from=${formattedLaunchDate}&to=${currentDate}`
  );

  const isDevelopment =
    !process.env.NODE_ENV || process.env.NODE_ENV === "development";
  const proxyBaseUrl = isDevelopment
    ? "http://localhost:3000/api/proxy?url=" // Vercel dev server
    : "/api/proxy?url="; // Production

  try {
    console.log("Fetching Transactions for URL:", transactionsApiUrl); // <-- Check the API URL

    // Fetch transactions
    const transactionsResponse = await axios.get(
      `${proxyBaseUrl}${transactionsApiUrl}`
    );

    console.log("Fetched Transactions Data:", transactionsResponse.data); // <-- Log transactions

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

// Function to calculate weekly transactions across all chains and filter for the last month
export const fetchAllTransactions = async (sheetData) => {
  const transactionDataByWeek = {};
  let totalTransactionsCombined = 0;
  const lastMonth = moment().subtract(1, "months"); // Get the last month date

  // Iterate over each chain's data from the sheet
  for (const chain of sheetData) {
    const { blockScoutUrl, launchDate, name } = chain;
    try {
      const { transactions } = await fetchBlockExplorerData(
        blockScoutUrl,
        launchDate
      );

      console.log(`Transactions for ${name}:`, transactions); // <-- Log transactions for each chain

      // Aggregate transactions by week
      transactions.forEach(({ date, value }) => {
        const week = moment(date).startOf("isoWeek").format("YYYY-WW");
        const transactionDate = moment(date);

        // Consider only transactions from the last month
        if (transactionDate.isAfter(lastMonth)) {
          // Sum the transactions for each week across all chains
          if (!transactionDataByWeek[week]) {
            transactionDataByWeek[week] = 0;
          }
          transactionDataByWeek[week] += value;

          // Increment the total transactions across all chains
          totalTransactionsCombined += value;
        }
      });
    } catch (error) {
      console.error(`Error fetching transactions for ${name}:`, error);
    }
  }

  console.log("Weekly Transaction Data (Last Month):", transactionDataByWeek); // <-- Log weekly transactions
  console.log("Total Transactions Combined:", totalTransactionsCombined); // <-- Log total transactions

  return {
    transactionDataByWeek,
    totalTransactionsCombined,
  };
};
