// Simple toast notification system
type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

let toasts: Toast[] = [];
let listeners: ((toasts: Toast[]) => void)[] = [];

export function toast(message: string, type: ToastType = 'info', duration: number = 3000) {
  const id = Math.random().toString(36).substring(2, 9);
  const newToast: Toast = { id, message, type, duration };
  
  toasts = [...toasts, newToast];
  notifyListeners();
  
  if (duration > 0) {
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }
  
  return id;
}

export function removeToast(id: string) {
  toasts = toasts.filter(toast => toast.id !== id);
  notifyListeners();
}

export function clearToasts() {
  toasts = [];
  notifyListeners();
}

export function getToasts() {
  return toasts;
}

export function subscribe(listener: (toasts: Toast[]) => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

function notifyListeners() {
  listeners.forEach(listener => listener([...toasts]));
}

// Convenience methods
export const toastSuccess = (message: string, duration?: number) => toast(message, 'success', duration);
export const toastError = (message: string, duration?: number) => toast(message, 'error', duration);
export const toastInfo = (message: string, duration?: number) => toast(message, 'info', duration);