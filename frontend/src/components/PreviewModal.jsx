import { FiX } from "react-icons/fi";

// A list of extensions that should be treated as images
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];

export default function PreviewModal({ file, baseURL, onClose }) {
  if (!file) return null;

  // Construct the full path and URL for the /view endpoint
  const fullPath = file.path + "\\" + file.name;
  const previewUrl = `${baseURL}/view?path=${encodeURIComponent(fullPath)}`;

  // Determine if this file is an image
  const extension = file.name.split('.').pop().toLowerCase();
  const isImage = IMAGE_EXTENSIONS.includes(extension);

  return (
    // Backdrop
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in-fast"
    >
      {/* Modal Content */}
      <div
        onClick={(e) => e.stopPropagation()} // Prevent modal close on content click
        className="bg-white rounded-xl shadow-2xl w-11/12 h-5/6 max-w-6xl flex flex-col"
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-semibold text-slate-800 truncate" title={file.name}>
            {file.name}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Content (Conditional) */}
        <div className="flex-1 p-4 bg-slate-100/50 overflow-hidden">
          {/* 👇 --- THIS IS THE KEY CHANGE --- 👇 */}

          {isImage ? (
            // If it's an image, use an <img> tag
            <img
              src={previewUrl}
              alt={file.name}
              className="w-full h-full object-contain" // 👈 'object-contain' scales the image down
            />
          ) : (
            // Otherwise, use an <iframe> for PDFs, text, etc.
            <iframe
              src={previewUrl}
              title={file.name}
              className="w-full h-full border-0 rounded-lg bg-white"
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          )}

          {/* 👆 --- END OF KEY CHANGE --- 👆 */}
        </div>
      </div>

      {/* Add fade-in animation to your global CSS or here */}
      <style>{`
        @keyframes fade-in-fast {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in-fast {
          animation: fade-in-fast 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
}