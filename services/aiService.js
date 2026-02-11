// services/aiService.js
const axios = require("axios");

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

async function generateLearningPath(payload) {
  try {
    console.log("[DEBUG] Sending to FastAPI:", payload);

    const response = await axios.post(
      `${AI_SERVICE_URL}/api/generate-learning-path`,
      payload,
      {
        timeout: 600000,
        headers: { "Content-Type": "application/json" },
      },
    );

    console.log("[DEBUG] FastAPI response:", response.data);
    return response.data;
  } catch (error) {
    if (error.code === "ECONNABORTED") {
      throw new Error("AI service timed out - generation took too long");
    }
    if (error.response) {
      console.error("FastAPI error response:", error.response.data);
      throw new Error(error.response.data.detail || "AI service error");
    }
    throw error;
  }
}

async function generateTopicContent(payload) {
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/api/generate-topic-content`,
      payload,
      {
        timeout: 600000,
      },
    );

    return response.data;
  } catch (error) {
    const errorTime = new Date().toISOString();

    console.error(
      `[${errorTime}] Topic content generation failed:`,
      error.message,
    );

    throw new Error(
      `(${errorTime}) ${
        error.response?.data?.detail || "Failed to generate topic content"
      }`,
    );
  }
}

module.exports = {
  generateLearningPath,
  generateTopicContent,
};
