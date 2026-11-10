import React, { useState } from 'react';
import { loginAdmin } from '../../api/client';
import { StatusBadge } from '../common/StatusBadge';

/**
 * Full-page Shop Admin Login Gate.
 * The dashboard opens only after a successful login.
 *
 * @param {{
 *   onLoginSuccess: (admin: Object) => void,
 *   health: Object|null
 * }} props
 */
export function LoginPage({ onLoginSuccess, health }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await loginAdmin({ username, password });
      if (res?.admin) {
        onLoginSuccess(res.admin);
      } else {
        setErrorMessage('Login failed. Please check your username and password.');
      }
    } catch (err) {
      setErrorMessage(
        err.message || 'Login failed! Incorrect username or password. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page-wrapper">
      {/* Background ambient decorative shapes */}
      <div className="login-bg-glow glow-1" />
      <div className="login-bg-glow glow-2" />

      <div className="login-card-container">
        {/* Brand header */}
        <div className="login-header">
          <div className="brand-logo-large">
            <span className="brand-icon-large">📈</span>
          </div>
          <h1 className="login-brand-title">StockWise AI</h1>
          <span className="login-brand-tagline">Retail Intelligence & Inventory Analytics</span>
        </div>

        {/* Main login card */}
        <div className="login-box card">
          <div className="login-box-header">
            <h2 className="login-title">Shop Admin Sign In</h2>
          </div>

          {/* Prominent Login Failed Banner */}
          {errorMessage && (
            <div className="login-error-alert" role="alert">
              <span className="error-alert-icon">❌</span>
              <div className="error-alert-content">
                <strong>Login Failed</strong>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="login-page-form">
            <div className="form-group">
              <label htmlFor="admin-username" className="form-label">
                Username or Email
              </label>
              <div className="input-with-icon">
                <span className="input-icon">👤</span>
                <input
                  id="admin-username"
                  type="text"
                  className={`form-input ${errorMessage ? 'input-error' : ''}`}
                  placeholder="e.g. admin or admin@stockwise.ai"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  required
                  autoFocus
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="form-group">
              <div className="form-label-row">
                <label htmlFor="admin-password" className="form-label">
                  Password
                </label>
                <button
                  type="button"
                  className="toggle-password-link"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? 'Hide Password' : 'Show Password'}
                </button>
              </div>
              <div className="input-with-icon">
                <span className="input-icon">🔒</span>
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  className={`form-input ${errorMessage ? 'input-error' : ''}`}
                  placeholder="Enter administrator password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-login-submit"
              disabled={isLoading || !username || !password}
            >
              {isLoading ? (
                <>
                  <span className="spinner-small" /> Verifying Credentials...
                </>
              ) : (
                'Sign In & Open Dashboard →'
              )}
            </button>
          </form>

          {/* Security & Audit Notice */}
          <div className="login-security-footer">
            <span className="security-icon">🛡️</span>
            <span>Audited Session &bull; Encrypted</span>
          </div>
        </div>

        {/* System connectivity status at bottom */}
        <div className="login-footer-status">
          <StatusBadge health={health} />
          <span className="db-engine-text">Enterprise Secure Store</span>
        </div>
      </div>
    </div>
  );
}
