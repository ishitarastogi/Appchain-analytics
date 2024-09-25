// /api/proxy.js

const axios = require("axios");

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*"); // Allow all origins
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS"); // Allow specific methods
  res.setHeader("Access-Control-Allow-Headers", "Content-Type"); // Allow specific headers

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing "url" query parameter' });
  }

  try {
    // Make the request to the external API
    const response = await axios.get(decodeURIComponent(url));

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
