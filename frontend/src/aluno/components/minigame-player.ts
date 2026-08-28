// @ts-nocheck

export class MinigamePlayer {
    constructor(activityData, onComplete, senhaCurso = '', senhaAtividade = '') {
        this.activityData = activityData;
        this.onComplete = onComplete;
        this.senhaCurso = senhaCurso;
        this.senhaAtividade = senhaAtividade;
        this.questions = [];
        this.containerId = null;
        this.canvas = null;
        this.ctx = null;
        this.w = 0;
        this.h = 0;

        // Game State
        this.isPlaying = false;
        this.score = 0;
        this.gameOver = false;
        this.particles = [];
        this.stars = [];
        this.currentEnemy = null;
        this.laser = null;
        this.controlsLocked = false;
        this.availableQuestions = [];
        this.player = { x: 0, y: 0, targetX: 0, width: 40, height: 50 };
        this.isSubmitting = false;
        this.animationFrameId = null;
        this.lastChosenAnswer = null;
        this.currentOpts = [];
        this.currentFeedbacks = [];
        this.feedbackTimer = null;

        // Parse questions
        try {
            const data = typeof activityData.json_data === 'string'
                ? JSON.parse(activityData.json_data)
                : activityData.json_data;

            // Adapt to the structure expected by the game
            // The editor saves as { questions: [ { title, content, options: [] } ] }
            // The game expects: { enunciado, alternativas }

            if (data.questions) {
                this.questions = data.questions.map(q => {
                    const correctOpt = (q.options || []).find(o => o.correct || o.isCorrect) || (q.options ? q.options[0] : null);
                    return {
                        enunciado: q.content || q.title,
                        alternativas: (q.options || []).map(o => o.text),
                        respostaCorreta: correctOpt ? correctOpt.text : '',
                        feedbacks: (q.options || []).map(o => o.feedback || '')
                    };
                });
            } else if (data.perguntas) {
                this.questions = data.perguntas.map(p => ({
                    enunciado: p.enunciado || p.pergunta,
                    alternativas: p.alternativas || [],
                    respostaCorreta: p.respostaCorreta || p.correta || (p.alternativas ? p.alternativas[0] : ''),
                    feedbacks: p.feedbacks || []
                }));
            }
        } catch (e) {
            console.error("Error parsing minigame data", e);
            this.questions = [];
        }
    }

