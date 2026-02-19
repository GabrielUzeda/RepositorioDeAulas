/**
 * RoletaPlayer - Logic for Roulette Game Activity
 * Redesigned to match 'Reforço' Activity aesthetics (Tailwind UI)
 */
export class RoletaPlayer {
    constructor(activityData, onComplete) {
        this.activityData = activityData;
        this.onComplete = onComplete;

        // Parse questions from json_data or use defaults if testing
        try {
            const data = typeof activityData.json_data === 'string'
                ? JSON.parse(activityData.json_data)
                : activityData.json_data;

            this.questions = data.questions || [];
        } catch (e) {
            console.error("Error parsing roleta data", e);
            this.questions = [];
        }

        this.availableQuestions = [...this.questions];
        this.currentQuestion = null;
        this.selectedAnswer = null;
        this.correctCount = 0;
        this.wrongCount = 0;
        this.isAnimating = false;

        // Constants
        this.questionModalId = 'roleta-question-modal';
    }

    mount(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Inject HTML - Matching 'Reforço' Zen Mode structure (Gray background, White cards)
        // Removed the gamey gradients in favor of app consistency.
        container.innerHTML = `
        <div class="flex flex-col h-full bg-gray-50 overflow-hidden font-sans">
            <!-- Header (Matches Reforço Modal Header) -->
            <div class="bg-white px-8 py-5 flex justify-between items-center border-b border-gray-200 shadow-sm z-10 flex-shrink-0">
                <div class="flex items-center space-x-3">
                    <div class="bg-pink-100 p-2 rounded-full text-pink-600">
                        <span class="material-icons">casino</span>
                    </div>
                    <div>
                        <h3 class="text-xl font-bold text-gray-800 tracking-wide">${this.activityData.titulo || 'Roleta de Perguntas'}</h3>
                        <p class="text-xs text-gray-500">Responda para ganhar pontos</p>
                    </div>
                </div>
                
                <!-- Stats Indicators - Moved further left (mr-16) to avoid close button overlap -->
                <div class="flex items-center space-x-4 bg-gray-100 px-4 py-2 rounded-lg mr-16 shadow-sm">
                    <div class="flex items-center space-x-1" title="Corretas">
                        <span class="material-icons text-green-500 text-sm">check_circle</span>
                        <span class="font-bold text-gray-700" id="roleta-correct-count">0</span>
                    </div>
                    <div class="w-px h-4 bg-gray-300"></div>
                    <div class="flex items-center space-x-1" title="Erradas">
                        <span class="material-icons text-red-500 text-sm">cancel</span>
                        <span class="font-bold text-gray-700" id="roleta-wrong-count">0</span>
                    </div>
                    <div class="w-px h-4 bg-gray-300"></div>
                    <div class="flex items-center space-x-1" title="Restantes">
                        <span class="material-icons text-blue-500 text-sm">help</span>
                        <span class="font-bold text-gray-700" id="roleta-remaining-count">0</span>
                    </div>
                </div>
            </div>

            <!-- Main Content Area -->
            <div class="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col items-center justify-center custom-scrollbar">
                
                <!-- Wheel Card -->
                <div class="bg-white rounded-xl shadow-lg border border-gray-100 p-8 w-full max-w-4xl flex flex-col items-center transition-all duration-300" id="roleta-main-card">
                    
                    <div class="text-center mb-8">
                        <h2 class="text-2xl font-light text-gray-700 mb-2">Sua Vez de Jogar</h2>
                        <p class="text-gray-500">Clique no botão para sortear uma pergunta.</p>
                    </div>

                    <div id="roleta-wheel-container" class="relative w-full max-w-2xl mb-8">
                        <!-- Cards Grid (Visual Wheel) -->
                        <div id="roleta-wheel" class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                            <!-- Items injected here -->
                        </div>
                    </div>

                    <!-- Spin Button -->
                    <button id="roleta-spin-btn" class="group relative px-8 py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 hover:shadow-xl transition-all transform hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">
                        <div class="flex items-center space-x-3">
                            <span class="material-icons group-hover:rotate-180 transition-transform duration-500">sync</span>
                            <span class="tracking-wider">GIRAR ROLETA</span>
                        </div>
                    </button>
                </div>

            </div>
        </div>

        <!-- Question Modal (Matches Reforço Question Design) -->
        <div id="${this.questionModalId}" class="hidden fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300">
            <div class="bg-white w-full max-w-3xl rounded-xl shadow-2xl flex flex-col overflow-hidden animate-slide-in">
                
                <!-- Modal Header -->
                <div class="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 class="text-lg font-bold text-gray-700 flex items-center gap-2">
                        <div class="bg-indigo-100 p-1.5 rounded-lg text-indigo-600">
                            <span class="material-icons text-xl">quiz</span>
                        </div>
                        Pergunta Sorteada
                    </h3>
                    <!-- Close button hidden by default, shown if stuck or reviewed -->
                    <button id="roleta-close-q-btn" class="text-gray-400 hover:text-gray-600 transition hidden">
                        <span class="material-icons">close</span>
                    </button>
                </div>

                <!-- Modal Content -->
                <div class="p-6 md:p-8 overflow-y-auto max-h-[70vh] custom-scrollbar">
                    
                    <!-- Question Text -->
                    <div class="mb-8">
                        <div class="text-gray-800 text-xl font-medium leading-relaxed" id="roleta-q-text"></div>
                    </div>

                    <!-- Options Grid -->
                    <div id="roleta-answers" class="grid grid-cols-1 gap-3"></div>

                    <!-- General Feedback Area (Fallback) -->
                    <div id="roleta-feedback" class="hidden mt-6 p-4 rounded-lg bg-gray-50 border border-gray-200 text-center animate-fade-in"></div>
                </div>

                <!-- Footer -->
                <div class="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end">
                    <button id="roleta-confirm-btn" class="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg shadow hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
                        Confirmar Resposta
                    </button>
                    <button id="roleta-continue-btn" class="hidden px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg shadow hover:bg-green-700 transition">
                        Continuar
                    </button>
                </div>
            </div>
        </div>
        `;

        // Load correct sounds if needed (skipping for now)
        this.bindEvents();
        this.renderWheel();
        this.updateStats();
    }

