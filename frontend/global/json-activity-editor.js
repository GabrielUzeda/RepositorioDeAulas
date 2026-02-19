export class ActivityEditor {
    constructor(saveCallback) {
        this.saveCallback = saveCallback;
        this.currentData = null;
        this.editorModalId = 'activityEditorModal';
        this.injectModal();
    }

    injectModal() {
        if (document.getElementById(this.editorModalId)) return;

        const modalHtml = `
      <div id="${this.editorModalId}" class="fixed inset-0 bg-white z-[120] flex flex-col hidden items-stretch">
        <!-- Toolbar -->
        <div class="h-14 border-b border-gray-200 flex justify-between items-center px-6 bg-gray-50 flex-shrink-0">
          <div class="flex items-center space-x-4">
            <button id="closeActivityEditor" class="text-gray-500 hover:text-gray-700 transition">
              <span class="material-icons">close</span>
            </button>
            <h2 class="text-lg font-bold text-gray-800">Editor de Atividade</h2>
          </div>
          <div class="flex items-center space-x-3">
            <button id="importJsonBtn" class="text-gray-600 hover:text-indigo-600 px-3 py-2 rounded-lg transition text-sm flex items-center border border-transparent hover:border-gray-200">
                <span class="material-icons text-base mr-1">upload_file</span> Importar
            </button>
            <button id="exportJsonBtn" class="text-gray-600 hover:text-indigo-600 px-3 py-2 rounded-lg transition text-sm flex items-center border border-transparent hover:border-gray-200">
                <span class="material-icons text-base mr-1">download</span> Exportar
            </button>
            <button id="saveActivityBtn" class="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition font-medium shadow-sm flex items-center">
              <span class="material-icons mr-2 text-sm">save</span> Salvar
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-auto bg-gray-50 p-6">
            <!-- Hidden File Input -->
            <input type="file" id="importJsonInput" accept=".json" class="hidden">

            <div class="max-w-4xl mx-auto space-y-6">
                <!-- Main Info -->
                <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
                    <h3 class="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">Informações Básicas</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="col-span-1">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Título</label>
                            <input type="text" id="actTitle" class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: Prova de Lógica">
                        </div>
                        <div class="col-span-1">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Tipo de Atividade</label>
                            <select id="actType" class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                                <option value="normal">Normal</option>
                                <option value="prova">Prova</option>
                                <option value="game">Minigame</option>
                                <option value="roleta">Roleta</option>
                                <option value="reforco">Reforço</option>
                            </select>
                        </div>
                        <div class="col-span-2">
                             <label class="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                             <textarea id="actDesc" rows="2" class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Breve descrição da atividade..."></textarea>
                        </div>
                        
                        <!-- Access Control (Dynamic) -->
                        <div id="pwdContainer" class="col-span-2 hidden">
                             <label class="block text-sm font-medium text-gray-700 mb-1">Senha de Acesso</label>
                             <input type="text" id="actPassword" placeholder="Senha da Atividade" class="w-full max-w-xs border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500">
                             <p class="text-xs text-gray-500 mt-1">Esta atividade exige senha para ser acessada.</p>
                        </div>
                    </div>
                </div>

                <!-- Questions -->
                <div>
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-semibold text-gray-800">Questões</h3>
                        <button id="addQuestionBtn" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center shadow-sm">
                            <span class="material-icons text-sm mr-2">add</span> Adicionar Questão
                        </button>
                    </div>
                    
                    <div id="questionsList" class="space-y-4"></div>
                    
                    <div id="emptyQuestionsMsg" class="text-center py-12 text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
                        <span class="material-icons text-4xl mb-2">quiz</span>
                        <p>Nenhuma questão adicionada.</p>
                    </div>
                </div>
            </div>
        </div>
      </div>
    `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.bindEvents();
    }

    bindEvents() {
        const $ = (sel) => document.querySelector(sel);
        $('#closeActivityEditor').onclick = () => this.close();
        $('#saveActivityBtn').onclick = () => this.save();
        $('#addQuestionBtn').onclick = () => this.addQuestionUI();
        $('#exportJsonBtn').onclick = () => this.exportJson();
        $('#importJsonBtn').onclick = () => $('#importJsonInput').click();
        $('#importJsonInput').onchange = (e) => this.handleImport(e);

        // Pass true to clear questions on manual change
        $('#actType').onchange = () => this.updateUIByType(true);
    }

    updateUIByType(clearQuestions = false) {
        const type = document.getElementById('actType').value;
        const pwdContainer = document.getElementById('pwdContainer');
        const addBtn = document.getElementById('addQuestionBtn');

        // Rules
        // Password: Prova, Roleta
        if (type === 'prova' || type === 'roleta') {
            pwdContainer.classList.remove('hidden');
        } else {
            pwdContainer.classList.add('hidden');
            document.getElementById('actPassword').value = '';
        }

        // Clear Layout if requested (invalidates old question types)
        if (clearQuestions) {
            document.getElementById('questionsList').innerHTML = '';
            document.getElementById('emptyQuestionsMsg').classList.remove('hidden');
        }
    }

    generateSlug(text) {
        return text.toString().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '_')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '_')
            .replace(/^-+/, '')
            .replace(/-+$/, '');
    }

    addQuestionUI(data = null) {
        const type = document.getElementById('actType').value;
        const id = Date.now().toString(36) + Math.random().toString(36).substring(2);
        const qContainer = document.getElementById('questionsList');
        document.getElementById('emptyQuestionsMsg').classList.add('hidden');

        // Determining Question Type based on Activity Type
        let allowedTypes = [];
        let defaultType = 'text';
        let showJustification = false;
        let showCorrectAnswer = false;
        let showOptions = false;
        let showOptionFeedback = false;

        if (type === 'normal' || type === 'prova') {
            allowedTypes = ['text']; // Removed 'code'
            defaultType = data?.type || 'text';
        } else if (type === 'game') {
            allowedTypes = ['choice'];
            defaultType = 'choice';
            showOptions = true;
            showCorrectAnswer = true;
        } else if (type === 'roleta' || type === 'reforco') {
            allowedTypes = ['choice'];
            defaultType = 'choice';
            showOptions = true;
            showCorrectAnswer = true;
            showOptionFeedback = true; // Feedback per option for both
            showJustification = false; // Disable global justification in favor of per-option
        }

        // Build Type Select Options
        let typeOptionsHtml = '';
        if (allowedTypes.length > 1) {
            typeOptionsHtml = `<select class="js-q-type text-xs border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500 bg-gray-50 h-8">`;
            allowedTypes.forEach(t => {
                typeOptionsHtml += `<option value="${t}" ${defaultType === t ? 'selected' : ''}>${t === 'text' ? 'Discursiva' : t === 'code' ? 'Código' : 'Múltipla Escolha'}</option>`;
            });
            typeOptionsHtml += `</select>`;
        } else {
            const t = allowedTypes[0];
            typeOptionsHtml = `<span class="js-q-type-label text-xs font-bold text-gray-400 uppercase border border-gray-200 px-2 py-1 rounded bg-gray-50 h-8 flex items-center">${t === 'text' ? 'Discursiva' : 'Múltipla Escolha'}</span>
                                <input type="hidden" class="js-q-type" value="${t}">`;
        }

        const html = `
            <div id="q_${id}" class="bg-white rounded-xl border border-gray-200 shadow-sm p-4 animate-fade-in group transition hover:border-indigo-300">
                <div class="flex justify-between items-start mb-4">
                    <div class="flex-1 flex items-center space-x-2 mr-4">
                        <span class="material-icons text-gray-300 transform rotate-90 cursor-move">drag_indicator</span>
                        <div class="flex-1">
                             <input type="text" class="js-q-title w-full font-semibold text-gray-800 border-b border-transparent focus:border-indigo-500 outline-none placeholder-gray-400 bg-transparent transition" placeholder="Título da Questão" value="${data?.title || `Questão ${(qContainer.children.length + 1).toString().padStart(2, '0')}`}">
                        </div>
                         ${typeOptionsHtml}
                    </div>
                    <div class="flex space-x-1 opacity-100 transition whitespace-nowrap">
                        <button type="button" class="js-move-up text-gray-400 hover:text-indigo-500 transition p-1"><span class="material-icons">arrow_upward</span></button>
                        <button type="button" class="js-move-down text-gray-400 hover:text-indigo-500 transition p-1"><span class="material-icons">arrow_downward</span></button>
                        <button type="button" class="text-gray-400 hover:text-red-500 transition p-1 ml-2" onclick="document.getElementById('q_${id}').remove(); if(document.getElementById('questionsList').children.length === 1) document.getElementById('emptyQuestionsMsg').classList.remove('hidden');">
                            <span class="material-icons">delete</span>
                        </button>
                    </div>
                </div>
                
                <div class="space-y-4 pl-0 md:pl-8">

                    <textarea class="js-q-content w-full p-3 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 resize-y" rows="3" placeholder="Enunciado da questão...">${data?.content || ''}</textarea>
                    
                    ${showJustification ? `
                    <div>
                        <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Justificativa (Feedback)</label>
                        <textarea class="js-q-justification w-full p-3 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 resize-y" rows="2" placeholder="Explicação da resposta correta...">${data?.justification || ''}</textarea>
                    </div>` : ''}

                    ${showOptions ? `
                    <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
                         <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Opções de Resposta</label>
                         <div class="js-options-list space-y-2"></div>
                         <button type="button" class="mt-2 text-indigo-600 text-sm hover:underline js-add-option">+ Adicionar Opção</button>
                    </div>` : ''}
                </div>
            </div>
        `;

        qContainer.insertAdjacentHTML('beforeend', html);
        const el = document.getElementById(`q_${id}`);

        // Event Listeners
        el.querySelector('.js-move-up').onclick = () => { if (el.previousElementSibling) el.parentNode.insertBefore(el, el.previousElementSibling); };
        el.querySelector('.js-move-down').onclick = () => { if (el.nextElementSibling) el.parentNode.insertBefore(el.nextElementSibling, el); };

        if (showOptions) {
            const optList = el.querySelector('.js-options-list');
            const addOptBtn = el.querySelector('.js-add-option');

            const addOption = (optData = null) => {
                const optId = Date.now().toString() + Math.random().toString(36).substring(2);

                let feedbackHtml = '';
                if (showOptionFeedback) {
                    feedbackHtml = `
                        <div class="mt-2 ml-6">
                            <input type="text" class="js-opt-feedback w-full border border-gray-200 rounded px-2 py-1 text-xs text-gray-600 outline-none focus:border-indigo-500 bg-gray-50" placeholder="Feedback se escolher esta opção (Opcional)" value="${optData?.feedback || ''}">
                        </div>
                     `;
                }

                const optHtml = `
                    <div class="border border-gray-100 rounded-lg p-2 mb-2 bg-white">
                        <div class="flex items-center space-x-2">
                            <input type="radio" name="radio_${id}" class="js-opt-correct w-4 h-4 text-indigo-600 focus:ring-indigo-500" ${optData?.correct ? 'checked' : ''}>
                            <input type="text" class="js-opt-text flex-1 border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:border-indigo-500" placeholder="Texto da opção" value="${optData?.text || ''}">
                            <button type="button" class="text-gray-400 hover:text-red-500" onclick="this.closest('.border').remove()"><span class="material-icons text-sm">close</span></button>
                        </div>
                        ${feedbackHtml}
                    </div>
                `;
                optList.insertAdjacentHTML('beforeend', optHtml);
            };

            addOptBtn.onclick = () => addOption();

            if (data?.options) {
                data.options.forEach(o => addOption(o));
            } else {
                addOption(); // Add one default
                addOption();
            }
        }
    }

    open(existingData = null) {
        this.currentData = existingData;

        // Reset
        document.getElementById('questionsList').innerHTML = '';
        document.getElementById('emptyQuestionsMsg').classList.remove('hidden');
        document.getElementById('actTitle').value = existingData?.titulo || '';
        document.getElementById('actDesc').value = existingData?.descricao || '';
        document.getElementById('actType').value = existingData?.tipo || 'normal';

        // Set Password
        // Only if type allows it, but existing data takes precedence? 
        // Logic: if has pwd, fill it. Logic for visibility is in updateUI.
        document.getElementById('actPassword').value = existingData?.senha || '';

        this.updateUIByType(); // Set visibility

        // Populate Questions
        if (existingData?.json_data) {
            let json = {};
            try { json = typeof existingData.json_data === 'string' ? JSON.parse(existingData.json_data) : existingData.json_data; } catch (e) { }

            if (json.questions && Array.isArray(json.questions)) {
                json.questions.forEach(q => this.addQuestionUI(q));
            }
        }

        const modal = document.getElementById(this.editorModalId);
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    close() {
        const modal = document.getElementById(this.editorModalId);
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    getJsonPayload(includePasswords = false) {
        const title = document.getElementById('actTitle').value;
        const type = document.getElementById('actType').value;
        const desc = document.getElementById('actDesc').value;

        if (!title) {
            alert("Título é obrigatório");
            return null;
        }

        const questions = [];
        document.querySelectorAll('#questionsList > div').forEach(el => {
            const q = {
                title: el.querySelector('.js-q-title').value,
                type: el.querySelector('.js-q-type')?.value, // select or hidden input
                content: el.querySelector('.js-q-content').value
            };

            // Justification
            const just = el.querySelector('.js-q-justification');
            if (just) q.justification = just.value;

            // Options
            const optsList = el.querySelector('.js-options-list');
            if (optsList) {
                q.options = [];
                // Selector updated to match new structure (div.border > div.flex)
                // We iterate the container divs
                optsList.querySelectorAll('.js-options-list > div').forEach(optEl => {
                    q.options.push({
                        text: optEl.querySelector('.js-opt-text').value,
                        correct: optEl.querySelector('.js-opt-correct').checked,
                        feedback: optEl.closest('.border').querySelector('.js-opt-feedback')?.value || '' // Capture feedback
                    });
                });
            }
            questions.push(q);
        });

        const jsonPayload = {
            meta: {
                title: title,
                description: desc,
                type: type
            },
            questions: questions
        };

        const allowPwd = (type === 'prova' || type === 'roleta');
        const pwd = (allowPwd || includePasswords) ? document.getElementById('actPassword').value : null;

        // Backend Payload Structure
        const payload = {
            titulo: title,
            descricao: desc,
            caminho: this.generateSlug(title),
            tipo: type,
            json_data: JSON.stringify(jsonPayload),
            allow_password: allowPwd && !!pwd,
            senha: pwd || null
        };

        return payload;
    }

    async save() {
        const payload = this.getJsonPayload();
        if (!payload) return;

        if (this.saveCallback) {
            await this.saveCallback(this.currentData, payload);
        }
        this.close();
    }

    exportJson() {
        const payload = this.getJsonPayload(true); // Include password in export for backup purposes
        if (!payload) return;

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `atividade_${payload.caminho}_${Date.now()}.json`);
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    handleImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);

                // Validate minimal structure
                if (!importedData.titulo || !importedData.tipo) {
                    throw new Error("Formato de arquivo inválido. Campos 'titulo' e 'tipo' são obrigatórios.");
                }

                // Populate UI
                document.getElementById('actTitle').value = importedData.titulo || '';
                document.getElementById('actDesc').value = importedData.descricao || '';
                document.getElementById('actType').value = importedData.tipo || 'normal';
                document.getElementById('actPassword').value = importedData.senha || '';

                // Update UI visibility based on type
                this.updateUIByType(true); // Clear existing questions first

                // Re-populate password field (updateUI clears it if hidden, so we set it again after update if valid)
                if (importedData.tipo === 'prova' || importedData.tipo === 'roleta') {
                    document.getElementById('actPassword').value = importedData.senha || '';
                }

                // Parse questions from json_data
                let json = {};
                try {
                    json = typeof importedData.json_data === 'string' ? JSON.parse(importedData.json_data) : importedData.json_data;
                } catch (e) { console.error("Error parsing interior JSON", e); }

                if (json.questions && Array.isArray(json.questions)) {
                    json.questions.forEach(q => this.addQuestionUI(q));
                }

                alert("Atividade importada com sucesso!");

            } catch (error) {
                console.error("Erro na importação:", error);
                alert("Erro ao importar arquivo: " + error.message);
            }
            // Reset input
            event.target.value = '';
        };
        reader.readAsText(file);
    }
}
