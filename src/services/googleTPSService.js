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
      launchDate: row[8], // Column I: Launch date
    }));
  } catch (error) {
    console.error("Error fetching Google Sheets data:", error);
    throw error;
  }
};

// Fetch TPS Data for a single project
export const fetchTpsData = async (projectId, launchDate) => {
  const currentDate = moment().format("YYYY-MM-DD");
  const formattedLaunchDate = moment(new Date(launchDate)).format("YYYY-MM-DD");

  const baseUrl = `https://l2beat.com/api/trpc/activity.chart?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22range%22%3A%22max%22%2C%22filter%22%3A%7B%22type%22%3A%22projects%22%2C%22projectIds%22%3A%5B%22${projectId}%22%5D%7D%7D%7D%7D`;

  const isDevelopment =
    !process.env.NODE_ENV || process.env.NODE_ENV === "development";
  const proxyBaseUrl = isDevelopment
    ? "http://localhost:3000/api/proxy?url="
    : "/api/proxy?url=";

  try {
    const response = await axios.get(
      `${proxyBaseUrl}${encodeURIComponent(baseUrl)}`
    );

    // Check if the response is in expected format
    if (
      !response.data ||
      !response.data[0] ||
      !response.data[0].result ||
      !response.data[0].result.data ||
      !response.data[0].result.data.json
    ) {
      console.error("Unexpected response structure:", response.data);
      throw new Error("Invalid response structure from the proxy");
    }

    const data = response.data[0].result.data.json;

    // Extracting TPS data
    const tpsData = data.map((item) => ({
      timestamp: item[0],
      tps: item[1],
    }));

    console.log(`Fetched TPS data for project ID ${projectId}:`, tpsData);
    return tpsData;
  } catch (error) {
    console.error(
      `Error fetching TPS data for project ID ${projectId}:`,
      error.message
    );
    throw error;
  }
};

// Fetch TPS Data for all Gelato chains
export const fetchAllTpsDataForGelatoChains = async (sheetData) => {
  const tpsDataResults = {};

  for (const chain of sheetData) {
    if (chain.raas.toLowerCase() !== "gelato") continue; // Filter for Gelato chains

    try {
      const tpsData = await fetchTpsData(chain.id, chain.launchDate);
      tpsDataResults[chain.name] = tpsData;
      console.log(`Fetched TPS data for ${chain.name}:`, tpsData);
    } catch (error) {
      console.error(`Error fetching TPS data for ${chain.name}:`, error);
    }
  }

  return tpsDataResults;
};