    bindEvents() {
        document.getElementById('roleta-spin-btn').addEventListener('click', () => this.animateSelection());
        document.getElementById('roleta-confirm-btn').addEventListener('click', () => this.checkAnswer());

        // Continue button explicitly closes modal to next state
        document.getElementById('roleta-continue-btn').addEventListener('click', () => {
            this.closeQuestionModal();
        });

        // Fallback close
        document.getElementById('roleta-close-q-btn').addEventListener('click', () => this.closeQuestionModal());
    }

    renderWheel() {
        const wheel = document.getElementById('roleta-wheel');
        if (!wheel) return;

        wheel.innerHTML = '';

        this.availableQuestions.forEach((q, index) => {
            const item = document.createElement('div');
            // Using standard colors, simpler design for the grid items
            item.className = 'roleta-wheel-item bg-white border-2 border-indigo-100 p-3 rounded-lg flex items-center justify-center text-indigo-300 transition-all duration-200 aspect-square shadow-sm';
            item.innerHTML = `<span class="material-icons text-2xl">help_outline</span>`;
            item.id = `roleta-card-${index}`;
            wheel.appendChild(item);
        });

        // Handle empty state
        if (this.availableQuestions.length === 0) {
            wheel.className = 'flex items-center justify-center p-8';
            wheel.innerHTML = `
                <div class="text-center">
                    <div class="bg-green-100 p-4 rounded-full inline-flex mb-4">
                        <span class="material-icons text-4xl text-green-600">emoji_events</span>
                    </div>
                    <h3 class="text-2xl font-bold text-gray-800 mb-2">Parabéns!</h3>
                    <p class="text-gray-500">Você respondeu todas as perguntas.</p>
                </div>
            `;
            const spinBtn = document.getElementById('roleta-spin-btn');
            spinBtn.disabled = true;
            spinBtn.innerHTML = `
                <div class="flex items-center justify-center space-x-2 w-full">
                    <span class="material-icons leading-none">check</span>
                    <span class="leading-none">ATIVIDADE CONCLUÍDA</span>
                </div>
            `;
            spinBtn.classList.replace('bg-indigo-600', 'bg-green-600');
            spinBtn.classList.replace('hover:bg-indigo-700', 'hover:bg-green-700');

            if (this.onComplete) this.onComplete();
        }
    }

