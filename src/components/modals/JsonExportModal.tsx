import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Download,
  Upload,
  FileCode,
  AlertCircle,
} from 'lucide-react';
import type { DynamicKycGroupResponse } from '../../types/survey';
import { safeParseJson } from '../../utils/jsonParser';

interface JsonExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  schema: DynamicKycGroupResponse;
  onImportSchema: (schema: DynamicKycGroupResponse) => void;
}

export const JsonExportModal: React.FC<JsonExportModalProps> = ({
  isOpen,
  onClose,
  schema,
  onImportSchema,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  if (!isOpen) return null;

  const jsonString = JSON.stringify(schema, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `survey_group_${schema.current_group || 1}_schema.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    try {
      setImportError(null);
      let text = importText.trim();
      if (!text) {
        throw new Error('Please paste a JSON schema to import.');
      }

      const parsed = safeParseJson(text);

      let questionsArray: any[] = [];
      let groupMetaRaw: any = {};

      if (Array.isArray(parsed)) {
        questionsArray = parsed;
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.data)) {
          questionsArray = parsed.data;
          groupMetaRaw = parsed;
        } else if (Array.isArray(parsed.questions)) {
          questionsArray = parsed.questions;
          groupMetaRaw = parsed;
        } else if (parsed.result && Array.isArray(parsed.result.data)) {
          questionsArray = parsed.result.data;
          groupMetaRaw = parsed.result;
        } else if (parsed.response && Array.isArray(parsed.response.data)) {
          questionsArray = parsed.response.data;
          groupMetaRaw = parsed.response;
        } else {
          // Look for any array in the object
          for (const key of Object.keys(parsed)) {
            if (Array.isArray(parsed[key]) && parsed[key].length > 0) {
              questionsArray = parsed[key];
              groupMetaRaw = parsed;
              break;
            }
          }
        }
      }

      if (!questionsArray || questionsArray.length === 0) {
        throw new Error(
          'Could not find a questions array in the JSON. Expected { "data": [...] } or a plain [ { "question_id": ... } ] array.'
        );
      }

      const normalized: DynamicKycGroupResponse = {
        total_groups: Number(groupMetaRaw.total_groups) || 1,
        current_group: Number(groupMetaRaw.current_group) || 1,
        next: Boolean(groupMetaRaw.next ?? groupMetaRaw.hasNextGroup ?? false),
        instruction: groupMetaRaw.instruction || '',
        groups: Array.isArray(groupMetaRaw.groups) ? groupMetaRaw.groups : [],
        data: questionsArray,
      };

      onImportSchema(normalized);
      onClose();
    } catch (err: any) {
      setImportError(err.message || 'Failed to parse JSON schema. Please verify syntax.');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container json-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-row">
            <FileCode size={20} className="text-emerald" />
            <div>
              <h3 className="modal-title">Dynamic KYC Schema Generator</h3>
              <p className="modal-subtitle">
                Exact JSON schema matching Sofol / In-App Survey Engine specification
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="modal-tabs">
          <button
            className={`modal-tab-btn ${activeTab === 'export' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            Exported JSON Output
          </button>
          <button
            className={`modal-tab-btn ${activeTab === 'import' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            Import Existing Schema
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {activeTab === 'export' ? (
            <div className="json-code-wrapper">
              <pre className="json-code-block">
                <code>{jsonString}</code>
              </pre>
            </div>
          ) : (
            <div className="import-wrapper">
              <p className="import-description">
                Paste any Sofol Credit Score / Dynamic KYC group JSON below. The tool will parse it and generate the visual flow chart automatically!
              </p>
              <textarea
                className="import-textarea"
                rows={12}
                placeholder="Paste JSON schema here..."
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
              {importError && (
                <div className="import-error-banner">
                  <AlertCircle size={16} />
                  <span>{importError}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          {activeTab === 'export' ? (
            <div className="modal-footer-actions">
              <span className="schema-stats">
                {schema.data?.length || 0} Questions • Group {schema.current_group || 1}
              </span>
              <div className="btn-group">
                <button className="btn btn-secondary" onClick={handleDownload}>
                  <Download size={14} />
                  <span>Download .json</span>
                </button>
                <button className="btn btn-primary" onClick={handleCopy}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Copied to Clipboard!' : 'Copy JSON'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="modal-footer-actions">
              <button className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleImport}
                disabled={!importText.trim()}
              >
                <Upload size={14} />
                <span>Parse & Visualize Flow</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
