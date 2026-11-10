import React, { useState, useEffect, useRef } from 'react';
import { getAiExecutiveBriefing, askAiAssistant } from '../../api/client';
import { LoadingSpinner } from '../common/LoadingSpinner';

const SUGGESTED_QUESTIONS = [
  'Which products should I restock first and what will it cost?',
  'How is my gross profit margin performing against wholesale costs?',
  'What are my top 5 best sellers and their margins?',
  'Which day of the week generates highest customer checkouts?',
  'Are there any slow-moving products I should discount or bundle?',
];

function getNowFormatted() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Enterprise Power BI / Tableau style AI Advisor Modal.
 *
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   dateRange: { startDate: string|null, endDate: string|null, preset?: string },
 *   admin?: Object|null
 * }} props
 */
export function BiAiAdvisorModal({ isOpen, onClose, dateRange, admin }) {
  const [activeTab, setActiveTab] = useState('briefing'); // 'briefing' | 'chat'

  // Executive Briefing State
  const [briefing, setBriefing] = useState(null);
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [briefingError, setBriefingError] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Chat State
  const [messages, setMessages] = useState(() => [
    {
      role: 'assistant',
      content: `👋 Hello ${admin?.fullName || 'Store Owner'}! I am **StockWise AI**, your Chief Retail Analyst.\n\nAsk me anything about your revenue, wholesale item costs, gross margins, inventory deficits, or weekday customer footfall!`,
      timestamp: getNowFormatted(),
    },
  ]);
  const [questionInput, setQuestionInput] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const messagesEndRef = useRef(null);

  // Fetch AI briefing when modal is opened or date range changes
  useEffect(() => {
    if (!isOpen) return;

    let ignore = false;

    setIsBriefingLoading(true);
    setBriefingError(null);
    getAiExecutiveBriefing({
      startDate: dateRange?.startDate,
      endDate: dateRange?.endDate,
    })
      .then((res) => {
        if (!ignore) setBriefing(res);
      })
      .catch((err) => {
        if (!ignore) setBriefingError(err.message || 'Failed to generate briefing.');
      })
      .finally(() => {
        if (!ignore) setIsBriefingLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [isOpen, dateRange?.startDate, dateRange?.endDate]);

  // Scroll to bottom of chat on new message
  useEffect(() => {
    if (activeTab === 'chat' && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  if (!isOpen) return null;

  const handleRefreshBriefing = async () => {
    setIsBriefingLoading(true);
    setBriefingError(null);
    try {
      const res = await getAiExecutiveBriefing({
        startDate: dateRange?.startDate,
        endDate: dateRange?.endDate,
      });
      setBriefing(res);
    } catch (err) {
      setBriefingError(err.message || 'Failed to generate briefing.');
    } finally {
      setIsBriefingLoading(false);
    }
  };

  const handleSendMessage = async (textToSend) => {
    const q = (textToSend || questionInput).trim();
    if (!q || isAsking) return;

    setQuestionInput('');
    const now = getNowFormatted();
    const userMsg = { role: 'user', content: q, timestamp: now };
    setMessages((prev) => [...prev, userMsg]);
    setIsAsking(true);

    try {
      const history = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await askAiAssistant({
        question: q,
        conversationHistory: history,
        startDate: dateRange?.startDate,
        endDate: dateRange?.endDate,
      });

      const aiReply = {
        role: 'assistant',
        content: res?.answer || 'No response generated from database records.',
        engine: res?.engine,
        notice: res?.notice,
        timestamp: getNowFormatted(),
      };
      setMessages((prev) => [...prev, aiReply]);
    } catch (err) {
      const errorReply = {
        role: 'assistant',
        content: `⚠️ Failed to query AI Advisor: ${err.message}. Please verify the Express backend is running.`,
        isError: true,
        timestamp: getNowFormatted(),
      };
      setMessages((prev) => [...prev, errorReply]);
    } finally {
      setIsAsking(false);
    }
  };

  const handleCopyBriefing = () => {
    if (!briefing?.briefing) return;
    navigator.clipboard.writeText(briefing.briefing);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  // Simple Markdown renderer helper for clean display
  const renderFormattedMarkdown = (markdownText) => {
    if (!markdownText) return null;

    const lines = markdownText.split('\n');
    return (
      <div className="ai-markdown-content">
        {lines.map((line, idx) => {
          const trimmed = line.trim();

          if (trimmed.startsWith('# ')) {
            return (
              <h2 key={idx} className="ai-md-h1">
                {trimmed.slice(2)}
              </h2>
            );
          }
          if (trimmed.startsWith('### ')) {
            return (
              <h3 key={idx} className="ai-md-h3">
                {trimmed.slice(4)}
              </h3>
            );
          }
          if (trimmed.startsWith('## ')) {
            return (
              <h3 key={idx} className="ai-md-h2">
                {trimmed.slice(3)}
              </h3>
            );
          }
          if (trimmed.startsWith('---')) {
            return <hr key={idx} className="ai-md-hr" />;
          }
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            const content = trimmed.slice(2);
            return (
              <div key={idx} className="ai-md-bullet">
                <span className="bullet-dot">•</span>
                <span>{renderInlineBold(content)}</span>
              </div>
            );
          }
          if (/^\d+\.\s/.test(trimmed)) {
            const match = trimmed.match(/^(\d+)\.\s(.*)/);
            return (
              <div key={idx} className="ai-md-numbered">
                <span className="numbered-badge">{match[1]}.</span>
                <span>{renderInlineBold(match[2])}</span>
              </div>
            );
          }
          if (trimmed.startsWith('*') && trimmed.endsWith('*')) {
            return (
              <p key={idx} className="ai-md-italic">
                {trimmed.slice(1, -1)}
              </p>
            );
          }
          if (trimmed === '') {
            return <div key={idx} className="ai-md-spacer" />;
          }
          return (
            <p key={idx} className="ai-md-p">
              {renderInlineBold(line)}
            </p>
          );
        })}
      </div>
    );
  };

  const renderInlineBold = (text) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="ai-bold-text">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card bi-ai-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header bi-ai-header">
          <div className="ai-header-left">
            <div className="ai-header-icon-glow">✨</div>
            <div>
              <div className="ai-title-row">
                <h3 className="modal-title">StockWise AI Advisor</h3>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close AI Advisor"
          >
            &times;
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="bi-ai-tabs-bar">
          <button
            type="button"
            className={`bi-ai-tab-btn ${activeTab === 'briefing' ? 'active' : ''}`}
            onClick={() => setActiveTab('briefing')}
          >
            📋 Executive AI Briefing
          </button>
          <button
            type="button"
            className={`bi-ai-tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            💬 Ask StockWise AI ({messages.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body bi-ai-body">
          {/* TAB 1: EXECUTIVE BRIEFING */}
          {activeTab === 'briefing' && (
            <div className="ai-tab-content ai-briefing-pane">
              {/* Controls bar */}
              <div className="ai-briefing-controls">
                <div className="briefing-info-left">
                  <span className="filter-chip">
                    📅 Timeframe: {dateRange?.preset ? dateRange.preset.toUpperCase() : 'Custom Window'}
                  </span>
                  {briefing?.engine && (
                    <span className="engine-chip">
                      Engine: {briefing.engine === 'claude-3-5-sonnet' ? 'StockWise AI Neural Engine' : 'StockWise Retail Engine'}
                    </span>
                  )}
                </div>

                <div className="briefing-actions-right">
                  <button
                    type="button"
                    className="ai-btn-copy"
                    onClick={handleCopyBriefing}
                    disabled={!briefing?.briefing}
                    title="Copy briefing to clipboard"
                  >
                    {copySuccess ? '✓ Copied!' : '📋 Copy Report'}
                  </button>
                  <button
                    type="button"
                    className="ai-btn-refresh"
                    onClick={handleRefreshBriefing}
                    disabled={isBriefingLoading}
                  >
                    {isBriefingLoading ? 'Analyzing Store Data...' : '🔄 Refresh AI Briefing'}
                  </button>
                </div>
              </div>

              {briefing?.notice && (
                <div className="ai-notice-banner">
                  <span className="notice-icon">💡</span>
                  <span className="notice-text">{briefing.notice}</span>
                </div>
              )}

              {isBriefingLoading ? (
                <div className="ai-loading-container">
                  <LoadingSpinner message="AI Advisor is reading live sales ledgers, calculating wholesale COGS, and evaluating warehouse replenishment..." />
                </div>
              ) : briefingError ? (
                <div className="ai-error-banner">
                  <span className="error-icon">⚠️</span>
                  <span>{briefingError}</span>
                  <button type="button" className="btn-retry-ai" onClick={handleRefreshBriefing}>
                    Try Again
                  </button>
                </div>
              ) : briefing?.briefing ? (
                <div className="ai-briefing-display">
                  {renderFormattedMarkdown(briefing.briefing)}
                </div>
              ) : (
                <div className="ai-empty-prompt">
                  <p>Click "Refresh AI Briefing" to generate an executive report.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: INTERACTIVE CHAT */}
          {activeTab === 'chat' && (
            <div className="ai-tab-content ai-chat-pane">
              {/* Messages scroll area */}
              <div className="ai-chat-messages">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`ai-message-bubble ${m.role === 'user' ? 'message-user' : 'message-assistant'} ${
                      m.isError ? 'message-error' : ''
                    }`}
                  >
                    <div className="message-header">
                      <span className="message-sender">
                        {m.role === 'user' ? `👤 ${admin?.username || 'Owner'}` : '✨ StockWise AI'}
                      </span>
                      <span className="message-time">{m.timestamp}</span>
                    </div>

                    <div className="message-body">
                      {m.role === 'user' ? (
                        <p>{m.content}</p>
                      ) : (
                        renderFormattedMarkdown(m.content)
                      )}
                    </div>

                    {m.notice && (
                      <div className="message-notice-footnote">
                        <small>{m.notice}</small>
                      </div>
                    )}
                  </div>
                ))}

                {isAsking && (
                  <div className="ai-message-bubble message-assistant message-loading">
                    <div className="typing-indicator">
                      <span className="dot" />
                      <span className="dot" />
                      <span className="dot" />
                    </div>
                    <span className="typing-text">Analyzing live store metrics...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick suggestion prompt chips */}
              <div className="ai-suggestion-chips-container">
                <span className="suggestion-label">Suggested Questions:</span>
                <div className="chips-scroll">
                  {SUGGESTED_QUESTIONS.map((sq, i) => (
                    <button
                      key={i}
                      type="button"
                      className="ai-chip-btn"
                      onClick={() => handleSendMessage(sq)}
                      disabled={isAsking}
                    >
                      {sq}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input bar */}
              <form
                className="ai-chat-input-bar"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
              >
                <input
                  type="text"
                  className="ai-input-field"
                  placeholder="Ask any question about your store sales, inventory, or margins..."
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  disabled={isAsking}
                />
                <button
                  type="submit"
                  className="ai-btn-send"
                  disabled={isAsking || !questionInput.trim()}
                >
                  {isAsking ? '...' : 'Ask AI →'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
