import Parser from "rss-parser";
import { generateEmbedding } from "./embeddings.js";
import { client, ensureCollection, upsertPoints } from "./qdrant.js";
import { v4 as uuidv4 } from 'uuid';

const parser = new Parser({
  customFields: {
    feed: ["language", "copyright"],
    item: ["pubDate", "guid", "category"],
  },
});

// News RSS feeds
const RSS_FEEDS = [
  "https://feeds.reuters.com/reuters/topNews",
  "https://feeds.reuters.com/reuters/businessNews",
  "https://feeds.reuters.com/reuters/technologyNews",
  "https://feeds.reuters.com/reuters/worldNews",
  "https://rss.cnn.com/rss/edition.rss",
  "https://feeds.bbci.co.uk/news/rss.xml",
];

async function fetchArticlesFromFeed(feedUrl) {
  try {
    console.log(`Fetching from: ${feedUrl}`);
    const feed = await parser.parseURL(feedUrl);

    const articles = [];

    for (const item of feed.items.slice(0, 50)) {
      // Limit per feed
      if (!item.title || !item.contentSnippet) continue;

      const cleanContent = cleanText(item.contentSnippet || item.content || "");
      const cleanTitle = cleanText(item.title);

      if (cleanContent.length < 50) continue;

      // Combine title and content
      const fullText = `${cleanTitle}. ${cleanContent}`;

      articles.push({
        title: cleanTitle,
        content: cleanContent,
        fullText: fullText,
        url: item.link,
        date: item.pubDate
          ? new Date(item.pubDate).toISOString()
          : new Date().toISOString(),
        source: feed.title || "Unknown Source",
        guid: item.guid || item.link,
      });
    }

    console.log(`Fetched ${articles.length} articles from ${feedUrl}`);
    return articles;
  } catch (error) {
    console.error(`Failed to fetch from ${feedUrl}:`, error.message);
    return [];
  }
}

function chunkText(text, maxWords = 400) {
  const words = text.split(/\s+/);
  const chunks = [];

  for (let i = 0; i < words.length; i += maxWords) {
    const chunk = words.slice(i, i + maxWords).join(" ");
    if (chunk.trim().length > 50) {
      // Only include substantial chunks
      chunks.push(chunk.trim());
    }
  }

  return chunks.length > 0 ? chunks : [text];
}

function cleanText(text) {
  return text
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[^\w\s.,!?-]/g, "")
    .trim();
}

async function ingestArticles() {
  try {
    console.log("Starting news ingestion...");

    // Fetch articles from all feeds
    const allArticles = [];

    for (const feedUrl of RSS_FEEDS) {
      const articles = await fetchArticlesFromFeed(feedUrl);
      allArticles.push(...articles);
    }

    console.log(`Total articles collected: ${allArticles.length}`);

    // Remove duplicates based on title similarity
    const uniqueArticles = [];
    const seenTitles = new Set();

    for (const article of allArticles) {
      const titleKey = article.title.toLowerCase().replace(/[^\w]/g, "");
      if (!seenTitles.has(titleKey) && titleKey.length > 10) {
        seenTitles.add(titleKey);
        uniqueArticles.push(article);
      }
    }

    console.log(
      `Unique articles after deduplication: ${uniqueArticles.length}`
    );

    // Process articles into chunks
    const points = [];

    for (let i = 0; i < uniqueArticles.length; i++) {
      const article = uniqueArticles[i];

      try {
        const chunks = chunkText(article.fullText, 300);

        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
          const chunk = chunks[chunkIndex];
          const chunkId = uuidv4();

          // Generate embedding
          const embedding = await generateEmbedding(chunk);

          points.push({
            id: chunkId,
            vector: embedding,
            payload: {
              text: chunk,
              title: article.title,
              url: article.url,
              date: article.date,
              source: article.source,
              guid: article.guid,
              chunkIndex: chunkIndex,
              totalChunks: chunks.length,
            }
          });
        }

        if ((i + 1) % 10 === 0) {
          console.log(`Processed ${i + 1}/${uniqueArticles.length} articles`);
        }
      } catch (error) {
        console.error(`Error processing article ${i}:`, error.message);
      }
    }

    console.log(`Total chunks created: ${points.length}`);

    // Store in Qdrant in batches
    const batchSize = 100;

    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize);

      try {
        await upsertPoints("news_articles", batch);
        console.log(
          `Stored batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
            points.length / batchSize
          )}`
        );
      } catch (error) {
        console.error(
          `Error storing batch ${Math.floor(i / batchSize) + 1}:`,
          error.message
        );
      }
    }

    console.log("News ingestion completed successfully!");
  } catch (error) {
    console.error("News ingestion failed:", error);
    throw error;
  }
}

export async function startIngestion() {
  try {
    await ensureCollection();
    await ingestArticles();

    process.exit(0);
  } catch (error) {
    console.error("Script failed:", error);
    process.exit(1);
  }
}

