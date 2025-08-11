import React, { useState, useRef } from 'react';
import { X, Save, AlertTriangle, CheckCircle, Edit3 } from 'lucide-react';
import { MoondreamExtractionResult } from '../lib/moondream';

interface ExtractionPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  extractionResult: MoondreamExtractionResult;
  thumbnailFile?: File;
  thumbnailUrl?: string; // Add support for thumbnail URLs
  onSave: (editedData: MoondreamExtractionResult) => void;
}

export function ExtractionPreviewModal({
  isOpen,
  onClose,
  extractionResult,
  thumbnailFile,
  thumbnailUrl,
  onSave,
}: ExtractionPreviewModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<MoondreamExtractionResult>(extractionResult);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>('');
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [imageLoadError, setImageLoadError] = useState<string | null>(null);
  const imageLoadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Generate thumbnail preview
  React.useEffect(() => {
    // Priority: thumbnailFile over thumbnailUrl
    if (thumbnailFile && thumbnailFile.size > 0) {
      // Check if this is a placeholder file (very small size or placeholder name)
      if (thumbnailFile.size < 100 || thumbnailFile.name === 'placeholder.jpg') {
        setThumbnailPreview('');
        return;
      }

      // Reset error state and set loading
      setImageLoadError(null);
      setIsImageLoading(true);

      // Clear any existing timeout
      if (imageLoadTimeoutRef.current) {
        clearTimeout(imageLoadTimeoutRef.current);
      }

      // Set a timeout for file reading (5 seconds)
      const timeout = setTimeout(() => {
        setIsImageLoading(false);
        setImageLoadError('File reading timeout');
      }, 5000);
      imageLoadTimeoutRef.current = timeout;

      const reader = new FileReader();
      
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          setThumbnailPreview(result);
          setIsImageLoading(false);
          setImageLoadError(null);
        } else {
          setThumbnailPreview('');
          setIsImageLoading(false);
          setImageLoadError('Failed to read file');
        }
        
        // Clear the timeout since file reading completed
        if (imageLoadTimeoutRef.current) {
          clearTimeout(imageLoadTimeoutRef.current);
          imageLoadTimeoutRef.current = null;
        }
      };
      
      reader.onerror = (e) => {
        setThumbnailPreview('');
        setIsImageLoading(false);
        setImageLoadError('Failed to read file');
        
        // Clear the timeout since file reading failed
        if (imageLoadTimeoutRef.current) {
          clearTimeout(imageLoadTimeoutRef.current);
          imageLoadTimeoutRef.current = null;
        }
      };
      
      reader.onabort = () => {
        setThumbnailPreview('');
        setIsImageLoading(false);
        setImageLoadError('File reading aborted');
        
        // Clear the timeout since file reading was aborted
        if (imageLoadTimeoutRef.current) {
          clearTimeout(imageLoadTimeoutRef.current);
          imageLoadTimeoutRef.current = null;
        }
      };
      
      try {
        reader.readAsDataURL(thumbnailFile);
      } catch (err) {
        setThumbnailPreview('');
        setIsImageLoading(false);
        setImageLoadError('Failed to read file');
      }
    } else if (thumbnailUrl) {
      // Reset error state and set loading
      setImageLoadError(null);
      setIsImageLoading(true);
      
      // Clear any existing timeout
      if (imageLoadTimeoutRef.current) {
        clearTimeout(imageLoadTimeoutRef.current);
      }
      
      // Set a timeout for image loading (10 seconds)
      const timeout = setTimeout(() => {
        setIsImageLoading(false);
        setImageLoadError('Image loading timeout');
      }, 10000);
      imageLoadTimeoutRef.current = timeout;
      
      // For Supabase URLs, ensure we have the correct format
      let processedUrl = thumbnailUrl;
      if (thumbnailUrl.includes('supabase.co')) {
        // Add a single cache busting parameter to prevent browser caching issues
        const timestamp = Date.now();
        processedUrl = `${thumbnailUrl}${thumbnailUrl.includes('?') ? '&' : '?'}t=${timestamp}`;
      }
      
      setThumbnailPreview(processedUrl);
    } else {
      setThumbnailPreview('');
      setIsImageLoading(false);
      setImageLoadError(null);
      
      // Clear any existing timeout
      if (imageLoadTimeoutRef.current) {
        clearTimeout(imageLoadTimeoutRef.current);
        imageLoadTimeoutRef.current = null;
      }
    }
  }, [thumbnailFile, thumbnailUrl]);

  // Cleanup timeouts on unmount
  React.useEffect(() => {
    return () => {
      if (imageLoadTimeoutRef.current) {
        clearTimeout(imageLoadTimeoutRef.current);
      }
    };
  }, []);

  const handleFieldChange = (field: keyof MoondreamExtractionResult, value: string | string[]) => {
    setEditedData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    onSave(editedData);
    setIsEditing(false);
  };



  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.8) return <CheckCircle size={16} className="text-green-600" />;
    if (confidence >= 0.6) return <AlertTriangle size={16} className="text-yellow-600" />;
    return <AlertTriangle size={16} className="text-red-600" />;
  };

  const getConfidenceText = (confidence: number) => {
    if (confidence >= 0.8) return 'High Confidence';
    if (confidence >= 0.6) return 'Medium Confidence';
    return 'Low Confidence';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">Review Extracted Data</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-lg"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* Confidence Score */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              {getConfidenceIcon(extractionResult.confidence)}
              <span className={`font-medium ${getConfidenceColor(extractionResult.confidence)}`}>
                {getConfidenceText(extractionResult.confidence)}
              </span>
              <span className="text-gray-600">
                ({Math.round(extractionResult.confidence * 100)}%)
              </span>
            </div>
            {extractionResult.confidence < 0.6 && (
              <p className="text-sm text-gray-600 mt-1">
                The extraction confidence is low. Please review and edit the information below.
              </p>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Thumbnail Preview */}
            <div>
              <h3 className="font-semibold mb-2">Label Image</h3>
              {thumbnailPreview ? (
                <img
                  src={thumbnailPreview}
                  alt="Supplement label thumbnail"
                  className="w-full h-48 object-contain rounded-lg border"
                  onLoad={() => {
                    setIsImageLoading(false);
                    setImageLoadError(null);
                    
                    // Clear the timeout since image loaded successfully
                    if (imageLoadTimeoutRef.current) {
                      clearTimeout(imageLoadTimeoutRef.current);
                      imageLoadTimeoutRef.current = null;
                    }
                  }}
                  onError={(e) => {
                    setIsImageLoading(false);
                    setImageLoadError('Failed to load image');
                    
                    // Clear the timeout since image failed to load
                    if (imageLoadTimeoutRef.current) {
                      clearTimeout(imageLoadTimeoutRef.current);
                      imageLoadTimeoutRef.current = null;
                    }
                  }}
                />
              ) : (
                <div className="w-full h-48 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                  <div className="text-center">
                    {isImageLoading ? (
                      <>
                        <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mx-auto mb-2 animate-pulse">
                          <span className="text-white text-xl">⏳</span>
                        </div>
                        <p className="text-gray-500 text-sm">Loading image...</p>
                      </>
                    ) : imageLoadError ? (
                      <>
                        <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center mx-auto mb-2">
                          <span className="text-white text-xl">❌</span>
                        </div>
                        <p className="text-red-500 text-sm">{imageLoadError}</p>
                        {thumbnailUrl && (
                          <>
                            <p className="text-gray-400 text-xs mt-1">
                              URL: {thumbnailUrl.substring(0, 50)}...
                            </p>
                            <button
                              onClick={() => {
                                setImageLoadError(null);
                                setIsImageLoading(true);
                                // Force a re-render by updating the timestamp
                                const newTimestamp = Date.now();
                                const retryUrl = `${thumbnailUrl}${thumbnailUrl.includes('?') ? '&' : '?'}t=${newTimestamp}`;
                                setThumbnailPreview(retryUrl);
                              }}
                              className="mt-2 px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                            >
                              Retry
                            </button>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mx-auto mb-2">
                          <span className="text-white text-xl font-bold">?</span>
                        </div>
                        <p className="text-gray-500 text-sm">
                          {thumbnailFile || thumbnailUrl ? 'Supplement label thumbnail' : 'No image available'}
                        </p>
                        {thumbnailFile && thumbnailFile.size > 0 && (
                          <p className="text-gray-400 text-xs mt-1">
                            File: {thumbnailFile.name} ({(thumbnailFile.size / 1024).toFixed(1)}KB)
                          </p>
                        )}
                        {thumbnailUrl && !thumbnailFile && (
                          <p className="text-gray-400 text-xs mt-1">
                            URL: {thumbnailUrl.substring(0, 50)}...
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
              

            </div>

            {/* Extracted Data */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Supplement Information</h3>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="flex items-center gap-1 px-2 py-1 text-blue-600 hover:bg-blue-50 rounded text-sm"
                >
                  <Edit3 size={14} />
                  {isEditing ? 'Cancel' : 'Edit'}
                </button>
              </div>

              <div className="space-y-3">
                {/* Supplement Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Supplement Name *
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedData.supplementName}
                      onChange={(e) => handleFieldChange('supplementName', e.target.value)}
                      className="w-full p-2 border rounded-lg"
                      required
                    />
                  ) : (
                    <div className="p-2 bg-gray-50 rounded-lg">
                      {editedData.supplementName || 'Not detected'}
                    </div>
                  )}
                </div>

                {/* Brand */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Brand
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedData.brand || ''}
                      onChange={(e) => handleFieldChange('brand', e.target.value)}
                      className="w-full p-2 border rounded-lg"
                    />
                  ) : (
                    <div className="p-2 bg-gray-50 rounded-lg">
                      {editedData.brand || 'Not detected'}
                    </div>
                  )}
                </div>

                {/* Dosage */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dosage per Serving
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedData.dosage || ''}
                      onChange={(e) => handleFieldChange('dosage', e.target.value)}
                      className="w-full p-2 border rounded-lg"
                      placeholder="e.g., 1000mg, 1 capsule"
                    />
                  ) : (
                    <div className="p-2 bg-gray-50 rounded-lg">
                      {editedData.dosage || 'Not detected'}
                    </div>
                  )}
                </div>

                {/* Serving Size */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Serving Size
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedData.servingSize || ''}
                      onChange={(e) => handleFieldChange('servingSize', e.target.value)}
                      className="w-full p-2 border rounded-lg"
                      placeholder="e.g., 1 capsule, 1 tablet"
                    />
                  ) : (
                    <div className="p-2 bg-gray-50 rounded-lg">
                      {editedData.servingSize || 'Not detected'}
                    </div>
                  )}
                </div>

                {/* Servings Per Container */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Servings Per Container
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedData.servingsPerContainer || ''}
                      onChange={(e) => handleFieldChange('servingsPerContainer', e.target.value)}
                      className="w-full p-2 border rounded-lg"
                      placeholder="e.g., 60, 90"
                    />
                  ) : (
                    <div className="p-2 bg-gray-50 rounded-lg">
                      {editedData.servingsPerContainer || 'Not detected'}
                    </div>
                  )}
                </div>

                {/* Manufacturer */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Manufacturer
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedData.manufacturer || ''}
                      onChange={(e) => handleFieldChange('manufacturer', e.target.value)}
                      className="w-full p-2 border rounded-lg"
                    />
                  ) : (
                    <div className="p-2 bg-gray-50 rounded-lg">
                      {editedData.manufacturer || 'Not detected'}
                    </div>
                  )}
                </div>

                {/* Ingredients */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ingredients
                  </label>
                  {isEditing ? (
                    <textarea
                      value={editedData.ingredients?.join(', ') || ''}
                      onChange={(e) => handleFieldChange('ingredients', e.target.value.split(',').map(i => i.trim()))}
                      className="w-full p-2 border rounded-lg"
                      rows={3}
                      placeholder="Enter ingredients separated by commas"
                    />
                  ) : (
                    <div className="p-2 bg-gray-50 rounded-lg">
                      {editedData.ingredients && editedData.ingredients.length > 0 
                        ? editedData.ingredients.join(', ')
                        : 'Not detected'
                      }
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!editedData.supplementName.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Save size={16} />
              Save Supplement
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 