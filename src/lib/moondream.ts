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

// Use Netlify function to proxy Moondream API calls
const MOONDREAM_PROXY_URL = '/.netlify/functions/moondream-proxy';

export async function extractSupplementFromImage(imageFile: File): Promise<MoondreamExtractionResult> {
  try {
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

    const requestBody = {
      image_url: `data:image/jpeg;base64,${base64Image}`,
      question: prompt
    };

    const response = await fetch(MOONDREAM_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      // Try to get more detailed error information
      let errorDetails = '';
      try {
        const errorData = await response.text();
        errorDetails = ` - ${errorData}`;
      } catch (e) {
        errorDetails = ` - ${response.statusText}`;
      }
      throw new Error(`Moondream API error: ${response.status}${errorDetails}`);
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

    // Ensure ingredients is always an array
    let ingredients: string[] = [];
    const rawIngredients = extractedData.ingredients;
    if (rawIngredients) {
      if (Array.isArray(rawIngredients)) {
        ingredients = rawIngredients;
      } else if (typeof rawIngredients === 'string') {
        // Split comma-separated ingredients into array
        ingredients = (rawIngredients as string).split(',').map((i: string) => i.trim()).filter((i: string) => i.length > 0);
      }
    }

    return {
      supplementName: extractedData.supplementName || 'Unknown Supplement',
      brand: extractedData.brand,
      dosage: extractedData.dosage,
      ingredients: ingredients.length > 0 ? ingredients : undefined,
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

    // Validate input file
    if (!file || file.size === 0) {
      reject(new Error('Invalid file provided'));
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Failed to get 2D context from canvas'));
      return;
    }
    
    const img = new Image();
    let objectUrl: string | null = null;
    
    // Add timeout to prevent hanging
    const timeoutId = setTimeout(() => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(new Error('Image loading timeout'));
    }, 10000); // 10 second timeout

    // Set up image event handlers
    img.onload = () => {
      clearTimeout(timeoutId);
      
      // Ensure we have valid dimensions
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        reject(new Error('Image has zero dimensions'));
        return;
      }
      
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
      
      // Ensure minimum dimensions
      if (width < 1 || height < 1) {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        reject(new Error('Calculated dimensions are too small'));
        return;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress
      try {
        ctx.drawImage(img, 0, 0, width, height);
      } catch (drawError) {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to draw image to canvas'));
        return;
      }
      
      canvas.toBlob(
        (blob) => {
          // Clean up object URL
          if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
            objectUrl = null;
          }
          
          if (blob) {
            // Validate blob size
            if (blob.size === 0) {
              reject(new Error('Thumbnail blob has 0 bytes'));
              return;
            }
            
            const thumbnailFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            
            // Final validation
            if (thumbnailFile.size === 0) {
              reject(new Error('Thumbnail file has 0 bytes after creation'));
              return;
            }
            
            resolve(thumbnailFile);
          } else {
            reject(new Error('Failed to create thumbnail blob'));
          }
        },
        'image/jpeg',
        0.7 // 70% quality
      );
    };
    
    img.onerror = (e) => {
      clearTimeout(timeoutId);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };

    // Set the image source
    try {
      objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;
      
    } catch (err) {
      clearTimeout(timeoutId);
      reject(new Error('Failed to set image source'));
    }
  });
} 