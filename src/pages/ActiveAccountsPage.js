// src/pages/ActiveAccountsPage.js

import React, {
  useState,
  useEffect,
  useMemo,
  Suspense,
  lazy,
  useCallback,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUsers, faSort } from "@fortawesome/free-solid-svg-icons";
import "./DailyTransactionsPage.css";
import {
  fetchGoogleSheetData,
  fetchAllActiveAccounts,
} from "../services/googleSheetService";
import { abbreviateNumber } from "../utils/numberFormatter";
import { saveData, getData, clearAllData } from "../services/indexedDBService";
import { format, subtractDays, isAfter, parseISO, addDays } from "date-fns";
import { FixedSizeList as List } from "react-window";

// Lazy load components
const Sidebar = lazy(() => import("../Sidebar/Sidebar"));
const LineChart = lazy(() => import("../components/LineChart"));
const PieChart = lazy(() => import("../components/PieChart"));

// Constants
const ACTIVE_ACCOUNTS_DATA_ID = "activeAccountsData";
const SIX_HOURS_IN_MS = 6 * 60 * 60 * 1000;

// Color palette
const COLORS = [
  "#FF6384",
  "#36A2EB",
  "#FFCE56",
  "#4BC0C0",
  "#9966FF",
  "#FF9F40",
  "#C9CBCF",
  "#E7E9ED",
  "#7CB342",
  "#D32F2F",
  "#F06292",
  "#BA68C8",
  "#4DD0E1",
  "#9575CD",
  "#7986CB",
  "#81C784",
  "#AED581",
  "#FF8A65",
  "#A1887F",
  "#90A4AE",
  // Add more colors if needed
];

