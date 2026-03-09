'use client';

import { useState, useRef, useEffect } from 'react';
import { Trash2, Edit } from 'lucide-react';

interface SwipeableCardProps {
  children: React.ReactNode;
  onDelete?: () => void;
  onEdit?: () => void;
  deleteThreshold?: number;
  editThreshold?: number;
  className?: string;
}

export function SwipeableCard({
  children,
  onDelete,
  onEdit,
  deleteThreshold = 100,
  editThreshold = 100,
  className = '',
}: SwipeableCardProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    currentX.current = offsetX;
    setIsDragging(true);
    setIsAnimating(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    const deltaX = e.touches[0].clientX - startX.current;
    const newOffset = currentX.current + deltaX;

    // Add resistance at extremes
    const resistance = 0.5;
    if (Math.abs(newOffset) > 150) {
      setOffsetX(currentX.current + deltaX * resistance);
    } else {
      setOffsetX(newOffset);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setIsAnimating(true);

    // Swipe left (delete)
    if (offsetX < -deleteThreshold && onDelete) {
      onDelete();
      // Reset after action
      setTimeout(() => {
        setOffsetX(0);
      }, 300);
    }
    // Swipe right (edit)
    else if (offsetX > editThreshold && onEdit) {
      onEdit();
      // Reset after action
      setTimeout(() => {
        setOffsetX(0);
      }, 300);
    }
    // Return to center
    else {
      setOffsetX(0);
    }
  };

  // Mouse events for desktop testing
  const handleMouseDown = (e: React.MouseEvent) => {
    startX.current = e.clientX;
    currentX.current = offsetX;
    setIsDragging(true);
    setIsAnimating(false);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - startX.current;
    const newOffset = currentX.current + deltaX;

    const resistance = 0.5;
    if (Math.abs(newOffset) > 150) {
      setOffsetX(currentX.current + deltaX * resistance);
    } else {
      setOffsetX(newOffset);
    }
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    
    setIsDragging(false);
    setIsAnimating(true);

    if (offsetX < -deleteThreshold && onDelete) {
      onDelete();
      setTimeout(() => {
        setOffsetX(0);
      }, 300);
    } else if (offsetX > editThreshold && onEdit) {
      onEdit();
      setTimeout(() => {
        setOffsetX(0);
      }, 300);
    } else {
      setOffsetX(0);
    }
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, offsetX]);

  const deleteRevealed = offsetX < -20;
  const editRevealed = offsetX > 20;
  const deleteProgress = Math.min(Math.abs(offsetX) / deleteThreshold, 1);
  const editProgress = Math.min(offsetX / editThreshold, 1);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Background actions */}
      <div className="absolute inset-0 flex items-center justify-between px-4">
        {/* Edit action (left side, revealed by swiping right) */}
        {onEdit && (
          <div
            className="flex items-center gap-2 text-blue-500"
            style={{
              opacity: editProgress,
              transform: `scale(${0.8 + editProgress * 0.2})`,
              transition: isAnimating ? 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
            }}
          >
            <Edit className="h-5 w-5" />
            <span className="font-semibold">Edit</span>
          </div>
        )}
        
        {/* Delete action (right side, revealed by swiping left) */}
        {onDelete && (
          <div
            className="flex items-center gap-2 text-red-500 ml-auto"
            style={{
              opacity: deleteProgress,
              transform: `scale(${0.8 + deleteProgress * 0.2})`,
              transition: isAnimating ? 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
            }}
          >
            <span className="font-semibold">Delete</span>
            <Trash2 className="h-5 w-5" />
          </div>
        )}
      </div>

      {/* Card content */}
      <div
        ref={cardRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isAnimating ? 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
          cursor: isDragging ? 'grabbing' : 'grab',
          touchAction: 'pan-y', // Allow vertical scrolling
        }}
        className="relative z-10"
      >
        {children}
      </div>
    </div>
  );
}
