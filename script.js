document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const video = document.getElementById('video');
    const countdownEl = document.getElementById('countdown');
    const flashEl = document.getElementById('flash');
    const photoIndexEl = document.getElementById('photo-index');
    const totalSlotsText = document.getElementById('total-slots-text');
    const startBtn = document.getElementById('start-btn');
    const resetBtn = document.getElementById('reset-btn');
    const downloadBtn = document.getElementById('download-btn');
    const strip = document.getElementById('booth-strip');
    const stripFooterText = document.getElementById('strip-footer-text');
    const stripDateText = document.getElementById('strip-date-text');
    const customTextInput = document.getElementById('custom-text-input');
    const layoutSelect = document.getElementById('layout-select');
    const timerSelect = document.getElementById('timer-select');
    const vignetteToggle = document.getElementById('vignette-toggle');
    const grainToggle = document.getElementById('grain-toggle');
    const vignetteOverlay = document.getElementById('vignette-overlay');
    const grainOverlay = document.getElementById('grain-overlay');
    const stickerLayer = document.getElementById('sticker-layer');

    // App States
    let currentFilter = 'filter-normal';
    let currentFrameColor = '#ffffff';
    let maxSlots = 4;
    let timerDelay = 5;
    let photosTaken = 0;
    let stream = null;
    let defaultFooterText = 'Memorable Day';
    const capturedImages = [null, null, null, null];

    // Set Tanggal
    const today = new Date();
    stripDateText.innerText = today.toLocaleDateString('id-ID', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });

    // Audio Synth Beep & Shutter
    function playAudio(type) {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            if (type === 'beep') {
                osc.frequency.setValueAtTime(800, ctx.currentTime);
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                osc.start();
                osc.stop(ctx.currentTime + 0.1);
            } else if (type === 'shutter') {
                osc.type = 'square';
                osc.frequency.setValueAtTime(150, ctx.currentTime);
                gain.gain.setValueAtTime(0.2, ctx.currentTime);
                osc.start();
                osc.stop(ctx.currentTime + 0.08);
            }
        } catch (e) {}
    }

    // Inisialisasi Kamera dengan Resolusi Tinggi (HD)
    async function initCamera() {
        try {
            if (stream) stream.getTracks().forEach(track => track.stop());
            
            // Request resolusi HD 1080p dari hardware kamera
            stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    facingMode: 'user',
                    width: { ideal: 1920, max: 3840 },
                    height: { ideal: 1080, max: 2160 }
                }
            });
            video.srcObject = stream;
        } catch (err) {
            // Fallback jika HP/Webcam tidak support 1080p
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
                });
                video.srcObject = stream;
            } catch (fallbackErr) {
                alert('Akses kamera ditolak atau tidak ditemukan.');
            }
        }
    }

    // Custom Text Event Listener
    customTextInput.addEventListener('input', (e) => {
        const text = e.target.value.trim();
        stripFooterText.innerText = text !== '' ? text : defaultFooterText;
    });

    // Layout Dynamic Change
    layoutSelect.addEventListener('change', (e) => {
        maxSlots = parseInt(e.target.value);
        totalSlotsText.innerText = maxSlots;
        
        for (let i = 1; i <= 4; i++) {
            const slot = document.getElementById(`canvas-${i}`).parentElement;
            if (i <= maxSlots) {
                slot.classList.remove('hidden');
            } else {
                slot.classList.add('hidden');
            }
        }
        resetPhotobooth();
    });

    // Timer Select Change
    timerSelect.addEventListener('change', (e) => {
        timerDelay = parseInt(e.target.value);
    });

    // Vignette & Grain Toggles
    vignetteToggle.addEventListener('change', (e) => {
        vignetteOverlay.classList.toggle('hidden', !e.target.checked);
    });

    grainToggle.addEventListener('change', (e) => {
        grainOverlay.classList.toggle('hidden', !e.target.checked);
    });

    // Set Filter Video
    function setFilter(filterClass) {
        currentFilter = filterClass;
        video.className = `w-full h-full object-cover ${filterClass}`;
        for (let i = 1; i <= 4; i++) {
            const canvas = document.getElementById(`canvas-${i}`);
            if (!canvas.classList.contains('hidden')) {
                canvas.className = `w-full h-full captured-frame ${filterClass}`;
            }
        }
    }

    function makeDraggable(elm) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

        elm.onmousedown = dragMouseDown;
        elm.ontouchstart = dragTouchStart;

        function dragMouseDown(e) {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            elm.style.top = (elm.offsetTop - pos2) + "px";
            elm.style.left = (elm.offsetLeft - pos1) + "px";
        }

        function dragTouchStart(e) {
            const touch = e.touches[0];
            pos3 = touch.clientX;
            pos4 = touch.clientY;
            document.ontouchend = closeDragElement;
            document.ontouchmove = touchMove;
        }

        function touchMove(e) {
            const touch = e.touches[0];
            pos1 = pos3 - touch.clientX;
            pos2 = pos4 - touch.clientY;
            pos3 = touch.clientX;
            pos4 = touch.clientY;
            elm.style.top = (elm.offsetTop - pos2) + "px";
            elm.style.left = (elm.offsetLeft - pos1) + "px";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
            document.ontouchend = null;
            document.ontouchmove = null;
        }
    }

    // Jalankan Foto Otomatis
    function startPhotobooth() {
        photosTaken = 0;
        startBtn.disabled = true;
        startBtn.innerText = 'Bersiap...';
        downloadBtn.disabled = true;
        
        for (let i = 1; i <= maxSlots; i++) {
            document.getElementById(`canvas-${i}`).classList.add('hidden');
        }
        takeNextPhoto();
    }

    function takeNextPhoto() {
        if (photosTaken >= maxSlots) {
            startBtn.disabled = false;
            startBtn.innerText = '⚡ Mulai Foto Otomatis';
            downloadBtn.disabled = false;
            return;
        }

        let count = timerDelay;
        countdownEl.classList.remove('hidden');
        countdownEl.innerText = count;
        playAudio('beep');

        const interval = setInterval(() => {
            count--;
            if (count > 0) {
                countdownEl.innerText = count;
                playAudio('beep');
            } else {
                clearInterval(interval);
                countdownEl.classList.add('hidden');

                playAudio('shutter');
                flashEl.classList.remove('hidden');
                setTimeout(() => flashEl.classList.add('hidden'), 150);

                snapPhoto();
                photosTaken++;
                photoIndexEl.innerText = photosTaken;

                setTimeout(takeNextPhoto, 1200);
            }
        }, 1000);
    }

    // Ambil Foto HD dengan Penyesuaian Aspect Ratio (Tanpa Gepeng)
    function snapPhoto() {
        const currentIdx = photosTaken + 1;
        const canvas = document.getElementById(`canvas-${currentIdx}`);
        const ctx = canvas.getContext('2d');

        // Resolusi Target HD (Aspect Ratio 4:3)
        const targetWidth = 1440;
        const targetHeight = 1080;
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        // Ukuran Asli Video dari Kamera
        const vWidth = video.videoWidth || 1280;
        const vHeight = video.videoHeight || 720;

        // Kalkulasi Crop Otomatis (Object-Fit: Cover) agar tidak gepeng
        const targetRatio = targetWidth / targetHeight;
        const videoRatio = vWidth / vHeight;

        let sWidth, sHeight, sx, sy;

        if (videoRatio > targetRatio) {
            sHeight = vHeight;
            sWidth = vHeight * targetRatio;
            sx = (vWidth - sWidth) / 2;
            sy = 0;
        } else {
            sWidth = vWidth;
            sHeight = vWidth / targetRatio;
            sx = 0;
            sy = (vHeight - sHeight) / 2;
        }

        // Draw cropped HD frame to canvas
        ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
        
        capturedImages[photosTaken] = canvas.toDataURL('image/png', 1.0);

        canvas.className = `w-full h-full captured-frame ${currentFilter}`;
        canvas.classList.remove('hidden');
    }

    function resetPhotobooth() {
        photosTaken = 0;
        photoIndexEl.innerText = '0';
        startBtn.disabled = false;
        startBtn.innerText = '⚡ Mulai Foto Otomatis';
        downloadBtn.disabled = true;
        stickerLayer.innerHTML = '';
        
        for (let i = 1; i <= 4; i++) {
            const canvas = document.getElementById(`canvas-${i}`);
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            canvas.classList.add('hidden');
        }
    }

    // Download Ultra HD Canvas Export (Diperbesar Skalanya)
    function downloadImage() {
        const masterCanvas = document.createElement('canvas');
        const mCtx = masterCanvas.getContext('2d');

        // Dimensi HD Strip Foto
        const stripWidth = 1600; 
        const padding = 80;
        const photoGap = 50;
        const photoW = stripWidth - (padding * 2);
        const photoH = photoW * (3 / 4); // Menjaga Rasio 4:3
        const footerH = 260;
        const stripHeight = (padding * 2) + (photoH * maxSlots) + (photoGap * (maxSlots - 1)) + footerH;

        masterCanvas.width = stripWidth;
        masterCanvas.height = stripHeight;

        // Background Frame
        mCtx.fillStyle = currentFrameColor;
        mCtx.fillRect(0, 0, stripWidth, stripHeight);

        // Map Filter Preset Style
        const filterStyles = {
            'filter-vintage': 'sepia(0.35) contrast(0.95) brightness(1.05) saturate(1.1)',
            'filter-bw': 'grayscale(1) contrast(1.15) brightness(1.02)',
            'filter-warm': 'saturate(1.2) sepia(0.12) brightness(1.03)',
            'filter-cool': 'hue-rotate(10deg) saturate(1.1) brightness(1.03)',
            'filter-normal': 'none'
        };

        let imagesLoaded = 0;
        for (let i = 0; i < maxSlots; i++) {
            const img = new Image();
            img.src = capturedImages[i];
            img.onload = function () {
                const posX = padding;
                const posY = padding + (i * (photoH + photoGap));

                mCtx.save();
                // Balikkan efek mirror secara horizontal
                mCtx.translate(posX + photoW, posY);
                mCtx.scale(-1, 1);
                mCtx.filter = filterStyles[currentFilter] || 'none';
                
                // Draw gambar dengan rasio presisi
                mCtx.drawImage(img, 0, 0, photoW, photoH);
                mCtx.restore();

                imagesLoaded++;
                if (imagesLoaded === maxSlots) {
                    // Cetak Teks Footer HD
                    mCtx.filter = 'none';
                    mCtx.fillStyle = currentFrameColor === '#1e293b' ? '#f8fafc' : '#334155';
                    mCtx.font = 'bold 48px Arial, sans-serif';
                    mCtx.textAlign = 'center';
                    mCtx.fillText(stripFooterText.innerText.toUpperCase(), stripWidth / 2, stripHeight - 120);

                    mCtx.font = '28px Arial, sans-serif';
                    mCtx.fillStyle = '#94a3b8';
                    mCtx.fillText(stripDateText.innerText, stripWidth / 2, stripHeight - 65);

                    // Download PNG Kualitas Maksimal
                    const link = document.createElement('a');
                    link.download = `zeetsnap-hd-${Date.now()}.png`;
                    link.href = masterCanvas.toDataURL('image/png', 1.0);
                    link.click();
                }
            };
        }
    }

    // UI Active State Handler
    document.querySelectorAll('.btn-filter').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('filter-active'));
            e.currentTarget.classList.add('filter-active');
            setFilter(e.currentTarget.dataset.filter);
        });
    });

    document.querySelectorAll('.btn-frame').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.btn-frame').forEach(b => b.classList.remove('frame-active'));
            const target = e.currentTarget;
            target.classList.add('frame-active');
            currentFrameColor = target.dataset.color;
            defaultFooterText = target.dataset.footer;
            strip.style.backgroundColor = currentFrameColor;
            
            if (!customTextInput.value.trim()) {
                stripFooterText.innerText = defaultFooterText;
            }
        });
    });

    startBtn.addEventListener('click', startPhotobooth);
    resetBtn.addEventListener('click', resetPhotobooth);
    downloadBtn.addEventListener('click', downloadImage);

    initCamera();
});