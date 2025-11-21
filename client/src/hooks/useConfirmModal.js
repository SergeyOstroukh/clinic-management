import { useState, useCallback } from 'react';

export const useConfirmModal = () => {
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    onCancel: null,
    confirmText: 'Да',
    cancelText: 'Отмена',
    confirmButtonClass: 'btn-primary'
  });

  const showConfirm = useCallback((options) => {
    return new Promise((resolve) => {
      setConfirmModal({
        isOpen: true,
        title: options.title || 'Подтвердите действие',
        message: options.message,
        confirmText: options.confirmText || 'Да',
        cancelText: options.cancelText || 'Отмена',
        confirmButtonClass: options.confirmButtonClass || 'btn-primary',
        onConfirm: () => {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          if (options.onConfirm) {
            options.onConfirm();
          }
          resolve(true);
        },
        onCancel: () => {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          if (options.onCancel) {
            options.onCancel();
          }
          resolve(false);
        }
      });
    });
  }, []);

  const closeModal = useCallback(() => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  }, []);

  return {
    confirmModal,
    showConfirm,
    closeModal
  };
};

