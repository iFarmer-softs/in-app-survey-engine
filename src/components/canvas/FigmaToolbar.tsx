import React from 'react';
import {
  MousePointer2,
  Hand,
  Crop,
  Plus,
  Minus,
  Maximize2,
} from 'lucide-react';
import { useReactFlow, useViewport } from '@xyflow/react';

export type CanvasToolMode = 'select' | 'hand' | 'drawArea';

interface FigmaToolbarProps {
  activeMode: CanvasToolMode;
  onSelectMode: (mode: CanvasToolMode) => void;
}

export const FigmaToolbar: React.FC<FigmaToolbarProps> = ({
  activeMode,
  onSelectMode,
}) => {
  const { zoomIn, zoomOut, fitView, zoomTo } = useReactFlow();
  const { zoom } = useViewport();

  const zoomPercentage = Math.round((zoom || 1) * 100);

  return (
    <div className="figma-bottom-dock animate-in">
      <div className="figma-dock-pill">
        {/* Tool Mode: Select (V) */}
        <button
          type="button"
          className={`figma-tool-btn ${activeMode === 'select' ? 'is-active' : ''}`}
          onClick={() => onSelectMode('select')}
          title="Select Tool: Click, drag, select elements (V)"
        >
          <MousePointer2 size={15} />
          <span className="figma-tool-label">Select</span>
          <span className="figma-tool-key">V</span>
        </button>

        {/* Tool Mode: Hand / Pan (H) */}
        <button
          type="button"
          className={`figma-tool-btn ${activeMode === 'hand' ? 'is-active' : ''}`}
          onClick={() => onSelectMode('hand')}
          title="Hand Tool: Pan the canvas smoothly (H or hold Space)"
        >
          <Hand size={15} />
          <span className="figma-tool-label">Hand</span>
          <span className="figma-tool-key">H</span>
        </button>

        {/* Tool Mode: Draw Area Frame (F) */}
        <button
          type="button"
          className={`figma-tool-btn ${activeMode === 'drawArea' ? 'is-active' : ''}`}
          onClick={() => onSelectMode('drawArea')}
          title="Draw Group Area: Click and drag on canvas to box questions into an area (F)"
        >
          <Crop size={15} />
          <span className="figma-tool-label">Area</span>
          <span className="figma-tool-key">F</span>
        </button>

        <div className="figma-dock-divider" />

        {/* Zoom Controls */}
        <div className="figma-zoom-group">
          <button
            type="button"
            className="figma-zoom-btn"
            onClick={() => zoomOut({ duration: 200 })}
            title="Zoom Out (Ctrl -)"
          >
            <Minus size={13} />
          </button>

          <button
            type="button"
            className="figma-zoom-percent-btn"
            onClick={() => zoomTo(1, { duration: 250 })}
            title="Reset Zoom to 100%"
          >
            {zoomPercentage}%
          </button>

          <button
            type="button"
            className="figma-zoom-btn"
            onClick={() => zoomIn({ duration: 200 })}
            title="Zoom In (Ctrl +)"
          >
            <Plus size={13} />
          </button>

          <button
            type="button"
            className="figma-zoom-btn figma-fit-btn"
            onClick={() => fitView({ padding: 0.2, duration: 300 })}
            title="Fit Canvas to Screen (Shift 1)"
          >
            <Maximize2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

