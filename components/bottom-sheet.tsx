'use client';

import { useEffect, useState, useRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  snapPoints?: number[]; // Percentage heights [50, 90] etc
}

export function BottomSheet({
  isOpen,
  onClose,
  children,
  title,
  snapPoints = [90],
}: BottomSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [currentSnapIndex, setCurrentSnapIndex] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const startDragYRef = useRef(0);

  // Check if mobile on mount
  useEffect(() => {
    setMounted(true);
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleDragStart = (clientY: number) => {
    setIsDragging(true);
    startYRef.current = clientY;
    startDragYRef.current = dragY;
  };

  const handleDragMove = (clientY: number) => {
    if (!isDragging) return;
    const deltaY = clientY - startYRef.current;
    const newDragY = Math.max(0, startDragYRef.current + deltaY);
    setDragY(newDragY);
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    // If dragged down more than 100px, close
    if (dragY > 100) {
      onClose();
      setDragY(0);
      return;
    }

    // Snap back to position
    setDragY(0);
  };

  // Mouse events
  const onMouseDown = (e: React.MouseEvent) => {
    if (!isMobile) return;
    handleDragStart(e.clientY);
  };

  const onMouseMove = (e: MouseEvent) => {
    handleDragMove(e.clientY);
  };

  const onMouseUp = () => {
    handleDragEnd();
  };

  // Touch events
  const onTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    handleDragStart(e.touches[0].clientY);
  };

  const onTouchMove = (e: TouchEvent) => {
    handleDragMove(e.touches[0].clientY);
  };

  const onTouchEnd = () => {
    handleDragEnd();
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.addEventListener('touchmove', onTouchMove);
      document.addEventListener('touchend', onTouchEnd);
    }
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [isDragging, dragY]);

  if (!mounted || !isOpen) return null;

  const content = (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 transition-opacity duration-300 z-40 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`fixed z-50 bg-[#0a0a0a] border border-[#1a1a1a] shadow-2xl transition-all duration-300 ${
          isMobile
            ? 'bottom-0 left-0 right-0 rounded-t-2xl'
            : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl w-[90vw] max-w-lg max-h-[80vh]'
        }`}
        style={
          isMobile
            ? {
                transform: `translateY(${dragY}px)`,
                height: `${snapPoints[currentSnapIndex]}%`,
                maxHeight: `${snapPoints[currentSnapIndex]}%`,
              }
            : {}
        }
      >
        {/* Drag Handle (mobile only) */}
        {isMobile && (
          <div
            className="flex justify-center py-3 cursor-grab active:cursor-grabbing"
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
          >
            <div className="w-12 h-1.5 bg-[#333] rounded-full" />
          </div>
        )}

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a]">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-[#888]" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className={`overflow-y-auto ${isMobile ? 'max-h-[calc(100%-4rem)]' : ''} p-6`}>
          {children}
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
}
