
* * *

# 📘 Backend – RAG News Chatbot

This backend powers the **RAG-based news chatbot**. It provides REST APIs for chat, session management, embeddings retrieval, and integrates with Redis, Qdrant, and Google Gemini.

* * *

## 🚀 Tech Stack

*   **Node.js + Express** → REST API server
    
*   **Qdrant** → Vector DB for semantic search
    
*   **Redis** → In-memory session & chat history storage
    
*   **Jina Embeddings** → Embedding model (or any open-source embeddings)
    
*   **Google Gemini API** → LLM to generate grounded answers
    

* * *

## ⚙️ Features

*   **Session Management**
    
    *   Each chat session is identified by a `sessionId`.
        
    *   History stored in Redis (expires after 1 hour).
        
*   **RAG Pipeline**
    
    1.  Convert user query → embedding.
        
    2.  Retrieve top-k similar passages from Qdrant.
        
    3.  Send context + query to Gemini API.
        
    4.  Return grounded answer to user.
        
*   **Chat API**
    
    *   Send message
        
    *   Fetch history
        
    *   Reset session
        

* * *

## 📂 Project Structure

    backend/
    │── src/
    │   ├── app.js               # Express server
    │   ├── routes/chat.js       # Chat routes
    │   ├── services/
    │   │   ├── embeddings.js    # Jina embeddings
    │   │   ├── qdrant.js        # Qdrant client
    │   │   ├── gemini.js        # Gemini API integration
    │   │   ├── redis.js         # Redis storage
    │  
    │    
    │
    │── package.json
    │── README.md
       

* * *

## 🧩 API Endpoints

### 1\. Send a message

    POST /chat/:sessionId
    

**Request Body:**

    { "message": "What did Apple announce today?" }
    

**Response:**

    { "answer": "Apple announced a new iPhone..." }
    

* * *

### 2\. Get session history

    GET /chat/:sessionId/history
    

**Response:**

    [
      { "role": "user", "content": "What did Apple announce?" },
      { "role": "bot", "content": "Apple announced a new iPhone..." }
    ]
    

* * *

### 3\. Reset session

    DELETE /chat/:sessionId
    

**Response:**

    { "status": "cleared" }
    

* * *

## 🧠 Caching & TTLs

*   Redis stores session chat history under key: `chat:<sessionId>`
    
*   TTL: **1 hour** (3600s) → auto-clears inactive sessions
    
*   Prevents memory bloat & ensures fresh sessions
    

* * *

## 🔮 Future Improvements

*   Move transcripts to Postgres/MySQL for persistence
    
*   Add hybrid search (keyword + vector) in Qdrant
    
*   Add rate-limiting per session to prevent abuse
    

* * *

