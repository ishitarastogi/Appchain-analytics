// src/components/DailyTransactionsPage.js

import React, { useState, useEffect } from "react";
import Sidebar from "../Sidebar/Sidebar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChartLine } from "@fortawesome/free-solid-svg-icons";
import GelatoLogo from "../assets/logos/raas/Gelato.png"; // Placeholder for RaaS logos
import "./DailyTransactionsPage.css";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import {
  fetchGoogleSheetData,
  fetchAllTransactions,
} from "../services/googleSheetService";
import { abbreviateNumber } from "../utils/numberFormatter";

// Register required components for Chart.js
ChartJS.register(
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend
);

const DailyTransactionsPage = () => {
  const [currency, setCurrency] = useState("ETH"); // Default to ETH
  const [timeRange, setTimeRange] = useState("Daily"); // Default to Daily
  const [gelatoChains, setGelatoChains] = useState([]);
  const [transactionsByChain, setTransactionsByChain] = useState({});
  const [chartData, setChartData] = useState({
    labels: [],
    datasets: [],
  });
  const [topChains, setTopChains] = useState([]);
  const [error, setError] = useState(null);

  // Fetch chain data from Google Sheets when component mounts or timeRange changes
  useEffect(() => {
    const fetchData = async () => {
      try {
        const sheetData = await fetchGoogleSheetData();
        console.log("Fetched Google Sheet data:", sheetData);

        setGelatoChains(sheetData);

        // Fetch transactions data for all Gelato chains based on timeRange
        const transactionsData = await fetchAllTransactions(
          sheetData,
          timeRange
        );
        console.log(
          "Fetched transactions for Gelato chains:",
          transactionsData
        );

        setTransactionsByChain(transactionsData.transactionsByChain);

        // Determine Top 5 Chains based on transaction counts
        const chainTotals = sheetData.map((chain) => {
          const total = Object.values(
            transactionsData.transactionsByChain[chain.name] || {}
          ).reduce((acc, val) => acc + val, 0);
          return { name: chain.name, total };
        });

        // Sort chains by total transactions in descending order
        chainTotals.sort((a, b) => b.total - a.total);

        // Select top 5 chains
        const topFiveChains = chainTotals
          .slice(0, 5)
          .map((chain) => chain.name);
        setTopChains(topFiveChains);
        console.log("Top 5 Chains:", topFiveChains);

        // Prepare data for the chart
        const labels = Object.keys(
          transactionsData.transactionDataByWeek
        ).sort();
        const datasets = topFiveChains.map((chainName) => ({
          label: chainName,
          data: labels.map(
            (week) =>
              transactionsData.transactionsByChain[chainName]?.[week] || 0
          ),
          fill: false,
          borderColor: getColorForChain(chainName),
          backgroundColor: getColorForChain(chainName),
          tension: 0.1,
        }));

        setChartData({
          labels,
          datasets,
        });
      } catch (error) {
        console.error("Error during data fetching:", error);
        setError("Failed to load transaction data. Please try again later.");
      }
    };
    fetchData();
  }, [timeRange]);

  // Function to handle the toggle between ETH and USD
  const handleToggleCurrency = (selectedCurrency) => {
    setCurrency(selectedCurrency);
  };

  // Function to handle the time range selection
  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
  };

  // Utility function to assign consistent colors for each chain
  const getColorForChain = (chainName) => {
    const colorMap = {
      Playnance: "#FF6384",
      Anomaly: "#36A2EB",
      "Aleph Zero": "#FFCE56",
      Everclear: "#4BC0C0",
      Fox: "#9966FF",
      Ethernity: "#FF9F40",
      Camp: "#C9CBCF",
      Gameswift: "#E7E9ED",
      "SX Network": "#36A2EB",
      "Event Horizon": "#FF6384",
      Arenaz: "#FFCE56",
      "Edu Chain": "#4BC0C0",
      // Add more mappings as needed
    };
    return colorMap[chainName] || getRandomColor(); // Default to random color if not mapped
  };

  // Utility function to generate random colors for unmapped chains
  const getRandomColor = () => {
    const letters = "0123456789ABCDEF";
    let color = "#";
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  };

  return (
    <div className="daily-transactions-page">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="main-content">
        {/* Top-right Currency Toggle */}
        <div className="currency-toggle">
          <div className="toggle-container">
            <button
              className={
                currency === "ETH" ? "toggle-option active" : "toggle-option"
              }
              onClick={() => handleToggleCurrency("ETH")}
            >
              ETH
            </button>
            <button
              className={
                currency === "USD" ? "toggle-option active" : "toggle-option"
              }
              onClick={() => handleToggleCurrency("USD")}
            >
              USD
            </button>
          </div>
        </div>

        {/* Transactions Header */}
        <div className="transactions-header">
          <div className="heading-container">
            <FontAwesomeIcon icon={faChartLine} className="icon" />
            <h2>Daily Transactions</h2>
          </div>
          <p className="description">
            Tracks the total number of transactions executed on the blockchain
            each day
          </p>
        </div>

        {/* Error Message */}
        {error && <div className="error-message">{error}</div>}

        {/* Time Range Selector */}
        <div className="time-range-selector">
          <div className="time-range-left">
            <button
              className={timeRange === "Daily" ? "active" : ""}
              onClick={() => handleTimeRangeChange("Daily")}
            >
              Daily
            </button>
            <button
              className={timeRange === "Monthly" ? "active" : ""}
              onClick={() => handleTimeRangeChange("Monthly")}
            >
              Monthly
            </button>
          </div>
          <div className="time-range-right">
            <button
              className={timeRange === "All" ? "active" : ""}
              onClick={() => handleTimeRangeChange("All")}
            >
              All
            </button>
            <button
              className={timeRange === "SixMonths" ? "active" : ""}
              onClick={() => handleTimeRangeChange("SixMonths")}
            >
              6 Months
            </button>
            <button
              className={timeRange === "FourMonths" ? "active" : ""}
              onClick={() => handleTimeRangeChange("FourMonths")}
            >
              4 Months
            </button>
          </div>
        </div>

        {/* Table and Chart Section */}
        <div className="table-chart-container">
          {/* Custom Chain List */}
          <div className="chain-list">
            {gelatoChains.map((chain, index) => {
              // Get the transaction count for the selected time range
              const transactionCount = Object.values(
                transactionsByChain[chain.name] || {}
              ).reduce((acc, val) => acc + val, 0);

              const abbreviatedCount = abbreviateNumber(transactionCount);

              console.log(
                `Chain: ${chain.name}, Time Range: ${timeRange}, Transactions: ${transactionCount}`
              ); // Debugging log

              return (
                <div key={index} className="chain-item">
                  <img
                    src={`https://s2.googleusercontent.com/s2/favicons?domain=${chain.blockScoutUrl}&sz=32`}
                    alt={`${chain.name} Logo`}
                    className="chain-logo"
                  />
                  <span className="chain-name">
                    {chain.name}
                    <img
                      src={GelatoLogo}
                      alt="RaaS Logo"
                      className="raas-logo"
                    />
                  </span>
                  <span className="transactions">
                    {abbreviateNumber(transactionCount)}
                  </span>
                  <span className="purpose">{chain.vertical || "Unknown"}</span>
                </div>
              );
            })}
          </div>

          {/* Line Chart Section */}
          <div className="line-chart">
            <Line
              data={chartData}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    position: "bottom", // Move legend to the bottom
                    labels: {
                      color: "#FFFFFF", // Legend labels in white
                    },
                  },
                  title: {
                    display: true,
                    text: `Transactions - ${timeRange}`,
                    color: "#FFFFFF", // Title in white
                  },
                  tooltip: {
                    callbacks: {
                      label: function (context) {
                        return `${context.dataset.label}: ${abbreviateNumber(
                          context.parsed.y
                        )}`;
                      },
                    },
                    backgroundColor: "rgba(0,0,0,0.7)", // Tooltip background
                    titleColor: "#FFFFFF",
                    bodyColor: "#FFFFFF",
                  },
                },
                scales: {
                  x: {
                    title: {
                      display: true,
                      text: "Time",
                      color: "#FFFFFF", // x-axis title in white
                    },
                    ticks: {
                      color: "#FFFFFF", // x-axis labels in white
                      maxRotation: 0,
                      minRotation: 0,
                    },
                  },
                  y: {
                    title: {
                      display: true,
                      text: "Number of Transactions",
                      color: "#FFFFFF", // y-axis title in white
                    },
                    ticks: {
                      color: "#FFFFFF", // y-axis labels in white
                      beginAtZero: true,
                      callback: function (value) {
                        return abbreviateNumber(value);
                      },
                    },
                  },
                },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyTransactionsPage;
