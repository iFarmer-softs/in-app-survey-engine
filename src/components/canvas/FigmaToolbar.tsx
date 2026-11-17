import React, { useState, useRef, useEffect } from 'react';
import {
  MousePointer2,
  Hand,
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
  const [isZoomMenuOpen, setIsZoomMenuOpen] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoomMenuRef = useRef<HTMLDivElement>(null);

  // Close zoom menu on outside click
  useEffect(() => {
    const handleZoomOutside = (e: MouseEvent) => {
      if (zoomMenuRef.current && !zoomMenuRef.current.contains(e.target as Node)) {
        setIsZoomMenuOpen(false);
      }
    };
    if (isZoomMenuOpen) {
      document.addEventListener('mousedown', handleZoomOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleZoomOutside);
    };
  }, [isZoomMenuOpen]);

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
    setIsPinned((prev) => {
      const next = !prev;
      if (!next) {
        setIsHovered(false);
      }
      return next;
    });
  };

  // Close pinned state on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('.figma-hamburger-btn, .figma-dock-action')) {
        return;
      }
      setIsPinned(false);
      setIsHovered(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPinned(false);
        setIsHovered(false);
      }
    };

    if (isPinned || isHovered) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPinned, isHovered]);

  const isExpanded = isHovered || isPinned;
  const zoomPercentage = Math.round((zoom || 1) * 100);

  return (
    <div className="figma-bottom-dock animate-in">
      <div className={`figma-dock-pill ${isExpanded ? 'is-actions-expanded' : ''}`}>
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

        <div className="figma-dock-divider" />

        {/* Zoom Controls */}
        <div className="figma-zoom-group">
          <button
            type="button"
            className="figma-zoom-btn"
            onClick={() => zoomOut({ duration: 150 })}
            data-tooltip="Zoom Out (Ctrl -)"
            data-tooltip-pos="top"
            aria-label="Zoom Out"
          >
            <Minus size={13} />
          </button>

          <div className="figma-zoom-dropdown-container" ref={zoomMenuRef}>
            <button
              type="button"
              className={`figma-zoom-percent-btn ${isZoomMenuOpen ? 'is-active' : ''}`}
              onClick={() => setIsZoomMenuOpen((prev) => !prev)}
              onDoubleClick={() => {
                zoomTo(1, { duration: 200 });
                setIsZoomMenuOpen(false);
              }}
              data-tooltip="Reset Zoom (100%)"
              data-tooltip-pos="top"
              aria-label="Reset Zoom to 100%"
            >
              {zoomPercentage}%
            </button>

            {isZoomMenuOpen && (
              <div className="figma-zoom-dropdown-menu animate-in">
                <div className="figma-zoom-menu-header">Zoom Presets</div>
                {[
                  { label: '25%', zoom: 0.25 },
                  { label: '50%', zoom: 0.5 },
                  { label: '75%', zoom: 0.75 },
                  { label: '100%', zoom: 1.0, shortcut: 'Shift 0' },
                  { label: '125%', zoom: 1.25 },
                  { label: '150%', zoom: 1.5 },
                  { label: '200%', zoom: 2.0 },
                  { label: '300%', zoom: 3.0 },
                  { label: '400%', zoom: 4.0 },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className={`figma-zoom-menu-item ${
                      Math.abs((zoom || 1) - item.zoom) < 0.05 ? 'is-active' : ''
                    }`}
                    onClick={() => {
                      zoomTo(item.zoom, { duration: 200 });
                      setIsZoomMenuOpen(false);
                    }}
                  >
                    <span>{item.label}</span>
                    {item.shortcut && <span className="figma-zoom-menu-shortcut">{item.shortcut}</span>}
                  </button>
                ))}
                <div className="figma-zoom-menu-divider" />
                <button
                  type="button"
                  className="figma-zoom-menu-item"
                  onClick={() => {
                    fitView({ padding: 0.2, duration: 300 });
                    setIsZoomMenuOpen(false);
                  }}
                >
                  <span>Fit to Screen</span>
                  <span className="figma-zoom-menu-shortcut">Shift 1</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="figma-zoom-btn"
            onClick={() => zoomIn({ duration: 150 })}
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

        {/* Primary Actions: Integrated directly into figma-dock-pill, smoothly handled by hamburger */}
        {(onCycleTheme || onSave || onOpenMobileModal || onOpenJsonModal) && (
          <>
            <div className="figma-dock-divider" />

            {/* Hamburger Menu Trigger Icon */}
            <button
              type="button"
              className={`figma-action-btn figma-hamburger-btn ${isExpanded ? 'is-active' : ''}`}
              onClick={handleTogglePin}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              data-tooltip={isExpanded ? 'Collapse Actions' : 'Expand Actions'}
              data-tooltip-pos="top"
              aria-label="Actions Menu"
            >
              <Menu size={16} />
            </button>

            {/* 1. Theme Toggle */}
            {onCycleTheme && (
              <button
                type="button"
                className={`figma-action-btn figma-dock-action ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}
                onClick={onCycleTheme}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                data-tooltip={`Theme: ${(theme || 'system').toUpperCase()} (${resolvedTheme === 'light' ? 'Light' : 'Dark'})`}
                data-tooltip-pos="top"
                aria-label="Toggle Theme"
                tabIndex={isExpanded ? 0 : -1}
                aria-hidden={!isExpanded}
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
                className={`figma-action-btn btn-save figma-dock-action ${isExpanded ? 'is-expanded' : 'is-collapsed'} ${isSaved ? 'is-saved' : ''} ${isSaving ? 'is-saving' : ''}`}
                onClick={onSave}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                disabled={isSaving}
                data-tooltip="Save Flowchart (Ctrl+S)"
                data-tooltip-pos="top"
                aria-label="Save Flowchart"
                tabIndex={isExpanded ? 0 : -1}
                aria-hidden={!isExpanded}
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
                className={`figma-action-btn figma-dock-action ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}
                onClick={onOpenMobileModal}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                data-tooltip="Mobile App Preview"
                data-tooltip-pos="top"
                aria-label="Mobile App Preview"
                tabIndex={isExpanded ? 0 : -1}
                aria-hidden={!isExpanded}
              >
                <Smartphone size={15} />
              </button>
            )}

            {/* 4. Generate JSON */}
            {onOpenJsonModal && (
              <button
                type="button"
                className={`figma-action-btn btn-primary-icon figma-dock-action ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}
                onClick={onOpenJsonModal}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                data-tooltip="Generate Survey JSON"
                data-tooltip-pos="top"
                aria-label="Generate Survey JSON"
                tabIndex={isExpanded ? 0 : -1}
                aria-hidden={!isExpanded}
              >
                <Code2 size={15} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

