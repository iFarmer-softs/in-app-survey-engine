import React, { useState } from 'react';
import {
  X,
  Layers,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import type { GroupCategory, GroupQuestionTemplate } from '../../types/group';

interface SaveSelectionAsGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedQuestions: GroupQuestionTemplate[];
  onSave: (meta: {
    name: string;
    nameBn: string;
    description: string;
    category: GroupCategory;
    color: string;
  }) => void;
}

const CATEGORY_OPTIONS: { value: GroupCategory; label: string; color: string }[] = [
  { value: 'kyc', label: 'Farmer KYC & Identity', color: '#0284c7' },
  { value: 'land', label: 'Land & Plots', color: '#10b981' },
  { value: 'crop', label: 'Crop & Harvest', color: '#f59e0b' },
  { value: 'financial', label: 'Financial & Income', color: '#8b5cf6' },
  { value: 'verification', label: 'Geo & Field Verification', color: '#ec4899' },
  { value: 'custom', label: 'Custom Domain', color: '#64748b' },
];

const PRESET_COLORS = [
  '#0284c7', // Sky
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#6366f1', // Indigo
];

export const SaveSelectionAsGroupModal: React.FC<SaveSelectionAsGroupModalProps> = ({
  isOpen,
  onClose,
  selectedQuestions,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [nameBn, setNameBn] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<GroupCategory>('kyc');
  const [color, setColor] = useState('#0284c7');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      name: name.trim(),
      nameBn: nameBn.trim() || name.trim(),
      description: description.trim() || 'Reusable group created from flowchart canvas selection.',
      category,
      color,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container save-selection-group-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">
            <Layers size={18} className="text-emerald" />
            <span>Create Reusable Group from Selection</span>
          </div>
          <button className="btn-close-modal" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Selected Questions Preview Chip Bar */}
            <div className="selection-preview-box">
              <div className="selection-preview-header">
                <span className="selection-count-badge">
                  <CheckCircle2 size={13} />
                  <span>{selectedQuestions.length} Questions Included in Group</span>
                </span>
                <span className="selection-note">Order matches top-to-bottom flowchart progression</span>
              </div>

              <div className="selection-questions-scroll">
                {selectedQuestions.map((q, idx) => (
                  <div key={idx} className="selection-q-pill">
                    <span className="pill-q-idx">#{idx + 1}</span>
                    <span className="pill-q-type">{q.answer_type}</span>
                    <span className="pill-q-name bn-font">
                      {q.question_bn || q.question || 'Untitled Question'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Group Metadata Form */}
            <div className="form-group">
              <label className="form-label">
                Group Name (English) <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Rice Cultivation & Harvesting"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Group Name (Bengali)</label>
              <input
                type="text"
                className="form-input bn-font"
                placeholder="যেমন: ধান চাষাবাদ ও ফসল তোলার তথ্য"
                value={nameBn}
                onChange={(e) => setNameBn(e.target.value)}
              />
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">Group Category</label>
                <select
                  className="form-select"
                  value={category}
                  onChange={(e) => {
                    const cat = e.target.value as GroupCategory;
                    setCategory(cat);
                    const opt = CATEGORY_OPTIONS.find((c) => c.value === cat);
                    if (opt) setColor(opt.color);
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
                <label className="form-label">Accent Theme Color</label>
                <div className="color-picker-row">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`color-swatch-btn ${color === c ? 'is-selected' : ''}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description (Optional)</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="Briefly describe what this question set captures..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!name.trim()}
            >
              <Sparkles size={14} />
              <span>Save as Reusable Group</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