    updateStats() {
        document.getElementById('roleta-correct-count').textContent = this.correctCount;
        document.getElementById('roleta-remaining-count').textContent = this.availableQuestions.length;
        document.getElementById('roleta-wrong-count').textContent = this.wrongCount;
    }

    async animateSelection() {
        if (this.availableQuestions.length === 0 || this.isAnimating) return;

        this.isAnimating = true;
        const spinBtn = document.getElementById('roleta-spin-btn');
        spinBtn.disabled = true;
        spinBtn.classList.add('opacity-75');

        const totalItems = this.availableQuestions.length;
        const finalIndex = Math.floor(Math.random() * totalItems);

        let currentIndex = 0;
        let delay = 50;
        const maxDelay = 300;
        const acceleration = 1.15;
        const minIterations = Math.max(20, totalItems * 2 + finalIndex);
        let iterations = 0;

        const loop = () => {
            // Remove highlight from all
            document.querySelectorAll('.roleta-wheel-item').forEach(el => {
                el.classList.remove('border-pink-500', 'bg-pink-50', 'text-pink-600', 'scale-105', 'shadow-md', 'z-10');
                el.classList.add('border-indigo-100', 'bg-white', 'text-indigo-300');
                // Reset icon
                el.innerHTML = `<span class="material-icons text-2xl">help_outline</span>`;
            });

            // Add highlight to current
            const currentCard = document.getElementById(`roleta-card-${currentIndex}`);
            if (currentCard) {
                currentCard.classList.remove('border-indigo-100', 'bg-white', 'text-indigo-300');
                currentCard.classList.add('border-pink-500', 'bg-pink-50', 'text-pink-600', 'scale-105', 'shadow-md', 'z-10');
                currentCard.innerHTML = `<span class="material-icons text-2xl">radar</span>`;
            }

            iterations++;
            currentIndex = (currentIndex + 1) % totalItems;

            if (iterations < minIterations || delay < maxDelay) {
                delay = Math.min(delay * acceleration, maxDelay);
                setTimeout(loop, delay);
            } else {
                // Done - Highlight final
                setTimeout(() => {
                    this.currentQuestion = this.availableQuestions[finalIndex];
                    // Flash effect
                    const finalCard = document.getElementById(`roleta-card-${finalIndex}`);
                    if (finalCard) {
                        finalCard.classList.remove('border-pink-500', 'bg-pink-50', 'text-pink-600');
                        finalCard.classList.add('border-green-500', 'bg-green-50', 'text-green-600', 'ring-2', 'ring-green-200');
                    }

                    setTimeout(() => {
                        this.showQuestionModal();
                        this.isAnimating = false;
                        spinBtn.disabled = false;
                        spinBtn.classList.remove('opacity-75');
                        // Clean up wheel highlight
                        this.renderWheel();
                    }, 800);
                }, 200);
            }
        };

        loop();
    }

