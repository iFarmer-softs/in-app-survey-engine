import React, { useState, useEffect } from 'react';
import { GitCommit, Rocket } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { getNextVersion } from '../../utils/projectStorage';

interface CreateVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVersion: string;
  isInitialPublish?: boolean;
  onSubmit: (params: {
    version: string;
    title: string;
    description: string;
    isPublished: boolean;
    createdBy: string;
  }) => void;
}

export const CreateVersionModal: React.FC<CreateVersionModalProps> = ({
  isOpen,
  onClose,
  currentVersion,
  isInitialPublish = false,
  onSubmit,
}) => {
  const [bumpType, setBumpType] = useState<'patch' | 'minor' | 'major' | 'custom'>(
    isInitialPublish ? 'minor' : 'patch'
  );
  const [versionNumber, setVersionNumber] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublished, setIsPublished] = useState(isInitialPublish);
  const [createdBy, setCreatedBy] = useState('Survey Designer');

  useEffect(() => {
    if (isOpen) {
      const defaultBump = isInitialPublish ? 'minor' : 'patch';
      setBumpType(defaultBump);
      setVersionNumber(getNextVersion(currentVersion, defaultBump));
      setTitle(isInitialPublish ? 'Production Release' : '');
      setDescription('');
      setIsPublished(isInitialPublish);
    }
  }, [isOpen, currentVersion, isInitialPublish]);

  const handleBumpChange = (type: 'patch' | 'minor' | 'major' | 'custom') => {
    setBumpType(type);
    if (type !== 'custom') {
      setVersionNumber(getNextVersion(currentVersion, type));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !versionNumber.trim()) return;

    onSubmit({
      version: versionNumber.trim(),
      title: title.trim(),
      description: description.trim(),
      isPublished,
      createdBy: createdBy.trim() || 'Survey Designer',
    });

    onClose();
  };

  const patchPreview = getNextVersion(currentVersion, 'patch');
  const minorPreview = getNextVersion(currentVersion, 'minor');
  const majorPreview = getNextVersion(currentVersion, 'major');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="create-version-modal-content"
      icon={
        <div className="modal-badge-icon">
          <GitCommit size={18} className="text-emerald" />
        </div>
      }
      title={isPublished ? 'Publish Version' : 'Save Version Snapshot'}
      subtitle={`Create an immutable checkpoint from the active canvas (Current baseline: v${currentVersion})`}
    >
      <form onSubmit={handleSubmit} className="modal-body-form">
        {/* Version Bump Selector */}
        <div className="form-group">
          <label className="form-label">Version Bump</label>
          <div className="version-bump-grid">
            <button
              type="button"
              className={`version-bump-card ${bumpType === 'patch' ? 'is-selected' : ''}`}
              onClick={() => handleBumpChange('patch')}
            >
              <span className="bump-tag">Patch</span>
              <span className="bump-val">v{patchPreview}</span>
              <span className="bump-hint">Bug fix, typos, minor tweaks</span>
            </button>

            <button
              type="button"
              className={`version-bump-card ${bumpType === 'minor' ? 'is-selected' : ''}`}
              onClick={() => handleBumpChange('minor')}
            >
              <span className="bump-tag">Minor</span>
              <span className="bump-val">v{minorPreview}</span>
              <span className="bump-hint">Added questions, new branches</span>
            </button>

            <button
              type="button"
              className={`version-bump-card ${bumpType === 'major' ? 'is-selected' : ''}`}
              onClick={() => handleBumpChange('major')}
            >
              <span className="bump-tag">Major</span>
              <span className="bump-val">v{majorPreview}</span>
              <span className="bump-hint">Major workflow restructuring</span>
            </button>
          </div>
        </div>

        {/* Version Number Input */}
        <div className="form-group">
          <label className="form-label required-label">Version String</label>
          <div className="input-with-prefix">
            <span className="input-prefix">v</span>
            <input
              type="text"
              className="form-input"
              value={versionNumber}
              onChange={(e) => {
                setVersionNumber(e.target.value);
                setBumpType('custom');
              }}
              placeholder="1.2.0"
              required
            />
          </div>
        </div>

        {/* Title / Summary */}
        <div className="form-group">
          <label className="form-label required-label">Snapshot Summary / Commit Message</label>
          <input
            type="text"
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Added Land Deed verification & credit score jump condition"
            required
            autoFocus
          />
        </div>

        {/* Change Notes */}
        <div className="form-group">
          <label className="form-label">Changelog & Notes (Optional)</label>
          <textarea
            className="form-textarea"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detailed notes: questions added, validation rules updated, branch logic..."
          />
        </div>

        {/* Status Mode: Draft Snapshot vs Live Published */}
        <div className="form-group">
          <label className="form-label">Release Target</label>
          <div className="version-target-selector">
            <label className={`version-target-option ${!isPublished ? 'is-active' : ''}`}>
              <input
                type="radio"
                name="releaseTarget"
                checked={!isPublished}
                onChange={() => setIsPublished(false)}
              />
              <div className="target-text">
                <span className="target-title">Draft Snapshot</span>
                <span className="target-sub">Safe working checkpoint without altering live surveys</span>
              </div>
            </label>

            <label className={`version-target-option ${isPublished ? 'is-active' : ''}`}>
              <input
                type="radio"
                name="releaseTarget"
                checked={isPublished}
                onChange={() => setIsPublished(true)}
              />
              <div className="target-text">
                <span className="target-title flex items-center gap-1.5">
                  <Rocket size={14} className="text-emerald-400" />
                  <span>Publish Production Release</span>
                </span>
                <span className="target-sub">Promotes this snapshot as the active published version</span>
              </div>
            </label>
          </div>
        </div>

        {/* Author */}
        <div className="form-group">
          <label className="form-label">Author / Creator</label>
          <input
            type="text"
            className="form-input"
            value={createdBy}
            onChange={(e) => setCreatedBy(e.target.value)}
            placeholder="Your name or team"
          />
        </div>

        {/* Actions */}
        <div className="modal-footer-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
            {isPublished ? (
              <>
                <Rocket size={15} />
                <span>Publish v{versionNumber}</span>
              </>
            ) : (
              <>
                <GitCommit size={15} />
                <span>Save Snapshot v{versionNumber}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
