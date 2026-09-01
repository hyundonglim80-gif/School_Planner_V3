<<<<<<< HEAD
// js/utils/csvHelper.js

export const CSVHelper = {
    parse: function(csvText) {
        const rows = []; let row = []; let inQuotes = false; let val = '';
        for (let i = 0; i < csvText.length; i++) {
            let c = csvText[i], nc = csvText[i+1];
            if (c === '"' && inQuotes && nc === '"') { val += '"'; i++; }
            else if (c === '"') { inQuotes = !inQuotes; }
            else if (c === ',' && !inQuotes) { row.push(val.replace(/\r$/, '')); val = ''; }
            else if (c === '\n' && !inQuotes) { row.push(val.replace(/\r$/, '')); rows.push(row); row = []; val = ''; }
            else { val += c; }
        }
        if (val || row.length > 0) { row.push(val.replace(/\r$/, '')); rows.push(row); }
        return rows;
    },
    
    escape: function(str) {
        if (str == null) return "";
        let s = String(str);
        if (s.includes('"') || s.includes(',') || s.includes('\n')) s = '"' + s.replace(/"/g, '""') + '"';
        return s;
    }
=======
// js/utils/csvHelper.js

export const CSVHelper = {
    parse: function(csvText) {
        const rows = []; let row = []; let inQuotes = false; let val = '';
        for (let i = 0; i < csvText.length; i++) {
            let c = csvText[i], nc = csvText[i+1];
            if (c === '"' && inQuotes && nc === '"') { val += '"'; i++; }
            else if (c === '"') { inQuotes = !inQuotes; }
            else if (c === ',' && !inQuotes) { row.push(val.replace(/\r$/, '')); val = ''; }
            else if (c === '\n' && !inQuotes) { row.push(val.replace(/\r$/, '')); rows.push(row); row = []; val = ''; }
            else { val += c; }
        }
        if (val || row.length > 0) { row.push(val.replace(/\r$/, '')); rows.push(row); }
        return rows;
    },
    
    escape: function(str) {
        if (str == null) return "";
        let s = String(str);
        if (s.includes('"') || s.includes(',') || s.includes('\n')) s = '"' + s.replace(/"/g, '""') + '"';
        return s;
    }
>>>>>>> d1348ae5447b87f69a849130f4f6a30f4c5cc4fe
};