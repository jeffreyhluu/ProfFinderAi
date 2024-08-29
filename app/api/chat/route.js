import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai'; // Ensure this import matches your package version
import fetch from 'node-fetch'; // Ensure you have node-fetch installed for server-side fetching

const systemPrompt = `
You are a Rate My Professor agent who helps students find classes by answering their questions with relevant information about professors. When responding to a user's question:

1. Use the top 3 professors that match the user's query.
2. Format the response as follows:
   - **Professor Name (Bold Text)**: [Professor's Name]
   - **Subject (Bold Text)**: [Subject]
   - **Stars (Bold Text)**: [Rating in Stars, give star shape based on how many stars.]
   - **Review (Bold Text)**: [Review Text]

Make sure to use bullet points to list the information for each professor and separate each professor's details clearly in the message so it is easier to read for the user.

Example Response:
- **Professor Name**: Dr. John Doe
  - **Subject**: Computer Science
  - **Stars**: 4.5
  - **Review**: Excellent lecturer with clear explanations and engaging lectures.

- **Professor Name**: Dr. Jane Smith
  - **Subject**: Mathematics
  - **Stars**: 4.2
  - **Review**: Very knowledgeable and approachable. Provides detailed feedback.

- **Professor Name**: Dr. Alice Johnson
  - **Subject**: Physics
  - **Stars**: 4.8
  - **Review**: Outstanding teaching skills and deep understanding of the subject.
`;

const extractProfessorDataFromUrl = async (url) => {
  try {
    // Fetch the HTML content of the URL
    const response = await fetch(url);
    const html = await response.text();
    
    // Simple example of extracting data (modify according to actual HTML structure)
    const professorName = html.match(/<h1 class="professor-name">([^<]+)<\/h1>/)[1];
    const subject = html.match(/<div class="subject">([^<]+)<\/div>/)[1];
    const stars = html.match(/<span class="rating">([^<]+)<\/span>/)[1];
    const review = html.match(/<div class="review-text">([^<]+)<\/div>/)[1];
    
    return { professorName, subject, stars, review };
  } catch (error) {
    console.error('Error extracting data from URL:', error);
    throw new Error('Failed to extract data from the URL');
  }
};

export async function POST(req) {
  try {
    const data = await req.json();

    // Initialize Pinecone and OpenAI clients
    const pc = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
    const index = pc.index('rag').namespace('ns1');
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    let resultString = '';
    const lastMessage = data[data.length - 1];
    const url = lastMessage.content; // Assuming URL is in the last message content

    if (url.startsWith('https://www.ratemyprofessors.com/')) {
      // Extract data from URL
      const { professorName, subject, stars, review } = await extractProfessorDataFromUrl(url);

      resultString = `
        - **Professor Name**: ${professorName}
          - **Subject**: ${subject}
          - **Stars**: ${stars}
          - **Review**: ${review}
        \n\n`;
    } else {
      // Handle text queries as before
      const text = lastMessage.content;
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float',
      });
      const embedding = embeddingResponse.data[0].embedding;

      // Query Pinecone index
      const results = await index.query({
        topK: 5,
        includeMetadata: true,
        vector: embedding,
      });

      results.matches.forEach((match) => {
        resultString += 
        `Returned Results:
        Professor: ${match.id}
        Review: ${match.metadata.review}
        Subject: ${match.metadata.subject}
        Stars: ${match.metadata.stars}
        \n\n`;
      });
    }

    // Prepare completion request
    const lastMessageContent = (url.startsWith('https://www.ratemyprofessors.com/') ? resultString : lastMessage.content + resultString);
    const lastDataWithoutLastMessage = data.slice(0, data.length - 1);

    const completion = await openai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        ...lastDataWithoutLastMessage,
        { role: 'user', content: lastMessageContent },
      ],
      model: 'gpt-3.5-turbo',
      stream: true,
    });

    // Create and return stream response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              const text = encoder.encode(content);
              controller.enqueue(text);
            }
          }
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(stream);

  } catch (error) {
    console.error('Error in POST handler:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}