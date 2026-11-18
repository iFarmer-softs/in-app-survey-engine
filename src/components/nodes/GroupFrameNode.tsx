import { memo, useCallback } from 'react';
import { NodeResizer, useReactFlow, useUpdateNodeInternals } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Layers, Sparkles, Trash } from 'lucide-react';
import type { GroupCategory } from '../../types/group';
import { isNodeInContainer, getNodeDimensions, getContainerBounds } from '../../utils/flowValidator';

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

export interface GroupFrameNodeProps extends NodeProps {
  onDeleteFrame?: (frameId: string) => void;
}

export const GroupFrameNode = memo(({ id, data, selected, onDeleteFrame }: GroupFrameNodeProps) => {
  const nodeData = data as unknown as GroupFrameNodeData;
  const isDropTarget = Boolean(nodeData.isDropTarget);
  const color = nodeData.color || '#8b5cf6';
  const activeColor = isDropTarget ? '#10b981' : color;
  const deleteHandler = onDeleteFrame || nodeData.onDeleteFrame;
  const { getNodes, setNodes, setEdges } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  const allNodes = getNodes();
  const currentFrameNode = allNodes.find((n) => n.id === id);
  const dynamicCount = currentFrameNode
    ? allNodes.filter((n) => isNodeInContainer(n, currentFrameNode, allNodes)).length
    : 0;
  const childCount = dynamicCount > 0 ? dynamicCount : (nodeData.questionCount ?? nodeData.questionIds?.length ?? 0);

  // Strict Non-Overlap Enforcement: Stop resizing if expanding into any adjacent frame
  const handleShouldResize = useCallback(
    (_event: any, params: { x: number; y: number; width: number; height: number }) => {
      const allNodes = getNodes();
      const GAP = 20;
      const otherFrames = allNodes.filter(
        (n) => (n.type === 'groupFrame' || n.type === 'groupContainer') && n.id !== id
      );

      for (const other of otherFrames) {
        const { fX: oX, fY: oY, fW: oW, fH: oH } = getContainerBounds(other);

        const collides =
          params.x < oX + oW + GAP &&
          params.x + params.width + GAP > oX &&
          params.y < oY + oH + GAP &&
          params.y + params.height + GAP > oY;

        if (collides) {
          return false;
        }
      }

      // Ensure resized boundary doesn't shrink past any child symbols from any direction
      const currentFrame = allNodes.find((n) => n.id === id);
      const childNodes = allNodes.filter((n) =>
        isNodeInContainer(n, currentFrame || ({ id } as any), allNodes)
      );

      for (const child of childNodes) {
        const { width: cW, height: cH } = getNodeDimensions(child);
        // Left border check: group left edge (+12px inset) cannot cross past child's left edge
        if (params.x + 12 > child.position.x) {
          return false;
        }
        // Right border check: group right edge (-12px inset) cannot cross past child's right edge
        if (params.x + params.width - 12 < child.position.x + cW) {
          return false;
        }
        // Top header check: group top header (+44px inset) cannot cross past child's top edge
        if (params.y + 44 > child.position.y) {
          return false;
        }
        // Bottom border check: group bottom edge (-12px inset) cannot cross past child's bottom edge
        if (params.y + params.height - 12 < child.position.y + cH) {
          return false;
        }
      }

      return true;
    },
    [getNodes, id]
  );

  // Automatically bring back inside any child item that was left outside after a resize
  const handleResizeEnd = useCallback(
    (_event: any, params: { x: number; y: number; width: number; height: number }) => {
      const allNodes = getNodes();
      const currentFrame = allNodes.find((n) => n.id === id);
      if (!currentFrame) return;

      const fX = params.x;
      const fY = params.y;
      const fW = params.width;
      const fH = params.height;

      const childNodes = allNodes.filter((n) =>
        isNodeInContainer(n, currentFrame, allNodes)
      );

      let nodesUpdated = false;
      const updatedNodes = allNodes.map((n) => {
        if (childNodes.some((c) => c.id === n.id)) {
          const { width: cW, height: cH } = getNodeDimensions(n);
          let newX = n.position.x;
          let newY = n.position.y;
          let clamped = false;

          if (newX < fX + 12) {
            newX = fX + 12;
            clamped = true;
          }
          if (newX + cW > fX + fW - 12) {
            newX = Math.max(fX + 12, fX + fW - 12 - cW);
            clamped = true;
          }
          if (newY < fY + 44) {
            newY = fY + 44;
            clamped = true;
          }
          if (newY + cH > fY + fH - 12) {
            newY = Math.max(fY + 44, fY + fH - 12 - cH);
            clamped = true;
          }

          if (clamped) {
            nodesUpdated = true;
            return {
              ...n,
              position: { x: newX, y: newY },
            };
          }
        }
        return n;
      });

      if (nodesUpdated) {
        setNodes(updatedNodes);
      }

      // Recompute connectors and trigger edge tick
      setEdges((edges) =>
        edges.map((e) => {
          const isRelated =
            e.source === id ||
            e.target === id ||
            childNodes.some((c) => c.id === e.source || c.id === e.target);
          if (isRelated) {
            return {
              ...e,
              data: {
                ...(e.data || {}),
                _groupTransformTick: Date.now(),
              },
            };
          }
          return e;
        })
      );

      if (updateNodeInternals) {
        try {
          updateNodeInternals(id);
          childNodes.forEach((c) => updateNodeInternals(c.id));
        } catch {
          // ignore if unmounted
        }
      }
    },
    [getNodes, setNodes, setEdges, updateNodeInternals, id]
  );

  return (
    <div
      className={`group-frame-boundary ${selected ? 'is-selected' : ''} ${isDropTarget ? 'is-drop-active' : ''
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
        pointerEvents: 'auto',
      }}
    >
      <NodeResizer
        minWidth={320}
        minHeight={200}
        isVisible={true}
        color={selected ? '#10b981' : color}
        lineClassName="group-frame-resize-line"
        handleClassName="group-frame-resize-handle"
        shouldResize={handleShouldResize}
        onResizeEnd={handleResizeEnd}
      />

      {/* Frame Header Bar */}
      <div
        className="group-frame-header"
        style={{
          borderBottomColor: `${activeColor}30`,
          backgroundColor: `${activeColor}15`,
          pointerEvents: 'auto',
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

        <div className="group-frame-header-right nodrag">
          <span className="group-frame-count-badge">
            {childCount} Item{childCount !== 1 ? 's' : ''} inside
          </span>
          {deleteHandler && (
            <button
              type="button"
              className="btn-group-icon-sm btn-delete"
              onClick={(e) => {
                e.stopPropagation();
                deleteHandler(id);
              }}
              title="Delete group area and all contents inside"
            >
              <Trash size={12} />
            </button>
          )}
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
    </div>
  );
});

GroupFrameNode.displayName = 'GroupFrameNode';
