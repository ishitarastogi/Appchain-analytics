import axios from "axios";

export default async function handler(req, res) {
  // Get the URL from the request query
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Missing URL parameter" });
  }

  try {
    // Fetch data from the external API using axios
    const response = await axios.get(url);

    // Send the data back to the client
    res.status(200).json(response.data);
  } catch (error) {
    console.error("Error fetching data:", error.message);
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: "Error fetching data from external API" });
    }
  }
}
