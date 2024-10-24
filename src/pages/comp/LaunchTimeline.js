// src/components/LaunchTimeline.js

import React from "react";
import moment from "moment";
import "./LaunchTimeline.css"; // Import the CSS for styling

const LaunchTimeline = ({ launchData }) => {
  return (
    <div className="launch-timeline-container">
      <div className="timeline">
        {launchData.map((item, index) => (
          <div
            key={index}
            className={`timeline-item ${index % 2 === 0 ? "left" : "right"}`}
          >
            <div className="timeline-content">
              <div className="chain-info">
                {item.chainLogo && (
                  <img
                    src={item.chainLogo}
                    alt={`${item.chainName} Logo`}
                    className="chain-logo"
                  />
                )}
                <h3 className="chain-name">{item.chainName}</h3>
              </div>
              <p className="launch-date">
                Launch Date: {moment(item.launchDate).format("MMMM Do, YYYY")}
              </p>
            </div>
            <div className="timeline-icon"></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LaunchTimeline;
