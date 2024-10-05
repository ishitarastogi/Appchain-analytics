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
        // Check local storage for existing data
        const storedData = localStorage.getItem("transactionData");
        const storedTimestamp = localStorage.getItem(
          "transactionDataTimestamp"
        );

        if (storedData && storedTimestamp) {
          const timestamp = JSON.parse(storedTimestamp);
          const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;

          // If data is less than 6 hours old, use it
          if (timestamp > sixHoursAgo) {
            const parsedData = JSON.parse(storedData);
            populateStateWithData(parsedData);
            return;
          }
        }

        // Fetch new data if no valid stored data is available
        const gelatoData = await fetchGelatoSheetData();
        const sheetData = await fetchGoogleSheetData();
        const transactionsData = await fetchAllTransactions(sheetData);

        const newData = {
          gelatoData,
          sheetData,
          transactionsData,
        };

        localStorage.setItem("transactionData", JSON.stringify(newData));
        localStorage.setItem(
          "transactionDataTimestamp",
          JSON.stringify(Date.now())
        );

        populateStateWithData(newData);
      } catch (error) {
        console.error("Error during data fetching:", error);
        setError("Failed to load transaction data. Please try again later.");
      }
    };

    fetchData();
  }, [timeRange]);

  const populateStateWithData = (data) => {
    const { gelatoData, sheetData, transactionsData } = data;

    setGelatoChains(gelatoData);
    setAllChains(sheetData);
    setTransactionsByChain(transactionsData.transactionsByChain);
    setTransactionsByChainDate(transactionsData.transactionsByChainDate);

    const dates = getFilteredDates();
    setFilteredDates(dates);

    // Aggregate data based on the selected time range
    const chainTotals = sheetData.map((chain) => {
      const transactionCounts = dates.map(
        (date) => transactionsByChainDate[chain.name]?.[date] || 0
      );
      const total = transactionCounts.reduce((acc, val) => acc + val, 0);
      return { name: chain.name, total };
    });

    chainTotals.sort((a, b) => b.total - a.total);
    const topSevenChains = chainTotals.slice(0, 7).map((chain) => chain.name);
    setTopChains(topSevenChains);

    const totalTransactionsByChainData = chainTotals.reduce(
      (acc, { name, total }) => ({ ...acc, [name]: total }),
      {}
    );
    setTotalTransactionsByChain(totalTransactionsByChainData);

    const transactionsByRaasData = sheetData.reduce((acc, chain) => {
      const raasProvider = chain.raas;
      if (!acc[raasProvider]) {
        acc[raasProvider] = 0;
      }
      acc[raasProvider] += totalTransactionsByChainData[chain.name] || 0;
      return acc;
    }, {});
    setTransactionsByRaas(transactionsByRaasData);

    // Generate labels and keys for the last six months
    const { labels, keys } = getLastSixMonths();

    // Aggregate transactions per chain per month
    const transactionsByChainMonth = {};
    topSevenChains.forEach((chainName) => {
      transactionsByChainMonth[chainName] = keys.map((monthKey) => {
        return Object.keys(transactionsByChainDate[chainName] || {})
          .filter((date) => moment(date).format("YYYY-MM") === monthKey)
          .reduce(
            (sum, date) =>
              sum + (transactionsByChainDate[chainName][date] || 0),
            0
          );
      });
    });

    // Prepare datasets for the line chart
    const datasets = topSevenChains.map((chainName) => ({
      label: chainName,
      data: transactionsByChainMonth[chainName],
      fill: false,
      borderColor: getColorForChain(chainName),
      backgroundColor: getColorForChain(chainName),
      tension: 0.1,
    }));

    setChartData({
      labels,
      datasets,
    });
  };

  const getFilteredDates = () => {
    const today = moment().format("YYYY-MM-DD");
    let startDate;
    switch (timeRange) {
      case "Daily":
        startDate = today;
        break;
      case "Monthly":
        startDate = moment().subtract(1, "months").format("YYYY-MM-DD");
        break;
      case "FourMonths":
        startDate = moment().subtract(4, "months").format("YYYY-MM-DD");
        break;
      case "SixMonths":
        startDate = moment().subtract(6, "months").format("YYYY-MM-DD");
        break;
      case "All":
        startDate = moment("2000-01-01").format("YYYY-MM-DD");
        break;
      default:
        startDate = moment().subtract(1, "months").format("YYYY-MM-DD");
    }

    const dates = [];
    let currentDate = moment(startDate);
    while (currentDate.isSameOrBefore(today, "day")) {
      dates.push(currentDate.format("YYYY-MM-DD"));
      currentDate.add(1, "day");
    }
    return dates;
  };

  const getLastSixMonths = () => {
    const months = [];
    const keys = [];
    let currentMonth = moment().subtract(5, "months").startOf("month");
    for (let i = 0; i < 6; i++) {
      months.push(currentMonth.format("MMMM"));
      keys.push(currentMonth.format("YYYY-MM"));
      currentMonth.add(1, "month");
    }
    return { labels: months, keys };
  };

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
          </div>
          <div className="time-range-right">
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
                      text: "Months",
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
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: "bottom",
                    labels: {
                      color: "#FFFFFF",
                      padding: 20, // Increased padding between legend labels for better visibility
                    },
                  },
                  datalabels: {
                    color: "#ffffff", // Label color for each slice
                    formatter: (value, context) => {
                      const total = context.dataset.data.reduce(
                        (a, b) => a + b,
                        0
                      );
                      const percentage = ((value / total) * 100).toFixed(1);
                      return `${percentage}%`; // Display percentage on the pie slice
                    },
                    anchor: "end", // Position labels at the end of each slice
                    align: "start", // Align labels slightly towards the inside of each slice
                    font: {
                      weight: "bold",
                      size: 12, // Adjusted label size for better readability
                    },
                  },
                  tooltip: {
                    callbacks: {
                      label: function (context) {
                        const total = context.dataset.data.reduce(
                          (a, b) => a + b,
                          0
                        );
                        const currentValue = context.raw;
                        const percentage = (
                          (currentValue / total) *
                          100
                        ).toFixed(2);
                        const formattedValue = abbreviateNumber(currentValue);
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
