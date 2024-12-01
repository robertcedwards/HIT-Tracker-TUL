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
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-lg">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">How to Use the Fitness Tracker</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-lg"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-6">
            <section>
              <h3 className="text-lg font-semibold mb-2 flex items-center">
                <Info className="mr-2 text-blue-500" size={24} />
                Overview
              </h3>
              <p className="text-gray-600">
                This app helps you track your high-intensity training sessions, focusing on time under load
                and weight progression for various exercises. It's designed for protocols like SuperSlow
                or other time-based strength training methods.
              </p>
              <p className="text-gray-600">
                Data is stored locally in your browser using localStorage. For more updates, check out my Warpcast: 
                <a href="https://warpcast.com/0xhashbrown" className="text-blue-500 underline"> @0xhashbrown</a>.
              </p>
              <p className="text-gray-600">
                It was built using <a href="https://srcbook.com" className="text-blue-500 underline">srcbook.com</a>.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2 flex items-center">
                <CheckCircle className="mr-2 text-green-500" size={24} />
                Exercise Tracking
              </h3>
              <ul className="list-disc list-inside space-y-2 text-gray-600">
                <li>Each exercise has a dedicated row in the table</li>
                <li>Enter the weight you're using for each exercise</li>
                <li>Use the timer to track your time under load</li>
                <li>Your progress is automatically saved after each session</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2 flex items-center">
                <Clock className="mr-2 text-yellow-500" size={24} />
                Timer Features
              </h3>
              <ul className="list-disc list-inside space-y-2 text-gray-600">
                <li>Start/stop timer for each exercise independently</li>
                <li>Audio countdown alerts when approaching your previous time</li>
                <li>Customize countdown settings with the timer settings button</li>
                <li>The timer shows both current time and remaining time to beat your previous record</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2 flex items-center">
                <BarChart2 className="mr-2 text-purple-500" size={24} />
                Progress Tracking
              </h3>
              <ul className="list-disc list-inside space-y-2 text-gray-600">
                <li>View your progress graph at the bottom of the page</li>
                <li>Track both weight and time progression over time</li>
                <li>All data is saved locally in your browser</li>
                <li>Previous session data is shown for easy reference</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2 flex items-center">
                <CheckCircle className="mr-2 text-green-500" size={24} />
                Tips
              </h3>
              <ul className="list-disc list-inside space-y-2 text-gray-600">
                <li>Enter weights before starting your set</li>
                <li>Use the audio countdown to help maintain intensity</li>
                <li>Track your sessions consistently for better progress visualization</li>
                <li>Check the graph regularly to ensure progressive overload</li>
              </ul>
            </section>
          </div>

          <div className="mt-6 pt-6 border-t">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Got it!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}; 