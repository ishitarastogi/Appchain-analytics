// src/pages/DailyTransactionsPage.js

import React, { useState, useEffect } from "react";
import Sidebar from "../Sidebar/Sidebar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChartLine,
  faSortUp,
  faSortDown,
} from "@fortawesome/free-solid-svg-icons";
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
  Filler,
  ArcElement,
} from "chart.js";
import { Line, Pie } from "react-chartjs-2";
import {
  fetchGoogleSheetData,
  fetchAllTransactions,
} from "../services/googleSheetService";
import { abbreviateNumber, formatNumber } from "../utils/numberFormatter";
import moment from "moment";
import { saveData, getData } from "../services/indexedDBService";

// Register required components for Chart.js
ChartJS.register(
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement
);

const DAILY_DATA_ID = "dailyTransactionData"; // Unique ID for IndexedDB

const DailyTransactionsPage = () => {
  // State variables
  const [currency, setCurrency] = useState("ETH");
  const [timeUnit, setTimeUnit] = useState("Daily"); // "Daily" or "Monthly"
  const [timeRange, setTimeRange] = useState("90 days");
  const [selectedRaas, setSelectedRaas] = useState("RaaS"); // Default is "RaaS"
  const [chartType, setChartType] = useState("absolute"); // 'absolute', 'stacked', 'percentage'
  const [allChains, setAllChains] = useState([]);
  const [transactionsByChainDate, setTransactionsByChainDate] = useState({});
  const [chartData, setChartData] = useState(null);
  const [chartDates, setChartDates] = useState([]); // State variable for dates
  const [topChains, setTopChains] = useState([]);
  const [topChainsList, setTopChainsList] = useState([]); // Added state for topChainsList
  const [transactionsByRaas, setTransactionsByRaas] = useState({}); // New state for RaaS transactions
  const [tableData, setTableData] = useState([]); // State for table data
  const [sortConfig, setSortConfig] = useState({
    key: "dailyTransactions",
    direction: "descending",
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true); // Loading state
  const SIX_HOURS_IN_MS = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

  const raasOptions = [
    "RaaS",
    "Gelato",
    "Conduit",
    "Caldera",
    "Altlayer",
    "Alchemy",
  ];

  const timeRangeOptions = {
    Daily: ["90 days", "180 days", "1 Year", "All"],
    Monthly: ["3 Months", "6 Months", "1 Year", "All"],
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true); // Start loading
      try {
        // Retrieve data from IndexedDB
        const storedRecord = await getData(DAILY_DATA_ID);

        const sixHoursAgo = Date.now() - SIX_HOURS_IN_MS;

        if (storedRecord && storedRecord.timestamp > sixHoursAgo) {
          // Use stored data if it's less than 6 hours old
          populateStateWithData(storedRecord.data);
          setLoading(false); // End loading
          return;
        }

        // Fetch new data if no valid stored data is available
        const sheetData = await fetchGoogleSheetData();
        const transactionsData = await fetchAllTransactions(sheetData);

        const newData = {
          sheetData,
          transactionsData,
        };

        // Save new data to IndexedDB
        await saveData(DAILY_DATA_ID, newData);

        populateStateWithData(newData);
      } catch (error) {
        console.error("Error during data fetching:", error);
        setError("Failed to load transaction data. Please try again later.");
      } finally {
        setLoading(false); // End loading regardless of success or failure
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (allChains.length && Object.keys(transactionsByChainDate).length) {
      updateChartData();
    }
  }, [
    allChains,
    transactionsByChainDate,
    timeUnit,
    timeRange,
    selectedRaas,
    chartType,
  ]);

  useEffect(() => {
    if (allChains.length && Object.keys(transactionsByChainDate).length) {
      updateTableData();
    }
  }, [allChains, transactionsByChainDate, selectedRaas, sortConfig]);

  const populateStateWithData = (data) => {
    const { sheetData, transactionsData } = data;

    console.log("Sheet Data:", sheetData);
    console.log("Transactions Data:", transactionsData);

    setAllChains(sheetData);
    setTransactionsByChainDate(transactionsData.transactionsByChainDate);

    // Calculate transactions by RaaS
    const raasTransactions = {};
    sheetData.forEach((chain) => {
      const { raas, name } = chain;
      const chainTransactions = transactionsData.transactionsByChainDate[name];

      if (chainTransactions) {
        const totalChainTransactions = Object.values(chainTransactions).reduce(
          (acc, val) => acc + val,
          0
        );

        if (!raasTransactions[raas]) {
          raasTransactions[raas] = 0;
        }
        raasTransactions[raas] += totalChainTransactions;
      }
    });

    setTransactionsByRaas(raasTransactions);
  };

  const updateChartData = () => {
    // Filter chains based on selected RaaS
    const filteredChains =
      selectedRaas === "RaaS"
        ? allChains
        : allChains.filter(
            (chain) =>
              chain.raas &&
              chain.raas.toLowerCase() === selectedRaas.toLowerCase()
          );

    // Aggregate data based on the selected time range and unit
    const dates = getFilteredDates();
    setChartDates(dates); // Store dates in state for access in tooltips

    // Prepare labels and datasets
    let labels = [];
    const datasets = [];

    if (timeUnit === "Daily") {
      labels = dates.map((date) => moment(date).format("D MMM YYYY"));
    } else {
      const months = getMonthlyLabels(dates);
      labels = months.map((month) =>
        moment(month, "YYYY-MM").format("MMM YYYY")
      );
    }

    const chainTotals = filteredChains.map((chain) => {
      const transactionCounts = dates.map(
        (date) => transactionsByChainDate[chain.name]?.[date] || 0
      );
      const total = transactionCounts.reduce((acc, val) => acc + val, 0);
      return { name: chain.name, total };
    });

    chainTotals.sort((a, b) => b.total - a.total);
    const topChainsList = chainTotals.slice(0, 10);
    setTopChainsList(topChainsList); // Store topChainsList in state
    const topChainsNames = topChainsList.map((chain) => chain.name);
    setTopChains(topChainsNames);

    const totalTransactionsByDate = {};

    topChainsNames.forEach((chainName) => {
      const chainData = [];
      if (timeUnit === "Daily") {
        dates.forEach((date, idx) => {
          const value = transactionsByChainDate[chainName]?.[date] || 0;
          chainData.push(value);

          // Aggregate total transactions
          totalTransactionsByDate[date] =
            (totalTransactionsByDate[date] || 0) + value;
        });
      } else {
        const monthlyData = aggregateMonthlyData(
          transactionsByChainDate[chainName] || {},
          dates
        );
        const months = getMonthlyLabels(dates);
        months.forEach((month) => {
          const value = monthlyData[month] || 0;
          chainData.push(value);

          // Aggregate total transactions
          totalTransactionsByDate[month] =
            (totalTransactionsByDate[month] || 0) + value;
        });
      }

      datasets.push({
        label: chainName,
        data: chainData,
        fill: chartType === "stacked" ? true : false,
        borderColor: getColorForChain(chainName),
        backgroundColor: getColorForChain(chainName),
        tension: 0.1,
      });
    });

    // Adjust datasets for percentage chart
    if (chartType === "percentage") {
      datasets.forEach((dataset) => {
        dataset.data = dataset.data.map((value, idx) => {
          const dateKey =
            timeUnit === "Daily" ? dates[idx] : getMonthlyLabels(dates)[idx];
          const total = totalTransactionsByDate[dateKey] || 1;
          return ((value / total) * 100).toFixed(2);
        });
      });
    }

    setChartData({
      labels,
      datasets,
    });
  };

  const getFilteredDates = () => {
    const today = moment().format("YYYY-MM-DD");
    let startDate;
    let dateDifference;

    switch (timeRange) {
      case "90 days":
        dateDifference = 90;
        break;
      case "180 days":
        dateDifference = 180;
        break;
      case "1 Year":
        dateDifference = 365;
        break;
      case "3 Months":
        dateDifference = 90;
        break;
      case "6 Months":
        dateDifference = 180;
        break;
      case "All":
        // Find the earliest launch date
        const launchDates = allChains
          .filter((chain) => chain.launchDate)
          .map((chain) =>
            moment(new Date(chain.launchDate)).format("YYYY-MM-DD")
          );
        if (launchDates.length > 0) {
          startDate = launchDates.reduce((minDate, date) =>
            date < minDate ? date : minDate
          );
        } else {
          startDate = moment().subtract(1, "year").format("YYYY-MM-DD"); // default to 1 year ago
        }
        break;
      default:
        dateDifference = 90;
    }

    if (dateDifference) {
      startDate = moment()
        .subtract(dateDifference, "days")
        .format("YYYY-MM-DD");
    }

    const dates = [];
    let currentDate = moment(startDate);
    while (currentDate.isSameOrBefore(today, "day")) {
      dates.push(currentDate.format("YYYY-MM-DD"));
      currentDate.add(1, "day");
    }
    return dates;
  };

  const getMonthlyLabels = (dates) => {
    const months = new Set();
    dates.forEach((date) => {
      months.add(moment(date).format("YYYY-MM"));
    });
    const sortedMonths = Array.from(months).sort((a, b) =>
      moment(a).diff(moment(b))
    );
    return sortedMonths;
  };

  const aggregateMonthlyData = (chainData, dates) => {
    const monthlyData = {};
    dates.forEach((date) => {
      const monthKey = moment(date).format("YYYY-MM");
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = 0;
      }
      monthlyData[monthKey] += chainData[date] || 0;
    });
    return monthlyData;
  };

  const updateTableData = () => {
    console.log("Updating table data with current state:", {
      allChains,
      transactionsByChainDate,
      selectedRaas,
      sortConfig,
    });

    const today = moment().format("YYYY-MM-DD");
    const yesterday = moment().subtract(1, "day").format("YYYY-MM-DD");

    // Generate dates for last 60 days
    const fullDates = [];
    let currentDate = moment().subtract(60, "days");
    while (currentDate.isSameOrBefore(today, "day")) {
      fullDates.push(currentDate.format("YYYY-MM-DD"));
      currentDate.add(1, "day");
    }

    const last7Days = fullDates.slice(-7); // Last 7 days
    const previous7Days = fullDates.slice(-14, -7); // Previous 7 days

    const last30Days = fullDates.slice(-30); // Last 30 days
    const previous30Days = fullDates.slice(-60, -30); // Previous 30 days

    const tableData = [];

    // Get the filtered chains based on RaaS selection
    const filteredChains =
      selectedRaas === "RaaS"
        ? allChains
        : allChains.filter(
            (chain) =>
              chain.raas &&
              chain.raas.toLowerCase() === selectedRaas.toLowerCase()
          );

    // For each chain, compute the required data
    filteredChains.forEach((chain) => {
      const chainName = chain.name;
      const chainLogo = chain.logo;
      const chainVertical = chain.vertical || "N/A";

      const chainTransactions = transactionsByChainDate[chainName] || {};

      // Daily transactions (transactions on yesterday)
      const dailyTransactions = chainTransactions[yesterday] || 0;

      // Sum transactions over last 7 days
      const last7DaysTransactions = last7Days.reduce((sum, date) => {
        return sum + (chainTransactions[date] || 0);
      }, 0);

      // Sum transactions over previous 7 days
      const previous7DaysTransactions = previous7Days.reduce((sum, date) => {
        return sum + (chainTransactions[date] || 0);
      }, 0);

      // Calculate 7d percentage increase
      const percentageIncrease7d =
        previous7DaysTransactions > 0
          ? ((last7DaysTransactions - previous7DaysTransactions) /
              previous7DaysTransactions) *
            100
          : last7DaysTransactions > 0
          ? 100
          : 0;

      // Sum transactions over last 30 days
      const last30DaysTransactions = last30Days.reduce((sum, date) => {
        return sum + (chainTransactions[date] || 0);
      }, 0);

      // Sum transactions over previous 30 days
      const previous30DaysTransactions = previous30Days.reduce((sum, date) => {
        return sum + (chainTransactions[date] || 0);
      }, 0);

      // Calculate 30d percentage increase
      const percentageIncrease30d =
        previous30DaysTransactions > 0
          ? ((last30DaysTransactions - previous30DaysTransactions) /
              previous30DaysTransactions) *
            100
          : last30DaysTransactions > 0
          ? 100
          : 0;

      tableData.push({
        chainName: chainName || "Unknown",
        chainLogo: chainLogo || "", // Provide a default logo or leave empty
        chainVertical: chainVertical || "N/A",
        dailyTransactions: dailyTransactions || 0,
        percentageIncrease7d: percentageIncrease7d || 0,
        percentageIncrease30d: percentageIncrease30d || 0,
      });
    });

    // Apply sorting
    if (sortConfig !== null) {
      tableData.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === "ascending" ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === "ascending" ? 1 : -1;
        }
        return 0;
      });
    }

    // Take top 10 chains
    const top10TableData = tableData.slice(0, 10);

    console.log("Final Table Data:", top10TableData);
    setTableData(top10TableData);
  };

  // Event Handlers

  const handleRaasChange = (event) => {
    setSelectedRaas(event.target.value);
  };

  const handleTimeUnitChange = (unit) => {
    setTimeUnit(unit);
    // Update timeRange to default option when time unit changes
    setTimeRange(timeRangeOptions[unit][0]);
  };

  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
  };

  const handleChartTypeChange = (type) => {
    setChartType(type);
  };

  const handleSort = (key) => {
    let direction = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
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
      Alchemy: "#4185F4",
      Gelato: "#ff3b57",
      Conduit: "#46BDC6",
      Altlayer: "#B28AFE",
      Other: "#999999", // Color for 'Other' slice
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

  // Calculate total transactions of all chains
  const totalTransactionsAllChains = allChains.reduce((sum, chain) => {
    const chainTransactions = transactionsByChainDate[chain.name] || {};
    return (
      sum +
      Object.values(chainTransactions).reduce(
        (chainSum, val) => chainSum + val,
        0
      )
    );
  }, 0);

  // Calculate total transactions for the top 10 chains
  const totalTransactionsTopChains = topChainsList.reduce((sum, chain) => {
    return sum + chain.total;
  }, 0);

  // Format total transactions
  const formattedTotalTransactions = formatNumber(
    totalTransactionsAllChains,
    2
  );

  // Calculate percentage share
  const percentageShare = totalTransactionsAllChains
    ? ((totalTransactionsTopChains / totalTransactionsAllChains) * 100).toFixed(
        2
      )
    : 0;

  // Data for RaaS Pie Chart
  const raasLabels = Object.keys(transactionsByRaas);
  const raasData = raasLabels.map((raas) => transactionsByRaas[raas]);
  const raasColors = raasLabels.map((raas) => {
    const colorMap = {
      Gelato: "#ff3b57",
      Conduit: "#46BDC6",
      Alchemy: "#4185F4",
      Caldera: "#EC6731",
      Altlayer: "#B28AFE",
    };
    return colorMap[raas] || getRandomColor();
  });

  const raasPieData = {
    labels: raasLabels,
    datasets: [
      {
        data: raasData,
        backgroundColor: raasColors,
        hoverBackgroundColor: raasColors,
      },
    ],
  };

  // Data for Top Chains Pie Chart
  // Include "Other" as the 11th slice
  const otherChainsTotal =
    totalTransactionsAllChains - totalTransactionsTopChains;
  const topChainsData = topChainsList.map((chain) => chain.total);
  const topChainsLabels = topChainsList.map((chain) => chain.name);
  topChainsLabels.push("Other");
  topChainsData.push(otherChainsTotal);

  const topChainsPieData = {
    labels: topChainsLabels,
    datasets: [
      {
        data: topChainsData,
        backgroundColor: topChainsLabels.map((label) =>
          getColorForChain(label)
        ),
        hoverBackgroundColor: topChainsLabels.map((label) =>
          getColorForChain(label)
        ),
      },
    ],
  };

  return (
    <div className="daily-transactions-page">
      <Sidebar />
      <div className="main-content">
        {/* Header */}
        <div className="transactions-header">
          <div className="heading-container">
            <FontAwesomeIcon icon={faChartLine} className="icon" />
            <div>
              <h2>Daily Transactions</h2>
              <p className="description">
                Tracks the total number of transactions executed on the
                blockchain each day
              </p>
            </div>
          </div>

          {/* RaaS Selection Dropdown */}
          <div className="raas-dropdown">
            <select value={selectedRaas} onChange={handleRaasChange}>
              {raasOptions.map((raas) => (
                <option key={raas} value={raas}>
                  {raas}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Error Message */}
        {error && <div className="error-message">{error}</div>}

        {/* Loading Indicator */}
        {loading && <div className="loading">Loading data...</div>}

        {/* Time Range Selector */}
        {!loading && (
          <>
            <div className="time-range-selector">
              <div className="time-range-left">
                <button
                  className={timeUnit === "Daily" ? "active" : ""}
                  onClick={() => handleTimeUnitChange("Daily")}
                >
                  Daily
                </button>
                <button
                  className={timeUnit === "Monthly" ? "active" : ""}
                  onClick={() => handleTimeUnitChange("Monthly")}
                >
                  Monthly
                </button>
              </div>
              <div className="time-range-right">
                {timeRangeOptions[timeUnit].map((range) => (
                  <button
                    key={range}
                    className={timeRange === range ? "active" : ""}
                    onClick={() => handleTimeRangeChange(range)}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            {/* Chart Type Selector */}
            <div className="chart-type-selector">
              <span
                className={chartType === "absolute" ? "active" : ""}
                onClick={() => handleChartTypeChange("absolute")}
              >
                Absolute
              </span>
              <span
                className={chartType === "stacked" ? "active" : ""}
                onClick={() => handleChartTypeChange("stacked")}
              >
                Stacked
              </span>
              <span
                className={chartType === "percentage" ? "active" : ""}
                onClick={() => handleChartTypeChange("percentage")}
              >
                Percentage
              </span>
            </div>
          </>
        )}

        {/* Line Chart Section */}
        {!loading && chartData && (
          <div className="line-chart-container">
            <Line
              data={chartData}
              options={{
                responsive: true,
                interaction: {
                  mode: "index",
                  intersect: false,
                },
                plugins: {
                  legend: {
                    position: "bottom",
                    labels: {
                      color: "#FFFFFF",
                    },
                  },
                  title: {
                    display: true,
                    text: `Transactions - ${timeRange}`,
                    color: "#FFFFFF",
                  },
                  tooltip: {
                    mode: "index",
                    intersect: false,
                    callbacks: {
                      title: function (context) {
                        let dateLabel = context[0].label;
                        return dateLabel;
                      },
                      label: function (context) {
                        let label = context.dataset.label || "";
                        let value = context.parsed.y;
                        if (chartType === "percentage") {
                          value = value + "%";
                        } else {
                          value = abbreviateNumber(value);
                        }
                        return `${label}: ${value}`;
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
                      text: timeUnit === "Daily" ? "Date" : "Month",
                      color: "#FFFFFF",
                    },
                    ticks: {
                      color: "#FFFFFF",
                      maxRotation: 45,
                      minRotation: 0,
                      autoSkip: true,
                      maxTicksLimit: 10,
                    },
                  },
                  y: {
                    stacked:
                      chartType === "stacked" || chartType === "percentage",
                    title: {
                      display: true,
                      text:
                        chartType === "percentage"
                          ? "Percentage of Total Transactions (%)"
                          : "Number of Transactions",
                      color: "#FFFFFF",
                    },
                    ticks: {
                      color: "#FFFFFF",
                      beginAtZero: true,
                      callback: function (value) {
                        return chartType === "percentage"
                          ? value + "%"
                          : abbreviateNumber(value);
                      },
                    },
                  },
                },
                elements: {
                  point: {
                    radius: 0, // Remove dots from the chart
                  },
                },
              }}
            />
            {/* Information Container Below the Chart */}
            <div className="info-container">
              <p className="percentage-info">
                The top 10 chains contribute <strong>{percentageShare}%</strong>{" "}
                of all transactions so far.
              </p>
              <div className="total-transactions-card">
                <h3>Total Transactions</h3>
                <p>{formattedTotalTransactions}</p>
              </div>
            </div>
          </div>
        )}

        {/* Pie Charts Section */}
        {!loading && (
          <div className="pie-charts-container">
            {/* Top Chains Pie Chart */}
            <div className="pie-chart">
              <h3>Top 10 Chains Market Share</h3>
              {topChainsData && (
                <Pie
                  data={topChainsPieData}
                  options={{
                    plugins: {
                      legend: {
                        position: "right",
                        labels: {
                          color: "#FFFFFF",
                        },
                      },
                      tooltip: {
                        callbacks: {
                          label: function (context) {
                            const label = context.label || "";
                            const value = context.parsed || 0;
                            const percentage = (
                              (value / totalTransactionsAllChains) *
                              100
                            ).toFixed(2);
                            const formattedValue = abbreviateNumber(value);
                            return `${label}: ${formattedValue} (${percentage}%)`;
                          },
                        },
                      },
                    },
                  }}
                />
              )}
            </div>
            {/* RaaS Pie Chart */}
            <div className="pie-chart">
              <h3>RaaS Providers Market Share</h3>
              {raasData && (
                <Pie
                  data={raasPieData}
                  options={{
                    plugins: {
                      legend: {
                        position: "right",
                        labels: {
                          color: "#FFFFFF",
                        },
                      },
                      tooltip: {
                        callbacks: {
                          label: function (context) {
                            const label = context.label || "";
                            const value = context.parsed || 0;
                            const percentage = (
                              (value / totalTransactionsAllChains) *
                              100
                            ).toFixed(2);
                            const formattedValue = abbreviateNumber(value);
                            return `${label}: ${formattedValue} (${percentage}%)`;
                          },
                        },
                      },
                    },
                  }}
                />
              )}
            </div>
          </div>
        )}

        {/* Table Section */}
        {!loading && !error && (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Logo</th>
                  <th>
                    Chain Name{" "}
                    <button onClick={() => handleSort("chainName")}>
                      {sortConfig.key === "chainName" ? (
                        sortConfig.direction === "ascending" ? (
                          <FontAwesomeIcon icon={faSortUp} />
                        ) : (
                          <FontAwesomeIcon icon={faSortDown} />
                        )
                      ) : (
                        <FontAwesomeIcon icon={faSortDown} />
                      )}
                    </button>
                  </th>
                  <th>
                    Daily Transactions{" "}
                    <button onClick={() => handleSort("dailyTransactions")}>
                      {sortConfig.key === "dailyTransactions" ? (
                        sortConfig.direction === "ascending" ? (
                          <FontAwesomeIcon icon={faSortUp} />
                        ) : (
                          <FontAwesomeIcon icon={faSortDown} />
                        )
                      ) : (
                        <FontAwesomeIcon icon={faSortDown} />
                      )}
                    </button>
                  </th>
                  <th>
                    Vertical{" "}
                    <button onClick={() => handleSort("chainVertical")}>
                      {sortConfig.key === "chainVertical" ? (
                        sortConfig.direction === "ascending" ? (
                          <FontAwesomeIcon icon={faSortUp} />
                        ) : (
                          <FontAwesomeIcon icon={faSortDown} />
                        )
                      ) : (
                        <FontAwesomeIcon icon={faSortUp} />
                      )}
                    </button>
                  </th>
                  <th>
                    7d{" "}
                    <button onClick={() => handleSort("percentageIncrease7d")}>
                      {sortConfig.key === "percentageIncrease7d" ? (
                        sortConfig.direction === "ascending" ? (
                          <FontAwesomeIcon icon={faSortUp} />
                        ) : (
                          <FontAwesomeIcon icon={faSortDown} />
                        )
                      ) : (
                        <FontAwesomeIcon icon={faSortDown} />
                      )}
                    </button>
                  </th>
                  <th>
                    30d{" "}
                    <button onClick={() => handleSort("percentageIncrease30d")}>
                      {sortConfig.key === "percentageIncrease30d" ? (
                        sortConfig.direction === "ascending" ? (
                          <FontAwesomeIcon icon={faSortUp} />
                        ) : (
                          <FontAwesomeIcon icon={faSortDown} />
                        )
                      ) : (
                        <FontAwesomeIcon icon={faSortDown} />
                      )}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tableData.length > 0 ? (
                  tableData.map((chain) => (
                    <tr key={chain.chainName}>
                      <td>
                        {chain.chainLogo ? (
                          <img
                            src={chain.chainLogo}
                            alt={chain.chainName}
                            className="chain-logo"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src =
                                "https://via.placeholder.com/40?text=No+Logo";
                            }}
                          />
                        ) : (
                          "No Logo"
                        )}
                      </td>
                      <td>{chain.chainName}</td>
                      <td>{formatNumber(chain.dailyTransactions)}</td>
                      <td>{chain.chainVertical}</td>
                      <td
                        className={
                          chain.percentageIncrease7d >= 0
                            ? "positive"
                            : "negative"
                        }
                      >
                        {chain.percentageIncrease7d.toFixed(2)}%
                      </td>
                      <td
                        className={
                          chain.percentageIncrease30d >= 0
                            ? "positive"
                            : "negative"
                        }
                      >
                        {chain.percentageIncrease30d.toFixed(2)}%
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="6"
                      style={{ textAlign: "center", color: "#cccccc" }}
                    >
                      No data available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyTransactionsPage;
