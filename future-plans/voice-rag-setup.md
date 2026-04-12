# Voice-RAG: Fastest Low-Latency Stack

For the ultimate fastest voice-RAG setup, the industry-standard "low-latency" stack avoids building from scratch and uses [**Retell AI**](https://www.retellai.com/) or **Vapi**. These platforms handle the complex "streaming" for you, which is critical because manually waiting for each step to finish causes an "awkward silence" longer than 1,000ms.

## Step 1: Set Up Your Supabase Vector Store

First, prepare your "brain" with your personal data.

1. **Create a Supabase Project:** Choose the region closest to your users to shave off precious milliseconds of network latency.
2. **Enable pgvector:** Run this in the **Supabase SQL Editor**:

   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE TABLE documents (
     id bigserial PRIMARY KEY,
     content text,
     embedding vector(1536) -- Match your embedding model dimensions
   );
   ```

3. **Add a Match Function:** Create a PostgreSQL function that the voice agent can call to perform a semantic search.

## Step 2: Use an Orchestration Layer (The "Speed Hub")

Instead of writing complex WebRTC code, use **Vapi** or **Retell AI**. They act as the "glue" that connects everything at lightning speed.

- **Vapi:** Best for rapid prototyping and flexibility.
- **Retell AI:** Generally offers the lowest latency and best "barge-in" (interruption) handling.

## Step 3: Connect RAG via Edge Functions

To keep latency low, do **not** use intermediate tools like Make.com for the actual RAG call.

1. **Create a Supabase Edge Function:** This function will take the user's spoken text, search your database, and return the answer.
2. **Call the Function from your Voice Agent:** In your Vapi or Retell dashboard, set up a "Tool" or "Server URL" that points to this Edge Function.

## Step 4: Choose Sub-Models for Speed

- **STT (Ears):** Use **Deepgram Nova-2** (transcription in under 200ms).
- **LLM (Brain):** Use **GPT-4o-mini** or **Gemini 1.5 Flash**. These models are designed for low-latency tasks.
- **TTS (Voice):** Use **Deepgram Aura-2** or **11Labs Turbo v2.5** for high-quality, instant speech generation.

## Summary of the "Fastest" Stack

| Component | Recommended Provider | Why? |
| --- | --- | --- |
| **Orchestrator** | [**Retell AI**](https://www.retellai.com/) | Lowest end-to-end latency. |
| **Database** | [**Supabase**](https://supabase.com/) | Built-in pgvector and edge functions. |
| **LLM** | **Gemini 1.5 Flash** | Native multimodal and extremely fast. |
| **Voice/STT** | **Deepgram** | Benchmark for real-time speed. |
