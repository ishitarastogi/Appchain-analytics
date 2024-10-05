// SimpleTPSComponent.js

import React, { useState } from "react";
import { fetchGoogleSheetData, fetchTPSData } from "../services/sheet";

const SimpleTPSComponent = () => {
  const [tpsData, setTpsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFetchTPS = async () => {
    setLoading(true);
    setError(null);
    setTpsData(null);

    try {
      // Step 1: Fetch Google Sheets Data
      const sheetData = await fetchGoogleSheetData();

      // Step 2: Select a Project ID (e.g., the first project with an ID)
      const project = sheetData.find(
        (item) => item.id && item.id.trim() !== ""
      );
      if (!project) {
        throw new Error("No valid project ID found in Google Sheets data.");
      }

      // Step 3: Fetch TPS Data for the Selected Project
      const tpsResponse = await fetchTPSData([project.id], "max"); // "max" can be replaced with other ranges like "daily", "6months", etc.

      // Step 4: Update State with the Retrieved TPS Data
      setTpsData(tpsResponse);
    } catch (err) {
      console.error("Error fetching TPS data:", err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h2>Simple TPS Fetcher</h2>
      <button onClick={handleFetchTPS} style={styles.button} disabled={loading}>
        {loading ? "Fetching TPS..." : "Fetch TPS Data"}
      </button>

      {error && <p style={styles.error}>Error: {error}</p>}

      {tpsData && (
        <div style={styles.dataContainer}>
          <h3>TPS Data:</h3>
          <pre style={styles.pre}>{JSON.stringify(tpsData, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

// Simple inline styles for basic styling
const styles = {
  container: {
    padding: "20px",
    fontFamily: "Arial, sans-serif",
  },
  button: {
    padding: "10px 20px",
    fontSize: "16px",
    cursor: "pointer",
  },
  error: {
    color: "red",
    marginTop: "10px",
  },
  dataContainer: {
    marginTop: "20px",
    backgroundColor: "#f4f4f4",
    padding: "10px",
    borderRadius: "5px",
  },
  pre: {
    whiteSpace: "pre-wrap",
    wordWrap: "break-word",
  },
};

export default SimpleTPSComponent;
