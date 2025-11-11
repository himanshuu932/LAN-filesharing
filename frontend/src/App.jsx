import { useState, useEffect } from "react";
import FileCard from "./components/FileCard";
import Toolbar from "./components/Toolbar";
import PreviewModal from "./components/PreviewModal"; // Import the modal

export default function App() {
  const [drives, setDrives] = useState([]);
  const [files, setFiles] = useState([]);
  const [currentPath, setCurrentPath] = useState("");
  const [uploading, setUploading] = useState(false);
  const [baseURL, setBaseURL] = useState("");
  const [previewFile, setPreviewFile] = useState(null); // State for the modal

  // 👇 Combined both useEffects into one
  useEffect(() => {
    // 🧭 Handle /save route FIRST
    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname;

    if (path === "/save" && params.has("ip")) {
      try {
        const encodedIP = params.get("ip");
        const scannedIP = atob(encodedIP); // 👈 DECODE with atob()

        if (!scannedIP) throw new Error("Empty IP after decoding");

        console.log("📥 Saving decoded backend IP from QR:", scannedIP);
        localStorage.setItem("server_ip", scannedIP);
        alert(`✅ Backend connected to ${scannedIP}`);
        
        // Redirect to home
        window.location.replace("/");
        return; // 👈 Stop execution to prevent detectServerIP
        
      } catch (err) {
        console.error("Failed to decode IP from URL", err);
        alert("❌ Invalid connection link. Could not decode IP.");
        window.location.replace("/"); // Redirect home anyway
        return; // 👈 Stop execution
      }
    }

    // 🔹 If not on /save, run normal IP detection
    detectServerIP();
  }, []); // 👈 Empty dependency array, runs once on mount

  // 🧩 Detect backend IP dynamically
  const detectServerIP = async () => {
    const cachedIP = localStorage.getItem("server_ip");

    // 🔹 If we already have an IP, try it first
    if (cachedIP) {
      const url = `http://${cachedIP}:8000`;
      try {
        // 👇 Simple timeout for fetch
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        const res = await fetch(`${url}/ip`, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          console.log("✅ Using cached IP:", cachedIP);
          setBaseURL(url);
          loadDrives(url);
          return;
        }
      } catch (err) {
        console.warn("⚠️ Cached IP failed, clearing cache...");
        localStorage.removeItem("server_ip");
      }
    }

    // 🔹 No valid cached IP, start polling localhost
    console.log("📡 Polling localhost for backend IP...");

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
          if (data?.ip) {
            const detectedIP = data.ip;
            const url = `http://${detectedIP}:8000`;
            console.log("✅ Backend found at:", url);

            localStorage.setItem("server_ip", detectedIP);
            clearInterval(intervalId);
            setBaseURL(url);
            loadDrives(url);
            return;
          }
        }
      } catch (err) {
        // silently ignore
      }

      if (attempts >= maxAttempts) {
        clearInterval(intervalId);
        console.warn("❌ Backend IP not found after several tries.");
      }
    };

    intervalId = setInterval(poll, pollInterval);
    poll(); // run immediately once
  };

  const loadDrives = async (url = baseURL) => {
    // 👈 Use baseURL from state, but allow override
    const effectiveUrl = url || baseURL;
    if (!effectiveUrl) return; // Don't fetch if no URL
    try {
      const res = await fetch(`${effectiveUrl}/drives`);
      if (!res.ok) throw new Error("Failed to fetch drives");
      const data = await res.json();
      if (data && data.length > 0) {
        setDrives(data);
        setCurrentPath(data[0]);
        fetchFiles(data[0], effectiveUrl); // 👈 Pass URL
      }
    } catch (error) {
      console.error(error);
      alert("Could not load drives. Is the backend running?");
    }
  };

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
    } catch (error) {
      console.error(error);
      alert("Failed to fetch files.");
    }
  };

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
    } catch (error) {
      console.error(error);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  // --- Modal Handlers ---
  
  // Create a handler to open the preview
  const handlePreview = (fileItem) => {
    setPreviewFile({
      name: fileItem.name,
      path: currentPath, // FileCard only knows its name, App knows the currentPath
    });
  };

  // Create a handler to close the preview
  const handleClosePreview = () => {
    setPreviewFile(null);
  };
  
  // --- End Modal Handlers ---

  return (
    <div className="min-w-[100%] min-h-screen bg-slate-50 p-4 sm:p-6">
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

        <form
          onSubmit={handleUpload}
          className="flex flex-wrap items-center gap-4 mt-5 bg-white p-4 rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200 border border-slate-200"
        >
          <input
            type="file"
            name="file"
            required
            className="flex-1 w-full sm:w-auto text-sm text-slate-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-lg file:border-0 file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100 transition-colors duration-200 cursor-pointer"
          />
          <button
            type="submit"
            disabled={uploading || !baseURL} // 👈 Disable if no backend
            className="w-full sm:w-auto bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 font-semibold shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-75 disabled:cursor-not-allowed"
          >
            {uploading ? "Uploading..." : "Upload File"}
          </button>
        </form>

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
      
      {/* Render the modal (it will only show when previewFile is not null) */}
      <PreviewModal
        file={previewFile}
        baseURL={baseURL}
        onClose={handleClosePreview}
      />
    </div>
  );
}