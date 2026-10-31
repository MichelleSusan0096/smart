import React, { useState } from 'react';
import axios from 'axios';
import './Auth.css';

function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
      const data = isLogin 
        ? { email, password }
        : { email, password, company };

      const response = await axios.post(endpoint, data);
      onLogin(response.data.token, response.data.userId);
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Smart Analyzer</h1>
          <p className="tagline">AI-Powered Resume Analysis & Matching</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <h2>{isLogin ? 'Sign In' : 'Create Account'}</h2>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {!isLogin && (
            <input
              type="text"
              placeholder="Company Name"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              required
            />
          )}

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <div className="error">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div className="auth-toggle">
          {isLogin ? (
            <>
              Don't have an account? <button onClick={() => setIsLogin(false)}>Sign Up</button>
            </>
          ) : (
            <>
              Already have an account? <button onClick={() => setIsLogin(true)}>Sign In</button>
            </>
          )}
        </div>

        <div className="features">
          <h3>Smart Analyzer Features</h3>
          <ul>
            <li>✓ Evidence-Linked Skill Matching</li>
            <li>✓ Intelligent Skill-Gap Mapping</li>
            <li>✓ Explainable & Adaptive Scoring</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Auth;
