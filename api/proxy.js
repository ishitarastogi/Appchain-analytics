// /api/proxy.js

const axios = require("axios");

module.exports = async (req, res) => {
  console.log("\nProxy request received with query:", req.query);

  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const { url } = req.query;

  if (!url) {
    console.error('Missing "url" query parameter');
    return res.status(400).json({ error: 'Missing "url" query parameter' });
  }

  try {
    const decodedUrl = decodeURIComponent(url);
    console.log("Decoded URL to proxy:", decodedUrl);

    // Make the request to the external API
    const response = await axios.get(decodedUrl);
    console.log("External API response status:", response.status);

    // Forward the response data
    res.status(200).json(response.data);
  } catch (error) {
    console.error("Error in proxy:", error.message);

    // Forward the error status and message
    const status = error.response ? error.response.status : 500;
    const message = error.response
      ? error.response.statusText
      : "Internal Server Error";
    res.status(status).json({ error: message });
  }
};
