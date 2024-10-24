// src/pages/L2L3Page.js

import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "../Sidebar/Sidebar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLayerGroup } from "@fortawesome/free-solid-svg-icons";
import "./L2L3Page.css";
import { Pie, Bar } from "react-chartjs-2";
import {
  fetchGoogleSheetData,
  fetchAllTransaction,
  fetchAllTvlData,
  fetchAllActiveAccounts,
} from "../services/googleSheetService";
import { abbreviateNumber } from "../utils/numberFormatter";
import { saveData, getData } from "../services/indexedDBService";

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

const L2_L3_DATA_ID = "l2L3Data";
const SIX_HOURS_IN_MS = 6 * 60 * 60 * 1000;

const L2L3Page = () => {
  // State variables
  const [raasOptions, setRaasOptions] = useState(["All Raas"]);
  const [selectedRaas, setSelectedRaas] = useState("All Raas");
  const [allChains, setAllChains] = useState([]);

  const [transactionsByChainDate, setTransactionsByChainDate] = useState({});
  const [approximateDataByChainDate, setApproximateDataByChainDate] = useState(
    {}
  );
  const [totalTransactionsCombined, setTotalTransactionsCombined] = useState(0);

  const [tvlDataByChainDate, setTvlDataByChainDate] = useState({});
  const [activeAccountsByChainDate, setActiveAccountsByChainDate] = useState(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data for charts
  const [chainsCountByL2L3, setChainsCountByL2L3] = useState({});
  const [transactionCountByL2L3, setTransactionCountByL2L3] = useState({});
  const [tvlByL2L3, setTvlByL2L3] = useState({});

  const [verticalCountsByL2L3, setVerticalCountsByL2L3] = useState({});
  const [verticalsByL2L3Data, setVerticalsByL2L3Data] = useState({});

  const [daCountsByL2L3, setDaCountsByL2L3] = useState({});
  const [daByL2L3Data, setDaByL2L3Data] = useState({});

  const [frameworkCountsByL2L3, setFrameworkCountsByL2L3] = useState({});
  const [frameworkByL2L3Data, setFrameworkByL2L3Data] = useState({});

  // Table Data
  const [tableData, setTableData] = useState([]);

  // State variables for filters and toggles
  const [tableFilter, setTableFilter] = useState("Transaction Count");
  const [showPercentageTransactionCount, setShowPercentageTransactionCount] =
    useState(false);
  const [showPercentageTvl, setShowPercentageTvl] = useState(false);

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

  // Define fetchData outside useEffect using useCallback to prevent re-creation
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Retrieve data from IndexedDB
      const storedRecord = await getData(L2_L3_DATA_ID);
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
      const transactionData = await fetchAllTransaction(sheetData);
      const tvlData = await fetchAllTvlData(sheetData);
      const activeAccountsData = await fetchAllActiveAccounts(sheetData);

      console.log("Fetched Data:", {
        sheetData,
        transactionData,
        tvlData,
        activeAccountsData,
      });

      const newData = {
        sheetData,
        transactionData,
        tvlData,
        activeAccountsData,
      };

      // Save new data with timestamp to IndexedDB
      await saveData(L2_L3_DATA_ID, newData);

      populateStateWithData(newData);
    } catch (err) {
      console.error("❌ Error fetching data:", err);
      setError(`Failed to load L2/L3 data: ${err.message}`);
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
    approximateDataByChainDate,
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

    // Chains count by L2/L3
    const chainsCount = {};
    filteredChains.forEach((chain) => {
      const l2OrL3 = chain.l2OrL3 || "Unknown";
      if (!chainsCount[l2OrL3]) {
        chainsCount[l2OrL3] = 0;
      }
      chainsCount[l2OrL3] += 1;
    });
    setChainsCountByL2L3(chainsCount);

    // Transaction Count by L2/L3
    const transactionCount = {};
    filteredChains.forEach((chain) => {
      const l2OrL3 = chain.l2OrL3 || "Unknown";
      const transactions = transactionsByChainDate[chain.name] || {};
      const totalTransactions = Object.values(transactions).reduce(
        (acc, curr) => acc + curr.value,
        0
      );
      if (!transactionCount[l2OrL3]) {
        transactionCount[l2OrL3] = 0;
      }
      transactionCount[l2OrL3] += totalTransactions;
    });
    setTransactionCountByL2L3(transactionCount);

    // TVL by L2/L3
    const tvlCount = {};
    filteredChains.forEach((chain) => {
      const l2OrL3 = chain.l2OrL3 || "Unknown";
      const tvlData = tvlDataByChainDate[chain.name] || {};
      const latestDate = Object.keys(tvlData).sort().pop();
      const latestTvl = latestDate ? tvlData[latestDate].totalTvl : 0;
      if (!tvlCount[l2OrL3]) {
        tvlCount[l2OrL3] = 0;
      }
      tvlCount[l2OrL3] += latestTvl;
    });
    setTvlByL2L3(tvlCount);

    // Vertical Counts by L2/L3
    const verticalCounts = {};
    const verticalsData = {};
    filteredChains.forEach((chain) => {
      const l2OrL3 = chain.l2OrL3 || "Unknown";
      const vertical = chain.vertical || "Unknown";

      // Vertical Counts by L2/L3
      if (!verticalCounts[l2OrL3]) {
        verticalCounts[l2OrL3] = {};
      }
      if (!verticalCounts[l2OrL3][vertical]) {
        verticalCounts[l2OrL3][vertical] = 0;
      }
      verticalCounts[l2OrL3][vertical] += 1;

      // Verticals by L2/L3 Data
      if (!verticalsData[l2OrL3]) {
        verticalsData[l2OrL3] = {};
      }
      if (!verticalsData[l2OrL3][vertical]) {
        verticalsData[l2OrL3][vertical] = {
          count: 0,
          chains: [],
        };
      }
      verticalsData[l2OrL3][vertical].count += 1;
      verticalsData[l2OrL3][vertical].chains.push(chain.name);
    });
    setVerticalCountsByL2L3(verticalCounts);
    setVerticalsByL2L3Data(verticalsData);

    // DA Counts by L2/L3
    const daCounts = {};
    const daData = {};
    filteredChains.forEach((chain) => {
      const l2OrL3 = chain.l2OrL3 || "Unknown";
      const da = chain.da || "Unknown";

      // DA Counts by L2/L3
      if (!daCounts[l2OrL3]) {
        daCounts[l2OrL3] = {};
      }
      if (!daCounts[l2OrL3][da]) {
        daCounts[l2OrL3][da] = 0;
      }
      daCounts[l2OrL3][da] += 1;

      // DA by L2/L3 Data
      if (!daData[l2OrL3]) {
        daData[l2OrL3] = {};
      }
      if (!daData[l2OrL3][da]) {
        daData[l2OrL3][da] = {
          count: 0,
          chains: [],
        };
      }
      daData[l2OrL3][da].count += 1;
      daData[l2OrL3][da].chains.push(chain.name);
    });
    setDaCountsByL2L3(daCounts);
    setDaByL2L3Data(daData);

    // Framework Counts by L2/L3
    const frameworkCounts = {};
    const frameworkData = {};
    filteredChains.forEach((chain) => {
      const l2OrL3 = chain.l2OrL3 || "Unknown";
      const framework = chain.framework || "Unknown";

      // Framework Counts by L2/L3
      if (!frameworkCounts[l2OrL3]) {
        frameworkCounts[l2OrL3] = {};
      }
      if (!frameworkCounts[l2OrL3][framework]) {
        frameworkCounts[l2OrL3][framework] = 0;
      }
      frameworkCounts[l2OrL3][framework] += 1;

      // Framework by L2/L3 Data
      if (!frameworkData[l2OrL3]) {
        frameworkData[l2OrL3] = {};
      }
      if (!frameworkData[l2OrL3][framework]) {
        frameworkData[l2OrL3][framework] = {
          count: 0,
          chains: [],
        };
      }
      frameworkData[l2OrL3][framework].count += 1;
      frameworkData[l2OrL3][framework].chains.push(chain.name);
    });
    setFrameworkCountsByL2L3(frameworkCounts);
    setFrameworkByL2L3Data(frameworkData);
  };

  // Function to process data for the table
  const processTableData = () => {
    // Aggregate data per L2/L3
    const l2l3Data = {};

    allChains.forEach((chain) => {
      if (
        selectedRaas !== "All Raas" &&
        (!chain.raas || chain.raas.toLowerCase() !== selectedRaas.toLowerCase())
      ) {
        return;
      }

      const l2OrL3 = chain.l2OrL3 || "Unknown";
      if (!l2l3Data[l2OrL3]) {
        l2l3Data[l2OrL3] = {
          count: 0,
          topChains: [],
        };
      }

      l2l3Data[l2OrL3].count += 1;

      // Calculate metric based on selected filter
      let metricValue = 0;
      if (tableFilter === "Transaction Count") {
        const transactions = transactionsByChainDate[chain.name] || {};
        const totalTransactions = Object.values(transactions).reduce(
          (acc, curr) => acc + curr.value,
          0
        );
        metricValue = totalTransactions;
      } else if (tableFilter === "TVL") {
        const tvlData = tvlDataByChainDate[chain.name] || {};
        const latestDate = Object.keys(tvlData).sort().pop();
        metricValue = latestDate ? tvlData[latestDate].totalTvl : 0;
      }

      l2l3Data[l2OrL3].topChains.push({
        name: chain.name,
        logoUrl: chain.logoUrl,
        metricValue,
      });
    });

    // Determine top 10 chains by metric per L2/L3
    Object.keys(l2l3Data).forEach((l2OrL3) => {
      l2l3Data[l2OrL3].topChains.sort((a, b) => b.metricValue - a.metricValue);
      l2l3Data[l2OrL3].topChains = l2l3Data[l2OrL3].topChains.slice(0, 10);
    });

    // Prepare table data
    const tableDataLocal = Object.keys(l2l3Data).map((l2OrL3) => {
      const data = l2l3Data[l2OrL3];
      return {
        l2OrL3,
        count: data.count,
        topChains: data.topChains,
      };
    });

    // Sort table data by count descending
    tableDataLocal.sort((a, b) => b.count - a.count);

    setTableData(tableDataLocal);
  };

  // Generate chart options (same as EcosystemPage)
  const generateChartOptions = (
    title,
    isPieChart = false,
    showPercentage = false,
    legendPosition = "top"
  ) => ({
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: true,
        position: legendPosition,
        labels: {
          color: "#FFFFFF",
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
      ? {}
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

  // Utility function to get color by index (same as EcosystemPage)
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
    ];
    return COLORS[index % COLORS.length];
  };

  // Generate data for each chart
  const getChainsCountByL2L3ChartData = () => {
    const labels = Object.keys(chainsCountByL2L3);
    const data = Object.values(chainsCountByL2L3);
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

  const getTransactionCountByL2L3ChartData = (showPercentage = false) => {
    const labels = Object.keys(transactionCountByL2L3);
    const dataValues = Object.values(transactionCountByL2L3);

    let data = dataValues;

    if (showPercentage) {
      const total = dataValues.reduce((acc, val) => acc + val, 0);
      data = dataValues.map((val) => (val / total) * 100);
    }

    return {
      labels,
      datasets: [
        {
          label: showPercentage ? "Transaction Count (%)" : "Transaction Count",
          data,
          backgroundColor: labels.map((_, idx) => getColorByIndex(idx)),
        },
      ],
    };
  };

  const getTvlByL2L3ChartData = (showPercentage = false) => {
    const labels = Object.keys(tvlByL2L3);
    const dataValues = Object.values(tvlByL2L3);

    let data = dataValues;

    if (showPercentage) {
      const total = dataValues.reduce((acc, val) => acc + val, 0);
      data = dataValues.map((val) => (val / total) * 100);
    }

    return {
      labels,
      datasets: [
        {
          label: showPercentage ? "TVL (%)" : "Total Value Locked (TVL)",
          data,
          backgroundColor: labels.map((_, idx) => getColorByIndex(idx)),
        },
      ],
    };
  };

  // Verticals Charts Data
  const getVerticalsByL2L3ChartData = () => {
    const l2L3Labels = Object.keys(verticalsByL2L3Data);
    const verticalsSet = new Set();
    l2L3Labels.forEach((l2OrL3) => {
      Object.keys(verticalsByL2L3Data[l2OrL3]).forEach((vertical) =>
        verticalsSet.add(vertical)
      );
    });
    const verticals = Array.from(verticalsSet);

    const datasets = verticals.map((vertical, idx) => {
      const data = l2L3Labels.map((l2OrL3) => {
        const entry = verticalsByL2L3Data[l2OrL3][vertical];
        return entry ? entry.count : 0;
      });
      const meta = l2L3Labels.map((l2OrL3) => {
        const entry = verticalsByL2L3Data[l2OrL3][vertical];
        return entry ? entry.chains : [];
      });
      return {
        label: vertical,
        data,
        meta,
        backgroundColor: getColorByIndex(idx),
      };
    });

    return {
      labels: l2L3Labels,
      datasets,
    };
  };

  const getVerticalsDistributionByL2L3ChartData = () => {
    const labels = [];
    const data = [];

    Object.keys(verticalCountsByL2L3).forEach((l2OrL3) => {
      const verticals = verticalCountsByL2L3[l2OrL3];
      Object.keys(verticals).forEach((vertical) => {
        labels.push(`${vertical} (${l2OrL3})`);
        data.push(verticals[vertical]);
      });
    });

    return {
      labels,
      datasets: [
        {
          label: "Verticals Distribution",
          data,
          backgroundColor: labels.map((_, idx) => getColorByIndex(idx)),
        },
      ],
    };
  };

  // DA Charts Data
  const getDaByL2L3ChartData = () => {
    const l2L3Labels = Object.keys(daByL2L3Data);
    const daSet = new Set();
    l2L3Labels.forEach((l2OrL3) => {
      Object.keys(daByL2L3Data[l2OrL3]).forEach((da) => daSet.add(da));
    });
    const daProviders = Array.from(daSet);

    const datasets = daProviders.map((daProvider, idx) => {
      const data = l2L3Labels.map((l2OrL3) => {
        const entry = daByL2L3Data[l2OrL3][daProvider];
        return entry ? entry.count : 0;
      });
      const meta = l2L3Labels.map((l2OrL3) => {
        const entry = daByL2L3Data[l2OrL3][daProvider];
        return entry ? entry.chains : [];
      });
      return {
        label: daProvider,
        data,
        meta,
        backgroundColor: getColorByIndex(idx),
      };
    });

    return {
      labels: l2L3Labels,
      datasets,
    };
  };

  const getDaDistributionByL2L3ChartData = () => {
    const labels = [];
    const data = [];

    Object.keys(daCountsByL2L3).forEach((l2OrL3) => {
      const das = daCountsByL2L3[l2OrL3];
      Object.keys(das).forEach((da) => {
        labels.push(`${da} (${l2OrL3})`);
        data.push(das[da]);
      });
    });

    return {
      labels,
      datasets: [
        {
          label: "DA Distribution",
          data,
          backgroundColor: labels.map((_, idx) => getColorByIndex(idx)),
        },
      ],
    };
  };

  // Framework Charts Data
  const getFrameworkByL2L3ChartData = () => {
    const l2L3Labels = Object.keys(frameworkByL2L3Data);
    const frameworkSet = new Set();
    l2L3Labels.forEach((l2OrL3) => {
      Object.keys(frameworkByL2L3Data[l2OrL3]).forEach((framework) =>
        frameworkSet.add(framework)
      );
    });
    const frameworks = Array.from(frameworkSet);

    const datasets = frameworks.map((framework, idx) => {
      const data = l2L3Labels.map((l2OrL3) => {
        const entry = frameworkByL2L3Data[l2OrL3][framework];
        return entry ? entry.count : 0;
      });
      const meta = l2L3Labels.map((l2OrL3) => {
        const entry = frameworkByL2L3Data[l2OrL3][framework];
        return entry ? entry.chains : [];
      });
      return {
        label: framework,
        data,
        meta,
        backgroundColor: getColorByIndex(idx),
      };
    });

    return {
      labels: l2L3Labels,
      datasets,
    };
  };

  const getFrameworkDistributionByL2L3ChartData = () => {
    const labels = [];
    const data = [];

    Object.keys(frameworkCountsByL2L3).forEach((l2OrL3) => {
      const frameworks = frameworkCountsByL2L3[l2OrL3];
      Object.keys(frameworks).forEach((framework) => {
        labels.push(`${framework} (${l2OrL3})`);
        data.push(frameworks[framework]);
      });
    });

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

  // Function to handle RaaS selection
  const handleRaasChange = (value) => {
    setSelectedRaas(value);
  };

  return (
    <div className="l2l3-page">
      <Sidebar />
      <div className="main-content">
        {/* Header */}
        <div className="l2l3-header">
          <div className="heading-container">
            <FontAwesomeIcon icon={faLayerGroup} className="icon" />
            <div>
              <h2>L2/L3 Overview</h2>
              <p className="description">
                Explore the distribution and performance of L2 and L3 chains
                within the ecosystem.
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
        {loading && <div className="loading">Loading L2/L3 data...</div>}

        {/* Main Content */}
        {!loading && !error && (
          <>
            <div className="l2l3-content">
              {/* Left Side: Table */}
              <div className="left-section">
                <div className="table-card">
                  <div className="table-header">
                    <h3>L2/L3 Overview</h3>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>L2/L3</th>
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
                        <tr key={row.l2OrL3}>
                          <td>
                            <div className="l2l3-name">
                              <span className="name">{row.l2OrL3}</span>
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

              {/* Right Side: Chains by L2/L3 Pie Chart */}
              <div className="right-section">
                <div className="chart-card chains-by-l2l3-chart">
                  <h3>Chains by L2/L3</h3>
                  <Pie
                    data={getChainsCountByL2L3ChartData()}
                    options={generateChartOptions(
                      "Chains by L2/L3",
                      true,
                      false,
                      "bottom" // Position legend at the bottom
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="charts-section">
              {/* Transaction Count and TVL Charts */}
              <div className="charts-row">
                {/* Transaction Count by L2/L3 */}
                <div className="chart-card bar-chart-card half-width">
                  <div className="chart-header">
                    <h3>Transaction Count by L2/L3</h3>
                    <div className="toggle-percentage">
                      <label>
                        <input
                          type="checkbox"
                          checked={showPercentageTransactionCount}
                          onChange={(e) =>
                            setShowPercentageTransactionCount(e.target.checked)
                          }
                        />
                        Show Percentage
                      </label>
                    </div>
                  </div>
                  <Bar
                    data={getTransactionCountByL2L3ChartData(
                      showPercentageTransactionCount
                    )}
                    options={generateChartOptions(
                      "Transaction Count by L2/L3",
                      false,
                      showPercentageTransactionCount
                    )}
                    height={300}
                  />
                </div>

                {/* TVL by L2/L3 */}
                <div className="chart-card bar-chart-card half-width">
                  <div className="chart-header">
                    <h3>TVL by L2/L3</h3>
                    <div className="toggle-percentage">
                      <label>
                        <input
                          type="checkbox"
                          checked={showPercentageTvl}
                          onChange={(e) =>
                            setShowPercentageTvl(e.target.checked)
                          }
                        />
                        Show Percentage
                      </label>
                    </div>
                  </div>
                  <Bar
                    data={getTvlByL2L3ChartData(showPercentageTvl)}
                    options={generateChartOptions(
                      "TVL by L2/L3",
                      false,
                      showPercentageTvl
                    )}
                    height={300}
                  />
                </div>
              </div>

              {/* Verticals Charts */}
              <div className="charts-row">
                <div className="chart-card half-width">
                  <h3>Verticals by L2/L3</h3>
                  <Bar
                    data={getVerticalsByL2L3ChartData()}
                    options={generateChartOptions("Verticals by L2/L3", false)}
                    height={300}
                  />
                </div>
                <div className="chart-card half-width">
                  <h3>Verticals Distribution by L2/L3</h3>
                  <Pie
                    data={getVerticalsDistributionByL2L3ChartData()}
                    options={generateChartOptions(
                      "Verticals Distribution by L2/L3",
                      true
                    )}
                  />
                </div>
              </div>

              {/* DA Charts */}
              <div className="charts-row">
                <div className="chart-card half-width">
                  <h3>DA by L2/L3</h3>
                  <Bar
                    data={getDaByL2L3ChartData()}
                    options={generateChartOptions("DA by L2/L3", false)}
                    height={300}
                  />
                </div>
                <div className="chart-card half-width">
                  <h3>DA Distribution by L2/L3</h3>
                  <Pie
                    data={getDaDistributionByL2L3ChartData()}
                    options={generateChartOptions(
                      "DA Distribution by L2/L3",
                      true
                    )}
                  />
                </div>
              </div>

              {/* Framework Charts */}
              <div className="charts-row">
                <div className="chart-card half-width">
                  <h3>Frameworks by L2/L3</h3>
                  <Bar
                    data={getFrameworkByL2L3ChartData()}
                    options={generateChartOptions("Frameworks by L2/L3", false)}
                    height={300}
                  />
                </div>
                <div className="chart-card half-width">
                  <h3>Framework Distribution by L2/L3</h3>
                  <Pie
                    data={getFrameworkDistributionByL2L3ChartData()}
                    options={generateChartOptions(
                      "Framework Distribution by L2/L3",
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

export default L2L3Page;
