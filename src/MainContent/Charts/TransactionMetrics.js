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
      const sheetData = await fetchGoogleSheetData();
      const { transactionDataByWeek, transactionsByChain } =
        await fetchAllTransactions(sheetData);

      const startDate = moment("2023-01-01");
      const endDate = moment("2024-09-30");

      const labels = [];
      let currentWeek = startDate.clone().startOf("isoWeek");
      while (currentWeek.isBefore(endDate)) {
        labels.push(currentWeek.format("YYYY-MM-DD"));
        currentWeek.add(1, "week");
      }

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
          },
        ],
      });

      const totalTransactionsPerChain = {};
      for (const chainName in transactionsByChain) {
        totalTransactionsPerChain[chainName] = Object.values(
          transactionsByChain[chainName]
        ).reduce((sum, value) => sum + value, 0);
      }

      const sortedChains = Object.entries(totalTransactionsPerChain)
        .sort((a, b) => b[1] - a[1])
        .map(([chainName]) => chainName);

      const topChains = sortedChains.slice(0, 10);
      const otherChains = sortedChains.slice(10);

      const colorMap = {};
      topChains.forEach((chain, index) => {
        colorMap[chain] = chainColors[index];
      });
      colorMap["Others"] = chainColors[10];

      const datasetsPerChain = topChains.map((chainName, index) => ({
        label: chainName,
        data: labels.map((label) => {
          const weekKey = moment(label).startOf("isoWeek").format("YYYY-WW");
          return transactionsByChain[chainName][weekKey]
            ? transactionsByChain[chainName][weekKey] / 1e6
            : 0;
        }),
        backgroundColor: chainColors[index],
      }));

      const othersData = labels.map((label) => {
        const weekKey = moment(label).startOf("isoWeek").format("YYYY-WW");
        return (
          otherChains.reduce((totalOthers, chainName) => {
            return totalOthers + (transactionsByChain[chainName][weekKey] || 0);
          }, 0) / 1e6
        );
      });

      datasetsPerChain.push({
        label: "Others",
        data: othersData,
        backgroundColor: chainColors[10],
      });

      setChartDataPerChain({
        labels,
        datasets: datasetsPerChain,
      });

      // Cache the data
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ transactionDataByWeek, transactionsByChain })
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
      // Use cached data
      const { transactionDataByWeek, transactionsByChain } = cachedData;
      processCachedData(transactionDataByWeek, transactionsByChain);
    } else {
      fetchAndProcessData();
    }
  }, []);

  const processCachedData = (transactionDataByWeek, transactionsByChain) => {
    const startDate = moment("2023-01-01");
    const endDate = moment("2024-09-30");

    const labels = [];
    let currentWeek = startDate.clone().startOf("isoWeek");
    while (currentWeek.isBefore(endDate)) {
      labels.push(currentWeek.format("YYYY-MM-DD"));
      currentWeek.add(1, "week");
    }

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
        },
      ],
    });

    const totalTransactionsPerChain = {};
    for (const chainName in transactionsByChain) {
      totalTransactionsPerChain[chainName] = Object.values(
        transactionsByChain[chainName]
      ).reduce((sum, value) => sum + value, 0);
    }

    const sortedChains = Object.entries(totalTransactionsPerChain)
      .sort((a, b) => b[1] - a[1])
      .map(([chainName]) => chainName);

    const topChains = sortedChains.slice(0, 10);
    const otherChains = sortedChains.slice(10);

    const datasetsPerChain = topChains.map((chainName, index) => ({
      label: chainName,
      data: labels.map((label) => {
        const weekKey = moment(label).startOf("isoWeek").format("YYYY-WW");
        return transactionsByChain[chainName][weekKey]
          ? transactionsByChain[chainName][weekKey] / 1e6
          : 0;
      }),
      backgroundColor: chainColors[index],
    }));

    const othersData = labels.map((label) => {
      const weekKey = moment(label).startOf("isoWeek").format("YYYY-WW");
      return (
        otherChains.reduce((totalOthers, chainName) => {
          return totalOthers + (transactionsByChain[chainName][weekKey] || 0);
        }, 0) / 1e6
      );
    });

    datasetsPerChain.push({
      label: "Others",
      data: othersData,
      backgroundColor: chainColors[10],
    });

    setChartDataPerChain({
      labels,
      datasets: datasetsPerChain,
    });
  };

  const options = {
    responsive: true,
    scales: {
      x: {
        type: "time",
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
          color: "#444444",
        },
      },
      y: {
        title: {
          display: true,
          text: "Transactions (Millions)",
          color: "#ffffff",
        },
        ticks: {
          color: "#ffffff",
        },
        grid: {
          color: "#444444",
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
          label: (context) => {
            const value = context.parsed.y;
            return `${context.dataset.label}: ${value.toFixed(2)}M`;
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
      <div className="chart-container">
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
