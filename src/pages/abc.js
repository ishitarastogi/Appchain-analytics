// // TpssPage.js

// import React, { useState, useEffect, useMemo, useCallback } from "react";
// import Sidebar from "../Sidebar/Sidebar";
// import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
// import { faTachometerAlt } from "@fortawesome/free-solid-svg-icons";
// import "./ActiveAccountsPage.css";
// import { Line } from "react-chartjs-2";
// import {
//   Chart as ChartJS,
//   LineElement,
//   PointElement,
//   CategoryScale,
//   LinearScale,
//   TimeScale,
//   Title,
//   Tooltip,
//   Legend,
// } from "chart.js";
// import "chartjs-adapter-moment";
// import {
//   fetchGoogleSheetData,
//   fetchAllTpsData,
// } from "../services/googleTPSService";
// import { saveData, getData, clearAllData } from "../services/indexedDBService";
// import moment from "moment";

// ChartJS.register(
//   LineElement,
//   PointElement,
//   CategoryScale,
//   LinearScale,
//   TimeScale,
//   Title,
//   Tooltip,
//   Legend
// );

// const TpssPage = () => {
//   const [gelatoChains, setGelatoChains] = useState([]);
//   const [tpsData, setTpsData] = useState({});
//   const [chartData, setChartData] = useState(null);
//   const [error, setError] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [timeRange, setTimeRange] = useState("Monthly");
//   const [lastUpdated, setLastUpdated] = useState(null);

//   // Memoized fetchData function
//   const fetchData = useCallback(async (forceRefresh = false) => {
//     setLoading(true);
//     try {
//       const storedData = await getData("tpsData");
//       const now = Date.now();
//       let newData;

//       if (
//         storedData &&
//         now - storedData.timestamp < 6 * 60 * 60 * 1000 &&
//         !forceRefresh
//       ) {
//         newData = storedData.data;
//         setLastUpdated(new Date(storedData.timestamp));
//       } else {
//         const sheetData = await fetchGoogleSheetData();
//         const tpsDataFetched = await fetchAllTpsData(sheetData);

//         newData = {
//           gelatoChains: sheetData.filter(
//             (chain) => chain.raas && chain.raas.toLowerCase() === "gelato"
//           ),
//           tpsData: tpsDataFetched,
//         };
//         await saveData("tpsData", newData);
//         setLastUpdated(new Date());
//       }

//       setGelatoChains(newData.gelatoChains);
//       setTpsData(newData.tpsData);
//     } catch (error) {
//       console.error("Error during data fetching:", error);
//       setError("Failed to load data. Please try again later.");
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     fetchData();
//   }, [fetchData]);

//   useEffect(() => {
//     if (Object.keys(tpsData).length > 0) {
//       populateChartData(tpsData);
//     }
//   }, [tpsData, timeRange]);

//   const handleTimeRangeChange = (range) => {
//     setTimeRange(range);
//   };

//   const handleRefreshData = async () => {
//     await clearAllData();
//     fetchData(true);
//   };

//   const filterDataByTimeRange = useCallback(
//     (data) => {
//       const now = moment();
//       let startDate;

//       switch (timeRange) {
//         case "Daily":
//           startDate = now.clone().startOf("day");
//           break;
//         case "Monthly":
//           startDate = now.clone().subtract(1, "month");
//           break;
//         case "FourMonths":
//           startDate = now.clone().subtract(4, "months");
//           break;
//         case "SixMonths":
//           startDate = now.clone().subtract(6, "months");
//           break;
//         case "All":
//         default:
//           startDate = moment(0);
//       }

//       return data.filter((item) =>
//         moment(item.timestamp * 1000).isAfter(startDate)
//       );
//     },
//     [timeRange]
//   );

//   const populateChartData = useCallback(
//     (allTpsData) => {
//       const chainAverages = Object.entries(allTpsData).map(
//         ([chainName, tpsArray]) => {
//           const filteredData = filterDataByTimeRange(tpsArray);
//           const averageTps =
//             filteredData.reduce((sum, item) => sum + item.tps, 0) /
//               filteredData.length || 0;
//           return { chainName, averageTps };
//         }
//       );

//       const topChains = chainAverages
//         .sort((a, b) => b.averageTps - a.averageTps)
//         .slice(0, 10)
//         .map((item) => item.chainName);

//       const datasets = [];
//       let labelsSet = new Set();

