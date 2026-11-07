# Introduction to Retrieval-Augmented Generation (RAG)

## Introduction
Artificial intelligence can write text and answer questions. However, an AI model can make mistakes or lack private company information. An AI model, also called a large language model, is a computer program trained on text to recognize patterns and generate words. This lesson introduces Retrieval-Augmented Generation, also called RAG. RAG is a method that helps AI models give better answers by searching true documents first.

## What it means
Retrieval-Augmented Generation, or RAG, is a three-part process for answering questions with an AI model. First, retrieval means finding relevant text from outside documents. Second, augmentation means adding that found text into the instruction given to the AI model. An instruction sent to an AI model is called a prompt. Third, generation means the AI model reads the prompt with the added text and writes the final answer in plain language.

## Why it matters
An AI model only knows what it learned during training up to a cutoff date. It does not know private business notes or facts created after its training. Also, an AI model can create confident but false answers, which are called hallucinations. RAG helps because it supplies real documents directly to the model. This makes answers more accurate, keeps data private, and allows updates without retraining the entire AI model.

## Important components
- **Retrieval:** Retrieval is the search step. The system looks outside the AI model to find document pieces that match the user question.
- **Augmentation:** Augmentation is the combining step. The system takes the found document text and attaches it to the question inside a single prompt.
- **Generation:** Generation is the writing step. The AI model reads the combined prompt and creates a clear answer in human language.
- **Embedding:** An embedding is a list of numbers that represents the meaning of a piece of text. Text with similar meaning gets similar numbers so a computer can compare them.
- **Vector Database:** A vector database is a special searchable store that holds document chunks and their numerical embeddings.

## Step by step
1. **Splitting Documents into Chunks:** Large documents are cut into smaller pieces called chunks. Small chunks help the search system find precise facts easily.
2. **Converting Chunks to Embeddings:** Each chunk is turned into an embedding, which is a list of numbers showing its meaning. These numbers and original texts are saved in a vector database.
3. **Converting Question to Embedding:** When a user asks a question, the system converts the question into numbers using the exact same embedding model.
4. **Searching for Related Chunks:** The vector database compares the question numbers with document numbers. It selects the chunks with the closest meaning in a process called semantic search.
5. **Augmenting the Prompt:** The system creates a new message called a prompt. It combines the retrieved chunk text, the user question, and an instruction to rely only on the chunk text.
6. **Generating the Answer:** The AI model reads the prompt and writes an answer. The model can also cite which source document it used.

## Real-world analogy
Imagine an open-book history exam. A student could try to answer every question using only memory. If the student forgot a fact or never learned it, they might guess wrong. RAG is like letting the student look at a specific textbook page before writing each answer. The student searches the textbook index for the right page, reads the page, and then writes the answer. However, this analogy stops being exact because a human student actually understands facts, while an AI model only predicts words based on patterns in the provided text.

## Practical example
An employee at a store uses an AI customer support tool to answer a customer question about damaged items.

**Question:** What is the refund policy for items that arrive damaged?

**Documents:**
- *Document A: Store Operating Hours:* Our physical store is open Monday through Friday from 9:00 AM to 5:00 PM. Weekend hours are 10:00 AM to 2:00 PM.
- *Document B: Return and Refund Policy:* Customers can return any product within 30 days of purchase. If an item arrives damaged, the customer receives a full refund or a free replacement within 5 business days of reporting the issue.

**Selected:** Document B: Return and Refund Policy

**Prompt given to the model:**

```text
Context text: Customers can return any product within 30 days of purchase. If an item arrives damaged, the customer receives a full refund or a free replacement within 5 business days of reporting the issue. User Question: What is the refund policy for items that arrive damaged? Instruction: Answer the user question using only the provided context text.
```

**Answer:** If an item arrives damaged, you can receive a full refund or a free replacement within 5 business days of reporting the issue.

## Example walkthrough
1. The system receives the user question: 'What is the refund policy for items that arrive damaged?' The question is converted into a numerical embedding so the system can search for matching content.
2. The search system compares the question embedding against all documents in the database. 'Document B: Return and Refund Policy' is retrieved because its meaning matches the user question, while Document A is ignored.
3. The system attaches the retrieved text from Document B to the user question and instructions into a single prompt. An augmented prompt containing the source text and question is prepared for the AI model.
4. The AI model reads the augmented prompt and generates an answer using only the attached source text. The AI model generates the final answer: 'If an item arrives damaged, you can receive a full refund or a free replacement within 5 business days of reporting the issue.'

## Terminology
- **AI Model:** A computer program trained on large text datasets to recognize patterns and write words.
- **Retrieval-Augmented Generation (RAG):** A method that searches outside documents for facts and gives them to an AI model to answer a question.
- **Retrieval:** The process of searching and selecting relevant document text from a store.
- **Augmentation:** The process of putting selected text into the instruction given to an AI model.
- **Generation:** The process where an AI model writes an answer based on its prompt.
- **Prompt:** The input text or instruction sent to an AI model.
- **Chunk:** A small piece of a larger text document.
- **Embedding:** A list of numbers representing the meaning of a text segment.
- **Vector Database:** A database that stores embeddings and allows fast search based on text meaning.
- **Semantic Search:** A search method that finds text with similar meaning rather than just matching exact words.
- **Hallucination:** A mistake where an AI model produces confident but false information.

## Common mistakes
- **RAG permanently retrains the AI model with new documents.** RAG does not retrain or permanently change the AI model. It only gives document text inside the prompt for a single question.
- **RAG completely eliminates all AI mistakes.** RAG reduces false statements, but an AI model can still misread context or ignore details.
- **RAG always produces a good answer even if the source documents are bad.** If the source documents are wrong or the search retrieves incorrect text, the final answer will also be poor.

## Summary
Retrieval-Augmented Generation (RAG) improves AI accuracy by searching external documents before generating an answer. It breaks documents into chunks, turns them into numerical embeddings, and stores them in a vector database. When a user asks a question, semantic search finds the most relevant chunks. The system augments the prompt with these chunks. Finally, the AI model generates an accurate, source-based answer without requiring model retraining.

## Key takeaways
- RAG stands for Retrieval-Augmented Generation.
- Retrieval finds relevant document chunks using semantic search with embeddings.
- Augmentation adds retrieved text directly into the prompt given to the AI model.
- Generation creates the final answer using the provided text context.
- RAG does not retrain the AI model, but helps prevent false facts called hallucinations.

## Check your knowledge
1. What do the three words in RAG stand for?
2. Why are long documents split into smaller pieces called chunks?
3. What is an embedding?
4. Does RAG permanently retrain the AI model with new text?

## Answers
1. RAG stands for Retrieval, Augmentation, and Generation.
2. Documents are split into chunks so the search system can find focused, specific facts more easily.
3. An embedding is a list of numbers that represents the meaning of a piece of text.
4. No, RAG does not retrain the AI model; it only provides the relevant text inside the temporary prompt for that specific request.
