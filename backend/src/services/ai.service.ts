import { GoogleGenAI, Type } from '@google/genai';
import { env } from '../config/env.js';

// Initialize the official Google Gen AI client wrapper
const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

/**
 * Service to parse raw CV text into a strict, validated schema using Gemini
 */
export const parseResumeText = async (rawText: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // Production-standard fast, cost-efficient model
      contents: `Analyze the following raw CV text extracted from a tech professional's resume. 
      Extract their core skills, educational background, and professional experience timeline.
      
      Raw CV Text:
      ${rawText}`,
      config: {
        systemInstruction: "You are an expert technical recruiter analyzing tech profiles for the Moroccan job market. Extract structural data accurately. If a field cannot be found, leave it empty or map it logically.",
        // Enforce rigid structural JSON output constraints at the model layer
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fullName: { type: Type.STRING },
            summary: { type: Type.STRING },
            skills: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Technical stack, programming languages, tools, frameworks, and methodologies."
            },
            education: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  degree: { type: Type.STRING },
                  institution: { type: Type.STRING },
                  year: { type: Type.STRING }
                },
                required: ["degree", "institution"]
              }
            },
            experience: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  role: { type: Type.STRING },
                  company: { type: Type.STRING },
                  duration: { type: Type.STRING },
                  description: { type: Type.STRING }
                },
                required: ["role", "company"]
              }
            }
          },
          required: ["fullName", "skills", "education", "experience"]
        }
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Gemini API returned an empty completion response.");
    }

    // Since the SDK guarantees pure JSON formatting, we can parse safely without sanitization strings
    return JSON.parse(responseText);

  } catch (error) {
    console.error("❌ Gemini CV Parsing Engine Failure:", error);
    throw new Error("Failed to process and analyze resume structure via AI pipeline.");
  }
};

/**
 * Service to generate high-fidelity mathematical vector embeddings
 * utilizes Google Gemini's gemini-embedding-001 production framework
 */
export const generateEmbedding = async (text: string): Promise<number[]> => {
  try {
    const cleanText = text.replace(/\s+/g, ' ').trim();

    // 1. Invoke the embedding method
    const response = await ai.models.embedContent({
      model: 'gemini-embedding-001', 
      contents: cleanText,
      config: {
        outputDimensionality: 768
      }
    }) as any; // Cast as any to bypass local SDK typing variations

    // 2. Extract values cleanly using our verified array index path
    if (!response || !response.embeddings || !Array.isArray(response.embeddings) || response.embeddings.length === 0) {
      throw new Error("No mathematical embeddings payload returned from the Google Gen AI API.");
    }

    const firstItem = response.embeddings[0];
    const vector = firstItem.values;

    if (!vector || !Array.isArray(vector)) {
      throw new Error("The returned embedding object structure does not contain a valid array of values.");
    }

    // 3. Confirm target database vector match compatibility
    if (vector.length !== 768) {
      throw new Error(`Unexpected vector length footprint received from API. Expected 768, got: ${vector.length}`);
    }

    return vector;

  } catch (error) {
    console.error("❌ Gemini Embedding Generation Engine Failure:", error);
    throw new Error("Failed to process and calculate mathematical text embedding vector arrays.");
  }
};

/**
 * Service to generate structured cover letters and resume feedback via Gemini Flash
 */
export const generateApplicationMaterials = async (
  jobTitle: string,
  company: string,
  jobDescription: string,
  userStructuredProfile: any
) => {
  try {
    const profileString = JSON.stringify(userStructuredProfile);

    // Call Gemini with structured markdown output instructions
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `
        You are a premier executive recruiter specializing in the Moroccan tech hubs of Casablanca, Rabat, and Tangier. 
        Analyze the candidate's structured profile alongside the job opening metadata to produce high-value application assets.
        
        [JOB DATA]
        Title: ${jobTitle}
        Company: ${company}
        Description: ${jobDescription}

        [CANDIDATE DATA]
        Profile JSON: ${profileString}

        ---
        Please generate two distinct sections in your response. Separated exactly by the delimiter '===SPLIT===':
        
        Section 1: The Cover Letter.
        - Professional, confident, and direct corporate tone.
        - Tailor the candidate's actual top skills to match the job criteria.
        - Max 350 words.
        
        ===SPLIT===
        
        Section 2: CV Optimization Feedback.
        - Provide 3-4 highly actionable bullet points.
        - Detail precisely which missing technical tools, framework alignments, or resume phrasing improvements are needed to pass local ATS screens for this exact position.
      `,
      config: {
        systemInstruction: "You are an AI recruitment asset engine. Output your response cleanly using markdown formatting inside the two split blocks. Do not add intro or wrap text like 'Here is your request'."
      }
    });

    const outputText = response.text;
    if (!outputText || !outputText.includes('===SPLIT===')) {
      throw new Error("The AI model returned an unparseable split output layout.");
    }

    const sections = outputText.split('===SPLIT===');
    
    return {
      coverLetter: sections[0].trim(),
      feedback: sections[1].trim()
    };

  } catch (error) {
    console.error("❌ Gemini Material Generation Pipeline Failure:", error);
    throw new Error("Failed to generate application materials via AI framework.");
  }
};
