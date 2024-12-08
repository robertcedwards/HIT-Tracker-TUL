import React, { useEffect } from 'react';
import { X, CheckCircle, Clock, BarChart2, Info } from 'lucide-react';

interface InfoModalProps {
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ onClose }) => {
  // Close modal on Esc key press
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Close modal on outside click
  const handleOutsideClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.currentTarget === event.target) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" 
      onClick={handleOutsideClick}
    >
      <div className="relative bg-white rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-500 hover:text-gray-700"
        >
          <X size={24} />
        </button>
        
        <h1 className="text-2xl font-bold mb-6">How to Use Hit Flow</h1>
        
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-semibold mb-2 flex items-center">
              <CheckCircle className="mr-2 text-green-500" size={24} />
              Exercise Tracking
            </h2>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>Each exercise has a dedicated row in the table</li>
              <li>Enter the weight you're using for each exercise</li>
              <li>Use the timer to track your time under load</li>
              <li>Your progress is automatically saved after each session</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2 flex items-center">
              <Clock className="mr-2 text-yellow-500" size={24} />
              Timer Features
            </h2>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>Start/stop timer for each exercise independently</li>
              <li>Audio countdown alerts when approaching your previous time</li>
              <li>Customize countdown settings with the timer settings button</li>
              <li>The timer shows both current time and remaining time to beat your previous record</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2 flex items-center">
              <BarChart2 className="mr-2 text-purple-500" size={24} />
              Progress Tracking
            </h2>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>View your progress graph at the bottom of the page</li>
              <li>Track both weight and time progression over time</li>
              <li>All data is saved locally in your browser</li>
              <li>Previous session data is shown for easy reference</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2 flex items-center">
              <CheckCircle className="mr-2 text-green-500" size={24} />
              Tips
            </h2>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>Enter weights before starting your set</li>
              <li>Use the audio countdown to help maintain intensity</li>
              <li>Track your sessions consistently for better progress visualization</li>
              <li>Check the graph regularly to ensure progressive overload</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}; 