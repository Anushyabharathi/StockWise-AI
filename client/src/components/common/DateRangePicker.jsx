import React, { useState } from 'react';
import { getDatePresetRange } from '../../utils/formatters';

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'last7', label: 'Last 7 Days' },
  { id: 'last30', label: 'Last 30 Days' },
  { id: 'thisMonth', label: 'This Month' },
  { id: 'lastMonth', label: 'Last Month' },
  { id: 'all', label: 'All Time' },
  { id: 'custom', label: 'Custom Range' },
];

export function DateRangePicker({ activePreset = 'all', onChangeRange }) {
  const [showCustom, setShowCustom] = useState(activePreset === 'custom');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const handleSelectPreset = (presetId) => {
    if (presetId === 'custom') {
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    const range = getDatePresetRange(presetId);
    onChangeRange({
      preset: presetId,
      startDate: range.startDate,
      endDate: range.endDate,
      label: range.label,
    });
  };

  const handleApplyCustom = (e) => {
    e.preventDefault();
    if (!customStart) return;

    const start = new Date(customStart);
    start.setHours(0, 0, 0, 0);

    let end = new Date();
    if (customEnd) {
      end = new Date(customEnd);
      end.setHours(23, 59, 59, 999);
    }

    onChangeRange({
      preset: 'custom',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      label: `${customStart} to ${customEnd || 'Now'}`,
    });
  };

  return (
    <div className="date-picker-wrapper">
      <div className="date-presets" role="group" aria-label="Select date range">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`date-preset-btn ${activePreset === p.id ? 'preset-active' : ''}`}
            onClick={() => handleSelectPreset(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {showCustom && (
        <form className="custom-range-form" onSubmit={handleApplyCustom}>
          <div className="custom-inputs">
            <label className="date-input-label">
              <span>From:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="date-input"
                required
              />
            </label>
            <label className="date-input-label">
              <span>To:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="date-input"
              />
            </label>
          </div>
          <button type="submit" className="custom-apply-btn">
            Apply
          </button>
        </form>
      )}
    </div>
  );
}
