import { memo, useMemo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Handle, Position, useEdges, useNodes } from '@xyflow/react';
import { Split, Check, X } from 'lucide-react';
import type { DecisionNodeData, DecisionRule } from '../../types/survey';
import { normalizeDecisionRules } from '../../types/survey';

/**
 * Maps condition type to natural, plain-language English phrases.
 */
export function getOperatorLabel(conditionType?: string, comparisonValue?: any): string {
  switch (conditionType) {
    case 'greater':
      return 'is greater than';
    case 'less':
      return 'is less than';
    case 'greater_or_equal':
      return 'is at least';
    case 'less_or_equal':
      return 'is at most';
    case 'not_match':
      return 'does not equal';
    case 'contains':
      return 'contains';
    case 'match':
    default: {
      const v = String(comparisonValue || '').toLowerCase().trim();
      if (v === 'yes' || v === 'true' || v === 'হ্যাঁ') {
        return 'is';
      }
      return 'equals';
    }
  }
}

/**
 * Shorthand operator symbol for compact node cards with multiple conditions.
 */
export function getShortOperator(conditionType?: string): string {
  switch (conditionType) {
    case 'greater':
      return '>';
    case 'less':
      return '<';
    case 'greater_or_equal':
      return '>=';
    case 'less_or_equal':
      return '<=';
    case 'not_match':
      return '!=';
    case 'contains':
      return 'contains';
    case 'match':
    default:
      return '=';
  }
}

/**
 * Resolves the subject label of a decision rule (field name, question title, or Q#ID).
 */
export function getRuleSubject(
  rule: DecisionRule,
  nodes?: any[],
  edges?: any[],
  nodeId?: string,
  defaultLabel?: string
): string {
  if (rule.field && rule.field.trim()) {
    return rule.field.trim();
  }
  if (rule.parentQuestionId) {
    if (nodes) {
      const qNode = nodes.find((n: any) => (n.data as any)?.question_id === rule.parentQuestionId);
      const qTitle = (qNode?.data as any)?.question;
      if (qTitle && typeof qTitle === 'string' && qTitle.trim() && qTitle.length <= 25) {
        return qTitle.trim();
      }
    }
    return `Q#${rule.parentQuestionId}`;
  }
  if (nodeId && edges && nodes) {
    const incomingEdge = edges.find((e: any) => e.target === nodeId);
    if (incomingEdge) {
      const srcNode = nodes.find((n: any) => n.id === incomingEdge.source);
      if (srcNode) {
        const qTitle = (srcNode.data as any)?.question;
        if (qTitle && typeof qTitle === 'string' && qTitle.trim() && qTitle.length <= 25) {
          return qTitle.trim();
        }
        const qId = (srcNode.data as any)?.question_id;
        if (qId) return `Q#${qId}`;
        const label = (srcNode.data as any)?.label;
        if (label) return String(label).slice(0, 16);
      }
    }
  }
  return defaultLabel && defaultLabel !== 'Condition Rule' && defaultLabel !== 'Decision Diamond' && defaultLabel !== 'Condition Check'
    ? defaultLabel
    : 'Question';
}

