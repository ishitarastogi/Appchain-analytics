import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "../Sidebar/Sidebar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLayerGroup } from "@fortawesome/free-solid-svg-icons";
import "./RaaSPage.css";
import {
  Chart as ChartJS,
  LineElement,
  BarElement,
  PointElement,
  CategoryScale,
  LinearScale,
  TimeScale,
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
  fetchAllActiveAccounts,
  fetchAllTpsData,
  fetchAllTvlData,
} from "../services/googleSheetService";
import moment from "moment";
import { saveData, getData, clearAllData } from "../services/indexedDBService";
import { abbreviateNumber, formatNumber } from "../utils/numberFormatter";

// DA Logos
import EthereumDALogo from "../assets/logos/da/ethereum.png";
import DACLogo from "../assets/logos/da/dac.png";
import CelestiaLogo from "../assets/logos/da/celestia.png";
import EigenDALogo from "../assets/logos/da/EigenDA.jpg"; // Renamed for clarity

// Framework Logos
import OPStackLogo from "../assets/logos/framework/op.png";
import OrbitLogo from "../assets/logos/framework/arbitrums.png";
import PolygonLogo from "../assets/logos/framework/Polygon.jpeg";
import NovaLogo from "../assets/logos/framework/Nova.png";

// Register required components for Chart.js
ChartJS.register(
  LineElement,
  BarElement,
  PointElement,
  CategoryScale,
  LinearScale,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement
);

// Custom Number Formatter

// DA Logos Mapping
const daLogoMap = {
  EthereumDA: EthereumDALogo,
  DAC: DACLogo,
  Celestia: CelestiaLogo,
  "Eigen DA": EigenDALogo,

  // Add other DA mappings as needed
};

// Framework Logos Mapping
const frameworkLogoMap = {
  "OP Stack": OPStackLogo,
  Orbit: OrbitLogo,
  Polygon: PolygonLogo,
  "Arbitrum Nova": NovaLogo,
  // Add other Framework mappings as needed
};

// Utility functions to get logos
const getDALogo = (daName) => daLogoMap[daName] || "/logos/default_da.png";
const getFrameworkLogo = (frameworkName) =>
  frameworkLogoMap[frameworkName] || "/logos/default_framework.png";

const RAAS_DATA_ID = "raasPageData"; // Unique ID for IndexedDB

