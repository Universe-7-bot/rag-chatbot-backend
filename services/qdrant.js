import { QdrantClient } from "@qdrant/js-client-rest";

export const client = new QdrantClient({
  url: process.env.QDRANT_URL || "http://localhost:6333",
  apiKey: process.env.QDRANT_API_KEY,
});

export async function ensureCollection(collection = "news_articles") {
  try {
    await client.getCollection(collection);
    console.log("Collection exists");
  } catch (e) {
    await client.createCollection(collection, {
      vectors: {
        size: 1024,
        distance: "Cosine",
      },
    });

    console.log("ollection created");
  }
}

export async function upsertPoints(collection, points) {
  // points: [{ id, vector, payload }]
  try {
    await client.upsert(collection, {
      points: Array.isArray(points) ? points : [points],
    });
  } catch (error) {
    console.error("Error upserting points:", error);
    throw error;
  }
}

export async function search(collection, vector, limit = 5) {
  const res = await client.search(collection, {
    vector,
    limit,
    with_payload: true
  });
  return res;
}
