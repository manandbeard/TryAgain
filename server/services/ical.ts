import axios from 'axios';
import ical from 'node-ical';
import { CalendarEvent, MealEvent } from '@shared/types';

interface ICalObject {
  [key: string]: any;
}

// Function to fetch iCal data from URL
export const fetchICalData = async (url: string): Promise<string> => {
  try {
    // Validate URL
    if (!url) {
      throw new Error('Calendar URL is empty');
    }

    // Try to parse URL to validate format
    try {
      new URL(url);
    } catch (e) {
      throw new Error('Invalid calendar URL format');
    }

    console.log(`Attempting to fetch calendar from: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'text/calendar,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Family-Calendar-Dashboard/1.0',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(10000)
    });

    console.log(`Calendar fetch response status: ${response.status}`);
    console.log(`Calendar fetch response type: ${response.headers.get('content-type')}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Calendar URL not found - please verify the URL is correct and accessible');
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error('Calendar access denied - please check permissions');
      }
      throw new Error(`Failed to fetch calendar: ${response.status} ${response.statusText}`);
    }

    const data = await response.text();
    console.log(`Calendar data length: ${data.length}`);
    console.log(`Calendar data preview: ${data.substring(0, 200)}`);

    if (!data.includes('BEGIN:VCALENDAR')) {
      throw new Error('Invalid iCal format - response does not contain calendar data');
    }

    return data;
  } catch (error) {
    console.error('Failed to fetch iCal data:', error);
    throw error;
  }
};

// Function to convert iCal data to CalendarEvents
export const parseICalToEvents = (
  icalData: ICalObject, 
  owner: string, 
  ownerColor: string
): CalendarEvent[] => {
  const events: CalendarEvent[] = [];

  for (const k in icalData) {
    const event = icalData[k];
    if (event.type !== 'VEVENT') continue;

    if (event.start && event.summary) {
      const calEvent: CalendarEvent = {
        id: event.uid || `${owner}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        title: event.summary,
        start: event.start,
        end: event.end || new Date(event.start.getTime() + 60 * 60 * 1000), // Default 1 hour
        description: event.description || '',
        location: event.location || '',
        owner,
        ownerColor
      };
      events.push(calEvent);
    }
  }

  return events;
};

// Function to convert iCal data to MealEvents
export const parseICalToMeals = (icalData: ICalObject): MealEvent[] => {
  const meals: MealEvent[] = [];

  for (const k in icalData) {
    const event = icalData[k];
    if (event.type !== 'VEVENT') continue;

    if (event.start && event.summary) {
      const mealEvent: MealEvent = {
        id: event.uid || `meal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        title: event.summary,
        date: new Date(event.start.setHours(0, 0, 0, 0)) // Set to midnight for date comparison
      };
      meals.push(mealEvent);
    }
  }

  return meals;
};

// Function to get events for specific date range
export const getEventsForDateRange = (
  events: CalendarEvent[], 
  startDate: Date, 
  endDate: Date
): CalendarEvent[] => {
  // Set times to start and end of day
  const dayStart = new Date(startDate);
  dayStart.setHours(0, 0, 0, 0);
  
  const dayEnd = new Date(endDate);
  dayEnd.setHours(23, 59, 59, 999);

  return events.filter(event => {
    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end || event.start);
    
    // Set start/end times appropriately for comparison
    eventStart.setHours(0, 0, 0, 0);
    eventEnd.setHours(23, 59, 59, 999);
    
    // Event should be included if it starts on or before the end of the day
    // AND ends on or after the start of the day
    return eventStart <= dayEnd && eventEnd >= dayStart;
  }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
};

// Function to get meals for specific date
export const getMealForDate = (
  meals: MealEvent[], 
  date: Date
): MealEvent | undefined => {
  const targetDate = new Date(date.setHours(0, 0, 0, 0));
  return meals.find(meal => {
    const mealDate = new Date(meal.date.setHours(0, 0, 0, 0));
    return mealDate.getTime() === targetDate.getTime();
  });
};