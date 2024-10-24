// src/App.js
import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import DailyTransactionsPage from "./pages/DailyTransactionsPage";
import ActiveAccountsPage from "./pages/ActiveAccountsPage";
import TPSPage from "./pages/TPS"; // Import the new TPSPage component
import TVLPage from "./pages/TVL";
import EcosystemPage from "./pages/EcosystemPage";
import Framework from "./pages/Framework";
import DataAvaliability from "./pages/DataAvaliability";
import L2L3Page from "./pages/L2L3Page";
import RaasPage from "./pages/RaasPage";

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/daily-transactions" element={<DailyTransactionsPage />} />
        <Route path="/active-accounts" element={<ActiveAccountsPage />} />
        <Route path="/tps" element={<TPSPage />} /> {/* New Route */}
        <Route path="/tvl" element={<TVLPage />} /> {/* New Route */}
        <Route path="/vertical" element={<EcosystemPage />} /> {/* New Route */}
        <Route path="/framework" element={<Framework />} /> {/* New Route */}
        <Route path="/da" element={<DataAvaliability />} /> {/* New Route */}
        <Route path="/layer" element={<L2L3Page />} /> {/* New Route */}
        <Route path="/raas" element={<RaasPage />} /> {/* New Route */}
      </Routes>
    </Router>
  );
};

export default App;
