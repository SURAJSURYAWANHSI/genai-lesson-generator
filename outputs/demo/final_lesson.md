# Introduction to RAG (Retrieval-Augmented Generation)

## Introduction
Imagine you ask a very smart friend a question about your company's leave rules. Your friend is good at explaining things, but has never seen those rules. A good friend would first read the rules, and then answer you. RAG helps an AI model work in the same way. In this lesson, you will learn what RAG is, why people use it, and how it works step by step. You do not need any technical knowledge to follow this lesson.

## What it means
An AI model is a computer program that has learned patterns from a very large amount of text. It can read a question and write an answer in normal language. RAG stands for Retrieval-Augmented Generation. It is a way of helping an AI model answer questions by first finding useful information and then giving that information to the model. The name has three parts. Retrieval means finding and bringing back useful information from a collection of documents. Augmentation means adding something extra. Here, we add the information we found to the question. Generation means creating something new. Here, the AI model writes the answer. So RAG is simple: find the information, add it to the question, and then write the answer.

## Why it matters
An AI model only knows what it learned during its training. Training stops on a certain date, so the model may not know about recent events. It also does not know private information, such as your company's rules or a school's fee list. When a model does not know something, it can still give an answer that sounds confident but is wrong. This kind of wrong answer is called a hallucination. RAG helps with these problems. The model gets the correct information at the moment you ask. This makes wrong answers less likely. It also means people can update their documents at any time without training the model again.

## Important components
- **Documents:** These are the sources of information, such as policy files, web pages or manuals. The answer can only be as good as these documents.
- **Chunks:** A chunk is a small piece of a document. Long documents are cut into chunks so that the system can find just the part it needs.
- **Embeddings:** An embedding is a list of numbers that represents the meaning of a piece of text. Text with similar meaning gets similar numbers. This lets a computer compare meaning, not just exact words.
- **Vector database:** A vector database is a place that stores embeddings together with their original text. It can quickly find the stored text whose meaning is closest to a question.
- **Retriever:** The retriever is the part of the system that does the searching. It takes the question and brings back the most useful chunks.
- **AI model:** The AI model reads the question and the chunks the retriever found. Then it writes the final answer in clear language.

## Step by step
1. **Prepare the documents:** Collect the documents and cut them into chunks. This happens before anyone asks a question.
2. **Store the documents:** Turn each chunk into an embedding, and save the embedding and its text in a vector database.
3. **Receive the question:** A person asks a question. The system turns the question into an embedding in the same way.
4. **Search and retrieve:** The system compares the question's numbers with the stored numbers. It brings back the chunks with the closest meaning. This is the retrieval stage.
5. **Add the information to the prompt:** A prompt is the text we send to the AI model. The system puts the retrieved chunks and the question together in one prompt, with an instruction to answer using that information. This is the augmentation stage.
6. **Write the answer:** The AI model reads the prompt, uses the retrieved information, and writes the answer. This is the generation stage.

## Real-world analogy
Think of a student taking an open-book exam. The student is the AI model. The library is the collection of documents. When a question comes, the student finds the right page in the book (retrieval), keeps that page open next to the question (augmentation), and writes the answer in their own words (generation). The analogy has one limit: the student understands the book, but an AI model only works with patterns in text, so it can still make mistakes.

## Practical example
A company has a helper chatbot for its staff. An employee wants to know how many leave days they can carry into next year.

**Question:** How many leave days can I carry into next year?

**Documents:**
- *Leave Policy:* Employees may carry a maximum of 5 unused leave days into the next calendar year.
- *Travel Policy:* Employees must book work travel at least 7 days before the trip.
- *Office Hours:* The office is open from 9 AM to 6 PM, Monday to Friday.

**Selected:** Leave Policy

**Prompt given to the model:**

```text
Use only the information below to answer the question.
Information: Employees may carry a maximum of 5 unused leave days into the next calendar year.
Question: How many leave days can I carry into next year?
```

**Answer:** You can carry up to 5 unused leave days into next year. This comes from the Leave Policy.

## Example walkthrough
1. The employee types the question into the chatbot. The system now has the question and turns it into an embedding.
2. The retriever compares the question with the three stored documents. The Leave Policy is closest in meaning, because it is about carrying leave days. The Travel Policy and Office Hours are not selected.
3. The system builds the prompt. The prompt now holds the instruction, the Leave Policy text and the question.
4. The AI model reads the prompt and writes an answer. The model answers that the limit is 5 days, using the retrieved text instead of guessing.
5. The chatbot shows the answer and names its source. The employee can see that the answer came from the Leave Policy and can check it.

## Terminology
- **AI model:** A computer program that has learned from a lot of text and can write answers.
- **Retrieval:** Finding and bringing back useful information.
- **Augmentation:** Adding the information that was found to the question.
- **Generation:** The AI model writing the answer.
- **Chunk:** A small piece of a document.
- **Embedding:** A list of numbers that represents the meaning of text.
- **Vector database:** A store that keeps embeddings and can quickly find similar meaning.
- **Prompt:** The text we send to an AI model.
- **Hallucination:** An answer from an AI model that sounds confident but is wrong.

## Common mistakes
- **RAG makes the AI model always correct.** RAG lowers the chance of wrong answers, but the model can still misunderstand the text.
- **RAG teaches the model new things permanently.** The model is not trained again. It only uses the retrieved text for that one question.
- **RAG works well with any documents.** If the documents are old, wrong or missing, the answer can also be poor. Good answers need good documents.
- **Search always finds the right text.** Retrieval can bring back the wrong text. When that happens, the final answer can be wrong too.

## Summary
RAG helps an AI model answer using information it was not trained on. First the system stores documents in a form it can search. When a question comes, it finds the most useful text, adds that text to the prompt, and lets the model write the answer. This gives more up-to-date and more trustworthy answers, but it does not make them perfect.

## Key takeaways
- RAG means find the information, add it to the question, then write the answer.
- Retrieval finds, augmentation adds, and generation writes.
- Documents are usually split into chunks and stored as embeddings so they can be searched by meaning.
- RAG reduces wrong answers, but it cannot remove them completely.
- The quality of the answer depends on the quality of the documents and the search.

## Check your knowledge
1. What do the three parts of the name RAG mean?
2. Why can a normal AI model not answer questions about your company's private rules?
3. In the leave example, why was the Leave Policy selected and not the Travel Policy?
4. Does RAG guarantee that every answer is correct? Why or why not?

## Answers
1. Retrieval means finding useful information. Augmentation means adding it to the question. Generation means the AI model writes the answer.
2. The model was not trained on those private rules, so it has never seen them.
3. The Leave Policy was closest in meaning to the question, because both are about carrying leave days.
4. No. The search can find the wrong text, and the model can misread the text, so mistakes are still possible.
