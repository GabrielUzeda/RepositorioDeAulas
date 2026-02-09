// global/alert-modals.js

/**
 * Helper function to show a modal with a consistent animation.
 * @param {string} modalId - The ID of the modal element.
 * @param {string} [message] - Optional message to display in the modal.
 */
function showModal(modalId, message) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  if (message) {
    const msgElement = document.getElementById(`${modalId}Message`);
    if (msgElement) {
      msgElement.textContent = message;
    }
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  const modalContent = modal.querySelector('.modal-content');
  if (modalContent) {
    modalContent.classList.add('modal-enter');
    setTimeout(() => modalContent.classList.add('modal-enter-active'), 10);
  }
}

/**
 * Helper function to hide a modal with a consistent animation.
 * @param {string} modalId - The ID of the modal element.
 */
function hideModal(modalId) {
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
    // Fallback for modals without .modal-content
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

export function showSuccessModal(message = 'Operação concluída com sucesso!') {
  showModal('successModal', message);
}

export function hideSuccessModal() {
  hideModal('successModal');
}

export function showErrorModal(message = 'Ocorreu um erro inesperado.') {
  showModal('errorModal', message);
}

export function hideErrorModal() {
  hideModal('errorModal');
}

export function showLoadingModal(message = 'Enviando atividade...') {
    const modal = document.getElementById('loadingModal');
    if (modal && message) {
        const p = modal.querySelector('p');
        if (p) p.textContent = message;
    }
    showModal('loadingModal');
}

export function hideLoadingModal() {
  hideModal('loadingModal');
}
