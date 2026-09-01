// js/api/driveAPI.js
import { getValidGoogleToken } from './auth.js';

export const driveAPI = {
    getOrCreateFolder: async function(token, folderName) {
        const q = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`);
        const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const searchData = await searchRes.json();
        if (searchData.files && searchData.files.length > 0) {
            return searchData.files[0].id;
        }
        
        const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder'
            })
        });
        const createData = await createRes.json();
        return createData.id;
    },

    uploadFile: async function(file) {
        const token = await getValidGoogleToken();
        if (!token) throw new Error("구글 드라이브 접근 권한이 없습니다.");

        const folderId = await this.getOrCreateFolder(token, 'School_Planner');

        const metadata = {
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            parents: [folderId]
        };

        const fields = 'id,name,webViewLink,iconLink';
        const initRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=${fields}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metadata)
        });

        if (!initRes.ok) throw new Error(`드라이브 업로드 세션 생성 실패: ${initRes.status}`);

        const uploadUrl = initRes.headers.get('Location');
        if (!uploadUrl) throw new Error("업로드 URL을 응답받지 못했습니다.");

        const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Length': file.size.toString() },
            body: file
        });

        if (!uploadRes.ok) throw new Error(`드라이브 파일 전송 실패: ${uploadRes.status}`);
        const fileData = await uploadRes.json();

        await fetch(`https://www.googleapis.com/drive/v3/files/${fileData.id}/permissions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ role: 'reader', type: 'anyone' })
        }).catch(e => console.warn("권한 변경 실패(무시 가능):", e));

        console.log("✅ 구글 드라이브 업로드 성공:", fileData);
        
        return {
            id: fileData.id,
            name: fileData.name,
            webViewLink: fileData.webViewLink,
            downloadLink: `https://drive.google.com/uc?export=download&id=${fileData.id}`,
            iconLink: fileData.iconLink
        };
    },

    deleteFile: async function(fileId) {
        if (!fileId) return;
        const token = await getValidGoogleToken();
        if (!token) return;
        try {
            await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log("✅ 구글 드라이브 파일 삭제 완료:", fileId);
        } catch (e) {
            console.warn("드라이브 파일 삭제 실패:", e);
        }
    }
};