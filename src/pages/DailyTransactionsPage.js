// DailyTransactionsPage.js

import React, { useState, useEffect } from "react";
import Sidebar from "../Sidebar/Sidebar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChartLine } from "@fortawesome/free-solid-svg-icons";
import GelatoLogo from "../assets/logos/raas/Gelato.png";
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
  ArcElement,
  BarElement,
} from "chart.js";
import { Line, Pie, Bar } from "react-chartjs-2";
import { fetchGelatoSheetData } from "../services/googleSheetGelatoService";
import {
  fetchGoogleSheetData,
  fetchAllTransactions,
} from "../services/googleSheetService";
import { abbreviateNumber } from "../utils/numberFormatter";
import moment from "moment";

// Register required components for Chart.js
ChartJS.register(
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement
);

const DailyTransactionsPage = () => {
  const [currency, setCurrency] = useState("ETH");
  const [timeRange, setTimeRange] = useState("Monthly");
  const [gelatoChains, setGelatoChains] = useState([]);
  const [allChains, setAllChains] = useState([]);
  const [transactionsByChain, setTransactionsByChain] = useState({});
  const [transactionsByChainDate, setTransactionsByChainDate] = useState({});
  const [chartData, setChartData] = useState({
    labels: [],
    datasets: [],
  });
  const [topChains, setTopChains] = useState([]);
  const [totalTransactionsByChain, setTotalTransactionsByChain] = useState({});
  const [transactionsByRaas, setTransactionsByRaas] = useState({});
  const [error, setError] = useState(null);
  const [filteredDates, setFilteredDates] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Gelato-specific data
        const gelatoData = await fetchGelatoSheetData();
        setGelatoChains(gelatoData);

        // Fetch data for all chains
        const sheetData = await fetchGoogleSheetData();
        setAllChains(sheetData);

        // Fetch transactions data for all chains
        const transactionsData = await fetchAllTransactions(sheetData);
        setTransactionsByChain(transactionsData.transactionsByChain);
        setTransactionsByChainDate(transactionsData.transactionsByChainDate);

        // Function to get filtered dates based on timeRange
        const getFilteredDates = () => {
          const today = moment();
          let startDate;
          switch (timeRange) {
            case "Daily":
              startDate = today.clone().startOf("day");
              break;
            case "Monthly":
              startDate = today.clone().subtract(1, "months").startOf("day");
              break;
            case "FourMonths":
              startDate = today.clone().subtract(4, "months").startOf("day");
              break;
            case "SixMonths":
              startDate = today.clone().subtract(6, "months").startOf("day");
              break;
            case "All":
              startDate = moment("2000-01-01");
              break;
            default:
              startDate = today.clone().subtract(1, "months").startOf("day");
          }
          const dates = [];
          let currentDate = startDate.clone();
          while (currentDate.isSameOrBefore(today, "day")) {
            dates.push(currentDate.format("YYYY-MM-DD"));
            currentDate.add(1, "day");
          }
          return dates;
        };

        const dates = getFilteredDates();
        setFilteredDates(dates);

        // Calculate transaction counts for each chain based on timeRange
        const chainTotals = sheetData.map((chain) => {
          const transactionCounts = dates.map(
            (date) => transactionsByChainDate[chain.name]?.[date] || 0
          );
          const total = transactionCounts.reduce((acc, val) => acc + val, 0);
          return { name: chain.name, total };
        });

        // Determine Top 7 Chains based on transaction counts
        chainTotals.sort((a, b) => b.total - a.total);
        const topSevenChains = chainTotals
          .slice(0, 7)
          .map((chain) => chain.name);
        setTopChains(topSevenChains);

        // Prepare data for pie and bar charts
        const totalTransactionsByChainData = chainTotals.reduce(
          (acc, { name, total }) => ({ ...acc, [name]: total }),
          {}
        );
        setTotalTransactionsByChain(totalTransactionsByChainData);

        // Calculate transactions by RaaS
        const transactionsByRaasData = sheetData.reduce((acc, chain) => {
          const raasProvider = chain.raas;
          if (!acc[raasProvider]) {
            acc[raasProvider] = 0;
          }
          acc[raasProvider] += totalTransactionsByChainData[chain.name] || 0;
          return acc;
        }, {});
        setTransactionsByRaas(transactionsByRaasData);

        // Prepare line chart data for the last 6 months
        const getLastSixMonthsWeeks = () => {
          const startDate = moment().subtract(6, "months").startOf("isoWeek");
          const endDate = moment().startOf("isoWeek");
          const weeks = [];
          let currentWeek = startDate.clone();
          while (currentWeek.isSameOrBefore(endDate, "week")) {
            weeks.push(currentWeek.format("YYYY-[W]WW"));
            currentWeek.add(1, "weeks");
          }
          return weeks;
        };

        const labels = getLastSixMonthsWeeks();
        const datasets = topSevenChains.map((chainName) => ({
          label: chainName,
          data: labels.map(
            (week) => transactionsByChain[chainName]?.[week] || 0
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

  // Utility functions
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
      Caldera: "#EC6731",
    };
    return colorMap[chainName] || getRandomColor();
  };

  const getRandomColor = () => {
    const letters = "0123456789ABCDEF";
    let color = "#";
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  };

  // Prepare the data for the bar chart, excluding any provider with zero transactions
  const filteredTransactionsByRaas = Object.keys(transactionsByRaas).reduce(
    (acc, provider) => {
      if (transactionsByRaas[provider] > 0) {
        acc[provider] = transactionsByRaas[provider];
      }
      return acc;
    },
    {}
  );

  // Pie Chart Data
  const pieData = {
    labels: [...Object.keys(totalTransactionsByChain).slice(0, 12), "Others"],
    datasets: [
      {
        data: [
          ...Object.values(totalTransactionsByChain).slice(0, 12),
          Object.values(totalTransactionsByChain)
            .slice(12)
            .reduce((acc, val) => acc + val, 0),
        ],
        backgroundColor: [
          ...Object.keys(totalTransactionsByChain)
            .slice(0, 12)
            .map((chain) => getColorForChain(chain)),
          "#808080", // Grey color for 'Others'
        ],
      },
    ],
  };

  // Bar Chart Data
  const barData = {
    labels: Object.keys(filteredTransactionsByRaas),
    datasets: [
      {
        label: "Transaction Count by RaaS Provider",
        data: Object.values(filteredTransactionsByRaas),
        backgroundColor: [
          "#ff3b57", // Gelato
          "#46BDC6", // Conduit
          "#4185F4", // Alchemy
          "#EC6731", // Caldera
          "#B28AFE", // Altlayer
        ].slice(0, Object.keys(filteredTransactionsByRaas).length),
      },
    ],
  };

  return (
    <div className="daily-transactions-page">
      <Sidebar />
      <div className="main-content">
        {/* Currency Toggle */}
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
            <button
              className={timeRange === "FourMonths" ? "active" : ""}
              onClick={() => handleTimeRangeChange("FourMonths")}
            >
              4 Months
            </button>
            <button
              className={timeRange === "SixMonths" ? "active" : ""}
              onClick={() => handleTimeRangeChange("SixMonths")}
            >
              6 Months
            </button>
            <button
              className={timeRange === "All" ? "active" : ""}
              onClick={() => handleTimeRangeChange("All")}
            >
              All
            </button>
          </div>
        </div>

        {/* Table and Chart Section */}
        <div className="table-chart-container">
          {/* Gelato Chain List */}
          <div className="chain-list">
            {gelatoChains.map((chain, index) => {
              const transactionCounts = filteredDates.map(
                (date) => transactionsByChainDate[chain.name]?.[date] || 0
              );
              const transactionCount = transactionCounts.reduce(
                (acc, val) => acc + val,
                0
              );

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
                    position: "bottom",
                    labels: {
                      color: "#FFFFFF",
                    },
                  },
                  title: {
                    display: true,
                    text: `Transactions - Last 6 Months`,
                    color: "#FFFFFF",
                  },
                  tooltip: {
                    callbacks: {
                      label: function (context) {
                        return `${context.dataset.label}: ${abbreviateNumber(
                          context.parsed.y
                        )}`;
                      },
                    },
                    backgroundColor: "rgba(0,0,0,0.7)",
                    titleColor: "#FFFFFF",
                    bodyColor: "#FFFFFF",
                  },
                },
                scales: {
                  x: {
                    title: {
                      display: true,
                      text: "Time (Weeks)",
                      color: "#FFFFFF",
                    },
                    ticks: {
                      color: "#FFFFFF",
                      maxRotation: 0,
                      minRotation: 0,
                    },
                  },
                  y: {
                    title: {
                      display: true,
                      text: "Number of Transactions",
                      color: "#FFFFFF",
                    },
                    ticks: {
                      color: "#FFFFFF",
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

        {/* Additional Chart Section */}
        <div className="additional-charts">
          <div className="pie-chart">
            <h3>Market Share of Each Chain</h3>
            <Pie
              data={pieData}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    position: "bottom",
                    labels: {
                      color: "#FFFFFF",
                    },
                  },
                  tooltip: {
                    callbacks: {
                      label: function (context) {
                        const percentage = (
                          (context.raw /
                            Object.values(totalTransactionsByChain).reduce(
                              (a, b) => a + b,
                              0
                            )) *
                          100
                        ).toFixed(2);
                        const formattedValue = abbreviateNumber(context.raw);
                        return `${context.label}: ${formattedValue} (${percentage}%)`;
                      },
                    },
                  },
                },
              }}
            />
          </div>
          <div className="bar-chart">
            <h3>Transaction Count by RaaS Providers</h3>
            <Bar
              data={barData}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    display: false,
                  },
                  tooltip: {
                    callbacks: {
                      label: function (context) {
                        return abbreviateNumber(context.raw);
                      },
                    },
                  },
                },
                scales: {
                  x: {
                    ticks: {
                      color: "#FFFFFF",
                    },
                  },
                  y: {
                    beginAtZero: true,
                    ticks: {
                      color: "#FFFFFF",
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
