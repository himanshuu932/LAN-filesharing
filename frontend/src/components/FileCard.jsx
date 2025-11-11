import { useState } from "react";
import { FiFolder, FiFile, FiDownload, FiEye } from "react-icons/fi";

// A list of extensions browsers can usually open
const VIEWABLE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'txt', 'pdf', 'md'];

// 👇 Accept onPreview as a prop
export default function FileCard({ item, currentPath, onOpen, baseURL, onPreview }) {
  const [showOverlay, setShowOverlay] = useState(false);

  const icon = item.is_dir ? (
    <FiFolder className="w-10 h-10 text-blue-500" />
  ) : (
    <FiFile className="w-10 h-10 text-slate-400" />
  );

  // 👇 Check if the file is viewable
  const extension = item.is_dir ? '' : item.name.split('.').pop().toLowerCase();
  const isViewable = VIEWABLE_EXTENSIONS.includes(extension);

  const handleCardClick = () => {
    if (item.is_dir) {
      let newPath = currentPath.endsWith("\\")
        ? currentPath + item.name
        : currentPath + "\\" + item.name;
      onOpen(newPath);
    } else {
      setShowOverlay((prev) => !prev);
    }
  };

  const handleDownloadClick = (e) => {
    e.stopPropagation();
    if (!baseURL) {
      console.error("Cannot download: baseURL is not set.");
      alert("Cannot download file: Not connected to backend.");
      return;
    }
    window.open(
      `${baseURL}/download?path=` +
        encodeURIComponent(currentPath + "\\" + item.name)
    );
    setShowOverlay(false);
  };

  // 👇 This function is now much simpler!
  const handlePreviewClick = (e) => {
    e.stopPropagation(); // Prevent card click
    
    // Call the function passed from App.jsx
    onPreview(item); 
    
    setShowOverlay(false); // Hide overlay
  };

  return (
    <div
      onClick={handleCardClick}
      onMouseEnter={() => !item.is_dir && setShowOverlay(true)}
      onMouseLeave={() => !item.is_dir && setShowOverlay(false)}
      className="relative bg-white p-4 rounded-xl shadow-md border border-slate-200 
                 hover:shadow-lg hover:border-blue-500 hover:-translate-y-1 cursor-pointer 
                 transition-all duration-200 ease-in-out group"
      title={item.name}
    >
      {/* Icon container */}
      <div className="flex justify-center items-center mb-3 h-14">{icon}</div>

      {/* File name */}
      <div className="text-sm font-medium text-slate-700 truncate">
        {item.name}
      </div>

      {/* Overlay for files */}
      {!item.is_dir && showOverlay && (
        <div
          className="absolute inset-0 bg-blue-600/90 rounded-xl flex flex-col items-center justify-center gap-2
                     text-white opacity-100 transition-opacity duration-200 animate-fade-in"
        >
          <button
            onClick={handleDownloadClick}
            className="flex items-center gap-2 px-4 py-2 bg-white text-blue-700 rounded-lg font-semibold
                       hover:bg-blue-100 transition-colors shadow-md"
          >
            <FiDownload className="w-5 h-5" /> Download
          </button>
          
          {/* 👇 Only show the Preview button if the file is viewable */}
          {isViewable && (
            <button
              onClick={handlePreviewClick} // Call the simplified handler
              className="flex items-center gap-2 px-4 py-2 bg-white text-blue-700 rounded-lg font-semibold
                         hover:bg-blue-100 transition-colors shadow-md"
            >
              <FiEye className="w-5 h-5" /> Preview
            </button>
          )}
        </div>
      )}

      {/* Add a simple fade-in keyframe animation (you can put this in your CSS file or a style block) */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
}