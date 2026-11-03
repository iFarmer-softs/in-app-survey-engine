import { useState, useCallback, useEffect, useRef } from 'react';

const STORAGE_KEY_LEFT_WIDTH = 'survey_left_sidebar_width';
const STORAGE_KEY_RIGHT_WIDTH = 'survey_right_sidebar_width';
const STORAGE_KEY_BOTTOM_HEIGHT = 'survey_bottom_dock_height';

const DEFAULT_LEFT_WIDTH = 290;
const MIN_LEFT_WIDTH = 210;
const MAX_LEFT_WIDTH = 520;

const DEFAULT_RIGHT_WIDTH = 340;
const MIN_RIGHT_WIDTH = 260;
const MAX_RIGHT_WIDTH = 640;

const DEFAULT_BOTTOM_HEIGHT = 260;
const MIN_BOTTOM_HEIGHT = 160;
const MAX_BOTTOM_HEIGHT = 500;

export function useSidebarResizer() {
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LEFT_WIDTH);
      const parsed = saved ? parseInt(saved, 10) : NaN;
      if (!isNaN(parsed) && parsed >= MIN_LEFT_WIDTH && parsed <= MAX_LEFT_WIDTH) {
        return parsed;
      }
    } catch {}
    return DEFAULT_LEFT_WIDTH;
  });

  const [rightWidth, setRightWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RIGHT_WIDTH);
      const parsed = saved ? parseInt(saved, 10) : NaN;
      if (!isNaN(parsed) && parsed >= MIN_RIGHT_WIDTH && parsed <= MAX_RIGHT_WIDTH) {
        return parsed;
      }
    } catch {}
    return DEFAULT_RIGHT_WIDTH;
  });

  const [bottomHeight, setBottomHeight] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_BOTTOM_HEIGHT);
      const parsed = saved ? parseInt(saved, 10) : NaN;
      if (!isNaN(parsed) && parsed >= MIN_BOTTOM_HEIGHT && parsed <= MAX_BOTTOM_HEIGHT) {
        return parsed;
      }
    } catch {}
    return DEFAULT_BOTTOM_HEIGHT;
  });

  const [resizingSide, setResizingSide] = useState<'left' | 'right' | 'bottom' | null>(null);

  const startXRef = useRef<number>(0);
  const startYRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);
  const startHeightRef = useRef<number>(0);

  // Left Sidebar Drag Handler
  const startResizingLeft = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setResizingSide('left');
      startXRef.current = e.clientX;
      startWidthRef.current = leftWidth;
      document.body.classList.add('is-resizing-sidebar');
    },
    [leftWidth]
  );

  // Right Sidebar Drag Handler
  const startResizingRight = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setResizingSide('right');
      startXRef.current = e.clientX;
      startWidthRef.current = rightWidth;
      document.body.classList.add('is-resizing-sidebar');
    },
    [rightWidth]
  );

  // Bottom Dock Drag Handler
  const startResizingBottom = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setResizingSide('bottom');
      startYRef.current = e.clientY;
      startHeightRef.current = bottomHeight;
      document.body.classList.add('is-resizing-sidebar');
    },
    [bottomHeight]
  );

  // Reset to default on double click
  const resetLeftWidth = useCallback(() => {
    setLeftWidth(DEFAULT_LEFT_WIDTH);
    try {
      localStorage.setItem(STORAGE_KEY_LEFT_WIDTH, String(DEFAULT_LEFT_WIDTH));
    } catch {}
    setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
  }, []);

  const resetRightWidth = useCallback(() => {
    setRightWidth(DEFAULT_RIGHT_WIDTH);
    try {
      localStorage.setItem(STORAGE_KEY_RIGHT_WIDTH, String(DEFAULT_RIGHT_WIDTH));
    } catch {}
    setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
  }, []);

  const resetBottomHeight = useCallback(() => {
    setBottomHeight(DEFAULT_BOTTOM_HEIGHT);
    try {
      localStorage.setItem(STORAGE_KEY_BOTTOM_HEIGHT, String(DEFAULT_BOTTOM_HEIGHT));
    } catch {}
    setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
  }, []);

  // Global mousemove and mouseup listeners during active dragging
  useEffect(() => {
    if (!resizingSide) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (resizingSide === 'left') {
        const delta = e.clientX - startXRef.current;
        const newWidth = Math.min(
          MAX_LEFT_WIDTH,
          Math.max(MIN_LEFT_WIDTH, startWidthRef.current + delta)
        );
        setLeftWidth(newWidth);
      } else if (resizingSide === 'right') {
        const delta = startXRef.current - e.clientX;
        const newWidth = Math.min(
          MAX_RIGHT_WIDTH,
          Math.max(MIN_RIGHT_WIDTH, startWidthRef.current + delta)
        );
        setRightWidth(newWidth);
      } else if (resizingSide === 'bottom') {
        const delta = startYRef.current - e.clientY;
        const newHeight = Math.min(
          MAX_BOTTOM_HEIGHT,
          Math.max(MIN_BOTTOM_HEIGHT, startHeightRef.current + delta)
        );
        setBottomHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      if (resizingSide === 'left') {
        try {
          setLeftWidth((w) => {
            localStorage.setItem(STORAGE_KEY_LEFT_WIDTH, String(w));
            return w;
          });
        } catch {}
      } else if (resizingSide === 'right') {
        try {
          setRightWidth((w) => {
            localStorage.setItem(STORAGE_KEY_RIGHT_WIDTH, String(w));
            return w;
          });
        } catch {}
      } else if (resizingSide === 'bottom') {
        try {
          setBottomHeight((h) => {
            localStorage.setItem(STORAGE_KEY_BOTTOM_HEIGHT, String(h));
            return h;
          });
        } catch {}
      }

      setResizingSide(null);
      document.body.classList.remove('is-resizing-sidebar');
      window.dispatchEvent(new Event('resize'));
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.classList.remove('is-resizing-sidebar');
    };
  }, [resizingSide]);

  return {
    leftWidth,
    rightWidth,
    bottomHeight,
    resizingSide,
    startResizingLeft,
    startResizingRight,
    startResizingBottom,
    resetLeftWidth,
    resetRightWidth,
    resetBottomHeight,
  };
}

