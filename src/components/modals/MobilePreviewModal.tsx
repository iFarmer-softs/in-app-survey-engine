import React, { useState, useEffect } from 'react';
import {
  X,
  Smartphone,
  ChevronLeft,
  Camera,
  MapPin,
  Calendar,
  CheckCircle,
  RotateCcw,
} from 'lucide-react';
import type { DynamicKycGroupResponse } from '../../types/survey';

interface MobilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  schema: DynamicKycGroupResponse;
}

export const MobilePreviewModal: React.FC<MobilePreviewModalProps> = ({
  isOpen,
  onClose,
  schema,
}) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [visibleQuestions, setVisibleQuestions] = useState<number[]>([]);
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);

  // Evaluate dependencies whenever answers change
  useEffect(() => {
    if (!schema.data) return;

    const visibleIds: number[] = [];

    schema.data.forEach((q) => {
      if (!q.depends_on || q.depends_on.length === 0) {
        visibleIds.push(q.question_id);
        return;
      }

      // Check all dependencies
      let allPassed = true;
      for (const parentId of q.depends_on) {
        const parentAnswer = answers[String(parentId)] || '';
        const ruleConfig = q.validation ? q.validation[String(parentId)] : null;

        if (ruleConfig) {
          if (ruleConfig.validation_type === 'match') {
            const allowedKeys =
              typeof ruleConfig.validation === 'object'
                ? Object.keys(ruleConfig.validation)
                : [String(ruleConfig.validation)];
            const matchFound = allowedKeys.some((k) =>
              parentAnswer.toLowerCase().includes(k.toLowerCase())
            );
            if (!matchFound) {
              allPassed = false;
              break;
            }
          } else if (ruleConfig.validation_type === 'greater') {
            const numVal = parseFloat(parentAnswer);
            const threshold = Number(ruleConfig.validation);
            if (isNaN(numVal) || numVal <= threshold) {
              allPassed = false;
              break;
            }
          } else if (ruleConfig.validation_type === 'less') {
            const numVal = parseFloat(parentAnswer);
            const threshold = Number(ruleConfig.validation);
            if (isNaN(numVal) || numVal >= threshold) {
              allPassed = false;
              break;
            }
          }
        }
      }

      if (allPassed) {
        visibleIds.push(q.question_id);
      }
    });

    setVisibleQuestions(visibleIds);
  }, [answers, schema]);

  if (!isOpen) return null;

  const handleAnswerChange = (qId: number, val: string) => {
    setAnswers((prev) => ({
      ...prev,
      [String(qId)]: val,
    }));
  };

  const handleNextSubmit = () => {
    // Check mandatory fields
    const missing: string[] = [];
    schema.data.forEach((q) => {
      if (visibleQuestions.includes(q.question_id) && q.mandatory) {
        const ans = answers[String(q.question_id)];
        if (!ans || ans.trim() === '') {
          missing.push(q.question_bn || q.question);
        }
      }
    });

    if (missing.length > 0) {
      alert(`অনুগ্রহ করে পূরণ করুন:\n${missing.join('\n')}`);
      return;
    }

    setSubmittedMessage(
      schema.next
        ? `গ্রুপ ${schema.current_group || 1} সফলভাবে সংরক্ষিত হয়েছে! পরবর্তী গ্রুপ লোড হচ্ছে...`
        : 'অভিনন্দন! জরিপ / ঋণ আবেদন সম্পূর্ণ হয়েছে!'
    );
  };

  const handleReset = () => {
    setAnswers({});
    setSubmittedMessage(null);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container mobile-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-row">
            <Smartphone size={20} className="text-emerald" />
            <div>
              <h3 className="modal-title">Live Android Simulator</h3>
              <p className="modal-subtitle">
                Interactive preview testing real-time dependency logic and layout
              </p>
            </div>
          </div>
          <div className="flex-center gap-2">
            <button className="btn btn-secondary btn-sm" onClick={handleReset}>
              <RotateCcw size={12} />
              <span>Reset State</span>
            </button>
            <button className="modal-close-btn" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="modal-body flex-center mobile-simulator-body">
          {/* Smartphone Frame */}
          <div className="phone-device-frame">
            {/* Status bar */}
            <div className="phone-status-bar">
              <span className="phone-time">14:45</span>
              <div className="phone-notch"></div>
              <div className="phone-icons">
                <span className="phone-signal">5G</span>
                <span className="phone-battery">98%</span>
              </div>
            </div>

            {/* Mobile App Bar */}
            <div className="mobile-app-bar">
              <ChevronLeft size={22} className="mobile-back-icon" />
              <div className="mobile-header-title">
                ঋণ আবেদন (গ্রুপ {schema.current_group || 1})
              </div>
            </div>

            {/* Farmer Profile Card (Sofol Style) */}
            <div className="mobile-profile-card">
              <div className="profile-avatar">কে</div>
              <div className="profile-info">
                <div className="profile-name">করিম মিয়া (Karim Mia)</div>
                <div className="profile-sub">NID: 19852691234567890</div>
                <div className="profile-sub">মোবাইল: 01712345678</div>
              </div>
            </div>

            {/* Instruction Banner */}
            {schema.instruction && (
              <div className="mobile-instruction-card">
                <div className="instruction-icon">ℹ</div>
                <div className="instruction-text">{schema.instruction}</div>
              </div>
            )}

            {/* Mobile Form Questions */}
            <div className="mobile-form-scroll">
              {schema.data?.map((q) => {
                const isVisible = visibleQuestions.includes(q.question_id);
                if (!isVisible) return null;

                const currentVal = answers[String(q.question_id)] || '';
                const isLocked = q.editable === false;

                return (
                  <div key={q.question_id} className={`mobile-question-item ${isLocked ? 'is-locked-question' : ''}`}>
                    {/* Question Title */}
                    <div className="mobile-q-label">
                      {q.question_bn || q.question}
                      {q.mandatory && <span className="text-danger"> *</span>}
                      {isLocked && (
                        <span className="mobile-locked-badge">🔒 লক করা / Read-only</span>
                      )}
                    </div>

                    {/* Hint */}
                    {q.hint && (
                      <div className="mobile-q-hint">{q.hint}</div>
                    )}

                    {/* Dynamic Widget Rendering */}
                    <div className="mobile-widget-slot">
                      {/* String / Text */}
                      {['string', 'text'].includes(q.answer_type) && (
                        <input
                          type="text"
                          disabled={isLocked}
                          className={`mobile-input-field ${isLocked ? 'field-disabled' : ''}`}
                          placeholder={q.placeholder || (isLocked ? 'লক করা তথ্য...' : 'এখানে লিখুন...')}
                          value={currentVal}
                          onChange={(e) =>
                            handleAnswerChange(q.question_id, e.target.value)
                          }
                        />
                      )}

                      {/* Integer / Number */}
                      {['integer', 'float', 'number_input'].includes(
                        q.answer_type
                      ) && (
                        <input
                          type="number"
                          disabled={isLocked}
                          className={`mobile-input-field ${isLocked ? 'field-disabled' : ''}`}
                          placeholder={q.placeholder || (isLocked ? 'লক করা সংখ্যা...' : 'সংখ্যা লিখুন...')}
                          value={currentVal}
                          onChange={(e) =>
                            handleAnswerChange(q.question_id, e.target.value)
                          }
                        />
                      )}

                      {/* Phone */}
                      {q.answer_type === 'phone' && (
                        <div className="mobile-phone-group">
                          <span className="phone-prefix">+88</span>
                          <input
                            type="tel"
                            disabled={isLocked}
                            className={`mobile-input-field phone-input ${isLocked ? 'field-disabled' : ''}`}
                            placeholder="01XXXXXXXXX"
                            maxLength={11}
                            value={currentVal}
                            onChange={(e) =>
                              handleAnswerChange(q.question_id, e.target.value)
                            }
                          />
                        </div>
                      )}

                      {/* Dropdown Spinner */}
                      {q.answer_type === 'dropdown' && (
                        <select
                          disabled={isLocked}
                          className={`mobile-select-field ${isLocked ? 'field-disabled' : ''}`}
                          value={currentVal}
                          onChange={(e) =>
                            handleAnswerChange(q.question_id, e.target.value)
                          }
                        >
                          <option value="">{q.placeholder || 'নির্বাচন করুন...'}</option>
                          {q.options?.split(',').map((opt, i) => (
                            <option key={i} value={opt.trim()}>
                              {opt.trim()}
                            </option>
                          ))}
                        </select>
                      )}

                      {/* Radio / Select One Chips */}
                      {['select_one', 'radio', 'single_radio'].includes(
                        q.answer_type
                      ) && (
                        <div className="mobile-chips-group">
                          {q.options?.split(',').map((opt, i) => {
                            const trimmed = opt.trim();
                            const isSelected = currentVal === trimmed;
                            return (
                              <button
                                key={i}
                                type="button"
                                disabled={isLocked}
                                className={`mobile-chip ${
                                  isSelected ? 'chip-active' : ''
                                } ${isLocked ? 'chip-disabled' : ''}`}
                                onClick={() =>
                                  !isLocked && handleAnswerChange(q.question_id, trimmed)
                                }
                              >
                                {trimmed}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Select Multiple Check Chips */}
                      {q.answer_type === 'select_multiple' && (
                        <div className="mobile-chips-group">
                          {q.options?.split(',').map((opt, i) => {
                            const trimmed = opt.trim();
                            const currentList = currentVal
                              ? currentVal.split(', ')
                              : [];
                            const isSelected = currentList.includes(trimmed);

                            return (
                              <button
                                key={i}
                                type="button"
                                disabled={isLocked}
                                className={`mobile-chip ${
                                  isSelected ? 'chip-active' : ''
                                } ${isLocked ? 'chip-disabled' : ''}`}
                                onClick={() => {
                                  if (isLocked) return;
                                  let updated: string[];
                                  if (isSelected) {
                                    updated = currentList.filter(
                                      (x) => x !== trimmed
                                    );
                                  } else {
                                    updated = [...currentList, trimmed];
                                  }
                                  handleAnswerChange(
                                    q.question_id,
                                    updated.join(', ')
                                  );
                                }}
                              >
                                {trimmed}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Calendar Date */}
                      {q.answer_type === 'calendar' && (
                        <div className="mobile-date-field">
                          <input
                            type="date"
                            disabled={isLocked}
                            className={`mobile-input-field ${isLocked ? 'field-disabled' : ''}`}
                            value={currentVal}
                            onChange={(e) =>
                              handleAnswerChange(q.question_id, e.target.value)
                            }
                          />
                          <Calendar size={18} className="date-icon" />
                        </div>
                      )}

                      {/* Image Upload + GPS */}
                      {q.answer_type === 'image' && (
                        <div className="mobile-image-uploader">
                          <div
                            className={`uploader-tap-area ${isLocked ? 'uploader-disabled' : ''}`}
                            onClick={() =>
                              !isLocked &&
                              handleAnswerChange(
                                q.question_id,
                                'farm_photo_mock_upload.webp'
                              )
                            }
                          >
                            <Camera size={24} className="camera-icon" />
                            <span>{isLocked ? 'ছবি পরিবর্তন করা যাবে না (লক করা)' : 'ক্যামেরা দিয়ে ছবি তুলুন'}</span>
                          </div>

                          {currentVal && (
                            <div className="image-preview-badge">
                              <CheckCircle size={14} className="text-emerald" />
                              <span>ছবি সংযুক্ত: {currentVal}</span>
                            </div>
                          )}

                          <div className="gps-indicator">
                            <MapPin size={12} className="text-emerald" />
                            <span>GPS স্থানাঙ্ক: 23.8103° N, 90.4125° E</span>
                          </div>
                        </div>
                      )}

                      {/* Read Only */}
                      {q.answer_type === 'read_only' && (
                        <div className="mobile-readonly-card">
                          ℹ {q.placeholder || 'তথ্য শুধুমাত্র প্রদর্শনের জন্য'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Submit / Next Button */}
              <div className="mobile-submit-holder">
                <button
                  type="button"
                  className="mobile-submit-btn"
                  onClick={handleNextSubmit}
                >
                  {schema.next ? 'পরবর্তী গ্রুপ (Next Group)' : 'আবেদন জমা দিন (Submit)'}
                </button>
              </div>

              {submittedMessage && (
                <div className="mobile-success-toast">
                  <CheckCircle size={16} />
                  <span>{submittedMessage}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
