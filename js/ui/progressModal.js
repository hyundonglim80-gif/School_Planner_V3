<<<<<<< HEAD
// js/ui/progressModal.js

export const ProgressModal = {
    modalEl: null,
    show: function(title) {
        if (this.modalEl) this.modalEl.remove();
        const html = `
        <div id="global-progress-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.75); z-index:999999; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
            <div style="background:#fff; width:380px; padding:30px 25px; border-radius:16px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); text-align:center; transform: scale(0.95); animation: popIn 0.2s forwards ease-out;">
                <div id="progress-spinner" style="margin:0 auto 20px auto; width:50px; height:50px; border:4px solid #e2e8f0; border-top-color:#3b82f6; border-radius:50%; animation: spin 1s linear infinite;"></div>
                <h3 id="progress-title" style="margin:0 0 12px 0; color:#1e293b; font-size:1.25rem; font-weight:800;">${title}</h3>
                <div id="progress-bar-container" style="width:100%; background:#f1f5f9; height:12px; border-radius:6px; overflow:hidden; margin-bottom:15px; box-shadow:inset 0 1px 2px rgba(0,0,0,0.05);">
                    <div id="progress-bar-fill" style="width:0%; height:100%; background:linear-gradient(90deg, #3b82f6, #60a5fa); transition:width 0.3s ease; border-radius:6px;"></div>
                </div>
                <p id="progress-desc" style="margin:0 0 15px 0; color:#64748b; font-size:0.95rem; font-weight:600; line-height:1.5; word-break:keep-all;">준비 중...</p>
                <div id="progress-extra-area" style="margin-bottom:15px;"></div>
                <button id="progress-ok-btn" style="display:none; width:100%; padding:12px; background:#10b981; color:#fff; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:1.05rem; transition: background 0.2s;">확인</button>
            </div>
        </div>
        <style>
            @keyframes spin { 100% { transform:rotate(360deg); } }
            @keyframes popIn { 100% { transform: scale(1); } }
        </style>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        this.modalEl = document.getElementById('global-progress-modal');
    },
    update: function(desc, percent) {
        if(!this.modalEl) return;
        const descEl = document.getElementById('progress-desc');
        const barEl = document.getElementById('progress-bar-fill');
        if(descEl && desc) descEl.innerText = desc;
        if(barEl && percent !== undefined) barEl.style.width = percent + '%';
    },
    complete: function(desc, callback, extraHtml = '') {
        if(!this.modalEl) return;
        const spinner = document.getElementById('progress-spinner');
        const descEl = document.getElementById('progress-desc');
        const barEl = document.getElementById('progress-bar-fill');
        const btn = document.getElementById('progress-ok-btn');
        const title = document.getElementById('progress-title');
        const extraArea = document.getElementById('progress-extra-area');
        
        if(spinner) {
            spinner.style.animation = "none";
            spinner.style.border = "none";
            spinner.innerHTML = "✅";
            spinner.style.fontSize = "3.5rem";
            spinner.style.lineHeight = "50px";
        }
        if(title) title.innerText = "작업 완료";
        if(descEl && desc) { descEl.innerText = desc; descEl.style.color = "#047857"; }
        if(barEl) { barEl.style.width = '100%'; barEl.style.background = "linear-gradient(90deg, #10b981, #34d399)"; }
        if(extraArea && extraHtml) { extraArea.innerHTML = extraHtml; }
        
        if(btn) { 
            btn.style.display = 'block'; 
            btn.style.background = '#10b981';
            btn.onclick = () => {
                this.close();
                if(callback) callback();
            };
        }
    },
    error: function(desc, callback) {
        if(!this.modalEl) return;
        const spinner = document.getElementById('progress-spinner');
        const descEl = document.getElementById('progress-desc');
        const barEl = document.getElementById('progress-bar-fill');
        const btn = document.getElementById('progress-ok-btn');
        const title = document.getElementById('progress-title');
        
        if(spinner) {
            spinner.style.animation = "none";
            spinner.style.border = "none";
            spinner.innerHTML = "❌";
            spinner.style.fontSize = "3.5rem";
            spinner.style.lineHeight = "50px";
        }
        if(title) { title.innerText = "오류 발생"; title.style.color = "#b91c1c"; }
        if(descEl && desc) { descEl.innerText = desc; descEl.style.color = "#b91c1c"; }
        if(barEl) barEl.style.background = "#ef4444";
        if(btn) { 
            btn.style.display = 'block'; 
            btn.style.background = '#ef4444';
            btn.onclick = () => {
                this.close();
                if(callback) callback();
            };
        }
    },
    close: function() {
        if(this.modalEl) {
            this.modalEl.remove();
            this.modalEl = null;
        }
    }
};

=======
// js/ui/progressModal.js

export const ProgressModal = {
    modalEl: null,
    show: function(title) {
        if (this.modalEl) this.modalEl.remove();
        const html = `
        <div id="global-progress-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.75); z-index:999999; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
            <div style="background:#fff; width:380px; padding:30px 25px; border-radius:16px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); text-align:center; transform: scale(0.95); animation: popIn 0.2s forwards ease-out;">
                <div id="progress-spinner" style="margin:0 auto 20px auto; width:50px; height:50px; border:4px solid #e2e8f0; border-top-color:#3b82f6; border-radius:50%; animation: spin 1s linear infinite;"></div>
                <h3 id="progress-title" style="margin:0 0 12px 0; color:#1e293b; font-size:1.25rem; font-weight:800;">${title}</h3>
                <div id="progress-bar-container" style="width:100%; background:#f1f5f9; height:12px; border-radius:6px; overflow:hidden; margin-bottom:15px; box-shadow:inset 0 1px 2px rgba(0,0,0,0.05);">
                    <div id="progress-bar-fill" style="width:0%; height:100%; background:linear-gradient(90deg, #3b82f6, #60a5fa); transition:width 0.3s ease; border-radius:6px;"></div>
                </div>
                <p id="progress-desc" style="margin:0 0 15px 0; color:#64748b; font-size:0.95rem; font-weight:600; line-height:1.5; word-break:keep-all;">준비 중...</p>
                <div id="progress-extra-area" style="margin-bottom:15px;"></div>
                <button id="progress-ok-btn" style="display:none; width:100%; padding:12px; background:#10b981; color:#fff; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:1.05rem; transition: background 0.2s;">확인</button>
            </div>
        </div>
        <style>
            @keyframes spin { 100% { transform:rotate(360deg); } }
            @keyframes popIn { 100% { transform: scale(1); } }
        </style>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        this.modalEl = document.getElementById('global-progress-modal');
    },
    update: function(desc, percent) {
        if(!this.modalEl) return;
        const descEl = document.getElementById('progress-desc');
        const barEl = document.getElementById('progress-bar-fill');
        if(descEl && desc) descEl.innerText = desc;
        if(barEl && percent !== undefined) barEl.style.width = percent + '%';
    },
    complete: function(desc, callback, extraHtml = '') {
        if(!this.modalEl) return;
        const spinner = document.getElementById('progress-spinner');
        const descEl = document.getElementById('progress-desc');
        const barEl = document.getElementById('progress-bar-fill');
        const btn = document.getElementById('progress-ok-btn');
        const title = document.getElementById('progress-title');
        const extraArea = document.getElementById('progress-extra-area');
        
        if(spinner) {
            spinner.style.animation = "none";
            spinner.style.border = "none";
            spinner.innerHTML = "✅";
            spinner.style.fontSize = "3.5rem";
            spinner.style.lineHeight = "50px";
        }
        if(title) title.innerText = "작업 완료";
        if(descEl && desc) { descEl.innerText = desc; descEl.style.color = "#047857"; }
        if(barEl) { barEl.style.width = '100%'; barEl.style.background = "linear-gradient(90deg, #10b981, #34d399)"; }
        if(extraArea && extraHtml) { extraArea.innerHTML = extraHtml; }
        
        if(btn) { 
            btn.style.display = 'block'; 
            btn.style.background = '#10b981';
            btn.onclick = () => {
                this.close();
                if(callback) callback();
            };
        }
    },
    error: function(desc, callback) {
        if(!this.modalEl) return;
        const spinner = document.getElementById('progress-spinner');
        const descEl = document.getElementById('progress-desc');
        const barEl = document.getElementById('progress-bar-fill');
        const btn = document.getElementById('progress-ok-btn');
        const title = document.getElementById('progress-title');
        
        if(spinner) {
            spinner.style.animation = "none";
            spinner.style.border = "none";
            spinner.innerHTML = "❌";
            spinner.style.fontSize = "3.5rem";
            spinner.style.lineHeight = "50px";
        }
        if(title) { title.innerText = "오류 발생"; title.style.color = "#b91c1c"; }
        if(descEl && desc) { descEl.innerText = desc; descEl.style.color = "#b91c1c"; }
        if(barEl) barEl.style.background = "#ef4444";
        if(btn) { 
            btn.style.display = 'block'; 
            btn.style.background = '#ef4444';
            btn.onclick = () => {
                this.close();
                if(callback) callback();
            };
        }
    },
    close: function() {
        if(this.modalEl) {
            this.modalEl.remove();
            this.modalEl = null;
        }
    }
};

>>>>>>> d1348ae5447b87f69a849130f4f6a30f4c5cc4fe
window.ProgressModal = ProgressModal; // 외부 뷰 파일 하위 호환성을 위해 유지