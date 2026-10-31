# Smart Analyzer - Deployment Guide

## Deploy to Vercel

### Step 1: Create GitHub Repository
```bash
# Go to https://github.com/new
# Create a repository named "smart-analyzer"
# Copy the repository URL
```

### Step 2: Push Code to GitHub
```bash
cd "d:\PROJECT TOOK\smart analyzer"
git remote add origin https://github.com/YOUR_USERNAME/smart-analyzer.git
git branch -M main
git push -u origin main
```

### Step 3: Deploy to Vercel

**Option A: Using Vercel CLI**
```bash
npm install -g vercel
vercel
# Follow the prompts to connect your GitHub repo
```

**Option B: Using Vercel Web Dashboard**
1. Go to https://vercel.com
2. Sign up or login
3. Click "Add New..." → "Project"
4. Select your GitHub repository
5. Configure:
   - **Framework**: Other (Node.js)
   - **Build Command**: `cd client && npm run build`
   - **Output Directory**: `client/dist`
   - **Install Command**: `npm install && cd client && npm install`

### Step 4: Set Environment Variables in Vercel
1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add: `GROQ_API_KEY` = your_groq_key

### Step 5: Deploy
- Vercel will automatically deploy on every push to main
- Your site will be live at: `https://smart-analyzer-RANDOM.vercel.app`

## Database Note
For production, replace SQLite with PostgreSQL or MongoDB:
- Update `server/index.js` to use a cloud database
- Current SQLite will be reset on each deploy (not persistent)

## Files Committed
✅ All source files pushed to Git
✅ .env not included (add to Vercel environment)
✅ node_modules ignored
✅ Ready for deployment!
