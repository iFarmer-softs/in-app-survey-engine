import React, { useState, useRef, useEffect } from 'react';
import {
  MousePointer2,
  Hand,
  Crop,
  Plus,
  Minus,
  Maximize2,
  Sun,
  Moon,
  Save,
  Check,
  Loader2,
  Smartphone,
  Code2,
  Menu,
} from 'lucide-react';
import { useReactFlow, useViewport } from '@xyflow/react';
import type { ThemeMode, ResolvedTheme } from '../../hooks/useTheme';

export type CanvasToolMode = 'select' | 'hand' | 'drawArea';

export interface FigmaToolbarProps {
  activeMode: CanvasToolMode;
  onSelectMode: (mode: CanvasToolMode) => void;
  // Primary actions merged from top-right floating bar:
  theme?: ThemeMode;
  resolvedTheme?: ResolvedTheme;
  onCycleTheme?: () => void;
  onSave?: () => void;
  isSaving?: boolean;
  isSaved?: boolean;
  onOpenMobileModal?: () => void;
  onOpenJsonModal?: () => void;
}

export const FigmaToolbar: React.FC<FigmaToolbarProps> = ({
  activeMode,
  onSelectMode,
  theme,
  resolvedTheme = 'dark',
  onCycleTheme,
  onSave,
  isSaving = false,
  isSaved = false,
  onOpenMobileModal,
  onOpenJsonModal,
}) => {
  const { zoomIn, zoomOut, fitView, zoomTo } = useReactFlow();
  const { zoom } = useViewport();

  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 280);
  };

  const handleTogglePin = () => {
    setIsPinned((prev) => !prev);
  };

  // Close pinned state on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsPinned(false);
        setIsHovered(false);
      }
    };
    if (isPinned) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPinned]);

  const isExpanded = isHovered || isPinned;
  const zoomPercentage = Math.round((zoom || 1) * 100);

  return (
    <div className="figma-bottom-dock animate-in">
      <div className="figma-dock-pill">
        {/* Tool Mode: Select (V) */}
        <button
          type="button"
          className={`figma-tool-btn ${activeMode === 'select' ? 'is-active' : ''}`}
          onClick={() => onSelectMode('select')}
          data-tooltip="Select Tool (V)"
          data-tooltip-pos="top"
          aria-label="Select Tool (V)"
        >
          <MousePointer2 size={15} />
        </button>

        {/* Tool Mode: Hand / Pan (H) */}
        <button
          type="button"
          className={`figma-tool-btn ${activeMode === 'hand' ? 'is-active' : ''}`}
          onClick={() => onSelectMode('hand')}
          data-tooltip="Hand Tool: Pan canvas (H / Space)"
          data-tooltip-pos="top"
          aria-label="Hand Tool (H)"
        >
          <Hand size={15} />
        </button>

        {/* Tool Mode: Draw Area Frame (F) */}
        <button
          type="button"
          className={`figma-tool-btn ${activeMode === 'drawArea' ? 'is-active' : ''}`}
          onClick={() => onSelectMode('drawArea')}
          data-tooltip="Draw Group Area (F)"
          data-tooltip-pos="top"
          aria-label="Draw Group Area (F)"
        >
          <Crop size={15} />
        </button>

        <div className="figma-dock-divider" />

        {/* Zoom Controls */}
        <div className="figma-zoom-group">
          <button
            type="button"
            className="figma-zoom-btn"
            onClick={() => zoomOut({ duration: 200 })}
            data-tooltip="Zoom Out (Ctrl -)"
            data-tooltip-pos="top"
            aria-label="Zoom Out"
          >
            <Minus size={13} />
          </button>

          <button
            type="button"
            className="figma-zoom-percent-btn"
            onClick={() => zoomTo(1, { duration: 250 })}
            data-tooltip="Reset Zoom (100%)"
            data-tooltip-pos="top"
            aria-label="Reset Zoom to 100%"
          >
            {zoomPercentage}%
          </button>

          <button
            type="button"
            className="figma-zoom-btn"
            onClick={() => zoomIn({ duration: 200 })}
            data-tooltip="Zoom In (Ctrl +)"
            data-tooltip-pos="top"
            aria-label="Zoom In"
          >
            <Plus size={13} />
          </button>

          <button
            type="button"
            className="figma-zoom-btn figma-fit-btn"
            onClick={() => fitView({ padding: 0.2, duration: 300 })}
            data-tooltip="Fit Canvas to Screen (Shift 1)"
            data-tooltip-pos="top"
            aria-label="Fit Canvas to Screen"
          >
            <Maximize2 size={13} />
          </button>
        </div>

        {/* Primary Actions: Inside Bottom Dock Pill, Expands on Hover */}
        {(onCycleTheme || onSave || onOpenMobileModal || onOpenJsonModal) && (
          <>
            <div className="figma-dock-divider" />
            <div
              className={`figma-expandable-dock-section ${isExpanded ? 'is-expanded' : ''}`}
              ref={menuRef}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {/* Hamburger Menu Trigger Icon */}
              <button
                type="button"
                className={`figma-action-btn figma-hamburger-btn ${isExpanded ? 'is-active' : ''}`}
                onClick={handleTogglePin}
                data-tooltip={isExpanded ? 'Collapse Actions' : 'Expand Actions'}
                data-tooltip-pos="top"
                aria-label="Actions Menu"
              >
                <Menu size={16} />
              </button>

              {/* Four Action Icons: Expand and Collapse inline inside bottom bar */}
              <div className="figma-inline-actions-tray" role="menu">
                {/* 1. Theme Toggle */}
                {onCycleTheme && (
                  <button
                    type="button"
                    className="figma-action-btn"
                    onClick={onCycleTheme}
                    data-tooltip={`Theme: ${(theme || 'system').toUpperCase()} (${resolvedTheme === 'light' ? 'Light' : 'Dark'})`}
                    data-tooltip-pos="top"
                    aria-label="Toggle Theme"
                  >
                    {resolvedTheme === 'light' ? (
                      <Sun size={15} className="text-amber-400" />
                    ) : (
                      <Moon size={15} className="text-cyan-300" />
                    )}
                  </button>
                )}

                {/* 2. Save Flowchart */}
                {onSave && (
                  <button
                    type="button"
                    className={`figma-action-btn btn-save ${isSaved ? 'is-saved' : ''} ${isSaving ? 'is-saving' : ''}`}
                    onClick={onSave}
                    disabled={isSaving}
                    data-tooltip="Save Flowchart (Ctrl+S)"
                    data-tooltip-pos="top"
                    aria-label="Save Flowchart"
                  >
                    {isSaving ? (
                      <Loader2 size={15} className="animate-spin text-emerald-400" />
                    ) : isSaved ? (
                      <Check size={16} className="text-emerald-400" />
                    ) : (
                      <Save size={15} />
                    )}
                  </button>
                )}

                {/* 3. Mobile Preview */}
                {onOpenMobileModal && (
                  <button
                    type="button"
                    className="figma-action-btn"
                    onClick={onOpenMobileModal}
                    data-tooltip="Mobile App Preview"
                    data-tooltip-pos="top"
                    aria-label="Mobile App Preview"
                  >
                    <Smartphone size={15} />
                  </button>
                )}

                {/* 4. Generate JSON */}
                {onOpenJsonModal && (
                  <button
                    type="button"
                    className="figma-action-btn btn-primary-icon"
                    onClick={onOpenJsonModal}
                    data-tooltip="Generate Survey JSON"
                    data-tooltip-pos="top"
                    aria-label="Generate Survey JSON"
                  >
                    <Code2 size={15} />
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

