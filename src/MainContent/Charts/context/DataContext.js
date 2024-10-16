// src/context/DataContext.js

import React, { createContext, useState, useEffect } from "react";
import {
  fetchGoogleSheetData,
  fetchAllTransactions,
} from "../../../services/googleSheetService";
import {
  saveData,
  getData,
  clearAllData,
} from "../../../services/indexedDBService";

// Create the DataContext
export const DataContext = createContext();

// DataProvider Component
export const DataProvider = ({ children }) => {
  const [transactionData, setTransactionData] = useState(null);
  const [chainDetails, setChainDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const CACHE_ID = "transactionMetricsData";
  const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

  // Function to fetch and process data
  const fetchData = async () => {
    try {
      setError(null);
      console.log("Fetching Google Sheet data...");
      const sheetData = await fetchGoogleSheetData();

      setChainDetails(sheetData);

      // Filter for Mainnet chains
      const mainnetChains = sheetData.filter(
        (chain) =>
          chain.status && chain.status.trim().toLowerCase() === "mainnet"
      );
      console.log(
        `Filtered to ${mainnetChains.length} Mainnet chains out of ${sheetData.length}`
      );

      if (mainnetChains.length === 0) {
        throw new Error("No Mainnet chains found.");
      }

      console.log("Fetching all transactions...");
      const {
        transactionDataByWeek,
        transactionsByChain,
        totalTransactionsCombined,
      } = await fetchAllTransactions(mainnetChains);
      console.log("Transaction data fetched.");

      const processedData = {
        transactionDataByWeek,
        transactionsByChain,
        totalTransactionsCombined,
      };

      // Save to IndexedDB
      await saveData(CACHE_ID, processedData);
      console.log("Data saved to IndexedDB.");

      setTransactionData(processedData);
    } catch (err) {
      console.error("Error fetching or processing data:", err);
      setError(err.message || "Failed to load transaction metrics.");
      setTransactionData(null);
    } finally {
      setLoading(false);
    }
  };

  // Function to load data from IndexedDB or fetch fresh data
  const loadData = async () => {
    try {
      const cachedRecord = await getData(CACHE_ID);
      const now = Date.now();

      if (
        cachedRecord &&
        now - cachedRecord.timestamp < CACHE_DURATION &&
        cachedRecord.data
      ) {
        console.log("Loading data from IndexedDB...");
        setTransactionData(cachedRecord.data);
        setLoading(false);
      } else {
        console.log("No valid cached data found. Fetching fresh data...");
        await fetchData();
      }
    } catch (err) {
      console.error("Error loading data:", err);
      setError("Failed to load transaction metrics.");
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Set up periodic updates
    const interval = setInterval(() => {
      console.log("Refreshing data from the server...");
      fetchData();
    }, CACHE_DURATION); // Every 6 hours

    return () => clearAllData(interval);
  }, []);

  return (
    <DataContext.Provider
      value={{ transactionData, chainDetails, loading, error }}
    >
      {children}
    </DataContext.Provider>
  );
};
