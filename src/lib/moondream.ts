import { getErrorMessage, logError } from './errorHandling';

export interface MoondreamExtractionResult {
  supplementName: string;
  brand?: string;
  dosage?: string;
  ingredients?: string[];
  servingSize?: string;
  servingsPerContainer?: string;
  manufacturer?: string;
  confidence: number;
  rawText: string;
}

export interface MoondreamApiResponse {
  text: string;
  confidence: number;
}

// You'll need to replace this with your actual Moondream API endpoint and key
const MOONDREAM_API_URL = import.meta.env.VITE_MOONDREAM_API_URL || 'https://api.moondream.ai/v1';
const MOONDREAM_API_KEY = import.meta.env.VITE_MOONDREAM_API_KEY;

export async function extractSupplementFromImage(imageFile: File): Promise<MoondreamExtractionResult> {
  try {
    if (!MOONDREAM_API_KEY) {
      throw new Error('Moondream API key not configured');
    }

    // Convert image to base64
    const base64Image = await fileToBase64(imageFile);
    
    // Prepare the prompt for supplement label extraction
    const prompt = `Extract supplement information from this label. Return a JSON object with the following fields:
    - supplementName: The name of the supplement
    - brand: The brand name (if available)
    - dosage: The dosage per serving (e.g., "1000mg", "1 capsule")
    - ingredients: Array of main ingredients
    - servingSize: How much to take per serving
    - servingsPerContainer: Total servings in container
    - manufacturer: Manufacturer name (if available)
    
    Only include fields that are clearly visible on the label. If a field is not present, omit it from the JSON.`;

    const response = await fetch(`${MOONDREAM_API_URL}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MOONDREAM_API_KEY}`,
      },
      body: JSON.stringify({
        image_url: `data:image/jpeg;base64,${base64Image}`,
        question: prompt
      }),
    });

    if (!response.ok) {
      throw new Error(`Moondream API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Moondream API returns the answer in the 'answer' field
    const answerText = data.answer || '';
    
    // Parse the extracted JSON from the response
    let extractedData: Partial<MoondreamExtractionResult>;
    try {
      extractedData = JSON.parse(answerText);
    } catch (parseError) {
      // If JSON parsing fails, try to extract information from raw text
      extractedData = parseSupplementText(answerText);
    }

    return {
      supplementName: extractedData.supplementName || 'Unknown Supplement',
      brand: extractedData.brand,
      dosage: extractedData.dosage,
      ingredients: extractedData.ingredients,
      servingSize: extractedData.servingSize,
      servingsPerContainer: extractedData.servingsPerContainer,
      manufacturer: extractedData.manufacturer,
      confidence: 0.8, // Default confidence since Moondream doesn't provide this
      rawText: answerText,
    };

  } catch (error) {
    logError(error, 'Moondream API extraction');
    throw new Error(`Failed to extract supplement data: ${getErrorMessage(error)}`);
  }
}

// Helper function to convert file to base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
}

// Fallback parser for when JSON parsing fails
function parseSupplementText(text: string): Partial<MoondreamExtractionResult> {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  let supplementName = '';
  let brand = '';
  let dosage = '';
  let ingredients: string[] = [];
  
  // Simple heuristics to extract information
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    
    // Look for supplement name (usually the first prominent line)
    if (!supplementName && line.length > 3 && line.length < 100) {
      supplementName = line;
    }
    
    // Look for dosage information
    if (!dosage && (lowerLine.includes('mg') || lowerLine.includes('mcg') || lowerLine.includes('iu'))) {
      dosage = line;
    }
    
    // Look for brand information
    if (!brand && (lowerLine.includes('brand') || lowerLine.includes('by') || lowerLine.includes('manufactured'))) {
      brand = line;
    }
    
    // Look for ingredients
    if (lowerLine.includes('ingredients') || lowerLine.includes('contains')) {
      const ingredientMatch = line.match(/ingredients?[:\s]+(.+)/i);
      if (ingredientMatch) {
        ingredients = ingredientMatch[1].split(',').map(i => i.trim());
      }
    }
  }
  
  return {
    supplementName: supplementName || 'Unknown Supplement',
    brand: brand || undefined,
    dosage: dosage || undefined,
    ingredients: ingredients.length > 0 ? ingredients : undefined,
  };
}

// Function to optimize image for storage (create thumbnail)
export async function createThumbnail(file: File, maxWidth: number = 200, maxHeight: number = 200): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;
      
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const thumbnailFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(thumbnailFile);
          } else {
            reject(new Error('Failed to create thumbnail'));
          }
        },
        'image/jpeg',
        0.7 // 70% quality
      );
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
} 