const RaaSPage = () => {
  // State variables
  const [selectedRaas, setSelectedRaas] = useState("Gelato"); // Default RaaS
  const [allChains, setAllChains] = useState([]);
  const [filteredChains, setFilteredChains] = useState([]);
  const [transactionsByChainDate, setTransactionsByChainDate] = useState({});
  const [activeAccountsByChainDate, setActiveAccountsByChainDate] = useState(
    {}
  );
  const [tpsDataByChainDate, setTpsDataByChainDate] = useState({});
  const [tvlDataByChainDate, setTvlDataByChainDate] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // State Variables for Time Range Selector
  const [timeRange, setTimeRange] = useState("All"); // Default time range is "All"

  // Chart View Options
  const [chartView, setChartView] = useState("Total"); // Options: Total, Per Chain
  const [chartType, setChartType] = useState("Absolute"); // Options: Absolute, Stacked, Percentage

  const raasOptions = ["Gelato", "Caldera", "Conduit", "Altlayer", "Alchemy"];

  const timeRangeOptions = [
    "Daily",
    "7 days",
    "30 days",
    "90 days",
    "180 days",
    "1 Year",
    "All",
  ];

  // DA and Framework Options (for filters)
  const [selectedVertical, setSelectedVertical] = useState("All Verticals");
  const [selectedFramework, setSelectedFramework] = useState("All Frameworks");
  const [selectedLayer, setSelectedLayer] = useState("All Layers");

  // Chart Colors Mapping
  const [chainColorMap, setChainColorMap] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      // await clearAllData();
      try {
        // Retrieve data from IndexedDB
        console.log("🔍 Attempting to retrieve data from IndexedDB...");
        const storedRecord = await getData(RAAS_DATA_ID);

        const oneHourAgo = Date.now() - 1 * 60 * 60 * 1000; // 1 hour

        if (storedRecord && storedRecord.timestamp > oneHourAgo) {
          // Use stored data if it's less than 1 hour old
          console.log("📦 Using cached data from IndexedDB.");
          populateStateWithData(storedRecord.data);
          setLoading(false);
          return;
        }

        console.log("🚀 Fetching new data from Google Sheets and APIs...");
        // Fetch new data if no valid stored data is available
        const sheetData = await fetchGoogleSheetData();
        console.log("sheetData", sheetData);
        const transactionsData = await fetchAllTransaction(sheetData);
        console.log("transactionsData", transactionsData);
        const activeAccountsData = await fetchAllActiveAccounts(sheetData);
        const tpsData = await fetchAllTpsData(sheetData);
        const tvlData = await fetchAllTvlData(sheetData);

        const newData = {
          sheetData,
          transactionsData,
          activeAccountsData,
          tpsData,
          tvlData,
        };

        // Save new data to IndexedDB
        console.log("💾 Saving new data to IndexedDB...");
        await saveData(RAAS_DATA_ID, newData);

        populateStateWithData(newData);
      } catch (error) {
        console.error("❌ Error during data fetching:", error);
        setError("Failed to load data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const populateStateWithData = (data) => {
    const {
      sheetData,
      transactionsData,
      activeAccountsData,
      tpsData,
      tvlData,
    } = data;

    // Include all chains
    const allChainsData = sheetData.map((chain) => ({
      ...chain,
      chainLogo:
        chain.logoUrl ||
        "https://www.helika.io/wp-content/uploads/2023/09/proofofplay_logo.png", // Default logo URL
    }));

    setAllChains(allChainsData);
    setTransactionsByChainDate(transactionsData.transactionsByChainDate);
    setActiveAccountsByChainDate(activeAccountsData.activeAccountsByChainDate);
    setTpsDataByChainDate(tpsData.tpsDataByChainDate);
    setTvlDataByChainDate(tvlData.tvlDataByChainDate);

    // Initialize chainColorMap
    const colorMap = {};
    allChainsData.forEach((chain, index) => {
      colorMap[chain.name] = getColorByIndex(index);
    });
    setChainColorMap(colorMap);
  };

  // Compute options for filters
  const verticalOptions = useMemo(() => {
    const options = new Set();
    allChains.forEach((chain) => {
      if (chain.vertical) options.add(chain.vertical);
    });
    return ["All Verticals", ...Array.from(options)];
  }, [allChains]);

  const frameworkOptions = useMemo(() => {
    const options = new Set();
    allChains.forEach((chain) => {
      if (chain.framework) options.add(chain.framework);
    });
    return ["All Frameworks", ...Array.from(options)];
  }, [allChains]);

  const layerOptions = useMemo(() => {
    const options = new Set();
    allChains.forEach((chain) => {
      if (chain.l2OrL3) options.add(chain.l2OrL3);
    });
    return ["All Layers", ...Array.from(options)];
  }, [allChains]);

  useEffect(() => {
    // Filter chains based on selected RaaS and other filters
    const filtered = allChains.filter((chain) => {
      const matchesRaas =
        chain.raas && chain.raas.toLowerCase() === selectedRaas.toLowerCase();

      const isMainnet =
        chain.status && chain.status.trim().toLowerCase() === "mainnet";

      // For Gelato, include all chains regardless of status
      // For other RaaS, include only mainnet chains
      const includeChain = selectedRaas.toLowerCase() === "gelato" || isMainnet;

      const matchesVertical =
        selectedVertical === "All Verticals" ||
        chain.vertical === selectedVertical;

      const matchesFramework =
        selectedFramework === "All Frameworks" ||
        chain.framework === selectedFramework;

      const matchesLayer =
        selectedLayer === "All Layers" || chain.l2OrL3 === selectedLayer;

      return (
        matchesRaas &&
        includeChain &&
        matchesVertical &&
        matchesFramework &&
        matchesLayer
      );
    });

    setFilteredChains(filtered);
  }, [
    allChains,
    selectedRaas,
    selectedVertical,
    selectedFramework,
    selectedLayer,
  ]);

  // Function moved above useMemo to avoid ReferenceError
  const findMostRecentNonApproximateDate = () => {
    let currentDate = moment().subtract(1, "day");
    while (currentDate.isAfter(moment().subtract(30, "days"))) {
      const dateStr = currentDate.format("YYYY-MM-DD");
      const isApproximate = Object.values(transactionsByChainDate).some(
        (chainData) => chainData[dateStr]?.is_approximate
      );
      if (!isApproximate) {
        return dateStr;
      }
      currentDate.subtract(1, "day");
    }
    return null;
  };

  // Get filtered dates based on timeRange
  const filteredDates = useMemo(() => {
    const today = moment().endOf("day");
    let startDate;
    let endDate = today;

    switch (timeRange) {
      case "Daily":
        // For Daily, get the most recent non-approximate date
        startDate = findMostRecentNonApproximateDate();
        if (!startDate) {
          console.warn("No non-approximate data found in the last 30 days.");
          return [];
        }
        return [startDate];
      case "7 days":
        startDate = moment().subtract(7, "days").startOf("day");
        break;
      case "30 days":
        startDate = moment().subtract(30, "days").startOf("day");
        break;
      case "90 days":
        startDate = moment().subtract(90, "days").startOf("day");
        break;
      case "180 days":
        startDate = moment().subtract(180, "days").startOf("day");
        break;
      case "1 Year":
        startDate = moment().subtract(1, "year").startOf("day");
        break;
      case "All":
        // Find the earliest launch date among the filtered chains
        const launchDates = filteredChains
          .filter((chain) => chain.launchDate)
          .map((chain) => moment(chain.launchDate).startOf("day"));
        if (launchDates.length > 0) {
          startDate = moment.min(launchDates);
        } else {
          startDate = moment().subtract(1, "year").startOf("day"); // default to 1 year ago
        }
        break;
      default:
        startDate = moment().subtract(90, "days").startOf("day"); // default to 90 days
    }

    const dates = [];
    let currentDate = moment(startDate);
    while (currentDate.isSameOrBefore(endDate, "day")) {
      dates.push(currentDate.format("YYYY-MM-DD"));
      currentDate.add(1, "day");
    }
    return dates;
  }, [timeRange, filteredChains, transactionsByChainDate]);

  // Statistics Calculations

  const totalProjects = filteredChains.length;

  const totalTransactions = useMemo(() => {
    let total = 0;
    filteredChains.forEach((chain) => {
      const chainName = chain.name;
      const chainTransactions = transactionsByChainDate[chainName] || {};
      filteredDates.forEach((date) => {
        if (
          chainTransactions[date] &&
          !chainTransactions[date].is_approximate
        ) {
          total += chainTransactions[date].value || 0;
        }
      });
    });
    return total;
  }, [filteredChains, transactionsByChainDate, filteredDates]);

  const totalActiveAccounts = useMemo(() => {
    let total = 0;
    filteredChains.forEach((chain) => {
      const chainName = chain.name;
      const chainAccounts = activeAccountsByChainDate[chainName] || {};
      filteredDates.forEach((date) => {
        if (chainAccounts[date]) {
          total += chainAccounts[date] || 0;
        }
      });
    });
    return total;
  }, [filteredChains, activeAccountsByChainDate, filteredDates]);

  const totalTVL = useMemo(() => {
    let total = 0;
    filteredChains.forEach((chain) => {
      const chainName = chain.name;
      const chainTvlData = tvlDataByChainDate[chainName] || {};
      // Get the latest TVL within the filtered dates
      const relevantDates = filteredDates.filter((date) => chainTvlData[date]);
      if (relevantDates.length > 0) {
        const latestDate = relevantDates.reduce((a, b) =>
          moment(a).isAfter(b) ? a : b
        );
        const currentTvl = chainTvlData[latestDate]?.totalTvl || 0;
        total += currentTvl;
      }
    });
    return total;
  }, [filteredChains, tvlDataByChainDate, filteredDates]);

  const averageTPS = useMemo(() => {
    let total = 0;
    let count = 0;
    filteredChains.forEach((chain) => {
      const chainName = chain.name;
      const chainTpsData = tpsDataByChainDate[chainName] || {};
      // Get the latest TPS within the filtered dates
      const relevantDates = filteredDates.filter((date) => chainTpsData[date]);
      if (relevantDates.length > 0) {
        const latestDate = relevantDates.reduce((a, b) =>
          moment(a).isAfter(b) ? a : b
        );
        const currentTps = chainTpsData[latestDate] || 0;
        total += currentTps;
        count += 1;
      }
    });
    // Avoid division by zero
    return count > 0 ? total / count : 0;
  }, [filteredChains, tpsDataByChainDate, filteredDates]);

  // Helper function to get period label
  const getPeriodLabel = () => {
    switch (timeRange) {
      case "Daily":
        return "Yesterday";
      case "7 days":
        return "Last 7 days";
      case "30 days":
        return "Last 30 days";
      case "90 days":
        return "Last 90 days";
      case "180 days":
        return "Last 180 days";
      case "1 Year":
        return "Last Year";
      case "All":
        return "All Time";
      default:
        return "Selected Period";
    }
  };

  // Launch Timeline Chart Data
  const launchTimelineData = useMemo(() => {
    const data = filteredChains
      .filter((chain) => chain.launchDate)
      .map((chain) => ({
        chainName: chain.name,
        launchDate: moment(chain.launchDate).format("YYYY-MM-DD"),
      }))
      .sort((a, b) =>
        moment(a.launchDate).isBefore(moment(b.launchDate)) ? -1 : 1
      );
    return data;
  }, [filteredChains]);

  // Table Data
  const tableData = useMemo(() => {
    return filteredChains
      .map((chain) => {
        const chainName = chain.name;
        const chainLogo = chain.chainLogo || ""; // Use chainLogo
        const chainVertical = chain.vertical || "N/A";
        const chainFramework = chain.framework || "N/A";
        const chainDA = chain.da || "N/A";

        // TVL
        const chainTvl = tvlDataByChainDate[chainName] || {};
        const relevantTvlDates = filteredDates.filter((date) => chainTvl[date]);
        let currentTvl = 0;
        if (relevantTvlDates.length > 0) {
          const latestDate = relevantTvlDates.reduce((a, b) =>
            moment(a).isAfter(b) ? a : b
          );
          currentTvl = chainTvl[latestDate]?.totalTvl || 0;
        }

        // Total Transactions within filtered dates
        const chainTransactions = transactionsByChainDate[chainName] || {};
        let totalTransactions = 0;
        filteredDates.forEach((date) => {
          if (
            chainTransactions[date] &&
            !chainTransactions[date].is_approximate
          ) {
            totalTransactions += chainTransactions[date].value || 0;
          }
        });

        // Total Active Accounts within filtered dates
        const chainAccounts = activeAccountsByChainDate[chainName] || {};
        let totalActiveAccounts = 0;
        filteredDates.forEach((date) => {
          if (chainAccounts[date]) {
            totalActiveAccounts += chainAccounts[date] || 0;
          }
        });

        // Current TPS within filtered dates
        const chainTpsData = tpsDataByChainDate[chainName] || {};
        let currentTps = 0;
        const relevantTpsDates = filteredDates.filter(
          (date) => chainTpsData[date]
        );
        if (relevantTpsDates.length > 0) {
          const latestTpsDate = relevantTpsDates.reduce((a, b) =>
            moment(a).isAfter(b) ? a : b
          );
          currentTps = chainTpsData[latestTpsDate] || 0;
        }

        // Chain Status
        const chainStatus =
          selectedRaas.toLowerCase() === "gelato"
            ? chain.status && chain.status.trim().toLowerCase() !== "mainnet"
              ? "Testnet"
              : "Mainnet"
            : "Mainnet"; // For non-Gelato RaaS, only Mainnet is included

        return {
          chainName,
          chainLogo,
          chainVertical,
          chainFramework,
          chainDA,
          currentTvl,
          totalTransactions,
          totalActiveAccounts,
          currentTps,
          chainStatus, // Added Chain Status
        };
      })
      .sort((a, b) => b.currentTvl - a.currentTvl);
  }, [
    filteredChains,
    tvlDataByChainDate,
    transactionsByChainDate,
    activeAccountsByChainDate,
    tpsDataByChainDate,
    selectedRaas,
    filteredDates,
  ]);

  // Activity Charts Data
  const activityChartData = useMemo(() => {
    const dates = filteredDates;

    // Initialize datasets
    const transactionDatasets = [];
    const activeAccountsDatasets = [];
    const tvlDatasets = [];

    if (chartView === "Total") {
      // Total data
      const transactionCounts = dates.map((date) => {
        let total = 0;
        filteredChains.forEach((chain) => {
          const chainName = chain.name;
          const chainTransactions = transactionsByChainDate[chainName] || {};
          if (
            chainTransactions[date] &&
            !chainTransactions[date].is_approximate
          ) {
            total += chainTransactions[date]?.value || 0;
          }
        });
        return total;
      });

      const activeAccountsCounts = dates.map((date) => {
        let total = 0;
        filteredChains.forEach((chain) => {
          const chainName = chain.name;
          const chainAccounts = activeAccountsByChainDate[chainName] || {};
          total += chainAccounts[date] || 0;
        });
        return total;
      });

      const tvlValues = dates.map((date) => {
        let total = 0;
        filteredChains.forEach((chain) => {
          const chainName = chain.name;
          const chainTvl = tvlDataByChainDate[chainName] || {};
          total += chainTvl[date]?.totalTvl || 0;
        });
        return total;
      });

      transactionDatasets.push({
        label: "Total Transactions",
        data: transactionCounts,
        borderColor: "#FF6384",
        backgroundColor: "rgba(255,99,132,0.2)",
        fill: true,
        tension: 0.1,
      });

      activeAccountsDatasets.push({
        label: "Total Active Accounts",
        data: activeAccountsCounts,
        borderColor: "#36A2EB",
        backgroundColor: "rgba(54,162,235,0.2)",
        fill: true,
        tension: 0.1,
      });

      tvlDatasets.push({
        label: "Total TVL",
        data: tvlValues,
        borderColor: "#FFCE56",
        backgroundColor: "rgba(255,206,86,0.2)",
        fill: true,
        tension: 0.1,
      });
    } else {
      // Per-chain data
      filteredChains.forEach((chain, index) => {
        const chainName = chain.name;
        const color = getColorForChain(chainName);

        // Transactions
        const transactionData = dates.map((date) => {
          const chainTransactions = transactionsByChainDate[chainName] || {};
          return chainTransactions[date] &&
            !chainTransactions[date].is_approximate
            ? chainTransactions[date]?.value || 0
            : 0;
        });
        transactionDatasets.push({
          label: chainName,
          data: transactionData,
          borderColor: color,
          backgroundColor: color,
          fill: false,
          tension: 0.1,
        });

        // Active Accounts
        const activeAccountsData = dates.map((date) => {
          const chainAccounts = activeAccountsByChainDate[chainName] || {};
          return chainAccounts[date] || 0;
        });
        activeAccountsDatasets.push({
          label: chainName,
          data: activeAccountsData,
          borderColor: color,
          backgroundColor: color,
          fill: false,
          tension: 0.1,
        });

        // TVL
        const tvlData = dates.map((date) => {
          const chainTvl = tvlDataByChainDate[chainName] || {};
          return chainTvl[date]?.totalTvl || 0;
        });
        tvlDatasets.push({
          label: chainName,
          data: tvlData,
          borderColor: color,
          backgroundColor: color,
          fill: false,
          tension: 0.1,
        });
      });
    }

    return {
      dates,
      transactionDatasets,
      activeAccountsDatasets,
      tvlDatasets,
    };
  }, [
    filteredChains,
    transactionsByChainDate,
    activeAccountsByChainDate,
    tvlDataByChainDate,
    chartView,
    chartType,
    filteredDates,
  ]);

  // Ecosystem Charts Data
  const ecosystemChartData = useMemo(() => {
    // Chain by Vertical
    const verticalCounts = {};
    const verticalChains = {};
    filteredChains.forEach((chain) => {
      const vertical = chain.vertical || "N/A";
      verticalCounts[vertical] = (verticalCounts[vertical] || 0) + 1;
      if (!verticalChains[vertical]) verticalChains[vertical] = [];
      verticalChains[vertical].push(chain.name);
    });

    // Chain by DA
    const daCounts = {};
    const daChains = {};
    filteredChains.forEach((chain) => {
      const da = chain.da || "N/A";
      daCounts[da] = (daCounts[da] || 0) + 1;
      if (!daChains[da]) daChains[da] = [];
      daChains[da].push(chain.name);
    });

    // Chain by Framework
    const frameworkCounts = {};
    const frameworkChains = {};
    filteredChains.forEach((chain) => {
      const framework = chain.framework || "N/A";
      frameworkCounts[framework] = (frameworkCounts[framework] || 0) + 1;
      if (!frameworkChains[framework]) frameworkChains[framework] = [];
      frameworkChains[framework].push(chain.name);
    });

    // Chain by L2/L3
    const layerCounts = {};
    const layerChains = {};
    filteredChains.forEach((chain) => {
      const layer = chain.l2OrL3 || "N/A";
      layerCounts[layer] = (layerCounts[layer] || 0) + 1;
      if (!layerChains[layer]) layerChains[layer] = [];
      layerChains[layer].push(chain.name);
    });

    return {
      verticalCounts,
      verticalChains,
      daCounts,
      daChains,
      frameworkCounts,
      frameworkChains,
      layerCounts,
      layerChains,
    };
  }, [filteredChains]);

  // Handle Time Range Change
  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
  };

  // Handle Chart View Change
  const handleChartViewChange = (event) => {
    setChartView(event.target.value);
  };

  // Handle Chart Type Change
  const handleChartTypeChange = (event) => {
    setChartType(event.target.value);
  };

  // Utility functions
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

  const getColorForChain = (chainName) => {
    return chainColorMap[chainName] || getRandomColor();
  };

  const getRandomColor = () => {
    const letters = "0123456789ABCDEF";
    let color = "#";
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  };

  return (
    <div className="raas-page">
      <Sidebar />
      <div className="main-content">
        {/* Header */}
        <div className="raas-header">
          <div className="heading-container">
            <FontAwesomeIcon icon={faLayerGroup} className="icon" />
            <div>
              <h2>{selectedRaas} RaaS</h2>
              <p className="description">
                Overview and analytics for {selectedRaas} Rollup as a Service.
              </p>
            </div>
          </div>

          {/* RaaS Selection Dropdown */}
          <div className="raas-dropdown">
            <select
              value={selectedRaas}
              onChange={(e) => setSelectedRaas(e.target.value)}
            >
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

        {!loading && (
          <>
            {/* Time Range Selector */}
            <div className="time-range-selector">
              {timeRangeOptions.map((range) => (
                <button
                  key={range}
                  className={timeRange === range ? "active" : ""}
                  onClick={() => handleTimeRangeChange(range)}
                >
                  {range}
                </button>
              ))}
            </div>

            {/* Statistics Cards */}
            <div className="stats-cards">
              <div className="stats-card">
                <h3>Total Projects</h3>
                <p>{totalProjects}</p>
              </div>
              <div className="stats-card">
                <h3>Total Transactions</h3>
                <p>{abbreviateNumber(totalTransactions, 2)}</p>
              </div>
              <div className="stats-card">
                <h3>Total Active Accounts</h3>
                <p>{abbreviateNumber(totalActiveAccounts, 2)}</p>
              </div>
              <div className="stats-card">
                <h3>Total TVL</h3>
                <p>${abbreviateNumber(totalTVL, 2)}</p>
              </div>
              <div className="stats-card">
                <h3>Average TPS</h3>
                <p>{averageTPS.toFixed(2)}</p>
              </div>
            </div>

            {/* Launch Timeline */}
            <h3 style={{ marginLeft: "30px" }}>Launch Timeline</h3>

            {/* Launch Timeline Chart */}
            <div className="launch-timeline-section">
              {/* Central horizontal line */}
              <div className="timeline-horizontal-line"></div>

              {/* Scrollable container */}
              <div className="timeline-chart-container">
                <div className="timeline-chart">
                  {launchTimelineData.map((item, index) => (
                    <div key={index} className="timeline-item">
                      {/* Vertical line */}
                      <div
                        className={
                          index % 2 === 0
                            ? "vertical-line vertical-line-above"
                            : "vertical-line vertical-line-below"
                        }
                      ></div>

                      {/* Dot positioned at the end of the vertical line */}
                      <div
                        className={
                          index % 2 === 0
                            ? "timeline-dot dot-above"
                            : "timeline-dot dot-below"
                        }
                      ></div>

                      {/* Label positioned at the dot */}
                      <div
                        className={
                          index % 2 === 0
                            ? "timeline-label label-above"
                            : "timeline-label label-below"
                        }
                      >
                        <div className="chain-name">{item.chainName}</div>
                        <div className="launch-date">
                          {moment(item.launchDate).format("MMM YYYY")}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="filters-container">
              <div className="filter-dropdown">
                <label>Vertical:</label>
                <select
                  value={selectedVertical}
                  onChange={(e) => setSelectedVertical(e.target.value)}
                >
                  {verticalOptions.map((vertical) => (
                    <option key={vertical} value={vertical}>
                      {vertical}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filter-dropdown">
                <label>Framework:</label>
                <select
                  value={selectedFramework}
                  onChange={(e) => setSelectedFramework(e.target.value)}
                >
                  {frameworkOptions.map((framework) => (
                    <option key={framework} value={framework}>
                      {framework}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filter-dropdown">
                <label>L2/L3:</label>
                <select
                  value={selectedLayer}
                  onChange={(e) => setSelectedLayer(e.target.value)}
                >
                  {layerOptions.map((layer) => (
                    <option key={layer} value={layer}>
                      {layer}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Data Table */}
            <div className="table-section">
              <h3 className="section-title">Projects</h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Vertical</th>
                      <th>TVL</th>
                      <th>Tx Count ({getPeriodLabel()})</th>
                      <th>Active Accounts</th>
                      <th>Current TPS</th>
                      {/* Removed Status Column */}
                    </tr>
                  </thead>

                  <tbody>
                    {tableData.map((chain, index) => (
                      <tr key={index}>
                        <td className="chain-name-cell">
                          {/* Chain Logo */}
                          <img
                            src={chain.chainLogo}
                            alt={chain.chainName}
                            className="chain-logo"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src =
                                "https://www.helika.io/wp-content/uploads/2023/09/proofofplay_logo.png"; // Fallback logo
                            }}
                          />
                          {/* Chain Details */}
                          <div className="chain-name-details">
                            {/* Chain Name */}
                            <span className="chain-name">
                              {chain.chainName}
                            </span>

                            {/* Display "Testnet" in bold if applicable */}
                            {chain.chainStatus === "Testnet" && (
                              <strong className="testnet-label">Testnet</strong>
                            )}

                            {/* Framework with Small Logo */}
                            <span className="chain-framework">
                              Framework: {chain.chainFramework}
                              {chain.chainFramework && (
                                <img
                                  src={getFrameworkLogo(chain.chainFramework)}
                                  alt={chain.chainFramework}
                                  className="small-logo"
                                  title={chain.chainFramework}
                                />
                              )}
                            </span>

                            {/* DA with Small Logo */}
                            <span className="chain-da">
                              DA: {chain.chainDA}
                              {chain.chainDA && (
                                <img
                                  src={getDALogo(chain.chainDA)}
                                  alt={chain.chainDA}
                                  className="small-logo"
                                  title={chain.chainDA}
                                />
                              )}
                            </span>
                          </div>
                        </td>
                        <td>{chain.chainVertical}</td>
                        <td>${abbreviateNumber(chain.currentTvl, 2)}</td>
                        <td>{abbreviateNumber(chain.totalTransactions, 2)}</td>
                        <td>
                          {abbreviateNumber(chain.totalActiveAccounts, 2)}
                        </td>
                        <td>{chain.currentTps.toFixed(2)}</td>
                        {/* Removed Status Cell */}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Chart View Options */}
            <div className="chart-options">
              <div className="chart-view-dropdown">
                <label>Chart View:</label>
                <select value={chartView} onChange={handleChartViewChange}>
                  <option value="Total">Total</option>
                  <option value="Per Chain">Per Chain</option>
                </select>
              </div>
              <div className="chart-type-dropdown">
                <label>Chart Type:</label>
                <select value={chartType} onChange={handleChartTypeChange}>
                  <option value="Absolute">Absolute</option>
                  <option value="Stacked">Stacked</option>
                  <option value="Percentage">Percentage</option>
                </select>
              </div>
            </div>

            {/* Activity Charts */}
            <div className="activity-charts-section">
              <h2>Activity Charts</h2>

              <div className="charts-grid">
                {/* Transaction Count Chart */}
                <div className="chart-card">
                  <h4>Transaction Count</h4>
                  <Line
                    data={{
                      labels: activityChartData.dates.map((date) =>
                        moment(date).format("D MMM")
                      ),
                      datasets: activityChartData.transactionDatasets,
                    }}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          display: chartView === "Per Chain",
                          position: "bottom",
                          labels: {
                            color: "#FFFFFF",
                          },
                        },
                      },
                      scales: {
                        x: {
                          ticks: {
                            color: "#FFFFFF",
                            maxRotation: 45,
                            minRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 10,
                          },
                        },
                        y: {
                          ticks: {
                            color: "#FFFFFF",
                            beginAtZero: true,
                          },
                        },
                      },
                    }}
                  />
                </div>
                {/* Active Accounts Chart */}
                <div className="chart-card">
                  <h4>Active Accounts</h4>
                  <Line
                    data={{
                      labels: activityChartData.dates.map((date) =>
                        moment(date).format("D MMM")
                      ),
                      datasets: activityChartData.activeAccountsDatasets,
                    }}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          display: chartView === "Per Chain",
                          position: "bottom",
                          labels: {
                            color: "#FFFFFF",
                          },
                        },
                      },
                      scales: {
                        x: {
                          ticks: {
                            color: "#FFFFFF",
                            maxRotation: 45,
                            minRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 10,
                          },
                        },
                        y: {
                          ticks: {
                            color: "#FFFFFF",
                            beginAtZero: true,
                          },
                        },
                      },
                    }}
                  />
                </div>
                {/* TVL Chart */}
                <div className="chart-card">
                  <h4>Total Value Locked (TVL)</h4>
                  <Line
                    data={{
                      labels: activityChartData.dates.map((date) =>
                        moment(date).format("D MMM")
                      ),
                      datasets: activityChartData.tvlDatasets,
                    }}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          display: chartView === "Per Chain",
                          position: "bottom",
                          labels: {
                            color: "#FFFFFF",
                          },
                        },
                      },
                      scales: {
                        x: {
                          ticks: {
                            color: "#FFFFFF",
                            maxRotation: 45,
                            minRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 10,
                          },
                        },
                        y: {
                          ticks: {
                            color: "#FFFFFF",
                            beginAtZero: true,
                          },
                        },
                      },
                    }}
                  />
                </div>
                {/* Average TPS Chart */}
                <div className="chart-card">
                  <h4>Average TPS</h4>
                  <Line
                    data={{
                      labels: activityChartData.dates.map((date) =>
                        moment(date).format("D MMM")
                      ),
                      datasets: [
                        {
                          label: "Average TPS",
                          data: activityChartData.dates.map((date) => {
                            let total = 0;
                            let count = 0;
                            filteredChains.forEach((chain) => {
                              const chainName = chain.name;
                              const chainTps =
                                tpsDataByChainDate[chainName] || {};
                              if (chainTps[date] !== undefined) {
                                total += chainTps[date];
                                count += 1;
                              }
                            });
                            return count > 0 ? total / count : 0;
                          }),
                          borderColor: "#4BC0C0",
                          backgroundColor: "rgba(75, 192, 192, 0.2)",
                          tension: 0.1,
                          fill: true,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          display: false,
                        },
                        title: {
                          display: true,
                          text: `Average TPS Over Time - ${getPeriodLabel()}`,
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
                              return `${label}: ${
                                value !== undefined ? value.toFixed(2) : "N/A"
                              }`;
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
                            text: "Date",
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
                          title: {
                            display: true,
                            text: "Average TPS",
                            color: "#FFFFFF",
                          },
                          ticks: {
                            color: "#FFFFFF",
                            beginAtZero: true,
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
              </div>
            </div>

            {/* Ecosystem Charts */}
            <div className="ecosystem-charts-section">
              <h2>Ecosystem Charts</h2>
              <div className="charts-grid">
                {/* Chain by Vertical */}
                <div className="chart-card">
                  <h4>Chains by Vertical</h4>
                  <Pie
                    data={{
                      labels: Object.keys(ecosystemChartData.verticalCounts),
                      datasets: [
                        {
                          data: Object.values(
                            ecosystemChartData.verticalCounts
                          ),
                          backgroundColor: [
                            "#FF6384",
                            "#36A2EB",
                            "#FFCE56",
                            "#4BC0C0",
                            "#9966FF",
                          ],
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          position: "right",
                          labels: {
                            color: "#FFFFFF",
                          },
                        },
                        tooltip: {
                          callbacks: {
                            label: function (tooltipItem) {
                              const index = tooltipItem.dataIndex;
                              const label = tooltipItem.label;
                              const count = tooltipItem.dataset.data[index];
                              const chainNames =
                                ecosystemChartData.verticalChains[label];
                              return [`${label}: ${count}`, ...chainNames];
                            },
                          },
                        },
                      },
                    }}
                  />
                </div>
                {/* Chain by DA */}
                <div className="chart-card">
                  <h4>Chains by Data Availability</h4>
                  <Pie
                    data={{
                      labels: Object.keys(ecosystemChartData.daCounts),
                      datasets: [
                        {
                          data: Object.values(ecosystemChartData.daCounts),
                          backgroundColor: [
                            "#FF6384",
                            "#36A2EB",
                            "#FFCE56",
                            "#4BC0C0",
                            "#9966FF",
                          ],
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          position: "right",
                          labels: {
                            color: "#FFFFFF",
                          },
                        },
                        tooltip: {
                          callbacks: {
                            label: function (tooltipItem) {
                              const index = tooltipItem.dataIndex;
                              const label = tooltipItem.label;
                              const count = tooltipItem.dataset.data[index];
                              const chainNames =
                                ecosystemChartData.daChains[label];
                              return [`${label}: ${count}`, ...chainNames];
                            },
                          },
                        },
                      },
                    }}
                  />
                </div>
                {/* Chain by Framework */}
                <div className="chart-card">
                  <h4>Chains by Framework</h4>
                  <Pie
                    data={{
                      labels: Object.keys(ecosystemChartData.frameworkCounts),
                      datasets: [
                        {
                          data: Object.values(
                            ecosystemChartData.frameworkCounts
                          ),
                          backgroundColor: [
                            "#FF6384",
                            "#36A2EB",
                            "#FFCE56",
                            "#4BC0C0",
                            "#9966FF",
                          ],
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          position: "right",
                          labels: {
                            color: "#FFFFFF",
                          },
                        },
                        tooltip: {
                          callbacks: {
                            label: function (tooltipItem) {
                              const index = tooltipItem.dataIndex;
                              const label = tooltipItem.label;
                              const count = tooltipItem.dataset.data[index];
                              const chainNames =
                                ecosystemChartData.frameworkChains[label];
                              return [`${label}: ${count}`, ...chainNames];
                            },
                          },
                        },
                      },
                    }}
                  />
                </div>
                {/* Chain by L2/L3 */}
                <div className="chart-card">
                  <h4>Chains by Layer (L2/L3)</h4>
                  <Pie
                    data={{
                      labels: Object.keys(ecosystemChartData.layerCounts),
                      datasets: [
                        {
                          data: Object.values(ecosystemChartData.layerCounts),
                          backgroundColor: [
                            "#FF6384",
                            "#36A2EB",
                            "#FFCE56",
                            "#4BC0C0",
                            "#9966FF",
                          ],
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          position: "right",
                          labels: {
                            color: "#FFFFFF",
                          },
                        },
                        tooltip: {
                          callbacks: {
                            label: function (tooltipItem) {
                              const index = tooltipItem.dataIndex;
                              const label = tooltipItem.label;
                              const count = tooltipItem.dataset.data[index];
                              const chainNames =
                                ecosystemChartData.layerChains[label];
                              return [`${label}: ${count}`, ...chainNames];
                            },
                          },
                        },
                      },
                    }}
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

export default RaaSPage;
