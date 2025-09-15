import fetch from "node-fetch";

export async function generateEmbedding(text) {
  const res = await fetch(process.env.EMBEDDING_URL, {
    method: "POST",
    headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.EMBEDDING_API_KEY}`
    },
    body: JSON.stringify({
      model: "jina-embeddings-v3",  
      input: text                         
    }),
  });
  const data = await res.json();
  return data.data[0].embedding; // [float...]
}
