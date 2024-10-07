// ActiveAccountsPage.js

import React, { useState, useEffect } from "react";
import Sidebar from "../Sidebar/Sidebar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUsers } from "@fortawesome/free-solid-svg-icons";
import GelatoLogo from "../assets/logos/raas/Gelato.png";
import "./ActiveAccountsPage.css";
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
  fetchAllActiveAccounts,
} from "../services/googleSheetService";
import { abbreviateNumber } from "../utils/numberFormatter";
import moment from "moment";
// Import IndexedDB functions
import { saveData, getData, clearAllData } from "../services/indexedDBService";

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

// Unique ID for IndexedDB storage
const ACTIVE_ACCOUNTS_DATA_ID = "activeAccountsData";
const SIX_HOURS_IN_MS = 6 * 60 * 60 * 1000; // Cache duration

const ActiveAccountsPage = () => {
  const [currency, setCurrency] = useState("ETH");
  const [timeRange, setTimeRange] = useState("Monthly");
  const [gelatoChains, setGelatoChains] = useState([]);
  const [allChains, setAllChains] = useState([]);
  const [activeAccountsByChainDate, setActiveAccountsByChainDate] = useState(
    {}
  );
  const [chartData, setChartData] = useState(null);
  const [topChains, setTopChains] = useState([]);
  const [totalActiveAccountsByChain, setTotalActiveAccountsByChain] = useState(
    {}
  );
  const [activeAccountsByRaas, setActiveAccountsByRaas] = useState({});
  const [error, setError] = useState(null);
  const [filteredDates, setFilteredDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null); // Last updated timestamp

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  // Function to fetch data (from IndexedDB or API)
  const fetchData = async () => {
    setLoading(true);
    try {
      // Attempt to retrieve data from IndexedDB
      const storedRecord = await getData(ACTIVE_ACCOUNTS_DATA_ID);
      const sixHoursAgo = Date.now() - SIX_HOURS_IN_MS;

      if (
        storedRecord &&
        storedRecord.timestamp > sixHoursAgo &&
        isValidData(storedRecord.data)
      ) {
        // Use stored data if it's recent and valid
        populateStateWithData(storedRecord.data);
        setLastUpdated(new Date(storedRecord.timestamp));
        setLoading(false);
        return;
      }

      // Fetch new data
      const gelatoData = await fetchGelatoSheetData();
      const sheetData = await fetchGoogleSheetData();
      const activeAccountsData = await fetchAllActiveAccounts(sheetData);

      const data = {
        gelatoData,
        sheetData,
        activeAccountsData,
      };

      // Save new data to IndexedDB
      const timestamp = Date.now();
      await saveData(ACTIVE_ACCOUNTS_DATA_ID, data);

      // Update state
      populateStateWithData(data);
      setLastUpdated(new Date(timestamp));
    } catch (error) {
      console.error("Error during data fetching:", error);
      setError("Failed to load active accounts data. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // Function to validate data retrieved from IndexedDB
  const isValidData = (data) => {
    if (!data) return false;
    const { gelatoData, sheetData, activeAccountsData } = data;
    if (
      !gelatoData ||
      !sheetData ||
      !activeAccountsData ||
      !activeAccountsData.activeAccountsByChainDate
    ) {
      return false;
    }
    return true;
  };

  // Handler for refreshing data
  const handleRefresh = async () => {
    setLoading(true);
    try {
      // Clear IndexedDB data
      await clearAllData();

      // Fetch new data
      const gelatoData = await fetchGelatoSheetData();
      const sheetData = await fetchGoogleSheetData();
      const activeAccountsData = await fetchAllActiveAccounts(sheetData);

      const data = {
        gelatoData,
        sheetData,
        activeAccountsData,
      };

      // Save data to IndexedDB with timestamp
      const timestamp = Date.now();
      await saveData(ACTIVE_ACCOUNTS_DATA_ID, data);

      // Update state
      populateStateWithData(data);
      setLastUpdated(new Date(timestamp));
    } catch (error) {
      console.error("Error refreshing data:", error);
      setError(
        "Failed to refresh active accounts data. Please try again later."
      );
    } finally {
      setLoading(false);
    }
  };

  const populateStateWithData = (data) => {
    const { gelatoData, sheetData, activeAccountsData } = data;

    setGelatoChains(gelatoData);
    setAllChains(sheetData);
    setActiveAccountsByChainDate(activeAccountsData.activeAccountsByChainDate);

    const dates = getFilteredDates();
    setFilteredDates(dates);

    // Aggregate data based on the selected time range
    const chainTotals = sheetData
      .map((chain) => {
        const chainName = chain.name?.trim();
        if (!chainName) return null; // Skip if chain name is missing
        const chainActiveAccounts = activeAccountsByChainDate[chainName] || {};
        const activeAccountCounts = dates.map(
          (date) => chainActiveAccounts[date] || 0
        );
        const total = activeAccountCounts.reduce((acc, val) => acc + val, 0);
        return { name: chainName, total };
      })
      .filter((item) => item !== null); // Remove null entries

    chainTotals.sort((a, b) => b.total - a.total);
    const topSevenChains = chainTotals.slice(0, 7).map((chain) => chain.name);
    setTopChains(topSevenChains);

    const totalActiveAccountsByChainData = chainTotals.reduce(
      (acc, { name, total }) => ({ ...acc, [name]: total }),
      {}
    );
    setTotalActiveAccountsByChain(totalActiveAccountsByChainData);

    const activeAccountsByRaasData = sheetData.reduce((acc, chain) => {
      const raasProvider = chain.raas;
      const chainName = chain.name?.trim();
      if (!chainName || !raasProvider) return acc;
      if (!acc[raasProvider]) {
        acc[raasProvider] = 0;
      }
      acc[raasProvider] += totalActiveAccountsByChainData[chainName] || 0;
      return acc;
    }, {});
    setActiveAccountsByRaas(activeAccountsByRaasData);

    // Generate labels and keys for the last six months
    const { labels, keys } = getLastSixMonths();

    // Aggregate active accounts per chain per month
    const activeAccountsByChainMonth = {};
    topSevenChains.forEach((chainName) => {
      const chainActiveAccounts = activeAccountsByChainDate[chainName] || {};
      activeAccountsByChainMonth[chainName] = keys.map((monthKey) => {
        return Object.keys(chainActiveAccounts)
          .filter((date) => moment(date).format("YYYY-MM") === monthKey)
          .reduce((sum, date) => sum + (chainActiveAccounts[date] || 0), 0);
      });
    });

    // Prepare datasets for the line chart
    const datasets = topSevenChains.map((chainName) => ({
      label: chainName,
      data: activeAccountsByChainMonth[chainName],
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

  // Function to handle the toggle between ETH and USD (if applicable)
  const handleToggleCurrency = (selectedCurrency) => {
    setCurrency(selectedCurrency);
  };

  // Function to handle the time range selection
  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
  };

  // Utility functions
  const getColorForChain = (chainName) => {
    // Generate a consistent color for each chain based on its name
    const colors = [
      "#FF6384",
      "#36A2EB",
      "#FFCE56",
      "#4BC0C0",
      "#9966FF",
      "#FF9F40",
      "#C9CBCF",
      "#E7E9ED",
      "#EC6731",
      "#B28AFE",
      "#FF5733",
      "#33FF57",
      "#3357FF",
      "#8E44AD",
      "#2ECC71",
    ];
    let hash = 0;
    for (let i = 0; i < chainName.length; i++) {
      hash = chainName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash) % colors.length;
    return colors[colorIndex];
  };

  // Prepare the data for the bar chart, excluding any provider with zero active accounts
  const filteredActiveAccountsByRaas = Object.keys(activeAccountsByRaas).reduce(
    (acc, provider) => {
      if (activeAccountsByRaas[provider] > 0) {
        acc[provider] = activeAccountsByRaas[provider];
      }
      return acc;
    },
    {}
  );

  // Pie Chart Data
  const pieData = {
    labels: [...Object.keys(totalActiveAccountsByChain).slice(0, 12), "Others"],
    datasets: [
      {
        data: [
          ...Object.values(totalActiveAccountsByChain).slice(0, 12),
          Object.values(totalActiveAccountsByChain)
            .slice(12)
            .reduce((acc, val) => acc + val, 0),
        ],
        backgroundColor: [
          ...Object.keys(totalActiveAccountsByChain)
            .slice(0, 12)
            .map((chain) => getColorForChain(chain)),
          "#808080",
        ],
      },
    ],
  };

  // Bar Chart Data
  const barData = {
    labels: Object.keys(filteredActiveAccountsByRaas),
    datasets: [
      {
        label: "Active Accounts by RaaS Provider",
        data: Object.values(filteredActiveAccountsByRaas),
        backgroundColor: Object.keys(filteredActiveAccountsByRaas).map(
          (provider) => getColorForChain(provider)
        ),
      },
    ],
  };

  return (
    <div className="active-accounts-page">
      <Sidebar />
      <div className="main-content">
        {/* Currency Toggle (if applicable) */}
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

        {/* Active Accounts Header */}
        <div className="active-accounts-header">
          <div className="heading-container">
            <FontAwesomeIcon icon={faUsers} className="icon" />
            <h2>Active Accounts</h2>
          </div>
          <p className="description">
            Tracks the total number of active accounts on the blockchain each
            day
          </p>
        </div>

        {/* Refresh Data Button and Last Updated Timestamp */}
        {!loading && (
          <div className="refresh-section">
            <button onClick={handleRefresh}>Refresh Data</button>
            {lastUpdated && <p>Last Updated: {lastUpdated.toLocaleString()}</p>}
          </div>
        )}

        {/* Error Message */}
        {error && <div className="error-message">{error}</div>}

        {/* Loading Indicator */}
        {loading && <div className="loading">Loading data...</div>}

        {/* Time Range Selector */}
        {!loading && (
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
        )}

        {/* Table and Chart Section */}
        {!loading && (
          <div className="table-chart-container">
            {/* Gelato Chain List */}
            <div className="chain-list">
              {gelatoChains.map((chain, index) => {
                const chainName = chain.name?.trim();
                if (!chainName) return null;
                const chainActiveAccounts =
                  activeAccountsByChainDate[chainName] || {};
                const activeAccountCounts = filteredDates.map(
                  (date) => chainActiveAccounts[date] || 0
                );
                const activeAccountCount = activeAccountCounts.reduce(
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
                    <span className="active-accounts">
                      {abbreviateNumber(activeAccountCount)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Line Chart Section */}
            <div className="line-chart">
              {chartData ? (
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
                        text: `Active Accounts - Last 6 Months`,
                        color: "#FFFFFF",
                      },
                      tooltip: {
                        callbacks: {
                          label: function (context) {
                            return `${
                              context.dataset.label
                            }: ${abbreviateNumber(context.parsed.y)}`;
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
                          text: "Number of Active Accounts",
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
              ) : (
                <div className="chart-placeholder">No data available</div>
              )}
            </div>
          </div>
        )}

        {/* Additional Chart Section */}
        {!loading && (
          <div className="additional-charts">
            <div className="pie-chart">
              <h3>Market Share of Active Accounts by Chain</h3>
              {pieData.datasets[0].data.some((value) => value > 0) ? (
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
                          padding: 20,
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
                            const formattedValue =
                              abbreviateNumber(currentValue);
                            return `${context.label}: ${formattedValue} (${percentage}%)`;
                          },
                        },
                      },
                    },
                  }}
                />
              ) : (
                <div className="chart-placeholder">No data available</div>
              )}
            </div>

            <div className="bar-chart">
              <h3>Active Accounts by RaaS Providers</h3>
              {barData.datasets[0].data.some((value) => value > 0) ? (
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
              ) : (
                <div className="chart-placeholder">No data available</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveAccountsPage;
