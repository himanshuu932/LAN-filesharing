import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { FiShare, FiLink, FiChevronLeft } from "react-icons/fi";

export default function Toolbar({ drives, currentPath, goBack, changeDrive }) {
  const [showShareQr, setShowShareQr] = useState(false);
  const [showConnectQr, setShowConnectQr] = useState(false);
  const [localIp, setLocalIp] = useState("localhost");
  const [backendIp, setBackendIp] = useState(""); // Starts empty
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    // Detect device type
    const ua = navigator.userAgent.toLowerCase();
    const desktop = !/iphone|ipad|ipod|android|mobile/.test(ua);
    setIsDesktop(desktop);

    // Try to fetch LAN IP from backend
    fetch("http://localhost:8000/ip")
      .then((res) => res.json())
      .then((data) => {
        if (data.ip) {
          setLocalIp(data.ip);
          setBackendIp(data.ip); // 👈 Set backend IP here
        }
      })
      .catch(() => setLocalIp("localhost"));
  }, []);

  const shareUrl = `http://${localIp}:8001`;
  // 👇 We no longer need backendUrl, but we'll leave it
  const backendUrl = backendIp ? `http://${backendIp}:8000` : "";

  return (
    <>
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

        {/* Desktop-only buttons */}
        {isDesktop && (
          <>
            <button
              onClick={() => setShowShareQr(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-600 text-white font-medium 
                        hover:bg-slate-700 transition-colors duration-200 
                        focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              <FiShare className="w-4 h-4" />
              Share
            </button>

            <button
              onClick={() => setShowConnectQr(true)}
              // 👇 CHANGED: Disable button if backend IP isn't ready
              disabled={!backendIp}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium 
                        hover:bg-blue-700 transition-colors duration-200 
                        focus:outline-none focus:ring-2 focus:ring-blue-500
                        disabled:opacity-50 disabled:cursor-not-allowed" // 👈 CHANGED
            >
              <FiLink className="w-4 h-4" />
              Connect IP
            </button>
          </>
        )}
      </div>

      {/* Share Frontend QR Modal */}
      {showShareQr && (
        <div
          onClick={() => setShowShareQr(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white p-8 rounded-xl shadow-2xl"
          >
            <h3 className="text-xl font-semibold text-center mb-4 text-slate-800">
              Scan to open on your device
            </h3>
            <div className="bg-white p-4 border rounded-lg">
              <QRCodeSVG value={shareUrl} size={256} />
            </div>
            <p className="text-center text-sm text-slate-600 mt-4 break-all">
              {shareUrl}
            </p>
          </div>
        </div>
      )}

      {/* Connect Backend QR Modal (Desktop Only) */}
      {showConnectQr && isDesktop && (
        <div
          onClick={() => setShowConnectQr(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white p-8 rounded-xl shadow-2xl"
          >
            <h3 className="text-xl font-semibold text-center mb-4 text-slate-800">
              Connect to Backend Server
            </h3>
            <div className="bg-white p-4 border rounded-lg">
              {/* 👇 CHANGED: Encode the backendIp with btoa() */}
              <QRCodeSVG
                value={`http://${localIp}:8001/save?ip=${btoa(backendIp)}`}
                size={256}
              />
            </div>
            <p className="text-center text-sm text-slate-600 mt-4 break-all">
              {/* 👇 CHANGED: Show the encoded URL so it matches the QR */}
              http://{localIp}:8001/save?ip={btoa(backendIp)}
            </p>
          </div>
        </div>
      )}
    </>
  );
}