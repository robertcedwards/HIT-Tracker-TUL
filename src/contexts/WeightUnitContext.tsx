import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type WeightUnit = 'lbs' | 'kg';

interface WeightUnitContextType {
  weightUnit: WeightUnit;
  toggleWeightUnit: () => void;
  convertWeight: (weight: number) => number;
  formatWeight: (weight: number) => string;
}

const WeightUnitContext = createContext<WeightUnitContextType | undefined>(undefined);

export function WeightUnitProvider({ children }: { children: ReactNode }) {
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(() => {
    const stored = localStorage.getItem('weightUnit');
    return (stored as WeightUnit) || 'lbs';
  });

  useEffect(() => {
    localStorage.setItem('weightUnit', weightUnit);
  }, [weightUnit]);

  const toggleWeightUnit = () => {
    setWeightUnit(prev => prev === 'lbs' ? 'kg' : 'lbs');
  };

  const convertWeight = (weight: number) => {
    return weightUnit === 'kg' ? Math.round(weight / 2.205) : weight;
  };

  const formatWeight = (weight: number) => {
    return `${convertWeight(weight)}${weightUnit}`;
  };

  return (
    <WeightUnitContext.Provider value={{ weightUnit, toggleWeightUnit, convertWeight, formatWeight }}>
      {children}
    </WeightUnitContext.Provider>
  );
}

export function useWeightUnit() {
  const context = useContext(WeightUnitContext);
  if (context === undefined) {
    throw new Error('useWeightUnit must be used within a WeightUnitProvider');
  }
  return context;
} 