import { db } from './database.js';
import { generateEmbedding } from '../services/ai.service.js';

// Realistic tech openings matching the Moroccan ecosystem
const mockJobs = [
  {
    title: 'Full Stack TypeScript Engineer',
    company: 'Casablanca Nearshore Solutions',
    location: 'Casablanca',
    description: 'Looking for a Senior Full Stack Developer proficient in React, Next.js, Node.js, and PostgreSQL. Experience building strongly-typed systems with TypeScript, optimizing database connection pools, and building scalable cloud microservices is highly required.'
  },
  {
    title: 'DevOps & Cloud Infrastructure Specialist',
    company: 'Rabat Tech Hub Corp',
    location: 'Rabat',
    description: 'Seeking a cloud architect specialized in Docker, Kubernetes, AWS, and CI/CD automation pipelines. Responsible for provisioning secure infrastructure platforms, managing relational databases, configuring CORS, and enforcing network-level rate limiting.'
  },
  {
    title: 'Data Engineer & AI Pipeline Specialist',
    company: 'Marrakesh Digital Insights',
    location: 'Marrakesh',
    description: 'We are expanding our artificial intelligence track. Seeking an engineer skilled in Python, SQL, data pipelines, Vector Databases, embeddings generation, and RAG systems architecture. Experience fine-tuning prompts for structured JSON outputs is preferred.'
  },
  {
    title: 'Junior Front-End UI Developer',
    company: 'Tangier Fintech Accelerator',
    location: 'Tangier',
    description: 'Join our product interface team. Requirements include crisp UI development using React, Tailwind CSS, structural state management, handling complex multi-part form data uploads, and implementing intuitive design systems with elegant loading/error states.'
  }
];

async function seedMarketplace() {
  console.log('🚀 [Seed Engine] Starting Moroccan Tech Jobs vector initialization...');
  
  try {
    // 1. Wipe out old mock listings to prevent database pollution
    await db.query('TRUNCATE TABLE job_postings CASCADE;');
    console.log('🧹 Old job records cleared.');

    // 2. Loop through positions sequentially to stay well within Gemini's free-tier requests-per-minute (RPM) constraints
    for (const job of mockJobs) {
      console.log(`⏳ [Vectorization] Processing embedding for: ${job.title} at ${job.company}...`);
      
      // Synthesize an optimal description context wrapper for vector balancing
      const synthesisInput = `Job Title: ${job.title}. Location: ${job.location}. Company Context: ${job.company}. Job Summary: ${job.description}`;
      
      // Call our updated, verified vector service
      const vectorArray = await generateEmbedding(synthesisInput);
      const pgVectorString = `[${vectorArray.join(',')}]`;

      // 3. Commit the row along with its explicitly cast vector footprint into PostgreSQL
      await db.query(
        `INSERT INTO job_postings (title, company, location, description, embedding)
         VALUES ($1, $2, $3, $4, $5::vector);`,
        [job.title, job.company, job.location, job.description, pgVectorString]
      );
    }

    console.log('✅ [Seed Engine] Marketplace successfully seeded with vectorized tech openings!');
    process.exit(0);

  } catch (error) {
    console.error('❌ [Seed Engine] Pipeline execution aborted due to error:', error);
    process.exit(1);
  }
}

seedMarketplace();
