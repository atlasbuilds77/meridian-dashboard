'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      
      {/* Content container */}
      <div className="relative z-50">
        {children}
      </div>
    </div>
  );
}

interface DialogContentProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogContent({ children, className }: DialogContentProps) {
  return (
    <div
      className={cn(
        'relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-2xl',
        className
      )}
    >
      {children}
    </div>
  );
}

interface DialogHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogHeader({ children, className }: DialogHeaderProps) {
  return (
    <div className={cn('mb-4 space-y-1.5', className)}>
      {children}
    </div>
  );
}

interface DialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogTitle({ children, className }: DialogTitleProps) {
  return (
    <h2 className={cn('text-lg font-semibold leading-none tracking-tight', className)}>
      {children}
    </h2>
  );
}

interface DialogDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogDescription({ children, className }: DialogDescriptionProps) {
  return (
    <p className={cn('text-sm text-muted-foreground', className)}>
      {children}
    </p>
  );
}

interface DialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogFooter({ children, className }: DialogFooterProps) {
  return (
    <div className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 ${className || ''}`}>
      {children}
    </div>
  );
}
