import axios from "axios";

export default async function handler(req, res) {
  const { url } = req.query;

  // Log the URL to check if it's being received correctly
  console.log("Received URL in serverless function:", url);

  if (!url) {
    return res.status(400).json({ error: "Missing URL parameter" });
  }

  try {
    // Make the request to the external API
    const response = await axios.get(url);

    // Log the response from the external API
    console.log("Received response from external API:", response.data);

    // Return the response data to the client
    res.status(200).json(response.data);
  } catch (error) {
    console.error("Error fetching data from external API:", error.message);

    if (error.response) {
      // Return the error response from the external API
      return res.status(error.response.status).json(error.response.data);
    } else {
      return res
        .status(500)
        .json({ error: "Error fetching data from external API" });
    }
  }
}
