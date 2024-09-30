// src/components/MainContent/Charts/TransactionMetrics.js

import React, { useState, useEffect } from "react";
import {
  fetchGoogleSheetData,
  fetchAllTransactions,
} from "../../services/googleSheetService";
import { Bar } from "react-chartjs-2";
import moment from "moment";
import "./TransactionMetrics.css";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  TimeScale,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  TimeScale
);

const CACHE_KEY = "transactionDataCache";
const CACHE_EXPIRY_KEY = "transactionDataExpiry";
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

// Define chain colors globally so they can be used in both functions
const chainColors = [
  "#ff3b57",
  "#46BDC6",
  "#4185F4",
  "#EC6731",
  "#B28AFE",
  "#FFBB00",
  "#8BC34A",
  "#9C27B0",
  "#E91E63",
  "#3F51B5",
  "#9E9E9E",
];

const TransactionMetrics = () => {
  const [selectedChart, setSelectedChart] = useState("transactions"); // Default chart
  const [chartData, setChartData] = useState(null);
  const [chartDataPerChain, setChartDataPerChain] = useState(null);

  const isCacheExpired = () => {
    const expiryTime = localStorage.getItem(CACHE_EXPIRY_KEY);
    return !expiryTime || new Date().getTime() > expiryTime;
  };

  const fetchAndProcessData = async () => {
    try {
      console.log("Fetching Google Sheet data...");
      const sheetData = await fetchGoogleSheetData();
      console.log("Sheet data fetched:", sheetData);

      console.log("Fetching all transactions...");
      const {
        transactionDataByWeek,
        transactionsByChain,
        totalTransactionsCombined,
      } = await fetchAllTransactions(sheetData);
      console.log("Transaction data fetched:");
      console.log("Transaction Data By Week:", transactionDataByWeek);
      console.log("Transactions By Chain:", transactionsByChain);
      console.log("Total Transactions Combined:", totalTransactionsCombined);

      processData(
        transactionDataByWeek,
        transactionsByChain,
        totalTransactionsCombined
      );

      // Cache the data, including totalTransactionsCombined
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          transactionDataByWeek,
          transactionsByChain,
          totalTransactionsCombined,
        })
      );
      localStorage.setItem(
        CACHE_EXPIRY_KEY,
        new Date().getTime() + CACHE_DURATION
      );
    } catch (error) {
      console.error("Error fetching or processing data:", error);
    }
  };

  useEffect(() => {
    const cachedData = JSON.parse(localStorage.getItem(CACHE_KEY));

    if (cachedData && !isCacheExpired()) {
      console.log("Using cached data.");
      const {
        transactionDataByWeek,
        transactionsByChain,
        totalTransactionsCombined,
      } = cachedData;
      processData(
        transactionDataByWeek,
        transactionsByChain,
        totalTransactionsCombined
      );
    } else {
      console.log("Cache expired or not found. Fetching new data.");
      fetchAndProcessData();
    }
  }, []);

  const processData = (
    transactionDataByWeek,
    transactionsByChain,
    totalTransactionsCombined
  ) => {
    // Get all weeks
    const weekNumbers = Object.keys(transactionDataByWeek);
    const weekMoments = weekNumbers.map((week) => moment(week, "YYYY-WW"));
    const sortedWeekMoments = weekMoments.sort((a, b) => a - b);
    const startWeek = moment.min(weekMoments);
    const endWeek = moment.max(weekMoments);

    // Generate labels
    const labels = [];
    let currentWeek = startWeek.clone();
    while (currentWeek.isSameOrBefore(endWeek)) {
      labels.push(currentWeek.format("YYYY-MM-DD"));
      currentWeek.add(1, "week");
    }

    const weekKeys = labels.map((label) =>
      moment(label).startOf("isoWeek").format("YYYY-WW")
    );

    // Total transactions data
    const totalData = labels.map((label) => {
      const weekKey = moment(label).startOf("isoWeek").format("YYYY-WW");
      return transactionDataByWeek[weekKey]
        ? transactionDataByWeek[weekKey] / 1e6
        : 0;
    });

    setChartData({
      labels,
      datasets: [
        {
          label: "Total Weekly Transactions",
          data: totalData,
          backgroundColor: "#ff3b57",
          barPercentage: 0.5, // Thicker bars
        },
      ],
    });

    // For Transactions Per Chain chart

    // Prepare data per week
    const topChainsPerWeek = {};
    const allTopChainsSet = new Set();

    weekKeys.forEach((weekKey) => {
      // For this week, get transaction counts per chain
      const chainTransactionCounts = {};
      for (let chainName in transactionsByChain) {
        const chainData = transactionsByChain[chainName];
        const txCount = chainData[weekKey] || 0;
        chainTransactionCounts[chainName] = txCount;
      }
      // Sort chains by transaction count
      const topChains = Object.entries(chainTransactionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .filter(([chainName, txCount]) => txCount > 0);

      const topChainNames = topChains.map(([chainName]) => chainName);
      topChainsPerWeek[weekKey] = topChainNames;
      topChainNames.forEach((chainName) => allTopChainsSet.add(chainName));
    });

    const allTopChains = Array.from(allTopChainsSet);

    // Assign colors to chains
    const colorMap = {};
    allTopChains.forEach((chain, index) => {
      colorMap[chain] = chainColors[index % chainColors.length];
    });
    colorMap["Others"] = chainColors[10] || "#9E9E9E";

    // Initialize datasets
    const datasetsPerChain = allTopChains.map((chainName) => ({
      label: chainName,
      data: [],
      backgroundColor: colorMap[chainName],
      barPercentage: 0.5, // Thicker bars
    }));

    // Add 'Others' dataset
    datasetsPerChain.push({
      label: "Others",
      data: [],
      backgroundColor: colorMap["Others"],
      barPercentage: 0.5, // Thicker bars
    });

    // Build data arrays
    for (let i = 0; i < weekKeys.length; i++) {
      const weekKey = weekKeys[i];
      const topChains = topChainsPerWeek[weekKey];
      const otherChains = Object.keys(transactionsByChain).filter(
        (chainName) => !topChains.includes(chainName)
      );

      // For each chain in allTopChains
      allTopChains.forEach((chainName, index) => {
        const chainData = transactionsByChain[chainName];
        const txCount = chainData[weekKey] || 0;
        if (topChains.includes(chainName)) {
          datasetsPerChain[index].data.push(txCount / 1e6);
        } else {
          datasetsPerChain[index].data.push(0);
        }
      });

      // For 'Others' dataset
      const othersTxCount = otherChains.reduce((sum, chainName) => {
        const chainData = transactionsByChain[chainName];
        return sum + (chainData[weekKey] || 0);
      }, 0);
      datasetsPerChain[datasetsPerChain.length - 1].data.push(
        othersTxCount / 1e6
      );
    }

    setChartDataPerChain({
      labels,
      datasets: datasetsPerChain,
    });
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false, // Makes the chart fit the screen
    scales: {
      x: {
        type: "time",
        stacked: true,
        time: {
          unit: "week",
          tooltipFormat: "ll",
          displayFormats: {
            week: "MMM D, YYYY",
          },
        },
        title: {
          display: true,
          text: "Weeks",
          color: "#ffffff",
        },
        ticks: {
          color: "#ffffff",
        },
        grid: {
          display: false, // Remove the grid lines
        },
      },
      y: {
        stacked: true,
        title: {
          display: true,
          text: "Transactions (Millions)",
          color: "#ffffff",
        },
        ticks: {
          color: "#ffffff",
        },
        grid: {
          display: false, // Remove the grid lines
        },
      },
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: "#ffffff",
        },
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const label = context.dataset.label || "";
            const value = context.parsed.y || 0;
            return `${label}: ${value.toFixed(2)}M`;
          },
        },
      },
    },
  };

  return (
    <div className="metrics-container">
      <h2 className="metrics-heading">Blockchain Weekly Transactions</h2>
      <div className="metrics-top">
        <div className="text-selectors">
          <span
            className={`metrics-selector ${
              selectedChart === "transactions" ? "active" : ""
            }`}
            onClick={() => setSelectedChart("transactions")}
          >
            Transactions Count
          </span>
          <span
            className={`metrics-selector ${
              selectedChart === "perChain" ? "active" : ""
            }`}
            onClick={() => setSelectedChart("perChain")}
          >
            Transactions Per Chain
          </span>
        </div>
        <div className="stats-cards">
          <div className="stats-card">
            <p>Total Transactions</p>
            <span>9,345,323</span>
            <span>5.2% last week</span>
          </div>
          <div className="stats-card">
            <p>Layer 2 Tx as % of Ethereum</p>
            <span>65% of Ethereum TX</span>
            <span>+23.4% last week</span>
          </div>
        </div>
      </div>
      <div className="transaction-metrics-chart-container">
        {selectedChart === "transactions" && chartData ? (
          <Bar data={chartData} options={options} />
        ) : selectedChart === "perChain" && chartDataPerChain ? (
          <Bar data={chartDataPerChain} options={options} />
        ) : (
          <p style={{ color: "white" }}>Chart is loading...</p>
        )}
      </div>
    </div>
  );
};

export default TransactionMetrics;
