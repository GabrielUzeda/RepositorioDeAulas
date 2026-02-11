// global/alert-modals.js

/**
 * Helper function to show a modal and return a promise that resolves when closed.
 */
function showModal(modalId, message) {
  return new Promise((resolve) => {
    const modal = document.getElementById(modalId);
    if (!modal) {
        resolve(false);
        return;
    }

    if (message) {
      const msgElement = document.getElementById(`${modalId}Message`);
      if (msgElement) msgElement.textContent = message;
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    // Configurar botões para resolver a promise
    const okBtn = modal.querySelector('.ok-btn');
    if (okBtn) {
        okBtn.onclick = () => {
            hideModal(modalId);
            resolve(true);
        };
    }

    const cancelBtn = modal.querySelector('.cancel-btn');
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            hideModal(modalId);
            resolve(false);
        };
    }

    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
      modalContent.classList.add('modal-enter');
      setTimeout(() => modalContent.classList.add('modal-enter-active'), 10);
    }
  });
}

/**
 * Fecha um modal específico.
 */
export function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  const modalContent = modal.querySelector('.modal-content');
  if (modalContent) {
    modalContent.classList.add('modal-exit');
    modalContent.classList.remove('modal-enter-active');
    setTimeout(() => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      modalContent.classList.remove('modal-exit');
    }, 300);
  } else {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

export async function showSuccessModal(message = 'Operação concluída com sucesso!') {
  return await showModal('successModal', message);
}

export function hideSuccessModal() {
  hideModal('successModal');
}

export async function showErrorModal(message = 'Ocorreu um erro inesperado.') {
  return await showModal('errorModal', message);
}

export function hideErrorModal() {
  hideModal('errorModal');
}

export async function showConfirmModal(message = 'Deseja realmente prosseguir?') {
    return await showModal('confirmModal', message);
}

export function showLoadingModal(message = 'Carregando...') {
    const modal = document.getElementById('loadingModal');
    if (modal && message) {
        const p = modal.querySelector('p');
        if (p) p.textContent = message;
    }
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

export function hideLoadingModal() {
  const modal = document.getElementById('loadingModal');
  if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
  }
}

// Expose to window for global access (compatibility)
window.showSuccessModal = showSuccessModal;
window.showErrorModal = showErrorModal;
window.showConfirmModal = showConfirmModal;
window.showLoadingModal = showLoadingModal;
window.hideLoadingModal = hideLoadingModal;
window.hideSuccessModal = hideSuccessModal;
window.hideErrorModal = hideErrorModal;
window.showModal = showModal;
window.hideModal = hideModal;
