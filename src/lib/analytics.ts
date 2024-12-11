declare global {
  interface Window {
    umami?: {
      track: (eventName: string, data?: Record<string, any>) => void;
    };
  }
}

type EventName = 
  | 'toggle_weight_unit'
  | 'start_timer'
  | 'stop_timer'
  | 'add_exercise'
  | 'delete_exercise'
  | 'toggle_sound'
  | 'export_data'
  | 'change_weight'
  | 'clear_weight'; 

export const trackEvent = (eventName: EventName, data?: Record<string, any>) => {
  try {
    window.umami?.track(eventName, data);
  } catch (error) {
    console.warn('Analytics tracking failed:', error);
  }
}; 