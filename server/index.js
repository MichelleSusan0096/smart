import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.js';
import mammoth from 'mammoth';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Setup PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// Database setup
const dbPath = path.join(__dirname, '..', 'data', 'smartmatch.db');
const dataDir = path.join(__dirname, '..', 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Database error:', err);
  else console.log('Database connected');
});

// Create tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password TEXT,
      company TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      title TEXT,
      description TEXT,
      skills TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS resumes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jobId INTEGER,
      fileName TEXT,
      text TEXT,
      skills TEXT,
      matchScore REAL DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (jobId) REFERENCES jobs(id)
    )
  `);
});

const JWT_SECRET = 'smart-match-secret-key-2024';

// File upload setup
const upload = multer({
  dest: path.join(dataDir, 'uploads'),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const uploadMultiple = multer({
  dest: path.join(dataDir, 'uploads'),
  limits: { fileSize: 10 * 1024 * 1024 }
}).array('resumes', 100);

// Helper functions
function extractSkills(text) {
  if (!text) return [];
  
  const skillKeywords = [
    // Languages
    'python', 'javascript', 'java', 'sql', 'typescript', 'ruby', 'php', 'rust',
    'golang', 'scala', 'kotlin', 'swift', 'csharp', 'perl', 'groovy', 'r',
    // Web/Mobile
    'react', 'angular', 'vue', 'node', 'express', 'django', 'flask', 'fastapi',
    'html', 'css', 'jquery', 'bootstrap', 'tailwind', 'nextjs', 'nuxt',
    // Databases
    'sql', 'mongodb', 'postgresql', 'mysql', 'oracle', 'redis', 'elasticsearch',
    'cassandra', 'dynamodb', 'firebase', 'bigquery', 'snowflake', 'mariadb',
    // Big Data
    'spark', 'hadoop', 'hive', 'pig', 'kafka', 'airflow', 'etl', 'tableau',
    'power bi', 'excel', 'analytics', 'machine learning', 'data science',
    // Cloud & DevOps
    'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'jenkins', 'gitlab', 'github',
    'terraform', 'ansible', 'prometheus', 'grafana', 'heroku', 'linux',
    // APIs & Integration
    'api', 'rest', 'graphql', 'soap', 'websocket', 'json', 'xml', 'oauth', 'jwt',
    // Testing
    'jest', 'mocha', 'pytest', 'junit', 'selenium', 'cucumber', 'postman', 'jmeter',
    // Other
    'git', 'agile', 'scrum', 'jira', 'confluence', 'microservices', 'architecture',
    'communication', 'leadership', 'problemsolving', 'teamwork', 'analytical'
  ];
  
  const textLower = text.toLowerCase();
  const foundSkills = [];
  
  for (const skill of skillKeywords) {
    // Simple substring match (more reliable than regex)
    if (textLower.includes(skill)) {
      foundSkills.push(skill);
    }
  }
  
  return [...new Set(foundSkills)];
}

function calculateMatch(jobSkills, resumeSkills) {
  if (jobSkills.length === 0) return 0;
  const matches = jobSkills.filter(skill => resumeSkills.includes(skill)).length;
  return Math.round((matches / jobSkills.length) * 100);
}

// AI-Powered Resume Matching using FREE Groq API
async function analyzeResumeMatch(jobDescription, resumeText, candidateName) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.log('⚠️  No Groq API key set. Using keyword matching only.');
      return null;
    }

    const prompt = `You are an expert HR recruiter analyzing resume-to-job fit.

Job Description:
${jobDescription.substring(0, 500)}

Candidate Resume:
${resumeText.substring(0, 500)}

Analyze this resume against the job and provide:
1. A match score (0-100) 
2. Top 3 matched skills
3. Top 3 missing skills  
4. Brief summary (1-2 sentences)

