// src/pages/TvlPage.js

import React, { useState, useEffect } from "react";
import Sidebar from "../Sidebar/Sidebar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChartLine } from "@fortawesome/free-solid-svg-icons";
import "./TVL.css";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Line, Pie } from "react-chartjs-2";
import "chartjs-adapter-moment";
import {
  fetchGoogleSheetData,
  fetchAllTvlData,
} from "../services/googleSheetService";
import moment from "moment";
import { saveData, getData, clearAllData } from "../services/indexedDBService";

// Register Chart.js components
ChartJS.register(
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const TVL_DATA_ID = "tvlData"; // Unique ID for IndexedDB
const SIX_HOURS_IN_MS = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

const TvlPage = () => {
  // State variables
  const [timeUnit, setTimeUnit] = useState("Daily"); // "Daily" or "Monthly"
  const [timeRange, setTimeRange] = useState("90 days");
  const [selectedRaas, setSelectedRaas] = useState("All Raas"); // Default is "All Raas"
  const [allChains, setAllChains] = useState([]);
  const [tvlDataByChainDate, setTvlDataByChainDate] = useState({});
  const [chartData, setChartData] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [topChainsPieData, setTopChainsPieData] = useState(null);
  const [raasPieData, setRaasPieData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const raasOptions = [
    "All Raas",
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
      setLoading(true);
      try {
        // Uncomment the following line if you need to clear IndexedDB
        // await clearAllData(); // Clear all data in IndexedDB

        const storedRecord = await getData(TVL_DATA_ID);

        const sixHoursAgo = Date.now() - SIX_HOURS_IN_MS;

        if (storedRecord && storedRecord.timestamp > sixHoursAgo) {
          // Use stored data if it's less than 6 hours old
          populateStateWithData(storedRecord.data);
          setLoading(false);
          return;
        }

        // Fetch new data if no valid stored data is available
        const sheetData = await fetchGoogleSheetData();
        const tvlDataFetched = await fetchAllTvlData(sheetData);

        const newData = {
          sheetData,
          tvlDataFetched,
        };

        // Save new data to IndexedDB
        await saveData(TVL_DATA_ID, newData);

        populateStateWithData(newData);
      } catch (error) {
        console.error("Error during data fetching:", error);
        setError("Failed to load TVL data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (allChains.length && Object.keys(tvlDataByChainDate).length) {
      updateChartData();
      updateTableData();
      updatePieCharts();
    }
  }, [allChains, tvlDataByChainDate, timeUnit, timeRange, selectedRaas]);

  const populateStateWithData = (data) => {
    const { sheetData, tvlDataFetched } = data;

    // Filter chains with status "Mainnet" and have a projectId
    const mainnetChains = sheetData.filter(
      (chain) =>
        chain.status &&
        chain.status.trim().toLowerCase() === "mainnet" &&
        chain.projectId // Ensure projectId is present
    );

    setAllChains(mainnetChains);
    setTvlDataByChainDate(tvlDataFetched.tvlDataByChainDate);
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
    const dates = getFilteredDates();

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

    // Calculate average TVL for each chain to determine top 10 chains
    const chainAverages = filteredChains.map((chain) => {
      const tvlValues = dates.map(
        (date) => tvlDataByChainDate[chain.name]?.[date]?.totalTvl || 0
      );
      const total = tvlValues.reduce((acc, val) => acc + val, 0);
      const average = total / tvlValues.length || 0;
      return { name: chain.name, average };
    });

    chainAverages.sort((a, b) => b.average - a.average);
    const topChainsList = chainAverages.slice(0, 10);
    const topChainsNames = topChainsList.map((chain) => chain.name);

    topChainsNames.forEach((chainName) => {
      const chainData = [];

      if (timeUnit === "Daily") {
        dates.forEach((date) => {
          const value = tvlDataByChainDate[chainName]?.[date]?.totalTvl || 0;
          chainData.push(value);
        });
      } else {
        const monthlyData = aggregateMonthlyData(
          tvlDataByChainDate[chainName] || {},
          dates
        );
        const months = getMonthlyLabels(dates);
        months.forEach((month) => {
          const value = monthlyData[month]?.totalTvl || 0;
          chainData.push(value);
        });
      }

      datasets.push({
        label: chainName,
        data: chainData,
        fill: false,
        borderColor: getColorForChain(chainName),
        backgroundColor: getColorForChain(chainName),
        tension: 0.1,
      });
    });

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
        // Find the earliest date in tvlDataByChainDate
        const allDates = Object.values(tvlDataByChainDate)
          .flatMap((chainData) => Object.keys(chainData))
          .map((dateStr) => moment(dateStr, "YYYY-MM-DD"));
        if (allDates.length > 0) {
          startDate = moment.min(allDates).format("YYYY-MM-DD");
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
        monthlyData[monthKey] = {
          totalTvl: 0,
          nativeTvl: 0,
          canonical: 0,
          external: 0,
        };
      }
      const dailyData = chainData[date] || {};
      monthlyData[monthKey].totalTvl += dailyData.totalTvl || 0;
      monthlyData[monthKey].nativeTvl += dailyData.nativeTvl || 0;
      monthlyData[monthKey].canonical += dailyData.canonical || 0;
      monthlyData[monthKey].external += dailyData.external || 0;
    });
    return monthlyData;
  };

  const updateTableData = () => {
    const tableData = [];

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
      const chainLogo = chain.logoUrl || "";
      const chainVertical = chain.vertical || "N/A";
      const chainRaas = chain.raas || "N/A";
      const chainFramework = chain.framework || "N/A";
      const chainDa = chain.da || "N/A";

      const chainTvlData = tvlDataByChainDate[chainName] || {};

      // Get the latest TVL value (current day)
      const dateKeys = Object.keys(chainTvlData);
      const latestDate = dateKeys[dateKeys.length - 1];
      const currentTvl = chainTvlData[latestDate]?.totalTvl || 0;

      tableData.push({
        chainName,
        chainLogo,
        chainVertical,
        chainRaas,
        chainFramework,
        chainDa,
        currentTvl,
      });
    });

    // Sort by 'Current TVL' in descending order
    tableData.sort((a, b) => b.currentTvl - a.currentTvl);

    // Take top 10 chains
    const top10TableData = tableData.slice(0, 10);

    setTableData(top10TableData);
  };

  const updatePieCharts = () => {
    // Pie Chart for Top 10 Chains by TVL Share
    const totalTvlAllChains = [];

    // Calculate total TVL for all chains
    allChains.forEach((chain) => {
      const chainName = chain.name;
      const chainTvlData = tvlDataByChainDate[chainName] || {};
      const dateKeys = Object.keys(chainTvlData);
      const latestDate = dateKeys[dateKeys.length - 1];
      const currentTvl = chainTvlData[latestDate]?.totalTvl || 0;
      totalTvlAllChains.push({
        chainName,
        currentTvl,
      });
    });

    // Sort chains by TVL
    totalTvlAllChains.sort((a, b) => b.currentTvl - a.currentTvl);

    // Prepare data for pie chart
    const top10Chains = totalTvlAllChains.slice(0, 10);
    const otherChains = totalTvlAllChains.slice(10);

    const top10Labels = top10Chains.map((chain) => chain.chainName);
    const top10Data = top10Chains.map((chain) => chain.currentTvl);
    const othersTvl = otherChains.reduce(
      (acc, chain) => acc + chain.currentTvl,
      0
    );

    if (othersTvl > 0) {
      top10Labels.push("Others");
      top10Data.push(othersTvl);
    }

    setTopChainsPieData({
      labels: top10Labels,
      datasets: [
        {
          data: top10Data,
          backgroundColor: top10Labels.map((label) => getColorForChain(label)),
        },
      ],
    });

    // Pie Chart for RaaS Providers TVL Market Share
    const raasTvlMap = {};

    allChains.forEach((chain) => {
      const chainName = chain.name;
      const chainRaas = chain.raas || "Unknown";
      const chainTvlData = tvlDataByChainDate[chainName] || {};
      const dateKeys = Object.keys(chainTvlData);
      const latestDate = dateKeys[dateKeys.length - 1];
      const currentTvl = chainTvlData[latestDate]?.totalTvl || 0;

      if (!raasTvlMap[chainRaas]) {
        raasTvlMap[chainRaas] = 0;
      }
      raasTvlMap[chainRaas] += currentTvl;
    });

    const raasLabels = Object.keys(raasTvlMap);
    const raasData = Object.values(raasTvlMap);

    // Define colorMap for RaaS providers
    const raasColorMap = {
      Gelato: "#ff3b57",
      Conduit: "#46BDC6",
      Alchemy: "#4185F4",
      Caldera: "#EC6731",
      Altlayer: "#B28AFE",
    };

    setRaasPieData({
      labels: raasLabels,
      datasets: [
        {
          data: raasData,
          backgroundColor: raasLabels.map(
            (label) => raasColorMap[label] || getRandomColor()
          ),
        },
      ],
    });
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
      Other: "#999999",
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

  const formatTvlValue = (value) => {
    if (value == null || isNaN(value)) {
      return "0.00";
    } else if (value >= 1e9) {
      return (value / 1e9).toFixed(2) + "B";
    } else if (value >= 1e6) {
      return (value / 1e6).toFixed(2) + "M";
    } else if (value >= 1e3) {
      return (value / 1e3).toFixed(2) + "K";
    } else {
      return value.toFixed(2);
    }
  };

  return (
    <div className="tvl-page">
      <Sidebar />
      <div className="main-content">
        {/* Header */}
        <div className="transactions-header">
          <div className="heading-container">
            <FontAwesomeIcon icon={faChartLine} className="icon" />
            <div>
              <h2>Total Value Locked (TVL)</h2>
              <p className="description">
                Tracks the TVL data for the top 10 chains
              </p>
            </div>
          </div>

          {/* RaaS Selection Dropdown */}
          <div className="raas-dropdown">
            <select
              value={selectedRaas}
              onChange={handleRaasChange}
              className="raas-select"
            >
              {raasOptions.map((raas) => (
                <option key={raas} value={raas}>
                  {raas}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Time Range Selector */}
        {!loading && (
          <div className="time-range-selector">
            <div className="time-range-left">
              <button
                className={`time-unit-btn ${
                  timeUnit === "Daily" ? "active" : ""
                }`}
                onClick={() => handleTimeUnitChange("Daily")}
              >
                Daily
              </button>
              <button
                className={`time-unit-btn ${
                  timeUnit === "Monthly" ? "active" : ""
                }`}
                onClick={() => handleTimeUnitChange("Monthly")}
              >
                Monthly
              </button>
            </div>
            <div className="time-range-right">
              {timeRangeOptions[timeUnit].map((range) => (
                <button
                  key={range}
                  className={`time-range-btn ${
                    timeRange === range ? "active" : ""
                  }`}
                  onClick={() => handleTimeRangeChange(range)}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && <div className="error-message">{error}</div>}

        {/* Loading Indicator */}
        {loading && <div className="loading">Loading data...</div>}

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
                    text: `TVL - ${timeRange}`,
                    color: "#FFFFFF",
                    font: {
                      size: 18,
                    },
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
                        value = "$" + formatTvlValue(value);
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
                    type: "time",
                    time: {
                      unit: timeUnit === "Daily" ? "day" : "month",
                      displayFormats: {
                        day: "D MMM YYYY",
                        month: "MMM YYYY",
                      },
                    },
                    title: {
                      display: true,
                      text: timeUnit === "Daily" ? "Date" : "Month",
                      color: "#FFFFFF",
                      font: {
                        size: 14,
                      },
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
                      text: "Total Value Locked (USD)",
                      color: "#FFFFFF",
                      font: {
                        size: 14,
                      },
                    },
                    ticks: {
                      color: "#FFFFFF",
                      beginAtZero: true,
                      callback: function (value) {
                        return "$" + formatTvlValue(value);
                      },
                    },
                  },
                },
                elements: {
                  point: {
                    radius: 0,
                  },
                },
              }}
            />
          </div>
        )}

        {/* Table Section */}
        {!loading && (
          <div className="table-section">
            <h3 className="section-title">Top 10 Chains by TVL</h3>
            <div className="table-container">
              <table className="tvl-table">
                <thead>
                  <tr>
                    <th>Chain</th>
                    <th>RaaS Provider</th>
                    <th>Vertical</th>
                    <th>TVL</th>
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
                        <div className="chain-info">
                          <span className="chain-name">{chain.chainName}</span>
                          <div className="chain-subtext">
                            Framework: {chain.chainFramework}
                          </div>
                          <div className="chain-subtext">
                            DA: {chain.chainDa}
                          </div>
                        </div>
                      </td>
                      <td className="raas-provider">{chain.chainRaas}</td>
                      <td className="vertical">{chain.chainVertical}</td>
                      <td className="tvl-value">
                        ${formatTvlValue(chain.currentTvl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pie Charts Section */}
        {!loading && topChainsPieData && raasPieData && (
          <div className="pie-charts-section">
            <div className="pie-chart-wrapper">
              <h3 className="section-title">Top 10 Chains TVL Share</h3>
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
                          const total = context.dataset.data.reduce(
                            (acc, val) => acc + val,
                            0
                          );
                          const percentage = ((value / total) * 100).toFixed(2);
                          return `${label}: $${formatTvlValue(
                            value
                          )} (${percentage}%)`;
                        },
                      },
                    },
                  },
                }}
              />
            </div>
            <div className="pie-chart-wrapper">
              <h3 className="section-title">RaaS Providers TVL Market Share</h3>
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
                          const total = context.dataset.data.reduce(
                            (acc, val) => acc + val,
                            0
                          );
                          const percentage = ((value / total) * 100).toFixed(2);
                          return `${label}: $${formatTvlValue(
                            value
                          )} (${percentage}%)`;
                        },
                      },
                    },
                  },
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TvlPage;