    showQuestionModal() {
        const modal = document.getElementById(this.questionModalId);
        const qText = document.getElementById('roleta-q-text');
        const ansContainer = document.getElementById('roleta-answers');
        const confirmBtn = document.getElementById('roleta-confirm-btn');
        const continueBtn = document.getElementById('roleta-continue-btn');

        qText.innerHTML = this.currentQuestion.content || this.currentQuestion.pergunta || this.currentQuestion.title;
        ansContainer.innerHTML = '';

        // Reset Footer
        confirmBtn.classList.remove('hidden');
        confirmBtn.disabled = true; // Disable until selection
        continueBtn.classList.add('hidden');

        this.selectedAnswer = null;

        // Options
        const opts = this.currentQuestion.options || this.currentQuestion.opcoes || [];

        opts.forEach((opt, idx) => {
            const btn = document.createElement('button');
            // Matching Reforço design: w-full text-left p-4 rounded-md border border-gray-200 hover:border-green-500 hover:bg-gray-50
            btn.className = 'w-full text-left p-4 rounded-lg border border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all duration-200 group relative bg-white';

            // Normalize option object
            const optData = typeof opt === 'string' ? { text: opt, correct: false } : opt;

            btn.innerHTML = `
                <div class="flex items-center justify-between">
                    <span class="text-gray-600 font-medium group-hover:text-indigo-800 transition-colors">${optData.text}</span>
                    <span class="material-icons opacity-0 group-hover:opacity-100 text-indigo-400 transition-opacity">radio_button_unchecked</span>
                </div>
                <!-- Feedback Container -->
                <div class="feedback-area hidden mt-3 pt-3 border-t border-gray-100 text-sm"></div>
            `;

            btn.onclick = () => {
                // Selection Logic (Single select for now)
                this.selectedAnswer = { ...optData, element: btn }; // Store element for feedback

                // Visual Update
                Array.from(ansContainer.children).forEach(child => {
                    child.classList.remove('border-indigo-600', 'bg-indigo-50', 'ring-1', 'ring-indigo-300');
                    child.classList.add('border-gray-200');
                    child.querySelector('.material-icons').textContent = 'radio_button_unchecked';
                    child.querySelector('.material-icons').classList.remove('text-indigo-600', 'opacity-100');
                    child.querySelector('.material-icons').classList.add('opacity-0');
                });

                btn.classList.replace('border-gray-200', 'border-indigo-600');
                btn.classList.add('bg-indigo-50', 'ring-1', 'ring-indigo-300');
                btn.querySelector('.material-icons').textContent = 'check_circle';
                btn.querySelector('.material-icons').classList.replace('text-indigo-400', 'text-indigo-600');
                btn.querySelector('.material-icons').classList.replace('opacity-0', 'opacity-100');

                confirmBtn.disabled = false;
            };

            ansContainer.appendChild(btn);
        });

        modal.classList.remove('hidden');
    }

    checkAnswer() {
        if (!this.selectedAnswer) return;

        const isCorrect = this.selectedAnswer.correct === true;
        const confirmBtn = document.getElementById('roleta-confirm-btn');
        const continueBtn = document.getElementById('roleta-continue-btn');
        const selectedBtn = this.selectedAnswer.element;
        const fbArea = selectedBtn.querySelector('.feedback-area');

        // Disable all inputs
        document.querySelectorAll('#roleta-answers button').forEach(b => {
            b.disabled = true;
            b.classList.add('cursor-default');
        });
        confirmBtn.classList.add('hidden');
        continueBtn.classList.remove('hidden');

        // Styles based on correctness (Reforço logic)
        if (isCorrect) {
            selectedBtn.classList.replace('border-indigo-600', 'border-green-500');
            selectedBtn.classList.replace('bg-indigo-50', 'bg-green-50');
            selectedBtn.classList.replace('ring-indigo-300', 'ring-green-200');
            selectedBtn.classList.add('animate-pulse-green');

            const icon = selectedBtn.querySelector('.material-icons');
            icon.textContent = 'check_circle';
            icon.classList.replace('text-indigo-600', 'text-green-600');

            this.correctCount++;
            // Remove from pool
            this.availableQuestions = this.availableQuestions.filter(q => q !== this.currentQuestion);
            this.renderWheel(); // Update remaining count visual

        } else {
            selectedBtn.classList.replace('border-indigo-600', 'border-red-500');
            selectedBtn.classList.replace('bg-indigo-50', 'bg-red-50');
            selectedBtn.classList.replace('ring-indigo-300', 'ring-red-200');
            selectedBtn.classList.add('animate-shake');

            const icon = selectedBtn.querySelector('.material-icons');
            icon.textContent = 'cancel';
            icon.classList.replace('text-indigo-600', 'text-red-500');

            this.wrongCount++;
            this.updateStats();
        }

        // Show Feedback
        // Use individual feedback if available, fallback to question level justification
        let txt = this.selectedAnswer.feedback || this.currentQuestion.justification || (isCorrect ? "Correto! Muito bem." : "Incorreto. Tente novamente.");
        fbArea.innerHTML = txt;
        fbArea.className = `feedback-area mt-3 pt-3 border-t border-${isCorrect ? 'green' : 'red'}-100 text-sm ${isCorrect ? 'text-green-700' : 'text-red-600'} block animate-fade-in`;
    }

    closeQuestionModal() {
        document.getElementById(this.questionModalId).classList.add('hidden');
        this.updateStats();
    }
}

