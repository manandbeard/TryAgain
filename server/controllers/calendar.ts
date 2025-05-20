import ical from 'ical';
import { IStorage } from '../storage';
import { fetchICalData, parseICalToEvents, parseICalToMeals, getEventsForDateRange, getMealForDate } from '../services/ical';
import { DayEvents, CalendarEvent, MealEvent } from '@shared/types';
import { addDays, startOfWeek, endOfWeek, format } from 'date-fns';

export class CalendarController {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  // Get all events for the current week
  async getWeeklyEvents(date?: string): Promise<DayEvents[]> {
    const currentDate = date ? new Date(date) : new Date();
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Start on Monday
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 }); // End on Sunday

    // Get all family members and their calendar URLs
    const familyMembers = await this.storage.getFamilyMembers();
    const mealCalendarData = await this.storage.getMealCalendar();

    // Fetch events from all calendars
    const allEvents: CalendarEvent[] = [];
    let allMeals: MealEvent[] = [];

    // Load events from family member calendars
    for (const member of familyMembers) {
      if (member.calendarUrl) {
        try {
          console.log(`Fetching calendar for ${member.name}...`);
          const icalData = await fetchICalData(member.calendarUrl);
          console.log(`Successfully fetched calendar data for ${member.name}`);
          
          const parsedData = ical.parseICS(icalData);
          console.log(`Parsed calendar data for ${member.name}:`, Object.keys(parsedData).length, 'entries');
          
          const events = parseICalToEvents(parsedData, member.name, member.color);
          console.log(`Found ${events.length} events for ${member.name}`);
          allEvents.push(...events);
        } catch (error) {
          console.error(`Failed to load calendar for ${member.name}:`, error);
          // Continue with other calendars even if one fails
        }
      } else {
        console.log(`No calendar URL configured for ${member.name}`);
      }
    }

    // Load meals from meal calendar if exists
    if (mealCalendarData?.active && mealCalendarData.calendarUrl) {
      try {
        const mealIcalData = await fetchICalData(mealCalendarData.calendarUrl);
        allMeals = parseICalToMeals(mealIcalData);
      } catch (error) {
        console.error('Failed to load meal calendar:', error);
      }
    }

    // Create day objects for each day of the week
    const days: DayEvents[] = [];
    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);
      day.setHours(0, 0, 0, 0); // Set to start of day
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);

      // Get events for this day
      const dayEvents = getEventsForDateRange(allEvents, day, dayEnd);
      console.log(`Found ${dayEvents.length} events for ${format(day, 'EEEE')}`);
      
      // Get meal for this day
      const meal = getMealForDate(allMeals, day);

      days.push({
        date: day,
        dayOfWeek: format(day, 'EEEE'),
        dayOfMonth: parseInt(format(day, 'd')),
        month: format(day, 'MMMM'),
        meal,
        events: dayEvents
      });
    }

    return days;
  }
}
