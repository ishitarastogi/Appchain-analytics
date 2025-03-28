import React, { useState, useEffect } from "react";
import Sidebar from "../Sidebar/Sidebar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTachometerAlt } from "@fortawesome/free-solid-svg-icons";
import "./abc.css";
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
} from "chart.js";
import { Line } from "react-chartjs-2";
import "chartjs-adapter-moment";
import {
  fetchGoogleSheetData,
  fetchAllTpsData,
} from "../services/googleSheetService";
import moment from "moment";
import { saveData, getData, clearAllData } from "../services/indexedDBService";

// Remove the import of numberFormatter since we'll define the functions here
// import { abbreviateNumber, formatNumber } from "../utils/numberFormatter";

// Register Chart.js components
ChartJS.register(
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  TimeScale,
  Title,
  Tooltip,
  Legend
);

const TPS_DATA_ID = "tpsData"; // Unique ID for IndexedDB
const SIX_HOURS_IN_MS = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

// Define abbreviateNumber function
function abbreviateNumber(value) {
  let newValue = value;
  const suffixes = ["", "K", "M", "B", "T", "P", "E"];
  let suffixNum = 0;

  while (newValue >= 1000 && suffixNum < suffixes.length - 1) {
    newValue /= 1000;
    suffixNum++;
  }

  // Format number to have at most 2 decimal digits, and remove trailing zeros and decimal point if not needed
  let formattedValue = formatNumber(newValue);
  return formattedValue + suffixes[suffixNum];
}

// Define formatNumber function
function formatNumber(value) {
  if (Number.isInteger(value)) {
    return value.toString();
  } else {
    // Ensure we have at most 2 decimal places
    let fixedValue = value.toFixed(2);
    // Remove unnecessary trailing zeros and decimal point
    return parseFloat(fixedValue).toString();
  }
}