export const DecisionNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as unknown as DecisionNodeData;
  const edges = useEdges();
  const nodes = useNodes();

  const rules = useMemo(() => normalizeDecisionRules(nodeData), [nodeData]);
  const isMulti = rules.length >= 2;
  const logicalOp = nodeData.logicalOperator || 'ALL';

  const firstRule = rules[0] || { conditionType: 'match', comparisonValue: '' };

  const firstSubject = useMemo(
    () => getRuleSubject(firstRule, nodes, edges, id, nodeData.label),
    [firstRule, nodes, edges, id, nodeData.label]
  );

  const firstOperator = useMemo(
    () => (isMulti ? getShortOperator(firstRule.conditionType) : getOperatorLabel(firstRule.conditionType, firstRule.comparisonValue)),
    [isMulti, firstRule.conditionType, firstRule.comparisonValue]
  );

  const firstValue = useMemo(() => {
    if (
      firstRule.comparisonValue !== undefined &&
      firstRule.comparisonValue !== null &&
      String(firstRule.comparisonValue).trim() !== ''
    ) {
      return String(firstRule.comparisonValue);
    }
    return '...';
  }, [firstRule.comparisonValue]);

  // Full tooltip for all rules
  const tooltipText = useMemo(() => {
    if (!isMulti) {
      return `IF ${firstSubject} ${getOperatorLabel(firstRule.conditionType, firstRule.comparisonValue)} ${firstValue}`;
    }
    const lines = rules.map((r, idx) => {
      const subj = getRuleSubject(r, nodes, edges, id, nodeData.label);
      const op = getOperatorLabel(r.conditionType, r.comparisonValue);
      const val = r.comparisonValue !== undefined ? String(r.comparisonValue) : '...';
      return `${idx + 1}. ${subj} ${op} ${val}`;
    });
    return `${logicalOp === 'ANY' ? 'ANY of these is true' : 'ALL of these are true'}:\n` + lines.join('\n');
  }, [isMulti, rules, nodes, edges, id, nodeData.label, logicalOp, firstSubject, firstRule, firstValue]);

  return (
    <div className={`survey-node decision-node ${selected ? 'is-selected' : ''}`}>
      {/* Top Incoming Handle */}
      <Handle
        type="target"
        position={Position.Top}
        id="in"
        className="node-handle target-handle decision-top-handle"
        title="Incoming Flow (Top)"
      />
      {/* Left Incoming Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="in-left"
        className="node-handle target-handle decision-left-handle"
        title="Incoming Flow (Left)"
      />

      <div className="decision-diamond-card">
        {/* Header with Split Icon and ALL/ANY Badge */}
        <div className="decision-diamond">
          <div className="decision-diamond-header-left" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Split size={16} className="decision-icon" />
            <span className="decision-title">Condition Check</span>
          </div>
          {isMulti && (
            <span className={`decision-logic-badge badge-${logicalOp.toLowerCase()}`}>
              {logicalOp}
            </span>
          )}
        </div>

        {/* Plain-Language Rule Sentence / Summary */}
        <div
          className="decision-sentence"
          title={tooltipText}
        >
          <span className="decision-token-if">IF</span>
          <span className="decision-token-subject">{firstSubject}</span>
          <span className="decision-token-operator">{firstOperator}</span>
          <span className="decision-token-value">{firstValue}</span>
          {isMulti && (
            <span className="decision-token-more">
              {logicalOp === 'ANY' ? 'or' : 'and'} {rules.length - 1} more
            </span>
          )}
        </div>

        {/* Dedicated Branches: ✓ Yes and ✗ No */}
        <div className="decision-branches">
          {/* Yes Branch Row */}
          <div className="decision-branch-row branch-row-yes">
            <div className="branch-label-box">
              <Check size={12} className="branch-icon branch-icon-yes" strokeWidth={2.5} />
              <span className="branch-label-text branch-text-yes">Yes</span>
            </div>
            <Handle
              type="source"
              position={Position.Right}
              id="match"
              className="node-handle source-handle branch-handle handle-yes"
              title="Yes (Condition Satisfied)"
            />
          </div>

          {/* No Branch Row */}
          <div className="decision-branch-row branch-row-no">
            <div className="branch-label-box">
              <X size={12} className="branch-icon branch-icon-no" strokeWidth={2.5} />
              <span className="branch-label-text branch-text-no">No</span>
            </div>
            <Handle
              type="source"
              position={Position.Right}
              id="else"
              className="node-handle source-handle branch-handle handle-no"
              title="No (Otherwise)"
            />
          </div>
        </div>
      </div>

      {/* Optional Bottom Handle for alternate vertical flow */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="default-next"
        className="node-handle source-handle decision-bottom-handle"
        title="Alternate Exit (Bottom)"
      />
    </div>
  );
});

DecisionNode.displayName = 'DecisionNode';
