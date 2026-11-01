import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import {
  ChevronDown,
  ChevronUp,
  Tag,
  Layers,
  Trash2,
  Ungroup,
} from 'lucide-react';
import type { GroupCategory } from '../../types/group';

export interface GroupContainerNodeData {
  groupId: string;
  title: string;
  titleBn?: string;
  category: GroupCategory;
  color: string;
  isCollapsed: boolean;
  questionIds: string[];
  questionCount: number;
  expandedHeight?: number;
  childOffsets?: number[];
  onToggleCollapse?: (nodeId: string) => void;
  onUngroup?: (nodeId: string) => void;
  onDeleteGroup?: (nodeId: string) => void;
}

export interface GroupContainerNodeProps extends NodeProps {
  onToggleCollapse?: (nodeId: string) => void;
  onUngroup?: (nodeId: string) => void;
  onDeleteGroup?: (nodeId: string) => void;
}

export const GroupContainerNode = memo(
  ({
    id,
    data,
    selected,
    onToggleCollapse,
    onUngroup,
    onDeleteGroup,
  }: GroupContainerNodeProps) => {
    const nodeData = data as unknown as GroupContainerNodeData;
    const isCollapsed = Boolean(nodeData.isCollapsed);
    const color = nodeData.color || '#0284c7';
    const qCount = nodeData.questionCount || nodeData.questionIds?.length || 0;

    const toggleHandler = onToggleCollapse || nodeData.onToggleCollapse;
    const ungroupHandler = onUngroup || nodeData.onUngroup;
    const deleteHandler = onDeleteGroup || nodeData.onDeleteGroup;

    // Dynamically calculate frame height to ensure all child questions (including option ports) fit inside
    const expandedFrameHeight = isCollapsed
      ? undefined
      : nodeData.expandedHeight || Math.max(180, qCount * 230 + 100);

    return (
      <div
        className={`group-container-node ${isCollapsed ? 'is-collapsed' : 'is-expanded'} ${
          selected ? 'is-selected' : ''
        }`}
        style={{
          borderColor: selected ? '#10b981' : color,
          height: expandedFrameHeight ? `${expandedFrameHeight}px` : 'auto',
          boxShadow: selected
            ? `0 0 0 2px #10b981, 0 8px 24px -4px rgba(0,0,0,0.6)`
            : `0 4px 16px -2px rgba(0,0,0,0.5)`,
        }}
      >
        {/* Top Handle for incoming flow */}
        <Handle
          type="target"
          position={Position.Top}
          id="in"
          className="flowchart-handle group-handle"
          style={{ background: color }}
        />

        {/* Group Header Bar */}
        <div
          className="group-container-header"
          style={{
            borderBottomColor: isCollapsed ? 'transparent' : `${color}40`,
          }}
          onDoubleClick={() => toggleHandler?.(id)}
        >
          <div className="group-header-left">
            <div
              className="group-icon-badge"
              style={{ backgroundColor: `${color}25`, color }}
            >
              <Layers size={14} />
            </div>

            <div className="group-titles-wrap">
              <div className="group-category-tag-row">
                <span
                  className="group-cat-chip"
                  style={{
                    backgroundColor: `${color}18`,
                    color,
                    borderColor: `${color}40`,
                  }}
                >
                  <Tag size={9} />
                  <span>{(nodeData.category || 'custom').toUpperCase()}</span>
                </span>

                <span className="group-q-badge">{qCount} Questions</span>
              </div>

              <h4 className="group-title-text">{nodeData.title || 'Question Group'}</h4>
              {nodeData.titleBn && (
                <span className="group-title-bn bn-font">{nodeData.titleBn}</span>
              )}
            </div>
          </div>

          {/* Action Controls */}
          <div className="group-header-actions nodrag">
            <button
              type="button"
              className={`btn-group-toggle ${isCollapsed ? 'btn-expand' : 'btn-collapse'}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleHandler?.(id);
              }}
              title={
                isCollapsed
                  ? 'Expand all questions in this group'
                  : 'Collapse group into compact card'
              }
            >
              {isCollapsed ? (
                <>
                  <ChevronDown size={14} />
                  <span>Expand</span>
                </>
              ) : (
                <>
                  <ChevronUp size={14} />
                  <span>Collapse</span>
                </>
              )}
            </button>

            {ungroupHandler && (
              <button
                type="button"
                className="btn-group-icon-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  ungroupHandler(id);
                }}
                title="Ungroup (Convert back into independent questions)"
              >
                <Ungroup size={13} />
              </button>
            )}

            {deleteHandler && (
              <button
                type="button"
                className="btn-group-icon-sm btn-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteHandler(id);
                }}
                title="Delete this entire question group and its questions"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Expanded Container Body: provides a translucent framed area behind inner questions */}
        {!isCollapsed && (
          <div className="group-container-body">
            <div className="group-interior-guide">
              <span className="guide-dot" style={{ backgroundColor: color }}></span>
              <span className="guide-text">
                {qCount} Questions in Group • Sequential Execution
              </span>
            </div>
          </div>
        )}

        {/* Collapsed Preview Hint */}
        {isCollapsed && (
          <div className="group-collapsed-footer">
            <span className="collapsed-flow-hint">
              Sequence of {qCount} questions (Click Expand to view & edit)
            </span>
          </div>
        )}

        {/* Bottom Handle for outgoing flow */}
        <Handle
          type="source"
          position={Position.Bottom}
          id="out"
          className="flowchart-handle group-handle"
          style={{ background: color }}
        />
      </div>
    );
  }
);

GroupContainerNode.displayName = 'GroupContainerNode';