//       topChains.forEach((chainName) => {
//         const tpsArray = allTpsData[chainName];
//         const filteredData = filterDataByTimeRange(tpsArray);
//         const data = filteredData.map((item) => ({
//           x: new Date(item.timestamp * 1000),
//           y: item.tps,
//         }));

//         data.forEach((item) => labelsSet.add(item.x.getTime()));

//         datasets.push({
//           label: chainName,
//           data: data,
//           borderColor: getColorForChain(chainName),
//           fill: false,
//           tension: 0.1,
//         });
//       });

//       const labels = Array.from(labelsSet)
//         .sort((a, b) => a - b)
//         .map((timestamp) => new Date(timestamp));

//       setChartData({
//         labels: labels,
//         datasets: datasets,
//       });
//     },
//     [filterDataByTimeRange]
//   );

//   const getColorForChain = useCallback((chainName) => {
//     const colors = [
//       "#FF6384",
//       "#36A2EB",
//       "#FFCE56",
//       "#4BC0C0",
//       "#9966FF",
//       "#FF9F40",
//       "#C9CBCF",
//       "#E7E9ED",
//       "#EC6731",
//       "#B28AFE",
//     ];
//     let hash = 0;
//     for (let i = 0; i < chainName.length; i++) {
//       hash = chainName.charCodeAt(i) + ((hash << 5) - hash);
//     }
//     const colorIndex = Math.abs(hash) % colors.length;
//     return colors[colorIndex];
//   }, []);

//   const abbreviateNumber = useCallback((num) => {
//     if (num === undefined || num === null || isNaN(num)) return "0";
//     if (num === 0) return "0";

//     const absNum = Math.abs(num);
//     const sign = Math.sign(num);

//     const suffixes = ["", "k", "M", "B", "T"];
//     let suffixIndex = 0;
//     let shortNumber = absNum;

//     while (shortNumber >= 1000 && suffixIndex < suffixes.length - 1) {
//       shortNumber /= 1000;
//       suffixIndex++;
//     }

//     if (shortNumber < 1) {
//       return (sign * absNum).toFixed(4);
//     }

//     shortNumber = parseFloat(shortNumber.toPrecision(3));
//     return sign * shortNumber + suffixes[suffixIndex];
//   }, []);

//   // Memoize chainRows to prevent unnecessary re-computation
//   const chainRows = useMemo(() => {
//     return gelatoChains.map((chain) => {
//       const chainName = chain.name;
//       const chainTpsData = tpsData[chainName] || [];
//       const latestTps =
//         chainTpsData.length > 0
//           ? chainTpsData[chainTpsData.length - 1]?.tps || 0
//           : 0;
//       const maxTps =
//         chainTpsData.length > 0
//           ? Math.max(...chainTpsData.map((data) => data.tps || 0), 0)
//           : 0;
//       return {
//         id: chain.id,
//         chainName: chain.name,
//         blockScoutUrl: chain.blockScoutUrl,
//         vertical: chain.vertical,
//         latestTps,
//         maxTps,
//       };
//     });
//   }, [gelatoChains, tpsData]);

//   if (loading) {
//     return <div className="loading">Loading TPS Data...</div>;
//   }

//   return (
//     <div className="tps-page">
//       <Sidebar />
//       <div className="main-content">
//         <div className="transactions-header">
//           <div className="heading-container">
//             <FontAwesomeIcon icon={faTachometerAlt} className="icon" />
//             <h2>Transactions Per Second</h2>
//           </div>
//           <p className="description">Tracks TPS data for the top 10 chains.</p>
//           {lastUpdated && (
//             <p className="last-updated">
//               Last updated: {moment(lastUpdated).format("YYYY-MM-DD HH:mm")}
//             </p>
//           )}
//           <button className="refresh-button" onClick={handleRefreshData}>
//             Refresh Data
//           </button>
//         </div>

//         {error && <div className="error-message">{error}</div>}

//         <div className="time-range-selector">
//           <div className="left-buttons">
//             <button
//               className={timeRange === "Daily" ? "active" : ""}
//               onClick={() => handleTimeRangeChange("Daily")}
//             >
//               Daily
//             </button>
//             <button
//               className={timeRange === "Monthly" ? "active" : ""}
//               onClick={() => handleTimeRangeChange("Monthly")}
//             >
//               Monthly
//             </button>
//           </div>
//           <div className="right-buttons">
//             <button
//               className={timeRange === "FourMonths" ? "active" : ""}
//               onClick={() => handleTimeRangeChange("FourMonths")}
//             >
//               4 Months
//             </button>
//             <button
//               className={timeRange === "SixMonths" ? "active" : ""}
//               onClick={() => handleTimeRangeChange("SixMonths")}
//             >
//               6 Months
//             </button>
//             <button
//               className={timeRange === "All" ? "active" : ""}
//               onClick={() => handleTimeRangeChange("All")}
//             >
//               All
//             </button>
//           </div>
//         </div>

