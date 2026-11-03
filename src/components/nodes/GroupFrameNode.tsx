import { memo } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Layers, Sparkles } from 'lucide-react';
import type { GroupCategory } from '../../types/group';

export interface GroupFrameNodeData {
  groupId: string;
  numericGroupId?: number;
  title: string;
  titleBn?: string;
  category: GroupCategory;
  color: string;
  questionIds?: string[];
  questionCount?: number;
  isDropTarget?: boolean;
  onUpdateMetadata?: (updates: Partial<GroupFrameNodeData>) => void;
  onDeleteFrame?: (frameId: string) => void;
}

export const GroupFrameNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as GroupFrameNodeData;
  const isDropTarget = Boolean(nodeData.isDropTarget);
  const color = nodeData.color || '#8b5cf6';
  const activeColor = isDropTarget ? '#10b981' : color;
  const childCount = nodeData.questionCount ?? nodeData.questionIds?.length ?? 0;

  return (
    <div
      className={`group-frame-boundary ${selected ? 'is-selected' : ''} ${
        isDropTarget ? 'is-drop-active' : ''
      }`}
      style={{
        width: '100%',
        height: '100%',
        minWidth: 340,
        minHeight: 220,
        borderColor: isDropTarget ? '#10b981' : selected ? '#10b981' : color,
        backgroundColor: isDropTarget ? 'rgba(16, 185, 129, 0.12)' : `${color}06`,
        boxShadow: isDropTarget
          ? `0 0 0 3px rgba(16, 185, 129, 0.6), 0 8px 24px rgba(0, 0, 0, 0.5)`
          : selected
          ? `0 0 0 2px #10b981, 0 8px 24px -4px rgba(0,0,0,0.5)`
          : `0 4px 16px -2px rgba(0,0,0,0.3)`,
      }}
    >
      <NodeResizer
        minWidth={320}
        minHeight={200}
        isVisible={selected}
        color={selected ? '#10b981' : color}
        lineClassName="group-frame-resize-line"
        handleClassName="group-frame-resize-handle"
      />

      {/* Frame Header Bar */}
      <div
        className="group-frame-header"
        style={{
          borderBottomColor: `${activeColor}30`,
          backgroundColor: `${activeColor}15`,
        }}
      >
        <div className="group-frame-header-left">
          <div
            className="group-frame-icon-badge"
            style={{ backgroundColor: `${activeColor}30`, color: activeColor }}
          >
            <Layers size={13} />
          </div>

          <div className="group-frame-titles-col">
            <div className="group-frame-tag-row">
              <span
                className="group-frame-id-pill"
                style={{ backgroundColor: `${activeColor}25`, color: activeColor }}
              >
                GROUP #{nodeData.numericGroupId || 1}
              </span>
              <span className="group-frame-cat-pill" style={{ color: activeColor }}>
                {nodeData.category || 'custom'}
              </span>
            </div>
            <div className="group-frame-title-text bn-font" title={nodeData.titleBn || nodeData.title}>
              {nodeData.titleBn || nodeData.title || 'গ্রুপ এলাকা (Group Area)'}
            </div>
          </div>
        </div>

        <div className="group-frame-header-right">
          <span className="group-frame-count-badge">
            {childCount} Question{childCount !== 1 ? 's' : ''} inside
          </span>
        </div>
      </div>

      {/* Frame Interior Drop Hint */}
      <div className="group-frame-interior">
        {isDropTarget ? (
          <div className="group-frame-drop-guide is-active">
            <Sparkles size={18} className="text-emerald" />
            <span className="guide-primary text-emerald" style={{ fontSize: 13 }}>
              Release to Drop into Group #{nodeData.numericGroupId || 1}
            </span>
          </div>
        ) : childCount === 0 ? (
          <div className="group-frame-drop-guide">
            <Sparkles size={16} style={{ color }} />
            <span className="guide-primary">Group Area Frame</span>
            <span className="guide-sub">
              Drag & drop question symbols from the left panel inside this box
            </span>
          </div>
        ) : null}
      </div>

      {/* Optional Top / Bottom Handles for Flow Routing */}
      <Handle
        type="target"
        position={Position.Top}
        id="frame-in"
        className="flowchart-handle group-handle"
        style={{ background: activeColor }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="frame-out"
        className="flowchart-handle group-handle"
        style={{ background: activeColor }}
      />
    </div>
  );
});

GroupFrameNode.displayName = 'GroupFrameNode';
