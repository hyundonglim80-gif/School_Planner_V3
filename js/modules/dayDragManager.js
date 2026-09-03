// js/modules/dayDragManager.js

import { store } from '../core/store.js';
import { dbAPI } from '../api/database.js';
import { DayTemplates } from '../ui/dayTemplates.js';

export const DayDragManager = {
    draggedPeriod: null,
    draggedFilterId: null,

    handleDragStart(instance, event, period, filterId) {
        this.draggedPeriod = period;
        this.draggedFilterId = filterId;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(period)); 
        setTimeout(() => {
            const row = event.target.closest('tr');
            if (row) row.style.opacity = '0.4';
            const tableContainer = event.target.closest('.table-container');
            if (tableContainer) tableContainer.classList.add('is-dragging'); 
        }, 0);
    },

    handleDragEnd(instance, event, filterId) {
        const tbody = document.getElementById(`schedule-tbody-${filterId}`);
        if (tbody) {
            tbody.querySelectorAll('tr').forEach(tr => { 
                tr.style.opacity = '1'; 
                tr.style.backgroundColor = '';
                tr.removeAttribute('draggable');
            });
        }
        const tableContainer = event.target.closest('.table-container');
        if (tableContainer) tableContainer.classList.remove('is-dragging');
        this.draggedPeriod = null;
        this.draggedFilterId = null;
    },

    handleDrop(instance, event, targetPeriod, filterId) {
        event.preventDefault();
        event.stopPropagation();
        
        const tableContainer = event.target.closest('.table-container');
        if (tableContainer) tableContainer.classList.remove('is-dragging');
        
        let sourcePeriodStr = '';
        try { sourcePeriodStr = event.dataTransfer.getData('text/plain'); } catch(e) {}
        
        const sourcePeriod = parseInt(sourcePeriodStr, 10) || this.draggedPeriod;
        if (!sourcePeriod || sourcePeriod === targetPeriod || this.draggedFilterId !== filterId) return;

        this.executeClassInsert(instance, sourcePeriod, targetPeriod, filterId);
        this.draggedPeriod = null;
        this.draggedFilterId = null;
    },

    executeClassInsert(instance, sourceP, targetP, fId) {
        if (sourceP === targetP) return;
        
        instance.syncScheduleInputs(fId);

        const s = parseInt(sourceP, 10);
        const t = parseInt(targetP, 10);
        const schedules = instance.dayData[fId].schedules;
        const sourceData = schedules[s] ? { ...schedules[s] } : null;

        if (s < t) {
            for (let i = s; i < t; i++) {
                if (schedules[i + 1]) schedules[i] = { ...schedules[i + 1] };
                else delete schedules[i];
            }
        } else {
            for (let i = s; i > t; i--) {
                if (schedules[i - 1]) schedules[i] = { ...schedules[i - 1] };
                else delete schedules[i];
            }
        }

        if (sourceData) schedules[t] = sourceData;
        else delete schedules[t];

        let evalChanged = false;
        instance.currentEvalList.forEach(ev => {
            const eSource = ev.context?.source || (ev.periodStr ? 'schedule' : 'journal');
            const targetGid = fId === 'personal' ? null : fId;
            if (eSource === 'schedule' && ev.groupId === targetGid) {
                const savedPeriod = ev.periodStr || ev.context?.period || '';
                const p = parseInt(String(savedPeriod).replace(/[^0-9]/g, ''), 10);
                
                if (p === s) {
                    ev.periodStr = String(t);
                    if (ev.context) ev.context.period = t;
                    evalChanged = true;
                } else if (s < t && p > s && p <= t) {
                    ev.periodStr = String(p - 1);
                    if (ev.context) ev.context.period = p - 1;
                    evalChanged = true;
                } else if (s > t && p >= t && p < s) {
                    ev.periodStr = String(p + 1);
                    if (ev.context) ev.context.period = p + 1;
                    evalChanged = true;
                }
            }
        });

        store.hasUnsavedChanges = true;

        const tbody = document.getElementById(`schedule-tbody-${fId}`);
        if (tbody) {
            tbody.innerHTML = Array.from({ length: instance.maxPeriod || 6 }).map((_, i) => {
                const p = i + 1;
                const pObj = schedules[p] || {};
                const periodName = store.periodNames[i] || p + '교시';
                const evalBadges = instance.generateEvalBadgesHtml('schedule', p, fId);
                return DayTemplates.getEditorPeriodRow(p, pObj, periodName, fId, evalBadges, instance.lockedDateStr || instance.dateStr);
            }).join('');
        }

        if (evalChanged) {
            const targetGid = fId === 'personal' ? null : fId;
            const scheduleEvals = instance.currentEvalList.filter(e => e.context?.source === 'schedule' && e.groupId === targetGid);
            const journalEvals = instance.currentEvalList.filter(e => e.context?.source === 'journal' && e.groupId === targetGid);
            
            dbAPI.saveEvaluations(instance.lockedDateStr || instance.dateStr, scheduleEvals, targetGid).catch(e => console.warn(e));
            if (journalEvals.length > 0) {
                dbAPI.saveEvaluations(instance.lockedDateStr || instance.dateStr, journalEvals, targetGid).catch(e => console.warn(e));
            }
        }
        
        if (typeof window.saveCurrentViewData === 'function') {
            window.saveCurrentViewData(true);
        } else {
            instance.save();
            store.hasUnsavedChanges = false;
        }
    }
};