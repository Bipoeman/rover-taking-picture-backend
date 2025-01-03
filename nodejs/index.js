const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors")

var app = express();
app.use(cors())

// Set up storage engine for multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Specify the folder where files will be stored
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`); // Save the file with a timestamp to avoid name collisions
  }
});

// Initialize multer
const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const mimeType = allowedTypes.test(file.mimetype);
    const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());

    if (mimeType && extName) {
      return cb(null, true);
    }
    cb(new Error("Only image files are allowed!"));
  }
});

// Middleware to serve JSON response on root endpoint
app.get("/", (req, res) => {
  res.json({ message: "Hello World" });
});

// Endpoint to handle file uploads
app.post("/photos/upload", upload.array("photos", 12), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No files uploaded" });
  }

  const fileDetails = req.files.map(file => ({
    originalName: file.originalname,
    savedName: file.filename,
    path: file.path,
    size: file.size
  }));

  res.status(200).json({
    message: "Files uploaded successfully",
    files: fileDetails
  });
});

// Endpoint to get the latest uploaded image
app.get("/photos/latest", (req, res) => {
  const uploadDir = path.join(__dirname, "uploads");

  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: "Error reading upload directory" });
    }

    if (files.length === 0) {
      return res.status(404).json({ error: "No images found" });
    }

    // Sort files by modification time (latest first)
    const sortedFiles = files
      .map(file => ({
        name: file,
        time: fs.statSync(path.join(uploadDir, file)).mtime
      }))
      .sort((a, b) => b.time - a.time);

    const latestFile = sortedFiles[0].name;

    res.sendFile(path.join(uploadDir, latestFile));
  });
});

// Start the server
app.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});
