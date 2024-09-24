import React from "react";

const TopChains = () => {
  return (
    <div className="top-chains">
      <h2>Top 6 Chains</h2>
      <div className="chain-cards">
        <div className="chain-card">
          <h3>Reya</h3>
          <p>100.5M TX</p>
          <p>25% of Total</p>
          <p>+12% this week</p>
        </div>
        {/* Add more chain cards */}
      </div>
    </div>
  );
};

export default TopChains;
