import express from 'express';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import cors from "cors";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import mqtt from "mqtt";
import * as dotenv from 'dotenv'
dotenv.config()

var mqttUrl = process.env.MQTT_HOST ?? "localhost"

const mqttClient = mqtt.connect(`mqtt://${mqttUrl}`);
var isAllowed = true;

mqttClient.on("connect", () => {
  console.log("MQTT Connected")
  mqttClient.subscribe("/app/enableUpload")
  mqttClient.publish("/app/enableUpload",JSON.stringify({"enable" : isAllowed}))
});

mqttClient.on("message", (topic, message) => {
  // message is Buffer
  // console.log(message.toString());
  if (topic === "/app/enableUpload"){
    isAllowed = JSON.parse(message.toString()).enable
  }
});
mqttClient.on("error", () => {
  // message is Buffer
  console.log("Error");
});


export var restApp = express();
restApp.use(cors());
restApp.use("/image", express.static('uploads'))

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads/");
  },
  filename: function (req, file, cb) {
    // cb(null, `output.${file.originalname.split(".").pop()}`);
    const timestamp = Date.now();
    cb(null, `${timestamp}.${file.originalname.split(".").pop()}`);
  },
});

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

function checkUploadAllowed(req, res, next) {
  if (!isAllowed) {
    return res.status(405).json({
      message: "Uploads are currently disabled. Another user has already submitted the picture.",
    });
  }
  next();
}

restApp.get("/", (req, res) => {
  res.json({ message: "Hello World" });
});

restApp.post("/photos/upload",checkUploadAllowed, upload.array("photos",1), (req, res) => {
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
    { 
      // "url": "http://localhost:3002/photos/latest",
      "url": `http://localhost:3002/image/${fileName}`,
      "team": req.body.team 
    }
  if (isAllowed){
    res.status(200).json({
      message: "Files uploaded successfully",
      files: fileDetails
    });
    mqttClient.publish("/app/reportState", JSON.stringify(transmit))
    mqttClient.publish("/app/enableUpload",JSON.stringify({"enable" : false}))
  }
  else{
    res.status(405).json({
      message: "Other already submitted the picture",
    });
  }
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
restApp.listen(3002, () => {
  console.log("Server running on http://localhost:3002");
});
