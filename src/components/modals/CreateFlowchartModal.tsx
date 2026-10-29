import React, { useState } from 'react';
import { X, Sparkles, Layers, FileText, ArrowRight } from 'lucide-react';

interface CreateFlowchartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (
    title: string,
    titleBn: string,
    description: string,
    totalGroups: number
  ) => void;
}

export const CreateFlowchartModal: React.FC<CreateFlowchartModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [title, setTitle] = useState('');
  const [titleBn, setTitleBn] = useState('');
  const [description, setDescription] = useState('');
  const [totalGroups, setTotalGroups] = useState(1);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onCreate(
      title.trim(),
      titleBn.trim() || title.trim(),
      description.trim() || 'Custom survey flow created from blank canvas.',
      totalGroups
    );

    // reset
    setTitle('');
    setTitleBn('');
    setDescription('');
    setTotalGroups(1);
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
            <div className="modal-badge-icon">
              <Sparkles size={18} className="text-emerald" />
            </div>
            <div>
              <h2 className="modal-title">Create New Flowchart</h2>
              <p className="modal-subtitle">
                Initialize a blank survey canvas ready for drag-and-drop flowchart symbols
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
              Flowchart Title (English) *
            </label>
            <input
              type="text"
              required
              className="form-input"
              placeholder="e.g. Potato Farmer Season KYC 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Bengali Title (বাংলা শিরোনাম)
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. আলু চাষী সিজন কেওয়াইসি সমীক্ষা"
              value={titleBn}
              onChange={(e) => setTitleBn(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description / Purpose</label>
            <textarea
              className="form-textarea"
              rows={2}
              placeholder="Describe the workflow, facilitator target, or loan product..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label className="form-label">
                Initial Number of Survey Groups
              </label>
              <div className="input-with-icon">
                <Layers size={14} className="input-icon" />
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="form-input has-icon"
                  value={totalGroups}
                  onChange={(e) =>
                    setTotalGroups(Math.max(1, parseInt(e.target.value) || 1))
                  }
                />
              </div>
            </div>

            <div className="form-group flex-1 template-info-box">
              <label className="form-label">Starting Canvas</label>
              <div className="blank-canvas-badge">
                <FileText size={14} />
                <span>Blank Canvas (Start & End Terminators)</span>
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
              disabled={!title.trim()}
              className="btn btn-primary create-submit-btn"
            >
              <span>Create Flowchart</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
