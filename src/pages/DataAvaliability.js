/* src/pages/DataAvailabilityPage.js */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Sidebar from "../Sidebar/Sidebar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChartPie } from "@fortawesome/free-solid-svg-icons";
import "./DailyTransactionsPage.css";
import { Pie, Bar } from "react-chartjs-2";
import {
  fetchGoogleSheetData,
  fetchAllTransaction, // Use the singular function
  fetchAllTvlData,
  fetchAllActiveAccounts,
} from "../services/googleSheetService"; // Ensure consistent import
import { abbreviateNumber } from "../utils/numberFormatter";
import { saveData, getData, clearAllData } from "../services/indexedDBService";

// Register required components for Chart.js
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
} from "chart.js";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement
);

const DATA_AVAILABILITY_DATA_ID = "dataAvailabilityData"; // Unique ID for IndexedDB
const SIX_HOURS_IN_MS = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

const DataAvailabilityPage = () => {
  // State variables
  const [raasOptions, setRaasOptions] = useState(["All Raas"]);
  const [selectedRaas, setSelectedRaas] = useState("All Raas");
  const [allChains, setAllChains] = useState([]);

  // Updated state variables to match fetchAllTransaction
  const [transactionsByChainDate, setTransactionsByChainDate] = useState({});
  const [approximateDataByChainDate, setApproximateDataByChainDate] = useState(
    {}
  );
  const [totalTransactionsCombined, setTotalTransactionsCombined] = useState(0);

  const [tvlDataByChainDate, setTvlDataByChainDate] = useState({});
  const [activeAccountsByChainDate, setActiveAccountsByChainDate] = useState(
    {}
  );

  const [daCounts, setDaCounts] = useState({});
  const [verticalCounts, setVerticalCounts] = useState({});
  const [l2L3Counts, setL2L3Counts] = useState({});
  const [frameworkCounts, setFrameworkCounts] = useState({});

  const [daByVerticalData, setDaByVerticalData] = useState({});
  const [daByL2L3Data, setDaByL2L3Data] = useState({});
  const [daByFrameworkData, setDaByFrameworkData] = useState({});

  const [chainsByDaL2L3, setChainsByDaL2L3] = useState({});
  const [chainsByDaVertical, setChainsByDaVertical] = useState({});
  const [chainsByDaFramework, setChainsByDaFramework] = useState({});

  // Table Data
  const [tableData, setTableData] = useState([]);

  // State variables for filters and toggles
  const [tableFilter, setTableFilter] = useState("Transaction Count");
  const [showPercentageVertical, setShowPercentageVertical] = useState(false);
  const [showPercentageL2L3, setShowPercentageL2L3] = useState(false);
  const [showPercentageFramework, setShowPercentageFramework] = useState(false);

  // Loading and Error States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Define RaasDropdown inside component
  const RaasDropdown = ({ options, selected, onChange }) => {
    return (
      <select
        className="raas-dropdown-select"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        aria-label="RaaS Dropdown"
      >
        {options.map((raas) => (
          <option key={raas} value={raas}>
            {raas}
          </option>
        ))}
      </select>
    );
  };

  // Utility function for deep comparison
  const isEqual = (obj1, obj2) => {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
  };

  // Define fetchData outside useEffect using useCallback to prevent re-creation
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Retrieve data from IndexedDB
      const storedRecord = await getData(DATA_AVAILABILITY_DATA_ID);
      const sixHoursAgo = Date.now() - SIX_HOURS_IN_MS;

      if (storedRecord && storedRecord.timestamp > sixHoursAgo) {
        // Use stored data if it's less than 6 hours old
        console.log("📦 Using cached data from IndexedDB.", storedRecord.data);
        populateStateWithData(storedRecord.data);
        setLoading(false);
        return;
      }

      console.log("🚀 Fetching new data from Google Sheets and APIs...");
      // Fetch new data
      const sheetData = await fetchGoogleSheetData();
      const transactionData = await fetchAllTransaction(sheetData); // Use fetchAllTransaction
      const tvlData = await fetchAllTvlData(sheetData);
      const activeAccountsData = await fetchAllActiveAccounts(sheetData);

      console.log("Fetched Data:", {
        sheetData,
        transactionData,
        tvlData,
        activeAccountsData,
      }); // Added for debugging

      const newData = {
        sheetData,
        transactionData, // Updated key
        tvlData,
        activeAccountsData,
      };

      // Save new data with timestamp to IndexedDB
      await saveData(DATA_AVAILABILITY_DATA_ID, newData);

      populateStateWithData(newData);
    } catch (err) {
      console.error("❌ Error fetching data:", err);
      setError(`Failed to load data availability data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch and cache data on component mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Function to populate state with fetched data
  const populateStateWithData = (data) => {
    const { sheetData, transactionData, tvlData, activeAccountsData } = data;

    // Defensive Checks
    if (!transactionData) {
      console.error("❌ transactionData is undefined.");
      setError("Transaction data is missing.");
      return;
    }

    if (
      !transactionData.transactionsByChainDate ||
      typeof transactionData.transactionsByChainDate !== "object"
    ) {
      console.error(
        "❌ transactionsByChainDate is missing or not an object in transactionData.",
        transactionData
      );
      setError("Invalid transaction data structure.");
      return;
    }

    // Similarly, add checks for tvlData and activeAccountsData if necessary

    // Filter chains with status "Mainnet"
    const mainnetChains = sheetData.filter(
      (chain) => chain.status && chain.status.trim().toLowerCase() === "mainnet"
    );

    setAllChains(mainnetChains);

    // Updated data assignments
    setTransactionsByChainDate(transactionData.transactionsByChainDate);
    setApproximateDataByChainDate(transactionData.approximateDataByChainDate);
    setTotalTransactionsCombined(transactionData.totalTransactionsCombined);

    setTvlDataByChainDate(tvlData.tvlDataByChainDate);
    setActiveAccountsByChainDate(activeAccountsData.activeAccountsByChainDate);

    // Set RaaS Options
    const uniqueRaas = [
      "All Raas",
      ...new Set(
        mainnetChains
          .map((chain) => chain.raas)
          .filter((raas) => raas && raas.trim() !== "")
          .map((raas) => raas.trim())
      ),
    ];
    setRaasOptions(uniqueRaas);
  };

  // Function to standardize L2/L3 values
  const standardizeL2L3 = (value) => {
    if (!value) return "Unknown";
    const lowerValue = value.trim().toLowerCase();
    if (lowerValue === "l2" || lowerValue === "layer 2") return "L2";
    if (lowerValue === "l3" || lowerValue === "layer 3") return "L3";
    return "Unknown";
  };

  // Process data whenever relevant state changes
  useEffect(() => {
    if (!loading && allChains.length) {
      processChartsData();
      processTableData();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    loading,
    allChains,
    transactionsByChainDate,
    approximateDataByChainDate, // Added dependency
    tvlDataByChainDate,
    activeAccountsByChainDate,
    selectedRaas,
    tableFilter,
  ]);

  // Function to process data for charts
  const processChartsData = () => {
    // Filter chains based on selected RaaS
    const filteredChains =
      selectedRaas === "All Raas"
        ? allChains
        : allChains.filter(
            (chain) =>
              chain.raas &&
              chain.raas.toLowerCase() === selectedRaas.toLowerCase()
          );

    // 1. DA Counts
    const daCountTemp = {};
    filteredChains.forEach((chain) => {
      const da = chain.da || "Unknown"; // Fetch the DA provider for each chain
      if (!daCountTemp[da]) {
        daCountTemp[da] = 0;
      }
      daCountTemp[da] += 1; // Increment the count for this DA provider
    });

    if (!isEqual(daCounts, daCountTemp)) {
      setDaCounts(daCountTemp);
    }

    // 2. Vertical Counts
    const verticalCountTemp = {};
    filteredChains.forEach((chain) => {
      const vertical = chain.vertical || "Unknown";
      if (!verticalCountTemp[vertical]) {
        verticalCountTemp[vertical] = 0;
      }
      verticalCountTemp[vertical] += 1;
    });

    if (!isEqual(verticalCounts, verticalCountTemp)) {
      setVerticalCounts(verticalCountTemp);
    }

    // 3. L2/L3 Counts
    const l2L3CountTemp = {};
    filteredChains.forEach((chain) => {
      let l2L3 = chain.l2OrL3 || "Unknown";
      l2L3 = standardizeL2L3(l2L3);
      if (!l2L3CountTemp[l2L3]) {
        l2L3CountTemp[l2L3] = 0;
      }
      l2L3CountTemp[l2L3] += 1;
    });

    if (!isEqual(l2L3Counts, l2L3CountTemp)) {
      setL2L3Counts(l2L3CountTemp);
    }

    // 4. Framework Counts
    const frameworkCountTemp = {};
    filteredChains.forEach((chain) => {
      const framework = chain.framework || "Unknown";
      if (!frameworkCountTemp[framework]) {
        frameworkCountTemp[framework] = 0;
      }
      frameworkCountTemp[framework] += 1;
    });

    if (!isEqual(frameworkCounts, frameworkCountTemp)) {
      setFrameworkCounts(frameworkCountTemp);
    }

    // 5. DA by Vertical
    const daByVerticalTemp = {};
    filteredChains.forEach((chain) => {
      const da = chain.da || "Unknown";
      const vertical = chain.vertical || "Unknown";

      if (!daByVerticalTemp[da]) {
        daByVerticalTemp[da] = {};
      }

      if (!daByVerticalTemp[da][vertical]) {
        daByVerticalTemp[da][vertical] = 0;
      }

      daByVerticalTemp[da][vertical] += 1;
    });

    if (!isEqual(daByVerticalData, daByVerticalTemp)) {
      setDaByVerticalData(daByVerticalTemp);
    }

    // 6. DA by L2/L3
    const daByL2L3Temp = {};
    filteredChains.forEach((chain) => {
      const da = chain.da || "Unknown";
      let l2L3 = chain.l2OrL3 || "Unknown";
      l2L3 = standardizeL2L3(l2L3);

      if (!daByL2L3Temp[da]) {
        daByL2L3Temp[da] = {};
      }

      if (!daByL2L3Temp[da][l2L3]) {
        daByL2L3Temp[da][l2L3] = 0;
      }

      daByL2L3Temp[da][l2L3] += 1;
    });

    if (!isEqual(daByL2L3Data, daByL2L3Temp)) {
      setDaByL2L3Data(daByL2L3Temp);
    }

    // 7. DA by Framework
    const daByFrameworkTemp = {};
    filteredChains.forEach((chain) => {
      const da = chain.da || "Unknown";
      const framework = chain.framework || "Unknown";

      if (!daByFrameworkTemp[da]) {
        daByFrameworkTemp[da] = {};
      }

      if (!daByFrameworkTemp[da][framework]) {
        daByFrameworkTemp[da][framework] = 0;
      }

      daByFrameworkTemp[da][framework] += 1;
    });

    if (!isEqual(daByFrameworkData, daByFrameworkTemp)) {
      setDaByFrameworkData(daByFrameworkTemp);
    }

    // 8. Chains by DA and L2/L3
    const chainsByDaL2L3Temp = {};
    filteredChains.forEach((chain) => {
      const da = chain.da || "Unknown";
      let l2L3 = chain.l2OrL3 || "Unknown";
      l2L3 = standardizeL2L3(l2L3);

      if (!chainsByDaL2L3Temp[da]) {
        chainsByDaL2L3Temp[da] = {};
      }

      if (!chainsByDaL2L3Temp[da][l2L3]) {
        chainsByDaL2L3Temp[da][l2L3] = [];
      }

      chainsByDaL2L3Temp[da][l2L3].push(chain.name);
    });
    setChainsByDaL2L3(chainsByDaL2L3Temp);

    // 9. Chains by DA and Vertical
    const chainsByDaVerticalTemp = {};
    filteredChains.forEach((chain) => {
      const da = chain.da || "Unknown";
      const vertical = chain.vertical || "Unknown";

      if (!chainsByDaVerticalTemp[da]) {
        chainsByDaVerticalTemp[da] = {};
      }

      if (!chainsByDaVerticalTemp[da][vertical]) {
        chainsByDaVerticalTemp[da][vertical] = [];
      }

      chainsByDaVerticalTemp[da][vertical].push(chain.name);
    });
    setChainsByDaVertical(chainsByDaVerticalTemp);

    // 10. Chains by DA and Framework
    const chainsByDaFrameworkTemp = {};
    filteredChains.forEach((chain) => {
      const da = chain.da || "Unknown";
      const framework = chain.framework || "Unknown";

      if (!chainsByDaFrameworkTemp[da]) {
        chainsByDaFrameworkTemp[da] = {};
      }

      if (!chainsByDaFrameworkTemp[da][framework]) {
        chainsByDaFrameworkTemp[da][framework] = [];
      }

      chainsByDaFrameworkTemp[da][framework].push(chain.name);
    });
    setChainsByDaFramework(chainsByDaFrameworkTemp);

    // Debugging: Log the processed DA data
    console.log("DA Counts:", daCountTemp);
    console.log("Vertical Counts:", verticalCountTemp);
    console.log("L2/L3 Counts:", l2L3CountTemp);
    console.log("DA by Vertical:", daByVerticalTemp);
    console.log("DA by L2L3:", daByL2L3Temp);
    console.log("DA by Framework:", daByFrameworkTemp);
    console.log("Chains by DA & L2L3:", chainsByDaL2L3Temp);
    console.log("Chains by DA & Vertical:", chainsByDaVerticalTemp);
    console.log("Chains by DA & Framework:", chainsByDaFrameworkTemp);
  };

  // Function to process table data
  const processTableData = () => {
    // Aggregate data per DA
    const daData = {};

    allChains.forEach((chain) => {
      if (
        selectedRaas !== "All Raas" &&
        (!chain.raas || chain.raas.toLowerCase() !== selectedRaas.toLowerCase())
      ) {
        return;
      }

      const da = chain.da || "Unknown";
      if (!daData[da]) {
        daData[da] = {
          count: 0,
          topChains: [],
        };
      }

      daData[da].count += 1;

      // Calculate metric based on selected filter
      let metricValue = 0;
      if (tableFilter === "Transaction Count") {
        const transactions = transactionsByChainDate[chain.name] || {};
        const totalTransactions = Object.values(transactions).reduce(
          (acc, curr) => acc + (curr.value || 0),
          0
        );
        metricValue = totalTransactions;
      } else if (tableFilter === "TVL") {
        const tvlData = tvlDataByChainDate[chain.name] || {};
        const latestDate = Object.keys(tvlData).sort().pop();
        metricValue = latestDate ? tvlData[latestDate].totalTvl : 0;
      }

      daData[da].topChains.push({
        name: chain.name,
        logoUrl: chain.logoUrl,
        metricValue,
      });
    });

    // Determine top 10 chains by metric per DA
    Object.keys(daData).forEach((da) => {
      daData[da].topChains.sort((a, b) => b.metricValue - a.metricValue);
      daData[da].topChains = daData[da].topChains.slice(0, 10);
    });

    // Prepare table data
    const tableDataLocal = Object.keys(daData).map((da) => {
      const data = daData[da];
      return {
        da,
        count: data.count,
        topChains: data.topChains,
      };
    });

    // Sort table data by count descending
    tableDataLocal.sort((a, b) => b.count - a.count);

    setTableData(tableDataLocal);
  };

  // Generate chart options similar to EcosystemPage.js
  const generateChartOptions = (
    title,
    isPieChart = false,
    showPercentage = false,
    legendPosition = "top"
  ) => ({
    responsive: true,
    maintainAspectRatio: true, // Maintain aspect ratio for all charts
    plugins: {
      legend: {
        display: true, // Ensure legends are displayed
        position: legendPosition,
        labels: {
          color: "#FFFFFF",
          // Adjust font size or other properties if needed
        },
      },
      title: {
        display: true,
        text: title,
        color: "#FFFFFF",
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            let label = "";
            if (context.chart.data.labels) {
              label = context.chart.data.labels[context.dataIndex] || "";
            }

            let value;
            if (isPieChart) {
              value = context.parsed;
            } else {
              value =
                context.parsed && context.parsed.y !== undefined
                  ? context.parsed.y
                  : context.parsed;
            }

            let percentage;

            if (isPieChart) {
              const totalPie = context.dataset.data.reduce(
                (acc, val) => acc + val,
                0
              );
              percentage = ((value / totalPie) * 100).toFixed(2);
              return `${label}: ${percentage}% (${abbreviateNumber(value, 2)})`;
            } else {
              const total = context.dataset.data.reduce(
                (acc, val) => acc + val,
                0
              );
              percentage = ((value / total) * 100).toFixed(2);
              const meta = context.dataset.meta
                ? context.dataset.meta[context.dataIndex]
                : [];
              let tooltipLines = [`${label}: ${abbreviateNumber(value, 2)}`];
              if (meta && meta.length) {
                tooltipLines.push("Chains:");
                tooltipLines = tooltipLines.concat(meta);
              }
              return tooltipLines;
            }
          },
        },
        backgroundColor: "rgba(0,0,0,0.7)",
        titleColor: "#FFFFFF",
        bodyColor: "#FFFFFF",
      },
    },
    scales: isPieChart
      ? {} // No scales for pie charts
      : {
          x: {
            stacked: true,
            ticks: { color: "#FFFFFF" },
            grid: { display: true },
          },
          y: {
            stacked: true,
            ticks: {
              color: "#FFFFFF",
              callback: function (value) {
                if (showPercentage) {
                  return value + "%";
                } else {
                  return abbreviateNumber(value, 2);
                }
              },
            },
            grid: { display: true },
          },
        },
  });

  // Generate chart options for bar charts with chains mapping
  const generateBarChartOptionsWithChains = (
    title,
    isPieChart = false,
    showPercentage = false,
    legendPosition = "top",
    chainsMapping
  ) => ({
    responsive: true,
    maintainAspectRatio: false, // Allows height to be set via CSS
    plugins: {
      legend: {
        display: true,
        position: legendPosition,
        labels: {
          color: "#FFFFFF",
          boxWidth: 20,
          padding: 15,
        },
      },
      title: {
        display: true,
        text: title,
        color: "#FFFFFF",
        font: {
          size: 18,
          weight: "bold",
        },
      },
      tooltip: {
        enabled: true,
        backgroundColor: "rgba(0,0,0,0.7)",
        titleColor: "#FFFFFF",
        bodyColor: "#FFFFFF",
        callbacks: {
          label: function (context) {
            if (isPieChart) {
              const label = context.label || "";
              const value = context.raw;
              const total = context.dataset.data.reduce(
                (acc, val) => acc + parseFloat(val),
                0
              );
              const percentage =
                total > 0 ? ((value / total) * 100).toFixed(2) : 0;
              return `${label}: ${percentage}% (${abbreviateNumber(value, 2)})`;
            } else {
              const da = context.label; // x-axis label
              const category = context.dataset.label; // dataset label
              const count = context.raw || 0;
              const chains =
                chainsMapping[da] && chainsMapping[da][category]
                  ? chainsMapping[da][category].join(", ")
                  : "None";

              // Split chain names into an array for vertical display
              const chainNames =
                chainsMapping[da] && chainsMapping[da][category]
                  ? chainsMapping[da][category]
                  : [];

              // Create an array of tooltip lines
              const tooltipLines = [
                `DA: ${da}`,
                `${category}: ${count}`,
                "Chains:",
                ...chainNames,
              ];

              return tooltipLines;
            }
          },
        },
      },
    },
    scales: isPieChart
      ? {}
      : {
          x: {
            stacked: true,
            display: true, // Ensure x-axis is displayed
            ticks: {
              color: "#FFFFFF",
              autoSkip: false, // Prevent labels from being skipped
              maxRotation: 0, // Remove rotation
              minRotation: 0, // Remove rotation
              font: {
                size: 12, // Adjust font size as needed
                weight: "bold",
              },
            },
            grid: { display: false },
            title: {
              display: true,
              text: "Data Availability (DA)",
              color: "#FFFFFF",
              font: {
                size: 14,
                weight: "bold",
              },
            },
          },
          y: {
            stacked: true,
            ticks: {
              color: "#FFFFFF",
              callback: function (value) {
                if (showPercentage) {
                  return value + "%";
                } else {
                  return abbreviateNumber(value, 2);
                }
              },
              font: {
                size: 12,
              },
            },
            grid: { display: true },
            title: {
              display: true,
              text: showPercentage ? "Percentage (%)" : "Count",
              color: "#FFFFFF",
              font: {
                size: 14,
                weight: "bold",
              },
            },
          },
        },
    layout: {
      padding: {
        top: 20,
        bottom: 80, // Increased from 50 to 80 to accommodate the x-axis title
        left: 20,
        right: 20,
      },
    },
    animation: false, // Disable all animations
    hover: {
      animationDuration: 0, // Disable hover animations
    },
    responsiveAnimationDuration: 0, // Disable responsive animations
  });

  // Generate chart options for pie charts (no chain names needed)
  const generatePieChartOptions = (
    title,
    isPieChart = true,
    showPercentage = false,
    legendPosition = "top"
  ) => ({
    responsive: true,
    maintainAspectRatio: false, // Allows height to be set via CSS
    plugins: {
      legend: {
        display: true,
        position: legendPosition,
        labels: {
          color: "#FFFFFF",
          boxWidth: 20,
          padding: 15,
        },
      },
      title: {
        display: true,
        text: title,
        color: "#FFFFFF",
        font: {
          size: 18,
          weight: "bold",
        },
      },
      tooltip: {
        enabled: true,
        backgroundColor: "rgba(0,0,0,0.7)",
        titleColor: "#FFFFFF",
        bodyColor: "#FFFFFF",
        callbacks: {
          label: function (context) {
            const label = context.label || "";
            const value = context.raw;
            const total = context.dataset.data.reduce(
              (acc, val) => acc + parseFloat(val),
              0
            );
            const percentage =
              total > 0 ? ((value / total) * 100).toFixed(2) : 0;
            return `${label}: ${percentage}% (${abbreviateNumber(value, 2)})`;
          },
        },
      },
    },
    layout: {
      padding: {
        top: 20,
        bottom: 50,
        left: 20,
        right: 20,
      },
    },
    animation: false, // Disable all animations
    hover: {
      animationDuration: 0, // Disable hover animations
    },
    responsiveAnimationDuration: 0, // Disable responsive animations
  });

  // Utility function to get color by index
  const getColorByIndex = (index) => {
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
    return COLORS[index % COLORS.length];
  };

  // Generate data for each chart

  /**
   * DA vs L2/L3 Bar Chart
   * X-Axis: DA
   * Y-Axis: Count
   * Bars: Split into L2 and L3
   */
  const getDaByL2L3ChartData = (showPercentage = false) => {
    const labels = Object.keys(daByL2L3Data); // DA providers
    const layers = ["L2", "L3"]; // Assuming only L2 and L3

    const datasets = layers.map((layer, idx) => {
      const data = labels.map((da) => {
        return daByL2L3Data[da][layer] || 0;
      });

      return {
        label: layer,
        data,
        backgroundColor: getColorByIndex(idx),
      };
    });

    // If showing percentage, calculate percentage per DA
    if (showPercentage) {
      const modifiedDatasets = layers.map((layer, idx) => {
        const data = labels.map((da) => {
          const total = layers.reduce(
            (acc, l) => acc + (daByL2L3Data[da][l] || 0),
            0
          );
          const value = daByL2L3Data[da][layer] || 0;
          return total > 0 ? ((value / total) * 100).toFixed(2) : 0;
        });

        return {
          label: layer,
          data,
          backgroundColor: getColorByIndex(idx),
        };
      });

      return {
        labels,
        datasets: modifiedDatasets,
      };
    }

    return {
      labels,
      datasets,
    };
  };

  /**
   * DA Distribution by Vertical Bar Chart
   * X-Axis: DA
   * Y-Axis: Count
   * Bars: Split into Verticals
   */
  const getDaByVerticalChartData = (showPercentage = false) => {
    const labels = Object.keys(daByVerticalData); // DA providers
    // Collect all unique verticals across all DAs
    const verticalSet = new Set();
    labels.forEach((da) => {
      Object.keys(daByVerticalData[da]).forEach((vertical) => {
        verticalSet.add(vertical);
      });
    });
    const verticals = Array.from(verticalSet);

    const datasets = verticals.map((vertical, idx) => {
      const data = labels.map((da) => {
        return daByVerticalData[da][vertical] || 0;
      });

      return {
        label: vertical,
        data,
        backgroundColor: getColorByIndex(idx),
      };
    });

    // If showing percentage, calculate percentage per DA
    if (showPercentage) {
      const modifiedDatasets = verticals.map((vertical, idx) => {
        const data = labels.map((da) => {
          const total = Object.values(daByVerticalData[da]).reduce(
            (acc, val) => acc + val,
            0
          );
          const value = daByVerticalData[da][vertical] || 0;
          return total > 0 ? ((value / total) * 100).toFixed(2) : 0;
        });

        return {
          label: vertical,
          data,
          backgroundColor: getColorByIndex(idx),
        };
      });

      return {
        labels,
        datasets: modifiedDatasets,
      };
    }

    return {
      labels,
      datasets,
    };
  };

  /**
   * DA Distribution by Vertical Pie Chart
   * Overall distribution of verticals
   */
  const getDaByVerticalPieChartData = () => {
    const labels = Object.keys(verticalCounts);
    const data = Object.values(verticalCounts);

    return {
      labels,
      datasets: [
        {
          label: "Vertical Distribution",
          data,
          backgroundColor: labels.map((_, idx) => getColorByIndex(idx)),
        },
      ],
    };
  };

  const getDaByChainsPieChartData = () => {
    const labels = Object.keys(daCounts); // DA providers as labels
    const data = Object.values(daCounts); // Chain count for each DA provider

    return {
      labels,
      datasets: [
        {
          label: "DA Distribution by Chains",
          data,
          backgroundColor: labels.map((_, idx) => getColorByIndex(idx)),
        },
      ],
    };
  };

  // Uncomment the following lines in DataAvailabilityPage.js
  // to enable the Clear Cache button for debugging purposes.

  const clearCache = async () => {
    try {
      // await clearAllData(DATA_AVAILABILITY_DATA_ID);
      console.log("✅ Cached data cleared.");
      // Refetch the data
      await fetchData();
    } catch (err) {
      console.error("❌ Error clearing cache:", err);
      setError(`Failed to clear cache: ${err.message}`);
    }
  };

  /**
   * DA Distribution by L2/L3 Pie Chart
   * Overall distribution of L2 vs L3
   */
  const getDaByL2L3PieChartData = () => {
    const labels = Object.keys(l2L3Counts); // Expected to be ["L2", "L3"]
    const data = labels.map((layer) => l2L3Counts[layer]);

    return {
      labels,
      datasets: [
        {
          label: "L2/L3 Distribution",
          data,
          backgroundColor: labels.map((_, idx) => getColorByIndex(idx)),
        },
      ],
    };
  };

  /**
   * DA vs Framework Bar Chart
   * X-Axis: DA
   * Y-Axis: Count
   * Bars: Split into Frameworks
   */
  const getDaByFrameworkChartData = (showPercentage = false) => {
    const labels = Object.keys(daByFrameworkData); // DA providers
    // Collect all unique frameworks across all DAs
    const frameworkSet = new Set();
    labels.forEach((da) => {
      Object.keys(daByFrameworkData[da]).forEach((framework) => {
        frameworkSet.add(framework);
      });
    });
    const frameworks = Array.from(frameworkSet);

    const datasets = frameworks.map((framework, idx) => {
      const data = labels.map((da) => {
        return daByFrameworkData[da][framework] || 0;
      });

      return {
        label: framework,
        data,
        backgroundColor: getColorByIndex(idx),
      };
    });

    // If showing percentage, calculate percentage per DA
    if (showPercentage) {
      const modifiedDatasets = frameworks.map((framework, idx) => {
        const data = labels.map((da) => {
          const total = frameworks.reduce(
            (acc, f) => acc + (daByFrameworkData[da][f] || 0),
            0
          );
          const value = daByFrameworkData[da][framework] || 0;
          return total > 0 ? ((value / total) * 100).toFixed(2) : 0;
        });

        return {
          label: framework,
          data,
          backgroundColor: getColorByIndex(idx),
        };
      });

      return {
        labels,
        datasets: modifiedDatasets,
      };
    }

    return {
      labels,
      datasets,
    };
  };

  /**
   * DA Distribution by Framework Pie Chart
   * Overall distribution of frameworks
   */
  const getDaByFrameworkPieChartData = () => {
    const labels = Object.keys(frameworkCounts);
    const data = Object.values(frameworkCounts);

    return {
      labels,
      datasets: [
        {
          label: "Framework Distribution",
          data,
          backgroundColor: labels.map((_, idx) => getColorByIndex(idx)),
        },
      ],
    };
  };

  // Memoize DA vs. L2/L3 Bar Chart Data
  const daByL2L3ChartData = useMemo(() => {
    return getDaByL2L3ChartData(showPercentageL2L3);
  }, [daByL2L3Data, showPercentageL2L3]);

  // Memoize DA vs. Vertical Bar Chart Data
  const daByVerticalChartDataMemo = useMemo(() => {
    return getDaByVerticalChartData(showPercentageVertical);
  }, [daByVerticalData, showPercentageVertical]);

  // Memoize DA vs. Framework Bar Chart Data
  const daByFrameworkChartDataMemo = useMemo(() => {
    return getDaByFrameworkChartData(showPercentageFramework);
  }, [daByFrameworkData, showPercentageFramework]);

  // Memoize DA Distribution Pie Chart Data
  const daDistributionPieChartData = useMemo(() => {
    return getDaByVerticalPieChartData();
  }, [verticalCounts]);

  const daByChainsPieChartData = useMemo(() => {
    return getDaByChainsPieChartData();
  }, [daCounts]);

  // Memoize DA Distribution by L2/L3 Pie Chart Data
  const daByL2L3PieChartData = useMemo(() => {
    return getDaByL2L3PieChartData();
  }, [l2L3Counts]);

  // Memoize DA Distribution by Vertical Pie Chart Data
  const daByVerticalPieChartData = useMemo(() => {
    return getDaByVerticalPieChartData();
  }, [verticalCounts]);

  // Memoize DA Distribution by Framework Pie Chart Data
  const daByFrameworkPieChartData = useMemo(() => {
    return getDaByFrameworkPieChartData();
  }, [frameworkCounts]);

  // Function to handle RaaS selection
  const handleRaasChange = (value) => {
    setSelectedRaas(value);
  };

  return (
    <div className="data-availability-page">
      <Sidebar />
      <div className="main-content">
        {/* <button onClick={clearCache}>Clear Cache</button> */}

        {/* Header */}
        <div className="data-availability-header">
          <div className="heading-container">
            <FontAwesomeIcon icon={faChartPie} className="icon" />
            <div>
              <h2>Data Availability Overview</h2>
              <p className="description">
                Explore the distribution and performance of various chains
                across different Data Availability (DA) providers within the
                ecosystem.
              </p>
            </div>
          </div>

          {/* RaaS Dropdown */}
          <div className="raas-dropdown">
            <RaasDropdown
              options={raasOptions}
              selected={selectedRaas}
              onChange={handleRaasChange}
            />
          </div>
        </div>

        {/* Error Message */}
        {error && <div className="error-message">{error}</div>}

        {/* Loading Indicator */}
        {loading && (
          <div className="loading">Loading data availability data...</div>
        )}

        {/* Main Content */}
        {!loading && !error && (
          <>
            <div className="data-availability-content">
              {/* Left Side: Table */}
              <div className="left-section">
                <div className="table-card">
                  <div className="table-header">
                    <h3>Data Availability Overview</h3>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>Data Availability (DA)</th>
                        <th>
                          <div className="table-header-with-filter">
                            <span>Top Chains (by {tableFilter})</span>
                            <div className="table-filter-section">
                              <span>Filter by:</span>
                              <select
                                value={tableFilter}
                                onChange={(e) => setTableFilter(e.target.value)}
                                className="table-filter-select"
                              >
                                <option value="Transaction Count">
                                  Transaction Count
                                </option>
                                <option value="TVL">TVL</option>
                              </select>
                            </div>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.map((row) => (
                        <tr key={row.da}>
                          <td>
                            <div className="da-name">
                              <span className="name">{row.da}</span>
                              <span className="count">({row.count})</span>
                            </div>
                          </td>
                          <td>
                            <div className="top-chains">
                              {row.topChains.map((chain) => (
                                <div
                                  key={chain.name}
                                  className="chain-logo-container"
                                  data-chain-name={chain.name}
                                  data-metric-value={abbreviateNumber(
                                    chain.metricValue,
                                    2
                                  )}
                                  data-metric-type={tableFilter}
                                >
                                  <img
                                    src={chain.logoUrl}
                                    alt={chain.name}
                                    className="chain-logo"
                                    onError={(e) => {
                                      e.target.onerror = null;
                                      e.target.src =
                                        "https://www.helika.io/wp-content/uploads/2023/09/proofofplay_logo.png";
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Side: DA Distribution Pie Chart */}
              <div className="right-section">
                {/* DA Distribution by Chains Pie Chart */}
                <div className="chart-card pie-chart-card half-width">
                  <Pie
                    data={daByChainsPieChartData}
                    options={generatePieChartOptions(
                      "DA Distribution by Chains",
                      true,
                      false,
                      "bottom"
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="charts-section">
              {/* DA vs. L2/L3 Charts */}
              <div className="charts-row">
                {/* DA vs. L2/L3 Bar Chart */}
                <div className="chart-card bar-chart-card half-width">
                  <div className="chart-header">
                    <div className="toggle-percentage">
                      <label>
                        <input
                          type="checkbox"
                          checked={showPercentageL2L3}
                          onChange={(e) =>
                            setShowPercentageL2L3(e.target.checked)
                          }
                        />
                        Show Percentage
                      </label>
                    </div>
                  </div>
                  <Bar
                    data={daByL2L3ChartData}
                    options={generateBarChartOptionsWithChains(
                      "DA Distribution across L2/L3 Layers",
                      false,
                      showPercentageL2L3,
                      "top",
                      chainsByDaL2L3 // Mapping for L2/L3
                    )}
                  />
                </div>

                {/* DA vs. L2/L3 Pie Chart */}
                <div className="chart-card pie-chart-card half-width">
                  <Pie
                    data={daByL2L3PieChartData}
                    options={generatePieChartOptions(
                      "DA Distribution by L2/L3 Percentage",
                      true
                    )}
                  />
                </div>
              </div>

              {/* DA vs. Vertical Charts */}
              <div className="charts-row">
                {/* DA vs. Vertical Bar Chart */}
                <div className="chart-card bar-chart-card half-width">
                  <div className="chart-header">
                    <div className="toggle-percentage">
                      <label>
                        <input
                          type="checkbox"
                          checked={showPercentageVertical}
                          onChange={(e) =>
                            setShowPercentageVertical(e.target.checked)
                          }
                        />
                        Show Percentage
                      </label>
                    </div>
                  </div>
                  <Bar
                    data={daByVerticalChartDataMemo}
                    options={generateBarChartOptionsWithChains(
                      "DA Distribution across Verticals",
                      false,
                      showPercentageVertical,
                      "top",
                      chainsByDaVertical // Mapping for Vertical
                    )}
                  />
                </div>

                {/* DA vs. Vertical Pie Chart */}
                <div className="chart-card pie-chart-card half-width">
                  <Pie
                    data={daByVerticalPieChartData}
                    options={generatePieChartOptions(
                      "DA Distribution by Vertical Percentage",
                      true
                    )}
                  />
                </div>
              </div>

              {/* DA vs. Framework Charts */}
              <div className="charts-row">
                {/* DA vs. Framework Bar Chart */}
                <div className="chart-card bar-chart-card half-width">
                  <div className="chart-header">
                    <div className="toggle-percentage">
                      <label>
                        <input
                          type="checkbox"
                          checked={showPercentageFramework}
                          onChange={(e) =>
                            setShowPercentageFramework(e.target.checked)
                          }
                        />
                        Show Percentage
                      </label>
                    </div>
                  </div>
                  <Bar
                    data={daByFrameworkChartDataMemo}
                    options={generateBarChartOptionsWithChains(
                      "DA Distribution across Frameworks",
                      false,
                      showPercentageFramework,
                      "top",
                      chainsByDaFramework // Mapping for Framework
                    )}
                  />
                </div>

                {/* DA vs. Framework Pie Chart */}
                <div className="chart-card pie-chart-card half-width">
                  <Pie
                    data={daByFrameworkPieChartData}
                    options={generatePieChartOptions(
                      "DA Distribution by Framework Percentage",
                      true
                    )}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DataAvailabilityPage;
