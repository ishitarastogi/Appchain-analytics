// /api/blockExplorer.js
import axios from "axios";

export default async function handler(req, res) {
  const { url } = req.query;

  // Log the URL received in the serverless function
  console.log("Received request to proxy this URL:", url);

  if (!url) {
    console.log("Missing URL parameter");
    return res.status(400).json({ error: "Missing URL parameter" });
  }

  try {
    console.log(`Fetching from external URL: ${url}`); // Log the external URL being requested

    // Fetch data from the external API using axios
    const response = await axios.get(url);

    console.log(`Received response: ${JSON.stringify(response.data)}`); // Log the response data

    // Send the data back to the client
    res.status(200).json(response.data);
  } catch (error) {
    console.error("Error fetching data:", error.message);

    if (error.response) {
      console.error("Error response status:", error.response.status);
      console.error("Error response data:", error.response.data);
      return res.status(error.response.status).json(error.response.data);
    } else {
      return res
        .status(500)
        .json({ error: "Error fetching data from external API" });
    }
  }
}
