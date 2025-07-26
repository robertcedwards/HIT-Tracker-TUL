# Auto-Fill Dosage Feature

## Overview

The Auto-Fill Dosage feature automatically uses recommended dosages from supplement databases (DSLD) when adding supplements to your personal list. This eliminates the need to manually look up and enter dosage information for most supplements.

## How It Works

### 🎯 **Smart Dosage Logic**

When you search for supplements and click "Add":

1. **Custom Override First**: If you've entered a dosage in the override field, that value is used
2. **API Default Second**: If no override is set, the supplement's recommended dosage from the database is used
3. **No Dosage Third**: If neither is available, the supplement is added without a specific dosage

### 📱 **User Interface**

#### **Search Results Display**
- Supplements with recommended dosages show: **"Recommended: XXXmg"** in green text
- Add buttons display the dosage that will be used: **"Add (1000mg)"**
- Visual indication helps users understand what dosage will be applied

#### **Dosage Override Field**
- Appears when search results are found
- Allows users to override recommended dosages
- Clear instructions: "Leave empty to use recommended dosages"
- Updates Add button text dynamically to show override dosage

#### **Smart Button Text**
- **"Add (1000mg)"** - Using API recommended dosage
- **"Add (500mg)"** - Using user override dosage  
- **"Add"** - No dosage available

## Benefits

### 🚀 **For Users**
- **Time Saving**: No need to research supplement dosages
- **Accuracy**: Uses manufacturer and research-backed recommendations
- **Flexibility**: Can override with custom dosages when needed
- **Transparency**: Always shows which dosage will be used before adding

### 📊 **For Data Quality**
- **Consistent Dosages**: Standardizes dosage information across users
- **Reduced Errors**: Eliminates manual entry mistakes
- **Better Tracking**: More supplements have dosage information for analytics

## Examples

### Example 1: Using API Dosage
```
Search: "Vitamin D"
Results: 
- Vitamin D3 2000 IU
  Recommended: 2000mg
  [Add (2000mg)] ← Uses API dosage
```

### Example 2: Using Override Dosage
```
Search: "Vitamin D"
Override: 1000mg
Results:
- Vitamin D3 2000 IU  
  Recommended: 2000mg
  [Add (1000mg)] ← Uses override dosage
```

### Example 3: No Recommended Dosage
```
Search: "Custom Supplement"
Results:
- Custom Supplement X
  [Add] ← No dosage information available
```

## Technical Implementation

### **Data Sources**
- **DSLD Database**: FDA's Dietary Supplement Label Database provides manufacturer dosages
- **Local Database**: Previously added supplements with their stored default dosages
- **User Input**: Manual override values

### **Dosage Priority Logic**
```typescript
const dosageToUse = customDosage 
  ? customDosage 
  : (supplement.defaultDosageMg ? String(supplement.defaultDosageMg) : undefined);
```

### **UI Components Enhanced**
1. **Search Results**: Show recommended dosages with green highlighting
2. **Add Buttons**: Dynamic text showing actual dosage to be used
3. **Override Field**: Prominent placement with helpful instructions
4. **Visual Feedback**: Real-time updates as user types override values

## User Workflows

### **Standard Workflow (API Dosage)**
1. Search for supplement (e.g., "Vitamin C")
2. See recommended dosage in results
3. Click "Add (1000mg)" 
4. Supplement added with 1000mg dosage automatically

### **Override Workflow (Custom Dosage)**
1. Search for supplement
2. Enter custom dosage in override field (e.g., 500)
3. Notice Add button changes to "Add (500mg)"
4. Click Add button
5. Supplement added with custom 500mg dosage

### **Research Workflow (No Dosage)**
1. Search for less common supplement
2. No recommended dosage shown
3. Either enter override dosage or add without dosage
4. Can edit dosage later in "My Supplements" table

## Edge Cases Handled

### **Empty Override Field**
- Empty string is treated as "no override"
- Falls back to API dosage or no dosage
- Prevents adding supplements with 0mg dosage

### **Invalid Override Values**
- Non-numeric values are ignored
- Negative values are prevented by input validation
- Very large values are accepted (for high-dose supplements)

### **API Data Variations**
- Handles missing `defaultDosageMg` fields gracefully
- Works with both local and DSLD supplement sources
- Consistent behavior across different data sources

## Future Enhancements

### **Planned Features**
1. **Dosage Recommendations**: AI-powered suggestions based on user profile
2. **Unit Conversion**: Support for IU, mcg, and other units
3. **Dosage History**: Track user's preferred dosages over time
4. **Range Recommendations**: Show dosage ranges instead of single values
5. **Interaction Warnings**: Alert users about potentially conflicting dosages

### **Analytics Integration**
- Track how often API dosages vs. overrides are used
- Identify supplements needing better dosage data
- Monitor user satisfaction with auto-filled dosages

## Accessibility

- **Screen Readers**: Clear labels and ARIA descriptions for dosage fields
- **Keyboard Navigation**: Tab order includes override field and Add buttons
- **Visual Indicators**: Color and text convey dosage information
- **Mobile Optimized**: Touch-friendly controls with adequate spacing

## Testing

### **Manual Testing Scenarios**
1. Search for supplements with API dosages
2. Search for supplements without API dosages  
3. Use override field with various values
4. Clear override field and verify fallback to API dosage
5. Add multiple supplements with different dosage sources

### **Error Conditions**
- Network failures during supplement search
- Malformed API responses missing dosage data
- User enters non-numeric override values
- Very large or very small dosage values

This feature significantly enhances the supplement tracking experience by reducing manual data entry while maintaining user control and transparency. 