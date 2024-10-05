import React, { useEffect, useState } from "react";
import {
  fetchGoogleSheetData,
  fetchAllActiveAccounts,
} from "../services/googleSheetService";

const ActiveAccountsDisplay = () => {
  const [activeAccounts, setActiveAccounts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sheetData = await fetchGoogleSheetData();
        const accountsData = await fetchAllActiveAccounts(sheetData);
        setActiveAccounts(accountsData);
      } catch (error) {
        console.error("Error fetching active accounts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Active Accounts Data</h1>
      {Object.keys(activeAccounts).length === 0 ? (
        <div>No active accounts data available for Gelato RaaS providers.</div>
      ) : (
        Object.entries(activeAccounts).map(([chainName, data]) => (
          <div key={chainName}>
            <h2>{chainName}</h2>
            <div>
              <h3>Daily Active Accounts:</h3>
              <pre>
                {data.daily.activeAccounts &&
                Array.isArray(data.daily.activeAccounts)
                  ? JSON.stringify(data.daily.activeAccounts, null, 2)
                  : "No data available"}
              </pre>
            </div>
            <div>
              <h3>All Active Accounts:</h3>
              <pre>
                {data.all.activeAccounts &&
                Array.isArray(data.all.activeAccounts)
                  ? JSON.stringify(data.all.activeAccounts, null, 2)
                  : "No data available"}
              </pre>
            </div>
            <div>
              <h3>Active Accounts Last 4 Months:</h3>
              <pre>
                {data.fourMonths.activeAccounts &&
                Array.isArray(data.fourMonths.activeAccounts)
                  ? JSON.stringify(data.fourMonths.activeAccounts, null, 2)
                  : "No data available"}
              </pre>
            </div>
            <div>
              <h3>Active Accounts Last 6 Months:</h3>
              <pre>
                {data.sixMonths.activeAccounts &&
                Array.isArray(data.sixMonths.activeAccounts)
                  ? JSON.stringify(data.sixMonths.activeAccounts, null, 2)
                  : "No data available"}
              </pre>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default ActiveAccountsDisplay;
