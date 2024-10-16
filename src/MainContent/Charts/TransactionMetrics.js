// src/components/TransactionMetrics/TransactionMetrics.js

import React, { useContext, useEffect, useState } from "react";
import { DataContext } from "../Charts/context/DataContext"; // Import DataContext
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

// Helper function to format numbers with two decimal places
const formatNumber = (num) => {
  if (num >= 1e9) {
    return (num / 1e9).toFixed(2) + "B";
  } else if (num >= 1e6) {
    return (num / 1e6).toFixed(2) + "M";
  } else if (num >= 1e3) {
    return (num / 1e3).toFixed(2) + "K";
  } else {
    return num.toFixed(2);
  }
};

const TransactionMetrics = () => {
  const { transactionData, loading, error } = useContext(DataContext);
  const [selectedChart, setSelectedChart] = useState("transactions");
  const [chartData, setChartData] = useState(null);
  const [chartDataPerChain, setChartDataPerChain] = useState(null);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [percentageIncrease, setPercentageIncrease] = useState(0);

  useEffect(() => {
    if (transactionData) {
      processData(
        transactionData.transactionDataByWeek,
        transactionData.transactionsByChain,
        transactionData.totalTransactionsCombined
      );
    }
  }, [transactionData]);

  const processData = (
    transactionDataByWeek,
    transactionsByChain,
    totalTransactionsCombined
  ) => {
    const weekNumbers = Object.keys(transactionDataByWeek);
    const weekMoments = weekNumbers.map((week) => moment(week, "GGGG-[W]WW"));
    const sortedWeekMoments = weekMoments.sort((a, b) => a - b);
    const startWeek = moment.min(weekMoments);
    const endWeek = moment.max(weekMoments);

    // Generate labels from the earliest week to the current week
    const labels = [];
    let currentWeek = startWeek.clone();
    while (currentWeek.isSameOrBefore(endWeek)) {
      labels.push(currentWeek.format("YYYY-MM-DD"));
      currentWeek.add(1, "week");
    }

    // Total transactions data
    const totalData = labels.map((label) => {
      const weekKey = moment(label).startOf("isoWeek").format("GGGG-[W]WW");
      return transactionDataByWeek[weekKey]
        ? parseFloat(transactionDataByWeek[weekKey].toFixed(2))
        : 0;
    });

    // Round total transactions to two decimal places
    const roundedTotalTransactions = parseFloat(
      totalTransactionsCombined.toFixed(2)
    );
    setTotalTransactions(roundedTotalTransactions);

    // Calculate percentage increase over the last 3 months (13 weeks)
    const last13WeeksData = totalData.slice(-13);
    const totalTx3MonthsAgo = last13WeeksData.reduce((sum, tx) => sum + tx, 0);
    const percentageInc =
      totalTx3MonthsAgo === 0
        ? 0
        : ((roundedTotalTransactions - totalTx3MonthsAgo) / totalTx3MonthsAgo) *
          100;
    setPercentageIncrease(parseFloat(percentageInc.toFixed(2)));

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
      const weekKey = moment(label).startOf("isoWeek").format("GGGG-[W]WW");
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
        // Round transaction count to two decimals
        dataPerChain[chainName][index] = parseFloat(
          chainTransactionCounts[chainName].toFixed(2)
        );
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
        dataPerChain["Others"][index] = parseFloat(othersTxCount.toFixed(2));
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
          font: {
            size: 14,
            weight: "bold",
          },
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
          font: {
            size: 14,
            weight: "bold",
          },
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
        titleColor: "#ffffff",
        bodyColor: "#ffffff",
        backgroundColor: "rgba(0, 0, 0, 0.7)",
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
              style={{ color: percentageIncrease >= 0 ? "#FF3B57" : "#00BCD4" }}
            >
              {percentageIncrease}%{" "}
              {percentageIncrease >= 0 ? "increase" : "decrease"} since last 3
              months
            </span>
          </div>
        </div>
      </div>
      <div className="transaction-metrics-chart-container">
        {loading ? (
          <div className="spinner"></div> // Optional: Add spinner
        ) : error ? (
          <p className="error-text">{error}</p>
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
