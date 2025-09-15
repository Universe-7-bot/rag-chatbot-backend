import express from "express";
import { v4 as uuidv4 } from "uuid";
import {
  processUserQuery,
  processUserQueryStreaming,
} from "../services/gemini.js";
import {
  redisClient,
  saveMessage,
  getHistory,
  clearSession,
} from "../services/redis.js";

const router = express.Router();

const SESSION_TTL = 3600;

// POST /api/chat/:sessionId/stream - Send message with streaming response
router.post("/:sessionId/stream", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { message } = req.body;

    if (
      !message ||
      typeof message !== "string" ||
      message.trim().length === 0
    ) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (!sessionId || sessionId.length < 10) {
      return res.status(400).json({ error: "Invalid session ID" });
    }

    // Set up Server-Sent Events
    res.writeHead(200, {
      "Content-Type": "text/plain",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    });

    const userMessage = {
      id: uuidv4(),
      content: message.trim(),
      sender: "user",
      timestamp: new Date().toISOString(),
    };

    const botMessageId = uuidv4();
    let fullResponse = "";
    let sources = [];

    await processUserQueryStreaming(
      message.trim(),
      (chunk) => {
        fullResponse += chunk;
        res.write(
          `data: ${JSON.stringify({ type: "chunk", content: chunk })}\n\n`
        );
      },
      (responseSources) => {
        sources = responseSources;
        res.write(
          `data: ${JSON.stringify({
            type: "complete",
            sources: responseSources,
          })}\n\n`
        );
      }
    );

    const botMessage = {
      id: botMessageId,
      content: fullResponse,
      sender: "bot",
      timestamp: new Date().toISOString(),
      sources: sources,
    };

    // Store messages in Redis if available
    if (redisClient && redisClient.isReady) {
      try {
        const sessionKey = `chat:${sessionId}`;

        await saveMessage(sessionKey, userMessage);
        await saveMessage(sessionKey, botMessage);
      } catch (redisError) {
        console.error("Redis error:", redisError);
      }
    }

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error) {
    console.error("Streaming chat error:", error);
    res.write(
      `data: ${JSON.stringify({
        type: "error",
        message: "Failed to process message",
      })}\n\n`
    );
    res.end();
  }
});

// POST /api/chat/:sessionId - Send message
router.post("/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { message } = req.body;

    console.log(`Received message for session ${sessionId}: ${message}`);

    if (
      !message ||
      typeof message !== "string" ||
      message.trim().length === 0
    ) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (!sessionId || sessionId.length < 10) {
      return res.status(400).json({ error: "Invalid session ID" });
    }

    const userMessage = {
      id: uuidv4(),
      content: message.trim(),
      sender: "user",
      timestamp: new Date().toISOString(),
    };

    const response = await processUserQuery(message.trim());

    const botMessage = {
      id: uuidv4(),
      content: response.message,
      sender: "bot",
      timestamp: new Date().toISOString(),
      sources: response.sources,
    };

    // Store messages in Redis if available
    if (redisClient && redisClient.isReady) {
      try {
        const sessionKey = `chat:${sessionId}`;

        await saveMessage(sessionKey, userMessage);
        await saveMessage(sessionKey, botMessage);
      } catch (redisError) {
        console.error("Redis error:", redisError);
      }
    }

    res.json({
      message: response.message,
      sources: response.sources,
      sessionId,
    });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({
      error: "Failed to process message",
      message:
        "Sorry, I encountered an error processing your request. Please try again.",
    });
  }
});

// GET /api/chat/:sessionId/history - Get chat history
router.get("/:sessionId/history", async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId || sessionId.length < 10) {
      return res.status(400).json({ error: "Invalid session ID" });
    }

    if (!redisClient || !redisClient.isReady) {
      return res.json({ messages: [] });
    }

    let messages = [];

    const sessionKey = `chat:${sessionId}`;
    messages = await getHistory(sessionKey);

    console.log(
      `Retrieved ${messages.length} messages for session ${sessionId}`
    );

    res.json({ messages });
  } catch (error) {
    console.error("History error:", error);
    res.status(500).json({ error: "Failed to retrieve chat history" });
  }
});

// DELETE /api/chat/:sessionId - Clear session
router.delete("/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId || sessionId.length < 10) {
      return res.status(400).json({ error: "Invalid session ID" });
    }

    if (redisClient && redisClient.isReady) {
      const sessionKey = `chat:${sessionId}`;
      await clearSession(sessionKey);
    }

    res.json({ message: "Session cleared successfully" });
  } catch (error) {
    console.error("Clear session error:", error);
    res.status(500).json({ error: "Failed to clear session" });
  }
});

export default router;
