import express from "express";
import cors from "cors";
import os from "os";
import path from "path";
import fs from "fs";
import multer from "multer";
import mime from "mime-types";
import { execSync } from "child_process";
import http from "http";

const app = express();
const PORT = 8000;
const __dirname = path.resolve();

// ---------- Middleware ----------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------- Helper: List Drives ----------
function listDrives() {
  try {
    const output = execSync("wmic logicaldisk get name", { encoding: "utf8" });
    return output
      .split("\n")
      .filter(line => line.trim().endsWith(":"))
      .map(line => line.trim() + "\\");
  } catch (err) {
    console.error("Error listing drives:", err);
    return [];
  }
}

// ---------- Helper: Check Hidden/System ----------
function isHiddenOrSystem(filePath) {
  try {
    const base = path.basename(filePath);
    return base.startsWith("$") || base.startsWith(".");
  } catch {
    return false;
  }
}

// ---------- GET: Local IP ----------
app.get("/ip", (req, res) => {
  const interfaces = os.networkInterfaces();
  let localIp = "127.0.0.1";
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === "IPv4" && !net.internal) {
        localIp = net.address;
        break;
      }
    }
  }
  res.json({ ip: localIp });
});

// ---------- GET: List Drives ----------
app.get("/drives", (req, res) => {
  res.json(listDrives());
});

// ---------- GET: List Files ----------
app.get("/files", (req, res) => {
  const queryPath = req.query.path;
  if (!queryPath) return res.status(400).send("Missing path");

  let normalized = path.normalize(queryPath);
  // Fix: make sure "C:" becomes "C:\\"
  if (/^[A-Za-z]:$/.test(normalized)) normalized += "\\";

  try {
    if (!fs.existsSync(normalized)) {
      return res.status(404).send("Path not found");
    }
    const stat = fs.lstatSync(normalized);
    if (!stat.isDirectory()) {
      return res.status(400).send("Not a directory");
    }
  } catch (err) {
    console.error("Access error:", err.message);
    return res.status(403).send("Cannot access folder, check permissions");
  }

  let entries = [];
  try {
    entries = fs.readdirSync(normalized);
  } catch (err) {
    console.error("Error reading:", err.message);
    return res.status(403).send("Cannot access folder, check permissions");
  }

  const result = entries
    .filter(name => !isHiddenOrSystem(path.join(normalized, name)))
    .map(name => {
      const fullPath = path.join(normalized, name);
      let isDir = false;
      let size = 0;
      try {
        const stat = fs.lstatSync(fullPath);
        isDir = stat.isDirectory();
        size = isDir ? 0 : stat.size;
      } catch {
        // skip inaccessible files
        return null;
      }
      return { name, is_dir: isDir, size };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.is_dir && !b.is_dir) return -1;
      if (!a.is_dir && b.is_dir) return 1;
      return a.name.localeCompare(b.name);
    });

  res.json(result);
});

// ---------- GET: View File (stream/preview) ----------
app.get("/view", (req, res) => {
  const filePath = req.query.path;
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).send("File not found");
  }

  try {
    const stat = fs.statSync(filePath);
    const mimeType = mime.lookup(filePath) || "application/octet-stream";
    const range = req.headers.range;

    if (range) {
      const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : stat.size - 1;
      const chunkSize = end - start + 1;

      const fileStream = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": mimeType,
      });
      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": stat.size,
        "Content-Type": mimeType,
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    console.error("Error in /view:", err.message);
    res.status(500).send("Error reading file");
  }
});

// ---------- GET: Download ----------
app.get("/download", (req, res) => {
  const filePath = req.query.path;
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).send("File not found");
  }

  try {
    res.download(filePath);
  } catch (err) {
    console.error("Download error:", err.message);
    res.status(500).send("Error downloading file");
  }
});

// ---------- POST: Upload ----------
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post("/upload", upload.single("file"), (req, res) => {
  const folderPath = req.body.path;
  if (!folderPath || !fs.existsSync(folderPath)) {
    return res.status(400).send("Invalid upload path");
  }

  const filename = path.basename(req.file.originalname);
  const targetPath = path.join(folderPath, filename);

  try {
    fs.writeFileSync(targetPath, req.file.buffer);
    res.send("File uploaded successfully");
  } catch (err) {
    console.error("Upload error:", err.message);
    res.status(500).send("Error saving file");
  }
});

// ---------- Start Server ----------
const server = http.createServer(app);
server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ File Browser running at http://0.0.0.0:${PORT}`);
});
