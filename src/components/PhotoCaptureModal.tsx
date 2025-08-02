import React, { useState, useRef } from 'react';
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<File | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    setError(null);
    setCapturedImage(file);
    setPreviewImage(URL.createObjectURL(file));
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (err) {
      setError('Failed to access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) return;

    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    
    context.drawImage(videoRef.current, 0, 0);
    
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'supplement-label.jpg', { type: 'image/jpeg' });
        setCapturedImage(file);
        setPreviewImage(URL.createObjectURL(file));
        stopCamera();
      }
    }, 'image/jpeg', 0.9);
  };

  const processImage = async () => {
    if (!capturedImage) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Extract supplement data using Moondream API
      const extractionResult = await extractSupplementFromImage(capturedImage);
      
      // Create thumbnail for storage
      const thumbnailFile = await createThumbnail(capturedImage);
      
      // Pass results to parent component
      onExtractionComplete(extractionResult, thumbnailFile);
      
      // Clean up
      if (previewImage) {
        URL.revokeObjectURL(previewImage);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    setError(null);
    setPreviewImage(null);
    setCapturedImage(null);
    if (previewImage) {
      URL.revokeObjectURL(previewImage);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">Capture Supplement Label</h2>
            <button
              onClick={handleClose}
              className="p-1 hover:bg-gray-100 rounded-lg"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

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
              
              {/* Camera Capture */}
              <div className="space-y-2">
                <button
                  onClick={startCamera}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Camera size={20} />
                  Use Camera
                </button>
                
                {streamRef.current && (
                  <div className="relative">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full h-64 object-cover rounded-lg"
                    />
                    <button
                      onClick={capturePhoto}
                      className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-white text-gray-800 rounded-lg shadow-lg hover:bg-gray-50"
                    >
                      Capture Photo
                    </button>
                  </div>
                )}
              </div>

              {/* File Upload */}
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
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <img
                  src={previewImage}
                  alt="Supplement label preview"
                  className="w-full h-64 object-contain rounded-lg border"
                />
                <button
                  onClick={() => {
                    setPreviewImage(null);
                    setCapturedImage(null);
                    if (previewImage) {
                      URL.revokeObjectURL(previewImage);
                    }
                  }}
                  className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-lg hover:bg-gray-50"
                >
                  <X size={16} />
                </button>
              </div>
              
              <p className="text-gray-600 text-sm">
                Review the image above. Make sure the supplement label is clearly visible.
              </p>
              
              <button
                onClick={processImage}
                disabled={isProcessing}
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