    mount(containerId) {
        this.containerId = containerId;
        const container = document.getElementById(containerId);
        if (!container) return;

        // Inject HTML Structure
        container.innerHTML = `
            <div id="mg-game-container" class="relative w-full h-full bg-[#050510] overflow-hidden font-mono select-none">
                
                <!-- START SCREEN -->
                <div id="mg-start-screen" class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95">
                    <h3 class="text-[#00d4ff] tracking-[4px] text-lg mb-4">SIMULAÇÃO TÁTICA</h3>
                    <h1 id="mg-phase-title" class="text-4xl text-white text-center mb-4 shadow-cyan-500/50 drop-shadow-[0_0_10px_rgba(0,212,255,0.8)] max-w-2xl px-4">
                        __MG_PHASE_TITLE__
                    </h1>
                    <p id="mg-phase-desc" class="hidden text-gray-300 text-sm text-center mb-8 max-w-xl px-4 font-sans leading-relaxed"></p>
                    <button id="mg-btn-start" class="px-10 py-4 bg-transparent border-2 border-[#00d4ff] text-[#00d4ff] text-xl font-bold uppercase cursor-pointer transition-all hover:bg-[#00d4ff] hover:text-black hover:shadow-[0_0_30px_#00d4ff] hover:scale-105 mb-6">
                        INICIAR SISTEMA
                    </button>
                    <button id="mg-btn-rank" class="mb-4 text-[#00d4ff] hover:text-white transition text-sm uppercase tracking-wider border-b border-transparent hover:border-[#00d4ff]">
                        EXIBIR RANKING
                    </button>
                    <button id="mg-btn-close-start" class="text-gray-400 hover:text-red-400 transition text-sm uppercase tracking-wider border-b border-transparent hover:border-red-400">
                        SAIR DA SIMULAÇÃO
                    </button>
                </div>

                <!-- GAME OVER SCREEN -->
                <div id="mg-game-over" class="hidden absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95">
                    <h1 class="text-6xl text-red-600 mb-2 drop-shadow-[0_0_20px_red] tracking-tighter">DESTRUÍDO</h1>
                    <p class="text-gray-400 text-xl mb-8">Falha Lógica Fatal.</p>
                    <button id="mg-btn-restart" class="px-10 py-4 bg-transparent border-2 border-[#00d4ff] text-[#00d4ff] text-xl font-bold uppercase cursor-pointer transition-all hover:bg-[#00d4ff] hover:text-black hover:shadow-[0_0_30px_#00d4ff] mb-6">
                        REINICIAR
                    </button>
                    <button id="mg-btn-close-over" class="text-gray-400 hover:text-red-400 transition text-sm uppercase tracking-wider border-b border-transparent hover:border-red-400">
                        SAIR DA SIMULAÇÃO
                    </button>
                </div>

                <!-- VICTORY SCREEN -->
                <div id="mg-victory-screen" class="hidden absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95">
                    <h1 class="text-5xl text-[#00d4ff] text-center mb-2 drop-shadow-[0_0_20px_#00d4ff]">MISSÃO<br>CUMPRIDA</h1>
                    <div class="text-sm text-gray-400 uppercase tracking-widest mt-4">PONTUAÇÃO FINAL</div>
                    <div id="mg-final-score" class="text-5xl text-white font-bold mb-8">0000</div>
                    
                    <div class="flex flex-col gap-4 items-center w-4/5 max-w-xs mb-8">
                        <input type="text" id="mg-player-name" class="w-full p-4 bg-[#111] border-2 border-[#333] text-[#00ff66] font-mono text-center text-xl uppercase outline-none focus:border-[#00ff66] focus:shadow-[0_0_15px_rgba(0,255,102,0.2)] transition-all placeholder-gray-700" placeholder="NOME DE BATALHA" maxlength="16" autocomplete="off">
                        <button id="mg-btn-submit" class="w-full px-10 py-4 bg-transparent border-2 border-[#00ff66] text-[#00ff66] text-xl font-bold uppercase cursor-pointer transition-all hover:bg-[#00ff66] hover:text-black hover:shadow-[0_0_30px_#00ff66] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[#444] disabled:hover:shadow-none">
                            REGISTRAR MARCO
                        </button>
                        <div id="mg-rank-msg" class="h-5 text-[#00ff66] font-bold text-sm text-center"></div>
                    </div>

                    <div class="flex gap-4">
                        <button id="mg-btn-replay" class="px-6 py-3 border border-[#00d4ff] text-[#00d4ff] text-sm font-bold uppercase hover:bg-[#00d4ff] hover:text-black transition-colors">
                            JOGAR NOVAMENTE
                        </button>
                        <button id="mg-btn-rank-victory" class="px-6 py-3 border border-purple-500 text-purple-500 text-sm font-bold uppercase hover:bg-purple-500 hover:text-white transition-colors">
                            EXIBIR RANKING
                        </button>
                        <button id="mg-btn-finish" class="px-6 py-3 border border-gray-600 text-gray-400 text-sm font-bold uppercase hover:bg-red-600 hover:border-red-600 hover:text-white transition-colors">
                            SAIR DA SIMULAÇÃO
                        </button>
                    </div>
                </div>

                <!-- HUD -->
                <div id="mg-impact-overlay" class="absolute inset-0 bg-red-600 opacity-0 pointer-events-none z-10 custom-mix-blend-overlay transition-opacity duration-200"></div>
                <div class="absolute top-0 left-0 w-full h-1.5 bg-[#111] z-20">
                    <div id="mg-danger-bar" class="w-0 h-full bg-gradient-to-r from-[#00d4ff] to-[#ff0055] transition-[width] duration-100 ease-linear"></div>
                </div>
                <div class="absolute top-5 left-5 text-2xl font-bold text-white z-20 drop-shadow-[0_0_10px_#00d4ff]">
                    SCORE: <span id="mg-score-val">0</span>
                </div>

                <!-- GAME CANVAS -->
                <canvas id="mg-canvas" class="block w-full h-full bg-[radial-gradient(circle_at_bottom,_#1a1a2e_0%,_#000000_100%)]"></canvas>
                
                <!-- UI LAYER (Questions) -->
                <div id="mg-ui-layer" class="absolute bottom-8 left-0 w-full p-5 text-center pointer-events-none z-10 flex justify-center">
                    <div id="mg-q-box" class="bg-[rgba(10,15,20,0.95)] border-2 border-[#00d4ff] rounded-md overflow-hidden shadow-[0_0_20px_rgba(0,212,255,0.2)] opacity-0 translate-y-[100px] transition-all duration-300 w-full max-w-2xl pointer-events-auto">
                        <div id="mg-error-banner" class="hidden bg-[#ffaa00] text-black font-black text-sm uppercase p-2 animate-pulse">VELOCIDADE CRÍTICA DETECTADA</div>
                        <div class="p-5 text-left">
                            <h2 id="mg-q-text" class="m-0 mb-4 text-white text-lg border-b border-[#333] pb-2 uppercase tracking-wide drop-shadow-[0_2px_0_#000]">
                                Aguardando dados...
                            </h2>
                            <div id="mg-options-area" class="grid grid-cols-1 gap-2"></div>
                        </div>
                    </div>
                </div>

            </div>
            
            <style>
                /* Helper classes for specific animations mostly. Tailwind handles the rest */
                .mg-shake { animation: mg-shake 0.4s; }
                @keyframes mg-shake {
                    0% { transform: translateX(0); } 25% { transform: translateX(-5px) rotate(-1deg); }
                    50% { transform: translateX(5px) rotate(1deg); } 75% { transform: translateX(-5px); } 100% { transform: translateX(0); }
                }
                .mg-float-score {
                     position: absolute; color: #ffff00; font-weight: bold; font-size: 1.5rem;
                     pointer-events: none; animation: mg-floatUp 1s forwards; z-index: 30; text-shadow: 0 0 5px black;
                }
                @keyframes mg-floatUp {
                    0% { opacity: 1; transform: translateY(0) scale(1); }
                    100% { opacity: 0; transform: translateY(-50px) scale(1.5); }
                }
            </style>
        `;

        this.canvas = document.getElementById('mg-canvas');
        this.ctx = this.canvas.getContext('2d');

        // Preencher título e descrição da fase de forma segura (sem innerHTML de dados do backend)
        const phaseTitle = document.getElementById('mg-phase-title');
        if (phaseTitle) {
            phaseTitle.textContent = String(this.activityData.titulo || 'Minigame');
        }
        const phaseDesc = document.getElementById('mg-phase-desc');
        if (phaseDesc && this.activityData.descricao) {
            phaseDesc.textContent = String(this.activityData.descricao);
            phaseDesc.classList.remove('hidden');
        }

        // Setup Resize Listener
        this.resizeHandler = this.resize.bind(this);
        window.addEventListener('resize', this.resizeHandler);
        this.resize();

        // Bind Buttons
        document.getElementById('mg-btn-start').onclick = () => this.startGame();
        document.getElementById('mg-btn-restart').onclick = () => this.resetGame();
        document.getElementById('mg-btn-replay').onclick = () => this.resetGame();
        document.getElementById('mg-btn-submit').onclick = () => this.submitScore();
        document.getElementById('mg-btn-rank').onclick = () => this.showRanking();
        document.getElementById('mg-btn-rank-victory').onclick = () => this.showRanking();

        // Close handlers
        const closer = () => { if (this.onComplete) this.onComplete(); };
        document.getElementById('mg-btn-close-start').onclick = closer;
        document.getElementById('mg-btn-close-over').onclick = closer;
        document.getElementById('mg-btn-finish').onclick = closer;

        // Mouse Move for Player
        this.mousemoveHandler = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.player.targetX = e.clientX - rect.left;
        };
        this.touchmoveHandler = (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            this.player.targetX = e.touches[0].clientX - rect.left;
        };
        this.canvas.addEventListener('mousemove', this.mousemoveHandler);
        this.canvas.addEventListener('touchmove', this.touchmoveHandler, { passive: false });
    }

    destroy() {
        this.isPlaying = false;
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
        window.removeEventListener('resize', this.resizeHandler);
        if (this.canvas) {
            this.canvas.removeEventListener('mousemove', this.mousemoveHandler);
            this.canvas.removeEventListener('touchmove', this.touchmoveHandler);
        }
    }

    resize() {
        const container = document.getElementById('mg-game-container');
        if (!container) return;
        this.w = this.canvas.width = container.clientWidth;
        this.h = this.canvas.height = container.clientHeight;

        // Reposition Logic
        this.player.y = this.h - 80;
        this.player.width = this.w < 500 ? 30 : 40; // Responsive width
    }

    startGame() {
        document.getElementById('mg-start-screen').classList.add('hidden');
        this.availableQuestions = [...this.questions].sort(() => Math.random() - 0.5);
        this.score = 0;
        document.getElementById('mg-score-val').innerText = '0';
        this.isPlaying = true;
        this.player.x = this.w / 2;
        this.player.targetX = this.w / 2;

        // Reset Game Vars
        this.gameOver = false;
        this.particles = [];
        this.stars = [];
        this.currentEnemy = null;
        this.laser = null;
        this.lastTime = 0;

        this.loop(performance.now());
    }

    loop(timestamp?: number) {
        if (!this.isPlaying) return;

        const now = timestamp || performance.now();
        if (!this.lastTime) this.lastTime = now;
        let dt = (now - this.lastTime) / 1000;
        this.lastTime = now;

        // Limita o dt para evitar saltos bruscos se o jogador alternar de aba
        if (dt > 0.05) dt = 0.05;
        const dtFactor = dt * 60;

        this.update(dtFactor);
        this.draw();
        this.animationFrameId = requestAnimationFrame((ts) => this.loop(ts));
    }

    update(dtFactor: number = 1) {
        if (this.gameOver) return;

        // Enemy Logic
        if (!this.currentEnemy) {
            this.spawnEnemy();
        } else {
            this.currentEnemy.update(dtFactor);

            // Check Collision / Game Over
            const dist = Math.hypot(this.player.x - this.currentEnemy.x, this.player.y - this.currentEnemy.y);
            // Height based Game Over
            if (dist < (this.player.width + this.currentEnemy.size) / 2 || this.currentEnemy.y > this.h) {
                this.triggerGameOver();
            }

            // Update UI Bar
            const dangerPct = (this.currentEnemy.y / (this.player.y - 50)) * 100;
            const bar = document.getElementById('mg-danger-bar');
            if (bar) bar.style.width = Math.min(100, dangerPct) + '%';
        }

        // Player Logic
        this.player.x += (this.player.targetX - this.player.x) * (0.15 * dtFactor);

        // Laser Logic
        if (this.laser) {
            this.laser.life--;
            if (this.laser.life <= 0) this.laser = null;
        }

        // Particles
        this.particles.forEach((p, i) => {
            p.update();
            if (p.life <= 0) this.particles.splice(i, 1);
        });
    }

    draw() {
        this.ctx.clearRect(0, 0, this.w, this.h);

        // Stars
        if (this.stars.length < 60) this.stars.push({
            x: Math.random() * this.w,
            y: 0,
            s: Math.random() * 2
        });

        this.ctx.fillStyle = 'rgba(255,255,255,0.8)';
        this.stars.forEach((s, i) => {
            const warp = this.currentEnemy ? this.currentEnemy.speed * 2 : 1;
            s.y += s.s + warp;
            if (s.y > this.h) this.stars.splice(i, 1);
            this.ctx.fillRect(s.x, s.y, s.s, s.s);
        });

        // Player
        this.ctx.save();
        this.ctx.translate(this.player.x, this.player.y);

        if (this.controlsLocked) {
            this.ctx.fillStyle = '#444';
        } else {
            this.ctx.fillStyle = '#e0e0e0';
        }

        // Ship Shape
        this.ctx.beginPath();
        this.ctx.moveTo(0, -30); this.ctx.lineTo(-20, 20); this.ctx.lineTo(0, 10); this.ctx.lineTo(20, 20);
        this.ctx.fill();

        // Engine flame
        if (!this.controlsLocked) {
            this.ctx.fillStyle = '#00d4ff';
            this.ctx.shadowBlur = 15; this.ctx.shadowColor = '#00d4ff';
            this.ctx.beginPath(); this.ctx.moveTo(-10, 20); this.ctx.lineTo(0, 40 + Math.random() * 15); this.ctx.lineTo(10, 20);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        }
        this.ctx.restore();

        // Enemy
        if (this.currentEnemy) {
            this.currentEnemy.draw(this.ctx);
        }

        // Laser
        if (this.laser) {
            this.ctx.strokeStyle = '#00d4ff';
            this.ctx.lineWidth = 8;
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = '#00d4ff';
            this.ctx.beginPath();
            this.ctx.moveTo(this.laser.x, this.laser.y);
            this.ctx.lineTo(this.laser.x, 0);
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
        }

        // Particles
        this.particles.forEach(p => p.draw(this.ctx));
    }

    spawnEnemy() {
        if (this.availableQuestions.length === 0) {
            this.triggerVictory();
            return;
        }

        const difficulty = Math.floor(this.score / 500);
        this.currentEnemy = new Enemy(difficulty, this.w);

        this.enemyMistakes = 0;
        this.controlsLocked = false;

        const qBox = document.getElementById('mg-q-box');
        const errBanner = document.getElementById('mg-error-banner');
        if (qBox) {
            qBox.classList.remove('opacity-0', 'translate-y-[100px]', '!border-[#ffaa00]', '!shadow-[0_0_25px_rgba(255,170,0,0.5)]', '!border-red-600', '!shadow-[0_0_30px_rgba(255,0,0,0.7)]');
            qBox.classList.add('border-[#00d4ff]', 'shadow-[0_0_20px_rgba(0,212,255,0.2)]');
        }
        if (errBanner) {
            errBanner.className = 'hidden bg-[#ffaa00] text-black font-black text-sm uppercase p-2 animate-pulse';
            errBanner.innerText = '';
        }
        const impact = document.getElementById('mg-impact-overlay');
        if (impact) impact.classList.remove('opacity-30');

        // Option Buttons Reset
        const opts = document.getElementById('mg-options-area');
        if (opts) Array.from(opts.children).forEach(b => b.classList.remove('opacity-40', 'pointer-events-none', '!bg-[#aa0000]', '!border-red-600', '!text-white'));

        this.loadNextQuestion();
    }

    loadNextQuestion() {
        const q = this.availableQuestions.pop();
        if (!q) return;

        document.getElementById('mg-q-text').innerText = q.enunciado;
        const area = document.getElementById('mg-options-area');
        area.innerHTML = '';

        const opts = q.alternativas && q.alternativas.length > 0 ? [...q.alternativas] : ['Verdadeiro', 'Falso'];
        opts.sort(() => Math.random() - 0.5);

        this.currentOpts = opts;

        opts.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'opt-btn w-full bg-[#1a1a1a] border border-[#444] p-3 text-[#00d4ff] font-bold text-base cursor-pointer font-mono hover:bg-[#2a2a2a] hover:border-white hover:text-white hover:scale-[1.02] hover:shadow-[0_0_10px_rgba(0,212,255,0.3)] transition-all active:scale-95';
            btn.textContent = opt;
            btn.onpointerdown = (e) => {
                e.preventDefault();
                this.answerChosen(opt, q.respostaCorreta, btn);
            };
            area.appendChild(btn);
        });
    }

    answerChosen(selected, correct, btnElement) {
        if (this.controlsLocked || this.gameOver || !this.currentEnemy) return;

        const isCorrect = correct !== '' && (
            selected === correct ||
            selected.trim().toLowerCase() === correct.trim().toLowerCase()
        );

        if (isCorrect) {
            this.lastChosenAnswer = selected;
            document.getElementById('mg-q-box').classList.add('opacity-0', 'translate-y-[100px]');
            this.player.targetX = this.currentEnemy.x;
            setTimeout(() => this.shootLaser(), 200);
        } else {
            this.enemyMistakes++;
            this.handleMistake(btnElement);
        }
    }

    handleMistake(btnElement) {
        if (btnElement) {
            btnElement.classList.add('!bg-[#aa0000]', '!border-red-600', '!text-white', 'pointer-events-none');
        }

        const qBox = document.getElementById('mg-q-box');
        const banner = document.getElementById('mg-error-banner');

        if (qBox) {
            qBox.classList.remove('mg-shake');
            void qBox.offsetWidth;
            qBox.classList.add('mg-shake');
        }

        if (this.enemyMistakes === 1 && this.currentEnemy) {
            this.currentEnemy.speed *= 2.0;
            this.currentEnemy.color = '#ffff00';
            if (qBox) {
                qBox.classList.remove('border-[#00d4ff]', 'shadow-[0_0_20px_rgba(0,212,255,0.2)]', '!border-red-600', '!shadow-[0_0_30px_rgba(255,0,0,0.7)]');
                qBox.classList.add('!border-[#ffaa00]', '!shadow-[0_0_25px_rgba(255,170,0,0.5)]');
            }
            if (banner) {
                banner.innerText = "ALERTA: VELOCIDADE CRÍTICA!";
                banner.className = "bg-[#ffaa00] text-black font-black text-sm uppercase p-2 text-center animate-pulse block";
            }
        } else if (this.enemyMistakes >= 2 && this.currentEnemy) {
            this.controlsLocked = true;
            this.currentEnemy.speed = Math.max(this.currentEnemy.speed * 5.0, 14);
            if (qBox) {
                qBox.classList.remove('border-[#00d4ff]', '!border-[#ffaa00]', 'shadow-[0_0_20px_rgba(0,212,255,0.2)]', '!shadow-[0_0_25px_rgba(255,170,0,0.5)]');
                qBox.classList.add('!border-red-600', '!shadow-[0_0_30px_rgba(255,0,0,0.7)]');
            }
            if (banner) {
                banner.innerText = "ERRO FATAL! CONTROLES TRAVADOS!";
                banner.className = "bg-red-600 text-white font-black text-sm uppercase p-2 text-center animate-pulse block";
            }
            document.querySelectorAll('#mg-options-area button').forEach(b => b.classList.add('opacity-40', 'pointer-events-none'));
            const impact = document.getElementById('mg-impact-overlay');
            if (impact) impact.classList.add('opacity-30');
        }
    }

    shootLaser() {
        this.laser = { x: this.player.x, y: this.player.y - 20, life: 10 };

        setTimeout(() => {
            if (this.currentEnemy) {
                const startY = -70;
                const endY = this.player.y - 60;
                const maxRange = endY - startY;
                const currentDist = this.currentEnemy.y - startY;

                // Score calc
                const performance = Math.max(0, 1 - (currentDist / maxRange));
                const pointsEarned = Math.floor(100 + (900 * performance));

                this.score += pointsEarned;
                document.getElementById('mg-score-val').innerText = this.score;
                this.showFloatingScore(this.currentEnemy.x, this.currentEnemy.y, pointsEarned);

                this.createExplosion(this.currentEnemy.x, this.currentEnemy.y, '#ffaa00');
                this.currentEnemy = null;
            }
        }, 150);
    }

    showFloatingScore(x, y, val) {
        const el = document.createElement('div');
        el.className = 'mg-float-score';
        el.innerText = `+${val}`;
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        document.getElementById('mg-game-container').appendChild(el);
        setTimeout(() => el.remove(), 1000);
    }

    createExplosion(x, y, color) {
        for (let i = 0; i < 30; i++) this.particles.push(new Particle(x, y, color));
        const cont = document.getElementById('mg-game-container');
        // Shake container
        cont.style.transform = `translate(${Math.random() * 10 - 5}px, ${Math.random() * 10 - 5}px)`;
        setTimeout(() => cont.style.transform = 'none', 100);
    }

    triggerGameOver() {
        this.gameOver = true;
        this.createExplosion(this.player.x, this.player.y, '#00d4ff');
        document.getElementById('mg-game-over').classList.remove('hidden');
        document.getElementById('mg-q-box').classList.add('opacity-0');
        document.getElementById('mg-impact-overlay').classList.remove('opacity-30');
    }

    triggerVictory() {
        this.isPlaying = false;
        document.getElementById('mg-q-box').classList.add('opacity-0');
        this.isSubmitting = false;

        const winScreen = document.getElementById('mg-victory-screen');
        winScreen.classList.remove('hidden');
        document.getElementById('mg-final-score').innerText = this.score;

        // Reset inputs
        const nameIn = document.getElementById('mg-player-name');
        if (nameIn) {
            nameIn.value = '';
            nameIn.disabled = false;
        }
        const submitBtn = document.getElementById('mg-btn-submit');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = "REGISTRAR MARCO";
        }
    }

    resetGame() {
        this.gameOver = false;
        this.score = 0;
        document.getElementById('mg-score-val').innerText = '0';
        document.getElementById('mg-game-over').classList.add('hidden');
        document.getElementById('mg-victory-screen').classList.add('hidden');
        document.getElementById('mg-start-screen').classList.remove('hidden'); // Go back to start
        this.currentEnemy = null;
        this.particles = [];
        this.isPlaying = false;
    }

    submitScore() {
        if (this.isSubmitting) return;

        const nameInput = document.getElementById('mg-player-name');
        const submitBtn = document.getElementById('mg-btn-submit');
        const rankMsg = document.getElementById('mg-rank-msg');
        const playerName = nameInput ? nameInput.value.trim() : '';

        if (!playerName) {
            if (rankMsg) {
                rankMsg.style.color = "#ff4444";
                rankMsg.innerText = "INFORME SEU NOME DE BATALHA";
            }
            return;
        }

        this.isSubmitting = true;
        if (nameInput) nameInput.disabled = true;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = "TRANSMITINDO...";
        }
        if (rankMsg) rankMsg.innerText = "";

        const headers = { 'Content-Type': 'application/json' };

        fetch('/api/ranking', {
            method: 'POST',
            body: JSON.stringify({
                nome_jogador: playerName,
                pontuacao: this.score,
                atividade_id: this.activityData.id,
                senha_curso: this.senhaCurso,
                senha_atividade: this.senhaAtividade
            }),
            headers
        })
        .then(res => res.json())
        .then(() => {
            if (submitBtn) submitBtn.innerText = "MARCO REGISTRADO!";
            if (rankMsg) {
                rankMsg.style.color = "#00ff66";
                rankMsg.innerText = "NOME DE BATALHA REGISTRADO NO RANKING!";
            }
        })
        .catch(err => {
            console.error("Erro ao registrar ranking", err);
            this.isSubmitting = false;
            if (nameInput) nameInput.disabled = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = "REGISTRAR MARCO";
            }
            if (rankMsg) {
                rankMsg.style.color = "#ff4444";
                rankMsg.innerText = "FALHA NA CONEXÃO. TENTE NOVAMENTE.";
            }
        });
    }

    showRanking() {
        const container = document.getElementById('mg-game-container');
        // Create ranking modal
        const modal = document.createElement('div');
        modal.id = 'mg-ranking-modal';
        modal.className = 'absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95 animate-fade-in';
        modal.innerHTML = `
            <h1 class="text-4xl text-[#00d4ff] mb-8 drop-shadow-[0_0_10px_#00d4ff] tracking-widest text-center">RANKING GLOBAL</h1>
            <div id="mg-rank-list" class="w-11/12 max-w-md bg-[#0a0a12] border border-[#333] p-4 h-96 overflow-y-auto mb-8 text-white font-mono shadow-[0_0_20px_rgba(0,0,0,0.5)] scrollbar-hide">
                <div class="text-center text-gray-500 animate-pulse mt-10">Carregando dados...</div>
            </div>
            <button id="mg-btn-close-rank" class="px-8 py-3 border border-[#00d4ff] text-[#00d4ff] font-bold uppercase hover:bg-[#00d4ff] hover:text-black transition shadow-[0_0_15px_rgba(0,212,255,0.2)]">
                FECHAR
            </button>
            <style>
                #mg-rank-list::-webkit-scrollbar { width: 5px; }
                #mg-rank-list::-webkit-scrollbar-track { bg: #000; }
                #mg-rank-list::-webkit-scrollbar-thumb { bg: #333; }
            </style>
        `;
        container.appendChild(modal);

        document.getElementById('mg-btn-close-rank').onclick = () => modal.remove();

        // Fetch Data
        fetch(`/api/ranking/${this.activityData.id}`)
            .then(res => res.json())
            .then(data => {
                const list = document.getElementById('mg-rank-list');
                if (!list) return; // Modal closed

                if (!data || data.length === 0) {
                    list.innerHTML = '<div class="text-center text-gray-500 mt-32 italic">Nenhum registro encontrado.<br>Seja o primeiro!</div>';
                    return;
                }

                list.textContent = '';
                data.forEach((r, i) => {
                    let colorClass = 'text-gray-300';
                    let icon = `${i + 1}º`;
                    if (i === 0) { colorClass = 'text-yellow-400 font-bold'; icon = '1º'; }
                    else if (i === 1) { colorClass = 'text-gray-300 font-bold'; icon = '2º'; }
                    else if (i === 2) { colorClass = 'text-accent font-bold'; icon = '3º'; }

                    const row = document.createElement('div');
                    row.className = `flex justify-between items-center border-b border-[#222] py-3 px-2 hover:bg-[#111] transition-colors ${colorClass}`;

                    const iconSpan = document.createElement('span');
                    iconSpan.className = 'w-10 text-center';
                    iconSpan.textContent = icon;

                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'flex-1 text-left truncate px-3 uppercase text-sm tracking-wider';
                    nameSpan.textContent = String(r.nome_jogador ?? '');

                    const scoreSpan = document.createElement('span');
                    scoreSpan.className = 'font-mono text-base';
                    scoreSpan.textContent = String(r.pontuacao ?? 0);

                    row.append(iconSpan, nameSpan, scoreSpan);
                    list.appendChild(row);
                });
            })
            .catch(err => {
                console.error(err);
                const list = document.getElementById('mg-rank-list');
                if (list) list.innerHTML = '<div class="text-center text-red-500 mt-32">Erro ao carregar ranking.</div>';
            });
    }
}

// --- HELPER CLASSES ---
class Enemy {
    constructor(difficultyMod, w) {
        this.size = 60;
        this.x = Math.random() * (w - 120) + 60;
        this.y = -70;
        // Velocidade base absoluta padronizada, independente da altura/resolução da tela
        this.baseSpeed = 0.5 + (difficultyMod * 0.1);
        this.speed = this.baseSpeed;
        this.color = '#ff0055';
        this.wobble = Math.random() * Math.PI;
    }
    update(dtFactor: number = 1) {
        this.y += this.speed * dtFactor;
        this.wobble += 0.05 * dtFactor;
        this.x += Math.sin(this.wobble) * (0.5 * dtFactor);
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.speed > this.baseSpeed * 2) {
            ctx.shadowBlur = 20; ctx.shadowColor = 'yellow';
        }

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(0, this.size / 2);
        ctx.lineTo(-this.size / 2, -this.size / 2);
        ctx.lineTo(0, -this.size / 4);
        ctx.lineTo(this.size / 2, -this.size / 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();

        ctx.restore();
        ctx.shadowBlur = 0;
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
        this.color = color;
    }
    update() { this.x += this.vx; this.y += this.vy; this.life -= 0.02; }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, Math.random() * 2 + 1, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}
