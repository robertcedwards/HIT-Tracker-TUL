import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Play, Square, Settings } from 'lucide-react';
import { TimeSettings } from './TimeSettings';

interface TimerProps {
  previousTime: number;
  onComplete: (newTime: number) => void;
}

export const Timer = forwardRef<{ resetTimer: () => void }, TimerProps>(
  function Timer({ previousTime, onComplete }, ref) {
    const [isRunning, setIsRunning] = useState(false);
    const [time, setTime] = useState(0);
    const [showSettings, setShowSettings] = useState(false);
    
    // Load settings from localStorage
    const [settings, setSettings] = useState(() => {
      const saved = localStorage.getItem('timerSettings');
      return saved ? JSON.parse(saved) : {
        soundEnabled: true,
        countdownTime: 10
      };
    });

    const resetTimer = useCallback(() => {
      setTime(0);
      setIsRunning(false);
    }, []);

    useImperativeHandle(ref, () => ({
      resetTimer
    }));

    const toggleTimer = useCallback(() => {
      if (isRunning) {
        setIsRunning(false);
        onComplete(time);
      } else {
        setIsRunning(true);
      }
    }, [isRunning, time, onComplete]);

    // Sound effect for countdown
    useEffect(() => {
      if (!isRunning || !settings.soundEnabled) return;
      
      const timeUntilPrevious = previousTime - time;
      if (timeUntilPrevious > 0 && timeUntilPrevious <= settings.countdownTime) {
        const audio = new Audio('/beep.mp3');
        audio.play().catch(e => console.warn('Audio play failed:', e));
      }
    }, [time, previousTime, isRunning, settings]);

    useEffect(() => {
      let interval: NodeJS.Timeout;
      if (isRunning) {
        interval = setInterval(() => {
          setTime(t => t + 1);
        }, 1000);
      }
      return () => clearInterval(interval);
    }, [isRunning]);

    const handleSettingsChange = (newSettings: typeof settings) => {
      setSettings(newSettings);
      localStorage.setItem('timerSettings', JSON.stringify(newSettings));
    };

    return (
      <div className="flex flex-col items-center gap-4">
        <div className="text-4xl font-mono">
          {time} s
          {isRunning && previousTime > 0 && time <= previousTime && (
            <span className="text-sm ml-2 text-gray-500">
              ({previousTime - time}s until previous)
            </span>
          )}
        </div>
        <div className="text-sm text-gray-500">
          Previous: {previousTime} s
        </div>
        <div className="flex gap-2">
          <button
            onClick={toggleTimer}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            {isRunning ? <Square size={20} /> : <Play size={20} />}
            {isRunning ? 'Stop' : 'Start'}
          </button>
          {isRunning && (
            <button
              onClick={resetTimer}
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              Reset
            </button>
          )}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            title="Timer Settings"
          >
            <Settings size={20} />
          </button>
        </div>

        {showSettings && (
          <TimeSettings
            settings={settings}
            onClose={() => setShowSettings(false)}
            onChange={handleSettingsChange}
          />
        )}
      </div>
    );
  }
);