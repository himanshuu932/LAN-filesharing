import { useState, useEffect } from "react";
import FileCard from "./components/FileCard";
import Toolbar from "./components/Toolbar";
import PreviewModal from "./components/PreviewModal";

export default function App() {
  const [drives, setDrives] = useState([]);
  const [files, setFiles] = useState([]);
  const [currentPath, setCurrentPath] = useState("");
  const [uploading, setUploading] = useState(false);
  const [baseURL, setBaseURL] = useState("");
  const [previewFile, setPreviewFile] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname;

    if (path === "/save" && params.has("ip")) {
      try {
        const encodedIP = params.get("ip");
        const scannedIP = atob(encodedIP);
        if (!scannedIP) throw new Error("Empty IP after decoding");

        localStorage.setItem("server_ip", scannedIP);
        alert(`✅ Backend connected to ${scannedIP}`);
        window.location.replace("/");
        return;
      } catch (err) {
        console.error("Failed to decode IP from URL", err);
        alert("❌ Invalid connection link.");
        window.location.replace("/");
        return;
      }
    }

    detectServerIP();
  }, []);

  // --- Detect backend IP ---
  const detectServerIP = async () => {
    const cachedIP = localStorage.getItem("server_ip");

    if (cachedIP) {
      const url = `http://${cachedIP}:8000`;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const res = await fetch(`${url}/ip`, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          setBaseURL(url);
          loadDrives(url);
          return;
        }
      } catch {
        localStorage.removeItem("server_ip");
      }
    }

    // Poll localhost
    const pollInterval = 3000;
    const maxAttempts = 40;
    let attempts = 0;
    let intervalId;

    const poll = async () => {
      attempts++;
      try {
        const res = await fetch("http://localhost:8000/ip");
        if (res.ok) {
          const data = await res.json();
          if (data?.ip && data.ip !== "false") {
            const detectedIP = data.ip;
            const url = `http://${detectedIP}:8000`;
            localStorage.setItem("server_ip", detectedIP);
            clearInterval(intervalId);
            setBaseURL(url);
            loadDrives(url);
            return;
          }
        }
      } catch {}
      if (attempts >= maxAttempts) clearInterval(intervalId);
    };

    intervalId = setInterval(poll, pollInterval);
    poll();
  };

  // --- Load drives ---
  const loadDrives = async (url = baseURL) => {
    const effectiveUrl = url || baseURL;
    if (!effectiveUrl) return;
    try {
      const res = await fetch(`${effectiveUrl}/drives`);
      if (!res.ok) throw new Error("Failed to fetch drives");
      const data = await res.json();

      if (data && data.length > 0) {
        setDrives(data);
        const lastPath = localStorage.getItem("last_path");

        if (lastPath) {
          setCurrentPath(lastPath);
          fetchFiles(lastPath, effectiveUrl);
        } else {
          setCurrentPath(data[0]);
          fetchFiles(data[0], effectiveUrl);
        }
      }
    } catch (error) {
      console.error(error);
      alert("Could not load drives. Is the backend running?");
    }
  };

  // --- Fetch files ---
  const fetchFiles = async (path, url = baseURL) => {
    const effectiveUrl = url || baseURL;
    if (!effectiveUrl) return;

    try {
      const res = await fetch(
        `${effectiveUrl}/files?path=` + encodeURIComponent(path)
      );
      if (!res.ok) {
        alert("Cannot access folder. Check permissions.");
        goBack();
        return;
      }
      const data = await res.json();
      setFiles(data);
      localStorage.setItem("last_path", path); // ✅ Save last opened path
    } catch (error) {
      console.error(error);
      alert("Failed to fetch files.");
    }
  };

  // --- Navigation ---
  const goBack = () => {
    if (currentPath.length <= 3) return;
    let newPath = currentPath.substring(0, currentPath.lastIndexOf("\\"));
    if (newPath.length < 3) newPath += "\\";
    setCurrentPath(newPath);
    fetchFiles(newPath);
  };

  const changeDrive = (drive) => {
    setCurrentPath(drive);
    fetchFiles(drive);
  };

  // --- Upload file ---
  const handleUpload = async (e) => {
    e.preventDefault();
    if (uploading || !baseURL) return;

    const form = new FormData(e.target);
    form.append("path", currentPath);
    setUploading(true);

    try {
      const res = await fetch(`${baseURL}/upload`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error("Upload failed");
      fetchFiles(currentPath);
      e.target.reset();
      setShowUploadModal(false);
    } catch (error) {
      console.error(error);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  // --- Preview handlers ---
  const handlePreview = (fileItem) => {
    setPreviewFile({
      name: fileItem.name,
      path: currentPath,
    });
  };
  const handleClosePreview = () => setPreviewFile(null);

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 relative">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-extrabold mb-6 tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          LAN File Explorer
        </h1>

        <Toolbar
          drives={drives}
          currentPath={currentPath}
          goBack={goBack}
          changeDrive={changeDrive}
          baseURL={baseURL}
        />

        <p className="mt-4 bg-white p-3 rounded-lg shadow-sm text-slate-600 text-sm font-mono break-all border border-slate-200">
          {currentPath || "Connecting to backend..."}
        </p>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-6">
          {files.map((item) => (
            <FileCard
              key={item.name}
              item={item}
              currentPath={currentPath}
              onOpen={(newPath) => {
                setCurrentPath(newPath);
                fetchFiles(newPath);
              }}
              baseURL={baseURL}
              onPreview={handlePreview}
            />
          ))}
        </div>
      </div>

      {/* Floating + Button */}
      {baseURL && (
        <button
          onClick={() => setShowUploadModal(true)}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 text-white text-3xl flex items-center justify-center shadow-lg hover:bg-blue-700 transition-transform hover:scale-105"
        >
          +
        </button>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div
          onClick={() => setShowUploadModal(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md"
          >
            <h2 className="text-xl font-semibold mb-4 text-center text-slate-800">
              Upload a File
            </h2>
            <form onSubmit={handleUpload} className="flex flex-col gap-4">
              <input
                type="file"
                name="file"
                required
                className="text-sm text-slate-500
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-lg file:border-0 file:text-sm file:font-semibold
                          file:bg-blue-50 file:text-blue-700
                          hover:file:bg-blue-100 transition-colors duration-200"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-all disabled:opacity-75"
                >
                  {uploading ? "Uploading..." : "Upload"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      <PreviewModal file={previewFile} baseURL={baseURL} onClose={handleClosePreview} />
    </div>
  );
}