const ActiveAccountsPage = () => {
  // State variables
  const [timeUnit, setTimeUnit] = useState("Daily"); // "Daily" or "Monthly"
  const [timeRange, setTimeRange] = useState("1 Day"); // Set default to "1 Day"
  const [selectedRaas, setSelectedRaas] = useState("All Raas"); // Default is "All Raas"
  const [chartType, setChartType] = useState("absolute"); // 'absolute', 'stacked', 'percentage'
  const [allChains, setAllChains] = useState([]);
  const [activeAccountsByChainDate, setActiveAccountsByChainDate] = useState(
    {}
  );
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chainColorMap, setChainColorMap] = useState({}); // State for chain colors

  const raasOptions = [
    "All Raas",
    "Gelato",
    "Conduit",
    "Caldera",
    "Altlayer",
    "Alchemy",
  ];

  const timeRangeOptions = {
    Daily: ["1 Day", "90 days", "180 days", "1 Year", "All"],
    Monthly: ["3 Months", "6 Months", "1 Year", "All"],
  };

  // Initialize chain colors
  const initializeChainColors = useCallback((chains) => {
    const colorMap = {};
    chains.forEach((chain, index) => {
      colorMap[chain.name] = COLORS[index % COLORS.length];
    });
    setChainColorMap(colorMap);
  }, []);

  // Fetch data on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const storedRecord = await getData(ACTIVE_ACCOUNTS_DATA_ID);
        const sixHoursAgo = Date.now() - SIX_HOURS_IN_MS;

        if (storedRecord && storedRecord.timestamp > sixHoursAgo) {
          populateStateWithData(storedRecord.data);
        } else {
          const sheetData = await fetchGoogleSheetData();
          const activeAccountsData = await fetchAllActiveAccounts(sheetData);
          const newData = { sheetData, activeAccountsData };
          await saveData(ACTIVE_ACCOUNTS_DATA_ID, newData);
          populateStateWithData(newData);
        }
      } catch (err) {
        console.error("Error during data fetching:", err);
        setError(
          "Failed to load active accounts data. Please try again later."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [initializeChainColors]);

  // Populate state with fetched data
  const populateStateWithData = (data) => {
    const { sheetData, activeAccountsData } = data;
    const mainnetChains = sheetData.filter(
      (chain) => chain.status?.trim().toLowerCase() === "mainnet"
    );
    const chainsToUse = mainnetChains.length ? mainnetChains : sheetData;
    setAllChains(chainsToUse);
    setActiveAccountsByChainDate(activeAccountsData.activeAccountsByChainDate);
    initializeChainColors(chainsToUse);
  };

  // Utility functions
  const getFilteredDates = useCallback(() => {
    const today = new Date();
    let startDate;

    switch (timeRange) {
      case "1 Day":
        startDate = subtractDays(today, 1);
        return [format(startDate, "yyyy-MM-dd")];
      case "90 days":
      case "3 Months":
        startDate = subtractDays(today, 90);
        break;
      case "180 days":
      case "6 Months":
        startDate = subtractDays(today, 180);
        break;
      case "1 Year":
        startDate = subtractDays(today, 365);
        break;
      case "All":
        // Find the earliest launch date among chains
        const launchDates = allChains
          .filter((chain) => chain.launchDate)
          .map((chain) => parseISO(chain.launchDate));
        if (launchDates.length > 0) {
          startDate = launchDates.reduce(
            (min, date) => (date < min ? date : min),
            launchDates[0]
          );
        } else {
          startDate = subtractDays(today, 365); // Default to 1 year ago
        }
        break;
      default:
        startDate = subtractDays(today, 90);
    }

    const dates = [];
    let currentDate = startDate;
    while (currentDate <= today) {
      dates.push(format(currentDate, "yyyy-MM-dd"));
      currentDate = addDays(currentDate, 1);
    }
    return dates;
  }, [timeRange, allChains]);

  const getAllDates = useCallback(() => {
    const today = new Date();
    let startDate;

    // Find the earliest launch date among chains
    const launchDates = allChains
      .filter((chain) => chain.launchDate)
      .map((chain) => parseISO(chain.launchDate));
    if (launchDates.length > 0) {
      startDate = launchDates.reduce(
        (min, date) => (date < min ? date : min),
        launchDates[0]
      );
    } else {
      startDate = subtractDays(today, 365); // Default to 1 year ago
    }

    const dates = [];
    let currentDate = startDate;
    while (currentDate <= today) {
      dates.push(format(currentDate, "yyyy-MM-dd"));
      currentDate = addDays(currentDate, 1);
    }
    return dates;
  }, [allChains]);

  const findMostRecentDate = useCallback(() => {
    // Implement your logic to find the most recent date
    // Here, assuming the most recent date is the max key in activeAccountsByChainDate
    const allDates = Object.values(activeAccountsByChainDate)
      .flatMap((dates) => Object.keys(dates))
      .map((dateStr) => parseISO(dateStr))
      .sort((a, b) => b - a);
    return allDates.length > 0 ? format(allDates[0], "yyyy-MM-dd") : null;
  }, [activeAccountsByChainDate]);

  const getMonthlyLabels = useCallback((dates) => {
    const months = new Set();
    dates.forEach((date) => {
      months.add(format(parseISO(date), "yyyy-MM"));
    });
    return Array.from(months).sort();
  }, []);

  const aggregateMonthlyData = useCallback((chainData, dates) => {
    const monthlyData = {};
    dates.forEach((date) => {
      const monthKey = format(parseISO(date), "yyyy-MM");
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = 0;
      }
      monthlyData[monthKey] += chainData[date] || 0;
    });
    return monthlyData;
  }, []);

  // Memoized chart data
  const chartData = useMemo(() => {
    if (!allChains.length || !Object.keys(activeAccountsByChainDate).length)
      return null;

    // Filter chains based on selected RaaS
    const filteredChains =
      selectedRaas === "All Raas"
        ? allChains
        : allChains.filter(
            (chain) =>
              chain.raas &&
              chain.raas.toLowerCase() === selectedRaas.toLowerCase()
          );

    // Aggregate data based on the selected time range and unit
    const dates =
      timeRange === "1 Day" ? [findMostRecentDate()] : getFilteredDates();

    if (!dates || dates.length === 0) return null;

    // Prepare labels
    let labels = [];
    if (timeUnit === "Daily") {
      labels = dates.map((date) => format(parseISO(date), "d MMM yyyy"));
    } else {
      const months = getMonthlyLabels(dates);
      labels = months.map((month) => {
        const [year, mon] = month.split("-");
        return format(parseISO(`${year}-${mon}-01`), "MMM yyyy");
      });
    }

    // Calculate top 10 chains based on total active accounts
    const chainTotals = filteredChains.map((chain) => {
      let total = 0;
      dates.forEach((date) => {
        total += activeAccountsByChainDate[chain.name]?.[date] || 0;
      });
      return { name: chain.name, total };
    });

    chainTotals.sort((a, b) => b.total - a.total);
    const topChainsList = chainTotals.slice(0, 10);
    const topChainsNames = topChainsList.map((chain) => chain.name);

    // Prepare datasets
    const datasets = topChainsNames.map((chainName, index) => {
      const chainData = dates.map(
        (date) => activeAccountsByChainDate[chainName]?.[date] || 0
      );

      if (chartType === "percentage") {
        // Calculate percentage
        const totalActiveAccountsByDate = dates.map(
          (date) =>
            topChainsNames.reduce(
              (sum, name) =>
                sum + (activeAccountsByChainDate[name]?.[date] || 0),
              0
            ) || 1 // Prevent division by zero
        );

        const percentageData = chainData.map((value, idx) =>
          ((value / totalActiveAccountsByDate[idx]) * 100).toFixed(2)
        );

        return {
          label: chainName,
          data: percentageData,
          fill: chartType === "stacked",
          borderColor:
            chainColorMap[chainName] || COLORS[index % COLORS.length],
          backgroundColor:
            chainColorMap[chainName] || COLORS[index % COLORS.length],
          tension: 0.1,
        };
      }

      return {
        label: chainName,
        data: chainData,
        fill: chartType === "stacked",
        borderColor: chainColorMap[chainName] || COLORS[index % COLORS.length],
        backgroundColor:
          chainColorMap[chainName] || COLORS[index % COLORS.length],
        tension: 0.1,
      };
    });

    return {
      labels,
      datasets,
    };
  }, [
    allChains,
    activeAccountsByChainDate,
    selectedRaas,
    timeUnit,
    timeRange,
    chartType,
    chainColorMap,
    findMostRecentDate,
    getFilteredDates,
    getMonthlyLabels,
  ]);

  // Memoized table data
  const tableData = useMemo(() => {
    if (!allChains.length) return [];

    const currentPeriodDates =
      timeRange === "1 Day" ? [findMostRecentDate()] : getFilteredDates();

    // Determine previous period dates
    let previousPeriodDates = [];
    if (timeRange === "1 Day") {
      const previousDate = format(
        subtractDays(parseISO(currentPeriodDates[0]), 1),
        "yyyy-MM-dd"
      );
      previousPeriodDates = [previousDate];
    } else {
      const dateDifference = currentPeriodDates.length;
      const previousStartDate = format(
        subtractDays(parseISO(currentPeriodDates[0]), dateDifference),
        "yyyy-MM-dd"
      );
      const previousEndDate = format(
        subtractDays(parseISO(currentPeriodDates[0]), 1),
        "yyyy-MM-dd"
      );

      let currentDate = parseISO(previousStartDate);
      while (currentDate <= parseISO(previousEndDate)) {
        previousPeriodDates.push(format(currentDate, "yyyy-MM-dd"));
        currentDate = addDays(currentDate, 1);
      }
    }

    // Calculate active accounts by RaaS
    const activeAccountsByRaas = {};
    allChains.forEach((chain) => {
      const chainName = chain.name;
      const chainRaas = chain.raas || "N/A";

      const chainActiveAccounts = activeAccountsByChainDate[chainName] || {};

      const totalActiveAccounts = (
        selectedRaas === "All Raas" ? currentPeriodDates : getAllDates()
      ).reduce((sum, date) => sum + (chainActiveAccounts[date] || 0), 0);

      if (!activeAccountsByRaas[chainRaas]) {
        activeAccountsByRaas[chainRaas] = 0;
      }
      activeAccountsByRaas[chainRaas] += totalActiveAccounts;
    });

    // Compute table data
    const table = allChains.map((chain) => {
      const chainName = chain.name;
      const chainLogo = chain.logoUrl || "";
      const chainVertical = chain.vertical || "N/A";
      const chainRaas = chain.raas || "N/A";
      const chainFramework = chain.framework || "N/A";
      const chainDA = chain.da || "N/A";

      const chainActiveAccounts = currentPeriodDates.reduce(
        (sum, date) =>
          sum + (activeAccountsByChainDate[chainName]?.[date] || 0),
        0
      );

      // Compute percentage increase
      const currentSum = currentPeriodDates.reduce(
        (sum, date) =>
          sum + (activeAccountsByChainDate[chainName]?.[date] || 0),
        0
      );
      const previousSum = previousPeriodDates.reduce(
        (sum, date) =>
          sum + (activeAccountsByChainDate[chainName]?.[date] || 0),
        0
      );

      let percentageIncrease = 0;
      if (previousSum > 0) {
        percentageIncrease = ((currentSum - previousSum) / previousSum) * 100;
      } else if (currentSum > 0) {
        percentageIncrease = 100;
      }

      return {
        chainName,
        chainLogo,
        chainVertical,
        raas: chainRaas,
        activeAccounts: chainActiveAccounts,
        percentageIncrease: percentageIncrease || 0,
        framework: chainFramework,
        DA: chainDA,
      };
    });

    // Filter based on selected RaaS
    const filteredTable =
      selectedRaas === "All Raas"
        ? table
        : table.filter(
            (chain) =>
              chain.raas &&
              chain.raas.toLowerCase() === selectedRaas.toLowerCase()
          );

    // Sort by active accounts descending
    filteredTable.sort((a, b) => b.activeAccounts - a.activeAccounts);

    // Take top 10
    return filteredTable.slice(0, 10);
  }, [
    allChains,
    activeAccountsByChainDate,
    selectedRaas,
    timeRange,
    findMostRecentDate,
    getFilteredDates,
    getAllDates,
  ]);

  // Calculate total active accounts and percentage share
  const totalActiveAccounts = useMemo(() => {
    return tableData.reduce((sum, chain) => sum + chain.activeAccounts, 0);
  }, [tableData]);

  const percentageShare = useMemo(() => {
    const total = tableData.reduce(
      (sum, chain) => sum + chain.activeAccounts,
      0
    );
    // Assuming 'totalActiveAccountsAllChains' is same as 'total' since tableData contains top 10
    // Adjust if you have a separate total for all chains
    return total ? ((total / total) * 100).toFixed(2) : "0.00";
  }, [tableData]);

  // Data for RaaS Pie Chart
  const raasPieData = useMemo(() => {
    const raasLabels = Object.keys(
      tableData.reduce((acc, chain) => {
        acc[chain.raas] = (acc[chain.raas] || 0) + chain.activeAccounts;
        return acc;
      }, {})
    );

    const raasData = raasLabels.map((raas) => {
      return tableData
        .filter((chain) => chain.raas === raas)
        .reduce((sum, chain) => sum + chain.activeAccounts, 0);
    });

    const raasColors = raasLabels.map((raas, index) => {
      const colorMap = {
        Gelato: "#ff3b57",
        Conduit: "#46BDC6",
        Alchemy: "#4185F4",
        Caldera: "#EC6731",
        Altlayer: "#B28AFE",
      };
      return colorMap[raas] || COLORS[index % COLORS.length];
    });

    return {
      labels: raasLabels,
      datasets: [
        {
          data: raasData,
          backgroundColor: raasColors,
          borderColor: "#FFFFFF",
          hoverBackgroundColor: raasColors,
          hoverBorderColor: "#FFFFFF",
          borderWidth: 1,
          hoverOffset: 0,
        },
      ],
    };
  }, [tableData]);

  // Data for Top Chains Pie Chart
  const topChainsPieData = useMemo(() => {
    const topChains = tableData.map((chain) => chain.activeAccounts);
    const otherChainsTotal = 0; // Since tableData already contains top 10

    const topChainsLabels = tableData.map((chain) => chain.chainName);
    // If you have more chains beyond top 10, include "Other"
    // For simplicity, assuming tableData contains top 10 only

    return {
      labels: topChainsLabels,
      datasets: [
        {
          data: topChains,
          backgroundColor: topChainsLabels.map(
            (label, index) =>
              chainColorMap[label] || COLORS[index % COLORS.length]
          ),
          borderColor: "#FFFFFF",
          hoverBackgroundColor: topChainsLabels.map(
            (label, index) =>
              chainColorMap[label] || COLORS[index % COLORS.length]
          ),
          hoverBorderColor: "#FFFFFF",
          borderWidth: 1,
          hoverOffset: 0,
        },
      ],
    };
  }, [tableData, chainColorMap]);

  // Chart options
  const lineChartOptions = useMemo(
    () => ({
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
          text: `Active Accounts - ${
            timeRange === "1 Day" ? "All Time" : timeRange
          }`,
          color: "#FFFFFF",
        },
        tooltip: {
          mode: "index",
          intersect: false,
          callbacks: {
            title: function (context) {
              return context[0].label;
            },
            label: function (context) {
              let label = context.dataset.label || "";
              let value = context.parsed.y;
              if (chartType === "percentage") {
                value = `${value}%`;
              } else {
                value = abbreviateNumber(value, 2);
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
          stacked: chartType === "stacked" || chartType === "percentage",
          max: chartType === "percentage" ? 100 : undefined,
          title: {
            display: true,
            text:
              chartType === "percentage"
                ? "Percentage of Total Active Accounts (%)"
                : "Number of Active Accounts",
            color: "#FFFFFF",
          },
          ticks: {
            color: "#FFFFFF",
            beginAtZero: true,
            callback: function (value) {
              return chartType === "percentage"
                ? `${value}%`
                : abbreviateNumber(value, 2);
            },
          },
        },
      },
      elements: {
        point: {
          radius: 0,
        },
      },
      hover: {
        onHover: function (event) {
          event.native.target.style.cursor = "default"; // Prevent pointer cursor
        },
      },
      animation: {
        duration: 0, // Disable animations to prevent color changes
      },
    }),
    [timeUnit, timeRange, chartType]
  );

  const pieChartOptions = useMemo(
    () => ({
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
              const total = context.dataset.data.reduce(
                (sum, val) => sum + val,
                0
              );
              const percentage = total
                ? ((value / total) * 100).toFixed(2)
                : "0.00";
              const formattedValue = abbreviateNumber(value, 2);
              return `${label}: ${formattedValue} (${percentage}%)`;
            },
          },
        },
      },
      hover: {
        mode: null, // Disable hover interactions if necessary
      },
    }),
    []
  );

  // Event Handlers
  const handleRaasChange = (e) => setSelectedRaas(e.target.value);

  const handleTimeUnitChange = (unit) => {
    setTimeUnit(unit);
    // Keep the current timeRange unless it's not available
    if (!timeRangeOptions[unit].includes(timeRange)) {
      setTimeRange(timeRangeOptions[unit][0]);
    }
  };

  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
  };

  const handleChartTypeChange = (type) => {
    setChartType(type);
  };

  const handleSort = () => {
    // Reverse the order of tableData
    setTableData([...tableData].reverse());
  };

  // Virtualized Table Row
  const Row = ({ index, style }) => {
    const chain = tableData[index];
    return (
      <tr style={style} key={chain.chainName}>
        <td className="chain-name-cell">
          <img
            src={chain.chainLogo}
            alt={chain.chainName}
            className="chain-logo"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "https://via.placeholder.com/40?text=No+Image"; // Fallback URL
            }}
          />
          <div className="chain-name-details">
            <span className="chain-name">{chain.chainName}</span>
            <span className="chain-framework">
              Framework: {chain.framework}
            </span>
            <span className="chain-da">DA: {chain.DA}</span>
          </div>
        </td>
        <td>{chain.raas}</td>
        <td>{abbreviateNumber(chain.activeAccounts, 2)}</td>
        <td>{chain.chainVertical}</td>
        <td className={chain.percentageIncrease >= 0 ? "positive" : "negative"}>
          {chain.percentageIncrease.toFixed(2)}%
        </td>
      </tr>
    );
  };

  return (
    <div className="performance-page">
      <Suspense fallback={<div>Loading Sidebar...</div>}>
        <Sidebar />
      </Suspense>
      <div className="main-content">
        {/* Header */}
        <div className="transactions-header">
          <div className="heading-container">
            <FontAwesomeIcon icon={faUsers} className="icon" />
            <div>
              <h2>Active Accounts</h2>
              <p className="description">
                Tracks the total number of active accounts on the blockchain
                each day
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

        {/* Main Content */}
        {!loading && (
          <>
            {/* Time Range Selector */}
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

            {/* Total Active Accounts and Percentage Share */}
            <div className="total-transactions-info">
              <p>
                Total Active Accounts:{" "}
                {abbreviateNumber(totalActiveAccounts, 2)}
              </p>
              <p>
                The top 10 chains contribute <strong>{percentageShare}%</strong>{" "}
                of all active accounts{" "}
                {timeRange === "1 Day" ? "Yesterday" : timeRange}.
              </p>
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

            {/* Charts */}
            <div className="charts-container">
              {/* Line Chart */}
              <Suspense fallback={<div>Loading Line Chart...</div>}>
                {chartData && (
                  <div className="line-chart-container">
                    <LineChart data={chartData} options={lineChartOptions} />
                  </div>
                )}
              </Suspense>

              {/* Pie Charts */}
              <Suspense fallback={<div>Loading Pie Charts...</div>}>
                <div className="pie-charts-container">
                  {/* RaaS Pie Chart */}
                  <div className="pie-chart-card">
                    <h4>
                      {selectedRaas !== "All Raas"
                        ? "RaaS Providers Market Share (All Time)"
                        : `RaaS Providers Market Share (${timeRange})`}
                    </h4>
                    <PieChart data={raasPieData} options={pieChartOptions} />
                  </div>

                  {/* Top Chains Pie Chart */}
                  <div className="pie-chart-card">
                    <h4>Top 10 Chains Market Share ({timeRange})</h4>
                    <PieChart
                      data={topChainsPieData}
                      options={pieChartOptions}
                    />
                  </div>
                </div>
              </Suspense>
            </div>

            {/* Table Section */}
            <div className="table-section">
              <h3 className="section-title">Top 10 Chains</h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Chain</th>
                      <th>RaaS</th>
                      <th>
                        Active Accounts (
                        {timeRange === "1 Day" ? "Yesterday" : timeRange})
                        <button onClick={handleSort}>
                          <FontAwesomeIcon icon={faSort} />
                        </button>
                      </th>
                      <th>Vertical</th>
                      <th>30d %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.length > 0 ? (
                      <List
                        height={400}
                        itemCount={tableData.length}
                        itemSize={70} // Adjust based on row height
                        width="100%"
                      >
                        {Row}
                      </List>
                    ) : (
                      <tr>
                        <td colSpan="5">No data available.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ActiveAccountsPage;
