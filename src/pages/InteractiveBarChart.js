// src/pages/EcosystemPage.js

import React, { useState, useEffect } from "react";
import Sidebar from "../Sidebar/Sidebar"; // Adjust path as necessary
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChartPie } from "@fortawesome/free-solid-svg-icons";
import "./EcosystemPage.css";
import { Pie } from "react-chartjs-2";
import InteractiveBarChart from "./InteractiveBarChart"; // Ensure correct path
import {
  fetchGoogleSheetData,
  fetchAllTransactions, // Corrected function name
  fetchAllTvlData,
  fetchAllActiveAccounts,
} from "../services/googleSheetService"; // Adjust import paths as necessary
import { abbreviateNumber } from "../utils/numberFormatter"; // Ensure this utility exists
import moment from "moment";
import { saveData, getData } from "../services/indexedDBService"; // Assuming you have these functions

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

const ECOSYSTEM_DATA_ID = "ecosystemData"; // Unique ID for IndexedDB
const SIX_HOURS_IN_MS = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

const EcosystemPage = () => {
  // State variables
  const [raasOptions, setRaasOptions] = useState(["All Raas"]);
  const [selectedRaas, setSelectedRaas] = useState("All Raas");

  // New State for Table Filter
  const [tableFilter, setTableFilter] = useState("Transaction Count"); // Default filter
  const [filterOptions] = useState(["Transaction Count", "TVL", "TPS"]);

  const [allChains, setAllChains] = useState([]);
  const [transactionsByChainDate, setTransactionsByChainDate] = useState({});
  const [tvlDataByChainDate, setTvlDataByChainDate] = useState({});
  const [activeAccountsByChainDate, setActiveAccountsByChainDate] = useState(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data for charts
  const [chainsByVerticalData, setChainsByVerticalData] = useState({});
  const [transactionCountByVerticalData, setTransactionCountByVerticalData] =
    useState({});
  const [tvlByVerticalData, setTvlByVerticalData] = useState({});
  const [verticalByFrameworkData, setVerticalByFrameworkData] = useState({}); // Restored
  const [daByVerticalData, setDaByVerticalData] = useState({}); // For DA by Vertical
  const [l2L3ByVerticalData, setL2L3ByVerticalData] = useState({}); // For L2/L3 by Vertical

  // New State for Percentage View Toggles
  const [transactionCountPercentage, setTransactionCountPercentage] =
    useState(false);
  const [tvlPercentage, setTvlPercentage] = useState(false);

  // State for selected categories in each chart
  const [
    selectedTransactionCountCategory,
    setSelectedTransactionCountCategory,
  ] = useState(null);
  const [selectedTvlCategory, setSelectedTvlCategory] = useState(null);
  const [
    selectedVerticalFrameworkCategory,
    setSelectedVerticalFrameworkCategory,
  ] = useState(null);
  const [selectedDaCategory, setSelectedDaCategory] = useState(null);
  const [selectedL2L3Category, setSelectedL2L3Category] = useState(null);

  // State for mapping frameworks/DA/L2/L3 to chains (Optional for Tooltips)
  const [frameworkChains, setFrameworkChains] = useState({}); // { framework: [chain names] }
  const [daChains, setDaChains] = useState({}); // { daProvider: [chain names] }
  const [l2L3Chains, setL2L3Chains] = useState({}); // { L2: [chain names], L3: [chain names] }

  // Table Data
  const [tableData, setTableData] = useState([]);

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

  // Define TableFilterDropdown inside component
  const TableFilterDropdown = ({ options, selected, onChange }) => {
    return (
      <select
        className="table-filter-select"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Table Filter Dropdown"
      >
        {options.map((filter) => (
          <option key={filter} value={filter}>
            {filter}
          </option>
        ))}
      </select>
    );
  };

  // Fetch and cache data on component mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Retrieve data from IndexedDB
        const storedRecord = await getData(ECOSYSTEM_DATA_ID);
        const sixHoursAgo = Date.now() - SIX_HOURS_IN_MS;

        if (storedRecord && storedRecord.timestamp > sixHoursAgo) {
          // Use stored data if it's less than 6 hours old
          console.log("📦 Using cached data from IndexedDB.");
          populateStateWithData(storedRecord.data);
          setLoading(false);
          return;
        }

        console.log("🚀 Fetching new data from Google Sheets and APIs...");
        // Fetch new data
        const sheetData = await fetchGoogleSheetData();
        const transactionsData = await fetchAllTransactions(sheetData); // Corrected function name
        const tvlData = await fetchAllTvlData(sheetData);
        const activeAccountsData = await fetchAllActiveAccounts(sheetData);

        const newData = {
          sheetData,
          transactionsData,
          tvlData,
          activeAccountsData,
        };

        // Save new data with timestamp to IndexedDB
        await saveData(ECOSYSTEM_DATA_ID, newData); // saveData now saves both data and timestamp

        populateStateWithData(newData);
      } catch (err) {
        console.error("❌ Error fetching data:", err);
        setError("Failed to load ecosystem data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Function to populate state with fetched data
  const populateStateWithData = (data) => {
    const { sheetData, transactionsData, tvlData, activeAccountsData } = data;

    // Filter chains with status "Mainnet"
    const mainnetChains = sheetData.filter(
      (chain) => chain.status && chain.status.trim().toLowerCase() === "mainnet"
    );

    setAllChains(mainnetChains);
    setTransactionsByChainDate(transactionsData.transactionsByChainDate || {});
    setTvlDataByChainDate(tvlData.tvlDataByChainDate || {});
    setActiveAccountsByChainDate(
      activeAccountsData.activeAccountsByChainDate || {}
    );

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
    tvlDataByChainDate,
    activeAccountsByChainDate,
    selectedRaas,
    tableFilter, // Added tableFilter as dependency
  ]);

  // Function to process data for charts
  const processChartsData = () => {
    console.log("Processing Charts Data");

    // Filter chains based on selected RaaS
    const filteredChains =
      selectedRaas === "All Raas"
        ? allChains
        : allChains.filter(
            (chain) =>
              chain.raas &&
              chain.raas.toLowerCase() === selectedRaas.toLowerCase()
          );

    console.log("Filtered Chains:", filteredChains);

    // 1. Chains by Vertical
    const chainsByVertical = {};
    filteredChains.forEach((chain) => {
      const vertical = chain.vertical || "Unknown";
      if (!chainsByVertical[vertical]) {
        chainsByVertical[vertical] = 0;
      }
      chainsByVertical[vertical] += 1;
    });
    setChainsByVerticalData(chainsByVertical);
    console.log("Chains by Vertical:", chainsByVertical);

    // 2. Transaction Count by Vertical
    const transactionCountByVertical = {};
    filteredChains.forEach((chain) => {
      const vertical = chain.vertical || "Unknown";
      const transactions = transactionsByChainDate[chain.name] || {};
      const totalTransactions = Object.values(transactions).reduce(
        (acc, curr) => acc + (curr.value || 0),
        0
      );
      if (!transactionCountByVertical[vertical]) {
        transactionCountByVertical[vertical] = 0;
      }
      transactionCountByVertical[vertical] += totalTransactions;
    });
    setTransactionCountByVerticalData(transactionCountByVertical);
    console.log("Transaction Count by Vertical:", transactionCountByVertical);

    // 3. TVL by Vertical
    const tvlByVertical = {};
    filteredChains.forEach((chain) => {
      const vertical = chain.vertical || "Unknown";
      const tvlData = tvlDataByChainDate[chain.name] || {};
      const latestDate = Object.keys(tvlData).sort().pop(); // Get the latest date
      const latestTvl = latestDate ? tvlData[latestDate].totalTvl : 0;
      if (!tvlByVertical[vertical]) {
        tvlByVertical[vertical] = 0;
      }
      tvlByVertical[vertical] += latestTvl;
    });
    setTvlByVerticalData(tvlByVertical);
    console.log("TVL by Vertical:", tvlByVertical);

    // 4. Vertical by Framework
    const verticalByFramework = {};
    filteredChains.forEach((chain) => {
      const vertical = chain.vertical || "Unknown";
      const framework = chain.framework || "Unknown";
      if (!verticalByFramework[vertical]) {
        verticalByFramework[vertical] = {};
      }
      if (!verticalByFramework[vertical][framework]) {
        verticalByFramework[vertical][framework] = 0;
      }
      verticalByFramework[vertical][framework] += 1;
    });
    setVerticalByFrameworkData(verticalByFramework);
    console.log("Vertical by Framework:", verticalByFramework);

    // 5. DA by Vertical
    const daByVertical = {};
    filteredChains.forEach((chain) => {
      const vertical = chain.vertical || "Unknown";
      const daProvider = chain.da || "Unknown"; // Assuming 'da' is the DA provider
      if (!daByVertical[vertical]) {
        daByVertical[vertical] = {};
      }
      if (!daByVertical[vertical][daProvider]) {
        daByVertical[vertical][daProvider] = 0;
      }
      daByVertical[vertical][daProvider] += 1;
    });
    setDaByVerticalData(daByVertical);
    console.log("DA by Vertical:", daByVertical);

    // 6. L2/L3 by Vertical
    const l2L3ByVertical = { L2: {}, L3: {} };
    filteredChains.forEach((chain) => {
      const vertical = chain.vertical || "Unknown";
      const l2OrL3 = chain.l2OrL3 || "Unknown";
      if (l2OrL3 === "L2" || l2OrL3 === "L3") {
        if (!l2L3ByVertical[l2OrL3][vertical]) {
          l2L3ByVertical[l2OrL3][vertical] = 0;
        }
        l2L3ByVertical[l2OrL3][vertical] += 1;
      }
    });
    setL2L3ByVerticalData(l2L3ByVertical);
    console.log("L2/L3 by Vertical:", l2L3ByVertical);

    // Mapping for Tooltips (Optional)
    const frameworkChainsLocal = {};
    filteredChains.forEach((chain) => {
      const framework = chain.framework || "Unknown";
      if (!frameworkChainsLocal[framework]) {
        frameworkChainsLocal[framework] = [];
      }
      frameworkChainsLocal[framework].push(chain.name);
    });
    setFrameworkChains(frameworkChainsLocal);
    console.log("Framework Chains:", frameworkChainsLocal);

    const daChainsLocal = {};
    filteredChains.forEach((chain) => {
      const daProvider = chain.da || "Unknown";
      if (!daChainsLocal[daProvider]) {
        daChainsLocal[daProvider] = [];
      }
      daChainsLocal[daProvider].push(chain.name);
    });
    setDaChains(daChainsLocal);
    console.log("DA Chains:", daChainsLocal);

    const l2L3ChainsLocal = { L2: [], L3: [] };
    filteredChains.forEach((chain) => {
      const l2OrL3 = chain.l2OrL3 || "Unknown";
      if (l2OrL3 === "L2" || l2OrL3 === "L3") {
        l2L3ChainsLocal[l2OrL3].push(chain.name);
      }
    });
    setL2L3Chains(l2L3ChainsLocal);
    console.log("L2/L3 Chains:", l2L3ChainsLocal);
  };

  // Function to process data for the table
  const processTableData = () => {
    // Aggregate data per vertical
    const verticalData = {};

    allChains.forEach((chain) => {
      if (
        selectedRaas !== "All Raas" &&
        (!chain.raas || chain.raas.toLowerCase() !== selectedRaas.toLowerCase())
      ) {
        return;
      }

      const vertical = chain.vertical || "Unknown";
      if (!verticalData[vertical]) {
        verticalData[vertical] = {
          count: 0,
          topChains: [],
        };
      }

      verticalData[vertical].count += 1;

      // Calculate based on selected filter
      let value = 0;
      if (tableFilter === "Transaction Count") {
        const transactions = transactionsByChainDate[chain.name] || {};
        value = Object.values(transactions).reduce(
          (acc, curr) => acc + (curr.value || 0),
          0
        );
      } else if (tableFilter === "TVL") {
        const tvlData = tvlDataByChainDate[chain.name] || {};
        const latestDate = Object.keys(tvlData).sort().pop();
        value = latestDate ? tvlData[latestDate].totalTvl : 0;
      } else if (tableFilter === "TPS") {
        // Assuming TPS data is similar to transactions, replace with actual data if different
        const transactions = transactionsByChainDate[chain.name] || {};
        value = Object.values(transactions).reduce(
          (acc, curr) => acc + (curr.value || 0),
          0
        );
      }

      verticalData[vertical].topChains.push({
        name: chain.name,
        logoUrl: chain.logoUrl,
        value, // Store value based on filter
      });
    });

    // Determine top 10 chains by selected filter per vertical
    Object.keys(verticalData).forEach((vertical) => {
      verticalData[vertical].topChains.sort((a, b) => b.value - a.value);
      verticalData[vertical].topChains = verticalData[vertical].topChains.slice(
        0,
        10 // Changed from 5 to 10
      );
    });

    // Prepare table data with filter indication in heading
    const tableDataLocal = Object.keys(verticalData).map((vertical) => {
      const data = verticalData[vertical];
      return {
        vertical,
        count: data.count,
        topChains: data.topChains,
      };
    });

    // Sort table data by count descending
    tableDataLocal.sort((a, b) => b.count - a.count);

    setTableData(tableDataLocal);
  };

  // Function to generate chart options with interactivity
  const generateChartOptions = (
    title,
    isPieChart = false,
    showPercentage = false
  ) => ({
    responsive: true,
    plugins: {
      legend: {
        position: "top",
        labels: { color: "#FFFFFF" },
      },
      title: {
        display: true,
        text: title,
        color: "#FFFFFF",
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            if (isPieChart) {
              const label = context.label || "";
              const value = context.parsed;
              const total = context.chart._metasets[context.datasetIndex].total;
              const percentage = ((value / total) * 100).toFixed(2);
              return `${label}: ${percentage}%`;
            } else {
              const label = context.dataset.label || "";
              const value =
                context.parsed.y !== undefined
                  ? context.parsed.y
                  : context.parsed;
              if (showPercentage) {
                const total = context.chart.scales.y.max || 1; // Prevent division by zero
                const percentage = ((value / total) * 100).toFixed(2);
                return `${label}: ${percentage}%`;
              }
              return `${label}: ${abbreviateNumber(value, 2)}`;
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
            ticks: { color: "#FFFFFF" },
            grid: { display: true }, // Keep grid lines for other charts
          },
          y: {
            ticks: { color: "#FFFFFF" },
            grid: { display: true }, // Keep grid lines for other charts
            beginAtZero: true,
          },
        },
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
  const getChainsByVerticalChartData = () => {
    const labels = Object.keys(chainsByVerticalData);
    const data = Object.values(chainsByVerticalData);
    return {
      labels,
      datasets: [
        {
          label: "Number of Chains",
          data,
          backgroundColor: labels.map((_, idx) => getColorByIndex(idx)),
        },
      ],
    };
  };

  const getTransactionCountByVerticalChartData = () => {
    const labels = Object.keys(transactionCountByVerticalData);
    const data = Object.values(transactionCountByVerticalData);
    return {
      labels,
      datasets: [
        {
          label: "Transaction Count",
          data: transactionCountPercentage
            ? data.map((val) =>
                ((val / (data.reduce((a, b) => a + b, 0) || 1)) * 100).toFixed(
                  2
                )
              )
            : data,
          backgroundColor: labels.map((_, idx) => getColorByIndex(idx)),
        },
      ],
    };
  };

  const getTvlByVerticalChartData = () => {
    const labels = Object.keys(tvlByVerticalData);
    const data = Object.values(tvlByVerticalData);
    return {
      labels,
      datasets: [
        {
          label: "Total Value Locked (TVL)",
          data: tvlPercentage
            ? data.map((val) =>
                ((val / (data.reduce((a, b) => a + b, 0) || 1)) * 100).toFixed(
                  2
                )
              )
            : data,
          backgroundColor: labels.map((_, idx) => getColorByIndex(idx)),
        },
      ],
    };
  };

  const getVerticalByFrameworkChartData = () => {
    const labels = Object.keys(verticalByFrameworkData);
    const frameworksSet = new Set();
    labels.forEach((vertical) => {
      Object.keys(verticalByFrameworkData[vertical]).forEach((framework) =>
        frameworksSet.add(framework)
      );
    });
    const frameworks = Array.from(frameworksSet);

    const datasets = frameworks.map((framework, idx) => {
      const data = labels.map(
        (vertical) => verticalByFrameworkData[vertical][framework] || 0
      );
      return {
        label: framework,
        data,
        backgroundColor: getColorByIndex(idx),
      };
    });

    return {
      labels,
      datasets,
    };
  };

  // Generate Framework Pie Chart Data
  const getFrameworkPieChartData = () => {
    const frameworkCounts = {};

    // Aggregate framework counts from verticalByFrameworkData
    Object.values(verticalByFrameworkData).forEach((frameworks) => {
      Object.entries(frameworks).forEach(([framework, count]) => {
        if (!frameworkCounts[framework]) {
          frameworkCounts[framework] = 0;
        }
        frameworkCounts[framework] += count;
      });
    });

    const labels = Object.keys(frameworkCounts);
    const data = Object.values(frameworkCounts);

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: labels.map((_, idx) => getColorByIndex(idx)),
        },
      ],
    };
  };

  // Generate DA by Vertical Chart Data
  const getDaByVerticalChartData = () => {
    const labels = Object.keys(daByVerticalData);
    const daProvidersSet = new Set();
    labels.forEach((vertical) => {
      Object.keys(daByVerticalData[vertical]).forEach((daProvider) =>
        daProvidersSet.add(daProvider)
      );
    });
    const daProviders = Array.from(daProvidersSet);

    const datasets = daProviders.map((daProvider, idx) => {
      const data = labels.map(
        (vertical) => daByVerticalData[vertical][daProvider] || 0
      );
      return {
        label: daProvider,
        data,
        backgroundColor: getColorByIndex(idx),
      };
    });

    return {
      labels,
      datasets,
    };
  };

  // Generate DA Pie Chart Data
  const getDaPieChartData = () => {
    const daCounts = {};

    // Aggregate DA counts from daByVerticalData
    Object.values(daByVerticalData).forEach((daProviders) => {
      Object.entries(daProviders).forEach(([daProvider, count]) => {
        if (!daCounts[daProvider]) {
          daCounts[daProvider] = 0;
        }
        daCounts[daProvider] += count;
      });
    });

    const labels = Object.keys(daCounts);
    const data = Object.values(daCounts);

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: labels.map((_, idx) => getColorByIndex(idx)),
        },
      ],
    };
  };

  // Generate L2/L3 by Vertical Chart Data
  const getL2L3ByVerticalChartData = () => {
    const labels = Object.keys(l2L3ByVerticalData);
    const levels = ["L2", "L3"];
    const datasets = levels.map((level, idx) => {
      const data = labels.map(
        (vertical) => l2L3ByVerticalData[level][vertical] || 0
      );
      return {
        label: level,
        data,
        backgroundColor: getColorByIndex(idx),
      };
    });

    return {
      labels,
      datasets,
    };
  };

  // Generate L2/L3 Pie Chart Data
  const getL2L3PieChartData = () => {
    const l2Counts = {};
    const l3Counts = {};

    // Aggregate L2 and L3 counts from l2L3ByVerticalData
    Object.entries(l2L3ByVerticalData).forEach(([level, verticals]) => {
      Object.entries(verticals).forEach(([vertical, count]) => {
        if (level === "L2") {
          if (!l2Counts[vertical]) {
            l2Counts[vertical] = 0;
          }
          l2Counts[vertical] += count;
        } else if (level === "L3") {
          if (!l3Counts[vertical]) {
            l3Counts[vertical] = 0;
          }
          l3Counts[vertical] += count;
        }
      });
    });

    const labels = ["L2", "L3"];
    const data = [
      Object.values(l2Counts).reduce((acc, val) => acc + val, 0),
      Object.values(l3Counts).reduce((acc, val) => acc + val, 0),
    ];

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: ["#36A2EB", "#FF6384"], // Specific colors for L2 and L3
        },
      ],
    };
  };

  // Generate Transaction Count Distribution Pie Chart Data
  const getTransactionCountDistributionChartData = () => {
    const labels = Object.keys(transactionCountByVerticalData);
    const data = Object.values(transactionCountByVerticalData);
    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: labels.map((_, idx) => getColorByIndex(idx)),
        },
      ],
    };
  };

  // Generate TVL Distribution Pie Chart Data
  const getTvlDistributionChartData = () => {
    const labels = Object.keys(tvlByVerticalData);
    const data = Object.values(tvlByVerticalData);
    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: labels.map((_, idx) => getColorByIndex(idx)),
        },
      ],
    };
  };

  // Function to handle RaaS selection
  const handleRaasChange = (value) => {
    setSelectedRaas(value);
  };

  // Function to handle Table Filter selection
  const handleTableFilterChange = (value) => {
    setTableFilter(value);
  };

  // Function to toggle Transaction Count Percentage View
  const toggleTransactionCountPercentage = () => {
    setTransactionCountPercentage((prev) => !prev);
  };

  // Function to toggle TVL Percentage View
  const toggleTvlPercentage = () => {
    setTvlPercentage((prev) => !prev);
  };

  // Function to handle Vertical Framework Bar Click
  const handleVerticalFrameworkBarClick = (datasetLabel, categoryLabel) => {
    if (
      selectedVerticalFrameworkCategory &&
      selectedVerticalFrameworkCategory.dataset === datasetLabel &&
      selectedVerticalFrameworkCategory.category === categoryLabel
    ) {
      setSelectedVerticalFrameworkCategory(null); // Deselect
    } else {
      setSelectedVerticalFrameworkCategory({
        dataset: datasetLabel,
        category: categoryLabel,
      });
    }
  };

  // Similarly, handle clicks for other charts
  const handleTransactionCountBarClick = (datasetLabel, categoryLabel) => {
    if (
      selectedTransactionCountCategory &&
      selectedTransactionCountCategory.dataset === datasetLabel &&
      selectedTransactionCountCategory.category === categoryLabel
    ) {
      setSelectedTransactionCountCategory(null);
    } else {
      setSelectedTransactionCountCategory({
        dataset: datasetLabel,
        category: categoryLabel,
      });
    }
  };

  const handleTvlBarClick = (datasetLabel, categoryLabel) => {
    if (
      selectedTvlCategory &&
      selectedTvlCategory.dataset === datasetLabel &&
      selectedTvlCategory.category === categoryLabel
    ) {
      setSelectedTvlCategory(null);
    } else {
      setSelectedTvlCategory({
        dataset: datasetLabel,
        category: categoryLabel,
      });
    }
  };

  const handleDaBarClick = (datasetLabel, categoryLabel) => {
    if (
      selectedDaCategory &&
      selectedDaCategory.dataset === datasetLabel &&
      selectedDaCategory.category === categoryLabel
    ) {
      setSelectedDaCategory(null);
    } else {
      setSelectedDaCategory({ dataset: datasetLabel, category: categoryLabel });
    }
  };

  const handleL2L3BarClick = (datasetLabel, categoryLabel) => {
    if (
      selectedL2L3Category &&
      selectedL2L3Category.dataset === datasetLabel &&
      selectedL2L3Category.category === categoryLabel
    ) {
      setSelectedL2L3Category(null);
    } else {
      setSelectedL2L3Category({
        dataset: datasetLabel,
        category: categoryLabel,
      });
    }
  };

  // Function to get framework chains
  const getFrameworkChains = (framework, category) => {
    return frameworkChains[framework] || [];
  };

  // Function to get DA chains
  const getDaChains = (daProvider, category) => {
    return daChains[daProvider] || [];
  };

  // Function to get L2/L3 chains
  const getL2L3Chains = (level, category) => {
    return l2L3Chains[level] || [];
  };

  return (
    <div className="ecosystem-page">
      <Sidebar />
      <div className="main-content">
        {/* Header */}
        <div className="ecosystem-header">
          <div className="heading-container">
            <FontAwesomeIcon icon={faChartPie} className="icon" />
            <div>
              <h2>Ecosystem Overview</h2>
              <p className="description">
                Explore the distribution and performance of various chains
                across different verticals within the ecosystem.
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
        {loading && <div className="loading">Loading ecosystem data...</div>}

        {/* Main Content */}
        {!loading && !error && (
          <>
            {/* Table and Filter Section */}
            <div className="table-filter-section">
              {/* Table Filter Dropdown */}
              <div className="table-filter-dropdown">
                <label htmlFor="table-filter">Filter by:</label>
                <TableFilterDropdown
                  options={filterOptions}
                  selected={tableFilter}
                  onChange={handleTableFilterChange}
                />
              </div>
            </div>

            <div className="ecosystem-content">
              {/* Left Side: Table */}
              <div className="left-section">
                <div className="table-card">
                  <h3>Verticals Overview ({tableFilter})</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Vertical ({tableFilter})</th>
                        <th>Top Chains</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.map((row) => (
                        <tr key={row.vertical}>
                          <td>
                            <div className="vertical-name">
                              <span className="name">{row.vertical}</span>
                              <span className="count">({row.count})</span>
                            </div>
                          </td>
                          <td>
                            <div className="top-chains">
                              {row.topChains.map((chain, idx) => (
                                <img
                                  key={`${chain.name}-${idx}`}
                                  src={chain.logoUrl}
                                  alt={chain.name}
                                  className="chain-logo"
                                  title={`${chain.name}: ${abbreviateNumber(
                                    chain.value,
                                    2
                                  )}`}
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src =
                                      "https://www.helika.io/wp-content/uploads/2023/09/proofofplay_logo.png";
                                  }}
                                />
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Side: Pie Chart */}
              <div className="right-section">
                <div className="chart-card">
                  <h3>Chains by Vertical</h3>
                  <Pie
                    data={getChainsByVerticalChartData()}
                    options={generateChartOptions("Chains by Vertical", true)} // isPieChart = true
                  />
                </div>
              </div>
            </div>

            {/* Percentage View Toggles */}
            <div className="percentage-toggles">
              <div className="toggle-item">
                <input
                  type="checkbox"
                  id="transactionCountPercentage"
                  checked={transactionCountPercentage}
                  onChange={toggleTransactionCountPercentage}
                />
                <label htmlFor="transactionCountPercentage">
                  Show Transaction Count as %
                </label>
              </div>
              <div className="toggle-item">
                <input
                  type="checkbox"
                  id="tvlPercentage"
                  checked={tvlPercentage}
                  onChange={toggleTvlPercentage}
                />
                <label htmlFor="tvlPercentage">Show TVL as %</label>
              </div>
            </div>

            {/* Charts Section */}
            <div className="charts-section">
              {/* Transaction Count by Vertical */}
              <div className="chart-pie-pair">
                <div className="chart-card">
                  <h3>Transaction Count by Vertical</h3>
                  <InteractiveBarChart
                    title="Transaction Count by Vertical"
                    data={getTransactionCountByVerticalChartData()}
                    options={generateChartOptions(
                      "Transaction Count by Vertical",
                      false,
                      transactionCountPercentage
                    )}
                    onBarClick={handleTransactionCountBarClick}
                    selectedCategory={selectedTransactionCountCategory}
                    categoryChains={(datasetLabel, categoryLabel) =>
                      getFrameworkChains(datasetLabel, categoryLabel)
                    }
                  />
                </div>
                {/* Transaction Count Pie Chart */}
                <div className="chart-card">
                  <h3>Transaction Count Distribution</h3>
                  <Pie
                    data={getTransactionCountDistributionChartData()}
                    options={generateChartOptions(
                      "Transaction Count Distribution",
                      true
                    )}
                  />
                </div>
              </div>

              {/* TVL by Vertical */}
              <div className="chart-pie-pair">
                <div className="chart-card">
                  <h3>TVL by Vertical</h3>
                  <InteractiveBarChart
                    title="TVL by Vertical"
                    data={getTvlByVerticalChartData()}
                    options={generateChartOptions(
                      "TVL by Vertical",
                      false,
                      tvlPercentage
                    )}
                    onBarClick={handleTvlBarClick}
                    selectedCategory={selectedTvlCategory}
                    categoryChains={(datasetLabel, categoryLabel) =>
                      getFrameworkChains(datasetLabel, categoryLabel)
                    }
                  />
                </div>
                {/* TVL Pie Chart */}
                <div className="chart-card">
                  <h3>TVL Distribution</h3>
                  <Pie
                    data={getTvlDistributionChartData()}
                    options={generateChartOptions("TVL Distribution", true)}
                  />
                </div>
              </div>

              {/* Vertical by Framework */}
              <div className="chart-pie-pair">
                <div className="chart-card">
                  <h3>Vertical by Framework</h3>
                  <InteractiveBarChart
                    title="Vertical by Framework"
                    data={getVerticalByFrameworkChartData()}
                    options={generateChartOptions(
                      "Vertical by Framework",
                      false
                    )}
                    onBarClick={handleVerticalFrameworkBarClick}
                    selectedCategory={selectedVerticalFrameworkCategory}
                    categoryChains={(datasetLabel, categoryLabel) =>
                      getFrameworkChains(datasetLabel, categoryLabel)
                    }
                  />
                </div>
                {/* Framework Pie Chart */}
                <div className="chart-card">
                  <h3>Framework Distribution</h3>
                  <Pie
                    data={getFrameworkPieChartData()}
                    options={generateChartOptions(
                      "Framework Distribution",
                      true
                    )}
                  />
                </div>
              </div>

              {/* DA by Vertical */}
              <div className="chart-pie-pair">
                <div className="chart-card">
                  <h3>Data Availability (DA) by Vertical</h3>
                  <InteractiveBarChart
                    title="DA by Vertical"
                    data={getDaByVerticalChartData()}
                    options={generateChartOptions("DA by Vertical", false)}
                    onBarClick={handleDaBarClick}
                    selectedCategory={selectedDaCategory}
                    categoryChains={(datasetLabel, categoryLabel) =>
                      getDaChains(datasetLabel, categoryLabel)
                    }
                  />
                </div>
                {/* DA Pie Chart */}
                <div className="chart-card">
                  <h3>DA Distribution</h3>
                  <Pie
                    data={getDaPieChartData()}
                    options={generateChartOptions("DA Distribution", true)}
                  />
                </div>
              </div>

              {/* L2/L3 by Vertical */}
              <div className="chart-pie-pair">
                <div className="chart-card">
                  <h3>L2/L3 by Vertical</h3>
                  <InteractiveBarChart
                    title="L2/L3 by Vertical"
                    data={getL2L3ByVerticalChartData()}
                    options={generateChartOptions("L2/L3 by Vertical", false)}
                    onBarClick={handleL2L3BarClick}
                    selectedCategory={selectedL2L3Category}
                    categoryChains={(datasetLabel, categoryLabel) =>
                      getL2L3Chains(datasetLabel, categoryLabel)
                    }
                  />
                </div>
                {/* Combined L2/L3 Pie Chart */}
                <div className="chart-card">
                  <h3>L2/L3 Distribution</h3>
                  <Pie
                    data={getL2L3PieChartData()}
                    options={generateChartOptions("L2/L3 Distribution", true)}
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

export default EcosystemPage;
