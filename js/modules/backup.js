const BackupModule = {
  // 1. 백업할 날짜 목록 추출기
  getTargetDateList: function() {
    const dates = [];
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const y = window.currentDate.getFullYear();
    const m = window.currentDate.getMonth();
    const d = window.currentDate.getDate();

    if (currentScope === 'day') {
      const dateObj = new Date(y, m, d);
      dates.push({ dateStr: window.formatDate(dateObj), year: y, month: m + 1, day: d, dayOfWeek: dayNames[dateObj.getDay()] });
    } else if (currentScope === 'week') {
      const tempDate = new Date(window.currentDate);
      const dayOfWeek = tempDate.getDay();
      const diffToSun = tempDate.getDate() - dayOfWeek;
      tempDate.setDate(diffToSun);
      for (let i = 0; i < 7; i++) {
        if (!window.showWeekend && (i === 0 || i === 6)) { tempDate.setDate(tempDate.getDate() + 1); continue; }
        dates.push({ dateStr: window.formatDate(tempDate), year: tempDate.getFullYear(), month: tempDate.getMonth() + 1, day: tempDate.getDate(), dayOfWeek: dayNames[tempDate.getDay()] });
        tempDate.setDate(tempDate.getDate() + 1);
      }
    } else if (currentScope === 'month') {
      const lastDate = new Date(y, m + 1, 0).getDate();
      for (let i = 1; i <= lastDate; i++) {
        const dateObj = new Date(y, m, i);
        dates.push({ dateStr: window.formatDate(dateObj), year: y, month: m + 1, day: i, dayOfWeek: dayNames[dateObj.getDay()] });
      }
    } else {
      const startYear = y;
      for (let monthIdx = 3; monthIdx <= 14; monthIdx++) { 
        let targetY = startYear;
        let targetM = monthIdx;
        if (monthIdx > 12) { targetY = startYear + 1; targetM = monthIdx - 12; }
        const lastDate = new Date(targetY, targetM, 0).getDate();
        for (let i = 1; i <= lastDate; i++) {
          const dateObj = new Date(targetY, targetM - 1, i);
          dates.push({ dateStr: window.formatDate(dateObj), year: targetY, month: targetM, day: i, dayOfWeek: dayNames[dateObj.getDay()] });
        }
      }
    }
    return dates;
  },

  // 2. CSV 다운로드 실행기
  downloadCSVFile: function(filename, csvData) {
    const bom = "\uFEFF";
    const blob = new Blob([bom + csvData], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  },

  // 3. 엑셀 특수문자 이스케이프 처리
  escapeCSV: function(str) {
    if (!str && str !== 0) return '';
    let s = String(str);
    let trimmed = s.trim();
    if (/^\d+[-/:]\d+$/.test(trimmed)) { return `'${trimmed}`; }
    s = s.replace(/"/g, '""');
    if (s.includes(',') || s.includes('\n') || s.includes('"')) { s = `"${s}"`; }
    return s;
  },

  // 4. CSV 파서 (줄바꿈 완벽 인식)
  parseCSV: function(str) {
    const arr = [];
    let quote = false;
    let col = 0, row = 0;
    for (let c = 0; c < str.length; c++) {
      let cc = str[c], nc = str[c+1];
      arr[row] = arr[row] || [];
      arr[row][col] = arr[row][col] || '';
      if (cc == '"' && quote && nc == '"') { arr[row][col] += cc; ++c; continue; }
      if (cc == '"') { quote = !quote; continue; }
      if (cc == ',' && !quote) { ++col; continue; }
      if (cc == '\r' && nc == '\n' && !quote) { ++row; col = 0; ++c; continue; }
      if (cc == '\n' && !quote) { ++row; col = 0; continue; }
      if (cc == '\r' && !quote) { ++row; col = 0; continue; }
      arr[row][col] += cc;
    }
    return arr;
  },

  // 5. DB 대량 업데이트(Batch) 실행기
  executeBatchOperations: async function(operations) {
    const chunkSize = 400; 
    for (let i = 0; i < operations.length; i += chunkSize) {
      const chunk = operations.slice(i, i + chunkSize);
      const batch = window.db.batch();
      chunk.forEach(op => {
        if (op.type === 'delete') batch.delete(op.ref);
        else if (op.type === 'set') batch.set(op.ref, op.data);
      });
      await batch.commit();
    }
  },

  // 6. 다운로드 메인 로직
  downloadCSV: async function() {
    const eventSnap = await window.getUserCol('events').get();
    const scheduleSnap = await window.getUserCol('schedules').get();
    const journalSnap = await window.getUserCol('journals').get();

    const eventMap = {};
    eventSnap.forEach(doc => { 
      const data = doc.data();
      let eList = [];
      if (data.eventList && Array.isArray(data.eventList) && data.eventList.length > 0) {
        eList = data.eventList;
      } else if (data.eventText && data.eventText.trim() !== '') {
        eList = window.parseRawEventTextToEventList(data.eventText);
      }
      eventMap[doc.id] = eList.map(e => `[${e.label}] ${e.content}`).join('\n');
    });

    const scheduleMap = {};
    scheduleSnap.forEach(doc => { scheduleMap[doc.id] = doc.data().periods || {}; });

    const journalMap = {};
    journalSnap.forEach(doc => { 
      const data = doc.data();
      let jList = [];
      if (data.entries && Array.isArray(data.entries) && data.entries.length > 0) {
        jList = data.entries;
      }
      journalMap[doc.id] = jList.map(j => `[${j.label}] ${j.content}`).join('\n');
    });

    // 💡 환경설정 시수에 맞게 엑셀 헤더 동적 생성
    const maxPeriod = window.periodNames ? window.periodNames.length : 6;
    let header = "년도,월,일,요일,일정,";
    for(let p=1; p<=maxPeriod; p++) header += `${p}교시 과목,`;
    for(let p=1; p<=maxPeriod; p++) header += `${p}교시 메모,`;
    for(let p=1; p<=maxPeriod; p++) header += `${p}교시 비고,`;
    header += "일지\n";
    
    let csv = header;
    const targetDates = this.getTargetDateList();

    targetDates.forEach(item => {
      const eventText = eventMap[item.dateStr] || '';
      const journalText = journalMap[item.dateStr] || '';
      const periods = scheduleMap[item.dateStr] || {};
      
      let rowStr = `${item.year},${item.month},${item.day},${item.dayOfWeek},${this.escapeCSV(eventText)}`;
      let subjects = []; let memos = []; let supplies = [];

      for (let p = 1; p <= maxPeriod; p++) {
        subjects.push(this.escapeCSV(periods[p]?.subject || ''));
        memos.push(this.escapeCSV(periods[p]?.memo || ''));
        supplies.push(this.escapeCSV(periods[p]?.supplies || ''));
      }
      rowStr += `,${subjects.join(',')},${memos.join(',')},${supplies.join(',')},${this.escapeCSV(journalText)}`;
      csv += rowStr + "\n";
    });

    let titlePrefix = `${window.currentDate.getFullYear()}학년도`;
    if (currentScope === 'day') {
      titlePrefix = `${window.currentDate.getFullYear()}년_${window.currentDate.getMonth()+1}월_${window.currentDate.getDate()}일`;
    } else if (currentScope === 'week') {
      const temp = new Date(window.currentDate);
      const day = temp.getDay();
      const sun = new Date(temp.setDate(temp.getDate() - day));
      const endDay = new Date(sun);
      endDay.setDate(sun.getDate() + 6);
      const mStr1 = String(sun.getMonth()+1).padStart(2,'0');
      const dStr1 = String(sun.getDate()).padStart(2,'0');
      const mStr2 = String(endDay.getMonth()+1).padStart(2,'0');
      const dStr2 = String(endDay.getDate()).padStart(2,'0');
      titlePrefix = `${window.currentDate.getFullYear()}년_${mStr1}${dStr1}_${mStr2}${dStr2}_주간`;
    } else if (currentScope === 'month') {
      titlePrefix = `${window.currentDate.getFullYear()}년_${window.currentDate.getMonth()+1}월`;
    }

    this.downloadCSVFile(`${titlePrefix}_백업.csv`, csv);
  },

  // 7. 업로드 및 복원 메인 로직
  uploadCSV: async function(input) {
    const file = input.files[0];
    if(!file) return;
    if(!confirm("⚠️ [안내] 업로드하는 파일에 포함된 '해당 날짜'의 데이터만 수정됩니다.\n(파일에 없는 다른 달의 데이터는 그대로 안전하게 유지됩니다.)\n진행하시겠습니까?")) {
      input.value = ''; return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      const rows = this.parseCSV(text);
      const operations = [];
      const maxPeriod = window.periodNames ? window.periodNames.length : 6;

      const parseExcelText = (val) => {
        let v = (val || '').trim();
        if (v.startsWith('=')) v = v.substring(1);
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.substring(1, v.length - 1);
        }
        if (v.startsWith("'")) v = v.substring(1);
        return v;
      };

      const parseStructuredList = (rawStr, defaultLabel) => {
          const text = parseExcelText(rawStr);
          if (!text) return [];
          const regex = /\[(.*?)\]/g;
          const matches = [...text.matchAll(regex)];
          
          if (matches.length === 0) return [{ label: defaultLabel, content: text }];

          const items = [];
          for (let i = 0; i < matches.length; i++) {
              const currentMatch = matches[i];
              const label = currentMatch[1].trim();
              const startIndex = currentMatch.index + currentMatch[0].length;
              let endIndex = text.length;
              if (i + 1 < matches.length) endIndex = matches[i + 1].index;
              
              const content = text.substring(startIndex, endIndex).trim();
              items.push({ label: label, content: content });
          }
          return items;
      };

      for(let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if(row.length >= 5 && row[0].trim() && row[1].trim() && row[2].trim()) {
          const y = row[0].trim();
          const m = String(row[1].trim()).padStart(2, '0');
          const d = String(row[2].trim()).padStart(2, '0');
          const dateStr = `${y}-${m}-${d}`;
          
          const eventTextRaw = parseExcelText(row[4]);
          const eventList = parseStructuredList(eventTextRaw, '일정');
          const cleanEventText = eventList.map(e => `[${e.label}] ${e.content}`).join('\n');
          const isSkipDay = window.checkSkipConditionFromText(cleanEventText);
          
          const periodsData = {};
          for (let p = 1; p <= maxPeriod; p++) {
            let subj = parseExcelText(row[4 + p]);
            if (isSkipDay) subj = '';
            // 인덱스 계산: 과목(4+p), 메모(4+maxPeriod+p), 비고(4+maxPeriod*2+p)
            periodsData[p] = { 
                subject: subj, 
                memo: parseExcelText(row[4 + maxPeriod + p]), 
                supplies: parseExcelText(row[4 + maxPeriod * 2 + p]) 
            };
          }

          // 일지 인덱스: 5 + maxPeriod * 3
          const journalIndex = 4 + maxPeriod * 3 + 1;
          const journalTextRaw = parseExcelText(row[journalIndex] || '');
          const journalList = parseStructuredList(journalTextRaw, '참고');

          const eRef = window.getUserCol('events').doc(dateStr);
          operations.push({ type: 'set', ref: eRef, data: { eventList: eventList, eventText: cleanEventText, updatedAt: Date.now() } });
          
          const sRef = window.getUserCol('schedules').doc(dateStr);
          operations.push({ type: 'set', ref: sRef, data: { periods: periodsData, updatedAt: Date.now() } });

          const jRef = window.getUserCol('journals').doc(dateStr);
          if (journalList.length > 0) {
              operations.push({ type: 'set', ref: jRef, data: { entries: journalList, updatedAt: Date.now() } });
          } else {
              operations.push({ type: 'delete', ref: jRef });
          }
        }
      }

      await this.executeBatchOperations(operations);
      alert("✅ 데이터가 성공적으로 동기화 및 업데이트되었습니다!");
      window.render();
    };
    reader.readAsText(file, 'utf-8');
    input.value = '';
  }
};

// 기존 로직과 호환되도록 전역 함수로 연결
window.downloadCSV = () => BackupModule.downloadCSV();
window.uploadCSV = (input) => BackupModule.uploadCSV(input);
// timetable.js 등 다른 모듈에서도 Batch 연산을 쓸 수 있게 노출
window.executeBatchOperations = (ops) => BackupModule.executeBatchOperations(ops);
