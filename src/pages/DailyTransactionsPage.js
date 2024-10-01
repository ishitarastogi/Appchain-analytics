import React, { useState } from "react";
import Sidebar from "../Sidebar/Sidebar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChartLine } from "@fortawesome/free-solid-svg-icons";
import GelatoLogo from "../assets/logos/raas/Gelato.png"; // Placeholder for chain logos
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
  const [timeRange, setTimeRange] = useState("Daily");

  // Function to handle the toggle between ETH and USD
  const handleToggleCurrency = (selectedCurrency) => {
    setCurrency(selectedCurrency);
  };

  // Function to handle the time range selection
  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
  };

  // Example Chain Data (for demonstration purposes)
  const chainData = [
    {
      name: "Reya",
      logo: GelatoLogo,
      raasProvider: GelatoLogo, // Placeholder for RaaS provider logo
      transactions: "2.5M",
      purpose: "DeFi",
    },
    // Add more chain data as needed
  ];

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

        {/* Daily Transactions Section */}
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
              className={timeRange === "6 Months" ? "active" : ""}
              onClick={() => handleTimeRangeChange("6 Months")}
            >
              6 Months
            </button>
            <button
              className={timeRange === "12 Months" ? "active" : ""}
              onClick={() => handleTimeRangeChange("12 Months")}
            >
              12 Months
            </button>
          </div>
        </div>

        {/* Table and Chart Section */}
        <div className="table-chart-container">
          {/* Custom Chain List */}
          <div className="chain-list">
            {chainData.map((chain, index) => (
              <div key={index} className="chain-item">
                <img
                  src={chain.logo}
                  alt={`${chain.name} Logo`}
                  className="chain-logo"
                />
                <span className="chain-name">
                  {chain.name}
                  <img
                    src={chain.raasProvider}
                    alt="RaaS Logo"
                    className="raas-logo"
                  />
                </span>
                <span className="transactions">{chain.transactions}</span>
                <span className="purpose">{chain.purpose}</span>
              </div>
            ))}
          </div>

          {/* Line Chart Section */}
          <div className="line-chart">
            <Line
              data={{
                labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"], // Placeholder for x-axis labels
                datasets: [
                  {
                    label: "Transactions",
                    data: [1200, 1900, 3000, 5000, 7000, 8000], // Placeholder for y-axis data
                    fill: false,
                    borderColor: "#ff3b57",
                  },
                ],
              }}
              options={{
                responsive: true,
                scales: {
                  x: {
                    title: {
                      display: true,
                      text: "Time",
                    },
                  },
                  y: {
                    title: {
                      display: true,
                      text: "Number of Transactions",
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
