import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, Loader2, Check, AlertCircle } from 'lucide-react';
import { extractSupplementFromImage, createThumbnail, MoondreamExtractionResult } from '../lib/moondream';

interface PhotoCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExtractionComplete: (result: MoondreamExtractionResult, thumbnailFile: File) => void;
}

export function PhotoCaptureModal({ isOpen, onClose, onExtractionComplete }: PhotoCaptureModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [showCameraSelector, setShowCameraSelector] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<File | null>(null);

  // Cleanup function for preview images
  const cleanupPreviewImage = () => {
    if (previewImage) {
      URL.revokeObjectURL(previewImage);
      setPreviewImage(null);
    }
    setIsImageLoading(false);
  };

  // Cleanup on unmount or modal close
  useEffect(() => {
    return () => {
      cleanupPreviewImage();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Setup video event listeners
  const setupVideoEventListeners = (videoElement: HTMLVideoElement) => {
    // Wait for video to load and play
    videoElement.onloadedmetadata = () => {
      videoElement.play().catch(err => {
        // Silent fail
      });
    };
    
    // Force play after a short delay as fallback
    setTimeout(() => {
      if (videoElement && videoElement.paused) {
        videoElement.play().catch(err => {
          // Silent fail
        });
      }
      // Stop showing loading spinner after 2 seconds regardless
      setIsCameraLoading(false);
    }, 2000);
    
    // Additional event listeners for debugging
    videoElement.onplay = () => {
      setIsCameraLoading(false);
      setIsVideoPlaying(true);
    };
    
    videoElement.onerror = (err) => {
      setIsCameraLoading(false);
      setIsVideoPlaying(false);
    };
    
    // Try to play immediately as well
    videoElement.play().catch(err => {
      // Silent fail, will retry
    });
    
    // Additional fallback - try again after video is ready
    videoElement.oncanplay = () => {
      if (videoElement && videoElement.paused) {
        videoElement.play().catch(err => {
          // Silent fail
        });
      }
    };
  };



  // Get available cameras
  const getAvailableCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      setAvailableCameras(cameras);
      
      // Auto-select the first camera if none selected
      if (cameras.length > 0 && !selectedCameraId) {
        setSelectedCameraId(cameras[0].deviceId);
      }
      
      return cameras;
    } catch (err) {
      console.error('Error getting cameras:', err);
      return [];
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image file is too large. Please select an image under 10MB.');
      return;
    }

    // Validate file size (min 1KB)
    if (file.size < 1024) {
      setError('Image file is too small. Please select a valid image file.');
      return;
    }

    setError(null);
    setCapturedImage(file);
    
    try {
      // Create a new object URL for the preview
      const newPreviewUrl = URL.createObjectURL(file);
      
      // Clean up any existing preview
      if (previewImage) {
        URL.revokeObjectURL(previewImage);
      }
      
      setPreviewImage(newPreviewUrl);
    } catch (err) {
      setError('Failed to create image preview. Please try again.');
    }
  };

  const startCamera = async () => {
    try {
      setError(null);
      setIsCameraLoading(true);
      
      // Get available cameras if we haven't already
      if (availableCameras.length === 0) {
        await getAvailableCameras();
      }
      
      // If multiple cameras available and none selected, show selector
      if (availableCameras.length > 1 && !selectedCameraId) {
        setShowCameraSelector(true);
        setIsCameraLoading(false);
        return;
      }
      
      const videoConstraints: MediaTrackConstraints = {
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      };
      
      // Use selected camera if available, otherwise use default
      if (selectedCameraId) {
        videoConstraints.deviceId = { exact: selectedCameraId };
      } else {
        videoConstraints.facingMode = 'environment';
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: videoConstraints
      });
      
      // If video ref doesn't exist yet, wait for it to be available
      if (!videoRef.current) {
        // Wait for the next render cycle
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            streamRef.current = stream;
            setupVideoEventListeners(videoRef.current);
          }
        }, 100);
        return;
      }
      
      videoRef.current.srcObject = stream;
      streamRef.current = stream;
      setupVideoEventListeners(videoRef.current);
    } catch (err) {
      setIsCameraLoading(false);
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Camera access denied. Please allow camera permissions and try again.');
        } else if (err.name === 'NotFoundError') {
          setError('No camera found on this device.');
        } else {
          setError(`Camera error: ${err.message}`);
        }
      } else {
        setError('Failed to access camera. Please check permissions.');
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsVideoPlaying(false);
    setIsCameraLoading(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) {
      console.error('Video ref not available for photo capture');
      setError('Camera not available. Please try again.');
      return;
    }

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) {
      console.error('Failed to get 2D context for photo capture');
      setError('Failed to initialize camera capture. Please try again.');
      return;
    }

    // Validate video dimensions
    const videoWidth = videoRef.current.videoWidth;
    const videoHeight = videoRef.current.videoHeight;
    
    if (videoWidth === 0 || videoHeight === 0) {
      setError('Camera not ready. Please wait a moment and try again.');
      return;
    }

    canvas.width = videoWidth;
    canvas.height = videoHeight;
    
    try {
      // Draw the image without flipping - the video preview is mirrored for UX but we want the actual image
      context.drawImage(videoRef.current, 0, 0);
    } catch (err) {
      setError('Failed to capture photo. Please try again.');
      return;
    }
    
    canvas.toBlob((blob) => {
      if (blob) {
        if (blob.size === 0) {
          setError('Failed to capture photo. Please try again.');
          return;
        }
        
        try {
          const file = new File([blob], 'supplement-label.jpg', { type: 'image/jpeg' });
          
          setCapturedImage(file);
          
          // Create a new preview URL and clean up the old one
          const newPreviewUrl = URL.createObjectURL(file);
          if (previewImage) {
            URL.revokeObjectURL(previewImage);
          }
          setPreviewImage(newPreviewUrl);
          
          stopCamera();
        } catch (err) {
          setError('Failed to process captured photo. Please try again.');
        }
      } else {
        setError('Failed to capture photo. Please try again.');
      }
    }, 'image/jpeg', 0.9);
  };

  const processImage = async () => {
    if (!capturedImage) {
      setError('No image selected. Please capture or upload an image first.');
      return;
    }

    // Validate the captured image
    if (capturedImage.size === 0) {
      setError('Invalid image file. Please try capturing or uploading again.');
      return;
    }

    if (!capturedImage.type.startsWith('image/')) {
      setError('Invalid file type. Please select an image file.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {

      // Extract supplement data using Moondream API
      const extractionResult = await extractSupplementFromImage(capturedImage);
      
      // Create thumbnail for storage
      let thumbnailFile: File;
      
      try {
        thumbnailFile = await createThumbnail(capturedImage);
      } catch (thumbnailError) {
        // Fallback: use the original captured image if thumbnail creation fails
        thumbnailFile = capturedImage;
      }
      
      // Verify thumbnail file is valid
      if (!thumbnailFile || thumbnailFile.size === 0) {
        throw new Error('Failed to create valid thumbnail file');
      }
      
      // Pass results to parent component
      onExtractionComplete(extractionResult, thumbnailFile);
      
      // Don't close the modal here - let the parent component handle it
      // The parent will close this modal and show the extraction preview
      
      // Clean up preview image but keep captured image for now
      cleanupPreviewImage();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    setError(null);
    cleanupPreviewImage();
    setCapturedImage(null);
    setShowCameraSelector(false);
    onClose();
  };

  const resetImage = () => {
    cleanupPreviewImage();
    setCapturedImage(null);
    setError(null);
    setIsImageLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">Capture Supplement Label</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDebug(!showDebug)}
                className="p-1 hover:bg-gray-100 rounded-lg text-xs text-gray-500"
                title="Toggle debug info"
              >
                🐛
              </button>
              <button
                onClick={handleClose}
                className="p-1 hover:bg-gray-100 rounded-lg"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Debug Panel */}
          {showDebug && (
            <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs">
              <h3 className="font-semibold mb-2">Debug Info:</h3>
              <div className="space-y-1">
                <div>Preview Image: {previewImage ? '✓' : '✗'}</div>
                <div>Captured Image: {capturedImage ? `✓ (${capturedImage.name}, ${(capturedImage.size / 1024).toFixed(1)}KB)` : '✗'}</div>
                <div>Image Loading: {isImageLoading ? '✓' : '✗'}</div>
                <div>Camera Loading: {isCameraLoading ? '✓' : '✗'}</div>
                <div>Video Playing: {isVideoPlaying ? '✓' : '✗'}</div>
                <div>Stream Active: {streamRef.current ? '✓' : '✗'}</div>
                <div>Error: {error || 'None'}</div>
                {capturedImage && (
                  <div className="mt-2 p-2 bg-white rounded border">
                    <div className="font-semibold">File Details:</div>
                    <div>Name: {capturedImage.name}</div>
                    <div>Size: {(capturedImage.size / 1024).toFixed(1)}KB</div>
                    <div>Type: {capturedImage.type}</div>
                    <div>Last Modified: {new Date(capturedImage.lastModified).toLocaleString()}</div>
                  </div>
                )}
                {previewImage && (
                  <div className="mt-2 p-2 bg-white rounded border">
                    <div className="font-semibold">Preview URL:</div>
                    <div className="break-all text-xs">{previewImage.substring(0, 50)}...</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle size={16} className="text-red-500" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          {!previewImage ? (
            <div className="space-y-4">
              <p className="text-gray-600 text-sm">
                Take a clear photo of the supplement label to automatically extract information.
              </p>
              
              {/* Camera Selector */}
              {showCameraSelector && availableCameras.length > 1 && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Select Camera
                  </label>
                  <select
                    value={selectedCameraId}
                    onChange={(e) => setSelectedCameraId(e.target.value)}
                    className="w-full p-2 border rounded-lg"
                  >
                    {availableCameras.map((camera) => (
                      <option key={camera.deviceId} value={camera.deviceId}>
                        {camera.label || `Camera ${camera.deviceId.slice(0, 8)}...`}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowCameraSelector(false);
                        startCamera();
                      }}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Use Selected Camera
                    </button>
                    <button
                      onClick={() => setShowCameraSelector(false)}
                      className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              
              {/* Camera Capture */}
              <div className="space-y-2">
                {!streamRef.current && !isCameraLoading && !showCameraSelector ? (
                  <button
                    onClick={async () => {
                      const cameras = await getAvailableCameras();
                      if (cameras.length > 1) {
                        setShowCameraSelector(true);
                      } else {
                        startCamera();
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Camera size={20} />
                    Use Camera {availableCameras.length > 1 ? `(${availableCameras.length} available)` : ''}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        controls={false}
                        className="w-full h-64 object-cover rounded-lg border-2 border-blue-500"
                        onClick={() => {
                          if (videoRef.current && videoRef.current.paused) {
                            videoRef.current.play().catch(err => {
                              // Silent fail
                            });
                          }
                        }}
                      />
                      {isCameraLoading && (
                        <div className="absolute inset-0 bg-gray-100 rounded-lg border-2 border-blue-500 flex items-center justify-center">
                          <div className="text-center">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
                            <p className="text-gray-600 text-sm">Starting camera...</p>
                          </div>
                        </div>
                      )}
                      {!isVideoPlaying && !isCameraLoading && (
                        <div className="absolute inset-0 bg-gray-100 rounded-lg border-2 border-blue-500 flex items-center justify-center">
                          <div className="text-center">
                            <Camera className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                            <p className="text-gray-600 text-sm">Camera ready - tap to capture</p>
                          </div>
                        </div>
                      )}
                      {!isCameraLoading && (
                        <div className="absolute top-2 left-2 bg-blue-500 text-white px-2 py-1 rounded text-xs">
                          Camera Active
                        </div>
                      )}
                      {!isCameraLoading && (
                        <button
                          onClick={capturePhoto}
                          disabled={isCameraLoading}
                          className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-white text-gray-800 rounded-lg shadow-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          📸 Capture Photo
                        </button>
                      )}
                    </div>
                    {!isCameraLoading && (
                      <button
                        onClick={() => {
                          stopCamera();
                          setError(null);
                        }}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
                      >
                        Stop Camera
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* File Upload */}
              {!isCameraLoading && (
                <div className="space-y-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Upload size={20} />
                    Choose from Gallery
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                {previewImage ? (
                  <div className="w-full h-64 border rounded-lg overflow-hidden">
                    {isImageLoading && (
                      <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                        <div className="text-center">
                          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
                          <p className="text-gray-600 text-sm">Loading image...</p>
                        </div>
                      </div>
                    )}
                    <img
                      src={previewImage}
                      alt="Supplement label preview"
                      className="w-full h-full object-contain"
                      onLoadStart={() => {
                        setIsImageLoading(true);
                        setError(null);
                      }}
                      onLoad={() => {
                        setIsImageLoading(false);
                        setError(null);
                      }}
                      onError={(e) => {
                        setIsImageLoading(false);
                        setError('Failed to load image preview. The file may be corrupted.');
                        // Try to fallback to showing just the file info
                        setPreviewImage(null);
                      }}
                      onAbort={() => {
                        setIsImageLoading(false);
                      }}
                    />
                  </div>
                ) : capturedImage ? (
                  <div className="w-full h-64 border rounded-lg bg-gray-100 flex items-center justify-center">
                    <div className="text-center">
                      <Check className="w-12 h-12 text-green-500 mx-auto mb-2" />
                      <p className="text-gray-600 text-sm">Image captured successfully</p>
                      <p className="text-gray-500 text-xs">{capturedImage.name}</p>
                    </div>
                  </div>
                ) : null}
                <button
                  onClick={resetImage}
                  className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-lg hover:bg-gray-50"
                  title="Remove image"
                >
                  <X size={16} />
                </button>
              </div>
              
              <p className="text-gray-600 text-sm">
                Review the image above. Make sure the supplement label is clearly visible.
              </p>
              
              <button
                onClick={processImage}
                disabled={isProcessing || !capturedImage}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Check size={20} />
                    Extract Supplement Data
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 