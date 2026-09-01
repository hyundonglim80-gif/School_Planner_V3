<<<<<<< HEAD
// js/api/storage.js
export const compressImage = (file, maxWidth = 1200) => { 
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let { width, height } = img;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
                }, 'image/jpeg', 0.8);
            };
        };
    });
=======
// js/api/storage.js
export const compressImage = (file, maxWidth = 1200) => { 
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let { width, height } = img;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
                }, 'image/jpeg', 0.8);
            };
        };
    });
>>>>>>> d1348ae5447b87f69a849130f4f6a30f4c5cc4fe
};