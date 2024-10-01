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
  TimeScale,
} from "chart.js";

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

const TransactionMetrics = () => {
  const [selectedChart, setSelectedChart] = useState("transactions"); // Default chart
  const [chartData, setChartData] = useState(null);
  const [chartDataPerChain, setChartDataPerChain] = useState(null);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [percentageIncrease, setPercentageIncrease] = useState(0);

  const CACHE_KEY = "transactionDataCache";
  const CACHE_EXPIRY_KEY = "transactionDataExpiry";
  const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // Define a consistent color for the "Total Transactions" bar
    const totalBarColor = "#FF3B57"; // Use an existing color from your raasColors or other existing palette

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
          backgroundColor: totalBarColor, // Use the defined color
          barPercentage: 0.6, // Thicker bars
        },
      ],
    });

    // Calculate Total Transactions Till Now
    const totalTx = Object.values(transactionDataByWeek).reduce(
      (sum, tx) => sum + tx,
      0
    );
    setTotalTransactions(totalTx);

    // Calculate Transactions 3 Months Ago (approx. 13 weeks)
    const weeksIn3Months = 13;
    const totalTx3MonthsAgo = weekKeys
      .slice(-weeksIn3Months - 1, -1) // Last 13 weeks excluding the current week
      .reduce((sum, weekKey) => {
        return sum + (transactionDataByWeek[weekKey] || 0);
      }, 0);

    // Calculate Percentage Increase
    const percentageInc =
      totalTx3MonthsAgo === 0
        ? 0
        : ((totalTx - totalTx3MonthsAgo) / totalTx3MonthsAgo) * 100;
    setPercentageIncrease(percentageInc.toFixed(2));

    // For Transactions Per Chain chart

    // Initialize color palette
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

    // Map to store assigned colors
    const colorMap = { Others: "#9E9E9E" }; // Color for 'Others'

    // Build data arrays
    const datasetsPerChain = [];
    const dataPerChain = {}; // { chainName: [weeklyData] }

    // Collect all unique chain names across all weeks (max 10 per week plus "Others")
    const allChainsSet = new Set(["Others"]);

    // Process data week by week
    labels.forEach((label, index) => {
      const weekKey = weekKeys[index];
      const chainTransactionCounts = {};

      // Collect transaction counts for all chains in this week
      for (let chainName in transactionsByChain) {
        const chainData = transactionsByChain[chainName];
        const txCount = chainData[weekKey] || 0;
        if (txCount > 0) {
          chainTransactionCounts[chainName] = txCount;
        }
      }

      // Get top 10 chains for this week
      const topChainsThisWeek = Object.entries(chainTransactionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([chainName]) => chainName);

      // Add top chains to the set
      topChainsThisWeek.forEach((chainName) => allChainsSet.add(chainName));

      // Assign colors to chains if not already assigned
      topChainsThisWeek.forEach((chainName) => {
        if (!colorMap[chainName]) {
          colorMap[chainName] =
            existingColors[
              (Object.keys(colorMap).length - 1) % existingColors.length
            ];
        }
      });

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

    // Sort datasets for stacking order: highest to lowest transactions per week
    // Since we cannot change stacking order per bar in Chart.js, we'll approximate by ordering datasets based on total transactions
    const totalTransactionsPerChain = {};
    allChains.forEach((chainName) => {
      totalTransactionsPerChain[chainName] = dataPerChain[chainName].reduce(
        (sum, val) => sum + val,
        0
      );
    });

    // Ensure "Others" is at the bottom
    const sortedChains = allChains
      .filter((chainName) => chainName !== "Others")
      .sort(
        (a, b) => totalTransactionsPerChain[b] - totalTransactionsPerChain[a]
      );

    // Final stacking order: "Others" at the bottom, then chains in descending order
    const finalChains = ["Others", ...sortedChains];

    finalChains.forEach((chainName) => {
      datasetsPerChain.push({
        label: chainName,
        data: dataPerChain[chainName],
        backgroundColor: colorMap[chainName],
        barPercentage: 0.6, // Thicker bars
      });
    });

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
          display: false, // Remove the grid lines
        },
      },
    },
    plugins: {
      legend: {
        display: false, // Remove the legend
      },
      tooltip: {
        mode: "index",
        intersect: false,
        displayColors: true,
        itemSort: function (a, b) {
          // Ensure 'Others' is at the bottom
          if (a.dataset.label === "Others") return 1;
          if (b.dataset.label === "Others") return -1;
          return b.raw - a.raw; // Sort descending by transaction count
        },
        callbacks: {
          label: function (tooltipItem) {
            const dataset = tooltipItem.dataset;
            const dataIndex = tooltipItem.dataIndex;
            const value = dataset.data[dataIndex];
            // Skip zero values
            if (value === 0) {
              return null;
            }
            const label = dataset.label || "";
            return `${label}: ${formatNumber(value)}`;
          },
          labelColor: function (tooltipItem) {
            return {
              borderColor: tooltipItem.dataset.backgroundColor,
              backgroundColor: tooltipItem.dataset.backgroundColor,
            };
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
            <span
              className="percentage-increase"
              style={{ color: "#FF3B57" }} // Use the same color as the bar
            >
              {percentageIncrease}%{" "}
              {percentageIncrease >= 0 ? "increase" : "decrease"} since last 3
              months
            </span>
          </div>
        </div>
      </div>
      <div className="transaction-metrics-chart-container">
        {selectedChart === "transactions" && chartData ? (
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
