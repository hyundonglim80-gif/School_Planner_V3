// js/api/driveAPI.js
import { getValidGoogleToken } from './auth.js';

// 🌟 [추가] 구글 API 에러를 감지하고 명확한 알림을 띄우는 헬퍼 함수
const handleDriveError = async (res) => {
    if (!res.ok) {
        if (res.status === 403) {
            throw new Error("구글 드라이브 접근 권한이 없습니다.\n\n앱 우측 상단에서 '로그아웃' 후 다시 로그인하실 때, 팝업창에서 '구글 드라이브 접근 권한' 체크박스를 반드시 선택해주세요.");
        }
        throw new Error(`Google Drive API 에러: ${res.status}`);
    }
    return res;
};

export const driveAPI = {
    getOrCreateFolder: async function(token, folderName) {
        const q = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`);
        const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        // 에러 확인
        await handleDriveError(searchRes);
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
        
        // 에러 확인
        await handleDriveError(createRes);
        const createData = await createRes.json();
        return createData.id;
    },

    uploadFile: async function(file) {
        const token = await getValidGoogleToken();
        if (!token) throw new Error("구글 계정 연결이 필요합니다.");

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

        await handleDriveError(initRes);

        const uploadUrl = initRes.headers.get('Location');
        if (!uploadUrl) throw new Error("업로드 URL을 응답받지 못했습니다.");

        const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Length': file.size.toString() },
            body: file
        });

        await handleDriveError(uploadRes);
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

    uploadFiles: async function(fileList) {
        const token = await getValidGoogleToken();
        if (!token) throw new Error("구글 계정 연결이 필요합니다.");

        // 폴더 조회는 한 번만 수행
        const folderId = await this.getOrCreateFolder(token, 'School_Planner');
        const files = Array.from(fileList);
        
        const uploadPromises = files.map(async (file) => {
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

            await handleDriveError(initRes);

            const uploadUrl = initRes.headers.get('Location');
            if (!uploadUrl) throw new Error("업로드 URL을 응답받지 못했습니다.");

            const uploadRes = await fetch(uploadUrl, {
                method: 'PUT',
                headers: { 'Content-Length': file.size.toString() },
                body: file
            });

            await handleDriveError(uploadRes);
            const fileData = await uploadRes.json();

            await fetch(`https://www.googleapis.com/drive/v3/files/${fileData.id}/permissions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ role: 'reader', type: 'anyone' })
            }).catch(e => console.warn("권한 변경 실패:", e));

            return {
                id: fileData.id,
                name: fileData.name,
                webViewLink: fileData.webViewLink,
                downloadLink: `https://drive.google.com/uc?export=download&id=${fileData.id}`,
                iconLink: fileData.iconLink
            };
        });

        return await Promise.all(uploadPromises);
    },

    deleteFile: async function(fileId) {
        if (!fileId) return;
        const token = await getValidGoogleToken();
        if (!token) return;
        try {
            const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            await handleDriveError(res);
            console.log("✅ 구글 드라이브 파일 삭제 완료:", fileId);
        } catch (e) {
            console.warn("드라이브 파일 삭제 실패:", e);
        }
    }
};
