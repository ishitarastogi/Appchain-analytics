// src/pages/DailyTransactionsPage.js

import React, { useState, useEffect } from "react";
import Sidebar from "../Sidebar/Sidebar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChartLine } from "@fortawesome/free-solid-svg-icons";
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
  ArcElement, // For Pie Chart
} from "chart.js";
import { Line, Pie } from "react-chartjs-2";
import {
  fetchGoogleSheetData,
  fetchAllTransactions,
} from "../services/googleSheetService";
import { abbreviateNumber, formatNumber } from "../utils/numberFormatter";
import moment from "moment";
import { saveData, getData } from "../services/indexedDBService"; // Import IndexedDB functions

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
  ArcElement // For Pie Chart
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
  const [transactionsByRaas, setTransactionsByRaas] = useState({}); // New state for RaaS transactions
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUnit, timeRange, selectedRaas, chartType]);

  const populateStateWithData = (data) => {
    const { sheetData, transactionsData } = data;

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
    const topChains = chainTotals.slice(0, 10).map((chain) => chain.name);
    setTopChains(topChains);

    const totalTransactionsByDate = {};

    topChains.forEach((chainName) => {
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

  // Calculate total transactions of all chains
  const totalTransactionsAllChains = Object.values(
    transactionsByChainDate
  ).reduce(
    (sum, chainData) =>
      sum +
      Object.values(chainData).reduce((chainSum, val) => chainSum + val, 0),
    0
  );

  // Calculate total transactions for the top 10 chains
  const totalTransactionsTopChains = topChains.reduce((sum, chainName) => {
    return (
      sum +
      (transactionsByChainDate[chainName]
        ? Object.values(transactionsByChainDate[chainName]).reduce(
            (acc, val) => acc + val,
            0
          )
        : 0)
    );
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
  const raasData = Object.values(transactionsByRaas);
  const raasColors = raasLabels.map((raas) => getRandomColor());

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
        {!loading && (
          <div className="line-chart-container">
            {chartData ? (
              <>
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
                    Until now, the total transactions happened by these 10
                    chains are <strong>{percentageShare}%</strong> of total
                    transactions of all the chains till now.
                  </p>
                  <div className="total-transactions-card">
                    <h3>Total Transactions</h3>
                    <p>{formattedTotalTransactions}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="chart-placeholder">No data available</div>
            )}
          </div>
        )}

        {/* RaaS Pie Chart */}
        {!loading && (
          <div className="raas-pie-chart-container">
            <h3>RaaS Providers' Share in Total Transactions</h3>
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
                },
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyTransactionsPage;
