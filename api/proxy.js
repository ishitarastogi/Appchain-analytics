// /api/proxy.js

const axios = require("axios");

module.exports = async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing "url" query parameter' });
  }

  try {
    // Make the request to the external API
    const response = await axios.get(url);

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
