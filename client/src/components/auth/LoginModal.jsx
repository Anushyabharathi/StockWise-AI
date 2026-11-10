import React, { useState, useEffect } from 'react';
import { loginAdmin } from '../../api/client';

/**
 * Shop Admin Secure Login Modal.
 *
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   onLoginSuccess: (admin: Object) => void
 * }} props
 */
export function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await loginAdmin({ username, password });
      if (res?.admin) {
        onLoginSuccess(res.admin);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = () => {
    setUsername('admin');
    setPassword('AdminPassword123!');
    setError(null);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container login-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-badge">SHOP ADMINISTRATION</span>
            <h2 id="login-modal-title" className="modal-title">
              Shop Admin Login
            </h2>
            <p className="modal-subtitle">
              Sign in to manage warehouse inventory, download sales records, and view system audit logs.
            </p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close login dialog"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="modal-body">
            {error && (
              <div className="banner-alert banner-alert-danger" style={{ marginBottom: '16px' }}>
                <span>⚠️ {error}</span>
              </div>
            )}

            {/* Quick Demo Credentials Hint */}
            <div className="demo-credentials-box">
              <div className="demo-info">
                <strong>Default Administrator Account:</strong>
                <span>Username: <code>admin</code> | Password: <code>AdminPassword123!</code></span>
              </div>
              <button
                type="button"
                className="btn-quick-fill"
                onClick={handleQuickFill}
                title="Fill default admin credentials automatically"
              >
                Auto-Fill Demo Credentials
              </button>
            </div>

            <div className="form-group">
              <label htmlFor="login-username" className="form-label">
                Username or Email
              </label>
              <input
                id="login-username"
                type="text"
                className="form-input"
                placeholder="e.g. admin or admin@stockwise.ai"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <div className="form-label-row">
                <label htmlFor="login-password" className="form-label">
                  Password
                </label>
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="Enter admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="login-security-notice">
              <span className="security-icon">🔒</span>
              <span>All authentication sessions and activities are cryptographically verified and logged securely.</span>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading || !username || !password}
            >
              {isLoading ? 'Signing In...' : 'Sign In as Admin &rarr;'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
