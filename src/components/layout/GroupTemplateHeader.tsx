import React, { useState } from 'react';
import {
  ArrowLeft,
  Sparkles,
  Settings2,
  TreePine,
  CheckCircle2,
  Tag,
} from 'lucide-react';
import type { GroupCategory } from '../../types/group';

interface GroupTemplateHeaderProps {
  name: string;
  nameBn: string;
  category: GroupCategory;
  color: string;
  questionCount: number;
  edgeCount: number;
  onUpdateMetadata: (meta: {
    name: string;
    nameBn: string;
    category: GroupCategory;
    color: string;
    description: string;
  }) => void;
  description: string;
  onAutoLayout: () => void;
  onExit: () => void;
  onSave: () => void;
}

const CATEGORY_OPTIONS: { value: GroupCategory; label: string; color: string }[] = [
  { value: 'kyc', label: 'Farmer KYC', color: '#0284c7' },
  { value: 'land', label: 'Land & Plots', color: '#10b981' },
  { value: 'crop', label: 'Crops & Yield', color: '#f59e0b' },
  { value: 'financial', label: 'Financials', color: '#8b5cf6' },
  { value: 'verification', label: 'Geo-Verification', color: '#ec4899' },
  { value: 'custom', label: 'Custom Domain', color: '#64748b' },
];

export const GroupTemplateHeader: React.FC<GroupTemplateHeaderProps> = ({
  name,
  nameBn,
  category,
  color,
  questionCount,
  edgeCount,
  onUpdateMetadata,
  description,
  onAutoLayout,
  onExit,
  onSave,
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempName, setTempName] = useState(name);
  const [tempNameBn, setTempNameBn] = useState(nameBn);
  const [tempCategory, setTempCategory] = useState(category);
  const [tempColor, setTempColor] = useState(color);
  const [tempDesc, setTempDesc] = useState(description);

  const handleOpenSettings = () => {
    setTempName(name);
    setTempNameBn(nameBn);
    setTempCategory(category);
    setTempColor(color);
    setTempDesc(description);
    setIsSettingsOpen(true);
  };

  const handleSaveSettings = () => {
    onUpdateMetadata({
      name: tempName,
      nameBn: tempNameBn,
      category: tempCategory,
      color: tempColor,
      description: tempDesc,
    });
    setIsSettingsOpen(false);
  };

  return (
    <header className="app-header group-template-header">
      {/* 1. Left: Back/Exit & Group Title */}
      <div className="header-brand">
        <button
          type="button"
          className="header-back-list-btn"
          onClick={onExit}
          title="Exit Group Designer"
        >
          <ArrowLeft size={16} />
          <span>Exit</span>
        </button>

        <div className="brand-titles">
          <div className="brand-name-row">
            <span className="brand-product">{name || 'New Question Group'}</span>
            <span
              className="group-cat-pill-mini"
              style={{
                backgroundColor: `${color}25`,
                color,
                borderColor: `${color}60`,
              }}
            >
              <Tag size={10} />
              <span>{category.toUpperCase()}</span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. Middle: Clean Stats Pill */}
      <div className="header-meta">
        <div className="meta-pill stats-pill">
          <span>{questionCount} Questions</span>
          <span className="pill-divider">•</span>
          <span>{edgeCount} Transitions</span>
        </div>
      </div>

      {/* 3. Right: Consolidated Action Buttons */}
      <div className="header-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onAutoLayout}
          title="Auto-organize questions hierarchy vertically"
        >
          <TreePine size={14} />
          <span>Auto-Layout</span>
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleOpenSettings}
          title="Edit Group Name, Bengali Title & Category"
        >
          <Settings2 size={14} />
          <span>Settings</span>
        </button>

        <button
          type="button"
          className="btn btn-primary btn-save-template"
          onClick={onSave}
          disabled={questionCount === 0 || !name.trim()}
          title="Save this reusable question group template"
        >
          <Sparkles size={14} />
          <span>Save Template</span>
        </button>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="modal-overlay" onClick={() => setIsSettingsOpen(false)}>
          <div
            className="modal-container group-settings-popover"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title">
                <Settings2 size={16} className="text-emerald" />
                <span>Group Template Settings</span>
              </div>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Group Name (English)</label>
                <input
                  type="text"
                  className="form-input"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  placeholder="e.g. Landholding Details"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Group Name (Bengali)</label>
                <input
                  type="text"
                  className="form-input bn-font"
                  value={tempNameBn}
                  onChange={(e) => setTempNameBn(e.target.value)}
                  placeholder="যেমন: আবাদি জমির বিবরণ"
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-select"
                    value={tempCategory}
                    onChange={(e) => {
                      const cat = e.target.value as GroupCategory;
                      setTempCategory(cat);
                      const opt = CATEGORY_OPTIONS.find((c) => c.value === cat);
                      if (opt) setTempColor(opt.color);
                    }}
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Accent Color</label>
                  <div className="color-picker-row">
                    {[
                      '#0284c7',
                      '#10b981',
                      '#f59e0b',
                      '#8b5cf6',
                      '#ec4899',
                      '#06b6d4',
                    ].map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`color-swatch-btn ${
                          tempColor === c ? 'is-selected' : ''
                        }`}
                        style={{ backgroundColor: c }}
                        onClick={() => setTempColor(c)}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={tempDesc}
                  onChange={(e) => setTempDesc(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsSettingsOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveSettings}
              >
                <CheckCircle2 size={14} />
                <span>Update Settings</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
