# Moondream AI Integration Setup Guide

## Overview
The Supplement Tracker now includes AI-powered photo capture functionality using the Moondream API. Users can take photos of supplement labels and automatically extract supplement information.

## Environment Variables Required

Add these to your `.env` file:

```env
# Moondream API Configuration
VITE_MOONDREAM_API_URL=https://api.moondream.com/v1
VITE_MOONDREAM_API_KEY=your_moondream_api_key_here
```

## Features Implemented

### 1. Photo Capture Modal (`PhotoCaptureModal.tsx`)
- Camera access for taking photos
- File upload from gallery
- Image preview before processing
- Error handling for camera permissions

### 2. AI Extraction Service (`moondream.ts`)
- Integration with Moondream API
- Image-to-text extraction with structured JSON output
- Fallback text parsing for non-JSON responses
- Thumbnail creation for storage optimization

### 3. Extraction Preview Modal (`ExtractionPreviewModal.tsx`)
- Display extracted data with confidence scores
- Editable fields for user correction
- Thumbnail preview
- Save functionality

### 4. Database Integration
- New `thumbnailUrl` field in Supplement type
- `addSupplementWithThumbnail` function for storing supplements with images
- Supabase Storage integration for thumbnail uploads

## API Integration Details

### Moondream API Endpoint
The integration uses the Moondream API to extract supplement information from images. The API expects:

**Request:**
```json
{
  "image": "base64_encoded_image",
  "prompt": "Extract supplement information from this label...",
  "format": "json"
}
```

**Response:**
```json
{
  "text": "{\"supplementName\": \"Vitamin D3\", \"brand\": \"Nature Made\", ...}",
  "confidence": 0.85
}
```

### Extracted Fields
- `supplementName`: Name of the supplement
- `brand`: Brand name (if available)
- `dosage`: Dosage per serving (e.g., "1000mg", "1 capsule")
- `ingredients`: Array of main ingredients
- `servingSize`: How much to take per serving
- `servingsPerContainer`: Total servings in container
- `manufacturer`: Manufacturer name (if available)

## User Experience Flow

1. **Photo Capture**: User clicks "Photo Capture" button
2. **Image Selection**: User can use camera or select from gallery
3. **AI Processing**: Image is sent to Moondream API for extraction
4. **Preview & Edit**: User reviews extracted data with confidence score
5. **Save**: User confirms and saves supplement to their database

## Confidence Score Display

- **High Confidence (≥80%)**: Green checkmark, "High Confidence"
- **Medium Confidence (60-79%)**: Yellow warning, "Medium Confidence"  
- **Low Confidence (<60%)**: Red warning, "Low Confidence" with edit recommendation

## Error Handling

- Camera permission errors
- API connection failures
- Image processing errors
- Invalid extracted data
- Storage upload failures

## Storage Optimization

- Images are automatically resized to 200x200px thumbnails
- JPEG format with 70% quality for optimal file size
- Stored in Supabase Storage under `supplement-thumbnails/` directory

## Future Enhancements

- Batch processing for multiple supplements
- OCR accuracy improvements through user feedback
- Integration with supplement databases for validation
- Advanced ingredient parsing and interaction warnings 