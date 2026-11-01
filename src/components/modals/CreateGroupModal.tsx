import React, { useState } from 'react';
import { X, Layers, ArrowRight, HelpCircle } from 'lucide-react';
import type { GroupCategory } from '../../types/group';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (meta: {
    name: string;
    nameBn: string;
    description: string;
    category: GroupCategory;
    color: string;
    initialQuestionCount: number;
  }) => void;
}

const CATEGORY_OPTIONS: { value: GroupCategory; label: string; color: string }[] = [
  { value: 'kyc', label: 'Farmer KYC & Identity', color: '#0284c7' },
  { value: 'land', label: 'Land & Plots', color: '#10b981' },
  { value: 'crop', label: 'Crops & Yield', color: '#f59e0b' },
  { value: 'financial', label: 'Financial & Income', color: '#8b5cf6' },
  { value: 'verification', label: 'Geo & Field Verification', color: '#ec4899' },
  { value: 'custom', label: 'Custom Domain Sets', color: '#64748b' },
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

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [nameBn, setNameBn] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<GroupCategory>('kyc');
  const [color, setColor] = useState('#0284c7');
  const [initialQuestionCount, setInitialQuestionCount] = useState(1);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onCreate({
      name: name.trim(),
      nameBn: nameBn.trim() || name.trim(),
      description: description.trim() || 'Reusable group designed visually in Flowchart Studio.',
      category,
      color,
      initialQuestionCount,
    });

    // Reset form state
    setName('');
    setNameBn('');
    setDescription('');
    setCategory('kyc');
    setColor('#0284c7');
    setInitialQuestionCount(1);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content create-flow-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div
              className="modal-badge-icon"
              style={{ backgroundColor: `${color}25`, color }}
            >
              <Layers size={18} />
            </div>
            <div>
              <h2 className="modal-title">Create Question Group</h2>
              <p className="modal-subtitle">
                Set up group details before visually designing the questions in Flowchart Studio
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="modal-body-form">
          <div className="form-group">
            <label className="form-label required-label">
              Group Title (English) *
            </label>
            <input
              type="text"
              required
              className="form-input"
              placeholder="e.g. Farmer Income & Production Cost"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Bengali Title (বাংলা শিরোনাম)
            </label>
            <input
              type="text"
              className="form-input bn-font"
              placeholder="e.g. কৃষকের আয় ও ফসল উৎপাদন ব্যয়"
              value={nameBn}
              onChange={(e) => setNameBn(e.target.value)}
            />
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Category</label>
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
            <label className="form-label">Description / Purpose</label>
            <textarea
              className="form-textarea"
              rows={2}
              placeholder="Describe the survey topic or facilitator checklist..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label className="form-label">
                Initial Number of Questions
              </label>
              <div className="input-with-icon">
                <HelpCircle size={14} className="input-icon" />
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="form-input has-icon"
                  value={initialQuestionCount}
                  onChange={(e) =>
                    setInitialQuestionCount(Math.max(1, parseInt(e.target.value) || 1))
                  }
                />
              </div>
            </div>

            <div className="form-group flex-1 template-info-box">
              <label className="form-label">Starting Canvas</label>
              <div className="blank-canvas-badge">
                <Layers size={14} />
                <span>Visual Studio ({initialQuestionCount} Question Node{initialQuestionCount > 1 ? 's' : ''})</span>
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="modal-footer-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="btn btn-primary create-submit-btn"
            >
              <span>Design in Studio</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