const TpssPage = () => {
  // State variables
  const [timeUnit, setTimeUnit] = useState("Daily"); // "Daily" or "Monthly"
  const [timeRange, setTimeRange] = useState("90 days");
  const [selectedRaas, setSelectedRaas] = useState("All Raas"); // Default is "All Raas"
  const [chartType, setChartType] = useState("absolute"); // 'absolute', 'stacked', 'percentage'
  const [allChains, setAllChains] = useState([]);
  const [tpsDataByChainDate, setTpsDataByChainDate] = useState({});
  const [chartData, setChartData] = useState(null);
  const [topChainsList, setTopChainsList] = useState([]);
  const [tpsByRaas, setTpsByRaas] = useState({});
  const [tableData, setTableData] = useState([]);
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
        await clearAllData(); // Clear all data in IndexedDB

        const storedRecord = await getData(TPS_DATA_ID);

        const sixHoursAgo = Date.now() - SIX_HOURS_IN_MS;

        if (storedRecord && storedRecord.timestamp > sixHoursAgo) {
          // Use stored data if it's less than 6 hours old
          populateStateWithData(storedRecord.data);
          setLoading(false);
          return;
        }

        // Fetch new data if no valid stored data is available
        const sheetData = await fetchGoogleSheetData();
        const tpsDataFetched = await fetchAllTpsData(sheetData);

        const newData = {
          sheetData,
          tpsDataFetched,
        };

        // Save new data to IndexedDB
        await saveData(TPS_DATA_ID, newData);

        populateStateWithData(newData);
      } catch (error) {
        console.error("Error during data fetching:", error);
        setError("Failed to load TPS data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (allChains.length && Object.keys(tpsDataByChainDate).length) {
      updateChartData();
      updateTableData();
    }
  }, [
    allChains,
    tpsDataByChainDate,
    timeUnit,
    timeRange,
    selectedRaas,
    chartType,
  ]);

  const populateStateWithData = (data) => {
    const { sheetData, tpsDataFetched } = data;

    // Filter chains with status "Mainnet" and have a projectId
    const mainnetChains = sheetData.filter(
      (chain) =>
        chain.status &&
        chain.status.trim().toLowerCase() === "mainnet" &&
        chain.projectId // Ensure projectId is present
    );

    setAllChains(mainnetChains);
    setTpsDataByChainDate(tpsDataFetched.tpsDataByChainDate);

    // Calculate TPS by RaaS
    const raasTps = {};
    mainnetChains.forEach((chain) => {
      const { raas, name } = chain;
      const chainTpsData = tpsDataFetched.tpsDataByChainDate[name];

      if (chainTpsData) {
        const totalChainTps = Object.values(chainTpsData).reduce(
          (acc, val) => acc + val,
          0
        );

        if (!raasTps[raas]) {
          raasTps[raas] = 0;
        }
        raasTps[raas] += totalChainTps;
      }
    });

    setTpsByRaas(raasTps);
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

    const chainAverages = filteredChains.map((chain) => {
      const tpsCounts = dates.map(
        (date) => tpsDataByChainDate[chain.name]?.[date] || 0
      );
      const total = tpsCounts.reduce((acc, val) => acc + val, 0);
      const average = total / tpsCounts.length || 0;
      return { name: chain.name, average };
    });

    chainAverages.sort((a, b) => b.average - a.average);
    const topChainsList = chainAverages.slice(0, 10);
    setTopChainsList(topChainsList);
    const topChainsNames = topChainsList.map((chain) => chain.name);

    const totalTpsByDate = {};

    topChainsNames.forEach((chainName) => {
      const chainData = [];
      if (timeUnit === "Daily") {
        dates.forEach((date, idx) => {
          const value = tpsDataByChainDate[chainName]?.[date] || 0;
          chainData.push(value);

          // Aggregate total TPS
          totalTpsByDate[date] = (totalTpsByDate[date] || 0) + value;
        });
      } else {
        const monthlyData = aggregateMonthlyData(
          tpsDataByChainDate[chainName] || {},
          dates
        );
        const months = getMonthlyLabels(dates);
        months.forEach((month) => {
          const value = monthlyData[month] || 0;
          chainData.push(value);

          // Aggregate total TPS
          totalTpsByDate[month] = (totalTpsByDate[month] || 0) + value;
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
          const total = totalTpsByDate[dateKey] || 1;
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
        // Find the earliest date in tpsDataByChainDate
        const allDates = Object.values(tpsDataByChainDate)
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
        monthlyData[monthKey] = 0;
      }
      monthlyData[monthKey] += chainData[date] || 0;
    });
    return monthlyData;
  };

  const updateTableData = () => {
    const today = moment().format("YYYY-MM-DD");
    const yesterday = moment().subtract(1, "day").format("YYYY-MM-DD");

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

      const chainTpsData = tpsDataByChainDate[chainName] || {};

      // Current TPS (latest available date)
      const currentTps = chainTpsData[yesterday] || chainTpsData[today] || 0;

      // Max TPS
      const maxTps = Math.max(...Object.values(chainTpsData), 0);

      tableData.push({
        chainName,
        chainLogo,
        chainVertical,
        chainRaas,
        currentTps,
        maxTps,
      });
    });

    // Sort on currentTps column
    tableData.sort((a, b) => b.currentTps - a.currentTps);

    // Take top 10 chains
    const top10TableData = tableData.slice(0, 10);

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

  return (
    <div className="performance-page">
      <Sidebar />
      <div className="main-content">
        {/* Header */}
        <div className="transactions-header">
          <div className="heading-container">
            <FontAwesomeIcon icon={faTachometerAlt} className="icon" />
            <div>
              <h2>Transactions Per Second</h2>
              <p className="description">
                Tracks the TPS data for the top 10 chains
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
                    text: `TPS - ${timeRange}`,
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
                    max: chartType === "percentage" ? 100 : undefined,
                    title: {
                      display: true,
                      text:
                        chartType === "percentage"
                          ? "Percentage of Total TPS (%)"
                          : "Transactions Per Second",
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
            <h3 className="section-title">Top 10 Chains</h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Chain</th>
                    <th>Current TPS</th>
                    <th>Max TPS</th>
                    <th>Vertical</th>
                    <th>RaaS Provider</th>
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
                              "https://www.verizon.com/learning/_next/static/images/87c8be7b206ab401b295fd1d21620b79.jpg";
                          }}
                        />
                        <span>{chain.chainName}</span>
                      </td>
                      <td>{formatNumber(chain.currentTps)}</td>
                      <td>{formatNumber(chain.maxTps)}</td>
                      <td>{chain.chainVertical}</td>
                      <td>{chain.chainRaas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TpssPage;
