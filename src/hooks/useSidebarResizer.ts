import { useState, useCallback, useEffect, useRef } from 'react';

const STORAGE_KEY_LEFT_WIDTH = 'survey_left_sidebar_width';
const STORAGE_KEY_RIGHT_WIDTH = 'survey_right_sidebar_width';

const DEFAULT_LEFT_WIDTH = 290;
const MIN_LEFT_WIDTH = 210;
const MAX_LEFT_WIDTH = 520;

const DEFAULT_RIGHT_WIDTH = 340;
const MIN_RIGHT_WIDTH = 260;
const MAX_RIGHT_WIDTH = 640;

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

  const [resizingSide, setResizingSide] = useState<'left' | 'right' | null>(null);

  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

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
    resizingSide,
    startResizingLeft,
    startResizingRight,
    resetLeftWidth,
    resetRightWidth,
  };
}

