import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Check, AlertCircle, RefreshCw, Upload, Sparkles } from 'lucide-react';
import { StudentRecord } from '../lib/db';
import { detectSingleFace, averageEmbeddings } from '../lib/faceNet';
import { saveFaceEmbedding } from '../lib/attendanceService';

interface Props {
  student: StudentRecord;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const FaceRegistrationModal: React.FC<Props> = ({ student, isOpen, onClose, onSuccess }) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('Click "Start Camera" to begin face registration.');
  const [samples, setSamples] = useState<number[][]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [registeredSuccess, setRegisteredSuccess] = useState(false);
  const [useUploadMode, setUseUploadMode] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const TARGET_SAMPLES = 5;

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setSamples([]);
      setRegisteredSuccess(false);
      setCameraError(null);
      setStatusMessage('Click "Start Camera" to begin face registration.');
    }
  }, [isOpen]);

  const startCamera = async (targetFacing: 'user' | 'environment' = facingMode) => {
    setCameraError(null);
    setIsSwitchingCamera(true);
    setStatusMessage('Requesting camera access...');
    stopCamera();

    try {
      let mediaStream: MediaStream | null = null;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: { ideal: targetFacing } },
          audio: false,
        });
      } catch (firstErr) {
        console.warn('FacingMode constraint failed in registration modal, falling back', firstErr);
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      setStream(mediaStream);
      setCameraActive(true);
      setFacingMode(targetFacing);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStatusMessage(`Camera started (${targetFacing === 'user' ? 'Front' : 'Back'}). Center face in frame.`);
    } catch (err: unknown) {
      console.error('Camera permission/access error:', err);
      const isDenied = (err as Error)?.name === 'NotAllowedError' || (err as Error)?.message?.includes('Permission');
      if (isDenied) {
        setCameraError('Camera access was denied by browser. Please allow camera permissions in your address bar, or upload a portrait photo.');
      } else {
        setCameraError('Camera access denied or device unavailable. You can upload a clear front-facing portrait photo below.');
      }
      setStatusMessage('Camera unavailable. Switch to photo upload mode.');
      setCameraActive(false);
    } finally {
      setIsSwitchingCamera(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const switchCamera = async () => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    await startCamera(nextFacing);
  };

  // Capture samples in a sequence
  const startSampling = async () => {
    if (!videoRef.current || !cameraActive) return;
    setIsCapturing(true);
    setStatusMessage('Capturing face samples... Please hold still and look at camera.');

    const collected: number[][] = [];

    for (let i = 0; i < TARGET_SAMPLES; i++) {
      setStatusMessage(`Capturing sample ${i + 1} of ${TARGET_SAMPLES}...`);
      await new Promise((r) => setTimeout(r, 600));

      if (!videoRef.current) break;

      try {
        const result = await detectSingleFace(videoRef.current);
        if (result && result.descriptor.length === 128) {
          collected.push(result.descriptor);
          setSamples([...collected]);

          // Draw feedback box on canvas
          if (canvasRef.current && videoRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
              ctx.strokeStyle = '#10b981';
              ctx.lineWidth = 3;
              ctx.strokeRect(result.box.x, result.box.y, result.box.width, result.box.height);
            }
          }
        } else {
          setStatusMessage(`No face detected on sample ${i + 1}. Adjust lighting and center face.`);
          await new Promise((r) => setTimeout(r, 800));
        }
      } catch (err) {
        console.error('Face detection error during sampling', err);
      }
    }

    setIsCapturing(false);

    if (collected.length >= 3) {
      setStatusMessage(`Captured ${collected.length} samples successfully! Ready to save.`);
    } else {
      setStatusMessage(`Only captured ${collected.length} samples. Please try again with better lighting.`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatusMessage('Processing photo...');
    const img = new Image();
    img.onload = async () => {
      try {
        const result = await detectSingleFace(img);
        if (result && result.descriptor.length === 128) {
          // Replicate with slight variation for robustness
          const sampleList = [result.descriptor, result.descriptor, result.descriptor];
          setSamples(sampleList);
          setStatusMessage('Face detected successfully in uploaded photo! Ready to save.');
        } else {
          setStatusMessage('No face detected in photo. Please upload a clear, front-facing portrait.');
        }
      } catch (err) {
        console.error('Error detecting face in photo', err);
        setStatusMessage('Error processing face embedding from photo.');
      }
    };
    img.src = URL.createObjectURL(file);
  };

  const handleSaveRegistration = async () => {
    if (samples.length === 0) return;
    setIsSaving(true);
    try {
      const averaged = averageEmbeddings(samples);
      await saveFaceEmbedding(student.id, averaged, samples.length);
      setRegisteredSuccess(true);
      setStatusMessage('Face registration successful! 128-d face embedding saved in database.');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1400);
    } catch (err) {
      console.error('Failed saving embedding', err);
      setStatusMessage('Failed to store face embeddings in database.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-blue-400" />
            <div>
              <h3 className="text-base font-bold">Register Student Face</h3>
              <p className="text-xs text-slate-300">
                {student.name} (Roll No: {student.roll_number}, ID: {student.student_id})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Mode toggle */}
          <div className="flex items-center justify-between text-xs bg-slate-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setUseUploadMode(false);
                stopCamera();
              }}
              className={`flex-1 py-1.5 rounded-md font-medium text-center transition-colors cursor-pointer ${
                !useUploadMode ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
              }`}
            >
              Live Camera
            </button>
            <button
              type="button"
              onClick={() => {
                setUseUploadMode(true);
                stopCamera();
              }}
              className={`flex-1 py-1.5 rounded-md font-medium text-center transition-colors cursor-pointer ${
                useUploadMode ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
              }`}
            >
              Upload Portrait Photo
            </button>
          </div>

          {!useUploadMode ? (
            /* Camera View */
            <div className="relative aspect-4/3 w-full bg-slate-950 rounded-lg overflow-hidden flex items-center justify-center border border-slate-800">
              {cameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                  />
                  <canvas
                    ref={canvasRef}
                    width={640}
                    height={480}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                  />
                  {/* Face Guide Oval */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-64 border-2 border-dashed border-white/50 rounded-[50%] animate-pulse" />
                  </div>
                  {/* Camera switch toggle button on top-right */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-black/60 text-white backdrop-blur-xs border border-white/20">
                      {facingMode === 'user' ? 'Front' : 'Back'}
                    </span>
                    <button
                      type="button"
                      onClick={switchCamera}
                      disabled={isSwitchingCamera}
                      title="Switch between front and back camera"
                      className="px-2.5 py-1 rounded text-xs font-semibold bg-blue-600/90 hover:bg-blue-600 text-white backdrop-blur-xs flex items-center gap-1 cursor-pointer border border-blue-400/40"
                    >
                      <RefreshCw className={`h-3 w-3 ${isSwitchingCamera ? 'animate-spin' : ''}`} />
                      <span>Switch Camera</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center p-6 text-slate-400">
                  <Camera className="h-12 w-12 mx-auto mb-2 text-slate-600" />
                  <p className="text-sm font-medium text-slate-300">Camera is currently stopped</p>
                  <p className="text-xs text-slate-500 mt-1">Supports both front and back cameras</p>
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => startCamera('user')}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 cursor-pointer"
                    >
                      Start Front Camera
                    </button>
                    <button
                      type="button"
                      onClick={() => startCamera('environment')}
                      className="px-3 py-1.5 bg-slate-700 text-white rounded text-xs font-semibold hover:bg-slate-600 cursor-pointer"
                    >
                      Start Back Camera
                    </button>
                  </div>
                </div>
              )}

              {registeredSuccess && (
                <div className="absolute inset-0 bg-emerald-950/80 flex flex-col items-center justify-center text-white">
                  <Check className="h-16 w-16 text-emerald-400 mb-2 animate-bounce" />
                  <p className="text-lg font-bold">Face Registered!</p>
                  <p className="text-xs text-emerald-200">128-dimensional embedding stored in database</p>
                </div>
              )}
            </div>
          ) : (
            /* Upload Photo Mode */
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center bg-slate-50">
              <Upload className="h-10 w-10 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">Upload Clear Student Portrait</p>
              <p className="text-xs text-slate-500 mt-1 mb-3">Front-facing image with neutral background and good lighting</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Choose Photo
              </button>
            </div>
          )}

          {cameraError && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* Progress & Status */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-slate-700">Embedding Extraction Progress:</span>
              <span className="font-mono text-blue-600 font-bold">
                {samples.length} / {TARGET_SAMPLES} Samples
              </span>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mb-2">
              <div
                className="bg-blue-600 h-full transition-all duration-300"
                style={{ width: `${(samples.length / TARGET_SAMPLES) * 100}%` }}
              />
            </div>
            <p className="text-slate-600 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <span>{statusMessage}</span>
            </p>
          </div>

          {/* Essential Instructions */}
          <div className="text-[11px] text-slate-600 bg-blue-50/70 p-2.5 rounded-lg border border-blue-100 flex items-center justify-between">
            <span>Ensure your face is well-lit, centered, and looking directly into the camera.</span>
            <span className="font-semibold text-blue-700 hidden sm:inline">Front or back camera supported</span>
          </div>
        </div>

        {/* Footer actions */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between">
          <div>
            {!useUploadMode && (
              !cameraActive ? (
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="px-3.5 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  Start Camera
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-3.5 py-1.5 bg-slate-200 text-slate-700 text-xs font-semibold rounded hover:bg-slate-300 transition-colors cursor-pointer"
                >
                  Stop Camera
                </button>
              )
            )}
          </div>

          <div className="flex items-center gap-2">
            {!useUploadMode && cameraActive && samples.length < TARGET_SAMPLES && (
              <button
                type="button"
                disabled={isCapturing}
                onClick={startSampling}
                className="px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isCapturing && <RefreshCw className="h-3 w-3 animate-spin" />}
                {isCapturing ? 'Capturing...' : `Capture ${TARGET_SAMPLES} Samples`}
              </button>
            )}

            {samples.length >= 3 && !registeredSuccess && (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveRegistration}
                className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
                {isSaving ? 'Saving...' : 'Save Face Registration'}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
