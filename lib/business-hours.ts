// lib/business-hours.ts

export interface BusinessHoursStatus {
  isOnline: boolean;
  message: string;
}

export function checkBusinessHours(): BusinessHoursStatus {
  // Get current time in West Africa Time (Africa/Lagos - UTC+1)
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Africa/Lagos',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  };

  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(now);
  
  let weekday = '';
  let hour = 0;

  parts.forEach((part) => {
    if (part.type === 'weekday') weekday = part.value;
    if (part.type === 'hour') hour = parseInt(part.value, 10);
  });

  const isWeekend = weekday === 'Sat' || weekday === 'Sun';
  const isWorkingHours = hour >= 9 && hour < 17;

  if (!isWeekend && isWorkingHours) {
    return {
      isOnline: true,
      message: 'Our support agents are currently online.',
    };
  }

  // Calculate next return time
  let nextReturn = new Date(now);
  if (isWeekend) {
    const daysUntilMonday = weekday === 'Sat' ? 2 : 1;
    nextReturn.setDate(now.getDate() + daysUntilMonday);
  } else if (hour >= 17) {
    // Past 5 PM on a weekday, resumes next day (or Monday if Friday)
    const daysToAdd = weekday === 'Fri' ? 3 : 1;
    nextReturn.setDate(now.getDate() + daysToAdd);
  }

  const dateOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'Africa/Lagos',
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  };

  const formattedReturnDate = new Intl.DateTimeFormat('en-US', dateOptions).format(nextReturn);

  return {
    isOnline: false,
    message: `Our human support agents are currently offline. We resume operations on ${formattedReturnDate} at 9:00 AM WAT. Your ticket has been logged and queued for our team.`,
  };
}
