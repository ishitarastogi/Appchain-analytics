import React, { useState, useEffect } from "react";
import { Scatter } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ScatterController,
  PointElement,
  Tooltip,
  Legend,
  LinearScale,
  Title,
  TimeScale, // <-- This is needed for the "time" scale
} from "chart.js";
import "chartjs-adapter-moment"; // <-- This is needed for handling time scales
import { fetchGoogleSheetData } from "../../services/googleSheetService";
import moment from "moment";
import "./ScatterPlot.css";

// Register required components in Chart.js
ChartJS.register(
  ScatterController,
  PointElement,
  Tooltip,
  Legend,
  LinearScale,
  Title,
  TimeScale
);

const ScatterPlot = () => {
  const [chainsData, setChainsData] = useState([]);
  const [timeRange, setTimeRange] = useState("12month"); // Default time range is 12 months

  // Fetch Google Sheets Data on component mount
  useEffect(() => {
    const fetchData = async () => {
      const data = await fetchGoogleSheetData();
      setChainsData(data);
    };
    fetchData();
  }, []);

  // Filter the data based on selected time range
  const filteredData = chainsData.filter((chain) => {
    const launchDate = moment(chain.launchDate);
    const currentDate = moment();

    switch (timeRange) {
      case "1week":
        return launchDate.isAfter(currentDate.subtract(1, "weeks"));
      case "3month":
        return launchDate.isAfter(currentDate.subtract(3, "months"));
      case "6month":
        return launchDate.isAfter(currentDate.subtract(6, "months"));
      case "12month":
      default:
        return launchDate.isAfter(currentDate.subtract(12, "months"));
    }
  });

  // Define a color palette for different RaaS providers
  const raasProviderColors = {
    Gelato: "rgba(255, 59, 87, 0.8)", // Pink for Gelato
    Conduit: "rgba(70, 189, 198, 0.8)", // Light blue for Conduit
    Alchemy: "rgba(65, 133, 244, 0.8)", // Dark blue for Alchemy
    Caldera: "rgba(236, 103, 49, 0.8)", // Orange for Caldera
    Altlayer: "rgba(178, 138, 254, 0.8)", // Purple for Altlayer
    Default: "rgba(150, 150, 150, 0.8)", // Grey for other providers
  };

  // Prepare scatter plot data
  const scatterData = {
    datasets: filteredData.map((chain) => ({
      label: chain.name,
      data: [{ x: moment(chain.launchDate).toDate(), y: Math.random() * 100 }], // Generate random Y-axis values for now
      backgroundColor:
        raasProviderColors[chain.raas] || raasProviderColors.Default, // Color based on RaaS provider
      pointRadius: 10,
    })),
  };

  const options = {
    scales: {
      x: {
        type: "time", // Set the X-axis to use time scale
        time: {
          unit: "month", // Display months on X-axis
        },
        title: {
          display: true,
          text: "Launch Date Timeline",
        },
      },
      y: {
        display: false, // Hide Y-axis
      },
    },
    plugins: {
      legend: {
        display: false, // Hide legend for now
      },
    },
  };

  return (
    <div className="scatter-plot-container">
      <div className="time-range-buttons">
        <button onClick={() => setTimeRange("1week")}>1 Week</button>
        <button onClick={() => setTimeRange("3month")}>3 Months</button>
        <button onClick={() => setTimeRange("6month")}>6 Months</button>
        <button onClick={() => setTimeRange("12month")}>12 Months</button>
      </div>
      <Scatter data={scatterData} options={options} />
    </div>
  );
};

export default ScatterPlot;
