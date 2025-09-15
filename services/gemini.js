import { client, search } from "./qdrant.js";
import { generateEmbedding } from "./embeddings.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function retrieveRelevantDocs(query, topK = 5) {
  try {
    if (!client) {
      return [];
    }

    const queryVector = await generateEmbedding(query);

    const searchResult = await search("news_articles", queryVector);

    return searchResult.map((result) => ({
      text: result.payload.text,
      title: result.payload.title,
      date: result.payload.date,
      source: result.payload.source,
      url: result.payload.url,
      score: result.score,
    }));
  } catch (error) {
    console.error("Error retrieving documents:", error);
  }
}

// Process user query through RAG pipeline
export async function processUserQuery(query) {
  try {
    const relevantDocs = await retrieveRelevantDocs(query);

    const context = relevantDocs
      .map(
        (doc) =>
          `Title: ${doc.title}\nSource: ${doc.source}\nContent: ${doc.text}`
      )
      .join("\n\n");

    let response;

    if (genAI) {
      const prompt = `You are a helpful news chatbot. Answer the user's question based on the following recent news articles. If the information isn't available in the provided context, politely say so and offer general assistance.

                    Context from recent news:
                    ${context}

                    User question: ${query}

                    Please provide a helpful and accurate response based on the context above. Keep your response concise and informative.`;

      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
      });

      const result = await model.generateContent(prompt);
      response = result.response.text();
    } else {
      // Fallback response
      response = `I found some relevant information about your query. Based on recent news, there have been various developments related to your question. However, I'm currently unable to access my full knowledge base. Please try again later or rephrase your question.`;
    }

    const sources = relevantDocs.slice(0, 3).map((doc) => ({
      title: doc.title,
      date: doc.date,
      url: doc.url,
    }));

    return {
      message: response,
      sources: sources,
    };
  } catch (error) {
    console.error("Error processing query:", error);

    return {
      message:
        "I apologize, but I'm experiencing some technical difficulties right now. Please try again in a moment, or rephrase your question.",
      sources: [],
    };
  }
}

// Process user query with streaming response
export async function processUserQueryStreaming(query, onChunk, onComplete) {
  try {
    const relevantDocs = await retrieveRelevantDocs(query);

    const context = relevantDocs
      .map(
        (doc) =>
          `Title: ${doc.title}\nSource: ${doc.source}\nContent: ${doc.text}`
      )
      .join("\n\n");

    if (genAI) {
      const prompt = `You are a helpful news chatbot. Answer the user's question based on the following recent news articles. If the information isn't available in the provided context, politely say so and offer general assistance.

                    Context from recent news:
                    ${context}

                    User question: ${query}

                    Please provide a helpful and accurate response based on the context above. Keep your response concise and informative.`;

      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
      });
      const result = await model.generateContentStream(prompt);

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          onChunk(chunkText);
        }
      }
    } else {
      const fallbackResponse = `I found some relevant information about your query. Based on recent news, there have been various developments related to your question. However, I'm currently unable to access my full knowledge base. Please try again later or rephrase your question.`;

      // Simulate typing effect
      const words = fallbackResponse.split(" ");
      for (let i = 0; i < words.length; i++) {
        const chunk = (i === 0 ? "" : " ") + words[i];
        onChunk(chunk);
        await new Promise((resolve) => setTimeout(resolve, 50)); // 50ms delay between words
      }
    }

    const sources = relevantDocs.slice(0, 3).map((doc) => ({
      title: doc.title,
      date: doc.date,
      url: doc.url,
    }));

    onComplete(sources);
  } catch (error) {
    console.error("Error processing streaming query:", error);

    const errorMessage =
      "I apologize, but I'm experiencing some technical difficulties right now. Please try again in a moment, or rephrase your question.";

    // Stream error message
    const words = errorMessage.split(" ");
    for (let i = 0; i < words.length; i++) {
      const chunk = (i === 0 ? "" : " ") + words[i];
      onChunk(chunk);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    onComplete([]);
  }
}
