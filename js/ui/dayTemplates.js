// js/ui/dayTemplates.js

export const DayTemplates = {
    // 1. 에디터 모드: 하루 일정(Event) 엔트리 HTML 생성
    getEditorEventEntry(ev, idx, fId, isAuthor, allLabelsObj, lockedDateStr, getLabelStyle) {
        const eLabelIds = ev.labelIds || [];
        const isCompleted = !!ev.completed;
        const canComplete = eLabelIds.some(id => allLabelsObj.find(l => l.id === id)?.isForward);

        let forwardedBadge = '';
        if (ev.forwardChainId && ev.originalDate && ev.originalDate !== lockedDateStr) {
            forwardedBadge = `<div style="font-size:0.75rem; font-weight:bold; color:#059669; background:#dcfce3; padding:2px 6px; border-radius:4px; border:1px solid #bbf7d0;">↪️ 이월됨</div>`;
        }

        const deleteBtnHtml = isAuthor 
            ? `<button class="modal-delete-btn" onclick="window.dayViewInstance.requestRemoveEvent('${fId}', ${idx})" title="일정 삭제" style="margin:0; background:transparent; border:none; color:#ef4444; font-size:1.1rem; cursor:pointer;">✖</button>`
            : '';

        const chipsHtml = allLabelsObj.map(lObj => {
            const isActive = eLabelIds.includes(lObj.id);
            const style = getLabelStyle(lObj.id, 'event'); 
            
            const chipClickAttr = isAuthor ? `onclick="window.dayViewInstance.toggleEventLabel('${fId}', ${idx}, '${lObj.id}')"` : '';
            const chipCursorStyle = isAuthor ? 'cursor:pointer;' : 'cursor:not-allowed; opacity:0.8;';
            
            const dynamicStyle = isActive 
                ? `background:${style.text}; color:#ffffff; border:1px solid ${style.text};` 
                : `background:${style.bg}; color:${style.text}; border:1px solid ${style.border}; opacity:0.6;`;

            return `<div class="label-chip ${isActive ? 'active' : ''}" ${chipClickAttr} style="padding:2px 8px; font-size:0.8rem; font-weight:bold; border-radius:4px; min-width:auto; ${chipCursorStyle} ${dynamicStyle}">${lObj.name}</div>`;
        }).join('');

        const checkboxHtml = canComplete 
            ? `<div style="padding-top:8px;"><input type="checkbox" ${isCompleted ? 'checked' : ''} ${!isAuthor ? 'disabled' : ''} onchange="window.dayViewInstance.updateEventStatus('${fId}', ${idx}, this.checked)" style="width:18px; height:18px; cursor:pointer; accent-color:#059669;" title="완료 체크"></div>`
            : '';

        const textBaseStyle = (isCompleted && canComplete) ? 'text-decoration:line-through; color:#94a3b8; background:#e2e8f0;' : 'background:#fff; color:#1e293b;';
        const textStyle = !isAuthor ? 'background:#f1f5f9; color:#64748b; cursor:not-allowed;' : textBaseStyle;
        const pureContent = (ev.content || '').replace(/➡️\s*\(미완료\)/g, '').replace(/➡️\s*\(다음 날로 이월됨\)/g, '').replace(/↪️\s*/g, '').trim();

        const timeVal = ev.time || '';
        const timeColor = timeVal ? '#2563eb' : '#94a3b8';
        const timeBg = timeVal ? '#eff6ff' : '#f8fafc';
        const timeBorder = timeVal ? '#bfdbfe' : '#cbd5e1';

        const timeHtml = isAuthor 
              ? `<div onclick="window.dayViewInstance.openDayAlarmModal('${fId}',${idx})" style="display:inline-flex; align-items:center; background:${timeBg}; padding:2px 6px; border-radius:4px; border:1px solid${timeBorder}; cursor:pointer; margin-right:4px;" title="클릭하여 알림 설정">
                   <span style="font-size:0.75rem; font-weight:bold; color:${timeColor};">${window.CompactEventHelper ? window.CompactEventHelper.formatAlarmTime(timeVal) : ''}</span>
                 </div>` 
              : `<span style="font-size:0.75rem; color:${timeColor}; font-weight:bold; background:${timeBg}; padding:2px 6px; border-radius:4px; border:1px solid ${timeBorder}; margin-right:4px;">${window.CompactEventHelper ? window.CompactEventHelper.formatAlarmTime(timeVal) : ''}</span>`;

        const linkCount = (ev.linkedItems || []).length;
        const linkBadgeHtml = linkCount > 0 
            ? `<button onclick="window.LinkManager.openViewer('${lockedDateStr}', '${ev.id}', '${fId}', 'event')" style="background:#fef08a; color:#854d0e; font-size:0.75rem; padding:2px 6px; border-radius:4px; margin-left:4px; font-weight:bold; border:1px solid #fde047; cursor:pointer;" title="연결된 내용 보기 및 수정">📑 ${linkCount}</button>` 
            : '';
        const linkBtnHtml = isAuthor
              ? `<div style="display:flex; align-items:center; margin-right:4px;"><button onclick="window.LinkManager.openModal('event', '${lockedDateStr}', '${ev.id}', '${fId}')" style="background:#f8fafc; border:1px solid #cbd5e1; color:#475569; font-size:0.75rem; cursor:pointer; padding:2px 6px; border-radius:4px; line-height:1;" title="새 링크 연결">🔗 연결</button>${linkBadgeHtml}</div>`
              : (linkCount > 0 ? `<div style="margin-right:4px;">${linkBadgeHtml}</div>` : '');

        const authorBadge = (fId !== 'personal' && ev.authorId)
            ? `<span style="font-size:0.7rem; background:#e2e8f0; color:#475569; padding:2px 6px; border-radius:4px; margin-left:4px;" title="작성자">👤 ${ev.authorName || ev.authorId.substring(0, 6)}</span>`
            : '';

        return `
        <div style="display:flex; flex-direction:column; padding:10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; margin-bottom:12px; transition:0.2s;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                <div class="label-chip-container" style="margin:0; display:flex; flex-wrap:wrap; gap:6px; align-items:center; flex:1;">
                    ${chipsHtml}${forwardedBadge}
                </div>
                <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                    ${linkBtnHtml} 
                    ${timeHtml}
                    ${authorBadge}${deleteBtnHtml}
                </div>
            </div>
            <div style="display:flex; align-items:flex-start; gap:8px; width:100%;">
                ${checkboxHtml}
                <textarea class="modal-input-text" ${!isAuthor ? 'readonly' : ''} placeholder="${isAuthor ? '일정 내용 입력...' : '권한이 없습니다.'}" style="flex:1; min-height:40px; resize:none; overflow:hidden; font-size:0.95rem; padding:8px; box-sizing:border-box; border:1px solid #cbd5e1; border-radius:4px; outline:none; ${textStyle}" onfocus="window.dayViewInstance.autoResize(this)" oninput="window.dayViewInstance.autoResize(this); window.dayViewInstance.updateEventContent('${fId}', ${idx}, this.value)">${pureContent}</textarea>
            </div>
        </div>`;
    },

    // 2. 에디터 모드: 하루 기록(Journal) 엔트리 HTML 생성
    getEditorJournalEntry(j, idx, fId, isAuthor, allLabelsObj, lockedDateStr, getLabelStyle) {
        const jLabelIds = j.labelIds || [];
        const chipsHtml = allLabelsObj.map(lObj => {
            const isActive = jLabelIds.includes(lObj.id);
            const style = getLabelStyle(lObj.id, 'journal'); 
            
            const dynamicStyle = isActive 
                ? `background:${style.text}; color:#ffffff; border:1px solid ${style.text};` 
                : `background:${style.bg}; color:${style.text}; border:1px solid ${style.border}; opacity:0.6;`;

            return `<div class="label-chip ${isActive ? 'active' : ''}" onclick="window.dayViewInstance.toggleJournalLabel('${fId}', ${idx}, '${lObj.id}')" style="padding:2px 8px; font-size:0.8rem; font-weight:bold; border-radius:4px; min-width:auto; cursor:pointer; ${dynamicStyle}">${lObj.name}</div>`;
        }).join('');

        const attachmentsHtml = (j.attachments && j.attachments.length > 0) ? `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">` + j.attachments.map((a, aIdx) => {
            const downloadUrl = a.downloadLink || `https://drive.google.com/uc?export=download&id=${a.id}`;
            return `
            <div onclick="window.handleAttachmentClick('${a.name}', '${a.webViewLink}', '${downloadUrl}')" style="display:inline-flex; align-items:center; gap:6px; padding:4px 8px; background:#fff; border:1px solid #fbcfe8; border-radius:6px; font-size:0.85rem; color:#be185d; box-shadow:0 1px 2px rgba(0,0,0,0.05); cursor:pointer;">
                <img src="${a.iconLink || 'https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg'}" style="width:16px; height:16px;">
                <span style="font-weight:bold; max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${a.name}</span>
                <button class="modal-delete-btn" onclick="event.stopPropagation(); window.dayViewInstance.removeJournalAttachment('${fId}', ${idx}, ${aIdx})" style="margin-left:4px; padding:0; color:#ef4444; font-size:1.1rem; line-height:1;" title="첨부 링크 삭제">✖</button>
            </div>`;
        }).join('') + `</div>` : '';

        const uploadId = `journal-upload-${fId}-${idx}`;
        const isUploading = j.isUploading ? `<div style="margin-top:8px; font-size:0.85rem; color:#2563eb; font-weight:bold; display:flex; align-items:center; gap:6px;">⏳ 구글 드라이브로 파일 업로드 중...</div>` : '';

        const linkCount = (j.linkedItems || []).length;
        const linkBadgeHtml = linkCount > 0 
            ? `<button onclick="window.LinkManager.openViewer('${lockedDateStr}', '${j.id}', '${fId}', 'journal')" style="background:#fef08a; color:#854d0e; font-size:0.75rem; padding:2px 6px; border-radius:4px; margin-left:4px; font-weight:bold; border:1px solid #fde047; cursor:pointer;" title="연결된 내용 보기 및 수정">📑 ${linkCount}</button>` 
            : '';
        const linkBtnHtml = isAuthor
            ? `<div style="display:flex; align-items:center; margin-right:8px;"><button onclick="window.LinkManager.openModal('journal', '${lockedDateStr}', '${j.id}', '${fId}')" style="background:#fff; border:1px solid #fbcfe8; color:#be185d; font-size:0.75rem; cursor:pointer; padding:2px 6px; border-radius:4px; line-height:1;" title="새 링크 연결">🔗 연결</button>${linkBadgeHtml}</div>`
            : (linkCount > 0 ? `<div style="margin-right:8px;">${linkBadgeHtml}</div>` : '');

        const authorBadge = (fId !== 'personal' && j.authorId)
            ? `<span style="font-size:0.7rem; background:#e2e8f0; color:#475569; padding:2px 6px; border-radius:4px; margin-right:8px;" title="작성자">👤 ${j.authorName || j.authorId.substring(0, 6)}</span>`
            : '';

        return `
        <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px; padding:10px; background:#fdf2f8; border:1px solid #fbcfe8; border-radius:6px; position:relative;">
            <div style="position:absolute; top:8px; right:8px; display:flex; align-items:center;">
                ${linkBtnHtml} 
                ${authorBadge}
                <button class="modal-delete-btn" onclick="window.dayViewInstance.removeJournalEntry('${fId}',${idx})" title="기록 삭제" style="margin:0; color:#be185d;">✖</button>
            </div>
            <div class="label-chip-container" style="margin:0; padding-right:24px; display:flex; flex-wrap:wrap; gap:4px;">${chipsHtml}</div>
            <div style="display:flex; align-items:flex-start; width:100%; gap:8px;">
                <textarea class="modal-input-text" placeholder="학급 기록, 상담, 업무 일지 등을 입력하세요..." style="flex:1; min-height:40px; resize:none; overflow:hidden; font-size:0.95rem; padding:8px; box-sizing:border-box; outline:none; border:1px solid #fbcfe8; border-radius:4px;" onfocus="window.dayViewInstance.autoResize(this)" oninput="window.dayViewInstance.autoResize(this); window.dayViewInstance.updateJournalContent('${fId}', ${idx}, this.value)">${j.content || ''}</textarea>
                
                <button onclick="document.getElementById('${uploadId}').click()" style="background:#fce7f3; color:#be185d; border:1px solid #fbcfe8; padding:0; border-radius:4px; cursor:pointer; font-size:1.2rem; width:40px; height:40px; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 1px 2px rgba(0,0,0,0.05); transition:0.2s;" onmouseover="this.style.background='#fbcfe8'" onmouseout="this.style.background='#fce7f3'" title="구글 드라이브 문서/파일 첨부">📎</button>
                <input type="file" id="${uploadId}" multiple style="display:none;" onchange="window.dayViewInstance.handleJournalAttachmentUpload('${fId}',${idx}, this)">
            </div>
            ${isUploading}${attachmentsHtml}
        </div>`;
    },

    // 3. 에디터 모드: 시간표 교시 행 HTML 생성
    getEditorPeriodRow(p, pObj, periodName, fId, evalBadges, dateStr) {
        const linkCount = (pObj.linkedItems || []).length;
        const linkBadge = linkCount > 0 ? `<button onclick="window.LinkManager.openViewer('${dateStr}', null, '${fId}', 'schedule', ${p})" style="background:#fef08a; color:#854d0e; font-size:0.7rem; padding:2px 5px; border-radius:4px; font-weight:bold; cursor:pointer; border:1px solid #fde047;" title="연결된 항목 보기 및 수정">📑 ${linkCount}</button>` : '';
        
        return `
        <tr id="period-row-${fId}-${p}" data-period="${p}" 
            ondragstart="window.dayViewInstance.handlePeriodDragStart(event, ${p}, '${fId}')"
            ondragend="window.dayViewInstance.handlePeriodDragEnd(event, '${fId}')"
            ondragenter="event.preventDefault(); this.style.backgroundColor='#e2e8f0';"
            ondragover="event.preventDefault(); event.dataTransfer.dropEffect='move';"
            ondragleave="this.style.backgroundColor='';"
            ondrop="event.preventDefault(); this.style.backgroundColor=''; window.dayViewInstance.handlePeriodDrop(event, ${p}, '${fId}');"
            style="transition: background-color 0.2s;">
          
          <td class="period-cell" 
              onmouseenter="document.getElementById('period-row-${fId}-${p}').setAttribute('draggable', 'true')"
              onmouseleave="document.getElementById('period-row-${fId}-${p}').removeAttribute('draggable')"
              style="padding:4px; vertical-align:middle; text-align:center; background:#f8fafc; cursor:grab;" title="이곳을 드래그하여 사이에 끼워넣기">
              <div style="display:flex; align-items:center; justify-content:center; gap:6px; pointer-events:none;">
                  <span style="font-size:1.2rem; color:#94a3b8;">≡</span>
                  <span style="font-weight:900; color:#475569; font-size:0.95rem;">${periodName}</span>
              </div>
          </td>
          <td class="editable-cell cell-subject" contenteditable="true" oninput="window.dayViewInstance.syncScheduleInputs('${fId}')">${pObj.subject || ''}</td>
          <td class="editable-cell cell-memo" contenteditable="true" style="text-align: left;" oninput="window.dayViewInstance.syncScheduleInputs('${fId}')">${pObj.memo || ''}</td>
          <td style="text-align: left; vertical-align: top;">
            <div class="editable-cell cell-supplies" contenteditable="true" style="color: #d97706; font-weight: 600; min-height:20px; outline:none;" oninput="window.dayViewInstance.syncScheduleInputs('${fId}')">${pObj.supplies || ''}</div>
            <div contenteditable="false" style="display:flex; align-items:center; flex-wrap:wrap; gap:6px; margin-top:4px;">
                <div class="eval-badges-container" data-badge-period="${p}" style="display:flex; flex-wrap:wrap; gap:6px;">
                    ${linkBadge}
                    ${evalBadges}
                </div>
            </div>
          </td>
        </tr>`;
    },

    // 4. 뷰어 모드: 시간표 교시 행 HTML 생성
    getViewerPeriodRow(p, pObj, periodName, fId, evalBadges, dateStr) {
        const linkCount = (pObj.linkedItems || []).length;
        const linkBadge = linkCount > 0 ? `<button onclick="window.LinkManager.openViewer('${dateStr}', null, '${fId}', 'schedule', ${p})" style="background:#fef08a; color:#854d0e; font-size:0.7rem; padding:2px 5px; border-radius:4px; font-weight:bold; cursor:pointer; border:1px solid #fde047;" title="연결된 항목 보기 및 수정">📑 ${linkCount}</button>` : '';

        return `
        <tr data-period="${p}">
            <td style="width: 60px; font-weight:900; color:#475569; background:#f8fafc; vertical-align:middle; border-bottom: 1px solid #cbd5e1;">${periodName}</td>
            <td style="width: 120px; vertical-align:top; padding:10px 8px; border-bottom: 1px dashed #cbd5e1;"><div style="font-weight:bold; color:#0f172a;">${pObj.subject || ''}</div></td>
            <td style="vertical-align:top; padding:10px 8px; border-bottom: 1px dashed #cbd5e1;"><div style="text-align: left; color:#334155; white-space:pre-wrap;">${pObj.memo || ''}</div></td>
            <td style="width: 25%; vertical-align:top; padding:10px 8px; border-bottom: 1px dashed #cbd5e1;">
                <div style="color: #d97706; font-weight: 600; text-align: left; white-space:pre-wrap;">${pObj.supplies || ''}</div>
                <div style="display:flex; align-items:center; flex-wrap:wrap; gap:6px; margin-top:4px;">
                    <div class="eval-badges-container" data-badge-period="${p}" style="display:flex; flex-wrap:wrap; gap:6px;">
                        ${linkBadge}
                        ${evalBadges}
                    </div>
                </div>
            </td>
        </tr>`;
    },

    // 5. 뷰어 모드: 하루 기록(Journal) 엔트리 HTML 생성
    getViewerJournalEntry(j, dateStr, fId, masterJournalLabels, getLabelStyle) {
        const lNames = j.labelIds?.map(id => masterJournalLabels.find(l => l.id === id)?.name).filter(Boolean) || j.labels || (j.label ? [j.label] : []);
        const chipsHtml = lNames.map(lName => {
            const style = getLabelStyle(lName, 'journal') || { bg: '#fdf2f8', text: '#9d174d', border: '#fbcfe8' };
            return `<span style="display:inline-block; padding:2px 6px; font-size:0.8rem; font-weight:bold; border-radius:4px; background:${style.bg}; color:${style.text}; border:1px solid ${style.border}; margin-right:6px; white-space:nowrap; vertical-align:middle;">${lName}</span>`;
        }).join('');

        const attachmentsHtml = (j.attachments && j.attachments.length > 0) ? `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">` + j.attachments.map(a => {
            const downloadUrl = a.downloadLink || `https://drive.google.com/uc?export=download&id=${a.id}`;
            return `
            <div onclick="window.handleAttachmentClick('${a.name}', '${a.webViewLink}', '${downloadUrl}')" style="display:inline-flex; align-items:center; gap:6px; padding:4px 10px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; font-size:0.85rem; color:#0f172a; cursor:pointer; font-weight:bold; transition:0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f8fafc'">
                <img src="${a.iconLink || 'https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg'}" style="width:16px; height:16px;">
                <span style="max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${a.name}</span>
            </div>`;
        }).join('') + `</div>` : '';

        const linkCount = (j.linkedItems || []).length;
        const linkBadgeHtml = linkCount > 0 
            ? `<button onclick="window.LinkManager.openViewer('${dateStr}', '${j.id}', '${fId}', 'journal')" style="background:#fef08a; color:#854d0e; font-size:0.75rem; padding:2px 6px; border-radius:4px; margin-left:4px; font-weight:bold; border:1px solid #fde047; cursor:pointer;" title="연결된 내용 보기 및 수정">📑 ${linkCount}</button>` 
            : '';

        return `
            <div style="display:flex; align-items:flex-start; margin-bottom:12px; line-height:1.4;">
                <div style="margin-top:1px; flex-shrink:0;">${chipsHtml}${linkBadgeHtml}</div>
                <div style="font-size:1rem; color:#1e293b; white-space:pre-wrap; word-break:break-all; flex:1; margin-left:6px;">${j.content || ''}${attachmentsHtml ? '\n' + attachmentsHtml : ''}</div>
            </div>`;
    },

    // 6. 뷰어 모드: 일정(Event)의 텍스트에 삽입될 링크 배지 HTML 생성 (🚨 신규 추가)
    getViewerEventLinkBadge(ev, lockedDateStr, fId) {
        const linkCount = (ev.linkedItems || []).length;
        if (linkCount === 0) return '';
        return ` <button onclick="window.LinkManager.openViewer('${lockedDateStr}', '${ev.id}', '${fId}', 'event')" style="background:#fef08a; color:#854d0e; font-size:0.75rem; padding:2px 5px; border-radius:4px; margin-left:4px; font-weight:bold; border:1px solid #fde047; cursor:pointer; vertical-align:middle;" title="연결된 내용 보기 및 수정">📑 ${linkCount}</button>`;
    }
};