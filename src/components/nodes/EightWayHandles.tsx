import React from 'react';
import { Handle, Position } from '@xyflow/react';

export interface EightWayHandlesProps {
  topCenterId?: string;
  bottomCenterId?: string;
  topLeftId?: string;
  topRightId?: string;
  bottomLeftId?: string;
  bottomRightId?: string;
  leftId?: string;
  rightId?: string;
  hideRight?: boolean;
  hideBottom?: boolean;
  hideLeft?: boolean;
  hideTop?: boolean;
}

/**
 * Symmetrical 8-Point Compass Anchor Grid:
 * - 4 Edge Midpoints: Top (N), Bottom (S), Left (W), Right (E)
 * - 4 Corner Vertices: Top-Left (NW), Top-Right (NE), Bottom-Left (SW), Bottom-Right (SE)
 */
export const EightWayHandles: React.FC<EightWayHandlesProps> = ({
  topCenterId = 'in',
  bottomCenterId = 'default-next',
  topLeftId = 'in-tl',
  topRightId = 'in-tr',
  bottomLeftId = 'out-bl',
  bottomRightId = 'out-br',
  leftId = 'in-left',
  rightId = 'out-right',
  hideRight = false,
  hideBottom = false,
  hideLeft = false,
  hideTop = false,
}) => {
  return (
    <>
      {/* ========================================================
          1. FOUR CORNER VERTICES (NW, NE, SW, SE)
         ======================================================== */}
      {/* Corner 1: Top-Left (NW) Vertex */}
      {!hideTop && !hideLeft && (
        <Handle
          type="target"
          position={Position.Top}
          id={topLeftId}
          style={{ left: 0 }}
          className="node-handle target-handle aux-handle corner-handle corner-tl"
          title="Top-Left Corner Anchor (NW)"
        />
      )}

      {/* Corner 2: Top-Right (NE) Vertex */}
      {!hideTop && !hideRight && (
        <Handle
          type="target"
          position={Position.Top}
          id={topRightId}
          style={{ left: '100%' }}
          className="node-handle target-handle aux-handle corner-handle corner-tr"
          title="Top-Right Corner Anchor (NE)"
        />
      )}

      {/* Corner 3: Bottom-Left (SW) Vertex */}
      {!hideBottom && !hideLeft && (
        <Handle
          type="source"
          position={Position.Bottom}
          id={bottomLeftId}
          style={{ left: 0 }}
          className="node-handle source-handle aux-handle corner-handle corner-bl"
          title="Bottom-Left Corner Anchor (SW)"
        />
      )}

      {/* Corner 4: Bottom-Right (SE) Vertex */}
      {!hideBottom && !hideRight && (
        <Handle
          type="source"
          position={Position.Bottom}
          id={bottomRightId}
          style={{ left: '100%' }}
          className="node-handle source-handle aux-handle corner-handle corner-br"
          title="Bottom-Right Corner Anchor (SE)"
        />
      )}

      {/* ========================================================
          2. FOUR EDGE MIDPOINTS (N, S, W, E)
         ======================================================== */}
      {/* Midpoint 5: Top-Center (North - Primary Input) */}
      {!hideTop && (
        <Handle
          type="target"
          position={Position.Top}
          id={topCenterId}
          style={{ left: '50%' }}
          className="node-handle target-handle midpoint-handle"
          title="Top-Center Anchor (North Default Entry)"
        />
      )}

      {/* Midpoint 6: Bottom-Center (South - Primary Output) */}
      {!hideBottom && (
        <Handle
          type="source"
          position={Position.Bottom}
          id={bottomCenterId}
          style={{ left: '50%' }}
          className="node-handle source-handle midpoint-handle"
          title="Bottom-Center Anchor (South Default Exit)"
        />
      )}

      {/* Midpoint 7: Left-Center (West - Lateral Entry) */}
      {!hideLeft && (
        <Handle
          type="target"
          position={Position.Left}
          id={leftId}
          style={{ top: '50%' }}
          className="node-handle target-handle aux-handle midpoint-handle"
          title="Left-Center Anchor (West Lateral Entry)"
        />
      )}

      {/* Midpoint 8: Right-Center (East - Lateral Exit) */}
      {!hideRight && (
        <Handle
          type="source"
          position={Position.Right}
          id={rightId}
          style={{ top: '50%' }}
          className="node-handle source-handle aux-handle midpoint-handle"
          title="Right-Center Anchor (East Lateral Exit)"
        />
      )}
    </>
  );
};
