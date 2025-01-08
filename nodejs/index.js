import express from 'express';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import cors from "cors";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import mqtt from "mqtt";

const mqttClient = mqtt.connect("mqtt://mosquitto");

mqttClient.on("connect", () => {
  console.log("MQTT Connected")
  mqttClient.subscribe("presence", (err) => {
    if (!err) {
      mqttClient.publish("presence", "Hello mqtt");
    }
  });
});

mqttClient.on("message", (topic, message) => {
  // message is Buffer
  console.log(message.toString());
});
mqttClient.on("error", () => {
  // message is Buffer
  console.log("Error");
});


export var restApp = express();
restApp.use(cors());

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Set up storage engine for multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // cb(null, "renderer/public/images/"); // Specify the folder where files will be stored
    cb(null, "./uploads/"); // Specify the folder where files will be stored
  },
  filename: function (req, file, cb) {
    // Original filename approach (commented for reference):
    // cb(null, `output.${file.originalname.split(".").pop()}`);

    // Timestamp-based filename
    const timestamp = Date.now();
    cb(null, `${timestamp}.${file.originalname.split(".").pop()}`);
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
restApp.get("/", (req, res) => {
  res.json({ message: "Hello World" });
});

// Endpoint to handle file uploads
restApp.post("/photos/upload", upload.array("photos", 1), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No files uploaded" });
  }
  const fileName = req.files[0]['filename'];
  const fileDetails = req.files.map(file => ({
    originalName: file.originalname,
    savedName: file.filename,
    path: file.path,
    size: file.size
  }));

  console.log(`filename : ${fileName}`);
  var transmit =
    { "url": "http://localhost:3002/photos/latest", "team": req.body.team }

  res.status(200).json({
    message: "Files uploaded successfully",
    files: fileDetails
  });
  mqttClient.publish("/app/reportState", JSON.stringify(transmit))
});

// Endpoint to get the latest uploaded image
restApp.get("/photos/latest", (req, res) => {
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
restApp.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});
