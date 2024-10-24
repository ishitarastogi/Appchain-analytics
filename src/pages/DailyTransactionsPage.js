// src/pages/DailyTransactionsPage.js

import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "../Sidebar/Sidebar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChartLine, faSort } from "@fortawesome/free-solid-svg-icons";
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
  fetchAllTransaction,
} from "../services/googleSheetService"; // Adjusted import path
import { abbreviateNumber, formatNumber } from "../utils/numberFormatter";
import moment from "moment";
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
  Filler,
  ArcElement
);

const DAILY_DATA_ID = "dailyTransactionData"; // Unique ID for IndexedDB

const DailyTransactionsPage = () => {
  // State variables
  const [currency, setCurrency] = useState("ETH");
  const [timeUnit, setTimeUnit] = useState("Daily"); // "Daily" or "Monthly"
  const [timeRange, setTimeRange] = useState("Daily"); // Set default to "Daily"
  const [selectedRaas, setSelectedRaas] = useState("All Raas"); // Default is "All Raas"
  const [chartType, setChartType] = useState("absolute"); // 'absolute', 'stacked', 'percentage'
  const [allChains, setAllChains] = useState([]);
  const [transactionsByChainDate, setTransactionsByChainDate] = useState({});
  const [approximateDataByChainDate, setApproximateDataByChainDate] = useState(
    {}
  ); // New state to track approximate data
  const [chartData, setChartData] = useState(null);
  const [chartDates, setChartDates] = useState([]); // State variable for dates
  const [topChains, setTopChains] = useState([]);
  const [topChainsList, setTopChainsList] = useState([]); // Added state for topChainsList
  const [transactionsByRaas, setTransactionsByRaas] = useState({}); // New state for RaaS transactions
  const [tableData, setTableData] = useState([]); // State for table data
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true); // Loading state
  const [totalTransactionsAllChains, setTotalTransactionsAllChains] =
    useState(0);
  const [totalTransactionsTopChains, setTotalTransactionsTopChains] =
    useState(0);
  const [chainColorMap, setChainColorMap] = useState({}); // State for chain colors
  const SIX_HOURS_IN_MS = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

  const raasOptions = [
    "All Raas",
    "Gelato",
    "Conduit",
    "Caldera",
    "Altlayer",
    "Alchemy",
  ];

  const timeRangeOptions = {
    Daily: ["Daily", "90 days", "180 days", "1 Year", "All"],
    Monthly: ["3 Months", "6 Months", "1 Year", "All"],
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true); // Start loading
      try {
        // Retrieve data from IndexedDB
        // await clearAllData(); // Uncomment to clear IndexedDB for testing
        console.log("🔍 Attempting to retrieve data from IndexedDB...");
        const storedRecord = await getData(DAILY_DATA_ID);

        const sixHoursAgo = Date.now() - SIX_HOURS_IN_MS;

        if (storedRecord && storedRecord.timestamp > sixHoursAgo) {
          // Use stored data if it's less than 6 hours old
          console.log("📦 Using cached data from IndexedDB.");
          populateStateWithData(storedRecord.data);
          setLoading(false); // End loading
          return;
        }

        console.log(
          "🚀 Fetching new data from Google Sheets and Block Explorer APIs..."
        );
        // Fetch new data if no valid stored data is available
        const sheetData = await fetchGoogleSheetData();
        const transactionsData = await fetchAllTransaction(sheetData);

        const newData = {
          sheetData,
          transactionsData,
        };

        // Save new data to IndexedDB
        console.log("💾 Saving new data to IndexedDB...");
        await saveData(DAILY_DATA_ID, newData);

        populateStateWithData(newData);
      } catch (error) {
        console.error("❌ Error during data fetching:", error);
        setError("Failed to load transaction data. Please try again later.");
      } finally {
        setLoading(false); // End loading regardless of success or failure
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (allChains.length && Object.keys(transactionsByChainDate).length) {
      updateChartData();
      updateTableData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    allChains,
    transactionsByChainDate,
    timeUnit,
    timeRange,
    selectedRaas,
    chartType,
  ]);

  const populateStateWithData = (data) => {
    const { sheetData, transactionsData } = data;

    // Filter chains with status "Mainnet"
    const mainnetChains = sheetData.filter(
      (chain) => chain.status && chain.status.trim().toLowerCase() === "mainnet"
    );

    setAllChains(mainnetChains);
    setTransactionsByChainDate(transactionsData.transactionsByChainDate);
    setApproximateDataByChainDate(
      transactionsData.approximateDataByChainDate || {}
    );

    // Initialize chainColorMap
    const colorMap = {};
    mainnetChains.forEach((chain, index) => {
      colorMap[chain.name] = getColorByIndex(index);
    });
    setChainColorMap(colorMap);
  };

  const updateChartData = () => {
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
    const dates = timeRange === "Daily" ? getAllDates() : getFilteredDates(); // Show all dates when "Daily" is selected
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
        (date) => transactionsByChainDate[chain.name]?.[date]?.value || 0
      );
      const total = transactionCounts.reduce((acc, val) => acc + val, 0);
      return { name: chain.name, total };
    });

    chainTotals.sort((a, b) => b.total - a.total);
    const topChainsListData = chainTotals.slice(0, 10);
    setTopChainsList(topChainsListData); // Store topChainsList in state
    const topChainsNames = topChainsListData.map((chain) => chain.name);
    setTopChains(topChainsNames);

    const totalTransactionsByDate = {};

    topChainsNames.forEach((chainName) => {
      const chainData = [];
      const chainTransactions = transactionsByChainDate[chainName] || {};

      if (timeUnit === "Daily") {
        dates.forEach((date, idx) => {
          const transactionEntry = chainTransactions[date];
          const value = transactionEntry ? transactionEntry.value : 0;
          chainData.push(value);

          // Aggregate total transactions
          totalTransactionsByDate[date] =
            (totalTransactionsByDate[date] || 0) + value;
        });
      } else {
        const monthlyData = aggregateMonthlyData(chainTransactions, dates);
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
      case "Daily":
        // For Daily, get the most recent non-approximate date
        startDate = findMostRecentNonApproximateDate();
        if (!startDate) {
          console.warn("No non-approximate data found in the last 30 days.");
          return [];
        }
        return [startDate];
      case "90 days":
      case "3 Months":
        dateDifference = 90;
        break;
      case "180 days":
      case "6 Months":
        dateDifference = 180;
        break;
      case "1 Year":
        dateDifference = 365;
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

  const getAllDates = () => {
    const today = moment().format("YYYY-MM-DD");
    // Find the earliest launch date
    const launchDates = allChains
      .filter((chain) => chain.launchDate)
      .map((chain) => moment(new Date(chain.launchDate)).format("YYYY-MM-DD"));
    let startDate;
    if (launchDates.length > 0) {
      startDate = launchDates.reduce((minDate, date) =>
        date < minDate ? date : minDate
      );
    } else {
      startDate = moment().subtract(1, "year").format("YYYY-MM-DD"); // default to 1 year ago
    }

    const dates = [];
    let currentDate = moment(startDate);
    while (currentDate.isSameOrBefore(today, "day")) {
      dates.push(currentDate.format("YYYY-MM-DD"));
      currentDate.add(1, "day");
    }
    return dates;
  };

  const findMostRecentNonApproximateDate = () => {
    let currentDate = moment().subtract(1, "day");
    while (currentDate.isAfter(moment().subtract(30, "days"))) {
      const dateStr = currentDate.format("YYYY-MM-DD");
      const isApproximate = Object.values(approximateDataByChainDate).some(
        (chainData) => chainData[dateStr]
      );
      if (!isApproximate) {
        return dateStr;
      }
      currentDate.subtract(1, "day");
    }
    return null;
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
      monthlyData[monthKey] += chainData[date]?.value || 0;
    });
    return monthlyData;
  };

  // 30-Day Percentage Change Calculation (Fixed)
  const thirtyDayPercentageChanges = useMemo(() => {
    const percentageChanges = {};

    allChains.forEach((chain) => {
      const chainName = chain.name;
      const chainTransactions = transactionsByChainDate[chainName] || {};

      // Define the current 30-day period
      const currentPeriodDates = [];
      for (let i = 1; i <= 30; i++) {
        const dateStr = moment().subtract(i, "days").format("YYYY-MM-DD");
        currentPeriodDates.push(dateStr);
      }

      // Define the previous 30-day period
      const previousPeriodDates = [];
      for (let i = 31; i <= 60; i++) {
        const dateStr = moment().subtract(i, "days").format("YYYY-MM-DD");
        previousPeriodDates.push(dateStr);
      }

      // Filter out approximate dates for current period
      const filteredCurrentDates = currentPeriodDates.filter((date) => {
        return !Object.values(approximateDataByChainDate).some(
          (chainData) => chainData[date]
        );
      });

      // Filter out approximate dates for previous period
      const filteredPreviousDates = previousPeriodDates.filter((date) => {
        return !Object.values(approximateDataByChainDate).some(
          (chainData) => chainData[date]
        );
      });

      // Sum transactions in current period
      const currentSum = filteredCurrentDates.reduce((sum, date) => {
        return sum + (chainTransactions[date]?.value || 0);
      }, 0);

      // Sum transactions in previous period
      const previousSum = filteredPreviousDates.reduce((sum, date) => {
        return sum + (chainTransactions[date]?.value || 0);
      }, 0);

      // Calculate percentage increase
      let percentageIncrease = null;
      if (previousSum > 0) {
        percentageIncrease = ((currentSum - previousSum) / previousSum) * 100;
      } else if (currentSum > 0) {
        percentageIncrease = 100; // From 0 to some value is 100% increase
      } else {
        percentageIncrease = 0; // No change
      }

      percentageChanges[chainName] = percentageIncrease;
    });

    return percentageChanges;
  }, [allChains, transactionsByChainDate, approximateDataByChainDate]);

  const updateTableData = () => {
    const today = moment().format("YYYY-MM-DD");

    // Compute currentPeriodDates and previousPeriodDates based on selected timeRange
    let currentPeriodDates = [];
    let previousPeriodDates = [];

    if (timeRange === "Daily") {
      // For "Daily", get the most recent non-approximate date
      const foundDate = findMostRecentNonApproximateDate();
      if (foundDate) {
        currentPeriodDates = [foundDate];
      } else {
        console.warn("No non-approximate data found in the last 30 days.");
      }

      // For previous period, find the previous non-approximate date
      let currentDate = moment(foundDate).subtract(1, "day");
      let previousFoundDate = null;

      while (currentDate.isAfter(moment().subtract(60, "days"))) {
        const dateStr = currentDate.format("YYYY-MM-DD");
        const isApproximate = Object.values(approximateDataByChainDate).some(
          (chainData) => chainData[dateStr]
        );
        if (!isApproximate) {
          previousFoundDate = dateStr;
          break;
        }
        currentDate.subtract(1, "day");
      }

      if (previousFoundDate) {
        previousPeriodDates = [previousFoundDate];
      }
    } else {
      // For other time ranges, use existing logic
      currentPeriodDates = getFilteredDates().filter((date) => {
        // Exclude approximate dates only if timeRange is "Daily"
        if (timeRange === "Daily") {
          const isApproximate = Object.values(approximateDataByChainDate).some(
            (chainData) => chainData[date]
          );
          return !isApproximate;
        }
        return true;
      });

      // Determine the previous time range
      const startDate = currentPeriodDates[0];
      const endDate = currentPeriodDates[currentPeriodDates.length - 1];
      const dateDifference =
        moment(endDate).diff(moment(startDate), "days") + 1; // Number of days in the current time range

      const previousStartDate = moment(startDate)
        .subtract(dateDifference, "days")
        .format("YYYY-MM-DD");
      const previousEndDate = moment(startDate)
        .subtract(1, "days")
        .format("YYYY-MM-DD");

      // Generate previous dates
      let currentDate = moment(previousStartDate);
      while (currentDate.isSameOrBefore(previousEndDate)) {
        const dateStr = currentDate.format("YYYY-MM-DD");
        previousPeriodDates.push(dateStr);
        currentDate.add(1, "day");
      }
    }

    // Exclude approximate dates from current and previous periods
    currentPeriodDates = currentPeriodDates.filter((date) => {
      const isApproximate = Object.values(approximateDataByChainDate).some(
        (chainData) => chainData[date]
      );
      return !isApproximate;
    });

    previousPeriodDates = previousPeriodDates.filter((date) => {
      const isApproximate = Object.values(approximateDataByChainDate).some(
        (chainData) => chainData[date]
      );
      return !isApproximate;
    });

    let totalTransactionsAllChainsLocal = 0;
    let transactionsByRaasLocal = {};

    // Determine the dates for transactionsByRaas
    let raasPeriodDates;
    if (selectedRaas !== "All Raas") {
      // If a specific RaaS is selected, use "All Time"
      raasPeriodDates = getAllDates();
    } else {
      // Use currentPeriodDates based on selected time range
      raasPeriodDates = currentPeriodDates;
    }

    // Compute transactionsByRaas
    allChains.forEach((chain) => {
      const chainName = chain.name;
      const chainRaas = chain.raas || "N/A";

      const chainTransactions = transactionsByChainDate[chainName] || {};

      // Sum transactions over raasPeriodDates
      const totalTransactions = raasPeriodDates.reduce((sum, date) => {
        const transactionEntry = chainTransactions[date];
        return sum + (transactionEntry ? transactionEntry.value : 0);
      }, 0);

      // Aggregate transactions by RaaS
      if (!transactionsByRaasLocal[chainRaas]) {
        transactionsByRaasLocal[chainRaas] = 0;
      }
      transactionsByRaasLocal[chainRaas] += totalTransactions;
    });

    const tableDataLocal = [];

    // Get the filtered chains based on RaaS selection
    const filteredChains =
      selectedRaas === "All Raas"
        ? allChains
        : allChains.filter(
            (chain) =>
              chain.raas &&
              chain.raas.toLowerCase() === selectedRaas.toLowerCase()
          );

    // For each chain, compute the required data
    filteredChains.forEach((chain) => {
      const chainName = chain.name;
      const chainLogo = chain.logoUrl || ""; // Use logoUrl
      const chainVertical = chain.vertical || "N/A";
      const chainRaas = chain.raas || "N/A"; // Add RaaS data

      const chainTransactions = transactionsByChainDate[chainName] || {};

      // Sum transactions over current period
      const currentTransactions = currentPeriodDates.reduce((sum, date) => {
        const transactionEntry = chainTransactions[date];
        return sum + (transactionEntry ? transactionEntry.value : 0);
      }, 0);

      totalTransactionsAllChainsLocal += currentTransactions;

      // Retrieve the fixed 30-day percentage change
      const percentageIncrease = thirtyDayPercentageChanges[chainName];

      tableDataLocal.push({
        chainName,
        chainLogo,
        chainVertical,
        chainRaas, // Include RaaS
        transactions: currentTransactions,
        percentageIncrease,
        framework: chain.framework || "N/A", // Include Framework
        da: chain.da || "N/A", // Include DA
      });
    });

    // Sort on transactions column
    tableDataLocal.sort((a, b) => b.transactions - a.transactions);

    // Take top 10 chains
    const top10TableData = tableDataLocal.slice(0, 10);

    // Calculate totalTransactionsTopChains
    const totalTransactionsTopChainsLocal = top10TableData.reduce(
      (sum, chain) => sum + chain.transactions,
      0
    );

    setTableData(top10TableData);

    // Update the state variables
    setTotalTransactionsAllChains(totalTransactionsAllChainsLocal);
    setTotalTransactionsTopChains(totalTransactionsTopChainsLocal);
    setTransactionsByRaas(transactionsByRaasLocal); // Updated transactionsByRaas
  };

  // Event Handlers

  const handleRaasChange = (event) => {
    setSelectedRaas(event.target.value);
  };

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
    setTableData([...tableData.reverse()]);
  };

  // Utility functions
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

  const getColorByIndex = (index) => COLORS[index % COLORS.length];

  const getColorForChain = (chainName) => {
    return chainColorMap[chainName] || "#000000"; // default to black if not found
  };

  // Format total transactions
  const formattedTotalTransactions = abbreviateNumber(
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

  const raasPieData = {
    labels: raasLabels,
    datasets: [
      {
        data: raasData,
        backgroundColor: raasColors,
        hoverBackgroundColor: raasColors, // Ensure colors don't change on hover
        borderWidth: 0, // Remove white border
      },
    ],
  };

  // Use useMemo to calculate topChainsPieData including "Other" slice
  const topChainsPieData = useMemo(() => {
    const otherChainsTotal =
      totalTransactionsAllChains - totalTransactionsTopChains;
    if (topChainsList.length === 0) return null;
    const topChainsData = topChainsList.map((chain) => chain.total);
    const topChainsLabels = topChainsList.map((chain) => chain.name);
    topChainsLabels.push("Other");
    topChainsData.push(otherChainsTotal);

    return {
      labels: topChainsLabels,
      datasets: [
        {
          data: topChainsData,
          backgroundColor: topChainsLabels.map((label, index) =>
            label === "Other"
              ? "#999999"
              : getColorForChain(label) || COLORS[index % COLORS.length]
          ),
          hoverBackgroundColor: topChainsLabels.map((label, index) =>
            label === "Other"
              ? "#999999"
              : getColorForChain(label) || COLORS[index % COLORS.length]
          ), // Ensure colors don't change on hover
          borderWidth: 0, // Remove white border
        },
      ],
    };
  }, [topChainsList, totalTransactionsAllChains, totalTransactionsTopChains]);

  // Data for Top Chains Pie Chart is now correctly including "Other"

  const getPeriodLabel = () => {
    if (timeRange === "Daily") {
      return "Yesterday";
    } else if (timeUnit === "Daily") {
      return timeRange;
    } else if (timeUnit === "Monthly") {
      return timeRange;
    } else {
      return "Selected Period";
    }
  };

  const raasPieChartLabel =
    selectedRaas !== "All Raas"
      ? "RaaS Providers Market Share (All Time)"
      : `RaaS Providers Market Share (${getPeriodLabel()})`;

  return (
    <div className="performance-page">
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

            {/* Total Transactions and Percentage Share */}
            <div className="total-transactions-info">
              <p>Total Transactions: {formattedTotalTransactions}</p>
              <p>
                The top 10 chains contribute <strong>{percentageShare}%</strong>{" "}
                of all transactions {getPeriodLabel()}.
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
                    text: `${timeUnit} Transactions - ${
                      timeRange === "Daily" ? "All Time" : timeRange
                    }`,
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
                    stacked:
                      chartType === "stacked" || chartType === "percentage",
                    max: chartType === "percentage" ? 100 : undefined, // Limit y-axis to 100% for percentage chart
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
                          : abbreviateNumber(value, 2);
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
          </div>
        )}

        {/* Table Section */}
        {!loading && (
          <div className="table-section">
            <h3 className="section-title">Top 10 Chains</h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Chain</th>
                    <th>RaaS</th> {/* New RaaS Column */}
                    <th>
                      Transactions ({getPeriodLabel()})
                      <button onClick={handleSort}>
                        <FontAwesomeIcon icon={faSort} />
                      </button>
                    </th>
                    <th>Vertical</th>
                    <th>30d %</th> {/* Fixed 30d % Column */}
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((chain) => (
                    <tr key={chain.chainName}>
                      <td className="chain-name-cell">
                        <img
                          src={chain.chainLogo}
                          alt={chain.chainName}
                          className="chain-logo"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src =
                              "https://www.helika.io/wp-content/uploads/2023/09/proofofplay_logo.png";
                          }}
                        />
                        <div className="chain-name-details">
                          <span className="chain-name">{chain.chainName}</span>
                          <span className="chain-framework">
                            Framework: {chain.framework}
                          </span>
                          <span className="chain-da">DA: {chain.da}</span>
                        </div>
                      </td>
                      <td>{chain.chainRaas}</td> {/* Display RaaS */}
                      <td>{abbreviateNumber(chain.transactions, 2)}</td>
                      <td>{chain.chainVertical}</td>
                      <td
                        className={
                          chain.percentageIncrease >= 0
                            ? "positive"
                            : "negative"
                        }
                      >
                        {chain.percentageIncrease !== null
                          ? chain.percentageIncrease.toFixed(2) + "%"
                          : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pie Charts Section */}
        {!loading && (
          <div className="pie-charts-section">
            <h3 className="section-title">Market Share</h3>
            <div className="pie-charts-container">
              {/* Top Chains Pie Chart */}
              <div className="pie-chart-card">
                <h4>Top 10 Chains Market Share ({getPeriodLabel()})</h4>
                {topChainsPieData && (
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
                              const percentage = totalTransactionsAllChains
                                ? (
                                    (value / totalTransactionsAllChains) *
                                    100
                                  ).toFixed(2)
                                : 0;
                              const formattedValue = abbreviateNumber(value, 2);
                              return `${label}: ${formattedValue} (${percentage}%)`;
                            },
                          },
                        },
                      },
                      hover: {
                        mode: null, // Disable hover interactions if necessary
                      },
                    }}
                  />
                )}
              </div>
              {/* RaaS Pie Chart */}
              <div className="pie-chart-card">
                <h4>{raasPieChartLabel}</h4>
                {raasPieData && (
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
                              const totalRaasTransactions = raasData.reduce(
                                (sum, val) => sum + val,
                                0
                              );
                              const percentage = totalRaasTransactions
                                ? (
                                    (value / totalRaasTransactions) *
                                    100
                                  ).toFixed(2)
                                : 0;
                              const formattedValue = abbreviateNumber(value, 2);
                              return `${label}: ${formattedValue} (${percentage}%)`;
                            },
                          },
                        },
                      },
                      hover: {
                        mode: null, // Disable hover interactions if necessary
                      },
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyTransactionsPage;
