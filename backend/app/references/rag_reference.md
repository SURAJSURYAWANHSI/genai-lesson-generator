# Retrieval-Augmented Generation: reference notes

Retrieval-Augmented Generation (RAG) is a method for answering questions with a large language model (LLM) by first finding relevant information from an outside collection of documents and then giving that information to the model together with the question.

## Stages

- **Retrieval:** the system searches a collection of documents and selects the pieces most relevant to the question. The search happens outside the LLM.
- **Augmentation:** the selected text is added to the prompt, along with the question and usually an instruction to answer from that text.
- **Generation:** the LLM reads the augmented prompt and writes an answer in natural language.

## Usual preparation

1. Documents are collected and split into smaller pieces called chunks, because models and searches work better with focused passages.
2. Each chunk is converted into an embedding: a list of numbers representing its meaning. Text with similar meaning gets similar numbers.
3. Embeddings and their original text are stored in a searchable store, often a vector database.

## Usual answering flow

1. The question is converted into an embedding using the same embedding model.
2. The store returns the chunks whose embeddings are closest to the question's embedding. This is called semantic search. Keyword search, or a mix of both, can also be used.
3. The retrieved text is placed into the prompt with the question.
4. The model generates an answer using that context. Many systems also show which sources were used.

## Why it is useful

- LLMs learn from data up to a training cutoff, so they may not know recent information.
- LLMs do not know an organisation's private documents unless they are provided.
- LLMs can produce confident but false statements, called hallucinations. Supplying relevant source text reduces this risk.
- Documents can be updated without retraining the model.

## Limitations

- RAG reduces hallucinations but does not eliminate them. A model can still misread or ignore the context.
- If retrieval finds the wrong text, or the right text does not exist, the answer can be poor or wrong.
- Answer quality depends on the quality of the documents, how they are split, and the search method.
- RAG does not retrain the model or permanently change what it has learned. The retrieved text only applies to that request.
- It adds moving parts and some extra time and cost to each answer.
