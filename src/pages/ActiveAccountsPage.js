// src/pages/ActiveAccountsPage.js

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  lazy,
  Suspense,
} from "react";
import Sidebar from "../Sidebar/Sidebar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUsers, faSort } from "@fortawesome/free-solid-svg-icons";
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
import {
  fetchGoogleSheetData,
  fetchAllActiveAccounts,
} from "../services/googleSheetService";
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

// Lazy load Line and Pie components
const Line = lazy(() =>
  import("react-chartjs-2").then((module) => ({ default: module.Line }))
);
const Pie = lazy(() =>
  import("react-chartjs-2").then((module) => ({ default: module.Pie }))
);

const ACTIVE_ACCOUNTS_DATA_ID = "activeAccountsData"; // Unique ID for IndexedDB
const SIX_HOURS_IN_MS = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

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
  const [sortOrder, setSortOrder] = useState("desc"); // 'asc' or 'desc'

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

  const getColorByIndex = useCallback(
    (index) => COLORS[index % COLORS.length],
    []
  );

  const getColorForChain = useCallback(
    (chainName) => {
      return chainColorMap[chainName] || "#000000"; // default to black if not found
    },
    [chainColorMap]
  );

  // Event Handlers with useCallback
  const handleRaasChange = useCallback((event) => {
    setSelectedRaas(event.target.value);
  }, []);

  const handleTimeUnitChange = useCallback(
    (unit) => {
      setTimeUnit(unit);
      if (!timeRangeOptions[unit].includes(timeRange)) {
        setTimeRange(timeRangeOptions[unit][0]);
      }
    },
    [timeRange, timeRangeOptions]
  );

  const handleTimeRangeChange = useCallback((range) => {
    setTimeRange(range);
  }, []);

  const handleChartTypeChange = useCallback((type) => {
    setChartType(type);
  }, []);

  const handleSort = useCallback(() => {
    setSortOrder((prevSortOrder) => (prevSortOrder === "asc" ? "desc" : "asc"));
  }, []);

  // Helper Functions

  const getAllDates = useCallback(() => {
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
  }, [allChains]);

  const getFilteredDates = useCallback(() => {
    const today = moment().format("YYYY-MM-DD");
    let startDate;
    let dateDifference;

    switch (timeRange) {
      case "1 Day":
        // For 1 Day, get the most recent date
        startDate = findMostRecentDate();
        if (!startDate) {
          console.warn("No data found in the last 30 days.");
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
  }, [timeRange, allChains, findMostRecentDate]);

  const findMostRecentDate = useCallback(() => {
    const datesSet = new Set();
    Object.values(activeAccountsByChainDate).forEach((chainData) => {
      Object.keys(chainData).forEach((date) => datesSet.add(date));
    });
    const allDates = Array.from(datesSet).sort((a, b) =>
      moment(b).diff(moment(a))
    );
    return allDates[0] || null;
  }, [activeAccountsByChainDate]);

  const getMonthlyLabels = useCallback((dates) => {
    const months = new Set();
    dates.forEach((date) => {
      months.add(moment(date).format("YYYY-MM"));
    });
    const sortedMonths = Array.from(months).sort((a, b) =>
      moment(a).diff(moment(b))
    );
    return sortedMonths;
  }, []);

  const aggregateMonthlyData = useCallback((chainData, dates) => {
    const monthlyData = {};
    dates.forEach((date) => {
      const monthKey = moment(date).format("YYYY-MM");
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = 0;
      }
      monthlyData[monthKey] += chainData[date] || 0;
    });
    return monthlyData;
  }, []);

  const populateStateWithData = useCallback(
    (data) => {
      const { sheetData, activeAccountsData } = data;

      // Filter chains with status "Mainnet" (if applicable)
      const mainnetChains = sheetData.filter(
        (chain) =>
          chain.status && chain.status.trim().toLowerCase() === "mainnet"
      );

      // If 'status' is not available, use all chains
      const chainsToUse = mainnetChains.length ? mainnetChains : sheetData;

      setAllChains(chainsToUse);
      setActiveAccountsByChainDate(
        activeAccountsData.activeAccountsByChainDate
      );

      // Initialize chainColorMap
      const colorMap = {};
      chainsToUse.forEach((chain, index) => {
        colorMap[chain.name] = getColorByIndex(index);
      });
      setChainColorMap(colorMap);
    },
    [getColorByIndex]
  );

  // Data Fetching
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // await clearAllData(); // Clear all data in IndexedDB (Uncomment if needed)

        const storedRecord = await getData(ACTIVE_ACCOUNTS_DATA_ID);

        const sixHoursAgo = Date.now() - SIX_HOURS_IN_MS;

        if (storedRecord && storedRecord.timestamp > sixHoursAgo) {
          // Use stored data if it's less than 6 hours old
          populateStateWithData(storedRecord.data);
          setLoading(false);
          return;
        }

        // Fetch new data if no valid stored data is available
        const sheetData = await fetchGoogleSheetData();
        const activeAccountsData = await fetchAllActiveAccounts(sheetData);

        const newData = {
          sheetData,
          activeAccountsData,
        };

        // Save new data to IndexedDB
        await saveData(ACTIVE_ACCOUNTS_DATA_ID, newData);

        populateStateWithData(newData);
      } catch (error) {
        console.error("Error during data fetching:", error);
        setError(
          "Failed to load active accounts data. Please try again later."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [populateStateWithData]);

  // Memoized Chart Data
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
    const dates = timeRange === "1 Day" ? getAllDates() : getFilteredDates();

    if (dates.length === 0) return null;

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

    // Calculate total active accounts per date for percentage chart
    const totalActiveAccountsByDate = {};

    const chainDataMap = {};

    filteredChains.forEach((chain) => {
      const chainName = chain.name;
      chainDataMap[chainName] = dates.map(
        (date) => activeAccountsByChainDate[chainName]?.[date] || 0
      );
    });

    // Calculate totals
    filteredChains.forEach((chain) => {
      const chainName = chain.name;
      chainDataMap[chainName].forEach((value, idx) => {
        const dateKey =
          timeUnit === "Daily" ? dates[idx] : getMonthlyLabels(dates)[idx];
        totalActiveAccountsByDate[dateKey] =
          (totalActiveAccountsByDate[dateKey] || 0) + value;
      });
    });

    // Sort chains by total active accounts
    const chainTotals = filteredChains.map((chain) => {
      const total = chainDataMap[chain.name].reduce((acc, val) => acc + val, 0);
      return { name: chain.name, total };
    });

    chainTotals.sort((a, b) => b.total - a.total);
    const topChainsListMemo = chainTotals.slice(0, 10);
    const topChainsNames = topChainsListMemo.map((chain) => chain.name);

    // Prepare datasets
    topChainsNames.forEach((chainName) => {
      const chainData = chainDataMap[chainName].map((value, idx) => {
        if (chartType === "percentage") {
          const dateKey =
            timeUnit === "Daily" ? dates[idx] : getMonthlyLabels(dates)[idx];
          const total = totalActiveAccountsByDate[dateKey] || 1;
          return ((value / total) * 100).toFixed(2);
        }
        return value;
      });

      datasets.push({
        label: chainName,
        data: chainData,
        fill: chartType === "stacked" ? true : false,
        borderColor: getColorForChain(chainName),
        backgroundColor: getColorForChain(chainName),
        hoverBackgroundColor: getColorForChain(chainName), // Match background color
        hoverBorderColor: getColorForChain(chainName), // Match border color
        borderWidth: 1, // Consistent border width
        hoverOffset: 0, // Prevent slice expansion on hover
        tension: 0.1,
      });
    });

    return {
      labels,
      datasets,
    };
  }, [
    allChains,
    activeAccountsByChainDate,
    timeUnit,
    timeRange,
    selectedRaas,
    chartType,
    getAllDates,
    getFilteredDates,
    getMonthlyLabels,
    aggregateMonthlyData,
    getColorForChain,
  ]);

  // Memoized Table Data
  const tableData = useMemo(() => {
    if (!allChains.length || !Object.keys(activeAccountsByChainDate).length)
      return [];

    const today = moment().format("YYYY-MM-DD");
    const yesterday = moment().subtract(1, "day").format("YYYY-MM-DD");

    let currentPeriodDates = [];
    let previousPeriodDates = [];

    if (timeRange === "1 Day") {
      const foundDate = findMostRecentDate();
      if (foundDate) {
        currentPeriodDates = [foundDate];
      } else {
        console.warn("No data found in the last 30 days.");
      }

      let previousDate = moment(foundDate)
        .subtract(1, "day")
        .format("YYYY-MM-DD");
      previousPeriodDates = [previousDate];
    } else {
      currentPeriodDates = getFilteredDates();

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

      let currentDate = moment(previousStartDate);
      while (currentDate.isSameOrBefore(previousEndDate)) {
        const dateStr = currentDate.format("YYYY-MM-DD");
        previousPeriodDates.push(dateStr);
        currentDate.add(1, "day");
      }
    }

    // Compute activeAccountsByRaas
    const activeAccountsByRaasMemo = useMemo(() => {
      const memo = {};
      allChains.forEach((chain) => {
        const chainName = chain.name;
        const chainRaas = chain.raas || "N/A";

        const chainActiveAccounts = activeAccountsByChainDate[chainName] || {};

        const totalActiveAccounts =
          selectedRaas !== "All Raas"
            ? getAllDates().reduce(
                (sum, date) => sum + (chainActiveAccounts[date] || 0),
                0
              )
            : currentPeriodDates.reduce(
                (sum, date) => sum + (chainActiveAccounts[date] || 0),
                0
              );

        if (!memo[chainRaas]) {
          memo[chainRaas] = 0;
        }
        memo[chainRaas] += totalActiveAccounts;
      });
      return memo;
    }, [
      allChains,
      activeAccountsByChainDate,
      selectedRaas,
      getAllDates,
      currentPeriodDates,
    ]);

    // Prepare table data
    const processedTableData = [];

    const filteredChains =
      selectedRaas === "All Raas"
        ? allChains
        : allChains.filter(
            (chain) =>
              chain.raas &&
              chain.raas.toLowerCase() === selectedRaas.toLowerCase()
          );

    filteredChains.forEach((chain) => {
      const chainName = chain.name;
      const chainLogo = chain.logoUrl || ""; // Corrected to use logoUrl
      const chainVertical = chain.vertical || "N/A";
      const chainRaas = chain.raas || "N/A"; // Added RaaS property
      const chainFramework = chain.framework || "N/A"; // Added Framework
      const chainDA = chain.da || "N/A"; // Added DA

      const chainActiveAccounts = activeAccountsByChainDate[chainName] || {};

      const currentActiveAccounts = currentPeriodDates.reduce((sum, date) => {
        return sum + (chainActiveAccounts[date] || 0);
      }, 0);

      const percentageCurrentPeriodDates = [];
      const percentagePreviousPeriodDates = [];

      for (let i = 1; i <= 30; i++) {
        const dateStr = moment().subtract(i, "days").format("YYYY-MM-DD");
        percentageCurrentPeriodDates.push(dateStr);
      }

      for (let i = 31; i <= 60; i++) {
        const dateStr = moment().subtract(i, "days").format("YYYY-MM-DD");
        percentagePreviousPeriodDates.push(dateStr);
      }

      const currentActiveAccountsForPercentage =
        percentageCurrentPeriodDates.reduce((sum, date) => {
          return sum + (chainActiveAccounts[date] || 0);
        }, 0);

      const previousActiveAccountsForPercentage =
        percentagePreviousPeriodDates.reduce((sum, date) => {
          return sum + (chainActiveAccounts[date] || 0);
        }, 0);

      const percentageIncrease =
        previousActiveAccountsForPercentage > 0
          ? ((currentActiveAccountsForPercentage -
              previousActiveAccountsForPercentage) /
              previousActiveAccountsForPercentage) *
            100
          : currentActiveAccountsForPercentage > 0
          ? 100
          : 0;

      processedTableData.push({
        chainName,
        chainLogo,
        chainVertical,
        raas: chainRaas,
        activeAccounts: currentActiveAccounts,
        percentageIncrease,
        framework: chainFramework, // Included Framework
        DA: chainDA, // Included DA
      });
    });

    // Sort the table data based on activeAccounts and sortOrder
    processedTableData.sort((a, b) => {
      if (sortOrder === "asc") {
        return a.activeAccounts - b.activeAccounts;
      } else {
        return b.activeAccounts - a.activeAccounts;
      }
    });

    const top10TableData = processedTableData.slice(0, 10);

    return top10TableData;
  }, [
    allChains,
    activeAccountsByChainDate,
    timeUnit,
    timeRange,
    selectedRaas,
    getAllDates,
    getFilteredDates,
    findMostRecentDate,
    sortOrder,
  ]);

  // Calculate totalActiveAccountsAllChains
  const totalActiveAccountsAllChains = useMemo(() => {
    return tableData.reduce((sum, chain) => sum + chain.activeAccounts, 0);
  }, [tableData]);

  // Calculate percentage share
  const percentageShare = useMemo(() => {
    const totalActiveAccountsTopChains = tableData.reduce(
      (sum, chain) => sum + chain.activeAccounts,
      0
    );
    return totalActiveAccountsAllChains
      ? (
          (totalActiveAccountsTopChains / totalActiveAccountsAllChains) *
          100
        ).toFixed(2)
      : 0;
  }, [totalActiveAccountsAllChains, tableData]);

  // Format total active accounts
  const formattedTotalActiveAccounts = useMemo(() => {
    return abbreviateNumber(
      tableData.reduce((sum, chain) => sum + chain.activeAccounts, 0),
      2
    );
  }, [tableData]);

  // Data for RaaS Pie Chart
  const raasLabels = useMemo(
    () => Object.keys(activeAccountsByRaasMemo),
    [activeAccountsByRaasMemo]
  );
  const raasData = useMemo(
    () => raasLabels.map((raas) => activeAccountsByRaasMemo[raas]),
    [raasLabels, activeAccountsByRaasMemo]
  );
  const raasColors = useMemo(
    () =>
      raasLabels.map((raas, index) => {
        const colorMap = {
          Gelato: "#ff3b57",
          Conduit: "#46BDC6",
          Alchemy: "#4185F4",
          Caldera: "#EC6731",
          Altlayer: "#B28AFE",
          "All Raas": "#CCCCCC",
        };
        return colorMap[raas] || COLORS[index % COLORS.length];
      }),
    [raasLabels]
  );

  const raasPieDataFinal = useMemo(
    () => ({
      labels: raasLabels,
      datasets: [
        {
          data: raasData,
          backgroundColor: raasColors,
          hoverBackgroundColor: raasColors,
          borderColor: "#FFFFFF",
          hoverBorderColor: "#FFFFFF",
          borderWidth: 1,
          hoverOffset: 0,
        },
      ],
    }),
    [raasLabels, raasData, raasColors]
  );

  // Data for Top Chains Pie Chart
  const topChainsPieData = useMemo(() => {
    const topChainsData = topChainsList.map((chain) => chain.total);
    const topChainsLabels = topChainsList.map((chain) => chain.name);
    const otherChainsTotal =
      totalActiveAccountsAllChains -
      topChainsData.reduce((sum, val) => sum + val, 0);
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
          ),
          borderColor: "#FFFFFF",
          hoverBorderColor: "#FFFFFF",
          borderWidth: 1,
          hoverOffset: 0,
        },
      ],
    };
  }, [topChainsList, getColorForChain, totalActiveAccountsAllChains]);

  // Chart Options
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
            title: (context) => context[0].label,
            label: (context) => {
              const label = context.dataset.label || "";
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
            callback: (value) =>
              chartType === "percentage"
                ? `${value}%`
                : abbreviateNumber(value, 2),
          },
        },
      },
      elements: {
        point: {
          radius: 0, // Remove points for smoother lines
        },
      },
      hover: {
        onHover: (event, chartElement) => {
          event.native.target.style.cursor = "default"; // Prevent pointer cursor
        },
      },
      animation: {
        duration: 0, // Disable animations for faster rendering
      },
    }),
    [timeRange, timeUnit, chartType]
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
            label: (context) => {
              const label = context.label || "";
              const value = context.parsed || 0;
              const totalRaasActiveAccounts = raasData.reduce(
                (sum, val) => sum + val,
                0
              );
              const percentage = totalRaasActiveAccounts
                ? ((value / totalRaasActiveAccounts) * 100).toFixed(2)
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
      animation: {
        duration: 0, // Disable animations for faster rendering
      },
    }),
    [raasData]
  );

  const getPeriodLabel = useCallback(() => {
    if (timeRange === "1 Day") {
      return "Yesterday";
    } else if (timeUnit === "Daily") {
      return timeRange;
    } else if (timeUnit === "Monthly") {
      return timeRange;
    } else {
      return "Selected Period";
    }
  }, [timeRange, timeUnit]);

  const raasPieChartLabel = useMemo(() => {
    return selectedRaas !== "All Raas"
      ? "RaaS Providers Market Share (All Time)"
      : `RaaS Providers Market Share (${getPeriodLabel()})`;
  }, [selectedRaas, getPeriodLabel]);

  // Separate useMemo for activeAccountsByRaas
  const activeAccountsByRaasMemo = useMemo(() => {
    const memo = {};
    allChains.forEach((chain) => {
      const chainName = chain.name;
      const chainRaas = chain.raas || "N/A";

      const chainActiveAccounts = activeAccountsByChainDate[chainName] || {};

      const totalActiveAccounts =
        selectedRaas !== "All Raas"
          ? getAllDates().reduce(
              (sum, date) => sum + (chainActiveAccounts[date] || 0),
              0
            )
          : timeRange !== "1 Day"
          ? getFilteredDates().reduce(
              (sum, date) => sum + (chainActiveAccounts[date] || 0),
              0
            )
          : 0; // For "1 Day", we handle differently

      if (!memo[chainRaas]) {
        memo[chainRaas] = 0;
      }
      memo[chainRaas] += totalActiveAccounts;
    });
    return memo;
  }, [
    allChains,
    activeAccountsByChainDate,
    selectedRaas,
    getAllDates,
    getFilteredDates,
    timeRange,
  ]);

  return (
    <div className="performance-page">
      <Sidebar />
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

            {/* Total Active Accounts and Percentage Share */}
            <div className="total-transactions-info">
              <p>Total Active Accounts: {formattedTotalActiveAccounts}</p>
              <p>
                The top 10 chains contribute <strong>{percentageShare}%</strong>{" "}
                of all active accounts {getPeriodLabel()}.
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
            <Suspense fallback={<div>Loading Chart...</div>}>
              <Line data={chartData} options={lineChartOptions} />
            </Suspense>
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
                    <th>RaaS</th>
                    <th>
                      Active Accounts ({getPeriodLabel()})
                      <button onClick={handleSort}>
                        <FontAwesomeIcon icon={faSort} />
                      </button>
                    </th>
                    <th>Vertical</th>
                    <th>30d %</th>
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
                              "https://via.placeholder.com/40?text=No+Image"; // Updated fallback URL
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
                  <Suspense fallback={<div>Loading Pie Chart...</div>}>
                    <Pie data={topChainsPieData} options={pieChartOptions} />
                  </Suspense>
                )}
              </div>
              {/* RaaS Pie Chart */}
              <div className="pie-chart-card">
                <h4>{raasPieChartLabel}</h4>
                {raasPieDataFinal && (
                  <Suspense fallback={<div>Loading Pie Chart...</div>}>
                    <Pie data={raasPieDataFinal} options={pieChartOptions} />
                  </Suspense>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveAccountsPage;
