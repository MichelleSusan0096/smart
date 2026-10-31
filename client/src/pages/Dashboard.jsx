import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Dashboard.css';

function Dashboard({ token, onLogout }) {
  const [activeTab, setActiveTab] = useState('jobs');
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await axios.get('/api/jobs', { headers });
      setJobs(response.data);
    } catch (err) {
      setError('Failed to load jobs');
    }
  };

  const handleCreateJob = async (e) => {
    e.preventDefault();
    if (!jobTitle || !jobDescription) {
      setError('Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        '/api/jobs',
        { title: jobTitle, description: jobDescription },
        { headers }
      );
      setJobs([{ id: Math.random(), title: jobTitle, description: jobDescription, skills: response.data.skills }, ...jobs]);
      setJobTitle('');
      setJobDescription('');
      setError('');
    } catch (err) {
      setError('Failed to create job');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadResume = async (jobId, files) => {
    if (!files || files.length === 0) return;

    setLoading(true);
    const formData = new FormData();
    
    // Handle both single file and multiple files
    if (files instanceof FileList) {
      for (let file of files) {
        formData.append('resumes', file);
      }
    } else {
      formData.append('resumes', files);
    }
    
    formData.append('jobId', jobId);

    try {
      const endpoint = files.length > 1 ? '/api/resumes/bulk-upload' : '/api/resumes/upload';
      const uploadKey = files.length > 1 ? 'resumes' : 'resume';
      
      const form = new FormData();
      if (files instanceof FileList) {
        for (let file of files) {
          form.append(uploadKey, file);
        }
      } else {
        form.append(uploadKey, files);
      }
      form.append('jobId', jobId);
      
      await axios.post(endpoint, form, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' }
      });
      fetchCandidates(jobId);
      setError('');
    } catch (err) {
      setError('Failed to upload resume(s)');
    } finally {
      setLoading(false);
    }
  };

  const fetchCandidates = async (jobId) => {
    try {
      const response = await axios.get(`/api/jobs/${jobId}/candidates`, { headers });
      setCandidates(response.data);
    } catch (err) {
      setError('Failed to load candidates');
    }
  };

  const handleSelectJob = (job) => {
    setSelectedJob(job);
    fetchCandidates(job.id);
    setActiveTab('candidates');
  };

  const handleDeleteJob = async (jobId) => {
    if (window.confirm('Are you sure you want to delete this job? All resumes will be deleted too.')) {
      try {
        await axios.delete(`/api/jobs/${jobId}`, { headers });
        setJobs(jobs.filter(job => job.id !== jobId));
        setError('');
      } catch (err) {
        setError('Failed to delete job');
      }
    }
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Smart Analyzer</h1>
          <button className="logout-btn" onClick={onLogout}>Logout</button>
        </div>
      </header>

      <div className="dashboard-container">
        <nav className="dashboard-nav">
          <button
            className={`nav-btn ${activeTab === 'jobs' ? 'active' : ''}`}
            onClick={() => setActiveTab('jobs')}
          >
            📋 Jobs
          </button>
          <button
            className={`nav-btn ${activeTab === 'candidates' ? 'active' : ''}`}
            onClick={() => setActiveTab('candidates')}
            disabled={!selectedJob}
          >
            👥 Candidates
          </button>
          <button
            className={`nav-btn ${activeTab === 'analyzer' ? 'active' : ''}`}
            onClick={() => setActiveTab('analyzer')}
            disabled={!selectedJob || candidates.length === 0}
          >
            🔍 Analyzer
          </button>
        </nav>

        <main className="dashboard-content">
          {error && <div className="error-banner">{error}</div>}

          {activeTab === 'jobs' && (
            <div className="jobs-section">
              <div className="create-job-card">
                <h2>Post a New Job</h2>
                <form onSubmit={handleCreateJob} className="job-form">
                  <input
                    type="text"
                    placeholder="Job Title"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    required
                  />
                  <textarea
                    placeholder="Job Description (Include key skills, responsibilities, requirements)"
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    rows="6"
                    required
                  />
                  <button type="submit" disabled={loading}>
                    {loading ? 'Creating...' : 'Create Job'}
                  </button>
                </form>
              </div>

              <div className="jobs-list">
                <h2>Your Jobs ({jobs.length})</h2>
                {jobs.length === 0 ? (
                  <p className="empty-state">No jobs posted yet. Create one above!</p>
                ) : (
                  jobs.map((job) => (
                    <div key={job.id} className="job-card">
                      <h3>{job.title}</h3>
                      <p className="job-desc">{job.description.substring(0, 100)}...</p>
                      <div className="job-skills">
                        {(job.skills || []).slice(0, 3).map((skill) => (
                          <span key={skill} className="skill-tag">{skill}</span>
                        ))}
                      </div>
                      <div className="job-actions">
                        <button
                          className="view-candidates-btn"
                          onClick={() => handleSelectJob(job)}
                        >
                          View & Upload Resumes
                        </button>
                        <button
                          className="delete-job-btn"
                          onClick={() => handleDeleteJob(job.id)}
                          title="Delete this job"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'candidates' && selectedJob && (
            <div className="candidates-section">
              <div className="job-header">
                <h2>{selectedJob.title}</h2>
                <span className="back-btn" onClick={() => { setActiveTab('jobs'); setSelectedJob(null); }}>← Back</span>
              </div>

              <div className="upload-section">
                <h3>Upload Resumes (Bulk Upload Supported)</h3>
                <p className="upload-hint">Select one or multiple resume files (30-60 at once)</p>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  multiple
                  onChange={(e) => {
                    if (e.target.files.length > 0) {
                      handleUploadResume(selectedJob.id, e.target.files);
                    }
                  }}
                />
              </div>

              <div className="candidates-list">
                <h3>Ranked Candidates</h3>
                {candidates.length === 0 ? (
                  <p className="empty-state">No resumes uploaded yet.</p>
                ) : (
                  <div className="candidates-table">
                    <div className="table-header">
                      <div className="col-rank">Rank</div>
                      <div className="col-name">Candidate</div>
                      <div className="col-score">Match Score</div>
                    </div>
                    {candidates.map((candidate) => (
                      <div key={candidate.id} className="table-row">
                        <div className="col-rank">
                          <span className="rank-badge">#{candidate.rank}</span>
                        </div>
                        <div className="col-name">{candidate.candidateName}</div>
                        <div className="col-score">
                          <div className="score-bar">
                            <div className="score-fill" style={{ width: `${candidate.matchScore}%` }}></div>
                          </div>
                          <span className="score-value">{candidate.matchScore}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'analyzer' && selectedJob && candidates.length > 0 && (
            <div className="analyzer-section">
              <div className="job-header">
                <h2>Detailed Analysis - {selectedJob.title}</h2>
                <span className="back-btn" onClick={() => { setActiveTab('candidates'); setSelectedCandidate(null); }}>← Back to Candidates</span>
              </div>

              <div className="job-analysis">
                <h3>Job Description Analysis</h3>
                <div className="jd-box">
                  <p className="jd-title">Required Skills:</p>
                  <div className="skills-display">
                    {(selectedJob.skills || []).map((skill) => (
                      <span key={skill} className="required-skill">{skill}</span>
                    ))}
                  </div>
                  <p className="jd-content"><strong>Description:</strong></p>
                  <p className="jd-description">{selectedJob.description}</p>
                </div>
              </div>

              <div className="candidates-analysis-list">
                <h3>Individual Resume Analysis</h3>
                {candidates.map((candidate) => (
                  <div key={candidate.id} className="candidate-analysis-card">
                    <div className="analysis-header">
                      <div className="analysis-left">
                        <h4>#{candidate.rank} - {candidate.candidateName}</h4>
                        <p className="file-name">({candidate.fileName})</p>
                      </div>
                      <div className="analysis-right">
                        <div className="match-score-large">
                          <div className="score-circle">{candidate.matchScore}%</div>
                        </div>
                      </div>
                    </div>

                    <div className="analysis-details">
                      <div className="matched-column">
                        <p className="column-title">✓ Matched Skills</p>
                        {candidate.skills && candidate.skills.length > 0 ? (
                          <div className="skills-display">
                            {candidate.skills.map((skill) => (
                              <span key={skill} className="matched-skill">{skill}</span>
                            ))}
                          </div>
                        ) : (
                          <p className="no-skills">No skills matched</p>
                        )}
                      </div>

                      <div className="missing-column">
                        <p className="column-title">✗ Missing Skills</p>
                        {(selectedJob.skills || []).filter(skill => !candidate.skills.includes(skill)).length > 0 ? (
                          <div className="skills-display">
                            {(selectedJob.skills || []).filter(skill => !candidate.skills.includes(skill)).map((skill) => (
                              <span key={skill} className="missing-skill">{skill}</span>
                            ))}
                          </div>
                        ) : (
                          <p className="no-skills">All skills matched!</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