//         <div className="table-chart-container">
//           <div className="chain-list">
//             <table>
//               <thead>
//                 <tr>
//                   <th></th>
//                   <th>Chain</th>
//                   <th>Current TPS</th>
//                   <th>Max TPS</th>
//                   <th>Vertical</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {chainRows.length > 0 ? (
//                   chainRows.map((row) => (
//                     <TableRow
//                       key={row.id}
//                       blockScoutUrl={row.blockScoutUrl}
//                       chainName={row.chainName}
//                       latestTps={row.latestTps}
//                       maxTps={row.maxTps}
//                       vertical={row.vertical}
//                       abbreviateNumber={abbreviateNumber}
//                     />
//                   ))
//                 ) : (
//                   <tr>
//                     <td colSpan={5} style={{ textAlign: "center" }}>
//                       No data available.
//                     </td>
//                   </tr>
//                 )}
//               </tbody>
//             </table>
//           </div>

//           <div className="line-chart">
//             {chartData ? (
//               <Line
//                 data={chartData}
//                 options={{
//                   responsive: true,
//                   plugins: {
//                     legend: {
//                       position: "bottom",
//                       labels: {
//                         color: "#FFFFFF",
//                       },
//                     },
//                     title: {
//                       display: true,
//                       text: "TPS Data for Top 10 Chains",
//                       color: "#FFFFFF",
//                     },
//                     tooltip: {
//                       callbacks: {
//                         label: function (context) {
//                           const value = context.parsed.y || 0;
//                           return `${context.dataset.label}: ${abbreviateNumber(
//                             value
//                           )}`;
//                         },
//                       },
//                       backgroundColor: "rgba(0,0,0,0.7)",
//                       titleColor: "#FFFFFF",
//                       bodyColor: "#FFFFFF",
//                     },
//                   },
//                   scales: {
//                     x: {
//                       type: "time",
//                       time: {
//                         unit: "month",
//                         displayFormats: {
//                           month: "MMM YYYY",
//                         },
//                       },
//                       title: {
//                         display: true,
//                         text: "Month",
//                         color: "#FFFFFF",
//                       },
//                       ticks: {
//                         color: "#FFFFFF",
//                       },
//                     },
//                     y: {
//                       title: {
//                         display: true,
//                         text: "TPS",
//                         color: "#FFFFFF",
//                       },
//                       ticks: {
//                         color: "#FFFFFF",
//                         beginAtZero: true,
//                         callback: function (value) {
//                           return abbreviateNumber(value);
//                         },
//                       },
//                     },
//                   },
//                 }}
//                 height={120} // Increased height
//               />
//             ) : (
//               <div className="chart-placeholder">No data available</div>
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// const TableRow = React.memo(
//   ({
//     blockScoutUrl,
//     chainName,
//     latestTps,
//     maxTps,
//     vertical,
//     abbreviateNumber,
//   }) => {
//     return (
//       <tr>
//         <td>
//           <img
//             src={`https://s2.googleusercontent.com/s2/favicons?domain=${blockScoutUrl}&sz=32`}
//             alt={`${chainName} Logo`}
//             className="chain-logo"
//             onError={(e) => {
//               e.target.onerror = null;
//               e.target.src =
//                 "https://cdn-icons-png.flaticon.com/512/2815/2815428.png"; // Use a valid placeholder image path
//             }}
//           />
//         </td>
//         <td>{chainName}</td>
//         <td>{abbreviateNumber(latestTps)} TPS</td>
//         <td>{abbreviateNumber(maxTps)} TPS</td>
//         <td>{vertical || "N/A"}</td>
//       </tr>
//     );
//   },
//   (prevProps, nextProps) => {
//     // Custom comparison function to prevent re-renders if props haven't changed
//     return (
//       prevProps.chainName === nextProps.chainName &&
//       prevProps.latestTps === nextProps.latestTps &&
//       prevProps.maxTps === nextProps.maxTps &&
//       prevProps.vertical === nextProps.vertical &&
//       prevProps.blockScoutUrl === nextProps.blockScoutUrl
//     );
//   }
// );

// export default TpssPage;

import React from "react";

function abc() {
  return <div>j</div>;
}

export default abc;
