import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { FiLink, FiChevronLeft, FiCopy } from "react-icons/fi";

export default function Toolbar({ drives, currentPath, goBack, changeDrive }) {
  const [showConnectQr, setShowConnectQr] = useState(false);
  const [localIp, setLocalIp] = useState("localhost");
  const [backendIp, setBackendIp] = useState("");
  const [isDesktop, setIsDesktop] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Detect device type
    const ua = navigator.userAgent.toLowerCase();
    const desktop = !/iphone|ipad|ipod|android|mobile/.test(ua);
    setIsDesktop(desktop);

    // Fetch LAN IP from backend
    fetch("http://localhost:8000/ip")
      .then((res) => res.json())
      .then((data) => {
        if (data.ip) {
          setLocalIp(data.ip);
          setBackendIp(data.ip);
        }
      })
      .catch(() => setLocalIp("localhost"));
  }, []);

  const encodedUrl = `http://${localIp}:8001/save?ip=${btoa(backendIp)}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(encodedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("Failed to copy link!");
    }
  };

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl shadow-md border border-slate-200">
        {/* Back Button */}
        <button
          onClick={goBack}
          className={`flex items-center gap-1 px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 font-medium 
                      hover:bg-slate-50 transition-colors duration-200 
                      focus:outline-none focus:ring-2 focus:ring-blue-500
                      ${
                        currentPath.length <= 3
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
          disabled={currentPath.length <= 3}
        >
          <FiChevronLeft className="w-5 h-5 -ml-1" />
          Back
        </button>

        {/* Drive Selector */}
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-700">Drive:</span>
          <select
            onChange={(e) => changeDrive(e.target.value)}
            value={currentPath.substring(0, 3)}
            className="border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-700 font-medium 
                      focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            {drives.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* Connect Backend Button */}
        {isDesktop && (
          <button
            onClick={() => setShowConnectQr(true)}
            disabled={!backendIp}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium 
                        hover:bg-blue-700 transition-colors duration-200 
                        focus:outline-none focus:ring-2 focus:ring-blue-500
                        disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiLink className="w-4 h-4" />
            Connect IP
          </button>
        )}
      </div>

      {/* Backend Connect QR Modal */}
      {showConnectQr && isDesktop && (
        <div
          onClick={() => setShowConnectQr(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white p-8 rounded-xl shadow-2xl flex flex-col items-center text-center"
          >
            <h3 className="text-xl font-semibold mb-4 text-slate-800">
              Connect to Backend Server
            </h3>

            <div className="bg-white p-4 border rounded-lg flex justify-center">
              <QRCodeSVG value={encodedUrl} size={256} />
            </div>

           
            <button
              onClick={copyToClipboard}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-white font-medium 
                        hover:bg-slate-800 transition-colors duration-200"
            >
              <FiCopy className="w-4 h-4" />
              {copied ? "Copied!" : "Copy Link"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
