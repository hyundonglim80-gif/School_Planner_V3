// js/modules/labels.js
import { getEventLabels, getJournalLabels } from '../core/utils.js';
import { getUserCol } from '../firebase.js';
import { doc, getDocs, setDoc, writeBatch } from "firebase/firestore"; 

export const LabelManager = {
  unifiedModal: null,
  currentTab: 'event',
  
  draggedIdx: null,
  draggedType: null,

  colorNames: {
      red: '빨강', orange: '주황', yellow: '노랑', green: '초록',
      blue: '파랑', indigo: '남색', purple: '보라', gray: '회색'
  },

  generateId: function(prefix) {
      return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
  },

  getColorPickerHTML: function(idPrefix, defaultColor = 'blue') {
      let html = '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">';
      const palette = window.LABEL_PALETTE || {
          red: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
          orange: { bg: '#ffedd5', text: '#9a3412', border: '#fdba74' },
          yellow: { bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
          green: { bg: '#dcfce7', text: '#166534', border: '#86efac' },
          blue: { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
          indigo: { bg: '#e0e7ff', text: '#3730a3', border: '#a5b4fc' },
          purple: { bg: '#f3e8ff', text: '#6b21a8', border: '#d8b4fe' },
          gray: { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' }
      };

      for (const [key, val] of Object.entries(palette)) {
          const isChecked = key === defaultColor;
          html += `
              <div onclick="window.LabelManager.selectColor('${idPrefix}', '${key}')" 
                   id="${idPrefix}-color-${key}" title="${this.colorNames[key] || key}"
                   style="width:26px; height:26px; border-radius:50%; background:${val.bg}; border:2px solid ${isChecked ? val.text : val.border}; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:0.2s;">
                  <span style="display:${isChecked ? 'block' : 'none'}; color:${val.text}; font-size:12px; font-weight:bold;">✔</span>
              </div>
          `;
      }
      html += `<input type="hidden" id="${idPrefix}-selected-color" value="${defaultColor}"></div>`;
      return html;
  },

  selectColor: function(idPrefix, colorKey) {
      document.getElementById(`${idPrefix}-selected-color`).value = colorKey;
      const palette = window.LABEL_PALETTE || {};
      for (const key of Object.keys(palette)) {
          const div = document.getElementById(`${idPrefix}-color-${key}`);
          if (div) {
              if (key === colorKey) {
                  div.style.border = `2px solid ${palette[key].text}`;
                  div.innerHTML = `<span style="display:block; color:${palette[key].text}; font-size:12px; font-weight:bold;">✔</span>`;
              } else {
                  div.style.border = `2px solid ${palette[key].border}`;
                  div.innerHTML = `<span style="display:none;"></span>`;
              }
          }
      }
  },

  handleDragStart: function(e, idx, type) {
      this.draggedIdx = idx;
      this.draggedType = type;
      e.dataTransfer.effectAllowed = 'move';
      e.target.closest('.modal-input-row').style.opacity = '0.5';
  },
  handleDragOver: function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
  },
  handleDrop: function(e, targetIdx, type) {
      e.preventDefault();
      if (this.draggedType !== type || this.draggedIdx === null) return;
      if (this.draggedIdx === targetIdx) return;
      
      let arr;
      if (type === 'event') arr = window.tempEditingLabels;
      else if (type === 'journal') arr = window.tempEditingJournalLabels;
      else arr = window.tempEditingMemoLabels;

      const item = arr.splice(this.draggedIdx, 1)[0];
      arr.splice(targetIdx, 0, item);

      this.draggedIdx = null;
      if (type === 'event') this.renderEventLabels();
      else if (type === 'journal') this.renderJournalLabels();
      else this.renderMemoLabels();
  },

  // 🌟 [통합] 하나의 팝업에서 관리
  openUnifiedLabelModal: function(initialTab = 'event') {
      if (!this.unifiedModal) {
          const html = `
              <div style="display:flex; border-bottom:2px solid #cbd5e1; margin-bottom:15px; gap:5px;">
                  <button id="tab-btn-event" onclick="window.LabelManager.switchTab('event')" style="flex:1; padding:10px; background:#eff6ff; color:#1e40af; border:2px solid #3b82f6; border-bottom:none; border-radius:8px 8px 0 0; font-weight:bold; cursor:pointer;">📅 일정</button>
                  <button id="tab-btn-journal" onclick="window.LabelManager.switchTab('journal')" style="flex:1; padding:10px; background:#f8fafc; color:#64748b; border:1px solid #cbd5e1; border-bottom:none; border-radius:8px 8px 0 0; font-weight:bold; cursor:pointer;">📔 기록</button>
                  <button id="tab-btn-memo" onclick="window.LabelManager.switchTab('memo')" style="flex:1; padding:10px; background:#f8fafc; color:#64748b; border:1px solid #cbd5e1; border-bottom:none; border-radius:8px 8px 0 0; font-weight:bold; cursor:pointer;">📝 메모</button>
              </div>
              <div id="unified-label-content"></div>
          `;
          this.unifiedModal = new window.Modal({
              id: 'unified-label-modal-v5',
              title: '🏷️ 통합 라벨 관리',
              width: '550px',
              content: html
          });
      }
      this.unifiedModal.open();
      this.switchTab(initialTab);
  },

  switchTab: function(tab) {
      this.currentTab = tab;
      const btnEvent = document.getElementById('tab-btn-event');
      const btnJournal = document.getElementById('tab-btn-journal');
      const btnMemo = document.getElementById('tab-btn-memo');
      const content = document.getElementById('unified-label-content');
      
      if(!btnEvent) return; 

      [btnEvent, btnJournal, btnMemo].forEach(b => {
          b.style.background = '#f8fafc';
          b.style.color = '#64748b';
          b.style.border = '1px solid #cbd5e1';
          b.style.borderBottom = 'none';
      });

      if (tab === 'event') {
          btnEvent.style.background = '#eff6ff';
          btnEvent.style.color = '#1e40af';
          btnEvent.style.border = '2px solid #3b82f6';
          btnEvent.style.borderBottom = 'none';
          content.innerHTML = this.getEventContentHTML();
          window.tempEditingLabels = getEventLabels().map(l => ({...l}));
          this.renderEventLabels();
      } else if (tab === 'journal') {
          btnJournal.style.background = '#fdf2f8';
          btnJournal.style.color = '#9d174d';
          btnJournal.style.border = '2px solid #ec4899';
          btnJournal.style.borderBottom = 'none';
          content.innerHTML = this.getJournalContentHTML();
          window.tempEditingJournalLabels = getJournalLabels().map(l => ({...l}));
          this.renderJournalLabels();
      } else if (tab === 'memo') {
          btnMemo.style.background = '#f0fdf4';
          btnMemo.style.color = '#166534';
          btnMemo.style.border = '2px solid #22c55e';
          btnMemo.style.borderBottom = 'none';
          content.innerHTML = this.getMemoContentHTML();
          window.tempEditingMemoLabels = this.getMemoLabels().map(l => ({...l}));
          this.renderMemoLabels();
      }
  },

  // ====================================================
  // 🏷️ 1. 일정 라벨 관리
  // ====================================================
  getEventContentHTML: function() {
        return `
        <div style="font-size:0.9rem; color:#475569; margin-bottom:15px; line-height:1.5; background:#f8fafc; padding:10px; border-radius:6px; border:1px solid #e2e8f0;">
            💡 <b>라벨 속성 안내</b><br>
            - <b>수업삭제</b>: 지정된 날짜의 수업 과목명을 자동으로 비웁니다.<br>
            - <b>완료</b>: 체크박스가 생성되며 미완료 시 다음 날로 자동 이월됩니다.<br>
            - <b>기간</b>: 선택 시 연속 기간 등록 달력 팝업이 실행됩니다.<br>
            - <b>반복</b>: 선택 시 매주/매월 반복 등록 팝업이 실행됩니다.
        </div>
        <div id="event-label-list-container" style="display:flex; flex-direction:column; gap:8px; max-height:280px; overflow-y:auto; margin-bottom:15px;"></div>
        
        <div style="background:#f1f5f9; padding:12px; border-radius:8px; border:1px solid #cbd5e1;">
            <div style="display:flex; gap:8px; margin-bottom:8px;">
                <input type="text" id="new-label-name" placeholder="라벨 이름" style="flex:1; padding:6px 10px; border:1px solid #cbd5e1; border-radius:4px;" onkeydown="if(event.key==='Enter') window.LabelManager.addNewEventLabel()">
                <select id="event-selected-color" style="padding:6px; border:1px solid #cbd5e1; border-radius:4px;">
                    <option value="blue">파랑</option>
                    <option value="red">빨강</option>
                    <option value="green">초록</option>
                    <option value="orange">주황</option>
                    <option value="purple">보라</option>
                    <option value="yellow">노랑</option>
                    <option value="gray">회색</option>
                </select>
                <button onclick="window.LabelManager.addNewEventLabel()" style="padding:6px 12px; background:#2563eb; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">추가</button>
            </div>
            
            <div style="display:flex; flex-wrap:wrap; gap:12px; font-size:0.85rem; color:#1e293b;">
                <label style="cursor:pointer;"><input type="checkbox" id="new-label-skip"> 🚫 수업삭제</label>
                <label style="cursor:pointer;"><input type="checkbox" id="new-label-forward"> ✅ 완료</label>
                <label style="cursor:pointer;"><input type="checkbox" id="new-label-period"> 📅 기간</label>
                <label style="cursor:pointer;"><input type="checkbox" id="new-label-recur"> 🔁 반복</label>
            </div>
        </div>
        
        <div class="modal-footer-actions" style="margin-top: 20px;">
            <button onclick="window.LabelManager.saveEventLabels(event)" class="modal-btn-primary" style="width: 100%; background: #2563eb; color: #fff; padding: 10px; border-radius: 6px; font-weight: bold; border: none; cursor: pointer;">💾 저장 및 클라우드 반영</button>
        </div>`;
    },

  renderEventLabels: function() {
    const container = document.getElementById('event-label-list-container');
    if (!container) return;
    const palette = window.LABEL_PALETTE || {};
    
    container.innerHTML = window.tempEditingLabels.map((label, index) => {
        const periodChecked = label.isPeriod ? 'checked' : '';
        const recurChecked = label.isRecur ? 'checked' : '';
        const forwardChecked = label.isForward ? 'checked' : '';
        const skipChecked = label.isSkip ? 'checked' : '';
        const style = palette[label.color || 'blue'] || { border: '#93c5fd', bg: '#dbeafe', text: '#1e40af' };
        
        return `
        <div class="modal-input-row" draggable="true" ondragstart="window.LabelManager.handleDragStart(event, ${index}, 'event')" ondragover="window.LabelManager.handleDragOver(event)" ondrop="window.LabelManager.handleDrop(event, ${index}, 'event')" ondragend="this.style.opacity='1';" style="transition:0.2s;">
            <div style="display:flex; align-items:center;"><span style="font-size:1.4rem; color:#94a3b8; cursor:grab; padding-right:4px;">≡</span></div>
            <input type="text" value="${label.name}" onchange="window.tempEditingLabels[${index}].name = this.value.trim(); window.LabelManager.renderEventLabels();" style="width:80px; padding:4px; border:1px solid #cbd5e1; border-radius:4px; outline:none; font-weight:bold; color:#1e293b;">
            <select onchange="window.tempEditingLabels[${index}].color = this.value; window.LabelManager.renderEventLabels();" style="padding:4px; border-radius:4px; border:1px solid ${style.border}; background:${style.bg}; color:${style.text}; font-weight:bold; outline:none; cursor:pointer; width:65px;">
                ${Object.keys(this.colorNames).map(k => `<option value="${k}" ${label.color === k ? 'selected' : ''}>${this.colorNames[k]}</option>`).join('')}
            </select>
            <div style="flex:1;"></div>
            <div style="display:flex; gap:10px; align-items:center; text-align:center;">
                <label style="display:flex; flex-direction:column; align-items:center; font-size:0.65rem; font-weight:bold; color:${label.isPeriod ? '#2563eb' : '#94a3b8'}; cursor:pointer;">
                    <span>기간</span><input type="checkbox" onchange="window.tempEditingLabels[${index}].isPeriod = this.checked; if(this.checked){ window.tempEditingLabels[${index}].isForward = false; window.tempEditingLabels[${index}].isRecur = false; } window.LabelManager.renderEventLabels();" ${periodChecked} class="modal-checkbox" style="margin-top:2px;">
                </label>
                <label style="display:flex; flex-direction:column; align-items:center; font-size:0.65rem; font-weight:bold; color:${label.isRecur ? '#16a34a' : '#94a3b8'}; cursor:pointer;">
                    <span>반복</span><input type="checkbox" onchange="window.tempEditingLabels[${index}].isRecur = this.checked; if(this.checked){ window.tempEditingLabels[${index}].isPeriod = false; window.tempEditingLabels[${index}].isForward = false; } window.LabelManager.renderEventLabels();" ${recurChecked} class="modal-checkbox" style="margin-top:2px;">
                </label>
                <label style="display:flex; flex-direction:column; align-items:center; font-size:0.65rem; font-weight:bold; color:${label.isForward ? '#059669' : '#94a3b8'}; cursor:pointer;">
                    <span>완료</span><input type="checkbox" onchange="window.tempEditingLabels[${index}].isForward = this.checked; if(this.checked){ window.tempEditingLabels[${index}].isPeriod = false; window.tempEditingLabels[${index}].isRecur = false; } window.LabelManager.renderEventLabels();" ${forwardChecked} class="modal-checkbox" style="margin-top:2px;">
                </label>
                <label style="display:flex; flex-direction:column; align-items:center; font-size:0.65rem; font-weight:bold; color:${label.isSkip ? '#ef4444' : '#94a3b8'}; cursor:pointer;">
                    <span>수업삭제</span><input type="checkbox" onchange="window.tempEditingLabels[${index}].isSkip = this.checked; window.LabelManager.renderEventLabels();" ${skipChecked} class="modal-checkbox" style="margin-top:2px;">
                </label>
            </div>
            <button onclick="window.LabelManager.removeEventLabel(${index});" class="modal-delete-btn" style="padding:4px; margin-left:4px;" title="삭제">✖</button>
        </div>`;
    }).join('');
  },

  addNewEventLabel: function() {
    const nameInput = document.getElementById('new-label-name');
    const periodCheck = document.getElementById('new-label-period');
    const recurCheck = document.getElementById('new-label-recur');
    const forwardCheck = document.getElementById('new-label-forward');
    const skipCheck = document.getElementById('new-label-skip');
    const colorInput = document.getElementById('event-selected-color');
    const name = nameInput.value.trim();
    const color = colorInput ? colorInput.value : 'blue';
    
    if (!name) return alert("라벨 이름을 입력하세요.");
    
    window.tempEditingLabels.push({ 
        id: this.generateId('lbl_ev'),
        name: name, 
        isPeriod: periodCheck.checked,
        isRecur: recurCheck.checked,
        isForward: forwardCheck.checked, 
        isSkip: skipCheck.checked, 
        color: color,
        isSystem: false 
    });
    
    nameInput.value = ''; 
    periodCheck.checked = false; 
    recurCheck.checked = false;
    forwardCheck.checked = false; 
    skipCheck.checked = false;
    this.renderEventLabels();
  },

  removeEventLabel: function(index) {
      const targetLabel = window.tempEditingLabels[index];
      if (targetLabel && targetLabel.isSystem) {
          alert("🔒 이 라벨은 시스템 작동에 필요한 [필수 라벨]이므로 삭제할 수 없습니다.");
          return;
      }
      window.tempEditingLabels.splice(index, 1);
      this.renderEventLabels(); 
  },

  saveEventLabels: async function(e) {
      for (let i = 0; i < window.tempEditingLabels.length; i++) {
          if (!window.tempEditingLabels[i].name.trim()) return alert(`${i + 1}번째 라벨의 이름이 비어있습니다.`);
      }

      const oldLabels = getEventLabels();
      const dataToSave = window.tempEditingLabels.map(l => ({...l}));

      const newIds = dataToSave.map(l => l.id);
      const deletedIds = oldLabels.map(l => l.id).filter(id => !newIds.includes(id));

      localStorage.setItem('workCalendar_eventLabels_v4', JSON.stringify(dataToSave));
      
      if (window.auth && window.auth.currentUser) {
          try { await setDoc(doc(getUserCol('settings'), 'labels'), { eventLabels: dataToSave }, { merge: true }); } 
          catch (err) { console.error(err); }
      }

      if (deletedIds.length > 0 && window.db) {
          if (e && e.target) { e.target.textContent = "클라우드 찌꺼기 데이터 정리 중..."; e.target.disabled = true; }

          try {
              const eventsSnap = await getDocs(getUserCol('events'));
              let batch = writeBatch(window.db);
              let count = 0; let batchPromises = [];

              eventsSnap.forEach(docSnap => {
                  const data = docSnap.data();
                  let list = data.eventList || [];
                  let docChanged = false;

                  list.forEach(item => {
                      if (item.labelIds) {
                          const originalLength = item.labelIds.length;
                          item.labelIds = item.labelIds.filter(id => !deletedIds.includes(id));
                          if (item.labelIds.length !== originalLength) docChanged = true;
                      }
                  });

                  if (docChanged) {
                      batch.update(docSnap.ref, { eventList: list, updatedAt: Date.now() });
                      count++;
                      if (count >= 400) { batchPromises.push(batch.commit()); batch = writeBatch(window.db); count = 0; }
                  }
              });
              if (count > 0) batchPromises.push(batch.commit());
              await Promise.all(batchPromises);
          } catch (err) { console.error("일정 라벨 정리 오류:", err); }
      }

      if (this.unifiedModal) this.unifiedModal.close();
      alert("일정 라벨 설정이 저장되었습니다.");
      if (typeof window.render === 'function') window.render(); 
  },

  // ====================================================
  // 📔 2. 기록 라벨 관리
  // ====================================================
  getJournalContentHTML: function() {
    return `
      <div class="modal-info-box journal">
          <p style="margin:0;">
              <strong>[기록 라벨]</strong> 왼쪽 '≡' 아이콘을 끌어서 순서를 바꾸거나 이름을 클릭해 수정하세요.<br>
              수정되거나 삭제된 라벨을 사용 중이던 기존 기록은 자동으로 새 라벨로 <strong>변경되거나 해제</strong>됩니다.
          </p>
      </div>
      <div id="journal-label-list-container" class="modal-list-container" style="max-height: 250px; padding-right:8px;"></div>
      
      <div class="modal-input-row alt" style="flex-direction:column; align-items:stretch; gap:10px; margin-bottom:20px; border-top:2px solid #cbd5e1;">
          <div style="display:flex; gap:10px; align-items:center; width:100%;">
              <input type="text" id="new-journal-label-name" placeholder="새 기록 라벨 이름 추가..." class="modal-input-text" onkeydown="if(event.key==='Enter') window.LabelManager.addNewJournalLabel()">
              <button onclick="window.LabelManager.addNewJournalLabel()" class="modal-btn-secondary journal" style="flex-shrink:0;">추가</button>
          </div>
          <div style="padding-left:4px;">
              <span style="font-size:0.85rem; font-weight:bold; color:#64748b;">🎨 새 라벨 색상:</span>
              ${this.getColorPickerHTML('journal', 'purple')}
          </div>
      </div>
      
      <div class="modal-footer-actions">
          <button onclick="window.LabelManager.saveJournalLabels(event)" class="modal-btn-primary journal" style="width:100%; border-radius:6px; font-weight:bold; padding:10px;">💾 저장 및 클라우드 반영</button>
      </div>
    `;
  },

  renderJournalLabels: function() {
    const container = document.getElementById('journal-label-list-container');
    if (!container) return;
    const palette = window.LABEL_PALETTE || {};
    
    container.innerHTML = window.tempEditingJournalLabels.map((label, index) => {
        const style = palette[label.color || 'purple'] || { border: '#d8b4fe', bg: '#f3e8ff', text: '#6b21a8' };
        const dragHandle = `<span style="font-size:1.4rem; color:#94a3b8; cursor:grab; padding-right:4px; line-height:1;">≡</span>`;
        const dragAttrs = `draggable="true" ondragstart="window.LabelManager.handleDragStart(event, ${index}, 'journal')" ondragover="window.LabelManager.handleDragOver(event)" ondrop="window.LabelManager.handleDrop(event, ${index}, 'journal')" ondragend="this.style.opacity='1';"`;
        const nameInputHTML = `<input type="text" value="${label.name}" onchange="window.tempEditingJournalLabels[${index}].name = this.value.trim(); window.LabelManager.renderJournalLabels();" style="width:110px; padding:6px; border:1px solid #cbd5e1; border-radius:4px; outline:none; font-weight:bold; color:#1e293b;">`;
        const colorSelectHTML = `
            <select onchange="window.tempEditingJournalLabels[${index}].color = this.value; window.LabelManager.renderJournalLabels();" style="padding:6px; border-radius:4px; border:1px solid ${style.border}; background:${style.bg}; color:${style.text}; font-weight:bold; outline:none; cursor:pointer;">
                ${Object.keys(this.colorNames).map(k => `<option value="${k}" ${label.color === k ? 'selected' : ''}>${this.colorNames[k]}</option>`).join('')}
            </select>
        `;
        const actionHTML = `<button onclick="window.tempEditingJournalLabels.splice(${index}, 1); window.LabelManager.renderJournalLabels();" class="modal-delete-btn" style="padding:4px;" title="삭제">✖</button>`;

        return `
        <div class="modal-input-row journal" ${dragAttrs} style="transition:0.2s;">
            <div style="display:flex; align-items:center;">${dragHandle}</div>
            ${nameInputHTML}
            ${colorSelectHTML}
            <div style="flex:1;"></div>
            ${actionHTML}
        </div>`;
    }).join('');
  },

  addNewJournalLabel: function() {
    const nameInput = document.getElementById('new-journal-label-name');
    const colorInput = document.getElementById('journal-selected-color');
    const name = nameInput.value.trim();
    const color = colorInput ? colorInput.value : 'purple';
    
    if (!name) return alert("라벨 이름을 입력하세요.");
    
    window.tempEditingJournalLabels.push({ id: this.generateId('lbl_jr'), name: name, color: color });
    nameInput.value = '';
    this.renderJournalLabels();
  },

  saveJournalLabels: async function(e) {
      for (let i = 0; i < window.tempEditingJournalLabels.length; i++) {
          if (!window.tempEditingJournalLabels[i].name.trim()) return alert(`${i + 1}번째 기록 라벨의 이름이 비어있습니다.`);
      }

      const oldLabels = getJournalLabels();
      const dataToSave = window.tempEditingJournalLabels.map(l => ({...l}));

      const newIds = dataToSave.map(l => l.id);
      const deletedIds = oldLabels.map(l => l.id).filter(id => !newIds.includes(id));

      localStorage.setItem('workCalendar_journalLabels_v4', JSON.stringify(dataToSave));
      
      if (window.auth && window.auth.currentUser) {
          try { await setDoc(doc(getUserCol('settings'), 'labels'), { journalLabels: dataToSave }, { merge: true }); } catch (err) {}
      }

      if (deletedIds.length > 0 && window.db) {
          if (e && e.target) { e.target.textContent = "클라우드 찌꺼기 데이터 정리 중..."; e.target.disabled = true; }

          try {
              const snap = await getDocs(getUserCol('journals'));
              let batch = writeBatch(window.db);
              let count = 0; let batchPromises = [];

              snap.forEach(docSnap => {
                  const data = docSnap.data();
                  let entries = data.entries || [];
                  let docChanged = false;

                  entries.forEach(item => {
                      if (item.labelIds) {
                          const originalLength = item.labelIds.length;
                          item.labelIds = item.labelIds.filter(id => !deletedIds.includes(id));
                          if (item.labelIds.length !== originalLength) docChanged = true;
                      }
                  });

                  if (docChanged) {
                      batch.update(docSnap.ref, { entries: entries, updatedAt: Date.now() });
                      count++;
                      if (count >= 400) { batchPromises.push(batch.commit()); batch = writeBatch(window.db); count = 0; }
                  }
              });
              if (count > 0) batchPromises.push(batch.commit());
              await Promise.all(batchPromises);
          } catch (err) { console.error(err); }
      }

      if (this.unifiedModal) this.unifiedModal.close();
      alert("기록 라벨 설정이 클라우드에 성공적으로 저장되었습니다.");
      if (typeof window.render === 'function') window.render(); 
  },

  // ====================================================
  // 📝 3. 메모 라벨 관리
  // ====================================================
  getMemoLabels: function() {
      const saved = JSON.parse(localStorage.getItem('workCalendar_memoLabels'));
      if (saved && saved.length > 0) return saved;
      return []; 
  },

  getMemoContentHTML: function() {
    return `
      <div class="modal-info-box" style="background: #ecfdf5; border-left-color: #10b981; color: #065f46;">
          <p style="margin:0;">
              <strong>[메모 라벨]</strong> 메모를 분류할 태그(Chip)들을 관리합니다.<br>
              왼쪽 '≡'를 끌어 순서를 바꾸거나 이름을 수정할 수 있습니다. 수정/삭제된 라벨은 기존 메모에서도 <strong>변경/해제</strong>됩니다.
          </p>
      </div>
      <div id="memo-label-list-container" class="modal-list-container" style="max-height: 250px; padding-right:8px;"></div>
      
      <div class="modal-input-row alt" style="flex-direction:column; align-items:stretch; gap:10px; margin-bottom:20px; border-top:2px solid #cbd5e1;">
          <div style="display:flex; gap:10px; align-items:center; width:100%;">
              <input type="text" id="new-memo-label-name" placeholder="새 메모 라벨 추가..." class="modal-input-text" onkeydown="if(event.key==='Enter') window.LabelManager.addNewMemoLabel()">
              <button onclick="window.LabelManager.addNewMemoLabel()" class="modal-btn-secondary success" style="flex-shrink:0; background:#10b981;">추가</button>
          </div>
          <div style="padding-left:4px;">
              <span style="font-size:0.85rem; font-weight:bold; color:#64748b;">🎨 태그 색상:</span>
              ${this.getColorPickerHTML('memo', 'green')}
          </div>
      </div>
      
      <div class="modal-footer-actions">
          <button onclick="window.LabelManager.saveMemoLabels(event)" class="modal-btn-primary success" style="width:100%; border-radius:6px; font-weight:bold; padding:10px; background:#059669;">💾 저장 및 클라우드 반영</button>
      </div>
    `;
  },

  renderMemoLabels: function() {
    const container = document.getElementById('memo-label-list-container');
    if (!container) return;
    const palette = window.LABEL_PALETTE || {};
    
    container.innerHTML = window.tempEditingMemoLabels.map((label, index) => {
        const style = palette[label.color || 'green'] || { border: '#86efac', bg: '#dcfce7', text: '#166534' };
        const dragHandle = `<span style="font-size:1.4rem; color:#94a3b8; cursor:grab; padding-right:4px; line-height:1;" title="드래그하여 순서 변경">≡</span>`;
        const dragAttrs = `draggable="true" ondragstart="window.LabelManager.handleDragStart(event, ${index}, 'memo')" ondragover="window.LabelManager.handleDragOver(event)" ondrop="window.LabelManager.handleDrop(event, ${index}, 'memo')" ondragend="this.style.opacity='1';"`;
        const nameInputHTML = `<input type="text" value="${label.name}" onchange="window.tempEditingMemoLabels[${index}].name = this.value.trim(); window.LabelManager.renderMemoLabels();" style="width:110px; padding:6px; border:1px solid #cbd5e1; border-radius:4px; outline:none; font-weight:bold; color:#1e293b;">`;
        const colorSelectHTML = `
            <select onchange="window.tempEditingMemoLabels[${index}].color = this.value; window.LabelManager.renderMemoLabels();" style="padding:6px; border-radius:4px; border:1px solid ${style.border}; background:${style.bg}; color:${style.text}; font-weight:bold; outline:none; cursor:pointer;">
                ${Object.keys(this.colorNames).map(k => `<option value="${k}" ${label.color === k ? 'selected' : ''}>${this.colorNames[k]}</option>`).join('')}
            </select>
        `;
        const actionHTML = `<button onclick="window.tempEditingMemoLabels.splice(${index}, 1); window.LabelManager.renderMemoLabels();" class="modal-delete-btn" style="padding:4px;" title="삭제">✖</button>`;

        return `
        <div class="modal-input-row" ${dragAttrs} style="transition:0.2s; border-left: 3px solid #10b981;">
            <div style="display:flex; align-items:center;">${dragHandle}</div>
            ${nameInputHTML}
            ${colorSelectHTML}
            <div style="flex:1;"></div>
            ${actionHTML}
        </div>`;
    }).join('');
  },

  addNewMemoLabel: function() {
    const nameInput = document.getElementById('new-memo-label-name');
    const colorInput = document.getElementById('memo-selected-color');
    const name = nameInput.value.trim();
    const color = colorInput ? colorInput.value : 'green';
    
    if (!name) return alert("라벨 이름을 입력하세요.");
    
    window.tempEditingMemoLabels.push({ id: this.generateId('lbl_mm'), name: name, color: color });
    nameInput.value = '';
    this.renderMemoLabels();
  },

  saveMemoLabels: async function(e) {
    for (let i=0; i<window.tempEditingMemoLabels.length; i++) {
        if (!window.tempEditingMemoLabels[i].name.trim()) return alert(`${i+1}번째 라벨의 이름이 비어있습니다.`);
    }
    
    const oldLabels = this.getMemoLabels();
    const dataToSave = window.tempEditingMemoLabels.map(l => ({...l}));

    const newIds = dataToSave.map(l => l.id);
    const deletedIds = oldLabels.map(l => l.id).filter(id => !newIds.includes(id));

    localStorage.setItem('workCalendar_memoLabels', JSON.stringify(dataToSave));
    if (window.db && window.auth && window.auth.currentUser) {
        try { await setDoc(doc(getUserCol('settings'), 'labels'), { memoLabels: dataToSave }, { merge: true }); } catch (err) {}
    }
    
    if (deletedIds.length > 0 && window.db) {
        if (e && e.target) { e.target.textContent = "클라우드 찌꺼기 데이터 정리 중..."; e.target.disabled = true; }

        try {
            const snap = await getDocs(getUserCol('tasks'));
            let batch = writeBatch(window.db);
            let opCount = 0; let batchPromises = [];

            snap.forEach(docSnap => {
                const data = docSnap.data();
                if (data.labelIds) {
                    const originalLength = data.labelIds.length;
                    const filtered = data.labelIds.filter(id => !deletedIds.includes(id));
                    if (filtered.length !== originalLength) {
                        batch.update(docSnap.ref, { labelIds: filtered, updatedAt: Date.now() });
                        opCount++;
                        if (opCount >= 400) { batchPromises.push(batch.commit()); batch = writeBatch(window.db); opCount = 0; }
                    }
                }
            });
            if (opCount > 0) batchPromises.push(batch.commit());
            await Promise.all(batchPromises);
        } catch(err) { console.error(err); }
    }

    if (this.unifiedModal) this.unifiedModal.close();
    alert("메모 라벨 설정이 클라우드에 성공적으로 저장되었습니다.");
    
    if (typeof window.render === 'function') {
        window.render(); 
    } else if (window.memoViewInstance) {
        window.memoViewInstance.renderViewer();
    }
  }
};

// ==========================================================================
// 🌉 과도기 호환성 레이어 
// ==========================================================================
window.LabelManager = LabelManager; 

// 기존 버튼 클릭 이벤트가 망가지지 않도록 통합 모달 호출 방식으로 안전하게 연결
window.openEventLabelModal = () => LabelManager.openUnifiedLabelModal('event');
window.openJournalLabelModal = () => LabelManager.openUnifiedLabelModal('journal');
window.openMemoLabelModal = () => LabelManager.openUnifiedLabelModal('memo'); 
window.manageMemoLabels = () => LabelManager.openUnifiedLabelModal('memo');
