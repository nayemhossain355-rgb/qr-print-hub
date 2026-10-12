const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ip = require('ip');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 5000;
const localIP = ip.address(); // আপনার পিসির লোকাল আইপি অ্যাড্রেস

// 'uploads' ফোল্ডার চেক করা
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Multer কনফিগারেশন (ফাইল সেভ করার জন্য)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// মিডলওয়্যার
app.use(express.static(path.join(__dirname, 'public')));

// হোম পেজের জন্য সরাসরি পাথ ডিরেকশন
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.json());

// ডাটাবেস ছাড়া ফাইল মেমোরি সংরক্ষণ
let fileList = [];

// ১. QR কোড API
app.get('/api/qr', async (req, res) => {
    try {
        const uploadUrl = `http://${localIP}:${PORT}/mobile.html`;
        const qrImage = await QRCode.toDataURL(uploadUrl);
        res.json({ qrImage, uploadUrl });
    } catch (err) {
        res.status(500).json({ error: 'QR Code তৈরি ব্যর্থ হয়েছে' });
    }
});

// ২. ফাইল লিস্ট API
app.get('/api/files', (req, res) => {
    res.json(fileList);
});

// ৩. মোবাইল থেকে আপলোড API
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('কোন ফাইল পাওয়া যায়নি!');
    }

    const newFile = {
        id: Date.now().toString(),
        name: req.file.originalname,
        filename: req.file.filename,
        path: `/uploads/${req.file.filename}`,
        size: (req.file.size / (1024 * 1024)).toFixed(2) + ' MB',
        type: req.file.mimetype,
        time: new Date().toLocaleTimeString('bn-BD')
    };

    fileList.unshift(newFile);
    io.emit('new-file', newFile); // ড্যাশবোর্ডে লাইভ নোটিফিকেশন পাঠাবে
    res.json({ success: true, file: newFile });
});

// ৪. ফাইল ডিলিট API
app.delete('/api/files/:id', (req, res) => {
    const fileId = req.params.id;
    const index = fileList.findIndex(f => f.id === fileId);

    if (index !== -1) {
        const filePath = path.join(uploadDir, fileList[index].filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        fileList.splice(index, 1);
        io.emit('file-deleted', fileId);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'ফাইল খুঁজে পাওয়া যায়নি' });
    }
});

// সার্ভার চালু
server.listen(PORT, '0.0.0.0', () => {
    console.log(`===============================================`);
    console.log(`সার্ভার চালু হয়েছে!`);
    console.log(`পিসিতে ভিজিট করুন: http://localhost:${PORT}`);
    console.log(`মোবাইল পেজ লিঙ্ক: http://${localIP}:${PORT}/mobile.html`);
    console.log(`===============================================`);
});