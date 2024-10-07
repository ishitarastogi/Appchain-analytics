import React, { useState, useEffect } from "react";
import Sidebar from "../Sidebar/Sidebar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUsers } from "@fortawesome/free-solid-svg-icons";
import GelatoLogo from "../assets/logos/raas/Gelato.png";
import "./ActiveAccountsPage.css";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement,
} from "chart.js";
import { Line, Pie, Bar } from "react-chartjs-2";
import { fetchGelatoSheetData } from "../services/googleSheetGelatoService";
import {
  fetchGoogleSheetData,
  fetchAllActiveAccounts,
} from "../services/googleSheetService";
import { abbreviateNumber } from "../utils/numberFormatter";
import moment from "moment";

ChartJS.register(
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement
);

const ActiveAccountsPage = () => {
  const [timeRange, setTimeRange] = useState("Monthly");
  const [gelatoChains, setGelatoChains] = useState([]);
  const [allChains, setAllChains] = useState([]);
  const [activeAccountsByChainDate, setActiveAccountsByChainDate] = useState(
    {}
  );
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });
  const [topChains, setTopChains] = useState([]);
  const [totalActiveAccountsByChain, setTotalActiveAccountsByChain] = useState(
    {}
  );
  const [error, setError] = useState(null);
  const [filteredDates, setFilteredDates] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const gelatoData = await fetchGelatoSheetData();
        const sheetData = await fetchGoogleSheetData();
        const activeAccountsData = await fetchAllActiveAccounts(sheetData);

        setGelatoChains(gelatoData);
        setAllChains(sheetData);
        setActiveAccountsByChainDate(
          activeAccountsData.activeAccountsByChainDate
        );

        // Log the active accounts data to debug
        console.log(
          "Active Accounts by Chain Date:",
          activeAccountsData.activeAccountsByChainDate
        );

        const dates = getFilteredDates();
        setFilteredDates(dates);

        populateStateWithData(dates, activeAccountsData);
      } catch (error) {
        console.error("Error during data fetching:", error);
        setError("Failed to load active account data. Please try again later.");
      }
    };

    fetchData();
  }, [timeRange]);

  const populateStateWithData = (dates, activeAccountsData) => {
    const chainTotals = allChains.map((chain) => {
      const activeCounts = dates.map(
        (date) => activeAccountsByChainDate[chain.name]?.[date] || 0 // Provide a fallback to 0
      );
      const total = activeCounts.reduce((acc, val) => acc + val, 0);
      return { name: chain.name, total };
    });

    chainTotals.sort((a, b) => b.total - a.total);
    const topSevenChains = chainTotals.slice(0, 7).map((chain) => chain.name);
    setTopChains(topSevenChains);

    const totalActiveAccountsByChainData = chainTotals.reduce(
      (acc, { name, total }) => ({ ...acc, [name]: total }),
      {}
    );
    setTotalActiveAccountsByChain(totalActiveAccountsByChainData);

    const { labels, keys } = getLastSixMonths();

    const activeAccountsByChainMonth = {};
    topSevenChains.forEach((chainName) => {
      activeAccountsByChainMonth[chainName] = keys.map((monthKey) => {
        return Object.keys(activeAccountsByChainDate[chainName] || {})
          .filter((date) => moment(date).format("YYYY-MM") === monthKey)
          .reduce(
            (sum, date) =>
              sum + (activeAccountsByChainDate[chainName]?.[date] || 0),
            0
          );
      });
    });

    const datasets = topSevenChains.map((chainName) => ({
      label: chainName,
      data: activeAccountsByChainMonth[chainName],
      fill: false,
      borderColor: getColorForChain(chainName),
      backgroundColor: getColorForChain(chainName),
      tension: 0.1,
    }));

    setChartData({ labels, datasets });
  };

  const getFilteredDates = () => {
    const today = moment().format("YYYY-MM-DD");
    let startDate;

    switch (timeRange) {
      case "Daily":
        startDate = today;
        break;
      case "Monthly":
        startDate = moment().subtract(1, "months").format("YYYY-MM-DD");
        break;
      case "FourMonths":
        startDate = moment().subtract(4, "months").format("YYYY-MM-DD");
        break;
      case "SixMonths":
        startDate = moment().subtract(6, "months").format("YYYY-MM-DD");
        break;
      case "All":
        startDate = moment("2000-01-01").format("YYYY-MM-DD");
        break;
      default:
        startDate = moment().subtract(1, "months").format("YYYY-MM-DD");
    }

    const dates = [];
    let currentDate = moment(startDate);
    while (currentDate.isSameOrBefore(today, "day")) {
      dates.push(currentDate.format("YYYY-MM-DD"));
      currentDate.add(1, "day");
    }
    return dates;
  };

  const getLastSixMonths = () => {
    const months = [];
    const keys = [];
    let currentMonth = moment().subtract(5, "months").startOf("month");
    for (let i = 0; i < 6; i++) {
      months.push(currentMonth.format("MMMM"));
      keys.push(currentMonth.format("YYYY-MM"));
      currentMonth.add(1, "month");
    }
    return { labels: months, keys };
  };

  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
  };

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
      Lisk: "#FFA500", // Example color for Lisk
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

  const pieData = {
    labels: [...Object.keys(totalActiveAccountsByChain).slice(0, 12), "Others"],
    datasets: [
      {
        data: [
          ...Object.values(totalActiveAccountsByChain).slice(0, 12),
          Object.values(totalActiveAccountsByChain)
            .slice(12)
            .reduce((acc, val) => acc + val, 0),
        ],
        backgroundColor: [
          ...Object.keys(totalActiveAccountsByChain)
            .slice(0, 12)
            .map((chain) => getColorForChain(chain)),
          "#808080", // Grey color for 'Others'
        ],
      },
    ],
  };

  const filteredActiveAccountsByRaas = Object.keys(
    totalActiveAccountsByChain
  ).reduce((acc, provider) => {
    if (totalActiveAccountsByChain[provider] > 0) {
      acc[provider] = totalActiveAccountsByChain[provider];
    }
    return acc;
  }, {});

  const barData = {
    labels: Object.keys(filteredActiveAccountsByRaas),
    datasets: [
      {
        label: "Active Account Count by RaaS Provider",
        data: Object.values(filteredActiveAccountsByRaas),
        backgroundColor: [
          "#ff3b57", // Gelato
          "#46BDC6", // Conduit
          "#4185F4", // Alchemy
          "#EC6731", // Caldera
          "#B28AFE", // Altlayer
        ].slice(0, Object.keys(filteredActiveAccountsByRaas).length),
      },
    ],
  };

  return (
    <div className="active-accounts-page">
      <Sidebar />
      <div className="main-content">
        <div className="transactions-header">
          <div className="heading-container">
            <FontAwesomeIcon icon={faUsers} className="icon" />
            <h2>Active Accounts</h2>
          </div>
          <p className="description">
            Tracks the total number of active accounts on the blockchain each
            day
          </p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="time-range-selector">
          <div className="time-range-left">
            <button
              className={timeRange === "Daily" ? "active" : ""}
              onClick={() => handleTimeRangeChange("Daily")}
            >
              Daily
            </button>
            <button
              className={timeRange === "Monthly" ? "active" : ""}
              onClick={() => handleTimeRangeChange("Monthly")}
            >
              Monthly
            </button>
          </div>
          <div className="time-range-right">
            <button
              className={timeRange === "FourMonths" ? "active" : ""}
              onClick={() => handleTimeRangeChange("FourMonths")}
            >
              4 Months
            </button>
            <button
              className={timeRange === "SixMonths" ? "active" : ""}
              onClick={() => handleTimeRangeChange("SixMonths")}
            >
              6 Months
            </button>
            <button
              className={timeRange === "All" ? "active" : ""}
              onClick={() => handleTimeRangeChange("All")}
            >
              All
            </button>
          </div>
        </div>

        <div className="table-chart-container">
          <div className="chain-list">
            {gelatoChains.map((chain, index) => {
              const activeCounts = filteredDates.map(
                (date) => activeAccountsByChainDate[chain.name]?.[date] || 0 // Provide a fallback to 0
              );
              const activeCount = activeCounts.reduce(
                (acc, val) => acc + val,
                0
              );

              return (
                <div key={index} className="chain-item">
                  <img
                    src={`https://s2.googleusercontent.com/s2/favicons?domain=${chain.blockScoutUrl}&sz=32`}
                    alt={`${chain.name} Logo`}
                    className="chain-logo"
                  />
                  <span className="chain-name">
                    {chain.name}
                    <img
                      src={GelatoLogo}
                      alt="RaaS Logo"
                      className="raas-logo"
                    />
                  </span>
                  <span className="transactions">
                    {abbreviateNumber(activeCount)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="line-chart">
            <Line
              data={chartData}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    position: "bottom",
                    labels: {
                      color: "#FFFFFF",
                    },
                  },
                  title: {
                    display: true,
                    text: "Active Accounts - Last 6 Months",
                    color: "#FFFFFF",
                  },
                  tooltip: {
                    callbacks: {
                      label: function (context) {
                        return `${context.dataset.label}: ${abbreviateNumber(
                          context.parsed.y
                        )}`;
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
                      text: "Months",
                      color: "#FFFFFF",
                    },
                    ticks: {
                      color: "#FFFFFF",
                      maxRotation: 0,
                      minRotation: 0,
                    },
                  },
                  y: {
                    title: {
                      display: true,
                      text: "Number of Active Accounts",
                      color: "#FFFFFF",
                    },
                    ticks: {
                      color: "#FFFFFF",
                      beginAtZero: true,
                      callback: function (value) {
                        return abbreviateNumber(value);
                      },
                    },
                  },
                },
              }}
            />
          </div>
        </div>

        <div className="additional-charts">
          <div className="pie-chart">
            <h3>Market Share of Each Chain</h3>
            <Pie
              data={pieData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: "bottom",
                    labels: {
                      color: "#FFFFFF",
                      padding: 20,
                    },
                  },
                  tooltip: {
                    callbacks: {
                      label: function (context) {
                        const total = context.dataset.data.reduce(
                          (a, b) => a + b,
                          0
                        );
                        const currentValue = context.raw;
                        const percentage = (
                          (currentValue / total) *
                          100
                        ).toFixed(2);
                        const formattedValue = abbreviateNumber(currentValue);
                        return `${context.label}: ${formattedValue} (${percentage}%)`;
                      },
                    },
                  },
                },
              }}
            />
          </div>

          <div className="bar-chart">
            <h3>Active Accounts by RaaS Providers</h3>
            <Bar
              data={barData}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    display: false,
                  },
                  tooltip: {
                    callbacks: {
                      label: function (context) {
                        return abbreviateNumber(context.raw);
                      },
                    },
                  },
                },
                scales: {
                  x: {
                    ticks: {
                      color: "#FFFFFF",
                    },
                  },
                  y: {
                    beginAtZero: true,
                    ticks: {
                      color: "#FFFFFF",
                      callback: function (value) {
                        return abbreviateNumber(value);
                      },
                    },
                  },
                },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActiveAccountsPage;
