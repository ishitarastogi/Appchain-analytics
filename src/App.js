// /src/App.js

import React, { useEffect, useState } from "react";
import "./App.css";
import {
  fetchGoogleSheetData,
  fetchBlockExplorerData,
} from "./services/googleSheetService";

function App() {
  const [sheetData, setSheetData] = useState([]);
  const [blockExplorerData, setBlockExplorerData] = useState({
    transactions: [],
    activeAccounts: [],
  });

  // Fetch Google Sheets data on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all data from the Google Sheet
        const sheetData = await fetchGoogleSheetData();
        setSheetData(sheetData);

        // Optionally: Fetch block explorer data for the first entry
        if (sheetData.length > 0) {
          const firstEntry = sheetData[0]; // Get the first row
          console.log("First entry from Google Sheets:", firstEntry);

          if (firstEntry.blockScoutUrl && firstEntry.launchDate) {
            const blockData = await fetchBlockExplorerData(
              firstEntry.blockScoutUrl,
              firstEntry.launchDate
            );
            console.log("Block Explorer Data:", blockData); // Log the fetched block explorer data
            setBlockExplorerData(blockData);
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="App">
      <h1>Appchain Growth Insights</h1>

      <div>
        <h2>Google Sheets Data</h2>
        {sheetData.length > 0 ? (
          <ul>
            {sheetData.map((row, index) => (
              <li key={index}>
                {row.name} - {row.blockScoutUrl} - {row.raas} - {row.vertical}
              </li>
            ))}
          </ul>
        ) : (
          <p>Loading Google Sheets data...</p>
        )}
      </div>

      <div>
        <h2>Block Explorer Data - Transactions</h2>
        {blockExplorerData.transactions.length > 0 ? (
          <ul>
            {blockExplorerData.transactions.map((transaction, index) => (
              <li key={index}>
                {transaction.date}: {transaction.value} new transactions
              </li>
            ))}
          </ul>
        ) : (
          <p>Loading Transactions data...</p>
        )}
      </div>

      <div>
        <h2>Block Explorer Data - Active Accounts</h2>
        {blockExplorerData.activeAccounts.length > 0 ? (
          <ul>
            {blockExplorerData.activeAccounts.map((account, index) => (
              <li key={index}>
                {account.date}: {account.value} active accounts
              </li>
            ))}
          </ul>
        ) : (
          <p>Loading Active Accounts data...</p>
        )}
      </div>
    </div>
  );
}

export default App;