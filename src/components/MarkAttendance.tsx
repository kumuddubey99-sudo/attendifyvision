import React, { useState, useRef, useEffect } from 'react';
import { Camera, CheckCircle2, AlertTriangle, Users, ArrowRight, ShieldCheck, RefreshCw, Upload, Clock, Calendar } from 'lucide-react';
import { UserSession } from '../lib/auth';
import { SubjectWithStats, getTeacherSubjects, getEnrolledStudentsForSubject, matchClassroomFaces, confirmAttendanceSession, StudentWithEmbeddingStatus } from '../lib/attendanceService';
import { detectAllFacesInClassroom } from '../lib/faceNet';

interface Props {
  user: UserSession;
  initialSubjectId?: number;
  onNavigateToAttendanceView: () => void;
}

export const MarkAttendance: React.FC<Props> = ({ user, initialSubjectId, onNavigateToAttendanceView }) => {
  const [subjects, setSubjects] = useState<SubjectWithStats[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | ''>(initialSubjectId || '');
  const [enrolledStudents, setEnrolledStudents] = useState<StudentWithEmbeddingStatus[]>([]);
  
  // Camera & Image State
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [useUpload, setUseUpload] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [availableCamerasCount, setAvailableCamerasCount] = useState<number>(0);
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);

  // Recognition Results
  interface RecognizedViewItem {
    studentId: number;
    name: string;
    rollNumber: string;
    confidence: number;
  }
  const [recognizedList, setRecognizedList] = useState<RecognizedViewItem[]>([]);
  const [absentList, setAbsentList] = useState<StudentWithEmbeddingStatus[]>([]);
  const [unknownFacesCount, setUnknownFacesCount] = useState(0);
  const [unauthorizedStudents, setUnauthorizedStudents] = useState<{ name: string; stream: string }[]>([]);
  const [totalDetected, setTotalDetected] = useState(0);

  // Confirmation step
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Date & Time
  const todayDate = new Date().toISOString().split('T')[0];
  const currentTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadSubjects();
    checkCameraDevices();
    return () => {
      stopCamera();
    };
  }, [user.id]);

  const checkCameraDevices = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setAvailableCamerasCount(videoInputs.length);
      }
    } catch {
      // Ignore enumeration errors
    }
  };

  useEffect(() => {
    if (selectedSubjectId) {
      loadEnrolled(Number(selectedSubjectId));
    } else {
      setEnrolledStudents([]);
    }
  }, [selectedSubjectId]);

  const loadSubjects = async () => {
    const list = await getTeacherSubjects(user.id);
    setSubjects(list);
    if (!selectedSubjectId && list.length > 0) {
      setSelectedSubjectId(list[0].id);
    }
  };

  const loadEnrolled = async (subId: number) => {
    const list = await getEnrolledStudentsForSubject(subId);
    setEnrolledStudents(list);
  };

  const startCamera = async (targetFacing: 'user' | 'environment' = facingMode) => {
    setErrorMessage(null);
    setIsSwitchingCamera(true);
    stopCamera();

    try {
      // Try with requested facingMode constraint
      let mediaStream: MediaStream | null = null;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: targetFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (firstErr) {
        // Fallback for laptops or single-camera devices that don't match ideal facingMode
        console.warn('Initial camera constraints failed, trying generic video constraint', firstErr);
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
      checkCameraDevices();
    } catch (err: unknown) {
      console.error('Webcam error:', err);
      const isDenied = (err as Error)?.name === 'NotAllowedError' || (err as Error)?.message?.includes('Permission');
      if (isDenied) {
        setErrorMessage('Camera access was denied by your browser. Please click the camera icon in your browser address bar to allow camera access, or switch to "Upload Photo" mode.');
      } else {
        setErrorMessage('Unable to access camera on this device. You can switch to "Upload Photo" mode.');
      }
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

  const captureWebcamPhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setCapturedImage(dataUrl);
    stopCamera();
    processClassroomImage(dataUrl);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setCapturedImage(dataUrl);
      processClassroomImage(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const processClassroomImage = async (imageSrc: string) => {
    if (!selectedSubjectId) {
      setErrorMessage('Please select a subject first.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setConfirmationMessage(null);
    setIsConfirmed(false);

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageSrc;
      });

      // 1. Detect all faces in classroom image using pretrained deep neural network
      const detectedFaces = await detectAllFacesInClassroom(img);
      setTotalDetected(detectedFaces.length);

      if (detectedFaces.length === 0) {
        setErrorMessage('No faces detected in the classroom photo. Ensure good lighting and students face the camera.');
        setRecognizedList([]);
        setAbsentList(enrolledStudents);
        setUnknownFacesCount(0);
        setIsProcessing(false);
        return;
      }

      // 2. Compare embeddings with registered student embeddings in database
      const matchResult = await matchClassroomFaces(detectedFaces, Number(selectedSubjectId));

      // Build recognized list
      const recItems: RecognizedViewItem[] = matchResult.recognizedStudents.map((m) => ({
        studentId: m.student.id,
        name: m.student.name,
        rollNumber: m.student.roll_number,
        confidence: m.confidence,
      }));
      setRecognizedList(recItems);

      // Determine absent students from enrolled list
      const recIds = new Set(recItems.map((r) => r.studentId));
      const absent = enrolledStudents.filter((stu) => !recIds.has(stu.id));
      setAbsentList(absent);

      setUnknownFacesCount(matchResult.unknownFacesCount);
      setUnauthorizedStudents(
        matchResult.unauthorizedMatches.map((m) => ({
          name: m.student.name,
          stream: m.student.stream,
        }))
      );
    } catch (err: unknown) {
      console.error('Classroom face recognition failed', err);
      setErrorMessage((err as Error)?.message || 'Face recognition processing error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmAttendance = async () => {
    if (!selectedSubjectId) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    const payload = recognizedList.map((r) => ({
      studentId: r.studentId,
      confidence: r.confidence,
    }));

    const result = await confirmAttendanceSession(
      user.id,
      Number(selectedSubjectId),
      payload,
      todayDate,
      currentTimeStr
    );

    setIsSubmitting(false);

    if (result.success) {
      setIsConfirmed(true);
      setConfirmationMessage(result.message);
    } else {
      setErrorMessage(result.message);
    }
  };

  const currentSubject = subjects.find((s) => s.id === Number(selectedSubjectId));

  return (
    <div className="space-y-6">
      {/* Header & Academic Info */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
              Attendance Session
            </span>
            <h2 className="text-xl font-bold text-slate-900 mt-1">Classroom Face Recognition Attendance</h2>
            <p className="text-xs text-slate-500">
              Select stream & subject, capture the classroom photo, review detected students and confirm attendance.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium text-slate-600 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-blue-600" />
              <span>{todayDate}</span>
            </div>
            <div className="h-4 w-px bg-slate-300" />
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-blue-600" />
              <span>{currentTimeStr}</span>
            </div>
          </div>
        </div>

        {/* Step 1: Subject Selection */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-5 pt-4 border-t border-slate-100">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Select Subject *</label>
            <select
              value={selectedSubjectId}
              onChange={(e) => {
                setSelectedSubjectId(Number(e.target.value));
                setCapturedImage(null);
                setRecognizedList([]);
                setIsConfirmed(false);
                setConfirmationMessage(null);
              }}
              className="w-full text-xs rounded-lg border border-slate-300 bg-white p-2 text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.subject_name} ({s.subject_code}) - {s.stream} {s.year} Div {s.division}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Stream / Course</label>
            <input
              type="text"
              readOnly
              value={currentSubject?.stream || 'N/A'}
              className="w-full text-xs rounded-lg border border-slate-200 bg-slate-100 p-2 text-slate-700"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Class / Division</label>
            <input
              type="text"
              readOnly
              value={currentSubject ? `${currentSubject.year} - Sem ${currentSubject.semester} (Div ${currentSubject.division})` : 'N/A'}
              className="w-full text-xs rounded-lg border border-slate-200 bg-slate-100 p-2 text-slate-700"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Enrolled Students</label>
            <input
              type="text"
              readOnly
              value={`${enrolledStudents.length} Students`}
              className="w-full text-xs rounded-lg border border-slate-200 bg-slate-100 p-2 text-slate-700 font-semibold"
            />
          </div>
        </div>
      </div>

      {/* Error & Success Alerts */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {confirmationMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start justify-between">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-sm block">Attendance Marked Successfully!</span>
              <p className="mt-0.5">{confirmationMessage}</p>
            </div>
          </div>
          <button
            onClick={onNavigateToAttendanceView}
            className="px-3 py-1.5 bg-emerald-700 text-white rounded text-xs font-semibold hover:bg-emerald-800 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span>View Attendance Log</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Step 2: Camera / Capture Box & Recognition Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Photo Capture */}
        <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Camera className="h-4 w-4 text-blue-600" />
              Classroom Photo Capture
            </h3>
            <div className="flex items-center gap-1 text-xs bg-slate-100 p-0.5 rounded-md">
              <button
                type="button"
                onClick={() => {
                  setUseUpload(false);
                  setCapturedImage(null);
                }}
                className={`px-2.5 py-1 rounded font-medium cursor-pointer ${
                  !useUpload ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Webcam
              </button>
              <button
                type="button"
                onClick={() => {
                  setUseUpload(true);
                  stopCamera();
                }}
                className={`px-2.5 py-1 rounded font-medium cursor-pointer ${
                  useUpload ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Upload Photo
              </button>
            </div>
          </div>

          {/* Viewport */}
          <div className="relative aspect-4/3 sm:aspect-16/10 w-full bg-slate-950 rounded-lg overflow-hidden flex items-center justify-center border border-slate-800">
            {capturedImage ? (
              <div className="relative w-full h-full">
                <img src={capturedImage} alt="Captured Classroom" className="w-full h-full object-contain" />
                {isProcessing && (
                  <div className="absolute inset-0 bg-slate-950/75 flex flex-col items-center justify-center text-white">
                    <RefreshCw className="h-8 w-8 text-blue-400 animate-spin mb-2" />
                    <span className="text-sm font-semibold">Detecting Faces & Computing Embeddings...</span>
                    <span className="text-xs text-slate-400 mt-1">Comparing against registered student dataset</span>
                  </div>
                )}
              </div>
            ) : !useUpload ? (
              cameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                  />
                  {/* Floating Camera Mode Tag & Switch Button on Mobile/Desktop */}
                  <div className="absolute top-3 right-3 flex items-center gap-2">
                    <span className="px-2 py-1 rounded-md text-[11px] font-semibold bg-black/60 text-white backdrop-blur-xs border border-white/20">
                      {facingMode === 'user' ? 'Front Camera' : 'Back Camera'}
                    </span>
                    <button
                      type="button"
                      onClick={switchCamera}
                      disabled={isSwitchingCamera}
                      title="Switch between front and back camera"
                      className="px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-600/90 hover:bg-blue-600 text-white backdrop-blur-xs shadow-md flex items-center gap-1.5 transition-colors cursor-pointer border border-blue-400/40"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isSwitchingCamera ? 'animate-spin' : ''}`} />
                      <span className="hidden sm:inline">Switch Camera</span>
                      <span className="sm:hidden">Switch</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center p-6 text-slate-400">
                  <Camera className="h-10 w-10 mx-auto mb-2 text-slate-600" />
                  <p className="text-xs font-medium text-slate-300">Camera preview is off</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Supports both Front (selfie) & Back (classroom) cameras</p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => startCamera('environment')}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs flex items-center gap-1.5"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      <span>Start Back Camera</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => startCamera('user')}
                      className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs flex items-center gap-1.5"
                    >
                      <span>Start Front Camera</span>
                    </button>
                  </div>
                </div>
              )
            ) : (
              <div className="text-center p-6">
                <Upload className="h-10 w-10 mx-auto mb-2 text-slate-500" />
                <p className="text-xs font-medium text-slate-300">Select Classroom Group Photo</p>
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
                  className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
                >
                  Choose Classroom Photo
                </button>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2">
            {!capturedImage ? (
              cameraActive && (
                <>
                  <button
                    type="button"
                    onClick={captureWebcamPhoto}
                    className="w-full sm:flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-md flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <Camera className="h-4 w-4" />
                    <span>Capture Attendance Photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={switchCamera}
                    disabled={isSwitchingCamera}
                    className="w-full sm:w-auto px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-300 cursor-pointer transition-colors"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isSwitchingCamera ? 'animate-spin' : ''}`} />
                    <span>Switch Camera ({facingMode === 'user' ? 'Front' : 'Back'})</span>
                  </button>
                </>
              )
            ) : (
              <div className="flex items-center gap-2 w-full">
                <button
                  type="button"
                  onClick={() => {
                    setCapturedImage(null);
                    setRecognizedList([]);
                    setIsConfirmed(false);
                    setConfirmationMessage(null);
                    if (!useUpload) startCamera(facingMode);
                  }}
                  className="flex-1 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  Retake / Choose Another Photo
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Real Face Recognition Results */}
        <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              Recognition Results
            </h3>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              {totalDetected} Faces Detected
            </span>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-100">
              <span className="text-emerald-700 font-bold text-base block">{recognizedList.length}</span>
              <span className="text-emerald-800 font-medium">Recognized</span>
            </div>
            <div className="p-2.5 bg-rose-50 rounded-lg border border-rose-100">
              <span className="text-rose-700 font-bold text-base block">{absentList.length}</span>
              <span className="text-rose-800 font-medium">Absent</span>
            </div>
            <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-100">
              <span className="text-amber-700 font-bold text-base block">{unknownFacesCount}</span>
              <span className="text-amber-800 font-medium">Unknown</span>
            </div>
          </div>

          {/* Unauthorized alert if students from another class appeared */}
          {unauthorizedStudents.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
              <span className="font-semibold block">⚠️ Student Not Enrolled in this Subject/Class:</span>
              <ul className="list-disc list-inside mt-1">
                {unauthorizedStudents.map((s, idx) => (
                  <li key={idx}>
                    {s.name} ({s.stream}) - Attendance discarded.
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recognized Students List */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Recognized Students (Present)
            </h4>
            {recognizedList.length > 0 ? (
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {recognizedList.map((stu) => (
                  <div
                    key={stu.studentId}
                    className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <div>
                        <span className="font-semibold text-slate-900">{stu.name}</span>
                        <span className="text-slate-500 ml-2">Roll: {stu.rollNumber}</span>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                      {stu.confidence}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded text-center">
                {capturedImage ? 'No registered students recognized in this photo.' : 'Capture photo to run face recognition.'}
              </p>
            )}
          </div>

          {/* Absent Students List */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Absent Students ({absentList.length})
            </h4>
            {absentList.length > 0 ? (
              <div className="space-y-1 max-h-36 overflow-y-auto text-xs">
                {absentList.map((stu) => (
                  <div key={stu.id} className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200 text-slate-600">
                    <span>
                      {stu.name} (Roll: {stu.roll_number})
                    </span>
                    <span className="text-rose-600 font-semibold text-[11px]">Absent</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic bg-slate-50 p-2 rounded text-center">
                {enrolledStudents.length === 0 ? 'No students enrolled in this subject' : 'All enrolled students recognized!'}
              </p>
            )}
          </div>

          {/* Confirm Button */}
          {recognizedList.length > 0 && !isConfirmed && (
            <div className="pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmAttendance}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-md flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                <span>{isSubmitting ? 'Recording Attendance...' : 'Confirm Attendance'}</span>
              </button>
              <p className="text-[11px] text-slate-400 text-center mt-1.5">
                Attendance will be recorded for {currentSubject?.subject_name} ({todayDate}).
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