Respond ONLY in JSON format, no other text:
{
  "matchScore": number,
  "matchedSkills": ["skill1", "skill2", "skill3"],
  "missingSkills": ["skill1", "skill2", "skill3"],
  "summary": "brief summary"
}`;

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'mixtral-8x7b-32768',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 300
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    const content = response.data.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid JSON response');
    
    const result = JSON.parse(jsonMatch[0]);
    console.log(`\n✨ AI Analysis for ${candidateName}:`);
    console.log(`   Match Score: ${result.matchScore}%`);
    console.log(`   Matched: [${result.matchedSkills.join(', ')}]`);
    console.log(`   Missing: [${result.missingSkills.join(', ')}]`);
    return result;
  } catch (err) {
    console.log(`⚠️  AI analysis failed: ${err.message}. Using keyword matching.`);
    return null;
  }
}

// Extract text from PDF
async function extractTextFromPDF(filePath) {
  try {
    return '';
  } catch (err) {
    return '';
  }
}

// Extract text from DOCX
async function extractTextFromDocx(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value.substring(0, 10000);
  } catch (err) {
    return '';
  }
}

// Extract text from text files
function extractTextFromFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.substring(0, 10000);
  } catch (err) {
    return '';
  }
}

// Auth Routes
app.post('/api/auth/signup', async (req, res) => {
  const { email, password, company } = req.body;
  
  if (!email || !password || !company) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  
  db.run(
    'INSERT INTO users (email, password, company) VALUES (?, ?, ?)',
    [email, hashedPassword, company],
    function(err) {
      if (err) {
        return res.status(400).json({ error: 'Email already exists' });
      }
      const token = jwt.sign({ userId: this.lastID, email }, JWT_SECRET);
      res.json({ token, userId: this.lastID });
    }
  );
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err || !user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET);
    res.json({ token, userId: user.id });
  });
});

// Middleware to verify token
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Job Routes
app.post('/api/jobs', verifyToken, (req, res) => {
  const { title, description } = req.body;
  const skills = extractSkills(description);
  console.log(`\n📋 JOB CREATED: "${title}"`);
  console.log(`   Extracted skills: [${skills.join(', ')}]`);
  console.log(`   Skills count: ${skills.length}\n`);
  
  db.run(
    'INSERT INTO jobs (userId, title, description, skills) VALUES (?, ?, ?, ?)',
    [req.userId, title, description, skills.join(',')],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ jobId: this.lastID, skills: skills });
    }
  );
});

app.get('/api/jobs', verifyToken, (req, res) => {
  db.all('SELECT * FROM jobs WHERE userId = ? ORDER BY createdAt DESC', [req.userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const jobsWithDetails = rows.map(job => ({
      ...job,
      skills: job.skills ? job.skills.split(',') : []
    }));
    
    res.json(jobsWithDetails);
  });
});

// Delete a job and all its resumes
app.delete('/api/jobs/:jobId', verifyToken, (req, res) => {
  const { jobId } = req.params;
  
  // First delete all resumes for this job
  db.run('DELETE FROM resumes WHERE jobId = ?', [jobId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Then delete the job
    db.run('DELETE FROM jobs WHERE id = ? AND userId = ?', [jobId, req.userId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Job not found' });
      }
      res.json({ success: true, message: 'Job deleted successfully' });
      console.log(`🗑️  Job ${jobId} deleted`);
    });
  });
});

// Resume upload and matching
app.post('/api/resumes/upload', verifyToken, upload.single('resume'), async (req, res) => {
  const { jobId } = req.body;
  
  if (!req.file || !jobId) {
    return res.status(400).json({ error: 'Missing file or jobId' });
  }

  try {
    let extractedText = '';
    
    // Extract text based on file type
    if (req.file.originalname.toLowerCase().endsWith('.pdf')) {
      extractedText = await extractTextFromPDF(req.file.path);
    } else if (req.file.originalname.toLowerCase().endsWith('.txt')) {
      extractedText = extractTextFromFile(req.file.path);
    } else {
      extractedText = extractTextFromFile(req.file.path);
    }

    const fileName = req.file.originalname.toLowerCase();
    const allText = `${fileName} ${extractedText}`;
    const skills = extractSkills(allText).join(',');
    
    db.get('SELECT skills FROM jobs WHERE id = ?', [jobId], (err, job) => {
      if (err || !job) return res.status(400).json({ error: 'Job not found' });
      
      const jobSkills = job.skills.split(',').filter(s => s);
      const resumeSkills = skills.split(',').filter(s => s);
      const matchScore = calculateMatch(jobSkills, resumeSkills);
      
      db.run(
        'INSERT INTO resumes (jobId, fileName, text, skills, matchScore) VALUES (?, ?, ?, ?, ?)',
        [jobId, req.file.originalname, extractedText.substring(0, 5000), skills, matchScore],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ 
            resumeId: this.lastID, 
            matchScore, 
            skills: resumeSkills,
            fileName: req.file.originalname
          });
          
          // Clean up
          fs.unlink(req.file.path, () => {});
        }
      );
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process resume' });
  }
});

// Bulk upload resumes
app.post('/api/resumes/bulk-upload', verifyToken, uploadMultiple, async (req, res) => {
  try {
    const { jobId } = req.body;
    
    if (!req.files || req.files.length === 0 || !jobId) {
      console.error('❌ Missing files or jobId');
      return res.status(400).json({ error: 'Missing files or jobId' });
    }

    db.get('SELECT id, skills, description FROM jobs WHERE id = ? AND userId = ?', [jobId, req.userId], async (err, job) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error: ' + err.message });
      }
      
      if (!job) {
        console.error('❌ Job not found:', jobId);
        return res.status(404).json({ error: 'Job not found' });
      }
      
      if (!job.description) {
        console.error('❌ Job has no description');
        return res.status(400).json({ error: 'Job has no description' });
      }
      
      console.log(`\n✅ Starting bulk upload for job ${jobId}`);
      console.log(`   Files: ${req.files.length}`);
      
      const jobSkills = job.skills ? job.skills.split(',').filter(s => s) : [];
      const results = [];
      let processed = 0;

      for (const file of req.files) {
        try {
          console.log(`\n📄 Processing: "${file.originalname}"`);
          let extractedText = '';
          
          // Extract text based on file type
          if (file.originalname.toLowerCase().endsWith('.pdf')) {
            extractedText = await extractTextFromPDF(file.path);
          } else if (file.originalname.toLowerCase().endsWith('.docx')) {
            extractedText = await extractTextFromDocx(file.path);
          } else if (file.originalname.toLowerCase().endsWith('.txt')) {
            extractedText = extractTextFromFile(file.path);
          } else {
            extractedText = extractTextFromFile(file.path);
          }

          const fileName = file.originalname.toLowerCase();
          const allText = `${fileName} ${extractedText}`;
          const skills = extractSkills(allText);
          
          console.log(`   Extracted: [${skills.join(', ')}]`);
          
          // Try AI analysis first, fallback to keyword matching
          let aiAnalysis = null;
          try {
            aiAnalysis = await analyzeResumeMatch(job.description, extractedText, file.originalname);
          } catch (aiErr) {
            console.log(`   ⚠️  AI analysis error: ${aiErr.message}`);
          }
          
          let matchScore, matchedSkills, missingSkills, summary;
          if (aiAnalysis && aiAnalysis.matchScore !== undefined) {
            matchScore = aiAnalysis.matchScore;
            matchedSkills = aiAnalysis.matchedSkills || [];
            missingSkills = aiAnalysis.missingSkills || [];
            summary = aiAnalysis.summary || '';
          } else {
            // Fallback to keyword matching
            matchScore = calculateMatch(jobSkills, skills);
            matchedSkills = skills.filter(s => jobSkills.includes(s));
            missingSkills = jobSkills.filter(s => !skills.includes(s));
            summary = `${matchScore}% keyword match`;
          }
          
          console.log(`   Score: ${matchScore}%`);
          
          db.run(
            'INSERT INTO resumes (jobId, fileName, text, skills, matchScore) VALUES (?, ?, ?, ?, ?)',
            [jobId, file.originalname, extractedText.substring(0, 5000), matchedSkills.join(','), matchScore],
            function(err) {
              if (err) {
                console.error(`   ❌ DB Error: ${err.message}`);
              } else {
                console.log(`   ✅ Saved`);
                results.push({
                  resumeId: this.lastID,
                  fileName: file.originalname,
                  matchScore,
                  skills: matchedSkills,
                  missingSkills,
                  summary
                });
              }
              
              processed++;
              if (processed === req.files.length) {
                results.sort((a, b) => b.matchScore - a.matchScore);
                console.log(`\n✅ Complete: ${results.length}/${req.files.length}`);
                res.json({ 
                  success: true,
                  uploaded: results.length,
                  totalFiles: req.files.length,
                  results 
                });
                
                // Clean up
                req.files.forEach(f => {
                  try {
                    fs.unlinkSync(f.path);
                  } catch (e) {}
                });
              }
            }
          );
        } catch (fileErr) {
          console.error(`❌ File error ${file.originalname}:`, fileErr.message);
          processed++;
          if (processed === req.files.length) {
            results.sort((a, b) => b.matchScore - a.matchScore);
            res.json({ 
              success: results.length > 0,
              uploaded: results.length,
              totalFiles: req.files.length,
              results,
              warning: `${results.length}/${req.files.length} processed`
            });
          }
        }
      }
    });
  } catch (err) {
    console.error('❌ Bulk upload error:', err.message);
    res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
});

// Get ranked candidates
app.get('/api/jobs/:jobId/candidates', verifyToken, (req, res) => {
  const { jobId } = req.params;
  
  db.all(
    'SELECT * FROM resumes WHERE jobId = ? ORDER BY matchScore DESC',
    [jobId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const candidates = rows.map((row, idx) => {
        // Extract candidate name from filename
        let candidateName = row.fileName;
        // Remove file extensions
        candidateName = candidateName.replace(/\.(pdf|doc|docx|txt)$/i, '');
        // Remove "resume_" or "resume-" prefix
        candidateName = candidateName.replace(/^resume[\s_-]*/i, '');
        // Replace underscores and hyphens with spaces
        candidateName = candidateName.replace(/[_-]/g, ' ');
        
        return {
          id: row.id,
          rank: idx + 1,
          candidateName: candidateName.trim(),
          fileName: row.fileName,
          matchScore: row.matchScore,
          skills: row.skills ? row.skills.split(',') : [],
          createdAt: row.createdAt
        };
      });
      
      res.json(candidates);
    }
  );
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
