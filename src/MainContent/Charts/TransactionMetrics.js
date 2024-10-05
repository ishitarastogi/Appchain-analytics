// src/components/TransactionMetrics/TransactionMetrics.js

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
  TimeScale,
} from "chart.js";
import { saveData, getData } from "../../services/indexedDBService";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, TimeScale);

// Helper function to format numbers
const formatNumber = (num) => {
  if (num >= 1e9) {
    return Math.round(num / 1e9) + "B";
  } else if (num >= 1e6) {
    return Math.round(num / 1e6) + "M";
  } else if (num >= 1e3) {
    return Math.round(num / 1e3) + "K";
  } else {
    return num.toString();
  }
};

const CACHE_ID = "transactionMetricsData";
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

const TransactionMetrics = () => {
  const [selectedChart, setSelectedChart] = useState("transactions");
  const [chartData, setChartData] = useState(null);
  const [chartDataPerChain, setChartDataPerChain] = useState(null);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [percentageIncrease, setPercentageIncrease] = useState(0);
  const [loading, setLoading] = useState(true);

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

      const processedData = {
        transactionDataByWeek,
        transactionsByChain,
        totalTransactionsCombined,
      };

      // Save processed data to IndexedDB
      await saveData(CACHE_ID, processedData);

      // Process and set state
      processData(
        transactionDataByWeek,
        transactionsByChain,
        totalTransactionsCombined
      );
    } catch (error) {
      console.error("Error fetching or processing data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    const cachedRecord = await getData(CACHE_ID);
    const now = Date.now();

    if (
      cachedRecord &&
      now - cachedRecord.timestamp < CACHE_DURATION &&
      cachedRecord.data
    ) {
      console.log("Loading data from IndexedDB...");
      const {
        transactionDataByWeek,
        transactionsByChain,
        totalTransactionsCombined,
      } = cachedRecord.data;
      processData(
        transactionDataByWeek,
        transactionsByChain,
        totalTransactionsCombined
      );
      setLoading(false);
    } else {
      console.log("No valid cached data found. Fetching fresh data...");
      await fetchAndProcessData();
    }
  };

  useEffect(() => {
    loadData();

    // Set up periodic updates
    const interval = setInterval(() => {
      console.log("Refreshing data from the server...");
      fetchAndProcessData();
    }, CACHE_DURATION); // Update every 6 hours

    return () => clearInterval(interval);
  }, []);

  const processData = (
    transactionDataByWeek,
    transactionsByChain,
    totalTransactionsCombined
  ) => {
    const weekNumbers = Object.keys(transactionDataByWeek);
    const weekMoments = weekNumbers.map((week) => moment(week, "YYYY-[W]WW"));
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

    // Total transactions data
    const totalData = labels.map((label) => {
      const weekKey = moment(label).startOf("isoWeek").format("YYYY-[W]WW");
      return transactionDataByWeek[weekKey]
        ? transactionDataByWeek[weekKey]
        : 0;
    });

    setChartData({
      labels,
      datasets: [
        {
          label: "Total Weekly Transactions",
          data: totalData,
          backgroundColor: "#FF3B57",
          barPercentage: 0.6,
        },
      ],
    });

    // Total Transactions Calculation
    setTotalTransactions(totalTransactionsCombined);

    const totalTx3MonthsAgo = totalData
      .slice(-13)
      .reduce((sum, tx) => sum + tx, 0);
    const percentageInc =
      totalTx3MonthsAgo === 0
        ? 0
        : ((totalTransactionsCombined - totalTx3MonthsAgo) /
            totalTx3MonthsAgo) *
          100;
    setPercentageIncrease(percentageInc.toFixed(2));

    // Transactions Per Chain Data
    prepareTransactionsPerChainData(transactionsByChain, labels);
  };

  const prepareTransactionsPerChainData = (transactionsByChain, labels) => {
    const datasetsPerChain = [];
    const dataPerChain = {};
    const existingColors = [
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
      "#00BCD4",
      "#CDDC39",
      "#FFC107",
      "#FF5722",
      "#607D8B",
      "#795548",
      "#8E24AA",
      "#D81B60",
      "#5E35B1",
      "#3949AB",
    ];
    const colorMap = { Others: "#9E9E9E" };
    const allChainsSet = new Set(["Others"]);

    // Process each week
    labels.forEach((label, index) => {
      const weekKey = moment(label).startOf("isoWeek").format("YYYY-[W]WW");
      const chainTransactionCounts = {};

      // Collect transaction counts for all chains in this week
      for (let chainName in transactionsByChain) {
        const chainData = transactionsByChain[chainName];
        const txCount = chainData[weekKey] || 0;
        if (txCount > 0) {
          chainTransactionCounts[chainName] = txCount;
        }
      }

      // Top 10 chains for this week
      const topChainsThisWeek = Object.entries(chainTransactionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([chainName]) => chainName);

      topChainsThisWeek.forEach((chainName) => allChainsSet.add(chainName));

      // Initialize dataPerChain for this week
      topChainsThisWeek.forEach((chainName) => {
        if (!dataPerChain[chainName]) {
          dataPerChain[chainName] = new Array(labels.length).fill(0);
        }
        dataPerChain[chainName][index] = chainTransactionCounts[chainName];
      });

      // Calculate 'Others' transactions
      const otherChains = Object.keys(chainTransactionCounts).filter(
        (chainName) => !topChainsThisWeek.includes(chainName)
      );

      const othersTxCount = otherChains.reduce(
        (sum, chainName) => sum + chainTransactionCounts[chainName],
        0
      );

      if (othersTxCount > 0) {
        if (!dataPerChain["Others"]) {
          dataPerChain["Others"] = new Array(labels.length).fill(0);
        }
        dataPerChain["Others"][index] = othersTxCount;
      }
    });

    // Build datasets
    const allChains = Array.from(allChainsSet);

    allChains.forEach((chainName, idx) => {
      datasetsPerChain.push({
        label: chainName,
        data: dataPerChain[chainName],
        backgroundColor:
          colorMap[chainName] || existingColors[idx % existingColors.length],
        barPercentage: 0.6,
      });
    });

    setChartDataPerChain({
      labels,
      datasets: datasetsPerChain,
    });
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
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
          display: false,
        },
      },
      y: {
        stacked: true,
        title: {
          display: true,
          text: "Transactions",
          color: "#ffffff",
        },
        ticks: {
          color: "#ffffff",
          callback: function (value) {
            return formatNumber(value);
          },
        },
        grid: {
          display: false,
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: "index",
        intersect: false,
        callbacks: {
          label: function (tooltipItem) {
            const dataset = tooltipItem.dataset;
            const value = dataset.data[tooltipItem.dataIndex];
            // Only display the label if the value is greater than 0
            if (value > 0) {
              return `${dataset.label}: ${formatNumber(value)}`;
            }
            return ""; // Return an empty string for zero values
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
          <div className="stats-card total-transactions-card">
            <p>Total Transactions</p>
            <span>{formatNumber(totalTransactions)}</span>
            <span className="percentage-increase" style={{ color: "#FF3B57" }}>
              {percentageIncrease}%{" "}
              {percentageIncrease >= 0 ? "increase" : "decrease"} since last 3
              months
            </span>
          </div>
        </div>
      </div>
      <div className="transaction-metrics-chart-container">
        {loading ? (
          <p className="loading-text">Chart is loading...</p>
        ) : selectedChart === "transactions" && chartData ? (
          <Bar data={chartData} options={options} />
        ) : selectedChart === "perChain" && chartDataPerChain ? (
          <Bar data={chartDataPerChain} options={options} />
        ) : (
          <p className="loading-text">Chart is loading...</p>
        )}
      </div>
    </div>
  );
};

export default TransactionMetrics;
